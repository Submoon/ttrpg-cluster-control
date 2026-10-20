// Requires the coordinator's explicit development or compiled-runtime release.
// Eight positive PNGs; extra screenshots/traces are retained only on failure.
import { chromium, expect } from '@playwright/test'
import { createJiti } from 'jiti'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleContrast } from '../../ticket-21-resume-2026-10-19/qa/contrast.mjs'

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../../../..')
const out = process.env.QA_HOST_OUTPUT_ROOT?.replaceAll('\\', '/')
if (!out?.startsWith('C:/Users/fbal-fontaine/AppData/Local/Temp/ticket22-') || out.includes('/../')) throw new Error('Literal ticket22 host output root required')
if (!['development', 'compiled'].includes(process.env.QA_RUNTIME_RELEASE) || !process.env.QA_CANDIDATE || !process.env.QA_SOURCE_IDENTITY) throw new Error('Explicit frozen candidate, identity and runtime release required')
const identity = JSON.parse(await readFile(process.env.QA_SOURCE_IDENTITY, 'utf8'))
if (identity.candidate !== process.env.QA_CANDIDATE || !identity.files?.length) throw new Error('Frozen identity/candidate mismatch')
const sha = value => createHash('sha256').update(value).digest('hex')
async function hashes() {
  return Promise.all(identity.files.map(async file => ({ path: file.path, expected: file.sha256, actual: sha(await readFile(resolve(repo, file.path))) })))
}
if ((await hashes()).some(file => file.expected.toLowerCase() !== file.actual)) throw new Error('Source differs from released freeze')
await mkdir(out, { recursive: true })
const base = process.env.QA_BASE_URL || (process.env.QA_RUNTIME_RELEASE === 'development' ? 'http://127.0.0.1:3100' : 'http://127.0.0.1:3180')
const result = {
  candidate: identity.candidate, started: new Date().toISOString(), base, runtime: process.env.QA_RUNTIME_RELEASE, cases: [], checks: [], screenshots: [], fixtures: [], pageerrors: [], contrast: [],
  scriptSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  limitations: [
    'Four structural pairs, eight selected positive PNGs; existing ticket21 shell geometry is retained evidence.',
    'Root uses a separately constructed authoritative-domain-validated import through public controls. B uses its actual memory-only dense sample, never as a product fixture source.',
    'B has no editable numeric Orbit form. Orbit root bodies are compared with its dense object header/body/footer structure; domain fields and fixture identities differ.',
    'The retained B sample renders unnamed fields; its existing visible DOM control IDs are used explicitly. Product controls continue to be located by public labels.',
    '390x500 is reduced-height emulation, not physical Android Chrome, OS keyboard, safe-area or gesture proof.',
    'Two text contrast samples per root state reuse the retained ticket21 sampleContrast utility. Temporary foreground-only suppression is restored; selected PNGs are unmodified.',
  ],
}
const check = (name, passed, detail = null) => { result.checks.push({ name, passed, detail }); if (!passed) console.log(`FAIL ${name}`) }
const persist = () => writeFile(join(out, 'presentation-results.json'), JSON.stringify(result, null, 2))
const domain = await createJiti(import.meta.url, { fsCache: false, moduleCache: false }).import(join(repo, 'domain/workspace.ts'))
const fixture = domain.createLocalWorkspace('Inspector QA Reach', 'Inspector QA Star')
const system = fixture.cluster.systems[0], planetId = randomUUID(), orbitId = randomUUID()
fixture.objectFieldSettings.customFields.push(
  { id: 'qa-note', name: 'Session note', type: 'text' }, { id: 'qa-score', name: 'Survey score', type: 'number' },
  { id: 'qa-hazard', name: 'Confirmed hazard', type: 'boolean' },
  { id: 'qa-status', name: 'Survey status', type: 'single-select', options: ['Not started', 'Needs review', 'Complete'] },
  { id: 'qa-log', name: 'Field log', type: 'text' },
)
system.objects.push({ id: planetId, family: 'CelestialBody', subtype: 'planet', locationKey: 'PL-01', name: 'QA Survey World of the Outer Meridian',
  description: 'An independent survey-world fixture. Its Description records the physical site and approach.\n\nWeather beacons repeat across the northern ridge; the sheltered landing shelf remains reachable after the seasonal storms.',
  placement: { kind: 'system', x: .7, y: .5 }, atmosphere: 'Breathable',
  customFieldValues: { 'qa-note': 'Session-only field value, distinct from Description.\n\nAsk the crew which archive they last visited.', 'qa-score': 0, 'qa-hazard': false, 'qa-status': 'Needs review', 'qa-log': 'North ridge inspected.\nSouthern beacon remains active.\nA second survey is planned.' } })
