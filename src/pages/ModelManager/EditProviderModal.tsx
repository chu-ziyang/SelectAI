import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Eye, EyeOff, Loader2, Save, X, XCircle } from 'lucide-react'
import type { ProviderConfig } from '@/types/models'
import { useModelStore } from '@/stores/modelStore'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n/useI18n'
import ProviderIcon from '@/components/ProviderIcon'

interface Props {
  provider: ProviderConfig | null
  open: boolean
  onClose: () => void
}

export default function EditProviderModal({ provider, open, onClose }: Props) {
  const { t } = useI18n()
  const { updateProvider } = useModelStore()
  const { addToast } = useToast()

  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (!provider || !open) return
    setName(provider.name)
    setBaseUrl(provider.baseUrl)
    setApiKey('')
    setShowKey(false)
    setIsSaving(false)
    setIsTesting(false)
    setTestResult(null)
  }, [provider, open])

  if (!open || !provider) return null

  const handleTest = async () => {
    if (!apiKey.trim()) { addToast('warning', t('provider.testNeedKey')); return }
    setIsTesting(true)
    setTestResult(null)
    const result = await window.electronAPI?.provider.testConfig({
      type: provider.type,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
    })
    setIsTesting(false)
    setTestResult(result?.ok ? { ok: true } : { ok: false, error: result?.error || '连接失败' })
  }

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim()) { addToast('warning', t('provider.fillRequired')); return }
    setIsSaving(true)
    const result = await updateProvider(provider.id, {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim() || undefined,
    })
    setIsSaving(false)
    if (result.ok) { addToast('success', t('provider.saved')); onClose() }
    else { addToast('error', result.error || t('provider.saveFailed')) }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[480px] overflow-hidden rounded-2xl border border-[var(--separator)] bg-white/95 shadow-ios-xl backdrop-blur-xl spring-in dark:bg-[var(--bg-secondary)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--separator)] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderIcon type={provider.type || 'custom'} size="md" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{t('provider.editTitle')}</h3>
              <p className="truncate text-xs text-[var(--text-secondary)]">{provider.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--fill-tertiary)]"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.displayName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field-surface w-full" placeholder={t('provider.namePlaceholder')} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.replaceKey')} <span className="text-xs text-[var(--text-tertiary)]">（{t('provider.keyHint')}）</span></label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="field-surface w-full pr-10" placeholder={t('provider.keyPlaceholder')} />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 transition-colors hover:bg-[var(--fill-tertiary)]">
                {showKey ? <EyeOff size={16} className="text-[var(--text-tertiary)]" /> : <Eye size={16} className="text-[var(--text-tertiary)]" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.apiAddress')}</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="field-surface w-full font-mono" placeholder="https://api.example.com/v1" />
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${testResult.ok ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'}`}>
              {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{testResult.ok ? t('provider.newConfigOk') : testResult.error || '连接失败'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--separator)] px-6 py-4">
          <button onClick={handleTest} disabled={isTesting || !apiKey.trim()} className="toolbar-button-muted">
            {isTesting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t('provider.testNewKey')}
          </button>
          <button onClick={handleSave} disabled={isSaving || !name.trim() || !baseUrl.trim()} className="toolbar-button-primary">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('provider.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
