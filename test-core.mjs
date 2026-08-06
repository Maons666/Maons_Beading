// 核心算法自测（不依赖浏览器 DOM/Canvas）
// 运行：node test-core.mjs
import { hexToRgb, rgbToHex, rgbToLab, findNearestIndex, precomputePaletteLab, limitPaletteToUsage, deltaESq, deltaE2000, deltaE76Sq } from './src/color.js'
import { PALETTES, DEFAULT_PALETTE_ID } from './src/palettes.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.log('  ✗', msg) }
}
function group(name, fn) {
  console.log('\n== ' + name + ' ==')
  fn()
}

group('hex/rgb 转换', () => {
  assert(JSON.stringify(hexToRgb('#FFFFFF')) === '[255,255,255]', 'hexToRgb #FFFFFF')
  assert(JSON.stringify(hexToRgb('#000000')) === '[0,0,0]', 'hexToRgb #000000')
  assert(JSON.stringify(hexToRgb('#FF8800')) === '[255,136,0]', 'hexToRgb #FF8800')
  assert(rgbToHex(255, 255, 255) === '#ffffff', 'rgbToHex 白')
  assert(rgbToHex(0, 0, 0) === '#000000', 'rgbToHex 黑')
  assert(rgbToHex(51, 88, 212) === '#3358d4', 'rgbToHex accent')
})

group('sRGB → LAB', () => {
  const white = rgbToLab(255, 255, 255)
  const black = rgbToLab(0, 0, 0)
  assert(Math.abs(white[0] - 100) < 0.5, `白色 L ≈ 100 (got ${white[0].toFixed(2)})`)
  assert(Math.abs(black[0]) < 0.5, `黑色 L ≈ 0 (got ${black[0].toFixed(2)})`)
  const red = rgbToLab(255, 0, 0)
  assert(red[1] > 40, `红色 a* > 40 (got ${red[1].toFixed(2)})`)
  const blue = rgbToLab(0, 0, 255)
  assert(blue[2] < -50, `蓝色 b* < -50 (got ${blue[2].toFixed(2)})`)
})

group('色板数据完整性（所有已注册色板）', () => {
  for (const pal of Object.values(PALETTES)) {
    console.log(`  · ${pal.name}: ${pal.colors.length} 色`)
    const codes = new Set()
    let hexOK = true, dupCode = false, nameOK = true
    for (const c of pal.colors) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(c.hex)) { hexOK = false; console.log('    异常 hex:', c) }
      if (codes.has(c.code)) { dupCode = true; console.log('    重复 code:', c.code) }
      codes.add(c.code)
      if (!c.name) { nameOK = false; console.log('    无名色号:', c) }
    }
    assert(pal.colors.length > 0, `  ${pal.id} 非空`)
    assert(hexOK, `  ${pal.id} 所有 hex 格式合法`)
    assert(!dupCode, `  ${pal.id} 色号无重复`)
    assert(nameOK, `  ${pal.id} 所有色号有名称`)
  }
})

// —— 判断匹配色是不是"红/绿/蓝"色相：R > G+30 && R > B+30 之类的启发式 —— //
const isRedish   = ([r, g, b]) => r > g + 30 && r > b + 30
const isGreenish = ([r, g, b]) => g > r + 20 && g > b + 20
const isBluish   = ([r, g, b]) => b > r + 30 && b > g + 20 // 允许蓝紫

group('最近色匹配（对所有色板）', () => {
  for (const pal of Object.values(PALETTES)) {
    console.log(`  · ${pal.name}`)
    const palLab = precomputePaletteLab(pal.colors)
    // 纯白 → 亮度 ≥ 90（Hama 官方最白也只到 L~94）
    const iW = findNearestIndex(255, 255, 255, palLab); const wc = palLab[iW]
    assert(wc.lab[0] >= 90, `  纯白匹配到高亮色 L>=90 (got ${wc.code} ${wc.hex} L=${wc.lab[0].toFixed(1)})`)
    // 纯黑 → 亮度 ≤ 20
    const iK = findNearestIndex(0, 0, 0, palLab); const kc = palLab[iK]
    assert(kc.lab[0] <= 20, `  纯黑匹配到低亮色 L<=20 (got ${kc.code} ${kc.hex} L=${kc.lab[0].toFixed(1)})`)
    // 纯红 → 匹配色 R 明显 > G,B
    const iR = findNearestIndex(255, 0, 0, palLab); const rc = palLab[iR]
    assert(isRedish(rc.rgb), `  纯红匹配到红色相 (got ${rc.code} ${rc.hex} rgb=${rc.rgb.join(',')})`)
    // 纯绿 → 匹配色 G > R,B
    const iG = findNearestIndex(0, 255, 0, palLab); const gc = palLab[iG]
    assert(isGreenish(gc.rgb), `  纯绿匹配到绿色相 (got ${gc.code} ${gc.hex} rgb=${gc.rgb.join(',')})`)
    // 纯蓝 → 匹配色 B > R,G
    const iB = findNearestIndex(0, 0, 255, palLab); const blc = palLab[iB]
    assert(isBluish(blc.rgb), `  纯蓝匹配到蓝色相 (got ${blc.code} ${blc.hex} rgb=${blc.rgb.join(',')})`)
  }
})