system.orbits.push({ id: orbitId, order: 1, hostId: null, center: { x: .25, y: .65 } })
fixture.layout.orbitRadii[orbitId] = { horizontal: 210, vertical: 85 }; fixture.layout.orbitRotations[orbitId] = 25
const importDocument = domain.exportJumpCluster(fixture)
const validated = domain.prepareJsonImport(domain.createLocalWorkspace('Validation', 'Validation star'), importDocument)
if (!domain.restoreLocalWorkspace(validated.workspace)) throw new Error('Presentation import fails authoritative validation')
const fixtureBytes = Buffer.from(JSON.stringify(importDocument, null, 2))
await writeFile(join(out, 'presentation-fixture.json'), fixtureBytes)
result.fixtures.push({ kind: 'product import source', sha256: sha(fixtureBytes), systemId: system.id, planetId, orbitId, validated: true })
for (const path of ['components/PrototypeWorkbench.vue', 'components/PrototypeBInspector.vue', 'components/prototype-inspector-fixture.ts', '.scratch/interface-revamp/implementation-lab/ticket-21-resume-2026-10-19/qa/contrast.mjs']) result.fixtures.push({ kind: 'reference/measurement source', path, sha256: sha(await readFile(join(repo, path))) })

async function hit(locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y)
    return { bounds: r.toJSON(), ordinaryHit: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && (top === el || el.contains(top)) }
  })
}
async function click(locator) { const evidence = await hit(locator); expect(evidence.ordinaryHit, JSON.stringify(evidence)).toBe(true); await locator.click() }
async function setTheme(page, arm, palette) {
  const shell = arm === 'root' ? page.locator('html') : page.locator('.proto-b')
  if (arm === 'root') { if (await shell.evaluate(el => el.classList.contains('dark')) !== (palette === 'dark')) await page.getByRole('button', { name: /^Switch to (light|dark) mode$/ }).click() }
  else if (await shell.getAttribute('data-theme') !== palette) await page.getByRole('button', { name: /^Switch to (light|dark) theme$/ }).click()
  if (arm === 'root') await expect.poll(() => shell.evaluate(el => el.classList.contains('dark'))).toBe(palette === 'dark')
  else await expect(shell).toHaveAttribute('data-theme', palette)
}
async function publicExport(page) {
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export star system JSON', exact: true }).click()])
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
async function rootSetup(page, info) {
  // Establish the imported selection and draft through the desktop public panels,
  // then resize the same mounted editor for the compact geometry checks.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base)
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Presentation workspace')
  await page.getByLabel('First star system', { exact: true }).fill('Bootstrap')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await expect(page.locator('svg.system-map-svg')).toBeVisible()
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Import map JSON', { exact: true }).setInputFiles({ name: 'inspector-presentation.json', mimeType: 'application/json', buffer: fixtureBytes })
  await expect(page.locator('svg.cluster-map-svg')).toBeVisible() // Cluster import returns here asynchronously.
  const files = page.getByRole('button', { name: 'Map files', exact: true })
  if (await files.getAttribute('aria-expanded') === 'true') await files.click()
  const toggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await expect(hierarchy).toBeVisible()
  await hierarchy.getByRole('button', { name: 'Open Inspector QA Star system map', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Inspector QA Star star system map', exact: true })).toBeVisible()
  const actual = await publicExport(page)
  await page.keyboard.press('Escape')
  if (await files.getAttribute('aria-expanded') === 'true') await files.click()
  result.fixtures.push({ caseId: info.id, kind: 'actual public imported system export', sha256: sha(JSON.stringify(actual)), systemId: actual.system.id, objects: actual.system.objects.map(object => ({ id: object.id, key: object.locationKey, name: object.name })), orbits: actual.system.orbits })
  await setTheme(page, 'root', info.palette)
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  await expect(hierarchy).toBeVisible()
  if (info.kind === 'object') await hierarchy.getByRole('button', { name: 'Select PL-01, QA Survey World of the Outer Meridian', exact: true }).click()
  else await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await page.getByRole('button', { name: info.kind === 'object' ? 'Edit map object' : 'Edit Orbit', exact: true }).click()
  const form = page.locator('#workspace-inspector-panel .entity-inspector:visible')
  await expect(form).toHaveCount(1)
  if (info.kind === 'object') await form.getByLabel('Location key', { exact: true }).fill('A')
  else await form.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('')
  await click(form.getByRole('button', { name: /^Apply changes/ }))
  await expect(form.getByRole('alert').first()).toBeVisible()
  await page.setViewportSize({ width: info.width, height: info.height })
  await expect(form).toBeVisible()
  return form
}
async function referenceSetup(page, info) {
  await page.goto(`${base}/?variant=B&controls=dock&inspectorSample=dense`)
  // The visible client-rendered SVG establishes actual reference hydration;
  // SSR form markup alone can precede usable theme/field event handlers.
  await expect(page.locator('.proto-b svg.system-map-svg')).toBeVisible()
  await setTheme(page, 'B', info.palette)
  const openInspect = page.getByRole('button', { name: 'Open Inspect panel', exact: true })
  if (await openInspect.isVisible()) await openInspect.click()
  const form = page.locator('.b-inspector-card:visible')
  const name = form.locator('[id="b-inspector-control-name"]')
  await expect(name).toBeVisible()
  result.fixtures.push({ caseId: info.id, kind: 'actual dense B object reference', title: await form.locator('h2').textContent(), sameEntityKindAsRoot: info.kind === 'object' })
  await name.fill('')
  await click(form.getByRole('button', { name: 'Apply changes', exact: true }))
  await expect(form.getByRole('alert')).toBeVisible()
  return form
}
async function errorAndDropdown(page, form, arm, info) {
  if (arm === 'B' || info.kind === 'object') {
    const select = arm === 'B' ? form.locator('[id="b-inspector-control-custom%3Asurvey-status"]') : form.getByLabel('Survey status', { exact: true })
    await select.click(); const popup = page.getByRole('listbox'); await expect(popup).toBeVisible()
    const option = popup.getByRole('option').first(), evidence = await hit(option)
    check(`${info.id}/${arm}: actual select popup ordinary hit`, evidence.ordinaryHit, evidence)
    await page.keyboard.press('Escape'); await expect(popup).not.toBeVisible()
  }
  await form.getByRole('button', { name: /^Review \d+ issue/ }).click()
  const issue = form.getByRole('alert').first().getByRole(arm === 'root' ? 'button' : 'link').first()
  const control = arm === 'root'
    ? (info.kind === 'object' ? form.getByLabel('Location key', { exact: true }) : form.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }))
    : form.locator(`[id="${(await issue.getAttribute('href')).slice(1)}"]`)
  await issue.click()
  check(`${info.id}/${arm}: error action focuses its control`, await control.evaluate(el => document.activeElement === el), await control.getAttribute('id'))
}
async function footerProbe(page, form, info, suffix = '') {
  const body = form.locator('.entity-inspector-body'), footer = form.locator('footer'), apply = form.getByRole('button', { name: /^Apply changes/ })
  const before = await footer.boundingBox(), bodyBounds = await body.boundingBox()
  const scrollable = await body.evaluate(el => el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1)
  if (scrollable) {
    await page.mouse.move(bodyBounds.x + bodyBounds.width / 2, bodyBounds.y + bodyBounds.height / 2); await page.mouse.wheel(0, 1800)
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  }
  const after = await footer.boundingBox(), evidence = await hit(apply)
  check(`${info.id}${suffix}: footer stays reachable after body scroll`, evidence.ordinaryHit && Math.abs(before.y - after.y) < 1, { before, after, scrollable, evidence })
  let reached = false
  for (let index = 0; index < 60; index++) { await page.keyboard.press('Tab'); if (await apply.evaluate(el => el === document.activeElement && el.matches(':focus-visible'))) { reached = true; break } }
  const focus = await apply.evaluate(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el), extent = s.outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset)); return { outline: s.outline, shadow: s.boxShadow, extent, fits: r.left - extent >= 0 && r.top - extent >= 0 && r.right + extent <= innerWidth && r.bottom + extent <= innerHeight } })
  check(`${info.id}${suffix}: natural footer keyboard focus visible/unobscured`, reached && focus.fits && (focus.extent > 0 || focus.shadow !== 'none'), focus)
}
async function completeFieldRow(page, form, arm, info, suffix = '') {
  const labelText = arm === 'B' ? 'Survey confidence' : info.kind === 'orbit' ? 'Horizontal radius' : 'Schematic X'
  const control = arm === 'B' ? form.locator('[id="b-inspector-control-custom%3Aconfidence"]') : form.getByRole('spinbutton', { name: labelText, exact: true })
  const handle = await control.evaluateHandle((control, labelText) => {
    const label = control.labels?.[0] || [...document.querySelectorAll('label')].find(node => node.textContent.trim() === labelText)
    let row = label?.parentElement
    while (row && !row.contains(control)) row = row.parentElement
    return row
  }, labelText)
  const row = handle.asElement()
  if (!row) throw new Error(`No actual label/control row for ${labelText}`)
  const canFit = await row.evaluate(row => row.closest('.entity-inspector-body, .b-inspector-body').clientHeight >= row.getBoundingClientRect().height)
  if (canFit) await row.scrollIntoViewIfNeeded()
  const metrics = await row.evaluate(row => {
    const body = row.closest('.entity-inspector-body, .b-inspector-body'), panel = row.closest('.entity-inspector, .b-inspector-card')
    const footer = panel.querySelector('footer'), control = row.querySelector('input,textarea,[role="combobox"]')
    const bounds = row.getBoundingClientRect(), b = body.getBoundingClientRect(), f = footer.getBoundingClientRect()
    const top = Math.max(0, b.top + body.clientTop), bottom = Math.min(innerHeight, b.top + body.clientTop + body.clientHeight, f.top)
    return { row: bounds.toJSON(), label: row.querySelector('label')?.getBoundingClientRect().toJSON(), control: control?.getBoundingClientRect().toJSON(), body: b.toJSON(), bodyClientHeight: body.clientHeight, footer: f.toJSON(), availableTop: top, availableBottom: bottom, text: row.textContent.trim(), complete: body.clientHeight >= bounds.height && bounds.top >= top - .5 && bounds.bottom <= bottom + .5 && bounds.left >= Math.max(0, b.left) - .5 && bounds.right <= Math.min(innerWidth, b.right) + .5 }
  })
  check(`${info.id}/${arm}${suffix}: one complete numeric field row fits while footer is visible`, metrics.complete, { labelText, ...metrics })
  if (!metrics.complete) {
    const file = `${info.id}-${arm}${suffix.replaceAll('/', '-')}-field-row-failure.png`
    await page.screenshot({ path: join(out, file) }); result.screenshots.push({ caseId: info.id, arm, file, failureEvidence: true })
  }
  await handle.dispose()
  return metrics.complete
}

