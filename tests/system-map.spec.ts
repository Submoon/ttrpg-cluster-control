import { expect, test, type Locator, type Page } from './fixtures'
import { createLocalWorkspace, createOrbit, createSystemObject, exportStarSystem } from '../domain/workspace'
import {
  captureMapExportBlobs, centerWorkspaceSelection, createSingleSystemWorkspace, downloadImage, downloadJson,
  exposedContinuousObjectHitPoint, hideWorkspaceInspector, inspectImageSvg,
  measureMouseDrag, openMapFilesSection, openWorkspaceHierarchy, resolveImportReview, reviewStarSystemImport,
  setHeaderMapActionsOpen, setWorkspaceMapMode, waitForWorkspaceSaved, waitForWorkspaceStartup, wardenLocalCoordinates,
  wardenMap, wardenObjectMark, wardenObjectLocalPosition, wardenOrbitLocalGeometry, wardenOrbitLocalRadii, workspaceZoomControls, type WorldPoint,
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
  return wardenObjectLocalPosition(mark)
}

async function expectObjectPosition(mark: Locator, expected: WorldPoint): Promise<void> {
  const coordinates = await wardenLocalCoordinates(mark.page(), (await mark.getAttribute('data-system-id'))!)
  const position = await objectPosition(mark)
  const actual = coordinates.toClient(position)
  const target = coordinates.toClient(expected)
  expect(Math.hypot(actual.x - target.x, actual.y - target.y)).toBeLessThan(.01)
}

