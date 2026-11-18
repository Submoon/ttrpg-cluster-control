import { expect, preparedCampaignTest as test } from './fixtures'
import {
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  clickDockAction,
  downloadImage,
  downloadJson,
  openWorkspaceHierarchy,
  selectInspectorOption,
  setWorkspaceMapMode,
  workspaceZoomControls,
} from './helpers'

test.use({ campaignViewport: { width: 1440, height: 960 } })

type Point = { x: number; y: number }

async function screenPointForClusterScenePoint(
  map: import('@playwright/test').Locator,
  point: Point,
): Promise<Point> {
  return map.evaluate((element, scenePoint) => {
    const content = element.querySelector<SVGGElement>('.cluster-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The Cluster-map scene is not attached.')
    const screen = new DOMPoint(scenePoint.x, scenePoint.y).matrixTransform(transform)
    return { x: screen.x, y: screen.y }
  }, point)
}

async function clickClusterScenePoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: Point,
): Promise<void> {
  const screen = await screenPointForClusterScenePoint(map, point)
  await page.mouse.click(screen.x, screen.y)
}

async function targetPosition(
  target: import('@playwright/test').Locator,
): Promise<Point> {
  return target.evaluate((element) => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
}

async function targetOverflowOfMap(
  map: import('@playwright/test').Locator,
  target: import('@playwright/test').Locator,
): Promise<number> {
  const [mapBounds, markerBounds] = await Promise.all([map.boundingBox(), target.boundingBox()])
  if (!mapBounds || !markerBounds) throw new Error('The map or unresolved marker has no bounds.')
  return Math.max(
    mapBounds.x - markerBounds.x,
    mapBounds.y - markerBounds.y,
    markerBounds.x + markerBounds.width - mapBounds.x - mapBounds.width,
    markerBounds.y + markerBounds.height - mapBounds.y - mapBounds.height,
  )
}

async function dragToClusterScenePoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  target: import('@playwright/test').Locator,
  destination: Point,
): Promise<void> {
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('The unresolved target is not attached to the map.')
  const screen = await screenPointForClusterScenePoint(map, destination)
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(screen.x, screen.y, { steps: 6 })
  await page.mouse.up()
}

async function pinchDuringExitDrag(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  target: import('@playwright/test').Locator,
): Promise<void> {
  const bounds = await target.boundingBox()
  const mapBounds = await map.boundingBox()
  if (!bounds || !mapBounds) throw new Error('The unresolved target is not visible for touch input.')
  const first = { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const towardCenter = first.x < mapBounds.x + mapBounds.width / 2 ? 1 : -1
  const dragged = { ...first, x: first.x + 28 * towardCenter }
  const second = { id: 2, x: dragged.x + 100 * towardCenter, y: dragged.y + 20 }
  const initialPosition = await targetPosition(target)
  const scene = map.locator('.cluster-map-content')
  const initialCamera = await scene.getAttribute('transform')
  const cdp = await page.context().newCDPSession(page)

  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [dragged] })
    await expect.poll(() => targetPosition(target)).not.toEqual(initialPosition)

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [dragged, second] })
    await expect.poll(() => targetPosition(target)).toEqual(initialPosition)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [dragged, { ...second, x: second.x + 36 * towardCenter }],
    })
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(initialCamera)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => targetPosition(target)).toEqual(initialPosition)
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }
}

