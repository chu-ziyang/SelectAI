import { useSettingsStore } from '@/stores/settingsStore'
import { useI18n } from '@/i18n/useI18n'
import { Palette, Minus, Plus } from 'lucide-react'
import SelectMenu from '@/components/SelectMenu'

const FONT_SCALES = ['small', 'medium', 'large', 'xl', 'xxl', 'xxxl'] as const
const FONT_LABELS: Record<string, string> = {
  small: 'appearance.fontSmall', medium: 'appearance.fontMedium', large: 'appearance.fontLarge',
  xl: 'appearance.fontXL', xxl: 'appearance.fontXXL', xxxl: 'appearance.fontXXXL',
}

export default function AppearanceSettings() {
  const { t } = useI18n()
  const { app, updateApp, popup, updatePopup } = useSettingsStore()

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Palette size={16} className="text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{t('appearance.theme')}</h3>
      </div>

      {/* 主题 */}
      <div className="settings-section mb-4 p-4">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{t('appearance.themeMode')}</p>
        <div className="segmented w-full">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateApp({ theme: mode })}
              className={`segmented-item flex-1 ${
                app.theme === mode
                  ? 'segmented-item-active'
                  : ''
              }`}
            >
              {{ light: t('appearance.light'), dark: t('appearance.dark'), system: t('appearance.system') }[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* 弹窗风格 */}
      <div className="settings-section">
        <p className="border-b border-[var(--separator)] px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{t('appearance.popupStyle')}</p>

        <div>
          {([
            { key: 'showButtonBackground' as const, labelKey: 'appearance.buttonBg' },
            { key: 'showHoverEffect' as const, labelKey: 'appearance.hoverEffect' },
          ]).map(({ key, labelKey }) => (
            <div key={key} className="setting-row">
              <span className="text-sm text-[var(--text-primary)]">{t(labelKey)}</span>
              <button
                onClick={() => updatePopup({ [key]: !popup[key] })}
                className={`switch-track ${popup[key] ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'}`}
              >
                <div className={`switch-thumb ${popup[key] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}

          <div className="setting-row">
            <span className="text-sm text-[var(--text-primary)]">{t('appearance.fontSize')}</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  const idx = FONT_SCALES.indexOf(app.fontScale)
                  if (idx > 0) updateApp({ fontScale: FONT_SCALES[idx - 1] } as any)
                }}
                disabled={app.fontScale === 'small'}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--separator)] hover:bg-[var(--fill-tertiary)] disabled:opacity-30 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-[44px] text-center text-sm font-semibold text-[#007AFF]">
                {t(FONT_LABELS[app.fontScale])}
              </span>
              <button
                onClick={() => {
                  const idx = FONT_SCALES.indexOf(app.fontScale)
                  if (idx < FONT_SCALES.length - 1) updateApp({ fontScale: FONT_SCALES[idx + 1] } as any)
                }}
                disabled={app.fontScale === 'xxxl'}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--separator)] hover:bg-[var(--fill-tertiary)] disabled:opacity-30 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="setting-row">
            <span className="text-sm text-[var(--text-primary)]">{t('appearance.fontFamily')}</span>
            <SelectMenu
              value={app.fontFamily}
              options={[
                { value: 'system', label: t('appearance.fontSystem') },
                { value: 'pingfang', label: t('appearance.fontPingfang') },
                { value: 'yahei', label: t('appearance.fontYahei') },
              ]}
              onChange={(fontFamily) => updateApp({ fontFamily })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
