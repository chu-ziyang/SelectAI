/**
 * 纯函数：provider baseUrl 校验。
 * 从 main.ts 抽出，刻意不依赖 electron，便于单测覆盖。
 *
 * 校验规则（防止把 Bearer API Key 发到错误目标）：
 * - 必须 http/https（拒 file://、javascript: 等）
 * - 不允许 URL 内含用户名/密码（避免 https://attacker:x@victim.com 钓鱼）
 * - http 仅允许 localhost / 127.x / ::1（保留本地 LLM 如 Ollama），
 *   公网必须 https（否则 Bearer Key 会以明文走中间路径）
 * - 拒绝云元数据地址（AWS/GCP/Aliyun IMDS），无论协议
 */
export type UrlValidationResult = { ok: true } | { ok: false; error: string }

export function validateProviderUrl(input: string): UrlValidationResult {
  let parsed: URL
  try {
    parsed = new URL(input.trim())
  } catch {
    return { ok: false, error: 'API 地址格式无效，请填写完整 URL（如 https://api.example.com/v1）' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'API 地址只支持 https:// 或 http:// 协议' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'API 地址不允许包含用户名/密码' }
  }
  const host = parsed.hostname.toLowerCase()
  const isLocal =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    host === '[::1]' ||
    host === '::1'
  if (parsed.protocol === 'http:' && !isLocal) {
    return { ok: false, error: 'http:// 仅支持本机地址；公网请改用 https://，否则 API Key 会以明文传输' }
  }
  // 云元数据：AWS IMDS / GCP metadata / Aliyun metadata 等，全部拦
  if (/^169\.254\./.test(host) || host === 'metadata.google.internal' || host === 'metadata' || host === '100.100.100.200') {
    return { ok: false, error: '不允许访问云元数据服务地址' }
  }
  return { ok: true }
}

/**
 * 严校验：renderer 要求打开外部链接时用。
 * - 长度限制
 * - 必须能严格解析、且原串与重新序列化一致（防 NUL 截断/不可见字符绕过）
 * - 只允许 http/https
 * - 禁 userinfo
 */
export function validateExternalUrl(url: string): UrlValidationResult {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return { ok: false, error: '链接无效' }
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: '链接格式无效' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '只允许 http(s) 链接' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: '链接不允许包含用户名/密码' }
  }
  // URL spec 给裸域名自动加 /（如 github.com → github.com/），属于正常规范化。
  // 只比对去掉尾部 / 的版本，仍然能拦截 NUL 截断/不可见字符等攻击。
  const hrefNorm = parsed.href.endsWith('/') && !url.endsWith('/')
    ? parsed.href.slice(0, -1)
    : parsed.href
  if (hrefNorm !== url) {
    return { ok: false, error: '链接含非法字符' }
  }
  return { ok: true }
}
