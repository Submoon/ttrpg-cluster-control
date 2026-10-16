import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const labDir = path.dirname(fileURLToPath(import.meta.url))
const repoDir = path.resolve(labDir, '../../..')
const measurementDir = path.join(repoDir, '.scratch', 'interface-revamp', 'measurement-lab')
const sourceB = path.join(measurementDir, 'source-b')
const artifactsDir = path.join(labDir, 'artifacts')
const fixturePath = path.join(measurementDir, 'fixture.json')
const baseUrl = process.env.LAB_BASE_URL || 'http://127.0.0.1:3125/?variant=B'
const playwrightUrl = pathToFileURL(path.join(sourceB, 'node_modules', 'playwright', 'index.mjs')).href
const { chromium } = await import(playwrightUrl)

await fs.mkdir(artifactsDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = {
  generatedAt: new Date().toISOString(),
  source: {
    baselineCommit: '629d2a98715c3a16b954e0f77c639b1f0c31212c',
    acceptedBCommit: '7ea41e0a9b0e585e23812eb9165e95420d72dc89',
    build: 'accepted B plus the disclosed three Orbit-order lab normalization; source-b-original-output is preserved separately',
    fixture: 'normalized measurement-lab/fixture.json; 3 systems, 4 routes, 13 objects, 6 Orbits',
    endpoint: baseUrl,
  },
  environment: {
    chrome: browser.version(),
    playwright: JSON.parse(await fs.readFile(path.join(sourceB, 'node_modules', 'playwright', 'package.json'), 'utf8')).version,
    node: process.version,
    os: os.type() + ' ' + os.release() + ' ' + os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    physicalDevice: false,
  },
  contexts: [],
  exports: [],
  optionalFlows: [],
}

function shortHash(value) {
  return crypto.createHash('sha256').update(value || '').digest('hex')
}

function fileName(value) {
  return value.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

async function newRun(name, viewport, mobile = false, colorScheme = 'dark') {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme,
    reducedMotion: 'reduce',
    acceptDownloads: true,
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' || /hydration/i.test(message.text())) errors.push({ type: 'console', text: message.text() })
  })
  page.on('pageerror', error => errors.push({ type: 'pageerror', text: error.stack || error.message }))
  page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('.proto-shell.proto-b').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('svg.cluster-map-svg').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(250)
  return { name, context, page, errors, viewport, mobile, colorScheme }
}

async function screenshot(run, name, options = {}) {
  const target = path.join(artifactsDir, fileName(name) + '.png')
  await run.page.screenshot({ path: target, fullPage: false, ...options })
  return path.relative(labDir, target).replaceAll('\\', '/')
}

