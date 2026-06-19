import { useEffect, useState } from 'react'
import { Github, RefreshCw, MessageCircle, History, Heart } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'

const REPO_URL = 'https://github.com/chu-ziyang/SelectAI'
const RELEASES_URL = `${REPO_URL}/releases`
const ISSUES_NEW_URL = `${REPO_URL}/issues/new`

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate'; currentVersion: string; latestVersion: string }
  | { kind: 'updateAvailable'; currentVersion: string; latestVersion: string; htmlUrl: string; publishedAt: string }
  | { kind: 'error'; message: string }

export default function AboutSettings() {
  const { t } = useI18n()
  const [currentVersion, setCurrentVersion] = useState<string>('—')
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' })

  // 进入页面读一次当前版本（不主动检查更新，避免用户打开就弹网络请求）
  useEffect(() => {
    window.electronAPI?.app.getVersion().then((v) => setCurrentVersion(v)).catch(() => {})
  }, [])

  async function handleCheckUpdate() {
    setUpdate({ kind: 'checking' })
    try {
      const r = await window.electronAPI!.app.checkUpdate()
      if (!r.ok) {
        setUpdate({ kind: 'error', message: r.error || '未知错误' })
        return
      }
      const cur = r.currentVersion || currentVersion
      const latest = r.latestVersion || ''
      if (r.hasUpdate && r.htmlUrl) {
        setUpdate({
          kind: 'updateAvailable',
          currentVersion: cur,
          latestVersion: latest,
          htmlUrl: r.htmlUrl,
          publishedAt: r.publishedAt || '',
        })
      } else {
        setUpdate({ kind: 'upToDate', currentVersion: cur, latestVersion: latest })
      }
    } catch (e) {
      setUpdate({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  async function openExternal(url: string) {
    await window.electronAPI?.shell.openExternal(url)
  }

  return (
    <div>
      {/* 更新与社区 - 一行 4 列按钮 */}
      <div className="settings-section mt-4 px-3 py-4">
        <div className="grid grid-cols-4 gap-2">
          {/* 检查更新 */}
          <TileButton
            icon={<RefreshCw size={20} className={update.kind === 'checking' ? 'animate-spin' : ''} />}
            label={
              update.kind === 'updateAvailable' ? t('about.updateAvailable') :
              update.kind === 'upToDate' ? t('about.upToDate') :
              update.kind === 'error' ? t('about.checkFailed') :
              t('about.checkUpdate')
            }
            hint={<UpdateSubtitle state={update} compact />}
            accent={
              update.kind === 'updateAvailable' ? 'warning' :
              update.kind === 'upToDate' ? 'success' :
              update.kind === 'error' ? 'danger' :
              'default'
            }
            onClick={update.kind === 'updateAvailable'
              ? () => openExternal((update as { htmlUrl: string }).htmlUrl)
              : handleCheckUpdate
            }
          />
          {/* 版本历史 */}
          <TileButton
            icon={<History size={20} />}
            label={t('about.changelog')}
            hint={<span className="text-[10px] text-[var(--text-tertiary)]">v{currentVersion}</span>}
            onClick={() => openExternal(RELEASES_URL)}
          />
          {/* 反馈问题 */}
          <TileButton
            icon={<MessageCircle size={20} />}
            label={t('about.feedback')}
            hint={<span className="text-[10px] text-[var(--text-tertiary)]">Issues</span>}
            onClick={() => openExternal(ISSUES_NEW_URL)}
          />
          {/* 项目主页 */}
          <TileButton
            icon={<Github size={20} />}
            label={t('about.githubRepo')}
            hint={<span className="font-mono text-[10px] text-[var(--text-tertiary)]">SelectAI</span>}
            onClick={() => openExternal(REPO_URL)}
          />
        </div>
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

      <p className="mt-6 text-center text-[10px] text-[var(--text-tertiary)]">
        {t('about.footer')}
      </p>
    </div>
  )
}

// 紧凑的格子按钮（4 列网格里的一格）
function TileButton({
  icon, label, hint, onClick, accent = 'default',
}: {
  icon: React.ReactNode
  label: string
  hint?: React.ReactNode
  onClick: () => void
  accent?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const accentClass =
    accent === 'success' ? 'text-[#34C759] bg-[#34C759]/8 hover:bg-[#34C759]/15' :
    accent === 'warning' ? 'text-[#FF9500] bg-[#FF9500]/8 hover:bg-[#FF9500]/15' :
    accent === 'danger'  ? 'text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15' :
                           'text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/15'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 rounded-xl transition-colors ${accentClass}`}
    >
      {icon}
      <span className="text-[11px] font-medium text-[var(--text-primary)] text-center leading-tight">
        {label}
      </span>
      {hint && <span className="leading-none">{hint}</span>}
    </button>
  )
}

function UpdateSubtitle({ state, compact = false }: { state: UpdateState; compact?: boolean }) {
  const { t } = useI18n()
  // compact 模式：格子按钮内显示，单行简短
  if (state.kind === 'idle') {
    return compact ? <span className="text-[10px] text-[var(--text-tertiary)]">点击检查</span> :
      <span className="text-[var(--text-tertiary)]">{t('about.clickToCheck') || '点击右侧按钮检查 GitHub 最新版本'}</span>
  }
  if (state.kind === 'checking') {
    return compact ? <span className="text-[10px] text-[var(--text-tertiary)]">检查中…</span> :
      <span className="text-[var(--text-tertiary)]">{t('about.checkingGithub') || '正在访问 GitHub Releases…'}</span>
  }
  if (state.kind === 'upToDate') {
    return compact ? <span className="text-[10px] text-[#34C759]">✓ 最新</span> :
      <span className="text-[#34C759]">v{state.currentVersion} = v{state.latestVersion} ✓</span>
  }
  if (state.kind === 'updateAvailable') {
    return compact ? <span className="text-[10px] text-[#FF9500]">→ v{state.latestVersion}</span> :
      (
        <span className="text-[#FF9500]">
          v{state.currentVersion} → <strong>v{state.latestVersion}</strong>
          {state.publishedAt && (
            <span className="text-[var(--text-tertiary)] ml-1.5">· {state.publishedAt.slice(0, 10)}</span>
          )}
        </span>
      )
  }
  if (state.kind === 'error') {
    return compact ? <span className="text-[10px] text-[#FF3B30]">失败</span> :
      <span className="text-[#FF3B30]">{state.message}</span>
  }
  return null
}