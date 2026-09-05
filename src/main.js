// 主入口：串起 UI 与核心逻辑
import { PALETTES, DEFAULT_PALETTE_ID } from './palettes.js'
import { loadImage, rasterizeToGrid, mapToPalette, tallyUsage, computeContentBounds } from './image.js'
import { limitPaletteToUsage } from './color.js'
import { renderPattern, pickCell } from './render.js'
import { downloadCanvasPng, downloadCsv } from './export.js'
import { exportPdf } from './pdf.js'

// ---- 状态 ----
const state = {
  file: null,
  img: null,
  gridW: 58,
  gridH: 58,
  fitMode: 'cover',
  paletteId: DEFAULT_PALETTE_ID,
  maxColors: 24,
  algo: 'ciede2000',
  skipTransparent: true,
  dither: false,
  heavyGrid: 5,
  exportName: '您的拼豆',  // 导出文件名前缀（用户可改）
  aspectLock: true,     // 默认锁定
  imgAspect: null,      // 上传后记录（去透明边后的）图像长宽比 = w/h
  // —— 编辑相关 —— //
  editTool: null,       // null | 'brush' | 'fill'
  editColorIdx: null,   // 目标色在 paletteLab 中的索引
  pickingColor: false,  // 是否处于「吸色一次」模式
  history: [],          // 撤销栈：Int32Array 快照
  isPainting: false,    // 笔画拖拽中
  paintedThisStroke: null,  // 本次拖拽已绘的格子集（Set of "x,y" 字符串）
  strokeValue: null,        // 本次拖拽写入的值：色号索引，擦除时为 -1
  // 生成结果
  indexMap: null,
  paletteLab: null,
  stats: null, // { rows, total }
}

const MAX_FILE_MB = 10
const MAX_IMG_EDGE = 4000

// ---- DOM ----
const $ = sel => document.querySelector(sel)
const dropzone = $('#dropzone')
const fileInput = $('#file-input')
const gridWInput = $('#grid-w')
const gridHInput = $('#grid-h')
const fitModeSel = $('#fit-mode')
const paletteSel = $('#palette-select')
const maxColorsInput = $('#max-colors')
const algoSel = $('#algo-select')
const skipTransparentToggle = $('#skip-transparent')
const ditherToggle = $('#dither-toggle')
const ditherHint = $('#dither-hint')
const heavyGridInput = $('#heavy-grid')
const aspectLockBtn = $('#aspect-lock-btn')
const btnGenerate = $('#btn-generate')
const canvas = $('#preview-canvas')
const emptyHint = $('#empty-hint')
const hoverCell = $('#hover-cell')
const statsTableBody = document.querySelector('#stats-table tbody')
const statsSummary = $('#stats-summary')
// 编辑工具栏
const editToolbar = $('#edit-toolbar')
const toolBrushBtn = $('#tool-brush')
const toolFillBtn = $('#tool-fill')
const toolEraserBtn = $('#tool-eraser')
const toolPickerBtn = $('#tool-picker')
const colorPickerBtn = $('#color-picker-btn')
const targetSwatch = $('#target-swatch')
const colorPickerLabel = $('#color-picker-label')
const undoBtn = $('#undo-btn')
const editHint = $('#edit-hint')
// 色板下拉菜单
const paletteMenu = $('#palette-menu')
const paletteSearch = $('#palette-search')
const paletteList = $('#palette-list')

const btnExportPngCodes = $('#btn-export-png-codes')
const btnExportCsv = $('#btn-export-csv')
const btnExportPdf = $('#btn-export-pdf')
const exportNameInput = $('#export-name')
const exportNamePreview = $('#export-name-preview')
const previewStage = $('#preview-stage')
const canvasWrap = $('#canvas-wrap')

