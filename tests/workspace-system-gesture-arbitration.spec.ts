import { expect, test, type Locator, type Page } from './fixtures'
import {
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  exposedContinuousObjectHitPoint,
  quitSystemAdd,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setWorkspaceMapMode,
  wardenLocalCoordinates,
  wardenMap,
  wardenObjectLocalPosition,
  wardenObjectMark,
  wardenOrbitLocalGeometry,
  wardenSystemMark,
  workspaceNavigation,
} from './helpers'

type TouchPoint = { id: number; x: number; y: number }
type WorkspaceRecords = { current: unknown; lastValid: unknown }
type ScreenPoint = { x: number; y: number }
type WorkspaceWriteGate = {
  originalPut?: typeof IDBObjectStore.prototype.put
  failNextCurrentWrite?: boolean
  currentWriteAttempts?: number
}
type WorkspaceWriteGateWindow = Window & { __gestureWriteGate?: WorkspaceWriteGate }
const activeTouchSessions = new WeakSet<Awaited<ReturnType<typeof enableTouch>>>()

async function createWorkspace(page: Page) {
  await captureMapExportBlobs(page)
  const identity = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  await waitForWorkspaceSaved(page)
  return identity
}

async function createHostedOrbit(page: Page): Promise<{
  map: Locator
  ring: Locator
  systemId: string
  primaryObjectId: string
}> {
  const { systemId, primaryObjectId } = await createWorkspace(page)
  await (await dockAction(page, 'Add orbit')).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  const placement = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
    identity: { attribute: 'data-object-id', id: primaryObjectId },
  })
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()
  await quitSystemAdd(page)
  const map = wardenMap(page)
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(ring).toHaveCount(1)
  const { start } = await orbitDragPoints(ring, 1, .5)
  await page.mouse.click(start.x, start.y)
  await closeVisiblePanels(page)
  await centerWorkspaceSelection(page)
  await waitForWorkspaceSaved(page)
  return { map, ring, systemId, primaryObjectId }
}

async function createFreeOrbitWithPassenger(page: Page): Promise<{
  map: Locator
  ring: Locator
  centerHandle: Locator
  passenger: Locator
  systemId: string
  primaryObjectId: string
}> {
  const { systemId, primaryObjectId } = await createWorkspace(page)
  await (await dockAction(page, 'Add orbit')).click()
  await clickWardenSystemPoint(page, systemId, { x: .2, y: .3 })
  await quitSystemAdd(page)
  const map = wardenMap(page)
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(ring).toHaveCount(1)
  const passenger = await addPlanetOnOrbit(page, systemId, ring, Math.PI / 2)
  await expect(passenger).toBeVisible()
  // Inverting the painted viewport geometry should recover the local Orbit radius within subpixel rounding.
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical).toBeCloseTo(112, 2)
  const { start } = await orbitDragPoints(ring, 1, .5)
  await page.mouse.click(start.x, start.y)
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('16')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('60')
  await page.getByRole('button', { name: /^Apply changes\b/ }).click()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal).toBeCloseTo(16, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical).toBeCloseTo(60, 2)
  await closeVisiblePanels(page)
  await wardenSystemMark(page, systemId).focus()
  await page.keyboard.press('Enter')
  await closeVisiblePanels(page)
  await centerWorkspaceSelection(page)
  await waitForWorkspaceSaved(page)
  return {
    map, ring, systemId, primaryObjectId, passenger,
    centerHandle: map.locator(`.continuous-warden-orbit-center-handle[data-system-id="${systemId}"]`),
  }
}

async function addPlanetOnOrbit(page: Page, systemId: string, ring: Locator, angle = 0): Promise<Locator> {
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const { start } = await orbitDragPoints(ring, 1, angle)
  await page.mouse.click(start.x, start.y)
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const exported = await downloadJson(page, 'Export star system JSON')
  const planet = exported.system?.objects.find(object => object.subtype === 'planet')
  if (!planet) throw new Error('The Orbit Add did not create its passenger.')
  return wardenObjectMark(page, systemId, planet.id)
}

