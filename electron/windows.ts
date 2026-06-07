import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { createStore } from './store'

let popupWindow: BrowserWindow | null = null
let resultWindow: BrowserWindow | null = null
let popupPinned = false
// 弹窗展开为结果卡时锁定：阅读/追问期间不响应 blur 自动关闭。
let popupFocusLock = false
let autoHideTimer: ReturnType<typeof setTimeout> | null = null
let popupShowFallback: ReturnType<typeof setTimeout> | null = null
let popupCloseFallback: ReturnType<typeof setTimeout> | null = null
let popupAnchor: Electron.Point | null = null
let resultPinned = false
let pendingSelectionPayload: PopupSelectionPayload | null = null
let pendingSelectionShouldShow = false
let popupReady = false
let popupPresentTimer: ReturnType<typeof setTimeout> | null = null
let activeAnimTimer: NodeJS.Timeout | null = null

interface StoredPopupSettings {
  width?: number
  maxHeight?: number
  padding?: number
  opacity?: number
  cornerRadius?: number
  placement?: string
  offsetX?: number
  offsetY?: number
  avoidScreenEdge?: boolean
  clickOutsideClose?: boolean
  replaceOnNewSelect?: boolean
  autoHide?: boolean
  autoHideSeconds?: number
}

export interface PopupSelectionPayload {
  id: string
  text: string
  anchor: Electron.Point
  reason: 'auto' | 'ctrl' | 'manual' | 'clipboard'
  createdAt: number
}

const DEFAULT_POPUP_SETTINGS: Required<StoredPopupSettings> = {
  width: 320,
  maxHeight: 400,
  padding: 16,
  opacity: 100,
  cornerRadius: 12,
  placement: 'bottom-right',
  offsetX: 0,
  offsetY: 8,
  avoidScreenEdge: true,
  clickOutsideClose: true,
  replaceOnNewSelect: true,
  autoHide: false,
  autoHideSeconds: 5,
}

function getPopupSettings(): Required<StoredPopupSettings> {
  const store = createStore()
  return {
    ...DEFAULT_POPUP_SETTINGS,
    ...((store.get('popupSettings', {}) as StoredPopupSettings) || {}),
  }
}

function calculatePopupBounds(
  cursorPoint: Electron.Point,
  popupW: number,
  popupH: number,
  settings: Required<StoredPopupSettings>,
) {
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const workArea = display.workArea
  const gapX = 8 + settings.offsetX
  const gapY = 8 + settings.offsetY

  let x = cursorPoint.x + gapX
  let y = cursorPoint.y + gapY

  switch (settings.placement) {
    case 'top-left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y - popupH - gapY
      break
    case 'top':
      x = cursorPoint.x - popupW / 2 + settings.offsetX
      y = cursorPoint.y - popupH - gapY
      break
    case 'top-right':
      x = cursorPoint.x + gapX
      y = cursorPoint.y - popupH - gapY
      break
    case 'left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y - popupH / 2 + settings.offsetY
      break
    case 'center':
      x = cursorPoint.x - popupW / 2 + settings.offsetX
      y = cursorPoint.y - popupH / 2 + settings.offsetY
      break
    case 'right':
      x = cursorPoint.x + gapX
      y = cursorPoint.y - popupH / 2 + settings.offsetY
      break
    case 'bottom-left':
      x = cursorPoint.x - popupW - gapX
      y = cursorPoint.y + gapY
      break
    case 'bottom':
      x = cursorPoint.x - popupW / 2 + settings.offsetX
      y = cursorPoint.y + gapY
      break
    case 'bottom-right':
    default:
      x = cursorPoint.x + gapX
      y = cursorPoint.y + gapY
      break
  }

  if (settings.avoidScreenEdge) {
    x = Math.min(Math.max(x, workArea.x + 12), workArea.x + workArea.width - popupW - 12)
    y = Math.min(Math.max(y, workArea.y + 12), workArea.y + workArea.height - popupH - 12)
  }

  return { x: Math.round(x), y: Math.round(y), width: popupW, height: popupH }
}

