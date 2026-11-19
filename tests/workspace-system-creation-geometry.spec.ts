import { expect, test, type Locator, type Page } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { resolveImportReview, reviewStarSystemImport } from './helpers'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  downloadImage,
  downloadJson,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  setWorkspaceMapMode,
  wardenMap,
  wardenObjectMark,
  wardenSystemMark,
  type WorldPoint,
} from './helpers'

const preservedLegacyPositions = [
  { name: 'Old Planet', point: { x: 520, y: 210.7179676972449 } },
  { name: 'Old Moon', point: { x: 440, y: 349.2820323027551 } },
] satisfies Array<{ name: string; point: WorldPoint }>

type TouchPoint = { id: number; x: number; y: number }

async function enableMapTouch(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  return cdp
}

async function dispatchMapTouch(
  cdp: Awaited<ReturnType<typeof enableMapTouch>>,
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  points: TouchPoint[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(point => ({ ...point, radiusX: 2, radiusY: 2, force: 1 })),
  })
}

async function findUnobstructedMapTouchPair(map: Locator): Promise<[TouchPoint, TouchPoint]> {
  const pair = await map.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const right = Math.min(bounds.right, window.innerWidth)
    const bottom = Math.min(bounds.bottom, window.innerHeight)
    const isMapHit = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y)
      if (!hit || (hit !== element && !element.contains(hit))) return false
      if (!(hit instanceof Element)) return true
      return !hit.closest('[data-map-obstruction], .continuous-warden-object, .continuous-warden-orbit-target, .cluster-system-node')
    }

    for (let y = Math.ceil(bounds.top + 24); y <= bottom - 24; y += 12) {
      for (let x = Math.ceil(bounds.left + 24); x + 56 <= right - 24; x += 12) {
        if (isMapHit(x, y) && isMapHit(x + 56, y)) {
          return { first: { id: 1, x, y }, second: { id: 2, x: x + 56, y } }
        }
      }
    }
    throw new Error('Could not find two unobstructed touch points on the visible Warden map.')
  })
  return [pair.first, pair.second]
}

