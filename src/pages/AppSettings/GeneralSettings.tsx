import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useI18n } from '@/i18n/useI18n'
import SelectMenu from '@/components/SelectMenu'

function ShortcutRecorder({ label, desc, value, onSave }: { label: string; desc: string; value: string; onSave: (v: string) => void }) {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [keys, setKeys] = useState<string[]>([])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const parts: string[] = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    if (e.metaKey) parts.push('Win')
    const key = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta' ? '' : e.key.toUpperCase()
    if (key) parts.push(key)
    if (parts.length >= 2) {
      onSave(parts.join('+'))
      setRecording(false)
    }
  }

  return (
    <div className="setting-row">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => { setRecording(true); setKeys([]) }}
        onKeyDown={recording ? handleKeyDown : undefined}
        className={`min-w-[120px] rounded-lg border px-3 py-1.5 text-center font-mono text-xs font-medium transition-all ${
          recording
            ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]/20'
            : 'border-[var(--separator)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
        }`}
      >
        {recording ? (keys.length > 0 ? keys.join('+') : t('general.pressCombo')) : value}
      </button>
    </div>
  )
}

export default function GeneralSettings() {
  const { t } = useI18n()
  const { app, updateApp, shortcut, showWindowShortcut, updateShortcut } = useSettingsStore()

  const Toggle = ({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="setting-row">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)} className={`switch-track ${value ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'}`}>
        <div className={`switch-thumb ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )

  return (
    <div>
      <h3 className="settings-heading">{t('general.startup')}</h3>
      <div className="settings-section">
        <Toggle label={t('general.autoStart')} desc={t('general.autoStartDesc')} value={app.autoStart} onChange={(v) => updateApp({ autoStart: v })} />
        <Toggle label={t('general.startMinimized')} desc={t('general.startMinimizedDesc')} value={app.startMinimized} onChange={(v) => updateApp({ startMinimized: v })} />
        <Toggle label={t('general.closeToTray')} desc={t('general.closeToTrayDesc')} value={app.closeToTray} onChange={(v) => updateApp({ closeToTray: v })} />
      </div>

      <h3 className="settings-heading mt-6">{t('general.selection')}</h3>
      <div className="settings-section">
        <Toggle label={t('general.autoPopup')} desc={t('general.autoPopupDesc')} value={app.autoPopup} onChange={(v) => updateApp({ autoPopup: v })} />
        <Toggle label={t('general.ctrlHoldPopup')} desc={t('general.ctrlHoldPopupDesc')} value={app.ctrlHoldPopup} onChange={(v) => updateApp({ ctrlHoldPopup: v })} />
        <Toggle label={t('general.clipboard')} desc={t('general.clipboardDesc')} value={app.clipboardTrigger} onChange={(v) => updateApp({ clipboardTrigger: v })} />
        <div className="setting-row">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('general.minLength')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('general.minLengthDesc')}</p>
          </div>
          <input
            type="number"
            min={1} max={20}
            value={app.minTriggerLength}
            onChange={(e) => updateApp({ minTriggerLength: parseInt(e.target.value) || 3 })}
            className="field-surface w-16 text-center"
          />
        </div>
      </div>

      <h3 className="settings-heading mt-6">{t('general.language')}</h3>
      <div className="settings-section">
        <div className="setting-row">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('general.uiLanguage')}</p>
          <SelectMenu
            value={app.language}
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en-US', label: 'English' },
            ]}
            onChange={(language) => updateApp({ language })}
          />
        </div>
      </div>

      <h3 className="settings-heading mt-6">{t('general.shortcuts')}</h3>
      <div className="settings-section">
        <ShortcutRecorder label={t('general.popupShortcut')} desc={t('general.popupShortcutDesc')} value={shortcut} onSave={(v) => updateShortcut('shortcut', v)} />
        <ShortcutRecorder label={t('general.windowShortcut')} desc={t('general.windowShortcutDesc')} value={showWindowShortcut} onSave={(v) => updateShortcut('showWindowShortcut', v)} />
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mt-3 px-1">
        {t('general.shortcutHint')}
      </p>
    </div>
  )
}
