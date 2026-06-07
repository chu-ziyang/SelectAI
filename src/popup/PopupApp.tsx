import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useActionStore } from '@/stores/actionStore'
import { useModelStore } from '@/stores/modelStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePopupSessionStore } from '@/stores/popupSessionStore'
import { compilePrompt } from '@/services/promptEngine'
import type { ActionConfig } from '@/types/models'
import { useKeyboardNav } from './useKeyboardNav'
import { useI18n } from '@/i18n/useI18n'
import SelectionToolbar from './SelectionToolbar'
import ExpandedResult from './ExpandedResult'

function estimateToolbarWidth(actions: Array<Pick<ActionConfig, 'name'>>, popupWidth: number, isVertical: boolean, isIconOnly: boolean) {
  if (isVertical) return popupWidth
  // 这个值只用于"窗口首次显示前"的兜底尺寸，挂载后 ResizeObserver 会按真实宽度二次校准。
  // 按钮组成：padding(16) + icon(20) + gap(6) + text；中文 12px font-weight 560
  // 字符宽度约 14-16px，这里取 16 防裁切；toolbar 外层 padding 3*2。
  const PADDING_PER_BUTTON = 16
  const ICON_WIDTH = 20
  const GAP_ICON_TEXT = 6
  const CHAR_WIDTH = 16
  const contentWidth = actions.reduce((sum, action) => {
    if (isIconOnly) return sum + 30
    const buttonWidth = PADDING_PER_BUTTON + ICON_WIDTH + GAP_ICON_TEXT + action.name.length * CHAR_WIDTH
    return sum + Math.max(60, Math.min(140, buttonWidth))
  }, 6)
  return Math.min(720, Math.max(180, popupWidth, contentWidth))
}

function resultBounds(popupWidth: number, popupMaxHeight: number) {
  return {
    width: Math.min(720, Math.max(360, popupWidth)),
    height: Math.max(300, popupMaxHeight),
  }
}

