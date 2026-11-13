import { expect, preparedCampaignTest as test } from './fixtures'
import {
  waitForWorkspaceSaved,
  clickDockAction,
  downloadImage,
  downloadJson,
  openWorkspaceHierarchy,
  returnToClusterMap,
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

test('the Warden can move an unresolved target, preview cancellation, save it, and resolve it independently', async ({ campaignWorkspacePage: page }) => {
  test.setTimeout(60000)
  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  await page.getByRole('spinbutton', { name: 'Jump level', exact: true }).fill('3')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const unresolvedRoute = before.cluster?.routes.find(route => route.toPointId === null)
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
  const dragDestination = { x: 720, y: 390 }
  await dragToClusterScenePoint(page, clusterMap, target, dragDestination)
  // Native pointer coordinates round to screen pixels before the map transforms them back.
  await expect.poll(async () => {
    const position = await targetPosition(target)
    return Math.hypot(position.x - dragDestination.x, position.y - dragDestination.y)
  }).toBeLessThan(2)
  const draggedPosition = await targetPosition(target)
  const routeLine = routeMark.locator('.cluster-route-line')
  await expect(routeLine).toHaveAttribute('d', new RegExp(`${draggedPosition.x} ${draggedPosition.y}$`))
  await expect(routeMark.locator('.cluster-exit-label')).toHaveText('Unknown: The Rim')

  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 760, y: 350 })
  const pointerPreview = await targetPosition(target)
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(async () => (await targetPosition(target)).x).toBeLessThan(pointerPreview.x)
  const previewPosition = await targetPosition(target)
  const previewSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expect(previewSvg.text).toContain(`cx="${draggedPosition.x}"`)
  expect(previewSvg.text).not.toContain(`cx="${previewPosition.x}"`)

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
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 16; step += 1) {
    if (await zoomIn.isDisabled()) break
    await zoomIn.click()
  }
  const clusterZoomBeforeReveal = await workspaceZoomControls(page).getByRole('status').innerText()

  // Undo while inside the source system must restore the global route action in its Cluster context.
  await setWorkspaceMapMode(page, 'Navigate')
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', {
    name: `Open ${originSystem.name} system map`,
    exact: true,
  }).click()
  await expect(page.getByRole('group', { name: `${originSystem.name} star system map`, exact: true })).toBeVisible()
  await undo.click()
  await expect(clusterMap).toBeVisible()
  await waitForWorkspaceSaved(page)
  await expect(routeMark).toHaveClass(/is-selected/)
  await expect.poll(() => targetPosition(target)).toEqual(draggedPosition)
  await expect.poll(async () => {
    const [mapBounds, markerBounds] = await Promise.all([clusterMap.boundingBox(), target.boundingBox()])
    if (!mapBounds || !markerBounds) return Number.POSITIVE_INFINITY
    return Math.max(
      mapBounds.x - markerBounds.x,
      mapBounds.y - markerBounds.y,
      markerBounds.x + markerBounds.width - mapBounds.x - mapBounds.width,
      markerBounds.y + markerBounds.height - mapBounds.y - mapBounds.height,
    )
  }).toBeLessThanOrEqual(0)
  await expect(workspaceZoomControls(page).getByRole('status')).toHaveText(clusterZoomBeforeReveal)

  await expect(redo).toBeEnabled()
  await redo.click()
  await expect.poll(() => targetPosition(target)).toEqual(confirmedPosition)
  await waitForWorkspaceSaved(page)

  await page.reload()
  await returnToClusterMap(page)
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
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
  await selectInspectorOption(routeDestination, 'Known Jump Point')
  await selectInspectorOption(toPoint, 'Harrow Arrival (Harrow)')
  await expect(reloadedInspector.getByText('Unapplied route changes', { exact: true })).toBeVisible()
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const resolvedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(resolvedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.toPointId).toBe(arrival.id)
  expect(resolvedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
  await expect(target).toHaveCount(0)

  await setWorkspaceMapMode(page, 'Select')
  await routeMark.click()
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const unresolvedAgain = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(unresolvedAgain.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.toPointId).toBeNull()
  expect(unresolvedAgain.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
  await expect(target).toBeVisible()
})
