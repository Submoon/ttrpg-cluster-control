import { expect, test, type Locator, type Page } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { importReviewDialog, resolveImportReview } from './helpers'
import {
  beginDragToWorldPoint,
  captureMapExportBlobs,
  downloadJson,
  ensureMapDragPointsReachable,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  readInspectorSelection,
  returnToClusterMap,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  type DownloadWindow,
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
): Promise<{ hierarchy: Locator; map: Locator }> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  await setJsonFile(jsonMapImportInput(page), 'orbit-placement-lab.json', JSON.stringify(fixture))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  return {
    hierarchy,
    map: page.getByRole('group', { name: 'Dense Reach star system map', exact: true }),
  }
}

/** Exports through the visible file controls by keyboard without moving the held map pointer. */
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

async function objectPosition(map: Locator, id: string): Promise<WorldPoint> {
  const transform = await map.locator(`.system-object[data-object-id="${id}"]`).getAttribute('transform')
  const match = transform?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
  if (!match) throw new Error(`Could not read the rendered position for ${id}.`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

async function expectObjectPosition(map: Locator, id: string, expected: WorldPoint): Promise<void> {
  await expect.poll(() => objectPosition(map, id)).toEqual(expected)
}

async function expectUnavailableHost(control: Locator, name: string): Promise<void> {
  const isNativeSelect = await control.evaluate(element => element instanceof HTMLSelectElement)
  if (isNativeSelect) {
    const options = await control.locator('option').evaluateAll(elements =>
      elements.map(element => ({ label: element.textContent?.trim() ?? '', disabled: (element as HTMLOptionElement).disabled })),
    )
    expect(options.some(option => option.label.includes(name) && !option.disabled)).toBe(false)
    return
  }

  await control.click()
  const option = control.page().getByRole('option', { name })
  if (await option.count()) await expect(option).toBeDisabled()
  await control.page().keyboard.press('Escape')
}

test('an unoccupied Orbit previews attachment safely and applies with the new host minimum', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { hierarchy, map } = await openPlacementLab(page)
  await expect(map).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported fixture did not export a star system.')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  const orbit = system.orbits.find(candidate => candidate.hostId === null)
  const passenger = system.objects.find(object => object.name === 'Transfer Moon')
  const nestedObject = system.objects.find(object => object.name === 'Nested Traveler')
  const primaryOrbits = system.orbits
    .filter(candidate => candidate.hostId === primary?.id)
    .sort((left, right) => left.order - right.order)
  const [firstPrimaryOrbit, secondPrimaryOrbit] = primaryOrbits
  if (!primary || !orbit || !passenger || !nestedObject) {
    throw new Error('The imported fixture is missing its expected star, unoccupied Orbit, or dependent objects.')
  }
  if (!firstPrimaryOrbit || !secondPrimaryOrbit
    || firstPrimaryOrbit.order !== 1 || secondPrimaryOrbit.order !== 2) {
    throw new Error('The imported fixture needs two ordered Orbits around the Primary Star.')
  }
  const primaryPosition = await objectPosition(map, primary.id)
  const originalPassengerPosition = await objectPosition(map, passenger.id)
  const originalNestedPosition = await objectPosition(map, nestedObject.id)
  const ring = map.locator(`.orbit-mark[data-orbit-id="${orbit.id}"] .orbit-ring`)
  const originalCenter = {
    x: Number(await ring.getAttribute('cx')),
    y: Number(await ring.getAttribute('cy')),
  }

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around Primary Star, 2 objects', exact: true }).click()
  await expect(inspector.getByRole('button', { name: 'Detach Orbit', exact: true })).toBeVisible()
  await expect(inspector.getByLabel('Host', { exact: true })).toHaveCount(0)

  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  const host = inspector.getByLabel('Host', { exact: true })
  await expect(host).toBeVisible()
  expect(await readInspectorSelection(host)).toBe('Unoccupied center')
  await selectInspectorOption(host, 'A, Primary Star (Star)')
  expect(await readInspectorSelection(host)).toBe('A, Primary Star (Star)')
  await expectUnavailableHost(host, 'Transfer Moon')
  await expectUnavailableHost(host, 'Nested Traveler')

  const primaryNode = map.locator(`.system-object[data-object-id="${primary.id}"]`)
  const hostPositionBeforeMove = await objectPosition(map, primary.id)
  await ensureMapDragPointsReachable(page, map, primaryNode, {
    x: hostPositionBeforeMove.x + 96,
    y: hostPositionBeforeMove.y + 72,
  })
  await beginDragToWorldPoint(page, map, primaryNode, {
    x: hostPositionBeforeMove.x + 96,
    y: hostPositionBeforeMove.y + 72,
  })
  await page.mouse.up()
  await expectObjectPosition(map, primary.id, hostPositionBeforeMove)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await expect(inspector.getByRole('alert'))
    .toContainText('Resolve the Inspector draft before moving this object or changing a related placement.')

  await inspector.getByRole('button', { name: 'Preview placement', exact: true }).click()
  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBe(primaryPosition.x)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBe(primaryPosition.y)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBe(39)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).toBe(60)
  await expectObjectPosition(map, passenger.id, { x: primaryPosition.x + 39, y: primaryPosition.y })
  await expectObjectPosition(map, nestedObject.id, { x: primaryPosition.x + 39 + 46, y: primaryPosition.y })
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await inspector.getByRole('button', { name: /^Discard changes\b/ }).click()
  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBeCloseTo(originalCenter.x, 5)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBeCloseTo(originalCenter.y, 5)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBe(16)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).toBe(60)
  await expectObjectPosition(map, passenger.id, originalPassengerPosition)
  await expectObjectPosition(map, nestedObject.id, originalNestedPosition)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)

  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await selectInspectorOption(inspector.getByLabel('Host', { exact: true }), 'A, Primary Star (Star)')
  await inspector.getByRole('button', { name: 'Preview placement', exact: true }).click()
  await inspector.getByRole('button', { name: /Apply changes/ }).click()

  await expect(inspector.getByRole('button', { name: /Apply changes/ })).toHaveCount(0)

  const applied = await downloadJson(page, 'Export star system JSON')
  const appliedSystem = applied.system
  if (!appliedSystem) throw new Error('Applying the placement removed the exported star system.')
  const attachedOrbit = appliedSystem.orbits.find(candidate => candidate.id === orbit.id)
  if (!attachedOrbit) throw new Error('Applying the placement removed the selected Orbit.')
  expect(attachedOrbit).toMatchObject({ hostId: primary.id, order: 3 })
  const appliedFirstPrimaryOrbit = appliedSystem.orbits.find(candidate => candidate.id === firstPrimaryOrbit.id)
  const appliedSecondPrimaryOrbit = appliedSystem.orbits.find(candidate => candidate.id === secondPrimaryOrbit.id)
  if (!appliedFirstPrimaryOrbit || !appliedSecondPrimaryOrbit) {
    throw new Error('Applying the placement removed an existing Primary Star Orbit.')
  }
  expect(appliedFirstPrimaryOrbit.order).toBe(1)
  expect(appliedSecondPrimaryOrbit.order).toBe(2)
  expect(applied.layout.orbitRadii[orbit.id]).toEqual({ horizontal: 39, vertical: 60 })
  await expect(inspector.getByRole('button', { name: 'Detach Orbit', exact: true })).toBeVisible()
})

