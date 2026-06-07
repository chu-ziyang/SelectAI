import { useEffect, useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter, KeyboardSensor,
  PointerSensor, useSensor, useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Settings2, Play, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react'
import { useActionStore } from '@/stores/actionStore'
import { useModelStore } from '@/stores/modelStore'
import EmptyState from '@/components/EmptyState'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import type { ActionConfig } from '@/types/models'
import ActionIcon from '@/components/ActionIcon'
import ActionEditModal from './ActionEditModal'
import { useI18n } from '@/i18n/useI18n'

// ---- 可排序的动作项 ----
function SortableActionItem({
  action, onEdit, onToggle, onDelete,
}: {
  action: ActionConfig
  onEdit: () => void
  onToggle: (enabled: boolean) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 拖拽时原位降到 0.4 透明度而不是 0，既给"位置被占"的提示，又不会让前后项视觉上跳
    opacity: isDragging ? 0.4 : 1,
  }

  const disabled = !action.enabled

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`panel flex items-center gap-3 px-4 py-3.5 ${disabled ? 'opacity-70' : ''}`}
    >
      {/* 拖拽手柄 */}
      <button
        {...attributes}
        {...listeners}
        aria-label="拖拽"
        className="cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
      >
        <GripVertical size={18} />
      </button>

      {/* 图标 + 名称 */}
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--fill-tertiary)] text-[var(--text-secondary)] ${disabled ? 'grayscale opacity-60' : ''}`}>
        <ActionIcon icon={action.icon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{action.name}</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{action.description}</p>
      </div>

      {/* 使用模型 */}
      <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--fill-tertiary)] px-2 py-1 rounded-lg whitespace-nowrap">
        {action.modelMode === 'default' ? t('action.followDefault') : t('action.specificModel')}
      </span>

      {/* 操作按钮 */}
      <button onClick={onEdit} className="rounded-xl p-2 transition-colors hover:bg-[var(--fill-tertiary)]" title={t('common.edit')}>
        <Settings2 size={16} className="text-[var(--text-secondary)]" />
      </button>
      <button
        onClick={() => onToggle(!action.enabled)}
        className={`p-2 rounded-xl transition-colors ${action.enabled ? 'text-[#34C759] hover:bg-[#34C759]/10' : 'text-[var(--text-tertiary)] hover:bg-[var(--fill-tertiary)]'}`}
        title={action.enabled ? t('models.disabled') : t('models.enabled')}
      >
        {action.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button
        onClick={onDelete}
        className="p-2 rounded-xl transition-colors text-[var(--text-tertiary)] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
        title={t('common.delete')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

// ---- 拖拽时显示的浮动预览（用 DragOverlay 接管视觉） ----
function ActionDragPreview({ action }: { action: ActionConfig }) {
  const { t } = useI18n()
  const disabled = !action.enabled
  return (
    <div
      className={`panel flex items-center gap-3 px-4 py-3.5 shadow-ios-lg ring-1 ring-[#007AFF]/30 ${disabled ? 'opacity-70' : ''}`}
    >
      <GripVertical size={18} className="text-[var(--text-tertiary)]" />
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--fill-tertiary)] text-[var(--text-secondary)] ${disabled ? 'grayscale opacity-60' : ''}`}>
        <ActionIcon icon={action.icon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{action.name}</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{action.description}</p>
      </div>
      <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--fill-tertiary)] px-2 py-1 rounded-lg whitespace-nowrap">
        {action.modelMode === 'default' ? t('action.followDefault') : t('action.specificModel')}
      </span>
    </div>
  )
}

// ---- 分隔标签 ----
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-2 px-1 text-xs font-medium text-[var(--text-secondary)] first:mt-0">
      {children}
    </p>
  )
}

// ---- 禁用区空槽位 drop zone ----
function DisabledDropZone({ label }: { label: string }) {
  const { t } = useI18n()
  const { isOver, setNodeRef } = useDroppable({ id: 'disabled-zone' })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-dashed py-6 text-center text-xs transition-all ${
        isOver
          ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]'
          : 'border-[var(--separator)] bg-[var(--fill-tertiary)]/40 text-[var(--text-tertiary)]'
      }`}
    >
      {isOver ? t('actions.dropHere') : label}
    </div>
  )
}

// ---- 启用区空槽位 drop zone（全部禁用时反向拖动启用） ----
function EnabledDropZone({ label }: { label: string }) {
  const { t } = useI18n()
  const { isOver, setNodeRef } = useDroppable({ id: 'enabled-zone' })
  return (
    <div
      ref={setNodeRef}
      className={`mt-3 rounded-xl border border-dashed py-4 text-center text-xs transition-all ${
        isOver
          ? 'border-[#34C759] bg-[#34C759]/10 text-[#34C759]'
          : 'border-[var(--separator)] bg-[var(--fill-tertiary)]/40 text-[var(--text-tertiary)]'
      }`}
    >
      {isOver ? t('actions.dropToEnableActive') : label}
    </div>
  )
}