// ---- 初始化 ----
function initPaletteSelect() {
  paletteSel.innerHTML = ''
  for (const p of Object.values(PALETTES)) {
    const opt = document.createElement('option')
    opt.value = p.id
    // 若名称已含"色"字（如"国产常用 74 色"）就不再重复色数，否则附上"(N 色)"
    opt.textContent = /\d+\s*色/.test(p.name)
      ? p.name
      : `${p.name} (${p.colors.length} 色)`
    opt.title = p.description || p.name  // hover 显示完整描述
    paletteSel.appendChild(opt)
  }
  paletteSel.value = state.paletteId
}

// ---- 上传 ----
function bindUpload() {
  dropzone.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', e => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  })
  ;['dragenter', 'dragover'].forEach(ev =>
    dropzone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation()
      dropzone.classList.add('dragover')
    })
  )
  ;['dragleave', 'drop'].forEach(ev =>
    dropzone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation()
      dropzone.classList.remove('dragover')
    })
  )
  dropzone.addEventListener('drop', e => {
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  })
}

async function handleFile(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    alert('仅支持 PNG / JPG / WebP')
    return
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    alert(`文件过大（超过 ${MAX_FILE_MB}MB）`)
    return
  }
  try {
    const img = await loadImage(file)
    const edge = Math.max(img.naturalWidth, img.naturalHeight)
    if (edge > MAX_IMG_EDGE) {
      alert(`图片长边 ${edge}px 超过 ${MAX_IMG_EDGE}px，将自动缩放处理`)
    }
    state.file = file
    state.img = img
    updateDropzonePreview(file, img)
    // —— 按图片长宽比自动预设图纸尺寸（把当前宽/高的最大值当"长边目标"） —— //
    autoPresetGridFromImage(img)
    btnGenerate.disabled = false
  } catch (e) {
    console.error(e)
    alert('图片加载失败')
  }
}

// 依据图像内容（去透明边后）设置初始 gridW/gridH，保留原本较大的一边作为长边目标
function autoPresetGridFromImage(img) {
  const bounds = computeContentBounds(img)
  const effW = bounds ? bounds.w : img.naturalWidth
  const effH = bounds ? bounds.h : img.naturalHeight
  if (!effW || !effH) return
  const aspect = effW / effH
  state.imgAspect = aspect

  const target = Math.max(state.gridW, state.gridH)   // 保留用户已设的"长边"
  let newW, newH
  if (aspect >= 1) {                                   // 横图
    newW = target
    newH = Math.round(target / aspect)
  } else {                                             // 竖图
    newH = target
    newW = Math.round(target * aspect)
  }
  newW = clamp(newW, 8, 200)
  newH = clamp(newH, 8, 200)
  state.gridW = newW
  state.gridH = newH
  gridWInput.value = newW
  gridHInput.value = newH
  updateExportNamePreview()
}

function updateDropzonePreview(file, img) {
  dropzone.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'dropzone-preview'
  const thumb = document.createElement('img')
  thumb.src = URL.createObjectURL(file)
  thumb.onload = () => URL.revokeObjectURL(thumb.src)
  const meta = document.createElement('div')
  meta.className = 'dropzone-meta'
  meta.innerHTML = `
    <div class="dz-filename">${escapeHtml(file.name)}</div>
    <div class="dz-size">${img.naturalWidth}×${img.naturalHeight} · ${(file.size / 1024).toFixed(1)} KB</div>
    <button class="btn btn-mini" id="btn-reupload">重新选择</button>
  `
  wrap.appendChild(thumb)
  wrap.appendChild(meta)
  dropzone.appendChild(wrap)
  document.getElementById('btn-reupload').addEventListener('click', ev => {
    ev.stopPropagation()
    resetDropzone()
  })
}

