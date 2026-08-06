// PDF 导出：竖版 A4
// 第 1 页：概况 —— 上半色块图（无网格无色号），下半用豆统计（多栏、含品牌信息）
// 第 2 页起：色号图分块 —— 每 50 宽 × 70 高一页；左上标签 + 右上缩略图高亮当前块

import { jsPDF } from 'jspdf'

// A4 竖版 mm
const A4 = { w: 210, h: 297 }
const MARGIN = 10

// 分块尺寸
const TILE_W = 40
const TILE_H = 50

// —— 入口 —— //
export function exportPdf({
  indexMap, paletteLab, width, height,
  stats, paletteName, algo,
  filename = 'pattern.pdf',
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  drawOverviewPage(doc, {
    indexMap, paletteLab, width, height,
    stats, paletteName, algo,
  })

  const tilesX = Math.ceil(width / TILE_W)
  const tilesY = Math.ceil(height / TILE_H)
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      doc.addPage()
      drawTilePage(doc, {
        indexMap, paletteLab, width, height,
        tileX: tx, tileY: ty, tilesX, tilesY,
      })
    }
  }

  doc.save(filename)
}

// ==================================================================
// 第 1 页：概况
// ==================================================================
function drawOverviewPage(doc, { indexMap, paletteLab, width, height,
                                  stats, paletteName, algo }) {
  // 标题
  const title = renderTextCanvas('拼豆图纸 · 概况', {
    fontPx: 22, weight: 600, color: '#111',
  })
  doc.addImage(title.canvas, 'PNG', MARGIN, MARGIN, title.wMm, title.hMm)

  // ---- 上半：色块图 ----
  const topAreaY = MARGIN + title.hMm + 3
  const topAreaH = A4.h * 0.45 - topAreaY
  const availW = A4.w - MARGIN * 2

  const cellMm = Math.min(availW / width, topAreaH / height)
  const blockW = cellMm * width
  const blockH = cellMm * height
  const blockX = MARGIN + (availW - blockW) / 2
  const blockY = topAreaY + (topAreaH - blockH) / 2

  drawBlocksNoGrid(doc, indexMap, paletteLab, width, height,
    blockX, blockY, cellMm)
  doc.setDrawColor(90); doc.setLineWidth(0.2)
  doc.rect(blockX, blockY, blockW, blockH)

  // 分割线
  const midY = A4.h * 0.45 + 2
  doc.setDrawColor(220); doc.setLineWidth(0.2)
  doc.line(MARGIN, midY, A4.w - MARGIN, midY)

  // ---- 下半：用豆统计 ----
  const bottomY = midY + 4
  const bottomH = A4.h - bottomY - MARGIN
  const statsImg = renderStatsCanvas({
    stats, paletteName, algo, width, height,
    widthMm: availW, heightMm: bottomH,
  })
  doc.addImage(statsImg.canvas, 'PNG', MARGIN, bottomY,
    statsImg.wMm, statsImg.hMm)

  drawFooter(doc, 'Overview')
}

// —— 纯色块图（矢量，无网格无色号） —— //
function drawBlocksNoGrid(doc, indexMap, paletteLab, width, height,
                          px, py, cellMm) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = indexMap[y * width + x]
      if (idx < 0) continue
      const [r, g, b] = paletteLab[idx].rgb
      doc.setFillColor(r, g, b)
      doc.rect(px + x * cellMm, py + y * cellMm, cellMm, cellMm, 'F')
    }
  }
}

