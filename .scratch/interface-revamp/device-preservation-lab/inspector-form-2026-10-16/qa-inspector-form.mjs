import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'

const qaDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(qaDir, '../../../..')
const runtimeRoot = path.join(repoRoot, '.scratch/interface-revamp/preview-build')
const outputDir = qaDir
const baseUrl = process.env.INSPECTOR_QA_URL ?? 'http://127.0.0.1:3144/'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const expectedCandidateHashes = {
  'components/PrototypeBInspector.vue': '010D58FEDEED2780BEE57223E950B7BDD5D5233C2054DC20E18BAF7FCB24DF3E',
  'components/PrototypeWorkbench.vue': 'B102BD8230E2D4E819D68B0B516DF9A3E39D34751AB8A3D9EA7CA090A6BB7D7D',
  'components/prototype-inspector-fixture.ts': '971DA11D6FE447B4CAF454FEAAB0954BD4CD4644B5A0E7E85D0DEC565CBE3CE5',
}
const changedSourcePaths = Object.keys(expectedCandidateHashes)
const preservedSourcePaths = [
  'components/PrototypeInspector.vue',
  'components/PrototypeFieldDefinitionsDialog.vue',
  'components/FieldDefinitionsDialog.vue',
  'components/field-definitions/FieldDefinitionChangeConfirmation.vue',
  'components/field-definitions/FieldDefinitionEditor.vue',
  'components/field-definitions/FieldDefinitionList.vue',
  'components/field-definitions/FieldDefinitionValues.vue',
  'components/field-definitions/model.ts',
  'domain/workspace-model.ts',
  'domain/workspace.ts',
  'domain/workspace-codec.ts',
  'domain/workspace-fields.ts',
  'domain/workspace-json-import.ts',
  'domain/workspace-schema.ts',
  'utils/workspace-storage.ts',
]
const viewports = {
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  portrait: { width: 390, height: 844, isMobile: true, hasTouch: true },
  landscape: { width: 844, height: 390, isMobile: true, hasTouch: true },
  compact: { width: 390, height: 500, isMobile: true, hasTouch: true },
}
const browserModule = await import(pathToFileURL(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'index.mjs')).href)
const { chromium } = browserModule
const domainJiti = createJiti(import.meta.url)
const domain = await domainJiti.import(path.join(repoRoot, 'domain/workspace.ts'))
const results = []
const jsonDecodes = []
const selectedCases = process.env.INSPECTOR_QA_CASES
  ? new Set(process.env.INSPECTOR_QA_CASES.split(',').map(value => value.trim()).filter(Boolean))
  : null
const activeRuns = new Set()
const browser = await chromium.launch({ headless: true, executablePath: chromePath })

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex').toUpperCase()
}

async function verifySourceManifest() {
  const files = []
  for (const relativePath of [...changedSourcePaths, ...preservedSourcePaths]) {
    const checkoutPath = path.join(repoRoot, relativePath)
    const runtimePath = path.join(runtimeRoot, relativePath)
    const checkoutSha256 = await sha256(checkoutPath)
    const runtimeSha256 = await sha256(runtimePath)
    assert.equal(runtimeSha256, checkoutSha256, `Frozen runtime matches checkout for ${relativePath}`)
    if (relativePath in expectedCandidateHashes) {
      assert.equal(checkoutSha256, expectedCandidateHashes[relativePath], `Frozen source hash for ${relativePath}`)
    }
    files.push({ path: relativePath, role: changedSourcePaths.includes(relativePath) ? 'prototype-source' : 'preservation-boundary', checkoutSha256, runtimeSha256 })
  }
  return { baselineCommit: '8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae', runtimeRoot, files }
}

