import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  BrainCircuit,
  Zap,
  History,
  Settings,
  Palette,
  Minus,
  Maximize2,
  X,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import ModelManager from './pages/ModelManager'
import ActionManager from './pages/ActionManager'
import HistoryPage from './pages/History'
import AppSettings from './pages/AppSettings'
import PopupSettings from './pages/PopupSettings'
import PopupApp from './popup/PopupApp'
import ResultApp from './popup/ResultApp'
import Onboarding from './pages/Onboarding'
import { useI18n } from '@/i18n/useI18n'

function App() {
  const location = useLocation()
  const isPopupRoute = location.pathname === '/popup' || location.pathname.startsWith('/popup/')
  const { t } = useI18n()
  const [isCheckingLaunch, setIsCheckingLaunch] = useState(true)
  const [hasLaunched, setHasLaunched] = useState(true)
  const [settingsReady, setSettingsReady] = useState(false)

  // 应用外观设置（主题 / 字号 / 字体 / 语言）
  const { app, loadSettings } = useSettingsStore()

  // 启动时先加载设置，避免默认值闪烁
  useEffect(() => { loadSettings().finally(() => setSettingsReady(true)) }, [])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolvedTheme = app.theme === 'system' ? (media.matches ? 'dark' : 'light') : app.theme
      root.setAttribute('data-theme', resolvedTheme)
      root.classList.toggle('dark', resolvedTheme === 'dark')
      root.classList.toggle('light', resolvedTheme === 'light')
    }

    applyTheme()
    if (app.theme === 'system') media.addEventListener('change', applyTheme)
    // 字号比例
    const scaleMap = { small: '13px', medium: '14px', large: '15px', xl: '16px', xxl: '18px', xxxl: '20px' }
    root.style.fontSize = scaleMap[app.fontScale] || '14px'
    root.setAttribute('data-font-scale', app.fontScale)
    // 字体
    const fontMap: Record<string, string> = {
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      yahei: '"Microsoft YaHei", "微软雅黑", sans-serif',
      pingfang: '"PingFang SC", "苹方", sans-serif',
    }
    root.style.setProperty('--font-family', fontMap[app.fontFamily] || fontMap.system)
    // 语言
    root.lang = app.language
    return () => media.removeEventListener('change', applyTheme)
  }, [app.theme, app.fontScale, app.fontFamily, app.language])

  useEffect(() => {
    if (isPopupRoute) {
      setIsCheckingLaunch(false)
      return
    }

    const checkLaunchState = async () => {
      const api = window.electronAPI
      if (!api) {
        setIsCheckingLaunch(false)
        return
      }

      const launched = await api.store.get('hasLaunched')
      setHasLaunched(Boolean(launched))
      setIsCheckingLaunch(false)
    }

    checkLaunchState()
  }, [isPopupRoute])

  const NAV_ITEMS = [
    { path: '/models', label: t('nav.models'), icon: BrainCircuit },
    { path: '/actions', label: t('nav.actions'), icon: Zap },
    { path: '/history', label: t('nav.history'), icon: History },
    { path: '/popup-settings', label: t('nav.popup'), icon: Palette },
    { path: '/settings', label: t('nav.settings'), icon: Settings },
  ]

  // 弹窗模式 / 结果窗口：不显示侧边栏
  if (isPopupRoute || location.pathname === '/result') {
    return (
      <Routes>
        <Route path="/popup" element={<PopupApp />} />
        <Route path="/result" element={<ResultApp />} />
      </Routes>
    )
  }

  if (isCheckingLaunch || !settingsReady) {
    return <div className="h-screen bg-[var(--bg-primary)]" />
  }

  if (!hasLaunched) {
    return (
      <Onboarding
        onComplete={async () => {
          await window.electronAPI?.store.set('hasLaunched', true)
          setHasLaunched(true)
        }}
      />
    )
  }

  // 首次进入默认跳转模型管理
  const activePath = location.pathname === '/' ? '/models' : location.pathname

  return (
    <div className="app-window-shell flex h-screen flex-col overflow-hidden bg-[var(--bg-primary)]">

      {/* 顶部菜单栏：导航 + 窗口控制 同一行 */}
      <header className="drag-region flex shrink-0 items-center border-b border-[var(--separator)] bg-[var(--bg-secondary)] pl-1 h-11 pr-[124px] relative">
        {/* 左侧导航 */}
        <nav className="no-drag flex items-center h-full gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.path || activePath.startsWith(item.path + '/')
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`shrink-0 flex items-center gap-1.5 px-4 h-9 text-[14px] font-medium rounded-2xl transition-all duration-150 select-none ${
                  isActive
                    ? 'text-[#007AFF] bg-[#007AFF]/10'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--fill-tertiary)]'
                }`}
              >
                <item.icon size={16} strokeWidth={1.7} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* 右侧窗口控制按钮 — 绝对定位，不遮挡导航 */}
        <div className="no-drag absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 h-9">
          <button
            onClick={() => window.electronAPI?.window.minimize()}
            className="group grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-secondary)] transition-all hover:bg-[#FEBC2E] hover:scale-105"
            title="最小化"
          >
            <Minus size={14} strokeWidth={2.5} className="text-[var(--text-tertiary)] group-hover:text-[#995D00] transition-all" />
          </button>
          <button
            onClick={() => window.electronAPI?.window.maximize()}
            className="group grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-secondary)] transition-all hover:bg-[#28C840] hover:scale-105"
            title="最大化/还原"
          >
            <Maximize2 size={12} strokeWidth={2.5} className="text-[var(--text-tertiary)] group-hover:text-[#0D6B1D] transition-all" />
          </button>
          <button
            onClick={() => window.electronAPI?.window.close()}
            className="group grid h-9 w-9 place-items-center rounded-full bg-[var(--bg-secondary)] transition-all hover:bg-[#FF5F57] hover:scale-105"
            title="关闭"
          >
            <X size={14} strokeWidth={2.5} className="text-[var(--text-tertiary)] group-hover:text-[#7F0A00] transition-all" />
          </button>
        </div>
      </header>

      {/* 页面内容区 */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<ModelManager />} />
          <Route path="/models" element={<ModelManager />} />
          <Route path="/actions" element={<ActionManager />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings/*" element={<AppSettings />} />
          <Route path="/popup-settings" element={<PopupSettings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