async function closeVisiblePanels(page: Page): Promise<void> {
  const hierarchy = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchy.count() && await hierarchy.getAttribute('aria-expanded') === 'true') {
    await hierarchy.click()
  }
  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspect.count() && await inspect.getAttribute('aria-expanded') === 'true') {
    await inspect.click()
  }
}

async function exportSystemJson(page: Page) {
  await closeVisiblePanels(page)
  return downloadJson(page, 'Export star system JSON')
}

async function enableTouch(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  return cdp
}

async function dispatchTouch(
  cdp: Awaited<ReturnType<typeof enableTouch>>,
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  points: TouchPoint[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(point => ({
      ...point,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    })),
  })
  if (type === 'touchStart') activeTouchSessions.add(cdp)
  else if (type === 'touchEnd' || type === 'touchCancel') activeTouchSessions.delete(cdp)
}

async function pointAtCenter(locator: Locator): Promise<TouchPoint> {
  const point = await locator.evaluate((element) => {
    if (!(element instanceof SVGCircleElement)) throw new Error('The touch handle is not a circle.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The touch handle is not attached to the map.')
    for (const fraction of [0, .5, .85]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8
        const point = new DOMPoint(
          element.cx.baseVal.value + Math.cos(angle) * element.r.baseVal.value * fraction,
          element.cy.baseVal.value + Math.sin(angle) * element.r.baseVal.value * fraction,
        ).matrixTransform(matrix)
        if (document.elementFromPoint(point.x, point.y) === element) return { x: point.x, y: point.y }
      }
    }
    throw new Error('The touch handle has no unobstructed hit in the visible viewport.')
  })
  return { id: 1, ...point }
}

async function orbitDragPoints(
  orbitTarget: Locator,
  scale: number,
  angle: number,
): Promise<{ start: ScreenPoint; end: ScreenPoint }> {
  return orbitTarget.evaluate((element, target) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit input target is not an ellipse.')
    const ellipse = element
    const systemId = ellipse.getAttribute('data-system-id')
    const orbitId = ellipse.getAttribute('data-orbit-id')
    if (!systemId || !orbitId) throw new Error('The Orbit input target has no owner-qualified identity.')
    const transform = ellipse.getScreenCTM()
    if (!transform) throw new Error('The Orbit hit target is not attached to the map.')
    const cx = Number(ellipse.getAttribute('cx'))
    const cy = Number(ellipse.getAttribute('cy'))
    const rx = Number(ellipse.getAttribute('rx'))
    const ry = Number(ellipse.getAttribute('ry'))
    const map = element.closest('svg')
    const screenRadius = Math.max(
      Math.hypot(transform.a * rx, transform.b * rx),
      Math.hypot(transform.c * ry, transform.d * ry),
    )
    // Sample at most half a CSS pixel apart, preferring the requested angle over distant paint.
    // Native hits must land on the dashed ring itself; axis handles would change the drag's meaning.
    const sampleCount = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    const inverse = transform.inverse()
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const offset = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / sampleCount
      const point = new DOMPoint(cx + rx * Math.cos(target.angle + offset), cy + ry * Math.sin(target.angle + offset))
        .matrixTransform(transform)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const start = { x: Math.round(point.x) + dx, y: Math.round(point.y) + dy }
          if (document.elementFromPoint(start.x, start.y) !== ellipse) continue
          const localStart = new DOMPoint(start.x, start.y).matrixTransform(inverse)
          const destination = new DOMPoint(
            cx + (localStart.x - cx) * target.scale,
            cy + (localStart.y - cy) * target.scale,
          ).matrixTransform(transform)
          const end = { x: Math.round(destination.x), y: Math.round(destination.y) }
          const reachable = Array.from({ length: 7 }, (_, step) => {
            const x = start.x + (end.x - start.x) * step / 6
            const y = start.y + (end.y - start.y) * step / 6
            return map?.contains(document.elementFromPoint(x, y))
          }).every(Boolean)
          if (reachable) return { start, end }
        }
      }
    }
    throw new Error(`Orbit ${orbitId} in system ${systemId} has no frontmost painted ring hit with an unobstructed native drag path.`)
  }, { scale, angle })
}

