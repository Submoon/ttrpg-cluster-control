import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Disposable browser evidence for the B Fields prototype. All application actions below use
// visible Playwright locators or keyboard input. page.evaluate is restricted to DOM reads.
const execFileAsync = promisify(execFile)
const repoRoot = process.cwd()
const runtimeRoot = path.resolve(process.env.FIELDS_RUNTIME_ROOT ?? '.scratch/interface-revamp/preview-build')
const outputDir = path.resolve(process.env.FIELDS_QA_OUTPUT ?? '.scratch/interface-revamp/device-preservation-lab/artifacts/fields-flow-2026-10-15/after')
const baselineCommit = process.env.FIELDS_BASELINE_COMMIT ?? 'c9ba3f3f41eb54c63ba2645e1c06b569ab485157'
const baseUrl = process.env.FIELDS_ROOT_URL ?? 'http://127.0.0.1:3139/?variant=B&controls=dock'
const chromePath = process.env.CHROME_EXECUTABLE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const playwrightPath = pathToFileURL(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'index.mjs')).href
const { chromium } = await import(playwrightPath)
const selectedCaseNames = process.env.FIELDS_CASES ? new Set(process.env.FIELDS_CASES.split(',').map(value => value.trim()).filter(Boolean)) : null

const changedSourcePaths = [
  'components/PrototypeFieldDefinitionsDialog.vue',
  'components/PrototypeWorkbench.vue',
  'components/PrototypeInspector.vue',
  'components/prototype-fields-fixture.ts',
  'pages/index.vue',
]
const unchangedSourcePaths = [
  'components/FieldDefinitionsDialog.vue',
  'components/field-definitions/FieldDefinitionEditor.vue',
  'components/field-definitions/FieldDefinitionList.vue',
  'components/field-definitions/FieldDefinitionValues.vue',
  'components/field-definitions/FieldDefinitionChangeConfirmation.vue',
  'components/field-definitions/model.ts',
  'components/BaselinePage.vue',
  'domain/workspace.ts',
  'domain/workspace-fields.ts',
  'domain/workspace-json-import.ts',
  'domain/workspace-schema.ts',
  'domain/workspace-codec.ts',
]
const viewports = {
  desktop: { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  portrait: { name: 'portrait', width: 390, height: 844, isMobile: true, hasTouch: true },
  landscape: { name: 'short-landscape', width: 844, height: 390, isMobile: true, hasTouch: true },
  short: { name: 'short-portrait', width: 390, height: 500, isMobile: true, hasTouch: true },
}
const results = []
let fixturePath

async function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 })
  return stdout.trim()
}

async function gitBlobHash(relativePath, filePath) {
  return git(['hash-object', `--path=${relativePath}`, filePath])
}

async function captureSources() {
  const candidateHead = await git(['rev-parse', 'HEAD'])
  const branch = await git(['branch', '--show-current'])
  const status = await git(['status', '--short', '--untracked-files=no'])
  const paths = [...new Set([...changedSourcePaths, ...unchangedSourcePaths])]
  const files = []

  for (const relativePath of paths) {
    const checkout = await readFile(path.join(repoRoot, relativePath))
    const runtime = await readFile(path.join(runtimeRoot, relativePath))
    let baselineGitBlobSha1 = null
    try {
      baselineGitBlobSha1 = await git(['rev-parse', `${baselineCommit}:${relativePath}`])
    } catch (error) {
      if (!changedSourcePaths.includes(relativePath)) throw error
    }
    const checkoutGitBlobSha1 = await gitBlobHash(relativePath, path.join(repoRoot, relativePath))
    const runtimeGitBlobSha1 = await gitBlobHash(relativePath, path.join(runtimeRoot, relativePath))
    const file = {
      path: relativePath,
      classification: changedSourcePaths.includes(relativePath) ? 'prototype-source' : 'preservation-boundary',
      baselineGitBlobSha1,
      checkoutGitBlobSha1,
      runtimeGitBlobSha1,
      checkoutSha256: await sha256(checkout),
      runtimeSha256: await sha256(runtime),
    }
    file.existsAtBaseline = baselineGitBlobSha1 !== null
    file.checkoutMatchesRuntime = file.checkoutSha256 === file.runtimeSha256
    file.checkoutMatchesBaseline = file.checkoutGitBlobSha1 === file.baselineGitBlobSha1
    if (file.classification === 'preservation-boundary') {
      assert.equal(file.checkoutMatchesBaseline, true, `Preservation boundary remains byte-identical to baseline: ${relativePath}`)
      assert.equal(file.runtimeGitBlobSha1, file.checkoutGitBlobSha1, `Preservation boundary runtime matches checkout: ${relativePath}`)
    } else {
      assert.equal(file.checkoutMatchesRuntime, true, `Prototype runtime source matches checkout: ${relativePath}`)
    }
    files.push(file)
  }

  return {
    candidateHead,
    candidateLabel: process.env.FIELDS_CANDIDATE_ID ?? 'Frozen working-tree source snapshot (identified by hashes below)',
    branch,
    baselineCommit,
    sourceStatus: status || 'No tracked working-tree changes',
    runtimeRoot,
    files,
  }
}

function urlFor({ fieldsActions = 'header', fieldsSample = 'normal' } = {}) {
  const url = new URL(baseUrl)
  url.searchParams.set('variant', 'B')
  url.searchParams.set('controls', 'dock')
  url.searchParams.set('fieldsActions', fieldsActions)
  url.searchParams.set('fieldsSample', fieldsSample)
  return url.toString()
}

async function readDialog(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-prototype-fields]')
    if (!root) return null
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        x: box.x, y: box.y, right: box.right, bottom: box.bottom,
        width: box.width, height: box.height,
        display: style.display, visibility: style.visibility, overflowY: style.overflowY,
      }
    }
    const visible = element => {
      if (!element) return false
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
    }
    const text = element => element?.textContent?.trim().replace(/\s+/g, ' ') ?? ''
    const style = element => {
      if (!element) return null
      const computed = getComputedStyle(element)
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderColor: computed.borderColor,
        panelBackground: computed.getPropertyValue('--panel-bg').trim(),
        softLine: computed.getPropertyValue('--line-soft').trim(),
        mutedText: computed.getPropertyValue('--text-muted').trim(),
        accentHover: computed.getPropertyValue('--accent-hover').trim(),
      }
    }
    const list = root.querySelector('[data-fields-list]')
    const detail = root.querySelector('[data-fields-detail]')
    const create = root.querySelector('[data-fields-create]')
    const assignments = root.querySelector('[aria-label="Existing field values"]')
    const affected = root.querySelector('[aria-label="Affected values preview"]')
    const active = document.activeElement
    const modal = root.closest('[role="dialog"]') ?? root
    return {
      visible: visible(root),
      screen: root.getAttribute('data-screen'),
      actions: root.getAttribute('data-actions'),
      draftState: root.getAttribute('data-draft-state'),
      reviewOpen: root.getAttribute('data-review-open'),
      title: text(root.querySelector('h1')),
      modalRole: modal.getAttribute('role'),
      modalAriaModal: modal.getAttribute('aria-modal'),
      rootTag: root.tagName,
      rootRect: rect(root),
      rootClass: root.className,
      rootStyle: style(root),
      rootPanelToken: getComputedStyle(root).getPropertyValue('--proto-panel').trim(),
      list: { visible: visible(list), rect: rect(list), scrollTop: list?.scrollTop ?? null, scrollHeight: list?.scrollHeight ?? null, clientHeight: list?.clientHeight ?? null },
      detail: { visible: visible(detail), rect: rect(detail), scrollTop: detail?.scrollTop ?? null, scrollHeight: detail?.scrollHeight ?? null, clientHeight: detail?.clientHeight ?? null },
      create: { visible: visible(create), rect: rect(create), scrollTop: create?.scrollTop ?? null, scrollHeight: create?.scrollHeight ?? null, clientHeight: create?.clientHeight ?? null },
      customChoiceCount: root.querySelectorAll('.prototype-fields-list .fields-list-group:nth-of-type(2) .fields-choice').length,
      definitionChoiceCount: root.querySelectorAll('.prototype-fields-list .fields-choice').length,
      selectedChoice: text(root.querySelector('.prototype-fields-list .fields-choice[aria-pressed="true"]')) || null,
      assignmentCount: assignments?.querySelectorAll('li').length ?? 0,
      assignmentTheme: assignments ? {
        region: style(assignments),
        firstValueColor: style(assignments.querySelector('li strong'))?.color ?? null,
      } : null,
      applicabilityControls: [...root.querySelectorAll('.fields-applicability input, .fields-target-groups input')]
        .filter(visible)
        .map(input => {
          const box = input.getBoundingClientRect()
          const computed = getComputedStyle(input)
          return {
            type: input.type,
            label: text(input.closest('label')),
            checked: input.checked,
            rect: { x: box.x, y: box.y, width: box.width, height: box.height },
            computedWidth: computed.width,
            computedHeight: computed.height,
          }
        }),
      affectedCount: affected?.querySelectorAll('li').length ?? 0,
      status: text(root.querySelector('[data-fields-status]')) || null,
      alerts: [...root.querySelectorAll('[role="alert"]')].filter(visible).map(text),
      activeElement: active instanceof HTMLElement ? {
        tag: active.tagName,
        ariaLabel: active.getAttribute('aria-label'),
        text: text(active).slice(0, 100),
        insideRoot: root.contains(active),
      } : null,
      viewport: { width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight },
    }
  })
}