async function resizePaintedOrbit(page: Page, ring: Locator, factor: number): Promise<void> {
  const points = await ring.evaluate((element, factor) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit target is not an ellipse.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The Orbit target is not attached to the map.')
    const cx = element.cx.baseVal.value
    const cy = element.cy.baseVal.value
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const center = new DOMPoint(cx, cy).matrixTransform(matrix)
    const screenRadius = Math.max(Math.hypot(matrix.a * rx, matrix.b * rx), Math.hypot(matrix.c * ry, matrix.d * ry))
    const samples = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    const map = element.closest('svg')
    // Dashed paint and edit handles move with the live camera. Sample the exact rounded native hit.
    for (let sample = 0; sample < samples; sample += 1) {
      const offset = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / samples
      const point = new DOMPoint(cx + rx * Math.cos(.5 + offset), cy + ry * Math.sin(.5 + offset)).matrixTransform(matrix)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const start = { x: Math.round(point.x) + dx, y: Math.round(point.y) + dy }
          if (document.elementFromPoint(start.x, start.y) !== element) continue
          const end = { x: Math.round(center.x + (start.x - center.x) * factor), y: Math.round(center.y + (start.y - center.y) * factor) }
          const reachable = Array.from({ length: 7 }, (_, step) => map?.contains(document.elementFromPoint(
            start.x + (end.x - start.x) * step / 6, start.y + (end.y - start.y) * step / 6,
          ))).every(Boolean)
          if (reachable) return { start, end }
        }
      }
    }
    throw new Error('The Orbit has no frontmost painted ring hit with a reachable native resize path.')
  }, factor)
  await measureMouseDrag(page, points.start, points.end, { eventFamily: 'pointer' })
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
  test.setTimeout(90_000)
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
    await hierarchy.getByRole('treeitem', { name: `${system.name}`, exact: true }).click()
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
  const primaryBefore = await objectPosition(primaryMark)
  const radius = (await wardenOrbitLocalRadii(ring)).horizontal
  const resizeAngle = .5
  const resizeTarget = { x: 480 + 1070 * Math.cos(resizeAngle), y: 280 + 1070 * Math.sin(resizeAngle) }
  await ensureLocalPointsReachable(page, system.id, [
    { x: 480 + radius * Math.cos(resizeAngle), y: 280 + radius * Math.sin(resizeAngle) }, resizeTarget,
  ])
  await resizePaintedOrbit(page, ring, 1070 / radius)
  await expect.poll(async () => (await wardenOrbitLocalRadii(ring)).horizontal).toBeGreaterThan(960)
  const resizedRadius = (await wardenOrbitLocalRadii(ring)).horizontal
  await ensureLocalPointsReachable(page, system.id, [await objectPosition(planet), { x: 1750, y: 800 }])
  const coordinates = await wardenLocalCoordinates(page, system.id)
  const origin = await objectPosition(planet)
  const start = await exposedContinuousObjectHitPoint(planet)
  if (!start) throw new Error('The Planet needs an exposed native Move target.')
  const originClient = coordinates.toClient(origin)
  const targetClient = coordinates.toClient({ x: 1750, y: 800 })
  const delivered = await measureMouseDrag(page, start, { x: start.x + targetClient.x - originClient.x, y: start.y + targetClient.y - originClient.y }, { eventFamily: 'pointer' })
  const down = coordinates.fromClient(delivered.down)
  const up = coordinates.fromClient(delivered.up)
  const expected = { x: origin.x + up.x - down.x, y: origin.y + up.y - down.y }
  const farPosition = await objectPosition(planet)
  const rendered = coordinates.toClient(farPosition)
  const expectedRendered = coordinates.toClient(expected)
  // SVGMatrix rounds large local coordinates; allow 0.01 CSS pixel only for this rendered observation.
  expect(Math.abs(rendered.x - expectedRendered.x)).toBeLessThanOrEqual(.01)
  expect(Math.abs(rendered.y - expectedRendered.y)).toBeLessThanOrEqual(.01)
  expect(farPosition.x).toBeGreaterThan(960)
  expect(farPosition.y).toBeGreaterThan(560)
  await expectObjectPosition(primaryMark, primaryBefore)
  const orbitGeometry = await wardenOrbitLocalGeometry(ring, system.id)
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const mapBounds = await map.boundingBox()
  const envelope = await owner.locator('.continuous-warden-system-envelope').boundingBox()
  if (!mapBounds || !envelope) throw new Error('The expanded system needs a visible canvas and envelope.')
  // Fit can collapse the interior. Check the committed ring and object in the fitted camera.
  const fittedCoordinates = await wardenLocalCoordinates(page, system.id)
  const { center, radii } = orbitGeometry
  const fittedPoints = [
    { x: envelope.x, y: envelope.y },
    { x: envelope.x + envelope.width, y: envelope.y + envelope.height },
    ...[
      { x: center.x - radii.horizontal, y: center.y - radii.vertical },
      { x: center.x + radii.horizontal, y: center.y + radii.vertical },
      farPosition,
    ].map(fittedCoordinates.toClient),
  ]
  for (const point of fittedPoints) {
    expect(point.x).toBeGreaterThanOrEqual(mapBounds.x - 1)
    expect(point.y).toBeGreaterThanOrEqual(mapBounds.y - 1)
    expect(point.x).toBeLessThanOrEqual(mapBounds.x + mapBounds.width + 1)
    expect(point.y).toBeLessThanOrEqual(mapBounds.y + mapBounds.height + 1)
  }
  const images = await openMapFilesSection(page, 'Export an image', 'keyboard')
  const imageScope = images.getByRole('menuitem', { name: /^Warden image scope/ })
  await imageScope.press('ArrowRight')
  const selectedSystemScope = page.getByRole('menuitem', { name: 'Selected system', exact: true })
  await expect(selectedSystemScope).toBeEnabled()
  await selectedSystemScope.press('Enter')
  await expect(imageScope).toHaveAccessibleName('Warden image scope · Selected system')
  await setHeaderMapActionsOpen(page, false)
  const svg = await downloadImage(page, 'image/svg+xml')
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
  const exportedPosition = exported.planetTransform?.match(/^translate\(([-+.\deE]+)[ ,]+([-+.\deE]+)\)/)
  expect(exportedPosition).not.toBeNull()
  const exportedClient = coordinates.toClient({ x: Number(exportedPosition?.[1]), y: Number(exportedPosition?.[2]) })
  expect(Math.hypot(exportedClient.x - rendered.x, exportedClient.y - rendered.y)).toBeLessThan(.01)
  expect(Number(exported.orbitRadius)).toBeCloseTo(resizedRadius, 3)
  expect(exported.systemIds).toEqual([system.id])
  const png = await downloadImage(page, 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  if (!png.width || !png.height) throw new Error('The system PNG is missing its raster dimensions.')
  expect(png.width).toBeGreaterThan(svgInfo.width)
  expect(png.height).toBeGreaterThan(svgInfo.height)
  // Each format rounds its output dimensions independently.
  expect(Math.abs(png.height - png.width * svgInfo.viewBox[3]! / svgInfo.viewBox[2]!)).toBeLessThanOrEqual(2)
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
  await expectObjectPosition(primaryMark, primaryBefore)
  await expectObjectPosition(planet, farPosition)
  expect((await wardenOrbitLocalRadii(ring)).horizontal).toBeCloseTo(resizedRadius, 3)
})