async function openApp({ viewport = viewports.desktop, dense = true, fieldsDense = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(90000)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const run = { context, page, pageErrors }
  activeRuns.add(run)
  const url = new URL(baseUrl)
  url.searchParams.set('variant', 'B')
  url.searchParams.set('controls', 'dock')
  if (dense) url.searchParams.set('inspectorSample', 'dense')
  if (fieldsDense) url.searchParams.set('fieldsSample', 'dense')
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('.proto-b').waitFor({ state: 'visible', timeout: 90000 })
  await page.locator('.cluster-map-svg, .system-map-svg').first().waitFor({ state: 'visible', timeout: 30000 })
  // The compact B shell closes its server-rendered open inspector during onMounted.
  // Wait for that client state before opening it through the visible map-panel control.
  const panelToggle = page.locator('.b-panel-actions button[aria-controls="b-inspector-panel"]')
  await page.waitForFunction(() => {
    const toggle = document.querySelector('.b-panel-actions button[aria-controls="b-inspector-panel"]')
    if (!toggle) return false
    const compact = window.matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 600px)').matches
    return toggle.getAttribute('aria-expanded') === (compact ? 'false' : 'true')
  }, null, { timeout: 15000 })
  const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await panelToggle.getAttribute('aria-expanded') === 'false') {
    await page.getByRole('button', { name: 'Open Inspect panel', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.b-panel-actions button[aria-controls="b-inspector-panel"]')?.getAttribute('aria-expanded') === 'true')
    await page.waitForTimeout(260)
  }
  await page.locator('#b-inspector-panel .b-inspector-card').waitFor({ state: 'visible' })
  assert.ok(await hideInspector.isVisible(), 'Inspector opens after the compact initial state settles')
  return run
}

async function runCase(name, action) {
  if (selectedCases && !selectedCases.has(name)) return null
  let run
  const startedAt = new Date().toISOString()
  const screenshots = []
  try {
    run = await action()
    assert.deepEqual(run.pageErrors ?? [], [], `Browser errors in ${name}`)
    results.push({ name, status: 'passed', startedAt, screenshots: run.screenshots ?? screenshots, details: run.details ?? {} })
    return run
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const failedRun = run ?? [...activeRuns].at(-1)
    if (failedRun?.page) await capture(failedRun.page, `${slug(name)}-failure`, screenshots).catch(() => {})
    results.push({ name, status: 'failed', startedAt, error: detail, screenshots })
    console.error(`${name}: ${detail}`)
    return null
  } finally {
    const completedRun = run ?? [...activeRuns].at(-1)
    if (completedRun?.context) {
      await completedRun.context.close()
      activeRuns.delete(completedRun)
    }
  }
}

async function capture(page, label, screenshots) {
  const file = path.join(outputDir, `${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  screenshots.push(file)
  return file
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function checkPanelGeometry(page, expectedWidth, expectedHeight) {
  const state = await page.evaluate(() => {
    const card = document.querySelector('#b-inspector-panel .b-inspector-card')
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }
    return {
      card: rect(card),
      header: rect(card?.querySelector('.b-inspector-header')),
      body: rect(card?.querySelector('.b-inspector-body')),
      footer: rect(card?.querySelector('.b-inspector-footer')),
      documentScrollWidth: document.documentElement.scrollWidth,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  assert.ok(state.card && state.card.width > 0, `Inspector has visible geometry: ${JSON.stringify(state)}`)
  assert.ok(state.card.x >= -1 && state.card.right <= expectedWidth + 1, `Inspector fits viewport width: ${JSON.stringify(state)}`)
  assert.ok(state.header && state.footer && state.header.bottom <= state.footer.y, `Header and footer do not overlap: ${JSON.stringify(state)}`)
  assert.ok(state.footer.bottom <= expectedHeight + 1, `Footer remains inside viewport: ${JSON.stringify(state)}`)
  assert.ok(state.documentScrollWidth <= expectedWidth + 1, `No horizontal document overflow: ${JSON.stringify(state)}`)
  return state
}

async function openObjectFromHierarchy(page, systemName = 'Vela Reach', accessibleName = 'Select PL-1, Aster') {
  const compact = await page.evaluate(() => window.matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 600px)').matches)
  if (compact && await page.locator('#b-inspector-panel').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
    await page.locator('#b-inspector-panel').waitFor({ state: 'hidden' })
  }
  const showHierarchy = page.getByRole('button', { name: 'Show map hierarchy', exact: true })
  await showHierarchy.click()
  const systemRow = page.locator('.b-hierarchy-panel .hierarchy-system-row').filter({ hasText: systemName }).first()
  await systemRow.waitFor({ state: 'visible' })
  await systemRow.click()
  await page.locator('.system-map-svg').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy', exact: true }).click()
  await page.getByRole('button', { name: accessibleName, exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-card').waitFor({ state: 'visible' })
}

async function openFields(page) {
  await page.getByRole('button', { name: 'Manage fields', exact: true }).click()
  const fields = page.locator('[data-prototype-fields]')
  await fields.waitFor({ state: 'visible' })
  return fields
}

async function triggerSurveyStatusConflict(page) {
  const selector = page.getByRole('combobox', { name: 'Survey status', exact: true })
  await selector.click()
  await page.getByRole('option', { name: 'Complete', exact: true }).click()
  const fields = await openFields(page)
  const fieldChoice = fields.locator('.fields-choice').filter({ hasText: 'Survey status' }).first()
  await fieldChoice.click()
  await fields.locator('[data-fields-detail]').waitFor({ state: 'visible' })
  await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const options = fields.locator('[data-fields-detail] textarea').first()
  const beforeOptions = (await options.inputValue()).split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  assert.ok(beforeOptions.includes('Needs a second pass'), 'Dense fixture exposes the saved option to review')
  await options.fill(beforeOptions.filter(value => value !== 'Needs a second pass').join('\n'))
  await fields.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  if (await fields.locator('[aria-label="Field change confirmation"]').isVisible().catch(() => false)) {
    await fields.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
  }
  const conflict = fields.locator('.fields-conflict')
  await conflict.waitFor({ state: 'visible' })
  return { fields, conflict, options: beforeOptions }
}

async function exportAndDecode(page, label) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export applied JSON', exact: true }).first().click(),
  ])
  const filePath = path.join(outputDir, `applied-${label}.json`)
  await download.saveAs(filePath)
  const value = JSON.parse(await readFile(filePath, 'utf8'))
  const shell = domain.createLocalWorkspace('Inspector QA Decoder', 'Decoder Shell')
  const decoded = domain.prepareJsonImport(shell, value)
  assert.equal(decoded.summary.type, 'cluster', `Applied ${label} recovery JSON decodes as a Jump Cluster`)
  const report = {
    label,
    file: filePath,
    sha256: await sha256(filePath),
    format: value.format,
    version: value.version,
    type: value.type,
    decodedSummary: decoded.summary,
  }
  jsonDecodes.push(report)
  return { value, decoded, report }
}

await mkdir(outputDir, { recursive: true })
let sourceManifest
try {
  sourceManifest = await verifySourceManifest()
} catch (error) {
  console.error(`Frozen source manifest failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
  await browser.close()
  process.exit()
}

await runCase('desktop-dense-sections-and-full-width-custom-text', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: true })
  const { page } = run
  const panel = page.locator('#b-inspector-panel .b-inspector-card')
  await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Aster, Keeper of the Quiet Meridian and Outer Beacon')
  assert.match(await page.getByRole('textbox', { name: 'Description', exact: true }).inputValue(), /\n\n/)
  await panel.getByRole('heading', { name: 'Catalogue fields', exact: true }).waitFor({ state: 'visible' })
  await panel.getByRole('heading', { name: 'Custom fields', exact: true }).waitFor({ state: 'visible' })
  assert.ok(await panel.getByText('Built-in', { exact: true }).count() >= 2, 'Native values are identified as built-in')
  await panel.getByRole('textbox', { name: 'Landing and weather log', exact: true }).waitFor({ state: 'visible' })
  const heading = await panel.locator('.b-inspector-header .proto-eyebrow').innerText()
  assert.match(heading, /Celestial bodies \/ Planet/i, 'Header uses readable catalogue labels')
  assert.doesNotMatch(heading, /CELESTIALBODY|obj-|PL-1/i, 'Header avoids internal family or identity tokens')
  const rect = async locator => locator.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { x: box.x, right: box.right, width: box.width }
  })
  const widths = {
    name: await rect(page.getByRole('textbox', { name: 'Name', exact: true })),
    description: await rect(page.getByRole('textbox', { name: 'Description', exact: true })),
    customText: await rect(panel.getByRole('textbox', { name: 'Landing and weather log', exact: true })),
  }
  assert.ok(widths.description.width >= widths.name.width * 0.9, `Description remains full width: ${JSON.stringify(widths)}`)
  assert.ok(widths.customText.width >= widths.name.width * 0.9, `Custom multiline text remains full width: ${JSON.stringify(widths)}`)
  assert.ok(widths.customText.x >= widths.name.x - 1 && widths.customText.right <= widths.name.right + 1, `Custom text aligns with the form column: ${JSON.stringify(widths)}`)
  const geometry = await checkPanelGeometry(page, 1440, 900)
  await capture(page, 'qa-desktop-dense-inspector', run._screenshots ??= [])
  run.details = { geometry, widths, headerEyebrow: heading }
  run.screenshots = run._screenshots
  return run
})

