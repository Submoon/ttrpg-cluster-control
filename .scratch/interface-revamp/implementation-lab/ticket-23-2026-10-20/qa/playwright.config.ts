import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const output = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!output?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-') || output.includes('/../')) {
  throw new Error('QA_HOST_OUTPUT_ROOT must name a fresh literal ticket23 host TEMP directory.')
}
if (!process.env.QA_CANDIDATE) throw new Error('QA_CANDIDATE must identify the released source candidate.')
const workers = Number(process.env.QA_WORKERS || '1')
if (![1, 2].includes(workers)) throw new Error('One focused worker or two explicitly released final workers required.')
const splitFinal = process.env.QA_FINAL_SPLIT === '1'
// grep includes file/project prefixes: anchor the exact existing title at the end.
const viteOnlyStorageTitle = /a failed IndexedDB save preserves current and backup snapshots$/

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
  ...(splitFinal ? {
    projects: [
      { name: 'compiled', grepInvert: viteOnlyStorageTitle, use: { baseURL: 'http://127.0.0.1:3180' } },
      { name: 'development-storage', grep: viteOnlyStorageTitle, use: { baseURL: 'http://127.0.0.1:3100' } },
    ],
  } : {}),
  // QA identifies and owns each separately managed server; never restart implicitly.
})
