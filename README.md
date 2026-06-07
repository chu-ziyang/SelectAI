# 划词助手 (SelectAI)

> 选中文字，AI 立刻为你翻译、总结、解释。一款 iOS 风格的 Windows 桌面划词工具。

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Electron](https://img.shields.io/badge/Electron-28+-9feaf9)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特性

- 🖱️ **划词触发** — 选中任意文字，自动弹出动作工具栏
- 🤖 **多 AI 厂商** — 支持 OpenAI、Claude、DeepSeek、智谱、月之暗面、Gemini、Ollama 等
- 🎯 **动作管理** — 翻译 / 总结 / 解释 / 查词 / 自定义 Prompt
- ⚡ **流式响应** — 打字机效果实时输出
- 🪟 **弹窗预览** — 在选词旁边显示结果，不打断阅读
- 🎨 **iOS 视觉** — 毛玻璃、微交互、弹簧动画、渐变色彩
- 🔒 **本地加密** — API Key 使用 Electron safeStorage 加密存储
- ⌨️ **全局快捷键** — 可自定义划词触发快捷键

## 🛠️ 技术栈

| 类别 | 选型 |
|------|------|
| 桌面框架 | Electron 28+ |
| UI 框架 | React 18 + TypeScript |
| 样式 | Tailwind CSS + iOS 主题 |
| 动画 | Framer Motion |
| 状态管理 | Zustand |
| 路由 | React Router (HashRouter) |
| 持久化 | electron-store + safeStorage |
| 打包 | electron-builder (NSIS) |

## 📁 项目结构

```
.
├── electron/              # 主进程
│   ├── main.ts           # 应用入口（窗口/托盘/IPC）
│   ├── preload.ts        # 预加载脚本
│   ├── store.ts          # 加密存储
│   ├── windows.ts        # 弹出窗口管理
│   ├── text-selection.ts # 划词检测
│   ├── shortcuts.ts      # 全局快捷键
│   └── logger.ts         # 日志
├── src/                   # 渲染进程 (React)
│   ├── App.tsx           # 主窗口根组件
│   ├── pages/            # 路由页面
│   │   ├── ModelManager/   # AI 模型管理
│   │   ├── ActionManager/  # 划词动作管理
│   │   ├── AppSettings/    # 软件设置
│   │   ├── PopupSettings/  # 弹窗设置
│   │   ├── History/        # 历史记录
│   │   └── Onboarding/     # 引导
│   ├── popup/            # 划词弹窗
│   │   ├── PopupApp.tsx
│   │   ├── SelectionToolbar.tsx
│   │   ├── ResultApp.tsx
│   │   └── ExpandedResult.tsx
│   ├── components/       # 通用组件
│   ├── stores/           # Zustand 状态
│   ├── services/         # API/Provider 适配
│   ├── i18n/             # 国际化
│   ├── styles/           # 全局样式
│   └── types/            # 类型声明
├── public/                # 静态资源
├── docs/                  # 需求/进度/任务清单
├── electron-builder.yml   # 打包配置
├── vite.config.ts         # Vite 配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18 (推荐 LTS)
- **npm** ≥ 9 (或 pnpm / yarn)
- **操作系统** Windows 10/11 (开发与运行)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后会自动打开主窗口，并支持热更新。

### 构建安装包

```bash
npm run package
```

构建产物在 `release/` 目录下，是 NSIS 安装程序。

## ⌨️ 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动主进程 + 渲染进程（开发） |
| `npm run dev:main` | 仅启动主进程 |
| `npm run dev:renderer` | 仅启动 Vite 开发服务器 |
| `npm run build` | 构建主进程 + 渲染进程 |
| `npm run package` | 打包成 NSIS 安装包 |
| `npm run preview` | 预览 Vite 构建产物 |
| `npm run lint` | 运行 ESLint |

## 🎬 使用流程

1. **添加 AI 厂商** — 打开「模型管理」→ 添加厂商 → 填入 API Key → 测试连接
2. **拉取模型列表** — 点击「刷新」自动获取该厂商所有模型
3. **配置动作** — 在「动作管理」中启用/禁用/调整划词动作
4. **划词使用** — 在任意应用选中文字 → 弹出工具栏 → 选择动作 → 查看结果

## 🔒 隐私与安全

- 所有 API Key 存储在本地，使用 Electron `safeStorage` 加密
- 划词历史仅保留在本地，不上传任何服务器
- AI 请求直接发送到对应厂商 API，不经过中转

## 📚 文档

- [需求文档](docs/requirements.md)
- [开发进度](docs/progress.md)
- [MVP 任务清单](docs/MVP开发任务清单.md)

## 📝 许可证

MIT License

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://github.com/pmndrs/zustand)
