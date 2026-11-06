import { defineConfig, type ReporterDescription } from '@playwright/test'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createPlaywrightSelection } from './scripts/playwright-selection.mjs'
import { initializePlaywrightOutput } from './scripts/playwright-output.mjs'

const output = initializePlaywrightOutput({
  env: process.env,
  args: process.argv.slice(2),
  cwd: process.cwd(),
  configFile: fileURLToPath(import.meta.url),
})
const { projects, webServer } = createPlaywrightSelection(process.env, process.argv.slice(2))
const reporter: ReporterDescription[] | 'list' = output.jsonReportFile
  ? [['list'], ['json', { outputFile: output.jsonReportFile }]]
  : 'list'

export default defineConfig({
  testDir: './tests',
  reporter,
  outputDir: output.outputDirectory,
  workers: 1,
  retries: 0,
  projects,
  globalSetup: './scripts/ci/playwright-artifacts.mjs',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer,
})
