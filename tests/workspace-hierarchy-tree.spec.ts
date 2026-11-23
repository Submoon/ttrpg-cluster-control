import { readFile } from 'node:fs/promises'
import { expect, preparedCampaignTest as test, test as freshTest, type Locator } from './fixtures'
import {
  centerWorkspaceSelection,
  type DownloadWindow,
  exposedContinuousObjectHitPoint,
  type ExportedMap,
  hideWorkspaceInspector,
  openMapFilesSection,
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  type ScreenPoint,
  setHeaderMapActionsOpen,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenObjectMark,
  wardenLocalCoordinates,
  wardenObjectLocalPosition,
  wardenOrbitLocalGeometry,
  wardenMap,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

async function renderedObjectPosition(mark: Locator): Promise<{ x: number; y: number }> {
  return wardenObjectLocalPosition(mark)
}

async function visibleIndicatorObjectIds(indicators: Locator): Promise<string[]> {
  const ids = await indicators.evaluateAll(marks => marks.map(mark => mark.getAttribute('data-selection-object-id')))
  return ids.map((id) => {
    if (!id) throw new Error('A visible selection indicator has no object identity.')
    return id
  }).sort()
}

async function downloadJsonFromFile(
  page: import('@playwright/test').Page,
  buttonName: 'Export Jump Cluster JSON' | 'Export star system JSON',
): Promise<ExportedMap> {
  const itemName = buttonName === 'Export Jump Cluster JSON'
    ? 'Download private Jump Cluster JSON'
    : 'Download private Star System JSON'
  const downloads = await openMapFilesSection(page, 'Download or back up')
  try {
    const downloadPromise = page.waitForEvent('download')
    await downloads.getByRole('menuitem', { name: itemName, exact: true }).click()
    const download = await downloadPromise
    const json = await readFile(await download.path(), 'utf8')
    await page.evaluate(() => (window as DownloadWindow).__mapExportBlobs?.splice(0))
    return JSON.parse(json) as ExportedMap
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

test('multi-select objects and preserve Hierarchy keyboard behavior through reflow', async ({
  campaignWorkspacePage: page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const beforeSelection = await downloadJsonFromFile(page, 'Export Jump Cluster JSON')
  const owner = beforeSelection.cluster?.systems.find(system => system.name === 'Vesper Prime')
  const star = owner?.objects.find(object => object.name === 'Primary Star')
  const planet = owner?.objects.find(object => object.name === 'Iria')
  const departure = owner?.objects.find(object => object.name === 'Vesper Departure')
  if (!owner || !star || !planet || !departure) throw new Error('The campaign needs its three selectable Vesper records.')

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: `${owner.name}`, exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const rowName = (object: typeof star) => `Select ${object.locationKey}, ${object.name} in ${owner.name}`
  const primaryStar = hierarchy.getByRole('treeitem', { name: rowName(star), exact: true })
  const iria = hierarchy.getByRole('treeitem', { name: rowName(planet), exact: true })
  const departureRow = hierarchy.getByRole('treeitem', { name: rowName(departure), exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit 1 around Primary Star, 1 object', exact: true })
  const map = wardenMap(page)
  const starMark = wardenObjectMark(page, owner.id, star.id)
  const departureMark = wardenObjectMark(page, owner.id, departure.id)
  const selectedMarks = map.locator('.continuous-warden-object[aria-pressed="true"]')
  const indicators = map.locator('.system-object-selection-indicator:visible')
  const groupIds = [star.id, planet.id].sort()
  await setWorkspaceMapMode(page, 'Select')
  await primaryStar.click()
  await iria.click({ modifiers: ['Shift'] })
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(selectedMarks).toHaveCount(2)
  expect(await visibleIndicatorObjectIds(indicators)).toEqual(groupIds)
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()
  await departureRow.click({ modifiers: ['Shift'] })
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(selectedMarks).toHaveCount(3)
  await expect(page.getByText('3 objects selected', { exact: true })).toBeVisible()
  await departureRow.click({ modifiers: ['Shift'] })
  await expect(departureRow).toHaveAttribute('aria-selected', 'false')
  expect(await visibleIndicatorObjectIds(indicators)).toEqual(groupIds)

  await hideWorkspaceInspector(page)
  const menu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  const moveMode = workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true })
  const moveFromContextMenu = async (row: Locator) => {
    // At the detail threshold Iria is covered by its owner's name badge; Hierarchy keeps its context action accessible.
    await row.focus()
    await row.press('Shift+F10')
    await menu.getByRole('menuitem', { name: 'Move selection', exact: true }).click()
    await expect(moveMode).toHaveAttribute('aria-pressed', 'true')
  }
  await moveFromContextMenu(iria)
  expect(await visibleIndicatorObjectIds(indicators)).toEqual(groupIds)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(selectedMarks).toHaveCount(2)
  await setWorkspaceMapMode(page, 'Select')
  await moveFromContextMenu(departureRow)
  await expect(selectedMarks).toHaveCount(1)
  await expect(departureMark).toHaveAttribute('aria-pressed', 'true')
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(primaryStar).toHaveAttribute('aria-selected', 'false')
  await expect(iria).toHaveAttribute('aria-selected', 'false')
  await setWorkspaceMapMode(page, 'Select')

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await filters.getByRole('group', { name: 'Celestial body', exact: true })
    .getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await primaryStar.focus()
  await page.keyboard.press('Enter')
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(primaryStar).toHaveAttribute('aria-description', /Dimmed on map/)
  await expect(starMark).toHaveClass(/\bis-dimmed\b/)
  await expect(starMark).toHaveAttribute('aria-pressed', 'true')
  await hideWorkspaceInspector(page)
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await starMark.focus()
  await expect(starMark).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const dimmedIndicator = starMark.locator('.system-object-selection-indicator')
  await expect(dimmedIndicator.locator('.system-object-selection-outline')).toBeVisible()
  await expect(dimmedIndicator.locator('.system-object-selection-dashes')).toBeVisible()
  await expect(dimmedIndicator.locator('.system-object-selection-dashes')).toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true }).click()
  await filters.getByRole('button', { name: 'Clear all', exact: true }).click()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(starMark).not.toHaveClass(/\bis-dimmed\b/)

  await openWorkspaceHierarchy(page)
  await iria.click({ modifiers: ['Shift'] })
  await hideWorkspaceInspector(page)
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  expect(await visibleIndicatorObjectIds(indicators)).toEqual(groupIds)
  const camera = map.locator('.cluster-map-content')
  const beforeNavigation = await camera.getAttribute('transform')
  const navigation = await openWorkspaceZoomNavigation(page)
  await navigation.getByRole('button', { name: 'Pan map right', exact: true }).click()
  const zoom = workspaceZoomControls(page)
  await zoom.getByRole('button', { name: 'Open map navigation controls', exact: true }).click()
  await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(camera).not.toHaveAttribute('transform', beforeNavigation!)

  // Derive both native rectangle corners from the transformed, owner-qualified object anchors.
  const rectangle = await map.evaluate((svg, target): { start: ScreenPoint; end: ScreenPoint } | null => {
    const anchors = [...svg.querySelectorAll<SVGGraphicsElement>('.continuous-warden-object')].map(mark => {
      const matrix = mark.getScreenCTM()
      if (!matrix) throw new Error('A painted Warden object has no screen transform.')
      const point = new DOMPoint(0, 0).matrixTransform(matrix)
      return { systemId: mark.dataset.systemId, objectId: mark.dataset.objectId, x: point.x, y: point.y }
    })
    const anchor = anchors.find(point => point.systemId === target.systemId && point.objectId === target.objectId)
    if (!anchor) throw new Error('Vesper Departure has no painted anchor after camera navigation.')
    const bounds = svg.getBoundingClientRect()
    const backgroundAt = (point: ScreenPoint) => {
      const hit = document.elementFromPoint(point.x, point.y)
      return hit instanceof Element && svg.contains(hit)
        && !hit.closest('.cluster-system-node, .cluster-route, .continuous-warden-object, .continuous-warden-orbit-target, .continuous-warden-orbit-edit-handle')
    }
    for (const radius of [24, 32, 48, 64, 80, 96]) {
      const start: ScreenPoint = { x: Math.round(anchor.x - radius), y: Math.round(anchor.y - radius) }
      const end: ScreenPoint = { x: Math.round(anchor.x + radius), y: Math.round(anchor.y + radius) }
      if (start.x <= bounds.left || end.x >= bounds.right || start.y <= bounds.top || end.y >= bounds.bottom) continue
      const enclosed = anchors.filter(point => point.x >= start.x && point.x <= end.x
        && point.y >= start.y && point.y <= end.y)
      if (enclosed.length === 1 && enclosed[0] === anchor && backgroundAt(start) && backgroundAt(end)) return { start, end }
    }
    return null
  }, { systemId: owner.id, objectId: departure.id })
  if (!rectangle) throw new Error('The transformed departure needs an unobstructed native selection rectangle.')
  const dragRectangle = async () => {
    await page.mouse.move(rectangle.start.x, rectangle.start.y)
    await page.mouse.down()
    await page.mouse.move(rectangle.end.x, rectangle.end.y, { steps: 6 })
  }
  const preview = page.locator('.workspace-selection-rectangle')
  try {
    await dragRectangle()
    await expect(preview).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()
  } finally {
    await page.mouse.up()
  }
  expect(await visibleIndicatorObjectIds(indicators)).toEqual(groupIds)
  try {
    await dragRectangle()
    await expect(preview).toBeVisible()
  } finally {
    await page.mouse.up()
  }
  await expect(preview).toBeHidden()
  await expect(selectedMarks).toHaveCount(1)
  await expect(departureMark).toHaveAttribute('aria-pressed', 'true')
  await hideWorkspaceInspector(page)
  await openWorkspaceHierarchy(page)
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.mouse.click(rectangle.start.x, rectangle.start.y)
  await expect(selectedMarks).toHaveCount(0)
  await expect(indicators).toHaveCount(0)

  await openWorkspaceHierarchy(page)
  await primaryStar.click()
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.type('Iria')
  await expect(iria).toBeFocused()
  const treeRows = hierarchy.getByRole('tree').getByRole('treeitem')
  await page.keyboard.press('Home')
  await expect(treeRows.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(treeRows.last()).toBeFocused()
  const selectMode = workspaceNavigation(page).getByRole('button', { name: 'Select', exact: true })
  for (const key of ['s', 'm', 'a']) {
    await iria.focus()
    await page.keyboard.press(key)
    await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
    await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true }))
      .toHaveAttribute('aria-expanded', 'false')
    await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
    await expect(iria).toHaveAttribute('aria-selected', 'false')
  }
  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(iria).toBeHidden()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await hideWorkspaceInspector(page)
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const compactHierarchy = await openWorkspaceHierarchy(page)
  const compactStar = compactHierarchy.getByRole('treeitem', { name: rowName(star), exact: true })
  const compactOrbit = compactHierarchy.getByRole('treeitem', { name: 'Orbit 1 around Primary Star, 1 object', exact: true })
  await expect(compactStar).toHaveAttribute('aria-selected', 'true')
  await expect(compactOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(compactHierarchy.getByRole('treeitem', { name: rowName(planet), exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await openWorkspaceHierarchy(page)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  expect(await downloadJsonFromFile(page, 'Export Jump Cluster JSON')).toEqual(beforeSelection)
})

freshTest('the default Warden map moves a group across owning systems and restores the saved edit', async ({ page }) => {
  freshTest.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const fixture = JSON.parse(await readFile(new URL('./fixtures/workspace-data-campaign-baseline.json', import.meta.url), 'utf8')) as ExportedMap
  const [sourceOwner, otherOwner] = fixture.cluster?.systems ?? []
  const sourceObject = sourceOwner?.objects.find(candidate => candidate.name === 'Iria')
  const otherOwnerObject = otherOwner?.objects.find(candidate => candidate.name === 'Harrow Arrival')
  if (!sourceOwner || !sourceObject || !otherOwner || !otherOwnerObject || !fixture.cluster) {
    throw new Error('The continuous group fixture needs an exposed object in each owner.')
  }
  fixture.layout.systemPositions = {
    [sourceOwner.id]: { x: .44, y: .5 },
    [otherOwner.id]: { x: .53, y: .5 },
  }
  otherOwnerObject.placement = { kind: 'system', x: .63, y: .59 }
  const destinationOrbitId = 'group-arrival-destination-orbit'
  otherOwner.orbits.push({ id: destinationOrbitId, hostId: null, center: { x: .73, y: .7 }, order: 1 })
  fixture.layout.orbitRadii[destinationOrbitId] = { horizontal: 55, vertical: 40 }
  const [picker] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Open local Jump Cluster backup', exact: true }).click(),
  ])
  await picker.setFiles({
    name: 'group-movement-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  })
  const review = page.getByRole('dialog', { name: 'Open Jump Cluster', exact: true })
  await review.getByRole('button', { name: 'Open Jump Cluster', exact: true }).click()
  await waitForWorkspaceStartup(page)
  const clusterBeforeGroupMove = await downloadJsonFromFile(page, 'Export Jump Cluster JSON')
  await setWorkspaceMapMode(page, 'Select')
  const sourceMark = wardenObjectMark(page, sourceOwner.id, sourceObject.id)
  const otherMark = wardenObjectMark(page, otherOwner.id, otherOwnerObject.id)
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  let sourcePoint = null
  let otherPoint = null
  for (let step = 0; step < 12; step += 1) {
    sourcePoint = await sourceMark.count() ? await exposedContinuousObjectHitPoint(sourceMark) : null
    otherPoint = await otherMark.count() ? await exposedContinuousObjectHitPoint(otherMark) : null
    if (sourcePoint && otherPoint) break
    await zoomIn.click()
  }
  if (!sourcePoint || !otherPoint) throw new Error('The two owners need visible, hittable objects.')
  await page.mouse.click(sourcePoint.x, sourcePoint.y)
  await page.keyboard.down('Shift')
  try {
    await page.mouse.click(otherPoint.x, otherPoint.y)
  } finally {
    await page.keyboard.up('Shift')
  }
  await expect(sourceMark).toHaveAttribute('aria-pressed', 'true')
  await expect(otherMark).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const sourceRow = hierarchy.getByRole('treeitem', {
    name: `Select ${sourceObject.locationKey}, ${sourceObject.name} in ${sourceOwner.name}`, exact: true, selected: true,
  })
  const otherRow = hierarchy.getByRole('treeitem', {
    name: `Select ${otherOwnerObject.locationKey}, ${otherOwnerObject.name} in ${otherOwner.name}`, exact: true, selected: true,
  })
  await expect(sourceRow).toBeVisible()
  await expect(otherRow).toBeVisible()
  const unrelatedSource = sourceOwner.objects.find(object => object.name === 'Vesper Departure')
  const unrelatedOther = otherOwner.objects.find(object => object.name === 'Primary Star')
  if (!unrelatedSource || !unrelatedOther) throw new Error('The group fixture needs unrelated records in both owners.')
  const unrelatedSourceRow = hierarchy.getByRole('treeitem', {
    name: `Select ${unrelatedSource.locationKey}, ${unrelatedSource.name} in ${sourceOwner.name}`, exact: true, includeHidden: true,
  })
  const unrelatedOtherRow = hierarchy.getByRole('treeitem', {
    name: `Select ${unrelatedOther.locationKey}, ${unrelatedOther.name} in ${otherOwner.name}`, exact: true, includeHidden: true,
  })
  await expect(unrelatedSourceRow).toHaveCount(0)
  await expect(unrelatedOtherRow).toHaveCount(0)
  // Selecting Iria reveals its ancestors without mounting its unrelated Orbit and Moon subtree.
  await expect(sourceRow).toHaveAttribute('aria-expanded', 'false')
  const moon = sourceOwner.objects.find(object => object.name === 'Nix')
  if (!moon) throw new Error('The hierarchy fixture needs an unselected nested Moon.')
  const moonRow = hierarchy.getByRole('treeitem', {
    name: `Select ${moon.locationKey}, ${moon.name} in ${sourceOwner.name}`, exact: true, includeHidden: true,
  })
  await expect(moonRow).toHaveCount(0)

  await sourceRow.focus()
  await sourceRow.press('ArrowRight')
  const moonOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit 1 around Iria, 1 object', exact: true })
  await expect(moonOrbit).toHaveAttribute('aria-expanded', 'false')
  await moonOrbit.focus()
  await moonOrbit.press('ArrowRight')
  await expect(moonRow).toBeVisible()
  await moonOrbit.press('ArrowLeft')
  await expect(moonRow).toHaveCount(0)

  const sourceBranch = hierarchy.getByRole('treeitem', { name: sourceOwner.name, exact: true })
  const sourceAllRecords = sourceBranch.getByRole('button', { name: `Show all ${sourceOwner.name} records`, exact: true })
  const camera = wardenMap(page).locator('.cluster-map-content')
  const cameraBeforeBrowsing = await camera.getAttribute('transform')
  await sourceAllRecords.focus()
  await page.keyboard.press('Enter')
  await expect(sourceAllRecords).toHaveCount(0)
  await expect(sourceBranch).toBeFocused()
  await expect(unrelatedSourceRow).toBeVisible()
  await expect(camera).toHaveAttribute('transform', cameraBeforeBrowsing!)
  await expect(sourceRow).toHaveAttribute('aria-selected', 'true')
  await expect(otherRow).toHaveAttribute('aria-selected', 'true')
  await sourceRow.focus()
  await sourceRow.press('ArrowRight')
  await expect(moonOrbit).toBeFocused()
  await sourceBranch.getByRole('button', { name: `Collapse ${sourceOwner.name}`, exact: true }).click()
  await sourceBranch.getByRole('button', { name: `Expand ${sourceOwner.name}`, exact: true }).click()
  await expect(sourceBranch).toBeFocused()
  // Full browsing and subsequent owner expansion retain an earlier manual child collapse.
  await expect(sourceRow).toHaveAttribute('aria-expanded', 'true')
  await expect(moonOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(moonRow).toHaveCount(0)
  await moonOrbit.focus()
  await moonOrbit.press('ArrowRight')
  await expect(moonRow).toBeVisible()
  await sourceBranch.getByRole('button', { name: `Collapse ${sourceOwner.name}`, exact: true }).click()
  await sourceBranch.getByRole('button', { name: `Expand ${sourceOwner.name}`, exact: true }).click()
  await expect(moonRow).toBeVisible()
  await expect(sourceRow).toHaveAttribute('aria-selected', 'true')
  await expect(otherRow).toHaveAttribute('aria-selected', 'true')
  const otherBranch = hierarchy.getByRole('treeitem', { name: otherOwner.name, exact: true })
  await otherBranch.getByRole('button', { name: `Collapse ${otherOwner.name}`, exact: true }).click()
  await expect(otherRow).toBeHidden()
  await expect(otherMark).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  await setWorkspaceMapMode(page, 'Move')
  const originalTransform = await sourceMark.getAttribute('transform')
  const start = await exposedContinuousObjectHitPoint(otherMark)
  if (!originalTransform || !start) throw new Error('The selected Warden group anchor has no exposed hit target.')
  const destinationRing = wardenMap(page).locator(`.continuous-warden-orbit-target[data-orbit-id="${destinationOrbitId}"]`)
  const destinationCoordinates = await wardenLocalCoordinates(page, otherOwner.id)
  const memberBeforeMove = destinationCoordinates.toClient(await renderedObjectPosition(otherMark))
  const destinationGeometry = await wardenOrbitLocalGeometry(destinationRing, otherOwner.id)
  const destinationPoint = destinationCoordinates.toClient({
    x: destinationGeometry.center.x + destinationGeometry.radii.horizontal + 6,
    y: destinationGeometry.center.y,
  })
  // Move the member in the uninspected owner onto its fixed Orbit while keeping the group selected.
  const dragEnd = {
    x: Math.round(start.x + destinationPoint.x - memberBeforeMove.x),
    y: Math.round(start.y + destinationPoint.y - memberBeforeMove.y),
  }
  const moveSelectedGroup = async () => {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 5 })
  }

  await moveSelectedGroup()
  await expect(page.getByRole('status').filter({ hasText: /Moving 2 selected objects/ })).toBeVisible()
  await expect(sourceMark).not.toHaveAttribute('transform', originalTransform)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(sourceMark).toHaveAttribute('transform', originalTransform)
  expect(await downloadJsonFromFile(page, 'Export Jump Cluster JSON')).toEqual(clusterBeforeGroupMove)
  await openWorkspaceHierarchy(page)
  await expect(otherBranch).toHaveAttribute('aria-expanded', 'false')
  await expect(otherRow).toBeHidden()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  await moveSelectedGroup()
  await expect(page.getByRole('status').filter({ hasText: /Moving 2 selected objects/ })).toBeVisible()
  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  const clusterAfterGroupMove = await downloadJsonFromFile(page, 'Export Jump Cluster JSON')
  const movedOwner = clusterAfterGroupMove.cluster?.systems.find(candidate => candidate.id === otherOwner.id)
  const movedAcrossSystemObject = movedOwner?.objects.find(candidate => candidate.id === otherOwnerObject.id)
  const groupObjectState = (snapshot: typeof clusterBeforeGroupMove, ownerId: string, objectId: string) => {
    const object = snapshot.cluster?.systems.find(candidate => candidate.id === ownerId)?.objects.find(candidate => candidate.id === objectId)
    if (!object) throw new Error(`The Jump Cluster export is missing object "${objectId}".`)
    return { placement: object.placement, angle: snapshot.layout.objectAngles[objectId] }
  }
  expect(groupObjectState(clusterAfterGroupMove, otherOwner.id, otherOwnerObject.id))
    .not.toEqual(groupObjectState(clusterBeforeGroupMove, otherOwner.id, otherOwnerObject.id))
  expect(movedAcrossSystemObject).toBeDefined()
  expect(movedAcrossSystemObject?.placement).toEqual({ kind: 'orbit', orbitId: destinationOrbitId })
  expect(groupObjectState(clusterAfterGroupMove, sourceOwner.id, sourceObject.id))
    .not.toEqual(groupObjectState(clusterBeforeGroupMove, sourceOwner.id, sourceObject.id))
  await openWorkspaceHierarchy(page)
  await expect(otherBranch).toHaveAttribute('aria-expanded', 'true')
  await expect(hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }))
    .toHaveAttribute('aria-expanded', 'true')
  await expect(otherRow).toBeVisible()
  await expect(otherRow).toHaveAttribute('aria-selected', 'true')
  await expect(sourceRow).toHaveAttribute('aria-selected', 'true')
  await expect(unrelatedOtherRow).toHaveCount(0)
  await otherBranch.getByRole('button', { name: `Show all ${otherOwner.name} records`, exact: true }).click()
  await expect(unrelatedOtherRow).toBeVisible()
  await expect(otherBranch).toBeFocused()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()

  const undo = page.getByRole('button', { name: /^Undo: Move selected objects/ })
  const redo = page.getByRole('button', { name: /^Redo: Move selected objects/ })
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJsonFromFile(page, 'Export Jump Cluster JSON')).toEqual(clusterBeforeGroupMove)
  await redo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJsonFromFile(page, 'Export Jump Cluster JSON')).toEqual(clusterAfterGroupMove)

  await page.reload()
  await waitForWorkspaceStartup(page)
  expect(await downloadJsonFromFile(page, 'Export Jump Cluster JSON')).toEqual(clusterAfterGroupMove)
})

