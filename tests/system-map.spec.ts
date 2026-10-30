import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, quitSystemAdd } from './helpers'
import { clickDockAction } from './helpers'
import { openWorkspaceHierarchy, workspaceZoomControls, setWorkspaceMapMode, zoomOutMapToMinimum } from './helpers'
import { dragToWorldPoint, dragHtmlElementToWorldPoint, dragOrbitToWorldPoint, editMapObject, saveMapObject, downloadImage, inspectImageSvg, selectCatalogueObjectButton } from './helpers'
import type { DownloadWindow } from './helpers'

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

test('the system map can zoom well beyond 400 percent', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const navigation = workspaceZoomControls(page)
  const zoomIn = navigation.getByRole('button', { name: 'Zoom in' })
  for (let step = 0; step < 25 && !(await zoomIn.isDisabled()); step += 1) {
    await zoomIn.click()
  }
  await expect(navigation.locator('output')).toHaveText('1600%')
})

test('the system map expands beyond its initial bounds and exports the full layout', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  const navigation = workspaceZoomControls(page)
  await zoomOutMapToMinimum(page)
  await expect(navigation.locator('output')).toHaveText('25%')
  await setWorkspaceMapMode(page, 'Move')
  const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await dragOrbitToWorldPoint(page, orbit, { x: 1550, y: 280 })
  expect(Number(await orbit.getAttribute('aria-valuenow'))).toBeGreaterThan(960)

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  const objectCountBeforeDrop = await map.locator('.system-object').count()
  await dragHtmlElementToWorldPoint(page, planetButton, map, { x: 1400, y: 700 })
  await expect(map.locator('.system-object')).toHaveCount(objectCountBeforeDrop + 1)
  await quitSystemAdd(page)
  await hierarchy.getByRole('treeitem', { name: /Select PL-\d+, New planet/ }).click()
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Far Planet')
  await saveMapObject(page)
  const planet = map.getByRole('button', { name: /Far Planet/ })
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 1750, y: 800 })
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
  const orbitBounds = await map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
    .locator('.orbit-ring').boundingBox()
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
  expect(svgInfo.texts).toContain('Far Planet')
  expect(svgInfo.viewBox[0]).toBeLessThan(0)
  await expectExportedSystemSceneInsideViewBox(page, svg.text!, svgInfo.viewBox)
  expect(svgInfo.viewBox[0] + svgInfo.viewBox[2]).toBeGreaterThan(farPosition.x)
  expect(svgInfo.viewBox[1] + svgInfo.viewBox[3]).toBeGreaterThan(farPosition.y)
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBe(svgInfo.width)
  expect(png.height).toBe(svgInfo.height)
  if (!png.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  expect((await inspectImageSvg(page, png.sourceSvgText)).texts).toContain('Far Planet')

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('button', { name: 'Select A, Primary Star' }))
    .toHaveAttribute('transform', 'translate(480 280)')
  const restoredPlanet = restoredMap.getByRole('button', { name: /Far Planet/ })
  await expect(restoredPlanet).toHaveAttribute('transform', farTransform)
  await zoomOutMapToMinimum(page)
  await dragToWorldPoint(page, restoredMap, restoredPlanet.locator('.object-hit-target'), {
    x: 1850,
    y: 850,
  })
  const editedPosition = await restoredPlanet.getAttribute('transform')
  expect(editedPosition).toContain('translate(')
  expect(Number(editedPosition?.match(/^translate\(([^ ]+)/)?.[1])).toBeGreaterThan(1800)
  await waitForWorkspaceSaved(page)
})
