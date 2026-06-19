// scripts/release-lib/log.mjs
// 简单 logger：info / warn / error + 颜色 + 调试模式（DEBUG=1）

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code, s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : s;

const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function now() {
  return new Date().toISOString().slice(11, 19);
}

export function info(msg) {
  console.log(`${c('90', '[' + now() + ']')} ${c('36', 'ℹ')} ${msg}`);
}

export function warn(msg) {
  console.warn(`${c('90', '[' + now() + ']')} ${c('33', '⚠')} ${msg}`);
}

export function error(msg) {
  console.error(`${c('90', '[' + now() + ']')} ${c('31', '✖')} ${msg}`);
}

export function success(msg) {
  console.log(`${c('90', '[' + now() + ']')} ${c('32', '✔')} ${msg}`);
}

export function debug(msg) {
  if (DEBUG) console.log(`${c('90', '[' + now() + ']')} ${c('90', '· ' + msg)}`);
}
