# 划词助手 — MVP 开发任务清单

> 基于 `docs/requirements.md` v1.2  
> 每个里程碑输出一个**可运行版本**，每个任务标注产出文件和验收条件。  
> 任务可直接交给 Claude Code / Codex 逐条实现。

---

## 里程碑总览

| 里程碑 | 目标 | 任务数 | 预计产出 |
|--------|------|--------|----------|
| M0 | 项目骨架 — 能启动 Electron + React | 6 | 主窗口 + 路由 + Tailwind 主题 |
| M1 | 配置闭环 — 能配置模型并测试连接 | 8 | 模型管理页面完整可用 |
| M2 | AI 请求闭环 — 能输入文本返回 AI 结果 | 6 | API 服务层 + 手动测试页 |
| M3 | 弹窗闭环 — 能唤起悬浮弹窗 | 7 | 快捷键触发 + 悬浮弹窗 + 动作按钮 + 结果面板 |
| M4 | 动作系统 — 能自定义动作与 Prompt | 6 | 动作管理页面 + 变量替换 |
| M5 | 设置与历史 — 形成完整可用产品 | 8 | 设置页 + 历史记录 + 托盘 + 引导页 |
| M6 | 打包发布 — 可安装可升级 | 5 | Windows 安装包 + 日志 |

---

## M0 · 项目骨架

> 目标：`npm run dev` 能启动带 Electron 壳的 React 页面，Tailwind 生效，路由可用。

### 任务 M0-1：安装依赖

**产出：** `node_modules/` 目录

```bash
npm install
```

**验收：** 无报错，`node_modules` 生成。

---

### 任务 M0-2：创建 HTML 入口 + React 挂载点

**产出文件：**
- `index.html`
- `src/main.tsx`
- `src/styles/global.css`

**要求：**
- `index.html`：标准 HTML5，`<div id="root">`，引入 `src/main.tsx`
- `src/main.tsx`：`ReactDOM.createRoot` 渲染 `<App />`，引入 `global.css`
- `src/styles/global.css`：`@tailwind base/components/utilities`，设置 `body` 字体、背景色，定义 CSS 变量（`--ios-blue: #007AFF` 等）

**验收：** Vite 启动后页面不白屏。

---

### 任务 M0-3：创建 App 根组件 + 路由框架

**产出文件：**
- `src/App.tsx`

**要求：**
- 左侧导航栏（图标 + 文字）：模型管理 / 动作管理 / 历史记录 / 软件设置 / 弹窗设置
- 右侧内容区：`<Routes>` 切换 5 个页面
- 使用 `react-router-dom` HashRouter
- 窗口标题栏：自定义拖拽区（`-webkit-app-region: drag`）+ 最小化/关闭按钮

**验收：** 5 个标签页可切换，左侧高亮当前页。

---

### 任务 M0-4：创建 6 个页面占位组件

**产出文件：**
- `src/pages/ModelManager/index.tsx`
- `src/pages/ActionManager/index.tsx`
- `src/pages/History/index.tsx`
- `src/pages/AppSettings/index.tsx`
- `src/pages/PopupSettings/index.tsx`
- `src/pages/Onboarding/index.tsx`
- `src/popup/PopupApp.tsx`（悬浮弹窗入口）

**要求：** 每个文件导出一个组件，显示该页面名称标题。内部逻辑后续补充。

**验收：** 切换标签页时标题变化，无 404。

---

### 任务 M0-5：TypeScript 类型声明文件

**产出文件：**
- `src/types/electron.d.ts`（`ElectronAPI` 接口声明）
- `src/types/models.ts`（`ProviderConfig`、`ModelConfig`、`ActionConfig`、`AppSettings`、`PopupSettings`、`HistoryRecord` 接口，按 v1.2 需求文档 §3.6 定义）

**验收：** `tsc --noEmit` 无类型错误。

---

### 任务 M0-6：验证 M0 可运行

**操作：**
```bash
npm run dev:renderer  # Vite 正常运行
npm run dev:main      # Electron 窗口启动
```

**验收：**
- [ ] Electron 窗口出现，显示主界面
- [ ] 左侧导航可点击切换
- [ ] Tailwind 样式生效
- [ ] 窗口可拖拽、最小化、关闭

---

## M1 · 配置闭环

> 目标：模型管理页面完整可用——添加厂商、拉取模型、设默认、测试连接、Key 加密存储。

### 任务 M1-1：完善 electron/store.ts

**产出文件：** `electron/store.ts`（修改）

