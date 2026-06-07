import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(app.getPath('userData'), 'logs')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function getLogFile(): string {
  ensureLogDir()
  const date = new Date().toISOString().slice(0, 10)
  return path.join(LOG_DIR, `${date}.log`)
}

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${level}] ${message}\n`
}

// 安全截断文本（不记录完整用户内容）
function safeTruncate(text: string, maxLen = 50): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

export const logger = {
  info(message: string) {
    const line = formatMessage('INFO', message)
    try { fs.appendFileSync(getLogFile(), line) } catch { /* 日志写入失败不能影响主流程 */ }
    console.log(line.trim())
  },

  warn(message: string) {
    const line = formatMessage('WARN', message)
    try { fs.appendFileSync(getLogFile(), line) } catch {}
    console.warn(line.trim())
  },

  error(message: string, err?: Error) {
    const detail = err ? ` | ${err.message}` : ''
    const line = formatMessage('ERROR', message + detail)
    try { fs.appendFileSync(getLogFile(), line) } catch {}
    console.error(line.trim())
  },

  // API 请求日志（不记录明文 Key）
  api(provider: string, model: string, status: string, latencyMs: number) {
    const line = formatMessage('API', `provider=${provider} model=${model} status=${status} latency=${latencyMs}ms`)
    try { fs.appendFileSync(getLogFile(), line) } catch {}
  },

  getLogDir() {
    return LOG_DIR
  },

  // 清理旧日志（保留 7 天）
  cleanOldLogs() {
    try {
      ensureLogDir()
      const files = fs.readdirSync(LOG_DIR)
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      for (const file of files) {
        const filePath = path.join(LOG_DIR, file)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
        }
      }
    } catch {}
  },
}
