// 图像处理：把上传的图片按参数缩放到 W×H 的豆网格，返回像素数组 (RGBA)
// 以及基于色板的索引图 (Int32Array，-1 表示跳过/透明)。

import { findNearestIndex, precomputePaletteLab } from './color.js'

// 载入 File → HTMLImageElement
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = e => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// 计算图像中"不透明区域"的紧包围盒。返回 { x, y, w, h }，若全透明则返回 null。
// 为避免大图 getImageData 过慢，先降采样到 <= 800px 长边再扫描，最后按比例还原。
// alphaThreshold：alpha 小于此值视为"透明"（默认 8）。
export function computeContentBounds(img, alphaThreshold = 8) {
  const W = img.naturalWidth, H = img.naturalHeight
  if (!W || !H) return null
  const maxDim = 800
  const scale = Math.min(1, maxDim / Math.max(W, H))
  const sw = Math.max(1, Math.round(W * scale))
  const sh = Math.max(1, Math.round(H * scale))

  const c = document.createElement('canvas')
  c.width = sw; c.height = sh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, sw, sh)
  ctx.drawImage(img, 0, 0, sw, sh)
  const data = ctx.getImageData(0, 0, sw, sh).data

  let minX = sw, minY = sh, maxX = -1, maxY = -1
  for (let y = 0; y < sh; y++) {
    let rowStart = y * sw * 4 + 3
    for (let x = 0; x < sw; x++, rowStart += 4) {
      if (data[rowStart] > alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null   // 全透明

  const inv = 1 / scale
  const x = Math.max(0, Math.floor(minX * inv))
  const y = Math.max(0, Math.floor(minY * inv))
  const rr = Math.min(W, Math.ceil((maxX + 1) * inv))
  const bb = Math.min(H, Math.ceil((maxY + 1) * inv))
  return { x, y, w: rr - x, h: bb - y }
}

// 把源图渲染到 W×H 目标 canvas，按 fitMode 处理裁剪/留白
// fitMode: 'cover' | 'contain' | 'stretch'
// autoTrim: 若原图四边有大量透明区域，自动裁到不透明包围盒后再按 fitMode 处理（默认 true）
export function rasterizeToGrid(img, gridW, gridH, fitMode = 'cover', autoTrim = true) {
  const c = document.createElement('canvas')
  c.width = gridW
  c.height = gridH
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const W = img.naturalWidth, H = img.naturalHeight

  // ---- 1) 自动去透明边：若能收得掉 ≥ 5%（任一维度），就采用紧包围盒 ----
  let srcX = 0, srcY = 0, srcW = W, srcH = H
  if (autoTrim) {
    const b = computeContentBounds(img)
    if (b && (b.w < W * 0.95 || b.h < H * 0.95) && b.w > 0 && b.h > 0) {
      srcX = b.x; srcY = b.y; srcW = b.w; srcH = b.h
    }
  }

  // ---- 2) 按 fitMode 计算实际采样 & 绘制区域 ----
  let sx = srcX, sy = srcY, sWidth = srcW, sHeight = srcH
  let dx = 0, dy = 0, dWidth = gridW, dHeight = gridH

  if (fitMode === 'cover') {
    const scale = Math.max(gridW / srcW, gridH / srcH)
    const cropW = gridW / scale
    const cropH = gridH / scale
    sx = srcX + (srcW - cropW) / 2
    sy = srcY + (srcH - cropH) / 2
    sWidth = cropW
    sHeight = cropH
  } else if (fitMode === 'contain') {
    const scale = Math.min(gridW / srcW, gridH / srcH)
    dWidth = Math.round(srcW * scale)
    dHeight = Math.round(srcH * scale)
    dx = Math.floor((gridW - dWidth) / 2)
    dy = Math.floor((gridH - dHeight) / 2)
    ctx.clearRect(0, 0, gridW, gridH)
  }
  // stretch：默认参数直接把 srcW×srcH 拉伸到 gridW×gridH

  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
  const imgData = ctx.getImageData(0, 0, gridW, gridH)
  return { canvas: c, imageData: imgData }
}

// 按色板把 RGBA 像素映射为色板索引
// options:
//   skipTransparent: 透明像素跳过（默认 true）
//   dither         : 是否 Floyd-Steinberg（默认 false）
//   alphaThreshold : 透明判定阈值（默认 128）
//   algo           : 'ciede2000'（默认，精准）| 'cie76'（快）
export function mapToPalette(imageData, palette, options = {}) {
  const {
    skipTransparent = true, dither = false,
    alphaThreshold = 128, algo = 'ciede2000',
  } = options
  const paletteLab = precomputePaletteLab(palette)
  const w = imageData.width, h = imageData.height
  const pixels = imageData.data
  const indexMap = new Int32Array(w * h)

  if (!dither) {
    for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
      const a = pixels[i + 3]
      if (skipTransparent && a < alphaThreshold) { indexMap[p] = -1; continue }
      indexMap[p] = findNearestIndex(pixels[i], pixels[i + 1], pixels[i + 2], paletteLab, algo)
    }
    return { indexMap, paletteLab, width: w, height: h }
  }

  // Floyd–Steinberg 抖动：需要在浮点缓冲上做，避免累积误差
  const buf = new Float32Array(w * h * 3)
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 3) {
    buf[p] = pixels[i]
    buf[p + 1] = pixels[i + 1]
    buf[p + 2] = pixels[i + 2]
  }
  const clip = v => v < 0 ? 0 : v > 255 ? 255 : v
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const a = pixels[p * 4 + 3]
      if (skipTransparent && a < alphaThreshold) { indexMap[p] = -1; continue }
      const off = p * 3
      const or = clip(buf[off]), og = clip(buf[off + 1]), ob = clip(buf[off + 2])
      const idx = findNearestIndex(or, og, ob, paletteLab, algo)
      indexMap[p] = idx
      const [nr, ng, nb] = paletteLab[idx].rgb
      const er = or - nr, eg = og - ng, eb = ob - nb
      // 分发误差：右 7/16、左下 3/16、下 5/16、右下 1/16
      const push = (xx, yy, w1) => {
        if (xx < 0 || xx >= w || yy >= h) return
        const o = (yy * w + xx) * 3
        buf[o]     += er * w1
        buf[o + 1] += eg * w1
        buf[o + 2] += eb * w1
      }
      push(x + 1, y,     7 / 16)
      push(x - 1, y + 1, 3 / 16)
      push(x,     y + 1, 5 / 16)
      push(x + 1, y + 1, 1 / 16)
    }
  }
  return { indexMap, paletteLab, width: w, height: h }
}

// 统计每色用量，返回 [{ idx, count, color }] 按数量降序
export function tallyUsage(indexMap, paletteLab) {
  const counts = new Map()
  let total = 0
  for (let i = 0; i < indexMap.length; i++) {
    const idx = indexMap[i]
    if (idx < 0) continue
    counts.set(idx, (counts.get(idx) || 0) + 1)
    total++
  }
  const rows = [...counts.entries()]
    .map(([idx, count]) => ({ idx, count, color: paletteLab[idx] }))
    .sort((a, b) => b.count - a.count)
  return { rows, total }
}
