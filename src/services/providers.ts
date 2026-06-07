/**
 * Provider Adapter 层
 * 封装各厂商 API 差异，统一对外接口
 */

export interface ProviderAdapter {
  /** 测试连接 */
  test: (providerId: string) => Promise<{ ok: boolean; error?: string }>
  /** 拉取模型列表 */
  fetchModels: (providerId: string) => Promise<{ ok: boolean; models?: Array<{ id: string; displayName: string }>; error?: string }>
}

/**
 * 通用 adapter —— 所有 OpenAI 兼容厂商共用
 */
export function createOpenAIAdapter(): ProviderAdapter {
  return {
    test: async (providerId: string) => {
      const api = window.electronAPI
      if (!api) return { ok: false, error: 'Electron API 不可用' }
      return api.provider.test(providerId) as Promise<{ ok: boolean; error?: string }>
    },
    fetchModels: async (providerId: string) => {
      const api = window.electronAPI
      if (!api) return { ok: false, error: 'Electron API 不可用' }
      const result = await api.provider.test(providerId) as any
      if (!result.ok) return { ok: false, error: result.error }
      return { ok: true, models: result.models || [] }
    },
  }
}

/**
 * 获取 adapter 实例（单例）
 */
let adapterInstance: ProviderAdapter | null = null

export function getProviderAdapter(): ProviderAdapter {
  if (!adapterInstance) adapterInstance = createOpenAIAdapter()
  return adapterInstance
}
