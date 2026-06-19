// scripts/release.test.mjs
// 用 node:test 跑核心逻辑单测。运行：node --test scripts/release.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- version.mjs ---
import {
  isValidSemver, parseSemver, compareSemver, bump, resolveTargetVersion,
} from './release-lib/version.mjs';

test('isValidSemver', () => {
  assert.equal(isValidSemver('1.2.3'), true);
  assert.equal(isValidSemver('0.0.0'), true);
  assert.equal(isValidSemver('10.20.30'), true);
  assert.equal(isValidSemver('1.2'), false);
  assert.equal(isValidSemver('1.2.3.4'), false);
  assert.equal(isValidSemver('v1.2.3'), false);
  assert.equal(isValidSemver(''), false);
  assert.equal(isValidSemver(null), false);
});

test('bump patch / minor / major', () => {
  assert.equal(bump('1.2.3', 'patch'), '1.2.4');
  assert.equal(bump('1.2.3', 'minor'), '1.3.0');
  assert.equal(bump('1.2.3', 'major'), '2.0.0');
  assert.equal(bump('0.0.0', 'patch'), '0.0.1');
  assert.equal(bump('0.0.9', 'minor'), '0.1.0');
});

test('compareSemver', () => {
  assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
  assert.equal(compareSemver('1.2.4', '1.2.3'), 1);
  assert.equal(compareSemver('1.2.3', '1.2.4'), -1);
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
});

test('resolveTargetVersion', () => {
  assert.equal(resolveTargetVersion('1.3.0', '1.2.0'), '1.3.0');
  assert.equal(resolveTargetVersion('patch', '1.2.0'), '1.2.1');
  assert.equal(resolveTargetVersion('minor', '1.2.0'), '1.3.0');
  assert.equal(resolveTargetVersion('major', '1.2.0'), '2.0.0');
  assert.throws(() => resolveTargetVersion('1.2.0', '1.2.0'), /必须大于/);
  assert.throws(() => resolveTargetVersion('0.9.0', '1.2.0'), /必须大于/);
  assert.throws(() => resolveTargetVersion('abc', '1.2.0'), /非法/);
  assert.throws(() => resolveTargetVersion('', '1.2.0'), /缺少/);
});

// --- conventional.mjs ---
import {
  parseCommitMessage, typeToChinese, bucketize, renderBucketsOrdered, CATEGORY_ORDER,
} from './release-lib/conventional.mjs';

test('parseCommitMessage', () => {
  assert.deepEqual(parseCommitMessage('feat: 新增 X'), { type: 'feat', scope: null, subject: '新增 X' });
  assert.deepEqual(parseCommitMessage('fix(popup): 修复弹窗 y'), { type: 'fix', scope: 'popup', subject: '修复弹窗 y' });
  assert.deepEqual(parseCommitMessage('feat(api)!: breaking change'), { type: 'feat', scope: 'api', subject: 'breaking change' });
  assert.equal(parseCommitMessage('not conventional'), null);
  assert.equal(parseCommitMessage(''), null);
});

test('typeToChinese mapping', () => {
  assert.equal(typeToChinese('feat'), '新增');
  assert.equal(typeToChinese('fix'), '修复');
  assert.equal(typeToChinese('refactor'), '重构');
  assert.equal(typeToChinese('perf'), '改进');
  assert.equal(typeToChinese('style'), '改进');
  assert.equal(typeToChinese('security'), '安全加固');
  assert.equal(typeToChinese('docs'), null);
  assert.equal(typeToChinese('test'), null);
  assert.equal(typeToChinese('chore'), null);
  assert.equal(typeToChinese('ci'), null);
  assert.equal(typeToChinese('build'), null);
  assert.equal(typeToChinese('unknown'), '其他');
});

