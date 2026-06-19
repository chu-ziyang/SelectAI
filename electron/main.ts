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
import { validateProviderUrl, validateExternalUrl } from './lib/urlValidation'
import { compareSemver } from './lib/semver'

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
  // 防御性二次校验：即使存储被旁路污染，fetch 前也卡一道
  const urlCheck = validateProviderUrl(String(provider.baseUrl || ''))
  if (!urlCheck.ok) return { ok: false, error: urlCheck.error }
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
  // store:set 白名单：renderer 是半可信的，限制只能写已知 key
  // （防止污染 electron-store schema 之外的 key 引发未定义行为）。
  const WRITABLE_STORE_KEYS = new Set([
    'settings', 'popupSettings', 'providers', 'actions',
    'history', 'shortcut', 'showWindowShortcut', '_paused',
  ])

  ipcMain.handle('store:get', (_e, key: string) => {
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) return undefined
    return store.get(key)
  })
  ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
    if (!WRITABLE_STORE_KEYS.has(key)) {
      return { ok: false, error: `不允许写入存储键 ${key}` }
    }
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
    return { ok: true }
  })
  ipcMain.handle('store:delete', (_e, key: string) => {
    if (!WRITABLE_STORE_KEYS.has(key)) {
      return { ok: false, error: `不允许删除存储键 ${key}` }
    }
    store.delete(key)
    return { ok: true }
  })

  // ---- 厂商管理 ----
  ipcMain.handle('provider:list', () => (store.get('providers', []) as any[]).map(sanitizeProvider))

  ipcMain.handle('provider:add', (_e, provider) => {
    const providers = (store.get('providers', []) as any[])
    // 入参基本守卫：必须是普通对象且字段都是 string
    if (!provider || typeof provider !== 'object') {
      return { ok: false, error: '入参无效' }
    }
    const name = String(provider.name || '').trim()
    const baseUrl = String(provider.baseUrl || '').trim()
    const apiKey = String(provider.apiKey || '').trim()
    const type = typeof provider.type === 'string' ? provider.type : 'custom'

    if (!name || !baseUrl || !apiKey) {
      return { ok: false, error: '请填写完整的厂商信息' }
    }
    const urlCheck = validateProviderUrl(baseUrl)
    if (!urlCheck.ok) return { ok: false, error: urlCheck.error }
    if (providers.some((p: any) => String(p.baseUrl).replace(/\/+$/, '') === baseUrl.replace(/\/+$/, ''))) {
      return { ok: false, error: '这个 API 地址已经添加过了' }
    }

    // 白名单字段：只取已知字段写盘，丢弃原型链注入的额外字段
    const entry = {
      id: `p_${Date.now()}`,
      type,
      name,
      baseUrl,
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
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return { ok: false, error: '入参无效' }
    }
    const providers = (store.get('providers', []) as any[]).filter((p: any) => p.id !== id)
    store.set('providers', providers)
    return { ok: true }
  })

  ipcMain.handle('provider:update', (_e, data: { id: string; updates: Record<string, unknown> }) => {
    // 入参守卫
    if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !data.updates || typeof data.updates !== 'object') {
      return { ok: false, error: '入参无效' }
    }
    const providers = (store.get('providers', []) as any[])
    const idx = providers.findIndex((p: any) => p.id === data.id)
    if (idx === -1) return { ok: false, error: '厂商不存在' }

    // 白名单 updates：只取允许修改的字段，避免 __proto__ 等注入
    const allowed: Record<string, unknown> = {}
    if (typeof data.updates.name === 'string') {
      const name = data.updates.name.trim()
      if (!name) return { ok: false, error: '显示名称不能为空' }
      allowed.name = name
    }
    if (typeof data.updates.baseUrl === 'string') {
      const baseUrl = data.updates.baseUrl.trim()
      if (!baseUrl) return { ok: false, error: 'API 地址不能为空' }
      const urlCheck = validateProviderUrl(baseUrl)
      if (!urlCheck.ok) return { ok: false, error: urlCheck.error }
      const duplicate = providers.some((p: any) => p.id !== data.id && String(p.baseUrl).replace(/\/+$/, '') === baseUrl.replace(/\/+$/, ''))
      if (duplicate) return { ok: false, error: '这个 API 地址已经添加过了' }
      allowed.baseUrl = baseUrl
    }
    if (typeof data.updates.type === 'string') {
      allowed.type = data.updates.type
    }
    if (typeof data.updates.apiKey === 'string' && data.updates.apiKey.length > 0) {
      allowed.apiKeyEncrypted = encryptApiKey(data.updates.apiKey)
      allowed.apiKeyMasked = maskApiKey(data.updates.apiKey)
    }
    providers[idx] = { ...providers[idx], ...allowed, updatedAt: new Date().toISOString() }
    store.set('providers', providers)
    return { ok: true, provider: sanitizeProvider(providers[idx]) }
  })

  // ---- 模型管理 ----
  ipcMain.handle('provider:list-models', (_e, providerId: string) => {
    if (typeof providerId !== 'string' || providerId.length === 0) {
      return { ok: false, error: '入参无效' }
    }
    const providers = store.get('providers', []) as any[]
    const provider = providers.find((p: any) => p.id === providerId)
    if (!provider) return { ok: false, error: '厂商不存在' }
    return { ok: true, models: provider.models || [] }
  })

  ipcMain.handle('model:update', (_e, data: { providerId: string; modelId: string; updates: Record<string, unknown> }) => {
    // 入参守卫
    if (!data || typeof data !== 'object' || typeof data.providerId !== 'string' || typeof data.modelId !== 'string'
        || !data.updates || typeof data.updates !== 'object') {
      return { ok: false, error: '入参无效' }
    }
    const providers = (store.get('providers', []) as any[])
    const pIdx = providers.findIndex((p: any) => p.id === data.providerId)
    if (pIdx === -1) return { ok: false, error: '厂商不存在' }
    const mIdx = (providers[pIdx].models || []).findIndex((m: any) => m.id === data.modelId)
    if (mIdx === -1) return { ok: false, error: '模型不存在' }

    // 白名单字段：只允许更新这些属性
    const allowed: Record<string, unknown> = {}
    if (typeof data.updates.enabled === 'boolean') allowed.enabled = data.updates.enabled
    if (typeof data.updates.isDefault === 'boolean') allowed.isDefault = data.updates.isDefault
    if (typeof data.updates.isReasoning === 'boolean') allowed.isReasoning = data.updates.isReasoning
    if (typeof data.updates.displayName === 'string') allowed.displayName = data.updates.displayName

    if (allowed.enabled === false && providers[pIdx].models[mIdx].isDefault) {
      return { ok: false, error: '默认模型不能直接禁用，请先选择其他默认模型' }
    }
    // 设默认时取消所有厂商的默认，保证全局只有一个默认模型。
    if (allowed.isDefault) {
      providers.forEach((p: any) => {
        (p.models || []).forEach((m: any) => { m.isDefault = false })
      })
      allowed.enabled = true
    }
    providers[pIdx].models[mIdx] = { ...providers[pIdx].models[mIdx], ...allowed }
    providers[pIdx].updatedAt = new Date().toISOString()
    store.set('providers', providers)
    return { ok: true }
  })

  // ---- 测试连接 & 拉取模型 ----
  ipcMain.handle('provider:test-config', async (_e, provider: { baseUrl: string; apiKey: string }) => {
    if (!provider || typeof provider !== 'object' || typeof provider.baseUrl !== 'string' || typeof provider.apiKey !== 'string') {
      return { ok: false, error: '入参无效' }
    }
    const urlCheck = validateProviderUrl(provider.baseUrl)
    if (!urlCheck.ok) return { ok: false, error: urlCheck.error }
    try {
      const result = await requestProviderModels({ ...provider, id: 'preview' }, provider.apiKey)
      return result.ok ? { ok: true, models: result.models } : result
    } catch (err: any) {
      return { ok: false, error: err.message || '连接失败' }
    }
  })

  ipcMain.handle('provider:test', async (_e, providerId: string) => {
    if (typeof providerId !== 'string' || providerId.length === 0) {
      return { ok: false, error: '入参无效', latencyMs: 0 }
    }
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
    if (typeof providerId !== 'string' || providerId.length === 0) {
      return { ok: false, error: '入参无效' }
    }
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
        // 确保全局只有一个默认模型：
        // - 旧默认仍在新列表且仍 enabled → 保留（清掉本厂商其他模型的默认标记）
        // - 否则，若其他厂商已经存在默认 → 本次不自动设默认，避免和现有默认冲突
        // - 否则（系统当前没有任何默认）→ 把本厂商第一个 enabled 设为默认
        const previousDefault = previousModels.find((m: any) => m.isDefault)
        const previousDefaultStillEnabled = previousDefault && mergedModels.some(
          (m: any) => m.id === previousDefault.id && m.enabled,
        )
        if (previousDefaultStillEnabled) {
          mergedModels.forEach((m: any) => { m.isDefault = m.id === previousDefault!.id })
        } else {
          mergedModels.forEach((m: any) => { m.isDefault = false })
          const hasGlobalDefault = providers.some((other: any) =>
            other.id !== providerId && (other.models || []).some((m: any) => m.isDefault),
          )
          if (!hasGlobalDefault) {
            const firstEnabled = mergedModels.find((m: any) => m.enabled)
            if (firstEnabled) firstEnabled.isDefault = true
          }
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
  // 按 requestId 隔离的 AbortController Map。旧版用一个全局变量，弹窗和结果窗口
  // 并发请求时会被互相覆盖，前一个 controller 变孤儿，fetch 继续向已隐藏的
  // webContents 发送 chunk。每个 ai:chat 生成独立 requestId，按它路由 chunk，
  // 这样多窗口并发不会串流。
  const activeAbortControllers = new Map<string, AbortController>()
  // 单次流式请求总超时（5 分钟）：防止上游不返回 [DONE] 时 controller 永远占位。
  const STREAM_TIMEOUT_MS = 5 * 60 * 1000

  ipcMain.handle('ai:chat', async (event, params: {
    requestId?: string; providerId: string; modelId: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number; maxTokens?: number;
  }) => {
    const providers = store.get('providers', []) as any[]
    const p = providers.find((p2: any) => p2.id === params.providerId)
    if (!p) return { ok: false, error: '厂商不存在' }

    const model = (p.models || []).find((m: any) => m.id === params.modelId)
    if (!model || !model.enabled) return { ok: false, error: '模型不可用' }

    // 防御性校验：拒绝把 Bearer Key 发到非法/内网/云元数据地址
    const urlCheck = validateProviderUrl(String(p.baseUrl || ''))
    if (!urlCheck.ok) return { ok: false, error: urlCheck.error }

    const key = decryptApiKey(p.apiKeyEncrypted)
    if (!key) return { ok: false, error: '无法解密 API Key' }

    // 为本次请求分配独立 id；renderer 必须用它来订阅 chunk 路由。
    const requestId = params.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const controller = new AbortController()
    activeAbortControllers.set(requestId, controller)
    // 组合信号：用户取消 OR 总超时
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(STREAM_TIMEOUT_MS)])
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
              // 带 requestId：renderer 端的监听器按它过滤，避免并发流串扰
              event.sender.send('ai:stream-chunk', { requestId, content, fullContent })
            }
            // OpenAI 在最后一个 chunk（choices 为空）携带 usage
            if (parsed.usage) {
              tokenUsage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
              // 单独推送一条 usage 事件，前端可以监听
              event.sender.send('ai:stream-usage', { requestId, ...tokenUsage })
            }
          } catch { /* 跳过解析失败的行 */ }
        }
      }
      return {
        ok: true,
        requestId,
        content: fullContent,
        latencyMs: Date.now() - startedAt,
        tokenUsage,
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        const message = err.name === 'TimeoutError' ? '请求超时，请稍后重试' : '已取消'
        return { ok: false, error: message, requestId }
      }
      return { ok: false, error: err.message || '网络错误', requestId }
    } finally {
      activeAbortControllers.delete(requestId)
    }
  })

  ipcMain.handle('ai:cancel', (_e, requestId?: string) => {
    if (requestId) {
      const ctrl = activeAbortControllers.get(requestId)
      if (ctrl) {
        ctrl.abort()
        activeAbortControllers.delete(requestId)
        return { ok: true }
      }
      return { ok: false, error: '该请求不存在或已完成' }
    }
    // 兼容旧版调用：没传 requestId 就取消全部
    if (activeAbortControllers.size === 0) {
      return { ok: false, error: '没有正在进行的请求' }
    }
    for (const ctrl of activeAbortControllers.values()) ctrl.abort()
    activeAbortControllers.clear()
    return { ok: true }
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
  ipcMain.handle('popup:hide', (_e, data?: { sessionId?: string }) => {
    hidePopupWindow(data?.sessionId)
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
    // 严校验：必须能严格解析、且原串与重新序列化一致（防 NUL 截断/不可见字符绕过）；
    // 只允许 http/https；禁 userinfo（防 https://attacker:x@victim.com 钓鱼）
    const check = validateExternalUrl(url)
    if (!check.ok) return { ok: false, error: check.error }
    return shell.openExternal(url).then(() => ({ ok: true })).catch((err: Error) => ({ ok: false, error: err.message }))
  })

  // ---- 应用信息 ----
  // 返回 package.json 里的当前版本号（来自 electron.app.getVersion()，无需 IPC 参数）
  ipcMain.handle('app:get-version', () => app.getVersion())

  // 调 GitHub Releases API 检查最新版本，返回 { ok, currentVersion, latestVersion, htmlUrl, publishedAt }
  // 公开 endpoint，无需 token；带 User-Agent；不解析 prerelease
  ipcMain.handle('app:check-update', async () => {
    const currentVersion = app.getVersion()
    const url = 'https://api.github.com/repos/chu-ziyang/SelectAI/releases/latest'
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'SelectAI-AboutPage',
        },
      })
      if (!res.ok) {
        return { ok: false, error: `GitHub API 返回 HTTP ${res.status}` }
      }
      const data: any = await res.json()
      const latestVersion = String(data.tag_name || '').replace(/^v/, '')
      const htmlUrl = String(data.html_url || '')
      const publishedAt = String(data.published_at || '')
      return {
        ok: true,
        currentVersion,
        latestVersion,
        htmlUrl,
        publishedAt,
        // 简单的版本比较：latest > current 才有更新
        hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
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

/** 启动时调用：保证全局最多只有一个模型的 isDefault=true。 */
function ensureSingleDefault() {
  const store = createStore()
  const providers = (store.get('providers', []) as any[])
  if (!Array.isArray(providers) || providers.length === 0) return

  const defaults: { pIdx: number; mIdx: number; model: any }[] = []
  providers.forEach((p, pIdx) => {
    ;(p.models || []).forEach((m: any, mIdx: number) => {
      if (m.isDefault) defaults.push({ pIdx, mIdx, model: m })
    })
  })
  if (defaults.length <= 1) return

  console.warn(`[ensureSingleDefault] 检测到 ${defaults.length} 个默认模型，自动清理为 1 个`)
  // 保留第一个 enabled 的默认；都不 enabled 就保留第一个
  const keep = defaults.find((d) => d.model.enabled) ?? defaults[0]
  providers.forEach((p) => {
    ;(p.models || []).forEach((m: any) => { m.isDefault = false })
  })
  providers[keep.pIdx].models[keep.mIdx].isDefault = true
  store.set('providers', providers)
}

app.whenReady().then(() => {
  // 启动时自愈：保证全局最多只有一个模型 isDefault=true。
  // 历史 bug：旧版 fetch-models 在新厂商拉模型时可能无视其他厂商已有默认，
  // 制造出多个默认。修复后仍保留此清理作为防御层。
  ensureSingleDefault()
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
  // 清理未触发的防抖定时器，避免退出后回调写到已销毁的 store
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer)
    saveBoundsTimer = null
  }
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