export default function PopupApp() {
  const { t } = useI18n()
  const { actions, loadActions } = useActionStore()
  const { providers, loadProviders } = useModelStore()
  const { app, popup, loadSettings } = useSettingsStore()
  const { session, start, cancel, clearForToolbar, hide } = usePopupSessionStore()

  const [notice, setNotice] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingPayloadIdRef = useRef('')
  const ignoreHiddenUntilRef = useRef(0)

  const enabledActions = useMemo(() => actions
    .filter((action) => action.enabled)
    .sort((a, b) => a.order - b.order), [actions])
  const isVertical = popup.layout === 'vertical'
  const isIconOnly = popup.layout === 'icon-only'
  const visible = session.status !== 'hidden'
  const toolbarWidth = estimateToolbarWidth(enabledActions, popup.width, isVertical, isIconOnly)
  const toolbarHeight = isVertical ? Math.max(44, enabledActions.length * 32 + 8) : 40
  const fixedResultBounds = resultBounds(popup.width, popup.maxHeight)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolvedTheme = app.theme === 'system' ? (media.matches ? 'dark' : 'light') : app.theme
      root.setAttribute('data-theme', resolvedTheme)
      root.classList.toggle('dark', resolvedTheme === 'dark')
      root.classList.toggle('light', resolvedTheme === 'light')
    }

    applyTheme()
    if (app.theme === 'system') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [app.theme])

  useEffect(() => {
    void loadActions()
    void loadProviders()
    void loadSettings()

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const text = params.get('text')
    if (text) {
      clearForToolbar(`legacy_${Date.now()}`, decodeURIComponent(text))
    }
  }, [clearForToolbar, loadActions, loadProviders, loadSettings])

  useEffect(() => {
    const dispose = window.electronAPI?.popup.onSelectionPayload((payload) => {
      pendingPayloadIdRef.current = payload.id
      ignoreHiddenUntilRef.current = Date.now() + 800
      setNotice('')
      void cancel()
      void window.electronAPI?.popup?.setFocusLock(false)
      clearForToolbar(payload.id, payload.text)
      // 等浏览器 paint 完新内容再让主进程 show 窗口，否则窗口出现的瞬间
      // 还可能停留在上一次的画面（旧 toolbar / 展开态结果）。
      // 双 RAF：第 1 个 callback 在下一帧 layout 之后、paint 之前；
      // 第 2 个 callback 在再下一帧，那时第一帧已经 paint 完成。
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (pendingPayloadIdRef.current === payload.id) {
            void window.electronAPI?.popup?.present()
          }
        })
      })
    })
    void window.electronAPI?.popup.ready()
    return dispose
  }, [cancel, clearForToolbar])

  useEffect(() => window.electronAPI?.popup.onStoreUpdated((event) => {
    if (event.key === 'actions') void loadActions()
    if (event.key === 'providers') void loadProviders()
    if (event.key === 'settings' || event.key === 'popupSettings') void loadSettings()
  }), [loadActions, loadProviders, loadSettings])

  useEffect(() => window.electronAPI?.popup.onHidden(() => {
    if (Date.now() < ignoreHiddenUntilRef.current) return
    void cancel()
    hide()
  }), [cancel, hide])

  const lastStatusRef = useRef<string>('')
  useEffect(() => {
    // 仅在 status 真正切换（toolbar ↔ 展开态）时调 resize；
    // 二次划词时主进程已经 setBounds 到工具栏大小，renderer 不需要再触发 resize/动画。
    const next = session.status
    if (lastStatusRef.current === next) return
    lastStatusRef.current = next
    if (next === 'toolbar') {
      void window.electronAPI?.popup?.resize(toolbarWidth, toolbarHeight)
    } else if (visible) {
      void window.electronAPI?.popup?.resize(fixedResultBounds.width, fixedResultBounds.height)
    }
  }, [session.status, visible, toolbarWidth, toolbarHeight, fixedResultBounds.width, fixedResultBounds.height])

  // 用 ResizeObserver 测真实工具栏宽高再二次校准窗口大小。
  // estimateToolbarWidth 是按平均字符宽度估算的，遇到长动作名或非标准字体时
  // 可能比 max-content 真实宽度偏小，导致最后一个按钮被窗口边界裁切。
  //
  // 取值用 max(scrollWidth, getBoundingClientRect().width) 而不是 borderBoxSize：
  // 当 motion.div 的 layoutId="popup-shell" 处于 layout 过渡时，framer-motion
  // 可能在 transition 中段报告非真实的"过渡态"宽度（比真实 max-content 小），
  // 而 scrollWidth 始终反映子元素总宽度（即按钮真实需要的空间），不受 transform 影响。
  // 同一会话内只允许窗口变大，不允许变小，避免在 layout 过渡中段被误调小后裁掉按钮；
  // actions 数量真变化时，useEffect 依赖 enabledActions.length 会重订阅并复位 lastMeasured。
  const lastMeasuredRef = useRef({ w: 0, h: 0 })
  useLayoutEffect(() => {
    lastMeasuredRef.current = { w: 0, h: 0 }
    if (!visible || session.status !== 'toolbar') return
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const report = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.ceil(Math.max(el.scrollWidth, rect.width)) + 2 // +2: 给 border/亚像素留缓冲
      const h = Math.ceil(Math.max(el.scrollHeight, rect.height)) + 2
      if (w <= 0 || h <= 0) return
      const last = lastMeasuredRef.current
      const nextW = Math.max(w, last.w)
      const nextH = Math.max(h, last.h)
      if (nextW === last.w && nextH === last.h) return
      lastMeasuredRef.current = { w: nextW, h: nextH }
      void window.electronAPI?.popup?.resize(nextW, nextH)
    }

    // 初次挂载立刻测一次，避免等 ResizeObserver 第一次触发
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible, session.status, enabledActions.length, popup.layout, popup.iconSize, popup.width])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const resolveModel = useCallback((action: ActionConfig) => {
    if (action.modelMode === 'specific' && action.modelId) {
      for (const provider of providers) {
        const model = (provider.models || []).find((item) => item.id === action.modelId && item.enabled)
        if (model) return { providerId: provider.id, modelId: model.id }
      }
    }
    for (const provider of providers) {
      const model = (provider.models || []).find((item) => item.isDefault && item.enabled)
      if (model) return { providerId: provider.id, modelId: model.id }
    }
    for (const provider of providers) {
      const model = (provider.models || []).find((item) => item.enabled)
      if (model) return { providerId: provider.id, modelId: model.id }
    }
    return null
  }, [providers])

  const startAction = useCallback((action: ActionConfig) => {
    const text = session.selectedText.trim()
    if (!text) {
      setNotice('没有读取到选中文字')
      return
    }

    const model = resolveModel(action)
    if (!model) {
      setNotice('请先启用一个可用模型')
      return
    }

    const { result } = compilePrompt(action.systemPrompt, {
      selected_text: text,
      target_language: action.parameters?.targetLanguage || '中文',
      tone: action.parameters?.tone || '',
      audience: action.parameters?.audience || '',
    })

    void window.electronAPI?.popup?.setFocusLock(true)
    void start({
      sessionId: session.id || `ps_${Date.now()}`,
      selectedText: text,
      action,
      providerId: model.providerId,
      modelId: model.modelId,
      prompt: result,
    })
  }, [resolveModel, session.id, session.selectedText, start])

  const collapseToToolbar = useCallback(() => {
    void cancel()
    void window.electronAPI?.popup?.setFocusLock(false)
    clearForToolbar(session.id || `ps_${Date.now()}`, session.selectedText)
    void window.electronAPI?.popup?.resize(toolbarWidth, toolbarHeight)
  }, [cancel, clearForToolbar, session.id, session.selectedText, toolbarHeight, toolbarWidth])

  const closePopup = useCallback(() => {
    void cancel()
    void window.electronAPI?.popup?.setFocusLock(false)
    hide()
    void window.electronAPI?.popup?.hide({ sessionId: session.id })
  }, [cancel, hide, session.id])

  const handleRequestClose = useCallback(() => {
    if (Date.now() < ignoreHiddenUntilRef.current) return
    closePopup()
  }, [closePopup])

  useEffect(() => window.electronAPI?.popup.onRequestClose(handleRequestClose), [handleRequestClose])

  useEffect(() => () => {
    void cancel()
    void window.electronAPI?.popup?.setFocusLock(false)
  }, [cancel])

  useKeyboardNav({
    enabled: visible && popup.escClose,
    allowDigitKeys: session.status === 'toolbar',
    actionCount: enabledActions.length,
    onAction: (index) => {
      const action = enabledActions[index]
      if (action) startAction(action)
    },
    onClose: closePopup,
    onCollapse: session.status !== 'toolbar' ? collapseToToolbar : undefined,
  })

  return (
    <AnimatePresence mode="sync" initial={false}>
      {visible && session.status === 'toolbar' && (
        <SelectionToolbar
          key="toolbar"
          actions={enabledActions}
          popup={popup}
          emptyText={t('popup.noActions')}
          notice={notice}
          rootRef={rootRef}
          onAction={(action) => startAction(action as ActionConfig)}
        />
      )}
      {visible && session.status !== 'toolbar' && (
        <ExpandedResult
          key={session.id}
          session={session}
          popup={popup}
          rootRef={rootRef}
          onRetry={() => session.action && startAction(session.action)}
          onStop={() => void cancel()}
          onCollapse={collapseToToolbar}
          onClose={closePopup}
        />
      )}
    </AnimatePresence>
  )
}
