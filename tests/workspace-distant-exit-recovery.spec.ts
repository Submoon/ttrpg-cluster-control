import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace, type CampaignFixture } from './scenarios/campaign-workspace'
import {
  waitForWorkspaceSaved,
  downloadImage,
  downloadJson,
  inspectImageSvg,
  panMap,
  returnToClusterMap,
  setWorkspaceMapMode,
  workspaceZoomControls,
  workspaceZoomOutput,
  zoomOutMapToMinimum,
} from './helpers'

type Point = { x: number; y: number }

function campaignWithUnresolvedExit(): CampaignFixture {
  const fixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as CampaignFixture
  const route = fixture.cluster.routes[0]
  if (!route) throw new Error('The campaign fixture has no Jump Route to repurpose.')
  Object.assign(route, { toPointId: null, unresolvedExit: 'The Rim' })
  return fixture
}

function campaignWithTallUnresolvedExit(): CampaignFixture {
  const fixture = campaignWithUnresolvedExit()
  const route = fixture.cluster.routes[0]
  if (!route) throw new Error('The campaign fixture has no Jump Route to place.')
  Object.assign(fixture.layout, {
    unresolvedExitPositions: { [route.id]: { x: 480, y: 10_000_000 } },
  })
  return fixture
}

async function screenPointForScenePoint(
  map: import('@playwright/test').Locator,
  point: Point,
): Promise<Point> {
  return map.evaluate((element, scenePoint) => {
    const items = element.querySelector<SVGGElement>('.cluster-map-content')
    const transform = items?.getScreenCTM()
    if (!transform) throw new Error('The Cluster-map scene is not attached.')
    const screen = new DOMPoint(scenePoint.x, scenePoint.y).matrixTransform(transform)
    return { x: screen.x, y: screen.y }
  }, point)
}

async function clickScenePoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: Point,
): Promise<Point> {
  const screen = await screenPointForScenePoint(map, point)
  await page.mouse.click(screen.x, screen.y)
  return screen
}

async function panScenePointToViewportCenter(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: Point,
): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    const screen = await screenPointForScenePoint(map, point)
    const bounds = await map.boundingBox()
    if (!bounds) throw new Error('The Cluster map has no viewport bounds.')
    const dx = bounds.x + bounds.width / 2 - screen.x
    const dy = bounds.y + bounds.height / 2 - screen.y
    if (Math.abs(dx) < bounds.width * 0.12 && Math.abs(dy) < bounds.height * 0.12) return
    await panMap(page, map, {
      x: Math.max(-bounds.width * 0.3, Math.min(bounds.width * 0.3, dx)),
      y: Math.max(-bounds.height * 0.3, Math.min(bounds.height * 0.3, dy)),
    })
  }
  throw new Error('Could not pan the requested scene point into the visible map area.')
}

async function visibleSceneBounds(
  map: import('@playwright/test').Locator,
): Promise<{ feature: { left: number; top: number; right: number; bottom: number }; viewport: { left: number; top: number; right: number; bottom: number } }> {
  return map.evaluate((element) => {
    const items = element.querySelector<SVGGElement>('.cluster-map-items')
    const transform = items?.getScreenCTM()
    if (!items || !transform) throw new Error('The Cluster map has no visible scene geometry.')
    const box = items.getBBox()
    const points = [
      new DOMPoint(box.x, box.y),
      new DOMPoint(box.x + box.width, box.y),
      new DOMPoint(box.x, box.y + box.height),
      new DOMPoint(box.x + box.width, box.y + box.height),
    ].map(point => point.matrixTransform(transform))
    const viewport = element.getBoundingClientRect()
    return {
      feature: {
        left: Math.min(...points.map(point => point.x)),
        top: Math.min(...points.map(point => point.y)),
        right: Math.max(...points.map(point => point.x)),
        bottom: Math.max(...points.map(point => point.y)),
      },
      viewport: { left: viewport.left, top: viewport.top, right: viewport.right, bottom: viewport.bottom },
    }
  })
}

