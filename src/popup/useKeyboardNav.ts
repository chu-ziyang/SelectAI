import { useEffect } from 'react'

interface KeyboardNavOptions {
  enabled: boolean
  /**
   * 是否允许数字键 1-9 触发动作。展开为结果卡时关闭，避免误触。
   */
  allowDigitKeys?: boolean
  actionCount: number
  onAction: (index: number) => void
  onClose: () => void
  /**
   * 弹窗展开态下的 Esc 处理：先收起（不解散弹窗），不再走 onClose。
   * 不传时 Esc 走原 onClose 路径。
   */
  onCollapse?: () => void
  onCancelRequest?: () => void
}

/**
 * 弹窗键盘导航 hook
 * - 数字键 1-9 触发对应动作（仅当 allowDigitKeys 为 true）
 * - Esc 优先调用 onCollapse（展开态）；否则走 onCancelRequest + onClose（工具栏态）
 */
export function useKeyboardNav({
  enabled,
  allowDigitKeys = true,
  actionCount,
  onAction,
  onClose,
  onCollapse,
  onCancelRequest,
}: KeyboardNavOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 数字键触发动作（仅在 idle 工具栏态允许）
      if (allowDigitKeys) {
        const digit = parseInt(e.key)
        if (digit >= 1 && digit <= Math.min(actionCount, 9)) {
          e.preventDefault()
          e.stopPropagation()
          onAction(digit - 1)
          return
        }
      }

      // Esc：展开态优先收起，工具栏态才真正关闭
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (onCollapse) {
          onCollapse()
          return
        }
        if (onCancelRequest) onCancelRequest()
        onClose()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [enabled, allowDigitKeys, actionCount, onAction, onClose, onCollapse, onCancelRequest])
}
