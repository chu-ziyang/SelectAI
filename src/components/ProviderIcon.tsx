import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import type { ProviderType } from '@/types/models'

const CDN_BASE = 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons'

// lobehub 图标库里各家厂商对应的 svg 文件名（找不到时自动回退到 Cpu）
const ICON_FILE: Partial<Record<ProviderType, string>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini',
  deepseek: 'deepseek',
  qwen: 'qwen',
  glm: 'chatglm',
  kimi: 'kimi',
  sensenova: 'sensenova',
  mistral: 'mistral',
  wenxin: 'wenxin',
  hunyuan: 'hunyuan',
  spark: 'spark',
  baichuan: 'baichuan',
  stepfun: 'stepfun',
  minimax: 'minimax',
}

// 各家品牌色 —— SVG 用 fill=currentColor，必须内联后用 color 属性着色
const BRAND_COLOR: Partial<Record<ProviderType, string>> = {
  openai: '#10A37F',
  anthropic: '#D97757',
  gemini: '#4285F4',
  deepseek: '#4D7FFF',
  qwen: '#615CED',
  glm: '#3451B2',
  kimi: '#111111',
  sensenova: '#FF6B00',
  mistral: '#FA520F',
  wenxin: '#2932E1',
  hunyuan: '#0064D2',
  spark: '#1E6EEB',
  baichuan: '#2563EB',
  stepfun: '#1F4FD8',
  minimax: '#FF6B35',
  custom: '#6B7280',
}

// 进程内缓存：按 URL 复用 SVG 文本，避免重复请求
const svgCache = new Map<string, string>()

interface Props {
  type: ProviderType
  size?: 'sm' | 'md' | 'lg'
}

export default function ProviderIcon({ type, size = 'md' }: Props) {
  const file = ICON_FILE[type]
  const iconUrl = file ? `${CDN_BASE}/${file}.svg` : undefined
  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size]
  const boxSize = { sm: 32, md: 40, lg: 48 }[size]
  const imgSize = { sm: 20, md: 24, lg: 28 }[size]
  const brandColor = BRAND_COLOR[type] || 'currentColor'

  const [svg, setSvg] = useState<string | null>(() => (iconUrl ? svgCache.get(iconUrl) ?? null : null))

  useEffect(() => {
    if (!iconUrl) { setSvg(null); return }
    if (svgCache.has(iconUrl)) { setSvg(svgCache.get(iconUrl)!); return }
    let cancelled = false
    fetch(iconUrl)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return
        // 去掉 XML 声明和 width/height 属性，方便 CSS 控制尺寸
        const cleaned = text
          .replace(/<\?xml[^?]*\?>/g, '')
          .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, '$1')
          .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, '$1')
        svgCache.set(iconUrl, cleaned)
        setSvg(cleaned)
      })
      .catch(() => { if (!cancelled) setSvg(null) })
    return () => { cancelled = true }
  }, [iconUrl])

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center`}
      style={{ color: brandColor }}
    >
      {svg ? (
        <span
          aria-hidden="true"
          style={{ display: 'inline-flex', width: imgSize, height: imgSize }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <Cpu size={imgSize - 6} className="text-[var(--text-secondary)]" />
      )}
    </span>
  )
}
