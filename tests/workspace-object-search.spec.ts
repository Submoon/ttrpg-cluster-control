import { expect, test, type Locator, type Page } from './fixtures'

import { expectPaletteOptionActive } from './scenarios/search-palette'
import { expectPaintedInsideUsableMap, measurePaintedBounds } from './scenarios/search-assertions'
import { largestUnobstructedClientRect } from '../utils/map-usable-area'
import { CONTINUOUS_MAP_SYSTEM_SCALE } from '../utils/continuous-map-projection'
import {
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  exportStarSystem,
  type StarSystem,
} from '../domain/workspace'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  downloadJson,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  resolveImportReview,
  reviewStarSystemImport,
  setWorkspaceMapMode,
  wardenMap,
} from './helpers'

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
  map: Locator,
  owner: Locator,
  branchRings: Locator,
  branchNames: readonly string[],
): Promise<void> {
  await expect(branchRings).toHaveCount(4)
  const labels = branchNames.map(name => owner.locator('.continuous-warden-object-name').and(owner.getByText(name, { exact: true })))
  await expectPaintedInsideUsableMap(page, map, [...await branchRings.all(), ...labels])
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

async function importAndOpenBranchSearchSystem(
  page: Page,
  fixture: ReturnType<typeof branchSearchMap>,
  fileName: string,
) {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  const review = await reviewStarSystemImport(page, fileName, fixture.content)
  await resolveImportReview(review, 'confirm')

  const backup = await downloadJson(page, 'Export Jump Cluster JSON')
  const system = backup.cluster?.systems.find(candidate => candidate.name === fixture.systemName)
  if (!system) throw new Error('The reviewed import is missing its Branch Vesper owner.')
  const target = system.objects.find(object => object.name === fixture.targetName)
  if (!target) throw new Error('The reviewed import is missing its branch root object.')
  const hosts = new Set(system.objects
    .filter(object => [fixture.targetName, ...fixture.branchNames].includes(object.name))
    .map(object => object.id))
  const ringSelectors = system.orbits
    .filter(orbit => orbit.hostId !== null && hosts.has(orbit.hostId))
    .map(orbit => `.continuous-warden-orbit-target[data-orbit-id="${orbit.id}"]`)
  expect(ringSelectors).toHaveLength(4)

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: `Inspect ${fixture.systemName}`, exact: true }).click()
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') === 'true') await hierarchyToggle.click()
  await centerWorkspaceSelection(page)
  await hideWorkspaceInspector(page)
  const map = wardenMap(page)
  const owner = map.locator(`.continuous-warden-system[data-system-id="${system.id}"]`)
  return { map, owner, targetObjectId: target.id, branchRings: owner.locator(ringSelectors.join(', ')) }
}



