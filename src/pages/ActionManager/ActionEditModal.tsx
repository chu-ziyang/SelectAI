import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Wand2, CheckCircle2, XCircle, Plus } from 'lucide-react'
import type { ActionConfig } from '@/types/models'
import { useModelStore } from '@/stores/modelStore'
import { useChatStore } from '@/stores/chatStore'
import { extractVariables } from '@/services/promptEngine'
import { useI18n } from '@/i18n/useI18n'
import SelectMenu from '@/components/SelectMenu'
import ActionIcon, { ICON_LIBRARY, isLibraryIcon } from '@/components/ActionIcon'

interface Props {
  action: ActionConfig | null
  open: boolean
  onClose: () => void
  onSave: (id: string, updates: Partial<ActionConfig>) => Promise<void>
  hasModels: boolean
}

export default function ActionEditModal({ action, open, onClose, onSave, hasModels }: Props) {
  const { t } = useI18n()
  const { providers } = useModelStore()
  const chatStore = useChatStore()

  const isNew = !action
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Sparkles')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelMode, setModelMode] = useState<'default' | 'specific'>('default')
  const [modelId, setModelId] = useState('')
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [showCustomIcon, setShowCustomIcon] = useState(false)
  const [customIcon, setCustomIcon] = useState('')

  const isCustomIcon = (ic: string) => !isLibraryIcon(ic)

  // 初始化表单
  useEffect(() => {
    if (action) {
      setName(action.name)
      setIcon(action.icon)
      setDescription(action.description)
      setSystemPrompt(action.systemPrompt)
      setModelMode(action.modelMode)
      setModelId(action.modelId || '')
      // 如果当前图标不在预设列表中，自动展开自定义输入
      if (isCustomIcon(action.icon)) {
        setShowCustomIcon(true)
        setCustomIcon(action.icon)
      } else {
        setShowCustomIcon(false)
        setCustomIcon('')
      }
    } else {
      setName('')
      setIcon('Sparkles')
      setDescription('')
      setSystemPrompt('请对以下文字进行处理：\n\n{{selected_text}}')
      setModelMode('default')
      setModelId('')
      setShowCustomIcon(false)
      setCustomIcon('')
    }
    setTestStatus(null)
  }, [action, open])

  const enabledModels = providers.flatMap((p) =>
    (p.models || []).filter((m) => m.enabled).map((m) => ({
      ...m,
      providerName: p.name,
    })),
  )

  const variables = extractVariables(systemPrompt)

  const handleSave = async () => {
    if (!name.trim()) return
    await onSave(action?.id || 'new', {
      name: name.trim(),
      icon,
      description: description.trim(),
      systemPrompt,
      modelMode,
      modelId: modelMode === 'specific' ? modelId : undefined,
    })
  }

  const handleTest = async () => {
    if (!hasModels) {
      setTestStatus({ ok: false, message: t('action.noModel') })
      return
    }

    // 选择模型
    let targetModel: { providerId: string; modelId: string } | null = null
    if (modelMode === 'specific' && modelId) {
      for (const p of providers) {
        const m = (p.models || []).find((m2) => m2.id === modelId)
        if (m) { targetModel = { providerId: p.id, modelId: m.id }; break }
      }
    }
    if (!targetModel) {
      // 使用默认模型
      for (const p of providers) {
        const m = (p.models || []).find((m2) => m2.isDefault && m2.enabled)
        if (m) { targetModel = { providerId: p.id, modelId: m.id }; break }
      }
    }
    if (!targetModel) {
      for (const p of providers) {
        const m = (p.models || []).find((m2) => m2.enabled)
        if (m) { targetModel = { providerId: p.id, modelId: m.id }; break }
      }
    }
    if (!targetModel) {
      setTestStatus({ ok: false, message: t('action.noAvailableModel') })
      return
    }

    const sampleText = '人工智能正在改变我们的工作方式。'
    const result = await chatStore.sendMessage({
      providerId: targetModel.providerId,
      modelId: targetModel.modelId,
      systemPrompt: systemPrompt.replace(/\{\{selected_text\}\}/g, sampleText),
      userText: sampleText,
    })
    setTestStatus(result.ok
      ? { ok: true, message: t('action.testPassed') }
      : { ok: false, message: result.error || t('action.testFailed') })
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-[560px] max-h-[86vh] overflow-hidden rounded-2xl border border-[var(--separator)] bg-white/95 shadow-ios-xl backdrop-blur-xl spring-in dark:bg-[var(--bg-secondary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--separator)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{isNew ? t('action.addTitle') : t('action.editTitle')}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t('action.editSubtitle')}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--fill-tertiary)]">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(86vh-132px)] space-y-4 overflow-y-auto px-6 py-5">
          {/* 名称 */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('action.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('action.namePlaceholder')}
              className="field-surface w-full"
              disabled={action?.type === 'preset'}
            />
          </div>

          {/* 图标选择 */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('action.icon')}</label>
            <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto p-1">
              {ICON_LIBRARY.map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => { setIcon(key); setShowCustomIcon(false) }}
                  title={key}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all shrink-0 ${
                    icon === key
                      ? 'border-[#007AFF] bg-[#007AFF]/10 scale-110 text-[#007AFF]'
                      : 'border-[var(--separator)] text-[var(--text-secondary)] hover:border-[#007AFF]/30 hover:bg-[var(--fill-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.8} />
                </button>
              ))}
              {/* 自定义图标入口 */}
              <button
                onClick={() => { setShowCustomIcon(!showCustomIcon); if (!showCustomIcon) setCustomIcon(isCustomIcon(icon) ? icon : '') }}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all shrink-0 ${
                  isCustomIcon(icon)
                    ? 'border-[#007AFF] bg-[#007AFF]/10 scale-110 border-solid text-[#007AFF]'
                    : showCustomIcon
                      ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] border-solid'
                      : 'border-[var(--text-tertiary)]/40 text-[var(--text-tertiary)] hover:border-[#007AFF]/30 hover:text-[var(--text-secondary)] border-dashed'
                }`}
                title={t('action.customIcon')}
              >
                {isCustomIcon(icon) ? <ActionIcon icon={icon} size={16} /> : <Plus size={16} />}
              </button>
            </div>
            {/* 自定义图标输入 — 当前图标为自定义时始终显示 */}
            {(showCustomIcon || isCustomIcon(icon)) && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  placeholder={t('action.customIconPlaceholder')}
                  maxLength={20}
                  className="field-surface flex-1 text-sm"
                />
                <button
                  onClick={() => { if (customIcon.trim()) { setIcon(customIcon.trim()); setShowCustomIcon(false) } }}
                  disabled={!customIcon.trim()}
                  className="toolbar-button-primary text-xs"
                >
                  {t('action.confirm')}
                </button>
              </div>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('action.description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('action.descPlaceholder')}
              className="field-surface w-full"
            />
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                System Prompt
              </label>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {t('action.variables')}：{variables.length > 0 ? variables.join(', ') : t('action.noVariables')}
              </span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              className="field-surface w-full resize-none font-mono text-xs"
              placeholder={t('action.promptPlaceholder')}
            />
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
              {t('action.promptHint')}
            </p>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('action.model')}</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setModelMode('default')}
                className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  modelMode === 'default' ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]' : 'border-[var(--separator)] text-[var(--text-secondary)]'
                }`}
              >
                {t('action.followDefault')}
              </button>
              <button
                onClick={() => setModelMode('specific')}
                className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  modelMode === 'specific' ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]' : 'border-[var(--separator)] text-[var(--text-secondary)]'
                }`}
              >
                {t('action.specificModel')}
              </button>
            </div>
            {modelMode === 'specific' && (
              <SelectMenu
                value={modelId}
                options={[
                  { value: '', label: t('action.selectModel') },
                  ...enabledModels.map((m) => ({
                    value: m.id,
                    label: `${m.providerName} / ${m.displayName}${m.isReasoning ? ` (${t('common.reasoning')})` : ''}`,
                  })),
                ]}
                onChange={setModelId}
                className="w-full"
              />
            )}
          </div>

          {/* 单按钮测试 */}
          <div className="rounded-xl border border-[var(--separator)] bg-[var(--bg-primary)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t('action.test')}</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t('action.testDesc')}</p>
              </div>
            <button
              onClick={handleTest}
              disabled={chatStore.isStreaming || !systemPrompt.trim()}
              className="toolbar-button-primary shrink-0"
            >
              {chatStore.isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {t('action.testBtn')}
            </button>
            </div>
            {testStatus && (
              <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                testStatus.ok ? 'bg-[#34C759]/10 text-[#1F9D55]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
              }`}>
                {testStatus.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

          {/* 操作按钮 —— 内联在表单底部，贴近最后一项 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--separator)]">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-colors">
              {t('action.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-xl hover:bg-[#0066D6] active:scale-95 transition-all shadow-ios-sm disabled:opacity-40"
            >
              {isNew ? t('action.add') : t('action.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
