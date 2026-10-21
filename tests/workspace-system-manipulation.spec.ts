import { expect, test, type Locator, type Page } from '@playwright/test'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import {
  activeWorkspaceFeedback,
  beginDragToWorldPoint,
  captureMapExportBlobs,
  downloadJson,
  ensureMapDragPointsReachable,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  returnToClusterMap,
  selectInspectorOption,
  setJsonFile,
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
  const importDialog = page.waitForEvent('dialog')
  await setJsonFile(
    jsonMapImportInput(page),
    'dense-reach.json',
    JSON.stringify(fixture),
  )
  const preview = await importDialog
  expect(preview.message()).toContain('Star systems: 1')
  await preview.accept()

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

test('dragging an attached object into empty space previews its raw drop and preserves dependent geometry', async ({ page }) => {
  await captureMapExportBlobs(page)
  const dragOutFixture = JSON.parse(JSON.stringify(creationGeometryFixture)) as ExportedMap
  const fixturePlanet = dragOutFixture.system?.objects.find(object => object.name === 'Old Planet')
  if (!fixturePlanet) throw new Error('The imported geometry fixture is missing Old Planet.')
  dragOutFixture.layout.objectAngles[fixturePlanet.id] = -Math.PI / 2
  const map = await createDenseReach(page, dragOutFixture)
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

  expect(oldPlanet.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expect(oldMoon.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expect(initial.layout.objectAngles[oldPlanet.id]).toBeCloseTo(-Math.PI / 2)
  expect(initial.layout.objectAngles[oldMoon.id]).toBeUndefined()
  const oldMoonAngle = implicitOrbitAngle(system, oldMoon.id, alphaOrbit.id)
  const originalOldMoonPosition = await objectMapPosition(map, oldMoon.id)
  const alphaCenter = objectPosition(primary)
  const alphaRadii = orbitRadii(initial, alphaOrbit.id)
  const alphaRotation = initial.layout.orbitRotations?.[alphaOrbit.id] ?? 0
  // This drop is 70 units beyond Alpha, outside the Orbit snap tolerance.
  const rawDropPoint = ellipsePoint(
    alphaCenter,
    { horizontal: alphaRadii.horizontal + 70, vertical: alphaRadii.vertical },
    0,
    alphaRotation,
  )

  const planetHitTarget = objectMark(map, oldPlanet.id).locator('.object-hit-target')
  await ensureMapDragPointsReachable(page, map, planetHitTarget, rawDropPoint)
  await beginDragToWorldPoint(page, map, planetHitTarget, rawDropPoint)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)

  const nestedAngle = initial.layout.objectAngles[nestedMoon.id]
  const deepAsteroidAngle = initial.layout.objectAngles[deepAsteroid.id]
  if (nestedAngle === undefined || deepAsteroidAngle === undefined) {
    throw new Error('The imported fixture is missing a dependent object angle.')
  }
  const expectedNestedMoon = ellipsePoint(
    rawDropPoint,
    orbitRadii(initial, nestedOrbit.id),
    nestedAngle,
    initial.layout.orbitRotations?.[nestedOrbit.id] ?? 0,
  )
  const expectedDeepAsteroid = ellipsePoint(
    expectedNestedMoon,
    orbitRadii(initial, deepOrbit.id),
    deepAsteroidAngle,
    initial.layout.orbitRotations?.[deepOrbit.id] ?? 0,
  )

  const previewPlanetPosition = await objectMapPosition(map, oldPlanet.id)
  const previewNestedMoonPosition = await objectMapPosition(map, nestedMoon.id)
  const previewDeepAsteroidPosition = await objectMapPosition(map, deepAsteroid.id)
  expectPointNear(previewPlanetPosition, rawDropPoint)
  expectPointNear(previewNestedMoonPosition, expectedNestedMoon)
  expectPointNear(previewDeepAsteroidPosition, expectedDeepAsteroid)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalOldMoonPosition)
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)

  await page.mouse.up()
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  if (!committedSystem) throw new Error('The moved Dense Reach workspace did not export a star system.')
  const committedPlanet = committedSystem.objects.find(object => object.id === oldPlanet.id)
  if (!committedPlanet) throw new Error('The moved planet is missing from the exported system.')
  expect(committedPlanet.placement.kind).toBe('system')
  expect(committed.layout.objectAngles[oldPlanet.id]).toBeUndefined()
  expect(committed.layout.objectAngles[oldMoon.id]).toBeCloseTo(oldMoonAngle)

  const committedPlanetPosition = objectPosition(committedPlanet)
  const committedNestedMoonPosition = ellipsePoint(
    committedPlanetPosition,
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

  expectPointNear(committedPlanetPosition, rawDropPoint)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), previewPlanetPosition)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), previewNestedMoonPosition)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), previewDeepAsteroidPosition)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), committedNestedMoonPosition)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), committedDeepAsteroidPosition)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalOldMoonPosition)
})

