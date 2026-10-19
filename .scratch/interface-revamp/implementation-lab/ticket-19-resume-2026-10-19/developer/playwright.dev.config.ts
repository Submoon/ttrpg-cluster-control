import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const repositoryRoot = process.cwd()
// Keep operational artifacts outside Nuxt's watched tree; curate only after stopping dev.
const evidenceRoot = resolve(tmpdir(), 'ticket19-developer-artifacts')

export default defineConfig({
  testDir: resolve(repositoryRoot, 'tests'),
  testMatch: ['workspace-theme.spec.ts'],
  outputDir: resolve(evidenceRoot, 'playwright-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(evidenceRoot, 'focused-final-results.json') }],
  ],
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: 'chrome',
  },
})
