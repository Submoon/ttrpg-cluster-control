// Three bounded root/B pairs. Never run before the coordinator's compiled release.
import { chromium, expect } from '@playwright/test'
import { createJiti } from 'jiti'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleContrast } from '../../ticket-21-resume-2026-10-19/qa/contrast.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const out = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!out?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-') || out.includes('/../')) throw new Error('Fresh literal ticket23 host output required')
if (process.env.QA_RUNTIME_RELEASE !== 'compiled' || !process.env.QA_CANDIDATE || !process.env.QA_SOURCE_IDENTITY) throw new Error('Explicit compiled candidate/identity release required')
const identity = JSON.parse(await readFile(process.env.QA_SOURCE_IDENTITY, 'utf8'))
if (identity.candidate !== process.env.QA_CANDIDATE || !identity.files?.length) throw new Error('Candidate identity mismatch')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
async function hashes() { return Promise.all(identity.files.map(async file => ({ path: file.path, expected: file.sha256, actual: sha(await readFile(resolve(repo, file.path))) }))) }
if ((await hashes()).some(file => file.expected.toLowerCase() !== file.actual)) throw new Error('Released source mismatch')
await mkdir(out, { recursive: true })
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3180'
const fixturePath = 'tests/fixtures/workspace-system-creation-geometry.json'
const fixtureBytes = await readFile(join(repo, fixturePath)), fixture = JSON.parse(fixtureBytes)
const domain = await createJiti(import.meta.url, { fsCache: false, moduleCache: false }).import(join(repo, 'domain/workspace.ts'))
const prepared = domain.prepareJsonImport(domain.createLocalWorkspace('Validation', 'Validation star'), fixture)
if (!domain.restoreLocalWorkspace(prepared.workspace)) throw new Error('Authoritative fixture validation failed')
const cases = [
  { id: 'chooser-desktop-light', width: 1440, height: 900, theme: 'light' },
  { id: 'ambiguity-portrait-dark', width: 390, height: 844, theme: 'dark' },
  { id: 'placement-short-light', width: 844, height: 390, theme: 'light' },
]
const pairs = process.env.QA_CASE_ARMS?.split(',').filter(Boolean) || cases.flatMap(row => ['root', 'B'].map(arm => `${row.id}:${arm}`))
if (pairs.some(pair => !cases.some(row => ['root', 'B'].some(arm => pair === `${row.id}:${arm}`)))) throw new Error('Unknown bounded pair')
const result = { candidate: identity.candidate, baseline: identity.baseline, runtime: 'compiled', base, started: new Date().toISOString(), scriptSha256: sha(await readFile(fileURLToPath(import.meta.url))), fixture: { path: fixturePath, sha256: sha(fixtureBytes), validated: true }, pairs, cases: [], checks: [], screenshots: [], fixtures: [], contrast: [], pageerrors: [], limitations: ['Six Add PNGs at most, plus two Chart views from the separate bounded Chart capture after the shared-header repair. Earlier Chart evidence retains its original source/runtime/focus adjudication.', 'B is the actual memory-only dense system sample. It has no explicit preview/Confirm, named-ambiguity or numeric-placement form; portrait/short comparisons use its nearest selected-type Add structure.', 'Root setup imports at1440x900 through public controls before resizing the same workspace; copied IDs come from actual downloaded JSON.', 'Ordinary mouse/keyboard in viewport/touch-capable browser contexts; no physical Android Chrome, OS keyboard, safe-area or gesture proof.', 'One useful-text contrast sample per changed root state; temporary measurement suppression is restored before unmodified PNGs.'] }
const persist = () => writeFile(join(out, 'add-results.json'), JSON.stringify(result, null, 2) + '\n')
function check(name, passed, detail = null) { result.checks.push({ name, passed, detail }); expect(passed, name).toBe(true) }
async function hit(locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(el => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { bounds: r.toJSON(), ordinaryHit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && (top === el || el.contains(top)) } })
}
async function click(locator) { expect((await hit(locator)).ordinaryHit).toBe(true); await locator.click() }
async function focusByTab(page, locator) {
  for (let index = 0; index < 40; index++) {
    if (await locator.evaluate(el => el === document.activeElement && el.matches(':focus-visible'))) {
      const evidence = await hit(locator)
      return locator.evaluate((el, evidence) => { const s = getComputedStyle(el); return { ...evidence, outline: s.outline, shadow: s.boxShadow, contained: evidence.bounds.left >= 0 && evidence.bounds.top >= 0 && evidence.bounds.right <= innerWidth && evidence.bounds.bottom <= innerHeight } }, evidence)
    }
    await page.keyboard.press('Tab')
  }
  throw new Error('Natural Tab did not reach the requested visible control')
}
async function theme(page, arm, palette) {
  const shell = arm === 'root' ? page.locator('html') : page.locator('.proto-b')
  const dark = arm === 'root' ? await shell.evaluate(el => el.classList.contains('dark')) : await shell.getAttribute('data-theme') === 'dark'
  if (dark !== (palette === 'dark')) await page.getByRole('button', { name: arm === 'root' ? /^Switch to (light|dark) mode$/ : /^Switch to (light|dark) theme$/ }).click()
  if (arm === 'root') await expect.poll(() => shell.evaluate(el => el.classList.contains('dark'))).toBe(palette === 'dark')
  else await expect(shell).toHaveAttribute('data-theme', palette)
}
async function exportSystem(page) {
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export star system JSON', exact: true }).click()])
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk)
  const bytes = Buffer.concat(chunks), data = JSON.parse(bytes)
  const files = page.getByRole('button', { name: 'Map files', exact: true }); if (await files.getAttribute('aria-expanded') === 'true') await files.click()
  return { data, sha256: sha(bytes) }
}
async function rootSetup(page, info) {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base)
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Creation presentation QA')
  await page.getByLabel('First star system', { exact: true }).fill('Bootstrap')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await expect(page.locator('svg.system-map-svg')).toBeVisible()
  await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const pending = page.waitForEvent('dialog')
  const upload = page.getByLabel('Import map JSON', { exact: true }).setInputFiles({ name: 'dense-reach.json', mimeType: 'application/json', buffer: fixtureBytes })
  const dialog = await pending; expect(dialog.message()).toContain('Star systems: 1'); await dialog.accept(); await upload
  const files = page.getByRole('button', { name: 'Map files', exact: true }); if (await files.getAttribute('aria-expanded') === 'true') await files.click()
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true }); if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.locator('#workspace-hierarchy-panel'); await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const map = page.getByRole('group', { name: 'Dense Reach star system map', exact: true }); await expect(map).toBeVisible()
  if (await hierarchy.isVisible()) await hierarchy.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel'); if (await inspector.isVisible()) await inspector.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
  const exported = await exportSystem(page)
  result.fixtures.push({ caseId: info.id, arm: 'root', source: 'Actual validated public import copy and standalone export', sha256: exported.sha256, systemId: exported.data.system.id, systemName: exported.data.system.name, objects: exported.data.system.objects.map(({ id, name, subtype }) => ({ id, name, subtype })), orbits: exported.data.system.orbits.map(({ id, order, hostId }) => ({ id, order, hostId })) })
  await page.setViewportSize({ width: info.width, height: info.height }); await theme(page, 'root', info.theme)
  return map
}
async function referenceSetup(page, info) {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`${base}/?variant=B&controls=dock&inspectorSample=dense`)
  const map = page.locator('.proto-b svg.system-map-svg'); await expect(map).toBeVisible(); await theme(page, 'B', info.theme)
  const hide = page.getByRole('button', { name: 'Hide Inspect panel', exact: true }); if (await hide.isVisible()) await hide.click()
  await page.setViewportSize({ width: info.width, height: info.height })
  result.fixtures.push({ caseId: info.id, arm: 'B', source: 'Actual memory-only dense B sample', context: await page.locator('.b-map-context strong').textContent(), mapLabel: await map.getAttribute('aria-label'), objectIds: await map.locator('.system-object').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))) })
}
async function rootPalette(page) {
  await click(page.getByRole('button', { name: 'Add to map', exact: true }))
  const palette = page.getByRole('region', { name: 'Object palette', exact: true }); await expect(palette).toBeVisible(); return palette
}
async function sceneClick(page, map, point) {
  for (let index = 0; index < 40; index++) {
    const target = await map.evaluate((el, point) => { const m = el.querySelector('.system-map-content').getScreenCTM(), p = new DOMPoint(point.x, point.y).matrixTransform(m), x = Math.round(p.x), y = Math.round(p.y), top = document.elementFromPoint(x, y); return { x, y, hit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && el.contains(top) } }, point)
    if (target.hit) { await page.mouse.click(target.x, target.y); return target }
    const out = page.getByRole('toolbar', { name: 'Map zoom controls', exact: true }).getByRole('button', { name: 'Zoom out', exact: true })
    if (await out.isDisabled()) break
    await out.click()
  }
  throw new Error('Public Zoom out could not expose the fixed fixture target')
}
async function state(page, info, arm, map) {
  if (arm === 'B') {
    await click(page.getByRole('button', { name: 'Choose an item to add to the map', exact: true }))
    if (info.id === 'placement-short-light') await click(page.getByRole('button', { name: 'Add Orbit', exact: true }))
    else {
      await click(page.getByRole('button', { name: /^Add map mark/ }))
      const catalogue = page.locator('#b-catalogue-panel'); await expect(catalogue).toBeVisible()
      const planet = catalogue.getByRole('button', { name: 'Planet', exact: true })
      if (info.id === 'chooser-desktop-light') return { surface: catalogue, target: planet }
      await click(planet)
    }
    await expect(page.locator('.prototype-toast')).toBeHidden()
    const status = page.locator('.b-add-status'); await expect(status).toBeVisible()
    return { surface: status, target: status.getByRole('button', { name: 'Quit Add and return to Navigate', exact: true }), structuralOnly: true }
  }
  const palette = await rootPalette(page)
  for (const [label, locator] of [
    ['active category', palette.locator('.object-palette-category-button[aria-pressed="true"]').first()],
    ['inactive category', palette.locator('.object-palette-category-button[aria-pressed="false"]').first()],
    ['category guidance', palette.locator('.object-palette-hint')],
  ]) {
    await expect(locator).toBeVisible()
    const sample = await sampleContrast(page, locator)
    result.contrast.push({ caseId: info.id, arm, target: label, theme: info.theme, ...sample })
    check(`${info.id}/${arm}: ${label} contrast`, sample.minimum >= 4.5, { minimum: sample.minimum, threshold: 4.5, text: sample.text })
  }
  if (info.id === 'chooser-desktop-light') return { surface: palette, target: palette.getByRole('button', { name: 'Add Planet', exact: true }), text: palette.getByRole('button', { name: 'Add Planet', exact: true }) }
  if (info.id === 'ambiguity-portrait-dark') {
    await click(palette.getByRole('button', { name: 'Add Planet', exact: true }))
    const delivered = await sceneClick(page, map, { x: 583.9230484541326, y: 340 })
    const choices = page.getByRole('group', { name: 'Placement targets', exact: true })
    const alpha = choices.getByRole('button', { name: 'Orbit 1 around Primary Star', exact: true }), beta = choices.getByRole('button', { name: 'Orbit 2 around Primary Star', exact: true })
    await expect(alpha).toBeVisible(); await expect(beta).toBeVisible(); await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
    check(`${info.id}: both named choices receive ordinary hits`, (await hit(alpha)).ordinaryHit && (await hit(beta)).ordinaryHit, delivered)
    return { surface: choices, target: alpha, text: alpha }
  }
  await click(palette.getByRole('button', { name: 'Add orbit', exact: true }))
  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true }), placement = controls.getByRole('button', { name: 'Placement', exact: true })
  await click(placement)
  const form = page.getByRole('form', { name: 'Placement', exact: true })
  await expect(form.getByRole('combobox', { name: 'Orbit center or host', exact: true })).toContainText('Unoccupied center')
  for (const [name, value] of [['Placement X', '0.2'], ['Placement Y', '0.7'], ['Horizontal radius', '140'], ['Vertical radius', '80'], ['Rotation', '25']]) await form.getByLabel(name, { exact: true }).fill(value)
  const preview = form.getByRole('button', { name: 'Preview placement', exact: true })
  await focusByTab(page, preview); await click(preview)
  await expect(controls.getByRole('button', { name: 'Confirm placement', exact: true })).toBeVisible()
  check(`${info.id}: preview Confirm/Cancel ordinary hits`, (await hit(controls.getByRole('button', { name: 'Confirm placement', exact: true }))).ordinaryHit && (await hit(controls.getByRole('button', { name: 'Cancel placement', exact: true }))).ordinaryHit)
  if (!(await form.isVisible())) await click(placement)
  return { surface: form, target: form.getByRole('button', { name: 'Preview placement', exact: true }), text: form.locator('.system-creation-form-heading p') }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true }); result.browser = browser.version()