test('an existing attached object supports numeric Orbit-angle preview, cancellation, and confirmation', async ({ page }) => {
  await captureMapExportBlobs(page)
  const map = await createDenseReach(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')

  const primary = system.objects.find(object => object.name === 'Primary Star')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const nestedMoon = system.objects.find(object => object.name === 'Nested Moon')
  const deepAsteroid = system.objects.find(object => object.name === 'Deep Asteroid')
  if (!primary || !oldPlanet || !nestedMoon || !deepAsteroid) {
    throw new Error('The imported geometry fixture is missing an expected map object.')
  }
  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  const nestedOrbit = system.orbits.find(orbit => orbit.hostId === oldPlanet.id && orbit.order === 1)
  const deepOrbit = system.orbits.find(orbit => orbit.hostId === nestedMoon.id && orbit.order === 1)
  if (!alphaOrbit || !nestedOrbit || !deepOrbit) {
    throw new Error('The imported geometry fixture is missing an expected hosted Orbit.')
  }
  expect(oldPlanet.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })

  const alphaCenter = objectPosition(primary)
  const alphaRadii = orbitRadii(initial, alphaOrbit.id)
  const alphaRotation = initial.layout.orbitRotations?.[alphaOrbit.id] ?? 0
  const nestedAngle = initial.layout.objectAngles[nestedMoon.id]
  const deepAsteroidAngle = initial.layout.objectAngles[deepAsteroid.id]
  if (nestedAngle === undefined || deepAsteroidAngle === undefined) {
    throw new Error('The imported fixture is missing a dependent object angle.')
  }

  const originalPositions = {
    planet: await objectMapPosition(map, oldPlanet.id),
    nestedMoon: await objectMapPosition(map, nestedMoon.id),
    deepAsteroid: await objectMapPosition(map, deepAsteroid.id),
  }
  await setWorkspaceMapMode(page, 'Move')
  await map.getByRole('button', { name: /^Select .*Old Planet/ }).click()

  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('spinbutton', { name: 'Orbit position (degrees)', exact: true }).fill('45')
  await page.getByRole('button', { name: 'Preview position', exact: true }).click()

  const targetAngle = 45 * Math.PI / 180
  const expectedPlanet = ellipsePoint(alphaCenter, alphaRadii, targetAngle, alphaRotation)
  const expectedNestedMoon = ellipsePoint(
    expectedPlanet,
    orbitRadii(initial, nestedOrbit.id),
    nestedAngle,
    initial.layout.orbitRotations?.[nestedOrbit.id] ?? 0,
  )
  const expectedDeepAsteroid = ellipsePoint(
    expectedNestedMoon,
    orbitRadii(initial, deepOrbit.id),
    deepAsteroidAngle,
    initial.layout.orbitRotations?.[deepOrbit.id] ?? 0,
  )
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanet)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoon)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroid)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), originalPositions.planet)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), originalPositions.nestedMoon)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), originalPositions.deepAsteroid)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await page.getByRole('spinbutton', { name: 'Orbit position (degrees)', exact: true }).fill('45')
  await page.getByRole('button', { name: 'Preview position', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanet)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoon)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroid)
  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const committed = await downloadJson(page, 'Export star system JSON')
  const expectedCommitted = JSON.parse(JSON.stringify(initial)) as ExportedMap
  expectedCommitted.layout.objectAngles[oldPlanet.id] = targetAngle
  expect(committed).toEqual(expectedCommitted)
  const committedPlanet = committed.system?.objects.find(object => object.id === oldPlanet.id)
  expect(committedPlanet?.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })

  await page.reload()
  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const restoredMap = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(restoredMap).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(expectedCommitted)
  expectPointNear(await objectMapPosition(restoredMap, oldPlanet.id), expectedPlanet)
  expectPointNear(await objectMapPosition(restoredMap, nestedMoon.id), expectedNestedMoon)
  expectPointNear(await objectMapPosition(restoredMap, deepAsteroid.id), expectedDeepAsteroid)
})

