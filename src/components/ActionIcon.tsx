import {
  // 文字处理
  Languages, FileText, BookOpen, Pencil, Type, Quote,
  // 思考
  Brain, Lightbulb, Atom, Sigma, Sparkles, Wand2,
  // 搜索分析
  Search, BarChart3, Calculator, FileSearch, Code, Hash,
  // 创意
  Image, Music, Video, Mic, Palette, MessageSquare,
  // 标记
  Tag, Bookmark, Star, Heart, Bell, Globe,
  // 其他
  Send, Bot, GitBranch, Briefcase, Calendar, Clock,
} from 'lucide-react'

/** 动作图标库 —— key 存到 store，渲染时按 key 查组件 */
export const ICON_LIBRARY: { key: string; Icon: typeof Languages }[] = [
  { key: 'Languages', Icon: Languages },
  { key: 'FileText', Icon: FileText },
  { key: 'BookOpen', Icon: BookOpen },
  { key: 'Pencil', Icon: Pencil },
  { key: 'Type', Icon: Type },
  { key: 'Quote', Icon: Quote },
  { key: 'Brain', Icon: Brain },
  { key: 'Lightbulb', Icon: Lightbulb },
  { key: 'Atom', Icon: Atom },
  { key: 'Sigma', Icon: Sigma },
  { key: 'Sparkles', Icon: Sparkles },
  { key: 'Wand2', Icon: Wand2 },
  { key: 'Search', Icon: Search },
  { key: 'ChartBar', Icon: BarChart3 },
  { key: 'Calculator', Icon: Calculator },
  { key: 'FileSearch', Icon: FileSearch },
  { key: 'Code', Icon: Code },
  { key: 'Hash', Icon: Hash },
  { key: 'Image', Icon: Image },
  { key: 'Music', Icon: Music },
  { key: 'Video', Icon: Video },
  { key: 'Mic', Icon: Mic },
  { key: 'Palette', Icon: Palette },
  { key: 'MessageSquare', Icon: MessageSquare },
  { key: 'Tag', Icon: Tag },
  { key: 'Bookmark', Icon: Bookmark },
  { key: 'Star', Icon: Star },
  { key: 'Heart', Icon: Heart },
  { key: 'Bell', Icon: Bell },
  { key: 'Globe', Icon: Globe },
  { key: 'Send', Icon: Send },
  { key: 'Bot', Icon: Bot },
  { key: 'GitBranch', Icon: GitBranch },
  { key: 'Briefcase', Icon: Briefcase },
  { key: 'Calendar', Icon: Calendar },
  { key: 'Clock', Icon: Clock },
]

const ICON_MAP = new Map(ICON_LIBRARY.map((i) => [i.key, i.Icon]))

/** 渲染动作图标：key → lucide 组件；其他（emoji）→ 文本降级 */
export default function ActionIcon({ icon, size = 18, className = '' }: { icon: string; size?: number; className?: string }) {
  const Comp = ICON_MAP.get(icon)
  if (Comp) return <Comp size={size} className={className} strokeWidth={1.8} />
  return <span className={className} style={{ fontSize: size }}>{icon}</span>
}

export function isLibraryIcon(icon: string): boolean {
  return ICON_MAP.has(icon)
}
