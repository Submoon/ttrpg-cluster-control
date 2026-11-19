import { expect, test, type Locator, type Page } from './fixtures'
import { createLocalWorkspace, createOrbit, createSystemObject, exportStarSystem } from '../domain/workspace'
import {
  captureMapExportBlobs, centerWorkspaceSelection, createSingleSystemWorkspace, downloadImage, downloadJson,
  dragOrbitToWorldPoint, exposedContinuousObjectHitPoint, hideWorkspaceInspector, inspectImageSvg,
  measureMouseDrag, openWorkspaceHierarchy, resolveImportReview, reviewStarSystemImport,
  setWorkspaceMapMode, waitForWorkspaceSaved, waitForWorkspaceStartup, wardenLocalCoordinates,
  wardenMap, wardenObjectMark, workspaceZoomControls, type WorldPoint,
} from './helpers'

async function ensureLocalPointsReachable(page: Page, systemId: string, points: readonly WorldPoint[]): Promise<void> {
  const map = wardenMap(page)
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  for (let step = 0; step < 48; step += 1) {
    const coordinates = await wardenLocalCoordinates(page, systemId)
    const reachable = await map.evaluate((element, targets) => targets.every(point => {
      const hit = document.elementFromPoint(point.x, point.y)
      return hit !== null && element.contains(hit)
    }), points.map(coordinates.toClient))
    if (reachable) return
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }
  throw new Error('The local drag points are unreachable through public Zoom out recovery.')
}

async function objectPosition(mark: Locator): Promise<WorldPoint> {
  return mark.evaluate(element => {
    const graphic = element as SVGGraphicsElement
    const matrix = graphic.transform.baseVal.consolidate()?.matrix
    if (!matrix) throw new Error('The object has no local SVG position.')
    return { x: matrix.e, y: matrix.f }
  })
}

async function expectExportedSystemSceneInsideViewBox(page: Page, text: string, viewBox: number[]): Promise<void> {
  const bounds = await page.evaluate(content => {
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    if (!(parsed instanceof SVGSVGElement)) throw new Error('The exported system image needs an SVG root.')
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(parsed)
    document.body.append(host)
    try {
      const rootMatrix = parsed.getScreenCTM()
      if (!rootMatrix) throw new Error('The exported SVG has no measurable root transform.')
      const boxes = ['.system-map-items', '.system-orbits', '.continuous-warden-system-name'].map(selector => {
        const group = parsed.querySelector<SVGGraphicsElement>(selector)
        const matrix = group?.getScreenCTM()
        if (!group || !matrix) throw new Error(`The exported system is missing ${selector}.`)
        const box = group.getBBox()
        const toRoot = rootMatrix.inverse().multiply(matrix)
        const corners = [
          new DOMPoint(box.x, box.y), new DOMPoint(box.x + box.width, box.y),
          new DOMPoint(box.x, box.y + box.height), new DOMPoint(box.x + box.width, box.y + box.height),
        ].map(point => point.matrixTransform(toRoot))
        return { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)),
          top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)) }
      })
      return { left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
        top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)) }
    } finally {
      host.remove()
    }
  }, text)
  const [left, top, width, height] = viewBox
  if (left === undefined || top === undefined || width === undefined || height === undefined) throw new Error('The SVG viewBox is incomplete.')
  // The mounted root and its child matrices round-trip through CSS pixel transforms.
  expect(bounds.left).toBeGreaterThanOrEqual(left - .001)
  expect(bounds.top).toBeGreaterThanOrEqual(top - .001)
  expect(bounds.right).toBeLessThanOrEqual(left + width + .001)
  expect(bounds.bottom).toBeLessThanOrEqual(top + height + .001)
}

