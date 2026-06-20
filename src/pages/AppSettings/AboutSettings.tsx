import { useEffect, useState, useCallback } from 'react'
import { Github, RefreshCw, MessageCircle, History, Heart, Copy, Check, Sparkles, FolderOpen } from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToast } from '@/components/Toast'

const REPO_URL = 'https://github.com/chu-ziyang/SelectAI'
const RELEASES_URL = `${REPO_URL}/releases`

type AppInfo = {
  version: string
  appName: string
  productName: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  userDataPath: string
  platform: string
}

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate'; currentVersion: string; latestVersion: string }
  | { kind: 'updateAvailable'; currentVersion: string; latestVersion: string; htmlUrl: string; publishedAt: string; body: string }
  | { kind: 'error'; message: string }

// 检查结果可能在用户进入关于页之前已经由后台自动检查算出，
// 这里把"展示态"独立于 fetch 态，避免与自动检查竞态。
type DisplayUpdate =
  | null
  | { latestVersion: string; htmlUrl: string; publishedAt: string; body: string }

export default function AboutSettings() {
  const { t } = useI18n()
  const { addToast } = useToast()
  const settings = useSettingsStore((s) => s.app)
  const updateApp = useSettingsStore((s) => s.updateApp)

  const [info, setInfo] = useState<AppInfo | null>(null)
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' })
  // 后台自动检查推送的更新（如有），打开关于页就直接展示
  const [autoUpdate, setAutoUpdate] = useState<DisplayUpdate>(null)

  // 1. 拉取 app info（不抛错；失败就用最小 fallback）
  useEffect(() => {
    let mounted = true
    window.electronAPI?.app.getInfo()
      .then((data) => { if (mounted) setInfo(data) })
      .catch(() => {
        // fallback: 至少把版本号填上
        window.electronAPI?.app.getVersion()
          .then((v) => mounted && setInfo({
            version: v, appName: 'SelectAI', productName: '划词助手',
            electronVersion: '', chromeVersion: '', nodeVersion: '',
            userDataPath: '', platform: window.electronAPI?.platform || 'win32',
          }))
          .catch(() => {})
      })
    return () => { mounted = false }
  }, [])

  // 2. 订阅后台自动检查更新事件（只在新版本时主进程会推）
  useEffect(() => {
    const off = window.electronAPI?.app.onUpdateAvailable((data) => {
      setAutoUpdate({
        latestVersion: data.latestVersion,
        htmlUrl: data.htmlUrl,
        publishedAt: data.publishedAt,
        body: '',
      })
      // 也用 onUpdate 触发一次正式查询以拿到 body（release notes）
      window.electronAPI?.app.checkUpdate().then((r) => {
        if (r.ok && r.hasUpdate) {
          setAutoUpdate({
            latestVersion: r.latestVersion || data.latestVersion,
            htmlUrl: r.htmlUrl || data.htmlUrl,
            publishedAt: r.publishedAt || data.publishedAt,
            body: r.body || '',
          })
        }
      }).catch(() => {})
    })
    return () => { off?.() }
  }, [])

  async function handleCheckUpdate() {
    setUpdate({ kind: 'checking' })
    try {
      const r = await window.electronAPI!.app.checkUpdate()
      if (!r.ok) {
        setUpdate({ kind: 'error', message: r.error || t('about.checkFailed') })
        return
      }
      const cur = r.currentVersion || info?.version || ''
      const latest = r.latestVersion || ''
      if (r.hasUpdate && r.htmlUrl) {
        setUpdate({
          kind: 'updateAvailable',
          currentVersion: cur,
          latestVersion: latest,
          htmlUrl: r.htmlUrl,
          publishedAt: r.publishedAt || '',
          body: r.body || '',
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

  // 复制文本 + 提示
  const copyText = useCallback(async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      addToast('success', t('about.copied'))
    } catch {
      addToast('error', '复制失败')
    }
  }, [addToast, t])

  const toggleAutoCheck = useCallback(async (v: boolean) => {
    try {
      await updateApp({ autoCheckUpdate: v })
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : String(e))
    }
  }, [updateApp, addToast])

  // issue 模板预填：版本 + 平台。`validateExternalUrl` 要求输入串 == parsed.href，
  // 因此 query 必须用 encodeURIComponent 提前编码（编码后的 %0A 不会被二次转义）
  const buildIssueUrl = (): string => {
    const version = info?.version || 'unknown'
    const platform = (info?.platform || 'win32').replace(/^win32$/i, 'Windows')
    const title = encodeURIComponent(t('about.issueTemplateTitle') + t('about.feedback'))
    const body = encodeURIComponent(
      t('about.issueTemplateBody')
        .replace('{version}', version)
        .replace('{platform}', platform),
    )
    return `${REPO_URL}/issues/new?title=${title}&body=${body}`
  }

  // 4 列按钮上"反馈"那个要把 URL 改成带模板的版本
  const issueUrl = buildIssueUrl()

  // 把自动检查的展示态合并：手动检查优先，其次后台推送
  const effectiveUpdate: DisplayUpdate = update.kind === 'updateAvailable'
    ? {
        latestVersion: update.latestVersion,
        htmlUrl: update.htmlUrl,
        publishedAt: update.publishedAt,
        body: update.body,
      }
    : (update.kind === 'upToDate' ? null : autoUpdate)

  return (
    <div>
      {/* === 顶部应用身份卡 === */}
      <div className="settings-section mt-4">
        <div className="px-5 py-7 text-center">
          <div className="relative inline-block">
            <img
              src="./icon.png"
              alt="SelectAI"
              className="w-20 h-20 mx-auto rounded-2xl shadow-ios-md"
              draggable={false}
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-ios-sm">
              <Sparkles size={12} className="text-white" />
            </div>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
            {t('about.appName')}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {t('about.tagline')}
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)] font-mono">
            v{info?.version || '—'} · {t('about.license')} MIT
          </p>
        </div>
      </div>

      {/* === 应用信息行 === */}
      {info && <AppInfoRows info={info} copyText={copyText} t={t} />}

      {/* === 新版本 banner（手动检查或后台自动检查触发的） === */}
      {effectiveUpdate && (
        <UpdateBanner
          update={effectiveUpdate}
          currentVersion={info?.version || ''}
          onOpen={() => openExternal(effectiveUpdate.htmlUrl)}
        />
      )}

      {/* === 自动检查更新开关 === */}
      <div className="settings-section mt-4">
        <label className="flex items-start gap-3 px-5 py-4 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.autoCheckUpdate}
            onChange={(e) => toggleAutoCheck(e.target.checked)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {t('about.autoCheckUpdate')}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              {t('about.autoCheckUpdateHint')}
            </div>
          </div>
        </label>
      </div>

      {/* === 1 行 4 列按钮（更新/历史/反馈/主页） === */}
      <div className="settings-section mt-4 px-3 py-4">
        <div className="grid grid-cols-4 gap-2">
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
              ? () => openExternal((update as Extract<UpdateState, { kind: 'updateAvailable' }>).htmlUrl)
              : handleCheckUpdate
            }
          />
          <TileButton
            icon={<History size={20} />}
            label={t('about.changelog')}
            hint={<span className="text-[10px] text-[var(--text-tertiary)]">v{info?.version || '—'}</span>}
            onClick={() => openExternal(RELEASES_URL)}
          />
          <TileButton
            icon={<MessageCircle size={20} />}
            label={t('about.feedback')}
            hint={<span className="text-[10px] text-[var(--text-tertiary)]">{t('about.feedbackHint')}</span>}
            onClick={() => openExternal(issueUrl)}
          />
          <TileButton
            icon={<Github size={20} />}
            label={t('about.githubRepo')}
            hint={<span className="font-mono text-[10px] text-[var(--text-tertiary)]">SelectAI</span>}
            onClick={() => openExternal(REPO_URL)}
          />
        </div>
      </div>

      {/* === 开发者区（收敛为单行） === */}
      <div className="settings-section mt-4">
        <div className="px-5 py-5 flex items-center justify-center gap-2 text-[var(--text-tertiary)]">
          <span className="text-xs">{t('about.devTitle')}</span>
          <Heart size={11} className="text-[#FF3B30]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Chu Ziyang</span>
          <span className="text-[var(--text-tertiary)]">&</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">Claude</span>
        </div>
      </div>

      {/* === 页脚：版权 + License === */}
      <div className="mt-5 mb-2 text-center space-y-1">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          {t('about.copyright', { year: String(new Date().getFullYear()) })}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          {t('about.footer')}
        </p>
      </div>
    </div>
  )
}