async function orbitOffStrokeDragPoints(
  orbitTarget: Locator,
  angle: number,
  offsetPixels: number,
  dragPixels: number,
): Promise<{ start: ScreenPoint; end: ScreenPoint; hitClass: string; hitOrbitId: string | null }> {
  const painted = await orbitDragPoints(orbitTarget, 1, angle)
  return orbitTarget.evaluate((element, input) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit input target is not an ellipse.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The Orbit hit target is not attached to the map.')
    const cx = element.cx.baseVal.value
    const cy = element.cy.baseVal.value
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const localStart = new DOMPoint(input.start.x, input.start.y).matrixTransform(matrix.inverse())
    const angleOnEllipse = Math.atan2((localStart.y - cy) / ry, (localStart.x - cx) / rx)
    const tangentLocal = {
      x: -rx * Math.sin(angleOnEllipse),
      y: ry * Math.cos(angleOnEllipse),
    }
    const tangent = {
      x: matrix.a * tangentLocal.x + matrix.c * tangentLocal.y,
      y: matrix.b * tangentLocal.x + matrix.d * tangentLocal.y,
    }
    const tangentLength = Math.hypot(tangent.x, tangent.y)
    if (!Number.isFinite(tangentLength) || tangentLength === 0) {
      throw new Error('The Orbit ring has no measurable screen-space tangent.')
    }
    let normal = { x: tangent.y / tangentLength, y: -tangent.x / tangentLength }
    const center = new DOMPoint(cx, cy).matrixTransform(matrix)
    const radial = { x: input.start.x - center.x, y: input.start.y - center.y }
    if (normal.x * radial.x + normal.y * radial.y < 0) normal = { x: -normal.x, y: -normal.y }
    const start = {
      x: Math.round(input.start.x + normal.x * input.offsetPixels),
      y: Math.round(input.start.y + normal.y * input.offsetPixels),
    }
    const end = {
      x: Math.round(start.x + normal.x * input.dragPixels),
      y: Math.round(start.y + normal.y * input.dragPixels),
    }
    const hit = document.elementFromPoint(start.x, start.y)
    return {
      start,
      end,
      hitClass: hit?.getAttribute('class') ?? '',
      hitOrbitId: hit?.closest('[data-orbit-id]')?.getAttribute('data-orbit-id') ?? null,
    }
  }, { start: painted.start, offsetPixels, dragPixels })
}

async function readWorkspaceRecords(page: Page): Promise<WorkspaceRecords> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })
    try {
      const transaction = database.transaction('workspace', 'readonly')
      const store = transaction.objectStore('workspace')
      const read = (key: string) => new Promise<unknown>((resolve, reject) => {
        const record = store.get(key)
        record.onsuccess = () => resolve(record.result)
        record.onerror = () => reject(record.error ?? new Error('Could not read a workspace record.'))
      })
      const [current, lastValid] = await Promise.all([read('current'), read('last-valid')])
      return { current, lastValid }
    } finally {
      database.close()
    }
  })
}

async function installOneCurrentWriteFailure(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gateWindow = window as WorkspaceWriteGateWindow
    const originalPut = IDBObjectStore.prototype.put
    const gate: WorkspaceWriteGate = {
      originalPut,
      failNextCurrentWrite: true,
      currentWriteAttempts: 0,
    }
    gateWindow.__gestureWriteGate = gate
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = originalPut.call(this, value, key)
      const isCurrentWorkspaceWrite = this.transaction.db.name === 'ttrpg-cluster-control'
        && this.name === 'workspace'
        && key === 'current'
      if (isCurrentWorkspaceWrite) {
        gate.currentWriteAttempts = (gate.currentWriteAttempts ?? 0) + 1
        if (gate.failNextCurrentWrite) {
          gate.failNextCurrentWrite = false
          this.transaction.abort()
        }
      }
      return request
    }
  })
}