async function snapshot(run) {
  const result = await run.page.evaluate(async () => {
    const round = value => Math.round(value * 10) / 10
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height), right: round(box.right), bottom: round(box.bottom) }
    }
    const elementPath = element => {
      if (!element) return null
      const parts = []
      for (let node = element; node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5; node = node.parentElement) {
        let part = node.tagName.toLowerCase()
        if (node.id) part += '#' + node.id
        if (typeof node.className === 'string' && node.className.trim()) part += '.' + node.className.trim().replace(/\s+/g, '.')
        parts.push(part)
      }
      return parts.join(' < ')
    }
    const visible = element => {
      if (!element) return false
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const svg = document.querySelector('svg.cluster-map-svg, svg.system-map-svg')
    const panel = document.querySelector('.b-inspector-float')
    const hierarchy = document.querySelector('.b-hierarchy-panel')
    const frame = document.querySelector('.b-map-frame')
    const board = document.querySelector('.b-map-board')
    const shell = document.querySelector('.proto-shell')
    const mapRect = svg?.getBoundingClientRect()
    const ix = Math.max(0, mapRect?.left ?? 0)
    const iy = Math.max(0, mapRect?.top ?? 0)
    const ir = Math.min(innerWidth, mapRect?.right ?? 0)
    const ib = Math.min(innerHeight, mapRect?.bottom ?? 0)
    const visibleBounds = { x: round(ix), y: round(iy), width: round(Math.max(0, ir - ix)), height: round(Math.max(0, ib - iy)) }
    const cols = 12
    const rows = 8
    let insideSvgHits = 0
    let inspectorHits = 0
    const sampled = []
    if (visibleBounds.width > 0 && visibleBounds.height > 0) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = visibleBounds.x + visibleBounds.width * (col + 0.5) / cols
          const y = visibleBounds.y + visibleBounds.height * (row + 0.5) / rows
          const top = document.elementFromPoint(x, y)
          const inSvg = !!top && !!svg?.contains(top)
          const inInspector = !!top && !!panel?.contains(top)
          if (inSvg) insideSvgHits++
          if (inInspector) inspectorHits++
          sampled.push({ x: round(x), y: round(y), hitPath: elementPath(top), insideSvg: inSvg, insideInspector: inInspector })
        }
      }
    }
    const workspace = document.querySelector('.prototype-map-canvas')?.__vueParentComponent?.props?.workspace
    let workspaceJson = null
    let counts = null
    try {
      workspaceJson = workspace ? JSON.stringify(workspace) : null
      counts = workspace ? {
        systems: workspace.cluster?.systems?.length ?? 0,
        routes: workspace.cluster?.routes?.length ?? 0,
        objects: workspace.cluster?.systems?.reduce((sum, system) => sum + system.objects.length, 0) ?? 0,
        orbits: workspace.cluster?.systems?.reduce((sum, system) => sum + system.orbits.length, 0) ?? 0,
      } : null
    } catch {}
    const routes = workspace?.cluster?.routes?.map(route => ({ id: route.id, name: route.name ?? null, jumpLevel: route.jumpLevel })) ?? []
    const objects = workspace?.cluster?.systems?.flatMap(system => system.objects.map(object => ({ systemId: system.id, id: object.id, name: object.name, locationKey: object.locationKey }))) ?? []
    const svgLabels = svg ? [...svg.querySelectorAll('text')].map(element => ({ text: element.textContent?.trim() ?? '', className: element.getAttribute('class'), fill: getComputedStyle(element).fill })).filter(label => label.text).slice(0, 100) : []
    const active = document.activeElement
    const activeRecord = active instanceof HTMLElement ? {
      tag: active.tagName.toLowerCase(),
      id: active.id || null,
      ariaLabel: active.getAttribute('aria-label'),
      role: active.getAttribute('role'),
      text: active.innerText?.trim().slice(0, 100) || null,
      rect: rect(active),
      path: elementPath(active),
      insideInspector: !!panel?.contains(active),
    } : null
    const controls = [...document.querySelectorAll('.b-tool-rail .rail-button, .b-zoom-controls button')].map(button => {
      const box = button.getBoundingClientRect()
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return {
        name: button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText.trim(),
        title: button.getAttribute('title'),
        ariaPressed: button.getAttribute('aria-pressed'),
        ariaExpanded: button.getAttribute('aria-expanded'),
        rect: rect(button),
        centerInViewport: box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        centerHitPath: elementPath(top),
        centerHitIsButton: top === button || button.contains(top),
      }
    })
    let databases = null
    try { databases = (await indexedDB.databases()).map(database => database.name) } catch {}
    let saveState = null
    const saveStatus = document.querySelector('.save-card')
    if (saveStatus) saveState = saveStatus.innerText.trim()
    const selection = document.querySelector('.b-map-footer span')?.innerText.trim() ?? null
    const inspectorInput = document.querySelector('.inspector-form input')
    const routeNameInput = document.querySelector('.inspector-form input')
    const selectionLabel = selection
    const mapContent = document.querySelector('.cluster-map-content, .system-map-content')
    const inspectorActions = document.querySelector('.inspector-actions')
    const modal = document.querySelector('[role="dialog"]')
    const mapCenterTop = svg ? document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, (mapRect.left + mapRect.right) / 2)), Math.min(innerHeight - 1, Math.max(0, (mapRect.top + mapRect.bottom) / 2))) : null
    let storage = { localStorageKeys: [], databases }
    try { storage.localStorageKeys = Object.keys(localStorage) } catch {}
    return {
      viewport: { innerWidth, innerHeight, visualWidth: visualViewport?.width ?? null, visualHeight: visualViewport?.height ?? null, dpr: devicePixelRatio, mobileMedia: matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 600px)').matches, coarsePointer: matchMedia('(pointer: coarse)').matches },
      theme: shell?.getAttribute('data-theme') ?? null,
      context: document.querySelector('.b-map-hud strong')?.innerText.trim() ?? null,
      activeView: svg?.classList.contains('system-map-svg') ? 'system' : svg?.classList.contains('cluster-map-svg') ? 'cluster' : null,
      selection: selectionLabel,
      hierarchyOpen: visible(hierarchy),
      hierarchyRect: rect(hierarchy),
      inspectorOpen: !!panel?.querySelector('.inspector-card'),
      inspectorRect: rect(panel),
      inspectorScroll: panel ? { scrollTop: panel.scrollTop, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, overflowY: getComputedStyle(panel).overflowY } : null,
      inspectorHeadingRect: rect(panel?.querySelector('.inspector-heading')),
      inspectorName: routeNameInput instanceof HTMLInputElement ? routeNameInput.value : inspectorInput instanceof HTMLInputElement ? inspectorInput.value : null,
      inspectorNameLabel: panel?.querySelector('.inspector-form label')?.innerText.trim() ?? null,
      inspectorActionsRect: rect(inspectorActions),
      inspectorActionButtons: [...(inspectorActions?.querySelectorAll('button') ?? [])].map(button => {
        const box = button.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return { name: button.innerText.trim(), disabled: button.disabled, rect: rect(button), centerInViewport: box.top >= 0 && box.bottom <= innerHeight, centerHitPath: elementPath(hit), centerHitIsButton: hit === button || button.contains(hit) }
      }),
      inspectorAlert: panel?.querySelector('[role="alert"]')?.innerText.trim() ?? null,
      mapFrameRect: rect(frame),
      boardRect: rect(board),
      svgRect: rect(svg),
      svgVisible: visible(svg),
      mapCenterHitPath: elementPath(mapCenterTop),
      visibleSvgIntersection: visibleBounds,
      mapHitSample: { cols, rows, samples: sampled.length, insideSvgHits, inspectorHits, accessibleFraction: sampled.length ? insideSvgHits / sampled.length : null, estimatedVisiblePixels: sampled.length ? round(visibleBounds.width * visibleBounds.height * insideSvgHits / sampled.length) : 0, pointSamples: sampled },
      controls,
      mapTransform: mapContent?.getAttribute('transform') ?? null,
      saveState,
      workspaceAvailable: !!workspaceJson,
      workspaceJson,
      workspaceCounts: counts,
      routeValues: routes,
      objects,
      svgLabels,
      activeElement: activeRecord,
      modalText: modal?.innerText.trim() ?? null,
      storage,
    }
  })
  const workspaceJson = result.workspaceJson
  delete result.workspaceJson
  result.workspaceSha256 = workspaceJson ? shortHash(workspaceJson) : null
  return result
}

