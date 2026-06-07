import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { motion } from 'framer-motion'
import {
  Check, ChevronDown, ChevronRight, Copy, RotateCcw, Square, X,
} from 'lucide-react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ActionIcon from '@/components/ActionIcon'
import type { PopupSession, PopupSettings } from '@/types/models'
import { useToast } from '@/components/Toast'

interface ExpandedResultProps {
  session: PopupSession
  popup: PopupSettings
  rootRef?: Ref<HTMLDivElement>
  onRetry: () => void
  onStop: () => void
  onCollapse: () => void
  onClose: () => void
}

export default function ExpandedResult({
  session,
  popup,
  rootRef,
  onRetry,
  onStop,
  onCollapse,
  onClose,
}: ExpandedResultProps) {
  const { addToast } = useToast()
  const contentRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const assistantText = useMemo(() => {
    const committed = [...session.messages].reverse().find((message) => message.role === 'assistant')?.content || ''
    return session.streamText || committed
  }, [session.messages, session.streamText])

  const isBusy = session.status === 'preparing' || session.status === 'streaming'
  const canRetry = Boolean(session.action) && !isBusy

  useEffect(() => {
    const viewport = contentRef.current
    if (!viewport || !autoScrollRef.current) return
    viewport.scrollTop = viewport.scrollHeight
  }, [assistantText, session.status])

  const handleScroll = () => {
    const viewport = contentRef.current
    if (!viewport) return
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    autoScrollRef.current = distanceFromBottom < 32
  }

  const handleCopy = async () => {
    if (!assistantText) return
    try {
      await navigator.clipboard.writeText(assistantText)
      setCopied(true)
      addToast('success', '已复制到剪贴板', 1400)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      addToast('error', '复制失败，请手动选择复制', 1800)
    }
  }

  const errorKind = useMemo(() => {
    const err = (session.error || '').toLowerCase()
    if (err.includes('网络') || err.includes('timeout') || err.includes('fetch')) return '网络好像断开了'
    if (err.includes('key') || err.includes('401') || err.includes('无效')) return 'API Key 无效'
    if (err.includes('频繁') || err.includes('429') || err.includes('限流')) return '请求太频繁了'
    if (err.includes('额度') || err.includes('402')) return '当前账号额度不足'
    if (err.includes('取消') || err.includes('cancel')) return '已取消生成'
    return '生成失败了'
  }, [session.error])

  return (
    <motion.div
      ref={rootRef}
      layoutId="popup-shell"
      id="popup-root"
      className="expanded-result-shell"
      style={{
        ['--popup-bg-alpha' as any]: popup.opacity / 100,
        ['--popup-radius' as any]: `${popup.cornerRadius}px`,
        borderRadius: popup.cornerRadius,
        transformOrigin: 'top left',
      } as CSSProperties}
      initial={{ opacity: 0.98, clipPath: 'inset(0 0 calc(100% - 40px) 0 round var(--popup-radius, 12px))' }}
      animate={{
        opacity: 1,
        clipPath: 'inset(0 0 0 0 round var(--popup-radius, 12px))',
      }}
      exit={{
        opacity: 0,
        clipPath: 'inset(0 0 calc(100% - 40px) 0 round var(--popup-radius, 12px))',
      }}
      transition={{
        duration: 0.22,
        ease: [0.2, 0.8, 0.2, 1],
        layout: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
      }}
    >
      <header className="expanded-result-header drag-region">
        <span className="expanded-result-title">
          <span className="expanded-result-icon">
            {session.action && <ActionIcon icon={session.action.icon} size={14} />}
          </span>
          <span className="expanded-result-name">{session.action?.name || 'AI 结果'}</span>
          {session.modelId && <span className="expanded-result-model">{session.modelId}</span>}
        </span>
        <div className="expanded-result-actions no-drag">
          {isBusy ? (
            <button onClick={onStop} className="expanded-result-icon-btn text-[#FF3B30]" title="停止生成">
              <Square size={13} />
            </button>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="expanded-result-icon-btn"
                title="复制最新回答"
                disabled={!assistantText}
              >
                {copied ? <Check size={13} className="text-[#34C759]" /> : <Copy size={13} />}
              </button>
              <button
                onClick={onRetry}
                className="expanded-result-icon-btn"
                title="重新生成"
                disabled={!canRetry}
              >
                <RotateCcw size={13} />
              </button>
            </>
          )}
          <button onClick={onCollapse} className="expanded-result-icon-btn" title="收为工具栏">
            <ChevronDown size={13} />
          </button>
          <button onClick={onClose} className="expanded-result-icon-btn" title="关闭">
            <X size={13} />
          </button>
        </div>
      </header>

      <button
        onClick={() => setSourceOpen((open) => !open)}
        className="expanded-result-source-toggle no-drag"
        title={sourceOpen ? '收起原文' : '展开原文'}
      >
        {sourceOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>原文</span>
        {!sourceOpen && <span className="expanded-result-source-preview">{session.selectedText}</span>}
      </button>

      {sourceOpen && (
        <div className="expanded-result-source-edit no-drag">
          <div className="field-surface max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
            {session.selectedText}
          </div>
        </div>
      )}

      <main ref={contentRef} className="expanded-result-body" onScroll={handleScroll}>
        {session.status === 'error' ? (
          <div className="expanded-result-error" role="alert">
            <div className="error-title">{errorKind}</div>
            <div className="error-msg">{session.error}</div>
            <div className="error-tip">可以重试，或到模型管理检查配置</div>
            <button onClick={onRetry} className="expanded-result-retry" disabled={!canRetry}>
              <RotateCcw size={12} />
              <span>重新生成</span>
            </button>
          </div>
        ) : (
          <div className="expanded-result-document">
            {assistantText ? (
              <>
                <MarkdownRenderer content={assistantText} />
                {isBusy && <span className="streaming-cursor" aria-hidden />}
              </>
            ) : (
              <div className="thinking-text">正在连接模型…</div>
            )}
          </div>
        )}
      </main>

      <footer className="expanded-result-footer no-drag">
        {isBusy && (
          <div className="streaming-progress" aria-live="polite">
            <span className="dots" aria-hidden><span /><span /><span /></span>
            <span>{session.status === 'preparing' ? '正在连接模型' : '正在生成回复'}</span>
            <span className="count">{assistantText.length} 字</span>
          </div>
        )}
        {!isBusy && (session.latencyMs != null || session.tokenUsage?.totalTokens != null) && (
          <div className="result-meta" aria-live="polite">
            <div className="result-meta-stats">
              {session.latencyMs != null && <span>{(session.latencyMs / 1000).toFixed(1)}s</span>}
              {session.tokenUsage?.totalTokens != null && (
                <>
                  {session.latencyMs != null && <span className="sep">·</span>}
                  <span>{session.tokenUsage.totalTokens} tokens</span>
                </>
              )}
            </div>
          </div>
        )}
      </footer>
    </motion.div>
  )
}