async function currentWriteAttempts(page: Page): Promise<number> {
  return page.evaluate(() => (window as WorkspaceWriteGateWindow).__gestureWriteGate?.currentWriteAttempts ?? -1)
}

async function restoreWorkspaceWrite(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gateWindow = window as WorkspaceWriteGateWindow
    const gate = gateWindow.__gestureWriteGate
    if (gate?.originalPut) IDBObjectStore.prototype.put = gate.originalPut
    delete gateWindow.__gestureWriteGate
  })
}

async function expectWorkspaceMode(page: Page, mode: 'Navigate' | 'Select' | 'Move'): Promise<void> {
  await expect(workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true')
}

async function visibleMapBackgroundPair(map: Locator): Promise<[ScreenPoint, ScreenPoint]> {
  return map.evaluate((element) => {
    const svg = element instanceof SVGSVGElement ? element : element.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) throw new Error('The Warden map SVG is not available.')
    const bounds = svg.getBoundingClientRect()
    const isBackground = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y)
      return !!hit && (hit === svg || svg.contains(hit))
        && !(hit instanceof Element && hit.closest('[role="button"], [role="slider"], [data-map-obstruction]'))
    }
    for (let y = Math.max(12, Math.ceil(bounds.top + 24)); y < Math.min(window.innerHeight, bounds.bottom) - 24; y += 12) {
      for (let x = Math.max(12, Math.ceil(bounds.left + 24)); x + 56 < Math.min(window.innerWidth, bounds.right) - 24; x += 12) {
        if (isBackground(x, y) && isBackground(x + 56, y)) {
          return [{ x, y }, { x: x + 56, y }]
        }
      }
    }
    throw new Error('Could not find two unobstructed Warden background points.')
  })
}

async function cameraOnlyRightPanAndSecondTouch(
  page: Page,
  map: Locator,
  cdp: Awaited<ReturnType<typeof enableTouch>>,
): Promise<void> {
  const scene = map.locator('.cluster-map-content')
  const transformBefore = await scene.getAttribute('transform')
  if (transformBefore === null) throw new Error('The Warden map has no view transform.')
  const [panStart] = await visibleMapBackgroundPair(map)
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(panStart.x + 32, panStart.y + 20, { steps: 3 })
  await page.mouse.up({ button: 'right' })
  const transformAfterPan = await scene.getAttribute('transform')
  expect(transformAfterPan).not.toBe(transformBefore)

  const [first, second] = await visibleMapBackgroundPair(map)
  const firstTouch = { id: 1, x: first.x, y: first.y }
  const secondTouch = { id: 2, x: second.x, y: second.y }
  await dispatchTouch(cdp, 'touchStart', [firstTouch])
  await dispatchTouch(cdp, 'touchStart', [firstTouch, secondTouch])
  await dispatchTouch(cdp, 'touchMove', [
    { ...firstTouch, x: firstTouch.x - 8, y: firstTouch.y + 12 },
    { ...secondTouch, x: secondTouch.x + 8, y: secondTouch.y + 12 },
  ])
  await dispatchTouch(cdp, 'touchEnd', [])
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(transformAfterPan)
}

