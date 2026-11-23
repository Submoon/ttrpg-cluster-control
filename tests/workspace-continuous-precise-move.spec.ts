import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  clickWardenSystemPoint,
  dockAction,
  downloadJson,
  createSingleSystemWorkspace,
  openWorkspaceHierarchy,
  quitSystemAdd,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  wardenLocalCoordinates,
  wardenMap,
  wardenObjectMark,
  workspaceZoomOutput,
} from './helpers'

type LocalPoint = { x: number; y: number }
type WardenWheelProbe = {
  pointer: LocalPoint | null
  wheelCount: number
  wheelScales: number[]
  initialScale: number | null
  initialOrbitRadius: number | null
  scenePointAtLastWheel: LocalPoint | null
  lastWheelTime: number | null
  targetReachedTime: number | null
  scales: number[]
  settled: boolean
}

async function prepareContinuousOrbitMap(page: import('@playwright/test').Page) {
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId, systemName } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })
  const map = wardenMap(page)
  const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await (await dockAction(page, 'Add orbit')).click()
  const delivered = await clickWardenSystemPoint(page, systemId, { x: 0.3, y: 0.3 })
  await expect(orbit).toHaveCount(1)
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const snapshot = await downloadJson(page, 'Export Jump Cluster JSON')
  const createdOrbit = snapshot.cluster?.systems.find(system => system.id === systemId)?.orbits[0]
  if (!createdOrbit) throw new Error('The saved unoccupied Orbit is missing from its owner.')
  expect(createdOrbit.hostId).toBeNull()
  expect(createdOrbit.center?.x).toBeCloseTo(delivered.x, 5)
  expect(createdOrbit.center?.y).toBeCloseTo(delivered.y, 5)
  await setWorkspaceMapMode(page, 'Move')
  return { map, orbit, orbitId: createdOrbit.id, primaryObjectId, systemId, systemName }
}