test('an existing object can preview and confirm a named Orbit or explicit free placement', async ({ page }) => {
  await captureMapExportBlobs(page)
  const transferFixture = JSON.parse(JSON.stringify(creationGeometryFixture)) as ExportedMap
  const fixtureOuterColony = transferFixture.system?.objects.find(object => object.name === 'Outer Colony')
  if (!fixtureOuterColony) throw new Error('The geometry fixture is missing Outer Colony.')
  delete transferFixture.layout.objectAngles[fixtureOuterColony.id]
  const map = await createDenseReach(page, transferFixture)
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')

  const primary = system.objects.find(object => object.name === 'Primary Star')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const oldMoon = system.objects.find(object => object.name === 'Old Moon')
  const nestedMoon = system.objects.find(object => object.name === 'Nested Moon')
  const outerColony = system.objects.find(object => object.name === 'Outer Colony')
  const deepAsteroid = system.objects.find(object => object.name === 'Deep Asteroid')
  if (!primary || !oldPlanet || !oldMoon || !nestedMoon || !outerColony || !deepAsteroid) {
    throw new Error('The imported geometry fixture is missing an expected map object.')
  }

  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  const betaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)
  const nestedOrbit = system.orbits.find(orbit => orbit.hostId === oldPlanet.id && orbit.order === 1)
  const deepOrbit = system.orbits.find(orbit => orbit.hostId === nestedMoon.id && orbit.order === 1)
  if (!alphaOrbit || !betaOrbit || !nestedOrbit || !deepOrbit) {
    throw new Error('The imported geometry fixture is missing an expected hosted Orbit.')
  }
  expect(oldPlanet.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expect(oldMoon.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expect(outerColony.placement).toEqual({ kind: 'orbit', orbitId: betaOrbit.id })

  const nestedAngle = initial.layout.objectAngles[nestedMoon.id]
  const deepAsteroidAngle = initial.layout.objectAngles[deepAsteroid.id]
  if (nestedAngle === undefined || deepAsteroidAngle === undefined) {
    throw new Error('The imported fixture is missing a dependent object angle.')
  }
  expect(initial.layout.objectAngles[oldMoon.id]).toBeUndefined()
  expect(initial.layout.objectAngles[outerColony.id]).toBeUndefined()

  const originalPositions = {
    oldPlanet: await objectMapPosition(map, oldPlanet.id),
    oldMoon: await objectMapPosition(map, oldMoon.id),
    nestedMoon: await objectMapPosition(map, nestedMoon.id),
    outerColony: await objectMapPosition(map, outerColony.id),
    deepAsteroid: await objectMapPosition(map, deepAsteroid.id),
  }
  await setWorkspaceMapMode(page, 'Move')
  await map.getByRole('button', { name: /^Select .*Old Planet/ }).click()

  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await ensureObjectPlacementOpen(page)
  const destination = page.getByRole('combobox', { name: 'Destination', exact: true })
  await destination.click()
  await expect(page.getByRole('option', { name: 'Orbit 1 around Primary Star', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Orbit 2 around Primary Star', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Free placement', exact: true })).toBeVisible()
  for (const label of ['Orbit 1 around Old Planet', 'Orbit 1 around Nested Moon']) {
    const cycleOption = page.getByRole('option', { name: label, exact: true })
    if (await cycleOption.count()) await expect(cycleOption).toBeDisabled()
  }
  await page.getByRole('option', { name: 'Orbit 2 around Primary Star', exact: true }).click()

  const betaAngle = Math.PI / 2
  const betaCenter = objectPosition(primary)
  const expectedPlanetBeta = ellipsePoint(
    betaCenter,
    orbitRadii(initial, betaOrbit.id),
    betaAngle,
    initial.layout.orbitRotations?.[betaOrbit.id] ?? 0,
  )
  const expectedNestedMoonBeta = ellipsePoint(
    expectedPlanetBeta,
    orbitRadii(initial, nestedOrbit.id),
    nestedAngle,
    initial.layout.orbitRotations?.[nestedOrbit.id] ?? 0,
  )
  const expectedDeepAsteroidBeta = ellipsePoint(
    expectedNestedMoonBeta,
    orbitRadii(initial, deepOrbit.id),
    deepAsteroidAngle,
    initial.layout.orbitRotations?.[deepOrbit.id] ?? 0,
  )
  await page.getByRole('spinbutton', { name: 'Orbit position (degrees)', exact: true }).fill('90')
  await page.getByRole('button', { name: 'Preview position', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanetBeta)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoonBeta)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroidBeta)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalPositions.oldMoon)
  expectPointNear(await objectMapPosition(map, outerColony.id), originalPositions.outerColony)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await ensureObjectPlacementOpen(page)
  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  const betaCommitted = await downloadJson(page, 'Export star system JSON')
  const expectedBeta = JSON.parse(JSON.stringify(initial)) as ExportedMap
  const expectedBetaPlanet = expectedBeta.system?.objects.find(object => object.id === oldPlanet.id)
  if (!expectedBetaPlanet) throw new Error('The expected export is missing Old Planet.')
  expectedBetaPlanet.placement = { kind: 'orbit', orbitId: betaOrbit.id }
  expectedBeta.layout.objectAngles[oldPlanet.id] = betaAngle
  expectedBeta.layout.objectAngles[oldMoon.id] = implicitOrbitAngle(system, oldMoon.id, alphaOrbit.id)
  expectedBeta.layout.objectAngles[outerColony.id] = implicitOrbitAngle(system, outerColony.id, betaOrbit.id)
  expect(betaCommitted).toEqual(expectedBeta)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanetBeta)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoonBeta)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroidBeta)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalPositions.oldMoon)
  expectPointNear(await objectMapPosition(map, outerColony.id), originalPositions.outerColony)

  await ensureObjectPlacementOpen(page)
  await selectInspectorOption(destination, 'Free placement')
  const freePoint = { x: 0.8, y: 0.75 }
  const expectedPlanetFree = { x: 64 + freePoint.x * 832, y: 72 + freePoint.y * 416 }
  const expectedNestedMoonFree = ellipsePoint(
    expectedPlanetFree,
    orbitRadii(betaCommitted, nestedOrbit.id),
    nestedAngle,
    betaCommitted.layout.orbitRotations?.[nestedOrbit.id] ?? 0,
  )
  const expectedDeepAsteroidFree = ellipsePoint(
    expectedNestedMoonFree,
    orbitRadii(betaCommitted, deepOrbit.id),
    deepAsteroidAngle,
    betaCommitted.layout.orbitRotations?.[deepOrbit.id] ?? 0,
  )
  await page.getByRole('spinbutton', { name: 'Object position X', exact: true }).fill(String(freePoint.x))
  await page.getByRole('spinbutton', { name: 'Object position Y', exact: true }).fill(String(freePoint.y))
  await page.getByRole('button', { name: 'Preview position', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanetFree)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoonFree)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroidFree)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalPositions.oldMoon)
  expectPointNear(await objectMapPosition(map, outerColony.id), originalPositions.outerColony)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(betaCommitted)

  await ensureObjectPlacementOpen(page)
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanetBeta)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoonBeta)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroidBeta)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(betaCommitted)

  await ensureObjectPlacementOpen(page)
  await selectInspectorOption(destination, 'Free placement')
  await page.getByRole('spinbutton', { name: 'Object position X', exact: true }).fill(String(freePoint.x))
  await page.getByRole('spinbutton', { name: 'Object position Y', exact: true }).fill(String(freePoint.y))
  await page.getByRole('button', { name: 'Preview position', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedPlanetFree)
  expectPointNear(await objectMapPosition(map, nestedMoon.id), expectedNestedMoonFree)
  expectPointNear(await objectMapPosition(map, deepAsteroid.id), expectedDeepAsteroidFree)
  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const expectedFree = JSON.parse(JSON.stringify(betaCommitted)) as ExportedMap
  const expectedFreePlanet = expectedFree.system?.objects.find(object => object.id === oldPlanet.id)
  if (!expectedFreePlanet) throw new Error('The expected free-placement export is missing Old Planet.')
  expectedFreePlanet.placement = { kind: 'system', x: freePoint.x, y: freePoint.y }
  delete expectedFree.layout.objectAngles[oldPlanet.id]
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(expectedFree)

  await page.reload()
  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const restoredMap = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(restoredMap).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(expectedFree)
  expectPointNear(await objectMapPosition(restoredMap, oldPlanet.id), expectedPlanetFree)
  expectPointNear(await objectMapPosition(restoredMap, nestedMoon.id), expectedNestedMoonFree)
  expectPointNear(await objectMapPosition(restoredMap, deepAsteroid.id), expectedDeepAsteroidFree)
  expectPointNear(await objectMapPosition(restoredMap, oldMoon.id), originalPositions.oldMoon)
  expectPointNear(await objectMapPosition(restoredMap, outerColony.id), originalPositions.outerColony)
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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const committed = await downloadJson(page, 'Export star system JSON')
  expect(committed.system?.objects.find(object => object.id === oldPlanet.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: betaOrbit.id })
})