test('bucketize + render', () => {
  const commits = [
    { hash: 'a1', subject: 'feat: 新增自动发布脚本' },
    { hash: 'a2', subject: 'fix(popup): 修复弹窗抖动' },
    { hash: 'a3', subject: 'chore(release): prepare v1.2.0' },
    { hash: 'a4', subject: 'refactor: 抽出 urlValidation' },
    { hash: 'a5', subject: 'not conventional commit' },
    { hash: 'a6', subject: 'feat(api): 新增流式 API' },
  ];
  const buckets = bucketize(commits);
  assert.equal(buckets.get('新增').length, 2);
  assert.equal(buckets.get('修复').length, 1);
  assert.equal(buckets.get('重构').length, 1);
  assert.equal(buckets.has('安全加固'), false);

  const md = renderBucketsOrdered(buckets);
  // 顺序：新增 → 修复 → 重构
  const addIdx = md.indexOf('### 新增');
  const fixIdx = md.indexOf('### 修复');
  const refactorIdx = md.indexOf('### 重构');
  assert.ok(addIdx < fixIdx && fixIdx < refactorIdx, 'sections 应该按 CATEGORY_ORDER 顺序');
  assert.ok(md.includes('自动发布脚本'));
  assert.ok(md.includes('弹出抖动') === false); // 错别字，应该不出现
  assert.ok(md.includes('修复弹窗抖动'));
  assert.ok(!md.includes('chore')); // 丢弃
  assert.ok(!md.includes('not conventional')); // 解析失败，丢弃
});

// --- changelog.mjs ---
import { parseChangelog, insertEntry, buildFullEntry, generateEntryBody } from './release-lib/changelog.mjs';

test('parseChangelog', () => {
  const text = `# 更新日志

## [1.2.0] - 2026-06-19

### 新增
- xxx

## [1.0.0] - 2026-06-07

### 新增
- yyy
`;
  const parsed = parseChangelog(text);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[0].version, '1.2.0');
  assert.equal(parsed.entries[0].date, '2026-06-19');
  assert.equal(parsed.entries[1].version, '1.0.0');
  assert.ok(parsed.entries[0].body.includes('xxx'));
});

test('insertEntry', () => {
  const text = `# Header

## [1.2.0] - 2026-06-19

old body
`;
  const newEntry = `## [1.3.0] - 2026-06-20

### 新增
- new feature
`;
  const result = insertEntry(text, newEntry);
  // 新 entry 应该在 1.2.0 之前
  const newIdx = result.indexOf('## [1.3.0]');
  const oldIdx = result.indexOf('## [1.2.0]');
  assert.ok(newIdx < oldIdx, '新 entry 应该在旧 entry 之前');
  assert.ok(result.includes('new feature'));
});

test('insertEntry 空 CHANGELOG', () => {
  const text = `# 更新日志

只有 header，没有 ## [...] 段
`;
  const newEntry = `## [1.0.0] - 2026-06-07\n\nfirst entry`;
  const result = insertEntry(text, newEntry);
  assert.ok(result.includes('## [1.0.0]'));
});

test('buildFullEntry', () => {
  const e = buildFullEntry('1.3.0', '2026-06-20', '### 新增\n\n- x');
  assert.ok(e.startsWith('## [1.3.0] - 2026-06-20\n'));
  assert.ok(e.includes('- x'));
});

test('generateEntryBody (empty)', () => {
  const body = generateEntryBody([]);
  assert.ok(body.includes('本次发布无'));
});

// --- args.mjs ---
import { parseCli } from './release-lib/args.mjs';

test('parseCli basic', () => {
  // 提供 --help 会调 process.exit，绕开
  const origExit = process.exit;
  process.exit = () => { throw new Error('exit'); };
  try {
    try { parseCli(['--help']); } catch (e) { assert.match(e.message, /exit/); }
  } finally { process.exit = origExit; }

  const c = parseCli(['1.3.0']);
  assert.equal(c.version, '1.3.0');
  assert.equal(c.dryRun, false);
  assert.equal(c.skipNotes, false);
});

test('parseCli options', () => {
  const c = parseCli(['patch', '--yes', '--dry-run', '--skip-push', '--token', 'abc', '--notes', 'foo.md']);
  assert.equal(c.version, 'patch');
  assert.equal(c.yes, true);
  assert.equal(c.dryRun, true);
  assert.equal(c.skipPush, true);
  assert.equal(c.token, 'abc');
  assert.equal(c.notesFile, 'foo.md');
});

test('parseCli unknown option', () => {
  assert.throws(() => parseCli(['--unknown']));
});