await runCase('portrait-hide-theme-resize-and-sticky-actions', async () => {
  const run = await openApp({ viewport: viewports.portrait, dense: true })
  const { page } = run
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await name.fill('QA draft kept through layout changes')
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  await page.locator('#b-inspector-panel').waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Open Inspect panel', exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-card').waitFor({ state: 'visible' })
  await page.waitForTimeout(260)
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'QA draft kept through layout changes')
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  await page.locator('#b-inspector-panel').waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  assert.equal(await page.locator('.proto-b').getAttribute('data-theme'), 'light')
  await page.getByRole('button', { name: 'Open Inspect panel', exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-card').waitFor({ state: 'visible' })
  await page.waitForTimeout(260)
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'QA draft kept through layout changes')
  const portraitGeometry = await checkPanelGeometry(page, 390, 844)
  const shots = []
  await capture(page, 'qa-inspector-portrait', shots)
  await page.setViewportSize({ width: viewports.landscape.width, height: viewports.landscape.height })
  await page.waitForTimeout(260)
  const landscapeGeometry = await checkPanelGeometry(page, 844, 390)
  await capture(page, 'qa-inspector-landscape', shots)
  await page.setViewportSize({ width: viewports.compact.width, height: viewports.compact.height })
  await page.waitForTimeout(260)
  const compactGeometry = await checkPanelGeometry(page, 390, 500)
  await capture(page, 'qa-inspector-compact', shots)
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'QA draft kept through layout changes')
  run.screenshots = shots
  run.details = { portraitGeometry, landscapeGeometry, compactGeometry, draftRetained: true, themeRetained: await page.locator('.proto-b').getAttribute('data-theme') }
  return run
})

