import { expect, test, type Locator, type Page } from './fixtures'
import {
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  addCatalogueObject,
  beginDragToWorldPoint,
  captureMapExportBlobs,
  clickDockAction,
  dockAction,
  dragToWorldPoint,
  downloadJson,
  ensureMapDragPointsReachable,
  openWorkspaceHierarchy,
  selectCatalogueObjectButton,
  setWorkspaceMapMode,
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

async function createWorkspace(page: Page): Promise<void> {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
}

async function createHostedOrbit(page: Page): Promise<{
  map: Locator
  orbit: Locator
  ring: Locator
  orbitTarget: Locator
}> {
  await createWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star', exact: true })
  await expect(orbit).toBeVisible()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await closeVisiblePanels(page)
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  return {
    map,
    orbit,
    ring: orbit.locator('.orbit-ring'),
    orbitTarget: orbit.locator('.orbit-hit-target'),
  }
}

async function createFreeOrbitWithPassenger(page: Page): Promise<{
  map: Locator
  orbit: Locator
  ring: Locator
  centerHandle: Locator
  passenger: Locator
}> {
  await createWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await clickDockAction(page, 'Add orbit', { target: { kind: 'center', x: 0.2, y: 0.3 } })
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const orbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center', exact: true })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around unoccupied center', angleDegrees: 90 },
  })
  const passenger = map.getByRole('button', { name: /New planet 1/ })
  await expect(passenger).toBeVisible()
  const ring = orbit.locator('.orbit-ring')
  await expect(ring).toHaveAttribute('ry', '112')
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('16')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('60')
  await page.getByRole('button', { name: /^Apply changes\b/ }).click()
  await expect(ring).toHaveAttribute('rx', '16')
  await expect(ring).toHaveAttribute('ry', '60')
  await closeVisiblePanels(page)
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  return { map, orbit, ring, centerHandle: orbit.locator('.orbit-center-handle'), passenger }
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
}

