# 划词助手 (SelectAI) — 项目总结

> 给下一任 Claude 看的项目全景：做了什么、怎么做、踩过什么坑、为什么这么写。
> 第一次接手这个项目时，请先读完本文档，再阅读 `electron/main.ts`、`electron/windows.ts`、`src/popup/PopupApp.tsx` 三个核心文件，最后翻 `docs/MVP开发任务清单.md` 和 `CHANGELOG.md` 补全细节。

---

## 1. 项目是什么

**划词助手 (SelectAI)** 是一款 Windows 10/11 桌面端 AI 划词工具。用户在任意应用（PDF 阅读器、浏览器、Office、聊天软件等）里选中文字后，自动弹出悬浮工具栏，点击动作按钮即可调用大模型完成翻译、总结、解释、查词等操作。

**产品定位**（来自 `docs/requirements.md` v1.2）：
- iOS 风格的 Windows 划词工具，简约、高级、有美感
- 支持 7+ 大模型厂商：OpenAI 兼容协议、Anthropic Claude、DeepSeek、智谱、月之暗面、Gemini、Ollama
- **隐私优先**：所有 API Key 用 Electron `safeStorage` 加密本地存储，划词历史只在本地

**核心工作流**：
```
用户选词 → 剪贴板轮询/快捷键捕获 → 复用常驻弹窗 → 渲染动作工具栏 →
用户点动作 → 主进程代理 AI 请求 → SSE 流式推回渲染进程 → 打字机渲染 →
点空白处自动关闭（钉住/聚焦锁定除外）
```

---

## 2. 技术栈与架构

| 层 | 选型 | 为什么 |
|---|---|---|
| 桌面壳 | Electron 28+ | 跨平台最快方案，Windows 透明窗口 + 形状裁剪 |
| UI | React 18 + TypeScript 5 + Vite 5 | 团队/工具链成熟 |
| 样式 | Tailwind CSS 3 + iOS 主题 | 毛玻璃、弹簧动画、CSS 变量 |
| 动画 | Framer Motion 10 | 声明式动画，layout 过渡 |
| 状态 | Zustand 4 | 轻量，无 Provider 嵌套 |
| 路由 | react-router-dom 7 (HashRouter) | Electron `file://` 协议下唯一稳妥方案 |
| 拖拽 | @dnd-kit | 动作排序 |
| 存储 | electron-store 8 + safeStorage | 加密 + 持久化 |
| 持久化渲染层 | localStorage (Zustand persist) | 快速读写 |
| 打包 | electron-builder 24 (NSIS) | Windows 安装包 |
| 拖拽 | @dnd-kit | 动作排序 |
| 日志 | electron-log | 用户日志收集 |

**关键架构原则**：
- **主进程 = 信任边界**：所有 API Key 永远只存在于主进程内存，绝不暴露给渲染进程
- **IPC 是唯一通道**：渲染进程通过 `contextBridge` 暴露的 `window.electronAPI` 与主进程通信
- **常驻窗口模式**：划词弹窗不每次 `new BrowserWindow`，而是预先 `loadURL` 一次、隐藏待命，划词时复用
- **预创建结果窗口**：点动作后才创建，避开了冷启动抖动

---

## 3. 开发时间线与里程碑

| 里程碑 | 目标 | 任务数 | 关键产出 |
|---|---|---|---|
| **M0** | 项目骨架 | 6 | Electron + React + Vite + Tailwind 主题 + 5 标签页路由 |
| **M1** | 模型管理 | 8 | 7 厂商适配器 + safeStorage 加密 + 测试连接 + 拉取模型 + 默认模型切换 |
| **M2** | AI 请求 | 6 | 主进程流式代理 + AbortController + Markdown 渲染 |
| **M3** | 弹窗闭环 | 7 | 透明 BrowserWindow + 位置计算 + 键盘导航 + 快捷键触发 |
| **M4** | 动作系统 | 6 | 4 个预置动作 + 自定义 Prompt + 拖拽排序 + 变量引擎 |
| **M5** | 设置 + 历史 + 托盘 | 8 | 通用/快捷键/外观/数据/关于 + 历史 + 托盘菜单 + 引导页 |
| **M6** | 打包发布 | 5 | electron-builder NSIS + 图标 + GitHub Action 自动发布 |

