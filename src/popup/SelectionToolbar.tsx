import { useState, type CSSProperties, type Ref } from 'react'
import { motion } from 'framer-motion'
import type { ActionConfig, PopupSettings } from '@/types/models'
import { getPopupEnterState, getPopupExitState, popupMotionEase } from './popupMotion'
import ActionIcon from '@/components/ActionIcon'

type ToolbarAction = Pick<ActionConfig, 'id' | 'name' | 'icon'>

interface SelectionToolbarProps {
  actions: ToolbarAction[]
  popup: PopupSettings
  emptyText: string
  notice?: string
  rootRef?: Ref<HTMLDivElement>
  onAction?: (action: ToolbarAction, index: number) => void
  preview?: boolean
}

export default function SelectionToolbar({
  actions,
  popup,
  emptyText,
  notice = '',
  rootRef,
  onAction,
  preview = false,
}: SelectionToolbarProps) {
  const isVertical = popup.layout === 'vertical'
  const isIconOnly = popup.layout === 'icon-only'
  const duration = popup.animationDurationMs / 1000
  const [flashingId, setFlashingId] = useState<string | null>(null)
  const triggerFlash = (id: string) => {
    setFlashingId(id)
    setTimeout(() => setFlashingId((current) => (current === id ? null : current)), 400)
  }

  return (
    <motion.div
      ref={rootRef}
      layoutId={preview ? undefined : 'popup-shell'}
      initial={getPopupEnterState(popup.enterAnimation)}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={getPopupExitState(popup.exitAnimation)}
      transition={{
        duration,
        ease: popupMotionEase,
        layout: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] },
      }}
      id={preview ? undefined : 'popup-root'}
      className={`selection-toolbar flex select-none ${isVertical ? 'selection-toolbar-vertical flex-col items-stretch' : 'items-center'}`}
      style={{
        WebkitAppRegion: preview ? undefined : 'no-drag',
        // 把 popup.opacity 注入到 CSS 变量，让 .selection-toolbar 的 background 用 rgb()/var()
        // 实现"只调背景透明度，文字保持不透明"，避免 framer-motion opacity 把整个 div 一起变淡
        ['--popup-bg-alpha' as any]: popup.opacity / 100,
        background: 'rgb(var(--popup-bg-rgb) / var(--popup-bg-alpha))',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: popup.cornerRadius,
        padding: 3,
        // 预览模式：按按钮自然宽度显示，外层 .ppv-toolbar-wrap 的 max-width:100% 兜底
        width: preview ? 'max-content' : (isVertical ? popup.width : 'max-content'),
        maxWidth: preview ? '100%' : (isVertical ? popup.width : 720),
      } as CSSProperties}
    >
      {notice ? (
        <span className="whitespace-nowrap px-2 text-xs font-medium text-[#FF9500]">{notice}</span>
      ) : actions.length === 0 ? (
        preview ? (
          <span className="px-2 text-xs text-[var(--text-tertiary)]">{emptyText}</span>
        ) : (
          // 真弹窗的空状态：插画 + 文案 + 跳转动作管理
          <div className="selection-toolbar-empty">
            <div className="empty-icon" aria-hidden>🪄</div>
            <div className="empty-title">还没有启用的动作</div>
            <div className="empty-desc">{emptyText}</div>
          </div>
        )
      ) : (
        actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => {
              triggerFlash(action.id)
              onAction?.(action, index)
            }}
            className={`selection-toolbar-button ${isIconOnly ? 'selection-toolbar-button-icon' : ''}
              ${popup.showHoverEffect ? 'selection-toolbar-button-hover' : ''}
              ${popup.showButtonBackground ? 'selection-toolbar-button-filled' : ''}
              ${flashingId === action.id ? 'is-flashing' : ''}`}
            style={{ WebkitAppRegion: preview ? undefined : 'no-drag' } as CSSProperties}
            /* 仅在 icon-only 模式启用悬浮文字提示（按钮没显示名字才需要 hover 提示）；
               且不带数字前缀，保持简单 */
            title={isIconOnly ? action.name : undefined}
            aria-label={isIconOnly ? `${action.name}（按数字键 ${index + 1}）` : undefined}
          >
            <span className="leading-none" style={{ fontSize: Math.min(popup.iconSize, 20) }}>
              <ActionIcon icon={action.icon} size={Math.min(popup.iconSize, 20)} />
            </span>
            {!isIconOnly && <span className="text-[var(--text-primary)]">{action.name}</span>}
          </button>
        ))
      )}
    </motion.div>
  )
}
