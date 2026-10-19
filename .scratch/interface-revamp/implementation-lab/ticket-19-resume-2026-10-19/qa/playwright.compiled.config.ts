import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  testMatch: ['workspace-theme.spec.ts'],
  outputDir: resolve(here, 'compiled-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(here, 'compiled-results.json') }]],
  workers: 1,
  maxFailures: 1,
  use: { baseURL: 'http://127.0.0.1:3180', channel: 'chrome' },
  // Run only after the fresh browser's cold product/glyph navigation.
})