// ============ 子组件 ============

function AppInfoRows({ info, copyText, t }: { info: AppInfo; copyText: (s: string) => void; t: (k: string) => string }) {
  return (
    <div className="settings-section mt-4">
      <InfoRow label={t('about.version')} value={`v${info.version}`} onCopy={() => copyText(info.version)} />
      <InfoRow label={t('about.electronVersion')} value={info.electronVersion} onCopy={() => copyText(info.electronVersion)} />
      <InfoRow label={t('about.chromeVersion')} value={info.chromeVersion} onCopy={() => copyText(info.chromeVersion)} />
      <InfoRow label={t('about.nodeVersion')} value={info.nodeVersion} onCopy={() => copyText(info.nodeVersion)} />
      <InfoRow
        label={t('about.userDataPath')}
        value={info.userDataPath || '—'}
        mono
        onCopy={() => copyText(info.userDataPath)}
        onOpen={() => info.userDataPath && window.electronAPI?.shell.openExternal(`file:///${info.userDataPath.replace(/\\/g, '/')}`)}
      />
    </div>
  )
}

function InfoRow({ label, value, mono = false, onCopy, onOpen }: {
  label: string
  value: string
  mono?: boolean
  onCopy?: () => void
  onOpen?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 group">
      <div className="w-20 flex-shrink-0 text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className={`flex-1 min-w-0 truncate text-xs ${mono ? 'font-mono' : ''} text-[var(--text-primary)]`} title={value}>
        {value || '—'}
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-opacity"
          title="复制"
        >
          {copied ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} className="text-[var(--text-tertiary)]" />}
        </button>
      )}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-opacity"
          title="打开"
        >
          <FolderOpen size={12} className="text-[var(--text-tertiary)]" />
        </button>
      )}
    </div>
  )
}