async function writeJson(name, data) {
  const target = path.join(artifactsDir, name)
  await fs.writeFile(target, JSON.stringify(data, null, 2))
  return path.relative(labDir, target).replaceAll('\\', '/')
}

async function clickAndRecord(run, label, locator, section, options = {}) {
  const before = await snapshot(run)
  const count = await locator.count()
  if (!count) throw new Error('Missing actual UI control for action: ' + label)
  await locator.click()
  if (options.waitForModalHidden) await run.page.locator('.proto-modal-body').waitFor({ state: 'hidden', timeout: 8_000 })
  await run.page.waitForTimeout(100)
  const after = await snapshot(run)
  section.actions.push({ label, locator: locator.toString(), count, before: { context: before.context, activeView: before.activeView, selection: before.selection, hierarchyOpen: before.hierarchyOpen, inspectorOpen: before.inspectorOpen, inspectorName: before.inspectorName }, after: { context: after.context, activeView: after.activeView, selection: after.selection, hierarchyOpen: after.hierarchyOpen, inspectorOpen: after.inspectorOpen, inspectorName: after.inspectorName } })
  return after
}

async function captureDialog(run) {
  return run.page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    return dialog ? { text: dialog.innerText.trim(), buttons: [...dialog.querySelectorAll('button')].map(button => ({ name: button.innerText.trim(), disabled: button.disabled })) } : null
  })
}

function comparableState(state) {
  return {
    context: state.context,
    activeView: state.activeView,
    selection: state.selection,
    theme: state.theme,
    mapTransform: state.mapTransform,
    inspectorOpen: state.inspectorOpen,
    inspectorName: state.inspectorName,
    hierarchyOpen: state.hierarchyOpen,
    workspaceSha256: state.workspaceSha256,
    svgLabels: state.svgLabels,
    saveState: state.saveState,
  }
}