**开发节奏**（看 git log）：
- 2026-06-04: 一天内完成 M0~M5 全部代码（凌晨 → 深夜）
- 2026-06-07 上午: v1.0.0 首次发布，但 CI 打包两次失败
- 2026-06-07 下午: v1.0.1 修复划词弹窗 4 个 UX 问题（重构为常驻窗口）
- 2026-06-07 晚上: v1.1.0 安全加固 5 项 + 弹窗 UX 微调，正式发布

完整任务清单见 `docs/MVP开发任务清单.md`，当前进度见 `docs/progress.md`。

---

## 4. 核心模块概览

### 4.1 主进程（`electron/`）

| 文件 | 职责 | 关键函数 |
|---|---|---|
| `main.ts` | 应用入口、IPC handler、托盘、单实例、URL 校验 | `setupIPC()`, `validateProviderUrl()`, `ensureSingleDefault()` |
| `windows.ts` | 弹窗 + 结果窗口的创建/位置/形状/动画 | `ensurePopupWindow()`, `showPopupSelection()`, `resizePopupWindow()`, `animateBounds()` |
| `text-selection.ts` | 剪贴板轮询检测选词 | `startTextWatch()` |
| `shortcuts.ts` | 全局快捷键 | `registerShortcuts()` |
| `store.ts` | 加密存储 + 默认配置 | `encryptApiKey()`, `decryptApiKey()`, `maskApiKey()` |
| `logger.ts` | electron-log 包装 | — |
| `preload.ts` | contextBridge 暴露 IPC | — |

### 4.2 渲染进程（`src/`）

| 目录 | 职责 |
|---|---|
| `pages/ModelManager/` | 厂商增删改 + 模型列表 + 思考模型标记 |
| `pages/ActionManager/` | 动作增删改 + 拖拽排序 + Prompt 编辑 |
| `pages/AppSettings/` | 通用/快捷键/外观/数据/关于 5 个子页 |
| `pages/PopupSettings/` | 弹窗布局/位置/动画 + 实时预览 |
| `pages/History/` | 划词历史记录（保留 30 天，上限 500 条） |
| `pages/Onboarding/` | 首次启动 3 步引导 |
| `popup/` | 划词弹窗（常驻），含工具栏、展开结果、键盘导航、位置计算 |
| `stores/` | Zustand: model / action / settings / chat / popupSession |
| `services/` | api (流式)、providers (适配器)、promptEngine (变量替换) |
| `i18n/` | 国际化（中英） |

---

## 5. 关键问题与解决方案

这一节是**最值钱的**——记录每个坑的具体表现、根因、修复方案。

### 5.1 划词弹窗 4 个 UX 问题（v1.0.0 → v1.0.1）

**问题 A：划词后弹窗前瞬间闪现空壳/旧窗口**
- 原因：原来每次划词都 `new BrowserWindow` + `loadURL`，冷启动期间用户能看到上一次的残留画面
- 解决：**重构为常驻隐藏窗口**。应用启动时 `ensurePopupWindow()` 预创建一次 `BrowserWindow(show:false)`，划词时只 `webContents.send('popup:selection-payload')` 推 payload，再 `showInactive()`
- 关键技巧：把"何时 show"交给 renderer——它在双 RAF（`requestAnimationFrame` 套两次）后调 `popup:present`，那时浏览器已经 paint 出新 toolbar，不会闪过旧画面
- 主进程同时挂 60-80ms 兜底定时器，防止 renderer 卡死时窗口永远不显示