await runCase('blank-name-feedback-aria-and-focused-arrows', async () => {
  const run = await openApp({ viewport: viewports.compact, dense: true })
  const { page } = run
  const original = 'Aster, Keeper of the Quiet Meridian and Outer Beacon'
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await name.fill('')
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  const summary = page.locator('#b-inspector-validation-summary')
  await summary.waitFor({ state: 'visible' })
  assert.match(await summary.innerText(), /Object name/i)
  assert.match(await page.locator('#b-inspector-panel .b-inspector-body').innerText(), /name/i)
  const accessibility = await name.evaluate(element => {
    const describedBy = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    return {
      ariaInvalid: element.getAttribute('aria-invalid'),
      describedBy,
      hasDescribedByTargets: describedBy.length > 0 && describedBy.every(id => document.getElementById(id)),
      isLabeled: !!element.labels?.length,
    }
  })
  assert.equal(accessibility.ariaInvalid, 'true', `Invalid control exposes aria-invalid: ${JSON.stringify(accessibility)}`)
  assert.equal(accessibility.hasDescribedByTargets, true, `aria-describedby points to rendered feedback: ${JSON.stringify(accessibility)}`)
  assert.equal(accessibility.isLabeled, true, 'Invalid control retains a programmatic label')
  await page.getByRole('button', { name: 'Review 1 issue', exact: true }).click()
  await page.waitForFunction(() => document.activeElement?.id === 'b-inspector-validation-summary')
  await page.keyboard.press('ArrowRight')
  assert.equal(new URL(page.url()).searchParams.get('variant'), 'B', 'ArrowRight from focused validation feedback does not switch prototype variant')
  await summary.locator('a').first().click()
  assert.equal(await name.evaluate(element => element === document.activeElement), true, 'Validation summary link focuses the affected name control')
  assert.equal(await name.inputValue(), '', 'Invalid Apply keeps the user-entered draft')
  await capture(page, 'qa-invalid-name-feedback', run._screenshots ??= [])
  run.details = { accessibility, summary: await summary.innerText(), arrowKeyStayedOnB: true, draftPreserved: true, original }
  run.screenshots = run._screenshots
  return run
})

