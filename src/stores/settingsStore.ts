import { create } from 'zustand'
import type { AppSettings, PopupSettings } from '@/types/models'
import { DEFAULT_APP_SETTINGS, DEFAULT_POPUP_SETTINGS } from '@/types/models'

interface SettingsState {
  app: AppSettings
  popup: PopupSettings
  shortcut: string
  showWindowShortcut: string
  isPaused: boolean

  loadSettings: () => Promise<void>
  updateApp: (updates: Partial<AppSettings>) => Promise<void>
  updatePopup: (updates: Partial<PopupSettings>) => Promise<void>
  updateShortcut: (key: 'shortcut' | 'showWindowShortcut', value: string) => Promise<void>
  setPaused: (paused: boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  app: DEFAULT_APP_SETTINGS,
  popup: DEFAULT_POPUP_SETTINGS,
  shortcut: 'Ctrl+Shift+Q',
  showWindowShortcut: 'Ctrl+Shift+H',
  isPaused: false,

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

      set({
        app: { ...DEFAULT_APP_SETTINGS, ...app },
        popup: { ...DEFAULT_POPUP_SETTINGS, ...popup },
        shortcut: shortcut || 'Ctrl+Shift+Q',
        showWindowShortcut: showKey || 'Ctrl+Shift+H',
        isPaused: paused || false,
      })
    } catch { /* ignore */ }
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
    await api.store.set('_paused', paused)
  },
}))
