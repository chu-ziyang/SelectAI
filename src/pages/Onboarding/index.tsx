import { useState } from 'react'
import { ArrowRight, Check, Key, MousePointer2, Zap } from 'lucide-react'

const STEPS = [
  {
    icon: Key,
    title: '配置 AI 模型',
    description: '添加 API Key，连接你喜欢的 AI 大模型。支持 OpenAI、DeepSeek、通义千问、智谱 GLM 等。',
    emoji: '🔑',
  },
  {
    icon: Zap,
    title: '选择你的动作',
    description: '翻译、总结、解释、查词——选择你常用的操作，也可以自定义专属动作。',
    emoji: '⚡',
  },
  {
    icon: MousePointer2,
    title: '试试划词吧',
    description: '在任意软件中选中文字，按下 Ctrl+Shift+Q 呼出弹窗，体验 AI 辅助的便捷！',
    emoji: '✨',
  },
]

interface Props {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  const current = STEPS[step]

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
      <div className="w-[400px] text-center">
        {/* 大图标 */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-[24px] bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-ios-lg">
          <span className="text-4xl">{current.emoji}</span>
        </div>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{current.title}</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-8 px-4">{current.description}</p>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-[#007AFF] w-6' : i < step ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'
              }`}
            />
          ))}
        </div>

        {/* 按钮 */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
          >
            跳过
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-[#007AFF] text-white text-sm font-medium rounded-xl hover:bg-[#0066D6] active:scale-95 transition-all shadow-ios-sm"
          >
            {step < STEPS.length - 1 ? (
              <>下一步 <ArrowRight size={14} /></>
            ) : (
              <>开始使用 <Check size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
