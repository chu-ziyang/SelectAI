// scripts/release-lib/github.mjs
// GitHub REST API 封装（releases + actions runs）。零依赖，使用 Node 18+ 内置 fetch。

const API_BASE = 'https://api.github.com';
const USER_AGENT = 'selectai-release-script';

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  };
}

export async function api(method, path, { token, body, query } = {}) {
  if (!token) throw new Error('api() 调用必须传 token');
  let url = `${API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += (path.includes('?') ? '&' : '?') + qs;
  }
  const init = {
    method,
    headers: authHeaders(token),
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    body: json,
  };
}

export async function getReleaseByTag({ owner, repo, tag, token, retry = 3, intervalMs = 30_000 } = {}) {
  let lastErr;
  for (let i = 0; i < retry; i++) {
    const r = await api('GET', `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, { token });
    if (r.status === 200 && r.body && r.body.id) {
      return r.body;
    }
    if (r.status === 404) {
      lastErr = new Error(`release for ${tag} not found (404)，可能 workflow 还没建好`);
      // 等待重试
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    // 其他错误：抛
    throw new Error(`getReleaseByTag 失败：HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  throw lastErr;
}

export async function patchRelease({ owner, repo, releaseId, fields, token }) {
  if (!releaseId) throw new Error('patchRelease 必须传 releaseId');
  const r = await api('PATCH', `/repos/${owner}/${repo}/releases/${releaseId}`, { token, body: fields });
  if (r.status !== 200) {
    throw new Error(`patchRelease 失败：HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  return r.body;
}

export async function listWorkflowRunsBySha({ owner, repo, sha, token, name } = {}) {
  const r = await api('GET', `/repos/${owner}/${repo}/actions/runs`, {
    token,
    query: { head_sha: sha, per_page: 20 },
  });
  if (r.status !== 200) {
    throw new Error(`listWorkflowRuns 失败：HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  let runs = r.body.workflow_runs || [];
  if (name) runs = runs.filter((run) => run.name === name);
  return runs;
}
