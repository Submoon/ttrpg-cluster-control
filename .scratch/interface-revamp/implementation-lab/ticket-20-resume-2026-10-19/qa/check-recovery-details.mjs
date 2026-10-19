import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actualJsonDownload, readWorkspaceRecords, withAbortedNextWorkspaceWrite } from './platform-hooks.mjs'
import { contrast, focusGeometry, settle } from './presentation.mjs'

const out = dirname(fileURLToPath(import.meta.url)), base = process.env.QA_BASE_URL || 'http://127.0.0.1:3180'
const evidence = { timestamp: new Date().toISOString(), identity: JSON.parse(await readFile(join(out, process.env.QA_DETAILS_IDENTITY || 'compiled-corrected-source-identity.json'), 'utf8')), runtime: 'corrected compiled product /', checks: [], contrast: [], fixtures: [], downloads: [], pageerrors: [], console: [], limitations: ['Two bounded light/dark recovery-detail cases, not a new full matrix.', 'Desktop keyboard and mobile viewport/touch emulation; no physical OS keyboard/safe-area/gesture proof.', 'Completion notification is held after a real write, not a pending browser transaction.'] }
const check = (name, passed, detail = null) => { evidence.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}: ${JSON.stringify(detail)}`) }
const active = page => page.locator('.workspace-feedback:not([inert]), .workspace-compact-recovery')
const save = page => active(page).locator('.save-feedback')
const modal = page => page.getByRole('dialog', { name: 'Edit chart names', exact: true })
const details = page => page.getByRole('group', { name: 'Workspace recovery details', exact: true })
const act = (locator, touch) => touch ? locator.tap() : locator.click()
async function focus(page, locator, label) {
  const row = await focusGeometry(page, locator)
  check(`${label}: complete unobscured keyboard focus`, row.focused && row.hit && row.ringFits && row.clippedBy.length === 0 && (row.outline !== row.before.outline || row.shadow !== row.before.shadow), row)
  const sample = await contrast(page, locator, 'focus', row); evidence.contrast.push({ label, ...sample }); check(`${label}: focus contrast`, Number.isFinite(sample.minimum) && sample.minimum >= 3, { minimum: sample.minimum })
}
async function holdCompletions(page) {
  await page.evaluate(() => {
    const original = IDBTransaction.prototype.addEventListener, state = { original, pending: [] }
    window.__qaDetailsCompletion = state
    IDBTransaction.prototype.addEventListener = function (type, listener, options) {
      if (type !== 'complete' || this.db.name !== 'ttrpg-cluster-control' || this.mode !== 'readwrite' || !this.objectStoreNames.contains('workspace')) return original.call(this, type, listener, options)
      return original.call(this, type, event => state.pending.push(() => typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event)), options)
    }
  })
}
async function releaseCompletions(page) {
  await page.evaluate(() => { const state = window.__qaDetailsCompletion; if (!state) return; IDBTransaction.prototype.addEventListener = state.original; delete window.__qaDetailsCompletion; for (const release of state.pending) release() })
}
const browser = await chromium.launch({ channel: 'chrome', headless: true }); evidence.browser = `Chrome ${browser.version()}`
try {
  for (const fixture of [{ width: 1440, height: 900, palette: 'dark', touch: false }, { width: 390, height: 844, palette: 'light', touch: true }]) {
    const { width, height, palette, touch } = fixture, label = `${width}x${height}-${palette}`
    console.log(`DETAILS ${label}`)
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: palette, hasTouch: touch, deviceScaleFactor: 1, serviceWorkers: 'block' }); context.setDefaultTimeout(8000)
    const page = await context.newPage(); page.on('pageerror', e => evidence.pageerrors.push({ label, message: e.message })); page.on('console', m => { if (['warning', 'error'].includes(m.type())) evidence.console.push({ label, type: m.type(), text: m.text() }) })
    try {
      await page.goto(base); await page.getByLabel('Jump Cluster', { exact: true }).fill(`Details ${label} Reach`); await page.getByLabel('First star system').fill(`Details ${label} Star`)
      await act(page.getByRole('button', { name: 'Create local workspace', exact: true }), touch); await expect(save(page)).toHaveText('Saved on this device')
      const inspector = page.locator('#workspace-inspector-panel')
      if (!await inspector.isVisible()) await act(page.getByRole('button', { name: 'Inspect', exact: true }), touch)
      const chart = inspector.getByRole('button', { name: 'Chart details', exact: true }); if (await chart.isVisible()) await act(chart, touch)
      await act(inspector.getByRole('button', { name: 'Edit chart names', exact: true }), touch)
      await modal(page).getByLabel('Jump Cluster', { exact: true }).fill(`Applied ${label} Reach`)
      const cameraBeforeFailure = await page.locator('.system-map-content').getAttribute('transform')
      await withAbortedNextWorkspaceWrite(page, async () => { await act(modal(page).getByRole('button', { name: 'Apply names', exact: true }), touch); await expect(modal(page)).toBeHidden(); await expect(save(page)).toContainText('Not saved.') })
      const record = await readWorkspaceRecords(page); evidence.fixtures.push({ label, record: record.current, context: touch ? 'exclusive compact Inspector' : 'desktop Inspector open' })
      const directRetryGlyph = active(page).getByRole('button', { name: 'Retry save', exact: true }).locator('svg, .iconify').first()
      await expect(directRetryGlyph).toBeVisible()
      const glyphSample = await contrast(page, directRetryGlyph, 'glyph'); evidence.contrast.push({ label: `${label} direct Retry glyph`, ...glyphSample }); check(`${label}: meaningful recovery glyph contrast`, glyphSample.minimum >= 3, { minimum: glyphSample.minimum })
      const trigger = active(page).getByRole('button', { name: 'Recovery details', exact: true })
      await focus(page, trigger, `${label} details trigger`); await act(trigger, touch); await expect(details(page)).toBeVisible(); await settle(page)
      await expect(details(page).getByRole('alert').filter({ hasText: 'Save failed:' })).toBeVisible()
      check(`${label}: full prior failure is in accessible scrollable details`, await details(page).evaluate(el => el.textContent.includes('transaction') && el.getBoundingClientRect().height <= innerHeight))
      const error = details(page).getByRole('alert').filter({ hasText: 'Save failed:' }), sample = await contrast(page, error); evidence.contrast.push({ label: `${label} full error`, ...sample }); check(`${label}: full error text contrast`, sample.minimum >= 4.5, { minimum: sample.minimum })
      const exporter = details(page).getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })
      await focus(page, exporter, `${label} portal JSON`)
      const download = await actualJsonDownload(page, () => act(exporter, touch)); evidence.downloads.push({ label, filename: download.filename, sha256: download.sha256 })
      check(`${label}: actual JSON works from portal inside panel state`, download.value.cluster.name === `Applied ${label} Reach`)
      await expect(save(page)).toContainText('Not saved.')
      await page.keyboard.press('Escape'); await expect(details(page)).toBeHidden(); await expect(trigger).toBeFocused()
      check(`${label}: dismissal retains failure and returns focus`, true)
      if (!touch) { await settle(page); await page.screenshot({ path: join(out, `${process.env.QA_DETAILS_SCREENSHOT_PREFIX || 'corrected-'}desktop-dark-recovery.png`) }) }
      await act(trigger, touch); await expect(details(page)).toBeVisible()
      const fallbackBefore = await save(page).evaluate(el => { const style = getComputedStyle(el); return { outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`, shadow: style.boxShadow } })
      await holdCompletions(page)
      try {
        const retry = details(page).getByRole('button', { name: 'Retry save', exact: true })
        await focus(page, retry, `${label} portal Retry`); await act(retry, touch)
        await expect.poll(() => page.evaluate(() => window.__qaDetailsCompletion.pending.length)).toBeGreaterThan(0)
        await expect(save(page)).toContainText('Saving')
        await expect(details(page).getByRole('alert').filter({ hasText: 'Save failed:' })).toBeVisible()
        check(`${label}: prior error remains accessible through held Retry acknowledgement`, true)
        await page.keyboard.press('Escape'); await expect(details(page)).toBeHidden(); await expect(trigger).toBeFocused()
        await trigger.press('Enter'); await expect(details(page).getByRole('alert').filter({ hasText: 'Save failed:' })).toBeVisible()
        if (touch) { await settle(page); await page.screenshot({ path: join(out, `${process.env.QA_DETAILS_SCREENSHOT_PREFIX || 'corrected-'}portrait-light-retry-details.png`) }) }
      } finally { await releaseCompletions(page) }
      await expect(save(page)).toHaveText('Saved on this device')
      await expect(details(page)).toBeHidden()
      await expect(active(page).getByRole('button', { name: 'Recovery details', exact: true })).toHaveCount(0)
      await expect(save(page)).toBeFocused()
      check(`${label}: newest successful Retry removes error-only trigger and focuses saved status`, true)
      const fallback = await save(page).evaluate((el, before) => { const style = getComputedStyle(el), bounds = el.getBoundingClientRect(), extent = style.outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)), hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); return { before, outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`, shadow: style.boxShadow, extent, bounds: bounds.toJSON(), focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'), hit: hit === el || el.contains(hit), ringFits: bounds.left >= extent && bounds.right <= innerWidth - extent && bounds.top >= extent && bounds.bottom <= innerHeight - extent } }, fallbackBefore)
      check(`${label}: Saved fallback has visible unobscured keyboard focus`, fallback.focused && fallback.focusVisible && fallback.hit && fallback.ringFits && (fallback.outline !== fallback.before.outline || fallback.shadow !== fallback.before.shadow), fallback)
      const fallbackSample = await contrast(page, save(page), 'focus', fallback); evidence.contrast.push({ label: `${label} Saved fallback focus`, ...fallbackSample }); check(`${label}: Saved fallback focus contrast`, Number.isFinite(fallbackSample.minimum) && fallbackSample.minimum >= 3, { minimum: fallbackSample.minimum, candidates: fallbackSample.candidates })
      check(`${label}: feedback and popover never auto-fit camera`, await page.locator('.system-map-content').getAttribute('transform') === cameraBeforeFailure, { cameraBeforeFailure, after: await page.locator('.system-map-content').getAttribute('transform') })
      if (touch) {
        const close = page.getByRole('button', { name: 'Close inspector panel', exact: true }); await act(close, touch)
        await expect(save(page)).toHaveText('Saved on this device')
        check(`${label}: closing panel restores one active feedback owner`, await save(page).count() === 1)
      }
      await page.reload(); await expect(save(page)).toHaveText('Saved on this device')
      check(`${label}: portal Retry persists current applied memory`, (await readWorkspaceRecords(page)).current.cluster.name === `Applied ${label} Reach`)
    } catch (error) { check(`${label}: execution`, false, { message: error.message, stack: error.stack }); await page.screenshot({ path: join(out, `${process.env.QA_DETAILS_SCREENSHOT_PREFIX || 'corrected-'}details-${label}-failure.png`) }).catch(() => {}) }
    finally { await releaseCompletions(page).catch(() => {}); await context.close() }
  }
  check('no application console warnings/errors', evidence.console.length === 0, evidence.console); check('no page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
} finally { await browser.close(); await writeFile(join(out, process.env.QA_DETAILS_RESULT || 'recovery-details-results.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify({ checks: evidence.checks.length, failures: evidence.checks.filter(x => !x.passed), samples: evidence.contrast.length }, null, 2)) }
if (evidence.checks.some(x => !x.passed)) process.exitCode = 1
