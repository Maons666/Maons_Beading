// 颜色工具：hex/rgb 互转、sRGB → LAB、色差
// 说明：色差同时提供 CIE76（快）与 CIEDE2000（精准）。默认走 CIEDE2000。
// CIEDE2000 参考：Sharma, Wu, Dalal (2005) "The CIEDE2000 color-difference formula".

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function rgbToHex(r, g, b) {
  const to = v => v.toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}

// sRGB → 线性 RGB
function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// 线性 RGB → XYZ (D65)
function rgbToXyz(r, g, b) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  return [
    lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  ]
}

// XYZ → LAB
function xyzToLab(x, y, z) {
  // D65 参考白
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116)
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn)
  return [
    116 * fy - 16,      // L
    500 * (fx - fy),    // a
    200 * (fy - fz),    // b
  ]
}

export function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b)
  return xyzToLab(x, y, z)
}

// CIE76 色差平方（LAB 欧氏距离²，比较用无需 sqrt）
export function deltaE76Sq(lab1, lab2) {
  const dL = lab1[0] - lab2[0]
  const da = lab1[1] - lab2[1]
  const db = lab1[2] - lab2[2]
  return dL * dL + da * da + db * db
}

// —— CIEDE2000 色差 —— //
// 返回 ΔE₀₀（非平方）。相比 CIE76：
//   · 修正了蓝色区、灰色区、色相加权的感知偏差
//   · 计算约慢 3–5×，但对拼豆匹配的画面还原更接近人眼
// 参考：Sharma et al. 2005 论文与 Bruce Lindbloom 的实现。
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const kL = 1, kC = 1, kH = 1

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))) // 25^7 = 6.1e9
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)

  const h1p = hueAngleDeg(a1p, b1)
  const h2p = hueAngleDeg(a2p, b2)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp
  if (C1p * C2p === 0)      dhp = 0
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360
  else                      dhp = h2p - h1p + 360
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2)

  const Lbar = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hBarp
  if (C1p * C2p === 0)      hBarp = h1p + h2p
  else if (Math.abs(h1p - h2p) <= 180) hBarp = (h1p + h2p) / 2
  else if (h1p + h2p < 360) hBarp = (h1p + h2p + 360) / 2
  else                      hBarp = (h1p + h2p - 360) / 2

  const T = 1
    - 0.17 * Math.cos(deg2rad(hBarp - 30))
    + 0.24 * Math.cos(deg2rad(2 * hBarp))
    + 0.32 * Math.cos(deg2rad(3 * hBarp + 6))
    - 0.20 * Math.cos(deg2rad(4 * hBarp - 63))

  const dTheta = 30 * Math.exp(-Math.pow((hBarp - 275) / 25, 2))
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + 6103515625))
  const SL = 1 + (0.015 * Math.pow(Lbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lbar - 50, 2))
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T
  const RT = -Math.sin(deg2rad(2 * dTheta)) * RC

  const term1 = dLp / (kL * SL)
  const term2 = dCp / (kC * SC)
  const term3 = dHp / (kH * SH)
  return Math.sqrt(term1 * term1 + term2 * term2 + term3 * term3 + RT * term2 * term3)
}

function hueAngleDeg(a, b) {
  if (a === 0 && b === 0) return 0
  const h = rad2deg(Math.atan2(b, a))
  return h < 0 ? h + 360 : h
}
const deg2rad = d => d * Math.PI / 180
const rad2deg = r => r * 180 / Math.PI

// —— 兼容旧调用：deltaESq 保留为 CIE76 —— //
export const deltaESq = deltaE76Sq

// 预计算色板的 LAB 值，返回带 lab 的新对象数组
export function precomputePaletteLab(colors) {
  return colors.map(c => {
    const [r, g, b] = hexToRgb(c.hex)
    return { ...c, rgb: [r, g, b], lab: rgbToLab(r, g, b) }
  })
}

/**
 * 在色板中找到距离 (r,g,b) 最近的颜色索引。
 * @param algo 'ciede2000'（默认，精准）| 'cie76'（快）
 */
export function findNearestIndex(r, g, b, paletteWithLab, algo = 'ciede2000') {
  const target = rgbToLab(r, g, b)
  let bestIdx = 0
  let bestDist = Infinity
  if (algo === 'cie76') {
    for (let i = 0; i < paletteWithLab.length; i++) {
      const d = deltaE76Sq(target, paletteWithLab[i].lab)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
  } else {
    for (let i = 0; i < paletteWithLab.length; i++) {
      const d = deltaE2000(target, paletteWithLab[i].lab)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
  }
  return bestIdx
}

// 依据「用量」从整幅图裁剪出前 topN 种颜色（median-cut 简化版：先全量匹配，再按频次截断，
// 未入选颜色重新映射到入选中最近的颜色）
export function limitPaletteToUsage(indexMap, palette, topN) {
  const counts = new Map()
  for (let i = 0; i < indexMap.length; i++) {
    const idx = indexMap[i]
    if (idx < 0) continue
    counts.set(idx, (counts.get(idx) || 0) + 1)
  }
  if (counts.size <= topN) return indexMap // 已在上限内

  // 保留前 topN 频次的颜色
  const kept = new Set(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([idx]) => idx)
  )

  // 为「未保留」的颜色，预先算好它们在「保留集合」中的最近映射
  // 这里用 CIE76 就够（少量点，快），主要匹配才用 CIEDE2000
  const remap = new Map()
  const keptArr = [...kept]
  for (const [idx] of counts) {
    if (kept.has(idx)) continue
    const src = palette[idx].lab
    let best = keptArr[0], bestD = Infinity
    for (const k of keptArr) {
      const d = deltaE76Sq(src, palette[k].lab)
      if (d < bestD) { bestD = d; best = k }
    }
    remap.set(idx, best)
  }

  const out = new Int32Array(indexMap.length)
  for (let i = 0; i < indexMap.length; i++) {
    const idx = indexMap[i]
    if (idx < 0) { out[i] = -1; continue }
    out[i] = kept.has(idx) ? idx : remap.get(idx)
  }
  return out
}
