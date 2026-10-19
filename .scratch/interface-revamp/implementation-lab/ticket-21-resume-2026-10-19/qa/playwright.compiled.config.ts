import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const output = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!output?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket21-') || output.includes('/../')) {
  throw new Error('QA_HOST_OUTPUT_ROOT must name the released literal ticket21 host output directory.')
}
if (!process.env.QA_FROZEN_CANDIDATE) throw new Error('QA_FROZEN_CANDIDATE must identify the compiled source freeze.')

export default defineConfig({
  testDir: resolve(repo, 'tests'),
  // Packaging/portal supplement only. The full development gate owns all tests,
  // including source-module imports that cannot run against a compiled server.
  testMatch: ['workspace-navigation.spec.ts', 'workspace-panels.spec.ts', 'workspace-chart-feedback.spec.ts'],
  outputDir: resolve(output, 'compiled-artifacts'),
  reporter: [['list'], ['json', { outputFile: resolve(output, 'compiled-results.json') }]],
  workers: 1,
  maxFailures: 0,
  retries: 0,
  use: {
    baseURL: process.env.QA_BASE_URL || 'http://127.0.0.1:3180',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Final compiled process is identified and managed separately after build.
})