try {
  for (const info of cases) for (const arm of ['root', 'B']) {
    if (!pairs.includes(`${info.id}:${arm}`)) continue
    const context = await browser.newContext({ viewport: { width: info.width, height: info.height }, colorScheme: info.theme, hasTouch: info.width < 1024, reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage(); page.on('pageerror', error => result.pageerrors.push({ caseId: info.id, arm, message: error.message }))
    let failed = false
    try {
      const map = arm === 'root' ? await rootSetup(page, info) : await referenceSetup(page, info)
      const selected = await state(page, info, arm, map)
      const focus = await focusByTab(page, selected.target)
      check(`${info.id}/${arm}: natural visible focus and ordinary hit`, focus.contained && focus.ordinaryHit, focus)
      if (selected.text) { const sample = await sampleContrast(page, selected.text); result.contrast.push({ caseId: info.id, arm, ...sample }); check(`${info.id}/${arm}: useful text contrast`, sample.minimum >= 4.5, { minimum: sample.minimum, threshold: 4.5 }) }
      const geometry = await selected.surface.evaluate(el => ({ bounds: el.getBoundingClientRect().toJSON(), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, activeName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent }))
      check(`${info.id}/${arm}: no horizontal document overflow`, geometry.pageScrollWidth <= info.width, geometry)
      await page.mouse.move(0, 0)
      const file = `${info.id}-${arm}.png`; await page.screenshot({ path: join(out, file) })
      result.screenshots.push({ ...info, arm, file, geometry, focus, structuralOnly: selected.structuralOnly || false }); result.cases.push({ ...info, arm, completed: true })
    } catch (error) {
      failed = true; result.checks.push({ name: `${info.id}/${arm}: execution`, passed: false, detail: { message: error.message, stack: error.stack } }); result.cases.push({ ...info, arm, completed: false })
      await page.screenshot({ path: join(out, `${info.id}-${arm}-failure.png`) }).catch(() => {}); throw error
    } finally { await context.tracing.stop(failed ? { path: join(out, `${info.id}-${arm}-failure-trace.zip`) } : undefined).catch(() => {}); await context.close(); await persist() }
  }
} finally {
  await browser.close(); result.finished = new Date().toISOString(); result.finalSourceHashes = await hashes()
  result.checks.push({ name: 'Released source unchanged', passed: result.finalSourceHashes.every(file => file.expected.toLowerCase() === file.actual) })
  result.status = result.checks.some(row => !row.passed) || result.pageerrors.length ? 'failed' : 'scripted-checks-complete-coordinator-visual-inspection-pending'; await persist()
}
if (result.status === 'failed') process.exitCode = 1