test('dragging an unoccupied Orbit center onto a host previews and commits attachment', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = orbitPlacementFixture()
  fixture.layout.objectAngles[passengerId] = Math.PI / 2
  const { hierarchy, map } = await openPlacementLab(page, fixture)
  await expect(map).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported fixture did not export a star system.')
  const primary = system.objects.find(object => object.name === 'Primary Star')
  const orbit = system.orbits.find(candidate => candidate.hostId === null)
  const passenger = system.objects.find(object => object.name === 'Transfer Moon')
  const nestedObject = system.objects.find(object => object.name === 'Nested Traveler')
  const primaryOrbits = system.orbits
    .filter(candidate => candidate.hostId === primary?.id)
    .sort((left, right) => left.order - right.order)
  const [firstPrimaryOrbit, secondPrimaryOrbit] = primaryOrbits
  if (!primary || !orbit || !passenger || !nestedObject) {
    throw new Error('The imported fixture is missing its expected star, Orbit, or dependent objects.')
  }
  if (!firstPrimaryOrbit || !secondPrimaryOrbit
    || firstPrimaryOrbit.order !== 1 || secondPrimaryOrbit.order !== 2) {
    throw new Error('The imported fixture needs two ordered Orbits around the Primary Star.')
  }

  const primaryPosition = await objectPosition(map, primary.id)
  const ring = map.locator(`.orbit-mark[data-orbit-id="${orbit.id}"] .orbit-ring`)
  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  const centerHandle = map.locator(`.orbit-mark[data-orbit-id="${orbit.id}"] .orbit-center-handle`)
  await expect(centerHandle).toBeVisible()
  await ensureMapDragPointsReachable(page, map, centerHandle, primaryPosition)
  await beginDragToWorldPoint(page, map, centerHandle, primaryPosition)
  await expect(centerHandle).toHaveClass(/is-moving/)

  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBe(primaryPosition.x)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBe(primaryPosition.y)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBe(39)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).toBe(60)
  await expectObjectPosition(map, passenger.id, { x: primaryPosition.x, y: primaryPosition.y + 60 })
  await expectObjectPosition(map, nestedObject.id, { x: primaryPosition.x + 46, y: primaryPosition.y + 60 })
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)
  await expect(centerHandle).toHaveClass(/is-moving/)

  await page.mouse.up()
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  if (!committedSystem) throw new Error('The committed placement removed the exported star system.')
  const attachedOrbit = committedSystem.orbits.find(candidate => candidate.id === orbit.id)
  if (!attachedOrbit) throw new Error('The committed placement removed the selected Orbit.')
  expect(attachedOrbit).toMatchObject({ hostId: primary.id, order: 3 })
  const committedFirstPrimaryOrbit = committedSystem.orbits.find(candidate => candidate.id === firstPrimaryOrbit.id)
  const committedSecondPrimaryOrbit = committedSystem.orbits.find(candidate => candidate.id === secondPrimaryOrbit.id)
  if (!committedFirstPrimaryOrbit || !committedSecondPrimaryOrbit) {
    throw new Error('The committed placement removed an existing Primary Star Orbit.')
  }
  expect(committedFirstPrimaryOrbit.order).toBe(1)
  expect(committedSecondPrimaryOrbit.order).toBe(2)
  expect(committed.layout.orbitRadii[orbit.id]).toEqual({ horizontal: 39, vertical: 60 })
})

