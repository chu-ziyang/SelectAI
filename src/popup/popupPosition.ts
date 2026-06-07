/**
 * 弹窗位置计算引擎
 * 根据鼠标位置、屏幕尺寸、弹窗尺寸、用户设置，计算最佳弹窗坐标
 */

export type Placement =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right'

export interface PopupGeometry {
  popupWidth: number
  popupHeight: number
  placement: Placement
  offsetX: number
  offsetY: number
  avoidScreenEdge: boolean
  followMouse: boolean
}

export interface ScreenInfo {
  width: number
  height: number
  availWidth: number
  availHeight: number
}

/**
 * 获取主屏幕信息（实际应从 Electron screen API 获取）
 */
export function getScreenInfo(): ScreenInfo {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
  }
}

/**
 * 计算弹窗位置
 */
export function calcPopupPosition(
  mouseX: number,
  mouseY: number,
  geometry: PopupGeometry,
  screen?: ScreenInfo,
): { x: number; y: number } {
  const scr = screen || getScreenInfo()
  const { popupWidth, popupHeight, placement, offsetX, offsetY, avoidScreenEdge } = geometry

  // 基于选中文档位置的基准坐标
  let x = mouseX
  let y = mouseY

  // 根据 placement 计算偏移
  switch (placement) {
    case 'top-left':
      x = mouseX - popupWidth
      y = mouseY - popupHeight - offsetY
      break
    case 'top':
      x = mouseX - popupWidth / 2
      y = mouseY - popupHeight - offsetY
      break
    case 'top-right':
      x = mouseX + offsetX
      y = mouseY - popupHeight - offsetY
      break
    case 'left':
      x = mouseX - popupWidth - offsetX
      y = mouseY - popupHeight / 2
      break
    case 'center':
      x = mouseX - popupWidth / 2
      y = mouseY - popupHeight / 2
      break
    case 'right':
      x = mouseX + offsetX
      y = mouseY - popupHeight / 2
      break
    case 'bottom-left':
      x = mouseX - popupWidth
      y = mouseY + offsetY
      break
    case 'bottom':
      x = mouseX - popupWidth / 2
      y = mouseY + offsetY
      break
    case 'bottom-right':
    default:
      x = mouseX + offsetX
      y = mouseY + offsetY
      break
  }

  // 智能避让屏幕边缘
  if (avoidScreenEdge) {
    const margin = 12
    if (x < margin) x = margin
    if (y < margin) y = margin
    if (x + popupWidth > scr.availWidth - margin) {
      x = scr.availWidth - popupWidth - margin
    }
    if (y + popupHeight > scr.availHeight - margin) {
      y = scr.availHeight - popupHeight - margin
    }
  }

  return { x: Math.round(x), y: Math.round(y) }
}