// —— 用豆统计：整块渲染到 Canvas —— //
// 样式对齐网页右侧：外圈圆角边框 · 14pt 主字号 · 柔和配色
// 布局：Header 区（标题+品牌胶囊+摘要） → 表头 → 分栏数据行
function renderStatsCanvas({ stats, paletteName, algo, width, height,
                             widthMm, heightMm }) {
  // —— 尺度：让 canvas 上"1 CSS px"= 1/pxPerMm 毫米。10 px/mm 即 254 DPI。 —— //
  const pxPerMm = 10
  const cvW = Math.floor(widthMm * pxPerMm)
  const cvH = Math.floor(heightMm * pxPerMm)
  const cv = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  cv.width = cvW * dpr
  cv.height = cvH * dpr
  const ctx = cv.getContext('2d')
  ctx.scale(dpr, dpr)

  // pt → CSS px 换算（1pt = 25.4/72 mm）
  const ptPx = pt => pt * (25.4 / 72) * pxPerMm

  // 字体家族
  const CJK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,-apple-system,sans-serif'
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'
  const sans = (weight, pt) => `${weight} ${ptPx(pt)}px ${CJK}`
  const mono = (weight, pt) => `${weight} ${ptPx(pt)}px ${MONO}`

  // 配色（对齐网页 var）
  const C = {
    bg:        '#ffffff',
    border:    '#e4e6ea',
    softBg:    '#fafbfc',
    headerBg:  '#f6f8fa',
    text:      '#1f2328',
    text2:     '#57606a',
    text3:     '#8b949e',
    rowDivider:'#f0f1f3',
    accent:    '#3358d4',
    accentBg:  '#eef2ff',
    swatchBd:  'rgba(0,0,0,0.14)',
  }

  // ==== 外圈圆角容器 ====
  const containerR = ptPx(6)                    // 圆角半径
  const containerX = ptPx(1)
  const containerY = ptPx(1)
  const containerW = cvW - ptPx(2)
  const containerH = cvH - ptPx(2)
  ctx.fillStyle = C.bg
  roundRect(ctx, containerX, containerY, containerW, containerH, containerR); ctx.fill()
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  roundRect(ctx, containerX + 0.5, containerY + 0.5,
    containerW - 1, containerH - 1, containerR); ctx.stroke()

  const padX = ptPx(10)
  const contentX = containerX + padX
  const contentR = containerX + containerW - padX
  const contentW = contentR - contentX
  let y = containerY + ptPx(9)

  // ==== 标题 + 品牌胶囊 ====
  ctx.textBaseline = 'top'
  ctx.fillStyle = C.text
  ctx.font = sans(600, 16)
  const titleH = ptPx(16) * 1.25
  ctx.fillText('用豆统计', contentX, y)

  // 品牌胶囊（用 baseline:'middle' + 垂直中点定位，避免 textBaseline:'top' 在
  // 不同字体下产生的视觉偏上问题）
  ctx.font = sans(500, 10.5)
  const pillPadX = ptPx(6)
  const pillPadY = ptPx(3)
  const pillTextW = ctx.measureText(paletteName).width
  const pillH = ptPx(10.5) * 1.35 + pillPadY * 2
  const pillW = pillTextW + pillPadX * 2
  const pillX = contentR - pillW
  const pillY = y + (titleH - pillH) / 2 - ptPx(1)
  ctx.fillStyle = C.accentBg
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.fill()
  ctx.fillStyle = C.accent
  ctx.textBaseline = 'middle'
  ctx.fillText(paletteName, pillX + pillPadX, pillY + pillH / 2)
  ctx.textBaseline = 'top'
  y += titleH + ptPx(4)

  // ==== 摘要行 ====
  ctx.fillStyle = C.text2
  ctx.font = sans(400, 11)
  const algoName = algo === 'cie76' ? 'CIE76' : 'CIEDE2000'
  ctx.fillText(
    `图纸 ${width}×${height}   ·   总豆数 ${stats.total.toLocaleString()}   ·   色种 ${stats.rows.length}   ·   算法 ${algoName}`,
    contentX, y
  )
  y += ptPx(11) * 1.3 + ptPx(6)

  // 分割线（内嵌，不到边）
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(contentX, y); ctx.lineTo(contentR, y); ctx.stroke()
  y += ptPx(4)

  // ==== 表格（只留 色卡 · 色号 · 数量） ====
  // 主字号 14pt；每行高约 1.7 × 字号
  const bodyPt = 14
  const bodySize = ptPx(bodyPt)
  const rowH = bodySize * 1.7
  const swatch = bodySize * 1.05      // 色卡边长 ≈ 字号

  // 每栏内布局：swatch | code | 空 | count
  const swatchGap = ptPx(6)
  const codeW = ptPx(34)              // 色号列（能容 4 字符等宽）
  const rightPad = ptPx(8)
  const perColOverhead = swatch + swatchGap + codeW + rightPad
  const minCountW = ptPx(30)
  const minColW = perColOverhead + minCountW

  const colGap = ptPx(16)
  // 少列少内容 → 允许更多分栏
  const cols = Math.max(1, Math.min(5, Math.floor((contentW + colGap) / (minColW + colGap))))
  const colW = Math.floor((contentW - colGap * (cols - 1)) / cols)

  // 表头行（浅灰底）
  const headerFontPt = 10.5
  const headerH = ptPx(headerFontPt) * 1.6
  ctx.fillStyle = C.headerBg
  ctx.fillRect(contentX, y, contentW, headerH)
  ctx.fillStyle = C.text3
  ctx.font = sans(500, headerFontPt)
  ctx.textBaseline = 'middle'
  for (let c = 0; c < cols; c++) {
    const cx = contentX + c * (colW + colGap)
    ctx.textAlign = 'left'
    ctx.fillText('色号', cx + swatch + swatchGap, y + headerH / 2)
    ctx.textAlign = 'right'
    ctx.fillText('数量', cx + colW - rightPad, y + headerH / 2)
  }
  ctx.textBaseline = 'top'
  y += headerH

  // 数据行
  const bodyStartY = y
  const bodyMaxY = containerY + containerH - ptPx(16)
  const rowsAvail = Math.max(1, Math.floor((bodyMaxY - bodyStartY) / rowH))
  const capacity = rowsAvail * cols
  const rowsToDraw = stats.rows.slice(0, capacity)

  for (let i = 0; i < rowsToDraw.length; i++) {
    const col = Math.floor(i / rowsAvail)
    const row = i % rowsAvail
    const cx = contentX + col * (colW + colGap)
    const ry = bodyStartY + row * rowH
    const r = rowsToDraw[i]
    const c = r.color

    // 隔行浅底
    if (row % 2 === 1) {
      ctx.fillStyle = C.softBg
      ctx.fillRect(cx, ry, colW, rowH)
    }
    // 行底线（除最后一行）
    if (row < rowsAvail - 1) {
      ctx.strokeStyle = C.rowDivider
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(cx, ry + rowH)
      ctx.lineTo(cx + colW, ry + rowH)
      ctx.stroke()
    }

    const midY = ry + rowH / 2
    const swatchY = midY - swatch / 2

    // 色卡（圆角+细边）
    ctx.fillStyle = c.hex
    roundRect(ctx, cx, swatchY, swatch, swatch, ptPx(1.5)); ctx.fill()
    ctx.strokeStyle = C.swatchBd
    ctx.lineWidth = 0.7
    roundRect(ctx, cx + 0.5, swatchY + 0.5, swatch - 1, swatch - 1, ptPx(1.5)); ctx.stroke()

    // 色号（等宽）
    ctx.textBaseline = 'middle'
    ctx.fillStyle = C.text
    ctx.font = mono(500, bodyPt)
    ctx.textAlign = 'left'
    ctx.fillText(c.code, cx + swatch + swatchGap, midY)

    // 数量（等宽 · 右对齐）
    ctx.textAlign = 'right'
    ctx.fillText(r.count.toLocaleString(), cx + colW - rightPad, midY)

    ctx.textBaseline = 'top'
  }

  // 若截断，末尾灰色提示
  if (rowsToDraw.length < stats.rows.length) {
    ctx.fillStyle = C.text3
    ctx.font = sans(400, 10)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(
      `尚有 ${stats.rows.length - rowsToDraw.length} 色未列出，完整清单见 CSV 导出`,
      contentX, containerY + containerH - ptPx(12)
    )
  }

  const visualPxPerMm = pxPerMm
  return { canvas: cv, wMm: cvW / visualPxPerMm, hMm: cvH / visualPxPerMm }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

function clipText(ctx, s, maxPx) {
  if (ctx.measureText(s).width <= maxPx) return s
  let lo = 0, hi = s.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(s.slice(0, mid) + '…').width <= maxPx) lo = mid
    else hi = mid - 1
  }
  return s.slice(0, lo) + '…'
}

