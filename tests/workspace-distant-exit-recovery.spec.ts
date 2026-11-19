import { expect, test, type Locator, type Page } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace, type CampaignFixture } from './scenarios/campaign-workspace'
import {
  downloadImage, downloadJson, hideWorkspaceInspector, inspectImageSvg, openWorkspaceHierarchy, openWorkspaceZoomNavigation,
  setWorkspaceMapMode, snapshotSvgCoordinates, waitForWorkspaceSaved, waitForWorkspaceStartup,
  wardenMap, workspaceZoomControls, workspaceZoomOutput,
} from './helpers'

type Point = { x: number; y: number }

function campaignWithUnresolvedExit(): CampaignFixture {
  const fixture = structuredClone(campaignBaselineFixture) as CampaignFixture
  const route = fixture.cluster.routes[0]
  if (!route) throw new Error('The campaign fixture has no Jump Route to repurpose.')
  Object.assign(route, { toPointId: null, unresolvedExit: 'The Rim' })
  return fixture
}

async function rightPan(page: Page, map: Locator, delta: Point): Promise<void> {
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The Warden map has no visible canvas.')
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  expect(await map.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), start)).toBe(true)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  try {
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 })
  } finally {
    await page.mouse.up({ button: 'right' })
  }
}

async function panScenePointToViewportCenter(page: Page, map: Locator, point: Point): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    const coordinates = await snapshotSvgCoordinates(map.locator('.cluster-map-content'))
    const screen = coordinates.toClient(point)
    const bounds = await map.boundingBox()
    if (!bounds) throw new Error('The map has no viewport bounds.')
    const dx = bounds.x + bounds.width / 2 - screen.x
    const dy = bounds.y + bounds.height / 2 - screen.y
    if (Math.abs(dx) < bounds.width * .12 && Math.abs(dy) < bounds.height * .12) return
    await rightPan(page, map, {
      x: Math.max(-bounds.width * .3, Math.min(bounds.width * .3, dx)),
      y: Math.max(-bounds.height * .3, Math.min(bounds.height * .3, dy)),
    })
  }
  throw new Error('Could not pan the authored scene point into the visible canvas.')
}

