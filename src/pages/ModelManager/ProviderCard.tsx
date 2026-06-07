import { useState } from 'react'
import {
  Trash2, Loader2, RefreshCw, CheckCircle2,
  ChevronDown, ChevronRight, Pencil,
} from 'lucide-react'
import type { ModelConfig, ProviderConfig } from '@/types/models'
import { useModelStore } from '@/stores/modelStore'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n/useI18n'
import ProviderIcon from '@/components/ProviderIcon'
import ConfirmDialog from '@/components/ConfirmDialog'
import ModelRow from './ModelRow'
import EditProviderModal from './EditProviderModal'

interface Props {
  provider: ProviderConfig
}

export default function ProviderCard({ provider }: Props) {
  const { t } = useI18n()
  const { removeProvider, testConnection, fetchModels, updateModel, setDefaultModel } = useModelStore()
  const testingId = useModelStore((s) => s.testingId)
  const loadingModels = useModelStore((s) => s.loadingModels)
  const { addToast } = useToast()

  const [expanded, setExpanded] = useState(true)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isTesting = testingId === provider.id
  const isLoading = loadingModels[provider.id]

  const models = provider.models || []
  const enabledCount = models.filter((m) => m.enabled).length

  const handleDelete = async () => {
    await removeProvider(provider.id)
    addToast('success', t('provider.deleted', { name: provider.name }))
  }

  const handleTest = async () => {
    setTestResult(null)
    const result = await testConnection(provider.id)
    setTestResult(result)
  }

  const handleRefreshModels = async () => {
    const result = await fetchModels(provider.id)
    if (result.ok) {
      setExpanded(true)
      addToast('success', `${t('provider.modelsUpdated')}${typeof result.count === 'number' ? `：${result.count}` : ''}`)
    } else {
      addToast('error', result.error || t('provider.modelsFetchFailed'))
    }
  }

  const handleToggleModel = async (model: ModelConfig, enabled: boolean) => {
    if (model.isDefault && !enabled) {
      addToast('warning', t('provider.cantDisableDefault'))
      return
    }
    const result = await updateModel(provider.id, model.id, { enabled })
    if (!result.ok) addToast('error', result.error || t('provider.updateModelFailed'))
  }


  return (
    <div className="panel-soft overflow-hidden">
      {/* 卡片头部 */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-80"
        >
          <span>
            {expanded ? <ChevronDown size={16} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={16} className="text-[var(--text-tertiary)]" />}
          </span>
          <ProviderIcon type={provider.type || 'custom'} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-[var(--text-primary)]">{provider.name}</h4>
              <span className="rounded-full bg-[var(--fill-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {models.length ? `${enabledCount}/${models.length} ${t('models.enabledCount')}` : t('models.noModels')}
              </span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tertiary)] hover:text-[var(--text-primary)]"
            title={t('models.editService')}
          >
            <Pencil size={14} />
            {t('models.editService')}
          </button>
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            title={t('provider.test')}
          >
            {isTesting ? <Loader2 size={14} className="animate-spin text-[#007AFF]" /> : <CheckCircle2 size={14} />}
            {t('provider.test')}
          </button>
          <button
            onClick={handleRefreshModels}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#007AFF] transition-colors hover:bg-[#007AFF]/10 disabled:opacity-50"
            title={t('provider.fetchModels')}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t('provider.fetchModels')}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
            title={t('provider.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>


      {/* 模型列表 */}
      {expanded && (
        <div className="px-6 pb-5">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 skeleton" />
              ))}
            </div>
          ) : models.length > 0 ? (
            <table className="w-full table-fixed overflow-hidden rounded-xl">
              <thead>
                <tr className="border-b border-[var(--separator)] text-xs text-[var(--text-tertiary)]">
                  <th className="w-[46%] px-3 py-2 text-left font-medium">{t('models.model')}</th>
                  <th className="w-[22%] px-3 py-2 text-left font-medium">{t('models.status')}</th>
                  <th className="w-[20%] px-3 py-2 text-left font-medium">{t('models.default')}</th>
                  <th className="w-[12%] px-3 py-2 text-center font-medium">{t('models.reasoning')}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    isDefault={model.isDefault}
                    testResult={testResult}
                    onToggle={(enabled) => handleToggleModel(model, enabled)}
                    onSetDefault={() => setDefaultModel(provider.id, model.id)}
                    onToggleReasoning={(isReasoning) => updateModel(provider.id, model.id, { isReasoning })}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--separator)] bg-[var(--bg-primary)] px-4 py-5 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t('models.noModelsYet')}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('models.noModelsHint')}</p>
              <button onClick={handleRefreshModels} disabled={isLoading} className="toolbar-button-primary mt-3 py-1.5 text-xs">
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t('provider.fetchModels')}
              </button>
            </div>
          )}
        </div>
      )}

      <EditProviderModal provider={provider} open={editing} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={confirmingDelete}
        danger
        title={t('provider.delete')}
        message={t('provider.deleteConfirm', { name: provider.name })}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setConfirmingDelete(false)
          await handleDelete()
        }}
      />
    </div>
  )
}