**要求：**
- 使用 `safeStorage` 加密 apiKey
- 提供 `getDecryptedKey(providerId)` / `setEncryptedKey(providerId, key)` 方法
- 默认配置使用需求文档 §3.6 的数据结构

**验收：** 本地存储文件中不出现明文 Key。

---

### 任务 M1-2：实现 IPC 通道 — 存储 + 厂商管理

**产出文件：** `electron/main.ts`（修改，新增 IPC handler）

**IPC 通道：**
| Channel | 方向 | 功能 |
|---------|------|------|
| `store:get` | Renderer→Main | 读配置 |
| `store:set` | Renderer→Main | 写配置 |
| `provider:add` | Renderer→Main | 添加厂商 |
| `provider:remove` | Renderer→Main | 删除厂商 |
| `provider:list` | Renderer→Main | 列出所有厂商 |
| `provider:test` | Renderer→Main | 测试 API 连通性 |
| `provider:list-models` | Renderer→Main | 拉取模型列表 |

**验收：** `provider:test` 返回 `{ ok: true }` 或 `{ ok: false, error: '...' }`。

---

### 任务 M1-3：创建 API Service 层

**产出文件：**
- `src/services/api.ts`（通用 fetch + 流式请求）
- `src/services/providers.ts`（OpenAI / DeepSeek / Qwen / GLM adapter）

**要求：**
- `api.ts` 暴露 `chatCompletion(params)` 和 `chatCompletionStream(params, onChunk)` 两个方法
- `providers.ts` 提供 `fetchModels(providerConfig)` 和 `testConnection(providerConfig)` 
- 统一请求头、超时（30s）、错误处理

**验收：** 传入有效 API Key 能正常请求并返回模型列表。

---

### 任务 M1-4：创建模型管理 Zustand Store

**产出文件：** `src/stores/modelStore.ts`

**要求：**
- `providers: ProviderConfig[]`
- `defaultModelId: string | null`
- Actions: `addProvider` / `removeProvider` / `updateProvider` / `fetchModels` / `testConnection` / `setDefaultModel` / `toggleModel` / `toggleReasoning`

**验收：** 通过 DevTools 可观察状态变化。

---

### 任务 M1-5：厂商添加弹窗组件

**产出文件：** `src/pages/ModelManager/AddProviderModal.tsx`

**要求：**
- 下拉选择厂商类型（OpenAI / DeepSeek / 通义千问 / 智谱 / 自定义）
- 输入框：名称（自动填充）、API Key、Base URL（自动填充，可修改）
- [测试连接] 按钮，显示测试结果
- [保存] 按钮，保存后关闭弹窗并自动拉取模型列表

**验收：** 添加 DeepSeek Key → 点测试 → 显示"连接成功" → 点保存 → 模型列表出现。

---

### 任务 M1-6：模型管理主页面

**产出文件：**
- `src/pages/ModelManager/index.tsx`
- `src/pages/ModelManager/ProviderCard.tsx`
- `src/pages/ModelManager/ModelRow.tsx`

**要求：**
- 顶部：[+ 添加厂商] 按钮
- 厂商卡片列表：每条显示厂商名、Key（掩码）、[测试] [查看] [删除]
- 模型表格：模型名 | 启用/禁用开关 | 默认模型(radio) | 思考模型(checkbox)
- 空状态：无厂商时显示插图 + "还没有添加模型哦~"
- 加载态：骨架屏

**验收：** 符合需求文档 M-01~M-10 所有编号。

---

### 任务 M1-7：preload.ts 暴露 IPC API

**产出文件：** `electron/preload.ts`（修改）

**要求：** 按 §3.7 暴露各 IPC 通道给渲染进程。

**验收：** `window.electronAPI.store.get('key')` 可调用。

---

### 任务 M1-8：验证 M1

**验收清单：**
- [ ] 可添加 OpenAI、DeepSeek、通义千问、智谱、自定义厂商
- [ ] 测试连接返回正确状态
- [ ] 拉取模型列表正常展示
- [ ] 可设置默认模型
- [ ] 可标记/取消思考模型
- [ ] Key 掩码显示，可点击查看/隐藏
- [ ] 删除厂商同时清除模型
- [ ] 重启软件后配置不丢失

---

## M2 · AI 请求闭环

> 目标：手动输入文字 → 选择模型和动作 → 流式返回 AI 结果。

### 任务 M2-1：实现主进程 AI 请求代理

**产出文件：** `electron/main.ts`（新增 ai:* IPC handler）

