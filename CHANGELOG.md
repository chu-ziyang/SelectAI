# 更新日志

所有值得注意的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [1.0.1] - 2026-06-07

### 修复

- 重构划词弹窗为常驻隐藏窗口，划词后复用窗口并通过 IPC 更新选区，减少冷启动和白屏闪烁。
- 修复划词后弹窗前短暂闪现空壳/旧窗口的问题，改为工具栏完成渲染和尺寸更新后再显示。
- 修复结果栏生成完成后被自动关闭的问题，展开结果期间锁定焦点并取消自动隐藏计时。
- 修复结果窗圆角外观失效的问题，同步 CSS 裁剪与 Electron 窗口圆角 shape。

### 改进

- 点击动作后在工具栏原位展开结果卡，结果窗口尺寸稳定，不再随流式内容抖动。
- 新增独立 popup 会话状态管理，按 session 管理流式请求、停止、重试、收起和关闭。
- 结果栏改为仅展示 Markdown 结果正文，移除对话气泡效果，并保留“展开原文”选项。
- 流式输出实时追加到当前结果正文，保持滚动稳定，用户手动上滚时不强制抢滚。

## [1.0.0] - 2026-06-07

### 🎉 首个公开版本

完整实现 6 大里程碑 (M0 ~ M6)。

### ✨ 新增

#### M0 - 项目骨架
- Electron 28 + React 18 + TypeScript 脚手架
- Vite 5 + Tailwind CSS 3 + iOS 风格主题
- HashRouter + 5 标签页 + 侧边栏
- TypeScript 类型系统
- 全局样式 + 骨架屏 + 弹簧动画

#### M1 - AI 模型管理
- 多厂商适配器：OpenAI / Anthropic Claude / DeepSeek / 智谱 / 月之暗面 / Gemini / Ollama
- API Key 加密存储（Electron safeStorage）
- 一键拉取模型列表
- 思考模型标记
- 默认模型切换
- 流式 AI 请求
- 中英文错误信息映射

#### M3 - 划词 + 弹窗
- 剪贴板轮询划词检测
- iOS 风格弹窗工具栏
- 流式打字机效果
- 可扩展/可固定弹窗
- Markdown 渲染
- 键盘导航

#### M4 - 划词动作管理
- 内置动作：翻译 / 总结 / 解释 / 查词
- 自定义 Prompt 动作
- 拖拽排序
- 启用开关
- 动作编辑（图标 / 名称 / Prompt / 输出语言）

#### M5 - 软件设置
- 通用设置
- 快捷键设置
- 外观设置（深色/浅色/跟随系统）
- 数据管理（导入/导出/重置）
- 关于页面

#### M5 - 弹窗设置
- 弹窗布局
- 弹窗位置
- 动画效果
- 实时预览

#### M6 - 打包发布
- electron-builder NSIS 安装包
- 桌面快捷方式
- 开始菜单
- 自定义安装路径
- GitHub Action 自动发布

### 🔧 技术栈

- Electron 28+
- React 18 + TypeScript 5
- Tailwind CSS 3
- Framer Motion 10
- Zustand 4
- electron-store 8
- electron-builder 24
- Vite 5