test('search centers a rotated recursive branch at sufficient current zoom without framing its relatives', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const fixture = branchSearchMap()
  const { map, owner, branchRings } = await importAndOpenBranchSearchSystem(page, fixture, 'branch-atlas-large.json')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await filters.getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const content = map.locator('.cluster-map-content')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()

  const beforeFrame = await content.getAttribute('transform')
  if (!beforeFrame) throw new Error('The imported system has no rendered camera transform.')
  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await expect(searchDialog).toBeVisible()
  await query.fill(fixture.targetName)
  const result = searchDialog.getByRole('option', { name: new RegExp(fixture.targetName) })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Star System: Branch Vesper')
  await expect(result).toContainText(`Location key: ${fixture.targetLocationKey}`)
  await result.click()

  await expect(searchDialog).toHaveCount(0)
  await expect(map).toBeFocused()
  const selectedTarget = owner.locator('.continuous-warden-object').filter({ hasText: fixture.targetName })
  await expect(selectedTarget).toHaveClass(/is-selected/)
  await expect(selectedTarget).not.toHaveClass(/is-dimmed/)
  await expect(owner.locator('.continuous-warden-object').filter({ hasText: fixture.branchNames[0] })).toHaveClass(/is-dimmed/)
  await expect(map.locator('[data-map-search-locator]')).toHaveCount(0)
  const frameScale = scaleFromTransform(await content.getAttribute('transform'))
  expect(frameScale).toBe(scaleFromTransform(beforeFrame))
  expect(frameScale * CONTINUOUS_MAP_SYSTEM_SCALE).toBeLessThan(0.25)
  expect(await content.getAttribute('transform')).not.toBe(beforeFrame)

  await expectBranchPaintInsideUsableMap(page, map, owner, branchRings, [fixture.targetName, ...fixture.branchNames])
  const painted = await Promise.all([
    ...await branchRings.all(),
    ...[fixture.targetName, ...fixture.branchNames].map(name => owner.locator('.continuous-warden-object-name')
      .and(owner.getByText(name, { exact: true }))),
  ].map(measurePaintedBounds))
  const rectangles = painted.map(bounds => {
    if (!bounds) throw new Error('The framed branch must have measurable paint.')
    return bounds
  })
  const branchBounds = {
    left: Math.min(...rectangles.map(bounds => bounds.x)),
    right: Math.max(...rectangles.map(bounds => bounds.x + bounds.width)),
    top: Math.min(...rectangles.map(bounds => bounds.y)),
    bottom: Math.max(...rectangles.map(bounds => bounds.y + bounds.height)),
  }
  const { drawable, obstructions } = await map.evaluate(element => {
    const rect = (node: Element) => {
      const bounds = node.getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
    }
    return {
      drawable: rect(element),
      obstructions: [...document.querySelectorAll('[data-map-obstruction]')]
        .filter(node => !node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0
          && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0')
        .map(rect),
    }
  })
  const usable = largestUnobstructedClientRect(drawable, obstructions)
  if (!usable) throw new Error('The framed branch needs unobstructed map space.')
  const branchCenter = { x: (branchBounds.left + branchBounds.right) / 2, y: (branchBounds.top + branchBounds.bottom) / 2 }
  // Native curve sampling and non-scaling strokes differ from the local framing envelope by under two CSS pixels.
  expect(Math.abs(branchCenter.x - (usable.left + usable.right) / 2)).toBeLessThan(2)
  expect(Math.abs(branchCenter.y - (usable.top + usable.bottom) / 2)).toBeLessThan(2)
  for (const excludedName of [fixture.parentName, fixture.siblingName]) {
    const excluded = owner.locator('.continuous-warden-object').filter({ hasText: excludedName })
    const bounds = await excluded.boundingBox()
    if (!bounds) throw new Error(`The excluded map object ${excludedName} has no measurable bounds.`)
    const includingRelativeCenter = {
      x: (Math.min(branchBounds.left, bounds.x) + Math.max(branchBounds.right, bounds.x + bounds.width)) / 2,
      y: (Math.min(branchBounds.top, bounds.y) + Math.max(branchBounds.bottom, bounds.y + bounds.height)) / 2,
    }
    expect(Math.hypot(includingRelativeCenter.x - branchCenter.x, includingRelativeCenter.y - branchCenter.y)).toBeGreaterThan(4)
  }

  const screenshotPath = testInfo.outputPath('object-search-large-rotated-branch.png')
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('object-search-large-rotated-branch', { path: screenshotPath, contentType: 'image/png' })
})