**IPC 通道：**
| Channel | 方向 | 功能 |
|---------|------|------|
| `ai:chat` | Renderer→Main | 发起流式 AI 请求 |
| `ai:stream-chunk` | Main→Renderer | 逐 chunk 推送 |
| `ai:cancel` | Renderer→Main | 取消当前请求 |

**要求：**
- 主进程读取加密 Key，构建请求，不在渲染进程暴露 Key
- 流式请求使用 SSE 解析，每个 chunk 通过 IPC 推送到渲染进程
- 支持 AbortController 取消
- 错误时返回结构化错误信息

**验收：** 发送请求 → 渲染进程收到逐字流式输出。

---

### 任务 M2-2：创建聊天状态 Store

**产出文件：** `src/stores/chatStore.ts`

**要求：**
- `messages: ChatMessage[]`
- `isStreaming: boolean`
- `abortController: AbortController | null`
- Actions: `sendMessage` / `cancelRequest` / `clearMessages`

**验收：** 状态可正常更新。

---

### 任务 M2-3：Provider Adapter 完善

**产出文件：** `src/services/providers.ts`（修改）

**要求：**
- 各厂商统一请求构建：OpenAI 格式
- 处理差异：DeepSeek 的 baseUrl、Qwen 的 model 前缀、GLM 的认证头
- 超时、重试逻辑
- 错误码映射为中文提示（按 §7.1）

**验收：** 4 种预设厂商均可正常请求。

---

### 任务 M2-4：内嵌测试面板（临时，供开发验证）

**产出文件：** `src/pages/ModelManager/TestPanel.tsx`

**要求：**
- 文字输入框（多行）
- 模型选择下拉（从已启用模型读取）
- [发送] 按钮
- 结果展示区：流式输出 + Markdown 渲染
- [复制] [停止] 按钮

**验收：** 输入一段英文 → 选择 DeepSeek 模型 → 点击发送 → 看到流式输出。

---

### 任务 M2-5：Markdown 结果渲染组件

**产出文件：** `src/components/MarkdownRenderer.tsx`

**要求：**
- 支持标题、列表、代码块、粗体、斜体、链接
- 使用 `react-markdown` 或自行实现基础渲染
- 代码块有复制按钮
- 适配深色/浅色主题

**验收：** AI 返回的 Markdown 格式内容正确渲染。

---

### 任务 M2-6：验证 M2

**验收清单：**
- [ ] 手动输入文字 → 选择模型 → 发送 → 流式返回结果
- [ ] 取消请求功能正常
- [ ] 4 种预设厂商均可用
- [ ] 错误时显示中文提示 + 重试按钮
- [ ] Markdown 正确渲染（标题、列表、代码块）

---

## M3 · 弹窗闭环

> 目标：快捷键唤起悬浮弹窗 → 点击动作按钮 → AI 处理 → 流式展示结果。

### 任务 M3-1：悬浮弹窗主进程窗口

**产出文件：** `electron/windows.ts`（修改）

**要求：**
- 创建无边框、透明、置顶、不抢焦点的 BrowserWindow
- 位置：根据鼠标位置 + 弹窗设置定位
- 智能避让屏幕边缘
- 监听 blur 事件关闭（钉住模式除外）

**验收：** `createPopupWindow('hello')` 弹出正确位置的透明窗口。

---

### 任务 M3-2：悬浮弹窗 UI — 动作按钮面板

**产出文件：**
- `src/popup/PopupApp.tsx`
- `src/popup/ActionButtons.tsx`
- `src/popup/ResultPanel.tsx`

**要求：**
- 初始态：显示已启用的动作按钮（横向排列，图标+文字）
- 点击动作 → 面板切换到结果态
- 结果态：顶部显示动作名 + 原文（可编辑）+ 流式结果区 + 底部工具栏（复制/重试/钉住/关闭）
- 弹窗宽度/圆角/阴影/毛玻璃按 PopupSettings 渲染
- 动画：弹出缩放动画、消失淡出动画（Framer Motion）

**验收：** 弹窗出现 → 点击翻译 → 流式结果展示 → 复制可用。

---

### 任务 M3-3：键盘交互

**产出文件：** `src/popup/useKeyboardNav.ts`

**要求：**
- `1/2/3/4` 数字键触发第 N 个动作
- `Esc` 关闭弹窗
- `Tab` 在输入框和动作按钮间切换焦点

**验收：** 按 1 触发第一个动作，Esc 关闭弹窗。

---

### 任务 M3-4：位置计算引擎