async function pointAtCenter(locator: Locator): Promise<TouchPoint> {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('The touch target has no visible bounds.')
  return { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

async function orbitDragPoints(
  orbitTarget: Locator,
  scale: number,
  angle: number,
): Promise<{ start: ScreenPoint; end: ScreenPoint }> {
  return orbitTarget.evaluate((element, target) => {
    const ellipse = element as SVGEllipseElement
    const transform = ellipse.getScreenCTM()
    if (!transform) throw new Error('The Orbit hit target is not attached to the map.')
    const cx = Number(ellipse.getAttribute('cx'))
    const cy = Number(ellipse.getAttribute('cy'))
    const rx = Number(ellipse.getAttribute('rx'))
    const ry = Number(ellipse.getAttribute('ry'))
    const screenPoint = (factor: number) => new DOMPoint(
      cx + rx * factor * Math.cos(target.angle),
      cy + ry * factor * Math.sin(target.angle),
    ).matrixTransform(transform)
    const start = screenPoint(1)
    const end = screenPoint(target.scale)
    return {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    }
  }, { scale, angle })
}

async function readWorkspaceRecords(page: Page): Promise<WorkspaceRecords> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
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

async function expectAddMode(page: Page, label: RegExp): Promise<void> {
  const navigation = workspaceNavigation(page)
  await expect(navigation.getByRole('button', { name: 'Add to map', exact: true })).toContainText(label)
  await expect(navigation.getByRole('button', { name: 'Add to map', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const mode of ['Navigate', 'Select', 'Move']) {
    await expect(navigation.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'false')
  }
  await expect(page.getByRole('button', {
    name: 'Quit Add and return to Select',
    exact: true,
  })).toBeVisible()
}

async function expectInactiveAdd(page: Page): Promise<void> {
  const add = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  await expect(add).toHaveAttribute('aria-pressed', 'false')
  await expect(add).toHaveAttribute('aria-expanded', 'false')
  await expect(add).toHaveAccessibleName('Add to map')
  await expect(add.getByText('Add', { exact: true })).toBeVisible()
  await expect(add.locator('kbd')).toHaveText('A')
  await expect(add.locator('#workspace-dock-add-type')).toHaveCount(0)
}

async function visibleMapBackgroundPair(map: Locator): Promise<[ScreenPoint, ScreenPoint]> {
  return map.evaluate((element) => {
    const svg = element instanceof SVGSVGElement ? element : element.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) throw new Error('The system map SVG is not available.')
    const bounds = svg.getBoundingClientRect()
    const isBackground = (x: number, y: number): boolean => {
      const hit = document.elementFromPoint(x, y)
      return hit === svg || (hit instanceof Element && hit.matches('.map-background, .map-grid'))
    }
    for (let y = Math.max(12, Math.ceil(bounds.top + 24)); y < Math.min(window.innerHeight, bounds.bottom) - 24; y += 12) {
      for (let x = Math.max(12, Math.ceil(bounds.left + 24)); x + 56 < Math.min(window.innerWidth, bounds.right) - 24; x += 12) {
        if (isBackground(x, y) && isBackground(x + 56, y)) {
          return [{ x, y }, { x: x + 56, y }]
        }
      }
    }
    throw new Error('Could not find two unobstructed system-map background points.')
  })
}

async function cameraOnlyRightPanAndSecondTouch(
  page: Page,
  map: Locator,
  cdp: Awaited<ReturnType<typeof enableTouch>>,
): Promise<void> {
  const scene = map.locator('.system-map-content')
  const transformBefore = await scene.getAttribute('transform')
  if (transformBefore === null) throw new Error('The system map has no view transform.')
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

test('Escape restores an Orbit ring drag before its late mouse release', async ({ page }) => {
  await createWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star', exact: true })
  const ring = orbit.locator('.orbit-ring')
  const orbitTarget = orbit.locator('.orbit-hit-target')
  await expect(orbit).toBeVisible()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await closeVisiblePanels(page)
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')
  await expect(orbitTarget).toHaveAttribute('role', 'slider')

  const before = await exportSystemJson(page)
  const system = before.system
  if (!system) throw new Error('The exported file does not contain a star system.')
  const orbitId = system.orbits[0]?.id
  if (!orbitId) throw new Error('The exported star system does not contain an Orbit.')
  const radiusXBefore = Number(await ring.getAttribute('rx'))
  const radiusYBefore = Number(await ring.getAttribute('ry'))
  const points = await orbitDragPoints(orbitTarget, 1.3, 0.5)

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
  await page.waitForTimeout(1700)
  await page.mouse.up()

  expect(await exportSystemJson(page)).toEqual(before)

  const freshPoints = await orbitDragPoints(orbitTarget, 1.3, 0.5)
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

test('a second contact cancels a horizontal Orbit resize before pinch pans the camera', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, orbit, ring } = await createHostedOrbit(page)
    await setWorkspaceMapMode(page, 'Move')
    const before = await exportSystemJson(page)
    const orbitId = before.system?.orbits[0]?.id
    if (!orbitId) throw new Error('The exported system does not contain an Orbit.')
    const recordsBefore = await readWorkspaceRecords(page)
    const scene = map.locator('.system-map-content')
    const viewBefore = await scene.getAttribute('transform')
    const horizontal = orbit.locator('.orbit-axis-handle--horizontal')
    await expect(horizontal).toBeVisible()
    const horizontalBefore = Number(await ring.getAttribute('rx'))
    const verticalBefore = Number(await ring.getAttribute('ry'))
    const bounds = await horizontal.boundingBox()
    if (!bounds) throw new Error('The horizontal Orbit handle has no visible bounds.')
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 42, bounds.y + bounds.height / 2 + 18, { steps: 4 })
    await expect(horizontal).toHaveClass(/is-resizing/)
    await expect.poll(async () => Number(await ring.getAttribute('rx'))).not.toBe(horizontalBefore)

    const [firstPoint, secondPoint] = await visibleMapBackgroundPair(map)
    const first = { id: 1, ...firstPoint }
    const second = { id: 2, ...secondPoint }
    await dispatchTouch(cdp, 'touchStart', [first])
    await dispatchTouch(cdp, 'touchStart', [first, second])
    await dispatchTouch(cdp, 'touchMove', [
      { ...first, x: first.x - 10, y: first.y + 12 },
      { ...second, x: second.x + 10, y: second.y + 12 },
    ])
    await dispatchTouch(cdp, 'touchEnd', [])
    await page.mouse.up()
    await expect(ring).toHaveAttribute('rx', String(horizontalBefore))
    await expect(ring).toHaveAttribute('ry', String(verticalBefore))
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewBefore)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    const centerX = Number(await ring.getAttribute('cx'))
    const centerY = Number(await ring.getAttribute('cy'))
    const committedHorizontal = horizontalBefore + 24
    await dragToWorldPoint(page, map, horizontal, { x: centerX + committedHorizontal, y: centerY })
    await expect(ring).toHaveAttribute('rx', String(committedHorizontal))
    await expect(ring).toHaveAttribute('ry', String(verticalBefore))
    await waitForWorkspaceSaved(page)
    const afterFreshResize = await exportSystemJson(page)
    expect(afterFreshResize.layout.orbitRadii[orbitId])
      .toEqual({ horizontal: committedHorizontal, vertical: verticalBefore })
    expect(await readWorkspaceRecords(page)).not.toEqual(recordsBefore)
  } finally {
    await cdp.detach()
  }
})

test('a native right-pan cancels a vertical Orbit resize while keeping Move active', async ({ page }) => {
  const { map, orbit, ring } = await createHostedOrbit(page)
  await setWorkspaceMapMode(page, 'Move')
  const before = await exportSystemJson(page)
  const orbitId = before.system?.orbits[0]?.id
  if (!orbitId) throw new Error('The exported system does not contain an Orbit.')
  const recordsBefore = await readWorkspaceRecords(page)
  const scene = map.locator('.system-map-content')
  const viewBefore = await scene.getAttribute('transform')
  const vertical = orbit.locator('.orbit-axis-handle--vertical')
  await expect(vertical).toBeVisible()
  const radiusBefore = Number(await ring.getAttribute('ry'))
  const horizontalBefore = Number(await ring.getAttribute('rx'))
  const bounds = await vertical.boundingBox()
  if (!bounds) throw new Error('The vertical Orbit handle has no visible bounds.')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2 + 42, { steps: 4 })
  await expect(vertical).toHaveClass(/is-resizing/)
  await expect.poll(async () => Number(await ring.getAttribute('ry'))).not.toBe(radiusBefore)

  const [panStart] = await visibleMapBackgroundPair(map)
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(panStart.x + 40, panStart.y + 24, { steps: 3 })
  await page.mouse.up({ button: 'right' })
  await page.mouse.up()
  await expect(vertical).not.toHaveClass(/is-resizing/)
  await expect(ring).toHaveAttribute('ry', String(radiusBefore))
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewBefore)
  await expectWorkspaceMode(page, 'Move')
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
  expect(await exportSystemJson(page)).toEqual(before)

  const centerX = Number(await ring.getAttribute('cx'))
  const centerY = Number(await ring.getAttribute('cy'))
  const committedVertical = radiusBefore + 24
  await dragToWorldPoint(page, map, vertical, { x: centerX, y: centerY - committedVertical })
  await expect(ring).toHaveAttribute('ry', String(committedVertical))
  await expect(ring).toHaveAttribute('rx', String(horizontalBefore))
  await waitForWorkspaceSaved(page)
  const afterFreshResize = await exportSystemJson(page)
  expect(afterFreshResize.layout.orbitRadii[orbitId])
    .toEqual({ horizontal: horizontalBefore, vertical: committedVertical })
  expect(await readWorkspaceRecords(page)).not.toEqual(recordsBefore)
})

