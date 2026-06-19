import { create } from 'zustand'
import { streamChat, type StreamChunk, type StreamUsage } from '@/services/api'

export interface ChatState {
  // 状态
  isStreaming: boolean
  result: string
  error: string | null
  providerId: string | null
  modelId: string | null
  /** OpenAI usage 字段：prompt/completion/total tokens */
  tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null
  /** 整个请求耗时（毫秒） */
  latencyMs: number | null

  // 操作
  sendMessage: (params: {
    providerId: string
    modelId: string
    systemPrompt: string
    userText: string
    temperature?: number
    maxTokens?: number
  }) => Promise<{ ok: boolean; content?: string; error?: string; tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null; latencyMs?: number }>
  cancelRequest: () => void
  clearResult: () => void
  setError: (error: string) => void
}

export const useChatStore = create<ChatState>((set, get) => {
  let cancelFn: (() => Promise<{ ok: boolean; error?: string }>) | null = null

  return {
    isStreaming: false,
    result: '',
    error: null,
    providerId: null,
    modelId: null,
    tokenUsage: null,
    latencyMs: null,

    sendMessage: async (params) => {
      // 取消上一个请求
      if (cancelFn) {
        await cancelFn()
        cancelFn = null
      }

      set({
        isStreaming: true,
        result: '',
        error: null,
        providerId: params.providerId,
        modelId: params.modelId,
        tokenUsage: null,
        latencyMs: null,
      })

      // usage 通过 streamChat 的第三个参数传入（按 requestId 自动过滤/解绑）
      const { promise, cancel } = streamChat(
        {
          providerId: params.providerId,
          modelId: params.modelId,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userText },
          ],
          temperature: params.temperature,
          maxTokens: params.maxTokens,
        },
        (chunk: StreamChunk) => {
          set({ result: chunk.fullContent })
        },
        (usage: StreamUsage) => {
          set({ tokenUsage: usage })
        },
      )

      cancelFn = cancel

      const result = await promise
      set({
        isStreaming: false,
        latencyMs: result.latencyMs ?? null,
        tokenUsage: get().tokenUsage || result.tokenUsage || null,
      })

      if (!result.ok) {
        set({ error: result.error || '请求失败' })
        return { ok: false, error: result.error }
      }

      return {
        ok: true,
        content: get().result || result.content || '',
        tokenUsage: get().tokenUsage,
        latencyMs: result.latencyMs,
      }
    },

    cancelRequest: async () => {
      if (cancelFn) {
        await cancelFn()
        cancelFn = null
      }
      set({ isStreaming: false })
    },

    clearResult: () => set({ result: '', error: null, tokenUsage: null, latencyMs: null }),

    setError: (error) => set({ error, result: '', isStreaming: false }),
  }
})
