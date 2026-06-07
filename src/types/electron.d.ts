export interface ElectronAPI {
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
    delete: (key: string) => Promise<boolean>
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
    revealKey: (providerId: string) => Promise<{ ok: boolean; apiKey?: string; error?: string }>
  }
  model: {
    update: (providerId: string, modelId: string, updates: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  }
  ai: {
    chat: (params: {
      providerId: string; modelId: string
      messages: Array<{ role: string; content: string }>
      temperature?: number; maxTokens?: number
    }) => Promise<{ ok: boolean; content?: string; error?: string; detail?: string }>
    cancel: () => Promise<{ ok: boolean; error?: string }>
    onStreamChunk: (callback: (data: { content: string; fullContent: string }) => void) => void
    offStreamChunk: () => void
  }
  getSelectedText: () => Promise<string>
  popup: {
    setPinned: (pinned: boolean) => Promise<{ ok: boolean }>
    setFocusLock: (lock: boolean) => Promise<{ ok: boolean }>
    close: () => Promise<{ ok: boolean }>
    resize: (width: number, height: number) => Promise<{ ok: boolean }>
    onRequestClose: (callback: () => void) => () => void
  }
  result: {
    open: (data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => Promise<{ ok: boolean }>
    setPinned: (pinned: boolean) => Promise<{ ok: boolean }>
    close: () => Promise<{ ok: boolean }>
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
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