function resetDropzone() {
  state.file = null
  state.img = null
  btnGenerate.disabled = true
  dropzone.innerHTML = `
    <input type="file" id="file-input" accept="image/png,image/jpeg,image/webp" hidden />
    <div class="dropzone-hint">
      <div class="dropzone-icon">＋</div>
      <div>点击或拖拽图片到此处</div>
      <div class="hint-small">PNG / JPG / WebP · ≤ 10MB</div>
    </div>`
  // 重新绑定 file input（因为 innerHTML 换了）
  const newInput = document.getElementById('file-input')
  newInput.addEventListener('change', e => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  })
}

// ---- 参数绑定 ----
function bindSettings() {
  gridWInput.addEventListener('change', () => {
    const v = clamp(parseInt(gridWInput.value, 10), 8, 200)
    state.gridW = v
    gridWInput.value = v
    if (state.aspectLock) syncPartner('h')
    updateExportNamePreview()
  })
  gridHInput.addEventListener('change', () => {
    const v = clamp(parseInt(gridHInput.value, 10), 8, 200)
    state.gridH = v
    gridHInput.value = v
    if (state.aspectLock) syncPartner('w')
    updateExportNamePreview()
  })
  aspectLockBtn.addEventListener('click', () => {
    state.aspectLock = !state.aspectLock
    aspectLockBtn.classList.toggle('locked', state.aspectLock)
    // 首次锁定：若还没有 imgAspect，用当前 W/H 比作为基准
    if (state.aspectLock && !state.imgAspect) {
      state.imgAspect = state.gridW / state.gridH
    }
  })
  fitModeSel.addEventListener('change', () => { state.fitMode = fitModeSel.value })
  paletteSel.addEventListener('change', () => { state.paletteId = paletteSel.value })
  maxColorsInput.addEventListener('change', () => {
    state.maxColors = clamp(parseInt(maxColorsInput.value, 10), 2, 200)
    maxColorsInput.value = state.maxColors
  })
  algoSel.addEventListener('change', () => { state.algo = algoSel.value })
  skipTransparentToggle.addEventListener('change', () => { state.skipTransparent = skipTransparentToggle.checked })
  ditherToggle.addEventListener('change', () => {
    state.dither = ditherToggle.checked
    // 用 class 切换（CSS 里定义了展开/收起过渡动画）
    ditherHint.classList.toggle('expanded', ditherToggle.checked)
  })
  // 深色线间距：改动后如果已有图纸就实时重绘（不必重新生成）
  heavyGridInput.addEventListener('input', () => {
    state.heavyGrid = clamp(parseInt(heavyGridInput.value, 10) || 0, 0, 50)
    heavyGridInput.value = state.heavyGrid
    if (state.indexMap) rerender()
  })
}

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

// 依据锁定的长宽比同步另一边
// which: 要更新哪个值（'w' 表示更新宽以匹配当前高；'h' 表示更新高以匹配当前宽）
function syncPartner(which) {
  const aspect = state.imgAspect || (state.gridW / state.gridH)
  if (!aspect) return
  if (which === 'h') {
    const nh = clamp(Math.round(state.gridW / aspect), 8, 200)
    state.gridH = nh
    gridHInput.value = nh
  } else {
    const nw = clamp(Math.round(state.gridH * aspect), 8, 200)
    state.gridW = nw
    gridWInput.value = nw
  }
  updateExportNamePreview()
}

// ---- 导出文件名 ----
const DEFAULT_EXPORT_NAME = '您的拼豆'
// 去掉各平台文件名里的非法字符（/ \ : * ? " < > |）和首尾空白/点
function sanitizeFilename(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 60)
}
// kind: '图纸集' | '色号图' | '用豆统计'；ext: 'pdf' | 'png' | 'csv'
function buildExportFilename(kind, ext) {
  const prefix = sanitizeFilename(state.exportName) || DEFAULT_EXPORT_NAME
  return `${prefix}-${state.gridW}×${state.gridH}-${kind}.${ext}`
}
function updateExportNamePreview() {
  exportNamePreview.textContent =
    `→ ${buildExportFilename('图纸集', 'pdf')}（PNG / CSV 同前缀）`
}
function bindExportName() {
  exportNameInput.addEventListener('input', () => {
    state.exportName = exportNameInput.value
    updateExportNamePreview()
  })
  // 失焦时把清理后的结果回填，让用户看到实际生效的名字
  exportNameInput.addEventListener('blur', () => {
    const clean = sanitizeFilename(exportNameInput.value)
    state.exportName = clean || DEFAULT_EXPORT_NAME
    exportNameInput.value = state.exportName
    updateExportNamePreview()
  })
  updateExportNamePreview()
}

