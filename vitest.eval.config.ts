import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Evaluation against the real Jev API: run on demand, never as part of `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@config': fileURLToPath(new URL('./config', import.meta.url)),
    },
  },
  test: { include: ['scripts/**/*.eval.ts'], environment: 'node', testTimeout: 120_000 },
})
