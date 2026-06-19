// scripts/release-lib/changelog.mjs
// 读 / 解析 / 生成 / 插入 CHANGELOG.md。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { bucketize, renderBucketsOrdered, CATEGORY_ORDER } from './conventional.mjs';

// 解析 CHANGELOG.md 的所有 ## [X.Y.Z] - DATE 段
// 返回 { header, entries: [{ version, date, body, raw }], fullText }
export function parseChangelog(text) {
  const lines = text.split(/\r?\n/);
  const headerEnd = lines.findIndex((l, i) => i > 0 && l.startsWith('## ['));
  const header = headerEnd === -1 ? text : lines.slice(0, headerEnd).join('\n');
  if (headerEnd === -1) {
    return { header, entries: [], fullText: text };
  }
  // 从 headerEnd 开始按 "## [" 切分
  const sections = [];
  let current = null;
  for (let i = headerEnd; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^## \[(?<v>[^\]]+)\] - (?<d>\d{4}-\d{2}-\d{2})/);
    if (m) {
      if (current) sections.push(current);
      current = { version: m.groups.v, date: m.groups.d, bodyLines: [line] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) sections.push(current);

  const entries = sections.map((s) => ({
    version: s.version,
    date: s.date,
    body: s.bodyLines.join('\n'),
  }));

  return { header, entries, fullText: text };
}

export function findLastEntry(parsed) {
  return parsed.entries[0] || null;
}

// 从 commits 生成 markdown entry（不含 ## [X.Y.Z] - DATE 头）
export function generateEntryBody(commits) {
  const buckets = bucketize(commits);
  const md = renderBucketsOrdered(buckets);
  return md || '_（本次发布无 conventional commit 变更记录；请手动补充。）_\n';
}

// 拼成完整 "## [X.Y.Z] - YYYY-MM-DD\n\n<entryBody>"
export function buildFullEntry(version, date, entryBody) {
  // entryBody 末尾自带换行
  return `## [${version}] - ${date}\n\n${entryBody}`;
}

// 把新 entry 插到 header 后、第一个 ## [ 之前
export function insertEntry(text, newEntry) {
  const parsed = parseChangelog(text);
  const oldFirst = parsed.entries[0];
  if (!oldFirst) {
    // 没有任何 ## [...] 段，append 到 header 后
    return parsed.header.trimEnd() + '\n\n' + newEntry + '\n';
  }
  const insertIdx = text.indexOf(`## [${oldFirst.version}]`);
  if (insertIdx === -1) {
    return text.trimEnd() + '\n\n' + newEntry + '\n';
  }
  return text.slice(0, insertIdx) + newEntry + '\n' + text.slice(insertIdx);
}

export function readChangelog(path = 'CHANGELOG.md') {
  if (!existsSync(path)) throw new Error(`找不到 ${path}`);
  return readFileSync(path, 'utf8');
}

export function writeChangelog(path, newText) {
  writeFileSync(path, newText, 'utf8');
}

// 把生成的 entry 写到 .release-notes-draft.md，给编辑器预览
export function writePreview(entryText, path = '.release-notes-draft.md') {
  writeFileSync(path, entryText, 'utf8');
  return path;
}

// 选择编辑器：$VISUAL > $EDITOR > Windows notepad
export function pickEditor() {
  if (process.env.VISUAL) return { cmd: process.env.VISUAL, args: [] };
  if (process.env.EDITOR) return { cmd: process.env.EDITOR, args: [] };
  if (process.platform === 'win32') return { cmd: 'notepad.exe', args: [] };
  if (process.platform === 'darwin') return { cmd: 'open', args: ['-t'] };
  return { cmd: 'vi', args: [] };
}

// 用编辑器打开文件。返回 { edited: boolean, content: string }
export async function editFile(filePath) {
  const { cmd, args } = pickEditor();
  // VS Code 用 -w 等待关闭
  const fullArgs = cmd.includes('code') ? [filePath, '--wait'] : [...args, filePath];
  return new Promise((resolve, reject) => {
    const res = spawnSync(cmd, fullArgs, { stdio: 'inherit' });
    if (res.status !== 0) return reject(new Error(`编辑器退出码 ${res.status}`));
    const content = readFileSync(filePath, 'utf8');
    resolve({ edited: true, content });
  });
}