// ==================================================================
// 第 2 页起：色号图分块
// ==================================================================
function drawTilePage(doc, { indexMap, paletteLab, width, height,
                              tileX, tileY, tilesX, tilesY }) {
  const x0 = tileX * TILE_W
  const y0 = tileY * TILE_H
  const x1 = Math.min(x0 + TILE_W, width)
  const y1 = Math.min(y0 + TILE_H, height)
  const tw = x1 - x0
  const th = y1 - y0

  // ---- 右上角：缩略图（高亮当前块）----
  const miniMax = { w: 42, h: 42 }
  const aspect = width / height
  let miniW, miniH
  if (aspect >= miniMax.w / miniMax.h) {
    miniW = miniMax.w
    miniH = miniW / aspect
  } else {
    miniH = miniMax.h
    miniW = miniH * aspect
  }
  const miniX = A4.w - MARGIN - miniW
  const miniY = MARGIN
  const miniCv = renderMiniMapCanvas(indexMap, paletteLab, width, height,
    tileX, tileY, tilesX, tilesY)
  doc.addImage(miniCv, 'PNG', miniX, miniY, miniW, miniH)
  // 缩略图外框
  doc.setDrawColor(140); doc.setLineWidth(0.15)
  doc.rect(miniX, miniY, miniW, miniH)

  // ---- 左上角：块位置标签 ----
  const label = renderTextCanvas(
    `第 (${tileX + 1}, ${tileY + 1}) / (${tilesX}, ${tilesY}) 块`,
    { fontPx: 13, weight: 600, color: '#111' })
  doc.addImage(label.canvas, 'PNG', MARGIN, MARGIN, label.wMm, label.hMm)

  const rangeLabel = renderTextCanvas(
    `列 ${x0 + 1} – ${x1}    行 ${y0 + 1} – ${y1}    整图 ${width} × ${height}`,
    { fontPx: 10, weight: 400, color: '#57606a' })
  doc.addImage(rangeLabel.canvas, 'PNG',
    MARGIN, MARGIN + label.hMm + 1,
    rangeLabel.wMm, rangeLabel.hMm)

  // ---- 网格区域 ----
  // 顶部预留：max(标签区高度, 缩略图高度) + 4mm
  const headerBottom = Math.max(
    MARGIN + label.hMm + rangeLabel.hMm + 1,
    miniY + miniH
  )
  const gridTop = headerBottom + 5
  const availW = A4.w - MARGIN * 2
  const availH = A4.h - gridTop - MARGIN

  const cellMm = Math.min(availW / tw, availH / th)
  const gridW_mm = cellMm * tw
  const gridH_mm = cellMm * th
  const gx0 = MARGIN + (availW - gridW_mm) / 2
  const gy0 = gridTop

  // Pass 1：填色（非空）
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const idx = indexMap[(y0 + j) * width + (x0 + i)]
      if (idx < 0) continue
      const [r, g, b] = paletteLab[idx].rgb
      doc.setFillColor(r, g, b)
      doc.rect(gx0 + i * cellMm, gy0 + j * cellMm, cellMm, cellMm, 'F')
    }
  }

  // Pass 2：所有格子的浅色网格
  doc.setDrawColor(190); doc.setLineWidth(0.05)
  for (let i = 0; i <= tw; i++) {
    const x = gx0 + i * cellMm
    doc.line(x, gy0, x, gy0 + gridH_mm)
  }
  for (let j = 0; j <= th; j++) {
    const y = gy0 + j * cellMm
    doc.line(gx0, y, gx0 + gridW_mm, y)
  }

  // Pass 3：色号文字
  // 每个色号按"目标宽度"独立缩放字号，让 2 字符（C3）和 3 字符（H26）等宽
  // 目标宽度取 cell 的 78%；字号存在绝对下限，防止太长的色号变得不可读
  doc.setFont('helvetica', 'normal')
  const targetWidthMm = cellMm * 0.78
  const targetWidthPt = targetWidthMm * 72 / 25.4
  const minFsPt = 3.0
  const maxFsPt = cellMm * 1.55        // 相当于原来的自然上限
  const cellHalf = cellMm / 2
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const idx = indexMap[(y0 + j) * width + (x0 + i)]
      if (idx < 0) continue
      const c = paletteLab[idx]
      const uW = doc.getStringUnitWidth(c.code) || 1
      // 目标字号 = 让当前色号宽度恰好为 targetWidthPt
      let fs = targetWidthPt / uW
      if (fs > maxFsPt) fs = maxFsPt   // 极短色号（如 "3"）不无限放大
      if (fs < minFsPt) fs = minFsPt   // 极长色号不缩到看不见
      doc.setFontSize(fs)
      const [rr, gg, bb] = c.rgb
      const yLum = 0.299 * rr + 0.587 * gg + 0.114 * bb
      doc.setTextColor(yLum > 160 ? 0 : 255)
      doc.text(c.code,
        gx0 + i * cellMm + cellHalf,
        gy0 + j * cellMm + cellHalf,
        { align: 'center', baseline: 'middle' })
    }
  }

  // Pass 4：深色分隔线（每 5 格）
  doc.setDrawColor(80); doc.setLineWidth(0.3)
  for (let i = 5; i < tw; i += 5) {
    const x = gx0 + i * cellMm
    doc.line(x, gy0, x, gy0 + gridH_mm)
  }
  for (let j = 5; j < th; j += 5) {
    const y = gy0 + j * cellMm
    doc.line(gx0, y, gx0 + gridW_mm, y)
  }

  // 外框
  doc.setDrawColor(0); doc.setLineWidth(0.4)
  doc.rect(gx0, gy0, gridW_mm, gridH_mm)

  // 每 5 格的坐标数字
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120)
  for (let i = 0; i <= tw; i += 5) {
    if (i === 0 || i === tw) continue
    doc.text(String(x0 + i), gx0 + i * cellMm, gy0 - 0.6, { align: 'center' })
  }
  for (let j = 0; j <= th; j += 5) {
    if (j === 0 || j === th) continue
    doc.text(String(y0 + j), gx0 - 1.2, gy0 + j * cellMm + 0.5, { align: 'right' })
  }

  drawFooter(doc, `Tile ${tileX + 1}-${tileY + 1}`)
}

