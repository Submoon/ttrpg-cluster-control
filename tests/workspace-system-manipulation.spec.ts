import { expect, test, type Locator, type Page } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { waitForWorkspaceSaved, resolveImportReview, reviewStarSystemImport } from './helpers'
import {
  beginDragToWorldPoint,
  captureMapExportBlobs,
  clickNormalizedSystemPoint,
  clickSystemOrbitPoint,
  downloadJson,
  ensureMapDragPointsReachable,
  openWorkspaceHierarchy,
  returnToClusterMap,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'
import type { DownloadWindow, ExportedMap, ExportedObject, WorldPoint } from './helpers'

type OrbitRadii = { horizontal: number; vertical: number }

function objectPosition(object: ExportedObject): WorldPoint {
  if (object.placement.kind !== 'system') {
    throw new Error(`Object "${object.name}" is not placed in the system map.`)
  }

  return {
    x: 64 + object.placement.x * 832,
    y: 72 + object.placement.y * 416,
  }
}

function orbitRadii(map: ExportedMap, orbitId: string): OrbitRadii {
  const radii = map.layout.orbitEllipseRadii?.[orbitId] ?? map.layout.orbitRadii[orbitId]
  if (radii === undefined) throw new Error(`Orbit "${orbitId}" has no exported radii.`)
  return typeof radii === 'number' ? { horizontal: radii, vertical: radii } : radii
}

/** Computes a point from the fixture's ellipse parameters without using production geometry helpers. */
function ellipsePoint(
  center: WorldPoint,
  radii: OrbitRadii,
  angle: number,
  rotationDegrees: number,
): WorldPoint {
  const rotation = rotationDegrees * Math.PI / 180
  const localX = Math.cos(angle) * radii.horizontal
  const localY = Math.sin(angle) * radii.vertical
  return {
    x: center.x + localX * Math.cos(rotation) - localY * Math.sin(rotation),
    y: center.y + localX * Math.sin(rotation) + localY * Math.cos(rotation),
  }
}

function objectMark(map: Locator, objectId: string): Locator {
  return map.locator(`.system-object[data-object-id="${objectId}"]`)
}

async function objectMapPosition(map: Locator, objectId: string): Promise<WorldPoint> {
  const transform = await objectMark(map, objectId).getAttribute('transform')
  const match = transform?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
  if (!match) throw new Error(`Could not read the rendered position of map object "${objectId}".`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

async function renderedMapObjects(map: Locator) {
  const entries = await map.locator('.system-object[data-object-id]').evaluateAll(marks => marks.map(mark => {
    const name = mark.querySelector('.object-name')?.textContent
    const id = mark.getAttribute('data-object-id')
    const point = mark.getAttribute('transform')?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
    if (!name || !id || !point) throw new Error('The rendered object has no name, identity or position.')
    return [name, { id, point: { x: Number(point[1]), y: Number(point[2]) } }] as const
  }))
  return new Map(entries)
}

function expectPointNear(actual: WorldPoint, expected: WorldPoint, tolerance = 1): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance)
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance)
}

function implicitOrbitAngle(system: NonNullable<ExportedMap['system']>, objectId: string, orbitId: string): number {
  const siblings = system.objects.filter(
    object => object.placement.kind === 'orbit' && object.placement.orbitId === orbitId,
  )
  const index = siblings.findIndex(object => object.id === objectId)
  if (index < 0) throw new Error(`Object "${objectId}" is not a child of Orbit "${orbitId}".`)
  return -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
}

async function createDenseReach(page: Page, fixture: ExportedMap = creationGeometryFixture as ExportedMap): Promise<Locator> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await returnToClusterMap(page)
  const preview = await reviewStarSystemImport(page, 'dense-reach.json', JSON.stringify(fixture))
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const map = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(map).toBeVisible()
  return map
}

async function ensureObjectPlacementOpen(page: Page): Promise<void> {
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'true')
}

/** Exports through the visible file controls without moving the held map pointer. */
async function downloadSystemJsonDuringDrag(page: Page): Promise<ExportedMap> {
  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  await expect(mapFiles).toBeVisible()
  if (await mapFiles.getAttribute('aria-expanded') !== 'true') await mapFiles.press('Enter')
  const exportButton = page.getByRole('button', { name: 'Export star system JSON', exact: true })
  await expect(exportButton).toBeVisible()

  const pendingDownload = page.waitForEvent('download')
  await exportButton.press('Enter')
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.json$/i)

  const json = await page.evaluate(async () => {
    const blob = (window as DownloadWindow).__mapExportBlobs?.shift()
    if (!blob) throw new Error('Could not read the downloaded JSON file.')
    return blob.text()
  })
  if (await mapFiles.getAttribute('aria-expanded') === 'true') await mapFiles.press('Enter')
  return JSON.parse(json) as ExportedMap
}






