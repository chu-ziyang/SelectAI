import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // 存储
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  // 厂商管理
  provider: {
    list: () => ipcRenderer.invoke('provider:list'),
    add: (provider: Record<string, unknown>) => ipcRenderer.invoke('provider:add', provider),
    remove: (id: string) => ipcRenderer.invoke('provider:remove', id),
    update: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('provider:update', { id, updates }),
    testConfig: (provider: Record<string, unknown>) => ipcRenderer.invoke('provider:test-config', provider),
    test: (providerId: string) => ipcRenderer.invoke('provider:test', providerId),
    fetchModels: (providerId: string) => ipcRenderer.invoke('provider:fetch-models', providerId),
    listModels: (providerId: string) => ipcRenderer.invoke('provider:list-models', providerId),
  },
  // 模型管理
  model: {
    update: (providerId: string, modelId: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('model:update', { providerId, modelId, updates }),
  },
  // AI 请求
  ai: {
    chat: (params: { requestId?: string; providerId: string; modelId: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number }) =>
      ipcRenderer.invoke('ai:chat', params),
    cancel: (requestId?: string) => ipcRenderer.invoke('ai:cancel', requestId),
    /**
     * 订阅流式 chunk。返回取消订阅函数。
     * 如果传入 expectedRequestId，只接收该 requestId 的 chunk（推荐，避免并发串流）。
     * 不传则接收所有 chunk（兼容老调用方）。
     */
    onStreamChunk: (callback: (data: { requestId: string; content: string; fullContent: string }) => void, expectedRequestId?: string) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { requestId: string; content: string; fullContent: string }) => {
        if (expectedRequestId && data.requestId !== expectedRequestId) return
        callback(data)
      }
      ipcRenderer.on('ai:stream-chunk', listener)
      return () => ipcRenderer.removeListener('ai:stream-chunk', listener)
    },
    onStreamUsage: (callback: (data: { requestId: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void, expectedRequestId?: string) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { requestId: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
        if (expectedRequestId && data.requestId !== expectedRequestId) return
        callback(data)
      }
      ipcRenderer.on('ai:stream-usage', listener)
      return () => ipcRenderer.removeListener('ai:stream-usage', listener)
    },
  },
  // 选中文字
  getSelectedText: () => ipcRenderer.invoke('get-selected-text'),
  // 弹窗控制
  popup: {
    ready: () => ipcRenderer.invoke('popup:renderer-ready'),
    present: () => ipcRenderer.invoke('popup:present'),
    showSelection: (data: { text: string; anchor?: { x: number; y: number }; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) =>
      ipcRenderer.invoke('popup:show-selection', data),
    updateSelection: (data: { text: string; anchor?: { x: number; y: number }; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) =>
      ipcRenderer.invoke('popup:update-selection', data),
    hide: (data?: { sessionId?: string }) => ipcRenderer.invoke('popup:hide', data),
    setPinned: (pinned: boolean) => ipcRenderer.invoke('popup:set-pinned', pinned),
    setFocusLock: (lock: boolean) => ipcRenderer.invoke('popup:set-focus-lock', lock),
    close: () => ipcRenderer.invoke('popup:close'),
    resize: (width: number, height: number) => ipcRenderer.invoke('popup:resize', width, height),
    onSelectionPayload: (callback: (data: { id: string; text: string; anchor: { x: number; y: number }; reason: 'auto' | 'ctrl' | 'manual' | 'clipboard'; createdAt: number }) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { id: string; text: string; anchor: { x: number; y: number }; reason: 'auto' | 'ctrl' | 'manual' | 'clipboard'; createdAt: number }) => callback(data)
      ipcRenderer.on('popup:selection-payload', listener)
      return () => ipcRenderer.removeListener('popup:selection-payload', listener)
    },
    onStoreUpdated: (callback: (data: { key: string; value: unknown }) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { key: string; value: unknown }) => callback(data)
      ipcRenderer.on('popup:store-updated', listener)
      return () => ipcRenderer.removeListener('popup:store-updated', listener)
    },
    onRequestClose: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('popup:request-close', listener)
      return () => ipcRenderer.removeListener('popup:request-close', listener)
    },
    onHidden: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('popup:hidden', listener)
      return () => ipcRenderer.removeListener('popup:hidden', listener)
    },
  },
  result: {
    open: (data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) =>
      ipcRenderer.invoke('result:open', data),
    setPinned: (pinned: boolean) => ipcRenderer.invoke('result:set-pinned', pinned),
    close: () => ipcRenderer.invoke('result:close'),
    /**
     * 接收 result 窗口参数。返回一次性回调，触发后自动解绑。
     * （新窗口推 params 用 webContents.send，比 URL query 安全）
     */
    onParams: (callback: (data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => {
        ipcRenderer.removeListener('result:params', listener)
        callback(data)
      }
      ipcRenderer.on('result:params', listener)
      return () => ipcRenderer.removeListener('result:params', listener)
    },
  },
  // 事件监听
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['navigate', 'text-selected', 'popup-show', 'popup-hide', 'shortcut-popup-toggle']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_e, ...args) => callback(...args))
    }
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    quit: () => ipcRenderer.send('window:quit'),
  },
  // 系统 shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  // 应用信息
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
    checkUpdate: (): Promise<{
      ok: boolean
      currentVersion?: string
      latestVersion?: string
      htmlUrl?: string
      publishedAt?: string
      hasUpdate?: boolean
      error?: string
    }> => ipcRenderer.invoke('app:check-update'),
  },
  // 平台
  platform: process.platform,
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
