import { defineConfig, type ReporterDescription } from '@playwright/test'
import process from 'node:process'
import { validatePreviewUrl } from './scripts/ci/vercel-preview.mjs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100'
const productionURL = process.env.PLAYWRIGHT_PRODUCTION_URL
  ? validatePreviewUrl(process.env.PLAYWRIGHT_PRODUCTION_URL).toString()
  : undefined
const suite = process.env.PLAYWRIGHT_SUITE ?? 'all'
const channel = process.env.PLAYWRIGHT_CHANNEL
const browserOptions = channel ? { channel } : {}
const jsonOutputName = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME
const reporter: ReporterDescription[] | 'list' = jsonOutputName
  ? [['list'], ['json', { outputFile: jsonOutputName }]]
  : 'list'

if (!['checks', 'browser', 'all'].includes(suite)) {
  throw new Error('PLAYWRIGHT_SUITE must be checks, browser, or all.')
}

const checksProjects = [
  {
    name: 'pure',
    grep: /@pure/,
  },
  {
    name: 'development-storage',
    grep: /@development-storage/,
    use: { ...browserOptions, baseURL },
  },
]
const browserProject = {
  name: 'browser',
  grepInvert: /@pure|@development-storage/,
  use: { ...browserOptions, baseURL: productionURL ?? baseURL },
}
const allProjects = [
  ...checksProjects,
  browserProject,
]
const projects = suite === 'checks'
  ? checksProjects
  : suite === 'browser'
    ? [browserProject]
    : allProjects
const needsLocalServer = suite !== 'browser' || !productionURL

export default defineConfig({
  testDir: './tests',
  reporter,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results',
  workers: 1,
  retries: 0,
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL || !needsLocalServer
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 3100',
        url: baseURL,
        timeout: 300_000,
      },
})
