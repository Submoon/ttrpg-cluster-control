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

async function sceneHorizontalGap(
  map: import('@playwright/test').Locator,
  screenStartX: number,
  screenEndX: number,
): Promise<number> {
  return map.evaluate((element, screenPoints) => {
    const contentTransform = element.querySelector<SVGGElement>('.cluster-map-content')?.getScreenCTM()
    if (!contentTransform) throw new Error('The Cluster map has no active scene transform.')
    const screenToScene = contentTransform.inverse()
    const start = new DOMPoint(screenPoints[0], 0).matrixTransform(screenToScene).x
    const end = new DOMPoint(screenPoints[1], 0).matrixTransform(screenToScene).x
    return end - start
  }, [screenStartX, screenEndX])
}

async function targetGeometrySnapshot(routeMark: import('@playwright/test').Locator): Promise<{
  path: string | null
  marker: Array<string | null>
  badge: Array<string | null>
  badgeText: Array<string | null>
  caption: Array<string | null>
}> {
  return routeMark.evaluate(mark => {
    const attributes = (selector: string, names: string[]) => {
      const element = mark.querySelector(selector)
      return names.map(name => element?.getAttribute(name) ?? null)
    }
    return {
      path: mark.querySelector('.cluster-route-line')?.getAttribute('d') ?? null,
      marker: attributes('.cluster-exit-mark', ['cx', 'cy']),
      badge: attributes('.cluster-route-label-bg', ['x', 'y', 'width', 'height']),
      badgeText: attributes('.cluster-route-label', ['x', 'y']),
      caption: attributes('.cluster-exit-label', ['x', 'y', 'text-anchor', 'textLength']),
    }
  })
}

async function attachMapDetailScreenshot(
  page: import('@playwright/test').Page,
  bounds: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<void> {
  const viewport = page.viewportSize()
  if (!viewport || bounds.length === 0) return
  const left = Math.max(0, Math.floor(Math.min(...bounds.map(box => box.x)) - 12))
  const top = Math.max(0, Math.floor(Math.min(...bounds.map(box => box.y)) - 12))
  const right = Math.min(viewport.width, Math.ceil(Math.max(...bounds.map(box => box.x + box.width)) + 12))
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(...bounds.map(box => box.y + box.height)) + 12))
  if (right <= left || bottom <= top) return
  await test.info().attach('unresolved-exit-card-and-label-detail', {
    body: await page.screenshot({ clip: { x: left, y: top, width: right - left, height: bottom - top } }),
    contentType: 'image/png',
  })
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
  expect(automaticOffset).toBeGreaterThan(125)
  expect(automaticOffset).toBeLessThan(145)

  const sourceCard = clusterMap.locator(`.cluster-system-node[data-system-id="${originSystem.id}"] .cluster-system-card`)
  const sourceBounds = await sourceCard.boundingBox()
  const targetBounds = await target.boundingBox()
  if (!sourceBounds || !targetBounds) throw new Error('The source system card or unresolved target has no visible bounds.')
  const gapInSceneUnits = await sceneHorizontalGap(
    clusterMap,
    sourceBounds.x + sourceBounds.width,
    targetBounds.x,
  )
  expect(gapInSceneUnits).toBeGreaterThanOrEqual(40)
  expect(gapInSceneUnits).toBeLessThanOrEqual(60)

  const routeBadge = routeMark.locator('.cluster-route-label-bg')
  const exitCaption = routeMark.locator('.cluster-exit-label')
  const [badgeBounds, captionBounds] = await Promise.all([routeBadge.boundingBox(), exitCaption.boundingBox()])
  if (!badgeBounds || !captionBounds) throw new Error('The unresolved route labels have no visible bounds.')
  const sourceRight = sourceBounds.x + sourceBounds.width
  const sourceBottom = sourceBounds.y + sourceBounds.height
  expect(badgeBounds.x).toBeGreaterThan(sourceRight)
  const captionOverlapsCardHorizontally = captionBounds.x < sourceRight
    && captionBounds.x + captionBounds.width > sourceBounds.x
  const captionOverlapsCardVertically = captionBounds.y < sourceBottom
    && captionBounds.y + captionBounds.height > sourceBounds.y
  expect(captionOverlapsCardHorizontally && captionOverlapsCardVertically).toBe(false)
  await attachMapDetailScreenshot(page, [sourceBounds, targetBounds, badgeBounds, captionBounds])
  await test.info().attach('unresolved-exit-near-source', {
    body: await clusterMap.screenshot(),
    contentType: 'image/png',
  })

  await page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('button', { name: 'Inspect', exact: true })
    .click()
  await setWorkspaceMapMode(page, 'Move')
  await target.click()
  await expect(routeMark).toHaveClass(/is-selected/)
  await expect(page.getByRole('button', { name: 'Move on map', exact: true })).toBeVisible()
  const automaticGeometry = await targetGeometrySnapshot(routeMark)
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  const zeroDeltaPreviewGeometry = await targetGeometrySnapshot(routeMark)
  expect(zeroDeltaPreviewGeometry).toEqual(automaticGeometry)
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  expect(await targetGeometrySnapshot(routeMark)).toEqual(zeroDeltaPreviewGeometry)
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
  await clusterMap.locator(`.cluster-system-node[data-system-id="${originSystem.id}"]`).click()
  await expect(page.getByRole('group', { name: `${originSystem.name} star system map`, exact: true })).toBeVisible()
  await undo.click()
  await expect(clusterMap).toBeVisible()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const undoneExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(undoneExport).toEqual(draggedExport)
  expect(undoneExport.cluster?.routes.find(route => route.id === unresolvedRoute.id)).toEqual(unresolvedRoute)

  const restoredRouteMark = clusterMap.locator(`.cluster-route[data-route-id="${unresolvedRoute.id}"]`)
  const restoredTarget = restoredRouteMark.locator('.cluster-exit-mark')
  await expect(restoredRouteMark).toHaveClass(/is-selected/)
  expect(await targetPosition(restoredTarget)).toEqual(draggedPosition)
  await expect.poll(async () => {
    const [mapBounds, markerBounds] = await Promise.all([clusterMap.boundingBox(), restoredTarget.boundingBox()])
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
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(confirmedExport)

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
