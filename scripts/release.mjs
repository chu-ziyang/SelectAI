#!/usr/bin/env node
// scripts/release.mjs — SelectAI 一键发布脚本
// 用法：npm run release 1.3.0  /  patch|minor|major  /  --dry-run  /  --skip-push
// 零运行时依赖（仅 Node 18+ 内置 fetch + spawnSync）

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseCli } from './release-lib/args.mjs';
import { resolveTargetVersion, assertTagFree } from './release-lib/version.mjs';
import {
  statusClean, currentBranch, lastTag, tagSha, getCommitsSince,
  add, commit, tag, push, deleteTagLocal, deleteTagRemote, softResetLastCommit,
  parseRepoFromRemote,
} from './release-lib/git.mjs';
import { resolveToken, maskToken } from './release-lib/token.mjs';
import {
  readChangelog, writeChangelog, parseChangelog, findLastEntry,
  generateEntryBody, buildFullEntry, insertEntry, writePreview, editFile,
} from './release-lib/changelog.mjs';
import { getReleaseByTag, patchRelease } from './release-lib/github.mjs';
import { waitForWorkflow } from './release-lib/polling.mjs';
import { step, ok, sub, prompt, spinner } from './release-lib/ui.mjs';
import { info, warn, error, success } from './release-lib/log.mjs';

const ROOT = process.cwd();
const PKG = resolve(ROOT, 'package.json');
const CHANGELOG = resolve(ROOT, 'CHANGELOG.md');
const PREVIEW = resolve(ROOT, '.release-notes-draft.md');
const TOTAL_STEPS = 8;

function exit(code, msg) {
  if (msg) (code === 0 ? success(msg) : error(msg));
  process.exit(code);
}

