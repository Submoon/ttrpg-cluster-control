import { expect, test } from '@playwright/test'
import { dragToWorldPoint, dragHtmlElementToWorldPoint, dragOrbitToWorldPoint, editMapObject, saveMapObject, downloadImage, inspectImageSvg, selectCatalogueObjectButton } from './helpers'
import type { DownloadWindow } from './helpers'

test('the system map can zoom well beyond 400 percent', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const zoomIn = navigation.getByRole('button', { name: 'Zoom in' })
  for (let step = 0; step < 25 && !(await zoomIn.isDisabled()); step += 1) {
    await zoomIn.click()
  }
  await expect(navigation.getByLabel('Zoom level')).toHaveText('1600%')
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
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  for (let index = 0; index < 8; index += 1) {
    await navigation.getByRole('button', { name: 'Zoom out' }).click()
  }
  await expect(navigation.getByLabel('Zoom level')).toHaveText('25%')
  await dragOrbitToWorldPoint(page, orbit, { x: 1550, y: 280 })
  expect(Number(await orbit.getAttribute('aria-valuenow'))).toBeGreaterThan(960)

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await dragHtmlElementToWorldPoint(page, planetButton, map, { x: 1400, y: 700 })
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
      return Object.fromEntries(['x', 'y', 'width', 'height'].map(attribute => [
        attribute,
        Number(surface.getAttribute(attribute)),
      ]))
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
  expect(svgInfo.viewBox[1]).toBeLessThan(0)
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
  const restoredNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  for (let index = 0; index < 8; index += 1) {
    await restoredNavigation.getByRole('button', { name: 'Zoom out' }).click()
  }
  await dragToWorldPoint(page, restoredMap, restoredPlanet.locator('.object-hit-target'), {
    x: 1850,
    y: 850,
  })
  const editedPosition = await restoredPlanet.getAttribute('transform')
  expect(editedPosition).toContain('translate(')
  expect(Number(editedPosition?.match(/^translate\(([^ ]+)/)?.[1])).toBeGreaterThan(1800)
  await expect(page.getByText('Saved on this device')).toBeVisible()
})