const cases = [
  { id: 'object-desktop-light', kind: 'object', width: 1440, height: 900, palette: 'light' },
  { id: 'orbit-desktop-dark', kind: 'orbit', width: 1440, height: 900, palette: 'dark' },
  { id: 'object-portrait-dark', kind: 'object', width: 390, height: 844, palette: 'dark' },
  { id: 'orbit-short-light', kind: 'orbit', width: 844, height: 390, palette: 'light' },
]
const allCases = [...cases, { id: 'object-reduced-dark', kind: 'object', width: 390, height: 500, palette: 'dark' }]
const requestedCases = process.env.QA_CASES?.split(',').filter(Boolean) || cases.map(info => info.id)
const requestedArms = process.env.QA_ARMS?.split(',').filter(Boolean) || ['root', 'B']
if (requestedCases.some(id => !allCases.some(info => info.id === id)) || requestedArms.some(arm => !['root', 'B'].includes(arm))) throw new Error('Unknown bounded case/arm selection')
const requestedPairs = process.env.QA_CASE_ARMS?.split(',').filter(Boolean)
if (requestedPairs?.some(pair => !requestedCases.some(id => requestedArms.some(arm => pair === `${id}:${arm}`)))) throw new Error('Unknown bounded case/arm pair')
result.requestedCases = requestedCases; result.requestedArms = requestedArms; result.requestedPairs = requestedPairs || null
const browser = await chromium.launch({ channel: 'chrome', headless: true }); result.browser = browser.version()
try {
  for (const info of allCases.filter(info => requestedCases.includes(info.id))) for (const arm of requestedArms) {
    if (requestedPairs && !requestedPairs.includes(`${info.id}:${arm}`)) continue
    const context = await browser.newContext({ viewport: { width: info.width, height: info.height }, colorScheme: info.palette, hasTouch: info.width < 1024, reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage(); page.on('pageerror', error => result.pageerrors.push({ caseId: info.id, arm, message: error.message }))
    const start = result.checks.length
    try {
      const form = arm === 'root' ? await rootSetup(page, info) : await referenceSetup(page, info)
      const rowFits = arm === 'root' || info.width < 1024 ? await completeFieldRow(page, form, arm, info) : true
      if (arm === 'root') await footerProbe(page, form, info)
      if (!rowFits) { result.cases.push({ ...info, arm, completed: false, blockedBy: 'Insufficient visible body for a complete numeric field row' }); continue }
      if (arm === 'root' && process.env.QA_COMPACT_FEEDBACK === '1') {
        const field = info.kind === 'object' ? form.getByLabel('Location key', { exact: true }) : form.getByRole('spinbutton', { name: 'Horizontal radius', exact: true })
        const value = await field.inputValue(), error = await form.getByRole('alert').first().textContent(), original = await field.elementHandle()
        await click(form.getByRole('button', { name: 'Hide inspector', exact: true }))
        await page.getByRole('button', { name: 'Inspect', exact: true }).click()
        await expect(field).toHaveValue(value); await expect(form.getByRole('alert').first()).toHaveText(error)
        check(`${info.id}: Hide/Resume retains invalid draft/error and control identity`, await field.evaluate((el, original) => el === original, original))
        await original.dispose()
      }
      await errorAndDropdown(page, form, arm, info)
      if (arm === 'root') for (const target of [form.getByRole('alert').first().locator('strong'), form.locator('footer').getByRole('status').first()]) {
        await target.scrollIntoViewIfNeeded()
        const sample = await sampleContrast(page, target); result.contrast.push({ caseId: info.id, ...sample }); check(`${info.id}: changed error/status text contrast`, sample.minimum >= 4.5, { minimum: sample.minimum, threshold: 4.5 })
      }
      if (arm === 'root') await form.getByRole('alert').first().getByRole('button').first().click()
      const file = `${info.id}-${arm}.png`; await page.screenshot({ path: join(out, file) })
      result.screenshots.push({ ...info, arm, file, title: await form.locator('h2').first().textContent(), geometry: await form.evaluate(el => ({ bounds: el.getBoundingClientRect().toJSON(), footer: el.querySelector('footer').getBoundingClientRect().toJSON(), activeId: document.activeElement?.id, pageScrollWidth: document.documentElement.scrollWidth, viewport: { width: innerWidth, height: innerHeight } })) })
      if (arm === 'root' && info.id === 'object-portrait-dark') {
        const name = form.getByLabel('Name', { exact: true }), value = await name.inputValue(), error = await form.getByRole('alert').first().textContent()
        await page.setViewportSize({ width: 390, height: 500 }); await footerProbe(page, form, info, '/390x500')
        await completeFieldRow(page, form, arm, info, '/390x500')
        await expect(name).toHaveValue(value); await expect(form.getByRole('alert').first()).toHaveText(error)
      }
      result.cases.push({ ...info, arm, completed: true })
    } catch (error) {
      check(`${info.id}/${arm}: execution`, false, { message: error.message, stack: error.stack }); result.cases.push({ ...info, arm, completed: false })
      await page.screenshot({ path: join(out, `${info.id}-${arm}-failure.png`) }).catch(() => {})
      throw error // Return the first concrete setup/execution blocker; no repeated setup loop.
    } finally {
      const failed = result.checks.slice(start).some(row => !row.passed)
      await context.tracing.stop(failed ? { path: join(out, `${info.id}-${arm}-failure-trace.zip`) } : undefined).catch(() => {})
      await context.close(); await persist()
    }
  }
} finally {
  await browser.close(); result.finished = new Date().toISOString(); result.finalSourceHashes = await hashes()
  check('Released source unchanged', result.finalSourceHashes.every(file => file.expected.toLowerCase() === file.actual))
  result.status = result.checks.some(row => !row.passed) || result.pageerrors.length ? 'failed' : 'scripted-checks-complete-coordinator-visual-inspection-pending'
  await persist()
}
if (result.status === 'failed') process.exitCode = 1
