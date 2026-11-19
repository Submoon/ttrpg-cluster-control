import { expect, test, type Locator, type Page } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { resolveImportReview, reviewStarSystemImport } from './helpers'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  downloadJson,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  readInspectorSelection,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  wardenLocalCoordinates,
  wardenMap,
  type ExportedMap,
  type WorldPoint,
} from './helpers'

const movingOrbitId = 'ticket-25-unoccupied-orbit'
const passengerId = 'ticket-25-transfer-moon'
const nestedOrbitId = 'ticket-25-moon-orbit'
const nestedObjectId = 'ticket-25-nested-traveler'
const overlappingHostId = 'ticket-25-overlapping-host'

function orbitPlacementFixture(): ExportedMap {
  const fixture = structuredClone(creationGeometryFixture) as ExportedMap
  const system = fixture.system
  if (!system) throw new Error('The creation-geometry fixture has no star system.')

  system.orbits.push(
    { id: movingOrbitId, hostId: null, center: { x: 0.85, y: 0.2 }, order: 1 },
    { id: nestedOrbitId, hostId: passengerId, order: 1 },
  )
  system.objects.push(
    {
      id: passengerId,
      family: 'CelestialBody',
      subtype: 'moon',
      locationKey: 'MO.3',
      name: 'Transfer Moon',
      description: '',
      placement: { kind: 'orbit', orbitId: movingOrbitId },
    },
    {
      id: nestedObjectId,
      family: 'CelestialBody',
      subtype: 'moon',
      locationKey: 'MO.4',
      name: 'Nested Traveler',
      description: '',
      placement: { kind: 'orbit', orbitId: nestedOrbitId },
    },
  )
  fixture.layout.orbitRadii[movingOrbitId] = { horizontal: 16, vertical: 60 }
  fixture.layout.orbitRadii[nestedOrbitId] = { horizontal: 46, vertical: 46 }
  fixture.layout.objectAngles[passengerId] = 0
  fixture.layout.objectAngles[nestedObjectId] = 0
  return fixture
}

function ambiguousOrbitPlacementFixture(): ExportedMap {
  const fixture = orbitPlacementFixture()
  const system = fixture.system
  if (!system) throw new Error('The creation-geometry fixture has no star system.')

  fixture.layout.objectAngles[passengerId] = Math.PI / 2
  system.objects.push({
    id: overlappingHostId,
    family: 'CelestialBody',
    subtype: 'star',
    locationKey: 'B',
    name: 'Companion Star',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  })
  return fixture
}

