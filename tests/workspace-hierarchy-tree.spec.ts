import { expect, preparedCampaignTest as test, type Locator } from './fixtures'
import {
  captureMapExportBlobs,
  downloadJson,
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  returnToClusterMap,
  snapshotSvgCoordinates,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

async function renderedObjectPosition(mark: Locator): Promise<{ x: number; y: number }> {
  const transform = await mark.getAttribute('transform')
  const match = transform?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
  if (!match) throw new Error('A system object has no rendered position.')
  return { x: Number(match[1]), y: Number(match[2]) }
}

function expectPositionNear(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  tolerance = 1.1,
): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance)
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance)
}

test('multi-select objects and preserve Hierarchy keyboard behavior through reflow', async ({
  campaignWorkspacePage: page,
}, testInfo) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()

  let hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const departureRow = hierarchy.getByRole('treeitem', { name: 'Select JP-01, Vesper Departure', exact: true })
  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  const selectedMapObjects = map.locator('.system-object.is-selected')
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const starObject = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  const planetObject = map.getByRole('button', { name: 'Select PL-01, Iria (Planet)', exact: true })
  const departureObject = map.getByRole('button', {
    name: 'Select JP-01, Vesper Departure (Jump Point)',
    exact: true,
  })
  const starId = await starObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  if (!starId) throw new Error('Primary Star has no stable map identity.')

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await filters.getByRole('group', { name: 'Celestial body', exact: true })
    .getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()

  await setWorkspaceMapMode(page, 'Select')
  await starObject.click()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(inspector).toContainText('Primary Star')

  const singleSelectionMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await planetObject.locator('.object-hit-target').click({ button: 'right' })
  await singleSelectionMenu.getByRole('menuitem', { name: 'Move selection', exact: true }).click()
  const moveModeButton = workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true })
  await expect(moveModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await setWorkspaceMapMode(page, 'Select')

  await iria.click({ button: 'right' })
  await singleSelectionMenu.getByRole('menuitem', { name: 'Move selection', exact: true }).click()
  await expect(moveModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await setWorkspaceMapMode(page, 'Select')

  await planetObject.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(starObject).toHaveClass(/\bis-dimmed\b/)
  await expect(starObject).toHaveAttribute('aria-pressed', 'true')
  await expect(planetObject).not.toHaveClass(/\bis-dimmed\b/)
  await expect(primaryStar).toHaveAttribute('aria-description', /Dimmed on map/)
  await expect(hierarchy.locator('[aria-current="true"]')).toHaveCount(0)
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true }).click()
  await filters.getByRole('button', { name: 'Clear all', exact: true }).click()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(starObject).not.toHaveClass(/\bis-dimmed\b/)
  await expect(selectedMapObjects).toHaveCount(2)

  await departureRow.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(3)
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('3 objects selected', { exact: true })).toBeVisible()

  await departureRow.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(departureRow).toHaveAttribute('aria-selected', 'false')

  await planetObject.locator('.object-hit-target').click({ button: 'right' })
  const selectedObjectMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await expect(selectedObjectMenu.getByRole('menuitem', { name: 'Move selection', exact: true })).toBeVisible()
  await selectedObjectMenu.getByRole('menuitem', { name: 'Change Visibility', exact: true }).hover()
  const selectedVisibilityMenu = page.getByRole('menu', { name: 'Change Visibility', exact: true })
  await expect(selectedVisibilityMenu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(selectedObjectMenu).toHaveCount(0)
  await expect(selectedMapObjects).toHaveCount(2)

  await departureObject.locator('.object-hit-target').click({ button: 'right' })
  const visibilityMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await visibilityMenu.getByRole('menuitem', { name: 'Change Visibility', exact: true }).hover()
  await page.getByRole('menu', { name: 'Change Visibility', exact: true })
    .getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).click()

  await expect(departureRow).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await expect(iria).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(page.getByText('2 objects selected', { exact: true })).toBeVisible()

  const transformBeforeNavigation = await map.locator('.system-map-content').evaluate((scene) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The system map scene has no screen transform.')
    return Math.hypot(matrix.a, matrix.b)
  })
  const mapNavigation = await openWorkspaceZoomNavigation(page)
  await mapNavigation.getByRole('button', { name: 'Pan map right', exact: true }).click()

  const zoomControls = workspaceZoomControls(page)
  const zoomNavigationToggle = zoomControls.getByRole('button', {
    name: 'Open map navigation controls',
    exact: true,
  })
  await zoomNavigationToggle.click()
  const zoomIn = zoomControls.getByRole('button', { name: 'Zoom in', exact: true })
  await expect(zoomIn).toBeVisible()
  await expect(zoomIn).toBeEnabled()
  await zoomIn.click()
  const transformAfterNavigation = await map.locator('.system-map-content').evaluate((scene) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The system map scene has no screen transform.')
    return Math.hypot(matrix.a, matrix.b)
  })
  expect(transformAfterNavigation).toBeGreaterThan(transformBeforeNavigation)

  const anchors = await map.locator('.system-object').evaluateAll(marks => marks.map((mark) => {
    const id = mark.getAttribute('data-object-id')
    const matrix = (mark as SVGGraphicsElement).getScreenCTM()
    if (!id || !matrix) throw new Error('A system object has no ID or screen transform.')
    const point = new DOMPoint(0, 0).matrixTransform(matrix)
    return { id, x: point.x, y: point.y }
  }))
  const departureId = await departureObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  if (!departureId) throw new Error('Vesper Departure has no stable map identity.')
  const departureAnchor = anchors.find(anchor => anchor.id === departureId)
  if (!departureAnchor) throw new Error('Vesper Departure has no resolved map anchor.')

  const svgBounds = await map.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
  })
  let rectangle: { start: { x: number; y: number }; end: { x: number; y: number } } | undefined
  for (const radius of [48, 64, 80, 96]) {
    const start = { x: departureAnchor.x - radius, y: departureAnchor.y - radius }
    const end = { x: departureAnchor.x + radius, y: departureAnchor.y + radius }
    if (start.x < svgBounds.left + 12 || end.x > svgBounds.right - 12
      || start.y < svgBounds.top + 12 || end.y > svgBounds.bottom - 12) continue

    const enclosed = anchors.filter(anchor => anchor.x >= start.x && anchor.x <= end.x
      && anchor.y >= start.y && anchor.y <= end.y)
    if (enclosed.length !== 1 || enclosed[0]?.id !== departureId) continue

    const startsOnBackground = await map.evaluate((element, point) => {
      const hit = document.elementFromPoint(point.x, point.y)
      return hit === element || (hit instanceof Element && hit.matches('.map-background, .map-grid'))
    }, start)
    if (startsOnBackground) {
      rectangle = { start, end }
      break
    }
  }
  if (!rectangle) throw new Error('Could not find a clear rectangle around Vesper Departure at the transformed zoom.')

  await expect(zoomIn).toBeFocused()
  await page.mouse.move(rectangle.start.x, rectangle.start.y)
  await page.mouse.down()
  await page.mouse.move(rectangle.end.x, rectangle.end.y, { steps: 6 })
  const preview = page.locator('.workspace-selection-rectangle')
  await expect(preview).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await page.mouse.up()
  await expect(selectedMapObjects).toHaveCount(2)

  await page.mouse.move(rectangle.start.x, rectangle.start.y)
  await page.mouse.down()
  await page.mouse.move(rectangle.end.x, rectangle.end.y, { steps: 6 })
  await page.mouse.up()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', departureId)
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')
  await expect(inspector).toContainText('Vesper Departure')

  await page.mouse.click(rectangle.start.x, rectangle.start.y)
  await expect(selectedMapObjects).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Jump Cluster details', exact: true })).toBeVisible()

  await starObject.click()
  await expect(selectedMapObjects).toHaveCount(1)
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', starId)
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')

  await testInfo.attach('hierarchy-tree-expanded', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  await primaryStar.click()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.type('Iria')
  await expect(iria).toBeFocused()

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await testInfo.attach('hierarchy-tree-collapsed', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  await expect(iria).toBeHidden()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await expect(iria).toBeVisible()
  await page.keyboard.press('Home')
  await expect(primaryStar).toBeFocused()
  await page.keyboard.press('End')
  await expect(departureRow).toBeFocused()

  await setWorkspaceMapMode(page, 'Navigate')
  await iria.focus()
  const navigation = workspaceNavigation(page)
  const navigateButton = navigation.getByRole('button', { name: 'Navigate', exact: true })
  const selectButton = navigation.getByRole('button', { name: 'Select', exact: true })
  const moveButton = navigation.getByRole('button', { name: 'Move', exact: true })
  const addButton = navigation.getByRole('button', { name: 'Add to map', exact: true })
  await expect(selectedMapObjects).toHaveAttribute('data-object-id', /.+/)
  const selectedObjectId = await selectedMapObjects.getAttribute('data-object-id')
  if (!selectedObjectId) throw new Error('The selected map object has no stable identity.')

  for (const key of ['n', 's', 'm', 'a']) {
    await page.keyboard.press(key)
    await expect(navigateButton).toHaveAttribute('aria-pressed', 'true')
    await expect(selectButton).toHaveAttribute('aria-pressed', 'false')
    await expect(moveButton).toHaveAttribute('aria-pressed', 'false')
    await expect(addButton).toHaveAttribute('aria-expanded', 'false')
    await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
    await expect(selectedMapObjects).toHaveAttribute('data-object-id', selectedObjectId)
  }

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(hierarchy).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const compactPrimaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  await expect(compactPrimaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }))
    .toHaveAttribute('aria-selected', 'true')

  await page.setViewportSize({ width: 1440, height: 900 })
  await openWorkspaceHierarchy(page, 'System hierarchy')
  await setWorkspaceMapMode(page, 'Select')
  await primaryOrbit.focus()
  await page.keyboard.press('ArrowRight')
  await expect(iria).toBeVisible()
  await primaryStar.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(0)
  await iria.click({ modifiers: ['Shift'] })
  await departureRow.click({ modifiers: ['Shift'] })
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(departureRow).toHaveAttribute('aria-selected', 'true')

  await planetObject.locator('.object-hit-target').click({ button: 'right' })
  const moveSelectionMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await moveSelectionMenu.getByRole('menuitem', { name: 'Move selection', exact: true }).click()
  await expect(moveModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedMapObjects).toHaveCount(2)

  await captureMapExportBlobs(page)
  const beforeMove = await downloadJson(page, 'Export star system JSON')
  const system = beforeMove.system
  if (!system) throw new Error('The selected Vesper Prime map did not export a system.')
  const iriaId = await planetObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  const groupDepartureId = await departureObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  const nixObject = map.getByRole('button', { name: 'Select MO-01, Nix (Moon)', exact: true })
  const nixId = await nixObject.evaluate(mark => mark.closest('.system-object')?.getAttribute('data-object-id'))
  if (!iriaId || !groupDepartureId || !nixId) throw new Error('The selected movement fixture is missing an object identity.')
  const initialObject = (id: string) => {
    const object = system.objects.find(candidate => candidate.id === id)
    if (!object) throw new Error(`The exported system is missing object "${id}".`)
    return object
  }
  const initialIria = initialObject(iriaId)
  const initialDeparture = initialObject(groupDepartureId)
  const initialNix = initialObject(nixId)
  if (initialIria.placement.kind !== 'orbit' || initialNix.placement.kind !== 'orbit') {
    throw new Error('Iria and Nix must begin in their expected Orbits for this movement scenario.')
  }
  const starMark = map.locator(`.system-object[data-object-id="${starId}"]`)
  const iriaMark = map.locator(`.system-object[data-object-id="${iriaId}"]`)
  const groupDepartureMark = map.locator(`.system-object[data-object-id="${groupDepartureId}"]`)
  const nixMark = map.locator(`.system-object[data-object-id="${nixId}"]`)
  const starBeforeMove = await renderedObjectPosition(starMark)
  const iriaBeforeMove = await renderedObjectPosition(iriaMark)
  const departureBeforeMove = await renderedObjectPosition(groupDepartureMark)
  const nixBeforeMove = await renderedObjectPosition(nixMark)
  const destinationOrbitId = initialIria.placement.orbitId
  const destinationRing = map.locator(`.orbit-mark[data-orbit-id="${destinationOrbitId}"] .orbit-ring`)
  const destinationRadius = Number(await destinationRing.getAttribute('rx'))
  expect(destinationRadius).toBeGreaterThan(0)
  expect(Number(await destinationRing.getAttribute('ry'))).toBe(destinationRadius)
  const hitTarget = planetObject.locator('.object-hit-target')
  const sourceBounds = await hitTarget.boundingBox()
  if (!sourceBounds) throw new Error('Iria has no rendered hit target for the group drag.')
  const sourceClient = {
    x: Math.round(sourceBounds.x + sourceBounds.width / 2),
    y: Math.round(sourceBounds.y + sourceBounds.height / 2),
  }
  const sceneCoordinates = await snapshotSvgCoordinates(map.locator('.system-map-content'))
  const sourceScene = sceneCoordinates.fromClient(sourceClient)
  // Aim the ungrabbed jump point just outside the fixed circular Orbit's right edge.
  const target = {
    x: sourceScene.x + starBeforeMove.x + destinationRadius + 6 - departureBeforeMove.x,
    y: sourceScene.y + starBeforeMove.y - departureBeforeMove.y,
  }
  const targetClient = sceneCoordinates.toClient(target)
  const deliveredTargetClient = { x: Math.round(targetClient.x), y: Math.round(targetClient.y) }
  const deliveredTarget = sceneCoordinates.fromClient(deliveredTargetClient)
  const rawOffset = {
    x: departureBeforeMove.x + deliveredTarget.x - sourceScene.x - starBeforeMove.x,
    y: departureBeforeMove.y + deliveredTarget.y - sourceScene.y - starBeforeMove.y,
  }
  const scaleToRing = destinationRadius / Math.hypot(rawOffset.x, rawOffset.y)
  const snappedDelta = {
    x: starBeforeMove.x + rawOffset.x * scaleToRing - departureBeforeMove.x,
    y: starBeforeMove.y + rawOffset.y * scaleToRing - departureBeforeMove.y,
  }
  const startGroupDrag = async (destination = deliveredTargetClient) => {
    await page.mouse.move(sourceClient.x, sourceClient.y)
    await page.mouse.down()
    await page.mouse.move(destination.x, destination.y, { steps: 6 })
  }

  await expect(moveModeButton).toHaveAttribute('aria-pressed', 'true')
  // Aim Iria just outside another point of its own fixed Orbit.
  const radiusComponent = (destinationRadius + 6) / Math.sqrt(2)
  const sameOrbitClient = sceneCoordinates.toClient({
    x: sourceScene.x + starBeforeMove.x + radiusComponent - iriaBeforeMove.x,
    y: sourceScene.y + starBeforeMove.y - radiusComponent - iriaBeforeMove.y,
  })
  await startGroupDrag({ x: Math.round(sameOrbitClient.x), y: Math.round(sameOrbitClient.y) })
  const iriaOnCurrentOrbit = await renderedObjectPosition(iriaMark)
  expect(Math.abs(Math.hypot(
    iriaOnCurrentOrbit.x - starBeforeMove.x,
    iriaOnCurrentOrbit.y - starBeforeMove.y,
  ) - destinationRadius)).toBeLessThan(1.1)
  expect(iriaOnCurrentOrbit.x).toBeGreaterThan(starBeforeMove.x + destinationRadius / 2)
  await expect(iriaMark.locator('.selected-object-departure-indicator')).toHaveAttribute('visibility', 'hidden')
  await iriaMark.focus()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(selectedMapObjects).toHaveCount(2)

  await startGroupDrag()
  await expect(iriaMark.locator('.selected-object-departure-indicator')).toHaveAttribute('visibility', 'visible')
  await expect(groupDepartureMark.locator('.selected-object-arrival-indicator')).toHaveAttribute('visibility', 'visible')
  expectPositionNear(await renderedObjectPosition(iriaMark), {
    x: iriaBeforeMove.x + snappedDelta.x,
    y: iriaBeforeMove.y + snappedDelta.y,
  })
  expectPositionNear(await renderedObjectPosition(groupDepartureMark), {
    x: departureBeforeMove.x + snappedDelta.x,
    y: departureBeforeMove.y + snappedDelta.y,
  })
  expectPositionNear(await renderedObjectPosition(nixMark), {
    x: nixBeforeMove.x + snappedDelta.x,
    y: nixBeforeMove.y + snappedDelta.y,
  })
  expectPositionNear(await renderedObjectPosition(starMark), starBeforeMove)
  await expect(selectedMapObjects).toHaveCount(2)
  const movePreviewScreenshot = testInfo.outputPath('selected-object-move-preview.png')
  await page.screenshot({ path: movePreviewScreenshot, animations: 'disabled' })
  await testInfo.attach('selected-object-move-preview', {
    path: movePreviewScreenshot,
    contentType: 'image/png',
  })
  await iriaMark.focus()
  await page.keyboard.press('Escape')
  await expect(selectedMapObjects).toHaveCount(2)
  await expect(iriaMark.locator('.selected-object-departure-indicator')).toHaveAttribute('visibility', 'hidden')
  await expect(groupDepartureMark.locator('.selected-object-arrival-indicator')).toHaveAttribute('visibility', 'hidden')
  await page.mouse.up()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforeMove)

  await startGroupDrag()
  await expect(iriaMark.locator('.selected-object-departure-indicator')).toHaveAttribute('visibility', 'visible')
  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  expectPositionNear(await renderedObjectPosition(groupDepartureMark), {
    x: departureBeforeMove.x + snappedDelta.x,
    y: departureBeforeMove.y + snappedDelta.y,
  })
  await expect(selectedMapObjects).toHaveCount(2)
  await planetObject.focus()
  await page.keyboard.press('Escape')
  await expect(selectedMapObjects).toHaveCount(0)

  const moved = await downloadJson(page, 'Export star system JSON')
  const movedSystem = moved.system
  if (!movedSystem) throw new Error('The moved Vesper Prime map did not export a system.')
  const movedObject = (id: string) => {
    const object = movedSystem.objects.find(candidate => candidate.id === id)
    if (!object) throw new Error(`The moved system is missing object "${id}".`)
    return object
  }
  const movedIria = movedObject(iriaId)
  const movedDeparture = movedObject(groupDepartureId)
  const movedNix = movedObject(nixId)
  expect(movedObject(starId).placement).toEqual(initialObject(starId).placement)
  expect(movedIria.placement.kind).toBe('system')
  expect(movedNix.placement).toEqual(initialNix.placement)
  expect(movedDeparture.placement).toEqual({ kind: 'orbit', orbitId: destinationOrbitId })
  expect(movedIria.placement.kind === 'system' ? movedIria.placement.x : 0)
    .toBeCloseTo((iriaBeforeMove.x + snappedDelta.x - 64) / 832, 5)
  expect(movedIria.placement.kind === 'system' ? movedIria.placement.y : 0)
    .toBeCloseTo((iriaBeforeMove.y + snappedDelta.y - 72) / 416, 5)
  expect(movedDeparture.placement).not.toEqual(initialDeparture.placement)

  const undo = page.getByRole('button', { name: /^Undo: Move selected objects/ })
  const redo = page.getByRole('button', { name: /^Redo: Move selected objects/ })
  await expect(undo).toBeEnabled()
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforeMove)
  await expect(redo).toBeEnabled()
  await redo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(moved)

  await page.reload()
  await waitForWorkspaceStartup(page)
  await returnToClusterMap(page)
  const restoredHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await restoredHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(moved)
})
