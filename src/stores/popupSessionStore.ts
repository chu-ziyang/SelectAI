import { create } from 'zustand'
import { streamChat, type StreamChunk } from '@/services/api'
import type { ActionConfig, ChatMessage, HistoryRecord, PopupSession } from '@/types/models'

interface StartSessionParams {
  sessionId: string
  selectedText: string
  action: ActionConfig
  providerId: string
  modelId: string
  prompt: string
}

interface PopupSessionState {
  session: PopupSession
  prompt: string
  start: (params: StartSessionParams) => Promise<void>
  cancel: () => Promise<void>
  clearForToolbar: (sessionId: string, selectedText: string) => void
  hide: () => void
}

const emptySession: PopupSession = {
  id: '',
  selectedText: '',
  action: null,
  providerId: null,
  modelId: null,
  status: 'hidden',
  messages: [],
  streamText: '',
  error: null,
  startedAt: null,
  latencyMs: null,
  tokenUsage: null,
}

function makeUserMessage(content: string): ChatMessage {
  return {
    id: `user_${Date.now()}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function makeAssistantMessage(content: string): ChatMessage {
  return {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    content,
    timestamp: Date.now(),
  }
}

async function saveHistory(session: PopupSession, resultText: string) {
  const api = window.electronAPI
  if (!api || !session.action || !session.providerId || !session.modelId) return

  const settings = await api.store.get('settings') as { saveHistory?: boolean; historyRetentionDays?: number } | undefined
  if (settings?.saveHistory === false) return

  const retentionDays = settings?.historyRetentionDays || 30
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const existing = ((await api.store.get('history')) || []) as HistoryRecord[]
  const record: HistoryRecord = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    selectedText: session.selectedText,
    actionId: session.action.id,
    actionName: session.action.name,
    providerId: session.providerId,
    modelId: session.modelId,
    resultText,
    status: 'success',
    latencyMs: session.latencyMs || 0,
    tokenUsage: session.tokenUsage || undefined,
    createdAt: new Date().toISOString(),
  }

  await api.store.set('history', [
    ...existing.filter((item) => new Date(item.createdAt).getTime() >= cutoff),
    record,
  ].slice(-500))
}

export const usePopupSessionStore = create<PopupSessionState>((set, get) => {
  let cancelFn: (() => Promise<{ ok: boolean; error?: string }>) | null = null

  return {
    session: emptySession,
    prompt: '',

    clearForToolbar: (sessionId, selectedText) => {
      set({
        session: {
          ...emptySession,
          id: sessionId,
          selectedText,
          status: 'toolbar',
        },
        prompt: '',
      })
    },

    hide: () => {
      set({ session: emptySession, prompt: '' })
    },

    cancel: async () => {
      if (cancelFn) {
        await cancelFn()
        cancelFn = null
      }
      const current = get().session
      if (current.status === 'preparing' || current.status === 'streaming') {
        set({
          session: {
            ...current,
            status: current.streamText ? 'done' : 'toolbar',
            error: null,
          },
        })
      }
    },

    start: async (params) => {
      if (cancelFn) {
        await cancelFn()
        cancelFn = null
      }

      const startedAt = performance.now()
      const baseSession: PopupSession = {
        id: params.sessionId,
        selectedText: params.selectedText,
        action: params.action,
        providerId: params.providerId,
        modelId: params.modelId,
        status: 'preparing',
        messages: [makeUserMessage(params.selectedText)],
        streamText: '',
        error: null,
        startedAt,
        latencyMs: null,
        tokenUsage: null,
      }
      set({ session: baseSession, prompt: params.prompt })

      const { promise, cancel } = streamChat(
        {
          providerId: params.providerId,
          modelId: params.modelId,
          messages: [
            { role: 'system', content: params.prompt },
            { role: 'user', content: params.selectedText },
          ],
          temperature: params.action.parameters?.temperature,
          maxTokens: params.action.parameters?.maxTokens,
        },
        (chunk: StreamChunk) => {
          const current = get().session
          if (current.id !== params.sessionId) return
          set({
            session: {
              ...current,
              status: 'streaming',
              streamText: chunk.fullContent,
            },
          })
        },
      )

      cancelFn = cancel
      const result = await promise
      if (get().session.id !== params.sessionId) return
      cancelFn = null

      const current = get().session
      const content = current.streamText || result.content || ''
      const latencyMs = result.latencyMs ?? Math.round(performance.now() - startedAt)

      if (!result.ok) {
        set({
          session: {
            ...current,
            status: 'error',
            error: result.error || '请求失败',
            latencyMs,
            tokenUsage: result.tokenUsage || current.tokenUsage,
          },
        })
        return
      }

      const doneSession: PopupSession = {
        ...current,
        status: 'done',
        streamText: content,
        messages: [
          ...current.messages.filter((message) => message.role !== 'assistant'),
          makeAssistantMessage(content),
        ],
        latencyMs,
        tokenUsage: result.tokenUsage || current.tokenUsage,
      }
      set({ session: doneSession })
      void saveHistory(doneSession, content)
    },
  }
})