async function openPlacementLab(
  page: Page,
  fixture: ExportedMap = orbitPlacementFixture(),
): Promise<{ hierarchy: Locator; map: Locator; systemId: string }> {
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })

  const preview = await reviewStarSystemImport(page, 'orbit-placement-lab.json', JSON.stringify(fixture))
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Inspect Dense Reach', exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const systemId = initial.system?.id
  if (!systemId || initial.system?.name !== 'Dense Reach') {
    throw new Error('The imported placement system was not selected on the Warden map.')
  }
  return {
    hierarchy,
    map: wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`),
    systemId,
  }
}

async function objectPosition(map: Locator, id: string): Promise<WorldPoint> {
  const transform = await map.locator(`.continuous-warden-object[data-object-id="${id}"]`).getAttribute('transform')
  const match = transform?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
  if (!match) throw new Error(`Could not read the rendered position for ${id}.`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

async function expectObjectPosition(map: Locator, id: string, expected: WorldPoint): Promise<void> {
  await expect.poll(() => objectPosition(map, id)).toEqual(expected)
}

/** Starts a native drag in the explicit owner's local coordinates and leaves release to the scenario. */
async function beginCenterDrag(page: Page, systemId: string, source: Locator, target: WorldPoint): Promise<void> {
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const end = coordinates.toClient(target)
  const start = await source.evaluate((element) => {
    if (!(element instanceof SVGCircleElement)) throw new Error('The Orbit center handle is not a circle.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The Orbit center handle is not attached to the Warden map.')
    // A nearby passenger can cover the center at system-wide detail; use a real exposed handle hit.
    for (const fraction of [0, .5, .85]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8
        const point = new DOMPoint(
          element.cx.baseVal.value + Math.cos(angle) * element.r.baseVal.value * fraction,
          element.cy.baseVal.value + Math.sin(angle) * element.r.baseVal.value * fraction,
        ).matrixTransform(matrix)
        const delivered = { x: Math.round(point.x), y: Math.round(point.y) }
        if (document.elementFromPoint(delivered.x, delivered.y) === element) return delivered
      }
    }
    throw new Error('The Orbit center handle has no exposed native pointer hit.')
  })
  expect(await wardenMap(page).evaluate((element, point) =>
    element.contains(document.elementFromPoint(point.x, point.y)), end)).toBe(true)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 6 })
}

test('an ambiguous Orbit center drag requires a named host choice before preview and Apply', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { hierarchy, map, systemId } = await openPlacementLab(page, ambiguousOrbitPlacementFixture())
  await expect(map).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported fixture did not export a star system.')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  const overlappingHost = system.objects.find(object => object.name === 'Companion Star')
  const orbit = system.orbits.find(candidate => candidate.hostId === null)
  const passenger = system.objects.find(object => object.name === 'Transfer Moon')
  const nestedObject = system.objects.find(object => object.name === 'Nested Traveler')
  const primaryOrbits = system.orbits
    .filter(candidate => candidate.hostId === primary?.id)
    .sort((left, right) => left.order - right.order)
  const [firstPrimaryOrbit, secondPrimaryOrbit] = primaryOrbits
  if (!primary || !overlappingHost || !orbit || !passenger || !nestedObject) {
    throw new Error('The imported fixture is missing its expected hosts, Orbit, or dependent objects.')
  }
  if (!firstPrimaryOrbit || !secondPrimaryOrbit
    || firstPrimaryOrbit.order !== 1 || secondPrimaryOrbit.order !== 2) {
    throw new Error('The imported fixture needs two ordered Orbits around the Primary Star.')
  }

  const primaryPosition = await objectPosition(map, primary.id)
  expect(await objectPosition(map, overlappingHost.id)).toEqual(primaryPosition)
  const ring = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbit.id}"]`)
  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hideWorkspaceInspector(page)
  const centerHandle = map.locator(`.continuous-warden-orbit-center-handle[data-orbit-id="${orbit.id}"]`)
  await expect(centerHandle).toBeVisible()
  const originalCenterX = await ring.getAttribute('cx')
  const originalCenterY = await ring.getAttribute('cy')
  const passengerPosition = await objectPosition(map, passenger.id)
  const nestedPosition = await objectPosition(map, nestedObject.id)
  await beginCenterDrag(page, systemId, centerHandle, primaryPosition)
  await expect(ring).toHaveAttribute('cx', originalCenterX!)
  await expect(ring).toHaveAttribute('cy', originalCenterY!)
  await expectObjectPosition(map, passenger.id, passengerPosition)
  await expectObjectPosition(map, nestedObject.id, nestedPosition)
  await page.mouse.up()
  await expect(ring).toHaveAttribute('cx', originalCenterX!)
  await expect(ring).toHaveAttribute('cy', originalCenterY!)

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const host = inspector.getByLabel('Host', { exact: true })
  await expect(host).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await expect(inspector.getByRole('button', { name: /Apply changes/ })).toBeDisabled()

  const previewButton = inspector.getByRole('button', { name: 'Preview placement', exact: true })
  if (await previewButton.count()) await expect(previewButton).toBeDisabled()
  await host.click()
  await expect(page.getByRole('option', { name: 'A, Primary Star (Star)', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'B, Companion Star (Star)', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Unoccupied center', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'A, Primary Star (Star)', exact: true }).click()
  expect(await readInspectorSelection(host)).toBe('A, Primary Star (Star)')

  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBe(primaryPosition.x)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBe(primaryPosition.y)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBe(39)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).toBe(60)
  await expectObjectPosition(map, passenger.id, { x: primaryPosition.x, y: primaryPosition.y + 60 })
  await expectObjectPosition(map, nestedObject.id, { x: primaryPosition.x + 46, y: primaryPosition.y + 60 })
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await previewButton.click()
  await inspector.getByRole('button', { name: /Apply changes/ }).click()

  const applied = await downloadJson(page, 'Export star system JSON')
  const appliedSystem = applied.system
  if (!appliedSystem) throw new Error('Applying the host choice removed the exported star system.')
  const attachedOrbit = appliedSystem.orbits.find(candidate => candidate.id === orbit.id)
  if (!attachedOrbit) throw new Error('Applying the host choice removed the selected Orbit.')
  expect(attachedOrbit).toMatchObject({ hostId: primary.id, order: 3 })
  const appliedFirstPrimaryOrbit = appliedSystem.orbits.find(candidate => candidate.id === firstPrimaryOrbit.id)
  const appliedSecondPrimaryOrbit = appliedSystem.orbits.find(candidate => candidate.id === secondPrimaryOrbit.id)
  if (!appliedFirstPrimaryOrbit || !appliedSecondPrimaryOrbit) {
    throw new Error('Applying the host choice removed an existing Primary Star Orbit.')
  }
  expect(appliedFirstPrimaryOrbit.order).toBe(1)
  expect(appliedSecondPrimaryOrbit.order).toBe(2)
  expect(applied.layout.orbitRadii[orbit.id]).toEqual({ horizontal: 39, vertical: 60 })
  await waitForWorkspaceSaved(page)
})

