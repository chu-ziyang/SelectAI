import { useSettingsStore } from '@/stores/settingsStore'
import type { Lang } from './translations'
import { translations } from './translations'

export function useI18n() {
  const lang = (useSettingsStore((s) => s.app.language) || 'zh-CN') as Lang

  const tr = (key: string, replacements?: Record<string, string>): string => {
    let text = translations[key]?.[lang] ?? translations[key]?.['zh-CN'] ?? key
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v)
      })
    }
    return text
  }

  return { lang, t: tr }
}
