import { expect, test } from './fixtures'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import {
  activeWorkspaceFeedback,
  clickDockAction,
  downloadImage,
  downloadJson,
  readInspectorSelection,
  returnToClusterMap,
  selectInspectorOption,
  setWorkspaceMapMode,
  workspaceZoomControls,
} from './helpers'

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

test('the Warden can move an unresolved target, preview cancellation, save it, and resolve it independently', async ({ page }) => {
  test.setTimeout(60000)
  await importCampaignWorkspace(page, undefined, { width: 1440, height: 960 })
  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  await page.getByRole('spinbutton', { name: 'Jump level', exact: true }).fill('3')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const unresolvedRoute = before.cluster?.routes.find(route => route.toPointId === null)
  expect(unresolvedRoute).toBeTruthy()
  if (!unresolvedRoute) throw new Error('The created external route was not exported.')
  const routeMark = clusterMap.locator(`.cluster-route[data-route-id="${unresolvedRoute.id}"]`)
  const target = routeMark.locator('.cluster-exit-mark')
  await expect(target).toBeVisible()
  const initialPosition = await targetPosition(target)
  const originSystem = before.cluster?.systems.find(system =>
    system.objects.some(object => object.id === unresolvedRoute.fromPointId),
  )
  const originLayoutPosition = originSystem && before.layout.systemPositions?.[originSystem.id]
  expect(originLayoutPosition).toBeTruthy()
  if (!originSystem || !originLayoutPosition) throw new Error('The unresolved route origin has no Cluster-map position.')
  const originScenePosition = {
    x: 112 + originLayoutPosition.x * 736,
    y: 96 + originLayoutPosition.y * 368,
  }
  const automaticOffset = Math.hypot(
    initialPosition.x - originScenePosition.x,
    initialPosition.y - originScenePosition.y,
  )
  expect(automaticOffset).toBeGreaterThan(150)
  expect(automaticOffset).toBeLessThan(250)

  await page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('button', { name: 'Inspect', exact: true })
    .click()
  await setWorkspaceMapMode(page, 'Move')
  await target.click()
  await expect(routeMark).toHaveClass(/is-selected/)
  await expect(page.getByRole('button', { name: 'Move on map', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, initialPosition)
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  const anchoredAutomaticPosition = await targetPosition(target)
  const anchoredExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(anchoredExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(anchoredAutomaticPosition)

  await dragToClusterScenePoint(page, clusterMap, target, { x: 720, y: 390 })
  await expect.poll(() => targetPosition(target)).not.toEqual(initialPosition)
  const draggedPosition = await targetPosition(target)
  const draggedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(draggedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(draggedPosition)
  expect(draggedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)).toEqual(unresolvedRoute)
  const routeLine = routeMark.locator('.cluster-route-line')
  await expect(routeLine).toHaveAttribute('d', new RegExp(`${draggedPosition.x} ${draggedPosition.y}$`))
  await expect(routeMark.locator('.cluster-exit-label')).toHaveText('Unknown: The Rim')

  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 760, y: 350 })
  await page.keyboard.press('Shift+ArrowLeft')
  const previewPosition = await targetPosition(target)
  expect(previewPosition.x).toBeLessThan(760)
  const previewExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(previewExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(draggedPosition)
  const previewSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expect(previewSvg.text).toContain(`cx="${draggedPosition.x}"`)
  expect(previewSvg.text).not.toContain(`cx="${previewPosition.x}"`)

  await page.getByRole('button', { name: 'Cancel move', exact: true }).click()
  await expect.poll(() => targetPosition(target)).toEqual(draggedPosition)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 760, y: 350 })
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const confirmedPosition = await targetPosition(target)
  expect(Math.abs(confirmedPosition.x - 760)).toBeLessThan(1)
  expect(Math.abs(confirmedPosition.y - 350)).toBeLessThan(1)

  const confirmedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(confirmedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(confirmedPosition)
  expect(confirmedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)).toEqual(unresolvedRoute)
  await page.reload()
  await returnToClusterMap(page)
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const reloadedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloadedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(confirmedPosition)

  await setWorkspaceMapMode(page, 'Select')
  const reloadedRouteMark = clusterMap.locator(`.cluster-route[data-route-id="${unresolvedRoute.id}"]`)
  await reloadedRouteMark.locator('.cluster-exit-mark').click()
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
  const movedWithAppliedDraft = await targetPosition(reloadedRouteMark.locator('.cluster-exit-mark'))
  await inspectToggle.click()
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const appliedDraftExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(appliedDraftExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.jumpLevel).toBe(4)
  expect(appliedDraftExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(movedWithAppliedDraft)

  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await jumpLevel.fill('5')
  await expect(reloadedInspector.getByText('Unapplied route changes', { exact: true })).toBeVisible()
  await setWorkspaceMapMode(page, 'Move')
  await inspectToggle.click()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await clickClusterScenePoint(page, clusterMap, { x: 740, y: 400 })
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  const movedWithDiscardedDraft = await targetPosition(reloadedRouteMark.locator('.cluster-exit-mark'))
  await inspectToggle.click()
  await reloadedInspector.getByRole('button', { name: 'Discard changes', exact: true }).click()
  const discardedDraftExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(discardedDraftExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.jumpLevel).toBe(4)
  expect(discardedDraftExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toEqual(movedWithDiscardedDraft)

  await setWorkspaceMapMode(page, 'Select')
  await reloadedRouteMark.locator('.cluster-exit-mark').click()
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const routeDestination = page.getByLabel('Route destination')
  const toPoint = page.getByLabel('To Jump Point')
  await selectInspectorOption(routeDestination, 'Known Jump Point')
  await expect.poll(() => readInspectorSelection(routeDestination)).toBe('Known Jump Point')
  await selectInspectorOption(toPoint, 'Harrow Arrival (Harrow)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
  await expect(reloadedInspector.getByText('Unapplied route changes', { exact: true })).toBeVisible()
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const resolvedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(resolvedExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)?.toPointId).toBeTruthy()
  expect(resolvedExport.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()

  await setWorkspaceMapMode(page, 'Select')
  const resolvedRouteMark = clusterMap.locator(`.cluster-route[data-route-id="${unresolvedRoute.id}"]`)
  await resolvedRouteMark.click()
  await reloadedInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('The Rim')
  await reloadedInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  const unresolvedAgain = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(unresolvedAgain.layout.unresolvedExitPositions?.[unresolvedRoute.id]).toBeUndefined()
})
