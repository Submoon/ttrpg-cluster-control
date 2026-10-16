import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkspaceRecords, withAbortedNextWorkspaceWrite, withDownloadClickFailure, actualJsonDownload } from './platform-hooks.mjs'
import { focusGeometry, contrast, settle } from './presentation.mjs'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../../..'), base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3120'
const selectedCases = process.env.QA_CASES?.split(',').filter(Boolean), resultFile = process.env.QA_RESULT_FILE ?? 'final-results.json'
const sha = value => createHash('sha256').update(value).digest('hex')
const evidence = { timestamp: new Date().toISOString(), baseline: 'e014a549e405bb283acb4368d45bdf484ca68d0a', candidate: 'b9d51ba27510427e31da780e1777a642a4499b28', runtime: 'compiled .output/server/index.mjs; actual product root; no prototype or app test API', base, route: '/', identity: {}, checks: [], contrast: [], fixtures: [], downloads: [], console: [], pageerrors: [], externalRequests: [], limitations: ['Physical Android Chrome, real OS keyboard, safe areas and physical gestures unavailable.', 'Canonical revision races, full conflict matrix and native departure-warning lifecycle belong to implementation tests; not repeated here.', 'Eight representative viewport/theme cases plus one desktop recovery supplement; no repeated cold icon inventory.'] }
// Source may receive an explicitly authorized source-only repair while this
// compiled build is under observation. Identify the compiled candidate with
// its pre-repair snapshot, never with whatever source exists at a later read.
const frozenSource = JSON.parse(await readFile(join(out, process.env.QA_SOURCE_IDENTITY ?? 'final-source-identity.json'), 'utf8'))
evidence.candidate = frozenSource.candidate; evidence.identity = frozenSource.identity
for (const file of ['.output/nitro.json', '.output/server/index.mjs']) evidence.identity[file] = sha(await readFile(join(root, file)))
const check = (name, passed, detail) => { evidence.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}: ${JSON.stringify(detail)}`) }
const browser = await chromium.launch({ headless: true }); evidence.browser = `Playwright Chromium ${browser.version()}, headless, scale 1`
const modal = page => page.getByRole('dialog', { name: 'Edit chart names', exact: true })
const errorMessage = field => `${field === 'Star system' ? 'Star system' : 'Jump Cluster'} name is required.`
const validation = (page, field = 'Jump Cluster') => modal(page).getByRole('alert').filter({ hasText: errorMessage(field) })
const feedback = page => page.locator('.workspace-feedback')
const save = page => feedback(page).locator(':scope > .save-feedback')
const resume = page => feedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })
const theme = page => page.getByRole('button', { name: /Switch to (light|dark)/ })
const activate = async (locator, touch) => touch ? locator.tap() : locator.click()
async function measured(page, locator, label, kind = 'text', focused) { const row = await contrast(page, locator, kind, focused); evidence.contrast.push({ label, ...row }); check(`${label}: contrast`, Number.isFinite(row.minimum) && row.minimum >= row.threshold, { minimum: row.minimum, threshold: row.threshold, candidates: row.candidates }) }
async function focus(page, locator, label) { const row = await focusGeometry(page, locator); check(`${label}: full focused cue visible`, row.focused && row.hit && row.ringFits && !row.clippedBy.length && (row.outline !== row.before.outline || row.shadow !== row.before.shadow), row); await measured(page, locator, label, 'focus', row); if (await locator.evaluate(el => !!el.textContent?.trim())) await measured(page, locator, `${label} text`); else { const glyph = locator.locator('svg, .iconify').first(); if (await glyph.count()) await measured(page, glyph, `${label} meaningful glyph`, 'glyph') }; await settle(page) }
async function overflow(page, label) { const row = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth })); check(`${label}: no horizontal overflow`, row.width <= row.viewport + 1, row) }
async function validationAssociation(page, label, field = 'Jump Cluster') {
  const dialog = modal(page), affected = dialog.getByLabel(field, { exact: true }), other = dialog.getByLabel(field === 'Star system' ? 'Jump Cluster' : 'Star system', { exact: true })
  const row = await affected.evaluate(el => ({ invalid: el.getAttribute('aria-invalid'), describedBy: el.getAttribute('aria-describedby'), focused: document.activeElement === el, description: (el.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() || '').join(' ') }))
  const sibling = await other.evaluate(el => ({ invalid: el.getAttribute('aria-invalid'), describedBy: el.getAttribute('aria-describedby'), description: (el.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() || '').join(' ') }))
  check(`${label}: error identifies and focuses only affected input`, row.invalid === 'true' && row.focused && row.description.includes(errorMessage(field)) && sibling.invalid !== 'true' && !sibling.description.includes(errorMessage(field)), { field, ...row, sibling })
}
async function openChart(page, touch) {
  await settle(page)
  const panel = page.locator('#workspace-inspector-panel')
  const show = page.getByRole('button', { name: 'Show inspector panel', exact: true })
  if (await show.isVisible()) await activate(show, touch)
  else if (!await panel.isVisible()) { await expect(show).toBeVisible(); await activate(show, touch) }
  await settle(page); await expect(panel).toBeVisible()
  const details = page.getByRole('button', { name: 'Chart details', exact: true }); if (await details.isVisible() && await details.getAttribute('aria-pressed') !== 'true') await activate(details, touch)
  const opener = panel.getByRole('button', { name: 'Edit chart names', exact: true }); const handle = await opener.elementHandle(); await activate(opener, touch); await modal(page).waitFor(); await settle(page); return handle
}
async function requestCluster(page, touch) {
  // Dialog leave transitions temporarily make otherwise open panels inert.
  // Wait for the real modal to close before deciding a panel needs opening.
  await expect(modal(page)).toBeHidden(); await settle(page)
  const control = page.getByRole('button', { name: 'Cluster map', exact: true })
  if (!await control.isVisible()) { const show = page.getByRole('button', { name: 'Show hierarchy panel', exact: true }); await expect(show).toBeVisible(); await activate(show, touch); await settle(page) }
  await activate(control, touch)
}
async function recovery(page) {
  const label = 'desktop-light recovery', appliedCluster = 'QA Applied Recovery Reach', appliedStar = 'QA Applied Recovery Star'
  await page.reload(); await expect(save(page)).toHaveText('Saved on this device'); const before = await readWorkspaceRecords(page)
  await openChart(page, false); await modal(page).getByLabel('Jump Cluster', { exact: true }).fill(appliedCluster); await modal(page).getByLabel('Star system', { exact: true }).fill(appliedStar); await page.keyboard.press('Escape')
  await withAbortedNextWorkspaceWrite(page, async () => {
    await requestCluster(page, false); await modal(page).getByRole('button', { name: 'Apply and continue', exact: true }).click(); await expect(modal(page)).toBeHidden(); await expect(page.getByRole('group', { name: `${appliedCluster} Jump Cluster map`, exact: true })).toBeVisible(); await expect(save(page)).toContainText('Not saved.')
  })
  check(`${label}: ended chart form and requested transition survive real write abort`, true, { appliedCluster, appliedStar })
  const failedRecords = await readWorkspaceRecords(page); check(`${label}: failed transaction preserves both stored records`, JSON.stringify(before) === JSON.stringify(failedRecords), { beforeHash: sha(JSON.stringify(before)), afterHash: sha(JSON.stringify(failedRecords)) })
  // Open a second draft through the real current chart summary, then hide it.
  const hierarchy = page.locator('#workspace-hierarchy-panel'); if (!await hierarchy.isVisible()) await page.getByRole('button', { name: 'Show hierarchy panel', exact: true }).click(); await hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }).click(); await modal(page).getByLabel('Jump Cluster', { exact: true }).fill('QA Draft Must Not Export'); await page.keyboard.press('Escape')
  const exportCurrent = feedback(page).getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })
  await withDownloadClickFailure(page, async () => { await exportCurrent.click(); await expect(feedback(page).getByRole('alert').filter({ hasText: 'Export failed:' })).toBeVisible(); await expect(save(page)).toContainText('Not saved.') })
  const exported = await actualJsonDownload(page, () => exportCurrent.click()); evidence.downloads.push({ label, filename: exported.filename, sha256: exported.sha256, format: exported.value.format, version: exported.value.version, type: exported.value.type })
  check(`${label}: actual recovery JSON includes applied data and excludes draft`, exported.value.type === 'cluster' && exported.value.cluster.name === appliedCluster && exported.value.cluster.systems[0].name === appliedStar && !JSON.stringify(exported.value).includes('QA Draft Must Not Export'), null)
  await expect(save(page)).toContainText('Not saved.'); await expect(feedback(page).getByText('Unapplied chart-name changes', { exact: true })).toBeVisible(); await expect(feedback(page).getByRole('alert').filter({ hasText: 'Export failed:' })).toHaveCount(0)
  await measured(page, save(page), `${label} persistent save error`); await focus(page, feedback(page).getByRole('button', { name: 'Retry save', exact: true }), `${label} Retry`); await focus(page, exportCurrent, `${label} current JSON`)
  await page.screenshot({ path: join(out, 'desktop-light-recovery-viewport.png') })
  await feedback(page).getByRole('button', { name: 'Retry save', exact: true }).click(); await expect(save(page)).toHaveText('Saved on this device'); await expect(resume(page)).toBeVisible(); const retried = await readWorkspaceRecords(page)
  check(`${label}: Retry saves current applied names without duplicate commands`, retried.current.cluster.name === appliedCluster && retried.current.cluster.systems[0].name === appliedStar && retried.current.cluster.systems.length === before.current.cluster.systems.length && retried.current.cluster.systems[0].objects.length === before.current.cluster.systems[0].objects.length, { recordHash: sha(JSON.stringify(retried)) })
  await resume(page).click(); await modal(page).getByRole('button', { name: 'Discard draft', exact: true }).click(); await page.reload(); await expect(page.getByRole('heading', { name: appliedStar, level: 1, exact: true })).toBeVisible(); check(`${label}: durable reload retains applied chart`, true, null)
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 500 }]) for (const palette of ['light', 'dark']) {
    const label = `${viewport.width}x${viewport.height}-${palette}`, touch = viewport.width !== 1440, cluster = `QA ${label} Reach`, star = `QA ${label} Star`
    if (selectedCases && !selectedCases.includes(label)) continue
    const invalidField = viewport.width === 1440 && palette === 'dark' ? 'Star system' : 'Jump Cluster', draftCluster = invalidField === 'Jump Cluster' ? '' : `Unapplied ${cluster}`, draftStar = invalidField === 'Star system' ? '' : `Unapplied ${star}`
    console.log(`SCENARIO ${label}`)
    const context = await browser.newContext({ viewport, colorScheme: palette, hasTouch: touch, deviceScaleFactor: 1, serviceWorkers: 'block' }); context.setDefaultTimeout(10000)
    await context.route('**/*', route => { if (['127.0.0.1', 'localhost', '[::1]'].includes(new URL(route.request().url()).hostname)) return route.continue(); evidence.externalRequests.push(route.request().url()); return route.abort('blockedbyclient') })
    const page = await context.newPage(); page.on('pageerror', error => evidence.pageerrors.push({ label, message: error.message })); page.on('console', message => { if (['warning', 'error'].includes(message.type())) evidence.console.push({ label, type: message.type(), text: message.text() }) })
    try {
      await page.goto(base); await page.getByRole('heading', { name: 'Give the unknown a name.' }).waitFor(); await page.getByLabel('Jump Cluster', { exact: true }).fill(cluster); await page.getByLabel('First star system').fill(star); await activate(page.getByRole('button', { name: 'Create local workspace', exact: true }), touch); await expect(save(page)).toHaveText('Saved on this device')
      const records = await readWorkspaceRecords(page); evidence.fixtures.push({ label, hash: sha(JSON.stringify(records)), cluster: records.current.cluster.name, systemId: records.current.cluster.systems[0].id, star: records.current.cluster.systems[0].name })
      const opener = await openChart(page, touch), dialog = modal(page)
      check(`${label}: actual portaled modal and entry focus`, await dialog.evaluate(el => document.body.contains(el) && !el.closest('.app-shell') && el.contains(document.activeElement)), null)
      await measured(page, dialog.getByRole('heading', { name: 'Edit chart names', exact: true }), `${label} modal heading`); await measured(page, dialog.getByLabel('Jump Cluster', { exact: true }), `${label} resting cluster input`, 'control'); await measured(page, dialog.getByLabel('Star system', { exact: true }), `${label} resting system input`, 'control')
      await focus(page, dialog.getByRole('button', { name: 'Apply names', exact: true }), `${label} Apply names`); await focus(page, dialog.getByRole('button', { name: 'Discard draft', exact: true }), `${label} Discard draft`); await focus(page, dialog.getByRole('button', { name: 'Close', exact: true }), `${label} Close`)
      await dialog.getByLabel('Jump Cluster', { exact: true }).fill(draftCluster); await dialog.getByLabel('Star system', { exact: true }).fill(draftStar); await activate(dialog.getByRole('button', { name: 'Apply names', exact: true }), touch); await expect(validation(page, invalidField)).toHaveText(errorMessage(invalidField)); await expect(dialog.getByLabel(invalidField, { exact: true })).toBeFocused(); await validationAssociation(page, `${label} initial validation`, invalidField)
      await measured(page, validation(page, invalidField), `${label} chart validation`)
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); check(`${label}: hide returns to actual opener`, await opener.evaluate(el => document.activeElement === el), null)
      await activate(theme(page), touch); await activate(theme(page), touch); const alternative = viewport.width === 390 ? { width: 844, height: 390 } : { width: 390, height: 500 }; await page.setViewportSize(alternative); await page.setViewportSize(viewport); await expect(save(page)).toHaveText('Saved on this device'); await expect(feedback(page).getByText('Unapplied chart-name changes', { exact: true })).toBeVisible()
      await focus(page, resume(page), `${label} named resume`); await measured(page, save(page), `${label} distinct durable status`); await activate(resume(page), touch); await expect(dialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue(draftCluster); await expect(dialog.getByLabel('Star system', { exact: true })).toHaveValue(draftStar); await expect(validation(page, invalidField)).toHaveText(errorMessage(invalidField)); await expect(dialog.getByLabel(invalidField, { exact: true })).toBeFocused(); await validationAssociation(page, `${label} resumed validation`, invalidField); check(`${label}: exact invalid draft/error survives hide theme reflow`, true, { invalidField })
      await overflow(page, `${label} modal`)
      if (label === '390x500-dark') {
        await settle(page)
        const presentation = await dialog.evaluate(el => { let opacity = 1; for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity); return { opacity, backgroundColor: getComputedStyle(el).backgroundColor, finiteAnimations: document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity && a.playState === 'running').length } })
        check(`${label}: curated invalid modal settled and opaque`, presentation.opacity === 1 && presentation.finiteAnimations === 0, presentation)
        await page.screenshot({ path: join(out, '390x500-dark-invalid-modal-viewport.png') })
      }
      if (viewport.width === 390 && viewport.height === 844) {
        await activate(dialog.getByRole('button', { name: 'Discard draft', exact: true }), touch); await expect(dialog).toBeHidden(); await expect(resume(page)).toHaveCount(0)
      } else {
        if (viewport.height === 500) { await dialog.getByLabel('Jump Cluster', { exact: true }).fill(`Applied ${cluster}`); await dialog.getByLabel('Star system', { exact: true }).fill(`Applied ${star}`) }
        await page.keyboard.press('Escape'); const systemMapBefore = await page.locator('.system-map-content').getAttribute('transform'); await requestCluster(page, touch); await dialog.getByRole('button', { name: 'Stay here', exact: true }).waitFor(); await focus(page, dialog.getByRole('button', { name: 'Stay here', exact: true }), `${label} guard Stay`); await focus(page, dialog.getByRole('button', { name: 'Apply and continue', exact: true }), `${label} guard Apply`); await focus(page, dialog.getByRole('button', { name: 'Discard and continue', exact: true }), `${label} guard Discard`)
        if (label === '844x390-light') await page.screenshot({ path: join(out, '844x390-light-guard-viewport.png') })
        if (viewport.height === 390) { await activate(dialog.getByRole('button', { name: 'Stay here', exact: true }), touch); await expect(dialog.getByLabel(invalidField, { exact: true })).toHaveValue(''); await expect(dialog.getByLabel(invalidField, { exact: true })).toBeFocused(); await validationAssociation(page, `${label} guard Stay correction`, invalidField); check(`${label}: Stay retains actual camera/context`, await page.locator('.system-map-content').getAttribute('transform') === systemMapBefore, { transform: systemMapBefore }); await page.keyboard.press('Escape'); await requestCluster(page, touch) }
        await activate(dialog.getByRole('button', { name: 'Apply and continue', exact: true }), touch)
        if (viewport.height === 500) { await expect(dialog).toBeHidden(); await expect(page.getByRole('group', { name: `Applied ${cluster} Jump Cluster map`, exact: true })).toBeVisible(); check(`${label}: accepted Apply continues real context`, true, null) }
        else { await expect(validation(page, invalidField)).toHaveText(errorMessage(invalidField)); await expect(dialog.getByLabel(invalidField, { exact: true })).toBeFocused(); await validationAssociation(page, `${label} invalid guard Apply correction`, invalidField); await measured(page, validation(page, invalidField), `${label} retained guard validation`); check(`${label}: invalid Apply refuses transition and preserves camera`, await page.locator('.system-map-content').getAttribute('transform') === systemMapBefore, null); await activate(dialog.getByRole('button', { name: 'Discard draft', exact: true }), touch) }
      }
      await overflow(page, `${label} feedback`)
      check(`${label}: decorative footer copy removed`, await page.getByText("WARDEN'S FIELD DESK", { exact: true }).count() === 0 && await page.getByText('LOCAL STORAGE / NO ACCOUNT', { exact: true }).count() === 0, null)
      if (label === '390x844-dark') await page.screenshot({ path: join(out, '390x844-dark-feedback-viewport.png') })
      if (label === '1440x900-light') await recovery(page)
    } catch (error) { check(`${label}: execution`, false, { message: error.message, stack: error.stack }); await page.screenshot({ path: join(out, `${label}-failure.png`) }).catch(() => {}) }
    finally { await context.close() }
  }
  check('no product console/hydration warnings', evidence.console.length === 0, evidence.console); check('no page errors', evidence.pageerrors.length === 0, evidence.pageerrors); check('no unexpected browser external requests', evidence.externalRequests.length === 0, evidence.externalRequests)
} finally { await browser.close(); evidence.selectedCases = selectedCases ?? 'all eight cases'; await writeFile(join(out, resultFile), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify({ checks: evidence.checks.length, failures: evidence.checks.filter(c => !c.passed), samples: evidence.contrast.length }, null, 2)) }
if (evidence.checks.some(c => !c.passed)) process.exitCode = 1
