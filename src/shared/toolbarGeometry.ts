/**
 * 纯函数：划词工具栏宽度估算 & 结果区尺寸。
 * 从 PopupApp.tsx 抽出，便于单测回归。
 *
 * 注意：estimateToolbarWidth 只用于"窗口首次显示前"的兜底尺寸，
 * 挂载后由 PopupApp 的 ResizeObserver 用真实宽度二次校准。
 */

/** 单按钮：padding(16) + icon(20) + gap(6) + 文本 */
const PADDING_PER_BUTTON = 16
const ICON_WIDTH = 20
const GAP_ICON_TEXT = 6
/** 中文 12px font-weight 560 字符宽约 14-16px，取 16 防裁切 */
const CHAR_WIDTH = 16
/** icon-only 模式按钮宽度 */
const ICON_ONLY_BUTTON_WIDTH = 30
const TOOLBAR_CHROME = 6

export function estimateToolbarWidth(
  actions: Array<Pick<{ name: string }, 'name'>>,
  popupWidth: number,
  isVertical: boolean,
  isIconOnly: boolean,
): number {
  if (isVertical) return popupWidth
  const contentWidth = actions.reduce((sum, action) => {
    if (isIconOnly) return sum + ICON_ONLY_BUTTON_WIDTH
    const buttonWidth = PADDING_PER_BUTTON + ICON_WIDTH + GAP_ICON_TEXT + action.name.length * CHAR_WIDTH
    return sum + Math.max(60, Math.min(140, buttonWidth))
  }, TOOLBAR_CHROME)
  return Math.min(720, Math.max(180, popupWidth, contentWidth))
}

/** 展开为结果卡时的锁定尺寸：宽度夹在 [360,720]，高度取 max(300, popupMaxHeight) */
export function resultBounds(popupWidth: number, popupMaxHeight: number): { width: number; height: number } {
  return {
    width: Math.min(720, Math.max(360, popupWidth)),
    height: Math.max(300, popupMaxHeight),
  }
}
