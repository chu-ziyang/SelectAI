import {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, clipboard, screen, shell,
} from 'electron'
import path from 'path'
import {
  createStore, encryptApiKey, decryptApiKey, maskApiKey,
} from './store'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { startTextWatch, stopTextWatch } from './text-selection'
import {
  ensurePopupWindow, showPopupSelection, updatePopupSelection, hidePopupWindow,
  closePopupWindow, setPopupPinned, setPopupFocusLock, resizePopupWindow, markPopupRendererReady,
  presentPopupWindow, createResultWindow, closeResultWindow, setResultPinned,
} from './windows'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null

const isDev = !app.isPackaged

function sanitizeProvider(provider: any) {
  const { apiKeyEncrypted, ...safeProvider } = provider
  return safeProvider
}

function applyAppSettings(settings: any) {
  if (!settings || typeof settings !== 'object') return
  if (typeof settings.autoStart === 'boolean') {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      openAsHidden: Boolean(settings.startMinimized),
    })
  }
}

async function requestProviderModels(provider: any, apiKey: string) {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `请求失败 (${res.status}): ${body.slice(0, 200)}` }
  }

  const data = await res.json() as any
  // 兼容多种 API 返回格式
  let rawList = data.data ?? data.models ?? data.body ?? data
  if (!Array.isArray(rawList)) rawList = []
  const models = rawList.map((m: any) => ({
    id: m.id || m.model || m.name || '',
    displayName: m.id || m.model || m.name || '',
    providerId: provider.id || '',
    enabled: true,
    isDefault: false,
    isReasoning: /reason|think|r1/i.test((m.id || m.model || '')),
    supportsStreaming: true,
  })).filter((m: any) => m.id)

  return { ok: true, models, _rawKeys: Object.keys(data) }
}

// ==================== 窗口创建 ====================

// 主窗口的最小尺寸：用户可以放大，但不可缩小到该尺寸以下
const MAIN_WINDOW_MIN_WIDTH = 750
const MAIN_WINDOW_MIN_HEIGHT = 500
// 启动时的默认尺寸（用户首次启动使用）
const MAIN_WINDOW_DEFAULT_WIDTH = 1100
const MAIN_WINDOW_DEFAULT_HEIGHT = 500

function createMainWindow() {
  // 恢复上次窗口大小
  const savedBounds = createStore().get('windowBounds', { width: MAIN_WINDOW_DEFAULT_WIDTH, height: MAIN_WINDOW_DEFAULT_HEIGHT }) as { width: number; height: number; x?: number; y?: number }
  // 主屏尺寸用于兜底夹取，避免出现窗口超出屏幕的情况
  const workArea = screen.getPrimaryDisplay().workArea
  const safeMaxWidth = Math.max(MAIN_WINDOW_MIN_WIDTH, workArea.width)
  const safeMaxHeight = Math.max(MAIN_WINDOW_MIN_HEIGHT, workArea.height)
  // 启动尺寸：在 [最小, 屏幕] 区间内取一个有效值
  const restoreWidth = Math.min(
    Math.max(savedBounds.width || MAIN_WINDOW_DEFAULT_WIDTH, MAIN_WINDOW_MIN_WIDTH),
    safeMaxWidth,
  )
  const restoreHeight = Math.min(
    Math.max(savedBounds.height || MAIN_WINDOW_DEFAULT_HEIGHT, MAIN_WINDOW_MIN_HEIGHT),
    safeMaxHeight,
  )

  mainWindow = new BrowserWindow({
    width: restoreWidth,
    height: restoreHeight,
    ...(savedBounds.x !== undefined && savedBounds.y !== undefined ? { x: savedBounds.x, y: savedBounds.y } : {}),
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    // 关闭原生阴影：原生阴影是矩形，会盖在 CSS 圆角外面形成"方框"。
    // 阴影由 .app-window-shell 的 box-shadow 自己渲染，能跟着 border-radius 走。
    hasShadow: false,
    resizable: true,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../public/icon.png'),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 记住窗口尺寸（300ms 防抖）
  mainWindow.on('resize', () => {
    if (mainWindow?.isMaximized() || mainWindow?.isFullScreen()) return
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        createStore().set('windowBounds', { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y })
      }
    }, 300)
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      const settings = createStore().get('settings', {}) as { closeToTray?: boolean }
      if (settings.closeToTray !== false) {
        e.preventDefault()
        mainWindow?.hide()
      } else {
        isQuitting = true
      }
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon-16.png')
  const appIcon = nativeImage.createFromPath(iconPath)
  tray = new Tray(appIcon.resize({ width: 16, height: 16 }))

  const store = createStore()
  const isPaused = store.get('_paused', false) as boolean

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '暂停划词',
      type: 'checkbox',
      checked: isPaused,
      click: (menuItem) => {
        const store = createStore()
        store.set('_paused', menuItem.checked)
        if (menuItem.checked) { stopTextWatch() }
        else { startTextWatch() }
      },
    },
    { type: 'separator' },
    { label: '关于划词助手', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', '/settings/about') } },
    { type: 'separator' },
    {
      label: '退出',
      click: () => { isQuitting = true; app.quit() },
    },
  ])

  tray.setToolTip('划词助手 - 运行中')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ==================== IPC 处理 ====================

