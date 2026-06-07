import { type ReactNode, useState, useEffect } from 'react'
import {
  ArrowDown, ArrowDownLeft, ArrowDownRight,
  ArrowLeft, ArrowRight,
  ArrowUp, ArrowUpLeft, ArrowUpRight,
  ChevronDown, Circle, Copy,
  Move, PinOff, RotateCcw, Sparkles,
  Timer, Wand2,
} from 'lucide-react'
import { useI18n } from '@/i18n/useI18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useActionStore } from '@/stores/actionStore'
import SelectionToolbar from '@/popup/SelectionToolbar'
import { DEFAULT_POPUP_SETTINGS } from '@/types/models'
import type { AnimationType, LayoutMode, Placement, PopupSettings as PS } from '@/types/models'

const PLACEMENTS: Placement[] = [
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
]

const P_ICON: Record<Placement, typeof ArrowUp> = {
  'top-left': ArrowUpLeft,
  top: ArrowUp,
  'top-right': ArrowUpRight,
  left: ArrowLeft,
  center: Circle,
  right: ArrowRight,
  'bottom-left': ArrowDownLeft,
  bottom: ArrowDown,
  'bottom-right': ArrowDownRight,
}

const PREVIEW_COPY = {
  'zh-CN': {
    reset: '恢复默认',
    stats: { width: '宽度', opacity: '透明度', animation: '动画' },
    currentPlacement: '当前在{placement}',
    text: 'AI 助手正在成为写作、阅读和研究流程里的轻量协作者。',
    selected: ['它们可以减少重复劳动，同时让用户始终掌控', '判断、语气和上下文。'],
    resultTitle: '翻译',
    resultBody: 'AI 助手正逐渐成为写作、阅读和研究流程里的轻量协作者。',
    followUp: '继续追问...',
    placement: {
      'top-left': '左上',
      top: '上方',
      'top-right': '右上',
      left: '左侧',
      center: '居中',
      right: '右侧',
      'bottom-left': '左下',
      bottom: '下方',
      'bottom-right': '右下',
    },
  },
  'en-US': {
    reset: 'Reset',
    stats: { width: 'Width', opacity: 'Opacity', animation: 'Animation' },
    currentPlacement: 'Currently {placement}',
    text: 'AI assistants are becoming lightweight collaborators across writing, reading, and research workflows.',
    selected: ['They can reduce repetitive work while keeping the user in control of', 'decisions, tone, and context.'],
    resultTitle: 'Translate',
    resultBody: 'AI assistants are becoming lightweight collaborators across writing, reading, and research workflows.',
    followUp: 'Ask follow-up...',
    placement: {
      'top-left': 'Top left',
      top: 'Top',
      'top-right': 'Top right',
      left: 'Left',
      center: 'Center',
      right: 'Right',
      'bottom-left': 'Bottom left',
      bottom: 'Bottom',
      'bottom-right': 'Bottom right',
    },
  },
} as const

type Option<T extends string | number> = { v: T; label: string }
type PreviewCopy = (typeof PREVIEW_COPY)[keyof typeof PREVIEW_COPY]