async function openDenseReach(page: Page): Promise<{ map: Locator; systemId: string }> {
  const preview = await reviewStarSystemImport(page, 'dense-reach.json', JSON.stringify(creationGeometryFixture))
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Inspect Dense Reach', exact: true }).click()
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hideWorkspaceInspector(page)
  const map = wardenMap(page)
  await expect(map).toHaveAccessibleName('Kestrel Reach continuous map')
  await centerWorkspaceSelection(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const systemId = initial.system?.id
  if (!systemId || initial.system?.name !== 'Dense Reach') {
    throw new Error('The imported Dense Reach system was not selected on the Warden map.')
  }
  await expect(wardenSystemMark(page, systemId)).toBeVisible()
  return { map, systemId }
}

function normalizedFixturePoint(point: WorldPoint): WorldPoint {
  return { x: (point.x - 64) / 832, y: (point.y - 72) / 416 }
}

/** Clicks a fixture-local point and returns its delivered error in the same local SVG units. */
async function clickScenePoint(page: Page, systemId: string, target: WorldPoint): Promise<number> {
  const requested = normalizedFixturePoint(target)
  const delivered = await clickWardenSystemPoint(page, systemId, requested)
  return Math.hypot((delivered.x - requested.x) * 832, (delivered.y - requested.y) * 416)
}

function mapObjects(map: Locator, systemId: string): Locator {
  return map.locator(`.continuous-warden-object[data-system-id="${systemId}"]`)
}

async function expectObjectAt(object: Locator, expected: WorldPoint): Promise<string> {
  const transform = await object.getAttribute('transform')
  expect(transform).not.toBeNull()
  const position = transform?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
  expect(position).not.toBeNull()
  expect(Number(position?.[1])).toBeCloseTo(expected.x, 6)
  expect(Number(position?.[2])).toBeCloseTo(expected.y, 6)
  return transform!
}

function expectAngleNearFixtureAngle(actual: number | undefined, clickError: number, minorRadius: number): void {
  expect(actual).toBeDefined()
  if (actual === undefined) return
  const wrappedDifference = Math.atan2(Math.sin(actual), Math.cos(actual))
  // The bound follows the delivered pointer's scene error and the Orbit's smallest radius.
  // A nearest point can move at most twice the input error; the minor radius bounds angular chord length.
  const angularBound = 2 * Math.asin(Math.min(1, clickError / minorRadius)) + 1e-6
  expect(Math.abs(wrappedDifference)).toBeLessThanOrEqual(angularBound)
}

test('system Add targets rotated primary and nested Orbits without shifting legacy occupants', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const { map, systemId } = await openDenseReach(page)

  const initial = await downloadJson(page, 'Export star system JSON')
  expect(initial.type).toBe('system')
  expect(initial.system?.name).toBe('Dense Reach')
  const primary = initial.system!.objects.find(object => object.name === 'Primary Star')!
  const oldPlanet = initial.system!.objects.find(object => object.name === 'Old Planet')!
  const oldMoon = initial.system!.objects.find(object => object.name === 'Old Moon')!
  const alphaOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)!
  const betaOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)!
  const nestedOrbit = initial.system!.orbits.find(orbit => orbit.hostId === oldPlanet.id && orbit.order === 1)!
  expect(initial.layout.objectAngles).not.toHaveProperty(oldPlanet.id)
  expect(initial.layout.objectAngles).not.toHaveProperty(oldMoon.id)

  const originalTransforms = new Map<string, string>()
  for (const { name, point } of preservedLegacyPositions) {
    const object = initial.system!.objects.find(candidate => candidate.name === name)!
    originalTransforms.set(object.id, await expectObjectAt(wardenObjectMark(page, systemId, object.id), point))
  }

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()
  const creationControls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const creationTargets = [
    {
      point: { x: 583.9230484541326, y: 340 },
      orbitId: alphaOrbit.id,
      minorRadius: 80,
    },
    {
      // Keep decimal fixture text; Number yields the same runtime float as the original literal.
      point: { x: 592.5020987390543, y: Number('244.52742863650086') },
      orbitId: nestedOrbit.id,
      minorRadius: 55,
    },
  ] as const

  const clickErrors: number[] = []
  const initialObjectCount = initial.system!.objects.length
  clickErrors.push(await clickScenePoint(page, systemId, creationTargets[0].point))
  const alphaChoice = page.getByRole('button', { name: `Orbit ${alphaOrbit.order} around ${primary.name}`, exact: true })
  const betaChoice = page.getByRole('button', { name: `Orbit ${betaOrbit.order} around ${primary.name}`, exact: true })
  await expect(alphaChoice).toBeVisible()
  await expect(betaChoice).toBeVisible()
  await expect(mapObjects(map, systemId)).toHaveCount(initialObjectCount)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await alphaChoice.click()
  await expect(mapObjects(map, systemId)).toHaveCount(initialObjectCount + 1)
  await expect(creationControls).toBeVisible()
  const afterAlphaChoice = await downloadJson(page, 'Export star system JSON')
  const originalObjectIds = new Set(initial.system!.objects.map(object => object.id))
  const alphaPlanet = afterAlphaChoice.system!.objects.find(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )!
  expect(alphaPlanet.placement).toEqual({ kind: 'orbit', orbitId: alphaOrbit.id })
  expectAngleNearFixtureAngle(
    afterAlphaChoice.layout.objectAngles[alphaPlanet.id],
    clickErrors[0]!,
    creationTargets[0].minorRadius,
  )

  clickErrors.push(await clickScenePoint(page, systemId, creationTargets[0].point))
  await expect(alphaChoice).toBeVisible()
  await expect(betaChoice).toBeVisible()
  await expect(mapObjects(map, systemId)).toHaveCount(initialObjectCount + 1)
  await alphaChoice.click()
  await expect(mapObjects(map, systemId)).toHaveCount(initialObjectCount + 2)
  await expect(map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${alphaOrbit.id}"]`))
    .toHaveAttribute('transform', 'rotate(30 480 280)')
  const completedExport = await downloadImage(page, 'image/svg+xml')
  if (!completedExport.text) throw new Error('The SVG exported after direct Add has no serialized content.')
  expect(completedExport.text).toContain(alphaPlanet.name)

  for (const { name, point } of preservedLegacyPositions) {
    const object = initial.system!.objects.find(candidate => candidate.name === name)!
    await expect(wardenObjectMark(page, systemId, object.id)).toHaveAttribute('transform', originalTransforms.get(object.id)!)
    await expectObjectAt(wardenObjectMark(page, systemId, object.id), point)
  }

  clickErrors.push(await clickScenePoint(page, systemId, creationTargets[1].point))
  await expect(mapObjects(map, systemId)).toHaveCount(initialObjectCount + 3)
  await expect(creationControls).toBeVisible()
  for (const { name, point } of preservedLegacyPositions) {
    const object = initial.system!.objects.find(candidate => candidate.name === name)!
    await expect(wardenObjectMark(page, systemId, object.id)).toHaveAttribute('transform', originalTransforms.get(object.id)!)
    await expectObjectAt(wardenObjectMark(page, systemId, object.id), point)
  }

  const completed = await downloadJson(page, 'Export star system JSON')
  const createdPlanets = completed.system!.objects.filter(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )
  const expectedTargets = [creationTargets[0]!, creationTargets[0]!, creationTargets[1]!]
  expect(createdPlanets).toHaveLength(expectedTargets.length)
  for (let index = 0; index < expectedTargets.length; index += 1) {
    const target = expectedTargets[index]!
    const planet = createdPlanets[index]!
    expect(planet.placement).toEqual({ kind: 'orbit', orbitId: target.orbitId })
    expectAngleNearFixtureAngle(completed.layout.objectAngles[planet.id], clickErrors[index]!, target.minorRadius)
  }
  await waitForWorkspaceSaved(page)
})


