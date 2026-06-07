import { create } from 'zustand'
import type { ProviderConfig, ModelConfig, ProviderType } from '@/types/models'

interface ModelState {
  // 状态
  providers: ProviderConfig[]
  isLoading: boolean
  testingId: string | null
  loadingModels: Record<string, boolean>
  bulkUpdatingId: string | null
  error: string | null

  // 操作
  loadProviders: () => Promise<void>
  addProvider: (params: {
    type: ProviderType
    name: string
    baseUrl: string
    apiKey: string
  }) => Promise<{ ok: boolean; error?: string }>
  updateProvider: (id: string, updates: {
    name?: string
    baseUrl?: string
    apiKey?: string
  }) => Promise<{ ok: boolean; error?: string }>
  removeProvider: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<{ ok: boolean; error?: string; latencyMs?: number }>
  fetchModels: (id: string) => Promise<{ ok: boolean; error?: string; count?: number }>
  updateModel: (providerId: string, modelId: string, updates: Partial<ModelConfig>) => Promise<{ ok: boolean; error?: string }>
  /** 批量更新同一厂商下的多个模型（启用/禁用/思考模式等） */
  bulkUpdateModels: (providerId: string, modelIds: string[], updates: Partial<ModelConfig>) => Promise<{ ok: boolean; count: number; error?: string }>
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>
  clearError: () => void
}

export const useModelStore = create<ModelState>((set, get) => ({
  providers: [],
  isLoading: false,
  testingId: null,
  loadingModels: {},
  bulkUpdatingId: null,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true })
    try {
      const api = window.electronAPI
      if (!api) {
        set({ isLoading: false, error: 'Electron API 不可用' })
        return
      }
      const providers = (await api.provider.list()) as ProviderConfig[]
      set({ providers: providers || [], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  addProvider: async (params) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }

    try {
      const result = (await api.provider.add(params)) as any
      if (result.ok) {
        await get().loadProviders()
        return { ok: true, provider: result.provider }
      }
      return { ok: false, error: result.error || '添加失败' }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  },

  updateProvider: async (id, updates) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }

    try {
      const payload = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => typeof value === 'string' ? value.trim() : value !== undefined),
      )
      const result = (await api.provider.update(id, payload)) as any
      if (result.ok) {
        await get().loadProviders()
        return { ok: true }
      }
      return { ok: false, error: result.error || '保存失败' }
    } catch (err: any) {
      return { ok: false, error: err.message || '保存失败' }
    }
  },

  removeProvider: async (id) => {
    const api = window.electronAPI
    if (!api) return
    await api.provider.remove(id)
    await get().loadProviders()
  },

  testConnection: async (id) => {
    set({ testingId: id })
    const api = window.electronAPI
    if (!api) {
      set({ testingId: null })
      return { ok: false, error: 'Electron API 不可用' }
    }

    try {
      const result = (await api.provider.test(id)) as any
      set({ testingId: null })
      return result
    } catch (err: any) {
      set({ testingId: null })
      return { ok: false, error: err.message }
    }
  },

  fetchModels: async (id) => {
    set((s) => ({ loadingModels: { ...s.loadingModels, [id]: true } }))
    const api = window.electronAPI
    if (!api) {
      set((s) => ({ loadingModels: { ...s.loadingModels, [id]: false } }))
      return { ok: false, error: 'Electron API 不可用' }
    }

    try {
      const result = (await api.provider.fetchModels(id)) as any
      if (result.ok) {
        await get().loadProviders()
      }
      set((s) => ({ loadingModels: { ...s.loadingModels, [id]: false } }))
      return { ...result, count: Array.isArray(result.models) ? result.models.length : undefined }
    } catch (err: any) {
      set((s) => ({ loadingModels: { ...s.loadingModels, [id]: false } }))
      return { ok: false, error: err.message || '获取模型失败' }
    }
  },

  updateModel: async (providerId, modelId, updates) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }
    // 乐观更新 —— 只动这一行 model，不重拉整表（避免 transition-all 闪屏）
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id !== providerId ? p : {
          ...p,
          models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)),
        },
      ),
    }))
    const result = await api.model.update(providerId, modelId, updates)
    if (!result.ok) {
      // 失败时回滚 + 拉一次保证和服务端一致
      set({ error: result.error || '更新失败' })
      await get().loadProviders()
    }
    return result
  },

  bulkUpdateModels: async (providerId, modelIds, updates) => {
    const api = window.electronAPI
    if (!api) return { ok: false, count: 0, error: 'Electron API 不可用' }
    if (modelIds.length === 0) return { ok: true, count: 0 }

    const idSet = new Set(modelIds)
    set({ bulkUpdatingId: providerId })
    // 乐观更新
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id !== providerId ? p : {
          ...p,
          models: p.models.map((m) => (idSet.has(m.id) ? { ...m, ...updates } : m)),
        },
      ),
    }))
    try {
      const results = await Promise.all(
        modelIds.map((id) => api.model.update(providerId, id, updates)),
      )
      const failed = results.find((r: any) => !r?.ok)
      if (failed) await get().loadProviders()
      if (failed) return { ok: false, count: 0, error: (failed as any).error || '部分更新失败' }
      return { ok: true, count: modelIds.length }
    } catch (err: any) {
      await get().loadProviders()
      return { ok: false, count: 0, error: err?.message || '批量更新失败' }
    } finally {
      set({ bulkUpdatingId: null })
    }
  },

  setDefaultModel: async (providerId, modelId) => {
    const { providers } = get()
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return
    // 本地乐观更新 —— 不再 loadProviders 全表重拉
    set({ providers: providers.map((p) => ({
      ...p,
      models: p.models.map((m) => ({
        ...m,
        isDefault: p.id === providerId && m.id === modelId,
      })),
    })) })
    const api = window.electronAPI
    if (!api) return
    const result = await api.model.update(providerId, modelId, { isDefault: true })
    if (!result.ok) {
      set({ error: result.error || '设置默认模型失败' })
      await get().loadProviders()
    }
  },

  clearError: () => set({ error: null }),
}))
