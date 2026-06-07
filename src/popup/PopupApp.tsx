import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useActionStore } from '@/stores/actionStore'
import { useModelStore } from '@/stores/modelStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { compilePrompt } from '@/services/promptEngine'
import type { ActionConfig } from '@/types/models'
import { useKeyboardNav } from './useKeyboardNav'
import { useI18n } from '@/i18n/useI18n'
import SelectionToolbar from './SelectionToolbar'
import ExpandedResult from './ExpandedResult'

type View = 'idle' | 'expanded'

export default function PopupApp() {
  const { t } = useI18n()
  const { actions, loadActions } = useActionStore()
  const { providers, loadProviders } = useModelStore()
  const { app, popup, loadSettings } = useSettingsStore()
  const chatStore = useChatStore()

  const [selectedText, setSelectedText] = useState('')
  const [notice, setNotice] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const [view, setView] = useState<View>('idle')
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null)
  const [activeParams, setActiveParams] = useState<{
    providerId: string
    modelId: string
    prompt: string
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // 应用主题到弹窗
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
    loadActions()
    loadProviders()
    loadSettings()
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const text = params.get('text')
    if (text) setSelectedText(decodeURIComponent(text))
  }, [])

  const enabledActions = actions
    .filter((a) => a.enabled)
    .sort((a, b) => a.order - b.order)
  const isVertical = popup.layout === 'vertical'
  const isIconOnly = popup.layout === 'icon-only'

  // 测量最终尺寸并通知主进程。两种 view 共用同一测量循环：
  //   - idle：贴按钮宽度，最多 720
  //   - expanded：贴内容尺寸，宽度按 popup.width，最大 maxHeight
  useEffect(() => {
    const fitWindow = () => {
      const el = rootRef.current
      if (!el) return
      const naturalWidth = Math.max(el.scrollWidth, el.getBoundingClientRect().width)
      const naturalHeight = Math.max(el.scrollHeight, el.getBoundingClientRect().height)
      const width = Math.ceil(
        view === 'expanded'
          ? Math.min(Math.max(naturalWidth, 360), 720)
          : (isVertical ? popup.width : Math.min(naturalWidth, 720)),
      )
      const height = Math.ceil(Math.max(naturalHeight, view === 'expanded' ? 280 : 40))
      window.electronAPI?.popup?.resize(width, height)
    }
    const frame = requestAnimationFrame(fitWindow)
    const observer = new ResizeObserver(fitWindow)
    if (rootRef.current) observer.observe(rootRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [enabledActions, view, activeAction, isVertical, popup.layout, popup.iconSize, popup.width])

  // 解析模型
  const resolveModel = useCallback((action: ActionConfig) => {
    if (action.modelMode === 'specific' && action.modelId) {
      for (const p of providers) {
        const m = (p.models || []).find(m2 => m2.id === action.modelId && m2.enabled)
        if (m) return { providerId: p.id, modelId: m.id }
      }
    }
    for (const p of providers) {
      const m = (p.models || []).find(m2 => m2.isDefault && m2.enabled)
      if (m) return { providerId: p.id, modelId: m.id }
    }
    for (const p of providers) {
      const m = (p.models || []).find(m2 => m2.enabled)
      if (m) return { providerId: p.id, modelId: m.id }
    }
    return null
  }, [providers])

  // 进入展开态：在同一弹窗里发起 AI 请求
  const enterExpanded = useCallback(async (action: ActionConfig) => {
    const model = resolveModel(action)
    const text = selectedText.trim()
    if (!text) {
      setNotice('没有读取到选中文字')
      return
    }
    if (!model) {
      setNotice('请先启用一个可用模型')
      return
    }

    const { result: prompt } = compilePrompt(action.systemPrompt, {
      selected_text: text,
      target_language: action.parameters?.targetLanguage || '中文',
      tone: action.parameters?.tone || '',
      audience: action.parameters?.audience || '',
    })

    setActiveAction(action)
    setActiveParams({ providerId: model.providerId, modelId: model.modelId, prompt })
    setView('expanded')

    // 展开期间不响应 blur 自动关闭（用户可能在阅读 / 输入追问）
    void window.electronAPI?.popup?.setFocusLock(true)
  }, [selectedText, resolveModel])

  // 收起回工具栏：取消流式、清空 chatStore、释放焦点锁
  const collapseToToolbar = useCallback(() => {
    setView('idle')
    setActiveAction(null)
    setActiveParams(null)
    void chatStore.cancelRequest()
    chatStore.clearResult()
    void window.electronAPI?.popup?.setFocusLock(false)
  }, [chatStore])

  // 真正关掉弹窗
  const closePopup = useCallback(() => {
    if (!isVisible) return
    if (popup.exitAnimation === 'none') {
      void window.electronAPI?.popup?.setFocusLock(false)
      window.electronAPI?.popup.close()
      return
    }
    setIsVisible(false)
    void window.electronAPI?.popup?.setFocusLock(false)
    window.setTimeout(() => window.electronAPI?.popup.close(), popup.animationDurationMs)
  }, [isVisible, popup.exitAnimation, popup.animationDurationMs])

  // 旧版兼容：点 X/外部触发时仍走这条关闭路径
  const handleClose = useCallback(() => {
    closePopup()
  }, [closePopup])

  useEffect(() => {
    return window.electronAPI?.popup.onRequestClose(handleClose)
  }, [handleClose])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 1800)
    return () => clearTimeout(timer)
  }, [notice])

  // 卸载时兜底释放焦点锁
  useEffect(() => () => {
    void window.electronAPI?.popup?.setFocusLock(false)
  }, [])

  useKeyboardNav({
    enabled: popup.escClose,
    // 数字键只在 idle 工具栏态生效，避免在结果卡里误触历史动作
    allowDigitKeys: view === 'idle',
    actionCount: enabledActions.length,
    onAction: (i) => enterExpanded(enabledActions[i]),
    onClose: closePopup,
    // 展开态时 Esc 优先收起（不关弹窗）；再按一次 Esc 才走 closePopup
    onCollapse: view === 'expanded' ? collapseToToolbar : undefined,
  })

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isVisible && view === 'idle' && (
        <SelectionToolbar
          key="toolbar"
          actions={enabledActions}
          popup={popup}
          emptyText={t('popup.noActions')}
          notice={notice}
          rootRef={rootRef}
          onAction={(action) => enterExpanded(action as ActionConfig)}
        />
      )}
      {isVisible && view === 'expanded' && activeAction && activeParams && (
        <ExpandedResult
          key="expanded"
          action={activeAction}
          sourceText={selectedText}
          providerId={activeParams.providerId}
          modelId={activeParams.modelId}
          prompt={activeParams.prompt}
          rootRef={rootRef}
          onCollapse={collapseToToolbar}
        />
      )}
    </AnimatePresence>
  )
}