**问题 B：结果栏生成完成后被自动关闭**
- 原因：`blur` 事件触发自动隐藏，但点动作后弹窗失焦（流式输出期间用户视线会移到别处）
- 解决：新增 `popupFocusLock` 状态，**展开结果期间锁定焦点**。`setPopupFocusLock(true)` 时不进 blur 关闭逻辑；`setPopupFocusLock(false)` 解除
- 顺带修了：进入展开态时如果焦点已不在弹窗里，用 `showInactive()` 拉回前台但不抢焦点，避免被 blur 立刻误关

**问题 C：流式结果尺寸抖动**
- 原因：每次 chunk 都触发 resize 动画（`animateBounds`），窗口宽度跟着内容走
- 解决：展开结果时锁定宽度到 `resultBounds(popupWidth, popupMaxHeight)`，流式只更新内容不更新尺寸
- 额外修复：`resizePopupWindow` 改为**保留用户拖动过的位置**。引入 `userMovedBounds` 影子，`move`/`resize` 事件实时记录，作为权威位置源。避免流式时把用户拖到别处的窗口拉回原划词点

**问题 D：结果窗圆角外观失效**
- 原因：CSS `border-radius` 只裁剪网页内容，Electron 窗口的方形"硬边"还是露出来
- 解决：写一个 `getRoundedRectShape(width, height, radius)` 函数，用三角函数生成圆角的逐行矩形集合，调用 `win.setShape(rects)` 让 OS 层也按圆角裁剪窗口
- 公式：`inset = ceil(r - sqrt(r² - dy²))`，逐 y 行算左右内缩量
- 副作用：必须用 `hasShadow: false` + CSS `box-shadow` 自己渲染阴影，否则原生矩形阴影会盖在圆角外面形成"方框"

### 5.2 Windows 弹窗的隐藏陷阱

`windows.ts` 注释里藏了 4 个 Windows 特有的坑：

1. **`transparent: true` 不足以让背景透明** — Windows 主题下还会显示白底，必须再加 `backgroundColor: '#00000000'`
2. **`showInactive()` 在 Windows 上会触发一次伪 blur** — 加 300ms blur 缓冲期（`BLUR_GRACE_PERIOD_MS`），期间忽略所有 blur 事件
3. **二次划词的旧 blur 会误关新工具栏** — renderer 维护 `ignoreHiddenUntilRef = now + 800`，在守卫窗口内的 blur 事件被忽略
4. **show 前的 `setBounds` 会触发 move 事件** — 屏蔽自己的 setBounds 干扰

### 5.3 5 项安全加固（v1.1.0）

发布前 5 个安全 blocker，按严重性排：

| # | 问题 | 修复 |
|---|---|---|
| 1 | `provider:reveal-key` IPC 返回明文 Key 给任意 renderer | **删除该 IPC**。Key 只在主进程解密用完即丢 |
| 2 | `.map` sourcemap 被 electron-builder 打进 release | tsconfig `sourceMap: false` + electron-builder 排除 `**/*.map` |
| 3 | blur 关闭弹窗时，渲染进程的 AI 流没取消，main 的 `activeAbortController` 成孤儿，fetch 继续向已隐藏 webContents send | blur 时 `webContents.send('popup:hidden')`，renderer 收到后调 `ai:cancel` |
| 4 | `provider.baseUrl` 用户可控，攻击者可填 `https://attacker.com` 把 Bearer Key 钓鱼出去 | 写 `validateProviderUrl()`：强校验 https、公网禁 http、本地允许（Ollama）、拦 AWS/GCP IMDS、禁 userinfo；在 add/update/test-config/fetch 4 处都卡 |
| 5 | `shell:open-external` 用正则 `^https?://` 太松，可被 NUL 截断/不可见字符绕过 | 用 `new URL()` 严格解析 + 协议白名单 + 禁 userinfo + 解析前后字符串完全一致才放行 |

### 5.4 多个默认模型自愈（v1.1.0）

- 原因：旧版 `fetch-models` 在新厂商拉模型时可能无视其他厂商已有默认，制造出多个 `isDefault=true`
- 解决：
  1. 修主逻辑：合并模型时如果其他厂商已有默认，**不自动设默认**给本次拉取的新厂商
  2. 加启动自愈 `ensureSingleDefault()`：启动时扫描全 store，发现 >1 个默认就保留第一个 enabled 的、其余全清
  3. 同样的逻辑在 `model:update` 切换默认时也跑一遍

