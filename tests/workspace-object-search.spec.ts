import { expect, test, type Locator, type Page } from './fixtures'
import {
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  exportStarSystem,
  type StarSystem,
} from '../domain/workspace'
import {
  activeWorkspaceFeedback,
  createSingleSystemWorkspace,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  workspaceMapContextType,
  workspaceZoomControls,
} from './helpers'

interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

async function tapVisibleTarget(
  cdp: import('@playwright/test').CDPSession,
  target: import('@playwright/test').Locator,
): Promise<void> {
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('The touch target has no visible bounds.')
  const touchPoint = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function expectBranchPaintInsideUsableMap(
  page: Page,
  systemMap: Locator,
  branchNames: readonly string[],
): Promise<void> {
  const mapBounds = await systemMap.boundingBox()
  if (!mapBounds) throw new Error('The visible star system map has no measured bounds.')
  const mapScreenRect: ScreenRect = {
    left: mapBounds.x,
    top: mapBounds.y,
    right: mapBounds.x + mapBounds.width,
    bottom: mapBounds.y + mapBounds.height,
  }
  const obstructionBounds: ScreenRect[] = []
  const obstructions = page.locator('[data-map-obstruction]')
  for (let index = 0; index < await obstructions.count(); index += 1) {
    const obstruction = obstructions.nth(index)
    const visible = await obstruction.evaluate(element => {
      if (!element.isConnected || element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false
      if (element.getClientRects().length === 0) return false
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })
    if (!visible) continue
    const bounds = await obstruction.boundingBox()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue
    obstructionBounds.push({
      left: bounds.x,
      top: bounds.y,
      right: bounds.x + bounds.width,
      bottom: bounds.y + bounds.height,
    })
  }

  const branchRings = systemMap.locator(
    '.orbit-mark[aria-label*="around Leaf Reliquary"] .orbit-ring, '
      + '.orbit-mark[aria-label*="around Nested Beacon East"] .orbit-ring, '
      + '.orbit-mark[aria-label*="around Nested Beacon West"] .orbit-ring',
  )
  await expect(branchRings).toHaveCount(4)
  const painted = [
    ...await Promise.all(Array.from({ length: await branchRings.count() }, (_, index) =>
      branchRings.nth(index).boundingBox(),
    )),
  ]
  for (const branchName of branchNames) {
    const label = await systemMap.locator('.object-name').filter({ hasText: branchName }).boundingBox()
    if (!label) throw new Error(`The visible branch label ${branchName} has no measured bounds.`)
    painted.push(label)
  }

  for (const bounds of painted) {
    if (!bounds) throw new Error('A painted branch element has no measured bounds.')
    expect(bounds.x).toBeGreaterThanOrEqual(mapScreenRect.left - 1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapScreenRect.right + 1)
    expect(bounds.y).toBeGreaterThanOrEqual(mapScreenRect.top - 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapScreenRect.bottom + 1)
    for (const obstruction of obstructionBounds) {
      const overlapsObstruction = bounds.x < obstruction.right
        && bounds.x + bounds.width > obstruction.left
        && bounds.y < obstruction.bottom
        && bounds.y + bounds.height > obstruction.top
      expect(overlapsObstruction).toBe(false)
    }
  }
}

function branchSearchMap(): {
  content: string
  systemName: string
  targetName: string
  branchNames: string[]
  readableTargetName: string
  readableNestedName: string
  remoteLeafName: string
  parentName: string
  siblingName: string
  targetLocationKey: string
} {
  const workspace = createLocalWorkspace('Branch Atlas', 'Branch Vesper')
  const sourceSystem = workspace.cluster.systems[0]
  if (!sourceSystem) throw new Error('The branch search fixture needs its initial star system.')
  const parent = sourceSystem.objects[0]
  if (!parent) throw new Error('The branch search fixture needs its initial star.')

  const parentOrbit = createOrbit(sourceSystem, parent.id)
  let system: StarSystem = { ...sourceSystem, orbits: [parentOrbit] }
  const target = { ...createSystemObject(system, 'planet', parentOrbit.id), name: 'Leaf Reliquary' }
  system = { ...system, objects: [...system.objects, target] }
  const eastOrbit = createOrbit(system, target.id)
  system = { ...system, orbits: [...system.orbits, eastOrbit] }
  const east = { ...createSystemObject(system, 'moon', eastOrbit.id), name: 'Nested Beacon East' }
  system = { ...system, objects: [...system.objects, east] }
  const eastDeepOrbit = createOrbit(system, east.id)
  system = { ...system, orbits: [...system.orbits, eastDeepOrbit] }
  const eastDeep = { ...createSystemObject(system, 'base', eastDeepOrbit.id), name: 'East Deep Signal' }
  system = { ...system, objects: [...system.objects, eastDeep] }
  const westOrbit = createOrbit(system, target.id)
  system = { ...system, orbits: [...system.orbits, westOrbit] }
  const west = { ...createSystemObject(system, 'moon', westOrbit.id), name: 'Nested Beacon West' }
  system = { ...system, objects: [...system.objects, west] }
  const westDeepOrbit = createOrbit(system, west.id)
  system = { ...system, orbits: [...system.orbits, westDeepOrbit] }
  const westDeep = { ...createSystemObject(system, 'colony', westDeepOrbit.id), name: 'West Deep Signal' }
  system = { ...system, objects: [...system.objects, westDeep] }
  const sibling = {
    ...createSystemObject(system, 'moon', parentOrbit.id),
    name: 'Sibling Haven',
  }
  system = { ...system, objects: [...system.objects, sibling] }
  const readableTarget = { ...createSystemObject(system, 'planet', parentOrbit.id), name: 'Readable Beacon' }
  system = { ...system, objects: [...system.objects, readableTarget] }
  const readableOrbit = createOrbit(system, readableTarget.id)
  system = { ...system, orbits: [...system.orbits, readableOrbit] }
  const readableNested = { ...createSystemObject(system, 'moon', readableOrbit.id), name: 'Readable Moon' }
  const remoteLeaf = {
    ...createSystemObject(system, 'anomaly'),
    name: 'Remote Beacon',
    placement: { kind: 'system' as const, x: 25, y: 20 },
  }
  system = { ...system, objects: [...system.objects, readableNested, remoteLeaf] }
  for (let index = 2; index <= 12; index += 1) {
    const searchableAnomaly = {
      ...createSystemObject(system, 'anomaly'),
      name: `Searchable Anomaly ${index}`,
    }
    system = { ...system, objects: [...system.objects, searchableAnomaly] }
  }

  const source = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [system],
    },
    layout: {
      ...workspace.layout,
      orbitRadii: {
        [parentOrbit.id]: { horizontal: 9000, vertical: 9000 },
        [eastOrbit.id]: { horizontal: 3200, vertical: 190 },
        [eastDeepOrbit.id]: { horizontal: 500, vertical: 120 },
        [westOrbit.id]: { horizontal: 2200, vertical: 600 },
        [westDeepOrbit.id]: { horizontal: 280, vertical: 150 },
        [readableOrbit.id]: { horizontal: 100, vertical: 70 },
      },
      orbitRotations: {
        [eastOrbit.id]: 41,
        [eastDeepOrbit.id]: -28,
        [westOrbit.id]: 123,
        [westDeepOrbit.id]: 62,
        [readableOrbit.id]: 23,
      },
      objectAngles: {
        [target.id]: 0,
        [east.id]: 0.35,
        [eastDeep.id]: 0.8,
        [west.id]: -0.45,
        [westDeep.id]: 1.1,
        [sibling.id]: Math.PI,
        [readableTarget.id]: 2.2,
        [readableNested.id]: 0.6,
      },
    },
  }

  return {
    content: JSON.stringify(exportStarSystem(source, system.id)),
    systemName: system.name,
    targetName: target.name,
    branchNames: [east.name, eastDeep.name, west.name, westDeep.name],
    readableTargetName: readableTarget.name,
    readableNestedName: readableNested.name,
    remoteLeafName: remoteLeaf.name,
    parentName: parent.name,
    siblingName: sibling.name,
    targetLocationKey: target.locationKey,
  }
}

