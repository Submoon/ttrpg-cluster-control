import { expect, test, type Locator, type Page } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { waitForWorkspaceSaved, resolveImportReview, reviewStarSystemImport } from './helpers'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  downloadJson,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  setWorkspaceMapMode,
  wardenLocalCoordinates,
  wardenMap,
  wardenObjectLocalPosition,
  workspaceNavigation,
} from './helpers'
import type { ExportedMap, ExportedObject, WorldPoint } from './helpers'

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
  return map.locator(`.continuous-warden-object[data-object-id="${objectId}"]`)
}

async function objectMapPosition(map: Locator, objectId: string): Promise<WorldPoint> {
  return wardenObjectLocalPosition(objectMark(map, objectId))
}

async function renderedMapObjects(map: Locator) {
  const rendered = await map.locator('.continuous-warden-object[data-object-id]').evaluateAll(marks => marks.map(mark => {
    const name = mark.querySelector('.continuous-warden-object-name')?.textContent
    const id = mark.getAttribute('data-object-id')
    return { name, id }
  }))
  const entries: Array<readonly [string, { id: string; point: WorldPoint }]> = []
  for (const { name, id } of rendered) {
    if (!name || !id) throw new Error('The rendered object has no name or identity.')
    entries.push([name, { id, point: await objectMapPosition(map, id) }])
  }
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

async function createDenseReach(page: Page, fixture: ExportedMap = creationGeometryFixture as ExportedMap): Promise<{ map: Locator; systemId: string }> {
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const preview = await reviewStarSystemImport(page, 'dense-reach.json', JSON.stringify(fixture))
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Inspect Dense Reach', exact: true }).click()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  if (!initial.system) throw new Error('The imported Dense Reach did not export its applied system.')
  const systemId = initial.system.id
  const map = wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
  await expect(map).toBeVisible()
  await waitForWorkspaceSaved(page)
  return { map, systemId }
}

function normalizedPoint(point: WorldPoint): WorldPoint {
  return { x: (point.x - 64) / 832, y: (point.y - 72) / 416 }
}

/** Keeps the object under the delivered pointer offset while its carried geometry is previewed. */
async function beginObjectDrag(page: Page, systemId: string, map: Locator, objectId: string, target: WorldPoint) {
  const object = objectMark(map, objectId)
  const origin = await objectMapPosition(map, objectId)
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const start = await object.locator('.continuous-warden-object-hit-target').evaluate((circle) => {
    if (!(circle instanceof SVGCircleElement)) throw new Error('The object has no circular hit target.')
    const matrix = circle.getScreenCTM()
    const owner = circle.closest('.continuous-warden-object')
    if (!matrix || !owner) throw new Error('The object hit target is not attached to its owner.')
    for (const fraction of [0, .45, .68, .87]) {
      for (let index = 0; index < 24; index += 1) {
        const angle = index * Math.PI / 12
        const point = new DOMPoint(
          circle.cx.baseVal.value + Math.cos(angle) * circle.r.baseVal.value * fraction,
          circle.cy.baseVal.value + Math.sin(angle) * circle.r.baseVal.value * fraction,
        ).matrixTransform(matrix)
        const hit = { x: Math.round(point.x), y: Math.round(point.y) }
        if (document.elementFromPoint(hit.x, hit.y)?.closest('.continuous-warden-object') === owner) return hit
      }
    }
    throw new Error('The owning object has no frontmost native pointer hit.')
  })
  const sourceClient = coordinates.toClient(origin)
  const sourceLocal = coordinates.fromClient(start)
  const moveTo = async (point: WorldPoint): Promise<WorldPoint> => {
    const requested = coordinates.toClient(point)
    const end = {
      x: Math.round(start.x + requested.x - sourceClient.x),
      y: Math.round(start.y + requested.y - sourceClient.y),
    }
    expect(await wardenMap(page).evaluate((element, point) =>
      element.contains(document.elementFromPoint(point.x, point.y)), end)).toBe(true)
    await page.mouse.move(end.x, end.y, { steps: 6 })
    const delivered = coordinates.fromClient(end)
    return { x: origin.x + delivered.x - sourceLocal.x, y: origin.y + delivered.y - sourceLocal.y }
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  try {
    const delivered = await moveTo(target)
    return { delivered, moveTo }
  } catch (error) {
    await page.mouse.up()
    throw error
  }
}






test('an existing object can preview and confirm a named Orbit or explicit free placement', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = structuredClone(creationGeometryFixture) as ExportedMap
  delete fixture.layout.objectAngles['creation-geometry-beta-colony']
  const { map, systemId } = await createDenseReach(page, fixture)
  const betaOrbitName = 'Orbit 2 around Primary Star'
  const applied = await downloadJson(page, 'Export star system JSON')
  const primary = applied.system?.objects.find(object => object.name === 'Primary Star')
  const betaOrbitId = applied.system?.orbits.find(orbit => orbit.hostId === primary?.id && orbit.order === 2)?.id
  const initialMarks = await renderedMapObjects(map)
  const oldPlanet = initialMarks.get('Old Planet')
  const oldMoon = initialMarks.get('Old Moon')
  const outerColony = initialMarks.get('Outer Colony')
  if (!primary || !betaOrbitId || !oldPlanet || !oldMoon || !outerColony) {
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
  await objectMark(map, oldPlanet.id).focus()
  await page.keyboard.press('Enter')
  await hideWorkspaceInspector(page)

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
  const betaRadii = orbitRadii(applied, betaOrbitId)
  const betaTarget = ellipsePoint(objectPosition(primary), betaRadii, Math.PI / 2, applied.layout.orbitRotations?.[betaOrbitId] ?? 0)
  const betaPoint = await clickWardenSystemPoint(page, systemId, normalizedPoint(betaTarget))
  const betaError = Math.hypot(64 + betaPoint.x * 832 - betaTarget.x, 72 + betaPoint.y * 416 - betaTarget.y)
  await placement.click()
  const { point: renderedPlanetBeta } = await expectCarriedBranchAt(
    map, betaTarget, 2 * betaError + 1e-6,
  )
  expect(Math.hypot(renderedPlanetBeta.x - oldPlanet.point.x, renderedPlanetBeta.y - oldPlanet.point.y)).toBeGreaterThan(2)

  await confirmPosition.click()
  await waitForWorkspaceSaved(page)
  const betaCommitted = await downloadJson(page, 'Export star system JSON')
  expect(betaCommitted.system?.objects.find(object => object.id === oldPlanet.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: betaOrbitId })
  expect(Math.abs(betaCommitted.layout.objectAngles[oldPlanet.id]! - Math.PI / 2))
    .toBeLessThanOrEqual(2 * Math.asin(Math.min(1, betaError / Math.min(betaRadii.horizontal, betaRadii.vertical))) + 1e-6)

  await placement.click()
  await destination.click()
  await freePlacement.click()
  await moveOnMap.click()
  const firstFreePoint = await clickWardenSystemPoint(page, systemId, { x: 0.63, y: 0.77 })
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
  const freePoint = await clickWardenSystemPoint(page, systemId, { x: 0.7, y: 0.72 })
  const expectedPlanetFree = { x: 64 + freePoint.x * 832, y: 72 + freePoint.y * 416 }
  await placement.click()
  await confirmPosition.click()
  await waitForWorkspaceSaved(page)

  await page.reload()
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Inspect Dense Reach', exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const restoredMap = wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
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

test('a direct single-object drag resolves overlapping Orbits deterministically and undoes exactly', async ({ page }) => {
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

  const { map, systemId } = await createDenseReach(page, ambiguousFixture)
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
  await setWorkspaceMapMode(page, 'Move')
  const drag = await beginObjectDrag(page, systemId, map, oldPlanet.id, destination)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-move-preview/)
  const pointerError = Math.hypot(drag.delivered.x - destination.x, drag.delivered.y - destination.y)
  const previewPosition = await objectMapPosition(map, oldPlanet.id)
  expectPointNear(previewPosition, destination, 2 * pointerError + 1e-4)
  expect(await downloadJson(page, 'Export star system JSON', 'keyboard')).toEqual(initial)
  await page.mouse.up()
  await waitForWorkspaceSaved(page)

  const committed = await downloadJson(page, 'Export star system JSON')
  const moved = committed.system?.objects.find(object => object.id === oldPlanet.id)
  if (!moved) throw new Error('The direct drag removed the moved object.')
  expect(moved.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expectPointNear(await objectMapPosition(map, oldPlanet.id), previewPosition, 0.01)
  const angleDifference = committed.layout.objectAngles[oldPlanet.id]! - Math.PI
  expect(Math.abs(Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference))))
    .toBeLessThanOrEqual(2 * Math.asin(Math.min(1, pointerError / Math.min(
      orbitRadii(initial, alphaOrbit.id).horizontal, orbitRadii(initial, alphaOrbit.id).vertical,
    ))) + 1e-6)
  await expect(page.getByRole('group', { name: 'Choose destination Orbit', exact: true })).toHaveCount(0)
  const history = page.locator('.workspace-history-controls')
  await history.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await history.getByRole('button', { name: /^Redo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(committed)
})



test('dragging an Orbit host across its carried ring follows the raw pointer and keeps nested objects attached', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { map, systemId } = await createDenseReach(page)
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
  await setWorkspaceMapMode(page, 'Move')
  const drag = await beginObjectDrag(page, systemId, map, oldPlanet.id, ringCrossing)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-move-preview/)
  const ringDelta = { x: drag.delivered.x - sourcePoint.x, y: drag.delivered.y - sourcePoint.y }
  expectPointNear(await objectMapPosition(map, oldPlanet.id), drag.delivered, 0.01)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), {
    x: originalNestedMoon.x + ringDelta.x,
    y: originalNestedMoon.y + ringDelta.y,
  })
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), {
    x: originalDeepAsteroid.x + ringDelta.x,
    y: originalDeepAsteroid.y + ringDelta.y,
  })
  expect(await downloadJson(page, 'Export star system JSON', 'keyboard')).toEqual(initial)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-move-preview/)

  const deliveredDrop = await drag.moveTo(rawDropPoint)
  const dropDelta = { x: deliveredDrop.x - sourcePoint.x, y: deliveredDrop.y - sourcePoint.y }
  expectPointNear(await objectMapPosition(map, oldPlanet.id), deliveredDrop, 0.01)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), {
    x: originalNestedMoon.x + dropDelta.x,
    y: originalNestedMoon.y + dropDelta.y,
  })
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), {
    x: originalDeepAsteroid.x + dropDelta.x,
    y: originalDeepAsteroid.y + dropDelta.y,
  })

  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  const committedPlanet = committedSystem?.objects.find(object => object.id === oldPlanet.id)
  if (!committedSystem || !committedPlanet) throw new Error('The moved system object is missing from the export.')
  expect(committedPlanet.placement.kind).toBe('system')
  expectPointNear(objectPosition(committedPlanet), deliveredDrop, 0.01)
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
