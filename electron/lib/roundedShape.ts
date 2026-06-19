/**
 * 纯函数：把圆角矩形窗口转成 Electron setShape() 接受的逐行矩形集合。
 * 从 windows.ts 抽出，刻意不依赖 electron，便于单测。
 *
 * CSS border-radius 只裁剪网页内容，Electron 窗口的方形"硬边"还会露出来，
 * 因此需要 setShape() 让 OS 层也按圆角裁剪窗口。
 *
 * 公式：对每行 y，圆角区域内 inset = ceil(r - sqrt(r² - dy²))，算左右内缩量；
 * 相邻同宽行合并为一个矩形以减少 shape 数量。
 */
export interface ShapeRect {
  x: number
  y: number
  width: number
  height: number
}

export function getRoundedRectShape(width: number, height: number, radius: number): ShapeRect[] {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const r = Math.max(0, Math.min(Math.round(radius), Math.floor(w / 2), Math.floor(h / 2)))
  if (r <= 0) return [{ x: 0, y: 0, width: w, height: h }]

  const rects: ShapeRect[] = []
  let pending: ShapeRect | null = null
  const pushRow = (y: number, x: number, rowWidth: number) => {
    if (rowWidth <= 0) return
    if (pending && pending.x === x && pending.width === rowWidth && pending.y + pending.height === y) {
      pending.height += 1
      return
    }
    if (pending) rects.push(pending)
    pending = { x, y, width: rowWidth, height: 1 }
  }

  for (let y = 0; y < h; y += 1) {
    let inset = 0
    if (y < r) {
      const dy = r - y - 0.5
      inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - dy * dy))))
    } else if (y >= h - r) {
      const dy = y - (h - r) + 0.5
      inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - dy * dy))))
    }
    pushRow(y, inset, w - inset * 2)
  }
  if (pending) rects.push(pending)
  return rects
}