test('keyboard Select cancels a held Orbit rotation preview', async ({ page }) => {
  const { map, orbit, ring } = await createHostedOrbit(page)
  await setWorkspaceMapMode(page, 'Move')
  const before = await exportSystemJson(page)
  const orbitId = before.system?.orbits[0]?.id
  if (!orbitId) throw new Error('The exported system does not contain an Orbit.')
  const recordsBefore = await readWorkspaceRecords(page)
  const rotation = orbit.locator('.orbit-rotation-handle')
  await expect(rotation).toBeVisible()
  const rotationBefore = await ring.getAttribute('transform')
  const bounds = await rotation.boundingBox()
  if (!bounds) throw new Error('The Orbit rotation handle has no visible bounds.')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 36, bounds.y + bounds.height / 2 + 36, { steps: 4 })
  await expect(rotation).toHaveClass(/is-rotating/)
  await expect(ring).not.toHaveAttribute('transform', rotationBefore!)
  await workspaceNavigation(page).getByRole('button', { name: 'Select', exact: true }).press('Enter')
  await page.mouse.up()
  await expect(ring).toHaveAttribute('transform', rotationBefore!)
  await expect(rotation).not.toHaveClass(/is-rotating/)
  await expectWorkspaceMode(page, 'Select')
  expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
  expect(await exportSystemJson(page)).toEqual(before)

  await setWorkspaceMapMode(page, 'Move')
  const center = { x: Number(await ring.getAttribute('cx')), y: Number(await ring.getAttribute('cy')) }
  const handlePoint = await rotation.evaluate(element => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
  const turn = Math.PI / 6
  const offset = { x: handlePoint.x - center.x, y: handlePoint.y - center.y }
  const rotationTarget = {
    x: center.x + offset.x * Math.cos(turn) - offset.y * Math.sin(turn),
    y: center.y + offset.x * Math.sin(turn) + offset.y * Math.cos(turn),
  }
  await dragToWorldPoint(page, map, rotation, rotationTarget)
  await expect(ring).not.toHaveAttribute('transform', rotationBefore!)
  await waitForWorkspaceSaved(page)
  const afterFreshRotation = await exportSystemJson(page)
  expect(afterFreshRotation.layout.orbitRotations?.[orbitId]).toBeCloseTo(30, 0)
  expect(await readWorkspaceRecords(page)).not.toEqual(recordsBefore)
})