test('wheel zoom repaints object text and Orbits in a fixed viewport paint space', async ({ page }) => {
  const { map, systemId, primaryObjectId } = await prepareContinuousOrbitMap(page)
  const object = wardenObjectMark(page, systemId, primaryObjectId)
  const camera = map.locator('.cluster-map-content')
  const scale = () => camera.evaluate(element => (element as SVGGraphicsElement).getCTM()!.a)
  const pointer = await object.evaluate(element => {
    const point = new DOMPoint().matrixTransform((element as SVGGraphicsElement).getScreenCTM()!)
    return { x: point.x, y: point.y }
  })
  await page.mouse.move(Math.round(pointer.x), Math.round(pointer.y))
  await map.evaluate((element) => {
    const camera = element.querySelector<SVGGElement>('.cluster-map-content')
    const initialMatrix = camera?.getScreenCTM()
    if (!camera || !initialMatrix) throw new Error('The continuous map camera must be measurable before wheel zoom.')

    const probe: WardenWheelProbe = {
      pointer: null,
      wheelCount: 0,
      wheelScales: [],
      initialScale: null,
      initialOrbitRadius: null,
      scenePointAtLastWheel: null,
      lastWheelTime: null,
      targetReachedTime: null,
      scales: [],
      settled: false,
    }
    const readScale = () => camera.getCTM()?.a ?? Number.NaN
    const view = element.getBoundingClientRect()
    let secondPointer: { x: number; y: number } | null = null
    const deliverWheel = (deltaY: number, client: { x: number; y: number }) => {
      element.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaY, clientX: client.x, clientY: client.y,
      }))
    }
    const observeWheel = (event: WheelEvent) => {
      const matrix = camera.getScreenCTM()
      if (!matrix) throw new Error('The continuous map camera must be measurable at wheel delivery.')
      const scenePoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      probe.pointer = { x: event.clientX, y: event.clientY }
      probe.scenePointAtLastWheel = { x: scenePoint.x, y: scenePoint.y }
      probe.lastWheelTime = window.performance.now()
      probe.wheelScales.push(readScale())
      probe.wheelCount += 1
      probe.settled = false
      if (probe.wheelCount === 3) window.removeEventListener('wheel', observeWheel, true)

      if (probe.initialScale !== null) return
      probe.initialScale = readScale()
      secondPointer = {
        x: event.clientX + (event.clientX + 64 < view.right - 8 ? 64 : -64),
        y: event.clientY + (event.clientY + 40 < view.bottom - 8 ? 40 : -40),
      }
      const orbit = element.querySelector<SVGEllipseElement>('.continuous-warden-orbit-target')
      if (!orbit) throw new Error('A Warden Orbit must be present before wheel zoom.')
      probe.initialOrbitRadius = Number(orbit.getAttribute('rx'))
      probe.scales.push(probe.initialScale)

      let previousScale = probe.initialScale
      let unchangedFrames = 0
      const sampleCamera = () => {
        const nextScale = readScale()
        probe.scales.push(nextScale)
        // Deliver the follow-up impulses in the browser while the camera is still easing.
        // Automation round trips can exceed the first impulse's complete animation on a busy runner.
        if (secondPointer && probe.wheelCount === 1 && nextScale > probe.wheelScales[0]! + .001) {
          deliverWheel(-100, secondPointer)
        } else if (secondPointer && probe.wheelCount === 2 && nextScale > probe.wheelScales[1]! + .001) {
          deliverWheel(100, secondPointer)
        }
        // SVG matrices round the rendered scale before JavaScript reads it.
        if (probe.wheelCount >= 3 && probe.targetReachedTime === null && probe.initialScale !== null
          && Math.abs(nextScale - probe.initialScale * 2 ** 0.2) < 0.000001) {
          probe.targetReachedTime = window.performance.now()
        }
        if (Math.abs(nextScale - previousScale) < 0.0000001) unchangedFrames += 1
        else {
          previousScale = nextScale
          unchangedFrames = 0
        }
        if (probe.wheelCount >= 3 && unchangedFrames >= 3) {
          probe.settled = true
          return
        }
        window.requestAnimationFrame(sampleCamera)
      }
      window.requestAnimationFrame(sampleCamera)
    }

    ;(window as unknown as { __wardenWheelProbe?: WardenWheelProbe }).__wardenWheelProbe = probe
    window.addEventListener('wheel', observeWheel, { capture: true })
  })
  await page.clock.install()
  await page.mouse.wheel(0, -100)
  const wheelProbe = () => page.evaluate(() =>
    (window as unknown as { __wardenWheelProbe: WardenWheelProbe }).__wardenWheelProbe,
  )
  const firstPointer = { x: Math.round(pointer.x), y: Math.round(pointer.y) }
  await page.clock.runFor(300)
  const probe = await wheelProbe()
  if (!probe.pointer || !probe.scenePointAtLastWheel || probe.initialScale === null || probe.initialOrbitRadius === null) {
    throw new Error('The native wheel input did not reach the Warden camera probe.')
  }
  expect(probe.wheelCount).toBe(3)
  expect(probe.settled).toBe(true)
  expect(probe.lastWheelTime).not.toBeNull()
  expect(probe.targetReachedTime).not.toBeNull()
  // The deadline can land between frames, and the sampling callback can precede the camera callback.
  expect(probe.targetReachedTime! - probe.lastWheelTime!).toBeLessThanOrEqual(200)
  expect(probe.pointer.x).not.toBe(firstPointer.x)
  const expectedFinalScale = probe.initialScale * 2 ** 0.2
  const intermediateScales = probe.scales.filter(value => value > probe.initialScale! + 0.001 && value < expectedFinalScale - 0.001)
  expect(intermediateScales.length).toBeGreaterThan(1)
  expect(probe.wheelScales[1]).toBeLessThan(probe.initialScale * 2 ** 0.2 - 0.001)
  await expect.poll(scale).toBeCloseTo(expectedFinalScale, 3)

  const finalPaint = await map.evaluate((element) => {
    const root = element as SVGSVGElement
    const camera = root.querySelector<SVGGElement>('.cluster-map-content')
    const orbit = root.querySelector<SVGEllipseElement>('.continuous-warden-orbit-target')
    if (!camera || !orbit) throw new Error('The continuous camera and Orbit must remain mounted after wheel zoom.')
    const rootMatrix = root.getScreenCTM()
    const cameraMatrix = camera.getCTM()
    if (!rootMatrix || !cameraMatrix) throw new Error('The final Warden camera transform must be measurable.')
    const paints = [...root.querySelectorAll<SVGGraphicsElement>(
      '.continuous-warden-object, .continuous-warden-object-name, .continuous-warden-orbit-target',
    )].map(mark => {
      const matrix = mark.getScreenCTM()
      if (!matrix) throw new Error('A painted Warden mark must remain measurable during wheel zoom.')
      return Math.hypot(matrix.a, matrix.b) / Math.hypot(rootMatrix.a, rootMatrix.b)
    })
    // Capture these together so no animation frame can split their camera snapshots.
    return { scale: cameraMatrix.a, orbitRadius: Number(orbit.getAttribute('rx')), paints }
  })
  expect(finalPaint.scale).toBeCloseTo(expectedFinalScale, 3)
  expect(finalPaint.orbitRadius).toBeGreaterThan(0)
  expect(finalPaint.orbitRadius).toBeCloseTo(probe.initialOrbitRadius * finalPaint.scale / probe.initialScale, 3)
  expect(finalPaint.paints.length).toBeGreaterThan(2)
  for (const paintScale of finalPaint.paints) expect(paintScale).toBeCloseTo(1, 5)

  const finalScenePoint = await camera.evaluate((element, clientPoint) => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The final Warden camera transform must be measurable.')
    const point = new DOMPoint(clientPoint.x, clientPoint.y).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }, probe.pointer)
  expect(finalScenePoint.x).toBeCloseTo(probe.scenePointAtLastWheel.x, 2)
  expect(finalScenePoint.y).toBeCloseTo(probe.scenePointAtLastWheel.y, 2)
})