await runCase('apply-discard-save-retry-and-dense-applied-json', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: true })
  const { page } = run
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  const appliedName = 'Aster Applied QA Name'
  const dirtyName = 'Aster Dirty Draft Must Not Export'
  await name.fill(appliedName)
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Simulated save error', exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  assert.equal(await page.locator('#b-inspector-panel .b-inspector-header h2').innerText(), appliedName)
  const shots = []
  await capture(page, 'qa-save-error-dense-applied', shots)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(dirtyName)
  const exported = await exportAndDecode(page, 'dense')
  const aster = exported.value.cluster.systems.flatMap(system => system.objects).find(object => object.id === 'obj-vela-planet')
  assert.equal(aster?.name, appliedName, 'Recovery export contains the applied value, not the dirty draft')
  assert.notEqual(aster?.name, dirtyName)
  const importedAster = exported.decoded.workspace.cluster.systems.flatMap(system => system.objects).find(object => object.name === appliedName)
  assert.ok(importedAster, 'Domain import decoder accepts dense values and the applied object name')
  await page.getByRole('button', { name: 'Retry simulated save', exact: true }).click()
  await page.getByRole('heading', { name: 'Prototype save status', exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  assert.match(await page.locator('#b-inspector-save-details').innerText(), /retry succeeded/i)
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), appliedName, 'Discard restores the last applied name')
  await capture(page, 'qa-save-retry-and-discard', shots)
  run.screenshots = shots
  run.details = { appliedName, dirtyName, decodedSummary: exported.report.decodedSummary, retryMessage: await page.locator('#b-inspector-save-details').innerText() }
  return run
})

await runCase('route-system-edit-and-orbit-read-only-gate', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: false })
  const { page } = run
  const routeName = page.getByRole('textbox', { name: 'Route name', exact: true })
  await routeName.waitFor({ state: 'visible' })
  await routeName.fill('QA Route Name')
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-header h2').getByText('QA Route Name').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Select: tap a map item to inspect it', exact: true }).click()
  const systemNode = page.locator('.cluster-system-node[data-system-id="sys-vela"]')
  await systemNode.click()
  const systemName = page.getByRole('textbox', { name: 'Star system name', exact: true })
  await systemName.waitFor({ state: 'visible' })
  await systemName.fill('QA Vela System Name')
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-header h2').getByText('QA Vela System Name').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy', exact: true }).click()
  await page.locator('.b-hierarchy-panel .hierarchy-system-row').filter({ hasText: 'QA Vela System Name' }).click()
  await page.locator('.system-map-svg').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy', exact: true }).click()
  await page.getByRole('button', { name: /Select Orbit 1 around/ }).first().click()
  await page.getByRole('region', { name: 'Read-only inspector' }).waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('button', { name: 'Apply changes', exact: true }).isDisabled(), true, 'Unsupported Orbit edits are disabled')
  assert.match((await page.locator('#b-inspector-panel .b-inspector-card').innerText()).replace(/\s+/g, ' '), /Orbit radii.*not implemented in this focused rendering/i)
  const shots = []
  await capture(page, 'qa-orbit-read-only-gate', shots)
  run.screenshots = shots
  run.details = { routeApplied: 'QA Route Name', systemApplied: 'QA Vela System Name', orbitReadOnly: true, chartFallback: 'not directly selectable through the current visible hierarchy flow; source-reviewed' }
  return run
})

