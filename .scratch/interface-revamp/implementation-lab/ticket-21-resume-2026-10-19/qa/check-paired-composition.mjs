// PREPARED ONLY. Reconcile selectors/identities with the immutable final handoff
// before QA_RUNTIME_RELEASE=compiled is set. No app APIs or acceptance style
// fixes. Measurement-only foreground/outline-color suppression is restored in
// finally; fidelity and focused evidence PNGs capture unmodified presentation.
import { chromium, expect } from '@playwright/test'
import { createJiti } from 'jiti'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkspaceRecords, seedValidatedRecord, actualJsonDownload, withAbortedNextWorkspaceWrite } from './platform-hooks.mjs'
import { sampleContrast, sampleFocusContour } from './contrast.mjs'

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../../../..')
const out = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!out?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket21-') || out.includes('/../')) throw new Error('Literal persistent ticket21 host output root required')
if (process.env.QA_RUNTIME_RELEASE !== 'compiled' || !process.env.QA_FROZEN_CANDIDATE || !process.env.QA_SOURCE_IDENTITY) throw new Error('Explicit compiled runtime release, frozen candidate and source identity required')
const identity = JSON.parse(await readFile(process.env.QA_SOURCE_IDENTITY, 'utf8'))
if (identity.candidate !== process.env.QA_FROZEN_CANDIDATE) throw new Error('Requested candidate differs from supplied source identity')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3180'
const sha = value => createHash('sha256').update(value).digest('hex')
if (!Array.isArray(identity.files) || !identity.files.length) throw new Error('Identity must supply nonempty files:[{path,sha256}] for frozen source/build inputs')
for (const file of identity.files) {
  const actual = sha(await readFile(resolve(repo, file.path)))
  if (actual.toLowerCase() !== file.sha256.toLowerCase()) throw new Error(`Frozen identity mismatch: ${file.path}`)
}
const result = {
  status: 'running', candidate: identity.candidate, identity, startedAt: new Date().toISOString(), base,
  runtime: 'compiled .output/server/index.mjs', productRoute: '/', referenceRoute: '/?variant=B&controls=dock',
  cases: [], checks: [], screenshots: [], fixtures: [], contrast: [], pageerrors: [], console: [],
  requestedCases: process.env.QA_CASES || 'all six families', requestedArms: process.env.QA_ARMS || 'root,B',
  retainedReferenceResults: process.env.QA_REFERENCE_RESULTS || null,
  limitations: [
    'Six representative case families; not an exhaustive matrix or product-wide accessibility certificate.',
    'Product fixture: actual public root creation/import, authoritative domain validation, then isolated browser-platform IndexedDB seeding of its JSON.',
    'Reference uses actual B/Dock default memory fixture: three systems, thirteen objects, six Orbits and four routes. Product has three systems, eleven objects, three Orbits and one route; names, IDs, density and selection target differ. Context, palette, viewport, mode and panel state are controlled.',
    'Reduced recovery has no equivalent durable failure in the memory-only reference; its paired image compares compact structure, not recovery semantics.',
    'Touch/viewport emulation is not physical Android Chrome, OS keyboard, safe-area or physical-gesture proof.',
  ],
}
const check = (name, passed, detail = null) => { result.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}: ${JSON.stringify(detail)}`) }
const persist = async () => writeFile(join(out, 'paired-composition-results.json'), JSON.stringify(result, null, 2))
const settle = async page => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
const act = (locator, touch) => touch ? locator.tap() : locator.click()
const map = page => page.locator('svg.cluster-map-svg:visible, svg.system-map-svg:visible')
const camera = page => page.locator('.cluster-map-content:visible, .system-map-content:visible')
const feedback = page => page.locator('.workspace-feedback:not([inert]), .workspace-compact-recovery:visible')
const save = page => feedback(page).locator('.save-feedback')
const chart = page => page.getByRole('dialog', { name: 'Edit chart names', exact: true })
const panels = {
  root: { inspector: '#workspace-inspector-panel', hierarchy: '#workspace-hierarchy-panel', dock: '.workspace-dock', zoom: '.workspace-zoom-controls', header: '.workspace-header', chrome: '.workspace-map-chrome', board: '[data-map-board]', canvas: '.workspace-map-canvas-region', bottom: '.workspace-bottom-controls', dockRegion: '.workspace-dock-region', zoomRegion: '.workspace-zoom-region', dashboard: '[data-workspace-dashboard]' },
  B: { inspector: '#b-inspector-panel', hierarchy: '#b-hierarchy-panel', dock: '.b-control-dock', zoom: '.b-zoom-controls', header: '.b-commandbar', chrome: '.b-map-hud', board: '.b-map-board', canvas: '.b-map-frame' },
}
const panel = (page, arm, kind) => page.locator(panels[arm][kind])
async function closePanels(page, arm, touch) {
  for (const kind of ['inspector', 'hierarchy']) {
    if (await panel(page, arm, kind).isVisible()) {
      const name = arm === 'root' ? `Close ${kind} panel` : kind === 'inspector' ? 'Hide inspector' : 'Close map hierarchy'
      await act(panel(page, arm, kind).getByRole('button', { name, exact: true }), touch)
      await expect(panel(page, arm, kind)).toBeHidden(); await settle(page)
    }
  }
}
async function openPanel(page, arm, kind, touch) {
  if (!await panel(page, arm, kind).isVisible()) {
    const button = arm === 'root'
      ? page.getByRole('button', { name: kind === 'inspector' ? 'Inspect' : 'Hierarchy', exact: true })
      : page.getByRole('button', { name: kind === 'inspector' ? 'Open Inspect panel' : 'Show map hierarchy', exact: true })
    await act(button, touch); await settle(page)
  }
  await expect(panel(page, arm, kind)).toBeVisible()
}
async function theme(page, arm, palette, touch) {
  if (arm === 'B') {
    if (await page.locator('.proto-b').getAttribute('data-theme') !== palette) await act(page.getByRole('button', { name: `Switch to ${palette} theme`, exact: true }), touch)
    await expect(page.locator('.proto-b')).toHaveAttribute('data-theme', palette)
  } else {
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')).toBe(palette)
  }
}
async function fit(page, touch) { await act(page.getByRole('button', { name: 'Fit map', exact: true }), touch); await settle(page) }
async function hit(page, locator, label) {
  await expect(locator).toBeVisible()
  const row = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { label: el.getAttribute('aria-label') || el.textContent?.trim(), bounds: r.toJSON(), ordinaryHit: hit === el || el.contains(hit), viewport: { width: innerWidth, height: innerHeight } }
  })
  check(label, row.ordinaryHit && row.bounds.left >= 0 && row.bounds.right <= row.viewport.width + 1 && row.bounds.top >= 0 && row.bounds.bottom <= row.viewport.height + 1, row)
  return row
}
async function contrast(page, locator, label, kind = 'text') {
  await expect(locator).toBeVisible(); await settle(page)
  if (kind === 'handle') {
    const file = `${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}-unmodified.png`
    await page.screenshot({ path: join(out, file) })
    result.screenshots.push({ caseId: 'resize-cue', state: label, arm: 'root', file })
  }
  const sample = await sampleContrast(page, locator, kind)
  result.contrast.push({ label, ...sample })
  check(`${label}: actual composited contrast`, Number.isFinite(sample.minimum) && sample.minimum >= sample.threshold, { minimum: sample.minimum, threshold: sample.threshold })
}
async function naturalFocusContour(page, locator, label) {
  // Move through the real tab order. Never repair natural entry using focus().
  let reached = false
  for (let index = 0; index < 100; index++) {
    if (await locator.evaluate(el => document.activeElement === el && el.matches(':focus-visible'))) { reached = true; break }
    await page.keyboard.press('Tab')
  }
  check(`${label}: reachable through natural Tab order`, reached)
  if (!reached) return
  await settle(page)
  const { measurement, focusedPixels } = await sampleFocusContour(page, locator)
  const focusGeometry = (await geometry(page, 'root')).focus
  result.contrast.push({ label, ...measurement, focusGeometry })
  const valid = measurement.focused && measurement.focusVisible && measurement.width > 0 && measurement.points.length > 0 && measurement.minimum >= 3 && measurement.paintMatches && focusGeometry.ringFits && focusGeometry.ordinaryHit && !focusGeometry.clippedBy.length
  const file = `${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${valid ? 'focus' : 'causal-focus-failure'}.png`
  await writeFile(join(out, file), focusedPixels)
  result.screenshots.push({ caseId: 'natural-focus-contour', state: label, arm: 'root', file, measurement: { minimum: measurement.minimum, paintMatches: measurement.paintMatches } })
  check(`${label}: complete actual straight focus contour contrast and unobscured paint`, valid, { minimum: measurement.minimum, threshold: 3, paintMatches: measurement.paintMatches, focusGeometry, causalPng: file, limitingPoints: measurement.points.filter(point => point.ratio < 3 || !point.paintMatches) })
}
async function geometry(page, arm) {
  return page.evaluate(selectors => {
    const visible = el => !!el && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0
    const rect = el => el ? { bounds: el.getBoundingClientRect().toJSON(), display: getComputedStyle(el).display, position: getComputedStyle(el).position, border: getComputedStyle(el).border, padding: getComputedStyle(el).padding, background: getComputedStyle(el).backgroundColor, gridColumns: getComputedStyle(el).gridTemplateColumns, gridRows: getComputedStyle(el).gridTemplateRows, chromeClearance: getComputedStyle(el).getPropertyValue('--workspace-map-chrome-clearance'), bottomClearance: getComputedStyle(el).getPropertyValue('--workspace-bottom-controls-clearance'), visible: visible(el) } : null
    const svg = [...document.querySelectorAll('svg.cluster-map-svg,svg.system-map-svg')].find(visible)
    const footprint = [...document.querySelectorAll('[data-map-obstruction]')].filter(visible).map(el => ({ name: el.id || el.getAttribute('aria-label') || el.className, ...rect(el) }))
    const marks = svg ? [...svg.querySelectorAll('.cluster-system-node,.system-object')].map(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { label: el.getAttribute('aria-label'), id: el.getAttribute('data-system-id') || el.getAttribute('data-object-id'), bounds: r.toJSON(), ordinaryHit: hit === el || el.contains(hit) }
    }) : []
    const active = document.activeElement, style = active instanceof Element ? getComputedStyle(active) : null
    const focusBox = active?.getBoundingClientRect(), extent = style?.outlineStyle !== 'none' ? Math.max(0, (parseFloat(style?.outlineWidth) || 0) + (parseFloat(style?.outlineOffset) || 0)) : 0
    const focusClips = []
    if (focusBox) for (let ancestor = active.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const css = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect()
      if ((/(auto|scroll|hidden|clip)/.test(css.overflowX) && (focusBox.left - extent < bounds.left - .1 || focusBox.right + extent > bounds.right + .1)) || (/(auto|scroll|hidden|clip)/.test(css.overflowY) && (focusBox.top - extent < bounds.top - .1 || focusBox.bottom + extent > bounds.bottom + .1))) focusClips.push({ name: ancestor.id || ancestor.className, bounds: bounds.toJSON() })
    }
    const focusHit = focusBox ? document.elementFromPoint(focusBox.x + focusBox.width / 2, focusBox.y + focusBox.height / 2) : null
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }, svg: rect(svg),
      surfaces: Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, rect(document.querySelector(selector))])),
      footprint, marks, camera: svg?.querySelector('.cluster-map-content,.system-map-content')?.getAttribute('transform'),
      selection: [...(svg?.querySelectorAll('.is-selected') || [])].map(el => ({ label: el.getAttribute('aria-label'), id: el.getAttribute('data-route-id') || el.getAttribute('data-object-id') || el.getAttribute('data-system-id') })),
      focus: { name: active?.getAttribute('aria-label') || active?.textContent?.trim().slice(0, 100), tag: active?.tagName, bounds: rect(active), outline: style ? `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}` : null, boxShadow: style?.boxShadow, outlineExtent: extent, focusVisible: active instanceof Element && active.matches(':focus-visible'), ordinaryHit: focusHit === active || active?.contains(focusHit), ringFits: !!focusBox && focusBox.left >= extent && focusBox.right <= innerWidth - extent && focusBox.top >= extent && focusBox.bottom <= innerHeight - extent, clippedBy: focusClips },
      controls: [...document.querySelectorAll('button,[role="slider"],[role="separator"]')].filter(visible).map(el => ({ name: el.getAttribute('aria-label') || el.textContent?.trim(), role: el.getAttribute('role'), pressed: el.getAttribute('aria-pressed'), expanded: el.getAttribute('aria-expanded'), controls: el.getAttribute('aria-controls') })),
    }
  }, panels[arm])
}
async function capture(page, arm, caseId, state) {
  await settle(page)
  const data = await geometry(page, arm), file = `${caseId}-${state}-${arm}.png`
  await page.screenshot({ path: join(out, file) })
  result.screenshots.push({ caseId, state, arm, file, geometry: data })
  check(`${caseId}/${state}/${arm}: no horizontal overflow`, data.viewport.scrollWidth <= data.viewport.width + 1)
  if (arm === 'root' && !state.includes('panel') && !state.includes('recovery')) {
    check(`${caseId}/${state}: one visible zoom set`, data.controls.filter(c => c.name === 'Fit map').length === 1)
    check(`${caseId}/${state}: bottom Dock`, data.surfaces.dock?.visible && data.surfaces.dock.bounds.top > data.viewport.height / 2, data.surfaces.dock)
    if (state === 'map' || state.includes('fitted')) check(`${caseId}/${state}: ordinary fitted entity target`, data.marks.some(mark => mark.ordinaryHit), data.marks)
    if (data.svg && data.surfaces.canvas) check(`${caseId}/${state}: SVG fills full canvas plane`, ['left', 'top', 'width', 'height'].every(key => Math.abs(data.svg.bounds[key] - data.surfaces.canvas.bounds[key]) < 2), { svg: data.svg.bounds, canvas: data.surfaces.canvas.bounds })
  }
  await persist()
  return data
}

const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false })
const domain = await jiti.import(join(repo, 'domain/workspace.ts'))
const fixturePath = join(here, 'fixtures/rich-cluster.json')
const fixtureBytes = await readFile(fixturePath), fixtureJson = JSON.parse(fixtureBytes)
const preparedFixture = domain.prepareJsonImport(domain.createLocalWorkspace('Validation Reach', 'Validation Star'), fixtureJson)
if (!domain.restoreLocalWorkspace(preparedFixture.workspace)) throw new Error('Authoritative fixture validation failed')
await mkdir(out, { recursive: true })
result.fixtures.push({ kind: 'import source', path: fixturePath, sha256: sha(fixtureBytes), authoritativeValidation: true, summary: preparedFixture.summary, provenance: 'Byte-identical copy of historical ticket-21/production-qa/rich-cluster.json; SHA-256 606283d0095d16e0e3948eb335a90c05eb5367d4b8c4fed326d8bf8f773f7435. This new fixture is the reproducible retained input; no other old artifact is required.' })
for (const file of ['components/PrototypeWorkbench.vue', 'components/PrototypeHierarchy.vue', 'components/PrototypeBInspector.vue', 'components/PrototypeMapCanvas.vue']) result.fixtures.push({ kind: 'actual B reference source', path: file, sha256: sha(await readFile(join(repo, file))) })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
result.browser = `Installed Chrome ${browser.version()}`
async function newPage(caseInfo, arm) {
  const context = await browser.newContext({ viewport: { width: caseInfo.width, height: caseInfo.height }, colorScheme: caseInfo.palette, hasTouch: caseInfo.touch, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' })
  context.setDefaultTimeout(8000)
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await context.newPage()
  page.on('pageerror', error => result.pageerrors.push({ caseId: caseInfo.id, arm, message: error.message }))
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) result.console.push({ caseId: caseInfo.id, arm, type: message.type(), text: message.text() }) })
  return { context, page }
}
let actualRecord
async function prepareRootFixture() {
  const { context, page } = await newPage({ id: 'fixture', width: 1440, height: 900, palette: 'light', touch: false }, 'root')
  try {
    await page.goto(base)
    await page.getByLabel('Jump Cluster', { exact: true }).fill('QA Paired Reach')
    await page.getByLabel('First star system', { exact: true }).fill('QA Bootstrap')
    await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
    await expect(save(page)).toHaveText('Saved on this device')
    await closePanels(page, 'root', false)
    await page.getByRole('button', { name: 'Map files', exact: true }).click()
    const menu = page.locator('#workspace-header-map-files-panel')
    await expect(menu).toBeVisible()
    page.once('dialog', dialog => dialog.accept())
    await page.getByLabel('Import map JSON', { exact: true }).setInputFiles({ name: 'paired-source.json', mimeType: 'application/json', buffer: fixtureBytes })
    await expect.poll(async () => (await readWorkspaceRecords(page)).current?.cluster.systems.length).toBe(3)
    await expect(save(page)).toHaveText('Saved on this device')
    actualRecord = (await readWorkspaceRecords(page)).current
    if (!domain.restoreLocalWorkspace(actualRecord)) throw new Error('Actual public root-created/imported record fails authoritative validation')
    await writeFile(join(out, 'actual-root-fixture.json'), JSON.stringify(actualRecord, null, 2))
    result.fixtures.push({ kind: 'actual public root record', sha256: sha(JSON.stringify(actualRecord)), id: actualRecord.id, cluster: actualRecord.cluster, authoritativeValidation: true })
  } catch (error) {
    check('public root fixture preparation: execution', false, { message: error.message, stack: error.stack })
    await page.screenshot({ path: join(out, 'fixture-root-failure.png') }).catch(() => {})
    await context.tracing.stop({ path: join(out, 'fixture-root-failure-trace.zip') }).catch(() => {})
    throw error
  } finally { await context.tracing.stop().catch(() => {}); await context.close() }
}
async function assertRootRouteSelection(page, inspected = false) {
  const expectedRoute = actualRecord.cluster.routes.find(route => route.jumpLevel === 4)
  if (!expectedRoute) throw new Error('Validated comparison fixture has no Jump Level 4 route')
  const selected = page.locator('svg.cluster-map-svg .cluster-route.is-selected')
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveAttribute('data-route-id', expectedRoute.id)
  if (inspected) {
    const inspector = panel(page, 'root', 'inspector')
    await expect(inspector.getByText('JUMP ROUTE / SELECTED', { exact: true })).toBeVisible()
    await expect(inspector.getByRole('heading', { name: 'Jump Level 4', exact: true })).toBeVisible()
  }
}
async function setup(page, arm, info) {
  await page.goto(arm === 'root' ? base : `${base}/?variant=B&controls=dock`)
  if (arm === 'root') {
    await expect(page.getByRole('button', { name: 'Create local workspace', exact: true })).toBeVisible()
    await seedValidatedRecord(page, actualRecord); await page.reload()
    await expect(map(page)).toBeVisible(); await expect(save(page)).toHaveText('Saved on this device')
    const initialHierarchy = await panel(page, arm, 'hierarchy').isVisible()
    check(`${info.id}: initial Hierarchy hidden`, !initialHierarchy)
    if (info.width <= 760 || info.height <= 600) check(`${info.id}: compact starts map-first with no panel`, !initialHierarchy && !await panel(page, arm, 'inspector').isVisible())
    await closePanels(page, arm, info.touch)
    const back = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
    if (await back.isVisible()) { await act(back, info.touch); await expect(page.locator('svg.cluster-map-svg')).toBeVisible() }
    await closePanels(page, arm, info.touch)
    await act(page.getByRole('button', { name: 'Select', exact: true }), info.touch)
    await fit(page, info.touch)
    const route = page.locator('svg.cluster-map-svg').getByRole('button', { name: /Jump Level 4/ }).first()
    // A curved SVG group's bounding-box center need not lie on route paint.
    // This setup uses the entity's real supported keyboard activation. Actual
    // ordinary pointer reachability is asserted separately on fitted targets.
    await route.press('Enter')
    await assertRootRouteSelection(page, true)
    await closePanels(page, arm, info.touch)
    await act(page.getByRole('button', { name: 'Navigate', exact: true }), info.touch)
  } else { await expect(page.locator('.proto-b')).toBeVisible(); await expect(map(page)).toBeVisible(); await closePanels(page, arm, info.touch) }
  await theme(page, arm, info.palette, info.touch); await fit(page, info.touch)
  if (arm === 'root') {
    await assertRootRouteSelection(page)
    await expect(page.getByRole('navigation', { name: 'Map context and commands', exact: true })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Map zoom controls', exact: true })).toBeVisible()
    if (['desktop-mapfirst', 'portrait-map'].includes(info.id)) {
      await contrast(page, page.locator('.workspace-map-context h2'), `${info.palette} map chrome name`)
      await contrast(page, page.getByRole('button', { name: 'Navigate', exact: true }), `${info.palette} active Dock mode text`)
      await contrast(page, page.locator('.workspace-zoom-value'), `${info.palette} zoom readout`)
      // Two existing light/dark case families only. Tight Dock and compact
      // zoom gaps need actual neighboring-border contour proof, not panel RGB.
      await naturalFocusContour(page, page.getByRole('button', { name: 'Select', exact: true }), `${info.id} Select neighbor contour`)
      await naturalFocusContour(page, page.getByRole('button', { name: 'Fit map', exact: true }), `${info.id} Fit neighbor contour`)
      await naturalFocusContour(page, page.getByRole('button', { name: 'Open map navigation controls', exact: true }), `${info.id} navigation neighbor contour`)
      await act(page.getByRole('button', { name: 'Navigate', exact: true }), info.touch)
    }
  }
}
async function compactCheck(page, arm, kind, info) {
  const target = panel(page, arm, kind), other = panel(page, arm, kind === 'inspector' ? 'hierarchy' : 'inspector')
  check(`${info.id}/${arm}: ${kind} exclusive`, !await other.isVisible())
  if (arm !== 'root') return
  await expect.poll(() => target.evaluate(el => el.contains(document.activeElement))).toBe(true)
  const row = await target.evaluate(el => ({ bounds: el.getBoundingClientRect().toJSON(), role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), viewport: { width: innerWidth, height: innerHeight } }))
  check(`${info.id}: compact ${kind} fullscreen`, row.role === 'dialog' && row.modal === 'true' && row.bounds.width >= row.viewport.width - 24 && row.bounds.height >= row.viewport.height - 24, row)
  for (let n = 0; n < 5; n++) await page.keyboard.press('Tab')
  check(`${info.id}: natural focus retained inside ${kind}`, await target.evaluate(el => el.contains(document.activeElement)))
  const focused = (await geometry(page, arm)).focus
  check(`${info.id}: naturally tabbed ${kind} focus fully unobscured`, focused.focusVisible && focused.ringFits && focused.ordinaryHit && !focused.clippedBy.length && (focused.outlineExtent > 0 || focused.boxShadow !== 'none'), focused)
}

async function resizeRetention(page, info) {
  await closePanels(page, 'root', false)
  await fit(page, false)
  await page.locator('svg.cluster-map-svg').getByRole('button', { name: 'Open QA Amber Lantern system map', exact: true }).click()
  await expect(page.locator('svg.system-map-svg')).toBeVisible()
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await fit(page, false)
  const object = page.locator('svg.system-map-svg').getByRole('button', { name: /^Select .*, QA Copper World \(/ })
  await hit(page, object, 'resize: ordinary object selection target'); await object.click()
  const inspector = panel(page, 'root', 'inspector')
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const input = inspector.getByLabel('Name', { exact: true })
  // A valid required Name lets submit reach the domain validator. The planet's
  // distinct key PL-01 deliberately collides with the Primary Star's key A.
  const draftName = 'QA retained Copper World draft'
  const locationKey = inspector.getByLabel('Location key', { exact: true })
  await input.fill(draftName)
  await locationKey.fill('A')
  await inspector.getByRole('button', { name: 'Save map object', exact: true }).click()
  await expect(input).toHaveValue(draftName)
  await expect(locationKey).toHaveValue('A')
  await expect(inspector.getByRole('alert')).toBeVisible()
  const originalNode = await input.elementHandle(), originalError = await inspector.getByRole('alert').textContent()
  const beforeRecord = await readWorkspaceRecords(page), beforeCamera = await camera(page).getAttribute('transform')
  await openPanel(page, 'root', 'hierarchy', false)
  for (const kind of ['hierarchy', 'inspector']) {
    const owner = panel(page, 'root', kind)
    const separator = page.locator(`[role="separator"][aria-controls="workspace-${kind}-panel"]`)
    await expect(separator).toHaveCount(1)
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical')
    await expect(separator).toHaveAttribute('tabindex', '0')
    const accessible = await separator.evaluate(el => ({ name: el.getAttribute('aria-label'), min: Number(el.getAttribute('aria-valuemin')), max: Number(el.getAttribute('aria-valuemax')), now: Number(el.getAttribute('aria-valuenow')) }))
    check(`resize/${kind}: named actual pixel range`, !!accessible.name && accessible.min > 0 && accessible.max > accessible.min && accessible.now >= accessible.min && accessible.now <= accessible.max, accessible)
    await page.mouse.move(1, 1)
    await contrast(page, separator, `light ${kind} resting resize cue`, 'handle')
    for (const direction of [1, -1]) {
      const before = await owner.boundingBox(), handle = await separator.boundingBox()
      if (!before || !handle) throw new Error(`Missing ${kind} resize bounds`)
      await hit(page, separator, `resize/${kind}: ordinary inward-edge hit`)
      const delta = direction * (kind === 'hierarchy' ? 24 : -24)
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
      await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + delta, handle.y + handle.height / 2, { steps: 5 }); await page.mouse.up()
      await settle(page)
      const after = await owner.boundingBox(), value = Number(await separator.getAttribute('aria-valuenow'))
      check(`resize/${kind}: pointer ${direction === 1 ? 'grows' : 'shrinks'} with correct edge sign`, direction * (after.width - before.width) > 10 && Math.abs(value - after.width) < 2, { before, after, value })
    }
    for (const direction of [1, -1]) {
      const before = await owner.boundingBox(), key = kind === 'hierarchy' ? direction === 1 ? 'ArrowRight' : 'ArrowLeft' : direction === 1 ? 'ArrowLeft' : 'ArrowRight'
      await separator.press(key); await settle(page)
      const after = await owner.boundingBox(), value = Number(await separator.getAttribute('aria-valuenow'))
      check(`resize/${kind}: keyboard ${direction === 1 ? 'grows' : 'shrinks'} same actual width`, direction * (after.width - before.width) > 0 && Math.abs(value - after.width) < 2, { key, before, after, value })
    }
    await contrast(page, separator, `light ${kind} resize focus`, 'focus')
  }
  const widths = { hierarchy: (await panel(page, 'root', 'hierarchy').boundingBox()).width, inspector: (await inspector.boundingBox()).width }
  await closePanels(page, 'root', false)
  await openPanel(page, 'root', 'inspector', false)
  await page.getByRole('button', { name: /^Switch to (light|dark) mode$/ }).click()
  const darkHandle = page.locator('[role="separator"][aria-controls="workspace-inspector-panel"]')
  await page.mouse.move(1, 1)
  await contrast(page, darkHandle, 'dark inspector resting resize cue', 'handle')
  await darkHandle.press('ArrowLeft')
  await contrast(page, darkHandle, 'dark inspector resize focus', 'focus')
  await darkHandle.press('ArrowRight')
  await page.getByRole('button', { name: /^Switch to (light|dark) mode$/ }).click()
  await page.setViewportSize({ width: 390, height: 500 }); await settle(page)
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(input).toHaveValue(draftName); await expect(locationKey).toHaveValue('A')
  await expect(inspector.getByRole('alert')).toHaveText(originalError)
  check('resize: same invalid editor node across Hide/theme/reflow', await input.evaluate((el, original) => el === original, originalNode))
  await page.setViewportSize({ width: info.width, height: info.height }); await settle(page)
  await openPanel(page, 'root', 'hierarchy', false)
  const afterWidths = { hierarchy: (await panel(page, 'root', 'hierarchy').boundingBox()).width, inspector: (await inspector.boundingBox()).width }
  check('resize: session widths survive compact fullscreen and reopening', Object.keys(widths).every(key => Math.abs(widths[key] - afterWidths[key]) < 2), { widths, afterWidths })
  check('resize: sizing/Hide/theme/reflow leave camera and records unchanged', await camera(page).getAttribute('transform') === beforeCamera && JSON.stringify(await readWorkspaceRecords(page)) === JSON.stringify(beforeRecord))
  await input.fill('Retained unsaved width-probe text')
  await closePanels(page, 'root', false); await openPanel(page, 'root', 'inspector', false)
  await expect(input).toHaveValue('Retained unsaved width-probe text')
  await inspector.getByRole('button', { name: 'Cancel map object edits', exact: true }).click()
  await originalNode.dispose()
}

async function recoveryProbe(page, info) {
  const hierarchy = panel(page, 'root', 'hierarchy')
  await act(hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }), true)
  await expect(chart(page)).toBeVisible()
  const applied = 'QA Applied Paired Recovery', hidden = 'QA Hidden Paired Draft'
  await chart(page).getByLabel('Jump Cluster', { exact: true }).fill(applied)
  const beforeRecord = await readWorkspaceRecords(page)
  await withAbortedNextWorkspaceWrite(page, async () => {
    await act(chart(page).getByRole('button', { name: 'Apply names', exact: true }), true)
    await expect(chart(page)).toBeHidden(); await expect(save(page)).toContainText('Not saved.')
  })
  check('recovery: real aborted write retains durable records and ends chart form', JSON.stringify(beforeRecord) === JSON.stringify(await readWorkspaceRecords(page)))
  await act(hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }), true)
  await chart(page).getByLabel('Jump Cluster', { exact: true }).fill(hidden)
  await page.keyboard.press('Escape'); await expect(chart(page)).toBeHidden()
  await expect(feedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })).toBeVisible()
  const beforeCamera = await page.locator('.cluster-map-content').getAttribute('transform')
  const trigger = feedback(page).getByRole('button', { name: 'Recovery details', exact: true })
  await act(trigger, true)
  const details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details).toBeVisible(); await settle(page)
  await expect(details.getByRole('alert').filter({ hasText: 'Save failed:' })).toBeVisible()
  const exporter = details.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })
  await hit(page, exporter, 'recovery: portaled current JSON ordinary hit inside compact panel')
  const download = await actualJsonDownload(page, () => act(exporter, true))
  check('recovery: actual current JSON contains applied memory and excludes hidden draft', download.value.cluster.name === applied && !JSON.stringify(download.value).includes(hidden), { filename: download.filename, sha256: download.sha256 })
  await capture(page, 'root', info.id, 'recovery-details-panel')
  await page.keyboard.press('Escape'); await expect(details).toBeHidden(); await expect(trigger).toBeFocused()
  check('recovery: popover opening/dismissal never refits camera', await page.locator('.cluster-map-content').getAttribute('transform') === beforeCamera)
  await closePanels(page, 'root', true)
  await act(page.getByRole('button', { name: 'Select', exact: true }), true); await fit(page, true)
  const target = page.locator('svg.cluster-map-svg .cluster-system-node').first()
  await hit(page, target, 'recovery: explicit Fit exposes ordinary target around Dock/zoom/feedback')
  const beforeTap = await page.locator('.cluster-map-content').getAttribute('transform')
  await act(target, true)
  await expect(chart(page).getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await act(chart(page).getByRole('button', { name: 'Stay here', exact: true }), true)
  await expect(chart(page).getByLabel('Jump Cluster', { exact: true })).toHaveValue(hidden)
  await page.keyboard.press('Escape'); await expect(chart(page)).toBeHidden()
  check('recovery: refused target retains map camera/tool/draft', await page.locator('.cluster-map-content').getAttribute('transform') === beforeTap && await page.getByRole('button', { name: 'Select', exact: true }).getAttribute('aria-pressed') === 'true')
  await capture(page, 'root', info.id, 'recovery-map')
  await act(feedback(page).getByRole('button', { name: 'Retry save', exact: true }), true)
  await expect(save(page)).toHaveText('Saved on this device')
  check('recovery: latest Retry persists applied data without replay', (await readWorkspaceRecords(page)).current.cluster.name === applied)
  await act(feedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true }), true)
  await expect(chart(page).getByLabel('Jump Cluster', { exact: true })).toHaveValue(hidden)
  await act(chart(page).getByRole('button', { name: 'Discard draft', exact: true }), true)
  await page.reload(); await expect(save(page)).toHaveText('Saved on this device')
  check('recovery: durable reload retains applied name', (await readWorkspaceRecords(page)).current.cluster.name === applied)
}

const cases = [
  { id: 'desktop-mapfirst', width: 1440, height: 900, palette: 'light', touch: false, kind: 'map' },
  { id: 'desktop-overlays', width: 1440, height: 900, palette: 'light', touch: false, kind: 'overlays' },
  { id: 'portrait-map', width: 390, height: 844, palette: 'dark', touch: true, kind: 'map' },
  { id: 'portrait-panels', width: 390, height: 844, palette: 'dark', touch: true, kind: 'panels' },
  { id: 'short-landscape', width: 844, height: 390, palette: 'light', touch: true, kind: 'landscape' },
  { id: 'reduced-recovery', width: 390, height: 500, palette: 'dark', touch: true, kind: 'recovery' },
]
const requestedCases = process.env.QA_CASES?.split(',').filter(Boolean)
const requestedArms = process.env.QA_ARMS?.split(',').filter(Boolean) || ['root', 'B']
if (requestedCases?.some(id => !cases.some(info => info.id === id)) || requestedArms.some(arm => !['root', 'B'].includes(arm))) throw new Error('Unknown bounded QA case/arm selection')
try {
  await prepareRootFixture()
  for (const info of cases.filter(info => !requestedCases || requestedCases.includes(info.id))) {
    console.log(`PAIR ${info.id}`)
    const caseRow = { ...info, arms: [] }; result.cases.push(caseRow)
    for (const arm of requestedArms) {
      const { page, context } = await newPage(info, arm)
      const armCheckStart = result.checks.length
      try {
        await setup(page, arm, info)
        const first = await capture(page, arm, info.id, 'map')
        if (info.kind === 'overlays') {
          if (arm === 'root') await assertRootRouteSelection(page)
          await openPanel(page, arm, 'inspector', info.touch)
          if (arm === 'root') await assertRootRouteSelection(page, true)
          const inspect = await capture(page, arm, info.id, 'inspect-overlay')
          await openPanel(page, arm, 'hierarchy', info.touch)
          if (arm === 'root') await assertRootRouteSelection(page, true)
          const both = await capture(page, arm, info.id, 'both-overlays')
          if (arm === 'root') {
            check(`${info.id}: panel opening preserves full map bounds`, ['left', 'top', 'width', 'height'].every(key => Math.abs(first.svg.bounds[key] - both.svg.bounds[key]) < 1), { first: first.svg, inspect: inspect.svg, both: both.svg })
            check(`${info.id}: both panels overlap map plane`, both.surfaces.hierarchy.bounds.right > both.svg.bounds.left && both.surfaces.inspector.bounds.left < both.svg.bounds.right)
            await fit(page, false)
            await capture(page, arm, info.id, 'both-fitted')
            const files = page.getByRole('button', { name: 'Map files', exact: true })
            await files.press('Enter')
            const exportButton = page.locator('#workspace-header-map-files-panel').getByRole('button', { name: 'Export Jump Cluster JSON', exact: true })
            await hit(page, exportButton, `${info.id}: Files above Inspect ordinary hit`)
            const downloaded = await actualJsonDownload(page, () => exportButton.click())
            check(`${info.id}: actual Files JSON`, downloaded.value.cluster.systems.length === 3, downloaded.sha256)
            await page.keyboard.press('Escape'); await expect(files).toBeFocused()
            await resizeRetention(page, info)
          }
        } else if (info.kind === 'panels' || info.kind === 'landscape' || info.kind === 'recovery') {
          if (arm === 'root') await assertRootRouteSelection(page)
          await openPanel(page, arm, 'inspector', info.touch)
          if (arm === 'root') await assertRootRouteSelection(page, true)
          await compactCheck(page, arm, 'inspector', info)
          await capture(page, arm, info.id, 'inspect-panel')
          await closePanels(page, arm, info.touch)
          await openPanel(page, arm, 'hierarchy', info.touch)
          await compactCheck(page, arm, 'hierarchy', info)
          await capture(page, arm, info.id, 'hierarchy-panel')
          if (info.kind === 'recovery' && arm === 'root') await recoveryProbe(page, info)
        }
        caseRow.arms.push({ arm, status: 'completed', route: page.url() })
      } catch (error) {
        check(`${info.id}/${arm}: execution`, false, { message: error.message, stack: error.stack })
        await page.screenshot({ path: join(out, `${info.id}-${arm}-failure.png`) }).catch(() => {})
        await context.tracing.stop({ path: join(out, `${info.id}-${arm}-failure-trace.zip`) }).catch(() => {})
        caseRow.arms.push({ arm, status: 'failed', error: error.message })
      } finally {
        const armFailed = result.checks.slice(armCheckStart).some(row => !row.passed)
        await context.tracing.stop(armFailed ? { path: join(out, `${info.id}-${arm}-failure-trace.zip`) } : undefined).catch(() => {})
        await context.close(); await persist()
      }
    }
  }
} finally {
  await browser.close()
  result.finishedAt = new Date().toISOString()
  result.finalSourceHashes = []
  for (const file of identity.files) {
    const actual = sha(await readFile(resolve(repo, file.path)))
    result.finalSourceHashes.push({ path: file.path, expected: file.sha256, actual, unchanged: actual.toLowerCase() === file.sha256.toLowerCase() })
  }
  check('frozen source/build input hashes unchanged after paired gate', result.finalSourceHashes.every(file => file.unchanged))
  result.status = result.checks.some(row => !row.passed) || result.pageerrors.length ? 'failed' : 'scripted-observations-complete-visual-inspection-pending'
  result.summary = { passed: result.checks.filter(row => row.passed).length, failed: result.checks.filter(row => !row.passed).length, screenshots: result.screenshots.length }
  await persist()
}
if (result.status === 'failed') process.exitCode = 1
