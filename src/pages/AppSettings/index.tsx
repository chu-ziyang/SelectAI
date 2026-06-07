import { useSettingsStore } from '@/stores/settingsStore'
import { useI18n } from '@/i18n/useI18n'
import GeneralSettings from './GeneralSettings'
import AppearanceSettings from './AppearanceSettings'
import DataSettings from './DataSettings'
import AboutSettings from './AboutSettings'

export default function AppSettings() {
  const { t } = useI18n()

  const TABS = [
    { key: 'general', label: t('settings.general') },
    { key: 'appearance', label: t('settings.appearance') },
    { key: 'data', label: t('settings.data') },
    { key: 'about', label: t('settings.about') },
  ]

  // 从 URL hash 读取当前子标签
  const hash = window.location.hash
  const activeTab = hash.includes('/settings/') ? hash.split('/settings/')[1]?.split('?')[0] || 'general' : 'general'

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">{t('settings.title')}</h2>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-[760px]">
        <div className="segmented mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                window.location.hash = `/settings/${tab.key}`
              }}
              className={`segmented-item px-4 ${
                activeTab === tab.key
                  ? 'segmented-item-active'
                  : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="min-w-0">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'data' && <DataSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </section>
      </div>
    </div>
  )
}