await runCase('fields-conflict-stay-and-resume', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: true })
  const { page } = run
  const selector = page.getByRole('combobox', { name: 'Survey status', exact: true })
  await selector.click()
  await page.getByRole('option', { name: 'Complete', exact: true }).click()
  const fields = await openFields(page)
  const fieldChoice = fields.locator('.fields-choice').filter({ hasText: 'Survey status' }).first()
  await fieldChoice.click()
  await fields.locator('[data-fields-detail]').waitFor({ state: 'visible' })
  await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const options = fields.locator('[data-fields-detail] textarea').first()
  const beforeOptions = (await options.inputValue()).split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  assert.ok(beforeOptions.includes('Needs a second pass'), 'Dense fixture exposes the saved option to review')
  await options.fill(beforeOptions.filter(value => value !== 'Needs a second pass').join('\n'))
  await fields.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  if (await fields.locator('[aria-label="Field change confirmation"]').isVisible().catch(() => false)) {
    await fields.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
  }
  const conflict = fields.locator('.fields-conflict')
  await conflict.waitFor({ state: 'visible' })
  const shots = []
  await capture(page, 'qa-fields-conflict-review', shots)
  assert.ok(await conflict.getByRole('button', { name: 'Apply object draft · review again', exact: true }).isVisible())
  assert.ok(await conflict.getByRole('button', { name: 'Discard object draft · continue', exact: true }).isVisible())
  await conflict.getByRole('button', { name: 'Keep both drafts open', exact: true }).click()
  await conflict.waitFor({ state: 'hidden' })
  assert.equal(await fields.getAttribute('data-draft-state'), 'modified', 'Stay choice retains the field draft')
  await fields.getByRole('button', { name: 'Close Fields', exact: true }).click()
  await fields.waitFor({ state: 'hidden' })
  await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('combobox', { name: 'Survey status', exact: true }).textContent().then(value => value?.includes('Complete')), true, 'Object draft value resumes after closing Fields')
  const resumed = await openFields(page)
  assert.equal(await resumed.getAttribute('data-draft-state'), 'modified', 'Reopening the production Fields manager resumes its pending draft')
  run.screenshots = shots
  run.details = { conflictChoicesVisible: true, stayRetainedDraft: true, fieldsDraftStateAfterResume: await resumed.getAttribute('data-draft-state') }
  return run
})

await runCase('fields-conflict-apply-object-draft-and-renewed-impact', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: false, fieldsDense: true })
  const { page } = run
  await openObjectFromHierarchy(page)
  const fieldSelector = page.getByRole('combobox', { name: 'Survey field 04', exact: true })
  const appliedValue = (await fieldSelector.innerText()).trim()
  await fieldSelector.click()
  const visibleChoices = (await page.getByRole('option').allInnerTexts()).map(value => value.trim())
  const removedValue = visibleChoices.find(value => value.startsWith('Status 04 ·') && value !== appliedValue)
  assert.ok(removedValue, `Visible field choices include an alternate Status 04 value (currently ${appliedValue})`)
  await page.getByRole('option', { name: removedValue, exact: true }).click()
  assert.equal((await fieldSelector.innerText()).trim(), removedValue, 'The visible object field control accepts the alternate value that will be removed')
  assert.equal(await page.getByRole('button', { name: 'Discard changes', exact: true }).isEnabled(), true, 'The alternate value is held as an unsaved object draft')
  const fields = await openFields(page)
  const choice = fields.locator('.fields-choice').filter({ hasText: 'Survey field 04' }).first()
  await choice.click()
  await fields.locator('[data-fields-detail]').waitFor({ state: 'visible' })
  await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const options = fields.locator('[data-fields-detail] textarea').first()
  const originalOptions = (await options.inputValue()).split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  assert.ok(originalOptions.includes('Status 04 · pending') && originalOptions.includes(removedValue), 'Dense Fields fixture provides selectable values for the shared definition')
  await options.fill(originalOptions.filter(value => value !== removedValue).join('\n'))
  await fields.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  const firstConfirmation = fields.locator('[aria-label="Field change confirmation"]')
  await firstConfirmation.waitFor({ state: 'visible' })
  const firstImpact = await firstConfirmation.innerText()
  assert.ok(firstImpact.includes(removedValue), 'Initial impact review lists saved uses of the alternate option to remove')
  assert.ok(!firstImpact.includes('Aster / Vela Reach'), 'The selected Aster value is still only a draft during the initial impact review')
  await fields.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
  const conflict = fields.locator('.fields-conflict')
  await conflict.waitFor({ state: 'visible' })
  await capture(page, 'qa-fields-conflict-apply-choice', run._screenshots ??= [])
  await conflict.getByRole('button', { name: 'Apply object draft · review again', exact: true }).click()
  await conflict.waitFor({ state: 'hidden' })
  assert.equal(await fields.getAttribute('data-draft-state'), 'modified', 'Applying the object draft leaves the definition draft available for renewed review')
  await fields.getByRole('button', { name: 'Close Fields', exact: true }).click()
  await fields.waitFor({ state: 'hidden' })
  assert.equal((await page.getByRole('combobox', { name: 'Survey field 04', exact: true }).innerText()).trim(), removedValue, 'The selected object draft is applied before renewing field review')
  const resumedFields = await openFields(page)
  assert.equal(await resumedFields.getAttribute('data-draft-state'), 'modified', 'Reopening Fields restores the pending definition draft')
  await resumedFields.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  const confirmation = resumedFields.locator('[aria-label="Field change confirmation"]')
  await confirmation.waitFor({ state: 'visible' })
  const impact = await confirmation.innerText()
  assert.ok(impact.includes(`Aster / Vela Reach\n${removedValue}`), 'Renewed impact includes the exact object value applied after the first review')
  await capture(page, 'qa-fields-renewed-impact-after-object-apply', run._screenshots)
  await resumedFields.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
  await confirmation.waitFor({ state: 'hidden' })
  assert.equal(await resumedFields.getAttribute('data-draft-state'), 'clean', 'Confirmed renewed impact commits the field draft')
  await resumedFields.getByRole('button', { name: 'Close Fields', exact: true }).click()
  await resumedFields.waitFor({ state: 'hidden' })
  assert.notEqual((await page.getByRole('combobox', { name: 'Survey field 04', exact: true }).innerText()).trim(), removedValue, 'The confirmed field change clears the newly affected value')
  run.screenshots = run._screenshots
  run.details = { objectDraftApplied: true, fieldDraftReviewedAgain: true, renewedImpact: impact, fieldDraftCommitted: true }
  return run
})

