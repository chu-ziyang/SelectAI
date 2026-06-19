// scripts/release-lib/token.mjs
// 解析 GITHUB_TOKEN，优先级：CLI > process.env > .env.local > .env > 1Password CLI（可选）。

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function loadDotenv(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉首尾引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function tryOnePassword() {
  // 只在 PATH 有 op 时尝试
  const which = spawnSync('op', ['--version'], { encoding: 'utf8' });
  if (which.status !== 0) return null;
  // 默认 reference：op://Private/Github/credential
  const ref = process.env.OP_GITHUB_REF || 'op://Private/Github/credential';
  const res = spawnSync('op', ['read', ref], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  const token = (res.stdout || '').trim();
  return token || null;
}

export async function resolveToken({ cliToken, cwd = process.cwd() } = {}) {
  // 1. CLI
  if (cliToken) return { token: cliToken, source: '--token' };
  // 2. env
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return { token: process.env.GITHUB_TOKEN.trim(), source: 'env GITHUB_TOKEN' };
  }
  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) {
    return { token: process.env.GH_TOKEN.trim(), source: 'env GH_TOKEN' };
  }
  // 3. .env.local
  const localEnv = loadDotenv(resolve(cwd, '.env.local'));
  if (localEnv.GITHUB_TOKEN) return { token: localEnv.GITHUB_TOKEN, source: '.env.local' };
  // 4. .env
  const envFile = loadDotenv(resolve(cwd, '.env'));
  if (envFile.GITHUB_TOKEN) return { token: envFile.GITHUB_TOKEN, source: '.env' };
  // 5. 1Password（可选）
  const op = tryOnePassword();
  if (op) return { token: op, source: '1Password' };
  return { token: null, source: null };
}

export function maskToken(token) {
  if (!token) return '(none)';
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}