### 5.5 GitHub Actions 打包两次失败（v1.0.0 → v1.0.1）

| 失败 | 原因 | 修复 |
|---|---|---|
| 第一次 | 依赖里 `sharp` 在 Windows runner 上 native 编译 `ENOENT` | 移除 `sharp` |
| 第二次 | 没 sharp 后 electron-builder 无法把 PNG 转 ICO，NSIS 报 `invalid icon file` | **预生成** `public/icon.ico`（256KB）并提交；`to-ico` 是纯 JS 转换器不依赖 native |
| 附带 | Node 20 actions 弃用警告；`npm ci` 太慢 | Node 20 → 22；`npm ci --no-audit --no-fund`；加 `setup-python@v5` 备用 |

### 5.6 弹窗宽度估算与 ResizeObserver 校准

- 估算函数 `estimateToolbarWidth()`：padding(16) + icon(20) + gap(6) + text 字符 × 16px（中文粗体）
- 真实宽度靠 ResizeObserver 在挂载后用 `max(scrollWidth, rect.width)` 二次校准
- 原因：framer-motion 的 layout 过渡期间，`rect.width` 可能不准确，会把最后一个按钮裁切

---

## 6. 反复出现的代码模式

这些是本项目沉淀下来的、可复用的范式：

### 6.1 常驻窗口 + 推送 payload（划词弹窗）
```ts
// 启动时预创建并隐藏
const win = ensurePopupWindow()  // show: false, loadURL 一次
// 划词时复用
win.webContents.send('popup:selection-payload', payload)
presentPopupWindow(60)  // 60ms 兜底定时器，等 renderer 双 RAF
```

### 6.2 双 RAF 等待 paint（避免白屏闪烁）
```ts
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    window.electronAPI.popup.present()
  })
})
```

### 6.3 防御性二次校验
- 即使 store 数据被旁路污染（如本地文件被改），关键操作前再校验一次
- 例：`requestProviderModels` 里 fetch 前再 `validateProviderUrl()` 一次

### 6.4 启动自愈
- 关键不变量在启动时扫描+修复
- 例：`ensureSingleDefault()` 保证全局最多 1 个默认模型

### 6.5 守卫窗口忽略过期事件
- 用 sessionId 标识一组事件
- 收到不属于当前 session 的事件直接 return
- 例：`hidePopupWindow(sessionId)` 二次划词时旧 session 的延迟 hide 被忽略

### 6.6 错误信息中文 + 上下文提示
- 错误对象返回 `{ ok: false, error: 'API Key 无效' }` 而不是英文/Error 对象
- 必要时给可操作建议："http:// 仅支持本机地址；公网请改用 https://"

---

## 7. 当前状态（v1.1.0）

| 项 | 状态 |
|---|---|
| 全部 6 个里程碑 | ✅ 完成 |
| 安全加固 5 项 | ✅ 完成 |
| 弹窗 UX 优化 | ✅ 完成 |
| GitHub Actions 自动发布 | ✅ 完成 |
| NSIS 安装包可生成 | ✅ |
| 历史/托盘/引导/设置 | ✅ 完整 |
| i18n（中英） | ✅ |
| 自动化测试 | ❌ 无（手动测试为主） |
| macOS / Linux | ❌ 暂不支持 |
| OCR 识别图片文字 | ❌ P2 后置 |
| 导入导出设置 | ❌ P2 后置 |

---

## 8. 后续可能的迭代方向

按需求文档 `docs/requirements.md` §1.7 的 P2 列表：

