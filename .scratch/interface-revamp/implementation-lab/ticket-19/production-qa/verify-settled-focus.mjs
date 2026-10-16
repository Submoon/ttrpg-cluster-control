import { chromium, expect } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const out = dirname(fileURLToPath(import.meta.url)), base = 'http://127.0.0.1:3119'
const root = resolve(out, '../../../../..')
const evidence = { timestamp: new Date().toISOString(), baseline: '006a245134ad06baaf0f56333d2722428b0df367', base, route: '/', runtime: 'final padding compiled .output/server/index.mjs; focused presentation recheck; no repeated cold resource claim', identity: {}, checks: [], samples: [], network: [], console: [], pageerrors: [] }
for (const file of ['components/WorkspaceHeader.vue', 'components/FieldDefinitionsDialog.vue', 'assets/css/main.css', 'assets/css/map-workspace.css', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tests/workspace-theme.spec.ts', '.output/nitro.json', '.output/server/index.mjs']) evidence.identity[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex')
const browser = await chromium.launch({ headless: true })
evidence.browser = `Playwright Chromium ${browser.version()}, headless, device scale 1; touch emulation at mobile sizes`
const check = (name, passed, detail) => { evidence.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}: ${JSON.stringify(detail)}`) }
const settle = locator => locator.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
async function capture(page, control, label, kind) {
  if (kind === 'boundary') { await control.evaluate(el => el.blur()); await settle(control) }
  else { await control.scrollIntoViewIfNeeded(); await control.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await settle(control) }
  const row = await control.evaluate((el, kind) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), extent = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset))
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d', { willReadFrequently: true }); const color = kind === 'boundary' ? s.borderTopColor : s.outlineColor; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
    const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), clippedBy = []
    for (let parent = el.parentElement; parent; parent = parent.parentElement) { const ps = getComputedStyle(parent), p = parent.getBoundingClientRect(); if ((/(hidden|clip|auto|scroll)/.test(ps.overflowX) && (r.left - extent < p.left - .1 || r.right + extent > p.right + .1)) || (/(hidden|clip|auto|scroll)/.test(ps.overflowY) && (r.top - extent < p.top - .1 || r.bottom + extent > p.bottom + .1))) clippedBy.push(parent.tagName) }
    return { kind, color, rgba: Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v), bounds: r.toJSON(), extent, offset: kind === 'boundary' ? 2 : extent + .75, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, outlineStyle: s.outlineStyle, scrollMarginTop: s.scrollMarginTop, scrollY, focus: document.activeElement === el, hit: center === el || el.contains(center), clippedBy, ringFits: r.top >= extent - .1 && r.bottom <= innerHeight - extent + .1 && r.left >= extent - .1 && r.right <= innerWidth - extent + .1 }
  }, kind)
  const png = (await page.screenshot()).toString('base64')
  const measured = await page.evaluate(async ({ row, png }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const at = (x, y) => Array.from(ctx.getImageData(Math.max(0, Math.min(img.width - 1, Math.floor(x))), Math.max(0, Math.min(img.height - 1, Math.floor(y))), 1, 1).data).slice(0, 3)
    const r = row.bounds, d = row.offset, backgrounds = [at(r.left - d, r.top + r.height / 2), at(r.right + d, r.top + r.height / 2), at(r.left + r.width / 2, r.top - d), at(r.left + r.width / 2, r.bottom + d)]
    const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0)
    const ratios = backgrounds.map(bg => { const f = row.rgba.slice(0, 3).map((v, i) => v * row.rgba[3] + bg[i] * (1 - row.rgba[3])), a = lum(f), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) })
    return { ...row, backgrounds, ratios, minimum: Math.min(...ratios) }
  }, { row, png })
  evidence.samples.push({ label, ...measured }); check(`${label}: settled contrast`, measured.minimum >= 3, measured)
  if (kind === 'focus') check(`${label}: complete focus ring`, row.focus && row.ringFits && row.hit && !row.clippedBy.length && row.outlineStyle !== 'none' && parseFloat(row.outlineWidth) >= 2, row)
}
async function overflow(page, label) { const row = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth })); check(`${label}: no horizontal overflow`, row.width <= row.viewport + 1, row) }
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 500 }]) for (const initial of ['light', 'dark']) {
    const label = `${viewport.width}x${viewport.height}-${initial}`, opposite = initial === 'light' ? 'dark' : 'light'
    const context = await browser.newContext({ viewport, colorScheme: initial, hasTouch: viewport.width !== 1440, serviceWorkers: 'block' }); context.setDefaultTimeout(10000)
    await context.route('**/*', route => { if (['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)) return route.continue(); evidence.network.push(route.request().url()); return route.abort('blockedbyclient') })
    const page = await context.newPage()
    page.on('pageerror', error => evidence.pageerrors.push(error.message)); page.on('console', message => { if (['warning', 'error'].includes(message.type())) evidence.console.push({ type: message.type(), text: message.text() }) })
    try {
      await page.goto(base); await page.getByRole('heading', { name: 'Give the unknown a name.' }).waitFor(); await page.emulateMedia({ colorScheme: opposite }); await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${opposite}\\b`))
      await overflow(page, `${label} welcome`)
      await capture(page, page.getByRole('button', { name: /Switch to (light|dark)/ }), `${label} theme`, 'focus')
      await page.screenshot({ path: join(out, `final-${label}-welcome-viewport.png`) })
      const toggle = page.getByRole('button', { name: /Switch to (light|dark)/ }); if (viewport.width === 1440) await page.keyboard.press('Enter'); else await toggle.tap(); await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${initial}\\b`)); await page.getByLabel('Jump Cluster', { exact: true }).fill('Settled Reach'); await page.getByLabel('First star system').fill('Settled Star'); const create = page.getByRole('button', { name: 'Create local workspace' }); if (viewport.width === 1440) await create.click(); else await create.tap(); await page.getByText('Saved on this device').waitFor(); await page.getByRole('button', { name: 'Cluster map', exact: true }).click()
      await overflow(page, `${label} created cluster`)
      const trigger = page.getByRole('button', { name: 'Open field definitions', exact: true }); await capture(page, trigger, `${label} Fields trigger`, 'focus')
      await page.screenshot({ path: join(out, `final-${label}-Fields-trigger-viewport.png`) })
      if (viewport.width === 1440) await page.keyboard.press('Enter'); else await trigger.tap(); const fields = page.getByRole('dialog', { name: 'Field definitions', exact: true }); await fields.waitFor(); check(`${label}: native body portal and focus entry`, await fields.evaluate(el => el.parentElement === document.body && el instanceof HTMLDialogElement && el.contains(document.activeElement)), null); await fields.getByRole('button', { name: 'New custom field', exact: true }).click(); await fields.getByLabel('Custom field label', { exact: true }).fill('Focus verification'); const select = fields.locator('#new-custom-field-type')
      await capture(page, select, `${label} native select`, 'focus')
      await page.screenshot({ path: join(out, `final-${label}-native-select-viewport.png`) })
      await capture(page, select, `${label} resting native select`, 'boundary')
      await overflow(page, `${label} Fields`); await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click(); await expect(fields).toHaveCount(0); check(`${label}: Fields focus return`, await trigger.evaluate(el => document.activeElement === el), null)
    } catch (error) { check(`${label}: execution`, false, { message: error.message }) }
    finally { await context.close() }
  }
  check('warm follow-up browser external requests', evidence.network.length === 0, evidence.network)
  check('no focused-check console/hydration warnings', evidence.console.length === 0, evidence.console); check('no focused-check page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
} finally { await browser.close(); await writeFile(join(out, 'final-focused-results.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify({ checks: evidence.checks.length, failed: evidence.checks.filter(c => !c.passed), minimum: Math.min(...evidence.samples.map(s => s.minimum)) }, null, 2)) }
if (evidence.checks.some(c => !c.passed)) process.exitCode = 1
