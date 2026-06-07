import { globalShortcut, BrowserWindow } from 'electron'
import { createStore } from './store'
import { createPopupWindow } from './windows'
import { readSelectedTextFromActiveApp } from './text-selection'

let registeredShortcuts: string[] = []

export function registerShortcuts() {
  unregisterShortcuts()

  const store = createStore()
  const mainShortcut = store.get('shortcut', 'Ctrl+Shift+Q') as string
  const showWindowShortcut = store.get('showWindowShortcut', 'Ctrl+Shift+H') as string

  try {
    // 弹出悬浮菜单：临时复制当前选区 → 读取 → 恢复剪贴板
    globalShortcut.register(mainShortcut, async () => {
      const paused = store.get('_paused', false) as boolean
      if (paused) return

      const minLength = store.get('settings.minTriggerLength', 3) as number
      const text = await readSelectedTextFromActiveApp()
      if (text && text.length >= minLength) {
        createPopupWindow(text)
      }
    })
    registeredShortcuts.push(mainShortcut)

    // 显示/隐藏主窗口
    globalShortcut.register(showWindowShortcut, () => {
      const windows = BrowserWindow.getAllWindows()
      const mainWindow = windows[0]
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
    registeredShortcuts.push(showWindowShortcut)
  } catch (error) {
    console.error('Failed to register shortcuts:', error)
  }
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
  registeredShortcuts = []
}