test('touchcancel restores an unoccupied Orbit center and failed host attachment can be retried', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, orbit, ring, centerHandle, passenger } = await createFreeOrbitWithPassenger(page)
    await setWorkspaceMapMode(page, 'Move')
    const beforeCancel = await exportSystemJson(page)
    const recordsBeforeCancel = await readWorkspaceRecords(page)
    const centerXBefore = await ring.getAttribute('cx')
    const centerYBefore = await ring.getAttribute('cy')
    const passengerBefore = await passenger.getAttribute('transform')
    const start = await pointAtCenter(centerHandle)
    await dispatchTouch(cdp, 'touchStart', [start])
    await dispatchTouch(cdp, 'touchMove', [{ ...start, x: start.x + 28, y: start.y + 20 }])
    await expect(centerHandle).toHaveClass(/is-moving/)
    await expect(ring).not.toHaveAttribute('cx', centerXBefore!)
    await expect(passenger).not.toHaveAttribute('transform', passengerBefore!)
    await expect(ring).toHaveAttribute('ry', '60')
    await dispatchTouch(cdp, 'touchCancel', [])
    await expect(ring).toHaveAttribute('cx', centerXBefore!)
    await expect(ring).toHaveAttribute('cy', centerYBefore!)
    await expect(passenger).toHaveAttribute('transform', passengerBefore!)
    await expect(centerHandle).not.toHaveClass(/is-moving/)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBeforeCancel)
    expect(await exportSystemJson(page)).toEqual(beforeCancel)

    const beforeMove = await exportSystemJson(page)
    const systemBeforeMove = beforeMove.system
    if (!systemBeforeMove) throw new Error('The exported file does not contain a star system.')
    const originalOrbitId = await orbit.getAttribute('data-orbit-id')
    if (!originalOrbitId) throw new Error('The selected free Orbit has no identity.')
    const originalOrbit = systemBeforeMove.orbits.find(candidate => candidate.id === originalOrbitId)
    if (!originalOrbit) throw new Error('The selected free Orbit is missing from the exported system.')
    expect(systemBeforeMove.orbits).toHaveLength(1)
    expect(beforeMove.layout.orbitRadii[originalOrbit.id]).toEqual({ horizontal: 16, vertical: 60 })
    const primaryStar = systemBeforeMove.objects.find(object => object.name === 'Primary Star')
    if (!primaryStar) throw new Error('The exported system has no Primary Star.')
    const host = map.getByRole('button', { name: /Primary Star/ })
    const hostPoint = await host.evaluate(element => {
      const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
      if (!transform) throw new Error('Could not locate Primary Star on the map.')
      return { x: Number(transform[1]), y: Number(transform[2]) }
    })
    const recordsBeforeWrite = await readWorkspaceRecords(page)
    await ensureMapDragPointsReachable(page, map, centerHandle, hostPoint)
    await installOneCurrentWriteFailure(page)
    let appliedMemory: Awaited<ReturnType<typeof exportSystemJson>> | undefined
    try {
      const retryStart = await pointAtCenter(centerHandle)
      const retryDestination = await map.evaluate((element, worldPoint) => {
        const content = element.querySelector<SVGGElement>('.system-map-content')
        const transform = content?.getScreenCTM()
        if (!transform) throw new Error('The system map content is not attached to the document.')
        const screenPoint = new DOMPoint(worldPoint.x, worldPoint.y).matrixTransform(transform)
        return { x: screenPoint.x, y: screenPoint.y }
      }, hostPoint)
      await dispatchTouch(cdp, 'touchStart', [retryStart])
      await dispatchTouch(cdp, 'touchMove', [{
        ...retryStart,
        x: retryDestination.x,
        y: retryDestination.y,
      }])
      await expect(centerHandle).toHaveClass(/is-moving/)
      await expect.poll(async () => Number(await ring.getAttribute('cx')))
        .toBeCloseTo(hostPoint.x, 0)
      await expect(ring).toHaveAttribute('rx', '39')
      await expect(ring).toHaveAttribute('ry', '60')
      await dispatchTouch(cdp, 'touchEnd', [])

      const attachedOrbitMark = map.locator(`.orbit-mark[data-orbit-id="${originalOrbitId}"]`)
      const hostedRing = attachedOrbitMark.locator('.orbit-ring')
      await expect(hostedRing).toHaveAttribute('rx', '39')
      await expect(hostedRing).toHaveAttribute('ry', '60')
      await expect(activeWorkspaceFeedback(page).getByRole('alert')).toContainText('Not saved.')
      const radiusNotice = page.getByRole('status').filter({
        hasText: 'Orbit radii increased to the new host minimum of 39.',
      })
      await expect(radiusNotice).toBeVisible()
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
    const afterReload = await exportSystemJson(page)
    if (!appliedMemory) throw new Error('The failed save did not preserve applied memory for reload verification.')
    expect(afterReload).toEqual(appliedMemory)
    expect(afterReload.system?.orbits).toHaveLength(systemBeforeMove.orbits.length)
  } finally {
    await cdp.detach()
  }
})