function getRoundedRectShape(width: number, height: number, radius: number): Electron.Rectangle[] {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const r = Math.max(0, Math.min(Math.round(radius), Math.floor(w / 2), Math.floor(h / 2)))
  if (r <= 0) return [{ x: 0, y: 0, width: w, height: h }]

  const rects: Electron.Rectangle[] = []
  let pending: Electron.Rectangle | null = null
  const pushRow = (y: number, x: number, rowWidth: number) => {
    if (rowWidth <= 0) return
    if (pending && pending.x === x && pending.width === rowWidth && pending.y + pending.height === y) {
      pending.height += 1
      return
    }
    if (pending) rects.push(pending)
    pending = { x, y, width: rowWidth, height: 1 }
  }

  for (let y = 0; y < h; y += 1) {
    let inset = 0
    if (y < r) {
      const dy = r - y - 0.5
      inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - dy * dy))))
    } else if (y >= h - r) {
      const dy = y - (h - r) + 0.5
      inset = Math.max(0, Math.ceil(r - Math.sqrt(Math.max(0, r * r - dy * dy))))
    }
    pushRow(y, inset, w - inset * 2)
  }
  if (pending) rects.push(pending)
  return rects
}

function applyPopupWindowShape(win: BrowserWindow, width: number, height: number, radius = getPopupSettings().cornerRadius) {
  if (win.isDestroyed()) return
  try {
    win.setShape(getRoundedRectShape(width, height, radius))
  } catch {
    // setShape is platform-dependent; CSS border-radius remains the visual fallback.
  }
}

function requestPopupWindowClose() {
  if (!popupWindow || popupWindow.isDestroyed()) return
  popupWindow.webContents.send('popup:request-close')
  if (popupCloseFallback) clearTimeout(popupCloseFallback)
  popupCloseFallback = setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
  }, 650)
}

function cancelPopupBoundsAnimation() {
  if (activeAnimTimer) {
    clearTimeout(activeAnimTimer)
    activeAnimTimer = null
  }
}

function cancelPopupPresentTimer() {
  if (popupPresentTimer) {
    clearTimeout(popupPresentTimer)
    popupPresentTimer = null
  }
}

export function presentPopupWindow(delayMs = 0) {
  cancelPopupPresentTimer()
  popupPresentTimer = setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.isVisible()) {
      popupWindow.showInactive()
    }
    popupPresentTimer = null
  }, Math.max(0, delayMs))
}

function emitSelectionPayload(win: BrowserWindow, payload: PopupSelectionPayload, shouldShow: boolean) {
  win.webContents.send('popup:selection-payload', payload)
  if (!shouldShow) cancelPopupPresentTimer()
}

/**
 * 预创建并复用悬浮弹窗窗口。
 * 快速划词体验依赖它常驻隐藏：选中文字变化时只推送 payload，不重新 loadURL。
 */
export function ensurePopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) return popupWindow

  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
  if (popupShowFallback) {
    clearTimeout(popupShowFallback)
    popupShowFallback = null
  }
  if (popupCloseFallback) {
    clearTimeout(popupCloseFallback)
    popupCloseFallback = null
  }

  const settings = getPopupSettings()
  const cursorPoint = popupAnchor || screen.getCursorScreenPoint()

  const popupW = Math.max(240, Math.min(settings.width, 720))
  const popupH = 68
  const bounds = calculatePopupBounds(cursorPoint, popupW, popupH, settings)

  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    // 关键：明确把 backgroundColor 设为透明。
    // Windows 上只设 transparent:true 不够，还需要 backgroundColor:'#00000000'，
    // 否则在某些主题下会出现"白色方框"而不是真正透明。
    backgroundColor: '#00000000',
    // 不抢焦点——关键！
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  popupWindow = win
  popupReady = false
  applyPopupWindowShape(win, bounds.width, bounds.height, settings.cornerRadius)

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5174/#/popup')
  } else {
    win.loadFile(
      path.join(__dirname, '../dist-renderer/index.html'),
      { hash: '/popup' },
    )
  }

  win.webContents.once('did-finish-load', () => {
    // Renderer calls markPopupRendererReady after React listeners are mounted.
    popupReady = false
  })

  win.on('closed', () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer)
      autoHideTimer = null
    }
    popupPinned = false
    popupFocusLock = false
    popupAnchor = null
    popupReady = false
    pendingSelectionPayload = null
    if (popupShowFallback) {
      clearTimeout(popupShowFallback)
      popupShowFallback = null
    }
    if (popupCloseFallback) {
      clearTimeout(popupCloseFallback)
      popupCloseFallback = null
    }
    if (popupPresentTimer) {
      clearTimeout(popupPresentTimer)
      popupPresentTimer = null
    }
    if (popupWindow === win) popupWindow = null
  })

  win.on('blur', () => {
    if (!settings.clickOutsideClose) return
    if (popupPinned || popupFocusLock) return
    if (popupWindow !== win) return
    requestPopupWindowClose()
  })

  return win
}

