import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, sortableKeyboardCoordinates,
  arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  X, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  ExternalLink, ArrowLeft, Check, GripVertical,
} from 'lucide-react'
import { useModelStore } from '@/stores/modelStore'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n/useI18n'
import { PRESET_PROVIDERS, type ProviderType, type ModelConfig, type PresetProvider } from '@/types/models'
import ProviderIcon from '@/components/ProviderIcon'

type CustomProtocol = 'openai' | 'anthropic' | 'custom'
type Stage = 'select' | 'fill'

interface Props {
  open: boolean
  onClose: () => void
}

// 可拖拽的厂商卡
function SortableProviderCard({ preset, onClick }: { preset: PresetProvider; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.type })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={onClick}
        className="w-full min-h-[88px] px-1.5 py-2.5 rounded-xl text-xs font-medium border-2 border-transparent transition-all flex flex-col items-center justify-center gap-1.5 text-[var(--text-secondary)] hover:border-[#007AFF]/30 hover:bg-[#007AFF]/5 hover:text-[var(--text-primary)] active:scale-[0.97] touch-none select-none"
      >
        <ProviderIcon type={preset.type} size="md" />
        <span className="leading-tight text-center line-clamp-1">{preset.name}</span>
        {/* 拖拽提示图标 —— 鼠标悬停时显示 */}
        <GripVertical size={10} className="absolute opacity-0 transition-opacity group-hover:opacity-40" />
      </button>
    </div>
  )
}