function UpdateBanner({ update, currentVersion, onOpen }: {
  update: NonNullable<DisplayUpdate>
  currentVersion: string
  onOpen: () => void
}) {
  return (
    <div className="settings-section mt-4 mx-1 border border-[#FF9500]/30 bg-[#FF9500]/5 rounded-2xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#FF9500]" />
          <span className="text-sm font-semibold text-[#FF9500]">
            v{currentVersion} → v{update.latestVersion}
          </span>
          {update.publishedAt && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              · {formatRelativeDate(update.publishedAt)}
            </span>
          )}
        </div>
        {update.body && (
          <pre className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-sans max-h-32 overflow-y-auto mb-2">
            {update.body.trim()}
          </pre>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="text-[11px] font-medium text-[#007AFF] hover:underline"
        >
          前往下载 →
        </button>
      </div>
    </div>
  )
}

function formatRelativeDate(iso: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso.slice(0, 10)
  const diffMs = Date.now() - then
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return '今天发布'
  if (diffDays === 1) return '昨天发布'
  if (diffDays < 30) return `${diffDays} 天前发布`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前发布`
  return `${Math.floor(diffDays / 365)} 年前发布`
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
  // compact 模式：格子按钮内显示，单行简短
  if (state.kind === 'idle') {
    return compact ? <span className="text-[10px] text-[var(--text-tertiary)]">点击检查</span> :
      <span className="text-[var(--text-tertiary)]">点击按钮检查 GitHub 最新版本</span>
  }
  if (state.kind === 'checking') {
    return compact ? <span className="text-[10px] text-[var(--text-tertiary)]">检查中…</span> :
      <span className="text-[var(--text-tertiary)]">正在访问 GitHub Releases…</span>
  }
  if (state.kind === 'upToDate') {
    return compact ? <span className="text-[10px] text-[#34C759]">✓ 最新</span> :
      <span className="text-[#34C759]">v{state.currentVersion} = v{state.latestVersion} ✓</span>
  }
  if (state.kind === 'updateAvailable') {
    return compact ? <span className="text-[10px] text-[#FF9500]">→ v{state.latestVersion}</span> :
      <span className="text-[#FF9500]">v{state.currentVersion} → v{state.latestVersion}</span>
  }
  if (state.kind === 'error') {
    return compact ? <span className="text-[10px] text-[#FF3B30]">失败</span> :
      <span className="text-[#FF3B30]">{state.message}</span>
  }
  return null
}
