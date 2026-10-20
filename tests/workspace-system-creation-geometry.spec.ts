import { expect, test, type Locator, type Page } from '@playwright/test'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import {
  captureMapExportBlobs,
  dockAction,
  downloadImage,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  returnToClusterMap,
  selectCatalogueObjectButton,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  workspaceZoomControls,
  type WorldPoint,
} from './helpers'

const preservedLegacyPositions = [
  { name: 'Old Planet', point: { x: 520, y: 210.7179676972449 } },
  { name: 'Old Moon', point: { x: 440, y: 349.2820323027551 } },
] satisfies Array<{ name: string; point: WorldPoint }>

async function createWorkspace(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
}

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
      return !hit.closest('[data-map-obstruction], .system-object, .orbit-mark, .orbit-edit-control')
    }

    for (let y = Math.ceil(bounds.top + 24); y <= bottom - 24; y += 12) {
      for (let x = Math.ceil(bounds.left + 24); x + 56 <= right - 24; x += 12) {
        if (isMapHit(x, y) && isMapHit(x + 56, y)) {
          return { first: { id: 1, x, y }, second: { id: 2, x: x + 56, y } }
        }
      }
    }
    throw new Error('Could not find two unobstructed touch points on the visible system map.')
  })
  return [pair.first, pair.second]
}

async function openDenseReach(page: Page): Promise<Locator> {
  await returnToClusterMap(page)
  const importDialog = page.waitForEvent('dialog')
  await setJsonFile(
    jsonMapImportInput(page),
    'dense-reach.json',
    JSON.stringify(creationGeometryFixture),
  )
  const preview = await importDialog
  expect(preview.message()).toContain('Star systems: 1')
  await preview.accept()
  await setHeaderMapActionsOpen(page, false)

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const map = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })
  await expect(map).toBeVisible()
  return map
}

/** Clicks a fixed scene point through the public map and returns its delivered scene-space error. */
async function clickScenePoint(page: Page, map: Locator, target: WorldPoint): Promise<number> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const hit = await map.evaluate((element, scenePoint) => {
      const content = element.querySelector<SVGGElement>('.system-map-content')
      const transform = content?.getScreenCTM()
      if (!transform) throw new Error('The system map content is not attached to the document.')
      const requestedScreenPoint = new DOMPoint(scenePoint.x, scenePoint.y).matrixTransform(transform)
      // Chromium page.mouse.click reports whole CSS-pixel client coordinates.
      const clickPoint = { x: Math.round(requestedScreenPoint.x), y: Math.round(requestedScreenPoint.y) }
      const delivered = new DOMPoint(clickPoint.x, clickPoint.y).matrixTransform(transform.inverse())
      const bounds = element.getBoundingClientRect()
      const targetElement = document.elementFromPoint(clickPoint.x, clickPoint.y)
      return {
        clickPoint,
        sceneError: Math.hypot(delivered.x - scenePoint.x, delivered.y - scenePoint.y),
        reachable: clickPoint.x >= Math.max(0, bounds.left) && clickPoint.y >= Math.max(0, bounds.top)
          && clickPoint.x < Math.min(window.innerWidth, bounds.right)
          && clickPoint.y < Math.min(window.innerHeight, bounds.bottom)
          && !!targetElement && (targetElement === element || element.contains(targetElement)),
      }
    }, target)

    if (hit.reachable) {
      await page.mouse.click(hit.clickPoint.x, hit.clickPoint.y)
      return hit.sceneError
    }
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }

  throw new Error(`Scene point (${target.x}, ${target.y}) is unreachable after public Zoom out controls.`)
}

function mapObject(map: Locator, id: string): Locator {
  return map.locator(`.system-object[data-object-id="${id}"]`)
}