test('moving one implicit Orbit occupant preserves its source sibling position', async ({ page }) => {
  await captureMapExportBlobs(page)
  const map = await createDenseReach(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')

  const primary = system.objects.find(object => object.name === 'Primary Star')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const oldMoon = system.objects.find(object => object.name === 'Old Moon')
  if (!primary || !oldPlanet || !oldMoon) throw new Error('The imported fixture is missing a map object.')
  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  const betaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)
  if (!alphaOrbit || !betaOrbit) throw new Error('The imported fixture is missing its root Orbits.')
  expect(oldPlanet.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expect(oldMoon.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })

  const oldMoonAngle = initial.layout.objectAngles[oldMoon.id]
    ?? implicitOrbitAngle(system, oldMoon.id, alphaOrbit.id)
  expect(initial.layout.objectAngles[oldMoon.id]).toBeUndefined()
  const originalOldMoonPosition = await objectMapPosition(map, oldMoon.id)
  const alphaRotation = initial.layout.orbitRotations?.[alphaOrbit.id] ?? 0
  const expectedOldMoonPosition = ellipsePoint(
    objectPosition(primary),
    orbitRadii(initial, alphaOrbit.id),
    oldMoonAngle,
    alphaRotation,
  )
  expectPointNear(originalOldMoonPosition, expectedOldMoonPosition)

  const betaRotation = initial.layout.orbitRotations?.[betaOrbit.id] ?? 0
  const destination = ellipsePoint(
    objectPosition(primary),
    orbitRadii(initial, betaOrbit.id),
    0,
    betaRotation,
  )
  const hitTarget = objectMark(map, oldPlanet.id).locator('.object-hit-target')
  await setWorkspaceMapMode(page, 'Move')
  await ensureMapDragPointsReachable(page, map, hitTarget, destination)
  await beginDragToWorldPoint(page, map, hitTarget, destination)
  await page.mouse.up()

  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  if (!committedSystem) throw new Error('The moved Dense Reach workspace did not export a star system.')
  expect(committedSystem.objects.find(object => object.id === oldPlanet.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: betaOrbit.id })
  expect(committed.layout.objectAngles[oldPlanet.id]).toBeCloseTo(0)
  expect(committed.layout.objectAngles[oldMoon.id]).toBeCloseTo(oldMoonAngle)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), destination)
  expectPointNear(await objectMapPosition(map, oldMoon.id), originalOldMoonPosition)
})