export function markPopupRendererReady() {
  popupReady = true
  if (!popupWindow || popupWindow.isDestroyed()) return
  if (pendingSelectionPayload) {
    emitSelectionPayload(popupWindow, pendingSelectionPayload, pendingSelectionShouldShow)
    pendingSelectionPayload = null
    pendingSelectionShouldShow = false
  }
}

export function showPopupSelection(
  text: string,
  anchor: Electron.Point = screen.getCursorScreenPoint(),
  reason: PopupSelectionPayload['reason'] = 'auto',
) {
  const settings = getPopupSettings()
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible() && !settings.replaceOnNewSelect) return

  popupPinned = false
  popupFocusLock = false
  popupAnchor = anchor

  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
  if (popupCloseFallback) {
    clearTimeout(popupCloseFallback)
    popupCloseFallback = null
  }
  if (popupShowFallback) {
    clearTimeout(popupShowFallback)
    popupShowFallback = null
  }
  cancelPopupPresentTimer()

  const win = ensurePopupWindow()
  const toolbarWidth = Math.max(240, Math.min(settings.width, 720))
  const toolbarHeight = 68
  const bounds = calculatePopupBounds(anchor, toolbarWidth, toolbarHeight, settings)
  cancelPopupBoundsAnimation()
  win.setBounds(bounds, false)
  applyPopupWindowShape(win, bounds.width, bounds.height, settings.cornerRadius)

  const payload: PopupSelectionPayload = {
    id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    anchor,
    reason,
    createdAt: Date.now(),
  }

  if (popupReady) {
    emitSelectionPayload(win, payload, !win.isVisible())
  } else {
    pendingSelectionPayload = payload
    pendingSelectionShouldShow = true
  }

  if (settings.autoHide && !autoHideTimer) {
    autoHideTimer = setTimeout(() => {
      if (!popupPinned && !popupFocusLock && popupWindow && !popupWindow.isDestroyed()) hidePopupWindow()
    }, settings.autoHideSeconds * 1000)
  }
}

export function updatePopupSelection(
  text: string,
  anchor: Electron.Point = screen.getCursorScreenPoint(),
  reason: PopupSelectionPayload['reason'] = 'auto',
) {
  showPopupSelection(text, anchor, reason)
}

export function hidePopupWindow() {
  if (popupCloseFallback) {
    clearTimeout(popupCloseFallback)
    popupCloseFallback = null
  }
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
  popupPinned = false
  popupFocusLock = false
  cancelPopupPresentTimer()
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('popup:hidden')
    popupWindow.hide()
  }
  cancelPopupBoundsAnimation()
}

// 旧入口保留给 text-selection/快捷键调用；内部已改成复用常驻窗口。
export function createPopupWindow(text: string) {
  showPopupSelection(text, screen.getCursorScreenPoint(), 'auto')
}