**产出文件：** `src/popup/popupPosition.ts`

**要求：**
- 输入：鼠标位置、屏幕尺寸、弹窗尺寸、PopSettings（方位、偏移）
- 输出：`{ x, y }` 窗口坐标
- 智能避让：弹窗超出右边界 → 自动左移；超出下边界 → 自动上移
- 考虑 Windows 任务栏位置

**验收：** 鼠标在屏幕右下角时，弹窗正确显示在左上方。

---

### 任务 M3-5：快捷键触发 + 剪贴板触发

**产出文件：**
- `electron/text-selection.ts`（重写）
- `electron/shortcuts.ts`（修改）

**要求：**
- `Ctrl+Shift+Q`：读取剪贴板 → 发起弹窗
- 剪贴板监听（可选）：检测 Ctrl+C → 延迟 100ms 后读取剪贴板 → 弹窗（需先缓存原剪贴板内容并恢复）
- `Ctrl+Shift+H`：显示/隐藏主窗口
- 用户自定义快捷键支持

**验收：** 复制文字 → `Ctrl+Shift+Q` → 弹窗出现。

---

### 任务 M3-6：弹窗设置同步

**产出文件：** `src/stores/settingsStore.ts`

**要求：**
- 管理 `AppSettings` 和 `PopupSettings`
- 从 electron-store 读写
- 弹窗渲染时读取最新 PopupSettings

**验收：** 修改弹窗宽度设置 → 下次弹窗生效。

---

### 任务 M3-7：验证 M3

**验收清单：**
- [ ] Ctrl+Shift+Q 呼出弹窗
- [ ] 弹窗位置正确、不越界
- [ ] 动作按钮显示已启用的动作
- [ ] 点击动作 → 流式返回结果
- [ ] 复制按钮可用
- [ ] 图钉按钮钉住弹窗
- [ ] Esc 关闭弹窗
- [ ] 数字键快捷触发动作
- [ ] 修改弹窗设置后效果生效

---

## M4 · 动作系统

> 目标：动作管理页面完整可用——自定义动作、排序、测试、变量替换。

### 任务 M4-1：动作管理 Zustand Store

**产出文件：** `src/stores/actionStore.ts`

**要求：**
- `actions: ActionConfig[]`
- 预置 4 个动作的默认配置
- Actions: `addAction` / `removeAction` / `updateAction` / `toggleAction` / `reorderActions` / `resetDefaults`

**验收：** 初始状态有 4 个预置动作。

---

### 任务 M4-2：动作管理主页面

**产出文件：**
- `src/pages/ActionManager/index.tsx`
- `src/pages/ActionManager/ActionItem.tsx`
- `src/pages/ActionManager/ActionEditModal.tsx`

**要求：**
- 已启用动作列表：可拖拽排序（`@dnd-kit/core`）
- 每项显示：拖拽手柄、图标、名称、核心配置摘要、[启用]开关、[编辑]按钮
- 已禁用动作列表：折叠在下方
- 编辑弹窗：名称、图标选择器、描述、System Prompt（`{{selected_text}}` 变量提示）、模型选择、参数配置
- [添加自定义动作] 按钮
- [恢复默认] 按钮

**验收：** 可拖拽排序、编辑 Prompt、添加自定义动作。

---

### 任务 M4-3：System Prompt 变量替换引擎

**产出文件：** `src/services/promptEngine.ts`

**要求：**
- `compilePrompt(template: string, variables: Record<string, string>): string`
- 支持 `{{selected_text}}`、`{{target_language}}` 等变量
- 变量缺失时给出警告但不报错

**验收：** `compilePrompt("翻译: {{selected_text}}", { selected_text: "Hello" })` → `"翻译: Hello"`。

---

### 任务 M4-4：动作测试功能

**产出文件：** `src/pages/ActionManager/ActionTestPanel.tsx`

**要求：**
- 在动作编辑弹窗内嵌测试面板
- 输入示例文字 → 选择模型 → 发送 → 查看结果
- 不保存到历史记录

**验收：** 编辑翻译动作 → 输入 "Hello world" → 点测试 → 看到翻译结果。

---

### 任务 M4-5：弹窗读取动作配置

**产出文件：** `src/popup/PopupApp.tsx`（修改）

**要求：**
- 弹窗启动时从 actionStore 读取已启用、已排序的动作
- 按布局模式渲染（横向/纵向/仅图标）
- 点击动作时获取对应的 systemPrompt，结合选中文字编译后发送 AI 请求