test('short landscape precise placement safely rejects derived overflow and persists valid input', async ({ page }) => {
  await captureMapExportBlobs(page)
  const map = await createDenseReach(page)
  await page.screenshot({ path: test.info().outputPath('workspace-desktop-light.png') })
  const darkTheme = page.getByRole('button', { name: 'Switch to dark mode', exact: true })
  if (await darkTheme.isVisible()) await darkTheme.click()
  await page.setViewportSize({ width: 844, height: 390 })
  const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeHierarchy.isVisible()) await closeHierarchy.click()
  await expect(page.getByRole('button', { name: 'Map files', exact: true })).toBeVisible()
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const oldMoon = system.objects.find(object => object.name === 'Old Moon')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  if (!oldPlanet || !oldMoon || !primary) throw new Error('The imported fixture is missing a map object.')
  const alphaOrbit = system.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)
  if (!alphaOrbit) throw new Error('The imported fixture is missing Alpha Orbit.')

  await setWorkspaceMapMode(page, 'Move')
  await map.getByRole('button', { name: /^Select .*Old Planet/ }).click()
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'true')
  const form = page.getByRole('form', { name: 'Object placement', exact: true })
  const formBounds = await form.boundingBox()
  if (!formBounds) throw new Error('The Object placement form has no visible bounds in short landscape.')
  expect(formBounds.x).toBeGreaterThanOrEqual(0)
  expect(formBounds.y).toBeGreaterThanOrEqual(0)
  expect(formBounds.x + formBounds.width).toBeLessThanOrEqual(844)
  expect(formBounds.y + formBounds.height).toBeLessThanOrEqual(390)
  await page.screenshot({ path: test.info().outputPath('placement-landscape-dark.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(form).toBeVisible()
  const portraitBounds = await form.boundingBox()
  if (!portraitBounds) throw new Error('The Object placement form has no visible portrait bounds.')
  expect(portraitBounds.x).toBeGreaterThanOrEqual(0)
  expect(portraitBounds.x + portraitBounds.width).toBeLessThanOrEqual(390)
  expect(portraitBounds.y + portraitBounds.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: test.info().outputPath('placement-portrait-dark.png') })
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(form).toBeVisible()

  const originalPosition = await objectMapPosition(map, oldPlanet.id)
  const orbitPosition = form.getByRole('spinbutton', { name: 'Orbit position (degrees)', exact: true })
  await expect(orbitPosition).toBeVisible()
  await orbitPosition.focus()
  await expect(orbitPosition).toBeFocused()
  const hugeDegrees = 1e308
  await orbitPosition.fill(String(hugeDegrees))
  await form.getByRole('button', { name: 'Preview position', exact: true }).click()
  const normalizedRadians = (hugeDegrees % 360) * Math.PI / 180
  const expectedOrbitPosition = ellipsePoint(
    objectPosition(primary),
    orbitRadii(initial, alphaOrbit.id),
    normalizedRadians,
    initial.layout.orbitRotations?.[alphaOrbit.id] ?? 0,
  )
  await expect(form.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedOrbitPosition)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await ensureObjectPlacementOpen(page)
  await form.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), originalPosition)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await ensureObjectPlacementOpen(page)
  const destination = form.getByRole('combobox', { name: 'Destination', exact: true })
  await selectInspectorOption(destination, 'Free placement')
  const positionX = form.getByRole('spinbutton', { name: 'Object position X', exact: true })
  const positionY = form.getByRole('spinbutton', { name: 'Object position Y', exact: true })
  await positionX.fill('1e308')
  await positionY.fill('0.75')
  await form.getByRole('button', { name: 'Preview position', exact: true }).click()
  await expect(form.getByText('Enter finite X and Y coordinates for free placement.', { exact: true }).first())
    .toBeVisible()
  await expect(form.getByRole('button', { name: 'Confirm position', exact: true })).toHaveCount(0)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), originalPosition)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await ensureObjectPlacementOpen(page)
  const freePoint = { x: 0.8, y: 0.75 }
  await positionX.fill(String(freePoint.x))
  await positionY.fill(String(freePoint.y))
  await form.getByRole('button', { name: 'Preview position', exact: true }).click()
  const expectedFreePosition = { x: 64 + freePoint.x * 832, y: 72 + freePoint.y * 416 }
  await expect(form.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), expectedFreePosition)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await ensureObjectPlacementOpen(page)
  await form.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const expectedCommitted = JSON.parse(JSON.stringify(initial)) as ExportedMap
  const expectedPlanet = expectedCommitted.system?.objects.find(object => object.id === oldPlanet.id)
  if (!expectedPlanet) throw new Error('The expected export is missing Old Planet.')
  expectedPlanet.placement = { kind: 'system', x: freePoint.x, y: freePoint.y }
  delete expectedCommitted.layout.objectAngles[oldPlanet.id]
  expectedCommitted.layout.objectAngles[oldMoon.id] = initial.layout.objectAngles[oldMoon.id]
    ?? implicitOrbitAngle(system, oldMoon.id, alphaOrbit.id)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(expectedCommitted)

  await page.reload()
  await returnToClusterMap(page)
  const openRestoredSystem = page.getByRole('button', { name: 'Open Dense Reach system map', exact: true })
  if (!(await openRestoredSystem.isVisible())) await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await openRestoredSystem.click()
  const restoredMap = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(restoredMap).toBeVisible()
  const restoredCloseHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await restoredCloseHierarchy.isVisible()) await restoredCloseHierarchy.click()
  await expect(page.getByRole('button', { name: 'Map files', exact: true })).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(expectedCommitted)
  expectPointNear(await objectMapPosition(restoredMap, oldPlanet.id), expectedFreePosition)
})

