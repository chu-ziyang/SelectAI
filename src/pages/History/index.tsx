import { useState, useEffect, useMemo } from 'react'
import { Search, Copy, Check, Trash2, FileText } from 'lucide-react'
import type { HistoryRecord } from '@/types/models'
import { useActionStore } from '@/stores/actionStore'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n/useI18n'
import SelectMenu from '@/components/SelectMenu'

export default function HistoryPage() {
  const { t } = useI18n()
  const { actions } = useActionStore()
  const { addToast } = useToast()
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const api = window.electronAPI
    if (!api) return
    const data = (await api.store.get('history') || []) as HistoryRecord[]
    setRecords(data.slice().reverse())
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    addToast('success', t('history.copied'))
  }

  const handleDelete = async (id: string) => {
    const api = window.electronAPI
    if (!api) return
    const stored = ((await api.store.get('history')) || []) as HistoryRecord[]
    const updated = stored.filter((r) => r.id !== id)
    setRecords(updated.slice().reverse())
    await api.store.set('history', updated)
    addToast('success', t('history.deleted'))
  }

  const handleClearAll = async () => {
    if (!confirm(t('history.clearConfirm'))) return
    const api = window.electronAPI
    if (!api) return
    await api.store.set('history', [])
    setRecords([])
    setSelectedRecord(null)
    addToast('success', t('history.cleared'))
  }

  const filtered = records.filter((r) => {
    if (search && !r.selectedText.includes(search) && !r.resultText.includes(search)) return false
    if (actionFilter && r.actionName !== actionFilter) return false
    return true
  })

  const allActions = useMemo(
    () => [...new Set(actions.map((a) => a.name))],
    [actions],
  )
  const activeRecord = selectedRecord && filtered.some((r) => r.id === selectedRecord.id)
    ? selectedRecord
    : filtered[0]

  if (records.length === 0) {
    return (
      <div className="page-shell">
        <h2 className="page-title mb-1">{t('history.title')}</h2>
        <p className="page-subtitle">{t('history.subtitle')}</p>
        <div className="panel mt-6 flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[var(--fill-tertiary)] flex items-center justify-center mb-4">
            <Search size={28} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-base font-medium text-[var(--text-secondary)] mb-1">{t('history.emptyTitle')}</h3>
          <p className="text-sm text-[var(--text-tertiary)]">{t('history.emptyDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell flex h-full flex-col">
      <div className="mb-3">
        <h2 className="page-title">{t('history.title')}</h2>
        <p className="page-subtitle">{t('history.subtitle')}</p>
      </div>

      {/* 搜索 + 筛选 + 清空 —— 顶部一行 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="field-surface w-full pl-9 h-[34px] py-0 text-[13px]"
          />
        </div>
        <SelectMenu
          value={actionFilter}
          options={[
            { value: '', label: t('history.allActions') },
            ...allActions.map((action) => ({ value: action, label: action })),
          ]}
          onChange={setActionFilter}
          className="w-[160px]"
        />
        <button
          onClick={handleClearAll}
          className="toolbar-button-muted text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] shrink-0"
        >
          <Trash2 size={13} />
          {t('history.clear')}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="panel min-h-0 overflow-hidden">
          <div className="max-h-full overflow-y-auto scrollbar-hidden p-2">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--text-tertiary)]">{t('history.noMatch')}</div>
            ) : filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecord(r)}
                className={`mb-2 w-full rounded-xl p-3 text-left transition-all last:mb-0 ${
                  activeRecord?.id === r.id ? 'bg-[#007AFF]/10 ring-1 ring-[#007AFF]/20' : 'hover:bg-[var(--fill-tertiary)]'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-[var(--fill-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--text-primary)]">
                    {r.actionName}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {new Date(r.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{r.selectedText}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="panel min-h-0 overflow-hidden">
          {activeRecord ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[var(--separator)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{activeRecord.actionName}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{activeRecord.modelId} · {activeRecord.latencyMs}ms</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(activeRecord.id)}
                  className="rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hidden p-5">
                <section className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[var(--text-secondary)]">{t('history.source')}</h3>
                    <button onClick={() => handleCopy(activeRecord.selectedText, `${activeRecord.id}_source`)} className="text-xs text-[#007AFF]">
                      {t('history.copy')}
                    </button>
                  </div>
                  <p className="break-words rounded-xl bg-[var(--bg-primary)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">{activeRecord.selectedText}</p>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[var(--text-secondary)]">{t('history.aiResult')}</h3>
                    <button onClick={() => handleCopy(activeRecord.resultText, activeRecord.id)} className="flex items-center gap-1 text-xs text-[#007AFF]">
                      {copiedId === activeRecord.id ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
                      {copiedId === activeRecord.id ? t('history.copied') : t('history.copy')}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-primary)] p-4 text-sm leading-relaxed text-[var(--text-primary)]">{activeRecord.resultText || activeRecord.errorMessage || t('history.noResult')}</p>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">{t('history.selectHint')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
