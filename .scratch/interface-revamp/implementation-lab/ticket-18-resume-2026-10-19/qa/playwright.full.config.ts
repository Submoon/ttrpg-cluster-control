import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  outputDir: resolve(here, 'full-suite-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(here, 'full-suite.json') }]],
  workers: 1,
  maxFailures: 1,
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'chrome' },
  // The single existing development server is handed over by the implementer.
  // No webServer or testMatch: discover the whole repository suite once.
})
