import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { Keyboard } from 'lucide-react'

function ShortcutRecorder({ label, desc, value, onSave }: { label: string; desc: string; value: string; onSave: (v: string) => void }) {
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
      const combo = parts.join('+')
      setKeys(parts)
      onSave(combo)
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
        className={`min-w-[116px] rounded-lg border px-3 py-1.5 text-center font-mono text-xs font-medium transition-all ${
          recording
            ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]/20'
            : 'border-[var(--separator)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
        }`}
      >
        {recording ? (keys.length > 0 ? keys.join('+') : '按下组合键...') : value}
      </button>
    </div>
  )
}

export default function ShortcutSettings() {
  const { shortcut, showWindowShortcut, updateShortcut } = useSettingsStore()

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Keyboard size={16} className="text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">全局快捷键</h3>
      </div>
      <div className="settings-section">
        <ShortcutRecorder label="弹出/隐藏菜单" desc="选中文字后呼出划词弹窗" value={shortcut} onSave={(v) => updateShortcut('shortcut', v)} />
        <ShortcutRecorder label="显示/隐藏主窗口" desc="快速打开或隐藏配置主窗口" value={showWindowShortcut} onSave={(v) => updateShortcut('showWindowShortcut', v)} />
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mt-3 px-1">
        点击快捷键按钮后，按下组合键即可设置新快捷键。支持 Ctrl / Alt / Shift / Win 组合。
      </p>
    </div>
  )
}