async function capture(run, label) {
  const state = await readDialog(run.page)
  const file = path.join(outputDir, `${run.slug}-${label}.png`)
  await run.page.screenshot({ path: file, fullPage: false })
  run.evidence.push({ label, screenshot: file, state })
  return state
}

async function openWorkbench(page, viewport, query) {
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(90000)
  const initialUrl = urlFor(query)
  await page.goto(initialUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('.proto-b').waitFor({ state: 'visible', timeout: 60000 })
  await page.locator('.cluster-map-svg, .system-map-svg').first().waitFor({ state: 'visible', timeout: 60000 })
  if (!viewport.isMobile) {
    const hideInspector = page.getByRole('button', { name: /^(Hide Inspect panel|Hide inspector)$/ })
    if (await hideInspector.isVisible().catch(() => false)) await hideInspector.click()
  }
  await page.getByRole('button', { name: 'Open field definitions', exact: true }).waitFor({ state: 'visible' })
}

async function waitForModalSettle(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-prototype-fields]')
    if (!root) return false
    const opacity = Number(getComputedStyle(root).opacity)
    const rect = root.getBoundingClientRect()
    const running = root.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')
    return opacity >= 0.99 && rect.width > 0 && rect.height > 0 && !running
  }, undefined, { timeout: 15000 })
}

async function openFields(page) {
  const trigger = page.getByRole('button', { name: 'Open field definitions', exact: true })
  await trigger.click()
  const root = page.locator('[data-prototype-fields]')
  await root.waitFor({ state: 'visible' })
  await root.locator('h1').filter({ hasText: 'Field definitions' }).waitFor({ state: 'visible' })
  await waitForModalSettle(page)
  return root
}

async function closeFields(page) {
  const root = page.locator('[data-prototype-fields]')
  await root.getByRole('button', { name: 'Close Fields', exact: true }).click()
  await root.waitFor({ state: 'hidden' })
}

async function waitForActiveButton(page, expectedText) {
  await page.waitForFunction(expected => {
    const active = document.activeElement
    if (!(active instanceof HTMLButtonElement)) return false
    const label = active.getAttribute('aria-label')?.trim()
    const text = active.textContent?.trim().replace(/\s+/g, ' ')
    return label === expected || text === expected
  }, expectedText, { timeout: 6000 })
}

async function waitScreen(page, screen) {
  await page.waitForFunction(expected => document.querySelector('[data-prototype-fields]')?.getAttribute('data-screen') === expected, screen)
}

async function customChoices(root) {
  return root.locator('.prototype-fields-list .fields-list-group').nth(1).locator('.fields-choice')
}

async function choiceName(choice) {
  return (await choice.locator(':scope > span').innerText()).replace(/\s+/g, ' ').trim()
}

async function openChoice(page, root, choices, index) {
  const choice = choices.nth(index)
  await choice.scrollIntoViewIfNeeded()
  const text = await choiceName(choice)
  await choice.click()
  await waitScreen(page, 'detail')
  return { choice, text }
}

async function insideViewport(locator, page) {
  const box = await locator.boundingBox()
  assert.ok(box && box.width > 0 && box.height > 0, 'Target has visible geometry')
  const viewport = page.viewportSize()
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
    `Target is within the viewport: ${JSON.stringify({ box, viewport })}`)
  const hit = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return Boolean(top && (top === element || element.contains(top)))
  })
  assert.equal(hit, true, 'Target center receives pointer input')
  return box
}

function assertDialogWithinViewport(state, viewport) {
  const box = state.rootRect
  assert.ok(box && box.width > 0 && box.height > 0, 'The actual modal content has visible geometry')
  assert.equal(state.modalRole, 'dialog', 'The Fields content is the accessible dialog')
  assert.equal(state.modalAriaModal, 'true', 'The Fields dialog exposes its modal boundary')
  assert.ok(box.x >= -1 && box.y >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
    `The dialog envelope fits the viewport: ${JSON.stringify({ box, viewport })}`)
  if (viewport.name === 'desktop') assert.ok(box.width <= 68 * 16 + 2, `Desktop content stays within the 68rem maximum: ${box.width}px`)
}

async function runCase(name, viewport, query, action) {
  if (selectedCaseNames && !selectedCaseNames.has(name)) return
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const run = { page, viewport, query, name, slug: name.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), evidence: [], pageErrors: [], actualInput: [] }
  page.on('pageerror', error => run.pageErrors.push(error.message))

  try {
    await openWorkbench(page, viewport, query)
    await action(run)
    assert.deepEqual(run.pageErrors, [], 'No uncaught browser errors occurred in the case')
    results.push({ name, status: 'passed', viewport, query, actualInput: run.actualInput, pageErrors: run.pageErrors, evidence: run.evidence })
  } catch (error) {
    try {
      const state = await readDialog(page)
      const file = path.join(outputDir, `${run.slug}-failure.png`)
      await page.screenshot({ path: file, fullPage: false })
      run.evidence.push({ label: 'failure-state', screenshot: file, state })
    } catch { /* Keep the original failure if the browser has already closed. */ }
    results.push({ name, status: 'failed', viewport, query, actualInput: run.actualInput, pageErrors: run.pageErrors, error: error instanceof Error ? error.stack : String(error), evidence: run.evidence })
  } finally {
    await context.close()
  }
  const result = results.at(-1)
  console.log(JSON.stringify({ case: result.name, status: result.status, error: result.status === 'failed' ? String(result.error).split('\n')[0] : undefined }))
}

async function chooseFirstObjectForManage(page) {
  await page.getByRole('button', { name: 'Show map hierarchy' }).click()
  const system = page.locator('.b-hierarchy-panel .hierarchy-system-row').first()
  await system.waitFor({ state: 'visible' })
  await system.click()
  await page.locator('.system-map-svg').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy' }).click()
  const object = page.locator('.b-hierarchy-panel .hierarchy-entity-row:has(.hierarchy-key)').first()
  await object.waitFor({ state: 'visible' })
  await object.click()
  await page.locator('.inspector-card').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Manage', exact: true }).waitFor({ state: 'visible' })
}

async function chooseObjectByNames(page, objectName, systemName) {
  await page.getByRole('button', { name: 'Show map hierarchy' }).click()
  const system = page.locator('.b-hierarchy-panel .hierarchy-system-row').filter({ hasText: systemName })
  await system.waitFor({ state: 'visible' })
  await system.click()
  await page.locator('.system-map-svg').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Show map hierarchy' }).click()
  const object = page.locator('.b-hierarchy-panel .hierarchy-entity-row:has(.hierarchy-key)').filter({ hasText: objectName })
  await object.waitFor({ state: 'visible' })
  await object.click()
  await page.locator('.inspector-card').waitFor({ state: 'visible' })
}