function setupIPC() {
  const store = createStore()

  // ---- 存储 ----
  ipcMain.handle('store:get', (_e, key: string) => store.get(key))
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
    store.set(key, value)
    if (key === 'settings') {
      applyAppSettings(value)
      if (!(store.get('_paused', false) as boolean)) {
        startTextWatch()
      }
    }
    if (key === 'settings' || key === 'popupSettings' || key === 'providers' || key === 'actions') {
      ensurePopupWindow().webContents.send('popup:store-updated', { key, value })
    }
    if (key === 'shortcut' || key === 'showWindowShortcut') registerShortcuts()
    if (key === '_paused') {
      if (value) stopTextWatch()
      else startTextWatch()
    }
    return true
  })
  ipcMain.handle('store:delete', (_e, key: string) => {
    store.delete(key)
    return true
  })

  // ---- 厂商管理 ----
  ipcMain.handle('provider:list', () => (store.get('providers', []) as any[]).map(sanitizeProvider))

  ipcMain.handle('provider:add', (_e, provider) => {
    const providers = (store.get('providers', []) as any[])
    const name = String(provider.name || '').trim()
    const baseUrl = String(provider.baseUrl || '').trim()
    const apiKey = String(provider.apiKey || '').trim()

    if (!name || !baseUrl || !apiKey) {
      return { ok: false, error: '请填写完整的厂商信息' }
    }
    if (providers.some((p: any) => String(p.baseUrl).replace(/\/+$/, '') === baseUrl.replace(/\/+$/, ''))) {
      return { ok: false, error: '这个 API 地址已经添加过了' }
    }

    const entry = {
      ...provider,
      name,
      baseUrl,
      apiKey: undefined,
      id: `p_${Date.now()}`,
      apiKeyEncrypted: encryptApiKey(apiKey),
      apiKeyMasked: maskApiKey(apiKey),
      models: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    providers.push(entry)
    store.set('providers', providers)
    return { ok: true, provider: sanitizeProvider(entry) }
  })

  ipcMain.handle('provider:remove', (_e, id: string) => {
    const providers = (store.get('providers', []) as any[]).filter((p: any) => p.id !== id)
    store.set('providers', providers)
    return { ok: true }
  })

  ipcMain.handle('provider:update', (_e, data: { id: string; updates: Record<string, unknown> }) => {
    const providers = (store.get('providers', []) as any[])
    const idx = providers.findIndex((p: any) => p.id === data.id)
    if (idx === -1) return { ok: false, error: '厂商不存在' }

    if (typeof data.updates.name === 'string' && !data.updates.name.trim()) {
      return { ok: false, error: '显示名称不能为空' }
    }
    if (typeof data.updates.baseUrl === 'string') {
      const baseUrl = data.updates.baseUrl.trim()
      if (!baseUrl) return { ok: false, error: 'API 地址不能为空' }
      const duplicate = providers.some((p: any) => p.id !== data.id && String(p.baseUrl).replace(/\/+$/, '') === baseUrl.replace(/\/+$/, ''))
      if (duplicate) return { ok: false, error: '这个 API 地址已经添加过了' }
      data.updates.baseUrl = baseUrl
    }
    if (typeof data.updates.name === 'string') data.updates.name = data.updates.name.trim()
    if (data.updates.apiKey) {
      data.updates.apiKeyEncrypted = encryptApiKey(data.updates.apiKey as string)
      data.updates.apiKeyMasked = maskApiKey(data.updates.apiKey as string)
      delete data.updates.apiKey
    }
    providers[idx] = { ...providers[idx], ...data.updates, updatedAt: new Date().toISOString() }
    store.set('providers', providers)
    return { ok: true, provider: sanitizeProvider(providers[idx]) }
  })

  ipcMain.handle('provider:reveal-key', (_e, providerId: string) => {
    const providers = store.get('providers', []) as any[]
    const provider = providers.find((p: any) => p.id === providerId)
    if (!provider) return { ok: false, error: '厂商不存在' }
    const apiKey = decryptApiKey(provider.apiKeyEncrypted)
    if (!apiKey) return { ok: false, error: '无法解密 API Key' }
    return { ok: true, apiKey }
  })

  // ---- 模型管理 ----
  ipcMain.handle('provider:list-models', (_e, providerId: string) => {
    const providers = store.get('providers', []) as any[]
    const provider = providers.find((p: any) => p.id === providerId)
    if (!provider) return { ok: false, error: '厂商不存在' }
    return { ok: true, models: provider.models || [] }
  })

  ipcMain.handle('model:update', (_e, data: { providerId: string; modelId: string; updates: Record<string, unknown> }) => {
    const providers = (store.get('providers', []) as any[])
    const pIdx = providers.findIndex((p: any) => p.id === data.providerId)
    if (pIdx === -1) return { ok: false, error: '厂商不存在' }
    const mIdx = (providers[pIdx].models || []).findIndex((m: any) => m.id === data.modelId)
    if (mIdx === -1) return { ok: false, error: '模型不存在' }
    if (data.updates.enabled === false && providers[pIdx].models[mIdx].isDefault) {
      return { ok: false, error: '默认模型不能直接禁用，请先选择其他默认模型' }
    }
    // 设默认时取消所有厂商的默认，保证全局只有一个默认模型。
    if (data.updates.isDefault) {
      providers.forEach((p: any) => {
        (p.models || []).forEach((m: any) => { m.isDefault = false })
      })
      data.updates.enabled = true
    }
    providers[pIdx].models[mIdx] = { ...providers[pIdx].models[mIdx], ...data.updates }
    providers[pIdx].updatedAt = new Date().toISOString()
    store.set('providers', providers)
    return { ok: true }
  })

  // ---- 测试连接 & 拉取模型 ----
  ipcMain.handle('provider:test-config', async (_e, provider: { baseUrl: string; apiKey: string }) => {
    try {
      const result = await requestProviderModels({ ...provider, id: 'preview' }, provider.apiKey)
      return result.ok ? { ok: true, models: result.models } : result
    } catch (err: any) {
      return { ok: false, error: err.message || '连接失败' }
    }
  })

  ipcMain.handle('provider:test', async (_e, providerId: string) => {
    const providers = store.get('providers', []) as any[]
    const p = providers.find((p2: any) => p2.id === providerId)
    if (!p) return { ok: false, error: '厂商不存在', latencyMs: 0 }
    const key = decryptApiKey(p.apiKeyEncrypted)
    if (!key) return { ok: false, error: '无法解密 API Key', latencyMs: 0 }
    const t0 = Date.now()
    try {
      const result = await requestProviderModels(p, key)
      const latencyMs = Date.now() - t0
      return result.ok ? { ok: true, latencyMs } : { ...result, latencyMs }
    } catch (err: any) {
      return { ok: false, error: err.message || '连接失败', latencyMs: Date.now() - t0 }
    }
  })

  ipcMain.handle('provider:fetch-models', async (_e, providerId: string) => {
    const providers = store.get('providers', []) as any[]
    const p = providers.find((p2: any) => p2.id === providerId)
    if (!p) return { ok: false, error: '厂商不存在' }
    const key = decryptApiKey(p.apiKeyEncrypted)
    if (!key) return { ok: false, error: '无法解密 API Key' }
    try {
      const result = await requestProviderModels(p, key)
      if (!result.ok) return result

      const providers = store.get('providers', []) as any[]
      const pIdx = providers.findIndex((p2: any) => p2.id === providerId)
      if (pIdx !== -1) {
        const previousModels = providers[pIdx].models || []
        const previousById = new Map<string, any>(previousModels.map((m: any) => [m.id, m]))
        const mergedModels = result.models.map((model: any) => {
          const previous = previousById.get(model.id)
          return previous ? { ...model, ...previous, displayName: model.displayName || previous.displayName } : model
        })
        // 确保每个厂商最多一个默认：旧默认仍在新列表且仍 enabled → 保留；否则清空全部，把第一个 enabled 设为默认。
        // 同时把不再 enabled 的旧默认清掉，避免数据里残留两个 isDefault。
        const previousDefault = previousModels.find((m: any) => m.isDefault)
        const previousDefaultStillEnabled = previousDefault && mergedModels.some(
          (m: any) => m.id === previousDefault.id && m.enabled,
        )
        if (previousDefaultStillEnabled) {
          mergedModels.forEach((m: any) => { m.isDefault = m.id === previousDefault!.id })
        } else {
          mergedModels.forEach((m: any) => { m.isDefault = false })
          const firstEnabled = mergedModels.find((m: any) => m.enabled)
          if (firstEnabled) firstEnabled.isDefault = true
        }
        providers[pIdx].models = mergedModels
        providers[pIdx].updatedAt = new Date().toISOString()
        store.set('providers', providers)
      }
      return result
    } catch (err: any) {
      return { ok: false, error: err.message || '获取模型失败' }
    }
  })

  // ---- AI 请求 ----
  let activeAbortController: AbortController | null = null

  ipcMain.handle('ai:chat', async (event, params: {
    providerId: string; modelId: string; messages: Array<{ role: string; content: string }>;
    temperature?: number; maxTokens?: number;
  }) => {
    const providers = store.get('providers', []) as any[]
    const p = providers.find((p2: any) => p2.id === params.providerId)
    if (!p) return { ok: false, error: '厂商不存在' }

    const model = (p.models || []).find((m: any) => m.id === params.modelId)
    if (!model || !model.enabled) return { ok: false, error: '模型不可用' }

    const key = decryptApiKey(p.apiKeyEncrypted)
    if (!key) return { ok: false, error: '无法解密 API Key' }

    activeAbortController = new AbortController()
    const { signal } = activeAbortController
    const startedAt = Date.now()

    try {
      const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: params.modelId,
          messages: params.messages,
          temperature: params.temperature ?? 0.3,
          max_tokens: params.maxTokens ?? 2048,
          stream: true,
          // 让 OpenAI 兼容接口在最后一个 chunk 里返回 usage（prompt/completion/total tokens）
          stream_options: { include_usage: true },
        }),
        signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        let errorMsg = `请求失败 (${res.status})`
        if (res.status === 401) errorMsg = 'API Key 无效'
        else if (res.status === 429) errorMsg = '请求过于频繁，请稍后再试'
        else if (res.status === 402) errorMsg = '账号额度不足'
        return { ok: false, error: errorMsg, detail: body.slice(0, 200) }
      }

      const reader = res.body?.getReader()
      if (!reader) return { ok: false, error: '无法读取响应流' }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              event.sender.send('ai:stream-chunk', { content, fullContent })
            }
            // OpenAI 在最后一个 chunk（choices 为空）携带 usage
            if (parsed.usage) {
              tokenUsage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
              // 单独推送一条 usage 事件，前端可以监听
              event.sender.send('ai:stream-usage', tokenUsage)
            }
          } catch { /* 跳过解析失败的行 */ }
        }
      }
      return {
        ok: true,
        content: fullContent,
        latencyMs: Date.now() - startedAt,
        tokenUsage,
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return { ok: false, error: '已取消' }
      return { ok: false, error: err.message || '网络错误' }
    } finally {
      activeAbortController = null
    }
  })

  ipcMain.handle('ai:cancel', () => {
    if (activeAbortController) {
      activeAbortController.abort()
      return { ok: true }
    }
    return { ok: false, error: '没有正在进行的请求' }
  })

  // ---- 窗口控制 ----
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.on('window:quit', () => {
    isQuitting = true
    app.quit()
  })

  ipcMain.handle('popup:set-pinned', (_e, pinned: boolean) => {
    setPopupPinned(pinned)
    return { ok: true }
  })
  ipcMain.handle('popup:renderer-ready', () => {
    markPopupRendererReady()
    return { ok: true }
  })
  ipcMain.handle('popup:present', () => {
    presentPopupWindow()
    return { ok: true }
  })
  ipcMain.handle('popup:set-focus-lock', (_e, lock: boolean) => {
    setPopupFocusLock(lock)
    return { ok: true }
  })
  ipcMain.handle('popup:close', () => {
    closePopupWindow()
    return { ok: true }
  })
  ipcMain.handle('popup:hide', () => {
    hidePopupWindow()
    return { ok: true }
  })
  ipcMain.handle('popup:show-selection', (_e, data: { text: string; anchor?: Electron.Point; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) => {
    showPopupSelection(data.text, data.anchor || screen.getCursorScreenPoint(), data.reason || 'manual')
    return { ok: true }
  })
  ipcMain.handle('popup:update-selection', (_e, data: { text: string; anchor?: Electron.Point; reason?: 'auto' | 'ctrl' | 'manual' | 'clipboard' }) => {
    updatePopupSelection(data.text, data.anchor || screen.getCursorScreenPoint(), data.reason || 'manual')
    return { ok: true }
  })

  ipcMain.handle('shell:open-external', (_e, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: '只允许 http(s) 链接' }
    }
    return shell.openExternal(url).then(() => ({ ok: true })).catch((err: Error) => ({ ok: false, error: err.message }))
  })

  ipcMain.handle('popup:resize', (_e, width: number, height: number) => {
    resizePopupWindow(width, height)
    return { ok: true }
  })

  ipcMain.handle('result:open', (_e, data: { actionId: string; name: string; icon: string; text: string; providerId: string; modelId: string; prompt: string }) => {
    createResultWindow(data.actionId, data.name, data.icon, data.text, data.providerId, data.modelId, data.prompt)
    return { ok: true }
  })
  ipcMain.handle('result:set-pinned', (_e, pinned: boolean) => {
    setResultPinned(pinned)
    return { ok: true }
  })
  ipcMain.handle('result:close', () => {
    closeResultWindow()
    return { ok: true }
  })

  // ---- 获取选中文字（剪贴板） ----
  ipcMain.handle('get-selected-text', () => clipboard.readText())
}

// ==================== 生命周期 ====================

app.whenReady().then(() => {
  setupIPC()
  createMainWindow()
  ensurePopupWindow()
  createTray()
  registerShortcuts()

  const store = createStore()
  if (!(store.get('_paused', false) as boolean)) {
    startTextWatch()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (app.isReady()) {
    unregisterShortcuts()
    stopTextWatch()
  }
})

// 单实例
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
