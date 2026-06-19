# 一键发布脚本（npm run release）

全自动把当前 commit 发布到 GitHub Release：改版本号 → 写 CHANGELOG → commit + tag + push → 等 GitHub Actions 跑完 → 把 draft release 转 published → 输出下载链接。

## 前置准备（只做一次）

### 1. 申请 GitHub Personal Access Token

打开 https://github.com/settings/tokens ，生成一个 **classic** token：

- Scopes 勾选 **`repo`**（含 Contents: write + Metadata: read）
- 有效期建议选 90 天 / No expiration（按你偏好）
- 复制生成的 token（形如 `ghp_xxxxxxxx`），**它只显示一次**

### 2. 写 .env.local（推荐）

在项目根目录创建 `.env.local`（已 gitignore）：

```ini
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

PowerShell 也能直接读：

```powershell
# 临时设（关掉 shell 就失效）
$env:GITHUB_TOKEN = "ghp_xxxxxxxx"
```

其他可选来源（按优先级）：

1. `--token xxx` 命令行（不推荐，会进 shell history）
2. `GITHUB_TOKEN` / `GH_TOKEN` 环境变量
3. `.env.local`
4. `.env`
5. 1Password CLI（可选，需安装 `op` 并设置 `OP_GITHUB_REF`）

### 3. 设置编辑器（可选）

要让发布时弹出编辑器微调 CHANGELOG，先设 `$EDITOR`：

```powershell
# VS Code（推荐，--wait 让脚本等关闭）
$env:EDITOR = "code --wait"

# 或者记事本（默认）
# $env:EDITOR = "notepad.exe"
```

不设也能跑，会跳过编辑器用自动生成内容。

## 发布新版本

```bash
npm run release 1.3.0          # 显式版本号
npm run release patch          # 自动 +1 patch（1.2.0 -> 1.2.1）
npm run release minor          # 自动 +1 minor（1.2.0 -> 1.3.0）
npm run release major          # 自动 +1 major
```

脚本会按以下步骤跑：

1. 解析参数 + 校验版本号
2. 校验环境（工作区干净 / 在 main / tag 不冲突）
3. 解析 GITHUB_TOKEN
4. 从 `git log <prevTag>..HEAD` 自动生成 CHANGELOG 条目（中文分类：新增/修复/重构/改进/安全加固）
5. 弹出编辑器让你微调 → 保存关闭
6. 改 `package.json` + 写 `CHANGELOG.md`
7. `git commit` + `git tag` + `git push`
8. 轮询 GitHub Actions 跑完（最长 15 min）
9. 把 draft release 转 published，CHANGELOG 段填到 release body

## 子命令

```bash
# 干跑：只生成预览，不改任何文件
npm run release:dry 1.3.0
# 预览写到 .release-notes-draft.md，可手动看后正式跑

# 断点续跑：跳过 commit/push/notes，只等 workflow + publish
# 用于：workflow 跑超时 / 失败了 / 中途 Ctrl+C 打断
npm run release:finish 1.3.0
```

## 错误处理

| 报错 | 原因 | 解决 |
|---|---|---|
| 找不到 GITHUB_TOKEN | 没设 token | 检查 `.env.local` 或 `$env:GITHUB_TOKEN` |
| 工作区有未提交改动 | dirty working tree | `git stash` 或 `git commit` 后重跑 |
| 当前分支不是 main | 不在 main | `git checkout main` |
| tag 已存在 | 目标 tag 冲突 | 换版本号 |
| git push 失败 | 网络/认证/冲突 | 脚本已自动回滚本地；修后重跑 |
| workflow 失败 | Actions 报错 | 点日志 URL 排查；修完跑 `release:finish <ver>` |
| workflow 超时（15 min） | NSIS 打包慢 / 队列 | 等几分钟跑 `release:finish <ver>` |
| release 找不到（404） | workflow 还没建 draft | 等 1-2 分钟跑 `release:finish <ver>` |
| PATCH 401 Unauthorized | token 缺 `repo` scope | 重新生成 PAT |
| PATCH 404 Not Found | workflow 没建 draft 或已 published | 看 Actions 日志 |

## Conventional Commit → CHANGELOG 映射

| commit 类型 | 映射分类 |
|---|---|
| `feat`, `feat(scope): ...` | 新增 |
| `fix`, `fix(scope): ...` | 修复 |
| `refactor` | 重构 |
| `perf`, `style` | 改进 |
| `security` | 安全加固 |
| `docs`, `test`, `chore`, `ci`, `build` | 丢弃（不进 CHANGELOG） |

如果 commit 不符合 conventional 格式（无 `type: subject` 形式），整条 commit 也会被丢弃。
要让一条 commit 进 CHANGELOG，必须用 `feat:` / `fix:` 等前缀。

## 配置（可选）

| 环境变量 | 作用 | 默认 |
|---|---|---|
| `GITHUB_TOKEN` | 优先于 .env 文件 | （必填） |
| `EDITOR` / `VISUAL` | CHANGELOG 编辑器 | Windows: notepad.exe |
| `DEBUG=1` | 打印详细调试日志 | 关 |
| `NO_COLOR=1` | 关闭 ANSI 颜色 | 自动检测 TTY |
| `FORCE_COLOR=1` | 强制打开 ANSI 颜色 | 自动 |
| `OP_GITHUB_REF` | 1Password 引用路径 | `op://Private/Github/credential` |

## 风险与最佳实践

1. **token 切勿 commit**：`/`.env.local` 已在 .gitignore，**但**如果手动 `git add -f` 强推，立刻去 https://github.com/settings/tokens 撤销。
2. **多人协作**：发布前先 `git pull --rebase origin main`，避免 push 冲突。
3. **不要在分支上发布**：脚本校验只在 main 跑，避免半成品发出去。
4. **不要 force-push tag**：脚本默认拒绝远端 tag 已存在的情况；如必须删除，手动 `git push --delete origin vX.Y.Z` + 去 GitHub UI 删除对应 release。
5. **workflow 失败不影响本地 commit/tag**：脚本失败时不会回滚 commit / tag，方便你修完 workflow 后用 `release:finish` 续跑。

## 文件清单

| 文件 | 作用 |
|---|---|
| `scripts/release.mjs` | 主入口 |
| `scripts/release-lib/args.mjs` | CLI 解析 |
| `scripts/release-lib/version.mjs` | semver bump / 校验 |
| `scripts/release-lib/changelog.mjs` | CHANGELOG 读 / 解析 / 生成 / 插入 |
| `scripts/release-lib/conventional.mjs` | commit type → 中文分类 |
| `scripts/release-lib/git.mjs` | git spawnSync 封装 |
| `scripts/release-lib/github.mjs` | fetch 封装 |
| `scripts/release-lib/polling.mjs` | workflow run 轮询 |
| `scripts/release-lib/token.mjs` | GITHUB_TOKEN 多源解析 |
| `scripts/release-lib/ui.mjs` | ANSI 颜色 / 步骤进度 / 提示 |
| `scripts/release-lib/log.mjs` | logger |
| `.env.example` | token 模板 |
| `.gitignore` | 已加 .env / .env.local / .release-notes-draft.md |
