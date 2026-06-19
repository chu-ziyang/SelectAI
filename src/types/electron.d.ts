export interface ElectronAPI {
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<{ ok: boolean; error?: string }>
    delete: (key: string) => Promise<{ ok: boolean; error?: string }>
  }
  provider: {
    list: () => Promise<unknown[]>
    add: (provider: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; provider?: { id: string } }>
    remove: (id: string) => Promise<{ ok: boolean }>
    update: (id: string, updates: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
    testConfig: (provider: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
    test: (providerId: string) => Promise<{ ok: boolean; models?: unknown[]; error?: string }>
    fetchModels: (providerId: string) => Promise<{ ok: boolean; models?: unknown[]; error?: string }>
    listModels: (providerId: string) => Promise<{ ok: boolean; models?: unknown[]; error?: string }>
  }
  model: {
    update: (providerId: string, modelId: string, updates: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  }
  ai: {
    chat: (params: {
      requestId?: string; providerId: string; modelId: string
      messages: Array<{ role: string; content: string }>
      temperature?: number; maxTokens?: number
    }) => Promise<{ ok: boolean; requestId?: string; content?: string; error?: string; detail?: string }>
    cancel: (requestId?: string) => Promise<{ ok: boolean; error?: string }>
    /**
     * 订阅流式 chunk，返回取消订阅函数。
     * 传 expectedRequestId 则只接收该 requestId 的事件（推荐，避免并发串流）。
     */
    onStreamChunk: (callback: (data: { requestId: string; content: string; fullContent: string }) => void, expectedRequestId?: string) => () => void
    onStreamUsage: (callback: (data: { requestId: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void, expectedRequestId?: string) => () => void
  }
  getSelectedText: () => Promise<string>
  popup: {
    ready: () => Promise<{ ok: boolean }>
    present: () => Promise<{ ok: boolean }>
    showSelection: (data: { text: string; anchor?: { x: number; y: number }; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) => Promise<{ ok: boolean }>
    updateSelection: (data: { text: string; anchor?: { x: number; y: number }; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) => Promise<{ ok: boolean }>
    hide: (data?: { sessionId?: string }) => Promise<{ ok: boolean }>
    setPinned: (pinned: boolean) => Promise<{ ok: boolean }>
    setFocusLock: (lock: boolean) => Promise<{ ok: boolean }>
    close: () => Promise<{ ok: boolean }>
    resize: (width: number, height: number) => Promise<{ ok: boolean }>
    onSelectionPayload: (callback: (data: { id: string; text: string; anchor: { x: number; y: number }; reason: 'auto' | 'ctrl' | 'manual' | 'clipboard'; createdAt: number }) => void) => () => void
    onStoreUpdated: (callback: (data: { key: string; value: unknown }) => void) => () => void
    onRequestClose: (callback: () => void) => () => void
    onHidden: (callback: () => void) => () => void
  }
  result: {
    open: (data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => Promise<{ ok: boolean }>
    setPinned: (pinned: boolean) => Promise<{ ok: boolean }>
    close: () => Promise<{ ok: boolean }>
    onParams: (callback: (data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => void) => () => void
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  removeAllListeners: (channel: string) => void
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    quit: () => void
  }
  shell: {
    openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
  }
  app: {
    getVersion: () => Promise<string>
    checkUpdate: () => Promise<{
      ok: boolean
      currentVersion?: string
      latestVersion?: string
      htmlUrl?: string
      publishedAt?: string
      hasUpdate?: boolean
      error?: string
    }>
  }
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