async function findChoiceWithAssignments(page, root, kindText) {
  const all = root.locator('.prototype-fields-list .fields-choice')
  const count = await all.count()
  for (let index = 0; index < count; index += 1) {
    const choice = all.nth(index)
    const label = (await choice.innerText()).replace(/\s+/g, ' ').trim()
    if (!label.includes(kindText)) continue
    await choice.scrollIntoViewIfNeeded()
    await choice.click()
    await waitScreen(page, 'detail')
    const values = root.getByRole('region', { name: 'Existing field values' }).locator('li')
    if (await values.count()) return { choice, label, values }
    if (await root.getAttribute('data-screen') !== 'list') {
      const back = root.getByRole('button', { name: 'Back to definitions', exact: true })
      if (await back.isVisible()) { await back.click(); await waitScreen(page, 'list') }
    }
  }
  throw new Error(`No ${kindText} field with saved values is available in this fixture`)
}

function rowText(values) {
  return values.map(value => value.replace(/\s+/g, ' ').trim())
}

async function savedAssignmentRecords(rows) {
  return rows.evaluateAll(items => items.map(row => ({
    objectName: row.children.item(0)?.textContent?.trim() ?? '',
    systemName: row.children.item(1)?.textContent?.trim() ?? '',
    value: row.children.item(2)?.textContent?.trim() ?? '',
  })))
}

async function confirmedImpactRecords(rows) {
  return rows.evaluateAll(items => items.map(row => {
    return {
      objectName: row.children.item(0)?.textContent?.trim() ?? '',
      systemName: row.children.item(1)?.textContent?.trim() ?? '',
      value: row.children.item(2)?.textContent?.trim() ?? '',
    }
  }))
}

function sortedAssignmentKeys(records) {
  return records.map(({ objectName, systemName, value }) => `${objectName}\u0000${systemName}\u0000${value}`).sort()
}

async function waitForCleanDraft(page) {
  await page.waitForFunction(() => document.querySelector('[data-prototype-fields]')?.getAttribute('data-draft-state') === 'clean')
}

const replacement = {
  format: 'ttrpg-cluster-control-map', version: 1, type: 'cluster',
  cluster: {
    id: 'fields-qa-import-cluster', name: 'QA replacement',
    systems: [{ id: 'fields-qa-import-system', name: 'QA system', objects: [{
      id: 'fields-qa-import-star', family: 'CelestialBody', subtype: 'star', locationKey: 'A',
      name: 'Primary Star', description: '', placement: { kind: 'system', x: 0.5, y: 0.5 },
    }], orbits: [] }],
    routes: [],
  },
  objectFieldSettings: {
    atmosphereOptions: ['Thin', 'Breathable', 'Dense', 'Toxic', 'None'],
    portClassOptions: ['A', 'B', 'C', 'D', 'E', 'X'], customFields: [],
  },
  layout: { version: 1, systemPositions: { 'fields-qa-import-system': { x: 0.18, y: 0.35 } }, orbitRadii: {}, orbitRotations: {}, objectAngles: {} },
}

await mkdir(outputDir, { recursive: true })
fixturePath = path.join(outputDir, 'valid-replacement-map.json')
await writeFile(fixturePath, JSON.stringify(replacement, null, 2))
const sourceManifest = await captureSources()
const browser = await chromium.launch({ headless: true, executablePath: chromePath })

