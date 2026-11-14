import { expect, test } from './fixtures'
import { createLocalWorkspace, createOrbit, createSystemObject, exportStarSystem } from '../domain/workspace'
import {
  captureMapExportBlobs,
  downloadImage,
  dragOrbitToWorldPoint,
  dragToWorldPoint,
  inspectImageSvg,
  openWorkspaceHierarchy,
  resolveImportReview,
  reviewStarSystemImport,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceZoomControls,
  workspaceZoomOutput,
} from './helpers'

async function expectExportedSystemSceneInsideViewBox(
  page: import('@playwright/test').Page,
  text: string,
  viewBox: number[],
): Promise<void> {
  const bounds = await page.evaluate((content) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement as unknown as SVGSVGElement
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(svg)
    document.body.append(host)
    try {
      const boxes = ['.system-map-items', '.system-orbits'].flatMap(selector => {
        const group = svg.querySelector<SVGGElement>(selector)
        if (!group) return []
        const { x, y, width, height } = group.getBBox()
        return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
          ? [{ x, y, width, height }]
          : []
      })
      const title = svg.querySelector<SVGTextElement>('.system-map-export-title')
      if (!title) throw new Error('The exported system SVG is missing its title.')
      const titleBounds = title.getBBox()
      if ([titleBounds.x, titleBounds.y, titleBounds.width, titleBounds.height].every(Number.isFinite)
        && titleBounds.width > 0 && titleBounds.height > 0) {
        boxes.push({ x: titleBounds.x, y: titleBounds.y, width: titleBounds.width, height: titleBounds.height })
      }
      if (boxes.length !== 3) throw new Error('The exported system SVG has incomplete measurable feature bounds.')
      const left = Math.min(...boxes.map(box => box.x))
      const top = Math.min(...boxes.map(box => box.y))
      const right = Math.max(...boxes.map(box => box.x + box.width))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    } finally {
      host.remove()
    }
  }, text)
  const [left, top, width, height] = viewBox
  if (left === undefined || top === undefined || width === undefined || height === undefined) {
    throw new Error('The exported system SVG has an incomplete viewBox.')
  }
  expect(bounds.x).toBeGreaterThanOrEqual(left)
  expect(bounds.y).toBeGreaterThanOrEqual(top)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(left + width)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(top + height)
}


test('the system map expands beyond its initial bounds and exports the full layout', async ({ page }) => {
  const fixture = createLocalWorkspace('Extent fixture', 'Vesper')
  const fixtureSystem = fixture.cluster.systems[0]!
  const fixtureStar = fixtureSystem.objects[0]!
  fixtureSystem.orbits.push(createOrbit(fixtureSystem, fixtureStar.id))
  const fixturePlanet = createSystemObject(fixtureSystem, 'planet')
  fixturePlanet.name = 'Far Planet'
  fixturePlanet.placement = { kind: 'system', x: 0.7, y: 0.7 }
  fixtureSystem.objects.push(fixturePlanet)

  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Staging system')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  const review = await reviewStarSystemImport(page, 'extent-fixture.json', JSON.stringify(exportStarSystem(fixture, fixtureSystem.id)))
  await resolveImportReview(review, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const openVesper = async () => {
    await returnToClusterMap(page)
    const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
    await hierarchy.getByRole('button', { name: 'Open Vesper system map', exact: true }).click()
  }
  await openVesper()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(map).toBeVisible()
  const planet = map.getByRole('button', { name: 'Select PL-01, Far Planet (Planet)', exact: true })
  const navigation = workspaceZoomControls(page)
  const initialViewport = await map.boundingBox()
  if (!initialViewport) throw new Error('The system map is not visible.')
  await page.mouse.move(initialViewport.x + initialViewport.width / 2, initialViewport.y + initialViewport.height / 2)
  await page.mouse.wheel(0, 5_000)
  await expect(workspaceZoomOutput(page)).toHaveText('25%')
  await setWorkspaceMapMode(page, 'Move')
  const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await dragOrbitToWorldPoint(page, orbit, { x: 1550, y: 280 })
  await expect.poll(async () => Number(await orbit.getAttribute('aria-valuenow'))).toBeGreaterThan(960)
  const ring = map.getByRole('group', { name: 'Orbit 1 around Primary Star' }).locator('.orbit-ring')
  const resizedRadius = await ring.getAttribute('rx')
  if (!resizedRadius) throw new Error('The resized Orbit has no radius.')

  const originalTransform = await planet.getAttribute('transform')
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 1750, y: 800 })
  await expect(planet).not.toHaveAttribute('transform', originalTransform!)
  const farPosition = await planet.evaluate((element) => {
    const values = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!values) throw new Error('The moved map object has no schematic position.')
    return { x: Number(values[1]), y: Number(values[2]) }
  })
  expect(farPosition.x).toBeGreaterThan(960)
  expect(farPosition.y).toBeGreaterThan(560)
  const farTransform = await planet.getAttribute('transform')
  if (!farTransform) throw new Error('The expanded planet has no map position.')

  const surfaces = await map.evaluate((element) => {
    const rect = (selector: string) => {
      const surface = element.querySelector<SVGRectElement>(selector)
      if (!surface) throw new Error(`The map is missing ${selector}.`)
      return {
        x: Number(surface.getAttribute('x')),
        y: Number(surface.getAttribute('y')),
        width: Number(surface.getAttribute('width')),
        height: Number(surface.getAttribute('height')),
      }
    }
    return { background: rect('.map-background'), grid: rect('.map-grid') }
  })
  expect(surfaces.background).toEqual(surfaces.grid)
  expect(surfaces.background.x).toBeLessThan(0)
  expect(surfaces.background.y).toBeLessThan(0)
  expect(surfaces.background.x + surfaces.background.width).toBeGreaterThan(farPosition.x)
  expect(surfaces.background.y + surfaces.background.height).toBeGreaterThan(farPosition.y)

  await navigation.getByRole('button', { name: 'Fit map' }).click()
  const mapBounds = await map.boundingBox()
  const orbitBounds = await ring.boundingBox()
  const planetBounds = await planet.boundingBox()
  if (!mapBounds || !orbitBounds || !planetBounds) {
    throw new Error('The expanded system map did not render its contents.')
  }
  for (const bounds of [orbitBounds, planetBounds]) {
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)
  }

  const svg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const svgInfo = await inspectImageSvg(page, svg.text!)
  expect(svgInfo.texts).toContain(fixturePlanet.name)
  expect(svgInfo.viewBox[0]).toBeLessThan(0)
  await expectExportedSystemSceneInsideViewBox(page, svg.text!, svgInfo.viewBox)
  expect(svgInfo.viewBox[0] + svgInfo.viewBox[2]).toBeGreaterThan(farPosition.x)
  expect(svgInfo.viewBox[1] + svgInfo.viewBox[3]).toBeGreaterThan(farPosition.y)
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBe(svgInfo.width)
  expect(png.height).toBe(svgInfo.height)
  if (!png.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  expect((await inspectImageSvg(page, png.sourceSvgText)).texts).toContain(fixturePlanet.name)

  await waitForWorkspaceSaved(page)
  await page.reload()
  await openVesper()
  await expect(map.getByRole('button', { name: 'Select A, Primary Star' }))
    .toHaveAttribute('transform', 'translate(480 280)')
  await expect(planet).toHaveAttribute('transform', farTransform)
  await expect(ring).toHaveAttribute('rx', resizedRadius)
})