async function expectObjectAt(map: Locator, id: string, expected: WorldPoint): Promise<string> {
  const transform = await mapObject(map, id).getAttribute('transform')
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
  await createWorkspace(page)
  const map = await openDenseReach(page)

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
    originalTransforms.set(object.id, await expectObjectAt(map, object.id, point))
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
      point: { x: 592.5020987390543, y: 244.52742863650086 },
      orbitId: nestedOrbit.id,
      minorRadius: 55,
    },
  ] as const

  const clickErrors: number[] = []
  const initialObjectCount = initial.system!.objects.length
  clickErrors.push(await clickScenePoint(page, map, creationTargets[0].point))
  const alphaChoice = page.getByRole('button', { name: `Orbit ${alphaOrbit.order} around ${primary.name}`, exact: true })
  const betaChoice = page.getByRole('button', { name: `Orbit ${betaOrbit.order} around ${primary.name}`, exact: true })
  await expect(alphaChoice).toBeVisible()
  await expect(betaChoice).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  await expect(map.locator('.system-object')).toHaveCount(initialObjectCount)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initial)
  await alphaChoice.click()
  await expect(map.locator('.system-object')).toHaveCount(initialObjectCount + 1)
  await expect(creationControls).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
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
  await expect(map.locator(`.orbit-mark[data-orbit-id="${alphaOrbit.id}"] .orbit-ring`))
    .toHaveAttribute('transform', 'rotate(30 480 280)')
  const completedExport = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!completedExport.text) throw new Error('The SVG exported after direct Add has no serialized content.')
  expect(completedExport.text).not.toContain('system-creation-preview')

  for (const { name, point } of preservedLegacyPositions) {
    const object = initial.system!.objects.find(candidate => candidate.name === name)!
    await expect(mapObject(map, object.id)).toHaveAttribute('transform', originalTransforms.get(object.id)!)
    await expectObjectAt(map, object.id, point)
  }

  clickErrors.push(await clickScenePoint(page, map, creationTargets[1].point))
  await expect(map.locator('.system-object')).toHaveCount(initialObjectCount + 2)
  await expect(creationControls).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  for (const { name, point } of preservedLegacyPositions) {
    const object = initial.system!.objects.find(candidate => candidate.name === name)!
    await expect(mapObject(map, object.id)).toHaveAttribute('transform', originalTransforms.get(object.id)!)
    await expectObjectAt(map, object.id, point)
  }

  const completed = await downloadJson(page, 'Export star system JSON')
  const createdPlanets = completed.system!.objects.filter(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )
  expect(createdPlanets).toHaveLength(2)
  for (let index = 0; index < creationTargets.length; index += 1) {
    const target = creationTargets[index]!
    const planet = createdPlanets[index]!
    expect(planet.placement).toEqual({ kind: 'orbit', orbitId: target.orbitId })
    expectAngleNearFixtureAngle(completed.layout.objectAngles[planet.id], clickErrors[index]!, target.minorRadius)
  }
})

test('a second map touch interrupts a fresh Add gesture and leaves the completed object unchanged', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const beforeChoosing = await downloadJson(page, 'Export star system JSON')
  await setWorkspaceMapMode(page, 'Move')
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const creationControls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const star = beforeChoosing.system!.objects.find(object => object.subtype === 'star')!
  const starTransform = await mapObject(map, star.id).getAttribute('transform')
  const starBounds = await mapObject(map, star.id).boundingBox()
  if (!starBounds || !starTransform) throw new Error('The primary star is not rendered for drag protection.')
  const starStart = { x: starBounds.x + starBounds.width / 2, y: starBounds.y + starBounds.height / 2 }
  await page.mouse.move(starStart.x, starStart.y)
  await page.mouse.down()
  await page.mouse.move(starStart.x + 48, starStart.y + 24, { steps: 5 })
  await page.mouse.up()
  await expect(mapObject(map, star.id)).toHaveAttribute('transform', starTransform)
  await expect(map.locator('.system-object')).toHaveCount(beforeChoosing.system!.objects.length)
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforeChoosing)

  const firstTarget = { x: 170, y: 150 }
  await clickScenePoint(page, map, firstTarget)
  await expect(map.locator('.system-object')).toHaveCount(beforeChoosing.system!.objects.length + 1)
  const afterFirstAdd = await downloadJson(page, 'Export star system JSON')
  const originalObjectIds = new Set(beforeChoosing.system!.objects.map(object => object.id))
  const firstAddedPlanet = afterFirstAdd.system!.objects.find(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )!
  await expect(creationControls).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)

  const mapContent = map.locator('.system-map-content')
  const transformBeforeTouch = await mapContent.getAttribute('transform')
  if (!transformBeforeTouch) throw new Error('The map content transform is missing before touch navigation.')
  const [firstTouch, secondTouch] = await findUnobstructedMapTouchPair(map)
  const movedTouches = [firstTouch, secondTouch].map(point => ({
    ...point,
    x: point.x + 24,
    y: point.y + 18,
  }))
  const cdp = await enableMapTouch(page)
  let touchSequenceActive = false
  try {
    await dispatchMapTouch(cdp, 'touchStart', [firstTouch])
    touchSequenceActive = true
    await dispatchMapTouch(cdp, 'touchStart', [firstTouch, secondTouch])
    await dispatchMapTouch(cdp, 'touchMove', movedTouches)
    await expect(mapContent).not.toHaveAttribute('transform', transformBeforeTouch)
    await dispatchMapTouch(cdp, 'touchEnd', [])
    touchSequenceActive = false
  } finally {
    if (touchSequenceActive) await dispatchMapTouch(cdp, 'touchCancel', [])
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }

  await expect(map.locator('.system-object')).toHaveCount(beforeChoosing.system!.objects.length + 1)
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  await expect(creationControls).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(afterFirstAdd)

  await clickScenePoint(page, map, { x: 370, y: 410 })
  await expect(map.locator('.system-object')).toHaveCount(beforeChoosing.system!.objects.length + 2)
  const completed = await downloadJson(page, 'Export star system JSON')
  const addedPlanets = completed.system!.objects.filter(object =>
    object.subtype === 'planet' && !originalObjectIds.has(object.id),
  )
  expect(addedPlanets).toHaveLength(2)
  expect(completed.system!.objects.find(object => object.id === firstAddedPlanet.id)).toEqual(firstAddedPlanet)
  expect(completed.layout.objectAngles[firstAddedPlanet.id])
    .toBe(afterFirstAdd.layout.objectAngles[firstAddedPlanet.id])
})