try {
  // The actual mobile list/detail transition and command reachability are measured with both
  // command placements. Dense data is asserted from rendered rows, not a UI-only count claim.
  for (const spec of [
    { viewport: viewports.desktop, sample: 'normal', actions: 'header' },
    { viewport: viewports.desktop, sample: 'dense', actions: 'header' },
    { viewport: viewports.portrait, sample: 'dense', actions: 'header' },
    { viewport: viewports.portrait, sample: 'dense', actions: 'footer' },
    { viewport: viewports.landscape, sample: 'dense', actions: 'header' },
    { viewport: viewports.landscape, sample: 'dense', actions: 'footer' },
    { viewport: viewports.short, sample: 'dense', actions: 'footer' },
  ]) {
    await runCase(`layout-${spec.sample}-${spec.viewport.name}-${spec.actions}`, spec.viewport,
      { fieldsSample: spec.sample, fieldsActions: spec.actions }, async run => {
        const root = await openFields(run.page)
        run.actualInput.push('Clicked the visible B Fields toolbar control.')
        assert.equal(await root.getAttribute('data-screen'), 'list', 'First open starts at the definitions list')
        const counts = await root.evaluate(element => ({
          native: element.querySelectorAll('.fields-list-group:first-child .fields-choice').length,
          custom: element.querySelectorAll('.fields-list-group:nth-of-type(2) .fields-choice').length,
          total: element.querySelectorAll('.fields-choice').length,
        }))
        if (spec.sample === 'dense') assert.ok(counts.custom >= 30, `Dense fixture renders at least 30 custom definitions: ${JSON.stringify(counts)}`)
        else assert.ok(counts.total >= 2, `Normal seed renders native/custom definitions: ${JSON.stringify(counts)}`)
        const listState = await capture(run, 'definitions-list')
        assertDialogWithinViewport(listState, spec.viewport)
        if (spec.viewport.name === 'desktop') {
          assert.equal(listState.list.visible, true)
          assert.equal(listState.detail.visible, true, 'Desktop retains simultaneous list and detail')
        }
        const choices = await customChoices(root)
        assert.ok(await choices.count(), 'At least one custom definition is available')
        const selected = await openChoice(run.page, root, choices, (await choices.count()) - 1)
        run.actualInput.push(`Scrolled the real list to its last custom row and selected ${selected.text}.`)
        const detailState = await capture(run, 'last-custom-detail')
        assert.equal(detailState.screen, 'detail')
        assert.match(await root.locator('[data-fields-detail] h2').innerText(), /.+/)
        const edit = root.getByRole('button', { name: 'Edit field definition', exact: true })
        await edit.waitFor({ state: 'visible' })
        const editBox = await insideViewport(edit, run.page)
        detailState.editActionRect = editBox
        assert.equal(await root.getAttribute('data-actions'), spec.actions, 'Query-selected placement is reflected by the rendered dialog')
        run.evidence[run.evidence.length - 1].state = detailState
      })
  }

  await runCase('back-scroll-highlight-focus', viewports.portrait, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    const last = choices.nth((await choices.count()) - 1)
    await last.scrollIntoViewIfNeeded()
    const before = await root.locator('[data-fields-list]').evaluate(element => element.scrollTop)
    const selectedName = await choiceName(last)
    await last.click()
    await waitScreen(run.page, 'detail')
    run.actualInput.push(`Scrolled to and selected ${selectedName}.`)
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    const after = await root.locator('[data-fields-list]').evaluate(element => element.scrollTop)
    const selected = root.locator('.fields-choice[aria-pressed="true"]')
    assert.equal(await selected.count(), 1, 'Back retains the selected definition highlight')
    assert.ok(Math.abs(after - before) <= 2, `Back restores the list position (${before} → ${after})`)
    const active = await run.page.evaluate(() => document.activeElement?.querySelector(':scope > span')?.textContent?.trim().replace(/\s+/g, ' ') ?? '')
    assert.equal(active, selectedName, 'Back returns focus to the selected definition row')
    await capture(run, 'restored-list')
  })

  await runCase('draft-hide-layout-theme-resize-reopen', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const originalName = await root.locator('[data-fields-detail] h2').innerText()
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const nameInput = root.getByRole('textbox', { name: 'Custom field name', exact: true })
    const draftName = `QA retained ${Date.now()}`
    await nameInput.fill(draftName)
    await capture(run, 'dirty-edit-before-hide')
    await closeFields(run.page)
    run.actualInput.push(`Edited ${originalName} through the UI, then closed Fields.`)
    const focus = await run.page.evaluate(() => document.activeElement instanceof HTMLElement
      ? document.activeElement.getAttribute('aria-label') ?? document.activeElement.textContent?.trim()
      : null)
    assert.equal(focus, 'Open field definitions', 'Close restores focus to the actual Fields opener')
    await openFields(run.page)
    assert.equal(await root.getAttribute('data-screen'), 'detail', 'Reopen resumes the last detail screen')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Reopen retains the modified draft')
    assert.equal(await root.getByRole('textbox', { name: 'Custom field name', exact: true }).inputValue(), draftName)
    const beforeTheme = await readDialog(run.page)
    await closeFields(run.page)
    const themeButton = run.page.getByRole('button', { name: /Switch to (light|dark) theme/ })
    await themeButton.click()
    await openFields(run.page)
    const afterTheme = await readDialog(run.page)
    assert.notEqual(afterTheme.rootStyle.backgroundColor, beforeTheme.rootStyle.backgroundColor, 'Teleported Fields content follows the active B theme')
    assert.notEqual(afterTheme.assignmentTheme.region.backgroundColor, beforeTheme.assignmentTheme.region.backgroundColor,
      'The reused saved-values panel follows the active B theme instead of retaining a dark island')
    assert.notEqual(afterTheme.assignmentTheme.firstValueColor, beforeTheme.assignmentTheme.firstValueColor,
      'The reused saved-value text follows the active B theme')
    assert.notEqual(afterTheme.assignmentTheme.region.mutedText, beforeTheme.assignmentTheme.region.mutedText,
      'The reused saved-values panel receives the active muted-text token')
    await run.page.setViewportSize({ width: 390, height: 500 })
    const toggle = root.getByRole('button', { name: /Field action placement:/ })
    await toggle.click()
    run.actualInput.push('Changed action placement with the in-dialog comparison control, changed B theme, and resized to 390×500.')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Theme, action query, and viewport changes preserve the same draft')
    assert.equal(await root.getByRole('textbox', { name: 'Custom field name', exact: true }).inputValue(), draftName)
    assertDialogWithinViewport(await readDialog(run.page), viewports.short)
    await insideViewport(root.getByRole('button', { name: 'Apply field changes', exact: true }), run.page)
    await capture(run, 'retained-after-layout-theme-resize')
    assert.ok(target.label.length > 0)
  })

  await runCase('manage-opener-focus-and-resume', viewports.desktop, { fieldsSample: 'normal' }, async run => {
    const fieldsTrigger = run.page.getByRole('button', { name: 'Open field definitions', exact: true })
    const fieldsRoot = await openFields(run.page)
    await closeFields(run.page)
    await waitForActiveButton(run.page, 'Open field definitions')
    assert.equal(await run.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open field definitions', 'Toolbar close restores focus to its Fields opener')
    await fieldsTrigger.click()
    await fieldsRoot.waitFor({ state: 'visible' })
    await closeFields(run.page)
    await waitForActiveButton(run.page, 'Open field definitions')
    assert.equal(await run.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open field definitions', 'A repeated toolbar open/close cycle restores opener focus again')

    await chooseFirstObjectForManage(run.page)
    const manage = run.page.getByRole('button', { name: 'Manage', exact: true })
    await manage.click()
    const root = run.page.locator('[data-prototype-fields]')
    await root.waitFor({ state: 'visible' })
    await waitScreen(run.page, 'list')
    run.actualInput.push('Opened Fields from the visible object inspector Manage button.')
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await root.getByRole('button', { name: 'Close Fields', exact: true }).click()
      await root.waitFor({ state: 'hidden' })
      await waitForActiveButton(run.page, 'Manage')
      const focus = await run.page.evaluate(() => ({
        label: document.activeElement?.getAttribute('aria-label'),
        text: document.activeElement?.textContent?.trim().replace(/\s+/g, ' '),
      }))
      assert.equal(focus.text || focus.label, 'Manage', `Close restores focus to the actual Manage opener (cycle ${cycle + 1})`)
      await manage.click()
      await root.waitFor({ state: 'visible' })
      assert.equal(await root.getAttribute('data-screen'), 'list', 'Manage reopens the shared Fields session at its last screen')
    }
    await capture(run, 'manage-reopen')
  })

  await runCase('clean-dirty-target-guard-and-apply', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    const oldName = await root.locator('[data-fields-detail] h2').innerText()
    const nextName = await choiceName(choices.nth(1))
    await choices.nth(1).click()
    await waitScreen(run.page, 'detail')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), nextName, 'A clean definition change proceeds without a guard')
    await choices.nth(0).click()
    await waitScreen(run.page, 'detail')
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const draftName = `QA applied ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill(draftName)
    await choices.nth(1).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), oldName, 'A dirty target switch does not change the selected definition early')
    await root.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await waitScreen(run.page, 'detail')
    await run.page.waitForFunction(name => document.querySelector('[data-prototype-fields] [data-fields-detail] h2')?.textContent?.trim() === name, nextName)
    await waitForCleanDraft(run.page)
    assert.ok(await root.locator('.fields-choice').filter({ hasText: draftName }).count(), 'Acknowledged Apply commits the edit before continuing to the requested target')
    run.actualInput.push(`Changed ${oldName}, requested ${nextName}, and chose Apply and continue.`)
    await capture(run, 'apply-acknowledged-then-switch')
  })

  await runCase('dirty-back-preserves-edit-and-guards-owner-or-new', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    const original = await root.locator('[data-fields-detail] h2').innerText()
    const originalId = await choices.nth(0).getAttribute('data-field-id')
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const draftName = `QA Back ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill(draftName)
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await root.getByRole('alertdialog').count(), 0, 'Back to definitions preserves a dirty edit without an owner-switch guard')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Back preserves the unsaved edit draft')
    assert.equal(await root.locator(`.fields-choice[data-field-id="${originalId}"]`).getAttribute('aria-pressed'), 'true', 'Back retains the draft owner selection')
    await capture(run, 'dirty-back-preserved-on-list')

    await root.locator(`.fields-choice[data-field-id="${originalId}"]`).click()
    await waitScreen(run.page, 'detail')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), original, 'Resuming the same owner keeps its committed heading unchanged')
    assert.equal(await root.getByRole('textbox', { name: 'Custom field name', exact: true }).inputValue(), draftName, 'Returning to the same owner resumes the unsaved edit')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Same-owner resume retains the modified marker')
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')

    await choices.nth(1).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'list', 'Changing owners guards before changing the selected definition')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), original, 'The prior detail remains intact behind the owner-switch guard')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'The owner-switch guard retains the draft')
    await root.getByRole('button', { name: 'Stay here', exact: true }).click()
    assert.equal(await root.getAttribute('data-screen'), 'list', 'Stay here keeps the list screen and current owner')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Stay here preserves the unsaved edit')

    await root.getByRole('button', { name: /New custom field/ }).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'list', 'Starting a new field guards before leaving the edit owner')
    await root.getByRole('button', { name: 'Stay here', exact: true }).click()
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Canceling the queued New transition keeps the edit draft')
    run.actualInput.push('Edited a custom field, used Back without losing it, resumed the same owner, then checked owner-switch and New guards with Stay here.')
    await capture(run, 'dirty-owner-and-new-guards')
  })

  await runCase('invalid-apply-does-not-switch', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    const original = await root.locator('[data-fields-detail] h2').innerText()
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill('')
    await choices.nth(1).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    await root.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await root.getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'detail', 'Invalid Apply leaves the source screen active')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), original, 'Invalid Apply does not run the queued target transition')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Invalid Apply preserves the draft')
    run.actualInput.push('Cleared the required name, requested another definition, then tried Apply and continue.')
    await capture(run, 'invalid-apply-preserved')
  })

  await runCase('compact-invalid-apply-remains-reachable-after-back', viewports.portrait, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    const originalId = await choices.nth(0).getAttribute('data-field-id')
    const requestedId = await choices.nth(1).getAttribute('data-field-id')
    const requestedName = await choiceName(choices.nth(1))
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const nameInput = root.getByRole('textbox', { name: 'Custom field name', exact: true })
    await nameInput.fill('')
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Compact Back retains the invalid edit draft')

    await choices.nth(1).scrollIntoViewIfNeeded()
    await choices.nth(1).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'list', 'The list remains active while the requested target is guarded')
    assert.equal(await root.locator(`.fields-choice[data-field-id="${originalId}"]`).getAttribute('aria-pressed'), 'true', 'The requested owner is not selected before Apply is acknowledged')
    await root.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await root.getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'detail', 'Invalid Apply reveals the active owner pane after the guard action')
    assert.equal(await root.locator(`.fields-choice[data-field-id="${originalId}"]`).getAttribute('aria-pressed'), 'true', 'Invalid Apply does not run the queued target transition')
    await nameInput.waitFor({ state: 'visible' })
    await insideViewport(nameInput, run.page)
    assert.equal(await nameInput.inputValue(), '', 'The invalid draft value stays available for correction')

    const correctedName = `QA compact corrected ${Date.now()}`
    await nameInput.fill(correctedName)
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await run.page.waitForFunction(name => document.querySelector('[data-prototype-fields] [data-fields-detail] h2')?.textContent?.trim() === name, requestedName)
    await waitForCleanDraft(run.page)
    assert.equal(await root.locator(`.fields-choice[data-field-id="${requestedId}"]`).getAttribute('aria-pressed'), 'true', 'Corrected valid Apply completes the still-queued target transition')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), requestedName, 'The requested owner opens only after the valid field command')
    run.actualInput.push('On a compact viewport, kept an invalid definition draft through Back and a queued owner switch, corrected it after invalid Apply, then applied and continued.')
    await capture(run, 'compact-corrected-apply-continued')
  })

  await runCase('create-four-types-cancel-and-duplicate', viewports.portrait, { fieldsSample: 'normal' }, async run => {
    const root = await openFields(run.page)
    const count = async () => (await customChoices(root)).count()
    let before = await count()
    await openChoice(run.page, root, await customChoices(root), 0)
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const priorDefinitionName = `QA clean seed ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill(priorDefinitionName)
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await waitForCleanDraft(run.page)
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    for (const [type, suffix] of [['text', 'Text'], ['number', 'Number'], ['boolean', 'Boolean'], ['single-select', 'Choice']]) {
      const createButton = root.getByRole('button', { name: /New custom field/ })
      if (await createButton.isVisible().catch(() => false)) await createButton.click()
      else {
        const add = root.getByRole('button', { name: 'Back to definitions', exact: true })
        if (await add.isVisible()) await add.click()
        await root.getByRole('button', { name: /New custom field/ }).click()
      }
      await waitScreen(run.page, 'create')
      const fieldName = `QA ${suffix} ${Date.now()}`
      await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(fieldName)
      await root.getByRole('combobox', { name: 'Value type', exact: true }).selectOption(type)
      if (type === 'single-select') await root.getByRole('textbox', { name: 'New field choices', exact: true }).fill('North\nSouth')
      assert.equal(await root.getAttribute('data-draft-state'), 'modified', `${type} creation becomes a draft after a clean prior edit`)
      if (type === 'text') {
        await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
        await waitScreen(run.page, 'list')
        assert.equal(await root.getByRole('alertdialog').count(), 0, 'Back to definitions preserves a dirty creation without a transition guard')
        assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Back preserves the dirty creation draft')
        await root.getByRole('button', { name: /New custom field/ }).click()
        await waitScreen(run.page, 'create')
        assert.equal(await root.getByRole('textbox', { name: 'Custom field label', exact: true }).inputValue(), fieldName, 'New resumes the same pending creation draft')
        assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Resumed creation remains modified')
        await closeFields(run.page)
        await openFields(run.page)
        assert.equal(await root.getAttribute('data-screen'), 'create', 'Hide and reopen resumes the creation screen')
        assert.equal(await root.getByRole('textbox', { name: 'Custom field label', exact: true }).inputValue(), fieldName, 'Hide and reopen retains the creation label')
      }
      await root.getByRole('button', { name: 'Create field', exact: true }).click()
      await run.page.waitForFunction(name => document.querySelector('[data-prototype-fields] [data-fields-detail] h2')?.textContent?.trim() === name, fieldName)
      assert.equal(await root.getAttribute('data-draft-state'), 'clean', `${type} creation is acknowledged and no longer a draft`)
      await root.getByText(/Read-only definition/, { exact: false }).waitFor({ state: 'visible' })
      assert.equal(await count(), before + 1, `${type} creation adds one actual custom definition`)
      before += 1
      run.actualInput.push(`Created a ${type} field through the visible form.`)
      await capture(run, `created-${type}`)
    }

    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    const currentCount = await count()
    await root.getByRole('button', { name: /New custom field/ }).click()
    await waitScreen(run.page, 'create')
    await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(`QA canceled ${Date.now()}`)
    await root.getByRole('button', { name: 'Cancel creation', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await count(), currentCount, 'Explicit Cancel abandons creation without adding a field')

    const existing = await choiceName((await customChoices(root)).first())
    await root.getByRole('button', { name: /New custom field/ }).click()
    await waitScreen(run.page, 'create')
    await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(existing)
    const create = root.getByRole('button', { name: 'Create field', exact: true })
    await create.click()
    await root.getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'create', 'Duplicate-name validation keeps the creation form open')
    assert.equal(await count(), currentCount, 'Rejected creation does not add a definition')
    await create.click()
    await root.getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Repeating the same rejected creation keeps the draft active')
    assert.equal(await count(), currentCount, 'The repeated duplicate command still adds no definition')
    const correctedName = `QA corrected duplicate ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(correctedName)
    await create.click()
    await run.page.waitForFunction(name => document.querySelector('[data-prototype-fields] [data-fields-detail] h2')?.textContent?.trim() === name, correctedName)
    await waitForCleanDraft(run.page)
    assert.equal(await count(), currentCount + 1, 'Correcting the repeated validation error allows a later creation to succeed')
    run.actualInput.push('Canceled one creation, submitted the same duplicate-name command twice without changing it, then corrected the name and created successfully.')
    await capture(run, 'creation-cancel-repeated-validation-retry')
  })

  await runCase('save-error-after-ack-does-not-resurrect-draft', viewports.desktop, { fieldsSample: 'normal' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const original = await root.locator('[data-fields-detail] h2').innerText()
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const savedName = `QA acknowledged ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill(savedName)
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await waitForCleanDraft(run.page)
    await run.page.getByText('SIMULATED ERROR', { exact: true }).waitFor({ state: 'visible', timeout: 8000 })
    assert.equal(await root.getAttribute('data-draft-state'), 'clean', 'The field command was acknowledged before the simulated save error')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), savedName, 'The in-memory field rename remains applied')
    assert.equal(await root.getByRole('textbox', { name: 'Custom field name', exact: true }).count(), 0, 'The failed simulated save does not resurrect the acknowledged edit form')
    await closeFields(run.page)
    await openFields(run.page)
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), savedName, 'Reopen retains the applied field definition after save failure')
    assert.equal(await root.getAttribute('data-draft-state'), 'clean', 'Reopen does not recreate a stale draft after save failure')
    run.actualInput.push(`Renamed ${original} through the Fields UI, waited for the memory acknowledgement and simulated save failure, then closed and reopened the dialog.`)
    await capture(run, 'acknowledged-field-after-save-error')
    assert.ok(target.label.length > 0)
  })

  await runCase('creation-apply-continues-to-requested-definition', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    const requested = choices.nth(1)
    const requestedId = await requested.getAttribute('data-field-id')
    const requestedName = await choiceName(requested)
    const initialCount = await choices.count()
    const createdName = `QA queued create ${Date.now()}`

    await root.getByRole('button', { name: /New custom field/ }).click()
    await waitScreen(run.page, 'create')
    await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(createdName)
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'A meaningful creation is a dirty draft before switching targets')
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Back retains the creation before a later target switch')

    await root.locator(`.fields-choice[data-field-id="${requestedId}"]`).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'list', 'The requested definition is not selected before resolving the creation draft')
    await root.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await run.page.waitForFunction(({ requestedName: expectedTarget, createdName: expectedCreated }) => {
      const dialog = document.querySelector('[data-prototype-fields]')
      const heading = dialog?.querySelector('[data-fields-detail] h2')?.textContent?.trim()
      const created = [...(dialog?.querySelectorAll('.fields-choice > span') ?? [])]
        .some(span => span.textContent?.trim() === expectedCreated)
      return dialog?.getAttribute('data-screen') === 'detail' && heading === expectedTarget && created
    }, { requestedName, createdName })
    await waitForCleanDraft(run.page)
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), requestedName, 'The queued definition opens after creation is acknowledged')
    assert.equal(await root.locator(`.fields-choice[data-field-id="${requestedId}"]`).getAttribute('aria-pressed'), 'true', 'The requested definition becomes the selected owner')
    assert.equal(await choices.count(), initialCount + 1, 'Applying the creation draft adds exactly one definition before continuing')
    run.actualInput.push(`Created ${createdName} from a retained creation draft while requesting ${requestedName} as the next definition.`)
    await capture(run, 'creation-applied-before-owner-switch')
  })

  await runCase('custom-option-impact-cancel-confirm', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const name = await root.locator('[data-fields-detail] h2').innerText()
    const beforeAssignments = await savedAssignmentRecords(target.values)
    const usedValue = await target.values.first().locator('strong').innerText()
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const options = root.locator('[data-fields-detail] textarea')
    const oldOptions = (await options.inputValue()).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    assert.ok(oldOptions.includes(usedValue), `Fixture stores a used option for ${name}: ${usedValue}`)
    await options.fill(oldOptions.filter(option => option !== usedValue).join('\n'))
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    const preview = root.getByRole('region', { name: 'Affected values preview' }).locator('li')
    const expected = beforeAssignments.filter(row => row.value === usedValue)
    assert.deepEqual(sortedAssignmentKeys(await confirmedImpactRecords(preview)), sortedAssignmentKeys(expected), 'Impact review names exactly the saved assignments for the removed option')
    await capture(run, 'custom-impact-review')

    const reviewOptions = root.locator('[data-fields-detail] textarea')
    if (await reviewOptions.isEnabled()) {
      await reviewOptions.fill(oldOptions.join('\n'))
      await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
      assert.equal(await root.getAttribute('data-review-open'), 'true', 'Changing the editable draft during review does not acknowledge the stale preview')
      const refreshedForDraft = await confirmedImpactRecords(root.getByRole('region', { name: 'Affected values preview' }).locator('li'))
      assert.equal(refreshedForDraft.length, 0, 'Review refresh reflects the restored option and removes its old impact')
      const unchangedAssignments = await savedAssignmentRecords(root.getByRole('region', { name: 'Existing field values' }).locator('li'))
      assert.deepEqual(unchangedAssignments, beforeAssignments, 'Confirming a stale review after editing the draft does not mutate saved values')
      await capture(run, 'custom-impact-refreshed-after-draft-edit')
      await run.page.keyboard.press('Escape')
      assert.equal(await root.getAttribute('data-review-open'), 'false', 'Escape closes the refreshed review')
      await reviewOptions.fill(oldOptions.filter(option => option !== usedValue).join('\n'))
      await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
      await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    } else {
      assert.equal(await reviewOptions.isEnabled(), false, 'Review locks its draft input while the preview is open')
      await run.page.keyboard.press('Escape')
      await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
      await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    }

    const editedOwnerId = await target.choice.getAttribute('data-field-id')
    await run.page.keyboard.press('Escape')
    assert.equal(await root.getAttribute('data-review-open'), 'false', 'Escape cancels the first destructive review before navigation')
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await root.getByRole('alertdialog').count(), 0, 'Back to definitions does not guard or discard the modified draft')
    assert.equal(await root.getAttribute('data-review-open'), 'false', 'Canceled review stays closed after returning to the list')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Back retains the modified field draft')
    await root.getByRole('button', { name: /New custom field/ }).click()
    await root.getByRole('alertdialog').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'list', 'New is guarded after returning to the list with a modified edit')
    await root.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'detail', 'Apply surfaces the active owner pane while New remains queued')
    assert.equal(await root.getAttribute('data-review-open'), 'true', 'Applying the queued New draft opens its required destructive review')
    assert.equal(await root.getByRole('alertdialog').count(), 0, 'The destructive review remains actionable above the canceled target guard')
    await run.page.keyboard.press('Escape')
    assert.equal(await root.getAttribute('data-review-open'), 'false', 'Canceling review closes the review')
    assert.equal(await root.getByRole('alertdialog').count(), 0, 'Canceling review also clears the queued New transition')
    assert.equal(await root.getAttribute('data-screen'), 'detail', 'Canceled Apply and continue stays with the active definition')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Canceling review preserves the edited field draft')

    await root.locator(`.fields-choice[data-field-id="${editedOwnerId}"]`).click()
    await waitScreen(run.page, 'detail')
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    await run.page.keyboard.press('Escape')
    assert.equal(await root.getAttribute('data-review-open'), 'false', 'First Escape cancels the nested review')
    assert.equal(await root.isVisible(), true, 'Canceling review keeps Fields open')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Canceling review retains the draft')
    const afterCancel = await savedAssignmentRecords(root.getByRole('region', { name: 'Existing field values' }).locator('li'))
    assert.deepEqual(afterCancel, beforeAssignments, 'Canceling review leaves saved values intact')
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
    await waitForCleanDraft(run.page)
    const afterApply = await savedAssignmentRecords(root.getByRole('region', { name: 'Existing field values' }).locator('li'))
    assert.ok(afterApply.every(row => row.value !== usedValue), 'Confirmed option removal clears only the reviewed saved values')
    run.actualInput.push(`Removed used option “${usedValue}” from ${name}; canceled once with Escape, then confirmed its exact named impact.`)
    await capture(run, 'custom-impact-applied')
  })

  await runCase('stale-impact-refreshes-after-real-object-edit', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const fieldName = await root.locator('[data-fields-detail] h2').innerText()
    const beforeAssignments = await savedAssignmentRecords(target.values)
    const affectedRow = await target.values.first().evaluate(row => ({
      objectName: row.children.item(0)?.textContent?.trim() ?? '',
      systemName: row.children.item(1)?.textContent?.trim() ?? '',
      value: row.children.item(2)?.textContent?.trim() ?? '',
    }))
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const options = root.locator('[data-fields-detail] textarea')
    const savedOptions = (await options.inputValue()).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const replacementValue = savedOptions.find(option => option !== affectedRow.value)
    assert.ok(replacementValue, 'The selected object has another valid value to choose through the inspector')
    await options.fill(savedOptions.filter(option => option !== affectedRow.value).join('\n'))
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    const originalPreview = await confirmedImpactRecords(root.getByRole('region', { name: 'Affected values preview' }).locator('li'))
    assert.deepEqual(sortedAssignmentKeys(originalPreview), sortedAssignmentKeys(beforeAssignments.filter(row => row.value === affectedRow.value)), 'The first review matches the current saved assignments')
    await capture(run, 'stale-impact-before-external-edit')
    await closeFields(run.page)

    await chooseObjectByNames(run.page, affectedRow.objectName, affectedRow.systemName)
    const valueSelect = run.page.getByRole('combobox', { name: fieldName, exact: true })
    await valueSelect.click()
    await run.page.getByRole('option', { name: replacementValue, exact: true }).click()
    await run.page.getByRole('button', { name: 'Apply changes', exact: true }).click()
    await run.page.getByRole('button', { name: 'Open field definitions', exact: true }).click()
    await root.waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-review-open'), 'true', 'The pending review survives a Fields hide and reopen')
    await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
    assert.equal(await root.getAttribute('data-review-open'), 'true', 'A changed saved assignment refreshes the review instead of applying it')
    const refreshedPreview = await confirmedImpactRecords(root.getByRole('region', { name: 'Affected values preview' }).locator('li'))
    assert.ok(!refreshedPreview.some(row => row.objectName === affectedRow.objectName && row.systemName === affectedRow.systemName && row.value === affectedRow.value),
      'The refreshed impact no longer claims the object value that was changed through the inspector')
    await capture(run, 'stale-impact-refreshed')
    await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
    await waitForCleanDraft(run.page)
    assert.equal(await root.getAttribute('data-review-open'), 'false', 'A second confirmation applies the refreshed impact')
    run.actualInput.push(`Staged removal of ${affectedRow.value} from ${fieldName}, changed ${affectedRow.objectName} through the actual object inspector while Fields was hidden, then confirmed the refreshed review.`)
    await capture(run, 'stale-impact-confirmed-after-refresh')
  })

  await runCase('native-option-edit-and-impact', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    for (const native of [
      { id: 'native:atmosphere', name: 'Atmosphere' },
      { id: 'native:port-class', name: 'Port class' },
    ]) {
      const row = root.locator(`.fields-choice[data-field-id="${native.id}"]`)
      await row.click()
      await waitScreen(run.page, 'detail')
      const values = root.getByRole('region', { name: 'Existing field values' }).locator('li')
      assert.ok(await values.count(), `The ${native.name} seed has saved values to protect`)
      const beforeAssignments = await savedAssignmentRecords(values)
      const usedValue = await values.first().locator('strong').innerText()
      const fieldName = await root.locator('[data-fields-detail] h2').innerText()
      assert.equal(fieldName, native.name, `The native option editor is exercising ${native.name}`)
      assert.equal(await root.getByRole('textbox', { name: 'Custom field name', exact: true }).count(), 0, `${native.name} identity stays read-only`)
      assert.equal(await root.getByRole('combobox', { name: 'Value type', exact: true }).count(), 0, `${native.name} type stays read-only`)
      const edit = root.getByRole('button', { name: 'Edit field definition', exact: true })
      await edit.waitFor({ state: 'visible' })
      assert.equal(await edit.isEnabled(), true, `${native.name} options remain editable`)
      await edit.click()
      const options = root.locator('[data-fields-detail] textarea')
      const oldOptions = (await options.inputValue()).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      assert.ok(oldOptions.includes(usedValue), `${native.name} options include the saved value ${usedValue}`)
      await options.fill(oldOptions.filter(option => option !== usedValue).join('\n'))
      await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
      await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
      const impacts = await confirmedImpactRecords(root.getByRole('region', { name: 'Affected values preview' }).locator('li'))
      assert.deepEqual(sortedAssignmentKeys(impacts), sortedAssignmentKeys(beforeAssignments.filter(value => value.value === usedValue)), `${native.name} review lists exact assignments affected by option removal`)
      await root.getByRole('button', { name: 'Cancel field changes', exact: true }).click()
      assert.equal(await root.getAttribute('data-draft-state'), 'modified', `Canceled ${native.name} review keeps the edit draft`)
      const preserved = await savedAssignmentRecords(root.getByRole('region', { name: 'Existing field values' }).locator('li'))
      assert.deepEqual(preserved, beforeAssignments, `Canceled ${native.name} review leaves saved values unchanged`)
      await root.getByRole('button', { name: 'Cancel field edits', exact: true }).click()
      assert.equal(await root.getAttribute('data-draft-state'), 'clean', `Cancel edits returns ${native.name} to its saved definition`)
      run.actualInput.push(`Opened ${native.name}, removed one used option through its actual editor, reviewed the exact impact, and canceled both review and draft.`)
      await capture(run, `native-${native.id.replace(':', '-')}-impact-canceled`)
    }
  })

  await runCase('delete-impact-cancel-confirm-and-focus', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const name = await root.locator('[data-fields-detail] h2').innerText()
    const beforeAssignments = await savedAssignmentRecords(target.values)
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    await root.getByRole('button', { name: /Delete field/ }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    const preview = await root.locator('[aria-label="Field change confirmation"] li').evaluateAll(rows => rows.map(row => ({
      label: row.querySelector('span')?.textContent?.trim() ?? '',
      value: row.querySelector('strong')?.textContent?.trim() ?? '',
    })))
    const expectedPreview = beforeAssignments.map(({ objectName, systemName, value }) => ({ label: `${objectName} / ${systemName}`, value }))
    const sortImpact = rows => rows.map(({ label, value }) => `${label}\u0000${value}`).sort()
    assert.deepEqual(sortImpact(preview), sortImpact(expectedPreview), 'Delete confirmation enumerates every named saved value for the selected custom definition')
    await root.getByRole('button', { name: 'Cancel field changes', exact: true }).click()
    assert.equal(await root.getAttribute('data-draft-state'), 'clean', 'Canceled deletion retains the definition and does not create an edit')
    assert.equal(await root.locator('[data-fields-detail] h2').innerText(), name, 'Canceled deletion keeps the selected definition open')
    await root.getByRole('button', { name: /Delete field/ }).click()
    await root.getByRole('button', { name: 'Delete field and clear values', exact: true }).click()
    await waitScreen(run.page, 'list')
    assert.equal(await root.locator('.fields-choice').filter({ hasText: name }).count(), 0, 'Confirmed deletion removes the selected custom definition')
    const selected = root.locator('.fields-choice[aria-pressed="true"]')
    assert.equal(await selected.count(), 1, 'Confirmed deletion selects a valid nearby list row')
    assert.ok(!(await selected.innerText()).includes(name), 'The selected fallback is not the deleted definition')
    assert.equal(await selected.evaluate(element => element === document.activeElement), true, 'Deletion returns focus to its valid nearby list row')
    run.actualInput.push(`Canceled then confirmed deletion of ${name} after reviewing its assignments.`)
    await capture(run, 'delete-returned-to-list')
  })

  await runCase('applicability-narrowing-retains-assignments', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · text')
    const beforeRows = rowText(await target.values.allTextContents())
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    await root.getByLabel('All catalogue objects').check()
    await root.getByLabel('Selected catalogue targets').check()
    const checkbox = root.locator('.fields-target-groups input[type="checkbox"]').first()
    await checkbox.check()
    const controls = (await readDialog(run.page)).applicabilityControls
    assert.ok(controls.some(control => control.type === 'radio' && control.checked), 'The selected applicability mode has a checked radio control')
    assert.ok(controls.some(control => control.type === 'checkbox' && control.checked), 'The selected catalogue target has a checked checkbox')
    assert.ok(controls.every(control => control.rect.width <= 32 && control.rect.height <= 32),
      `Applicability radios and checkboxes retain compact native control geometry: ${JSON.stringify(controls)}`)
    await capture(run, 'applicability-control-geometry')
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await waitForCleanDraft(run.page)
    const afterRows = rowText(await root.getByRole('region', { name: 'Existing field values' }).locator('li').allTextContents())
    assert.deepEqual(afterRows, beforeRows, 'Narrowing applicability keeps every stored assignment visible and intact')
    run.actualInput.push('Narrowed a used custom field to a selected catalogue target through the visible form.')
    await capture(run, 'applicability-values-retained')
  })

  await runCase('object-conflict-invalid-apply-and-renewed-impact', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const target = await findChoiceWithAssignments(run.page, root, 'Custom · single-select')
    const fieldName = await root.locator('[data-fields-detail] h2').innerText()
    const assignments = await target.values.evaluateAll(rows => rows.map(row => ({
      objectName: row.children.item(0)?.textContent?.trim() ?? '',
      systemName: row.children.item(1)?.textContent?.trim() ?? '',
      value: row.children.item(2)?.textContent?.trim() ?? '',
    })))
    const first = assignments[0]
    const conflict = assignments.find(item => item.value !== first.value)
    assert.ok(first && conflict, 'Dense fixture has two saved option values for an end-to-end object conflict')
    await closeFields(run.page)
    await run.page.getByRole('button', { name: 'Show map hierarchy' }).click()
    await run.page.locator('.b-hierarchy-panel .hierarchy-system-row').filter({ hasText: first.systemName }).click()
    await run.page.locator('.system-map-svg').waitFor({ state: 'visible' })
    await run.page.getByRole('button', { name: 'Show map hierarchy' }).click()
    await run.page.locator('.b-hierarchy-panel .hierarchy-entity-row:has(.hierarchy-key)').filter({ hasText: first.objectName }).click()
    await run.page.locator('.inspector-card').waitFor({ state: 'visible' })
    const selector = run.page.getByRole('combobox', { name: fieldName, exact: true })
    await selector.click()
    await run.page.getByRole('option', { name: conflict.value, exact: true }).click()
    await run.page.getByRole('textbox', { name: 'Chart label', exact: true }).fill('')
    await run.page.getByRole('button', { name: 'Manage', exact: true }).click()
    await root.waitFor({ state: 'visible' })
    await waitScreen(run.page, 'detail')
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const options = root.locator('[data-fields-detail] textarea')
    const oldOptions = (await options.inputValue()).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    assert.ok(oldOptions.includes(conflict.value), `Selected saved option remains available for ${fieldName}`)
    await options.fill(oldOptions.filter(option => option !== conflict.value).join('\n'))
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    if (await root.locator('[aria-label="Field change confirmation"]').isVisible().catch(() => false)) {
      await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
    }
    const applyObject = root.getByRole('button', { name: 'Apply object draft · review again', exact: true })
    const keepBoth = root.getByRole('button', { name: 'Keep both drafts open', exact: true })
    await applyObject.waitFor({ state: 'visible' })
    await applyObject.click()
    await root.locator('.fields-conflict').getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await applyObject.isVisible(), true, 'Invalid object Apply keeps the conflict open')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Invalid object Apply preserves the field draft')
    await keepBoth.click()
    await root.locator('.fields-conflict').waitFor({ state: 'hidden' })
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Keep both drafts open retains the field draft')
    await closeFields(run.page)
    const chartLabel = run.page.getByRole('textbox', { name: 'Chart label', exact: true })
    await chartLabel.waitFor({ state: 'visible' })
    assert.equal(await chartLabel.inputValue(), '', 'Keep both drafts open also retains the invalid object draft')
    await chartLabel.fill(first.objectName)
    assert.equal(await chartLabel.inputValue(), first.objectName, 'The object correction is entered through its visible inspector input')
    await run.page.getByRole('button', { name: 'Manage', exact: true }).click()
    await root.waitFor({ state: 'visible' })
    await waitScreen(run.page, 'detail')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Reopening Manage preserves the field draft while the corrected object draft awaits Apply')
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    await root.getByRole('button', { name: 'Remove options and clear affected values', exact: true }).click()
    await applyObject.waitFor({ state: 'visible' })
    await applyObject.click()
    await root.locator('.fields-conflict').waitFor({ state: 'hidden' })
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Applying the corrected object draft preserves the field draft for a fresh review')
    await run.page.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await root.locator('[aria-label="Field change confirmation"]').waitFor({ state: 'visible' })
    const renewed = await confirmedImpactRecords(root.getByRole('region', { name: 'Affected values preview' }).locator('li'))
    assert.ok(renewed.some(row => row.objectName === first.objectName && row.systemName === first.systemName && row.value === conflict.value), 'After object Apply, renewed review includes the newly stored affected value')
    run.actualInput.push(`Changed the selected object’s ${fieldName} value, attempted an invalid object Apply, kept both drafts open once, corrected the object draft, then opened the renewed field impact review.`)
    await capture(run, 'object-conflict-renewed-review')
  })

  await runCase('hidden-draft-blocks-workspace-import', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const cleanName = `QA clean before create ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field name', exact: true }).fill(cleanName)
    await root.getByRole('button', { name: 'Apply field changes', exact: true }).click()
    await waitForCleanDraft(run.page)
    await root.getByRole('button', { name: 'Back to definitions', exact: true }).click()
    await waitScreen(run.page, 'list')
    await root.getByRole('button', { name: /New custom field/ }).click()
    await waitScreen(run.page, 'create')
    const draftName = `QA hidden creation ${Date.now()}`
    await root.getByRole('textbox', { name: 'Custom field label', exact: true }).fill(draftName)
    await root.getByRole('combobox', { name: 'Value type', exact: true }).selectOption('text')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Dirty creation is recognized after a prior clean edit')
    await closeFields(run.page)
    const hideInspector = run.page.getByRole('button', { name: 'Hide inspector', exact: true })
    if (await hideInspector.isVisible().catch(() => false)) {
      await hideInspector.click()
      await run.page.locator('#b-inspector-panel').waitFor({ state: 'hidden' })
    }
    const fileMenu = run.page.locator('.b-files-menu')
    const summary = fileMenu.locator('summary')
    if (await summary.count() && !(await run.page.getByRole('button', { name: /Import map/ }).isVisible().catch(() => false))) await summary.click()
    await run.page.getByRole('button', { name: /Import map/ }).click()
    await run.page.locator('input[type="file"]').setInputFiles(fixturePath)
    await run.page.getByRole('button', { name: 'Use imported sample', exact: true }).waitFor({ state: 'visible' })
    await run.page.getByRole('button', { name: 'Use imported sample', exact: true }).click()
    const error = run.page.getByRole('alert').filter({ hasText: /field|draft|work/i })
    await error.waitFor({ state: 'visible' })
    await root.waitFor({ state: 'visible' })
    assert.equal(await root.getAttribute('data-screen'), 'create', 'Rejected replacement resumes the dirty creation screen')
    assert.equal(await root.getAttribute('data-draft-state'), 'modified', 'Rejected replacement reopens Fields with the hidden draft intact')
    assert.equal(await root.getByRole('textbox', { name: 'Custom field label', exact: true }).inputValue(), draftName, 'Hidden creation remains editable after replacement refusal')
    run.actualInput.push('Applied a clean definition edit, created a modified new-field draft through the visible form, then confirmed a valid replacement while Fields was hidden.')
    await capture(run, 'replacement-refused-and-fields-reopened')
  })

  await runCase('modal-focus-escape-and-add-retention', viewports.portrait, { fieldsSample: 'normal' }, async run => {
    const chooser = run.page.getByRole('button', { name: 'Choose an item to add to the map' })
    await chooser.click()
    await run.page.getByRole('button', { name: /Add Jump Route/ }).click()
    const addStatus = run.page.locator('.b-add-status')
    await addStatus.waitFor({ state: 'visible' })
    const initialStatus = await addStatus.innerText()
    const root = await openFields(run.page)
    await run.page.keyboard.press('Tab')
    const activeInsideModal = await run.page.evaluate(() => {
      const active = document.activeElement
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]')
      return Boolean(active && modal?.contains(active))
    })
    assert.equal(activeInsideModal, true, 'Tab remains within the Fields modal focus boundary')
    await run.page.keyboard.press('Escape')
    await root.waitFor({ state: 'hidden' })
    assert.equal(await addStatus.innerText(), initialStatus, 'Escape closes Fields and retains the active B Add action')
    run.actualInput.push('Started Add Jump Route, opened Fields, used Tab and Escape, and checked the real Add status afterward.')
    await capture(run, 'escape-closed-fields-add-retained')
  })

  await runCase('arrow-keys-stay-in-field-input', viewports.desktop, { fieldsSample: 'dense' }, async run => {
    const root = await openFields(run.page)
    const choices = await customChoices(root)
    await openChoice(run.page, root, choices, 0)
    await root.getByRole('button', { name: 'Edit field definition', exact: true }).click()
    const input = root.getByRole('textbox', { name: 'Custom field name', exact: true })
    await input.fill('Arrow preservation')
    await input.press('End')
    await input.press('ArrowLeft')
    assert.equal(await input.evaluate(element => element.selectionStart), 'Arrow preservation'.length - 1, 'ArrowLeft moves the input caret')
    await input.press('ArrowRight')
    assert.equal(await input.evaluate(element => element.selectionStart), 'Arrow preservation'.length, 'ArrowRight moves the input caret back')
    assert.equal(new URL(run.page.url()).searchParams.get('variant'), 'B', 'Input arrows do not cycle the page variant')
    assert.equal(await input.inputValue(), 'Arrow preservation')
    const detailPane = root.locator('[data-fields-detail]')
    await detailPane.focus()
    assert.equal(await detailPane.evaluate(element => element === document.activeElement), true, 'The actual detail pane has keyboard focus')
    await run.page.keyboard.press('ArrowRight')
    assert.equal(new URL(run.page.url()).searchParams.get('variant'), 'B', 'ArrowRight from the focused Fields pane does not cycle the page variant')
    assert.equal(await input.inputValue(), 'Arrow preservation', 'Pane arrows do not change the saved draft input')
    run.actualInput.push('Focused the visible Fields name input and detail pane, then pressed ArrowLeft/ArrowRight.')
    await capture(run, 'input-arrow-preserved')
  })

  const report = {
    baselineCommit,
    originMain: '629d2a98715c3a16b954e0f77c639b1f0c31212c',
    baseUrl,
    runtime: 'Local Nuxt dev in isolated preview-build; current checkout/runtime source hashes verified before browser launch.',
    browser: `Chrome ${browser.version()} via Playwright`,
    node: process.version,
    inputPolicy: 'Visible UI locators, keyboard input, file-input selection, and viewport changes only. page.evaluate is read-only DOM inspection; no app state is injected or mutated.',
    caseSelection: selectedCaseNames ? [...selectedCaseNames] : 'all cases',
    viewportLimit: 'Viewport resizing does not emulate a physical phone keyboard or safe-area hardware.',
    sourceManifest,
    importFixture: { path: fixturePath, sha256: await sha256(await readFile(fixturePath)) },
    results,
  }
  await writeFile(path.join(outputDir, 'qa-fields-flow.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ outputDir, sourceManifest, resultCount: results.length, failures: results.filter(result => result.status === 'failed').map(result => ({ name: result.name, error: result.error })), report: path.join(outputDir, 'qa-fields-flow.json') }, null, 2))
  if (results.some(result => result.status === 'failed')) process.exitCode = 1
} finally {
  await browser.close()
}