test('Navigate object long-press inspects without editing and camera takeover stays navigation-only', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map } = await createHostedOrbit(page)
    await setWorkspaceMapMode(page, 'Navigate')
    await closeVisiblePanels(page)
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    const objectTarget = map.locator('.system-object').first().locator('.object-hit-target')
    const start = await pointAtCenter(objectTarget)
    await dispatchTouch(cdp, 'touchStart', [start])
    await page.waitForTimeout(650)
    await expect(page.getByRole('complementary', { name: 'Object inspector', exact: true })).toBeVisible()
    await dispatchTouch(cdp, 'touchEnd', [])
    await closeVisiblePanels(page)
    await expectWorkspaceMode(page, 'Navigate')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectWorkspaceMode(page, 'Navigate')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await cdp.detach()
  }
})

test('Select ring long-press leaves the map data and Select mode intact', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, orbitTarget } = await createHostedOrbit(page)
    await setWorkspaceMapMode(page, 'Select')
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    const ringPoint = await orbitDragPoints(orbitTarget, 1, 0.5)
    await dispatchTouch(cdp, 'touchStart', [{ id: 1, ...ringPoint.start }])
    await page.waitForTimeout(650)
    await dispatchTouch(cdp, 'touchEnd', [])
    await expectWorkspaceMode(page, 'Select')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectWorkspaceMode(page, 'Select')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await cdp.detach()
  }
})

test('blur restores an attached host drag and Move camera takeover changes only the view', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, ring } = await createHostedOrbit(page)
    await addCatalogueObject(page, 'planet', {
      target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
    })
    await closeVisiblePanels(page)
    await setWorkspaceMapMode(page, 'Move')
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    const host = map.getByRole('button', { name: /Primary Star/ })
    const hostTarget = host.locator('.object-hit-target')
    const hostTransformBefore = await host.getAttribute('transform')
    const ringCenterBefore = await ring.getAttribute('cx')
    const passenger = map.getByRole('button', { name: /New planet 1/ })
    const passengerTransformBefore = await passenger.getAttribute('transform')
    const position = await host.evaluate(element => {
      const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
      if (!transform) throw new Error('Could not locate the attached host.')
      return { x: Number(transform[1]), y: Number(transform[2]) }
    })
    const destination = { x: position.x + 350, y: position.y + 220 }
    await ensureMapDragPointsReachable(page, map, hostTarget, destination)
    await beginDragToWorldPoint(page, map, hostTarget, destination)
    await expect(host).toHaveClass(/is-dragging/)
    await expect(host).not.toHaveAttribute('transform', hostTransformBefore!)
    await expect(ring).not.toHaveAttribute('cx', ringCenterBefore!)
    await expect(passenger).not.toHaveAttribute('transform', passengerTransformBefore!)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.up()
    await expect(host).toHaveAttribute('transform', hostTransformBefore!)
    await expect(ring).toHaveAttribute('cx', ringCenterBefore!)
    await expect(passenger).toHaveAttribute('transform', passengerTransformBefore!)
    await expect(host).not.toHaveClass(/is-dragging/)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await cdp.detach()
  }
})