test('the Warden can move an unresolved target, preview cancellation, save it, and resolve it independently', async ({ campaignWorkspacePage: page }) => {
  test.setTimeout(60000)
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'true')
  await hierarchyToggle.click()
  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  await page.getByRole('spinbutton', { name: 'Jump level', exact: true }).fill('3')
  await selectInspectorOption(page.getByLabel('From system'), 'Vesper Prime')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const clusterMap = page.locator('svg.continuous-warden-map-svg')
  const zoomControls = workspaceZoomControls(page)
  const fit = zoomControls.getByRole('button', { name: 'Fit map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const unresolvedRoute = before.cluster?.routes.find(route => route.toSystemId === null)
  expect(unresolvedRoute).toBeTruthy()
  if (!unresolvedRoute) throw new Error('The created external route was not exported.')
  const routeMark = clusterMap.locator(`.cluster-route[data-route-id="${unresolvedRoute.id}"]`)
  const target = routeMark.locator('.cluster-exit-mark')
  await expect(target).toBeVisible()
  const originSystem = before.cluster?.systems.find(system =>
    system.objects.some(object => object.id === unresolvedRoute.fromPointId),
  )
  const arrival = before.cluster?.systems.find(system => system.name === 'Harrow')?.objects
    .find(object => object.name === 'Harrow Arrival')
  if (!originSystem || !arrival) throw new Error('The campaign is missing a route endpoint.')

  await page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('button', { name: 'Inspect', exact: true })
    .click()
  await setWorkspaceMapMode(page, 'Move')
  await target.click()
  await expect(routeMark).toHaveClass(/is-selected/)
  await test.step('A second touch rolls back the live marker and zooms the same map', async () => {
    await pinchDuringExitDrag(page, clusterMap, target)
    const afterPinch = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(afterPinch.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
    expect(afterPinch.cluster?.routes.find(route => route.id === unresolvedRoute.id)).toEqual(unresolvedRoute)
    await fit.click()
  })
  const dragDestination = { x: 720, y: 390 }
  const sceneOrigin = await screenPointForClusterScenePoint(clusterMap, { x: 0, y: 0 })
  const sceneUnit = await screenPointForClusterScenePoint(clusterMap, { x: 1, y: 0 })
  const pixelsPerSceneUnit = Math.hypot(sceneUnit.x - sceneOrigin.x, sceneUnit.y - sceneOrigin.y)
  await dragToClusterScenePoint(page, clusterMap, target, dragDestination)
  // Native pointer coordinates round to screen pixels before the map transforms them back.
  await expect.poll(async () => {
    const position = await targetPosition(target)
    return Math.hypot(position.x - dragDestination.x, position.y - dragDestination.y) * pixelsPerSceneUnit
  }).toBeLessThan(2)
  await waitForWorkspaceSaved(page)
  const draggedPosition = await targetPosition(target)
  const routeLine = routeMark.locator('.cluster-route-line')
  await expect.poll(async () => (await routeLine.getAttribute('d'))?.endsWith(`${draggedPosition.x} ${draggedPosition.y}`)).toBe(true)
  await expect(routeMark.locator('.cluster-route-destination-caption')).toHaveText('The Rim')

  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 760, y: 350 })
  await expect.poll(() => targetPosition(target)).not.toEqual(draggedPosition)
  const pointerPreview = await targetPosition(target)
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(async () => (await targetPosition(target)).x).toBeLessThan(pointerPreview.x)
  const previewSvg = await downloadImage(page, 'image/svg+xml', 'Entire Cluster')
  const exportedPosition = await page.evaluate(({ source, routeId }) => {
    if (!source) throw new Error('The Warden SVG download has no SVG text.')
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
    const marker = svg.querySelector(`.cluster-route[data-route-id="${CSS.escape(routeId)}"] .cluster-exit-mark`)
    if (!marker) throw new Error('The Warden SVG download is missing the route marker.')
    return { x: Number(marker.getAttribute('cx')), y: Number(marker.getAttribute('cy')) }
  }, { source: previewSvg.text, routeId: unresolvedRoute.id })
  expect(exportedPosition).toEqual(draggedPosition)

  await page.getByRole('button', { name: 'Cancel move', exact: true }).click()
  await expect.poll(() => targetPosition(target)).toEqual(draggedPosition)
  await waitForWorkspaceSaved(page)

  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 760, y: 350 })
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await waitForWorkspaceSaved(page)
  const confirmedPosition = await targetPosition(target)
  expect(Math.abs(confirmedPosition.x - 760)).toBeLessThan(1)
  expect(Math.abs(confirmedPosition.y - 350)).toBeLessThan(1)

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  // Inspect and frame another target on the same camera before revealing the route through Undo.
  await setWorkspaceMapMode(page, 'Select')
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: `Inspect ${originSystem.name}`, exact: true }).click()
  await zoomControls.getByRole('button', { name: 'Center selected target', exact: true }).click()
  const zoomIn = zoomControls.getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 16; step += 1) {
    if (await zoomIn.isDisabled()) break
    await zoomIn.click()
  }
  await expect.poll(() => targetOverflowOfMap(clusterMap, target)).toBeGreaterThan(0)
  const clusterZoomBeforeReveal = await zoomControls.getByRole('status').innerText()
  await undo.click()
  await expect(clusterMap).toBeVisible()
  await waitForWorkspaceSaved(page)
  await expect(routeMark).toHaveClass(/is-selected/)
  await expect.poll(() => targetPosition(target)).toEqual(draggedPosition)
  await expect.poll(() => targetOverflowOfMap(clusterMap, target)).toBeLessThanOrEqual(0)
  await expect(zoomControls.getByRole('status')).toHaveText(clusterZoomBeforeReveal)

  await expect(redo).toBeEnabled()
  await redo.click()
  await expect.poll(() => targetPosition(target)).toEqual(confirmedPosition)
  await waitForWorkspaceSaved(page)

  await page.reload()
  await waitForWorkspaceStartup(page)
  await expect(clusterMap).toBeVisible()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'true')
  await hierarchyToggle.click()
  await fit.click()
  await waitForWorkspaceSaved(page)
  const reloadedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloadedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(confirmedPosition)
  expect(reloadedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)).toEqual(unresolvedRoute)

  await setWorkspaceMapMode(page, 'Select')
  await target.click()
  const reloadedInspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const jumpLevel = page.getByRole('spinbutton', { name: 'Jump level', exact: true })
  await jumpLevel.fill('4')
  await expect(reloadedInspector.getByText('Unapplied route changes', { exact: true })).toBeVisible()
  await setWorkspaceMapMode(page, 'Move')
  const inspectToggle = page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('button', { name: 'Inspect', exact: true })
  await inspectToggle.click()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 700, y: 410 })
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  const movedWithAppliedDraft = await targetPosition(target)
  await inspectToggle.click()
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const appliedDraftExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(appliedDraftExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.jumpLevel).toBe(4)
  expect(appliedDraftExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(movedWithAppliedDraft)

  await setWorkspaceMapMode(page, 'Select')
  await target.click()
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const routeDestination = page.getByLabel('Route destination')
  const toPoint = page.getByLabel('To Jump Point')
  await selectInspectorOption(routeDestination, 'Known system')
  await selectInspectorOption(page.getByLabel('To system'), 'Harrow')
  await selectInspectorOption(toPoint, 'Harrow Arrival (Harrow)')
  await expect(reloadedInspector.getByText('Unapplied route changes', { exact: true })).toBeVisible()
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const resolvedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const resolvedRoute = resolvedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)
  expect(resolvedRoute?.toPointId).toBe(arrival.id)
  expect(resolvedRoute?.toSystemId).toBe(before.cluster?.systems.find(system => system.name === 'Harrow')?.id)
  expect(resolvedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
  await expect(target).toHaveCount(0)

  await setWorkspaceMapMode(page, 'Select')
  await routeMark.focus()
  await page.keyboard.press('Enter')
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const unresolvedAgain = await downloadJson(page, 'Export Jump Cluster JSON')
  const unresolvedAgainRoute = unresolvedAgain.cluster?.routes.find(route => route.id === unresolvedRoute.id)
  expect(unresolvedAgainRoute?.toSystemId).toBeNull()
  expect(unresolvedAgainRoute?.toPointId).toBeNull()
  expect(unresolvedAgain.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
  await expect(target).toBeVisible()
})