**验收：** 新增一个自定义动作 → 弹窗中出现在列表里 → 点击可正常执行。

---

### 任务 M4-6：验证 M4

**验收清单：**
- [ ] 预置 4 个动作默认启用
- [ ] 可拖拽调整顺序
- [ ] 可禁用/启用
- [ ] 可编辑 System Prompt
- [ ] `{{selected_text}}` 变量正确替换
- [ ] 自定义动作可添加/删除
- [ ] 动作测试功能正常
- [ ] 恢复默认不删除用户数据

---

## M5 · 设置与历史

> 目标：完整可用产品 — 设置页、历史记录、托盘、引导页、异常处理全部到位。

### 任务 M5-1：设置主页面（通用 + 快捷键 + 外观 + 数据 + 关于）

**产出文件：**
- `src/pages/AppSettings/index.tsx`
- `src/pages/AppSettings/GeneralSettings.tsx`
- `src/pages/AppSettings/ShortcutSettings.tsx`
- `src/pages/AppSettings/AppearanceSettings.tsx`
- `src/pages/AppSettings/DataSettings.tsx`
- `src/pages/AppSettings/AboutSettings.tsx`

**要求：** 按需求文档 §2.3.2 覆盖所有 S-01~S-28 设置项。

**验收：** 各设置项修改后立即保存，重启后不丢失。

---

### 任务 M5-2：弹窗设置页面

**产出文件：**
- `src/pages/PopupSettings/index.tsx`
- `src/pages/PopupSettings/LayoutSettings.tsx`
- `src/pages/PopupSettings/PositionSettings.tsx`
- `src/pages/PopupSettings/AnimationSettings.tsx`
- `src/pages/PopupSettings/PreviewPanel.tsx`

**要求：** 按需求文档 §2.4 覆盖所有 P-01~P-21 设置项。PreviewPanel 实时反映当前设置。

**验收：** 修改圆角 → 预览弹窗圆角同步变化。

---

### 任务 M5-3：历史记录页面

**产出文件：**
- `src/pages/History/index.tsx`
- `src/pages/History/HistoryItem.tsx`
- `src/pages/History/HistoryDetail.tsx`
- `src/stores/historyStore.ts`

**要求：** 按需求文档 §2.5 覆盖 H-01~H-10。

**验收：** 划词后历史列表出现记录，可搜索、筛选、复制、删除。

---

### 任务 M5-4：系统托盘完善

**产出文件：** `electron/tray.ts`（独立文件）

**要求：** 按需求文档 §2.6 覆盖 T-01~T-08。
- 托盘图标（16x16 和 32x32）
- 右键菜单：打开主窗口、暂停/恢复划词（勾选）、设置、退出
- 左键单击：显示/隐藏主窗口
- Tooltip：显示当前状态
- 单实例运行（已在 main.ts 中实现）

**验收：** 关闭主窗口 → 程序在托盘运行 → 右键菜单可用。

---

### 任务 M5-5：首次引导页

**产出文件：** `src/pages/Onboarding/index.tsx`

**要求：**
- 3 步引导：① 配置 API Key → ② 选择你要用的动作 → ③ 试试划词吧
- 每步有插图（CSS 绘制或 emoji）+ 说明文字
- 显示步骤指示器（3 个圆点）
- [跳过] 按钮可跳过引导
- 第 3 步引导用户试划词，成功后显示 "🎉 你已准备就绪！"

**验收：** 首次启动 → 引导页出现 → 3 步走完 → 进入主窗口。

---

### 任务 M5-6：全局异常处理与提示

**产出文件：**
- `src/components/ErrorBoundary.tsx`
- `src/components/Toast.tsx`
- `src/components/EmptyState.tsx`

**要求：**
- ErrorBoundary：捕获 React 渲染错误，显示友好界面
- Toast：全局消息提示（成功/错误/警告），3 秒自动消失
- EmptyState：统一空状态组件（插图 + 标题 + 描述 + 操作按钮）
- 所有 API 错误按 §7.1 映射为中文提示

**验收：** 断开网络 → 点翻译 → 显示"网络连接超时"Toast + 重试按钮。

---

### 任务 M5-7：Zustand Store 持久化

**产出文件：** 修改所有 Store，增加 `persist` 中间件

**要求：**
- 使用 `zustand/middleware` 的 `persist` 
- 存储到 `localStorage`（渲染进程快速读写）
- 重要数据（API Key 除外）同步到 electron-store
- 配置版本号，支持默认值迁移

**验收：** 修改配置 → 刷新页面 → 配置仍在。

---

