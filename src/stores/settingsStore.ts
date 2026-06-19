import { create } from 'zustand'
import type { AppSettings, PopupSettings } from '@/types/models'
import { DEFAULT_APP_SETTINGS, DEFAULT_POPUP_SETTINGS } from '@/types/models'

interface SettingsState {
  app: AppSettings
  popup: PopupSettings
  shortcut: string
  showWindowShortcut: string
  isPaused: boolean
  /** 最近一次加载/写盘错误（用于 toast 提示） */
  error: string | null

  loadSettings: () => Promise<void>
  updateApp: (updates: Partial<AppSettings>) => Promise<void>
  updatePopup: (updates: Partial<PopupSettings>) => Promise<void>
  updateShortcut: (key: 'shortcut' | 'showWindowShortcut', value: string) => Promise<void>
  setPaused: (paused: boolean) => Promise<void>
  clearError: () => void
}

/**
 * 数值守卫：store.get 返回 any（electron-store schema 不深入校验字段类型），
 * 若本地文件被破坏（如 minTriggerLength: "abc"），强转 number 会得 NaN，
 * 导致 < NaN 比较为 false，划词功能静默失效。这里拒绝非有限数，回退默认值。
 */
function safeInt(v: unknown, fallback: number, min = 1, max = 9999): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  app: DEFAULT_APP_SETTINGS,
  popup: DEFAULT_POPUP_SETTINGS,
  shortcut: 'Ctrl+Shift+Q',
  showWindowShortcut: 'Ctrl+Shift+H',
  isPaused: false,
  error: null,

  loadSettings: async () => {
    const api = window.electronAPI
    if (!api) return

    try {
      const [app, popup, shortcut, showKey, paused] = await Promise.all([
        api.store.get('settings') as Promise<AppSettings | undefined>,
        api.store.get('popupSettings') as Promise<PopupSettings | undefined>,
        api.store.get('shortcut') as Promise<string | undefined>,
        api.store.get('showWindowShortcut') as Promise<string | undefined>,
        api.store.get('_paused') as Promise<boolean | undefined>,
      ])

      const mergedApp: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...(app || {}),
        // 数值字段单独校验
        minTriggerLength: safeInt((app as any)?.minTriggerLength, DEFAULT_APP_SETTINGS.minTriggerLength, 1, 9999),
        historyRetentionDays: safeInt(
          (app as any)?.historyRetentionDays,
          DEFAULT_APP_SETTINGS.historyRetentionDays,
          1,
          365,
        ) as AppSettings['historyRetentionDays'],
      }
      const mergedPopup: PopupSettings = {
        ...DEFAULT_POPUP_SETTINGS,
        ...(popup || {}),
        width: safeInt((popup as any)?.width, DEFAULT_POPUP_SETTINGS.width, 180, 720),
        maxHeight: safeInt((popup as any)?.maxHeight, DEFAULT_POPUP_SETTINGS.maxHeight, 200, 2000),
        cornerRadius: safeInt((popup as any)?.cornerRadius, DEFAULT_POPUP_SETTINGS.cornerRadius, 0, 100),
        iconSize: safeInt((popup as any)?.iconSize, DEFAULT_POPUP_SETTINGS.iconSize, 12, 64),
        offsetX: safeInt((popup as any)?.offsetX, 0, -200, 200),
        offsetY: safeInt((popup as any)?.offsetY, DEFAULT_POPUP_SETTINGS.offsetY, -200, 200),
        animationDurationMs: safeInt((popup as any)?.animationDurationMs, 200, 0, 2000),
        autoHideSeconds: safeInt((popup as any)?.autoHideSeconds, 5, 1, 600),
      }
      set({
        app: mergedApp,
        popup: mergedPopup,
        shortcut: typeof shortcut === 'string' && shortcut ? shortcut : 'Ctrl+Shift+Q',
        showWindowShortcut: typeof showKey === 'string' && showKey ? showKey : 'Ctrl+Shift+H',
        isPaused: Boolean(paused),
        error: null,
      })
    } catch (err: any) {
      set({ error: err?.message || '加载设置失败' })
    }
  },

  updateApp: async (updates) => {
    const api = window.electronAPI
    if (!api) return
    const newApp = { ...get().app, ...updates }
    set({ app: newApp })
    await api.store.set('settings', newApp)
  },

  updatePopup: async (updates) => {
    const api = window.electronAPI
    const newPopup = { ...get().popup, ...updates }
    set({ popup: newPopup })
    if (api) await api.store.set('popupSettings', newPopup)
  },

  updateShortcut: async (key, value) => {
    const api = window.electronAPI
    if (!api) return
    set({ [key]: value })
    await api.store.set(key, value)
  },

  setPaused: async (paused) => {
    const api = window.electronAPI
    if (!api) return
    set({ isPaused: paused })
    const result = await api.store.set('_paused', paused)
    if (!result?.ok) set({ error: result?.error || '保存失败' })
  },

  clearError: () => set({ error: null }),
}))
