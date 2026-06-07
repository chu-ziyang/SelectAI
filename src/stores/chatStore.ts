import { create } from 'zustand'
import { streamChat, type StreamChunk } from '@/services/api'

export interface ChatState {
  // 状态
  isStreaming: boolean
  result: string
  error: string | null
  providerId: string | null
  modelId: string | null

  // 操作
  sendMessage: (params: {
    providerId: string
    modelId: string
    systemPrompt: string
    userText: string
    temperature?: number
    maxTokens?: number
  }) => Promise<{ ok: boolean; content?: string; error?: string }>
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
      })

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
      )

      cancelFn = cancel

      const result = await promise
      set({ isStreaming: false })

      if (!result.ok) {
        set({ error: result.error || '请求失败' })
        return { ok: false, error: result.error }
      }

      return { ok: true, content: get().result || result.content || '' }
    },

    cancelRequest: async () => {
      if (cancelFn) {
        await cancelFn()
        cancelFn = null
      }
      set({ isStreaming: false })
    },

    clearResult: () => set({ result: '', error: null }),

    setError: (error) => set({ error, result: '', isStreaming: false }),
  }
})