### 任务 M5-8：验证 M5

**验收清单：**
- [ ] 所有设置项可修改并持久保存
- [ ] 弹窗预览实时更新
- [ ] 历史记录完整可用
- [ ] 托盘菜单所有功能正常
- [ ] 首次启动引导流畅
- [ ] 错误提示为中文、可理解、可操作
- [ ] 关闭主窗口 → 托盘运行 → 重新打开 → 状态保持

---

## M6 · 打包发布

> 目标：生成 Windows 安装包，可安装、可运行、可升级。

### 任务 M6-1：electron-builder 配置完善

**产出文件：** `electron-builder.yml`

**要求：**
- appId、产品名、版本号
- Windows NSIS 安装器配置
- 安装目录可选、创建桌面快捷方式
- 文件关联（可选）
- 图标（ico 格式）

**验收：** `npm run package` 生成 `release/划词助手 Setup x.x.x.exe`。

---

### 任务 M6-2：应用图标

**产出文件：** `public/icon.png`、`public/icon.ico`

**要求：**
- 设计一个简约 iOS 风格的图标（圆角矩形 + 文字光标 + 魔法效果）
- 生成 256x256 PNG 和 ico 多尺寸

**验收：** 安装后桌面出现图标，窗口标题栏显示图标。

---

### 任务 M6-3：构建脚本 + 开发/生产环境分离

**产出文件：** `package.json`（修改 scripts）

**要求：**
- `npm run dev`：同时启动 Vite + tsc watch + Electron
- `npm run build`：构建渲染进程 + 编译主进程
- `npm run package`：完整打包
- 环境区分：`app.isPackaged`

**验收：** `npm run dev` 一条命令启动全部服务。

---

### 任务 M6-4：日志系统

**产出文件：** `electron/logger.ts`

**要求：**
- 使用 `electron-log`
- 记录应用启动、关闭、错误、API 请求状态
- 日志不包含明文 API Key 和完整用户文本（截断前 50 字符）
- 日志文件路径：`%APPDATA%/text-helper/logs/`
- 提供「打开日志文件夹」入口（设置 → 关于）

**验收：** 运行后日志文件有记录，不包含 Key。

---

### 任务 M6-5：验证 M6 + 全流程回归

**验收清单：**
- [ ] `npm run package` 生成可安装 exe
- [ ] 安装到默认目录，桌面快捷方式可用
- [ ] 首次启动引导正常
- [ ] 完整流程：添加 Key → 设置动作 → 划词 → AI 返回 → 历史记录
- [ ] 托盘常驻、暂停划词、退出程序正常
- [ ] 卸载干净无残留
- [ ] §8.1 MVP 总体验收 12 项全部通过

---

## 附录 A：任务依赖图

```
M0 (项目骨架)
 └─→ M1 (配置闭环)
      └─→ M2 (AI 请求闭环)
           └─→ M3 (弹窗闭环)
                ├─→ M4 (动作系统)
                └─→ M5 (设置与历史)
                     └─→ M6 (打包发布)
```

## 附录 B：每个阶段的技术关键字

| 阶段 | 关键文件 | 关键依赖 |
|------|----------|----------|
| M0 | Vite, Tailwind, React Router, electron main/preload | react, react-dom, electron, vite, tailwindcss |
| M1 | IPC, electron-store, safeStorage, API service | electron-store |
| M2 | SSE 流式请求, AbortController, Markdown | react-markdown |
| M3 | BrowserWindow(transparent), Framer Motion, 位置计算 | framer-motion |
| M4 | @dnd-kit/core, Prompt 变量引擎 | @dnd-kit/core |
| M5 | Zustand persist, 引导页, Toast, ErrorBoundary | — |
| M6 | electron-builder, electron-log, NSIS | electron-builder, electron-log |

## 附录 C：需求编号 → 任务映射

| 需求编号范围 | 对应里程碑 |
|-------------|-----------|
| M-01 ~ M-10 | M1 配置闭环 |
| A-01 ~ A-12 | M4 动作系统 |
| S-01 ~ S-28 | M5 设置与历史 |
| P-01 ~ P-21 | M5 弹窗设置 (M5-2) |
| H-01 ~ H-10 | M5 历史记录 (M5-3) |
| T-01 ~ T-08 | M5 系统托盘 (M5-4) |
| UX-01 ~ UX-15 | 贯穿 M1-M5 |

---

> 使用方式：将此文件交给 Claude Code 或 Codex，逐任务执行。每完成一个任务后验收并标记 ✅。
