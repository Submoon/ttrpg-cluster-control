import { expect, test, type Locator } from './fixtures'
import { waitForWorkspaceSaved } from './helpers'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  exposedContinuousObjectHitPoint,
  hideWorkspaceInspector,
  readInspectorSelection,
  selectCatalogueObjectButton,
  selectInspectorOption,
  wardenMap,
  wardenObjectMark,
  workspaceZoomControls,
  workspaceZoomOutput,
  type WorldPoint,
} from './helpers'

type WorkspaceWriteFailpointWindow = Window & {
  __ticket23OriginalPut?: typeof IDBObjectStore.prototype.put
  __ticket23FailNextCurrentWrite?: boolean
}

async function failNextCurrentWorkspaceWrite(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = window as WorkspaceWriteFailpointWindow
    const originalPut = IDBObjectStore.prototype.put
    gate.__ticket23OriginalPut = originalPut
    gate.__ticket23FailNextCurrentWrite = true
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = originalPut.call(this, value, key)
      if (this.transaction.db.name === 'ttrpg-cluster-control'
        && this.name === 'workspace'
        && key === 'current'
        && gate.__ticket23FailNextCurrentWrite) {
        gate.__ticket23FailNextCurrentWrite = false
        this.transaction.abort()
      }
      return request
    }
  })
}

async function restoreCurrentWorkspaceWrite(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const gate = window as WorkspaceWriteFailpointWindow
    if (gate.__ticket23OriginalPut) IDBObjectStore.prototype.put = gate.__ticket23OriginalPut
    delete gate.__ticket23OriginalPut
    delete gate.__ticket23FailNextCurrentWrite
  })
}

async function ensurePlacementOpen(controls: import('@playwright/test').Locator): Promise<void> {
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await expect(placementToggle).toHaveAttribute('aria-expanded', 'true')
}

async function hitCenter(locator: Locator): Promise<{ x: number; y: number }> {
  return locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const point = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    if (!element.contains(document.elementFromPoint(point.x, point.y))) {
      throw new Error('The center of the requested target is covered.')
    }
    return point
  })
}

async function orbitDragPoints(ring: Locator): Promise<{ start: WorldPoint; requested: WorldPoint }> {
  return ring.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('Expected an Orbit ellipse.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('Expected a visible Orbit transform.')
    const x = element.cx.baseVal.value
    const y = element.cy.baseVal.value
    const radius = element.rx.baseVal.value
    const start = new DOMPoint(x, y).matrixTransform(matrix)
    const requested = new DOMPoint(x + radius, y).matrixTransform(matrix)
    return { start: { x: start.x, y: start.y }, requested: { x: requested.x, y: requested.y } }
  })
}


function expectSystemPlacement(
  placement: { kind: string; x?: number; y?: number } | undefined,
  expected: WorldPoint,
): void {
  expect(placement?.kind).toBe('system')
  if (placement?.kind !== 'system' || typeof placement.x !== 'number' || typeof placement.y !== 'number') return
  // SVG matrix conversion persists raw floating-point coordinates, so allow only subpixel-scale rounding.
  expect(placement.x).toBeCloseTo(expected.x, 6)
  expect(placement.y).toBeCloseTo(expected.y, 6)
}