test('Object Add suppresses long-press inspection and second-contact takeover preserves Add', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map } = await createHostedOrbit(page)
    await setWorkspaceMapMode(page, 'Navigate')
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    await (await selectCatalogueObjectButton(page, 'planet')).click()
    await closeVisiblePanels(page)
    await expectAddMode(page, /Planet/)
    const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
    const objectTarget = map.locator('.system-object').first().locator('.object-hit-target')
    const firstTouch = await pointAtCenter(objectTarget)
    const scene = map.locator('.system-map-content')
    const viewBefore = await scene.getAttribute('transform')
    await dispatchTouch(cdp, 'touchStart', [firstTouch])
    await page.waitForTimeout(650)
    const inspectorStayedClosed = await inspector.isHidden()
    const memoryWhileHeld = await downloadJson(page, 'Export star system JSON')
    const recordsWhileHeld = await readWorkspaceRecords(page)
    expect(inspectorStayedClosed).toBe(true)
    expect(recordsWhileHeld).toEqual(recordsBefore)
    expect(memoryWhileHeld).toEqual(before)

    const [, secondPoint] = await visibleMapBackgroundPair(map)
    const secondTouch = { id: 2, x: secondPoint.x, y: secondPoint.y }
    await dispatchTouch(cdp, 'touchStart', [firstTouch, secondTouch])
    await dispatchTouch(cdp, 'touchMove', [
      { ...firstTouch, x: firstTouch.x - 10, y: firstTouch.y + 12 },
      { ...secondTouch, x: secondTouch.x + 10, y: secondTouch.y + 12 },
    ])
    await dispatchTouch(cdp, 'touchEnd', [])
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewBefore)
    await expectAddMode(page, /Planet/)
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectAddMode(page, /Planet/)
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    await workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toHaveCount(0)
    await expectInactiveAdd(page)
    await expectWorkspaceMode(page, 'Move')
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await cdp.detach()
  }
})
test('Orbit Add ring drag cancels on Escape and camera takeover stays navigation-only', async ({ page }) => {
  const cdp = await enableTouch(page)
  try {
    const { map, orbitTarget } = await createHostedOrbit(page)
    const before = await exportSystemJson(page)
    const recordsBefore = await readWorkspaceRecords(page)
    const addOrbit = await dockAction(page, 'Add orbit')
    await addOrbit.click()
    const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
    await expect(controls).toBeVisible()
    const addToggle = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
    if (await addToggle.getAttribute('aria-expanded') === 'true') await addToggle.click()
    await expectAddMode(page, /Orbit/)

    await cameraOnlyRightPanAndSecondTouch(page, map, cdp)
    await expectAddMode(page, /Orbit/)
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)

    const scene = map.locator('.system-map-content')
    const transformBeforeRingDrag = await scene.getAttribute('transform')
    const points = await orbitDragPoints(orbitTarget, 1.25, 0.45)
    await page.mouse.move(points.start.x, points.start.y)
    await page.mouse.down()
    await page.mouse.move(points.end.x, points.end.y, { steps: 5 })
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(transformBeforeRingDrag)
    await page.keyboard.press('Escape')
    await expect(controls).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true }))
      .toHaveCount(0)
    await expectInactiveAdd(page)
    await expectWorkspaceMode(page, 'Select')
    await page.mouse.up()
    expect(await readWorkspaceRecords(page)).toEqual(recordsBefore)
    expect(await exportSystemJson(page)).toEqual(before)
  } finally {
    await cdp.detach()
  }
})
