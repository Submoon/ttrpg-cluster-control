import { expect, test, type Locator } from './fixtures'
import campaignFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import {
  centerWorkspaceSelection,
  clusterCircleScenePosition,
  clickDockAction,
  hideWorkspaceInspector,
  quitSystemAdd,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceZoomControls,
} from './helpers'

async function routeStrokePoint(mark: Locator, clippedOnly = false) {
  return mark.evaluate((group, requireClipping) => {
    const path = group.querySelector<SVGPathElement>('.cluster-route-hit-target')!
    const map = path.ownerSVGElement!
    const viewport = map.getBoundingClientRect()
    const transform = path.getScreenCTM()!
    const length = path.getTotalLength()
    const pointAt = (position: number) => path.getPointAtLength(position * length).matrixTransform(transform)
    const inMap = (point: DOMPoint) => point.x > viewport.left && point.x < viewport.right
      && point.y > viewport.top && point.y < viewport.bottom
    if (requireClipping && inMap(pointAt(0)) && inMap(pointAt(1))) return null
    for (let sample = 1; sample < 30; sample++) {
      const point = pointAt(sample / 30)
      if (inMap(point) && document.elementFromPoint(point.x, point.y) === path) {
        return { x: point.x, y: point.y }
      }
    }
    return null
  }, clippedOnly)
}

async function fullRouteInView(mark: Locator): Promise<boolean> {
  return mark.locator('.cluster-route-line').evaluate((element) => {
    if (!(element instanceof SVGPathElement)) return false
    const map = element.ownerSVGElement!
    const viewport = map.getBoundingClientRect()
    const bounds = element.getBBox()
    const matrix = element.getScreenCTM()!
    const topLeft = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix)
    const bottomRight = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height).matrixTransform(matrix)
    if (topLeft.x <= viewport.left || bottomRight.x >= viewport.right
      || topLeft.y <= viewport.top || bottomRight.y >= viewport.bottom) return false
    const length = element.getTotalLength()
    for (let sample = 0; sample <= 20; sample++) {
      const point = element.getPointAtLength(length * sample / 20).matrixTransform(matrix)
      if (!map.contains(document.elementFromPoint(point.x, point.y))) return false
    }
    return true
  })
}

async function usesIndependentlyRevealedEnds(mark: Locator): Promise<boolean> {
  return mark.locator('.cluster-route-line').evaluate((element) => {
    if (!(element instanceof SVGPathElement)) return false
    const map = element.ownerSVGElement!
    const departure = map.querySelector<SVGGElement>('.continuous-warden-object[aria-label$="Vesper Departure"]')
    const destinationId = map.querySelector('.continuous-warden-name-target[aria-label="Select Harrow"]')?.getAttribute('data-system-id')
    const destination = [...map.querySelectorAll('.continuous-warden-system')].find(system =>
      system.getAttribute('data-system-id') === destinationId)
    const frame = destination?.querySelector<SVGRectElement>('.continuous-warden-system-envelope')
    if (!departure || !frame || destination?.querySelector('.continuous-warden-system-detail')) return false
    const start = element.getPointAtLength(0).matrixTransform(element.getScreenCTM()!)
    const end = element.getPointAtLength(element.getTotalLength()).matrixTransform(element.getScreenCTM()!)
    const jumpPoint = new DOMPoint().matrixTransform(departure.getScreenCTM()!)
    const frameMatrix = frame.getScreenCTM()!
    const point = end.matrixTransform(frameMatrix.inverse())
    const { x, y, width, height } = frame.getBBox()
    const radius = Math.min(frame.rx.baseVal.value, width / 2, height / 2)
    const centerX = Math.max(x + radius, Math.min(x + width - radius, point.x))
    const centerY = Math.max(y + radius, Math.min(y + height - radius, point.y))
    const edgeDistance = Math.abs(Math.hypot(point.x - centerX, point.y - centerY) - radius)
    return Math.hypot(start.x - jumpPoint.x, start.y - jumpPoint.y) < 1
      && edgeDistance * Math.hypot(frameMatrix.a, frameMatrix.b) < 1
  })
}