// ---- 主页面 ----
export default function ActionManager() {
  const { t } = useI18n()
  const { actions, loadActions, updateAction, toggleAction, moveAction, resetDefaults, removeAction } = useActionStore()
  const { providers } = useModelStore()
  const { addToast } = useToast()

  const [editingAction, setEditingAction] = useState<ActionConfig | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingAction, setDeletingAction] = useState<ActionConfig | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  useEffect(() => { loadActions() }, [loadActions])

  // 拆分两个区段
  const enabledItems = useMemo(
    () => actions.filter((a) => a.enabled).sort((a, b) => a.order - b.order),
    [actions],
  )
  const disabledItems = useMemo(
    () => actions.filter((a) => !a.enabled),
    [actions],
  )

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 当前正在拖拽的动作
  const activeDragAction = activeDragId ? actions.find((a) => a.id === activeDragId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  // 每个 SortableContext 各自重排；跨区只能通过 drop zone 显式 toggle
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const action = actions.find((a) => a.id === active.id)
    if (!action) return

    // 跨区：拖到 disabled-zone → 禁用
    if (over.id === 'disabled-zone' && action.enabled) {
      toggleAction(action.id, false)
      return
    }
    // 跨区：拖到 enabled-zone → 启用
    if (over.id === 'enabled-zone' && !action.enabled) {
      toggleAction(action.id, true)
      return
    }

    // 同区内重排：只处理从启用→启用 或 禁用→禁用
    if (active.id === over.id) return
    const isFromEnabled = action.enabled
    const overAction = actions.find((a) => a.id === over.id)
    if (!overAction) return
    const isToEnabled = overAction.enabled

    if (isFromEnabled === isToEnabled) {
      // 同区：reorder
      if (isFromEnabled) {
        const fromIdx = enabledItems.findIndex((a) => a.id === active.id)
        const toIdx = enabledItems.findIndex((a) => a.id === over.id)
        if (fromIdx < 0 || toIdx < 0) return
        moveAction(action.id, toIdx, true)
      } else {
        const fromIdx = disabledItems.findIndex((a) => a.id === active.id)
        const toIdx = disabledItems.findIndex((a) => a.id === over.id)
        if (fromIdx < 0 || toIdx < 0) return
        moveAction(action.id, enabledItems.length + toIdx, false)
      }
    } else {
      // 跨区：拖到对方区段某个项目上，视为该区段的 drop 行为（启用 / 禁用）
      toggleAction(action.id, isToEnabled)
    }
  }

  const handleReset = async () => {
    await resetDefaults()
    addToast('success', t('actions.resetDone'))
  }

  const handleConfirmDelete = async () => {
    if (!deletingAction) return
    const name = deletingAction.name
    await removeAction(deletingAction.id)
    setDeletingAction(null)
    addToast('success', t('action.deleted', { name }))
  }

  const hasModels = providers.some((p) => (p.models || []).length > 0)

  return (
    <div className="page-shell">
      {/* 标题 */}
      <div className="page-header">
        <div>
          <h2 className="page-title">{t('actions.title')}</h2>
          <p className="page-subtitle">{t('actions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="toolbar-button-muted"
          >
            <RotateCcw size={14} className="inline mr-1" />
            {t('actions.resetDefault')}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="toolbar-button-primary"
          >
            <Plus size={16} />
            {t('actions.addAction')}
          </button>
        </div>
      </div>

      {/* 空状态 */}
      {actions.length === 0 && (
        <EmptyState
          icon={<Play size={28} className="text-[var(--text-tertiary)]" />}
          title={t('actions.emptyTitle')}
          description={t('actions.emptyDesc')}
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#007AFF] text-white text-sm font-medium rounded-xl hover:bg-[#0066D6] active:scale-95 transition-all shadow-ios-sm"
            >
              {t('actions.addAction')}
            </button>
          }
        />
      )}

      {/* 两个独立 SortableContext：同区重排自由，跨区只能通过 drop zone 切换启用/禁用 */}
      {actions.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 已启用 */}
          <SectionLabel>{t('actions.enabled')}</SectionLabel>
          {enabledItems.length > 0 ? (
            <SortableContext items={enabledItems.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-2">
                {enabledItems.map((action) => (
                  <SortableActionItem
                    key={action.id}
                    action={action}
                    onEdit={() => setEditingAction(action)}
                    onToggle={(enabled) => toggleAction(action.id, enabled)}
                    onDelete={() => setDeletingAction(action)}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <EnabledDropZone label={t('actions.dropToEnable')} />
          )}

          {/* 已禁用 */}
          {enabledItems.length > 0 && <SectionLabel>{t('actions.disabled')}</SectionLabel>}
          {disabledItems.length > 0 ? (
            <SortableContext items={disabledItems.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {disabledItems.map((action) => (
                  <SortableActionItem
                    key={action.id}
                    action={action}
                    onEdit={() => setEditingAction(action)}
                    onToggle={(enabled) => toggleAction(action.id, enabled)}
                    onDelete={() => setDeletingAction(action)}
                  />
                ))}
              </div>
            </SortableContext>
          ) : enabledItems.length > 0 ? (
            <DisabledDropZone label={t('actions.dropToDisable')} />
          ) : null}

          {/* DragOverlay 浮动预览 —— 宽度自适应内容，无变形 */}
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
            {activeDragAction ? <ActionDragPreview action={activeDragAction} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* 编辑弹窗 */}
      <ActionEditModal
        action={editingAction}
        open={!!editingAction}
        onClose={() => setEditingAction(null)}
        onSave={async (id, updates) => {
          await updateAction(id, updates)
          setEditingAction(null)
          addToast('success', t('action.saved'))
        }}
        hasModels={hasModels}
      />

      {/* 添加弹窗 */}
      <ActionEditModal
        action={null}
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={async (_, data) => {
          await useActionStore.getState().addAction(data as any)
          setShowAddModal(false)
          addToast('success', t('action.added'))
        }}
        hasModels={hasModels}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={!!deletingAction}
        danger
        title={t('action.deleteTitle')}
        message={t('action.deleteConfirm', { name: deletingAction?.name || '' })}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onCancel={() => setDeletingAction(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
