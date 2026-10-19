import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  testMatch: ['workspace-launch.spec.ts', 'workspace-recovery.spec.ts'],
  // This one storage-module regression needs Nuxt's development module path.
  // It remains part of the development run, never a claimed compiled pass.
  grepInvert: /a failed IndexedDB save preserves current and backup snapshots/,
  outputDir: resolve(here, 'compiled-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(here, 'compiled-results.json') }]],
  workers: 1,
  maxFailures: 1,
  use: { baseURL: 'http://127.0.0.1:3180', channel: 'chrome' },
})
