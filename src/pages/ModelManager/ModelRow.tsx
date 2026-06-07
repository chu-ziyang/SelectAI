import { Brain, CheckCircle2, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ModelConfig } from '@/types/models'
import { useI18n } from '@/i18n/useI18n'

interface Props {
  model: ModelConfig
  isDefault: boolean
  testResult?: { ok: boolean; latencyMs?: number; error?: string } | null
  onToggle: (enabled: boolean) => void
  onSetDefault: () => void
  onToggleReasoning: (isReasoning: boolean) => void
}

export default function ModelRow({
  model, isDefault, testResult,
  onToggle, onSetDefault, onToggleReasoning,
}: Props) {
  const { t } = useI18n()

  return (
    <tr className={`group h-12 border-b border-[var(--separator)] last:border-0 hover:bg-[var(--fill-tertiary)]/60 ${isDefault ? 'bg-[#007AFF]/5' : ''}`}>
      <td className="h-12 px-3 py-0 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          {/* 默认模型小指示点 */}
          {isDefault && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#007AFF]" />}
          <span className="truncate text-sm font-medium leading-none text-[var(--text-primary)]">{model.displayName}</span>
          <AnimatePresence initial={false}>
            {model.isReasoning && (
              <motion.span
                key="reasoning-chip"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md bg-[#AF52DE]/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#AF52DE]"
              >
                <Brain size={9} strokeWidth={2.4} />
                {t('models.reasoning')}
              </motion.span>
            )}
          </AnimatePresence>
          {/* 测试结果 chip：延时 + 成功/失败（仅在点过测试按钮后显示） */}
          {testResult && (
            <span
              title={testResult.ok ? `连接成功 · 延时 ${testResult.latencyMs}ms` : (testResult.error || '连接失败')}
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                testResult.ok
                  ? 'bg-[#34C759]/10 text-[#34C759]'
                  : 'bg-[#FF3B30]/10 text-[#FF3B30]'
              }`}
            >
              {testResult.ok
                ? <CheckCircle2 size={9} strokeWidth={2.4} />
                : <XCircle size={9} strokeWidth={2.4} />}
              {testResult.ok ? `${testResult.latencyMs ?? 0}ms` : '失败'}
            </span>
          )}
          {/* 复制 ID 按钮已移除 */}
        </div>
      </td>
      <td className="h-12 px-3 py-0 align-middle">
        <div className="flex h-full items-center gap-2">
          {/* 启用开关 —— 收窄过渡属性，避免与父级 transition 冲突 */}
          <button
            onClick={() => onToggle(!model.enabled)}
            disabled={isDefault}
            title={isDefault ? t('provider.cantDisableDefault') : model.enabled ? t('models.disabled') : t('models.enabled')}
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-75 ${
              model.enabled ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white dark:bg-[#F2F2F7] rounded-full shadow-sm transition-[left] duration-200 ease-out ${
              model.enabled ? 'left-[18px]' : 'left-0.5'
            }`} />
          </button>
          <span className="text-xs text-[var(--text-secondary)]">
            {model.enabled ? t('models.enabled') : t('models.disabled')}
          </span>
        </div>
      </td>
      <td className="h-12 px-3 py-0 align-middle">
        <div className="flex h-full items-center gap-3">
          {/* 默认模型 */}
          <button
            onClick={onSetDefault}
            disabled={isDefault}
            title={isDefault ? t('models.defaultModel') : t('models.default')}
            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors duration-200 disabled:cursor-default ${
              isDefault ? 'border-[#007AFF] bg-[#007AFF]' : 'border-[var(--text-tertiary)] hover:border-[#007AFF]'
            }`}
          >
            {isDefault && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#F2F2F7]" />}
          </button>
          <span className="text-xs text-[var(--text-secondary)]">{t('models.default')}</span>
        </div>
      </td>
      <td className="h-12 px-3 py-0 text-center align-middle">
        <div className="flex h-full items-center justify-center">
          <button
            onClick={() => onToggleReasoning(!model.isReasoning)}
            aria-pressed={model.isReasoning}
            title={model.isReasoning ? '关闭思考模式' : '开启思考模式'}
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
              model.isReasoning ? 'bg-[#AF52DE]' : 'bg-[var(--text-tertiary)]'
            }`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out dark:bg-[#F2F2F7] ${
              model.isReasoning ? 'left-[18px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      </td>
    </tr>
  )
}
