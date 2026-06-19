import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { createStore } from './store'
import { getRoundedRectShape } from './lib/roundedShape'
import { calculatePopupBounds as calculatePopupBoundsPure } from './lib/popupGeometry'

let popupWindow: BrowserWindow | null = null
let resultWindow: BrowserWindow | null = null
let popupPinned = false
// 弹窗展开为结果卡时锁定：阅读/追问期间不响应 blur 自动关闭。
let popupFocusLock = false
let autoHideTimer: ReturnType<typeof setTimeout> | null = null
let popupShowFallback: ReturnType<typeof setTimeout> | null = null
let popupCloseFallback: ReturnType<typeof setTimeout> | null = null
let popupAnchor: Electron.Point | null = null
// 用户主动拖动窗口后的最近位置。resizePopupWindow 在 toolbar↔展开态切换/
// ResizeObserver 校准/重新生成等场景下，优先使用这个值而不是 popupAnchor，
// 避免把用户拖到别处的窗口拉回原划词点。
let userMovedBounds: Electron.Rectangle | null = null
let resultPinned = false
let pendingSelectionPayload: PopupSelectionPayload | null = null
let pendingSelectionShouldShow = false
let currentPopupSessionId = ''
let popupReady = false
let popupPresentTimer: ReturnType<typeof setTimeout> | null = null
let activeAnimTimer: NodeJS.Timeout | null = null
// 刚 show 后的 blur 缓冲期：showInactive 在 Windows 上有时会触发一次伪 blur，
// 导致 clickOutsideClose 立刻关闭弹窗。300ms 内的 blur 视为误报，忽略。
let popupShownAt = 0
const BLUR_GRACE_PERIOD_MS = 300

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

/**
 * 弹窗窗口坐标计算（屏幕相关薄封装）。
 * 纯几何逻辑在 electron/lib/popupGeometry.ts，这里只负责从 Electron screen 取工作区。
 */
function calculatePopupBounds(
  cursorPoint: Electron.Point,
  popupW: number,
  popupH: number,
  settings: Required<StoredPopupSettings>,
) {
  const workArea = screen.getDisplayNearestPoint(cursorPoint).workArea
  return calculatePopupBoundsPure(cursorPoint, popupW, popupH, workArea, {
    placement: settings.placement as any,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    avoidScreenEdge: settings.avoidScreenEdge,
  })
}

