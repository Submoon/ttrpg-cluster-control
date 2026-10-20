import { expect, test } from '@playwright/test'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  readInspectorSelection,
  returnToClusterMap,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  workspaceZoomControls,
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

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
}

test('changing Placement inputs invalidates the old preview before an invalid replacement', async ({ page }) => {
  await createWorkspace(page)
  const inspector = page.locator('#workspace-inspector-panel')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeHidden()

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const controls = page.getByRole('group', { name: 'Planet creation controls' })
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const x = page.getByLabel('Placement X')
  const y = page.getByLabel('Placement Y')
  const preview = page.getByRole('button', { name: 'Preview placement' })
  const confirm = controls.getByRole('button', { name: 'Confirm placement', exact: true })

  await x.fill('0.3')
  await y.fill('0.4')
  await preview.click()
  await expect(confirm).toBeVisible()

  await x.fill('0.35')
  await expect(confirm).toHaveCount(0)
  await x.fill('')
  await preview.click()
  await expect(page.getByText('X must be a finite number.', { exact: true })).toBeVisible()
  await expect(confirm).toHaveCount(0)
  await expect(x).toHaveValue('')
  await expect(y).toHaveValue('0.4')

  await x.fill('0.35')
  await preview.click()
  await expect(confirm).toBeVisible()
})

async function clickNormalizedSystemPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<WorldPoint> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const target = await map.evaluate((element, normalized) => {
      const content = element.querySelector<SVGGElement>('.system-map-content')
      const transform = content?.getScreenCTM()
      if (!transform) throw new Error('The system map content is not attached to the document.')
      const requestedScreenPoint = new DOMPoint(64 + normalized.x * 832, 72 + normalized.y * 416)
        .matrixTransform(transform)
      const clickPoint = { x: Math.floor(requestedScreenPoint.x), y: Math.floor(requestedScreenPoint.y) }
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(clickPoint.x, clickPoint.y)
      // Chromium delivers page.mouse coordinates as integer CSS pixels; derive the oracle from that delivered point.
      const deliveredScenePoint = new DOMPoint(clickPoint.x, clickPoint.y).matrixTransform(transform.inverse())
      return {
        clickPoint,
        deliveredPoint: { x: (deliveredScenePoint.x - 64) / 832, y: (deliveredScenePoint.y - 72) / 416 },
        reachable: clickPoint.x >= Math.max(0, bounds.left) && clickPoint.y >= Math.max(0, bounds.top)
          && clickPoint.x < Math.min(window.innerWidth, bounds.right)
          && clickPoint.y < Math.min(window.innerHeight, bounds.bottom)
          && !!hit && (hit === element || element.contains(hit)),
      }
    }, point)

    if (target.reachable) {
      await page.mouse.click(target.clickPoint.x, target.clickPoint.y)
      return target.deliveredPoint
    }
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }

  throw new Error(`Normalized map point (${point.x}, ${point.y}) is unreachable after public Zoom out controls.`)
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

test('system Add previews before confirming, repeats the type, and reloads confirmed placements', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeHidden()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const beforeChoosingPlanet = await downloadJson(page, 'Export star system JSON')
  expect(beforeChoosingPlanet.system?.objects).toHaveLength(1)

  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const afterChoosingPlanet = await downloadJson(page, 'Export star system JSON')
  expect(afterChoosingPlanet.system?.objects).toEqual(beforeChoosingPlanet.system?.objects)
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')

  const firstPoint = { x: 0.25, y: 0.25 }
  const firstDeliveredPoint = await clickNormalizedSystemPoint(page, map, firstPoint)
  const confirmPlacement = page.getByRole('button', { name: 'Confirm placement', exact: true })
  await expect(confirmPlacement).toBeVisible()

  const beforeConfirming = await downloadJson(page, 'Export star system JSON')
  expect(beforeConfirming.system?.objects).toEqual(beforeChoosingPlanet.system?.objects)

  await confirmPlacement.click()
  const afterFirstConfirmation = await downloadJson(page, 'Export star system JSON')
  const firstPlanets = afterFirstConfirmation.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(firstPlanets).toHaveLength(1)
  expectSystemPlacement(firstPlanets[0]?.placement, firstDeliveredPoint)
  await expect(inspector).toBeHidden()

  const secondPoint = { x: 0.75, y: 0.75 }
  const secondDeliveredPoint = await clickNormalizedSystemPoint(page, map, secondPoint)
  await expect(confirmPlacement).toBeVisible()
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspector).toBeHidden()
  await confirmPlacement.click()

  const afterSecondConfirmation = await downloadJson(page, 'Export star system JSON')
  const confirmedPlanets = afterSecondConfirmation.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(confirmedPlanets).toHaveLength(2)
  expectSystemPlacement(confirmedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(confirmedPlanets[1]?.placement, secondDeliveredPoint)

  await page.reload()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  const afterReload = await downloadJson(page, 'Export star system JSON')
  const reloadedPlanets = afterReload.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(reloadedPlanets).toHaveLength(2)
  expectSystemPlacement(reloadedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(reloadedPlanets[1]?.placement, secondDeliveredPoint)
})