function scaleFromTransform(transform: string | null): number {
  const scale = transform?.match(/scale\(([-+\deE.]+)\)/)?.[1]
  if (!scale) throw new Error(`The system map has no readable scale transform: ${transform ?? 'missing'}`)
  return Number(scale)
}

test('search frames the selected nested object and its rotated hosted branch below 25 percent', async ({ page }, testInfo) => {
  const fixture = branchSearchMap()
  await createSingleSystemWorkspace(page)
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'branch-atlas.json', fixture.content)
  await resolveImportReview(page.getByRole('dialog', { name: 'Review import', exact: true }), 'confirm')

  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const importedSystem = page.getByRole('button', { name: `Open ${fixture.systemName} system map`, exact: true })
  await importedSystem.click()
  const systemMap = page.getByRole('group', { name: `${fixture.systemName} star system map`, exact: true })
  const content = systemMap.locator('.system-map-content')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })

  await query.fill(fixture.remoteLeafName)
  const remoteResult = searchDialog.getByRole('button', { name: new RegExp(fixture.remoteLeafName) })
  await expect(remoteResult).toContainText('Location key: AN-01')
  await remoteResult.click()
  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  const remoteObject = systemMap.locator('.system-object').filter({ hasText: fixture.remoteLeafName })
  await expect(remoteObject).toHaveClass(/is-selected/)
  const remoteScale = scaleFromTransform(await content.getAttribute('transform'))
  expect(remoteScale).toBeCloseTo(2, 1)
  await expect(systemMap.locator('.orbit-mark[aria-label*="around Remote Beacon"]')).toHaveCount(0)
  const remoteLabel = systemMap.locator('.object-name').filter({ hasText: fixture.remoteLeafName })
  const remoteBounds = await remoteLabel.boundingBox()
  const remoteMapBounds = await systemMap.boundingBox()
  if (!remoteBounds || !remoteMapBounds) throw new Error('The isolated leaf or its system map has no visible bounds.')
  expect(remoteBounds.x).toBeGreaterThanOrEqual(remoteMapBounds.x)
  expect(remoteBounds.x + remoteBounds.width).toBeLessThanOrEqual(remoteMapBounds.x + remoteMapBounds.width)
  expect(remoteBounds.y).toBeGreaterThanOrEqual(remoteMapBounds.y)
  expect(remoteBounds.y + remoteBounds.height).toBeLessThanOrEqual(remoteMapBounds.y + remoteMapBounds.height)

  const isolatedLeafScreenshot = testInfo.outputPath('object-search-isolated-leaf-capped.png')
  await page.screenshot({ path: isolatedLeafScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-isolated-leaf-capped', {
    path: isolatedLeafScreenshot,
    contentType: 'image/png',
  })

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await query.fill(fixture.readableTargetName)
  const readableResult = searchDialog.getByRole('button', { name: new RegExp(fixture.readableTargetName) })
  await expect(readableResult).toContainText(`Location key: PL-02`)
  await readableResult.click()
  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  const readableTarget = systemMap.locator('.system-object').filter({ hasText: fixture.readableTargetName })
  await expect(readableTarget).toHaveClass(/is-selected/)
  const readableScale = scaleFromTransform(await content.getAttribute('transform'))
  expect(readableScale).toBeCloseTo(2, 1)
  const readableOrbit = systemMap.locator('.orbit-mark[aria-label*="around Readable Beacon"] .orbit-ring')
  const readableOrbitBounds = await readableOrbit.boundingBox()
  const readableMoonLabel = systemMap.locator('.object-name').filter({ hasText: fixture.readableNestedName })
  const readableMoonBounds = await readableMoonLabel.boundingBox()
  const inspectorBounds = await inspector.boundingBox()
  if (!readableOrbitBounds || !readableMoonBounds || !inspectorBounds) {
    throw new Error('The readable hosted branch or its Inspector obstruction has no visible bounds.')
  }
  expect(readableOrbitBounds.x + readableOrbitBounds.width <= inspectorBounds.x
    || readableOrbitBounds.x >= inspectorBounds.x + inspectorBounds.width).toBe(true)
  expect(readableMoonBounds.x + readableMoonBounds.width <= inspectorBounds.x
    || readableMoonBounds.x >= inspectorBounds.x + inspectorBounds.width).toBe(true)

  const readableScreenshot = testInfo.outputPath('object-search-readable-branch-with-inspector.png')
  await page.screenshot({ path: readableScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-readable-branch-with-inspector', {
    path: readableScreenshot,
    contentType: 'image/png',
  })

  const beforeFrame = await content.getAttribute('transform')
  if (!beforeFrame) throw new Error('The imported system has no rendered camera transform.')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await query.fill(fixture.targetName)
  const result = searchDialog.getByRole('button', { name: new RegExp(fixture.targetName) })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Star System: Branch Vesper')
  await expect(result).toContainText(`Location key: ${fixture.targetLocationKey}`)
  await result.click()

  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  const selectedTarget = systemMap.locator('.system-object').filter({ hasText: fixture.targetName })
  await expect(selectedTarget).toHaveClass(/is-selected/)
  const frameScale = scaleFromTransform(await content.getAttribute('transform'))
  expect(frameScale).toBeLessThan(0.25)
  expect(await content.getAttribute('transform')).not.toBe(beforeFrame)

  const targetOrbits = systemMap.locator(
    '.orbit-mark[aria-label*="around Leaf Reliquary"] .orbit-ring, '
      + '.orbit-mark[aria-label*="around Nested Beacon East"] .orbit-ring, '
      + '.orbit-mark[aria-label*="around Nested Beacon West"] .orbit-ring',
  )
  await expect(targetOrbits).toHaveCount(4)
  const mapBounds = await systemMap.boundingBox()
  if (!mapBounds) throw new Error('The active system map has no visible bounds.')

  const obstructions = page.locator('[data-map-obstruction]')
  for (let orbitIndex = 0; orbitIndex < await targetOrbits.count(); orbitIndex += 1) {
    const orbitBounds = await targetOrbits.nth(orbitIndex).boundingBox()
    if (!orbitBounds) throw new Error('A hosted branch Orbit has no visible bounds.')
    expect(orbitBounds.x).toBeGreaterThanOrEqual(mapBounds.x)
    expect(orbitBounds.x + orbitBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
    expect(orbitBounds.y).toBeGreaterThanOrEqual(mapBounds.y)
    expect(orbitBounds.y + orbitBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)

    for (let index = 0; index < await obstructions.count(); index += 1) {
      const obstruction = obstructions.nth(index)
      if (!(await obstruction.isVisible().catch(() => false))) continue
      const bounds = await obstruction.boundingBox()
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue
      const overlapsOrbit = orbitBounds.x < bounds.x + bounds.width
        && orbitBounds.x + orbitBounds.width > bounds.x
        && orbitBounds.y < bounds.y + bounds.height
        && orbitBounds.y + orbitBounds.height > bounds.y
      expect(overlapsOrbit).toBe(false)
    }
  }

  for (const branchName of [fixture.targetName, ...fixture.branchNames]) {
    const label = systemMap.locator('.object-name').filter({ hasText: branchName })
    const bounds = await label.boundingBox()
    if (!bounds) throw new Error(`The framed branch label ${branchName} has no visible bounds.`)
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)
  }

  for (const excludedName of [fixture.parentName, fixture.siblingName]) {
    const excluded = systemMap.locator('.system-object').filter({ hasText: excludedName })
    const bounds = await excluded.boundingBox()
    if (!bounds) throw new Error(`The excluded map object ${excludedName} has no measurable bounds.`)
    expect(bounds.x + bounds.width < mapBounds.x
      || bounds.x > mapBounds.x + mapBounds.width
      || bounds.y + bounds.height < mapBounds.y
      || bounds.y > mapBounds.y + mapBounds.height).toBe(true)
  }

  const screenshotPath = testInfo.outputPath('object-search-large-rotated-branch.png')
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('object-search-large-rotated-branch', { path: screenshotPath, contentType: 'image/png' })

  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await query.fill(fixture.targetName)
  await searchDialog.getByRole('button', { name: new RegExp(fixture.targetName) }).click()
  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  expect(scaleFromTransform(await content.getAttribute('transform'))).toBeCloseTo(frameScale, 3)
  await expect(zoomOut).toBeDisabled()

  for (let step = 0; step < 64 && !(await zoomOut.isDisabled()); step += 1) await zoomOut.click()
  await expect(zoomOut).toBeDisabled()
  expect(scaleFromTransform(await content.getAttribute('transform'))).toBeCloseTo(frameScale, 3)

  const revisitCamera = await content.getAttribute('transform')
  if (!revisitCamera) throw new Error('The framed system visit has no camera transform to restore.')
  const revisitScale = scaleFromTransform(revisitCamera)
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  await page.getByRole('button', { name: `Open ${fixture.systemName} system map`, exact: true }).click()
  await expect(systemMap).toBeVisible()
  await expect(content).toHaveAttribute('transform', revisitCamera)
  expect(scaleFromTransform(await content.getAttribute('transform'))).toBeCloseTo(revisitScale, 3)
  await expect(zoomOut).toBeDisabled()
})