test('compact Location-key search preserves a dirty same-object draft and returns focus after touch selection', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const fixture = branchSearchMap()
  const draftName = `${fixture.targetName} draft`
  const { map, owner, targetObjectId, branchRings } = await importAndOpenBranchSearchSystem(page, fixture, 'branch-atlas-draft.json')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill(fixture.targetName)
  await searchDialog.getByRole('option', { name: new RegExp(fixture.targetName) }).click()
  await expect(searchDialog).toHaveCount(0)
  await expect(map).toBeFocused()

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await filters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()

  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill(draftName)
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await query.fill('AN-')
  const results = searchDialog.getByRole('listbox')
  const resultOptions = results.getByRole('option')
  await expect(resultOptions).toHaveCount(12)
  await expect(searchDialog).toBeInViewport({ ratio: 1 })
  const resultViewport = results.locator('[data-slot="viewport"]')
  expect(await resultViewport.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, resultOptions.first())
  await page.keyboard.press('End')
  await expectPaletteOptionActive(query, resultOptions.last())
  await expect(resultOptions.last()).toBeInViewport()

  await searchDialog.getByRole('button', { name: 'Search filters', exact: true }).click()
  await searchDialog.getByRole('group', { name: 'Celestial body', exact: true })
    .getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await searchDialog.getByRole('button', { name: 'Close filters', exact: true }).click()
  await query.fill('')
  await expect(resultOptions).toHaveCount(2)
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, resultOptions.first())

  await searchDialog.getByRole('button', { name: /Search filters \(1 active criterion\)/ }).click()
  const addFieldFilter = searchDialog.getByRole('combobox', { name: 'Add Field filter' })
  await addFieldFilter.focus()
  await page.keyboard.press('ArrowDown')
  await expect(searchDialog.getByRole('option', { name: 'Atmosphere', exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  const atmosphereOperator = searchDialog.getByRole('combobox', { name: 'Atmosphere operator' })
  await atmosphereOperator.focus()
  await page.keyboard.press('ArrowDown')
  const noValueOperator = searchDialog.getByRole('option', { name: 'No value', exact: true })
  await expect(noValueOperator).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(noValueOperator).toBeHidden()
  await expect(searchDialog.getByRole('button', { name: 'Close filters', exact: true })).toBeVisible()
  await expect(searchDialog).toBeVisible()
  await atmosphereOperator.click()
  await noValueOperator.click()
  await expect(atmosphereOperator).toHaveText('No value')
  await searchDialog.getByRole('button', { name: 'Remove Atmosphere filter', exact: true }).click()
  await searchDialog.getByRole('button', { name: 'Close filters', exact: true }).click()

  const landscapeSearchScreenshot = testInfo.outputPath('object-search-short-landscape-populated.png')
  await page.screenshot({ path: landscapeSearchScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-short-landscape-populated', {
    path: landscapeSearchScreenshot,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(searchDialog).toBeVisible()
  await expect(resultOptions.last()).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await query.fill(fixture.targetLocationKey)
  const targetResult = searchDialog.getByRole('option', { name: new RegExp(`Location key: ${fixture.targetLocationKey}`) })
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
  await expect(map).toBeFocused()
  const selectedTarget = owner.locator(`.continuous-warden-object[data-object-id="${targetObjectId}"]`)
  await expect(selectedTarget).toHaveAccessibleName(`Select ${fixture.targetLocationKey}, ${draftName}`)
  await expect(selectedTarget).toHaveClass(/is-selected/)
  await expect(selectedTarget).toHaveClass(/is-dimmed/)
  const locator = map.locator('[data-map-search-locator]')
  await expect(locator).toBeVisible()
  const locatorBounds = await locator.boundingBox()
  expect(locatorBounds?.width).toBeGreaterThanOrEqual(19)
  await expect(inspector).toBeHidden()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  await expectBranchPaintInsideUsableMap(page, map, owner, branchRings, [draftName, ...fixture.branchNames])
  const portraitFrameScreenshot = testInfo.outputPath('object-search-portrait-framed-branch.png')
  await page.screenshot({ path: portraitFrameScreenshot, animations: 'disabled' })
  await testInfo.attach('object-search-portrait-framed-branch', {
    path: portraitFrameScreenshot,
    contentType: 'image/png',
  })

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue(fixture.targetLocationKey)
  const searchFiltersButton = searchDialog.getByRole('button', { name: /Search filters \(1 active criterion\)/ })
  await expect(searchFiltersButton).toBeVisible()
  await searchFiltersButton.click()
  await expect(searchDialog.getByRole('checkbox', { name: 'Planet', exact: true })).toBeChecked()
  await searchDialog.getByRole('button', { name: 'Clear all', exact: true }).click()
  await expect(query).toHaveValue(fixture.targetLocationKey)
  const searchFiltersWithoutCriteria = searchDialog.getByRole('button', { name: 'Search filters', exact: true })
  await expect(searchFiltersWithoutCriteria).toBeVisible()
  await expect(searchDialog.getByRole('checkbox', { name: 'Planet', exact: true })).not.toBeChecked()
  await searchDialog.getByRole('button', { name: 'Close filters', exact: true }).click()
  await query.press('Escape')
  await expect(searchDialog).toHaveCount(0)

  await expect(locator).toBeVisible()
  await map.dispatchEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true })
  await expect(locator).toHaveCount(0)
  await setWorkspaceMapMode(page, 'Move')
  await expect(selectedTarget).toHaveClass(/is-dimmed/)

  const applied = await downloadJson(page, 'Export Jump Cluster JSON')
  const appliedTarget = applied.cluster?.systems.flatMap(system => system.objects)
    .find(object => object.id === targetObjectId)
  expect(appliedTarget?.name).toBe(fixture.targetName)
  await inspectToggle.click()
  await expect(inspector).toBeVisible()
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue(draftName)
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
})