export default function AddProviderModal({ open, onClose }: Props) {
  const { t } = useI18n()
  const addProvider = useModelStore((s) => s.addProvider)
  const fetchModels = useModelStore((s) => s.fetchModels)
  const { addToast } = useToast()
  const defaultProvider = PRESET_PROVIDERS.find((p) => p.type === 'deepseek')

  const [stage, setStage] = useState<Stage>('select')
  const [providerType, setProviderType] = useState<ProviderType>('deepseek')
  const [name, setName] = useState(defaultProvider?.name || '')
  const [baseUrl, setBaseUrl] = useState(defaultProvider?.baseUrl || '')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [customProtocol, setCustomProtocol] = useState<CustomProtocol>('openai')

  // 厂商排序状态（持久化到 localStorage）
  const [order, setOrder] = useState<ProviderType[]>(() => {
    try {
      const saved = localStorage.getItem('addProviderModal:providerOrder')
      if (saved) {
        const parsed = JSON.parse(saved) as ProviderType[]
        const validIds = new Set(PRESET_PROVIDERS.map((p) => p.type))
        // 过滤掉已删除的厂商，追加任何新厂商到末尾
        const filtered = parsed.filter((t) => validIds.has(t))
        const missing = PRESET_PROVIDERS.map((p) => p.type).filter((t) => !filtered.includes(t))
        return [...filtered, ...missing]
      }
    } catch {}
    return PRESET_PROVIDERS.map((p) => p.type)
  })

  const [fetchedModels, setFetchedModels] = useState<ModelConfig[]>([])

  // 按用户排序后的厂商列表
  const orderedProviders = useMemo(
    () => order
      .map((t) => PRESET_PROVIDERS.find((p) => p.type === t))
      .filter((p): p is PresetProvider => Boolean(p)),
    [order],
  )

  const isCustom = providerType === 'custom'
  const currentPreset = !isCustom ? PRESET_PROVIDERS.find((p) => p.type === providerType) : undefined
  const apiKeyUrl = currentPreset?.apiKeyUrl
  const selectedLabel = isCustom ? t('provider.custom') : (currentPreset?.name || providerType)

  // 自定义厂商协议预设
  const PROTOCOL_PRESETS: Record<CustomProtocol, { label: string; url: string }> = {
    openai: { label: t('provider.protocol.openai'), url: 'https://api.openai.com/v1' },
    anthropic: { label: t('provider.protocol.anthropic'), url: 'https://api.anthropic.com/v1' },
    custom: { label: t('provider.protocol.custom'), url: '' },
  }

  useEffect(() => {
    if (!open) return
    setStage('select')
    setProviderType('deepseek')
    setName(defaultProvider?.name || '')
    setBaseUrl(defaultProvider?.baseUrl || '')
    setApiKey('')
    setShowKey(false)
    setTestResult(null)
    setIsTesting(false)
    setIsSaving(false)
    setFetchedModels([])
    setCustomProtocol('openai')
  }, [defaultProvider?.baseUrl, defaultProvider?.name, open])

  // 拖拽传感器（必须在 early return 之前调用，遵守 Hooks 规则）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 拖拽结束 —— 重新排序
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as ProviderType)
    const newIndex = order.indexOf(over.id as ProviderType)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(order, oldIndex, newIndex)
    setOrder(newOrder)
    try { localStorage.setItem('addProviderModal:providerOrder', JSON.stringify(newOrder)) } catch {}
  }

  if (!open) return null

  // 打开外部链接 —— 走系统默认浏览器
  const openApiKeyUrl = async () => {
    if (!apiKeyUrl) return
    const result = await window.electronAPI?.shell?.openExternal?.(apiKeyUrl)
    if (result && !result.ok) addToast('error', result.error || '打开链接失败')
  }

  const handlePickProvider = (type: ProviderType) => {
    setProviderType(type)
    if (type === 'custom') {
      setName('')
      setBaseUrl(PROTOCOL_PRESETS[customProtocol].url)
    } else {
      const preset = PRESET_PROVIDERS.find((p) => p.type === type)
      setName(preset?.name || '')
      setBaseUrl(preset?.baseUrl || '')
    }
    setApiKey('')
    setTestResult(null)
    setFetchedModels([])
    setStage('fill')
  }

  const handleProtocolChange = (p: CustomProtocol) => {
    setCustomProtocol(p)
    setBaseUrl(PROTOCOL_PRESETS[p].url)
    setTestResult(null)
    setFetchedModels([])
  }

  const handleTestAndFetch = async () => {
    if (!apiKey.trim()) { addToast('warning', t('provider.keyRequired')); return }
    setIsTesting(true)
    setTestResult(null)
    setFetchedModels([])

    const result = await window.electronAPI?.provider.testConfig({
      type: providerType, name: name || providerType,
      baseUrl: baseUrl || 'https://api.openai.com/v1', apiKey: apiKey.trim(),
    })
    setIsTesting(false)

    if (!result?.ok) { setTestResult({ ok: false, error: result?.error || '连接失败' }); return }

    setTestResult({ ok: true })
    const resultWithModels = result as { ok: boolean; models?: any[]; error?: string }
    if (resultWithModels.models && Array.isArray(resultWithModels.models)) {
      const models: ModelConfig[] = resultWithModels.models.map((m: any) => ({
        id: m.id, displayName: m.displayName || m.id,
        providerId: 'preview', enabled: true, isDefault: false,
        isReasoning: m.isReasoning || false, supportsStreaming: true,
      }))
      if (models.length > 0) models[0].isDefault = true
      setFetchedModels(models)
      addToast('success', `${t('provider.fetchedModels')}：${models.length}${t('provider.modelsFound')}`)
    }
  }

  const toggleModel = (id: string, key: 'enabled' | 'isReasoning', val: boolean) => {
    setFetchedModels((prev) => prev.map((m) => m.id === id ? { ...m, [key]: val } : m))
  }

  const setDefaultModel = (id: string) => {
    setFetchedModels((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id, enabled: m.id === id ? true : m.enabled })))
  }

  const handleSave = async () => {
    if (!apiKey.trim()) { addToast('warning', t('provider.keyRequired')); return }
    if (isCustom && (!name.trim() || !baseUrl.trim())) {
      addToast('warning', t('provider.fillAllFields'))
      return
    }
    setIsSaving(true)
    const result = await addProvider({
      type: providerType, name: name || providerType,
      baseUrl: baseUrl || 'https://api.openai.com/v1', apiKey: apiKey.trim(),
    })
    if (!result.ok) { setIsSaving(false); addToast('error', result.error || t('provider.addFailed')); return }

    const providerId = (result as any).provider?.id
    const displayName = name || providerType
    if (providerId) {
      const fetchResult = await fetchModels(providerId)
      setIsSaving(false)
      if (fetchResult.ok) {
        addToast('success', `${t('provider.added', { name: displayName })}，${fetchResult.count || 0}${t('provider.modelsFound')}`)
      } else {
        addToast('success', t('provider.added', { name: displayName }))
      }
    } else {
      setIsSaving(false)
      addToast('success', t('provider.added', { name: displayName }))
    }
    onClose()
  }

  const enabledCount = fetchedModels.filter((m) => m.enabled).length

  // 旧 renderProviderCard 已由 SortableProviderCard 取代

  // 测试按钮
  const renderTestButton = () => (
    <button
      onClick={handleTestAndFetch}
      disabled={isTesting || !apiKey.trim()}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        testResult?.ok ? 'text-[#34C759] bg-[#34C759]/8'
          : testResult && !testResult.ok ? 'text-[#FF3B30] bg-[#FF3B30]/8'
          : 'text-[#007AFF] hover:bg-[#007AFF]/8'
      }`}
    >
      {isTesting ? <><Loader2 size={13} className="animate-spin" />测试中...</>
        : testResult?.ok ? <><CheckCircle2 size={13} />{t('provider.connectionOk')} · {fetchedModels.length}{t('provider.modelsFound')}</>
        : testResult && !testResult.ok ? <><XCircle size={13} />{testResult.error || '连接失败'}</>
        : <><CheckCircle2 size={13} />{t('provider.testConfig')}</>}
    </button>
  )

  // 模型预览
  const renderModelPreview = () => (
    <AnimatePresence mode="wait">
      {fetchedModels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="rounded-2xl border border-[#34C759]/20 bg-[#34C759]/5 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={15} className="text-[#34C759]" />
            <span className="text-sm font-semibold">{fetchedModels.length}{t('provider.modelsFound')}</span>
            <span className="text-xs text-[var(--text-tertiary)]">({t('models.enabledCount')} {enabledCount})</span>
          </div>
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
            {fetchedModels.map((model) => (
              <div key={model.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[var(--fill-tertiary)] hover:bg-white dark:hover:bg-[var(--bg-primary)] transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate block">{model.displayName}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] truncate block">{model.id}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-[10px] text-[var(--text-tertiary)]">{t('models.enabled')}</span>
                    <button onClick={() => toggleModel(model.id, 'enabled', !model.enabled)} disabled={model.isDefault}
                      className={`relative h-4 w-7 rounded-full transition-colors disabled:opacity-50 ${model.enabled ? 'bg-[#34C759]' : 'bg-[var(--text-tertiary)]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white dark:bg-[#F2F2F7] rounded-full shadow-sm transition-all ${model.enabled ? 'left-[13px]' : 'left-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-[10px] text-[var(--text-tertiary)]">{t('models.default')}</span>
                    <button onClick={() => setDefaultModel(model.id)}
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${model.isDefault ? 'border-[#007AFF] bg-[#007AFF]' : 'border-[var(--text-tertiary)] hover:border-[#007AFF]'}`}>
                      {model.isDefault && <div className="w-1 h-1 rounded-full bg-white dark:bg-[#F2F2F7]" />}
                    </button>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-[10px] text-[var(--text-tertiary)]">{t('models.reasoning')}</span>
                    <button onClick={() => toggleModel(model.id, 'isReasoning', !model.isReasoning)}
                      className={`relative h-4 w-7 rounded-full transition-colors ${model.isReasoning ? 'bg-[#AF52DE]' : 'bg-[var(--text-tertiary)]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white dark:bg-[#F2F2F7] rounded-full shadow-sm transition-all ${model.isReasoning ? 'left-[13px]' : 'left-0.5'}`} />
                    </button>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // =================== Stage 1: 选择厂商 ===================
  const renderStageSelect = () => {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedProviders.map((p) => p.type)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2.5">
            {orderedProviders.map((p) => (
              <SortableProviderCard
                key={p.type}
                preset={p}
                onClick={() => handlePickProvider(p.type)}
              />
            ))}
            {/* 自定义 —— 永远作为最末 cell，不可拖拽 */}
            <button
              onClick={() => handlePickProvider('custom')}
              className="min-h-[88px] px-1.5 py-2.5 rounded-xl text-xs font-medium border-2 border-dashed border-[var(--separator)] transition-all flex flex-col items-center justify-center gap-1.5 text-[var(--text-secondary)] hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 hover:text-[var(--text-primary)] active:scale-[0.97]"
            >
              <ProviderIcon type="custom" size="md" />
              <span className="leading-tight text-center line-clamp-1">{t('provider.custom')}</span>
            </button>
          </div>
        </SortableContext>
        <p className="mt-3 text-center text-[11px] text-[var(--text-tertiary)]">{t('provider.dragHint')}</p>
      </DndContext>
    )
  }

  // =================== Stage 2: 填写详情 ===================
  const renderStageFill = () => (
    <div className="space-y-4">
      {/* 顶部"已选"小条 —— 一键切回 stage 1 */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/5 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ProviderIcon type={providerType} size="sm" />
          <span className="text-[11px] text-[var(--text-tertiary)]">{t('provider.selected')}</span>
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedLabel}</span>
          <Check size={12} className="text-[#34C759]" />
        </div>
        <button
          onClick={() => setStage('select')}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#007AFF] transition-colors hover:bg-[#007AFF]/10"
        >
          <ArrowLeft size={11} />
          {t('provider.change')}
        </button>
      </div>

      {isCustom ? (
        <>
          {/* 名称 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.displayName')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('provider.namePlaceholder')} className="field-surface w-full" />
          </div>

          {/* 协议 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.protocol')}</label>
            <select
              value={customProtocol}
              onChange={(e) => handleProtocolChange(e.target.value as CustomProtocol)}
              className="field-surface w-full"
            >
              {Object.entries(PROTOCOL_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* 地址 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{t('provider.apiAddress')}</label>
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="field-surface w-full font-mono" />
          </div>
        </>
      ) : null}

      {/* API Key + 测试 —— 优先显示主要输入 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-secondary)]">{t('provider.apiKey')}</label>
          {renderTestButton()}
        </div>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="field-surface w-full pr-10" />
          <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--fill-tertiary)] rounded-lg transition-colors">
            {showKey ? <EyeOff size={16} className="text-[var(--text-tertiary)]" /> : <Eye size={16} className="text-[var(--text-tertiary)]" />}
          </button>
        </div>
        {/* 次要入口 —— 没有 Key? 去官网获取（走系统浏览器） */}
        {apiKeyUrl && (
          <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <span>{t('provider.noKey')}</span>
            <button
              type="button"
              onClick={openApiKeyUrl}
              className="inline-flex items-center gap-0.5 text-[#007AFF] transition-colors hover:underline"
            >
              {t('provider.getOne')}
              <ExternalLink size={10} className="opacity-70" />
            </button>
          </div>
        )}
      </div>

      {renderModelPreview()}
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-[560px] max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-[var(--separator)] bg-white/95 shadow-ios-xl backdrop-blur-xl spring-in dark:bg-[var(--bg-secondary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--separator)]">
          <div>
            <h3 className="text-lg font-semibold">
              {stage === 'fill' && !isCustom && currentPreset ? currentPreset.name
                : stage === 'fill' && isCustom ? t('provider.custom')
                : t('provider.addTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {stage === 'select' ? t('provider.addSubtitle') : t('provider.apiKey')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--fill-tertiary)]">
            <X size={18} />
          </button>
        </div>

        {/* 主体 —— 两屏切换 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="popLayout" initial={false}>
            {stage === 'select' ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderStageSelect()}
              </motion.div>
            ) : (
              <motion.div
                key="fill"
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderStageFill()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部 —— 始终渲染以稳定模态框高度；Stage 1 仅取消，Stage 2 取消+保存 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--separator)]">
          {stage === 'fill' ? (
            <>
              <button onClick={() => setStage('select')} className="toolbar-button-muted px-4 py-2 text-sm">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !apiKey.trim() || (isCustom && (!name.trim() || !baseUrl.trim()))}
                className="toolbar-button-primary px-5 py-2 text-sm disabled:opacity-40"
              >
                {isSaving && <Loader2 size={14} className="mr-1 inline animate-spin" />}
                {t('common.save')}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="toolbar-button-muted px-4 py-2 text-sm">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