async function markerPosition(marker: Locator): Promise<Point> {
  return marker.evaluate(element => ({ x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')) }))
}

async function expectFittedFeatures(map: Locator): Promise<void> {
  const viewport = await map.boundingBox()
  if (!viewport) throw new Error('Fit needs a visible canvas.')
  const features = map.locator('.continuous-warden-system-anchor, .cluster-route-line, .cluster-exit-mark, .continuous-warden-system-name')
  expect(await features.count()).toBeGreaterThan(3)
  for (const feature of await features.all()) {
    const bounds = await feature.boundingBox()
    if (!bounds) throw new Error('A fitted feature has no geometry.')
    expect(bounds.x).toBeGreaterThanOrEqual(viewport.x - 1)
    expect(bounds.y).toBeGreaterThanOrEqual(viewport.y - 1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.x + viewport.width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.y + viewport.height + 1)
  }
}

test('far unresolved exits stay reachable after Fit and export as a complete bounded map', async ({ page }) => {
  test.setTimeout(90_000)
  const fixture = campaignWithUnresolvedExit()
  const routeId = fixture.cluster.routes[0]!.id
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  const map = wardenMap(page)
  const route = map.locator(`.cluster-route[data-route-id="${routeId}"]`)
  const target = route.locator('.cluster-exit-mark')
  await expect(target).toBeVisible()
  await route.press('Enter')
  await hideWorkspaceInspector(page)
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') === 'true') await hierarchyToggle.click()
  await setWorkspaceMapMode(page, 'Move')
  const zoom = workspaceZoomControls(page)
  const navigation = await openWorkspaceZoomNavigation(page)
  await navigation.getByRole('slider', { name: 'Map zoom level', exact: true }).press('Home')
  await expect(zoom.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')

  const authorPosition = async (position: Point) => {
    await panScenePointToViewportCenter(page, map, position)
    await page.getByRole('button', { name: 'Move on map', exact: true }).click()
    const coordinates = await snapshotSvgCoordinates(map.locator('.cluster-map-content'))
    const requested = coordinates.toClient(position)
    const delivered = { x: Math.round(requested.x), y: Math.round(requested.y) }
    expect(await map.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), delivered)).toBe(true)
    await page.mouse.click(delivered.x, delivered.y)
    await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
    await waitForWorkspaceSaved(page)
    const applied = await markerPosition(target)
    const painted = coordinates.toClient(applied)
    expect(Math.abs(painted.x - delivered.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(painted.y - delivered.y)).toBeLessThanOrEqual(1)
    return applied
  }
  const distant = await authorPosition({ x: -1800, y: 7000 })
  await zoom.getByRole('button', { name: 'Fit map', exact: true }).click()
  const fittedScale = Number((await workspaceZoomOutput(page).textContent())?.replace('%', ''))
  expect(fittedScale).toBeGreaterThan(0)
  // This authored extent cannot fit at the historical 25% camera floor.
  expect(fittedScale).toBeLessThan(25)
  await expectFittedFeatures(map)
  const fittedCamera = await map.locator('.cluster-map-content').getAttribute('transform')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Inspect Vesper Prime', exact: true }).click()
  await hideWorkspaceInspector(page)
  await hierarchyToggle.click()
  await expect(map.locator('.cluster-map-content')).toHaveAttribute('transform', fittedCamera ?? '')
  await route.press('Enter')
  await hideWorkspaceInspector(page)
  await setWorkspaceMapMode(page, 'Move')
  expect(await markerPosition(target)).toEqual(distant)
  const committed = await authorPosition({ x: -1400, y: 6500 })
  await zoom.getByRole('button', { name: 'Fit map', exact: true }).click()
  await expectFittedFeatures(map)
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('Fit must reveal the authored external target.')
  await setWorkspaceMapMode(page, 'Select')
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(page.getByRole('region', { name: 'Jump Route details', exact: true })).toContainText('The Rim')
  await hideWorkspaceInspector(page)
  const beforePan = await map.locator('.cluster-map-content').getAttribute('transform')
  await rightPan(page, map, { x: 48, y: -36 })
  await expect(map.locator('.cluster-map-content')).not.toHaveAttribute('transform', beforePan ?? '')
  await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  expect(await markerPosition(target)).toEqual(committed)
  const exportCamera = await map.locator('.cluster-map-content').getAttribute('transform')
  const svg = await downloadImage(page, 'image/svg+xml', 'Entire Cluster')
  if (!svg.text) throw new Error('The distant Cluster SVG is empty.')
  const svgInfo = await inspectImageSvg(page, svg.text)
  const [x, y, width, height] = svgInfo.viewBox
  expect(x).toBeLessThan(committed.x - 7)
  expect(y).toBeLessThan(committed.y)
  expect(x + width).toBeGreaterThan(committed.x)
  expect(y + height).toBeGreaterThan(committed.y + 24)
  expect(svgInfo.texts).toContain('Unknown: The Rim')
  expect(svg.text).not.toMatch(/NaN|Infinity/)
  const png = await downloadImage(page, 'image/png', 'Entire Cluster')
  if (!png.width || !png.height || !png.sourceSvgText) throw new Error('The PNG needs real dimensions and its source SVG.')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBeLessThanOrEqual(4096)
  expect(png.height).toBeLessThanOrEqual(4096)
  expect(png.width * png.height).toBeLessThanOrEqual(4_194_304)
  expect(Math.abs(png.width / png.height - svgInfo.width / svgInfo.height)).toBeLessThan(.005)
  expect((await inspectImageSvg(page, png.sourceSvgText)).viewBox).toEqual(svgInfo.viewBox)
  await expect(map.locator('.cluster-map-content')).toHaveAttribute('transform', exportCamera ?? '')
  const saved = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(saved.layout.unresolvedExitPositions?.[routeId]).toEqual(committed)
  await page.reload()
  await waitForWorkspaceStartup(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(saved)
  await expect(target).toHaveAttribute('cx', String(committed.x))
  await expect(target).toHaveAttribute('cy', String(committed.y))
})