test('an ambiguous Orbit center drag requires a named host choice before preview and Apply', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { hierarchy, map } = await openPlacementLab(page, ambiguousOrbitPlacementFixture())
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
  const ring = map.locator(`.orbit-mark[data-orbit-id="${orbit.id}"] .orbit-ring`)
  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  const centerHandle = map.locator(`.orbit-mark[data-orbit-id="${orbit.id}"] .orbit-center-handle`)
  await expect(centerHandle).toBeVisible()
  await ensureMapDragPointsReachable(page, map, centerHandle, primaryPosition)
  await beginDragToWorldPoint(page, map, centerHandle, primaryPosition)
  await expect(centerHandle).toHaveClass(/is-moving/)
  await page.mouse.up()

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
  await page.keyboard.press('Escape')
  await selectInspectorOption(host, 'A, Primary Star (Star)')
  expect(await readInspectorSelection(host)).toBe('A, Primary Star (Star)')
  await inspector.getByRole('button', { name: 'Preview placement', exact: true }).click()

  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBe(primaryPosition.x)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBe(primaryPosition.y)
  await expect.poll(async () => Number(await ring.getAttribute('rx'))).toBe(39)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).toBe(60)
  await expectObjectPosition(map, passenger.id, { x: primaryPosition.x, y: primaryPosition.y + 60 })
  await expectObjectPosition(map, nestedObject.id, { x: primaryPosition.x + 46, y: primaryPosition.y + 60 })
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
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