test('system Add immediately places on repeated clicks and preserves each placement', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })

  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeHidden()
  const map = wardenMap(page)
  const host = wardenObjectMark(page, systemId, primaryObjectId)
  const hostPoint = async () => {
    const point = await exposedContinuousObjectHitPoint(host)
    if (!point) throw new Error('The primary Star must have a reachable Orbit Add target.')
    return point
  }
  const ownerRings = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  const orbitRings = ownerRings.and(map.getByRole('button', { name: /^Select Orbit \d+$/ }))
  const beforeChoosingPlanet = await downloadJson(page, 'Export star system JSON')
  expect(beforeChoosingPlanet.system?.id).toBe(systemId)
  expect(beforeChoosingPlanet.system?.objects).toHaveLength(1)

  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const afterChoosingPlanet = await downloadJson(page, 'Export star system JSON')
  expect(afterChoosingPlanet.system?.objects).toEqual(beforeChoosingPlanet.system?.objects)
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspector).toBeHidden()

  const firstPoint = { x: 0.25, y: 0.25 }
  const firstDeliveredPoint = await clickWardenSystemPoint(page, systemId, firstPoint)
  const confirmPlacement = page.getByRole('button', { name: 'Confirm placement', exact: true })
  await expect(confirmPlacement).toHaveCount(0)
  const afterFirstClick = await downloadJson(page, 'Export star system JSON')
  const firstPlanets = afterFirstClick.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(firstPlanets).toHaveLength(1)
  expectSystemPlacement(firstPlanets[0]?.placement, firstDeliveredPoint)
  await expect(inspector).toBeHidden()

  const secondPoint = { x: 0.75, y: 0.75 }
  const secondDeliveredPoint = await clickWardenSystemPoint(page, systemId, secondPoint)
  await expect(confirmPlacement).toHaveCount(0)
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspector).toBeHidden()

  const afterSecondClick = await downloadJson(page, 'Export star system JSON')
  const placedPlanets = afterSecondClick.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(placedPlanets).toHaveLength(2)
  expectSystemPlacement(placedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(placedPlanets[1]?.placement, secondDeliveredPoint)

  await waitForWorkspaceSaved(page)
  await page.reload()
  await map.locator('.continuous-warden-name-target').click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const afterReload = await downloadJson(page, 'Export star system JSON')
  const reloadedPlanets = afterReload.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(reloadedPlanets).toHaveLength(2)
  expectSystemPlacement(reloadedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(reloadedPlanets[1]?.placement, secondDeliveredPoint)

  await test.step('Three clicks on the same host in one Add Orbit session create distinct rings', async () => {
    const rings = orbitRings
    await expect(rings).toHaveCount(0)
    await (await dockAction(page, 'Add orbit')).click()

    const quitAdd = page.getByRole('button', { name: 'Quit Add and return to Select' })
    const readRings = () => rings.evaluateAll(ellipses => ellipses.map(ellipse => ({
      id: ellipse.closest('[data-orbit-id]')?.getAttribute('data-orbit-id'),
      geometry: ['cx', 'cy', 'rx', 'ry', 'transform'].map(attribute => ellipse.getAttribute(attribute)),
    })))
    let previous = await readRings()
    for (const count of [1, 2, 3]) {
      await expect(quitAdd).toBeVisible()
      const point = await hostPoint()
      await page.mouse.click(point.x, point.y)
      await expect(rings).toHaveCount(count)
      const current = await readRings()
      expect(current).toEqual(expect.arrayContaining(previous))
      previous = current
    }
    await expect(quitAdd).toBeVisible()
    expect(new Set(previous.map(ring => JSON.stringify(ring.geometry))).size, 'distinct rings').toBe(3)
    expect(previous.map(ring => ring.geometry.slice(2, 4).map(Number)), 'compact hosted radii')
      .toEqual([[56, 56], [72, 72], [88, 88]])
  })

  await test.step('A drag that leaves the map before showing a ring still blocks Undo', async () => {
    await waitForWorkspaceSaved(page)
    const undo = page.getByRole('group', { name: 'Edit history' }).getByRole('button', { name: /^Undo(?:$|:)/ })
    const quitAdd = page.getByRole('button', { name: 'Quit Add and return to Select' })
    const start = await hostPoint()
    await expect(undo).toBeEnabled()
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    try {
      const outside = await hitCenter(quitAdd)
      await page.mouse.move(outside.x, outside.y)
      await expect(map.locator('.orbit-creation-preview-ring')).toHaveCount(0)
      await expect(undo).toBeDisabled()
      await page.keyboard.press('Control+z')
      await expect(ownerRings).toHaveCount(3)
    } finally {
      await page.mouse.up()
    }
    await expect(quitAdd).toBeVisible()
    await expect(undo).toBeEnabled()
    await expect(ownerRings).toHaveCount(3)
  })

  await test.step('An Orbit drag released over Quit Add creates the displayed circle once', async () => {
    const quitAdd = page.getByRole('button', { name: 'Quit Add and return to Select' })
    const firstRing = orbitRings.and(map.getByRole('button', { name: 'Select Orbit 1', exact: true }))
    const start = await hostPoint()
    const preview = map.locator('.orbit-creation-preview-ring')
    const readPaintedGap = () => preview.evaluate((element) => {
      if (!(element instanceof SVGEllipseElement)) throw new Error('Expected a circular preview.')
      const matrix = element.getScreenCTM()
      const existing = element.closest('svg')?.querySelectorAll<SVGEllipseElement>('.continuous-warden-orbit-target')
      if (!matrix || !existing?.length) throw new Error('Expected concentric rendered rings.')
      const previewStroke = parseFloat(getComputedStyle(element).strokeWidth)
      const scale = Math.hypot(matrix.a, matrix.b)
      const gap = Math.min(...Array.from(existing, (ring) => {
        const separation = Math.abs(element.rx.baseVal.value - ring.rx.baseVal.value)
        const halfStrokes = (previewStroke + parseFloat(getComputedStyle(ring).strokeWidth)) / 2
        return (separation - halfStrokes) * scale
      }))
      return { gap, scale }
    })
    const originalRing = await firstRing.evaluateHandle(element => element)
    let radius: string
    try {
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      const { requested } = await orbitDragPoints(firstRing)
      await page.mouse.move(requested.x, requested.y)
      await expect(preview).toBeVisible()
      const snappedRadius = await preview.getAttribute('rx')
      if (snappedRadius === null) throw new Error('Expected a preview radius.')
      const beforeGap = await readPaintedGap()
      expect(beforeGap.gap, 'nearest rendered gap in CSS pixels').toBeGreaterThanOrEqual(3.95)
      // Clearance accounts for the highlighted stroke, which is 0.4 scene units wider.
      expect(beforeGap.gap, 'nearest available radius limits the gap').toBeLessThanOrEqual(4.05 + 0.2 * beforeGap.scale)

      const zoom = workspaceZoomOutput(page)
      const beforeZoom = await zoom.textContent()
      if (!beforeZoom) throw new Error('Expected a zoom readout before changing zoom.')
      const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
      await zoomOut.focus()
      await page.keyboard.press('Enter')
      await expect(zoom).not.toHaveText(beforeZoom)
      await expect(preview).not.toHaveAttribute('rx', snappedRadius)
      expect((await readPaintedGap()).gap, 'gap stays clear at the new zoom').toBeGreaterThanOrEqual(3.95)
      expect(await originalRing.evaluate(element => element.isConnected), 'preview updates keep existing map marks mounted').toBe(true)

      const updatedRadius = await preview.getAttribute('rx')
      if (updatedRadius === null) throw new Error('Expected a preview radius after changing zoom.')
      radius = updatedRadius
      await expect(preview).toHaveAttribute('ry', radius)
    } finally {
      await originalRing.dispose()
    }

    // The Add status can reflow the toolbar when the preview starts.
    const releasePoint = await hitCenter(quitAdd)
    await page.mouse.move(releasePoint.x, releasePoint.y)
    await expect(preview).toHaveAttribute('rx', radius)
    await page.mouse.up()

    await expect(preview).toHaveCount(0)
    await expect(quitAdd).toBeVisible()
    const rings = orbitRings
    await expect(rings).toHaveCount(4)
    const created = orbitRings.and(map.getByRole('button', { name: 'Select Orbit 4', exact: true }))
    await expect(created).toHaveAttribute('rx', radius)
    await expect(created).toHaveAttribute('ry', radius)
    expect(await created.getAttribute('cx')).toBe(await firstRing.getAttribute('cx'))
    expect(await created.getAttribute('cy')).toBe(await firstRing.getAttribute('cy'))

    await test.step('Escape cancels an active pen drag and its late release', async () => {
      const start = await hostPoint()
      const { requested } = await orbitDragPoints(firstRing)
      const cdp = await page.context().newCDPSession(page)
      try {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start, pointerType: 'pen' })
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mousePressed', ...start, pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1,
        })
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', ...requested, pointerType: 'pen', buttons: 1,
        })
        await expect(preview).toBeVisible()
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: requested.x + 12, y: requested.y, pointerType: 'pen', buttons: 1,
        })
        await expect(preview).toBeVisible()

        await page.keyboard.down('Escape')
        try {
          await expect(preview).toHaveCount(0)
          // A held Escape key repeats before the pen's physical release.
          await page.keyboard.down('Escape')
          await expect(quitAdd).toBeVisible()
        } finally {
          await page.keyboard.up('Escape')
        }
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: requested.x + 12, y: requested.y,
          pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1,
        })
        await expect(quitAdd).toBeVisible()
        await expect(rings).toHaveCount(4)
      } finally {
        await cdp.detach()
      }
    })
  })
})


