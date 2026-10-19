import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

const repositoryRoot = process.cwd()

export default defineConfig({
  testDir: resolve(repositoryRoot, 'tests'),
  testMatch: ['workspace-launch.spec.ts', 'workspace-recovery.spec.ts'],
  outputDir: resolve(repositoryRoot, '.scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/developer/playwright-results'),
  reporter: 'list',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: 'chrome',
  },
})