export function setPopupPinned(pinned: boolean) {
  popupPinned = pinned
  if (pinned && autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

/**
 * 弹窗焦点锁：true 时阅读/追问期间点弹窗外不会触发自动关闭。
 * 仅影响 blur 关闭判断，不影响钉住/拖动。
 */
export function setPopupFocusLock(lock: boolean) {
  popupFocusLock = lock
  if (lock && autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
  // 进入展开态时，如果焦点已不在弹窗里（比如用户点过别处），
  // 把它拉回前台但不抢焦点，避免被 blur 立刻误关。
  if (lock && popupWindow && !popupWindow.isDestroyed() && !popupWindow.isFocused()) {
    popupWindow.showInactive()
  }
  // 解锁后清掉 autoHide 计时器依赖的旧判断
  if (!lock && autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

export function closePopupWindow() {
  if (popupCloseFallback) {
    clearTimeout(popupCloseFallback)
    popupCloseFallback = null
  }
  hidePopupWindow()
}

export function getPopupWindow() {
  return popupWindow
}

export function resizePopupWindow(width: number, height: number) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    const settings = getPopupSettings()
    const anchor = popupAnchor || screen.getCursorScreenPoint()
    // 宽度上限 720；高度上限放到 800（之前 640 太紧，长流式内容被截在内部滚动），
    // 同时再兜底限制到屏幕工作区高度的 90%，避免超高内容把窗口顶出屏幕。
    const safeWidth = Math.max(120, Math.min(Math.ceil(width), 720))
    const display = screen.getDisplayNearestPoint(anchor)
    const maxByScreen = Math.max(160, Math.floor(display.workArea.height * 0.9))
    const safeHeight = Math.max(40, Math.min(Math.ceil(height), maxByScreen))
    const target = calculatePopupBounds(anchor, safeWidth, safeHeight, settings)

    // 平滑过渡：当前 bounds 与目标 bounds 之间用 RAF 缓动，
    // 让窗口大小变化看起来"缓慢增长"而不是瞬时跳变。
    animateBounds(popupWindow, target)

    if (popupShowFallback) {
      clearTimeout(popupShowFallback)
      popupShowFallback = null
    }
    if (settings.autoHide && !popupFocusLock && !autoHideTimer) {
      autoHideTimer = setTimeout(() => {
        if (!popupPinned && popupWindow && !popupWindow.isDestroyed()) requestPopupWindowClose()
      }, settings.autoHideSeconds * 1000)
    }
  }
}

/** 在窗口上以 16ms 步进缓动过渡到目标 bounds（缓出曲线，约 220ms）
 *  用 setTimeout 链而非 requestAnimationFrame，因为 Electron 主进程无 DOM/RAF 全局 */
function animateBounds(win: BrowserWindow, target: Electron.Rectangle) {
  cancelPopupBoundsAnimation()
  const start = win.getBounds()
  const dx = target.x - start.x
  const dy = target.y - start.y
  const dw = target.width - start.width
  const dh = target.height - start.height
  // 没有变化则跳过
  if (Math.abs(dw) < 1 && Math.abs(dh) < 1 && Math.abs(dx) < 1 && Math.abs(dy) < 1) return

  const duration = 220
  const radius = getPopupSettings().cornerRadius
  const t0 = Date.now()
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

  const step = () => {
    const t = Math.min(1, (Date.now() - t0) / duration)
    const e = easeOut(t)
    const nextBounds = {
      x: Math.round(start.x + dx * e),
      y: Math.round(start.y + dy * e),
      width: Math.round(start.width + dw * e),
      height: Math.round(start.height + dh * e),
    }
    win.setBounds(nextBounds, false)
    applyPopupWindowShape(win, nextBounds.width, nextBounds.height, radius)
    if (t < 1) {
      activeAnimTimer = setTimeout(step, 16)
    } else {
      activeAnimTimer = null
    }
  }
  activeAnimTimer = setTimeout(step, 0)
}

/** 创建独立的 AI 结果窗口 */
export function createResultWindow(actionId: string, actionName: string, actionIcon: string, selectedText: string, providerId: string, modelId: string, systemPrompt: string) {
  if (resultWindow && !resultWindow.isDestroyed()) {
    const previous = resultWindow
    resultWindow = null
    previous.close()
  }

  const store = createStore()
  const popupSettings = store.get('popupSettings', {}) as any
  const w = Math.max(420, popupSettings?.width || 420)
  const h = Math.max(360, popupSettings?.maxHeight || 500)

  const win = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 320,
    minHeight: 240,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    // 关闭原生阴影：原生阴影是矩形，会盖在 CSS 圆角外面形成"方框"。
    // 阴影由 .result-window-shell 的 box-shadow 自己渲染。
    hasShadow: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  resultWindow = win
  resultPinned = false

  const display = screen.getDisplayNearestPoint(popupAnchor || screen.getCursorScreenPoint())
  const area = display.workArea
  let x = Math.round(area.x + (area.width - w) / 2)
  let y = Math.round(area.y + (area.height - h) / 2)
  if (popupWindow && !popupWindow.isDestroyed()) {
    const toolbar = popupWindow.getBounds()
    x = Math.round(toolbar.x + (toolbar.width - w) / 2)
    y = toolbar.y + toolbar.height + 8
    x = Math.max(area.x + 8, Math.min(x, area.x + area.width - w - 8))
    if (y + h > area.y + area.height - 8) y = Math.max(area.y + 8, toolbar.y - h - 8)
  }
  win.setBounds({ x, y, width: w, height: h }, false)

  const params = new URLSearchParams({
    actionId,
    name: actionName,
    icon: actionIcon,
    text: selectedText,
    providerId,
    modelId,
    prompt: systemPrompt,
  })

  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5174/#/result?${params.toString()}`)
  } else {
    win.loadFile(
      path.join(__dirname, '../dist-renderer/index.html'),
      { hash: `/result?${params.toString()}` },
    )
  }

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    if (resultWindow === win) {
      resultPinned = false
      resultWindow = null
    }
  })
}

export function setResultPinned(pinned: boolean) {
  resultPinned = pinned
  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.setAlwaysOnTop(pinned, pinned ? 'floating' : 'normal')
  }
}

export function closeResultWindow() {
  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.close()
    resultWindow = null
  }
}