test('near-ring Warden Orbit targets select and resize from off-stroke pointer hits', async ({ page }) => {
  const { map, ring, systemId, primaryObjectId } = await createHostedOrbit(page)
  await setWorkspaceMapMode(page, 'Select')
  await expect(map.getByRole('button', { name: 'Select Orbit 1', exact: true })).toHaveCount(1)
  const orbitId = await ring.getAttribute('data-orbit-id')
  if (!orbitId) throw new Error('The hosted Orbit has no identity.')

  await wardenObjectMark(page, systemId, primaryObjectId).press('Enter')
  await expect(page.getByRole('button', { name: 'Edit map object', exact: true })).toBeVisible()
  const nearRingClick = await orbitOffStrokeDragPoints(ring, .65, 8, 36)
  await page.mouse.click(nearRingClick.start.x, nearRingClick.start.y)
  await expect(page.getByRole('button', { name: 'Edit Orbit', exact: true })).toBeVisible()
  expect(nearRingClick.hitClass.split(/\s+/)).toContain('continuous-warden-orbit-hit-target')
  expect(nearRingClick.hitOrbitId).toBe(orbitId)

  await setWorkspaceMapMode(page, 'Move')
  const before = await wardenOrbitLocalGeometry(ring, systemId)
  const nearRingDrag = await orbitOffStrokeDragPoints(ring, .65, 8, 36)
  await page.mouse.move(nearRingDrag.start.x, nearRingDrag.start.y)
  await page.mouse.down()
  try {
    await page.mouse.move(nearRingDrag.end.x, nearRingDrag.end.y, { steps: 5 })
    await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
      .toBeGreaterThan(before.radii.horizontal + 5)
  } finally {
    await page.mouse.up()
  }
  await waitForWorkspaceSaved(page)
  const after = await wardenOrbitLocalGeometry(ring, systemId)
  expect(after.radii.horizontal).toBeGreaterThan(before.radii.horizontal + 5)
  expect(after.radii.vertical).toBeGreaterThan(before.radii.vertical + 5)
  expect(nearRingDrag.hitClass.split(/\s+/)).toContain('continuous-warden-orbit-hit-target')
  expect(nearRingDrag.hitOrbitId).toBe(orbitId)
})

test('Escape restores an Orbit ring drag before its late mouse release', async ({ page }) => {
  const { ring } = await createHostedOrbit(page)
  await setWorkspaceMapMode(page, 'Move')
  await expect(ring).toHaveAttribute('role', 'button')

  const before = await exportSystemJson(page)
  const system = before.system
  if (!system) throw new Error('The exported file does not contain a star system.')
  const orbitId = system.orbits[0]?.id
  if (!orbitId) throw new Error('The exported star system does not contain an Orbit.')
  const radiusXBefore = Number(await ring.getAttribute('rx'))
  const radiusYBefore = Number(await ring.getAttribute('ry'))
  const recordsBefore = await readWorkspaceRecords(page)
  const points = await orbitDragPoints(ring, 1.3, 0.5)

  await page.mouse.move(points.start.x, points.start.y)
  await page.mouse.down()
  await page.mouse.move(points.end.x, points.end.y, { steps: 6 })
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(radiusXBefore)
  await expect.poll(async () => Number(await ring.getAttribute('ry')))
    .toBeGreaterThan(radiusYBefore)

  await page.keyboard.press('Escape')
  await expect(ring).toHaveAttribute('rx', String(radiusXBefore))
  await expect(ring).toHaveAttribute('ry', String(radiusYBefore))
  // Release after the old click-suppression window so cancellation must survive the late pointerup.
  await page.waitForTimeout(1700)
  await page.mouse.up()

  expect(await exportSystemJson(page)).toEqual(before)
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)

  const freshPoints = await orbitDragPoints(ring, 1.3, 0.5)
  await page.mouse.move(freshPoints.start.x, freshPoints.start.y)
  await page.mouse.down()
  await page.mouse.move(freshPoints.end.x, freshPoints.end.y, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(radiusXBefore)
  await expect.poll(async () => Number(await ring.getAttribute('ry')))
    .toBeGreaterThan(radiusYBefore)
  await waitForWorkspaceSaved(page)
  const afterFreshDrag = await exportSystemJson(page)
  expect(afterFreshDrag.layout.orbitRadii[orbitId])
    .not.toEqual(before.layout.orbitRadii[orbitId])
})





