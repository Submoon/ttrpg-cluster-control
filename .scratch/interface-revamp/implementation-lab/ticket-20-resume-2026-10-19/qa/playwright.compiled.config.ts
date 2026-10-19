import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  testMatch: ['workspace-chart-drafts.spec.ts', 'workspace-chart-feedback.spec.ts', 'workspace-theme.spec.ts', 'workspace-launch.spec.ts'],
  outputDir: resolve(here, process.env.QA_COMPILED_ARTIFACTS || 'compiled-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(here, process.env.QA_COMPILED_REPORT || 'compiled-results.json') }]],
  workers: 1,
  maxFailures: 1,
  use: { baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3180', channel: 'chrome' },
  // The one final compiled build/server is managed separately after handoff.
})