function applyPopupWindowShape(win: BrowserWindow, width: number, height: number, radius = getPopupSettings().cornerRadius) {
  if (win.isDestroyed()) return
  try {
    win.setShape(getRoundedRectShape(width, height, radius) as Electron.Rectangle[])
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
  const expectedSessionId = currentPopupSessionId
  popupPresentTimer = setTimeout(() => {
    if (
      expectedSessionId === currentPopupSessionId
      && popupWindow
      && !popupWindow.isDestroyed()
      && !popupWindow.isVisible()
    ) {
      popupShownAt = Date.now()  // 进入 blur 缓冲期
      popupWindow.showInactive()
    }
    popupPresentTimer = null
  }, Math.max(0, delayMs))
}

function emitSelectionPayload(win: BrowserWindow, payload: PopupSelectionPayload, shouldShow: boolean) {
  win.webContents.send('popup:selection-payload', payload)
  if (shouldShow) {
    // 把"何时 show"交给 renderer：它在双 RAF 后会主动调 popup:present，
    // 那时浏览器已经 paint 出新 toolbar 内容，不会闪过上一次的旧画面。
    // 这里只挂一个 80ms 兜底，防止 renderer 卡死时窗口永远不显示。
    presentPopupWindow(80)
  } else {
    cancelPopupPresentTimer()
  }
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
    currentPopupSessionId = ''
    userMovedBounds = null
    if (popupWindow === win) popupWindow = null
  })

  // 用户拖动窗口（或主进程 setBounds）都会触发 move。我们把当前 bounds 持续
  // 同步到 userMovedBounds，作为 resizePopupWindow 的权威位置源。
  // 主进程自己 setBounds 时也会触发 move，但 target.x/y 本来就来自这个值，
  // 所以是稳定不动的；用户拖动则会真正更新它。
  win.on('move', () => {
    if (popupWindow !== win || win.isDestroyed()) return
    userMovedBounds = win.getBounds()
  })
  win.on('resize', () => {
    if (popupWindow !== win || win.isDestroyed()) return
    userMovedBounds = win.getBounds()
  })

  win.on('blur', () => {
    // 刚 show 后的 300ms 内 Windows 会触发一次伪 blur（showInactive 副作用），
    // 在缓冲期内忽略，避免 clickOutsideClose 误关弹窗
    const sinceShown = Date.now() - popupShownAt
    if (sinceShown < BLUR_GRACE_PERIOD_MS) {
      return
    }
    if (!getPopupSettings().clickOutsideClose) return
    if (popupPinned || popupFocusLock) return
    if (popupWindow !== win) return
    if (popupWindow && !popupWindow.isDestroyed()) {
      // 发 popup:hidden 让 renderer 取消正在跑的 AI 流（否则 streaming 中点别处会
      // 让 main 的 activeAbortController 成孤儿，fetch 持续向已隐藏 webContents send）。
      // renderer 在 onSelectionPayload 时会设 ignoreHiddenUntilRef = now+800，
      // 二次划词的旧 blur 落在守卫窗口内会被忽略，不会把新工具栏误清。
      popupWindow.webContents.send('popup:hidden')
      popupWindow.hide()
    }
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
  // 新选区开始一段全新会话：清掉用户对上一窗口的拖动位置，
  // 让本次定位完全由 anchor + setBounds 决定。
  userMovedBounds = null

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
  currentPopupSessionId = payload.id

  if (popupReady) {
    emitSelectionPayload(win, payload, !win.isVisible())
  } else {
    pendingSelectionPayload = payload
    pendingSelectionShouldShow = true
    // 兜底：万一 renderer 一直没 ready（极端情况），也确保窗口最终显示。
    // 60ms 是 React 首次挂载的安全上限，比之前的 140ms 体感快很多。
    if (!win.isVisible()) presentPopupWindow(60)
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

export function hidePopupWindow(sessionId?: string) {
  if (sessionId && sessionId !== currentPopupSessionId) {
    // 收到过期 session 的隐藏请求（如二次划词时旧 session 的延迟 hide），直接忽略。
    return
  }
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
    // 关键：保留窗口当前 x/y。resizePopupWindow 只在窗口已显示之后被调用
    // （toolbar ↔ 展开态切换、ResizeObserver 校准、重新生成时 status 变化等），
    // 用户可能已经把窗口拖到别处；如果再按 popupAnchor 重算位置，会把窗口拉回
    // 原划词点 —— 表现为流式时抖动、点重新生成跳回原位。新选区的定位由
    // showPopupSelection 直接 setBounds 负责，不走这条路径。
    //
    // 位置源优先级：userMovedBounds（move 事件实时记录）> getBounds()。
    // 两者通常一致；userMovedBounds 是兜底，规避 getBounds 在动画 step 与
    // 外部 setBounds 交错时偶发的过期返回。
    const current = userMovedBounds || popupWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: current.x, y: current.y })
    const safeWidth = Math.max(120, Math.min(Math.ceil(width), 720))
    const maxByScreen = Math.max(160, Math.floor(display.workArea.height * 0.9))
    const safeHeight = Math.max(40, Math.min(Math.ceil(height), maxByScreen))

    let x = current.x
    let y = current.y
    if (settings.avoidScreenEdge) {
      const wa = display.workArea
      x = Math.min(Math.max(x, wa.x + 12), wa.x + wa.width - safeWidth - 12)
      y = Math.min(Math.max(y, wa.y + 12), wa.y + wa.height - safeHeight - 12)
    }

    const target = { x, y, width: safeWidth, height: safeHeight }
    // 平滑过渡：当前 bounds 与目标 bounds 之间用缓动；小幅变化由 animateBounds 内
    // 自行跳过动画直接 setBounds。
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

  const radius = getPopupSettings().cornerRadius

  // 小幅变化（如 ResizeObserver 校准工具栏真实宽度）直接 setBounds，不动画。
  // 否则用户每次二次划词都会看到工具栏宽度缓缓长大 220ms，体验比硬切换还差。
  // 阈值：宽度 < 120px、高度 < 80px、位置 < 80px 视为微调；超过则用缓动（toolbar ↔ 展开态切换）。
  if (Math.abs(dw) < 120 && Math.abs(dh) < 80 && Math.abs(dx) < 80 && Math.abs(dy) < 80) {
    win.setBounds(target, false)
    applyPopupWindowShape(win, target.width, target.height, radius)
    return
  }

  const duration = 220
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

  // 不再把 text/prompt 拼进 URL（长文本+特殊字符会撑爆 URL，且可能被会话历史记录）。
  // 改用 webContents.send 在 did-finish-load 后传参；renderer 用一次性回调接收。
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5174/#/result')
  } else {
    win.loadFile(
      path.join(__dirname, '../dist-renderer/index.html'),
      { hash: '/result' },
    )
  }

  // 等待页面渲染完再推参数；renderer 必须先注册 result:on-params 监听
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return
    win.webContents.send('result:params', {
      actionId, name: actionName, icon: actionIcon, text: selectedText,
      providerId, modelId, prompt: systemPrompt,
    })
  })

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
