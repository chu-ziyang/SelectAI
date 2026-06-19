// scripts/release-lib/args.mjs
// 极简 CLI 解析。不依赖 commander/yargs。

const HELP = `用法：
  npm run release <version|patch|minor|major> [选项]
  npm run release:dry <version|patch|minor|major> [选项]
  npm run release:finish <version> [选项]

选项：
  --token <pat>           GitHub Personal Access Token（不推荐，会进 shell history）
  --notes <file>          用指定文件作为 release notes（跳过自动生成）
  --skip-notes            跳过 CHANGELOG 生成（直接 push，等待 publish 阶段再手动填）
  --skip-push             跳过 git commit/tag/push（断点续跑模式）
  --yes                   跳过所有确认提示
  --dry-run               只打印将要做什么，不实际改动
  --verbose               DEBUG=1
  --help, -h              打印此帮助

版本号：
  1.3.0                   显式 semver
  patch | minor | major   自动 bump 当前 package.json 的 version

环境：
  GITHUB_TOKEN            优先于 .env.local / .env / 1Password
  EDITOR / VISUAL         release notes 预览编辑器（Windows 默认 notepad.exe）
  DEBUG=1                 打印调试日志
  NO_COLOR=1              关闭 ANSI 颜色

示例：
  npm run release 1.3.0
  npm run release patch
  npm run release:dry minor
  npm run release:finish 1.3.0    # workflow 跑完后用这个收尾
`;

export function parseCli(argv) {
  const out = {
    version: null,
    token: null,
    notesFile: null,
    skipNotes: false,
    skipPush: false,
    yes: false,
    dryRun: false,
    help: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--token') out.token = argv[++i];
    else if (a === '--notes') out.notesFile = argv[++i];
    else if (a === '--skip-notes') out.skipNotes = true;
    else if (a === '--skip-push') out.skipPush = true;
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--verbose') process.env.DEBUG = '1';
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`未知选项：${a}`);
    else positional.push(a);
  }

  if (out.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  // 第一个位置参数是版本号
  out.version = positional[0] || null;
  if (!out.version && !out.dryRun) {
    process.stderr.write(HELP);
    throw new Error('缺少版本号参数');
  }

  // dry-run 隐含 skip-push（只读，不写）
  if (out.dryRun) out.skipPush = true;

  return out;
}