function legacyImplicitOrbitRadiiFixture(): ExportedMap {
  const fixture = orbitPlacementFixture()
  const system = fixture.system
  if (!system) throw new Error('The creation-geometry fixture has no star system.')

  fixture.layout.objectAngles[passengerId] = Math.PI / 2
  delete fixture.layout.orbitRadii[movingOrbitId]
  const siblingOrbitId = 'ticket-25-implicit-free-sibling'
  const neighborId = 'ticket-25-implicit-free-neighbor'
  system.orbits.push({
    id: siblingOrbitId,
    hostId: null,
    center: { x: 2.8, y: 2.6 },
    order: 2,
  })
  system.objects.push({
    id: neighborId,
    family: 'CelestialBody',
    subtype: 'moon',
    locationKey: 'MO.5',
    name: 'Implicit Radius Neighbor',
    description: '',
    placement: { kind: 'orbit', orbitId: siblingOrbitId },
  })
  fixture.layout.objectAngles[neighborId] = Math.PI / 2
  return fixture
}


test('attaching an implicit-radius free Orbit preserves both free Orbit geometries while reindexing a sibling', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { hierarchy, map, systemId } = await openPlacementLab(page, legacyImplicitOrbitRadiiFixture())
  await expect(map).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported fixture did not export a star system.')
  const orbit = system.orbits.find(candidate => candidate.hostId === null && candidate.order === 1)
  const sibling = system.orbits.find(candidate => candidate.hostId === null && candidate.order === 2)
  const oldPlanet = system.objects.find(object => object.name === 'Old Planet')
  const passenger = system.objects.find(object => object.name === 'Transfer Moon')
  const nestedObject = system.objects.find(object => object.name === 'Nested Traveler')
  const neighbor = system.objects.find(object => object.name === 'Implicit Radius Neighbor')
  if (!orbit || !sibling || !oldPlanet || !passenger || !nestedObject || !neighbor) {
    throw new Error('The imported fixture is missing an Orbit, host, or dependent object.')
  }
  if (initial.layout.orbitRadii[orbit.id] !== undefined || initial.layout.orbitRadii[sibling.id] !== undefined) {
    throw new Error('The legacy fixture must begin with implicit radii on both free Orbits.')
  }
  const hostOrbits = system.orbits.filter(candidate => candidate.hostId === oldPlanet.id)
  if (!hostOrbits.some(candidate => candidate.order === 1)) {
    throw new Error('Old Planet must already host Orbit 1 for append-order coverage.')
  }

  const sourceRing = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbit.id}"]`)
  const siblingRing = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${sibling.id}"]`)
  const sourceRadii = {
    horizontal: Number(await sourceRing.getAttribute('rx')),
    vertical: Number(await sourceRing.getAttribute('ry')),
  }
  const siblingRadii = {
    horizontal: Number(await siblingRing.getAttribute('rx')),
    vertical: Number(await siblingRing.getAttribute('ry')),
  }
  const hostPosition = await objectPosition(map, oldPlanet.id)
  const neighborPosition = await objectPosition(map, neighbor.id)

  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hideWorkspaceInspector(page)
  const centerHandle = map.locator(`.continuous-warden-orbit-center-handle[data-orbit-id="${orbit.id}"]`)
  await expect(centerHandle).toBeVisible()
  await beginCenterDrag(page, systemId, centerHandle, hostPosition)
  await expect.poll(async () => Number(await sourceRing.getAttribute('cx'))).toBeCloseTo(hostPosition.x, 4)
  await expect.poll(async () => Number(await sourceRing.getAttribute('cy'))).toBeCloseTo(hostPosition.y, 4)
  await expect.poll(async () => Number(await sourceRing.getAttribute('rx'))).toBe(sourceRadii.horizontal)
  await expect.poll(async () => Number(await sourceRing.getAttribute('ry'))).toBe(sourceRadii.vertical)
  await expectObjectPosition(map, passenger.id, { x: hostPosition.x, y: hostPosition.y + sourceRadii.vertical })
  await expectObjectPosition(map, nestedObject.id, { x: hostPosition.x + 46, y: hostPosition.y + sourceRadii.vertical })
  await expectObjectPosition(map, neighbor.id, neighborPosition)
  expect(await downloadJson(page, 'Export star system JSON', 'keyboard')).toEqual(initial)

  await page.mouse.up()
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  if (!committedSystem) throw new Error('The attachment removed the exported star system.')
  const committedOrbit = committedSystem.orbits.find(candidate => candidate.id === orbit.id)
  const committedSibling = committedSystem.orbits.find(candidate => candidate.id === sibling.id)
  if (!committedOrbit || !committedSibling) throw new Error('The attachment removed a free Orbit.')
  expect(committedOrbit).toMatchObject({ hostId: oldPlanet.id, order: 2 })
  expect(committedOrbit.center).toBeUndefined()
  expect(committedSibling).toMatchObject({ hostId: null, order: 1 })
  expect(committed.layout.orbitRadii[orbit.id]).toEqual(sourceRadii)
  expect(committed.layout.orbitRadii[sibling.id]).toEqual(siblingRadii)
  await expectObjectPosition(map, neighbor.id, neighborPosition)

  const expected = structuredClone(initial)
  const expectedSystem = expected.system
  if (!expectedSystem) throw new Error('The initial JSON lost its star system copy.')
  const expectedOrbit = expectedSystem.orbits.find(candidate => candidate.id === orbit.id)
  const expectedSibling = expectedSystem.orbits.find(candidate => candidate.id === sibling.id)
  if (!expectedOrbit || !expectedSibling) throw new Error('The initial JSON lost an Orbit copy.')
  expectedOrbit.hostId = oldPlanet.id
  expectedOrbit.order = 2
  delete expectedOrbit.center
  expectedSibling.order = 1
  expected.layout.orbitRadii[orbit.id] = sourceRadii
  expected.layout.orbitRadii[sibling.id] = siblingRadii
  expect(committed).toEqual(expected)

  await waitForWorkspaceSaved(page)
  await page.reload()
  const clusterHierarchy = await openWorkspaceHierarchy(page)
  await clusterHierarchy.getByRole('button', { name: 'Inspect Dense Reach', exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const restoredMap = wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
  const restoredSourceRing = restoredMap.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbit.id}"]`)
  const restoredSiblingRing = restoredMap.locator(`.continuous-warden-orbit-target[data-orbit-id="${sibling.id}"]`)
  await expect(restoredSourceRing).toHaveAttribute('rx', String(sourceRadii.horizontal))
  await expect(restoredSourceRing).toHaveAttribute('ry', String(sourceRadii.vertical))
  await expect(restoredSiblingRing).toHaveAttribute('rx', String(siblingRadii.horizontal))
  await expect(restoredSiblingRing).toHaveAttribute('ry', String(siblingRadii.vertical))
  await expectObjectPosition(restoredMap, neighbor.id, neighborPosition)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(committed)
})
