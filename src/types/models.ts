// ==================== 模型管理 ====================

export interface ModelConfig {
  id: string
  displayName: string
  providerId: string
  enabled: boolean
  isDefault: boolean
  isReasoning: boolean
  supportsStreaming: boolean
  contextWindow?: number
  maxOutputTokens?: number
}

export type ProviderType =
  | 'openai' | 'anthropic' | 'gemini'
  | 'deepseek' | 'qwen' | 'glm' | 'kimi' | 'sensenova' | 'mistral'
  | 'wenxin' | 'hunyuan' | 'spark' | 'baichuan' | 'stepfun' | 'minimax'
  | 'custom'

export interface ProviderConfig {
  id: string
  type: ProviderType
  name: string
  baseUrl: string
  apiKeyEncrypted: string
  models: ModelConfig[]
  createdAt: string
  updatedAt: string
}

export interface PresetProvider {
  type: ProviderType
  name: string
  baseUrl: string
  /** 该厂商申请 API Key 的官方页面（用于弹窗内跳转） */
  apiKeyUrl?: string
  /** 是否常用（默认置顶展示，其余藏在"展开更多"里） */
  featured?: boolean
}

export const PRESET_PROVIDERS: PresetProvider[] = [
  // 常用厂商 —— 16 个全部展示
  { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyUrl: 'https://platform.openai.com/api-keys' },
  { type: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKeyUrl: 'https://console.anthropic.com/settings/keys' },
  { type: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKeyUrl: 'https://aistudio.google.com/apikey' },
  { type: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKeyUrl: 'https://platform.deepseek.com/api_keys' },
  { type: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey' },
  { type: 'glm', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyUrl: 'https://bigmodel.cn/user-center/apikeys' },
  { type: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', apiKeyUrl: 'https://platform.moonshot.cn/console/users/me/api-keys' },
  { type: 'sensenova', name: '商汤日日新', baseUrl: 'https://api.sensenova.cn/compatible-mode/v1', apiKeyUrl: 'https://platform.sensenova.cn/doc?path=/platform/ApplicationGuide/AccountManagement/ApiKey' },
  { type: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', apiKeyUrl: 'https://console.mistral.ai/api-keys' },
  { type: 'wenxin', name: '文心一言', baseUrl: 'https://qianfan.baidubce.com/v2', apiKeyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/apiKey' },
  { type: 'hunyuan', name: '混元', baseUrl: 'https://api.hunyuan.tencent.com/v1', apiKeyUrl: 'https://console.cloud.tencent.com/hunyuan/apikey' },
  { type: 'spark', name: '讯飞星火', baseUrl: 'https://spark-api-open.xf-yun.com/v1', apiKeyUrl: 'https://console.xfyun.cn/services/bm35' },
  { type: 'baichuan', name: '百川', baseUrl: 'https://api.baichuan-ai.com/v1', apiKeyUrl: 'https://platform.baichuan-ai.com/console/index/apikey' },
  { type: 'stepfun', name: '阶跃星辰', baseUrl: 'https://api.stepfun.com/v1', apiKeyUrl: 'https://platform.stepfun.com/keys' },
  { type: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', apiKeyUrl: 'https://api.minimax.chat/user-center/basic-information/interface-key' },
]

// ==================== 动作管理 ====================

export interface ActionConfig {
  id: string
  name: string
  icon: string
  description: string
  enabled: boolean
  order: number
  type: 'preset' | 'custom'
  systemPrompt: string
  modelMode: 'default' | 'specific'
  modelId?: string
  parameters?: {
    targetLanguage?: string
    tone?: string
    audience?: string
    temperature?: number
    maxTokens?: number
  }
}

export const PRESET_ACTIONS: Omit<ActionConfig, 'id' | 'order'>[] = [
  {
    name: '翻译',
    icon: 'Languages',
    description: '将选中文字翻译为目标语言',
    enabled: true,
    type: 'preset',
    systemPrompt: '你是一个专业的翻译助手。请将以下文字翻译为英文，保持原意准确、语言流畅自然。\n\n{{selected_text}}',
    modelMode: 'default',
    parameters: { targetLanguage: '英文', temperature: 0.3 },
  },
  {
    name: '总结',
    icon: 'FileText',
    description: '对选中内容进行概括提炼',
    enabled: true,
    type: 'preset',
    systemPrompt: '你是一个擅长总结的助手。请用简洁的语言总结以下内容的核心要点，用 3-5 条要点呈现，每条不超过一句话。\n\n{{selected_text}}',
    modelMode: 'default',
    parameters: { tone: '简洁', temperature: 0.3 },
  },
  {
    name: '解释',
    icon: 'Lightbulb',
    description: '用通俗语言解释选中内容',
    enabled: true,
    type: 'preset',
    systemPrompt: '你是一个善于解释复杂概念的老师。请用通俗易懂的语言解释以下内容，让普通人也能轻松理解。如果涉及专业术语，请用类比或生活中的例子来解释。\n\n{{selected_text}}',
    modelMode: 'default',
    parameters: { audience: '普通人', temperature: 0.5 },
  },
  {
    name: '查词',
    icon: 'BookOpen',
    description: '词典式查询，含释义和例句',
    enabled: true,
    type: 'preset',
    systemPrompt: '你是一个词典查询助手。请对以下单词或短语给出：1) 音标或拼音 2) 中文释义 3) 词性 4) 两个实用例句（中英对照）。\n\n{{selected_text}}',
    modelMode: 'default',
    parameters: { temperature: 0.3 },
  },
]

// ==================== 软件设置 ====================

export interface AppSettings {
  autoStart: boolean
  startMinimized: boolean
  closeToTray: boolean
  autoPopup: boolean
  ctrlHoldPopup: boolean
  minTriggerLength: number
  appBlacklist: string[]
  language: 'zh-CN' | 'en-US'
  clipboardTrigger: boolean
  saveHistory: boolean
  historyRetentionDays: 7 | 14 | 30 | 90
  theme: 'light' | 'dark' | 'system'
  fontScale: 'small' | 'medium' | 'large' | 'xl' | 'xxl' | 'xxxl'
  fontFamily: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoStart: false,
  startMinimized: true,
  closeToTray: true,
  autoPopup: true,
  ctrlHoldPopup: true,
  minTriggerLength: 3,
  appBlacklist: [],
  language: 'zh-CN',
  clipboardTrigger: false,
  saveHistory: true,
  historyRetentionDays: 30,
  theme: 'system',
  fontScale: 'medium',
  fontFamily: 'system',
}

// ==================== 弹窗设置 ====================

export type LayoutMode = 'horizontal' | 'vertical' | 'icon-only'
export type Placement =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right'
export type AnimationType = 'fade' | 'scale' | 'slide-down' | 'slide-up' | 'none'

export interface PopupSettings {
  width: number
  maxHeight: number
  padding: number
  opacity: number
  layout: LayoutMode
  cornerRadius: number
  iconSize: number
  showButtonBackground: boolean
  showHoverEffect: boolean
  placement: Placement
  offsetX: number
  offsetY: number
  avoidScreenEdge: boolean
  followMouse: boolean
  enterAnimation: AnimationType
  exitAnimation: AnimationType
  animationDurationMs: number
  clickOutsideClose: boolean
  escClose: boolean
  autoHide: boolean
  autoHideSeconds: number
  replaceOnNewSelect: boolean
  pinned: boolean
}

export const DEFAULT_POPUP_SETTINGS: PopupSettings = {
  width: 320,
  maxHeight: 400,
  padding: 16,
  opacity: 100,
  layout: 'horizontal',
  cornerRadius: 12,
  iconSize: 20,
  showButtonBackground: true,
  showHoverEffect: true,
  placement: 'bottom-right',
  offsetX: 0,
  offsetY: 8,
  avoidScreenEdge: true,
  followMouse: true,
  enterAnimation: 'scale',
  exitAnimation: 'fade',
  animationDurationMs: 200,
  clickOutsideClose: true,
  escClose: true,
  autoHide: false,
  autoHideSeconds: 5,
  replaceOnNewSelect: true,
  pinned: false,
}

// ==================== 历史记录 ====================

export interface HistoryRecord {
  id: string
  selectedText: string
  actionId: string
  actionName: string
  providerId: string
  modelId: string
  resultText: string
  status: 'success' | 'failed' | 'cancelled'
  errorMessage?: string
  latencyMs: number
  createdAt: string
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

// ==================== 聊天消息 ====================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export type PopupSessionStatus = 'hidden' | 'toolbar' | 'preparing' | 'streaming' | 'done' | 'error'

export interface PopupSession {
  id: string
  selectedText: string
  action: ActionConfig | null
  providerId: string | null
  modelId: string | null
  status: PopupSessionStatus
  messages: ChatMessage[]
  streamText: string
  error: string | null
  startedAt: number | null
  latencyMs: number | null
  tokenUsage: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  } | null
}
