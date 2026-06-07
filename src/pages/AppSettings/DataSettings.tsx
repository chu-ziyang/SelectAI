import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useI18n } from '@/i18n/useI18n'
import { useToast } from '@/components/Toast'
import { Trash2, Download, Upload } from 'lucide-react'
import SelectMenu from '@/components/SelectMenu'

export default function DataSettings() {
  const { t } = useI18n()
  const { app, updateApp } = useSettingsStore()
  const { addToast } = useToast()

  const handleExport = async () => {
    const api = window.electronAPI
    if (!api) return
    const settings = await api.store.get('settings')
    const actions = await api.store.get('actions')
    const popup = await api.store.get('popupSettings')
    const json = JSON.stringify({ settings, actions, popupSettings: popup }, null, 2)

    // 触发下载
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `text-helper-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast('success', t('data.exported'))
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const api = window.electronAPI
        if (api) {
          if (data.settings) await api.store.set('settings', data.settings)
          if (data.actions) await api.store.set('actions', data.actions)
          if (data.popupSettings) await api.store.set('popupSettings', data.popupSettings)
          addToast('success', t('data.imported'))
        }
      } catch {
        addToast('error', t('data.invalidFile'))
      }
    }
    input.click()
  }

  const handleReset = async () => {
    if (!confirm(t('data.resetConfirm'))) return
    const api = window.electronAPI
    if (api) {
      await api.store.delete('settings')
      await api.store.delete('actions')
      await api.store.delete('popupSettings')
      await api.store.delete('providers')
      addToast('success', t('data.resetDone'))
    }
  }

  return (
    <div>
      <h3 className="settings-heading">{t('data.history')}</h3>
      <div className="settings-section">
        <div className="setting-row">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('data.saveHistory')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('data.saveHistoryDesc')}</p>
          </div>
          <button onClick={() => updateApp({ saveHistory: !app.saveHistory })} className={`switch-track ${app.saveHistory ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'}`}>
            <div className={`switch-thumb ${app.saveHistory ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('data.retention')}</p>
          </div>
          <SelectMenu<7 | 14 | 30 | 90>
            value={app.historyRetentionDays}
            options={[
              { value: 7, label: t('data.7days') },
              { value: 14, label: t('data.14days') },
              { value: 30, label: t('data.30days') },
              { value: 90, label: t('data.90days') },
            ]}
            onChange={(historyRetentionDays) => updateApp({ historyRetentionDays })}
          />
        </div>
      </div>

      <h3 className="settings-heading mt-6">{t('data.backup')}</h3>
      <div className="settings-section">
        <button onClick={handleExport} className="setting-row w-full text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tertiary)]">
          <span className="flex items-center gap-3">
          <Download size={16} className="text-[var(--text-secondary)]" />
          {t('data.export')}
          </span>
        </button>
        <button onClick={handleImport} className="setting-row w-full text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tertiary)]">
          <span className="flex items-center gap-3">
          <Upload size={16} className="text-[var(--text-secondary)]" />
          {t('data.import')}
          </span>
        </button>
        <button onClick={handleReset} className="setting-row w-full text-left text-sm text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/5">
          <span className="flex items-center gap-3">
          <Trash2 size={16} />
          {t('data.reset')}
          </span>
        </button>
      </div>
    </div>
  )
}
