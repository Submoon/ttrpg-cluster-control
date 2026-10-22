import { defineConfig, type ReporterDescription } from '@playwright/test'
import process from 'node:process'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100'
const productionURL = process.env.PLAYWRIGHT_PRODUCTION_URL
const channel = process.env.PLAYWRIGHT_CHANNEL
const storageOnlyCase = /a failed IndexedDB save preserves current and backup snapshots$/
const browserOptions = channel ? { channel } : {}
const jsonOutputName = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME
const reporter: ReporterDescription[] | 'list' = jsonOutputName
  ? [['list'], ['json', { outputFile: jsonOutputName }]]
  : 'list'

const projects = productionURL
  ? [
      {
        name: 'compiled',
        grepInvert: storageOnlyCase,
        use: { ...browserOptions, baseURL: productionURL },
      },
      {
        name: 'development-storage',
        grep: storageOnlyCase,
        use: { ...browserOptions, baseURL },
      },
    ]
  : [
      {
        name: 'development',
        use: { ...browserOptions, baseURL },
      },
    ]

export default defineConfig({
  testDir: './tests',
  reporter,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results',
  workers: 1,
  retries: 0,
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 3100',
        url: baseURL,
        timeout: 300_000,
      },
})