test('the system map expands beyond its initial bounds and exports the full applied layout', async ({ page }) => {
  const fixture = createLocalWorkspace('Extent fixture', 'Vesper')
  const fixtureSystem = fixture.cluster.systems[0]!
  const fixtureStar = fixtureSystem.objects[0]!
  fixtureSystem.orbits.push(createOrbit(fixtureSystem, fixtureStar.id))
  const fixturePlanet = createSystemObject(fixtureSystem, 'planet')
  fixturePlanet.name = 'Far Planet'
  fixturePlanet.placement = { kind: 'system', x: .7, y: .7 }
  fixtureSystem.objects.push(fixturePlanet)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { systemName: 'Staging system', viewport: { width: 1920, height: 1080 } })
  const review = await reviewStarSystemImport(page, 'extent-fixture.json', JSON.stringify(exportStarSystem(fixture, fixtureSystem.id)))
  await resolveImportReview(review, 'confirm')
  const imported = await downloadJson(page, 'Export Jump Cluster JSON')
  const system = imported.cluster?.systems.find(candidate => candidate.name === fixtureSystem.name)
  const primary = system?.objects.find(object => object.name === 'Primary Star')
  const planetObject = system?.objects.find(object => object.name === fixturePlanet.name)
  const orbitObject = system?.orbits.find(orbit => orbit.hostId === primary?.id)
  if (!system || !primary || !planetObject || !orbitObject) throw new Error('The reviewed extent system needs its Star, Orbit, and Planet.')
  const openVesper = async () => {
    const hierarchy = await openWorkspaceHierarchy(page)
    await hierarchy.getByRole('button', { name: `Inspect ${system.name}`, exact: true }).click()
    await centerWorkspaceSelection(page)
    await hideWorkspaceInspector(page)
    const toggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click()
  }
  await openVesper()
  const map = wardenMap(page)
  const owner = map.locator(`.continuous-warden-system[data-system-id="${system.id}"]`)
  const planet = wardenObjectMark(page, system.id, planetObject.id)
  const primaryMark = wardenObjectMark(page, system.id, primary.id)
  const ring = owner.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitObject.id}"]`)
  await ring.press('Enter')
  await hideWorkspaceInspector(page)
  await setWorkspaceMapMode(page, 'Move')
  const primaryBefore = await primaryMark.getAttribute('transform')
  const radius = Number(await ring.getAttribute('rx'))
  const resizeAngle = .5
  const resizeTarget = { x: 480 + 1070 * Math.cos(resizeAngle), y: 280 + 1070 * Math.sin(resizeAngle) }
  await ensureLocalPointsReachable(page, system.id, [
    { x: 480 + radius * Math.cos(resizeAngle), y: 280 + radius * Math.sin(resizeAngle) }, resizeTarget,
  ])
  await dragOrbitToWorldPoint(page, ring, resizeTarget, resizeAngle)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBeGreaterThan(960)
  const resizedRadius = await ring.getAttribute('rx')
  if (!resizedRadius) throw new Error('The resized Orbit has no radius.')
  await ensureLocalPointsReachable(page, system.id, [await objectPosition(planet), { x: 1750, y: 800 }])
  const coordinates = await wardenLocalCoordinates(page, system.id)
  const origin = await objectPosition(planet)
  const start = await exposedContinuousObjectHitPoint(planet)
  if (!start) throw new Error('The Planet needs an exposed native Move target.')
  const originClient = coordinates.toClient(origin)
  const targetClient = coordinates.toClient({ x: 1750, y: 800 })
  const delivered = await measureMouseDrag(page, start, { x: start.x + targetClient.x - originClient.x, y: start.y + targetClient.y - originClient.y })
  const down = coordinates.fromClient(delivered.down)
  const up = coordinates.fromClient(delivered.up)
  const expected = { x: origin.x + up.x - down.x, y: origin.y + up.y - down.y }
  const farPosition = await objectPosition(planet)
  expect(farPosition.x).toBeCloseTo(expected.x, 5)
  expect(farPosition.y).toBeCloseTo(expected.y, 5)
  expect(farPosition.x).toBeGreaterThan(960)
  expect(farPosition.y).toBeGreaterThan(560)
  const farTransform = await planet.getAttribute('transform')
  await expect(primaryMark).toHaveAttribute('transform', primaryBefore ?? '')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await expect(ring).toBeVisible()
  await expect(planet).toBeVisible()
  const mapBounds = await map.boundingBox()
  const envelope = await owner.locator('.continuous-warden-system-envelope').boundingBox()
  if (!mapBounds || !envelope) throw new Error('The expanded system needs a visible canvas and envelope.')
  for (const feature of [ring, planet]) {
    const bounds = await feature.boundingBox()
    if (!bounds) throw new Error('The expanded system feature is not measurable.')
    for (const containing of [mapBounds, envelope]) {
      expect(bounds.x).toBeGreaterThanOrEqual(containing.x - 1)
      expect(bounds.y).toBeGreaterThanOrEqual(containing.y - 1)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(containing.x + containing.width + 1)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(containing.y + containing.height + 1)
    }
  }
  const svg = await downloadImage(page, 'image/svg+xml', 'Selected system')
  if (!svg.text) throw new Error('The applied system SVG is missing.')
  const svgInfo = await inspectImageSvg(page, svg.text)
  expect(svgInfo.texts).toContain(fixturePlanet.name)
  await expectExportedSystemSceneInsideViewBox(page, svg.text, svgInfo.viewBox)
  const exported = await page.evaluate(({ text, objectId, orbitId }) => {
    const document = new DOMParser().parseFromString(text, 'image/svg+xml')
    return {
      planetTransform: document.querySelector(`.continuous-warden-object[data-object-id="${objectId}"]`)?.getAttribute('transform'),
      orbitRadius: document.querySelector(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)?.getAttribute('rx'),
      systemIds: [...document.querySelectorAll('.continuous-warden-system')].map(system => system.getAttribute('data-system-id')),
    }
  }, { text: svg.text, objectId: planetObject.id, orbitId: orbitObject.id })
  expect(exported.planetTransform).toBe(farTransform)
  expect(exported.orbitRadius).toBe(resizedRadius)
  expect(exported.systemIds).toEqual([system.id])
  const png = await downloadImage(page, 'image/png', 'Selected system')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBe(svgInfo.width)
  expect(png.height).toBe(svgInfo.height)
  if (!png.sourceSvgText) throw new Error('The system PNG has no source SVG.')
  const pngScene = await inspectImageSvg(page, png.sourceSvgText)
  expect(pngScene.texts).toContain(fixturePlanet.name)
  expect(pngScene.viewBox).toEqual(svgInfo.viewBox)
  await waitForWorkspaceSaved(page)
  const saved = await downloadJson(page, 'Export Jump Cluster JSON')
  const savedPlanet = saved.cluster?.systems.find(candidate => candidate.id === system.id)?.objects.find(object => object.id === planetObject.id)
  if (savedPlanet?.placement.kind !== 'system') throw new Error('The saved far Planet must keep its free placement.')
  expect(savedPlanet.placement.x).toBeCloseTo((expected.x - 64) / 832, 6)
  expect(savedPlanet.placement.y).toBeCloseTo((expected.y - 72) / 416, 6)
  await page.reload()
  await waitForWorkspaceStartup(page)
  await openVesper()
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(saved)
  await expect(primaryMark).toHaveAttribute('transform', primaryBefore ?? '')
  await expect(planet).toHaveAttribute('transform', farTransform ?? '')
  await expect(ring).toHaveAttribute('rx', resizedRadius)
})
