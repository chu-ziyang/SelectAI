import { create } from 'zustand'
import type { ActionConfig } from '@/types/models'
import { PRESET_ACTIONS } from '@/types/models'

interface ActionState {
  actions: ActionConfig[]
  isLoading: boolean

  loadActions: () => Promise<void>
  addAction: (action: Omit<ActionConfig, 'id' | 'order'>) => Promise<void>
  removeAction: (id: string) => Promise<void>
  updateAction: (id: string, updates: Partial<ActionConfig>) => Promise<void>
  toggleAction: (id: string, enabled: boolean) => Promise<void>
  reorderActions: (fromIndex: number, toIndex: number) => Promise<void>
  moveAction: (id: string, toIndex: number, targetEnabled: boolean) => Promise<void>
  resetDefaults: () => Promise<void>
}

let actionIdCounter = Date.now()

export const useActionStore = create<ActionState>((set, get) => ({
  actions: [],
  isLoading: false,

  loadActions: async () => {
    set({ isLoading: true })
    const api = window.electronAPI
    if (!api) {
      // 无 Electron 环境时使用预置默认
      const defaults: ActionConfig[] = PRESET_ACTIONS.map((a, i) => ({
        ...a,
        id: `a_default_${i}`,
        order: i,
      }))
      set({ actions: defaults, isLoading: false })
      return
    }

    try {
      const saved = await api.store.get('actions') as ActionConfig[] | undefined
      if (saved && saved.length > 0) {
        set({ actions: saved, isLoading: false })
      } else {
        // 首次使用，写入预置
        const defaults: ActionConfig[] = PRESET_ACTIONS.map((a, i) => ({
          ...a,
          id: `a_${actionIdCounter++}`,
          order: i,
        }))
        await api.store.set('actions', defaults)
        set({ actions: defaults, isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  addAction: async (action) => {
    const newAction: ActionConfig = {
      ...action,
      id: `a_${actionIdCounter++}`,
      order: get().actions.length,
    }
    const updated = [...get().actions, newAction]
    set({ actions: updated })

    const api = window.electronAPI
    if (api) await api.store.set('actions', updated)
  },

  removeAction: async (id) => {
    const action = get().actions.find((a) => a.id === id)
    if (action?.type === 'preset') return // 不能删除预置

    const updated = get().actions.filter((a) => a.id !== id)
    set({ actions: updated })

    const api = window.electronAPI
    if (api) await api.store.set('actions', updated)
  },

  updateAction: async (id, updates) => {
    const updated = get().actions.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    )
    set({ actions: updated })

    const api = window.electronAPI
    if (api) await api.store.set('actions', updated)
  },

  toggleAction: async (id, enabled) => {
    await get().updateAction(id, { enabled })
  },

  reorderActions: async (fromIndex, toIndex) => {
    const actions = [...get().actions]
    const enabled = actions.filter((a) => a.enabled).sort((a, b) => a.order - b.order)
    const disabled = actions.filter((a) => !a.enabled)

    const [moved] = enabled.splice(fromIndex, 1)
    enabled.splice(toIndex, 0, moved)

    const reordered = [
      ...enabled.map((a, i) => ({ ...a, order: i })),
      ...disabled,
    ]

    set({ actions: reordered })

    const api = window.electronAPI
    if (api) await api.store.set('actions', reordered)
  },

  /**
   * 跨区移动：toIndex 是合并列表中的目标位置，targetEnabled 是目标区段。
   * 同步重排 order：启用区按 0..N-1 排，禁用区排在 N 之后。
   */
  moveAction: async (id: string, toIndex: number, targetEnabled: boolean) => {
    const all = [...get().actions]
    const fromIndex = all.findIndex((a) => a.id === id)
    if (fromIndex < 0) return
    const [moved] = all.splice(fromIndex, 1)
    const adjusted = toIndex > fromIndex ? toIndex - 1 : toIndex
    const insertIndex = Math.max(0, Math.min(adjusted, all.length))
    all.splice(insertIndex, 0, { ...moved, enabled: targetEnabled })

    // 重新计算 order：启用区优先，按当前顺序 0..N-1
    let order = 0
    const reordered: ActionConfig[] = []
    for (const a of all) {
      if (a.enabled) {
        reordered.push({ ...a, order: order++ })
      }
    }
    for (const a of all) {
      if (!a.enabled) {
        reordered.push({ ...a, order: order++ })
      }
    }

    set({ actions: reordered })

    const api = window.electronAPI
    if (api) await api.store.set('actions', reordered)
  },

  resetDefaults: async () => {
    const defaults: ActionConfig[] = PRESET_ACTIONS.map((a, i) => ({
      ...a,
      id: `a_${actionIdCounter++}`,
      order: i,
    }))
    set({ actions: defaults })

    const api = window.electronAPI
    if (api) await api.store.set('actions', defaults)
  },
}))
