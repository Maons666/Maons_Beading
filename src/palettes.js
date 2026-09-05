// 拼豆色板数据
// 说明：色号沿用 Hama Midi 编号习惯（中文用户群体最通用），RGB 参考市售 5mm 中豆常见值。
// 该色板筛选自国内常见约 72 色，覆盖常用色相，兼容 Artkal / Perler 大多数中豆型号。
// 后续可通过新增 palette 对象扩展。
//
// 其他色板从独立模块导入：
import { MARD_291, MARD_221 } from './palettes-mard.js'
import { PERLER }    from './palettes-perler.js'
import { HAMA_MIDI } from './palettes-hama.js'
import { ARTKAL_S }  from './palettes-artkal.js'
//
// 每色字段：
//   code: 短色号（做图纸标注）
//   name: 中文名
//   hex : 十六进制颜色
//   tags: 可选，用于分组/筛选（"常用"/"荧光"/"透明"/"夜光"...）

const COMMON_72 = [
  { code: 'W01', name: '白色',     hex: '#FFFFFF', tags: ['基础'] },
  { code: 'W02', name: '米白',     hex: '#F7F1DE', tags: ['基础'] },
  { code: 'W03', name: '奶油黄',   hex: '#FDEAB0', tags: ['基础'] },
  { code: 'Y01', name: '柠檬黄',   hex: '#FCE300', tags: ['基础'] },
  { code: 'Y02', name: '中黄',     hex: '#FFC72C', tags: ['基础'] },
  { code: 'Y03', name: '土黄',     hex: '#D9A441', tags: ['基础'] },
  { code: 'Y04', name: '荧光黄',   hex: '#E6F542', tags: ['荧光'] },
  { code: 'O01', name: '桔黄',     hex: '#F58220', tags: ['基础'] },
  { code: 'O02', name: '橘红',     hex: '#F26522', tags: ['基础'] },
  { code: 'O03', name: '淡橙',     hex: '#F9AE79', tags: ['基础'] },
  { code: 'O04', name: '荧光橙',   hex: '#FF6D3A', tags: ['荧光'] },
  { code: 'R01', name: '大红',     hex: '#E70012', tags: ['基础'] },
  { code: 'R02', name: '深红',     hex: '#A2231D', tags: ['基础'] },
  { code: 'R03', name: '樱桃红',   hex: '#D0004F', tags: ['基础'] },
  { code: 'R04', name: '玫红',     hex: '#C5006B', tags: ['基础'] },
  { code: 'R05', name: '酒红',     hex: '#6E1420', tags: ['基础'] },
  { code: 'P01', name: '粉红',     hex: '#FDA5C2', tags: ['基础'] },
  { code: 'P02', name: '浅粉',     hex: '#FDCFDB', tags: ['基础'] },
  { code: 'P03', name: '淡粉',     hex: '#FBE0E6', tags: ['基础'] },
  { code: 'P04', name: '桃粉',     hex: '#F7B2A6', tags: ['基础'] },
  { code: 'P05', name: '荧光粉',   hex: '#FF56A0', tags: ['荧光'] },
  { code: 'V01', name: '浅紫',     hex: '#C7A9C9', tags: ['基础'] },
  { code: 'V02', name: '紫色',     hex: '#7B3F98', tags: ['基础'] },
  { code: 'V03', name: '深紫',     hex: '#4B2A6E', tags: ['基础'] },
  { code: 'V04', name: '粉紫',     hex: '#B93288', tags: ['基础'] },
  { code: 'V05', name: '淡紫',     hex: '#B69AC1', tags: ['基础'] },
  { code: 'B01', name: '天蓝',     hex: '#9EC5E6', tags: ['基础'] },
  { code: 'B02', name: '湖蓝',     hex: '#0080C0', tags: ['基础'] },
  { code: 'B03', name: '中蓝',     hex: '#009EDA', tags: ['基础'] },
  { code: 'B04', name: '深蓝',     hex: '#004896', tags: ['基础'] },
  { code: 'B05', name: '藏青',     hex: '#1F3F6B', tags: ['基础'] },
  { code: 'B06', name: '粉蓝',     hex: '#7DC5EB', tags: ['基础'] },
  { code: 'B07', name: '荧光蓝',   hex: '#3ED0FF', tags: ['荧光'] },
  { code: 'B08', name: '宝蓝',     hex: '#1E3EDA', tags: ['基础'] },
  { code: 'T01', name: '青绿',     hex: '#00A0A6', tags: ['基础'] },
  { code: 'T02', name: '薄荷绿',   hex: '#A6DED0', tags: ['基础'] },
  { code: 'T03', name: '孔雀蓝',   hex: '#005E7E', tags: ['基础'] },
  { code: 'G01', name: '嫩绿',     hex: '#A6CE39', tags: ['基础'] },
  { code: 'G02', name: '浅绿',     hex: '#7FBB4F', tags: ['基础'] },
  { code: 'G03', name: '草绿',     hex: '#63B33F', tags: ['基础'] },
  { code: 'G04', name: '绿色',     hex: '#009944', tags: ['基础'] },
  { code: 'G05', name: '深绿',     hex: '#005E33', tags: ['基础'] },
  { code: 'G06', name: '森林绿',   hex: '#2A6633', tags: ['基础'] },
  { code: 'G07', name: '橄榄绿',   hex: '#6C6C1E', tags: ['基础'] },
  { code: 'G08', name: '军绿',     hex: '#4C5D3A', tags: ['基础'] },
  { code: 'G09', name: '荧光绿',   hex: '#47D75B', tags: ['荧光'] },
  { code: 'N01', name: '肉色',     hex: '#F4C6A0', tags: ['基础'] },
  { code: 'N02', name: '深肉色',   hex: '#D9A17A', tags: ['基础'] },
  { code: 'N03', name: '米色',     hex: '#DEBB80', tags: ['基础'] },
  { code: 'N04', name: '卡其',     hex: '#C2A878', tags: ['基础'] },
  { code: 'N05', name: '淡杏',     hex: '#F5DEC3', tags: ['基础'] },
  { code: 'C01', name: '浅棕',     hex: '#C68A55', tags: ['基础'] },
  { code: 'C02', name: '棕色',     hex: '#8C4B22', tags: ['基础'] },
  { code: 'C03', name: '红棕',     hex: '#A0522D', tags: ['基础'] },
  { code: 'C04', name: '深棕',     hex: '#4C2C0F', tags: ['基础'] },
  { code: 'C05', name: '咖啡',     hex: '#6F4E37', tags: ['基础'] },
  { code: 'K01', name: '黑色',     hex: '#000000', tags: ['基础'] },
  { code: 'K02', name: '深灰',     hex: '#4D4D4D', tags: ['基础'] },
  { code: 'K03', name: '中灰',     hex: '#7F7F7F', tags: ['基础'] },
  { code: 'K04', name: '银灰',     hex: '#B3B3B3', tags: ['基础'] },
  { code: 'K05', name: '浅灰',     hex: '#D9D9D9', tags: ['基础'] },
  { code: 'K06', name: '暖灰',     hex: '#A79E92', tags: ['基础'] },
  { code: 'M01', name: '金色',     hex: '#B08D57', tags: ['金属'] },
  { code: 'M02', name: '铜色',     hex: '#8C5A2B', tags: ['金属'] },
  { code: 'S01', name: '珠光白',   hex: '#F0EFEB', tags: ['珠光'] },
  { code: 'S02', name: '珠光粉',   hex: '#EBD6D8', tags: ['珠光'] },
  { code: 'S03', name: '珠光蓝',   hex: '#C8D6E2', tags: ['珠光'] },
  { code: 'S04', name: '珠光紫',   hex: '#CBBAD3', tags: ['珠光'] },
  { code: 'F01', name: '荧光红',   hex: '#FF3B57', tags: ['荧光'] },
  { code: 'F02', name: '荧光紫',   hex: '#C77DFF', tags: ['荧光'] },
  { code: 'X01', name: '透明红',   hex: '#F26C7D', tags: ['透明'] },
  { code: 'X02', name: '透明黄',   hex: '#F7E783', tags: ['透明'] },
  { code: 'X03', name: '透明蓝',   hex: '#7ABBE0', tags: ['透明'] },
  { code: 'X04', name: '透明绿',   hex: '#8BC48A', tags: ['透明'] },
]

