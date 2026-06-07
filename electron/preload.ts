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
    revealKey: (providerId: string) => ipcRenderer.invoke('provider:reveal-key', providerId),
  },
  // 模型管理
  model: {
    update: (providerId: string, modelId: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('model:update', { providerId, modelId, updates }),
  },
  // AI 请求
  ai: {
    chat: (params: { providerId: string; modelId: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number }) =>
      ipcRenderer.invoke('ai:chat', params),
    cancel: () => ipcRenderer.invoke('ai:cancel'),
    onStreamChunk: (callback: (data: { content: string; fullContent: string }) => void) => {
      ipcRenderer.on('ai:stream-chunk', (_e, data) => callback(data))
    },
    offStreamChunk: () => ipcRenderer.removeAllListeners('ai:stream-chunk'),
    onStreamUsage: (callback: (data: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void) => {
      ipcRenderer.on('ai:stream-usage', (_e, data) => callback(data))
    },
    offStreamUsage: () => ipcRenderer.removeAllListeners('ai:stream-usage'),
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
    hide: () => ipcRenderer.invoke('popup:hide'),
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
  // 平台
  platform: process.platform,
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