async function captureGeometryAndOpenPaths() {
  const section = { name: 'desktop-to-mobile geometry and panel paths', screenshots: [], actions: [], states: {}, errors: [] }
  const run = await newRun('geometry-reflow', { width: 1440, height: 900 }, false)
  section.context = { viewport: run.viewport, mobileEmulation: false, storage: (await snapshot(run)).storage }
  try {
    section.states.desktopInitial = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-desktop-1440x900-initial'))
    section.states.desktopHierarchyExclusive = await clickAndRecord(run, 'Open Hierarchy from the rail while desktop Inspect is open', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    section.screenshots.push(await screenshot(run, 'b-desktop-hierarchy-exclusive'))
    section.states.desktopHierarchyClosed = await clickAndRecord(run, 'Close Hierarchy from its visible heading control', run.page.getByRole('button', { name: 'Close map hierarchy' }), section)
    await run.page.setViewportSize({ width: 390, height: 844 })
    await run.page.waitForTimeout(300)
    section.states.desktopToPortraitInspectorOpen = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-reflow-390x844-inspector-open'))
    section.states.portraitMapMode = await clickAndRecord(run, 'Hide Inspect to reveal map', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.screenshots.push(await screenshot(run, 'b-390x844-map-mode'))
    section.states.portraitInspectViaDetailTab = await clickAndRecord(run, 'Open Inspect with the map detail tab', run.page.locator('.detail-tab'), section)
    section.screenshots.push(await screenshot(run, 'b-390x844-inspect-via-detail-tab'))
    section.states.portraitInspectHiddenForRail = await clickAndRecord(run, 'Hide Inspect before reaching the rail', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.states.portraitInspectViaDetailsRail = await clickAndRecord(run, 'Open Inspect from the Details rail control', run.page.locator('.b-tool-rail .rail-button[title="Toggle inspector"]'), section)
    section.states.portraitHierarchyHiddenForRail = await clickAndRecord(run, 'Hide Inspect before reaching Hierarchy on the rail', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.states.portraitHierarchyExclusive = await clickAndRecord(run, 'Open Hierarchy from the tool rail', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    section.screenshots.push(await screenshot(run, 'b-390x844-hierarchy-open'))
    const selectedRouteRow = await run.page.locator('.hierarchy-entity-row.route-tree-row[aria-current="true"]').getAttribute('aria-label')
    if (selectedRouteRow) {
      section.states.portraitSameTargetHierarchySelection = await clickAndRecord(run, 'Choose the already selected Jump Route through Hierarchy', run.page.getByRole('button', { name: selectedRouteRow, exact: true }), section)
      section.screenshots.push(await screenshot(run, 'b-390x844-same-target-hierarchy-selection'))
    } else {
      section.actions.push({ label: 'Same-target hierarchy selection', result: 'No aria-current hierarchy route row was exposed.' })
    }
    await run.page.setViewportSize({ width: 844, height: 390 })
    await run.page.waitForTimeout(300)
    section.states.landscapeShortInspectorOpen = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-reflow-844x390-inspector-open'))
    section.states.landscapeShortMapMode = await clickAndRecord(run, 'Hide Inspect at 844 by 390', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.screenshots.push(await screenshot(run, 'b-844x390-map-mode'))
    await run.page.setViewportSize({ width: 1440, height: 900 })
    await run.page.waitForTimeout(300)
    section.states.reflowBackToDesktop = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-reflow-back-to-1440x900'))
    section.states.errors = run.errors
  } catch (error) {
    section.failure = { message: error.message, stack: error.stack }
    section.errors.push(...run.errors)
  } finally {
    await run.context.close()
  }
  return section
}

async function routeRows(page) {
  return page.locator('.hierarchy-entity-row.route-tree-row').evaluateAll(rows => rows.map(row => ({ name: row.getAttribute('aria-label'), current: row.getAttribute('aria-current') === 'true' })))
}

async function clickRouteByName(page, name) {
  const rows = await routeRows(page)
  const index = rows.findIndex(row => row.name === name)
  if (index < 0) throw new Error('The requested Jump Route label is no longer in the visible Hierarchy rows: ' + name)
  await page.locator('.hierarchy-entity-row.route-tree-row').nth(index).click()
}

async function captureDraftGuardsAndScroll() {
  const section = { name: 'fresh mobile context draft guards, hierarchy selection and internal scroll', actions: [], states: {}, screenshots: [], errors: [] }
  const run = await newRun('draft-guards', { width: 390, height: 844 }, true)
  section.context = { viewport: run.viewport, isMobile: true, hasTouch: true, storage: (await snapshot(run)).storage }
  try {
    section.states.mobileInitial = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-fresh-390x844-initial'))
    section.states.openInspect = await clickAndRecord(run, 'Open Inspect from the detail tab', run.page.locator('.detail-tab'), section)
    const routeName = run.page.locator('.inspector-form input').first()
    await routeName.fill('same-target draft persists')
    section.actions.push({ label: 'Edit current Jump Route name', locator: '.inspector-form input (label Route name)', value: 'same-target draft persists', result: (await snapshot(run)).inspectorName })
    await clickAndRecord(run, 'Hide dirty Inspect panel', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.states.hiddenDirtyDraft = await snapshot(run)
    await clickAndRecord(run, 'Reopen same Inspect panel from detail tab', run.page.locator('.detail-tab'), section)
    section.states.sameTargetDraftReopened = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-same-target-draft-reopened'))
    await clickAndRecord(run, 'Open Hierarchy while Inspect is open', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    section.states.hierarchyWhileDirty = await snapshot(run)
    const initialRoutes = await routeRows(run.page)
    const currentRoute = initialRoutes.find(row => row.current)
    const alternateRoute = initialRoutes.find(row => !row.current)
    section.hierarchyRouteRows = initialRoutes
    if (!currentRoute || !alternateRoute) throw new Error('Hierarchy did not expose at least two Jump Route rows.')
    await clickRouteByName(run.page, currentRoute.name)
    section.states.sameTargetHierarchySelection = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-same-target-hierarchy-selection'))
    await clickAndRecord(run, 'Reopen Hierarchy from the tool rail', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    await clickRouteByName(run.page, alternateRoute.name)
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 8_000 })
    section.states.stayGuardOpened = await snapshot(run)
    section.guardButtons = await captureDialog(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-dirty-navigation-guard'))
    await clickAndRecord(run, 'Choose Stay here for a dirty route draft', run.page.getByRole('button', { name: 'Stay here', exact: true }), section, { waitForModalHidden: true })
    section.states.stayChosen = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-stay-keeps-hierarchy-and-selection'))
    await clickAndRecord(run, 'Open Inspect after Stay using Details rail', run.page.locator('.b-tool-rail .rail-button[title="Toggle inspector"]'), section)
    section.states.draftAfterStay = await snapshot(run)
    await clickAndRecord(run, 'Reopen Hierarchy after reading the draft kept by Stay', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    const routeRowsAfterStay = await routeRows(run.page).catch(() => [])
    section.routeRowsAfterStay = routeRowsAfterStay
    const currentAfterStay = routeRowsAfterStay.find(row => row.current)
    const alternateAfterStay = routeRowsAfterStay.find(row => !row.current)
    if (!currentAfterStay || !alternateAfterStay) throw new Error('Hierarchy route rows were not available after Stay.')
    await clickRouteByName(run.page, alternateAfterStay.name)
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 8_000 })
    section.states.discardGuardOpened = await snapshot(run)
    await clickAndRecord(run, 'Choose Discard and continue', run.page.getByRole('button', { name: 'Discard and continue', exact: true }), section, { waitForModalHidden: true })
    section.states.discardResult = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-discard-result'))
    const selectedRouteInput = run.page.locator('.inspector-form input').first()
    await selectedRouteInput.fill('route applied before navigation')
    section.actions.push({ label: 'Edit newly selected route before Apply', value: 'route applied before navigation', result: (await snapshot(run)).inspectorName })
    await clickAndRecord(run, 'Reopen Hierarchy before Apply', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    const currentBeforeApply = (await routeRows(run.page)).find(row => row.current)
    const applyTarget = (await routeRows(run.page)).find(row => !row.current)
    section.routeRowsBeforeApply = await routeRows(run.page)
    if (!currentBeforeApply || !applyTarget) throw new Error('No alternate route was available for Apply guard.')
    await clickRouteByName(run.page, applyTarget.name)
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 8_000 })
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 8_000 })
    section.applyGuardTarget = applyTarget
    section.states.applyGuardOpened = await snapshot(run)
    await clickAndRecord(run, 'Choose Apply and continue', run.page.getByRole('button', { name: 'Apply and continue', exact: true }), section, { waitForModalHidden: true })
    section.states.applyResult = await snapshot(run)
    section.appliedRouteNameFoundInWorkspace = section.states.applyResult.routeValues.some(route => route.name === 'route applied before navigation')
    section.screenshots.push(await screenshot(run, 'b-mobile-apply-result'))

    await clickAndRecord(run, 'Open Hierarchy to navigate to Vela', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    const velaRow = run.page.locator('.hierarchy-system-row').filter({ hasText: 'Vela' }).first()
    await clickAndRecord(run, 'Open Vela from the Hierarchy system list', velaRow, section)
    section.states.velaOpenedFromHierarchy = await snapshot(run)
    await clickAndRecord(run, 'Open Hierarchy in Vela to choose Aster', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    section.hierarchyVelaTargets = await run.page.locator('.hierarchy-entity-row:not(.route-tree-row)').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')))
    const aster = run.page.getByRole('button', { name: 'Select PL-1, Aster', exact: true })
    await clickAndRecord(run, 'Select Aster through its actual Hierarchy row', aster, section)
    section.states.asterInspector = await snapshot(run)
    section.screenshots.push(await screenshot(run, 'b-mobile-aster-inspector-top'))
    const beforeInvalid = await snapshot(run)
    await run.page.locator('.inspector-form input').first().fill('')
    await run.page.getByRole('button', { name: 'Apply changes', exact: true }).click()
    await run.page.waitForTimeout(100)
    section.states.invalidApply = await snapshot(run)
    section.invalidApplyPreservedSelection = beforeInvalid.selection === section.states.invalidApply.selection
    section.invalidApplyPreservedWorkspace = beforeInvalid.workspaceSha256 !== null && beforeInvalid.workspaceSha256 === section.states.invalidApply.workspaceSha256
    section.invalidApplyKeptBlankDraft = section.states.invalidApply.inspectorName === ''
    section.invalidApplyPreservedSvgLabels = JSON.stringify(beforeInvalid.svgLabels) === JSON.stringify(section.states.invalidApply.svgLabels)
    section.actions.push({ label: 'Apply an empty Aster name', locator: 'Apply changes', priorSelection: beforeInvalid.selection, priorWorkspaceSha256: beforeInvalid.workspaceSha256, priorSvgLabels: beforeInvalid.svgLabels, result: { alert: section.states.invalidApply.inspectorAlert, selection: section.states.invalidApply.selection, workspaceSha256: section.states.invalidApply.workspaceSha256, draftName: section.states.invalidApply.inspectorName, svgLabels: section.states.invalidApply.svgLabels }, selectionUnchanged: section.invalidApplyPreservedSelection, workspaceComparisonAvailable: beforeInvalid.workspaceSha256 !== null, mapLabelsUnchanged: section.invalidApplyPreservedSvgLabels })
    section.screenshots.push(await screenshot(run, 'b-mobile-invalid-apply-preserves-object'))
    await run.page.locator('.inspector-form input').first().fill('Aster scroll and footer check')
    const panel = run.page.locator('.b-inspector-float')
    const panelBeforeScroll = await panel.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
    const panelBox = await panel.boundingBox()
    await run.page.mouse.move(panelBox.x + Math.min(panelBox.width - 8, 180), panelBox.y + Math.min(panelBox.height - 8, 260))
    await run.page.mouse.wheel(0, 1600)
    await run.page.waitForTimeout(100)
    let panelAfterWheel = await panel.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
    if (panelAfterWheel.scrollTop === panelBeforeScroll.scrollTop && panelAfterWheel.scrollHeight > panelAfterWheel.clientHeight) {
      await panel.evaluate(element => { element.scrollTop = element.scrollHeight })
      panelAfterWheel = await panel.evaluate(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
      section.scrollFallback = 'mouse wheel did not move the internal panel; set scrollTop was used to verify the internal scroll range and click target'
    }
    section.internalScroll = { before: panelBeforeScroll, after: panelAfterWheel, actions: await snapshot(run) }
    section.screenshots.push(await screenshot(run, 'b-mobile-aster-inspector-scrolled-to-actions'))
    const actionButton = run.page.getByRole('button', { name: 'Apply changes', exact: true })
    section.reachableApplyButton = await actionButton.evaluate(button => {
      const box = button.getBoundingClientRect()
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      const hit = document.elementFromPoint(x, y)
      return { rect: { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom }, enabled: !button.disabled, inViewport: box.top >= 0 && box.bottom <= innerHeight, centerHitButton: hit === button || button.contains(hit), centerHit: hit?.tagName.toLowerCase() + (typeof hit?.className === 'string' && hit.className ? '.' + hit.className.trim().replace(/\s+/g, '.') : '') }
    })
    const beforeFooterApply = await snapshot(run)
    await actionButton.click()
    await run.page.waitForTimeout(250)
    section.states.scrollFooterApply = await snapshot(run)
    section.footerApplyComparison = { priorSelection: beforeFooterApply.selection, afterSelection: section.states.scrollFooterApply.selection, priorSvgLabels: beforeFooterApply.svgLabels, afterSvgLabels: section.states.scrollFooterApply.svgLabels, mapLabelsChanged: JSON.stringify(beforeFooterApply.svgLabels) !== JSON.stringify(section.states.scrollFooterApply.svgLabels), inputAfterApply: section.states.scrollFooterApply.inspectorName, alert: section.states.scrollFooterApply.inspectorAlert, workspaceComparisonAvailable: beforeFooterApply.workspaceSha256 !== null, saveState: section.states.scrollFooterApply.saveState }
    section.actions.push({ label: 'Apply valid Aster edit after internal panel scroll', result: section.states.scrollFooterApply.inspectorName, alert: section.states.scrollFooterApply.inspectorAlert, saveState: section.states.scrollFooterApply.saveState, mapLabelsChanged: section.footerApplyComparison.mapLabelsChanged })
    section.screenshots.push(await screenshot(run, 'b-mobile-aster-after-scroll-footer-apply'))
    await clickAndRecord(run, 'Hide Inspect after valid Aster Apply', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    await clickAndRecord(run, 'Open Hierarchy to verify applied Aster label', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), section)
    section.hierarchyTargetsAfterApply = await run.page.locator('.hierarchy-entity-row:not(.route-tree-row)').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')))
    const renamedAsterRow = section.hierarchyTargetsAfterApply.find(label => label?.includes('PL-1') && label.includes('Aster scroll and footer check'))
    section.appliedNameAppearsInHierarchy = !!renamedAsterRow
    if (renamedAsterRow) {
      await clickAndRecord(run, 'Reopen applied Aster from its updated Hierarchy row', run.page.getByRole('button', { name: renamedAsterRow, exact: true }), section)
      section.states.reopenedAppliedObject = await snapshot(run)
      section.appliedNamePersistsAfterReopen = section.states.reopenedAppliedObject.inspectorName === 'Aster scroll and footer check'
      section.screenshots.push(await screenshot(run, 'b-mobile-aster-reopened-after-apply'))
    }
    section.errors = run.errors
  } catch (error) {
    section.failure = { message: error.message, stack: error.stack }
    section.errors.push(...run.errors)
    section.lastState = await snapshot(run).catch(() => null)
    section.screenshots.push(await screenshot(run, 'b-mobile-draft-guards-failure').catch(() => ''))
  } finally {
    await run.context.close()
  }
  return section
}

async function captureShortViewport() {
  const section = { name: 'fresh short landscape viewport geometry', screenshots: [], actions: [], errors: [] }
  const run = await newRun('short-landscape', { width: 844, height: 390 }, true)
  section.context = { viewport: run.viewport, isMobile: true, hasTouch: true, storage: (await snapshot(run)).storage }
  try {
    section.states = { initial: await snapshot(run) }
    section.screenshots.push(await screenshot(run, 'b-mobile-fresh-844x390-initial'))
    section.states.inspectorViaDetailTab = await clickAndRecord(run, 'Open Inspect at 844 by 390 via detail tab', run.page.locator('.detail-tab'), section)
    section.screenshots.push(await screenshot(run, 'b-mobile-844x390-inspect-open'))
    section.states.hideAndMap = await clickAndRecord(run, 'Hide Inspect at 844 by 390', run.page.getByRole('button', { name: 'Hide inspector' }), section)
    section.screenshots.push(await screenshot(run, 'b-mobile-844x390-map-visible'))
    section.errors = run.errors
  } catch (error) {
    section.failure = { message: error.message, stack: error.stack }
    section.errors.push(...run.errors)
  } finally {
    await run.context.close()
  }
  return section
}

async function previewImage(run, imageBytes, mime, name) {
  const preview = await run.context.newPage()
  const data = Buffer.from(imageBytes).toString('base64')
  const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#d7d7d7}body{display:grid;place-items:center}img{max-width:98vw;max-height:98vh;object-fit:contain;background:#fff}</style><img src="data:' + mime + ';base64,' + data + '">'
  await preview.setContent(html)
  await preview.locator('img').evaluate(image => image.decode())
  const target = path.join(artifactsDir, fileName(name) + '.png')
  await preview.screenshot({ path: target })
  await preview.close()
  return path.relative(labDir, target).replaceAll('\\', '/')
}

async function summarizeSvg(run, svgText) {
  return run.page.evaluate(text => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const title = doc.querySelector('.system-map-export-title')
    const bg = doc.querySelector('.map-background, .cluster-map-background')
    const name = doc.querySelector('.object-name, .cluster-system-name')
    const selected = [...doc.querySelectorAll('[class*="selected"], [class*="active"]')].map(element => ({ className: element.getAttribute('class'), style: element.getAttribute('style') })).slice(0, 30)
    const parseColor = value => {
      if (!value) return null
      const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      if (hex) {
        const expanded = hex[1].length === 3 ? [...hex[1]].map(char => char + char).join('') : hex[1]
        return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16))
      }
      const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
      return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
    }
    const luminance = value => {
      const rgb = parseColor(value)
      if (!rgb) return null
      const channels = rgb.map(channel => { const normalized = channel / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4 })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const titleFill = title ? (title.style.fill || title.getAttribute('fill')) : null
    const backgroundFill = bg ? (bg.style.fill || bg.getAttribute('fill')) : null
    const titleLuminance = luminance(titleFill)
    const backgroundLuminance = luminance(backgroundFill)
    return {
      parseError: !!doc.querySelector('parsererror'),
      viewBox: doc.documentElement.getAttribute('viewBox'),
      title: title ? { text: title.textContent, style: title.getAttribute('style'), fill: titleFill } : null,
      firstBackground: bg ? { className: bg.getAttribute('class'), style: bg.getAttribute('style'), fill: backgroundFill } : null,
      titleBackgroundContrastRatio: titleLuminance !== null && backgroundLuminance !== null ? (Math.max(titleLuminance, backgroundLuminance) + 0.05) / (Math.min(titleLuminance, backgroundLuminance) + 0.05) : null,
      firstMapName: name ? { text: name.textContent, className: name.getAttribute('class'), style: name.getAttribute('style'), fill: name.style.fill } : null,
      selectedOrActiveClassSamples: selected,
      editHandles: doc.querySelectorAll('.orbit-edit-control').length,
      hasPrintLightBackground: !![...doc.querySelectorAll('[style]')].find(element => (element.style.fill || element.style.backgroundColor) === 'rgb(251, 248, 239)' || (element.style.fill || element.style.backgroundColor) === '#fbf8ef'),
    }
  }, svgText)
}

async function exportOne(run, viewName, theme, format, marker, section) {
  const before = await snapshot(run)
  const trigger = format === 'svg'
    ? run.page.getByRole('button', { name: 'SVG', exact: true })
    : run.page.locator('.b-tool-rail .rail-button[title="Export map image"]')
  const downloadPromise = run.page.waitForEvent('download', { timeout: 30_000 })
  await trigger.click()
  const download = await downloadPromise
  const target = path.join(artifactsDir, fileName(viewName + '-' + theme + '-dirty-draft.' + format))
  await download.saveAs(target)
  const bytes = await fs.readFile(target)
  const after = await snapshot(run)
  const record = {
    view: viewName,
    activeTheme: theme,
    format,
    suggestedFilename: download.suggestedFilename(),
    artifact: path.relative(labDir, target).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: shortHash(bytes),
    dirtyDraftMarker: marker,
    markerIncludedInExport: bytes.toString(format === 'svg' ? 'utf8' : 'base64').includes(marker),
    before: comparableState(before),
    after: comparableState(after),
    workspaceUnchanged: before.workspaceSha256 !== null ? before.workspaceSha256 === after.workspaceSha256 : null,
    workspaceComparisonAvailable: before.workspaceSha256 !== null && after.workspaceSha256 !== null,
    svgLabelsUnchanged: JSON.stringify(before.svgLabels) === JSON.stringify(after.svgLabels),
    selectionUnchanged: before.selection === after.selection,
    contextUnchanged: before.context === after.context,
    mapTransformUnchanged: before.mapTransform === after.mapTransform,
    inspectorDraftUnchanged: before.inspectorName === after.inspectorName,
    themeUnchanged: before.theme === after.theme,
    svgDetails: null,
    previewScreenshot: null,
  }
  if (format === 'svg') {
    const text = bytes.toString('utf8')
    record.svgDetails = await summarizeSvg(run, text)
    record.previewScreenshot = await previewImage(run, bytes, 'image/svg+xml', viewName + '-' + theme + '-svg-export-preview')
  } else {
    record.pngSignature = bytes.subarray(0, 8).toString('hex')
    record.pngDimensions = bytes.length >= 24 ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null
    record.previewScreenshot = await previewImage(run, bytes, 'image/png', viewName + '-' + theme + '-png-export-preview')
  }
  section.exports.push(record)
  return record
}

async function ensureTheme(run, targetTheme) {
  let state = await snapshot(run)
  if (state.theme !== targetTheme) {
    await run.page.getByRole('button', { name: /Theme/ }).click()
    await run.page.waitForFunction(theme => document.querySelector('.proto-shell')?.getAttribute('data-theme') === theme, targetTheme)
    state = await snapshot(run)
  }
  return state
}

async function captureExports() {
  const section = { name: 'cluster and system exports with unapplied drafts in both active themes', exports: [], errors: [], actions: [] }
  let run = await newRun('exports-cluster', { width: 1440, height: 900 }, false)
  section.contexts = []
  try {
    section.contexts.push({ view: 'cluster', storage: (await snapshot(run)).storage, fixture: (await snapshot(run)).workspaceCounts })
    for (const theme of ['dark', 'light']) {
      await ensureTheme(run, theme)
      const marker = 'cluster-draft-not-exported-' + theme
      await run.page.locator('.inspector-form input').first().fill(marker)
      const before = await snapshot(run)
      section.actions.push({ label: 'Set cluster Jump Route draft in active ' + theme + ' theme', marker, selected: before.selection, savedWorkspaceHash: before.workspaceSha256, theme: before.theme, svgLabels: before.svgLabels })
      await screenshot(run, 'b-cluster-active-' + theme + '-with-draft')
      if (theme === 'dark') {
        await exportOne(run, 'cluster', theme, 'svg', marker, section)
        await exportOne(run, 'cluster', theme, 'png', marker, section)
      }
      const afterExports = await snapshot(run)
      section.actions.push({ label: 'Cluster state after both ' + theme + ' exports', dirtyMarkerStillInInspector: afterExports.inspectorName === marker, screenshot: 'see active theme capture' })
    }
    section.errors.push(...run.errors)
  } catch (error) {
    section.clusterFailure = { message: error.message, stack: error.stack }
    section.errors.push(...run.errors)
  } finally {
    await run.context.close()
  }

  run = await newRun('exports-system', { width: 1440, height: 900 }, false)
  try {
    const systemSection = { view: 'system', initialStorage: (await snapshot(run)).storage, actions: [] }
    section.contexts.push(systemSection)
    await clickAndRecord(run, 'Open Hierarchy to navigate to Vela for export', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), { actions: systemSection.actions })
    await clickAndRecord(run, 'Open Vela from the Hierarchy system list for export', run.page.locator('.hierarchy-system-row').filter({ hasText: 'Vela' }).first(), { actions: systemSection.actions })
    await clickAndRecord(run, 'Open Hierarchy to select Aster for export', run.page.locator('.b-tool-rail .rail-button[title="Show map hierarchy"]'), { actions: systemSection.actions })
    const aster = run.page.getByRole('button', { name: 'Select PL-1, Aster', exact: true })
    await clickAndRecord(run, 'Select Aster through the Hierarchy for export', aster, { actions: systemSection.actions })
    for (const theme of ['dark', 'light']) {
      await ensureTheme(run, theme)
      const marker = 'aster-draft-not-exported-dark'
      if (theme === 'dark') await run.page.locator('.inspector-form input').first().fill(marker)
      const before = await snapshot(run)
      systemSection.actions.push({ label: theme === 'dark' ? 'Set Aster draft before dark-theme export' : 'Observe same dirty Aster draft in light active theme', marker, selected: before.selection, savedWorkspaceHash: before.workspaceSha256, theme: before.theme, svgLabels: before.svgLabels })
      await screenshot(run, 'b-system-active-' + theme + '-with-draft')
      if (theme === 'dark') {
        await exportOne(run, 'system', theme, 'svg', marker, section)
        await exportOne(run, 'system', theme, 'png', marker, section)
      }
    }
    systemSection.finalState = await snapshot(run)
    section.errors.push(...run.errors)
  } catch (error) {
    section.systemFailure = { message: error.message, stack: error.stack }
    section.errors.push(...run.errors)
    section.systemLastState = await snapshot(run).catch(() => null)
  } finally {
    await run.context.close()
  }
  return section
}

async function captureOptionalDeleteAndImport() {
  const results = []
  let run = await newRun('delete-flow', { width: 1440, height: 900 }, false)
  const deletion = { name: 'optional delete with dirty route draft', actions: [], errors: [] }
  try {
    const before = await snapshot(run)
    const routeId = 'route-vela-kestrel'
    const routeBefore = before.routeValues.find(route => route.id === routeId)
    await run.page.locator('.inspector-form input').first().fill('draft intended to be replaced by deletion')
    const dirty = await snapshot(run)
    await run.page.getByRole('button', { name: /Delete route/ }).click()
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 8_000 })
    deletion.confirmation = await captureDialog(run)
    await run.page.getByRole('button', { name: 'Delete from sample', exact: true }).click()
    await run.page.waitForTimeout(150)
    const after = await snapshot(run)
    deletion.result = {
      priorSavedRoute: routeBefore,
      dirtyDraftBeforeConfirmation: dirty.inspectorName,
      confirmationText: deletion.confirmation?.text,
      routeStillExists: after.routeValues.some(route => route.id === routeId),
      selectionAfter: after.selection,
      inspectorNameAfter: after.inspectorName,
      workspaceChanged: before.workspaceSha256 !== after.workspaceSha256,
      simulatedSaveStatus: after.saveState,
      userStorageAfter: after.storage,
    }
    deletion.screenshot = await screenshot(run, 'b-delete-after-confirmation')
    deletion.errors = run.errors
  } catch (error) {
    deletion.failure = { message: error.message, stack: error.stack }
    deletion.errors.push(...run.errors)
  } finally {
    await run.context.close()
  }
  results.push(deletion)

  run = await newRun('import-flow', { width: 1440, height: 900 }, false)
  const importing = { name: 'optional import with dirty route draft', actions: [], errors: [] }
  try {
    const before = await snapshot(run)
    await run.page.locator('.inspector-form input').first().fill('draft intended to be replaced by import')
    const dirty = await snapshot(run)
    await run.page.locator('input[type="file"]').setInputFiles(fixturePath)
    await run.page.locator('.proto-modal-body').waitFor({ state: 'visible', timeout: 10_000 })
    importing.preview = await captureDialog(run)
    importing.draftAtPreview = dirty.inspectorName
    await run.page.getByRole('button', { name: 'Use imported sample', exact: true }).click()
    await run.page.waitForTimeout(150)
    const after = await snapshot(run)
    importing.result = {
      previewText: importing.preview?.text,
      draftBeforeImport: dirty.inspectorName,
      activeViewAfterImport: after.activeView,
      selectionAfterImport: after.selection,
      inspectorNameAfterImport: after.inspectorName,
      workspaceChanged: before.workspaceSha256 !== after.workspaceSha256,
      saveState: after.saveState,
      userStorageAfter: after.storage,
    }
    importing.screenshot = await screenshot(run, 'b-import-after-confirmation')
    importing.errors = run.errors
  } catch (error) {
    importing.failure = { message: error.message, stack: error.stack }
    importing.errors.push(...run.errors)
  } finally {
    await run.context.close()
  }
  results.push(importing)
  return results
}

try {
  report.results = []
  if (process.env.RUN_PHASE !== 'exports') {
    report.results.push(await captureGeometryAndOpenPaths())
    await writeJson('preservation-incremental.json', report)
    console.log('GEOMETRY_DONE')
    report.results.push(await captureDraftGuardsAndScroll())
    await writeJson('preservation-incremental.json', report)
    console.log('DRAFT_GUARDS_DONE')
  }
  if (process.env.RUN_PHASE !== 'initial') {
    report.results.push(await captureShortViewport())
    await writeJson('preservation-incremental.json', report)
    console.log('SHORT_VIEWPORT_DONE')
    report.results.push(await captureExports())
    await writeJson('preservation-incremental.json', report)
    console.log('EXPORTS_DONE')
    if (process.env.RUN_PHASE !== 'exports') {
      report.optionalFlows = await captureOptionalDeleteAndImport()
      await writeJson('preservation-incremental.json', report)
      console.log('OPTIONAL_FLOWS_DONE')
    }
  }
} finally {
  await writeJson(process.env.RUN_PHASE === 'initial' ? 'preservation-initial.json' : 'preservation-runs.json', report)
  await browser.close()
}
console.log('WROTE artifacts/' + (process.env.RUN_PHASE === 'initial' ? 'preservation-initial.json' : 'preservation-runs.json'))
