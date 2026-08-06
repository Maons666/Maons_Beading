// 导出：PNG（当前画布截图）、CSV（用豆清单）

export function downloadCanvasPng(canvas, filename) {
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export function downloadCsv(rows, total, filename) {
  const header = ['色号', '名称', 'HEX', '数量', '占比(%)']
  const lines = [header.join(',')]
  for (const r of rows) {
    const c = r.color
    const pct = total > 0 ? (r.count / total * 100).toFixed(2) : '0.00'
    // 简单转义 name（避免中文名里出现逗号）
    const safeName = /[,"\n]/.test(c.name) ? `"${c.name.replace(/"/g, '""')}"` : c.name
    lines.push([c.code, safeName, c.hex, r.count, pct].join(','))
  }
  lines.push('')
  lines.push(['合计', '', '', total, '100.00'].join(','))
  const csv = '﻿' + lines.join('\n') // BOM，Excel 打开中文不乱码
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