async function main() {
  let cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (e) {
    error(e.message);
    process.exit(1);
  }

  // 子命令别名：release:dry / release:finish 在 package.json 里已经传 --dry-run / --skip-push
  // 直接根据 cli 字段判断

  step(1, TOTAL_STEPS, '解析参数与版本号');
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  const current = pkg.version;
  let target;
  // release:finish 模式（--skip-push）允许目标版本等于当前版本（断点续跑）
  if (cli.skipPush && cli.version) {
    if (cli.version === current ||
        ['patch', 'minor', 'major'].includes(cli.version) ||
        !isValidSemver(cli.version)) {
      // finish 模式：版本号应当已经是 commit 时的版本。校验一致性即可。
      const expected = current;
      if (cli.version !== expected && isValidSemver(cli.version) && cli.version !== expected) {
        exit(1, `finish 模式：传入的版本 ${cli.version} 与 package.json 当前版本 ${expected} 不一致`);
      }
      target = expected;
    } else {
      target = resolveTargetVersion(cli.version, current);
    }
  } else if (cli.version) {
    target = resolveTargetVersion(cli.version, current);
  } else if (cli.dryRun) {
    exit(1, '干跑模式也要传版本号：npm run release:dry 1.3.0');
  } else {
    exit(1, '缺少版本号参数');
  }
  if (!cli.skipPush && target === current) exit(1, `目标版本 ${target} 与当前相同`);

  const tagName = `v${target}`;
  ok(`当前版本：${current}`);
  ok(`目标版本：${target}`);
  ok(`Tag：${tagName}`);

  if (!cli.yes && !cli.dryRun) {
    const yes = await prompt(`确认发布 ${tagName}？(Y/n)`, { defaultYes: true });
    if (!yes) exit(1, '用户取消');
  }

  step(2, TOTAL_STEPS, '校验环境');
  if (!cli.skipPush) {
    if (!statusClean()) exit(1, '工作区有未提交改动，请先 git stash 或 git commit');
    if (currentBranch() !== 'main') exit(1, `当前分支 ${currentBranch()} 不是 main`);
    sub('工作区干净 ✓ 分支 main ✓');
  } else {
    sub('已跳过工作区/分支检查（--skip-push 或 --dry-run）');
  }

  if (!cli.skipPush) {
    await assertTagFree(tagName);
    sub(`tag ${tagName} 在本地 / 远端都空闲 ✓`);
  }

  step(3, TOTAL_STEPS, '解析 GITHUB_TOKEN');
  let token = null;
  let source = null;
  if (!cli.dryRun) {
    const r = await resolveToken({ cliToken: cli.token });
    token = r.token;
    source = r.source;
  } else {
    sub('干跑模式跳过 token 解析');
  }
  if (!cli.dryRun && !token) {
    error('找不到 GITHUB_TOKEN。');
    error('请用以下任一方式提供：');
    error('  1. 在项目根目录创建 .env.local，写入 GITHUB_TOKEN=ghp_xxx');
    error('  2. 设置环境变量 $env:GITHUB_TOKEN = "ghp_xxx"');
    error('  3. 安装 1Password CLI 并把 token 存在 op://Private/Github/credential');
    error('Token 需要 repo scope：https://github.com/settings/tokens');
    process.exit(1);
  }
  if (token) ok(`token 来源：${source}  (${maskToken(token)})`);

  const repo = parseRepoFromRemote('origin');
  sub(`仓库：${repo.owner}/${repo.repo}`);

  step(4, TOTAL_STEPS, '生成 CHANGELOG 条目');
  let entryText;
  if (cli.notesFile) {
    if (!existsSync(cli.notesFile)) exit(1, `--notes 文件不存在：${cli.notesFile}`);
    entryText = readFileSync(cli.notesFile, 'utf8');
    sub(`从 ${cli.notesFile} 读取 release notes（${entryText.length} 字节）`);
  } else if (cli.skipNotes) {
    entryText = `## [${target}] - ${new Date().toISOString().slice(0, 10)}\n\n_（release notes 待补充）_\n`;
    sub('跳过 CHANGELOG 生成，使用占位文本');
  } else {
    const prevTag = lastTag();
    const commits = prevTag ? getCommitsSince(prevTag) : getCommitsSince(null);
    sub(`区间：${prevTag || '(全部历史)'}..HEAD，共 ${commits.length} 条 commit`);
    if (commits.length === 0) {
      warn('区间内无 commit，将生成空 entry（你可手动补充）');
    }
    const entryBody = generateEntryBody(commits);
    const date = new Date().toISOString().slice(0, 10);
    entryText = buildFullEntry(target, date, entryBody);

    if (!cli.dryRun && process.stdin.isTTY) {
      // 写到 preview 文件，提示用户可选编辑
      writePreview(entryText, PREVIEW);
      sub(`已生成预览：${PREVIEW}`);
      const ans = await prompt('要打开编辑器微调吗？(e 打开 / 回车跳过 / q 取消)', { defaultYes: false });
      if (ans === false) {
        // q / n
        if (!existsSync(PREVIEW)) {
          // 用户取消
          exit(1, '用户取消发布');
        }
      } else if (cli.yes) {
        // --yes 模式直接跳过
      } else {
        // 检查输入
      }
      // 二次确认：是否打开编辑器
      const choice = await new Promise((resolve) => {
        process.stdout.write('? 输入 e 打开编辑器，回车继续，q 取消 [e/Y/q] ');
        const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout });
        rl.question('', (a) => {
          rl.close();
          const v = (a || '').trim().toLowerCase();
          resolve(v === 'q' ? 'q' : v === 'e' ? 'e' : 'y');
        });
      });
      if (choice === 'q') exit(1, '用户取消发布');
      if (choice === 'e') {
        try {
          const r = await editFile(PREVIEW);
          entryText = r.content;
          sub('已读回编辑器修改后的内容');
        } catch (e) {
          warn(`编辑器失败：${e.message}，使用自动生成内容`);
        }
      }
    }
  }

  if (cli.dryRun) {
    info('【干跑模式】以下是预览，不实际改动：');
    console.log('--- package.json version ---');
    console.log(`${current} -> ${target}`);
    console.log('--- CHANGELOG entry (会插到第一个 ## [ 之前) ---');
    console.log(entryText);
    if (existsSync(PREVIEW)) {
      console.log(`\n预览文件已写到：${PREVIEW}`);
    }
    success('干跑完成');
    process.exit(0);
  }

  step(5, TOTAL_STEPS, '改 package.json + 写 CHANGELOG');
  pkg.version = target;
  // 保留原缩进
  const pkgText = readFileSync(PKG, 'utf8');
  const newPkgText = pkgText.replace(/"version":\s*"[^"]+"/, `"version": "${target}"`);
  writeFileSync(PKG, newPkgText, 'utf8');
  ok('package.json updated');

  if (!cli.skipPush) {
    const clText = readFileSync(CHANGELOG, 'utf8');
    const newClText = insertEntry(clText, entryText.trimEnd());
    writeFileSync(CHANGELOG, newClText, 'utf8');
    ok('CHANGELOG.md updated');
  } else {
    sub('已跳过 CHANGELOG 写入（finish 模式不应修改 CHANGELOG）');
  }

  // 清理 preview 文件
  if (existsSync(PREVIEW)) {
    try { unlinkSync(PREVIEW); } catch {}
  }

  if (!cli.skipPush) {
    step(6, TOTAL_STEPS, 'git commit + tag + push');
    add(['package.json', 'CHANGELOG.md']);
    ok('git add');
    commit(`chore(release): prepare ${tagName}`);
    ok(`commit: chore(release): prepare ${tagName}`);
    tag(tagName, tagName);
    ok(`tag ${tagName} created`);

    try {
      push('origin', 'main');
      ok('push origin main');
      push('origin', tagName);
      ok(`push origin ${tagName}`);
    } catch (e) {
      error(`git push 失败，自动回滚：${e.message}`);
      try { deleteTagRemote('origin', tagName); } catch {}
      try { deleteTagLocal(tagName); } catch {}
      try { softResetLastCommit(); } catch {}
      exit(2, 'push 失败，已回滚本地 tag + commit，请修复后重跑');
    }
  } else {
    sub('已跳过 commit/push（--skip-push）');
  }

  step(7, TOTAL_STEPS, '等待 workflow 完成（最长 15 分钟）');
  // 用 tag 的 SHA 来定位 workflow run（更准确）
  const sha = cli.skipPush ? tagSha(tagName) : tagSha(tagName);
  sub(`head_sha = ${sha.slice(0, 7)}`);
  let runResult;
  try {
    runResult = await waitForWorkflow({
      owner: repo.owner,
      repo: repo.repo,
      sha,
      token,
      name: 'Release',
      timeoutMs: 15 * 60_000,
      intervalMs: 10_000,
    });
  } catch (e) {
    error(`workflow 失败/超时：${e.message}`);
    error(`可手动查看：https://github.com/${repo.owner}/${repo.repo}/actions`);
    error(`修完后跑：npm run release:finish ${target}`);
    process.exit(2);
  }

  if (runResult.conclusion !== 'success') {
    error(`workflow 结论：${runResult.conclusion}（非 success）`);
    error(`查看：${runResult.htmlUrl}`);
    error(`修完后跑：npm run release:finish ${target}`);
    process.exit(2);
  }
  ok(`workflow #${runResult.runNumber} 成功：${runResult.htmlUrl}`);

  step(8, TOTAL_STEPS, '把 draft release 转 published');
  const release = await getReleaseByTag({
    owner: repo.owner,
    repo: repo.repo,
    tag: tagName,
    token,
    retry: 5,
    intervalMs: 20_000,
  });
  if (!release) exit(2, '找不到 release（workflow 可能没建 draft）');
  if (!release.draft) {
    warn(`release 已经是 published 状态，跳过 PATCH`);
    success(`Release URL: ${release.html_url}`);
    process.exit(0);
  }
  sub(`release id=${release.id} draft=true`);

  // body 用 ## [...] - DATE 起头的整段
  const finalBody = entryText.trimEnd();
  const patched = await patchRelease({
    owner: repo.owner,
    repo: repo.repo,
    releaseId: release.id,
    fields: {
      draft: false,
      name: tagName,
      body: finalBody,
      prerelease: false,
    },
    token,
  });
  success(`发布成功：${patched.html_url}`);
  console.log('');
  console.log(`  ${patched.html_url}`);
  console.log('');
  process.exit(0);
}

main().catch((e) => {
  error(e.stack || e.message);
  process.exit(1);
});