function Section({ title, children, icon: Icon }: { title: string; children: ReactNode; icon?: typeof Sparkles }) {
  return (
    <section className="psp-section">
      <div className="psp-section-title">
        {Icon && <Icon size={14} />}
        <span>{title}</span>
      </div>
      <div className="psp-section-body">{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: ReactNode
}) {
  return (
    <div className="psp-row">
      <div className="psp-row-copy">
        <span className="psp-row-title">{title}</span>
        {desc && <span className="psp-row-desc">{desc}</span>}
      </div>
      <div className="psp-row-control">{children}</div>
    </div>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="psp-segmented">
      {options.map((option) => (
        <button
          key={option.v}
          onClick={() => onChange(option.v)}
          className={`psp-segmented-item ${value === option.v ? 'is-active' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`psp-switch ${checked ? 'is-on' : ''}`}
    >
      <span />
    </button>
  )
}

function SliderControl({
  min,
  max,
  step = 1,
  value,
  suffix = '',
  inputWidth = 58,
  onChange,
}: {
  min: number
  max: number
  step?: number
  value: number
  suffix?: string
  inputWidth?: number
  onChange: (value: number) => void
}) {
  const commit = (nextValue: number) => {
    if (Number.isNaN(nextValue)) return
    const clamped = Math.min(max, Math.max(min, nextValue))
    onChange(clamped)
  }

  return (
    <div className="psp-slider-control">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => commit(Number(event.target.value))}
      />
      <label className="psp-number-field" style={{ width: inputWidth }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => commit(Number(event.target.value))}
        />
        {suffix && <span>{suffix}</span>}
      </label>
    </div>
  )
}

function SelectMenu<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.v === value) ?? options[0]

  return (
    <div className="psp-select-menu">
      <button
        type="button"
        className={`psp-select-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((next) => !next)}
      >
        <span>{selected.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="psp-select-popover">
          {options.map((option) => (
            <button
              key={option.v}
              type="button"
              className={`psp-select-option ${option.v === value ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(option.v)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.v === value && <span className="psp-select-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Preview({ popup, copy }: { popup: PS; copy: PreviewCopy }) {
  const { actions } = useActionStore()
  const enabledActions = actions
    .filter((a) => a.enabled)
    .sort((a, b) => a.order - b.order)
    .map((a) => ({ id: a.id, name: a.name, icon: a.icon }))

  const previewWidth = Math.min(Math.max(popup.width, 300), 420)
  const previewHeight = Math.min(Math.max(Math.round(popup.maxHeight * 0.36), 144), 210)
  const previewOpacity = Math.max(0.45, popup.opacity / 100)

  return (
    <div className="ppv">
      {/* 用 max-width 跟随列宽自适应，避免列被内容撑大而与右栏重叠 */}
      <div className="ppv-window" style={{ width: '100%', maxWidth: previewWidth }}>
        <div className="ppv-document">
          <p>{copy.text}</p>
          <p className="ppv-selected-text">
            {copy.selected.map((line) => <span key={line}>{line}</span>)}
          </p>
        </div>
      </div>

      <div
        className="ppv-toolbar-wrap"
        style={{ width: '100%', maxWidth: previewWidth, opacity: previewOpacity }}
      >
        <SelectionToolbar
          preview
          actions={enabledActions}
          popup={popup}
          emptyText=""
        />
      </div>

      <div
        className="ppv-result"
        style={{
          width: '100%',
          maxWidth: previewWidth,
          height: previewHeight,
          borderRadius: popup.cornerRadius,
          padding: popup.padding,
          opacity: previewOpacity,
        }}
      >
        <div className="ppv-result-head">
          <span style={{ fontSize: 13 }}>{enabledActions[0]?.icon ?? '📝'}</span>
          <strong>{copy.resultTitle}</strong>
          <em>deepseek-chat</em>
          <button><Copy size={12} /></button>
          <button><RotateCcw size={12} /></button>
          <button><PinOff size={12} /></button>
        </div>
        <div className="ppv-result-body">
          {copy.resultBody}
        </div>
      </div>
    </div>
  )
}

export default function PopupSettings() {
  const { lang, t } = useI18n()
  const { popup, updatePopup } = useSettingsStore()
  const { loadActions } = useActionStore()
  const previewCopy = PREVIEW_COPY[lang]
  const styleValue: Extract<LayoutMode, 'horizontal' | 'icon-only'> = popup.layout === 'icon-only' ? 'icon-only' : 'horizontal'

  useEffect(() => { loadActions() }, [])

  const up = (updates: Partial<PS>) => { void updatePopup(updates) }
  const reset = () => { void updatePopup(DEFAULT_POPUP_SETTINGS) }

  return (
    <div className="page-shell psp-shell">
      <div className="psp-hero">
        <div>
          <h2 className="page-title">{t('popup.title')}</h2>
          <p className="page-subtitle">{t('popup.subtitle')}</p>
        </div>
        <button onClick={reset} className="psp-reset" title={previewCopy.reset}>
          <RotateCcw size={15} />
          <span>{previewCopy.reset}</span>
        </button>
      </div>

      <div className="psp-layout">
        <aside className="psp-preview">
          <Preview popup={popup} copy={previewCopy} />
        </aside>

        <div className="psp-panel">
          <Section title="外观" icon={Sparkles}>
            <SettingRow title="样式" desc="工具栏按钮的排列方式">
              <Segmented<Extract<LayoutMode, 'horizontal' | 'icon-only'>>
                value={styleValue}
                options={[
                  { v: 'horizontal', label: '标准' },
                  { v: 'icon-only', label: '简洁' },
                ]}
                onChange={(layout) => up({ layout })}
              />
            </SettingRow>

            <SettingRow title="大小" desc="同步调整结果窗宽高">
              <SliderControl
                min={260}
                max={520}
                step={10}
                value={popup.width}
                suffix="px"
                inputWidth={72}
                onChange={(width) => up({ width, maxHeight: Math.round(width * 1.25) })}
              />
            </SettingRow>

            <SettingRow title="圆角">
              <SliderControl
                min={6}
                max={24}
                value={popup.cornerRadius}
                suffix="px"
                inputWidth={64}
                onChange={(cornerRadius) => up({ cornerRadius })}
              />
            </SettingRow>

            <SettingRow title="透明度">
              <SliderControl
                min={50}
                max={100}
                value={popup.opacity}
                suffix="%"
                inputWidth={64}
                onChange={(opacity) => up({ opacity })}
              />
            </SettingRow>

            <SettingRow title="按钮背景">
              <Switch checked={popup.showButtonBackground} onChange={() => up({ showButtonBackground: !popup.showButtonBackground })} />
            </SettingRow>

            <SettingRow title="悬停反馈">
              <Switch checked={popup.showHoverEffect} onChange={() => up({ showHoverEffect: !popup.showHoverEffect })} />
            </SettingRow>
          </Section>

          <Section title="位置" icon={Move}>
            <SettingRow
              title="相对选中文字"
              desc={previewCopy.currentPlacement.replace('{placement}', previewCopy.placement[popup.placement])}
            >
              <div className="ppos">
                {PLACEMENTS.map((placement) => {
                  const Icon = P_ICON[placement]
                  const active = popup.placement === placement
                  return (
                    <button
                      key={placement}
                      onClick={() => up({ placement })}
                      className={`ppos-cell ${active ? 'is-active' : ''}`}
                      title={previewCopy.placement[placement]}
                    >
                      <Icon size={14} strokeWidth={active ? 2.4 : 1.7} />
                    </button>
                  )
                })}
              </div>
            </SettingRow>
            <SettingRow title="水平偏移">
              <SliderControl min={-60} max={60} step={2} value={popup.offsetX} onChange={(offsetX) => up({ offsetX })} />
            </SettingRow>
            <SettingRow title="垂直偏移">
              <SliderControl min={-60} max={60} step={2} value={popup.offsetY} onChange={(offsetY) => up({ offsetY })} />
            </SettingRow>
            <SettingRow title="智能避让">
              <Switch checked={popup.avoidScreenEdge} onChange={() => up({ avoidScreenEdge: !popup.avoidScreenEdge })} />
            </SettingRow>
            <SettingRow title="鼠标吸附">
              <Switch checked={popup.followMouse} onChange={() => up({ followMouse: !popup.followMouse })} />
            </SettingRow>
          </Section>

          <Section title="关闭" icon={Timer}>
            <SettingRow title="点击外部关闭" desc="在别处点击时收起弹窗">
              <Switch checked={popup.clickOutsideClose} onChange={() => up({ clickOutsideClose: !popup.clickOutsideClose })} />
            </SettingRow>
            <SettingRow title="Esc 关闭">
              <Switch checked={popup.escClose} onChange={() => up({ escClose: !popup.escClose })} />
            </SettingRow>
            <SettingRow title="无操作自动关闭" desc={popup.autoHide ? `${popup.autoHideSeconds} 秒后关闭` : '保持直到用户关闭'}>
              <Switch checked={popup.autoHide} onChange={() => up({ autoHide: !popup.autoHide })} />
            </SettingRow>
            {popup.autoHide && (
              <SettingRow title="等待时长">
                <SliderControl min={3} max={15} value={popup.autoHideSeconds} suffix="s" onChange={(autoHideSeconds) => up({ autoHideSeconds })} />
              </SettingRow>
            )}
            <SettingRow title="新选中替换">
              <Switch checked={popup.replaceOnNewSelect} onChange={() => up({ replaceOnNewSelect: !popup.replaceOnNewSelect })} />
            </SettingRow>
          </Section>

          <Section title="细节与动画" icon={Wand2}>
            <SettingRow title="图标大小">
              <SliderControl min={16} max={32} value={popup.iconSize} onChange={(iconSize) => up({ iconSize })} />
            </SettingRow>
            <SettingRow title="内边距">
              <SliderControl min={8} max={32} step={2} value={popup.padding} onChange={(padding) => up({ padding })} />
            </SettingRow>
            <SettingRow title="进入动画">
              <SelectMenu<AnimationType>
                value={popup.enterAnimation}
                options={[
                  { v: 'scale', label: '缩放弹出' },
                  { v: 'fade', label: '淡入' },
                  { v: 'slide-down', label: '下滑入' },
                  { v: 'none', label: '无动画' },
                ]}
                onChange={(enterAnimation) => up({ enterAnimation })}
              />
            </SettingRow>
            <SettingRow title="退出动画">
              <SelectMenu<AnimationType>
                value={popup.exitAnimation}
                options={[
                  { v: 'fade', label: '淡出' },
                  { v: 'scale', label: '缩小消失' },
                  { v: 'slide-up', label: '上滑出' },
                  { v: 'none', label: '无动画' },
                ]}
                onChange={(exitAnimation) => up({ exitAnimation })}
              />
            </SettingRow>
            <SettingRow title="动画时长">
              <SliderControl
                min={100}
                max={400}
                step={50}
                value={popup.animationDurationMs}
                suffix="ms"
                inputWidth={74}
                onChange={(animationDurationMs) => up({ animationDurationMs })}
              />
            </SettingRow>
          </Section>
        </div>
      </div>
    </div>
  )
}




