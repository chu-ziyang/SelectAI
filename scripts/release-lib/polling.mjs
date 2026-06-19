// scripts/release-lib/polling.mjs
// workflow run 轮询：等它 completed，然后返回结论。

import { listWorkflowRunsBySha } from './github.mjs';
import { spinner } from './ui.mjs';

export async function waitForWorkflow({ owner, repo, sha, token, name = 'Release', timeoutMs = 15 * 60_000, intervalMs = 10_000, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSeenRunId = null;
  const sp = spinner(`等待 workflow ${name} 启动...`);
  try {
    // 第一次：先等 run 出现
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('已取消');
      const runs = await listWorkflowRunsBySha({ owner, repo, sha, token, name });
      const run = runs.find((r) => r.head_sha === sha);
      if (run) {
        lastSeenRunId = run.id;
        sp.update(`workflow ${name} #${run.run_number} status=${run.status} conclusion=${run.conclusion || '-'}`);
        if (run.status === 'completed') {
          sp.stop(`workflow ${name} #${run.run_number} 完成：${run.conclusion}`);
          return {
            runId: run.id,
            conclusion: run.conclusion,
            htmlUrl: run.html_url,
            runNumber: run.run_number,
          };
        }
      }
      await sleep(intervalMs, signal);
    }
    throw new Error(`workflow 等待超时（${Math.round(timeoutMs / 1000)}s）`);
  } catch (e) {
    sp.fail(`workflow 等待出错：${e.message}`);
    throw e;
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('已取消'));
    const t = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error('已取消'));
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}