await runCase('fields-conflict-discard-object-draft-guard', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: true })
  const { page } = run
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  const appliedName = await name.inputValue()
  const dirtyName = 'QA object name discarded by Fields guard'
  await name.fill(dirtyName)
  const { fields, conflict } = await triggerSurveyStatusConflict(page)
  await conflict.getByRole('button', { name: 'Discard object draft · continue', exact: true }).click()
  await conflict.waitFor({ state: 'hidden' })
  assert.equal(await fields.getAttribute('data-draft-state'), 'clean', 'Discard choice commits the already-reviewed field edit')
  await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const options = fields.locator('[data-fields-detail] textarea').first()
  assert.ok(!(await options.inputValue()).split(/\r?\n/).map(value => value.trim()).includes('Needs a second pass'), 'Discard choice proceeds with the explicitly reviewed option removal')
  await capture(page, 'qa-fields-discard-guard-result', run._screenshots ??= [])
  assert.equal(await fields.getAttribute('data-draft-state'), 'clean', 'Discarding the object draft does not discard the explicit field edit')
  await fields.getByRole('button', { name: 'Close Fields', exact: true }).click()
  await fields.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), appliedName)
  assert.notEqual(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), dirtyName)
  run.screenshots = run._screenshots
  run.details = { discardedObjectDraft: dirtyName, restoredAppliedName: appliedName, fieldDraftCommitted: true }
  return run
})

await runCase('delete-review-cancel', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: false })
  const { page } = run
  await openObjectFromHierarchy(page)
  const dirtyName = 'QA name survives delete cancellation'
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(dirtyName)
  await page.getByRole('button', { name: /^Delete object…$/i }).click()
  const title = page.getByRole('heading', { name: /^Remove Aster \(Planet, PL-1\)\?$/, exact: true })
  await title.waitFor({ state: 'visible' })
  const effects = page.locator('.b-delete-review-effects')
  const affectedLabels = await effects.innerText()
  assert.match(affectedLabels, /Morrow/)
  assert.match(affectedLabels, /Orbit 1 around Aster/)
  const shots = []
  await capture(page, 'qa-delete-review-cancel', shots)
  await page.getByRole('button', { name: 'Keep it', exact: true }).click()
  await title.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#b-inspector-panel .b-inspector-header h2').innerText(), 'Aster', 'Cancel preserves the selected object')
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), dirtyName, 'Cancel preserves the uncommitted object draft')
  run.screenshots = shots
  run.details = { target: 'Aster', affectedLabels, cancelPreservedSelection: true, dirtyNamePreserved: true }
  return run
})

