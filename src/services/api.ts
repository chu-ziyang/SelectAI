/**
 * AI API 调用服务层
 * 通过 Electron IPC 代理请求，渲染进程不直接访问 API Key
 */

export interface ChatParams {
  providerId: string
  modelId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface StreamChunk {
  content: string
  fullContent: string
}

export interface ApiResult {
  ok: boolean
  content?: string
  error?: string
  detail?: string
  latencyMs?: number
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null
}

/**
 * 流式 AI 聊天请求（通过 Electron IPC）
 * @returns 取消函数 + onChunk 回调
 */
export function streamChat(
  params: ChatParams,
  onChunk: (chunk: StreamChunk) => void,
): { promise: Promise<ApiResult>; cancel: () => Promise<{ ok: boolean; error?: string }> } {
  const api = window.electronAPI
  if (!api) throw new Error('Electron API 不可用')

  api.ai.onStreamChunk(onChunk)

  const promise = api.ai.chat(params).then((result: any) => {
    api.ai.offStreamChunk()
    return result
  }).catch((err: any) => {
    api.ai.offStreamChunk()
    return { ok: false, error: err.message || '请求失败' }
  })

  return {
    promise,
    cancel: () => api.ai.cancel(),
  }
}

/**
 * 非流式请求（可扩展）
 */
export async function chat(params: ChatParams): Promise<ApiResult> {
  // 目前统一使用流式请求
  let fullContent = ''
  const { promise } = streamChat(params, (chunk) => {
    fullContent = chunk.fullContent
  })
  return promise
}

// ==================== 错误信息映射 ====================

export function getErrorMessage(status: number, body?: string): string {
  const map: Record<number, string> = {
    401: 'API Key 似乎无效，请检查后重试',
    402: '当前账号额度不足，请检查服务商后台',
    403: '访问被拒绝，请检查 API Key 权限',
    429: '当前模型请求过于频繁，请稍后再试',
    500: 'AI 服务暂时不可用，请稍后重试',
    502: 'AI 服务网关错误，请稍后重试',
    503: 'AI 服务正在维护中，请稍后重试',
  }
  return map[status] || `请求失败 (${status})`
}

export function getNetworkError(err: Error): string {
  if (err.message.includes('timeout') || err.message.includes('TIMEOUT')) {
    return '网络连接超时，请稍后重试'
  }
  if (err.message.includes('fetch') || err.message.includes('Network')) {
    return '网络连接失败，请检查网络后重试'
  }
  return err.message || '未知错误'
}