// —— 缩略图（Canvas）：整图的迷你色块预览 + 分块网格 + 高亮当前块 —— //
function renderMiniMapCanvas(indexMap, paletteLab, width, height,
                              tileX, tileY, tilesX, tilesY) {
  const pxPerCell = 3
  const cw = width * pxPerCell
  const ch = height * pxPerCell
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d')

  // 白底
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cw, ch)

  // 全部彩色小格
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = indexMap[y * width + x]
      if (idx < 0) continue
      ctx.fillStyle = paletteLab[idx].hex
      ctx.fillRect(x * pxPerCell, y * pxPerCell, pxPerCell, pxPerCell)
    }
  }

  // 分块虚线（浅灰）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.6
  ctx.setLineDash([2, 2])
  for (let i = 1; i < tilesX; i++) {
    const lx = Math.min(i * TILE_W, width) * pxPerCell
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ch); ctx.stroke()
  }
  for (let j = 1; j < tilesY; j++) {
    const ly = Math.min(j * TILE_H, height) * pxPerCell
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(cw, ly); ctx.stroke()
  }
  ctx.setLineDash([])

  // 高亮当前块（红色边框）
  const tx = tileX * TILE_W * pxPerCell
  const ty = tileY * TILE_H * pxPerCell
  const tw = Math.min(TILE_W, width - tileX * TILE_W) * pxPerCell
  const th = Math.min(TILE_H, height - tileY * TILE_H) * pxPerCell
  ctx.strokeStyle = 'rgba(220,38,38,0.95)'
  ctx.lineWidth = 3
  ctx.strokeRect(tx, ty, tw, th)

  // 整图边框
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1)

  return cv
}

function drawFooter(doc, tag) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140)
  doc.text('Beading Pattern Maker', MARGIN, A4.h - 4)
  doc.text(`Page ${doc.getNumberOfPages()} · ${tag}`,
    A4.w - MARGIN, A4.h - 4, { align: 'right' })
}

// ==================================================================
// 工具：把一段文字画到 Canvas（返回 { canvas, wMm, hMm }）
// 视觉比例：1 mm ≈ 4 屏幕像素
// ==================================================================
function renderTextCanvas(text, {
  fontPx = 12, weight = 400, color = '#111', bg = null, padding = 2,
} = {}) {
  const font = `${weight} ${fontPx}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  const m = measure.measureText(text)
  const w = Math.ceil(m.width) + padding * 2
  const h = Math.ceil(fontPx * 1.3) + padding * 2

  const cv = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  cv.width = w * dpr
  cv.height = h * dpr
  const ctx = cv.getContext('2d')
  ctx.scale(dpr, dpr)
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h) }
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.fillText(text, padding, padding)

  const visualPxPerMm = 4
  return { canvas: cv, wMm: w / visualPxPerMm, hMm: h / visualPxPerMm }
}
