// scripts/release-lib/ui.mjs
// ANSI 颜色 + 步骤进度 + 提示输入。零依赖。

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR === '1');
const c = (code, s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : s;

export const colors = {
  red: (s) => c('31', s),
  green: (s) => c('32', s),
  yellow: (s) => c('33', s),
  blue: (s) => c('34', s),
  magenta: (s) => c('35', s),
  cyan: (s) => c('36', s),
  gray: (s) => c('90', s),
  bold: (s) => c('1', s),
  dim: (s) => c('2', s),
};

export function step(n, total, msg) {
  console.log(`\n${colors.bold(colors.cyan(`[${n}/${total}]`))} ${colors.bold(msg)}`);
}

export function ok(msg) {
  console.log(`  ${colors.green('✔')} ${msg}`);
}

export function sub(msg) {
  console.log(`  ${colors.gray(msg)}`);
}

// 简单 prompt：readline.question。--yes 跳过返回 true。EOF 返回 true（自动接受）。
export async function prompt(question, { defaultYes = true } = {}) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  process.stdout.write(`${colors.cyan('?')} ${question} ${colors.gray(hint)} `);
  // 非 TTY：直接接受默认值
  if (!process.stdin.isTTY) return defaultYes;

  const rl = await import('node:readline');
  const r = rl.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    r.question('', (answer) => {
      r.close();
      const a = (answer || '').trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else if (a === 'y' || a === 'yes') resolve(true);
      else if (a === 'n' || a === 'no') resolve(false);
      else resolve(defaultYes); // 其他输入采用默认
    });
  });
}

// spinner：仅在使用 TTY 时启用
export function spinner(text) {
  if (!process.stderr.isTTY) {
    process.stderr.write(`  ${colors.gray('…')} ${text}\n`);
    return { stop: (finalText) => process.stderr.write(`  ${colors.green('✔')} ${finalText}\n`), update: () => {} };
  }
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const start = Date.now();
  const tick = () => {
    process.stderr.write(`\r  ${colors.cyan(frames[i++ % frames.length])} ${text} ${colors.gray(`(${Math.round((Date.now() - start) / 1000)}s)`)}`);
  };
  tick();
  const timer = setInterval(tick, 100);
  return {
    update: (newText) => { text = newText; tick(); },
    stop: (finalText) => {
      clearInterval(timer);
      process.stderr.write(`\r  ${colors.green('✔')} ${finalText} ${colors.gray(`(${Math.round((Date.now() - start) / 1000)}s)`)}\n`);
    },
    fail: (finalText) => {
      clearInterval(timer);
      process.stderr.write(`\r  ${colors.red('✖')} ${finalText}\n`);
    },
  };
}