async function orbitClientPoint(
  page: import('@playwright/test').Page,
  systemId: string,
  map: import('@playwright/test').Locator,
  orbitId: string,
  angle: number,
  offset = 0,
): Promise<{ client: LocalPoint; local: LocalPoint; radius: number }> {
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const axes = await map.evaluate((element, input) => {
    const ellipse = [...element.querySelectorAll<SVGEllipseElement>('.continuous-warden-orbit-target')]
      .find(candidate => candidate.getAttribute('data-orbit-id') === input.orbitId)
    const matrix = ellipse?.getScreenCTM()
    if (!ellipse || !matrix) throw new Error('The continuous map Orbit is not measurable.')

    const cx = Number(ellipse.getAttribute('cx'))
    const cy = Number(ellipse.getAttribute('cy'))
    const radius = Number(ellipse.getAttribute('rx'))
    const screen = (x: number, y: number) => {
      const point = new DOMPoint(x, y).matrixTransform(matrix)
      return { x: point.x, y: point.y }
    }
    return { center: screen(cx, cy), horizontal: screen(cx + radius, cy), vertical: screen(cx, cy + Number(ellipse.getAttribute('ry'))) }
  }, { orbitId })
  const center = coordinates.fromClient(axes.center)
  const horizontal = coordinates.fromClient(axes.horizontal)
  const vertical = coordinates.fromClient(axes.vertical)
  const radius = Math.hypot(horizontal.x - center.x, horizontal.y - center.y)
  const ratio = (radius + offset) / radius
  const local = {
    x: center.x + (horizontal.x - center.x) * ratio * Math.cos(angle) + (vertical.x - center.x) * Math.sin(angle),
    y: center.y + (horizontal.y - center.y) * ratio * Math.cos(angle) + (vertical.y - center.y) * Math.sin(angle),
  }
  return { client: coordinates.toClient(local), local, radius }
}

async function objectLocalPosition(
  object: import('@playwright/test').Locator,
  coordinates: Awaited<ReturnType<typeof wardenLocalCoordinates>>,
): Promise<LocalPoint> {
  const anchor = await object.evaluate(element => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM()
    if (!matrix) throw new Error('The continuous object is not painted.')
    const point = new DOMPoint().matrixTransform(matrix)
    return { x: point.x, y: point.y }
  })
  return coordinates.fromClient(anchor)
}