test('a held pan release after click suppression expires adds nothing before a fresh Add click', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const beforePan = await downloadJson(page, 'Export star system JSON')
  await setWorkspaceMapMode(page, 'Move')
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()
  const creationControls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const mapContent = map.locator('.system-map-content')
  const transformBeforePan = await mapContent.getAttribute('transform')
  if (!transformBeforePan) throw new Error('The map content transform is missing before the held pan.')
  const panStart = await map.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const right = Math.min(bounds.right, window.innerWidth)
    const bottom = Math.min(bounds.bottom, window.innerHeight)
    const isMapHit = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y)
      if (!hit || (hit !== element && !element.contains(hit))) return false
      if (!(hit instanceof Element)) return true
      return !hit.closest('[data-map-obstruction], .system-object, .orbit-mark, .orbit-edit-control')
    }

    for (let y = Math.ceil(bounds.top + 24); y <= bottom - 48; y += 12) {
      for (let x = Math.ceil(bounds.left + 24); x <= right - 48; x += 12) {
        if (isMapHit(x, y) && isMapHit(x + 36, y + 24)) return { x, y }
      }
    }
    throw new Error('Could not find an unobstructed map point for the held pan.')
  })
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(panStart.x + 36, panStart.y + 24, { steps: 3 })
  await expect(mapContent).not.toHaveAttribute('transform', transformBeforePan)
  await page.waitForTimeout(950)
  await page.mouse.up()
  await expect(map.locator('.system-object')).toHaveCount(beforePan.system!.objects.length)
  await expect(creationControls).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforePan)

  await clickScenePoint(page, map, { x: 370, y: 410 })
  await expect(map.locator('.system-object')).toHaveCount(beforePan.system!.objects.length + 1)
  const completed = await downloadJson(page, 'Export star system JSON')
  expect(completed.system!.objects.filter(object =>
    object.subtype === 'planet' && !beforePan.system!.objects.some(initial => initial.id === object.id),
  )).toHaveLength(1)
})

test('a stationary Primary Star long press adds no Orbit after click suppression expires', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const beforeLongPress = await downloadJson(page, 'Export star system JSON')
  const primary = beforeLongPress.system!.objects.find(object => object.subtype === 'star')!
  const primaryGlyph = mapObject(map, primary.id)

  await setWorkspaceMapMode(page, 'Navigate')
  await (await dockAction(page, 'Add orbit')).click()
  const creationControls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  await expect(creationControls).toBeVisible()

  const hit = await primaryGlyph.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const point = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    const target = document.elementFromPoint(point.x, point.y)
    return {
      ...point,
      isPrimaryGlyph: !!target && (target === element || element.contains(target)),
    }
  })
  expect(hit.isPrimaryGlyph).toBe(true)
  await page.mouse.move(hit.x, hit.y)
  await page.mouse.down()
  await page.waitForTimeout(1600)
  await page.mouse.up()

  await expect(map.locator('.orbit-mark')).toHaveCount(beforeLongPress.system!.orbits.length)
  await expect(creationControls).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(beforeLongPress)

  await page.mouse.click(hit.x, hit.y)
  await expect(map.locator('.orbit-mark')).toHaveCount(beforeLongPress.system!.orbits.length + 1)
  await expect(creationControls).toBeVisible()
  const completed = await downloadJson(page, 'Export star system JSON')
  const priorOrbitIds = new Set(beforeLongPress.system!.orbits.map(orbit => orbit.id))
  const addedOrbits = completed.system!.orbits.filter(orbit => !priorOrbitIds.has(orbit.id))
  expect(addedOrbits).toHaveLength(1)
  expect(addedOrbits[0]!.hostId).toBe(primary.id)
})