// ---- 悬停信息 ----
// 说明栏（help）常驻显示；hover 到格子时把「格子信息」放在 help 左边
function bindHover() {
  canvas.addEventListener('mousemove', e => {
    if (!state.indexMap) return
    const { gx, gy } = pickCell(canvas, e, state.gridW, state.gridH)
    if (gx < 0 || gy < 0 || gx >= state.gridW || gy >= state.gridH) {
      hoverCell.textContent = ''
      return
    }
    const idx = state.indexMap[gy * state.gridW + gx]
    if (idx < 0) {
      hoverCell.textContent = `(${gx + 1}, ${gy + 1}) · 空 ·`
    } else {
      const c = state.paletteLab[idx]
      hoverCell.innerHTML =
        `(${gx + 1}, ${gy + 1}) · <span class="swatch-inline" style="background:${c.hex}"></span> ${escapeHtml(c.code)} ${escapeHtml(c.name || '')} ·`
    }
  })
  canvas.addEventListener('mouseleave', () => { hoverCell.textContent = '' })
}

// ---- 生成 ----
btnGenerateSetup()
function btnGenerateSetup() {
  btnGenerate.addEventListener('click', async () => {
    if (!state.img) return
    btnGenerate.disabled = true
    btnGenerate.textContent = '生成中…'
    try {
      await new Promise(r => setTimeout(r, 10)) // 让 UI 更新
      const palette = PALETTES[state.paletteId].colors
      const { imageData } = rasterizeToGrid(state.img, state.gridW, state.gridH, state.fitMode)
      let { indexMap, paletteLab } = mapToPalette(imageData, palette, {
        skipTransparent: state.skipTransparent,
        dither: state.dither,
        algo: state.algo,
      })
      // 颜色数上限
      if (state.maxColors && state.maxColors > 0) {
        indexMap = limitPaletteToUsage(indexMap, paletteLab, state.maxColors)
      }
      state.indexMap = indexMap
      state.paletteLab = paletteLab
      state.stats = tallyUsage(indexMap, paletteLab)
      // 编辑：重置历史 + 重建色板菜单 + 显示编辑工具栏
      state.history = []
      state.editTool = null
      state.editColorIdx = null
      state.pickingColor = false
      toolBrushBtn.classList.remove('active')
      toolFillBtn.classList.remove('active')
      toolEraserBtn.classList.remove('active')
      toolPickerBtn.classList.remove('active')
      canvasWrap.classList.remove('tool-brush', 'tool-fill', 'tool-eraser', 'picking')
      buildPaletteMenu()
      updateColorPickerLabel()
      activateEditToolbar()
      updateEditHint()
      // 显示画布 + 重置视图
      canvasWrap.hidden = false
      resetView()
      rerender()
      renderStats()
      enableExportButtons(true)
      emptyHint.style.display = 'none'
    } catch (e) {
      console.error(e)
      alert('生成失败：' + e.message)
    } finally {
      btnGenerate.disabled = false
      btnGenerate.textContent = '生成图纸'
    }
  })
}

function rerender() {
  renderPattern(canvas, state.indexMap, state.paletteLab,
    state.gridW, state.gridH, state.heavyGrid)
}