test('Orbit Add retains its target, corrects each axis, and retries one applied write', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const inspector = page.locator('#workspace-inspector-panel')
  const starHierarchy = await openWorkspaceHierarchy(page)
  await starHierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')

  const addToggle = page.locator('.workspace-dock-add')
  await addToggle.click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  await expect(controls).toBeVisible()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await clickNormalizedSystemPoint(page, map, { x: 0.5, y: 0.5 })
  const confirm = controls.getByRole('button', { name: 'Confirm placement', exact: true })
  // An Object draft does not own Orbit ordering or host geometry, so this target remains independent.
  await expect(confirm).toBeVisible()
  await expect(controls.getByRole('alert')).toHaveCount(0)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await controls.getByRole('button', { name: 'Cancel placement', exact: true }).click()
  await inspector.getByRole('button', { name: 'Discard changes Cancel map object edits', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeHidden()

  // A free map target replaces the current host selection in Orbit Placement.
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const orbitHost = page.getByLabel('Orbit center or host', { exact: true })
  await selectInspectorOption(orbitHost, 'Around Primary Star')
  await page.getByRole('button', { name: 'Preview placement' }).click()
  await expect(confirm).toBeVisible()
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const freeCenter = await clickNormalizedSystemPoint(page, map, { x: 0.9, y: 0.1 })
  await expect(confirm).toBeVisible()
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect.poll(() => readInspectorSelection(orbitHost)).toBe('Unoccupied center')
  // Match the map's float32 pointer conversion against the double-precision DOM matrix oracle.
  expect(Number(await page.getByLabel('Placement X', { exact: true }).inputValue())).toBeCloseTo(freeCenter.x, 6)
  expect(Number(await page.getByLabel('Placement Y', { exact: true }).inputValue())).toBeCloseTo(freeCenter.y, 6)
  await selectInspectorOption(orbitHost, 'Around Primary Star')
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()

  // Dismissing the anchored non-modal form from another Dock control leaves parent-owned inputs armed.
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const placementForm = page.getByRole('form', { name: 'Placement' })
  await expect(placementForm).toBeVisible()
  await page.getByRole('button', { name: 'Navigate', exact: true }).click()
  await expect(placementForm).toBeHidden()
  await expect(controls).toBeVisible()

  await clickNormalizedSystemPoint(page, map, { x: 0.5, y: 0.5 })
  await expect(confirm).toBeVisible()

  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  await page.getByLabel('Horizontal radius').fill('10')
  await page.getByLabel('Vertical radius').fill('80')
  await page.getByRole('button', { name: 'Preview placement' }).click()
  await expect(confirm).toBeVisible()
  const creationStatus = page.getByRole('navigation', { name: 'Map context and commands' }).getByRole('status')
  await expect(creationStatus).toContainText('Horizontal radius set to 39')
  await expect(page.getByLabel('Horizontal radius')).toHaveValue('39')
  await expect(page.getByLabel('Vertical radius')).toHaveValue('80')

  const beforeConfirm = await downloadJson(page, 'Export star system JSON')
  expect(beforeConfirm.system?.orbits).toHaveLength(0)

  await failNextCurrentWorkspaceWrite(page)
  await confirm.click()
  const saveFeedback = activeWorkspaceFeedback(page).locator('.save-feedback')
  await expect(saveFeedback).toContainText('Not saved.')
  await expect(creationStatus).toContainText('Horizontal radius set to 39')
  await expect(creationStatus).toContainText('Orbit 1 added')
  await restoreCurrentWorkspaceWrite(page)

  const appliedMemory = await downloadJson(page, 'Export star system JSON')
  const appliedOrbit = appliedMemory.system?.orbits[0]
  expect(appliedMemory.system?.orbits).toHaveLength(1)
  expect(appliedOrbit?.hostId).toBe(appliedMemory.system?.objects[0]?.id)
  expect(appliedMemory.layout.orbitRadii[appliedOrbit!.id]).toEqual({ horizontal: 39, vertical: 80 })
  expect(appliedMemory.layout.orbitRotations?.[appliedOrbit!.id]).toBe(0)
  await expect(inspector).toBeHidden()
  await expect(controls).toBeVisible()

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(saveFeedback).toHaveText('Saved on this device')
  await page.reload()
  const afterReload = await downloadJson(page, 'Export star system JSON')
  expect(afterReload.system?.orbits).toHaveLength(1)
  expect(afterReload.system?.orbits[0]?.hostId).toBe(afterReload.system?.objects[0]?.id)
  expect(afterReload.layout.orbitRadii[afterReload.system!.orbits[0]!.id])
    .toEqual({ horizontal: 39, vertical: 80 })
})

test('Add chooser dismissal consumes outside contact and preserves the next right-pan', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
  await addToggle.click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  const confirm = controls.getByRole('button', { name: 'Confirm placement', exact: true })
  await expect(controls).toBeVisible()

  // Escape closes the real chooser while leaving the armed Add type available.
  await addToggle.click()
  await page.keyboard.press('Escape')
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(controls).toBeVisible()

  // The outside tap dismisses the chooser without also creating a map target.
  await addToggle.click()
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The system map has no visible bounds for the Add chooser dismissal.')
  await page.mouse.click(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2)
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(controls).toBeVisible()
  await expect(confirm).toHaveCount(0)
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)

  // A right-button outside dismissal consumes the whole drag sequence while preserving preview state.
  await clickNormalizedSystemPoint(page, map, { x: 0.5, y: 0.5 })
  await expect(confirm).toBeVisible()
  const viewportBeforeRightDismissal = await map.locator('.system-map-content').getAttribute('transform')
  if (viewportBeforeRightDismissal === null) throw new Error('The system map has no viewport transform to preserve.')
  const memoryBeforeRightDismissal = await downloadJson(page, 'Export star system JSON')
  await addToggle.click()
  const rightDrag = await map.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const start = { x: bounds.left + bounds.width * 0.2, y: bounds.top + bounds.height * 0.2 }
    const end = { x: start.x + 36, y: start.y + 28 }
    const hit = document.elementFromPoint(start.x, start.y)
    return {
      start,
      end,
      startsOnMap: !!hit && (hit === element || element.contains(hit)),
    }
  })
  expect(rightDrag.startsOnMap).toBe(true)
  await page.mouse.move(rightDrag.start.x, rightDrag.start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(rightDrag.end.x, rightDrag.end.y, { steps: 3 })
  await page.mouse.up({ button: 'right' })
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(confirm).toBeVisible()
  await expect(map.locator('.system-creation-preview')).toHaveCount(1)
  await expect(map.locator('.system-map-content')).toHaveAttribute('transform', viewportBeforeRightDismissal)
  const memoryAfterRightDismissal = await downloadJson(page, 'Export star system JSON')
  expect(memoryAfterRightDismissal.system).toEqual(memoryBeforeRightDismissal.system)
  expect(memoryAfterRightDismissal.layout).toEqual(memoryBeforeRightDismissal.layout)

  // The consumed drag ended its sequence; the next right drag is the map's normal view-only pan.
  const viewportBeforeFreshPan = await map.locator('.system-map-content').getAttribute('transform')
  if (viewportBeforeFreshPan === null) throw new Error('The system map has no viewport transform before panning.')
  await page.mouse.move(rightDrag.start.x, rightDrag.start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(rightDrag.end.x, rightDrag.end.y, { steps: 3 })
  await page.mouse.up({ button: 'right' })
  await expect(map.locator('.system-map-content')).not.toHaveAttribute('transform', viewportBeforeFreshPan)
  await expect(confirm).toHaveCount(0)
})