test('continuous routes support clipped selection, guarded inspection and authored exits', async ({ page }) => {
  test.setTimeout(60_000)
  const fixture = structuredClone(campaignFixture)
  const original = fixture.cluster.routes[0]!
  const departure = fixture.cluster.systems[0]!.objects.find(object => object.id === original.fromPointId)!
  const destinationSystem = fixture.cluster.systems[1]!
  const arrival = destinationSystem.objects.find(object => object.id === original.toPointId)!
  destinationSystem.objects = [{ ...arrival, locationKey: 'A', name: 'Arrival' }]
  departure.placement = { kind: 'system', x: 0.94, y: 0.5 }
  const namedRoute = { ...original, name: 'Harrow courier route' }
  fixture.cluster.routes.splice(0, 1, namedRoute, {
    ...original,
    id: 'campaign-baseline-second-route',
    jumpLevel: 3,
  })
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  await setWorkspaceMapMode(page, 'Select')

  const map = page.getByRole('group', { name: /continuous map$/ })
  const first = map.locator(`.cluster-route[data-route-id="${namedRoute.id}"]`)
  const second = map.locator('.cluster-route[data-route-id="campaign-baseline-second-route"]')
  const zoom = workspaceZoomControls(page)
  const camera = map.locator('.cluster-map-content')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(first).toHaveAccessibleName(/Select Jump Level 1 route/)
  await expect(second).toHaveAccessibleName(/Select Jump Level 3 route/)
  expect(await first.locator('.cluster-route-line').getAttribute('d'))
    .not.toBe(await second.locator('.cluster-route-line').getAttribute('d'))

  const reveal = map.locator('.continuous-warden-object[aria-label$="Vesper Departure"]')
  for (let step = 0; await reveal.count() === 0 && step < 12; step++) {
    await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  }
  await expect.poll(() => usesIndependentlyRevealedEnds(first)).toBe(true)

  let point = await routeStrokePoint(first, true)
  for (let step = 0; !point && step < 12; step++) {
    await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
    point = await routeStrokePoint(first, true)
  }
  if (!point) throw new Error('The clipped route needs a visible, distinct stroke segment.')
  const priorCamera = await camera.getAttribute('transform')
  await page.mouse.click(point.x, point.y)
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(camera).toHaveAttribute('transform', priorCamera!)
  await expect(inspector.getByText('Harrow courier route', { exact: true })).toBeVisible()

  await zoom.getByRole('button', { name: 'Center selected target' }).click()
  await expect.poll(() => fullRouteInView(first)).toBe(true)

  await inspector.getByRole('button', { name: 'Edit Jump Route' }).click()
  const jumpLevel = inspector.getByRole('spinbutton', { name: 'Jump level' })
  await jumpLevel.fill('9')
  await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await second.press('Enter')
  await page.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(jumpLevel).toHaveValue('9')
  await expect(first).toHaveAccessibleName(/Select Jump Level 9 route/)
  await inspector.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(first).toHaveAccessibleName(/Select Jump Level 1 route/)

  await inspector.getByRole('button', { name: 'Edit Jump Route' }).click()
  await inspector.getByRole('button', { name: 'Reverse endpoints', exact: true }).click()
  await inspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(first).toHaveAccessibleName(/from Arrival \(Harrow\) to Vesper Departure \(Vesper Prime\)/)
  await page.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  await expect(first).toHaveAccessibleName(/from Vesper Departure \(Vesper Prime\) to Arrival \(Harrow\)/)

  await clickDockAction(page, 'Add Jump Route')
  await selectInspectorOption(inspector.getByLabel('From Zone'), 'Vesper Prime')
  await selectInspectorOption(inspector.getByLabel('Route destination'), 'Unresolved external exit')
  await inspector.getByLabel('Unknown destination label').fill('Far survey')
  await inspector.getByRole('button', { name: 'Create Jump Route' }).click()
  await waitForWorkspaceSaved(page)

  const exit = map.getByRole('button', { name: /route from Vesper Prime to unknown destination: Far survey/ })
  await setWorkspaceMapMode(page, 'Move')
  await exit.press('Enter')
  await expect(exit).toHaveAttribute('aria-pressed', 'true')
  const marker = exit.locator('.cluster-exit-mark')
  const originalX = (await clusterCircleScenePosition(marker)).x
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await clusterCircleScenePosition(marker)).x).toBeCloseTo(originalX + 10, 2)
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect.poll(async () => (await clusterCircleScenePosition(marker)).x).toBeCloseTo(originalX + 10, 2)

  await setWorkspaceMapMode(page, 'Select')
  await expect(exit).toHaveAttribute('aria-pressed', 'true')
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  await expect(marker).toBeInViewport()
  const bounds = await marker.boundingBox()
  if (!bounds) throw new Error('The selected exit must expose its drag marker.')
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 24, start.y, { steps: 5 })
  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  await expect.poll(async () => (await clusterCircleScenePosition(marker)).x).toBeGreaterThan(originalX + 10)
  await expect(exit).toHaveAttribute('aria-pressed', 'true')

  await (await selectCatalogueObjectButton(page, 'hazard')).click()
  await exit.press('Enter')
  const hazard = map.getByRole('button', { name: /Select .*New hazard 1/ })
  await expect(hazard).toBeVisible()
  await waitForWorkspaceSaved(page)
  await quitSystemAdd(page)
  await hazard.press('Enter')
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await expect(objectInspector.getByText(/50%/)).toBeVisible()
  await objectInspector.getByRole('button', { name: 'Edit map object' }).click()
  await objectInspector.getByLabel('Route position (%)').fill('25.125')
  await objectInspector.getByRole('button', { name: /Apply changes/ }).click()
  await waitForWorkspaceSaved(page)
  await expect(objectInspector.getByText(/25\.125%/)).toBeVisible()

  await hideWorkspaceInspector(page)
  const arrivalAim = await exit.locator('.cluster-route-line').evaluate(path => {
    if (!(path instanceof SVGPathElement)) throw new Error('The route needs a painted cubic.')
    const transform = path.getScreenCTM()!
    const length = path.getTotalLength()
    const near = path.getPointAtLength(0.7 * length).matrixTransform(transform)
    const next = path.getPointAtLength(0.71 * length).matrixTransform(transform)
    const delta = { x: next.x - near.x, y: next.y - near.y }
    const offset = 24 / Math.hypot(delta.x, delta.y)
    return { x: near.x - delta.y * offset, y: near.y + delta.x * offset }
  })
  const existing = hazard.locator('.warden-route-object-marker')
  const origin = await existing.boundingBox()
  if (!origin) throw new Error('The route object needs a visible mark.')
  await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2)
  await page.mouse.down()
  await page.mouse.move(arrivalAim.x, arrivalAim.y, { steps: 6 })
  const ghost = map.locator('.warden-route-object-landing-preview .warden-route-object-marker')
  await expect(ghost).toBeVisible()
  const markerCenter = (locator: Locator) => locator.evaluate(circle => {
    if (!(circle instanceof SVGCircleElement)) throw new Error('Expected a route-object marker circle.')
    const { x, y } = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(circle.getScreenCTM()!)
    return { x, y }
  })
  const proposed = await markerCenter(ghost)
  expect(Math.hypot(proposed.x - origin.x - origin.width / 2, proposed.y - origin.y - origin.height / 2)).toBeGreaterThan(4)
  await test.info().attach('route-object-landing', { body: await map.screenshot(), contentType: 'image/png' })
  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
  // Compare centers within a CSS pixel because a selected marker has a wider stroke than its ghost.
  await expect.poll(async () => {
    const accepted = await markerCenter(existing)
    return Math.hypot(accepted.x - proposed.x, accepted.y - proposed.y)
  }).toBeLessThan(1)
  await waitForWorkspaceSaved(page)
})
