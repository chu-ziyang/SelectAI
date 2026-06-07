import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const contentWidth = actions.reduce((sum, action) => {
    if (isIconOnly) return sum + 30
    return sum + Math.max(52, Math.min(120, action.name.length * 14 + 38))
  }, 8)
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
      setNotice('')
      void cancel()
      void window.electronAPI?.popup?.setFocusLock(false)
      clearForToolbar(payload.id, payload.text)
      void (async () => {
        await window.electronAPI?.popup?.resize(toolbarWidth, toolbarHeight)
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
        if (pendingPayloadIdRef.current === payload.id) {
          await window.electronAPI?.popup?.present()
        }
      })()
    })
    void window.electronAPI?.popup.ready()
    return dispose
  }, [cancel, clearForToolbar, toolbarWidth, toolbarHeight])

  useEffect(() => window.electronAPI?.popup.onStoreUpdated((event) => {
    if (event.key === 'actions') void loadActions()
    if (event.key === 'providers') void loadProviders()
    if (event.key === 'settings' || event.key === 'popupSettings') void loadSettings()
  }), [loadActions, loadProviders, loadSettings])

  useEffect(() => window.electronAPI?.popup.onHidden(() => {
    void cancel()
    hide()
  }), [cancel, hide])

  useEffect(() => {
    if (session.status === 'toolbar') {
      void window.electronAPI?.popup?.resize(toolbarWidth, toolbarHeight)
    } else if (visible) {
      void window.electronAPI?.popup?.resize(fixedResultBounds.width, fixedResultBounds.height)
    }
  }, [session.status, visible, toolbarWidth, toolbarHeight, fixedResultBounds.width, fixedResultBounds.height])

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
    void window.electronAPI?.popup?.hide()
  }, [cancel, hide])

  useEffect(() => window.electronAPI?.popup.onRequestClose(closePopup), [closePopup])

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
