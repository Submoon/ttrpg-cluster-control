import { expect, test, type Locator } from './fixtures'
import campaignFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import {
  clickDockAction,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceZoomControls,
} from './helpers'

async function clippedRouteStroke(mark: Locator) {
  return mark.evaluate(group => {
    const path = group.querySelector<SVGPathElement>('.cluster-route-hit-target')!
    const map = path.ownerSVGElement!
    const viewport = map.getBoundingClientRect()
    const transform = path.getScreenCTM()!
    const length = path.getTotalLength()
    const pointAt = (position: number) => path.getPointAtLength(position * length).matrixTransform(transform)
    const inMap = (point: DOMPoint) => point.x > viewport.left && point.x < viewport.right
      && point.y > viewport.top && point.y < viewport.bottom
    if (inMap(pointAt(0)) && inMap(pointAt(1))) return null
    for (let sample = 1; sample < 30; sample++) {
      const point = pointAt(sample / 30)
      if (inMap(point) && document.elementFromPoint(point.x, point.y) === path) {
        return { x: point.x, y: point.y }
      }
    }
    return null
  })
}

async function fullRouteInView(mark: Locator): Promise<boolean> {
  return mark.locator('.cluster-route-line').evaluate((element) => {
    if (!(element instanceof SVGPathElement)) return false
    const viewport = element.ownerSVGElement!.getBoundingClientRect()
    const bounds = element.getBBox()
    const matrix = element.getScreenCTM()!
    const topLeft = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix)
    const bottomRight = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height).matrixTransform(matrix)
    return topLeft.x > viewport.left && bottomRight.x < viewport.right
      && topLeft.y > viewport.top && bottomRight.y < viewport.bottom
  })
}

test('continuous routes support clipped selection, guarded inspection and authored exits', async ({ page }) => {
  test.setTimeout(60_000)
  const fixture = structuredClone(campaignFixture)
  const original = fixture.cluster.routes[0]!
  const namedRoute = { ...original, name: 'Harrow courier route' }
  fixture.cluster.routes.splice(0, 1, namedRoute, {
    ...original,
    id: 'campaign-baseline-second-route',
    jumpLevel: 3,
  })
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  await page.goto('/?map=continuous')
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

  let point = await clippedRouteStroke(first)
  for (let step = 0; !point && step < 12; step++) {
    await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
    point = await clippedRouteStroke(first)
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
  await exit.press('Enter')
  await setWorkspaceMapMode(page, 'Move')
  const marker = exit.locator('.cluster-exit-mark')
  const originalX = Number(await marker.getAttribute('cx'))
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(marker).toHaveAttribute('cx', String(originalX + 10))
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(marker).toHaveAttribute('cx', String(originalX + 10))
})
