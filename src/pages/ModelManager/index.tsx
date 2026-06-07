import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Layers3, Plus, Server, ShieldCheck } from 'lucide-react'
import { useModelStore } from '@/stores/modelStore'
import { useI18n } from '@/i18n/useI18n'
import EmptyState from '@/components/EmptyState'
import ProviderCard from './ProviderCard'
import AddProviderModal from './AddProviderModal'

export default function ModelManager() {
  const { t } = useI18n()
  const { providers, isLoading, error, loadProviders, clearError } = useModelStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const totalModels = providers.reduce((sum, provider) => sum + (provider.models?.length || 0), 0)
  const enabledModels = providers.reduce((sum, provider) => sum + (provider.models || []).filter((model) => model.enabled).length, 0)
  const defaultModel = providers.flatMap((provider) => provider.models || []).find((model) => model.isDefault && model.enabled)

  return (
    <div className="page-shell">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2 className="page-title">{t('models.title')}</h2>
          <p className="page-subtitle">
            {t('models.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="toolbar-button-primary no-drag"
        >
          <Plus size={16} />
          {t('models.addKey')}
        </button>
      </div>

      {!isLoading && providers.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="panel-soft flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Server size={17} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">{t('models.service')}</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{providers.length}</p>
            </div>
          </div>
          <div className="panel-soft flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#34C759]/10 text-[#34C759]">
              <Layers3 size={17} />
            </span>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">{t('models.availableModels')}</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{enabledModels}<span className="text-xs font-medium text-[var(--text-tertiary)]"> / {totalModels}</span></p>
            </div>
          </div>
          <div className="panel-soft flex items-center gap-3 px-4 py-3">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${defaultModel ? 'bg-[#5856D6]/10 text-[#5856D6]' : 'bg-[#FF9500]/10 text-[#FF9500]'}`}>
              {defaultModel ? <ShieldCheck size={17} /> : <AlertCircle size={17} />}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-secondary)]">{t('models.defaultModel')}</p>
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{defaultModel?.displayName || t('models.notSet')}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-4 py-3 text-sm text-[#FF3B30]">
          <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
          <button onClick={clearError} className="rounded-lg px-2 py-1 text-xs hover:bg-[#FF3B30]/10">{t('common.close')}</button>
        </div>
      )}

      {/* 加载态 */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && providers.length === 0 && (
        <EmptyState
          icon={<Server size={28} className="text-[var(--text-tertiary)]" />}
          title={t('models.emptyTitle')}
          description={t('models.emptyDesc')}
          action={
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#007AFF] text-white text-sm font-medium rounded-xl hover:bg-[#0066D6] active:scale-95 transition-all shadow-ios-sm"
            >
              {t('models.addKey')}
            </button>
          }
        />
      )}

      {!isLoading && providers.length > 0 && totalModels === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#007AFF]" />
          <div>
            <p className="font-medium">{t('models.nextStep')}</p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t('models.nextStepHint')}</p>
          </div>
        </div>
      )}

      {/* 服务卡片列表 */}
      {!isLoading && providers.length > 0 && (
        <div className="space-y-4">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}

      {/* 添加弹窗 */}
      <AddProviderModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
