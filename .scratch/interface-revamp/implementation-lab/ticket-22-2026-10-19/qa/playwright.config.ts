import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const output = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!output?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket22-') || output.includes('/../')) {
  throw new Error('QA_HOST_OUTPUT_ROOT must name a fresh literal ticket22 host TEMP directory.')
}
if (!process.env.QA_CANDIDATE) throw new Error('QA_CANDIDATE must identify the baseline, iteration or frozen source.')
const workers = Number(process.env.QA_WORKERS || '1')
if (![1, 2].includes(workers)) throw new Error('Only one focused worker or two final isolated-context workers are permitted.')

export default defineConfig({
  testDir: resolve(repo, 'tests'),
  outputDir: resolve(output, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(output, 'results.json') }]],
  workers,
  retries: 0,
  maxFailures: 0,
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3100',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // QA alone owns the separately identified host server; no implicit restart.
})
