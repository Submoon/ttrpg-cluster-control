import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const qaDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(qaDir, '../../../..')
const outputDir = qaDir
const { chromium } = await import(pathToFileURL(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'index.mjs')).href)
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))

try {
  await page.goto('http://127.0.0.1:3144/?variant=B&controls=dock&inspectorSample=dense', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('.proto-b').waitFor({ state: 'visible', timeout: 90000 })
  await page.locator('.cluster-map-svg, .system-map-svg').first().waitFor({ state: 'visible', timeout: 30000 })
  const inspector = page.locator('#b-inspector-panel .b-inspector-card')
  await inspector.waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Apply changes', exact: true }).waitFor({ state: 'visible' })
  const desktop = await readLayout(page)
  assert.equal(desktop.title, 'Aster, Keeper of the Quiet Meridian and Outer Beacon')
  assert.ok(desktop.header.bottom <= desktop.footer.y, `Desktop header/footer order: ${JSON.stringify(desktop)}`)
  assert.ok(desktop.footer.bottom <= desktop.viewport.height + 1, `Desktop footer remains in the viewport: ${JSON.stringify(desktop)}`)
  await page.screenshot({ path: path.join(outputDir, 'smoke-production-desktop.png') })

  await page.setViewportSize({ width: 390, height: 500 })
  await page.waitForTimeout(200)
  const compact = await readLayout(page)
  assert.ok(compact.card.width > 0 && compact.card.width <= 390, `Compact inspector fits viewport width: ${JSON.stringify(compact)}`)
  assert.ok(compact.footer.bottom <= 501, `Compact footer remains reachable: ${JSON.stringify(compact)}`)
  assert.ok(compact.scrollWidth <= 391, `Compact layout has no horizontal page overflow: ${JSON.stringify(compact)}`)
  await page.screenshot({ path: path.join(outputDir, 'smoke-production-compact.png') })
  assert.deepEqual(errors, [], `Production page errors: ${errors.join('; ')}`)
  await writeFile(path.join(outputDir, 'production-smoke.json'), JSON.stringify({
    url: page.url(),
    browser: `Chrome ${browser.version()}`,
    productionBuild: true,
    pageErrors: errors,
    desktop,
    compact,
    screenshots: ['smoke-production-desktop.png', 'smoke-production-compact.png'],
  }, null, 2))
  console.log(JSON.stringify({ status: 'passed', pageErrors: errors, desktop, compact }, null, 2))
} finally {
  await browser.close()
}

async function readLayout(page) {
  return page.evaluate(() => {
    const inspector = document.querySelector('#b-inspector-panel .b-inspector-card')
    const header = inspector?.querySelector('.b-inspector-header')
    const footer = inspector?.querySelector('.b-inspector-footer')
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }
    return {
      title: inspector?.querySelector('h2')?.textContent?.trim() ?? null,
      card: rect(inspector),
      header: rect(header),
      footer: rect(footer),
      scrollWidth: document.documentElement.scrollWidth,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
}