test('touchcancel restores an unoccupied Orbit center and failed host attachment can be retried', async ({ page }) => {
  test.setTimeout(60_000)
  const cdp = await enableTouch(page)
  try {
    const { map, ring, centerHandle, passenger, systemId, primaryObjectId } = await createFreeOrbitWithPassenger(page)
    await setWorkspaceMapMode(page, 'Move')
    const beforeCancel = await exportSystemJson(page)
    const recordsBeforeCancel = await readWorkspaceRecords(page)
    const centerXBefore = await ring.getAttribute('cx')
    const centerYBefore = await ring.getAttribute('cy')
    const passengerBefore = await passenger.getAttribute('transform')
    const start = await pointAtCenter(centerHandle)
    await dispatchTouch(cdp, 'touchStart', [start])
    await dispatchTouch(cdp, 'touchMove', [{ ...start, x: start.x + 28, y: start.y + 20 }])
    await expect(ring).not.toHaveAttribute('cx', centerXBefore!)
    await expect(passenger).not.toHaveAttribute('transform', passengerBefore!)
    await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical).toBeCloseTo(60, 2)
    await dispatchTouch(cdp, 'touchCancel', [])
    await expect(ring).toHaveAttribute('cx', centerXBefore!)
    await expect(ring).toHaveAttribute('cy', centerYBefore!)
    await expect(passenger).toHaveAttribute('transform', passengerBefore!)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBeforeCancel)
    expect(await exportSystemJson(page)).toEqual(beforeCancel)

    const beforeMove = await exportSystemJson(page)
    const systemBeforeMove = beforeMove.system
    if (!systemBeforeMove) throw new Error('The exported file does not contain a star system.')
    const originalOrbitId = await ring.getAttribute('data-orbit-id')
    if (!originalOrbitId) throw new Error('The selected free Orbit has no identity.')
    const originalOrbit = systemBeforeMove.orbits.find(candidate => candidate.id === originalOrbitId)
    if (!originalOrbit) throw new Error('The selected free Orbit is missing from the exported system.')
    expect(systemBeforeMove.orbits).toHaveLength(1)
    expect(beforeMove.layout.orbitRadii[originalOrbit.id]).toEqual({ horizontal: 16, vertical: 60 })
    const primaryStar = systemBeforeMove.objects.find(object => object.name === 'Primary Star')
    if (!primaryStar) throw new Error('The exported system has no Primary Star.')
    const host = wardenObjectMark(page, systemId, primaryObjectId)
    const hostPoint = await wardenObjectLocalPosition(host)
    const recordsBeforeWrite = await readWorkspaceRecords(page)
    const coordinates = await wardenLocalCoordinates(page, systemId)
    const retryDestination = coordinates.toClient(hostPoint)
    expect(await map.evaluate((element, point) =>
      element.contains(document.elementFromPoint(point.x, point.y)), retryDestination)).toBe(true)
    await installOneCurrentWriteFailure(page)
    let appliedMemory: Awaited<ReturnType<typeof exportSystemJson>> | undefined
    try {
      const retryStart = await pointAtCenter(centerHandle)
      await dispatchTouch(cdp, 'touchStart', [retryStart])
      await dispatchTouch(cdp, 'touchMove', [{
        ...retryStart,
        x: retryDestination.x,
        y: retryDestination.y,
      }])
      // Detail SVG attributes are viewport-projected; compare in owner-local map units.
      await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
        .toBeCloseTo(hostPoint.x, 2)
      await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal).toBeCloseTo(39, 2)
      await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical).toBeCloseTo(60, 2)
      await dispatchTouch(cdp, 'touchEnd', [])

      const hostedRing = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${originalOrbitId}"]`)
      await expect.poll(async () => (await wardenOrbitLocalGeometry(hostedRing, systemId)).radii.horizontal).toBeCloseTo(39, 2)
      await expect.poll(async () => (await wardenOrbitLocalGeometry(hostedRing, systemId)).radii.vertical).toBeCloseTo(60, 2)
      await expect(activeWorkspaceFeedback(page).getByRole('alert')).toContainText('Not saved.')
      const radiusToast = page.getByText('Orbit radii adjusted', { exact: true })
      await expect(radiusToast).toBeVisible()
      await expect(page.getByText('Orbit radii increased to the new host minimum of 39.', { exact: true })).toBeVisible()
      expect(await currentWriteAttempts(page)).toBe(1)
      expect(await readWorkspaceRecords(page)).toEqual(recordsBeforeWrite)

      appliedMemory = await exportSystemJson(page)
      expect(appliedMemory.system?.orbits).toHaveLength(systemBeforeMove.orbits.length)
      const attachedOrbit = appliedMemory.system?.orbits.find(candidate => candidate.id === originalOrbit.id)
      expect(attachedOrbit?.hostId).toBe(primaryStar.id)
      expect(appliedMemory.layout.orbitRadii[originalOrbit.id]).toEqual({ horizontal: 39, vertical: 60 })
      expect(appliedMemory.layout.orbitRotations?.[originalOrbit.id])
        .toBe(beforeMove.layout.orbitRotations?.[originalOrbit.id])

      await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
      await waitForWorkspaceSaved(page)
      expect(await currentWriteAttempts(page)).toBe(2)
    } finally {
      await restoreWorkspaceWrite(page)
    }

    const recordsAfterRetry = await readWorkspaceRecords(page)
    expect(recordsAfterRetry).not.toEqual(recordsBeforeWrite)
    await page.reload()
    await expect(wardenMap(page)).toBeVisible()
    await wardenSystemMark(page, systemId).focus()
    await page.keyboard.press('Enter')
    const afterReload = await exportSystemJson(page)
    if (!appliedMemory) throw new Error('The failed save did not preserve applied memory for reload verification.')
    expect(afterReload).toEqual(appliedMemory)
    expect(afterReload.system?.orbits).toHaveLength(systemBeforeMove.orbits.length)
  } finally {
    if (activeTouchSessions.has(cdp)) await dispatchTouch(cdp, 'touchCancel', [])
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }
})



