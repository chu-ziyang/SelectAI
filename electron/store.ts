import Store from 'electron-store'
import { safeStorage } from 'electron'

type StoreType = Record<string, unknown>

let storeInstance: Store<StoreType> | null = null

export function createStore(): Store<StoreType> {
  if (!storeInstance) {
    storeInstance = new Store<StoreType>({
      name: 'text-helper-config',
      schema: {
        hasLaunched: { type: 'boolean', default: false },
        providers: { type: 'array', default: [] },
        actions: { type: 'array', default: [] },
        history: { type: 'array', default: [] },
        settings: {
          type: 'object',
          default: {
            autoStart: false,
            startMinimized: true,
            closeToTray: true,
            autoPopup: true,
            ctrlHoldPopup: true,
            minTriggerLength: 3,
            appBlacklist: [] as string[],
            language: 'zh-CN',
            clipboardTrigger: false,
            saveHistory: true,
            historyRetentionDays: 30,
            theme: 'system' as const,
            fontScale: 'medium',
            fontFamily: 'system',
          },
        },
        popupSettings: {
          type: 'object',
          default: {
            width: 320,
            maxHeight: 400,
            padding: 16,
            opacity: 100,
            layout: 'horizontal' as const,
            cornerRadius: 12,
            iconSize: 20,
            showButtonBackground: true,
            showHoverEffect: true,
            placement: 'bottom-right' as const,
            offsetX: 0,
            offsetY: 8,
            avoidScreenEdge: true,
            followMouse: true,
            enterAnimation: 'scale' as const,
            exitAnimation: 'fade' as const,
            animationDurationMs: 200,
            clickOutsideClose: true,
            escClose: true,
            autoHide: false,
            autoHideSeconds: 5,
            replaceOnNewSelect: true,
            pinned: false,
          },
        },
        shortcut: { type: 'string', default: 'Ctrl+Shift+Q' },
        showWindowShortcut: { type: 'string', default: 'Ctrl+Shift+H' },
      },
    })
  }
  return storeInstance!
}

// ==================== API Key 加密管理 ====================

export function encryptApiKey(plainKey: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plainKey)
    return encrypted.toString('base64')
  }
  // Fallback: 如果系统不支持加密（极少情况），base64 编码作为最低限度模糊处理
  return Buffer.from(plainKey).toString('base64')
}

export function decryptApiKey(encryptedKey: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedKey, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      // 兼容旧版未加密的 key
      try {
        return Buffer.from(encryptedKey, 'base64').toString('utf-8')
      } catch {
        return ''
      }
    }
  }
  // Fallback
  try {
    return Buffer.from(encryptedKey, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return `sk-****${key.slice(-4)}`
}
