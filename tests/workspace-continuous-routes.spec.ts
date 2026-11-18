import { expect, test, type Locator } from './fixtures'
import { exportJumpCluster, restoreJumpClusterBackup } from '../domain/workspace'
import campaignFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import {
  clickDockAction,
  openPlayerPreview,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceZoomControls,
} from './helpers'

test('the player preview inspects the same public route through its shared document view', async ({ page }) => {
  const fixture = exportJumpCluster(restoreJumpClusterBackup(structuredClone(campaignFixture)))
  for (const system of fixture.cluster.systems) {
    system.publication = 'revealed'
    for (const object of system.objects) {
      if (object.family === 'JumpPoint') object.publication = 'revealed'
    }
  }
  fixture.cluster.routes[0]!.playerShared = true
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })

  const preview = await openPlayerPreview(page)
  const map = preview.getByRole('region', { name: 'Player-visible continuous map', exact: true })
  const route = map.locator('.cluster-route[data-route-id="route-1"]')
  await expect(route).toBeVisible()
  const point = await routeStrokePoint(route)
  if (!point) throw new Error('The shared public route has no visible Preview stroke segment.')
  await page.mouse.click(point.x, point.y)

  const details = preview.getByRole('region', { name: 'Jump Route details', exact: true })
  await expect(details.getByRole('heading', { name: 'Jump Level 1', exact: true })).toBeVisible()
  await expect(details).toContainText('Vesper Departure (Vesper Prime)')
  await expect(details).toContainText('Harrow Arrival (Harrow)')
  await details.getByRole('button', { name: 'Center selected Jump Route', exact: true }).click()
  await expect(route).toHaveAttribute('aria-pressed', 'true')
})

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
    const destination = map.querySelector<SVGGElement>('.continuous-warden-system-anchor[aria-label="Select Harrow"]')
    if (!departure || !destination || destination.closest('.continuous-warden-system')?.querySelector('.continuous-warden-system-detail')) return false
    const start = element.getPointAtLength(0).matrixTransform(element.getScreenCTM()!)
    const end = element.getPointAtLength(element.getTotalLength()).matrixTransform(element.getScreenCTM()!)
    const jumpPoint = new DOMPoint().matrixTransform(departure.getScreenCTM()!)
    const anchor = new DOMPoint().matrixTransform(destination.getScreenCTM()!)
    return Math.hypot(start.x - jumpPoint.x, start.y - jumpPoint.y) < 1
      && Math.hypot(end.x - anchor.x, end.y - anchor.y) < 1
  })
}

async function coveredRouteStrokePoint(mark: Locator, minimumCoverage: number) {
  return mark.locator('.cluster-route-hit-target').evaluate((element, coverage) => {
    if (!(element instanceof SVGPathElement)) return null
    const length = element.getTotalLength()
    const matrix = element.getScreenCTM()!
    for (let sample = 4; sample <= 16; sample++) {
      const point = element.getPointAtLength(length * sample / 20).matrixTransform(matrix)
      const stack = document.elementsFromPoint(point.x, point.y)
      if (!stack[0]?.matches('.cluster-route-hit-target') || stack[0] === element || !stack.includes(element)) continue
      const covering = stack.slice(0, stack.indexOf(element)).filter(hit => hit.matches('.cluster-route-hit-target'))
      if (covering.length >= coverage) return { x: point.x, y: point.y }
    }
    return null
  }, minimumCoverage)
}

test('continuous routes support clipped selection, guarded inspection and authored exits', async ({ page }) => {
  test.setTimeout(60_000)
  const fixture = structuredClone(campaignFixture)
  const original = fixture.cluster.routes[0]!
  const departure = fixture.cluster.systems[0]!.objects.find(object => object.id === original.fromPointId)!
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
  const first = map.getByRole('button', { name: /Select Jump Level 1 route/ })
  const second = map.getByRole('button', { name: /Select Jump Level 3 route/ })
  const zoom = workspaceZoomControls(page)
  const camera = map.locator('.cluster-map-content')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
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
  await inspector.getByRole('button', { name: 'Discard changes', exact: true }).click()

  await clickDockAction(page, 'Add Jump Route')
  await selectInspectorOption(inspector.getByLabel('From system'), 'Vesper Prime')
  await selectInspectorOption(inspector.getByLabel('Route destination'), 'Unresolved external exit')
  await inspector.getByLabel('Unknown destination label').fill('Far survey')
  await inspector.getByRole('button', { name: 'Create Jump Route' }).click()
  await waitForWorkspaceSaved(page)

  const exit = map.getByRole('button', { name: /route from Vesper Prime to unknown destination: Far survey/ })
  await setWorkspaceMapMode(page, 'Move')
  await exit.press('Enter')
  await expect(exit).toHaveAttribute('aria-pressed', 'true')
  const marker = exit.locator('.cluster-exit-mark')
  const originalX = Number(await marker.getAttribute('cx'))
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(marker).toHaveAttribute('cx', String(originalX + 10))
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(marker).toHaveAttribute('cx', String(originalX + 10))
})

test('the nearest continuous route wins even when later routes cover its distant stroke', async ({ page }) => {
  test.setTimeout(60_000)
  const fixture = structuredClone(campaignFixture)
  const first = fixture.cluster.routes[0]!
  const destination = fixture.cluster.systems[1]!
  const parallels = Array.from({ length: 23 }, (_, index) => ({
    ...first,
    id: `distant-route-${String(index).padStart(2, '0')}`,
    jumpLevel: index + 1,
    ...(index === 10 ? { fromPointId: first.toPointId, toPointId: first.fromPointId } : {}),
  }))
  const [left, middle, right] = parallels.splice(10, 3)
  fixture.cluster.routes = [middle!, left!, right!, ...parallels]
  const remoteId = 'distant-overview-anchor'
  fixture.cluster.systems.push({ ...destination, id: remoteId, name: 'Distant anchor', objects: [], orbits: [] })
  const positions: Record<string, { x: number; y: number }> = fixture.layout.systemPositions
  positions[destination.id] = { x: 4.15, y: 0.5 }
  positions[remoteId] = { x: 12, y: 0.5 }
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  await setWorkspaceMapMode(page, 'Select')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()

  const map = page.getByRole('group', { name: /continuous map$/ })
  const routes = [12, 11, 13].map(level => map.getByRole('button', { name: new RegExp(`Select Jump Level ${level} route`) }))
  const scale = await routes[0]!.locator('.cluster-route-hit-target').evaluate(element => {
    if (!(element instanceof SVGPathElement)) throw new Error('The route stroke is unavailable.')
    const matrix = element.getScreenCTM()!
    return Math.hypot(matrix.a, matrix.b)
  })
  expect(scale).toBeLessThan(0.12)
  for (const [index, route] of routes.entries()) {
    const point = await coveredRouteStrokePoint(route, index === 0 ? 2 : 1)
    if (!point) throw new Error('The tested centerline must be covered by another route’s hit stroke.')
    await page.mouse.click(point.x, point.y)
    await expect(route).toHaveAttribute('aria-pressed', 'true')
  }
})
