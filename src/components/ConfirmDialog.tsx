import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 危险操作（删除）— 确认按钮用红色，标题前显示警告图标 */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/15 backdrop-blur-[2px]"
          onClick={onCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="w-[320px] max-w-[90vw] overflow-hidden rounded-xl border border-[var(--separator)] bg-white/95 shadow-ios-xl backdrop-blur-xl dark:bg-[var(--bg-secondary)]"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 内容区 */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-start gap-2.5">
                {danger && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FF3B30]/10">
                    <AlertTriangle size={14} className="text-[#FF3B30]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{message}</p>
                </div>
              </div>
            </div>

            {/* 按钮区 */}
            <div className="flex border-t border-[var(--separator)]">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)]"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 border-l border-[var(--separator)] px-4 py-2.5 text-[13px] font-semibold transition-colors active:bg-[var(--fill-secondary)] ${
                  danger
                    ? 'text-[#FF3B30] hover:bg-[#FF3B30]/8'
                    : 'text-[#007AFF] hover:bg-[#007AFF]/8'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
