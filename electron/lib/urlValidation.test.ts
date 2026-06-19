import { describe, it, expect } from 'vitest'
import { validateProviderUrl, validateExternalUrl } from './urlValidation'

describe('validateProviderUrl', () => {
  it('accepts valid https URL', () => {
    expect(validateProviderUrl('https://api.openai.com/v1')).toEqual({ ok: true })
  })

  it('accepts https with trailing slash', () => {
    expect(validateProviderUrl('https://api.example.com/v1/')).toEqual({ ok: true })
  })

  it('accepts localhost with http', () => {
    expect(validateProviderUrl('http://localhost:11434')).toEqual({ ok: true })
    expect(validateProviderUrl('http://127.0.0.1:8080')).toEqual({ ok: true })
    expect(validateProviderUrl('http://0.0.0.0:8000')).toEqual({ ok: true })
  })

  it('rejects http on public host', () => {
    const r = validateProviderUrl('http://api.example.com/v1')
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.error).toContain('http://')
  })

  it('rejects URLs with userinfo', () => {
    const r = validateProviderUrl('https://user:pass@api.example.com/v1')
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.error).toContain('用户名/密码')
  })

  it('rejects AWS IMDS (http blocked before metadata check)', () => {
    const r = validateProviderUrl('http://169.254.169.254/latest/meta-data/')
    expect(r.ok).toBe(false)
    // http + non-local → blocked by protocol check first
  })

  it('rejects AWS IMDS even with https', () => {
    const r = validateProviderUrl('https://169.254.169.254/latest/meta-data/')
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.error).toContain('云元数据')
  })

  it('rejects GCP metadata', () => {
    const r = validateProviderUrl('http://metadata.google.internal/computeMetadata/')
    expect(r.ok).toBe(false)
  })

  it('rejects Aliyun metadata', () => {
    const r = validateProviderUrl('http://100.100.100.200/latest/meta-data/')
    expect(r.ok).toBe(false)
  })

  it('rejects non-http protocols', () => {
    expect(validateProviderUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateProviderUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateProviderUrl('ftp://example.com').ok).toBe(false)
  })

  it('rejects malformed URLs', () => {
    const r = validateProviderUrl('not-a-url')
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.error).toContain('格式无效')
  })

  it('trims whitespace', () => {
    expect(validateProviderUrl('  https://api.example.com/v1  ')).toEqual({ ok: true })
  })
})

describe('validateExternalUrl', () => {
  it('accepts valid https URL', () => {
    expect(validateExternalUrl('https://github.com')).toEqual({ ok: true })
    expect(validateExternalUrl('https://github.com/')).toEqual({ ok: true })
  })

  it('accepts valid http URL', () => {
    expect(validateExternalUrl('http://example.com')).toEqual({ ok: true })
    expect(validateExternalUrl('http://example.com/')).toEqual({ ok: true })
  })

  it('rejects empty string', () => {
    expect(validateExternalUrl('').ok).toBe(false)
  })

  it('rejects non-string', () => {
    expect(validateExternalUrl(123 as any).ok).toBe(false)
  })

  it('rejects userinfo in URL', () => {
    expect(validateExternalUrl('https://evil:pass@github.com').ok).toBe(false)
  })

  it('rejects non-http protocols', () => {
    expect(validateExternalUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateExternalUrl('javascript:alert(1)').ok).toBe(false)
  })

  it('rejects NUL-injected URLs (parse failure)', () => {
    // NUL byte causes new URL() to throw in Node
    const r = validateExternalUrl('https://github.com\x00.evil.com')
    expect(r.ok).toBe(false)
  })

  it('rejects overly long URLs', () => {
    expect(validateExternalUrl('https://example.com/' + 'a'.repeat(3000)).ok).toBe(false)
  })
})
