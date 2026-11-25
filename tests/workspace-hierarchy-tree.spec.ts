import { readFile } from 'node:fs/promises'
import { expect, test as freshTest, type Locator } from './fixtures'
import {
  createSingleSystemWorkspace,
  type DownloadWindow,
  editMapObject,
  exposedContinuousObjectHitPoint,
  type ExportedMap,
  hideWorkspaceInspector,
  openMapFilesSection,
  openWorkspaceHierarchy,
  saveMapObject,
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

freshTest('Select distinguishes a single object drag from a selection click', async ({ page }) => {
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 900 },
  })
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  const hitPoint = async () => {
    const point = await exposedContinuousObjectHitPoint(star)
    if (!point) throw new Error('The primary Star needs an exposed pointer target.')
    return point
  }
  const dragStar = async () => {
    const { x, y } = await hitPoint()
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 24, y + 18, { steps: 5 })
  }
  const undoMove = page.getByRole('button', { name: /^Undo: Move / })
  const originalPosition = await wardenObjectLocalPosition(star)
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await dragStar()
  await page.mouse.up()
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expect(undoMove).toHaveCount(0)
  const positionAfterUnselectedDrag = await wardenObjectLocalPosition(star)
  expect(positionAfterUnselectedDrag.x).toBeCloseTo(originalPosition.x, 2)
  expect(positionAfterUnselectedDrag.y).toBeCloseTo(originalPosition.y, 2)

  const clickStar = async () => {
    const { x, y } = await hitPoint()
    await page.mouse.click(x, y)
  }
  await clickStar()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await hideWorkspaceInspector(page)
  await clickStar()
  await expect(page.getByRole('region', { name: 'Object inspector', exact: true })).toBeVisible()
  await hideWorkspaceInspector(page)
  await dragStar()
  await expect.poll(async () => (await wardenObjectLocalPosition(star)).x)
    .not.toBeCloseTo(originalPosition.x, 2)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(async () => (await wardenObjectLocalPosition(star)).x)
    .toBeCloseTo(originalPosition.x, 2)
  await expect(undoMove).toHaveCount(0)

  await dragStar()
  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  await expect.poll(async () => (await wardenObjectLocalPosition(star)).x)
    .not.toBeCloseTo(originalPosition.x, 2)
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await expect(undoMove).toBeEnabled()
  await undoMove.click()
  await waitForWorkspaceSaved(page)
  await expect.poll(async () => (await wardenObjectLocalPosition(star)).x)
    .toBeCloseTo(originalPosition.x, 2)
  await expect(undoMove).toHaveCount(0)
})

freshTest('a Warden edits an object and moves a group onto an Orbit in Select', async ({ page }) => {
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
  await sourceMark.press('Enter')
  await editMapObject(page)
  const notes = page.getByRole('region', { name: 'Object inspector', exact: true }).getByLabel('GM notes', { exact: true })
  await notes.fill('Surveyed before the move.')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
  await hideWorkspaceInspector(page)
  const clusterBeforeGroupMove = await downloadJsonFromFile(page, 'Export Jump Cluster JSON')
  expect(clusterBeforeGroupMove.cluster?.systems.find(system => system.id === sourceOwner.id)
    ?.objects.find(object => object.id === sourceObject.id)?.description).toBe('Surveyed before the move.')
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

  await setWorkspaceMapMode(page, 'Select')
  await moveSelectedGroup()
  await expect(page.getByRole('status').filter({ hasText: /Moving 2 selected objects/ })).toBeVisible()
  await page.mouse.up()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Select', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
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
