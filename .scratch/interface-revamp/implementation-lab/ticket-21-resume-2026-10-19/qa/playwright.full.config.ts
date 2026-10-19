import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const output = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
const hostPrefix = 'C:/Users/fbal-fontaine/AppData/Local/Temp/ticket21-'
if (!output || !output.startsWith(hostPrefix) || output.includes('/../')) {
  throw new Error('QA_HOST_OUTPUT_ROOT must name a fresh literal C:/Users/fbal-fontaine/AppData/Local/Temp/ticket21-... host directory.')
}
if (!process.env.QA_FROZEN_CANDIDATE) throw new Error('QA_FROZEN_CANDIDATE must identify the released source freeze.')

export default defineConfig({
  testDir: resolve(repo, 'tests'),
  outputDir: resolve(output, 'full-suite-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(output, 'full-suite.json') }]],
  workers: 1,
  maxFailures: 0,
  retries: 0,
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3100',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Sole handed-off development server is identified and managed separately.
})