test('an existing object can preview and confirm a named Orbit or explicit free placement', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = structuredClone(creationGeometryFixture) as ExportedMap
  delete fixture.layout.objectAngles['creation-geometry-beta-colony']
  const map = await createDenseReach(page, fixture)
  const betaOrbitName = 'Orbit 2 around Primary Star'
  const betaOrbitId = await map.getByRole('group', { name: betaOrbitName, exact: true }).getAttribute('data-orbit-id')
  const initialMarks = await renderedMapObjects(map)
  const oldPlanet = initialMarks.get('Old Planet')
  const oldMoon = initialMarks.get('Old Moon')
  const outerColony = initialMarks.get('Outer Colony')
  if (!betaOrbitId || !oldPlanet || !oldMoon || !outerColony) {
    throw new Error('The imported system is missing a required map mark.')
  }

  const nestedRadii = orbitRadii(fixture, 'creation-geometry-nested')
  const deepRadii = orbitRadii(fixture, 'creation-geometry-deep')
  const nestedAngle = creationGeometryFixture.layout.objectAngles['creation-geometry-nested-moon']
  const deepAsteroidAngle = creationGeometryFixture.layout.objectAngles['creation-geometry-deep-asteroid']
  const nestedRotation = creationGeometryFixture.layout.orbitRotations['creation-geometry-nested']
  const deepRotation = creationGeometryFixture.layout.orbitRotations['creation-geometry-deep']
  const expectCarriedBranchAt = async (targetMap: Locator, point: WorldPoint, tolerance = 1) => {
    const marks = await renderedMapObjects(targetMap)
    const planet = marks.get('Old Planet')
    const moon = marks.get('Nested Moon')
    const asteroid = marks.get('Deep Asteroid')
    if (!planet || !moon || !asteroid) throw new Error('The rendered branch is missing an expected object.')
    expectPointNear(planet.point, point, tolerance)
    const expectedMoon = ellipsePoint(planet.point, nestedRadii, nestedAngle, nestedRotation)
    const expectedAsteroid = ellipsePoint(expectedMoon, deepRadii, deepAsteroidAngle, deepRotation)
    expectPointNear(moon.point, expectedMoon)
    expectPointNear(asteroid.point, expectedAsteroid)
    return { marks, point: planet.point }
  }

  await setWorkspaceMapMode(page, 'Move')
  await map.getByRole('button', { name: /^Select .*Old Planet/ }).click()

  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await placement.click()
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true })
  const moveOnMap = page.getByRole('button', { name: 'Move on map', exact: true })
  const confirmPosition = page.getByRole('button', { name: 'Confirm position', exact: true })
  const freePlacement = page.getByRole('option', { name: 'Free placement', exact: true })
  await destination.click()
  await expect(page.getByRole('option', { name: /^Orbit 1 around (Old Planet|Nested Moon)$/ })).toHaveCount(0)
  await page.getByRole('option', { name: betaOrbitName, exact: true }).click()

  await moveOnMap.click()
  const betaPoint = await clickSystemOrbitPoint(page, map, betaOrbitName, 90)
  await placement.click()
  const { point: renderedPlanetBeta } = await expectCarriedBranchAt(
    map, { x: 64 + betaPoint.x * 832, y: 72 + betaPoint.y * 416 }, 2,
  )
  expect(Math.hypot(renderedPlanetBeta.x - oldPlanet.point.x, renderedPlanetBeta.y - oldPlanet.point.y)).toBeGreaterThan(2)

  await confirmPosition.click()
  await waitForWorkspaceSaved(page)
  const betaCommitted = await downloadJson(page, 'Export star system JSON')
  expect(betaCommitted.system?.objects.find(object => object.id === oldPlanet.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: betaOrbitId })
  expect(betaCommitted.layout.objectAngles[oldPlanet.id]).toBeCloseTo(Math.PI / 2, 2)

  await placement.click()
  await destination.click()
  await freePlacement.click()
  await moveOnMap.click()
  const firstFreePoint = await clickNormalizedSystemPoint(page, map, { x: 0.63, y: 0.77 })
  await expectCarriedBranchAt(map, { x: 64 + firstFreePoint.x * 832, y: 72 + firstFreePoint.y * 416 })
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(betaCommitted)

  await placement.click()
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  await expect(placement).toBeFocused()
  await expectCarriedBranchAt(map, renderedPlanetBeta)

  await placement.click()
  await destination.click()
  await freePlacement.click()
  await moveOnMap.click()
  const freePoint = await clickNormalizedSystemPoint(page, map, { x: 0.7, y: 0.72 })
  const expectedPlanetFree = { x: 64 + freePoint.x * 832, y: 72 + freePoint.y * 416 }
  await placement.click()
  await confirmPosition.click()
  await waitForWorkspaceSaved(page)

  await page.reload()
  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const restoredMap = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(restoredMap).toBeVisible()
  const restored = await downloadJson(page, 'Export star system JSON')
  const restoredPlanet = restored.system?.objects.find(object => object.id === oldPlanet.id)
  if (restoredPlanet?.placement.kind !== 'system') throw new Error('The confirmed free placement did not survive reload.')
  expect(restoredPlanet.placement.x).toBeCloseTo(freePoint.x, 6)
  expect(restoredPlanet.placement.y).toBeCloseTo(freePoint.y, 6)
  expect(restored.layout.objectAngles[oldPlanet.id]).toBeUndefined()
  const { marks: restoredMarks } = await expectCarriedBranchAt(restoredMap, expectedPlanetFree)
  const restoredOldMoon = restoredMarks.get('Old Moon')
  const restoredOuterColony = restoredMarks.get('Outer Colony')
  if (!restoredOldMoon || !restoredOuterColony) throw new Error('The restored map lost an unaffected object.')
  expectPointNear(restoredOldMoon.point, oldMoon.point)
  expectPointNear(restoredOuterColony.point, outerColony.point)
})

