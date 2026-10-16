import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  testMatch: ['workspace-theme.spec.ts', 'workspace-launch.spec.ts'],
  outputDir: resolve(here, 'test-results'),
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3119' },
})