test('compact Location-key search preserves a dirty same-object draft and returns focus after touch selection', async ({ page }, testInfo) => {
  const fixture = branchSearchMap()
  await createSingleSystemWorkspace(page)
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'branch-atlas-draft.json', fixture.content)
  await resolveImportReview(page.getByRole('dialog', { name: 'Review import', exact: true }), 'confirm')

  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  await page.getByRole('button', { name: `Open ${fixture.systemName} system map`, exact: true }).click()
  const systemMap = page.getByRole('group', { name: `${fixture.systemName} star system map`, exact: true })

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill(fixture.targetName)
  await searchDialog.getByRole('button', { name: new RegExp(fixture.targetName) }).click()
  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()

  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill('Leaf Reliquary draft')
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await query.fill('AN-')
  const results = searchDialog.locator('#workspace-search-results')
  const resultButtons = results.getByRole('button')
  await expect(resultButtons).toHaveCount(12)
  expect(await results.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await query.press('ArrowDown')
  await expect(resultButtons.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(resultButtons.last()).toBeFocused()
  await expect(resultButtons.last()).toBeInViewport()
  const landscapeSearchScreenshot = testInfo.outputPath('object-search-short-landscape-populated.png')
  await page.screenshot({ path: landscapeSearchScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-short-landscape-populated', {
    path: landscapeSearchScreenshot,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(searchDialog).toBeVisible()
  await expect(resultButtons.last()).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await query.fill(fixture.targetLocationKey)
  const targetResult = searchDialog.getByRole('button', { name: new RegExp(`Location key: ${fixture.targetLocationKey}`) })
  await expect(targetResult).toBeVisible()
  await expect(targetResult).toContainText(`Location key: ${fixture.targetLocationKey}`)

  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    await tapVisibleTarget(cdp, targetResult)
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => undefined)
    await cdp.detach()
  }

  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  await expect(systemMap.locator('.system-object').filter({ hasText: fixture.targetName })).toHaveClass(/is-selected/)
  await expect(inspector).toBeHidden()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  await expectBranchPaintInsideUsableMap(page, systemMap, [fixture.targetName, ...fixture.branchNames])
  const portraitFrameScreenshot = testInfo.outputPath('object-search-portrait-framed-branch.png')
  await page.screenshot({ path: portraitFrameScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-portrait-framed-branch', {
    path: portraitFrameScreenshot,
    contentType: 'image/png',
  })

  await inspectToggle.click()
  await expect(inspector).toBeVisible()
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Leaf Reliquary draft')
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
})

test('object search guards a hidden chart-name draft before revealing the result', async ({ page }) => {
  const { systemName } = await createSingleSystemWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  const clusterDraft = 'Kestrel Reach draft'
  const systemDraft = 'Vesper draft'
  await chartDialog.getByLabel('Jump Cluster', { exact: true }).fill(clusterDraft)
  await chartDialog.getByLabel('Star system', { exact: true }).fill(systemDraft)
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(hierarchy).toBeHidden()

  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })
  await expect(resumeDraft).toBeVisible()
  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  const systemMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  const systemContent = systemMap.locator('.system-map-content')
  const initialCamera = await systemContent.getAttribute('transform')
  if (!initialCamera) throw new Error('The active system map has no rendered camera transform.')

  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('Primary Star')
  const result = searchDialog.getByRole('button', { name: /Primary Star, Star, Star System: Vesper/ })
  await expect(result).toBeVisible()
  await result.click()

  const guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await expect(guard.getByRole('button', { name: 'Discard and continue', exact: true })).toBeVisible()
  await expect(guard.getByRole('button', { name: 'Apply and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()

  await expect(guard).toHaveCount(0)
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue('Primary Star')
  await expect(query).toBeFocused()
  await expect(workspaceMapContextType(page)).toHaveText('Star System')
  await expect(systemContent).toHaveAttribute('transform', initialCamera)
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()
  await resumeDraft.click()
  await expect(chartDialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue(clusterDraft)
  await expect(chartDialog.getByLabel('Star system', { exact: true })).toHaveValue(systemDraft)
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  await searchButton.click()
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue('Primary Star')
  await searchDialog.getByRole('button', { name: /Primary Star, Star, Star System: Vesper/ }).click()
  await expect(guard.getByRole('button', { name: 'Discard and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Discard and continue', exact: true }).click()

  await expect(searchDialog).toHaveCount(0)
  await expect(systemMap).toBeFocused()
  const selectedStar = systemMap.locator('.system-object').filter({ hasText: 'Primary Star' })
  await expect(selectedStar).toHaveClass(/is-selected/)
  expect(scaleFromTransform(await systemContent.getAttribute('transform'))).toBeCloseTo(2, 1)
  await expect(resumeDraft).toHaveCount(0)
})