- **结果钉住** 已实现（`popupPinned` / `resultPinned`）
- **随打随搜** 已实现（弹窗里可修改输入框重发）
- **剪贴板监听** 已实现（Ctrl+C 后 100ms 读剪贴板）
- **面板拖拽** 已实现（`movable: true`）
- **导入导出设置** 未做 — `dataSettings` 页面骨架在，但导出 JSON 按钮是占位
- **检查更新** 未做 — electron-updater 可以接入
- **多语言界面** 已有 i18n 框架，但只有中英两套
- **增强：选中文字 OCR** — 可考虑接入 PaddleOCR / Tesseract
- **增强：自定义 Base URL 代理** — 给国内用户加速
- **增强：快捷键自定义 UI** — `shortcut` 字段已存，但 UI 还没暴露

---

## 9. 如何在新设备/新会话继续

1. **装环境**：Node 18+（推荐 LTS 22，因为 CI 用 22），`npm install`
2. **跑开发**：`npm run dev`（同时启动 Vite + tsc watch + Electron）
3. **打包**：`npm run package`，产物在 `release/划词助手 Setup x.x.x.exe`
4. **发版流程**：见 `README.md` §"发布新版本"——commit → tag → push → GitHub Action 自动构建草稿 Release → 人工编辑 release notes → Publish
5. **接手前必读**：
   - `electron/main.ts`（700+ 行，最重要的入口）
   - `electron/windows.ts`（500+ 行，弹窗逻辑集中地，注释最详尽）
   - `src/popup/PopupApp.tsx`（弹窗 UI 主入口）
   - `src/stores/popupSessionStore.ts`（v1.0.1 重构后的会话管理）
   - `CHANGELOG.md`（每次改动的用户视角记录）

---

## 10. 关键设计决策记录

- **为什么用 HashRouter 而不是 MemoryRouter/ BrowserRouter**？ — Electron 生产环境用 `file://` 协议，只有 hash 路由能工作
- **为什么主进程代理 AI 请求**？ — API Key 不能给渲染进程，且需要 AbortController 全局管理
- **为什么弹窗要常驻而不是按需创建**？ — 冷启动期间会有 50-200ms 白屏，二次划词体验差
- **为什么结果窗口独立于工具栏窗口**？ — 工具栏需要小巧可拖、结果需要大块阅读区，分开各自优化
- **为什么 fetch 流式放在主进程而不是渲染进程**？ — API Key 保密 + 跨窗口统一 abort + 利用 Node 的 fetch 节省内存
- **为什么用 `safeStorage` 而不是自己写加密**？ — 跨平台、OS 级密钥链绑定、自己写密钥管理会有无数坑
- **为什么 NSIS 而不是 MSI/MSIX**？ — NSIS 支持自定义安装目录、桌面快捷方式、开始菜单、对国内环境最友好

---

## 11. 经验教训

做这个项目踩过的、值得记住的：

1. **Electron 透明窗口的"透明"在 Windows 上分两步** — `transparent: true` + `backgroundColor: '#00000000'`，少一步就有白框
2. **`setShape` 是真圆角** — CSS `border-radius` 裁不了 OS 窗口边缘，圆角必须双管齐下
3. **`showInactive()` 会触发 blur** — Windows 上的副作用，300ms 缓冲期是必要的
4. **二次划词的旧事件会迟到** — 任何异步链路都要带 sessionId 守卫
5. **流式响应的 AbortController 必须在主进程集中持有** — 渲染进程关了窗口，main 的 fetch 还在跑会向已销毁的 webContents 抛异常
6. **`new URL()` 是 URL 校验的唯一正确方式** — 正则永远会被绕过（NUL、不可见字符、协议变形）
7. **OWASP 的 "validate at every trust boundary" 在 Electron 里是字面意义** — IPC 是信任边界，每条 IPC handler 都要校验
8. **electron-builder 跨平台打包的 native 依赖是雷** — sharp、canvas、node-gyp 工具链在 GitHub Actions Windows runner 上都容易翻车，能用纯 JS 替代品就替代
9. **图标文件宁可预生成也不要让 builder 转换** — 转换工具链五花八门，提交二进制 ICO 最稳
10. **iOS 风格在 Windows 上是"看起来简单做起来难"** — 圆角、阴影、毛玻璃、弹簧动画，每一项都要跟 Electron 的硬边缘斗智斗勇