test('Orbit form Add retains its host, corrects each axis, and retries one applied write', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })
  await waitForWorkspaceSaved(page)
  const inspector = page.locator('#workspace-inspector-panel')
  await wardenObjectMark(page, systemId, primaryObjectId).press('Enter')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')

  const addToggle = page.locator('.workspace-dock-add')
  await addToggle.click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  await expect(controls).toBeVisible()

  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const orbitHost = page.getByLabel('Orbit center or host', { exact: true })
  await selectInspectorOption(orbitHost, 'Around Primary Star')
  await page.getByLabel('Horizontal radius').fill('10')
  await page.getByLabel('Vertical radius').fill('80')
  await page.getByLabel('Rotation', { exact: true }).fill('37')
  const creationStatus = page.getByRole('navigation', { name: 'Map context and commands' }).locator('.workspace-add-status')

  const beforeAdd = await downloadJson(page, 'Export star system JSON')
  expect(beforeAdd.system?.orbits).toHaveLength(0)

  await ensurePlacementOpen(controls)
  await failNextCurrentWorkspaceWrite(page)
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()
  const saveFeedback = activeWorkspaceFeedback(page).locator('.save-feedback')
  await expect(saveFeedback).toContainText('Not saved.')
  await expect(creationStatus).toContainText('Horizontal radius set to 39')
  await expect(creationStatus).toContainText('Orbit 1 added')
  await expect(page.getByLabel('Horizontal radius')).toHaveValue('39')
  await expect(page.getByLabel('Vertical radius')).toHaveValue('80')
  await expect(page.getByLabel('Rotation', { exact: true })).toHaveValue('37')
  await expect.poll(() => readInspectorSelection(orbitHost)).toBe('Around Primary Star')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  await restoreCurrentWorkspaceWrite(page)

  const appliedMemory = await downloadJson(page, 'Export star system JSON')
  const appliedOrbit = appliedMemory.system?.orbits[0]
  expect(appliedMemory.system?.orbits).toHaveLength(1)
  expect(appliedOrbit?.hostId).toBe(appliedMemory.system?.objects[0]?.id)
  expect(appliedMemory.layout.orbitRadii[appliedOrbit!.id]).toEqual({ horizontal: 39, vertical: 80 })
  expect(appliedMemory.layout.orbitRotations?.[appliedOrbit!.id]).toBe(37)

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await page.reload()
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  const ownerAfterReload = afterReload.cluster?.systems.find(system => system.id === systemId)
  const orbitAfterReload = ownerAfterReload?.orbits[0]
  expect(ownerAfterReload?.orbits).toHaveLength(1)
  expect(orbitAfterReload?.hostId).toBe(primaryObjectId)
  if (!orbitAfterReload) throw new Error('The retried Orbit is missing from the recovered owner.')
  expect(afterReload.layout.orbitRadii[orbitAfterReload.id]).toEqual({ horizontal: 39, vertical: 80 })
  expect(afterReload.layout.orbitRotations?.[orbitAfterReload.id]).toBe(37)
})
