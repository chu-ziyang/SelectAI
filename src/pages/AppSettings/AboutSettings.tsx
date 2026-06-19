import { useEffect, useState } from 'react'
import { Github, RefreshCw, MessageCircle, History, ExternalLink, Sparkles, Heart, FolderOpen } from 'lucide-react'
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

  // 列表项渲染辅助
  const Row = ({
    icon, title, subtitle, action, accent = 'default',
  }: {
    icon: React.ReactNode
    title: string
    subtitle?: React.ReactNode
    action: React.ReactNode
    accent?: 'default' | 'success' | 'warning'
  }) => (
    <div className="setting-row flex items-center gap-3 px-5 py-3.5">
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
        accent === 'success' ? 'bg-[#34C759]/15 text-[#34C759]' :
        accent === 'warning' ? 'bg-[#FF9500]/15 text-[#FF9500]' :
        'bg-[#007AFF]/12 text-[#007AFF]'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {subtitle && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</div>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )

  const ExternalButton = ({ url, label }: { url: string; label: string }) => (
    <button
      type="button"
      onClick={() => openExternal(url)}
      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--fill-quaternary)] hover:bg-[var(--fill-tertiary)] text-xs text-[var(--text-secondary)] transition-colors"
    >
      {label}
      <ExternalLink size={11} />
    </button>
  )

  return (
    <div>
      {/* 品牌区 */}
      <div className="settings-section p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-ios-lg">
          <Sparkles size={32} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)]">划词助手</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">{t('about.tagline')}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-2 font-mono">v{currentVersion}</p>
      </div>

      {/* 更新与社区 */}
      <div className="settings-section mt-4">
        <p className="px-5 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {t('about.checkUpdate')}
        </p>

        <Row
          icon={<RefreshCw size={16} />}
          title={
            update.kind === 'updateAvailable'
              ? t('about.updateAvailable')
              : update.kind === 'upToDate'
                ? t('about.upToDate')
                : update.kind === 'error'
                  ? t('about.checkFailed')
                  : t('about.checkUpdate')
          }
          subtitle={
            <UpdateSubtitle state={update} />
          }
          accent={
            update.kind === 'updateAvailable' ? 'warning' :
            update.kind === 'upToDate' ? 'success' :
            'default'
          }
          action={
            update.kind === 'updateAvailable' ? (
              <ExternalButton url={update.htmlUrl} label={t('about.downloadNow')} />
            ) : (
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={update.kind === 'checking'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#007AFF] hover:bg-[#0066D6] disabled:bg-[#007AFF]/50 text-white text-xs font-medium transition-colors"
              >
                <RefreshCw size={12} className={update.kind === 'checking' ? 'animate-spin' : ''} />
                {update.kind === 'checking' ? t('about.checking') : t('about.checkUpdate')}
              </button>
            )
          }
        />

        <Row
          icon={<History size={16} />}
          title={t('about.changelog')}
          subtitle={<span className="text-[var(--text-tertiary)]">v{currentVersion} · {RELEASES_URL.replace('https://', '')}</span>}
          action={<ExternalButton url={RELEASES_URL} label={t('about.changelog')} />}
        />

        <Row
          icon={<MessageCircle size={16} />}
          title={t('about.feedback')}
          subtitle={<span className="text-[var(--text-tertiary)]">{t('about.feedbackHint') || 'Bug · 建议 · 功能请求'}</span>}
          action={<ExternalButton url={ISSUES_NEW_URL} label={t('about.feedback')} />}
        />

        <Row
          icon={<Github size={16} />}
          title={t('about.githubRepo')}
          subtitle={<span className="font-mono text-[var(--text-tertiary)]">chu-ziyang/SelectAI</span>}
          action={<ExternalButton url={REPO_URL} label="GitHub" />}
        />
      </div>

      {/* 数据存储 */}
      <div className="settings-section mt-4">
        <div className="setting-row block px-5 py-3">
          <div className="flex items-center gap-2.5">
            <FolderOpen size={14} className="text-[var(--text-secondary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('about.dataPath')}</p>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">%APPDATA%\text-helper\</p>
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

function UpdateSubtitle({ state }: { state: UpdateState }) {
  const { t } = useI18n()
  if (state.kind === 'idle') {
    return <span className="text-[var(--text-tertiary)]">{t('about.clickToCheck') || '点击右侧按钮检查 GitHub 最新版本'}</span>
  }
  if (state.kind === 'checking') {
    return <span className="text-[var(--text-tertiary)]">{t('about.checkingGithub') || '正在访问 GitHub Releases…'}</span>
  }
  if (state.kind === 'upToDate') {
    return <span className="text-[#34C759]">v{state.currentVersion} = v{state.latestVersion} ✓</span>
  }
  if (state.kind === 'updateAvailable') {
    return (
      <span className="text-[#FF9500]">
        v{state.currentVersion} → <strong>v{state.latestVersion}</strong>
        {state.publishedAt && (
          <span className="text-[var(--text-tertiary)] ml-1.5">· {state.publishedAt.slice(0, 10)}</span>
        )}
      </span>
    )
  }
  if (state.kind === 'error') {
    return <span className="text-[#FF3B30]">{state.message}</span>
  }
  return null
}