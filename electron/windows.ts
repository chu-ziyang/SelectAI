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

interface StoredPopupSettings {
  width?: number
  maxHeight?: number
  padding?: number
  opacity?: number
  placement?: string
  offsetX?: number
  offsetY?: number
  avoidScreenEdge?: boolean
  clickOutsideClose?: boolean
  replaceOnNewSelect?: boolean
  autoHide?: boolean
  autoHideSeconds?: number
}

const DEFAULT_POPUP_SETTINGS: Required<StoredPopupSettings> = {
  width: 320,
  maxHeight: 400,
  padding: 16,
  opacity: 100,
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

function requestPopupWindowClose() {
  if (!popupWindow || popupWindow.isDestroyed()) return
  popupWindow.webContents.send('popup:request-close')
  if (popupCloseFallback) clearTimeout(popupCloseFallback)
  popupCloseFallback = setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
  }, 650)
}

/**
 * 创建悬浮弹窗窗口
 * - 无边框、透明、置顶、不抢焦点
 */
export function createPopupWindow(text: string) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    const currentSettings = getPopupSettings()
    if (!currentSettings.replaceOnNewSelect) return
    const previous = popupWindow
    popupWindow = null
    previous.close()
  }
  popupPinned = false
  popupFocusLock = false
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
  const cursorPoint = screen.getCursorScreenPoint()
  popupAnchor = cursorPoint

  // Give the renderer enough room to measure its natural toolbar width while hidden.
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
    // 不抢焦点——关键！
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  popupWindow = win

  // 不让弹窗抢走当前应用的焦点
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)

  const hash = `/popup?text=${encodeURIComponent(text)}`

  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5174/#${hash}`)
  } else {
    win.loadFile(
      path.join(__dirname, '../dist-renderer/index.html'),
      { hash },
    )
  }

  win.once('ready-to-show', () => {
    // The renderer normally calls popup:resize immediately. Keep a fallback so
    // a renderer error never leaves an invisible window behind.
    popupShowFallback = setTimeout(() => {
      if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.isVisible()) {
        popupWindow.showInactive()
      }
    }, 500)
  })

  win.on('closed', () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer)
      autoHideTimer = null
    }
    popupPinned = false
    popupFocusLock = false
    popupAnchor = null
    if (popupShowFallback) {
      clearTimeout(popupShowFallback)
      popupShowFallback = null
    }
    if (popupCloseFallback) {
      clearTimeout(popupCloseFallback)
      popupCloseFallback = null
    }
    if (popupWindow === win) popupWindow = null
  })

  win.on('blur', () => {
    if (!settings.clickOutsideClose) return
    if (popupPinned || popupFocusLock) return
    if (popupWindow !== win) return
    requestPopupWindowClose()
  })
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
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    popupWindow = null
  }
}

export function getPopupWindow() {
  return popupWindow
}

export function resizePopupWindow(width: number, height: number) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    const settings = getPopupSettings()
    const anchor = popupAnchor || screen.getCursorScreenPoint()
    const safeWidth = Math.max(120, Math.min(Math.ceil(width), 720))
    const safeHeight = Math.max(40, Math.min(Math.ceil(height), 640))
    popupWindow.setBounds(calculatePopupBounds(anchor, safeWidth, safeHeight, settings), false)
    if (popupShowFallback) {
      clearTimeout(popupShowFallback)
      popupShowFallback = null
    }
    if (!popupWindow.isVisible()) popupWindow.showInactive()

    if (settings.autoHide && !autoHideTimer) {
      autoHideTimer = setTimeout(() => {
        if (!popupPinned && popupWindow && !popupWindow.isDestroyed()) requestPopupWindowClose()
      }, settings.autoHideSeconds * 1000)
    }
  }
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