// —— 色板注册表 ——
// 追加新色板：新增一个模块，import 后按下面结构注册即可。
export const PALETTES = {
  'mard-221': {
    id: 'mard-221',
    name: 'MARD 标准 221 色',
    description: 'MARD 官方标准系列（A–H, M）· 最常见的基础套装 · 不含 P/Q/R/T/Y/ZG 扩展系列',
    colors: MARD_221,
  },
  'mard-291': {
    id: 'mard-291',
    name: 'MARD 完整 291 色',
    description: 'MARD 官方 15 系列全色板（A–H, M, P, Q, R, T, Y, ZG）· 来源 pixel-beads.com',
    colors: MARD_291,
  },
  'perler-57': {
    id: 'perler-57',
    name: 'Perler 57 色',
    description: 'Perler 5mm 标准色板 · 含霓虹/珍珠特殊系列 · 中文色名 · 来源 pixel-beads.com',
    colors: PERLER,
  },
  'hama-53': {
    id: 'hama-53',
    name: 'Hama Midi 53 色',
    description: 'Hama Midi 5mm 标准色板 · 源站未提供色名（用色号占位）· 来源 pixel-beads.com',
    colors: HAMA_MIDI,
  },
  'artkal-s-159': {
    id: 'artkal-s-159',
    name: 'Artkal S 159 色',
    description: 'Artkal S 系列 5mm 完整色板 · 英文色名 · 来源 pixel-beads.com',
    colors: ARTKAL_S,
  },
  'common-74': {
    id: 'common-74',
    name: '国产常用 74 色',
    description: '精简色板，兼容 Hama/Perler/Artkal 主要色号 · 少色更适合手工拼装',
    colors: COMMON_72,
  },
}

export const DEFAULT_PALETTE_ID = 'mard-221'