async function markerPosition(marker: import('@playwright/test').Locator): Promise<Point> {
  return marker.evaluate(element => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
}

async function hideInspectorIfOpen(page: import('@playwright/test').Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const hide = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await close.isVisible()) await close.click()
  else if (await hide.isVisible()) await hide.click()
}

test('far unresolved exits stay reachable after Fit and export as a complete bounded map', async ({ page }) => {
  test.setTimeout(90_000)
  await importCampaignWorkspace(page, campaignWithUnresolvedExit(), { width: 1440, height: 960 })

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const original = await downloadJson(page, 'Export Jump Cluster JSON')
  const route = original.cluster?.routes.find(candidate => candidate.toPointId === null && candidate.unresolvedExit === 'The Rim')
  if (!route) throw new Error('The new unresolved Jump Route was not exported.')
  const routeMark = clusterMap.locator(`.cluster-route[data-route-id="${route.id}"]`)
  const target = routeMark.locator('.cluster-exit-mark')
  await expect(target).toBeVisible()
  await hideInspectorIfOpen(page)
  await setWorkspaceMapMode(page, 'Move')
  await target.click()
  await expect(routeMark).toHaveClass(/is-selected/)
  await zoomOutMapToMinimum(page)

  const distantPoint = { x: -1800, y: 7000 }
  await panScenePointToViewportCenter(page, clusterMap, distantPoint)
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  const requestedDistantScreenPoint = await clickScenePoint(page, clusterMap, distantPoint)
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const appliedDistantPoint = await markerPosition(target)
  const appliedDistantScreenPoint = await screenPointForScenePoint(clusterMap, appliedDistantPoint)
  expect(Math.abs(appliedDistantScreenPoint.x - requestedDistantScreenPoint.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(appliedDistantScreenPoint.y - requestedDistantScreenPoint.y)).toBeLessThanOrEqual(1)
  const distantJson = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(distantJson.layout.unresolvedExitPositions?.[route.id]).toEqual(appliedDistantPoint)
  const background = clusterMap.locator('.cluster-map-background')
  const backgroundBounds = await background.evaluate(element => ({
    x: Number(element.getAttribute('x') ?? 0),
    y: Number(element.getAttribute('y') ?? 0),
    width: Number(element.getAttribute('width')),
    height: Number(element.getAttribute('height')),
    right: Number(element.getAttribute('x') ?? 0) + Number(element.getAttribute('width')),
    bottom: Number(element.getAttribute('y') ?? 0) + Number(element.getAttribute('height')),
  }))
  expect(Object.values(backgroundBounds).every(value => Number.isFinite(value) && Math.abs(value) <= 2 ** 24 - 4096))
    .toBe(true)
  const backgroundClient = await background.boundingBox()
  const mapClient = await clusterMap.boundingBox()
  if (!backgroundClient || !mapClient) throw new Error('The map background or viewport is not measurable.')
  expect(backgroundClient.x).toBeLessThanOrEqual(mapClient.x + 1)
  expect(backgroundClient.y).toBeLessThanOrEqual(mapClient.y + 1)
  expect(backgroundClient.x + backgroundClient.width).toBeGreaterThanOrEqual(mapClient.x + mapClient.width - 1)
  expect(backgroundClient.y + backgroundClient.height).toBeGreaterThanOrEqual(mapClient.y + mapClient.height - 1)

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const fittedScale = Number((await workspaceZoomOutput(page).textContent())?.replace('%', ''))
  expect(fittedScale).toBeGreaterThan(0)
  expect(fittedScale).toBeLessThan(25)
  const fitted = await visibleSceneBounds(clusterMap)
  expect(fitted.feature.left).toBeGreaterThanOrEqual(fitted.viewport.left - 1)
  expect(fitted.feature.top).toBeGreaterThanOrEqual(fitted.viewport.top - 1)
  expect(fitted.feature.right).toBeLessThanOrEqual(fitted.viewport.right + 1)
  expect(fitted.feature.bottom).toBeLessThanOrEqual(fitted.viewport.bottom + 1)

  const fitBeforeMapSwitch = Number((await workspaceZoomOutput(page).textContent())?.replace('%', ''))
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  await returnToClusterMap(page)
  const restoredFit = Number((await workspaceZoomOutput(page).textContent())?.replace('%', ''))
  expect(Math.abs(restoredFit - fitBeforeMapSwitch)).toBeLessThan(0.1)
  const restoredScene = await visibleSceneBounds(clusterMap)
  expect(restoredScene.feature.left).toBeGreaterThanOrEqual(restoredScene.viewport.left - 1)
  expect(restoredScene.feature.top).toBeGreaterThanOrEqual(restoredScene.viewport.top - 1)
  expect(restoredScene.feature.right).toBeLessThanOrEqual(restoredScene.viewport.right + 1)
  expect(restoredScene.feature.bottom).toBeLessThanOrEqual(restoredScene.viewport.bottom + 1)
  await setWorkspaceMapMode(page, 'Move')

  const cameraAfterFit = await clusterMap.locator('.cluster-map-content').getAttribute('transform')
  await panMap(page, clusterMap, { x: 48, y: -36 })
  await expect(clusterMap.locator('.cluster-map-content')).not.toHaveAttribute('transform', cameraAfterFit!)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(distantJson)
  const beforeZoomPosition = await markerPosition(target)
  await workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => Number((await workspaceZoomOutput(page).textContent())?.replace('%', '')))
    .toBeGreaterThan(fittedScale)
  expect(await markerPosition(target)).toEqual(beforeZoomPosition)

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const movedPoint = { x: -1400, y: 6500 }
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  const requestedMovedScreenPoint = await clickScenePoint(page, clusterMap, movedPoint)
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click()
  const committedPosition = await markerPosition(target)
  const committedScreenPoint = await screenPointForScenePoint(clusterMap, committedPosition)
  expect(Math.abs(committedScreenPoint.x - requestedMovedScreenPoint.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(committedScreenPoint.y - requestedMovedScreenPoint.y)).toBeLessThanOrEqual(1)
  const committedJson = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(committedJson.layout.unresolvedExitPositions?.[route.id]).toEqual(committedPosition)

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const svg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  if (!svg.text) throw new Error('The distant Cluster SVG export is empty.')
  const svgInfo = await inspectImageSvg(page, svg.text)
  const [viewX, viewY, viewWidth, viewHeight] = svgInfo.viewBox
  expect(viewX).toBeLessThan(committedPosition.x - 7)
  expect(viewY).toBeLessThan(committedPosition.y)
  expect(viewX + viewWidth).toBeGreaterThan(committedPosition.x)
  expect(viewY + viewHeight).toBeGreaterThan(committedPosition.y + 24)
  expect(svgInfo.texts).toContain('Unknown: The Rim')

  const png = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  if (png.width === undefined || png.height === undefined || !png.sourceSvgText) {
    throw new Error('The distant Cluster PNG did not expose its dimensions and source SVG.')
  }
  expect(png.width).toBeLessThanOrEqual(4096)
  expect(png.height).toBeLessThanOrEqual(4096)
  expect(png.width * png.height).toBeLessThanOrEqual(4096 * 4096)
  expect(Math.abs(png.width / png.height - svgInfo.width / svgInfo.height)).toBeLessThan(0.005)
  expect((await inspectImageSvg(page, png.sourceSvgText)).viewBox).toEqual(svgInfo.viewBox)

  await page.reload()
  await returnToClusterMap(page)
  await waitForWorkspaceSaved(page)
  expect((await downloadJson(page, 'Export Jump Cluster JSON')).layout.unresolvedExitPositions?.[route.id])
    .toEqual(committedPosition)
  await expect(clusterMap.locator(`.cluster-route[data-route-id="${route.id}"] .cluster-exit-mark`))
    .toHaveAttribute('cx', String(committedPosition.x))
  await expect(clusterMap.locator(`.cluster-route[data-route-id="${route.id}"] .cluster-exit-mark`))
    .toHaveAttribute('cy', String(committedPosition.y))
})

for (const viewport of [{ width: 1440, height: 960 }, { width: 1920, height: 400 }]) {
  test(`Fit of a tall distant exit covers the SVG viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await importCampaignWorkspace(page, campaignWithTallUnresolvedExit(), viewport)
    const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
    await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()

    const coverage = await clusterMap.evaluate((element) => {
      const content = element.querySelector<SVGGElement>('.cluster-map-content')
      const rect = (box: DOMRect) => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom })
      const surfaces = (selector: string) => {
        const rectangles = [...element.querySelectorAll<SVGRectElement>(selector)].map(rectangle => ({
          x: Number(rectangle.getAttribute('x')),
          y: Number(rectangle.getAttribute('y')),
          width: Number(rectangle.getAttribute('width')),
          height: Number(rectangle.getAttribute('height')),
          client: rect(rectangle.getBoundingClientRect()),
        }))
        return {
          rectangles,
          safe: rectangles.every(rectangle => [
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height,
            rectangle.x + rectangle.width,
            rectangle.y + rectangle.height,
          ].every(value => Number.isFinite(value) && Math.abs(value) <= 2 ** 24 - 4096)
            && rectangle.width > 0 && rectangle.height > 0),
        }
      }
      return {
        viewport: rect(element.getBoundingClientRect()),
        camera: content?.getAttribute('transform'),
        pattern: element.querySelector<SVGPatternElement>('#cluster-map-grid')?.getAttribute('patternTransform'),
        background: surfaces('.cluster-map-background'),
        grid: surfaces('.cluster-map-grid'),
      }
    })
    const fittedScalePercent = Number((await workspaceZoomOutput(page).textContent())?.replace('%', ''))
    expect(fittedScalePercent).toBeGreaterThan(0)
    expect(fittedScalePercent).toBeLessThan(0.01)
    for (const surface of [coverage.background, coverage.grid]) {
      expect(surface.safe).toBe(true)
      expect(surface.rectangles).toHaveLength(1)
      const [rectangle] = surface.rectangles
      if (!rectangle) throw new Error('The map surface rectangle is missing.')
      expect(rectangle.client.left).toBeLessThanOrEqual(coverage.viewport.left + 1)
      expect(rectangle.client.top).toBeLessThanOrEqual(coverage.viewport.top + 1)
      expect(rectangle.client.right).toBeGreaterThanOrEqual(coverage.viewport.right - 1)
      expect(rectangle.client.bottom).toBeGreaterThanOrEqual(coverage.viewport.bottom - 1)
    }
    expect(coverage.pattern).toBe(coverage.camera)

    const exportedSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
    if (!exportedSvg.text) throw new Error('The tall-scene SVG export is empty.')
    const exportSurfaces = await page.evaluate((source) => {
      const document = new DOMParser().parseFromString(source, 'image/svg+xml')
      const viewBox = (document.documentElement.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
      const read = (selector: string) => {
        const surface = document.querySelector<SVGRectElement>(selector)
        if (!surface) throw new Error(`Missing exported surface ${selector}.`)
        return {
          x: Number(surface.getAttribute('x')),
          y: Number(surface.getAttribute('y')),
          width: Number(surface.getAttribute('width')),
          height: Number(surface.getAttribute('height')),
        }
      }
      return {
        viewBox,
        background: read('.cluster-map-background'),
        grid: read('.cluster-map-grid'),
        patternTransform: document.querySelector('#cluster-map-grid')?.getAttribute('patternTransform') ?? null,
      }
    }, exportedSvg.text)
    const [x, y, width, height] = exportSurfaces.viewBox
    expect(exportSurfaces.background).toEqual({ x, y, width, height })
    expect(exportSurfaces.grid).toEqual({ x, y, width, height })
    expect(exportSurfaces.patternTransform).toBeNull()
  })
}