test('an Orbit draft blocks only same-host Orbit creation and survives independent creations', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
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

  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await hierarchy.getByRole('button', { name: /^Orbit 1 around Primary Star,/ }).click()

  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  const horizontalRadius = inspector.getByLabel('Horizontal radius', { exact: true })
  const modifiedRadius = String(Number(await horizontalRadius.inputValue()) + 1)
  await horizontalRadius.fill(modifiedRadius)
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()

  const initial = await downloadJson(page, 'Export star system JSON')
  const primary = initial.system!.objects.find(object => object.name === 'Primary Star')!
  const oldPlanet = initial.system!.objects.find(object => object.name === 'Old Planet')!
  const primaryOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)!
  const originalOrbitCount = initial.system!.orbits.length
  const map = page.getByRole('group', { name: 'Dense Reach star system map', exact: true })

  const addToggle = page.locator('.workspace-dock-add')
  await addToggle.click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()

  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  const confirm = controls.getByRole('button', { name: 'Confirm placement', exact: true })
  await clickNormalizedSystemPoint(page, map, { x: 0.5, y: 0.5 })
  await expect(confirm).toHaveCount(0)
  await expect(controls.getByRole('alert')).toContainText('Resolve the Inspector draft')
  await expect(horizontalRadius).toHaveValue(modifiedRadius)

  // The same armed Add type may target a different host while the primary-host Orbit draft remains open.
  await clickNormalizedSystemPoint(page, map, {
    x: (520 - 64) / 832,
    y: (210.7179676972449 - 72) / 416,
  })
  await expect(confirm).toBeVisible()
  await expect(controls.getByRole('alert')).toHaveCount(0)
  await confirm.click()
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  await expect(horizontalRadius).toHaveValue(modifiedRadius)

  const afterDifferentHostOrbit = await downloadJson(page, 'Export star system JSON')
  expect(afterDifferentHostOrbit.system?.orbits).toHaveLength(originalOrbitCount + 1)
  const addedOrbit = afterDifferentHostOrbit.system!.orbits.find(orbit =>
    orbit.hostId === oldPlanet.id && orbit.order === 2,
  )
  expect(addedOrbit).toBeDefined()
  expect(addedOrbit?.hostId).not.toBe(primary.id)
  expect(afterDifferentHostOrbit.system!.orbits.find(orbit => orbit.id === primaryOrbit.id)).toEqual(primaryOrbit)

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()
  const planetControls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  const confirmPlanet = planetControls.getByRole('button', { name: 'Confirm placement', exact: true })
  // Alpha and beta overlap here; the explicit Alpha choice proves object-create remains independent
  // even when it appends an occupant to the Orbit whose geometry draft is still open.
  await clickNormalizedSystemPoint(page, map, {
    x: (583.9230484541326 - 64) / 832,
    y: (340 - 72) / 416,
  })
  const alphaChoice = page.getByRole('button', { name: `Orbit ${primaryOrbit.order} around ${primary.name}`, exact: true })
  const betaOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)!
  const betaChoice = page.getByRole('button', { name: `Orbit ${betaOrbit.order} around ${primary.name}`, exact: true })
  await expect(alphaChoice).toBeVisible()
  await expect(betaChoice).toBeVisible()
  await expect(confirmPlanet).toHaveCount(0)
  await alphaChoice.click()
  await expect(confirmPlanet).toBeVisible()

  // A free map point replaces the selected Orbit in the public Placement form.
  const orbitPlacement = page.getByLabel('Orbit placement', { exact: true })
  await planetControls.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect.poll(() => readInspectorSelection(orbitPlacement))
    .toBe(`Orbit ${primaryOrbit.order} around ${primary.name}`)
  await planetControls.getByRole('button', { name: 'Placement', exact: true }).click()
  const freePoint = await clickNormalizedSystemPoint(page, map, { x: 0.9, y: 0.1 })
  await expect(confirmPlanet).toBeVisible()
  await planetControls.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect.poll(() => readInspectorSelection(orbitPlacement)).toBe('Free map position')
  // The map's D3 pointer is float32-backed while the public DOM matrix oracle is double precision.
  expect(Number(await page.getByLabel('Placement X', { exact: true }).inputValue())).toBeCloseTo(freePoint.x, 6)
  expect(Number(await page.getByLabel('Placement Y', { exact: true }).inputValue())).toBeCloseTo(freePoint.y, 6)
  await selectInspectorOption(orbitPlacement, `Orbit ${primaryOrbit.order} around ${primary.name}`)
  await page.getByRole('button', { name: 'Preview placement' }).click()
  await expect(confirmPlanet).toBeVisible()
  await expect(planetControls.getByRole('alert')).toHaveCount(0)
  await confirmPlanet.click()
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  await expect(inspector.getByLabel('Horizontal radius', { exact: true })).toHaveValue(modifiedRadius)

  const afterIndependentObject = await downloadJson(page, 'Export star system JSON')
  expect(afterIndependentObject.system?.orbits).toHaveLength(originalOrbitCount + 1)
  expect(afterIndependentObject.system?.objects).toHaveLength(initial.system!.objects.length + 1)
  const newPlanet = afterIndependentObject.system!.objects.find(object =>
    !initial.system!.objects.some(existing => existing.id === object.id),
  )
  expect(newPlanet?.subtype).toBe('planet')
  expect(newPlanet?.placement).toEqual({ kind: 'orbit', orbitId: primaryOrbit.id })
  expect(afterIndependentObject.layout.objectAngles[oldPlanet.id]).toBeDefined()
  const oldMoon = initial.system!.objects.find(object => object.name === 'Old Moon')!
  expect(afterIndependentObject.layout.objectAngles[oldMoon.id]).toBeDefined()
  expect(afterIndependentObject.system!.orbits.find(orbit => orbit.id === primaryOrbit.id)).toEqual(primaryOrbit)
})