freshTest('a sparse Hierarchy context menu survives replacing its selected sibling and returns focus', async ({ page }) => {
  freshTest.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const fixture = JSON.parse(await readFile(new URL('./fixtures/workspace-data-campaign-baseline.json', import.meta.url), 'utf8')) as ExportedMap
  const owner = fixture.cluster?.systems[0]
  const alpha = owner?.objects.find(object => object.name === 'Primary Star')
  const beta = owner?.objects.find(object => object.name === 'Vesper Departure')
  if (!fixture.cluster || !owner || !alpha || !beta) throw new Error('The context fixture needs two sibling objects.')
  alpha.name = 'Context Alpha'
  beta.name = 'Context Beta'
  alpha.placement = { kind: 'system', x: .3, y: .7 }
  beta.placement = { kind: 'system', x: .7, y: .7 }
  owner.objects = [alpha, beta]
  owner.orbits = []
  fixture.cluster.systems = [owner]
  fixture.cluster.routes = []
  fixture.layout.systemPositions = { [owner.id]: { x: .5, y: .5 } }
  fixture.layout.orbitRadii = {}
  fixture.layout.objectAngles = {}
  const [picker] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Open local Jump Cluster backup', exact: true }).click(),
  ])
  await picker.setFiles({ name: 'sparse-context-siblings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await page.getByRole('dialog', { name: 'Open Jump Cluster', exact: true })
    .getByRole('button', { name: 'Open Jump Cluster', exact: true }).click()
  await waitForWorkspaceStartup(page)
  await setWorkspaceMapMode(page, 'Select')
  const alphaMark = wardenObjectMark(page, owner.id, alpha.id)
  const betaMark = wardenObjectMark(page, owner.id, beta.id)
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 12; step += 1) {
    if (await alphaMark.count() && await betaMark.count()
      && await exposedContinuousObjectHitPoint(alphaMark) && await exposedContinuousObjectHitPoint(betaMark)) break
    await zoomIn.click()
  }
  const selectMapObject = async (mark: Locator, modified = false) => {
    const point = await exposedContinuousObjectHitPoint(mark)
    if (!point) throw new Error('The context sibling needs an exposed native map target.')
    if (modified) await page.keyboard.down('Shift')
    try {
      await page.mouse.click(point.x, point.y)
    } finally {
      if (modified) await page.keyboard.up('Shift')
    }
  }
  await selectMapObject(betaMark)
  await hideWorkspaceInspector(page)
  await selectMapObject(alphaMark, true)
  await selectMapObject(betaMark, true)
  await expect(alphaMark).toHaveAttribute('aria-pressed', 'true')
  await expect(betaMark).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toContainText(beta.name)
  const hierarchy = await openWorkspaceHierarchy(page)
  const alphaRow = hierarchy.getByRole('treeitem', {
    name: `Select ${alpha.locationKey}, ${alpha.name} in ${owner.name}`, exact: true, includeHidden: true,
  })
  const betaRow = hierarchy.getByRole('treeitem', {
    name: `Select ${beta.locationKey}, ${beta.name} in ${owner.name}`, exact: true,
  })
  await expect(alphaRow).toHaveAttribute('aria-selected', 'true')
  await expect(betaRow).toHaveAttribute('aria-selected', 'false')
  await expect(hierarchy.getByRole('button', { name: `Show all ${owner.name} records`, exact: true })).toBeVisible()
  const camera = wardenMap(page).locator('.cluster-map-content')
  const cameraBeforeContext = await camera.getAttribute('transform')
  await betaRow.focus()
  await betaRow.press('Shift+F10')
  const menu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  await expect(menu.getByRole('menuitem', { name: 'Move selection', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  // Replacing membership prunes Alpha, moving Beta into its preceding sibling's rendered slot.
  await expect(alphaRow).toHaveCount(0)
  await expect(betaRow).toHaveAttribute('aria-selected', 'true')
  await expect(alphaMark).toHaveAttribute('aria-pressed', 'false')
  await expect(betaMark).toHaveAttribute('aria-pressed', 'true')
  await expect(inspector).toContainText(beta.name)
  await expect(inspector).not.toContainText(alpha.name)
  await expect(camera).toHaveAttribute('transform', cameraBeforeContext!)
  await expect(betaRow).toBeFocused()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
})