test('a second map touch interrupts a fresh Add gesture and leaves the completed object unchanged', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const map = wardenMap(page)
  const beforeChoosing = await downloadJson(page, 'Export star system JSON')
  await setWorkspaceMapMode(page, 'Move')
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const creationControls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const star = beforeChoosing.system!.objects.find(object => object.subtype === 'star')!
  const starMark = wardenObjectMark(page, systemId, star.id)
  const starTransform = await starMark.getAttribute('transform')
  const starBounds = await starMark.boundingBox()
  if (!starBounds || !starTransform) throw new Error('The primary star is not rendered for drag protection.')
  const starStart = { x: starBounds.x + starBounds.width / 2, y: starBounds.y + starBounds.height / 2 }
  await page.mouse.move(starStart.x, starStart.y)
  await page.mouse.down()
  await page.mouse.move(starStart.x + 48, starStart.y + 24, { steps: 5 })
  await page.mouse.up()
  await expect(starMark).toHaveAttribute('transform', starTransform)
  await expect(mapObjects(map, systemId)).toHaveCount(beforeChoosing.system!.objects.length)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforeChoosing)

  const firstTarget = { x: 170, y: 150 }
  await clickScenePoint(page, systemId, firstTarget)
  await expect(mapObjects(map, systemId)).toHaveCount(beforeChoosing.system!.objects.length + 1)
  const afterFirstAdd = await downloadJson(page, 'Export star system JSON')
  const originalObjectIds = new Set(beforeChoosing.system!.objects.map(object => object.id))
  const firstAddedPlanet = afterFirstAdd.system!.objects.find(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )!
  await expect(creationControls).toBeVisible()

  const mapContent = map.locator('.cluster-map-content')
  const transformBeforeTouch = await mapContent.getAttribute('transform')
  if (!transformBeforeTouch) throw new Error('The map content transform is missing before touch navigation.')
  const [firstTouch, secondTouch] = await findUnobstructedMapTouchPair(map)
  const firstPan = { ...firstTouch, x: firstTouch.x + 24, y: firstTouch.y + 18 }
  const movedTouches = [firstPan, secondTouch].map(point => ({
    ...point,
    x: point.x + 24,
    y: point.y + 18,
  }))
  const cdp = await enableMapTouch(page)
  let touchSequenceActive = false
  try {
    await dispatchMapTouch(cdp, 'touchStart', [firstTouch])
    touchSequenceActive = true
    await dispatchMapTouch(cdp, 'touchMove', [firstPan])
    await expect(mapContent).not.toHaveAttribute('transform', transformBeforeTouch)
    await expect(mapObjects(map, systemId)).toHaveCount(beforeChoosing.system!.objects.length + 1)
    const transformBeforeTakeover = await mapContent.getAttribute('transform')
    if (!transformBeforeTakeover) throw new Error('The map content transform is missing after the first touch.')
    await dispatchMapTouch(cdp, 'touchStart', [firstPan, secondTouch])
    await dispatchMapTouch(cdp, 'touchMove', movedTouches)
    await expect(mapContent).not.toHaveAttribute('transform', transformBeforeTakeover)
    await dispatchMapTouch(cdp, 'touchEnd', [])
    touchSequenceActive = false
  } finally {
    if (touchSequenceActive) await dispatchMapTouch(cdp, 'touchCancel', [])
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }

  await expect(mapObjects(map, systemId)).toHaveCount(beforeChoosing.system!.objects.length + 1)
  await expect(creationControls).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(afterFirstAdd)

  await clickScenePoint(page, systemId, { x: 370, y: 410 })
  await expect(mapObjects(map, systemId)).toHaveCount(beforeChoosing.system!.objects.length + 2)
  const completed = await downloadJson(page, 'Export star system JSON')
  const addedPlanets = completed.system!.objects.filter(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )
  expect(addedPlanets).toHaveLength(2)
  expect(completed.system!.objects.find(object => object.id === firstAddedPlanet.id)).toEqual(firstAddedPlanet)
  expect(completed.layout.objectAngles[firstAddedPlanet.id])
    .toBe(afterFirstAdd.layout.objectAngles[firstAddedPlanet.id])
  await waitForWorkspaceSaved(page)
})