test('an ambiguous object drag offers overlapping Orbit destinations before confirmation', async ({ page }) => {
  await captureMapExportBlobs(page)
  const ambiguousFixture = JSON.parse(JSON.stringify(creationGeometryFixture)) as ExportedMap
  const fixtureSystem = ambiguousFixture.system
  if (!fixtureSystem) throw new Error('The geometry fixture is missing its star system.')
  const fixturePrimary = fixtureSystem.objects.find(object => object.name === 'Primary Star')
  if (!fixturePrimary) throw new Error('The geometry fixture is missing Primary Star.')
  const fixtureAlpha = fixtureSystem.orbits.find(orbit => orbit.hostId === fixturePrimary.id && orbit.order === 1)
  const fixtureBeta = fixtureSystem.orbits.find(orbit => orbit.hostId === fixturePrimary.id && orbit.order === 2)
  if (!fixtureAlpha || !fixtureBeta) throw new Error('The geometry fixture is missing its root Orbits.')
  const fixtureOrbitRotations = ambiguousFixture.layout.orbitRotations
  const alphaRotation = fixtureOrbitRotations?.[fixtureAlpha.id]
  if (!fixtureOrbitRotations || alphaRotation === undefined) {
    throw new Error('The geometry fixture is missing its root Orbit rotations.')
  }
  ambiguousFixture.layout.orbitRadii[fixtureBeta.id] = orbitRadii(ambiguousFixture, fixtureAlpha.id)
  fixtureOrbitRotations[fixtureBeta.id] = alphaRotation

  const map = await createDenseReach(page, ambiguousFixture)
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  if (!primary || !oldPlanet) throw new Error('The imported geometry fixture is missing a map object.')
  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  const betaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)
  if (!alphaOrbit || !betaOrbit) throw new Error('The imported geometry fixture is missing a root Orbit.')

  const destination = ellipsePoint(objectPosition(primary), orbitRadii(initial, alphaOrbit.id), Math.PI,
    initial.layout.orbitRotations?.[alphaOrbit.id] ?? 0)
  const hitTarget = objectMark(map, oldPlanet.id).locator('.object-hit-target')
  await setWorkspaceMapMode(page, 'Move')
  await ensureMapDragPointsReachable(page, map, hitTarget, destination)
  await beginDragToWorldPoint(page, map, hitTarget, destination)
  await page.mouse.up()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await ensureObjectPlacementOpen(page)
  const chooser = page.getByRole('group', { name: 'Choose destination Orbit', exact: true })
  await expect(chooser).toBeVisible()
  await expect(chooser.getByRole('button', { name: 'Orbit 1 around Primary Star', exact: true })).toBeVisible()
  await chooser.getByRole('button', { name: 'Orbit 2 around Primary Star', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), destination)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await ensureObjectPlacementOpen(page)
  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const committed = await downloadJson(page, 'Export star system JSON')
  expect(committed.system?.objects.find(object => object.id === oldPlanet.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: betaOrbit.id })
})



