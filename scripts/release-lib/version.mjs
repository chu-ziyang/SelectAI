// scripts/release-lib/version.mjs
// semver 校验、bump、tag 冲突检测。零依赖。

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function isValidSemver(v) {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

export function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new Error(`非法版本号：${v}（期望 X.Y.Z 格式）`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

export function compareSemver(a, b) {
  const A = parseSemver(a);
  const B = parseSemver(b);
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  return A.patch - B.patch;
}

export function bump(current, kind) {
  const { major, minor, patch } = parseSemver(current);
  switch (kind) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`未知的 bump 类型：${kind}`);
  }
}

// 解析"显式 semver / 关键字 patch|minor|major / 数字"
export function resolveTargetVersion(input, currentVersion) {
  if (!input || typeof input !== 'string') {
    throw new Error('缺少版本号参数（用法：npm run release 1.3.0 或 patch|minor|major）');
  }
  const s = input.trim().toLowerCase();
  let target;
  if (['patch', 'minor', 'major'].includes(s)) {
    target = bump(currentVersion, s);
  } else if (isValidSemver(s)) {
    target = s;
  } else {
    throw new Error(`非法版本号：${input}（期望 1.3.0 或 patch|minor|major）`);
  }
  if (compareSemver(target, currentVersion) <= 0) {
    throw new Error(`目标版本 ${target} 必须大于当前版本 ${currentVersion}`);
  }
  return target;
}

// tag 冲突检测：本地 + 远端
export function tagExistsLocally(tag) {
  try {
    const { execSync } = require('node:child_process');
    const out = execSync(`git tag --list ${tag}`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export async function tagExistsRemotely(remote, tag) {
  const { execSync } = require('node:child_process');
  try {
    const out = execSync(`git ls-remote --tags ${remote} refs/tags/${tag}`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export async function assertTagFree(tag, { remote = 'origin' } = {}) {
  if (tagExistsLocally(tag)) {
    throw new Error(`本地已存在 tag ${tag}（请删除或换版本号）`);
  }
  if (await tagExistsRemotely(remote, tag)) {
    throw new Error(`远端 ${remote} 已存在 tag ${tag}（请删除或换版本号）`);
  }
}