test('moving a free Orbit center to a nearby free point commits instead of treating itself as an Add collision', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = orbitPlacementFixture()
  fixture.layout.objectAngles[passengerId] = Math.PI / 2
  const { hierarchy, map } = await openPlacementLab(page, fixture)
  await expect(map).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  if (!system) throw new Error('The imported fixture did not export a star system.')
  const orbit = system.orbits.find(candidate => candidate.hostId === null && candidate.order === 1)
  const passenger = system.objects.find(object => object.name === 'Transfer Moon')
  const nestedObject = system.objects.find(object => object.name === 'Nested Traveler')
  if (!orbit || !passenger || !nestedObject) {
    throw new Error('The imported fixture is missing its free Orbit or dependent objects.')
  }

  const ring = map.locator('.orbit-mark[data-orbit-id="' + orbit.id + '"] .orbit-ring')
  const initialCenter = {
    x: Number(await ring.getAttribute('cx')),
    y: Number(await ring.getAttribute('cy')),
  }
  const originalPassengerPosition = await objectPosition(map, passenger.id)
  const originalNestedPosition = await objectPosition(map, nestedObject.id)
  const target = { x: initialCenter.x + 20, y: initialCenter.y }

  await hierarchy.getByRole('treeitem', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  const centerHandle = map.locator('.orbit-mark[data-orbit-id="' + orbit.id + '"] .orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  await ensureMapDragPointsReachable(page, map, centerHandle, target)
  await beginDragToWorldPoint(page, map, centerHandle, target)
  await expect(centerHandle).toHaveClass(/is-moving/)
  // Native screen coordinates quantize the intended endpoint; commit must match the delivered preview.
  const previewCenter = {
    x: Number(await ring.getAttribute('cx')),
    y: Number(await ring.getAttribute('cy')),
  }
  expect(Math.abs(previewCenter.x - target.x)).toBeLessThan(1)
  expect(Math.abs(previewCenter.y - target.y)).toBeLessThan(1)
  const delta = { x: previewCenter.x - initialCenter.x, y: previewCenter.y - initialCenter.y }
  for (const [id, before] of [[passenger.id, originalPassengerPosition], [nestedObject.id, originalNestedPosition]] as const) {
    await expect.poll(async () => {
      const actual = await objectPosition(map, id)
      return Math.hypot(actual.x - before.x - delta.x, actual.y - before.y - delta.y)
    }).toBeLessThan(0.000001)
  }
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)
  await expect(centerHandle).toHaveClass(/is-moving/)

  await page.mouse.up()
  const committed = await downloadJson(page, 'Export star system JSON')
  const committedSystem = committed.system
  if (!committedSystem) throw new Error('The free-center move removed the exported star system.')
  const movedOrbit = committedSystem.orbits.find(candidate => candidate.id === orbit.id)
  if (!movedOrbit) throw new Error('The free-center move removed its Orbit.')
  expect(movedOrbit.hostId).toBeNull()
  expect(movedOrbit.order).toBe(1)
  expect(movedOrbit.center?.x).toBeCloseTo((previewCenter.x - 64) / 832, 5)
  expect(movedOrbit.center?.y).toBeCloseTo((previewCenter.y - 72) / 416, 5)
  await expect.poll(async () => Number(await ring.getAttribute('cx'))).toBeCloseTo(previewCenter.x, 4)
  await expect.poll(async () => Number(await ring.getAttribute('cy'))).toBeCloseTo(previewCenter.y, 4)
})

test('attaching an implicit-radius free Orbit preserves both free Orbit geometries while reindexing a sibling', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { hierarchy, map } = await openPlacementLab(page, legacyImplicitOrbitRadiiFixture())
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

  const sourceRing = map.locator('.orbit-mark[data-orbit-id="' + orbit.id + '"] .orbit-ring')
  const siblingRing = map.locator('.orbit-mark[data-orbit-id="' + sibling.id + '"] .orbit-ring')
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
  await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  const centerHandle = map.locator('.orbit-mark[data-orbit-id="' + orbit.id + '"] .orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  await ensureMapDragPointsReachable(page, map, centerHandle, hostPosition)
  await beginDragToWorldPoint(page, map, centerHandle, hostPosition)
  await expect(centerHandle).toHaveClass(/is-moving/)
  await expect.poll(async () => Number(await sourceRing.getAttribute('cx'))).toBeCloseTo(hostPosition.x, 4)
  await expect.poll(async () => Number(await sourceRing.getAttribute('cy'))).toBeCloseTo(hostPosition.y, 4)
  await expect.poll(async () => Number(await sourceRing.getAttribute('rx'))).toBe(sourceRadii.horizontal)
  await expect.poll(async () => Number(await sourceRing.getAttribute('ry'))).toBe(sourceRadii.vertical)
  await expectObjectPosition(map, passenger.id, { x: hostPosition.x, y: hostPosition.y + sourceRadii.vertical })
  await expectObjectPosition(map, nestedObject.id, { x: hostPosition.x + 46, y: hostPosition.y + sourceRadii.vertical })
  await expectObjectPosition(map, neighbor.id, neighborPosition)
  expect(await downloadSystemJsonDuringDrag(page)).toEqual(initial)

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

  await page.reload()
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const restoredMap = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  const restoredSourceRing = restoredMap.locator('.orbit-mark[data-orbit-id="' + orbit.id + '"] .orbit-ring')
  const restoredSiblingRing = restoredMap.locator('.orbit-mark[data-orbit-id="' + sibling.id + '"] .orbit-ring')
  await expect(restoredSourceRing).toHaveAttribute('rx', String(sourceRadii.horizontal))
  await expect(restoredSourceRing).toHaveAttribute('ry', String(sourceRadii.vertical))
  await expect(restoredSiblingRing).toHaveAttribute('rx', String(siblingRadii.horizontal))
  await expect(restoredSiblingRing).toHaveAttribute('ry', String(siblingRadii.vertical))
  await expectObjectPosition(restoredMap, neighbor.id, neighborPosition)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(committed)
})
