import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, ChevronDown, ChevronRight, Copy, GripVertical, Pin, PinOff,
  RotateCcw, Send, Square, X,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import type { HistoryRecord } from '@/types/models'

interface ResultParams {
  actionId: string
  name: string
  icon: string
  text: string
  providerId: string
  modelId: string
  prompt: string
}

interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function readParams(): ResultParams {
  const raw = window.location.hash
  const qs = raw.includes('?') ? raw.split('?')[1] : ''
  const sp = new URLSearchParams(qs)
  return {
    actionId: sp.get('actionId') || '',
    name: sp.get('name') || '',
    icon: sp.get('icon') || '',
    text: sp.get('text') || '',
    providerId: sp.get('providerId') || '',
    modelId: sp.get('modelId') || '',
    prompt: sp.get('prompt') || '',
  }
}

export default function ResultApp() {
  const chatStore = useChatStore()
  const paramsRef = useRef<ResultParams>(readParams())
  const startedRef = useRef(false)
  const lastCommittedRef = useRef('')
  const historySavedRef = useRef(false)
  const startedAtRef = useRef(performance.now())
  const contentRef = useRef<HTMLDivElement>(null)
  const params = paramsRef.current

  const [sourceText, setSourceText] = useState(params.text)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [turns, setTurns] = useState<ConversationTurn[]>([])

  const runInitial = () => {
    startedAtRef.current = performance.now()
    lastCommittedRef.current = ''
    setTurns([])
    chatStore.clearResult()
    void chatStore.sendMessage({
      providerId: params.providerId,
      modelId: params.modelId,
      systemPrompt: params.prompt.replace(/\{\{selected_text\}\}/g, sourceText),
      userText: sourceText,
    })
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runInitial()
  }, [])

  useEffect(() => {
    if (chatStore.isStreaming || !chatStore.result || chatStore.result === lastCommittedRef.current) return
    lastCommittedRef.current = chatStore.result
    setTurns((current) => [
      ...current,
      { id: `assistant_${Date.now()}`, role: 'assistant', content: chatStore.result },
    ])
    if (!historySavedRef.current) {
      historySavedRef.current = true
      void saveHistory(chatStore.result)
    }
  }, [chatStore.isStreaming, chatStore.result])

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
      selectedText: sourceText,
      actionId: params.actionId,
      actionName: params.name,
      providerId: params.providerId,
      modelId: params.modelId,
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

  useEffect(() => {
    const viewport = contentRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [turns, chatStore.result, chatStore.isStreaming])

  const handleCopy = async () => {
    const latest = chatStore.result || [...turns].reverse().find((turn) => turn.role === 'assistant')?.content
    if (!latest) return
    await navigator.clipboard.writeText(latest)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const handlePin = () => {
    const next = !isPinned
    setIsPinned(next)
    void window.electronAPI?.result.setPinned(next)
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
      providerId: params.providerId,
      modelId: params.modelId,
      systemPrompt: `${params.prompt}\n\n以下是此前对话，请结合上下文继续回答：\n${context}`,
      userText: question,
    })
  }

  return createPortal(
    <div className="result-window-shell fixed inset-0 z-50 flex select-none flex-col overflow-hidden">
      <header className="drag-region flex h-11 shrink-0 items-center gap-2 border-b border-[var(--separator)] px-3">
        <GripVertical size={14} className="text-[var(--text-tertiary)]" />
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--fill-tertiary)] text-sm">{params.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{params.name}</p>
          <p className="truncate text-[10px] text-[var(--text-tertiary)]">{params.modelId}</p>
        </div>

        <div className="no-drag flex items-center gap-0.5">
          {chatStore.isStreaming ? (
            <button onClick={() => chatStore.cancelRequest()} className="result-icon-button text-[#FF3B30]" title="停止生成">
              <Square size={14} />
            </button>
          ) : (
            <>
              <button onClick={handleCopy} className="result-icon-button" title="复制最新回答">
                {copied ? <Check size={14} className="text-[#34C759]" /> : <Copy size={14} />}
              </button>
              <button onClick={runInitial} className="result-icon-button" title="重新生成">
                <RotateCcw size={14} />
              </button>
            </>
          )}
          <button onClick={handlePin} className={`result-icon-button ${isPinned ? 'text-[#007AFF]' : ''}`} title={isPinned ? '取消固定' : '固定窗口'}>
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button onClick={() => window.electronAPI?.result.close()} className="result-icon-button" title="关闭">
            <X size={14} />
          </button>
        </div>
      </header>

      <button
        onClick={() => setSourceOpen(!sourceOpen)}
        className="no-drag flex shrink-0 items-center gap-2 border-b border-[var(--separator)] px-4 py-2 text-left hover:bg-[var(--fill-tertiary)]"
      >
        {sourceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-xs font-medium text-[var(--text-secondary)]">原文</span>
        {!sourceOpen && <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-tertiary)]">{sourceText}</span>}
      </button>

      {sourceOpen && (
        <div className="shrink-0 border-b border-[var(--separator)] px-4 py-3">
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            rows={3}
            className="field-surface w-full resize-none text-xs leading-relaxed"
          />
        </div>
      )}

      <main ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {turns.map((turn, index) => {
            const isLiveDuplicate = turn.role === 'assistant' && index === turns.length - 1 && turn.content === chatStore.result
            if (isLiveDuplicate) return null
            return turn.role === 'user' ? (
              <div key={turn.id} className="ml-auto max-w-[86%] rounded-xl bg-[#007AFF] px-3 py-2 text-sm leading-relaxed text-white">
                {turn.content}
              </div>
            ) : (
              <div key={turn.id} className="result-answer">
                <MarkdownRenderer content={turn.content} />
              </div>
            )
          })}

          {chatStore.error ? (
            <div className="rounded-xl bg-[#FF3B30]/10 p-3 text-xs text-[#FF3B30]">
              <p>{chatStore.error}</p>
              <button onClick={runInitial} className="mt-2 font-medium underline">重试</button>
            </div>
          ) : chatStore.isStreaming || chatStore.result ? (
            <div className="result-answer">
              {chatStore.result ? (
                <MarkdownRenderer content={chatStore.result} />
              ) : (
                <div className="thinking-text">正在思考...</div>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="shrink-0 border-t border-[var(--separator)] p-3">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--separator)] bg-[var(--bg-primary)] p-2 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/15">
          <textarea
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
            className="max-h-24 min-h-7 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            placeholder={chatStore.isStreaming ? '回答生成中...' : '继续追问，Enter 发送'}
          />
          <button
            onClick={() => void handleFollowUp()}
            disabled={!followUp.trim() || chatStore.isStreaming}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#007AFF] text-white transition-colors hover:bg-[#0066D6] disabled:bg-[var(--text-tertiary)]"
            title="发送"
          >
            <Send size={15} />
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}
