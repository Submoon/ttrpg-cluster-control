import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), 'artifacts')
await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const route = 'http://127.0.0.1:3100/?variant=baseline'
  const screenshots = []

  await page.goto(route)
  await page.getByRole('heading', { name: 'Give the unknown a name.' }).waitFor({ state: 'visible' })
  await page.screenshot({ path: join(outputDirectory, 'baseline-welcome-1440x900.png'), fullPage: true })
  screenshots.push('baseline-welcome-1440x900.png')

  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('heading', { name: 'Vesper', level: 1 }).waitFor({ state: 'visible' })
  await page.getByText('Saved on this device').waitFor({ state: 'visible' })
  await page.screenshot({ path: join(outputDirectory, 'baseline-created-1440x900.png'), fullPage: true })
  screenshots.push('baseline-created-1440x900.png')

  await page.reload()
  await page.getByRole('heading', { name: 'Vesper', level: 1 }).waitFor({ state: 'visible' })
  await page.getByText('Saved on this device').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' }).waitFor({ state: 'visible' })
  await page.screenshot({ path: join(outputDirectory, 'baseline-reloaded-1440x900.png'), fullPage: true })
  screenshots.push('baseline-reloaded-1440x900.png')

  await writeFile(join(outputDirectory, 'retained-baseline.json'), JSON.stringify({
    source: '3c660a6a2df6c37f392c998c36d72cec1ddbf938',
    route,
    runtime: 'Nuxt development server on 127.0.0.1:3100',
    browser: 'Playwright Chromium, headless',
    viewport: { width: 1440, height: 900 },
    context: 'fresh isolated browser context; no preexisting workspace data',
    fixture: { cluster: 'Kestrel Reach', firstSystem: 'Vesper' },
    outcomes: {
      welcomeVisible: true,
      workspaceCreated: true,
      savedStatusVisible: true,
      reloadRestoredWorkspace: true,
      clusterMapOpenedAfterReload: true,
    },
    screenshots,
  }, null, 2))

  await context.close()
} finally {
  await browser.close()
}
