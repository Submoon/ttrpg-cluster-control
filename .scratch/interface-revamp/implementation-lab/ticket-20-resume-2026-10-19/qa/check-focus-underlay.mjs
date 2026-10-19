import { chromium, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withAbortedNextWorkspaceWrite } from './platform-hooks.mjs'
import { focusGeometry, settle } from './presentation.mjs'

const out = dirname(fileURLToPath(import.meta.url)), browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 500 }, colorScheme: 'dark', hasTouch: true, deviceScaleFactor: 1 })
const page = await context.newPage()
try {
  await page.goto('http://127.0.0.1:3180/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Focus diagnostic Reach'); await page.getByLabel('First star system').fill('Focus diagnostic Star')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).tap()
  await page.getByRole('button', { name: 'Inspect', exact: true }).tap()
  const panel = page.locator('#workspace-inspector-panel'), modal = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await panel.getByRole('button', { name: 'Chart details', exact: true }).tap(); await panel.getByRole('button', { name: 'Edit chart names', exact: true }).tap()
  await modal.getByLabel('Jump Cluster', { exact: true }).fill('Applied focus diagnostic Reach')
  await withAbortedNextWorkspaceWrite(page, async () => { await modal.getByRole('button', { name: 'Apply names', exact: true }).tap(); await expect(modal).toBeHidden() })
  await panel.getByRole('button', { name: 'Edit chart names', exact: true }).tap(); await modal.getByLabel('Jump Cluster', { exact: true }).fill('Hidden focus diagnostic draft'); await page.keyboard.press('Escape'); await expect(modal).toBeHidden(); await settle(page)
  const owner = page.locator('.workspace-compact-recovery'), retry = owner.getByRole('button', { name: 'Retry save', exact: true }), json = owner.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })
  await retry.scrollIntoViewIfNeeded(); await retry.evaluate(el => el.blur()); await settle(page)
  const before = await page.screenshot({ path: join(out, 'focus-underlay-before.png') })
  const focus = await focusGeometry(page, retry)
  const after = await page.screenshot({ path: join(out, 'focus-underlay-after.png') })
  const neighbor = await json.evaluate(el => { const r = el.getBoundingClientRect(), style = getComputedStyle(el); return { bounds: r.toJSON(), border: style.borderColor, shadow: style.boxShadow } })
  const pixels = await page.evaluate(async ({ before, after, bounds }) => {
    const read = async bytes => { const image = new Image(); image.src = `data:image/png;base64,${bytes}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0); return (x, y) => Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data).slice(0, 3) }
    const readBefore = await read(before), readAfter = await read(after), r = bounds
    const samples = [{ name: 'left ring midpoint', x: r.left - 3, y: r.top + r.height / 2 }, { name: 'right ring midpoint', x: r.right + 3, y: r.top + r.height / 2 }, { name: 'right adjacent outer pixel', x: r.right + 4.75, y: r.top + r.height / 2 }, { name: 'top ring midpoint', x: r.left + r.width / 2, y: r.top - 3 }, { name: 'bottom ring midpoint', x: r.left + r.width / 2, y: r.bottom + 3 }]
    const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    return samples.map(point => { const before = readBefore(point.x, point.y), after = readAfter(point.x, point.y), a = luminance(before), b = luminance(after); return { ...point, before, after, samePixelChangeRatio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) } })
  }, { before: before.toString('base64'), after: after.toString('base64'), bounds: focus.bounds })
  const result = { candidate: 'dc7861d736a12f545f6c2c16ddd4b53bcccc7b89', focus, neighbor, gap: neighbor.bounds.left - focus.bounds.right, ringToNeighborGap: neighbor.bounds.left - focus.bounds.right - focus.extent, pixels }
  await writeFile(join(out, 'focus-underlay-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2))
} finally { await context.close(); await browser.close() }
