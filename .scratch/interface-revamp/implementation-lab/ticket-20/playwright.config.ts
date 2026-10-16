import { defineConfig } from '@playwright/test'
import path from 'node:path'

export default defineConfig({
  testDir: path.resolve(process.cwd(), 'tests'),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
})