function renderStats() {
  const { rows, total } = state.stats
  statsSummary.textContent =
    `总豆数 ${total.toLocaleString()} · 色种 ${rows.length} · 图纸 ${state.gridW}×${state.gridH}`
  statsTableBody.innerHTML = ''
  for (const r of rows) {
    const c = r.color
    const pct = total > 0 ? (r.count / total * 100).toFixed(1) : '0'
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><span class="swatch" style="background:${c.hex}"></span></td>
      <td class="mono">${c.code}</td>
      <td>${escapeHtml(c.name)}</td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="num">${pct}%</td>
    `
    statsTableBody.appendChild(tr)
  }
}

function enableExportButtons(enable) {
  btnExportPngCodes.disabled = !enable
  btnExportCsv.disabled = !enable
  btnExportPdf.disabled = !enable
}

// ---- 导出 ----
// CSS transform 只影响显示、不影响 canvas 像素，导出无需处理缩放
btnExportPngCodes.addEventListener('click', () => {
  if (!state.indexMap) return
  downloadCanvasPng(canvas, buildExportFilename('色号图', 'png'))
})
btnExportCsv.addEventListener('click', () => {
  if (!state.stats) return
  downloadCsv(state.stats.rows, state.stats.total, buildExportFilename('用豆统计', 'csv'))
})
btnExportPdf.addEventListener('click', async () => {
  if (!state.indexMap) return
  btnExportPdf.disabled = true
  const label = btnExportPdf.textContent
  btnExportPdf.textContent = '生成 PDF 中…'
  try {
    // 让 UI 更新一次再干活（避免"生成中"看不到）
    await new Promise(r => setTimeout(r, 10))
    exportPdf({
      indexMap: state.indexMap,
      paletteLab: state.paletteLab,
      width: state.gridW,
      height: state.gridH,
      stats: state.stats,
      paletteName: PALETTES[state.paletteId].name,
      algo: state.algo,
      filename: buildExportFilename('图纸集', 'pdf'),
    })
  } catch (e) {
    console.error(e)
    alert('PDF 导出失败：' + e.message)
  } finally {
    btnExportPdf.disabled = false
    btnExportPdf.textContent = label
  }
})

// —— 缩放 & 平移 —— //
// 缩放：鼠标滚轮；平移：鼠标右键拖动（左键留给编辑）；双击复位
state.zoom = 1
state.panX = 0
state.panY = 0
function applyViewTransform() {
  canvasWrap.style.transform =
    `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`
}
function resetView() {
  state.zoom = 1
  state.panX = 0
  state.panY = 0
  applyViewTransform()
}

// 滚轮：以鼠标位置为锚点缩放（zoom-at-cursor，直观）
previewStage.addEventListener('wheel', e => {
  if (!state.indexMap) return
  e.preventDefault()
  const rect = canvasWrap.getBoundingClientRect()
  // 鼠标相对于画布左上角（未 transform 的坐标）
  const mx = (e.clientX - rect.left) / state.zoom
  const my = (e.clientY - rect.top)  / state.zoom
  const oldZoom = state.zoom
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newZoom = clamp(+(state.zoom + delta).toFixed(2), 0.2, 4)
  state.zoom = newZoom
  // 保持鼠标下的点在缩放前后位置一致
  state.panX -= mx * (newZoom - oldZoom)
  state.panY -= my * (newZoom - oldZoom)
  applyViewTransform()
}, { passive: false })

// 右键拖动平移
let panState = null
previewStage.addEventListener('contextmenu', e => {
  // 屏蔽右键菜单（用来做拖拽）
  if (state.indexMap) e.preventDefault()
})
previewStage.addEventListener('pointerdown', e => {
  if (!state.indexMap) return
  if (e.button !== 2) return                  // 只响应鼠标右键
  e.preventDefault()
  panState = {
    startX: e.clientX, startY: e.clientY,
    origX: state.panX, origY: state.panY,
    pointerId: e.pointerId,
  }
  previewStage.setPointerCapture(e.pointerId)
  previewStage.classList.add('panning')
})
window.addEventListener('pointermove', e => {
  if (!panState) return
  state.panX = panState.origX + (e.clientX - panState.startX)
  state.panY = panState.origY + (e.clientY - panState.startY)
  applyViewTransform()
})
function endPan(e) {
  if (!panState) return
  try { previewStage.releasePointerCapture(panState.pointerId) } catch {}
  panState = null
  previewStage.classList.remove('panning')
}
window.addEventListener('pointerup', endPan)
window.addEventListener('pointercancel', endPan)

// 双击复位视图
previewStage.addEventListener('dblclick', resetView)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

// ==================================================================
// 编辑功能：笔画 / 填充 / 撤销 / 吸色 / 色板弹窗
// ==================================================================

function activateEditToolbar() {
  editToolbar.hidden = false
  undoBtn.disabled = state.history.length === 0
}
function pushHistorySnapshot() {
  if (!state.indexMap) return
  state.history.push(new Int32Array(state.indexMap))
  if (state.history.length > 100) state.history.shift()  // 上限 100 步
  undoBtn.disabled = false
}
function undo() {
  if (!state.history.length) return
  state.indexMap = state.history.pop()
  rerender()
  retallyStats()
  undoBtn.disabled = state.history.length === 0
}
function retallyStats() {
  if (!state.indexMap || !state.paletteLab) return
  state.stats = tallyUsage(state.indexMap, state.paletteLab)
  renderStats()
}

// —— 工具选择 —— //
function setTool(tool) {
  state.editTool = tool
  toolBrushBtn.classList.toggle('active', tool === 'brush')
  toolFillBtn.classList.toggle('active', tool === 'fill')
  toolEraserBtn.classList.toggle('active', tool === 'eraser')
  canvasWrap.classList.toggle('tool-brush', tool === 'brush')
  canvasWrap.classList.toggle('tool-fill', tool === 'fill')
  canvasWrap.classList.toggle('tool-eraser', tool === 'eraser')
  updateEditHint()
}
toolBrushBtn.addEventListener('click', () => setTool(state.editTool === 'brush' ? null : 'brush'))
toolFillBtn.addEventListener('click', () => setTool(state.editTool === 'fill' ? null : 'fill'))
toolEraserBtn.addEventListener('click', () => setTool(state.editTool === 'eraser' ? null : 'eraser'))
undoBtn.addEventListener('click', undo)

// —— 吸色按钮 —— //
function setPickingMode(on) {
  state.pickingColor = on
  toolPickerBtn.classList.toggle('active', on)
  canvasWrap.classList.toggle('picking', on)
  updateEditHint()
}
toolPickerBtn.addEventListener('click', () => setPickingMode(!state.pickingColor))

// —— 目标颜色 —— //
function setEditColor(idx) {
  state.editColorIdx = idx
  updateColorPickerLabel()
  paletteList.querySelectorAll('.palette-menu-item').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.idx) === idx)
  })
  updateEditHint()
}
function updateColorPickerLabel() {
  if (state.editColorIdx == null || !state.paletteLab) {
    // 未选色：按钮显示当前色板的名称
    targetSwatch.style.background = ''
    colorPickerBtn.classList.remove('has-color')
    const palName = PALETTES[state.paletteId]?.name || '选择目标颜色'
    colorPickerLabel.textContent = palName
    colorPickerLabel.classList.add('placeholder')
  } else {
    const c = state.paletteLab[state.editColorIdx]
    targetSwatch.style.background = c.hex
    colorPickerBtn.classList.add('has-color')
    colorPickerLabel.textContent = c.name ? `${c.code}  ${c.name}` : c.code
    colorPickerLabel.classList.remove('placeholder')
  }
}
function updateEditHint() {
  // 吸色模式独立提示，优先级最高
  if (state.pickingColor) {
    editHint.textContent = '吸色模式：点击画布任一格子吸取该色 · Esc 取消'
    return
  }
  // 擦除不需要目标色，单独提示
  if (state.editTool === 'eraser') {
    editHint.textContent = '✔ 点击 / 按住拖动画布 · 把格子擦成无色（无需选色）'
    return
  }
  const hasTool = !!state.editTool
  const hasColor = state.editColorIdx != null
  if (!hasTool && !hasColor) {
    editHint.textContent = '选一个工具和目标色后开始编辑 · Alt+点击画布可吸色'
  } else if (hasTool && !hasColor) {
    editHint.textContent = '⚠ 还需选择目标颜色 · 点击右边色卡按钮或用「吸色」'
  } else if (!hasTool && hasColor) {
    editHint.textContent = '⚠ 还需选择工具 · 点击左边「笔画」「填充」或「擦除」'
  } else {
    editHint.textContent = state.editTool === 'brush'
      ? '✔ 点击 / 按住拖动画布 · 把格子刷成目标色'
      : '✔ 点击画布 · 把相邻的同色区域填成目标色'
  }
}

// —— 色板下拉菜单 —— //
function buildPaletteMenu() {
  paletteList.innerHTML = ''
  if (!state.paletteLab || !state.paletteLab.length) {
    const empty = document.createElement('div')
    empty.className = 'palette-empty'
    empty.textContent = '（未生成图纸时无可选颜色）'
    paletteList.appendChild(empty)
    return
  }
  const frag = document.createDocumentFragment()
  state.paletteLab.forEach((c, idx) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'palette-menu-item'
    item.dataset.idx = idx
    item.dataset.code = c.code.toLowerCase()
    item.dataset.name = (c.name || '').toLowerCase()
    // 用 innerHTML 拼一次，比 append 多元素快
    item.innerHTML =
      `<span class="mi-swatch" style="background:${c.hex}"></span>` +
      `<span class="mi-code">${escapeHtml(c.code)}</span>` +
      `<span class="mi-name">${escapeHtml(c.name || '')}</span>` +
      `<span class="mi-hex">${c.hex.toUpperCase()}</span>`
    // 关键：pointerdown 阶段就选中，避免 click 之前有其它事件干扰
    item.addEventListener('pointerdown', evt => {
      evt.preventDefault()   // 保住 button 上的焦点/避免默认行为
      evt.stopPropagation()
      setEditColor(idx)
      closePaletteMenu()
    })
    frag.appendChild(item)
  })
  paletteList.appendChild(frag)
}
function openPaletteMenu() {
  if (!state.paletteLab) return
  paletteMenu.classList.add('open')
  paletteSearch.value = ''
  filterPaletteMenu('')
  // 已选色时滚动到当前项
  if (state.editColorIdx != null) {
    const el = paletteList.querySelector(`.palette-menu-item[data-idx="${state.editColorIdx}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }
  setTimeout(() => paletteSearch.focus(), 30)
}
function closePaletteMenu() {
  paletteMenu.classList.remove('open')
}
function togglePaletteMenu() {
  paletteMenu.classList.contains('open') ? closePaletteMenu() : openPaletteMenu()
}
function filterPaletteMenu(q) {
  const s = q.trim().toLowerCase()
  paletteList.querySelectorAll('.palette-menu-item').forEach(el => {
    const hit = !s || el.dataset.code.includes(s) || el.dataset.name.includes(s)
    el.dataset.hidden = hit ? 'false' : 'true'
  })
}
colorPickerBtn.addEventListener('click', e => {
  e.stopPropagation()
  togglePaletteMenu()
})
paletteSearch.addEventListener('input', () => filterPaletteMenu(paletteSearch.value))
// 点菜单外部关闭
document.addEventListener('click', e => {
  if (!paletteMenu.classList.contains('open')) return
  if (paletteMenu.contains(e.target) || colorPickerBtn.contains(e.target)) return
  closePaletteMenu()
})

// —— 画布编辑事件 —— //
function paintCell(gx, gy, colorIdx) {
  if (gx < 0 || gy < 0 || gx >= state.gridW || gy >= state.gridH) return false
  const i = gy * state.gridW + gx
  if (state.indexMap[i] === colorIdx) return false
  state.indexMap[i] = colorIdx
  return true
}
function floodFill(gx, gy, colorIdx) {
  if (gx < 0 || gy < 0 || gx >= state.gridW || gy >= state.gridH) return false
  const w = state.gridW, h = state.gridH
  const start = state.indexMap[gy * w + gx]
  if (start === colorIdx || start < 0) return false
  const stack = [gx, gy]
  let changed = false
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const idx = y * w + x
    if (state.indexMap[idx] !== start) continue
    state.indexMap[idx] = colorIdx
    changed = true
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
  return changed
}
function pickCellFromEvt(evt) {
  if (!state.indexMap) return null
  const { gx, gy } = pickCell(canvas, evt, state.gridW, state.gridH)
  if (gx < 0 || gy < 0 || gx >= state.gridW || gy >= state.gridH) return null
  return { gx, gy }
}

canvas.addEventListener('pointerdown', evt => {
  if (evt.button !== 0) return              // 只响应鼠标左键（右键留给平移）
  if (!state.indexMap) return
  const cell = pickCellFromEvt(evt)
  if (!cell) return

  // 吸色（吸色按钮点开的 pick 模式 或 Alt+点击 快捷键）
  if (state.pickingColor || evt.altKey) {
    const idx = state.indexMap[cell.gy * state.gridW + cell.gx]
    if (idx >= 0) setEditColor(idx)
    // 用完一次自动退出 pick 模式（Alt 快捷键本来就没进入，无副作用）
    if (state.pickingColor) setPickingMode(false)
    return
  }

  // 擦除不需要目标色；笔画 / 填充需要
  if (!state.editTool) return
  if (state.editTool !== 'eraser' && state.editColorIdx == null) return

  evt.preventDefault()
  try { canvas.setPointerCapture(evt.pointerId) } catch {}

  if (state.editTool === 'fill') {
    pushHistorySnapshot()
    if (floodFill(cell.gx, cell.gy, state.editColorIdx)) {
      rerender()
      retallyStats()
    } else {
      state.history.pop()
      undoBtn.disabled = state.history.length === 0
    }
  } else if (state.editTool === 'brush' || state.editTool === 'eraser') {
    pushHistorySnapshot()
    state.isPainting = true
    state.strokeValue = state.editTool === 'eraser' ? -1 : state.editColorIdx
    state.paintedThisStroke = new Set()
    const key = `${cell.gx},${cell.gy}`
    if (paintCell(cell.gx, cell.gy, state.strokeValue)) {
      state.paintedThisStroke.add(key)
      rerender()
    }
  }
})

canvas.addEventListener('pointermove', evt => {
  if (!state.isPainting) return
  const cell = pickCellFromEvt(evt)
  if (!cell) return
  const key = `${cell.gx},${cell.gy}`
  if (state.paintedThisStroke.has(key)) return
  state.paintedThisStroke.add(key)
  if (paintCell(cell.gx, cell.gy, state.strokeValue)) {
    rerender()
  }
})

function endStroke() {
  if (!state.isPainting) return
  state.isPainting = false
  if (state.paintedThisStroke && state.paintedThisStroke.size === 0) {
    state.history.pop()
    undoBtn.disabled = state.history.length === 0
  } else {
    retallyStats()
  }
  state.paintedThisStroke = null
}
canvas.addEventListener('pointerup', endStroke)
canvas.addEventListener('pointercancel', endStroke)
window.addEventListener('pointerup', endStroke)

// Ctrl/Cmd + Z 撤销 · Esc 取消吸色
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    undo()
    return
  }
  if (e.key === 'Escape' && state.pickingColor) {
    setPickingMode(false)
  }
})

// ---- 启动 ----
initPaletteSelect()
bindUpload()
bindSettings()
bindHover()
bindExportName()