await runCase('delete-review-escape', async () => {
  const run = await openApp({ viewport: viewports.compact, dense: false })
  const { page } = run
  await openObjectFromHierarchy(page)
  const dirtyName = 'QA name survives Escape cancellation'
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(dirtyName)
  await page.getByRole('button', { name: /^Delete object…$/i }).click()
  const title = page.getByRole('heading', { name: /^Remove Aster \(Planet, PL-1\)\?$/, exact: true })
  await title.waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await title.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#b-inspector-panel .b-inspector-header h2').innerText(), 'Aster', 'Escape cancels without deleting the target')
  assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), dirtyName, 'Escape preserves the uncommitted object draft')
  return run
})

await runCase('delete-confirm-and-ordinary-json-decode', async () => {
  const run = await openApp({ viewport: viewports.desktop, dense: false })
  const { page } = run
  await openObjectFromHierarchy(page)
  await page.getByRole('button', { name: /^Delete object…$/i }).click()
  const effects = page.locator('.b-delete-review-effects')
  await page.getByRole('heading', { name: /^Remove Aster \(Planet, PL-1\)\?$/, exact: true }).waitFor({ state: 'visible' })
  const affectedBeforeConfirm = await effects.innerText()
  assert.match(affectedBeforeConfirm, /Morrow/)
  assert.match(affectedBeforeConfirm, /Orbit 1 around Aster/)
  await page.getByRole('button', { name: 'Delete from sample', exact: true }).click()
  await page.locator('#b-inspector-panel .b-inspector-header h2').getByText('Vela Prime').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy', exact: true }).click()
  const tree = page.locator('.b-hierarchy-panel')
  await tree.getByRole('button', { name: /Select STAR-1, Vela Prime/ }).waitFor({ state: 'visible' })
  assert.equal(await tree.getByRole('button', { name: /Select PL-1, Aster/ }).count(), 0, 'Confirmed target no longer appears in the hierarchy')
  assert.equal(await tree.getByRole('button', { name: /Select MO-1, Morrow/ }).count(), 0, 'Nested dependent no longer appears in the hierarchy')
  await tree.getByRole('button', { name: 'Close map hierarchy', exact: true }).click()
  await page.getByRole('heading', { name: 'Simulated save error', exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  const exported = await exportAndDecode(page, 'ordinary-after-delete')
  const allNames = exported.value.cluster.systems.flatMap(system => system.objects.map(object => object.name))
  assert.ok(allNames.includes('Vela Prime'), 'Unrelated entities remain in the applied recovery JSON')
  assert.ok(allNames.includes('Pilgrim Anchorage'), 'Unrelated installation remains in the applied recovery JSON')
  assert.ok(!allNames.includes('Aster') && !allNames.includes('Morrow'), 'Deleted target and dependent are absent from applied recovery JSON')
  const shots = []
  await capture(page, 'qa-delete-confirmed-result', shots)
  run.screenshots = shots
  run.details = { affectedBeforeConfirm, remainingEntityNames: allNames, ordinaryJson: exported.report }
  return run
})

const report = {
  sourceBaselineCommit: '8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae',
  originMainAtIntake: '629d2a98715c3a16b954e0f77c639b1f0c31212c',
  candidateSourceHashes: expectedCandidateHashes,
  baseUrl,
  runtime: 'Compiled local production build from isolated preview-build; headless Chrome through visible UI locators and keyboard input. page.evaluate is read-only DOM inspection.',
  browser: `Chrome ${browser.version()}`,
  node: process.version,
  viewportLimit: 'Responsive viewport emulation is not physical keyboard, touch, or safe-area hardware acceptance.',
  inputPolicy: 'No app state injection. All edits, selection, dialogs, export, and retry use visible Playwright controls. Downloaded JSON is parsed and passed to the existing prepareJsonImport domain decoder.',
  selectedCases: selectedCases ? [...selectedCases] : 'all cases',
  sourceManifest,
  results,
  jsonDecodes,
}
await writeFile(path.join(outputDir, 'qa-inspector-form.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  output: path.join(outputDir, 'qa-inspector-form.json'),
  resultCount: results.length,
  passed: results.filter(result => result.status === 'passed').map(result => result.name),
  failed: results.filter(result => result.status === 'failed').map(result => ({ name: result.name, error: result.error })),
  jsonDecodes,
}, null, 2))
await browser.close()
if (results.some(result => result.status !== 'passed')) process.exitCode = 1