group('颜色数上限（limitPaletteToUsage）', () => {
  const pal = PALETTES[DEFAULT_PALETTE_ID].colors
  const palLab = precomputePaletteLab(pal)
  // 构造一张用了 10 种颜色的索引图，每色 1 个像素
  const usedIdx = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]
  const raw = new Int32Array(usedIdx.length)
  usedIdx.forEach((v, i) => raw[i] = v)
  // 保留 5 色
  const out = limitPaletteToUsage(raw, palLab, 5)
  const distinct = new Set(out)
  distinct.delete(-1)
  assert(distinct.size === 5, `裁到 5 色（got ${distinct.size}）`)
  // 保留 20 色（多于实际使用），应保持不变
  const out2 = limitPaletteToUsage(raw, palLab, 20)
  const distinct2 = new Set(out2)
  distinct2.delete(-1)
  assert(distinct2.size === 10, `上限>使用数时不变（got ${distinct2.size}）`)
  // 空/透明 (-1) 应保留
  const raw2 = new Int32Array([1, -1, 2, -1, 3])
  const out3 = limitPaletteToUsage(raw2, palLab, 2)
  assert(out3[1] === -1 && out3[3] === -1, '-1 (透明) 保留')
})

group('色差 CIE76 (deltaESq)', () => {
  const lab1 = rgbToLab(255, 0, 0)
  const lab2 = rgbToLab(255, 0, 0)
  assert(deltaESq(lab1, lab2) < 0.001, '同色 ΔE² ≈ 0')
  const lab3 = rgbToLab(0, 255, 0)
  assert(deltaESq(lab1, lab3) > 100, '红与绿 ΔE² > 100')
})

group('色差 CIEDE2000 (deltaE2000)', () => {
  // 同色 ΔE₀₀ = 0
  const lab1 = rgbToLab(120, 60, 200)
  assert(deltaE2000(lab1, lab1) < 0.0001, `同色 ΔE₀₀ ≈ 0 (got ${deltaE2000(lab1, lab1)})`)
  // Sharma 2005 论文的标定样本（近似）：#000 vs #FFF ΔE₀₀ = 100
  const black = rgbToLab(0, 0, 0), white = rgbToLab(255, 255, 255)
  const dWhBk = deltaE2000(black, white)
  assert(dWhBk > 99 && dWhBk < 101, `黑↔白 ΔE₀₀ ≈ 100 (got ${dWhBk.toFixed(2)})`)
  // 相邻近色差应很小
  const c1 = rgbToLab(100, 100, 100)
  const c2 = rgbToLab(105, 100, 100)
  assert(deltaE2000(c1, c2) < 5, `近色 ΔE₀₀ 小 (got ${deltaE2000(c1, c2).toFixed(2)})`)
  // CIEDE2000 应对蓝色区更宽容：#0000FF vs #0020F0 应比 CIE76 的（欧氏）判定更接近
  const b1 = rgbToLab(0, 0, 255)
  const b2 = rgbToLab(0, 32, 240)
  const d76  = Math.sqrt(deltaE76Sq(b1, b2))
  const d00  = deltaE2000(b1, b2)
  assert(d00 < d76, `蓝色近色：ΔE₀₀ < ΔE₇₆ (got ΔE₀₀=${d00.toFixed(2)} vs ΔE₇₆=${d76.toFixed(2)})`)
})

// —— 端到端流水线测试（伪 ImageData） ——
const { mapToPalette, tallyUsage } = await import('./src/image.js')

group('端到端：mapToPalette + tallyUsage', () => {
  const pal = PALETTES[DEFAULT_PALETTE_ID].colors
  // 构造 4×4 图：全是纯红
  const w = 4, h = 4
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4]     = 255  // R
    data[i * 4 + 1] = 0
    data[i * 4 + 2] = 0
    data[i * 4 + 3] = 255  // A
  }
  const fakeImageData = { data, width: w, height: h }
  const { indexMap, paletteLab } = mapToPalette(fakeImageData, pal, { skipTransparent: true, dither: false })
  const { rows, total } = tallyUsage(indexMap, paletteLab)
  assert(total === 16, `总豆数 16 (got ${total})`)
  assert(rows.length === 1, `只用 1 色 (got ${rows.length})`)
  assert(isRedish(rows[0].color.rgb), `匹配到的色是红色相 (got ${rows[0].color.code} ${rows[0].color.hex})`)

  // 一半纯白 + 一半纯黑 + 1 个透明像素
  const data2 = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const isBottom = i >= (w * h / 2)
    data2[i * 4]     = isBottom ? 0 : 255
    data2[i * 4 + 1] = isBottom ? 0 : 255
    data2[i * 4 + 2] = isBottom ? 0 : 255
    data2[i * 4 + 3] = 255
  }
  data2[0 * 4 + 3] = 0 // 第一格透明
  const r2 = mapToPalette({ data: data2, width: w, height: h }, pal, { skipTransparent: true, dither: false })
  const t2 = tallyUsage(r2.indexMap, r2.paletteLab)
  assert(t2.total === 15, `跳过 1 个透明像素后总数 15 (got ${t2.total})`)
  assert(t2.rows.length === 2, `两种颜色 (got ${t2.rows.length})`)

  // 抖动开关不改变输出结构
  const r3 = mapToPalette({ data, width: w, height: h }, pal, { skipTransparent: true, dither: true })
  assert(r3.indexMap.length === 16, `抖动模式下输出长度 16 (got ${r3.indexMap.length})`)
})

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`)
process.exit(fail === 0 ? 0 : 1)
