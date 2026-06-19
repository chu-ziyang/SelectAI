/**
 * AI API 调用服务层
 * 通过 Electron IPC 代理请求，渲染进程不直接访问 API Key
 *
 * 流式请求按 requestId 路由：
 * - 每次 streamChat 调用生成独立 requestId
 * - chunk/usage 事件只发给订阅了同一 requestId 的回调，避免多窗口并发串流
 * - 订阅/取消订阅用 try/finally 包住，确保 promise 异常也能解绑
 */

export interface ChatParams {
  providerId: string
  modelId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface StreamChunk {
  requestId: string
  content: string
  fullContent: string
}

export interface StreamUsage {
  requestId: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ApiResult {
  ok: boolean
  requestId?: string
  content?: string
  error?: string
  detail?: string
  latencyMs?: number
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 流式 AI 聊天请求（通过 Electron IPC）
 * @returns promise（完成后所有监听器自动解绑）+ cancel（按 requestId 取消）+ onUsage 回调
 */
export function streamChat(
  params: ChatParams,
  onChunk: (chunk: StreamChunk) => void,
  onUsage?: (usage: StreamUsage) => void,
): { promise: Promise<ApiResult>; cancel: () => Promise<{ ok: boolean; error?: string }> } {
  const api = window.electronAPI
  if (!api) throw new Error('Electron API 不可用')

  const requestId = generateRequestId()
  // 订阅 chunk（按 requestId 过滤）和 usage（如有）；返回的解绑函数放进 finally
  const offChunk = api.ai.onStreamChunk((data) => onChunk(data), requestId)
  const offUsage = onUsage ? api.ai.onStreamUsage(onUsage, requestId) : null

  const promise = api.ai
    .chat({ ...params, requestId })
    .catch((err: Error) => ({ ok: false as const, requestId, error: err.message || '请求失败' }))
    .finally(() => {
      // 任何路径下都解绑监听器，避免 listener 堆积触发陈旧回调
      offChunk()
      offUsage?.()
    })

  return {
    promise,
    cancel: () => api.ai.cancel(requestId),
  }
}

/**
 * 非流式请求（可扩展）
 */
export async function chat(params: ChatParams): Promise<ApiResult> {
  let fullContent = ''
  const { promise } = streamChat(params, (chunk) => {
    fullContent = chunk.fullContent
  })
  const result = await promise
  if (result.ok && result.content === undefined) {
    return { ...result, content: fullContent }
  }
  return result
}

// ==================== 错误信息映射 ====================

export function getErrorMessage(status: number, _body?: string): string {
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
