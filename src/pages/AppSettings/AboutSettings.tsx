import { Github, Heart } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'

export default function AboutSettings() {
  const { t } = useI18n()
  return (
    <div>
      {/* 品牌区 */}
      <div className="settings-section p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-ios-lg">
          <span className="text-3xl">✨</span>
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)]">划词助手</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">{t('about.tagline')}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-2 font-mono">v1.0.0</p>
      </div>

      {/* 开发者 */}
      <div className="settings-section mt-4">
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t('about.devTitle')}</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#5856D6]/20 flex items-center justify-center">
                <span className="text-lg font-bold text-[#007AFF]">CZ</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Chu Ziyang</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{t('about.chuRole')}</p>
            </div>
            <span className="text-[var(--text-tertiary)]">
              <Heart size={14} className="text-[#FF3B30]" />
            </span>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#5856D6]/20 to-[#AF52DE]/20 flex items-center justify-center">
                <span className="text-lg font-bold text-[#5856D6]">AI</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Claude</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{t('about.claudeRole')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 技术栈 */}
      <div className="settings-section mt-4">
        <div className="setting-row block px-5 py-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('about.techStack')}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Electron 28 · React 18 · TypeScript · Tailwind CSS · Framer Motion · Zustand</p>
        </div>
        <div className="setting-row block px-5 py-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('about.dataPath')}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">%APPDATA%\text-helper\</p>
        </div>
        <div className="setting-row block px-5 py-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">GitHub</p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 mt-1 text-xs text-[#007AFF] hover:underline"
          >
            <Github size={12} />
            github.com
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-tertiary)]">
        {t('about.footer')}
      </p>
    </div>
  )
}