test('continuous precise Free placement stays exact beside an Orbit and commits to its inspected owner', async ({ page }) => {
  const { map, orbitId, primaryObjectId, systemId, systemName } = await prepareContinuousOrbitMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemBranch = hierarchy.getByRole('treeitem', { name: systemName, exact: true })
  const primaryObject = hierarchy.getByRole('treeitem', { name: /^Select [^,]+, Primary Star\b/ })
  if (await systemBranch.getAttribute('aria-expanded') === 'true') {
    await systemBranch.getByRole('button', { name: `Collapse ${systemName}`, exact: true }).click()
  }
  await expect(systemBranch).toHaveAttribute('aria-expanded', 'false')
  await expect(primaryObject).toBeHidden()
  await systemBranch.getByRole('button', { name: `Expand ${systemName}`, exact: true }).click()
  await expect(primaryObject).toBeVisible()
  await expect(systemBranch).toBeFocused()
  await systemBranch.press('ArrowLeft')
  await expect(primaryObject).toBeHidden()
  await systemBranch.getByRole('button', { name: `Expand ${systemName}`, exact: true }).click()
  await expect(systemBranch).toHaveAttribute('aria-expanded', 'true')
  await expect(primaryObject).toBeVisible()
  await primaryObject.click()
  const object = wardenObjectMark(page, systemId, primaryObjectId)
  await expect(object).toBeVisible()
  const placement = page.getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()

  const ringPoint = await orbitClientPoint(page, systemId, map, orbitId, 0)
  const target = await orbitClientPoint(page, systemId, map, orbitId, 0, 18)
  expect(Math.hypot(target.local.x - ringPoint.local.x, target.local.y - ringPoint.local.y))
    .toBeCloseTo(18, 1)
  const click = { x: Math.round(target.client.x), y: Math.round(target.client.y) }
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const expected = coordinates.fromClient(click)
  await page.mouse.click(click.x, click.y)

  await placement.click()
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  const previewPosition = await objectLocalPosition(object, coordinates)
  expect(previewPosition.x).toBeCloseTo(expected.x, 1)
  expect(previewPosition.y).toBeCloseTo(expected.y, 1)

  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect.poll(async () => (await objectLocalPosition(object, coordinates)).x)
    .toBeCloseTo(expected.x, 1)
  await expect.poll(async () => (await objectLocalPosition(object, coordinates)).y)
    .toBeCloseTo(expected.y, 1)
  await waitForWorkspaceSaved(page)
})

test('continuous Orbit resize rolls back on Escape and accepts the next pointer gesture', async ({ page }) => {
  const { map, orbit, orbitId, systemId } = await prepareContinuousOrbitMap(page)
  const ringHit = await orbit.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit has no ellipse.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The Orbit has no screen transform.')
    const length = element.getTotalLength()
    for (let step = 0; step < 32; step++) {
      const point = element.getPointAtLength(length * step / 32).matrixTransform(transform)
      const x = Math.round(point.x)
      const y = Math.round(point.y)
      if (document.elementFromPoint(x, y) === element) return { x, y }
    }
    throw new Error('No painted Orbit stroke is reachable.')
  })
  await page.mouse.click(ringHit.x, ringHit.y)
  const resize = map.locator(
    `.continuous-warden-orbit-edit-handle[data-system-id="${systemId}"][data-orbit-id="${orbitId}"][data-resize-axis="horizontal"]`,
  )
  await expect(resize).toBeVisible()

  const ring = orbit
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const initialRadius = Number(await ring.getAttribute('rx'))
  const dragHandle = async (distance: number): Promise<void> => {
    const bounds = await resize.boundingBox()
    if (!bounds) throw new Error('The continuous Orbit resize handle has no visible bounds.')
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + distance, point.y, { steps: 3 })
  }

  await dragHandle(32)
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(initialRadius)
  await page.keyboard.press('Escape')
  await expect(ring).toHaveAttribute('rx', String(initialRadius))
  // Keep the canceled contact held past the compatibility-click deadline.
  await page.waitForTimeout(1_200)
  await page.mouse.up()
  await expect(ring).toHaveAttribute('rx', String(initialRadius))
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)

  await dragHandle(32)
  await page.mouse.up()
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(initialRadius)
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.layout.orbitRadii[orbitId]).not.toEqual(before.layout.orbitRadii[orbitId])

  await resize.focus()
  await expect(resize).toBeFocused()
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The continuous map is not visible.')
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2)
  await page.mouse.wheel(0, 1800)
  await expect(resize).toHaveCount(0)
  await expect.poll(async () => {
    const appliedPercentage = await map.locator('.cluster-map-content').evaluate(element => {
      if (!(element instanceof SVGGElement)) throw new Error('The camera group has no SVG transform.')
      return element.transform.baseVal.getItem(1).matrix.a * 20
    })
    const displayedPercentage = parseFloat((await workspaceZoomOutput(page).textContent()) ?? '')
    return Math.abs(displayedPercentage - appliedPercentage)
  }).toBeLessThanOrEqual(0.051)
  await expect.poll(() => map.evaluate(element => {
    const focused = document.activeElement
    return focused === element || (element.contains(focused) && focused?.classList.contains('continuous-warden-name-target'))
  })).toBe(true)
})