test('dragging an Orbit host across its carried ring follows the raw pointer and keeps nested objects attached', async ({ page }) => {
  await captureMapExportBlobs(page)
  const map = await createDenseReach(page)
  const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeHierarchy.isVisible()) await closeHierarchy.click()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const oldMoon = system.objects.find(object => object.name === 'Old Moon')
  const nestedMoon = system.objects.find(object => object.name === 'Nested Moon')
  const deepAsteroid = system.objects.find(object => object.name === 'Deep Asteroid')
  if (!primary || !oldPlanet || !oldMoon || !nestedMoon || !deepAsteroid) {
    throw new Error('The imported geometry fixture is missing an expected map object.')
  }
  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  const nestedOrbit = system.orbits.find(orbit => orbit.hostId === oldPlanet.id && orbit.order === 1)
  const deepOrbit = system.orbits.find(orbit => orbit.hostId === nestedMoon.id && orbit.order === 1)
  if (!alphaOrbit || !nestedOrbit || !deepOrbit) {
    throw new Error('The imported geometry fixture is missing an expected hosted Orbit.')
  }
  expect(oldPlanet.placement.kind).toBe('orbit')

  const sourcePoint = await objectMapPosition(map, oldPlanet.id)
  const nestedRadii = orbitRadii(initial, nestedOrbit.id)
  const nestedRotation = initial.layout.orbitRotations?.[nestedOrbit.id] ?? 0
  expect(nestedRadii).toEqual({ horizontal: 80, vertical: 55 })
  expect(nestedRotation).toBe(25)
  const ringCrossing = ellipsePoint(sourcePoint, nestedRadii, 0, nestedRotation)
  const rawDropPoint = { x: 800, y: 430 }
  const originalNestedMoon = await objectMapPosition(map, nestedMoon.id)
  const originalDeepAsteroid = await objectMapPosition(map, deepAsteroid.id)
  const hitTarget = objectMark(map, oldPlanet.id).locator('.object-hit-target')

  await setWorkspaceMapMode(page, 'Move')
  await ensureMapDragPointsReachable(page, map, hitTarget, ringCrossing)
  await ensureMapDragPointsReachable(page, map, hitTarget, rawDropPoint)
  await beginDragToWorldPoint(page, map, hitTarget, ringCrossing)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)
  const ringDelta = { x: ringCrossing.x - sourcePoint.x, y: ringCrossing.y - sourcePoint.y }
  expectPointNear(await objectMapPosition(map, oldPlanet.id), ringCrossing)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), {
    x: originalNestedMoon.x + ringDelta.x,
    y: originalNestedMoon.y + ringDelta.y,
  })
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), {
    x: originalDeepAsteroid.x + ringDelta.x,
    y: originalDeepAsteroid.y + ringDelta.y,
  })
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)

  const dropScreenPoint = await map.evaluate((element, point) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(transform)
    return { x: screenPoint.x, y: screenPoint.y }
  }, rawDropPoint)
  await page.mouse.move(dropScreenPoint.x, dropScreenPoint.y, { steps: 6 })
  const dropDelta = { x: rawDropPoint.x - sourcePoint.x, y: rawDropPoint.y - sourcePoint.y }
  expectPointNear(await objectMapPosition(map, oldPlanet.id), rawDropPoint)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), {
    x: originalNestedMoon.x + dropDelta.x,
    y: originalNestedMoon.y + dropDelta.y,
  })
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), {
    x: originalDeepAsteroid.x + dropDelta.x,
    y: originalDeepAsteroid.y + dropDelta.y,
  })

  await page.mouse.up()
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  const committedPlanet = committedSystem?.objects.find(object => object.id === oldPlanet.id)
  if (!committedSystem || !committedPlanet) throw new Error('The moved system object is missing from the export.')
  expect(committedPlanet.placement.kind).toBe('system')
  expectPointNear(objectPosition(committedPlanet), rawDropPoint)
  expect(committed.layout.objectAngles[oldPlanet.id]).toBeUndefined()
  expect(committed.layout.objectAngles[oldMoon.id]).toBeCloseTo(
    initial.layout.objectAngles[oldMoon.id] ?? implicitOrbitAngle(system, oldMoon.id, alphaOrbit.id),
  )
  const committedNestedMoonPosition = ellipsePoint(
    objectPosition(committedPlanet),
    orbitRadii(committed, nestedOrbit.id),
    committed.layout.objectAngles[nestedMoon.id]!,
    committed.layout.orbitRotations?.[nestedOrbit.id] ?? 0,
  )
  const committedDeepAsteroidPosition = ellipsePoint(
    committedNestedMoonPosition,
    orbitRadii(committed, deepOrbit.id),
    committed.layout.objectAngles[deepAsteroid.id]!,
    committed.layout.orbitRotations?.[deepOrbit.id] ?? 0,
  )
  expectPointNear(await objectMapPosition(map, nestedMoon.id), committedNestedMoonPosition)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), committedDeepAsteroidPosition)
})
