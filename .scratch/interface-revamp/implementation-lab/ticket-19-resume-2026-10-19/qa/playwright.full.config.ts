import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAbsolute, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const runRoot = process.env.QA_DEV_OUTPUT_ROOT
if (!runRoot || !isAbsolute(runRoot) || !relative(repo, runRoot).startsWith('..')) {
  throw new Error('QA_DEV_OUTPUT_ROOT must be an absolute fresh temporary directory outside the watched repository.')
}

export default defineConfig({
  testDir: resolve(here, '../../../../../tests'),
  outputDir: resolve(runRoot, 'full-suite-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(runRoot, 'full-suite.json') }]],
  workers: 1,
  maxFailures: 1,
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'chrome' },
  // Output, reports and shell logs stay outside the watched repo during this sole attempt.
})
