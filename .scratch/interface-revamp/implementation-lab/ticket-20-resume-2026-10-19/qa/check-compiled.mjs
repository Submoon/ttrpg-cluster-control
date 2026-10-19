import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkspaceRecords, withAbortedNextWorkspaceWrite, actualJsonDownload } from './platform-hooks.mjs'
import { contrast, focusGeometry, settle } from './presentation.mjs'

const out = dirname(fileURLToPath(import.meta.url)), base = process.env.QA_BASE_URL || 'http://127.0.0.1:3180'
const screenshot = name => join(out, `${process.env.QA_SCREENSHOT_PREFIX || ''}${name}`)
const evidence = { timestamp: new Date().toISOString(), baseline: '92c4bd85a2891bb1144c01e19d2b6088a93d5a7b', runtime: 'compiled product /', base, identity: JSON.parse(await readFile(join(out, process.env.QA_IDENTITY_FILE || 'compiled-source-identity.json'), 'utf8')), checks: [], contrast: [], fixtures: [], downloads: [], console: [], pageerrors: [], limitations: ['Touch/viewport emulation is not physical Android Chrome, OS keyboard, safe area or physical gesture proof.', 'Selected bounded presentation cases; canonical compiled tests own full target/revision race behavior.', 'No ticket 21 whole-composition acceptance or repeated ticket 19 offline/icon audit.'] }
const check = (name, passed, detail = null) => { evidence.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}: ${JSON.stringify(detail)}`) }
const modal = page => page.getByRole('dialog', { name: 'Edit chart names', exact: true })
const feedback = page => page.locator('.workspace-feedback:not([inert]), .workspace-compact-recovery')
const save = page => feedback(page).locator('.save-feedback')
const resume = page => feedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })
const act = (locator, touch) => touch ? locator.tap() : locator.click()

async function closeCompact(page, touch) {
  if (!touch) return
  for (const name of ['Close inspector panel', 'Close hierarchy panel']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.isVisible()) { await act(button, touch); await settle(page) }
  }
}
async function openChart(page, touch) {
  await closeCompact(page, touch)
  const panel = page.locator('#workspace-inspector-panel')
  if (!await panel.isVisible()) await act(page.getByRole('button', { name: 'Inspect', exact: true }), touch)
  await expect(panel).toBeVisible()
  const details = panel.getByRole('button', { name: 'Chart details', exact: true })
  if (await details.isVisible()) await act(details, touch)
  const opener = panel.getByRole('button', { name: /^(Edit chart names|Resume chart name draft)$/ })
  const openerHandle = await opener.elementHandle()
  await act(opener, touch)
  await expect(modal(page)).toBeVisible(); await settle(page)
  return openerHandle
}
async function cluster(page, touch) {
  await expect(modal(page)).toBeHidden(); await settle(page); await closeCompact(page, touch)
  await act(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }), touch)
}
async function sample(page, locator, label, kind = 'text', focused) {
  const row = await contrast(page, locator, kind, focused)
  evidence.contrast.push({ label, ...row })
  check(`${label}: contrast`, Number.isFinite(row.minimum) && row.minimum >= row.threshold, { minimum: row.minimum, threshold: row.threshold })
}
async function focus(page, locator, label) {
  const row = await focusGeometry(page, locator)
  check(`${label}: unobscured full keyboard focus`, row.focused && row.hit && row.ringFits && row.clippedBy.length === 0 && (row.outline !== row.before.outline || row.shadow !== row.before.shadow), row)
  await sample(page, locator, label, 'focus', row)
}
async function geometry(page, locator, label) {
  await locator.scrollIntoViewIfNeeded(); await settle(page)
  const row = await locator.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: r.toJSON(), viewport: { width: innerWidth, height: innerHeight }, hit: hit === el || el.contains(hit) } })
  check(`${label}: visible ordinary hit target`, row.hit && row.rect.top >= 0 && row.rect.bottom <= row.viewport.height && row.rect.left >= 0 && row.rect.right <= row.viewport.width, row)
  return row
}
async function recovery(page, touch, label) {
  await openChart(page, touch)
  await modal(page).getByLabel('Jump Cluster', { exact: true }).fill('QA Applied Recovery Reach')
  await modal(page).getByLabel('Star system', { exact: true }).fill('QA Applied Recovery Star')
  const before = await readWorkspaceRecords(page)
  await withAbortedNextWorkspaceWrite(page, async () => {
    await act(modal(page).getByRole('button', { name: 'Apply names', exact: true }), touch)
    await expect(modal(page)).toBeHidden(); await expect(save(page)).toContainText('Not saved.')
  })
  const after = await readWorkspaceRecords(page)
  check(`${label}: real aborted transaction retains durable records and ends form`, JSON.stringify(before) === JSON.stringify(after))
  await openChart(page, touch); await modal(page).getByLabel('Jump Cluster', { exact: true }).fill('QA Draft Excluded From Recovery'); await page.keyboard.press('Escape'); await settle(page)
  await expect(save(page)).toContainText('Not saved.')
  const retry = feedback(page).getByRole('button', { name: 'Retry save', exact: true }), exporter = feedback(page).getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })
  await geometry(page, retry, `${label} Retry`); await geometry(page, exporter, `${label} current JSON`)
  await sample(page, save(page), `${label} Not saved text`)
  await focus(page, retry, `${label} Retry focus`)
  const download = await actualJsonDownload(page, () => act(exporter, touch)); evidence.downloads.push({ label, filename: download.filename, sha256: download.sha256 })
  check(`${label}: actual recovery JSON contains applied names and excludes draft`, download.value.cluster.name === 'QA Applied Recovery Reach' && download.value.cluster.systems[0].name === 'QA Applied Recovery Star' && !JSON.stringify(download.value).includes('QA Draft Excluded From Recovery'))
  await expect(save(page)).toContainText('Not saved.'); await expect(resume(page)).toBeVisible()
  if (!touch) {
    await act(resume(page), touch); await modal(page).getByRole('button', { name: 'Discard draft', exact: true }).click(); await expect(modal(page)).toBeHidden(); await settle(page)
    const hierarchy = page.locator('#workspace-hierarchy-panel')
    if (!await hierarchy.isVisible()) await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
    await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
    const inspector = page.locator('#workspace-inspector-panel')
    if (!await inspector.isVisible()) await page.getByRole('button', { name: 'Inspect', exact: true }).click()
    await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
    await geometry(page, inspector.getByRole('button', { name: 'Save map object', exact: true }), `${label} Inspector bottom Save under error`)
    const cancel = inspector.getByRole('button', { name: 'Cancel map object edits', exact: true })
    await geometry(page, cancel, `${label} Inspector bottom Cancel under error`); await cancel.click()
    await expect(save(page)).toContainText('Not saved.')
    check(`${label}: actual Inspector Cancel remains usable under persistent error`, true)
    for (const name of ['Back to Jump Cluster', 'Add to map', 'Fit map', 'Zoom in']) await geometry(page, page.getByRole('button', { name, exact: true }), `${label} ${name} under error`)
  } else {
    await closeCompact(page, touch)
    await act(page.getByRole('button', { name: 'Select', exact: true }), touch)
    await act(page.getByRole('button', { name: 'Fit map', exact: true }), touch); await settle(page)
    const planet = page.getByRole('button', { name: /^Select PL-01, New planet 1 \(/ })
    const fitted = await geometry(page, planet, `${label} fitted lower-right planet under error and draft`)
    evidence.fittedRecovery = { target: await planet.getAttribute('aria-label'), targetGeometry: fitted, feedback: await feedback(page).boundingBox(), transform: await page.locator('.system-map-content').getAttribute('transform') }
    if (fitted.hit) {
      await act(planet, touch); await expect(modal(page).getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
      await act(modal(page).getByRole('button', { name: 'Stay here', exact: true }), touch); await page.keyboard.press('Escape'); await settle(page)
      check(`${label}: fitted map target accepts ordinary touch under recovery`, true)
    }
    await page.screenshot({ path: screenshot('compact-dark-recovery.png') })
  }
  await act(retry, touch); await expect(save(page)).toHaveText('Saved on this device')
  const durable = await readWorkspaceRecords(page)
  check(`${label}: latest Retry saves applied memory without replay`, durable.current.cluster.name === 'QA Applied Recovery Reach' && durable.current.cluster.systems[0].name === 'QA Applied Recovery Star' && durable.current.cluster.systems.length === before.current.cluster.systems.length && durable.current.cluster.systems[0].objects.length === before.current.cluster.systems[0].objects.length)
  if (await resume(page).isVisible()) { await act(resume(page), touch); await act(modal(page).getByRole('button', { name: 'Discard draft', exact: true }), touch) }
  await page.reload(); await expect(save(page)).toHaveText('Saved on this device')
  check(`${label}: durable reload retains applied names`, (await readWorkspaceRecords(page)).current.cluster.name === 'QA Applied Recovery Reach')
}

const cases = [
  { width: 1440, height: 900, palette: 'light' }, { width: 1440, height: 900, palette: 'dark' },
  { width: 390, height: 844, palette: 'dark' }, { width: 844, height: 390, palette: 'light' },
  { width: 390, height: 500, palette: 'light' }, { width: 390, height: 500, palette: 'dark' },
]
const browser = await chromium.launch({ headless: true, channel: 'chrome' }); evidence.browser = `Chrome ${browser.version()}, headless, deviceScaleFactor 1`
try {
  for (const { width, height, palette } of cases) {
    const label = `${width}x${height}-${palette}`, touch = width !== 1440
    if (process.env.QA_CASES && !process.env.QA_CASES.split(',').includes(label)) continue
    console.log(`CASE ${label}`)
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: palette, hasTouch: touch, deviceScaleFactor: 1, serviceWorkers: 'block' })
    context.setDefaultTimeout(8000)
    const page = await context.newPage(); page.on('pageerror', e => evidence.pageerrors.push({ label, message: e.message })); page.on('console', m => { if (['warning', 'error'].includes(m.type())) evidence.console.push({ label, type: m.type(), text: m.text() }) })
    try {
      await page.goto(base); await page.getByRole('heading', { name: 'Give the unknown a name.' }).waitFor()
      await page.getByLabel('Jump Cluster', { exact: true }).fill(`QA ${label} Reach`); await page.getByLabel('First star system').fill(`QA ${label} Star`)
      await act(page.getByRole('button', { name: 'Create local workspace', exact: true }), touch); await expect(save(page)).toHaveText('Saved on this device')
      if (label === '390x500-dark') {
        await act(page.getByRole('button', { name: 'Add to map', exact: true }), touch)
        const palette = page.getByRole('region', { name: 'Object palette' })
        await act(palette.getByRole('group', { name: 'Object categories' }).getByRole('button', { name: 'Celestial bodies', exact: true }), touch)
        await act(palette.getByRole('button', { name: 'Add Planet', exact: true }), touch)
        await expect(save(page)).toHaveText('Saved on this device'); await page.keyboard.press('Escape'); await settle(page)
        await closeCompact(page, touch)
        await act(page.getByRole('button', { name: 'Hierarchy', exact: true }), touch)
        await act(page.locator('#workspace-hierarchy-panel').getByRole('button', { name: /^Select PL-01, New planet 1/ }), touch)
        await closeCompact(page, touch)
        await act(page.getByRole('button', { name: 'Inspect', exact: true }), touch)
        const inspector = page.locator('#workspace-inspector-panel')
        await act(inspector.getByRole('button', { name: 'Edit map object', exact: true }), touch)
        await inspector.getByLabel('Schematic X', { exact: true }).fill('0.9'); await inspector.getByLabel('Schematic Y', { exact: true }).fill('0.9')
        await act(inspector.getByRole('button', { name: 'Save map object', exact: true }), touch); await expect(save(page)).toHaveText('Saved on this device'); await closeCompact(page, touch)
      }
      const records = await readWorkspaceRecords(page); evidence.fixtures.push({ label, hash: createHash('sha256').update(JSON.stringify(records)).digest('hex'), record: records.current })
      const opener = await openChart(page, touch)
      const field = palette === 'dark' && !touch ? 'Star system' : 'Jump Cluster', input = modal(page).getByLabel(field, { exact: true })
      check(`${label}: actual modal entry focus`, await modal(page).evaluate(el => el.contains(document.activeElement)))
      await sample(page, input, `${label} input boundary`, 'control')
      await focus(page, modal(page).getByRole('button', { name: 'Apply names', exact: true }), `${label} Apply focus`)
      await input.fill(''); await act(modal(page).getByRole('button', { name: 'Apply names', exact: true }), touch)
      await expect(input).toBeFocused(); await expect(modal(page).getByRole('alert')).toContainText(`${field} name is required.`)
      const association = await input.evaluate(el => ({ invalid: el.getAttribute('aria-invalid'), description: (el.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') }))
      check(`${label}: validation identifies affected field`, association.invalid === 'true' && association.description.includes(`${field} name is required.`), association)
      await sample(page, modal(page).getByRole('alert'), `${label} error text`)
      if (label === '844x390-light') { await settle(page); await page.screenshot({ path: screenshot('landscape-light-invalid-modal.png') }) }
      await page.keyboard.press('Escape'); await expect(modal(page)).toBeHidden(); await settle(page)
      check(`${label}: hide returns focus to real opener`, await opener.evaluate(el => document.activeElement === el))
      await closeCompact(page, touch)
      const theme = page.getByRole('button', { name: /Switch to (light|dark)/ })
      await act(theme, touch); await act(theme, touch)
      await page.setViewportSize({ width: 390, height: 500 }); await page.setViewportSize({ width, height }); await settle(page)
      await geometry(page, resume(page), `${label} named Resume`); await act(resume(page), touch)
      await expect(input).toHaveValue(''); await expect(input).toBeFocused(); await expect(modal(page).getByRole('alert')).toContainText(`${field} name is required.`)
      check(`${label}: exact invalid draft/error survives hide/theme/reflow`, true)
      const transform = await page.locator('.system-map-content').getAttribute('transform')
      await page.keyboard.press('Escape'); await cluster(page, touch)
      await act(modal(page).getByRole('button', { name: 'Stay here', exact: true }), touch); await expect(input).toHaveValue('')
      check(`${label}: Stay retains context and camera`, await page.locator('.system-map-content').getAttribute('transform') === transform)
      await page.keyboard.press('Escape'); await cluster(page, touch); await act(modal(page).getByRole('button', { name: 'Apply and continue', exact: true }), touch)
      await expect(input).toBeFocused(); await expect(input).toHaveValue('')
      check(`${label}: invalid guard Apply refuses context change`, await page.locator('.system-map-content').getAttribute('transform') === transform)
      await page.keyboard.press('Escape'); await cluster(page, touch)
      await act(modal(page).getByRole('button', { name: 'Discard and continue', exact: true }), touch); await expect(modal(page)).toBeHidden(); await expect(page.getByRole('group', { name: `QA ${label} Reach Jump Cluster map`, exact: true })).toBeVisible()
      check(`${label}: scoped Discard continues without renaming`, (await readWorkspaceRecords(page)).current.cluster.name === `QA ${label} Reach`)
      await closeCompact(page, touch)
      const root = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
      check(`${label}: no horizontal overflow`, root.scroll <= root.width + 1, root)
      check(`${label}: decorative copy absent`, await page.getByText("WARDEN'S FIELD DESK", { exact: true }).count() === 0 && await page.getByText('LOCAL STORAGE / NO ACCOUNT', { exact: true }).count() === 0)
      if (label === '1440x900-light') {
        await settle(page); await page.screenshot({ path: screenshot('desktop-light-feedback.png') })
        evidence.productGeometry = await page.locator('.app-shell, .workspace-canvas, .workspace-feedback:not([inert]), .workspace-map-column, .workspace-dock, #workspace-inspector-panel').evaluateAll(elements => elements.map(el => ({ surface: el.id || el.className, bounds: el.getBoundingClientRect().toJSON(), position: getComputedStyle(el).position })))
      }
      if (label === '1440x900-light' || label === '390x500-dark') {
        // Public navigation back to the original system supplies a real chart target.
        const hierarchy = page.locator('#workspace-hierarchy-panel')
        if (!await hierarchy.isVisible()) await act(page.getByRole('button', { name: 'Hierarchy', exact: true }), touch)
        await act(hierarchy.getByRole('button', { name: `Open QA ${label} Star system map`, exact: true }), touch)
        await recovery(page, touch, label)
      }
    } catch (error) { check(`${label}: execution`, false, { message: error.message, stack: error.stack }); await page.screenshot({ path: screenshot(`${label}-failure.png`) }).catch(() => {}) }
    finally { await context.close() }
  }
  // Actual accepted route, same compiled runtime and desktop palette/map scope.
  // Its seeded systems/route selection differ from the isolated product fixture.
  if (process.env.QA_SKIP_REFERENCE !== '1') {
   const referenceContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
   try {
    const reference = await referenceContext.newPage()
    await reference.goto(`${base}/?variant=B&controls=dock`)
    await expect(reference.locator('.proto-b')).toBeVisible()
    await reference.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
    await reference.getByRole('button', { name: 'Show map hierarchy', exact: true }).click()
    await settle(reference)
    await reference.screenshot({ path: screenshot('reference-B-desktop-light.png') })
    evidence.reference = { route: '/?variant=B&controls=dock', viewport: { width: 1440, height: 900 }, palette: 'light', mapScope: 'cluster', panels: 'Hierarchy and Inspect open', fixtureDifference: 'Prototype uses its seeded three-system/route selection; product uses one UI-created system and chart consultation. No pixel-identity claim.', geometry: await reference.locator('.b-map-board, .b-map-frame, .b-control-dock, .b-map-footer, .b-inspector-float').evaluateAll(elements => elements.map(el => ({ surface: el.className, bounds: el.getBoundingClientRect().toJSON(), position: getComputedStyle(el).position }))) }
   } catch (error) { check('accepted prototype reference capture', false, { message: error.message }) }
   finally { await referenceContext.close() }
  }
  check('no browser application warnings/errors', evidence.console.length === 0, evidence.console)
  check('no page errors', evidence.pageerrors.length === 0, evidence.pageerrors)
} finally {
  await browser.close(); await writeFile(join(out, process.env.QA_RESULT_FILE || 'presentation-results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ checks: evidence.checks.length, failed: evidence.checks.filter(x => !x.passed), contrastSamples: evidence.contrast.length }, null, 2))
}
if (evidence.checks.some(x => !x.passed)) process.exitCode = 1