test('dropping an object into its own hosted Orbit is refused instead of becoming Free', async ({ page }) => {
  await captureMapExportBlobs(page)
  const map = await createDenseReach(page)
  const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeHierarchy.isVisible()) await closeHierarchy.click()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported Dense Reach workspace did not export a star system.')
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  if (!oldPlanet) throw new Error('The imported geometry fixture is missing Old Planet.')
  const nestedOrbit = system.orbits.find(orbit => orbit.hostId === oldPlanet.id && orbit.order === 1)
  if (!nestedOrbit) throw new Error('The imported geometry fixture is missing Old Planet\'s hosted Orbit.')
  expect(oldPlanet.placement.kind).toBe('orbit')

  const sourcePoint = await objectMapPosition(map, oldPlanet.id)
  const nestedRadii = orbitRadii(initial, nestedOrbit.id)
  const nestedRotation = initial.layout.orbitRotations?.[nestedOrbit.id] ?? 0
  expect(nestedRadii).toEqual({ horizontal: 80, vertical: 55 })
  expect(nestedRotation).toBe(25)
  const invalidTarget = ellipsePoint(sourcePoint, nestedRadii, 0, nestedRotation)
  const hitTarget = objectMark(map, oldPlanet.id).locator('.object-hit-target')

  await setWorkspaceMapMode(page, 'Move')
  await ensureMapDragPointsReachable(page, map, hitTarget, invalidTarget)
  await beginDragToWorldPoint(page, map, hitTarget, invalidTarget)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), sourcePoint)
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)
  await expect(objectMark(map, oldPlanet.id)).toHaveClass(/is-dragging/)

  await page.mouse.up()
  expectPointNear(await objectMapPosition(map, oldPlanet.id), sourcePoint)
  await ensureObjectPlacementOpen(page)
  const chooser = page.getByRole('group', { name: 'Choose destination Orbit', exact: true })
  await expect(chooser).toBeVisible()
  await expect(chooser.getByRole('button')).toHaveCount(1)
  const ownOrbit = chooser.getByRole('button', { name: 'Orbit 1 around Old Planet', exact: true })
  await expect(ownOrbit).toBeDisabled()
  await expect(chooser.getByRole('note')).toHaveText(
    'This Orbit is hosted by the object or one of its descendants.',
  )
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toHaveCount(0)

  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  expectPointNear(await objectMapPosition(map, oldPlanet.id), sourcePoint)
})
