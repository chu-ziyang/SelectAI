// scripts/release-lib/git.mjs
// git 命令的 spawnSync 封装。所有命令失败抛 Error（带 stderr 原文）。

import { spawnSync } from 'node:child_process';

function git(args, { cwd = process.cwd(), env = process.env, input = null, allowFailure = false } = {}) {
  const res = spawnSync('git', args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024, // 64 MB
  });
  if (res.error) throw new Error(`git ${args[0]} 启动失败：${res.error.message}`);
  if (res.status !== 0 && !allowFailure) {
    const stderr = (res.stderr || '').trim();
    const stdout = (res.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} 退出码 ${res.status}\n  stdout: ${stdout}\n  stderr: ${stderr}`);
  }
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: res.status ?? 0 };
}

// 工作区是否干净（含 untracked）
export function statusClean() {
  const { stdout } = git(['status', '--porcelain'], { allowFailure: true });
  return stdout.trim().length === 0;
}

export function currentBranch() {
  const { stdout } = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

export function headSha() {
  const { stdout } = git(['rev-parse', 'HEAD']);
  return stdout.trim();
}

export function tagSha(tag) {
  const { stdout } = git(['rev-list', '-n1', tag]);
  return stdout.trim();
}

export function lastTag() {
  // v* 的最新 tag
  const { stdout } = git(['tag', '--sort=-version:refname', '--list', 'v*'], { allowFailure: true });
  return stdout.trim().split('\n')[0] || null;
}

export function getCommitsSince(prevTag) {
  // 输出 "hash subject"，subject 不带引号
  const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
  const { stdout } = git(['log', range, '--no-merges', '--pretty=format:%H %s'], { allowFailure: true });
  if (!stdout.trim()) return [];
  return stdout.split('\n').filter(Boolean).map((line) => {
    const spaceIdx = line.indexOf(' ');
    return {
      hash: line.slice(0, spaceIdx),
      subject: line.slice(spaceIdx + 1),
    };
  });
}

export function add(paths) {
  const arr = Array.isArray(paths) ? paths : [paths];
  git(['add', '--', ...arr]);
}

export function commit(message) {
  // 多行 message：-F -
  git(['commit', '-m', message]);
}

export function tag(name, message) {
  git(['tag', '-a', name, '-m', message || name]);
}

export function push(remote, ref, { force = false } = {}) {
  const args = ['push'];
  if (force) args.push('--force');
  args.push(remote, ref);
  git(args);
}

export function deleteTagLocal(name) {
  git(['tag', '-d', name], { allowFailure: true });
}

export function deleteTagRemote(remote, name) {
  git(['push', remote, `:refs/tags/${name}`], { allowFailure: true });
}

// git reset --soft HEAD~1：撤销 commit 但保留改动在暂存
export function softResetLastCommit() {
  git(['reset', '--soft', 'HEAD~1']);
}

// 列出本地所有 v* tag
export function listLocalTags() {
  const { stdout } = git(['tag', '--list', 'v*'], { allowFailure: true });
  return stdout.trim().split('\n').filter(Boolean);
}

// 从 remote URL 解析 owner/repo
export function parseRepoFromRemote(remote = 'origin') {
  const { stdout } = git(['remote', 'get-url', remote]);
  const url = stdout.trim();
  // 支持 https://github.com/owner/repo.git 和 git@github.com:owner/repo.git
  const https = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?$/);
  if (!https) throw new Error(`无法从 remote URL 解析 owner/repo：${url}`);
  return { owner: https[1], repo: https[2].replace(/\.git$/, '') };
}