test('blur restores an attached host drag and Move camera takeover changes only the view', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, ring, systemId, primaryObjectId } = await createHostedOrbit(page)
    const passenger = await addPlanetOnOrbit(page, systemId, ring)
    await closeVisiblePanels(page)
    await setWorkspaceMapMode(page, 'Move')
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    const host = wardenObjectMark(page, systemId, primaryObjectId)
    const hostTransformBefore = await host.getAttribute('transform')
    const ringCenterBefore = await ring.getAttribute('cx')
    const passengerTransformBefore = await passenger.getAttribute('transform')
    const position = await wardenObjectLocalPosition(host)
    const coordinates = await wardenLocalCoordinates(page, systemId)
    const hostClient = coordinates.toClient(position)
    const destinationClient = { x: hostClient.x + 64, y: hostClient.y + 40 }
    expect(await map.evaluate((element, point) =>
      element.contains(document.elementFromPoint(point.x, point.y)), destinationClient)).toBe(true)
    const start = await exposedContinuousObjectHitPoint(host)
    if (!start) throw new Error('The attached host has no exposed pointer hit.')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(destinationClient.x, destinationClient.y, { steps: 6 })
    await expect(host).toHaveClass(/is-move-preview/)
    await expect(host).not.toHaveAttribute('transform', hostTransformBefore!)
    await expect(ring).not.toHaveAttribute('cx', ringCenterBefore!)
    await expect(passenger).not.toHaveAttribute('transform', passengerTransformBefore!)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(host).toHaveAttribute('transform', hostTransformBefore!)
    await expect(ring).toHaveAttribute('cx', ringCenterBefore!)
    await expect(passenger).toHaveAttribute('transform', passengerTransformBefore!)
    await page.mouse.up()
    await expect(host).toHaveAttribute('transform', hostTransformBefore!)
    await expect(ring).toHaveAttribute('cx', ringCenterBefore!)
    await expect(passenger).toHaveAttribute('transform', passengerTransformBefore!)
    await expect(host).not.toHaveClass(/is-move-preview/)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await page.mouse.up()
    if (activeTouchSessions.has(cdp)) await dispatchTouch(cdp, 'touchCancel', [])
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }
})
