// 图纸渲染：把 indexMap + palette 画成色号图（每格填色 + 中间打上色号 + 细网格 + 可选深色分隔线）

// 每格像素大小（放大展示，不代表实际尺寸）
const CELL_PX = 22

/**
 * 渲染色号图。
 * @param heavyGridInterval 深色分隔线间距（每 N 格加一条深线）。0 表示关闭。
 */
export function renderPattern(canvas, indexMap, paletteLab, w, h, heavyGridInterval = 5) {
  const cell = CELL_PX
  const cw = w * cell
  const ch = h * cell
  // 高清屏
  const dpr = window.devicePixelRatio || 1
  canvas.width = cw * dpr
  canvas.height = ch * dpr
  canvas.style.width = cw + 'px'
  canvas.style.height = ch + 'px'
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false

  // 背景（浅色棋盘表示"无豆"）
  drawCheckerBackground(ctx, cw, ch, 8)

  // ---- 第 1 遍：给非空格子填色 ----
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = indexMap[y * w + x]
      if (idx < 0) continue
      const color = paletteLab[idx]
      ctx.fillStyle = color.hex
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }

  // ---- 第 2 遍：所有格子都画浅色网格（含空格） ----
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let gx = 0; gx <= w; gx++) {
    const x = gx * cell + 0.5
    ctx.moveTo(x, 0); ctx.lineTo(x, ch)
  }
  for (let gy = 0; gy <= h; gy++) {
    const y = gy * cell + 0.5
    ctx.moveTo(0, y); ctx.lineTo(cw, y)
  }
  ctx.stroke()

  // ---- 第 3 遍：非空格子写色号 ----
  ctx.font = `${Math.floor(cell * 0.42)}px system-ui, -apple-system, "PingFang SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = indexMap[y * w + x]
      if (idx < 0) continue
      const color = paletteLab[idx]
      const [r, g, b] = color.rgb
      const yLum = 0.299 * r + 0.587 * g + 0.114 * b
      ctx.fillStyle = yLum > 160 ? '#000' : '#fff'
      ctx.fillText(color.code, x * cell + cell / 2, y * cell + cell / 2)
    }
  }

  // 深色分隔线（每 heavyGridInterval 格）
  if (heavyGridInterval > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1.5
    for (let gx = heavyGridInterval; gx < w; gx += heavyGridInterval) {
      const x = gx * cell + 0.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke()
    }
    for (let gy = heavyGridInterval; gy < h; gy += heavyGridInterval) {
      const y = gy * cell + 0.5
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke()
    }
  }

  // 外边框
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, cw - 2, ch - 2)
}

function drawCheckerBackground(ctx, w, h, size) {
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#eeeeee'
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) {
        ctx.fillRect(x, y, size, size)
      }
    }
  }
}

// 定位鼠标坐标在哪一格。rect.width 已包含 CSS transform，
// 用它反推每格实际屏幕尺寸即可，天然兼容缩放。
export function pickCell(canvas, evt, gridW, gridH) {
  const rect = canvas.getBoundingClientRect()
  const cellW = rect.width / gridW
  const cellH = rect.height / gridH
  const x = evt.clientX - rect.left
  const y = evt.clientY - rect.top
  const gx = Math.floor(x / cellW)
  const gy = Math.floor(y / cellH)
  return { gx, gy }
}

export { CELL_PX }
