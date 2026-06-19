import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest 仅覆盖纯函数（electron/lib 与 src/shared）。
// 这些模块刻意不依赖 electron / DOM，因此无需 jsdom 环境。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['electron/lib/**/*.test.ts', 'src/shared/**/*.test.ts'],
    environment: 'node',
  },
})
