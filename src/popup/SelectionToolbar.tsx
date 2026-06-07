import type { CSSProperties, Ref } from 'react'
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

  return (
    <motion.div
      ref={rootRef}
      initial={getPopupEnterState(popup.enterAnimation)}
      animate={{ opacity: popup.opacity / 100, scale: 1, y: 0 }}
      exit={getPopupExitState(popup.exitAnimation)}
      transition={{ duration, ease: popupMotionEase }}
      id={preview ? undefined : 'popup-root'}
      className={`selection-toolbar flex select-none ${isVertical ? 'selection-toolbar-vertical flex-col items-stretch' : 'items-center'}`}
      style={{
        WebkitAppRegion: preview ? undefined : 'no-drag',
        background: 'var(--popup-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: popup.cornerRadius,
        padding: 3,
        width: isVertical ? popup.width : 'max-content',
        maxWidth: isVertical ? popup.width : 720,
      } as CSSProperties}
    >
      {notice ? (
        <span className="whitespace-nowrap px-2 text-xs font-medium text-[#FF9500]">{notice}</span>
      ) : actions.length === 0 ? (
        <span className="px-2 text-xs text-[var(--text-tertiary)]">{emptyText}</span>
      ) : (
        actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => onAction?.(action, index)}
            className={`selection-toolbar-button ${isIconOnly ? 'selection-toolbar-button-icon' : ''}
              ${popup.showHoverEffect ? 'selection-toolbar-button-hover' : ''}
              ${popup.showButtonBackground ? 'selection-toolbar-button-filled' : ''}`}
            style={{ WebkitAppRegion: preview ? undefined : 'no-drag' } as CSSProperties}
            title={`${index + 1}. ${action.name}`}
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
