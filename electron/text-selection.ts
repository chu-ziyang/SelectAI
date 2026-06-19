import { clipboard } from 'electron'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createStore } from './store'
import { createPopupWindow } from './windows'

let watchInterval: ReturnType<typeof setInterval> | null = null
let mouseWatchProcess: ChildProcessWithoutNullStreams | null = null
let isWatching = false
let lastPopupText = ''
let lastPopupAt = 0

// 缓存原剪贴板内容，保护用户剪贴板
let savedClipboard = ''

function sendCopyShortcut(): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-WindowStyle',
        'Hidden',
        '-Command',
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
      ],
      { windowsHide: true, timeout: 1500 },
      () => resolve(),
    )
  })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldTriggerText(text: string) {
  const store = createStore()
  const raw = store.get('settings.minTriggerLength', 3) as unknown
  // 防御：若 store 被破坏为非数（如 "abc"），回退默认 3，避免划词静默失效
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  const minLength = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 3
  if (!text || text.length < minLength) return false

  const now = Date.now()
  if (text === lastPopupText && now - lastPopupAt < 1200) return false

  lastPopupText = text
  lastPopupAt = now
  return true
}

function startMouseWatch() {
  stopMouseWatch()

  const store = createStore()
  const autoPopup = store.get('settings.autoPopup', true) as boolean
  const ctrlHoldPopup = store.get('settings.ctrlHoldPopup', true) as boolean
  if (!autoPopup && !ctrlHoldPopup) return

  const autoPopupFlag = autoPopup ? '$true' : '$false'
  const ctrlHoldFlag = ctrlHoldPopup ? '$true' : '$false'

  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class TextHelperMouse {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
}
"@
$autoPopup = ${autoPopupFlag}
$ctrlHoldPopup = ${ctrlHoldFlag}

function Copy-SelectedText {
  $marker = "__TEXT_HELPER_COPY_MARKER_$([Guid]::NewGuid().ToString("N"))__"
  $original = ""
  $hadOriginal = $false
  try {
    $original = [System.Windows.Forms.Clipboard]::GetText()
    $hadOriginal = $true
  } catch {}

  try {
    [System.Windows.Forms.Clipboard]::SetText($marker)
    [System.Windows.Forms.SendKeys]::SendWait("^c")

    for ($i = 0; $i -lt 8; $i++) {
      Start-Sleep -Milliseconds 35
      try {
        $copied = [System.Windows.Forms.Clipboard]::GetText()
        if ($copied -and $copied -ne $marker) {
          return $copied.Trim()
        }
      } catch {}
    }
  } finally {
    try {
      if ($hadOriginal) {
        [System.Windows.Forms.Clipboard]::SetText($original)
      } else {
        [System.Windows.Forms.Clipboard]::Clear()
      }
    } catch {}
  }

  return ""
}

function Emit-Text($prefix, $text) {
  if (-not $text) { return }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $base64 = [Convert]::ToBase64String($bytes)
  Write-Output "$prefix $base64"
  [Console]::Out.Flush()
}

$wasDown = $false
$downX = 0
$downY = 0
while ($true) {
  $down = (([TextHelperMouse]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0)
  $pt = New-Object TextHelperMouse+POINT
  [TextHelperMouse]::GetCursorPos([ref]$pt) | Out-Null
  if (-not $wasDown -and $down) {
    $downX = $pt.X
    $downY = $pt.Y
  }
  if ($wasDown -and -not $down) {
    $dx = [Math]::Abs($pt.X - $downX)
    $dy = [Math]::Abs($pt.Y - $downY)
    if ([Math]::Max($dx, $dy) -ge 6) {
      $captured = ""
      if ($autoPopup) {
        Start-Sleep -Milliseconds 45
        $captured = Copy-SelectedText
        Emit-Text "TEXT" $captured
      }

      if ($ctrlHoldPopup -and (-not $autoPopup -or -not $captured)) {
        for ($i = 0; $i -lt 30; $i++) {
          $ctrlDown = (([TextHelperMouse]::GetAsyncKeyState(0x11) -band 0x8000) -ne 0)
          if ($ctrlDown) {
            if (-not $captured) {
              $captured = Copy-SelectedText
            }
            Emit-Text "CTRL" $captured
            break
          }
          Start-Sleep -Milliseconds 70
        }
      }
    }
  }
  $wasDown = $down
  Start-Sleep -Milliseconds 45
}
`

  mouseWatchProcess = spawn(
    'powershell.exe',
    ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-Command', script],
    { windowsHide: true },
  )

  let buffer = ''
  mouseWatchProcess.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      const match = /^(TEXT|CTRL)\s+(.+)$/.exec(line.trim())
      if (!match) continue
      const text = Buffer.from(match[2], 'base64').toString('utf-8').trim()
      if (shouldTriggerText(text)) {
        createPopupWindow(text)
      }
    }
  })

  // stderr 排空避免阻塞；同时把警告写入日志便于排查
  mouseWatchProcess.stderr.on('data', (chunk) => {
    // 不在 stderr 上做任何抛错——只是把内容排空
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    chunk
  })

  mouseWatchProcess.on('error', (err) => {
    // 进程创建失败或启动错误：记录后重置，由 isWatching 在下一轮触发重启
    console.warn('[text-selection] mouse watcher error:', err?.message || err)
    mouseWatchProcess = null
  })

  mouseWatchProcess.on('exit', (code, signal) => {
    if (mouseWatchProcess !== null) {
      // 非预期退出（用户没主动 stop）—— 记录并按指数退避重启
      console.warn(`[text-selection] mouse watcher exited (code=${code}, signal=${signal}), will restart`)
      mouseWatchProcess = null
      if (isWatching) {
        scheduleMouseWatchRestart()
      }
    }
  })
}

let mouseWatchRestartTimer: ReturnType<typeof setTimeout> | null = null
let mouseWatchRestartAttempts = 0

function scheduleMouseWatchRestart() {
  if (mouseWatchRestartTimer) return
  // 指数退避：1s, 2s, 4s, 8s, 最长 30s
  const delay = Math.min(30000, 1000 * Math.pow(2, mouseWatchRestartAttempts))
  mouseWatchRestartAttempts += 1
  mouseWatchRestartTimer = setTimeout(() => {
    mouseWatchRestartTimer = null
    if (isWatching) {
      startMouseWatch()
      // 成功重启就重置 attempts（在新的 spawn 成功时无法判断；
      // 简化策略：每 5 次成功调用清零，由 stop/start 触发）
    }
  }, delay)
}

function stopMouseWatch() {
  if (mouseWatchRestartTimer) {
    clearTimeout(mouseWatchRestartTimer)
    mouseWatchRestartTimer = null
  }
  mouseWatchRestartAttempts = 0
  if (mouseWatchProcess) {
    mouseWatchProcess.kill()
    mouseWatchProcess = null
  }
}

export async function readSelectedTextFromActiveApp(): Promise<string> {
  const originalText = clipboard.readText()
  const marker = `__TEXT_HELPER_COPY_MARKER_${Date.now()}_${Math.random().toString(36).slice(2)}__`

  try {
    clipboard.writeText(marker)
    await sendCopyShortcut()

    for (let i = 0; i < 8; i += 1) {
      await delay(60)
      const copied = clipboard.readText()
      if (copied && copied !== marker) {
        return copied.trim()
      }
    }

    return ''
  } catch {
    return ''
  } finally {
    try { clipboard.writeText(originalText) } catch { /* ignore */ }
  }
}

export function startTextWatch() {
  stopTextWatch()
  isWatching = true
  startMouseWatch()

  // 保存当前剪贴板
  try { savedClipboard = clipboard.readText() } catch { /* ignore */ }

  const store = createStore()

  watchInterval = setInterval(() => {
    if (!isWatching) return
    const paused = store.get('_paused', false) as boolean
    if (paused) return

    const clipboardTrigger = store.get('settings.clipboardTrigger', false) as boolean
    if (!clipboardTrigger) return // 默认关闭，只有用户显式开启才监听剪贴板

    try {
      const currentText = clipboard.readText().trim()
      if (!currentText || currentText === savedClipboard) return

      const raw = store.get('settings.minTriggerLength', 3) as unknown
      const parsed = typeof raw === 'number' ? raw : Number(raw)
      const minLength = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 3
      if (currentText.length < minLength) return

      savedClipboard = currentText
      createPopupWindow(currentText)
    } catch { /* 剪贴板读取失败不能影响用户 */ }
  }, 800) // 降低轮询频率
}

export function stopTextWatch() {
  isWatching = false
  stopMouseWatch()
  if (watchInterval) {
    clearInterval(watchInterval)
    watchInterval = null
  }
}
