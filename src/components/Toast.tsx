import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
})

export const useToast = () => useContext(ToastContext)

const ICON_MAP = {
  success: { icon: CheckCircle, color: 'text-[#34C759]' },
  error: { icon: AlertCircle, color: 'text-[#FF3B30]' },
  warning: { icon: AlertTriangle, color: 'text-[#FF9500]' },
  info: { icon: Info, color: 'text-[#007AFF]' },
}

const BG_MAP = {
  success: 'bg-[#34C759]/10 border-[#34C759]/20',
  error: 'bg-[#FF3B30]/10 border-[#FF3B30]/20',
  warning: 'bg-[#FF9500]/10 border-[#FF9500]/20',
  info: 'bg-[#007AFF]/10 border-[#007AFF]/20',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const { icon: Icon, color } = ICON_MAP[toast.type]

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-ios-md animate-slide-up ${BG_MAP[toast.type]}`}
    >
      <Icon size={18} className={color} />
      <span className="text-sm text-[var(--text-primary)] flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { id, type, message, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
