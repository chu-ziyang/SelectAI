import { useEffect, useRef, useState, type Ref } from 'react'
import { motion } from 'framer-motion'
import {
  Check, ChevronDown, ChevronRight, Copy, RotateCcw, Send, Square, X,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ActionIcon from '@/components/ActionIcon'
import type { ActionConfig, HistoryRecord } from '@/types/models'

interface ExpandedResultProps {
  action: ActionConfig
  sourceText: string
  providerId: string
  modelId: string
  prompt: string
  rootRef?: Ref<HTMLDivElement>
  onCollapse: () => void
}

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/**
 * 弹窗工具栏内联展开后的结果卡。
 * 复刻 src/popup/ResultApp.tsx 的核心交互（流式 / 复制 / 重新生成 / 追问），
 * 但针对窄弹窗尺寸做了紧凑处理：
 *   - header 一行：图标 + 动作名 + 操作按钮组
 *   - 主体 13px 行高 1.6，可滚动
 *   - 底部追问输入框常驻（streaming 时禁用）
 *   - 无拖动区（弹窗本身可移动）
 */
export default function ExpandedResult({
  action,
  sourceText,
  providerId,
  modelId,
  prompt,
  rootRef,
  onCollapse,
}: ExpandedResultProps) {
  const chatStore = useChatStore()
  const startedRef = useRef(false)
  const lastCommittedRef = useRef('')
  const historySavedRef = useRef(false)
  const startedAtRef = useRef(performance.now())
  const contentRef = useRef<HTMLDivElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)

  const [draftSource, setDraftSource] = useState(sourceText)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [turns, setTurns] = useState<ConversationTurn[]>([])

  const runInitial = () => {
    startedAtRef.current = performance.now()
    lastCommittedRef.current = ''
    historySavedRef.current = false
    setTurns([])
    chatStore.clearResult()
    void chatStore.sendMessage({
      providerId,
      modelId,
      systemPrompt: prompt.replace(/\{\{selected_text\}\}/g, draftSource),
      userText: draftSource,
    })
  }

  // 首次挂载自动发起
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runInitial()
    // 进入结果卡后自动聚焦追问框，等流式开始时再放权
    const t = setTimeout(() => followUpRef.current?.focus(), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 流式回填：把 chatStore.result 当成最后一段 assistant
  useEffect(() => {
    if (chatStore.isStreaming || !chatStore.result) return
    if (chatStore.result === lastCommittedRef.current) return
    lastCommittedRef.current = chatStore.result
    setTurns((current) => {
      // 若最后一段是 assistant 且正在被流式填充，则就地更新；否则追加
      const last = current[current.length - 1]
      if (last && last.role === 'assistant') {
        return [...current.slice(0, -1), { ...last, content: chatStore.result }]
      }
      return [
        ...current,
        { id: `assistant_${Date.now()}`, role: 'assistant', content: chatStore.result },
      ]
    })
    if (!historySavedRef.current) {
      historySavedRef.current = true
      void saveHistory(chatStore.result)
    }
  }, [chatStore.isStreaming, chatStore.result])

  // 滚动到底
  useEffect(() => {
    const viewport = contentRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [turns, chatStore.result, chatStore.isStreaming])

  const saveHistory = async (resultText: string) => {
    const api = window.electronAPI
    if (!api) return
    const settings = await api.store.get('settings') as { saveHistory?: boolean; historyRetentionDays?: number } | undefined
    if (settings?.saveHistory === false) return

    const retentionDays = settings?.historyRetentionDays || 30
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const existing = ((await api.store.get('history')) || []) as HistoryRecord[]
    const record: HistoryRecord = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      selectedText: draftSource,
      actionId: action.id,
      actionName: action.name,
      providerId,
      modelId,
      resultText,
      status: 'success',
      latencyMs: Math.round(performance.now() - startedAtRef.current),
      createdAt: new Date().toISOString(),
    }
    await api.store.set('history', [
      ...existing.filter((item) => new Date(item.createdAt).getTime() >= cutoff),
      record,
    ].slice(-500))
  }

  const handleCopy = async () => {
    const latest = chatStore.result || [...turns].reverse().find((turn) => turn.role === 'assistant')?.content
    if (!latest) return
    await navigator.clipboard.writeText(latest)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const handleFollowUp = async () => {
    const question = followUp.trim()
    if (!question || chatStore.isStreaming) return

    const context = turns
      .map((turn) => `${turn.role === 'user' ? '用户' : '助手'}：${turn.content}`)
      .join('\n\n')
    setTurns((current) => [
      ...current,
      { id: `user_${Date.now()}`, role: 'user', content: question },
    ])
    setFollowUp('')
    lastCommittedRef.current = ''

    await chatStore.sendMessage({
      providerId,
      modelId,
      systemPrompt: `${prompt}\n\n以下是此前对话，请结合上下文继续回答：\n${context}`,
      userText: question,
    })
  }

  const streaming = chatStore.isStreaming
  const hasContent = turns.length > 0 || chatStore.result || chatStore.error

  return (
    <motion.div
      ref={rootRef}
      id="popup-root"
      className="expanded-result-shell"
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 4 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <header className="expanded-result-header no-drag">
        <span className="expanded-result-title">
          <span className="expanded-result-icon">
            <ActionIcon icon={action.icon} size={14} />
          </span>
          <span className="expanded-result-name">{action.name}</span>
          <span className="expanded-result-model">{modelId}</span>
        </span>
        <div className="expanded-result-actions no-drag">
          {streaming ? (
            <button
              onClick={() => chatStore.cancelRequest()}
              className="expanded-result-icon-btn text-[#FF3B30]"
              title="停止生成"
            >
              <Square size={13} />
            </button>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="expanded-result-icon-btn"
                title="复制最新回答"
                disabled={!hasContent}
              >
                {copied ? <Check size={13} className="text-[#34C759]" /> : <Copy size={13} />}
              </button>
              <button
                onClick={runInitial}
                className="expanded-result-icon-btn"
                title="重新生成"
                disabled={!hasContent}
              >
                <RotateCcw size={13} />
              </button>
            </>
          )}
          <button
            onClick={onCollapse}
            className="expanded-result-icon-btn"
            title="收为工具栏"
          >
            <ChevronDown size={13} />
          </button>
          <button
            onClick={() => window.electronAPI?.popup.close()}
            className="expanded-result-icon-btn"
            title="关闭"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      <button
        onClick={() => setSourceOpen(!sourceOpen)}
        className="expanded-result-source-toggle no-drag"
        title={sourceOpen ? '收起原文' : '展开原文'}
      >
        {sourceOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>原文</span>
        {!sourceOpen && <span className="expanded-result-source-preview">{draftSource}</span>}
      </button>

      {sourceOpen && (
        <div className="expanded-result-source-edit no-drag">
          <textarea
            value={draftSource}
            onChange={(event) => setDraftSource(event.target.value)}
            rows={3}
            className="field-surface w-full resize-none text-xs leading-relaxed"
            spellCheck={false}
          />
        </div>
      )}

      <main ref={contentRef} className="expanded-result-body">
        {turns.length === 0 && !chatStore.result && chatStore.error && (
          <div className="expanded-result-error">
            <p>{chatStore.error}</p>
            <button onClick={runInitial} className="expanded-result-retry">重试</button>
          </div>
        )}
        {turns.length === 0 && !chatStore.result && !chatStore.error && streaming && (
          <div className="thinking-text">正在思考…</div>
        )}
        <div className="space-y-3">
          {turns.map((turn) => (
            turn.role === 'user' ? (
              <div key={turn.id} className="expanded-result-user">
                {turn.content}
              </div>
            ) : (
              <div key={turn.id} className="result-answer">
                <MarkdownRenderer content={turn.content} />
              </div>
            )
          ))}
        </div>
      </main>

      <footer className="expanded-result-footer no-drag">
        <div className="expanded-result-input-wrap">
          <textarea
            ref={followUpRef}
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleFollowUp()
              }
            }}
            rows={1}
            disabled={chatStore.isStreaming}
            className="expanded-result-input"
            placeholder={chatStore.isStreaming ? '回答生成中…' : '继续追问，Enter 发送'}
            spellCheck={false}
          />
          <button
            onClick={() => void handleFollowUp()}
            disabled={!followUp.trim() || chatStore.isStreaming}
            className="expanded-result-send"
            title="发送"
          >
            <Send size={13} />
          </button>
        </div>
      </footer>
    </motion.div>
  )
}
