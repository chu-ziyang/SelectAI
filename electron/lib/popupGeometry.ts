/**
 * 纯函数：弹窗位置/尺寸计算。
 * 从 windows.ts 抽出，刻意不依赖 electron 的 screen API，
 * 把"屏幕工作区"作为入参传入，便于在 Node 环境单测。
 */
export type Placement =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface PopupPlacementConfig {
  placement: Placement
  offsetX: number
  offsetY: number
  avoidScreenEdge: boolean
}

/**
 * 根据光标点、弹窗尺寸、工作区、布局配置计算窗口坐标。
 * gapX/gapY = 固定 8px 边距 + 用户偏移，与原 windows.ts 行为一致。
 */
export function calculatePopupBounds(
  cursorPoint: { x: number; y: number },
  popupW: number,
  popupH: number,
  workArea: WorkArea,
  cfg: PopupPlacementConfig,
): Rect {
  const gapX = 8 + cfg.offsetX
  const gapY = 8 + cfg.offsetY

  let x = cursorPoint.x + gapX
  let y = cursorPoint.y + gapY

  switch (cfg.placement) {
    case 'top-left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y - popupH - gapY
      break
    case 'top':
      x = cursorPoint.x - popupW / 2 + cfg.offsetX
      y = cursorPoint.y - popupH - gapY
      break
    case 'top-right':
      x = cursorPoint.x + gapX
      y = cursorPoint.y - popupH - gapY
      break
    case 'left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y - popupH / 2 + cfg.offsetY
      break
    case 'center':
      x = cursorPoint.x - popupW / 2 + cfg.offsetX
      y = cursorPoint.y - popupH / 2 + cfg.offsetY
      break
    case 'right':
      x = cursorPoint.x + gapX
      y = cursorPoint.y - popupH / 2 + cfg.offsetY
      break
    case 'bottom-left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y + gapY
      break
    case 'bottom':
      x = cursorPoint.x - popupW / 2 + cfg.offsetX
      y = cursorPoint.y + gapY
      break
    case 'bottom-right':
    default:
      x = cursorPoint.x + gapX
      y = cursorPoint.y + gapY
      break
  }

  if (cfg.avoidScreenEdge) {
    x = Math.min(Math.max(x, workArea.x + 12), workArea.x + workArea.width - popupW - 12)
    y = Math.min(Math.max(y, workArea.y + 12), workArea.y + workArea.height - popupH - 12)
  }

  return { x: Math.round(x), y: Math.round(y), width: popupW, height: popupH }
}
