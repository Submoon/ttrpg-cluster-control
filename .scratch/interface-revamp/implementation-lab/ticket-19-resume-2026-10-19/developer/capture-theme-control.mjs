import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const evidenceDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(evidenceDirectory, '../../../../..')
const baseURL = 'http://127.0.0.1:3100'
const phase = process.argv[2]
if (!['before', 'after'].includes(phase)) throw new Error('Pass either "before" or "after" as the capture phase.')

const manifest = {
  phase,
  route: '/',
  baseURL,
  fixture: 'Empty isolated browser storage at the real product root.',
  input: 'Keyboard-focused real Theme button.',
  source: {},
  browser: null,
  captures: [],
}
for (const file of ['components/WorkspaceHeader.vue', 'assets/css/main.css', 'tests/workspace-theme.spec.ts', 'nuxt.config.ts']) {
  manifest.source[file] = createHash('sha256').update(await readFile(resolve(repositoryRoot, file))).digest('hex')
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
manifest.browser = { name: 'Google Chrome channel', version: browser.version(), headless: true, deviceScaleFactor: 1 }

try {
  for (const scenario of [
    { name: 'desktop-light', viewport: { width: 1440, height: 900 }, theme: 'light' },
    { name: 'short-landscape-dark', viewport: { width: 844, height: 390 }, theme: 'dark' },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport, colorScheme: scenario.theme, deviceScaleFactor: 1, serviceWorkers: 'block' })
    try {
      const page = await context.newPage()
      await page.goto(baseURL)
      await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scenario.theme)
      const button = page.getByRole('group', { name: 'Theme', exact: true })
        .getByRole('button', { name: /switch to (light|dark) mode/i })
      await button.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await page.waitForTimeout(250)
      const fileName = `theme-control-${phase}-${scenario.name}.png`
      await page.screenshot({ path: resolve(evidenceDirectory, fileName), fullPage: false })
      manifest.captures.push({ file: fileName, viewport: scenario.viewport, theme: scenario.theme, focusedButton: await button.getAttribute('aria-label') })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(resolve(evidenceDirectory, `theme-control-${phase}-manifest.json`), JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify(manifest, null, 2))
}
