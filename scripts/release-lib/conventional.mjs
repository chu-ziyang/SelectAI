// scripts/release-lib/conventional.mjs
// 解析 conventional commit，把 type 映射到中文分类。

// 匹配：type(scope)?: subject  或  type: subject
const COMMIT_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?!?:\s*(?<subject>.+)$/;

export function parseCommitMessage(msg) {
  if (typeof msg !== 'string') return null;
  const m = COMMIT_RE.exec(msg.trim());
  if (!m || !m.groups) return null;
  return {
    type: m.groups.type,
    scope: m.groups.scope || null,
    subject: m.groups.subject.trim(),
  };
}

// type -> 中文分类。返回 null 表示丢弃。
const TYPE_MAP = {
  feat: '新增',
  fix: '修复',
  refactor: '重构',
  perf: '改进',
  style: '改进',
  security: '安全加固',
  docs: null,
  test: null,
  chore: null,
  ci: null,
  build: null,
};

export function typeToChinese(type) {
  return Object.prototype.hasOwnProperty.call(TYPE_MAP, type) ? TYPE_MAP[type] : '其他';
}

// 把 commit 列表分桶。commits 形如 [{ hash, subject }]。
export function bucketize(commits) {
  const buckets = new Map();
  for (const c of commits) {
    const parsed = parseCommitMessage(c.subject);
    if (!parsed) continue;
    const cat = typeToChinese(parsed.type);
    if (!cat) continue; // 丢弃
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat).push({ ...c, ...parsed });
  }
  return buckets;
}

// 渲染成 markdown 段："### 新增\n- xxx\n- yyy\n\n### 修复\n- zzz"
export function renderBucketsToMarkdown(buckets) {
  const sections = [];
  for (const [cat, items] of buckets) {
    if (items.length === 0) continue;
    const lines = items.map((it) => {
      // subject 已经不含 type prefix，直接用
      return `- ${it.subject}`;
    });
    sections.push(`### ${cat}\n\n${lines.join('\n')}`);
  }
  return sections.length ? sections.join('\n\n') + '\n' : '';
}

// 类别顺序（中文分类顺序固定）
export const CATEGORY_ORDER = ['新增', '修复', '重构', '改进', '安全加固', '其他'];

// 按固定顺序渲染 buckets
export function renderBucketsOrdered(buckets) {
  const sections = [];
  for (const cat of CATEGORY_ORDER) {
    if (!buckets.has(cat)) continue;
    const items = buckets.get(cat);
    if (items.length === 0) continue;
    const lines = items.map((it) => `- ${it.subject}`);
    sections.push(`### ${cat}\n\n${lines.join('\n')}`);
  }
  return sections.length ? sections.join('\n\n') + '\n' : '';
}
