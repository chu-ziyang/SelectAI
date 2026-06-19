// scripts/release-lib/version.mjs 的简化版（main 进程用，纯 TS）。
// 仅支持 X.Y.Z 格式（不解析 pre-release / build metadata），足够本地 bump 比对。

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/

export function compareSemver(a: string, b: string): number {
  const am = SEMVER_RE.exec(a || '')
  const bm = SEMVER_RE.exec(b || '')
  if (!am || !bm) return 0
  const aM = +am[1], am_ = +am[2], ap = +am[3]
  const bM = +bm[1], bm_ = +bm[2], bp = +bm[3]
  if (aM !== bM) return aM - bM
  if (am_ !== bm_) return am_ - bm_
  return ap - bp
}