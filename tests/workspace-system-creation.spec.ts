import { expect, test } from './fixtures'
import creationGeometryFixture from './fixtures/workspace-system-creation-geometry.json' with { type: 'json' }
import { waitForWorkspaceSaved, importReviewDialog, resolveImportReview } from './helpers'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickNormalizedSystemPoint,
  clickSystemOrbitPoint,
  dragToWorldPoint,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  readInspectorSelection,
  returnToClusterMap,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  workspaceNavigation,
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
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
}

async function ensurePlacementOpen(controls: import('@playwright/test').Locator): Promise<void> {
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await expect(placementToggle).toHaveAttribute('aria-expanded', 'true')
}

test('free-object creation uses a map point instead of coordinate inputs', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const inspector = page.locator('#workspace-inspector-panel')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeHidden()

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await planetButton.click()

  const controls = page.getByRole('group', { name: 'Planet creation controls' })
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect(page.getByLabel('Placement X')).toHaveCount(0)
  await expect(page.getByLabel('Placement Y')).toHaveCount(0)
  await expect(page.getByRole('form', { name: 'Placement', exact: true }).getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)
  await controls.getByRole('button', { name: 'Placement', exact: true }).click()
  const point = await clickNormalizedSystemPoint(page, page.getByRole('group', { name: /star system map$/ }), { x: 0.35, y: 0.45 })
  await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  const afterAdd = await downloadJson(page, 'Export star system JSON')
  const addedPlanet = afterAdd.system?.objects.find(object => object.subtype === 'planet')
  expect(afterAdd.system?.objects).toHaveLength(2)
  expectSystemPlacement(addedPlanet?.placement, point)
  await expect(inspector).toBeVisible()
})

test('Other map Add explains a blank label and recovers through Placement', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')

  const before = await downloadJson(page, 'Export star system JSON')
  const primaryStarId = before.system!.objects.find(object => object.name === 'Primary Star')!.id
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const otherButton = await selectCatalogueObjectButton(page, 'other')
  await otherButton.click()
  const controls = page.getByRole('group', { name: 'Other creation controls', exact: true })
  await expect(controls).toBeVisible()

  const mapPoint = await clickNormalizedSystemPoint(page, map, { x: 0.25, y: 0.25 })
  const afterBlankLabel = await downloadJson(page, 'Export star system JSON')
  expect(afterBlankLabel.system).toEqual(before.system)
  expect(afterBlankLabel.layout).toEqual(before.layout)
  await expect(controls.getByRole('alert')).toContainText('Object type is required.')
  await expect(page.getByRole('dialog', { name: 'Edit chart names', exact: true })).toHaveCount(0)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()

  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await expect(placementToggle).toHaveAttribute('aria-expanded', 'true')
  const placementForm = page.getByRole('form', { name: 'Placement', exact: true })
  await placementForm.getByLabel('Type label', { exact: true }).fill('Relay Beacon')
  await placementToggle.click()
  await clickNormalizedSystemPoint(page, map, { x: 0.25, y: 0.25 })

  const guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Apply and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()

  await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  const afterAdd = await downloadJson(page, 'Export star system JSON')
  const addedObject = afterAdd.system?.objects.find(object =>
    !before.system!.objects.some(existing => existing.id === object.id),
  )
  expect(afterAdd.system?.objects).toHaveLength(before.system!.objects.length + 1)
  expect(addedObject?.subtype).toBe('Relay Beacon')
  expect(afterAdd.system?.objects.find(object => object.id === primaryStarId)?.name).toBe('Unapplied Primary Star')
  expectSystemPlacement(addedObject?.placement, mapPoint)
  await expect(controls).toBeVisible()
  await expect(inspector).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
})

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

test('system Add immediately places on repeated clicks and reloads both placements', async ({ page }) => {
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
  await expect(inspector).toBeHidden()

  const firstPoint = { x: 0.25, y: 0.25 }
  const firstDeliveredPoint = await clickNormalizedSystemPoint(page, map, firstPoint)
  const confirmPlacement = page.getByRole('button', { name: 'Confirm placement', exact: true })
  await expect(confirmPlacement).toHaveCount(0)
  const afterFirstClick = await downloadJson(page, 'Export star system JSON')
  const firstPlanets = afterFirstClick.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(firstPlanets).toHaveLength(1)
  expectSystemPlacement(firstPlanets[0]?.placement, firstDeliveredPoint)
  await expect(inspector).toBeVisible()

  const secondPoint = { x: 0.75, y: 0.75 }
  const secondDeliveredPoint = await clickNormalizedSystemPoint(page, map, secondPoint)
  await expect(confirmPlacement).toHaveCount(0)
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspector).toBeVisible()

  const afterSecondClick = await downloadJson(page, 'Export star system JSON')
  const placedPlanets = afterSecondClick.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(placedPlanets).toHaveLength(2)
  expectSystemPlacement(placedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(placedPlanets[1]?.placement, secondDeliveredPoint)

  await page.reload()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  const afterReload = await downloadJson(page, 'Export star system JSON')
  const reloadedPlanets = afterReload.system?.objects.filter(object => object.subtype === 'planet') ?? []
  expect(reloadedPlanets).toHaveLength(2)
  expectSystemPlacement(reloadedPlanets[0]?.placement, firstDeliveredPoint)
  expectSystemPlacement(reloadedPlanets[1]?.placement, secondDeliveredPoint)
})

test('explicit Move exits Add when Move is already active', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  const inspector = page.locator('#workspace-inspector-panel')
  if (await inspector.isVisible()) await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeHidden()

  const navigation = workspaceNavigation(page)
  const move = navigation.getByRole('button', { name: 'Move', exact: true })
  const addTrigger = navigation.getByRole('button', { name: 'Add to map', exact: true })
  await move.click()
  await expect(move).toHaveAttribute('aria-pressed', 'true')

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const beforeAdd = await downloadJson(page, 'Export star system JSON')
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const controls = page.getByRole('group', { name: 'Planet creation controls', exact: true })
  await expect(controls).toBeVisible()
  await expect(addTrigger).toContainText('Planet')
  await page.setViewportSize({ width: 390, height: 844 })
  const compactAddBounds = await addTrigger.boundingBox()
  if (!compactAddBounds) throw new Error('The Add button is not visible at a 390px viewport width.')
  expect(compactAddBounds.x).toBeGreaterThanOrEqual(0)
  expect(compactAddBounds.x + compactAddBounds.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.setViewportSize({ width: 1440, height: 960 })

  await move.click()
  await expect(controls).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true }))
    .toHaveCount(0)
  await expect(addTrigger).toHaveAttribute('aria-pressed', 'false')
  await expect(addTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(addTrigger).toHaveAccessibleName('Add to map')
  await expect(addTrigger.getByText('Add', { exact: true })).toBeVisible()
  await expect(addTrigger.locator('kbd')).toHaveText('A')
  await expect(addTrigger.locator('#workspace-dock-add-type')).toHaveCount(0)
  await expect(move).toHaveAttribute('aria-pressed', 'true')

  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Primary Star/ }).locator('.object-hit-target'),
    { x: 640, y: 400 },
  )
  const afterMove = await downloadJson(page, 'Export star system JSON')
  expect(afterMove.system?.objects).toHaveLength(beforeAdd.system!.objects.length)
  const originalStar = beforeAdd.system!.objects.find(object => object.subtype === 'star')
  const movedStar = afterMove.system?.objects.find(object => object.subtype === 'star')
  expect(movedStar?.placement).not.toEqual(originalStar?.placement)
})

test('Orbit form Add retains its host, corrects each axis, and retries one applied write', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await waitForWorkspaceSaved(page)
  const inspector = page.locator('#workspace-inspector-panel')
  const starHierarchy = await openWorkspaceHierarchy(page)
  await starHierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
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
  const afterReload = await downloadJson(page, 'Export star system JSON')
  expect(afterReload.system?.orbits).toHaveLength(1)
  expect(afterReload.system?.orbits[0]?.hostId).toBe(afterReload.system?.objects[0]?.id)
  expect(afterReload.layout.orbitRadii[afterReload.system!.orbits[0]!.id])
    .toEqual({ horizontal: 39, vertical: 80 })
  expect(afterReload.layout.orbitRotations?.[afterReload.system!.orbits[0]!.id]).toBe(37)
})

test('Add chooser dismissal consumes outside contact and preserves the next right-pan', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
  await addToggle.click()
  await page.getByRole('button', { name: 'Add orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  await expect(controls).toBeVisible()
  const beforeOutsideDismissal = await downloadJson(page, 'Export star system JSON')

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
  await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
  const afterOutsideDismissal = await downloadJson(page, 'Export star system JSON')
  expect(afterOutsideDismissal.system).toEqual(beforeOutsideDismissal.system)
  expect(afterOutsideDismissal.layout).toEqual(beforeOutsideDismissal.layout)

  // A valid map click adds immediately; opening the chooser and right-dragging outside it must not add again.
  await clickNormalizedSystemPoint(page, map, { x: 0.5, y: 0.5 })
  const afterMapAdd = await downloadJson(page, 'Export star system JSON')
  expect(afterMapAdd.system?.orbits).toHaveLength(1)
  const viewportBeforeRightDismissal = await map.locator('.system-map-content').getAttribute('transform')
  if (viewportBeforeRightDismissal === null) throw new Error('The system map has no viewport transform to preserve.')
  const memoryBeforeRightDismissal = afterMapAdd
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
  await expect(page.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  await expect(map.locator('.system-creation-preview')).toHaveCount(0)
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
})

test('an Orbit draft blocks same-host Orbit creation and is resolved before object Add changes Inspect', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await returnToClusterMap(page)

  await setJsonFile(
    jsonMapImportInput(page),
    'dense-reach.json',
    JSON.stringify(creationGeometryFixture),
  )
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  await resolveImportReview(preview, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Dense Reach system map', exact: true }).click()
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await hierarchy.getByRole('treeitem', { name: /^Orbit 1 around Primary Star,/ }).click()

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
  await expect(confirm).toHaveCount(0)
  await expect(controls.getByRole('alert')).toHaveCount(0)
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
  // Alpha and beta overlap here; choose Alpha to confirm the placement target before Inspect hands off.
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
  const inspectorGuard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(inspectorGuard.getByRole('button', { name: 'Apply and continue', exact: true })).toBeVisible()
  await inspectorGuard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(inspectorGuard).toBeHidden()
  await expect(confirmPlanet).toHaveCount(0)
  const afterNamedChoice = await downloadJson(page, 'Export star system JSON')
  expect(afterNamedChoice.system?.objects).toHaveLength(initial.system!.objects.length + 1)
  expect(afterNamedChoice.layout.orbitRadii[primaryOrbit.id]).toMatchObject({ horizontal: Number(modifiedRadius) })
  const namedPlanet = afterNamedChoice.system!.objects.find(object =>
    !initial.system!.objects.some(existing => existing.id === object.id),
  )
  expect(namedPlanet?.subtype).toBe('planet')
  expect(namedPlanet?.placement).toEqual({ kind: 'orbit', orbitId: primaryOrbit.id })

  // A free map click also adds immediately and updates the retained Placement target.
  const orbitPlacement = page.getByLabel('Orbit placement', { exact: true })
  const placementToggle = planetControls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await expect.poll(() => readInspectorSelection(orbitPlacement))
    .toBe(`Orbit ${primaryOrbit.order} around ${primary.name}`)
  if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
  const freePoint = await clickNormalizedSystemPoint(page, map, { x: 0.9, y: 0.1 })
  await expect(confirmPlanet).toHaveCount(0)
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await expect(placementToggle).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(() => readInspectorSelection(orbitPlacement)).toBe('Free map position')
  await expect(page.getByLabel('Placement X', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Placement Y', { exact: true })).toHaveCount(0)
  const afterFreeMapAdd = await downloadJson(page, 'Export star system JSON')
  expect(afterFreeMapAdd.system?.objects).toHaveLength(initial.system!.objects.length + 2)
  const freePlanet = afterFreeMapAdd.system!.objects.find(object =>
    !initial.system!.objects.some(existing => existing.id === object.id)
      && object.id !== namedPlanet?.id,
  )
  expectSystemPlacement(freePlanet?.placement, freePoint)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue(freePlanet!.name)
  await expect(inspector.getByRole('button', { name: 'Apply changes Save map object', exact: true })).toBeVisible()

  await ensurePlacementOpen(planetControls)
  await selectInspectorOption(orbitPlacement, `Orbit ${primaryOrbit.order} around ${primary.name}`)
  await ensurePlacementOpen(planetControls)
  await expect(page.getByLabel('Angle (degrees)', { exact: true })).toHaveCount(0)
  if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
  await clickSystemOrbitPoint(page, map, `Orbit ${primaryOrbit.order} around ${primary.name}`, 45)
  await expect(confirmPlanet).toHaveCount(0)
  await expect(planetControls.getByRole('alert')).toHaveCount(0)
  const afterResolvedObjectAdd = await downloadJson(page, 'Export star system JSON')
  expect(afterResolvedObjectAdd.system?.orbits).toHaveLength(originalOrbitCount + 1)
  expect(afterResolvedObjectAdd.system?.objects).toHaveLength(initial.system!.objects.length + 3)
  const newPlanets = afterResolvedObjectAdd.system!.objects.filter(object =>
    !initial.system!.objects.some(existing => existing.id === object.id),
  )
  expect(newPlanets.map(object => object.subtype)).toEqual(['planet', 'planet', 'planet'])
  expect(newPlanets[0]?.placement).toEqual({ kind: 'orbit', orbitId: primaryOrbit.id })
  expect(newPlanets[1]?.placement).toEqual(freePlanet?.placement)
  expect(newPlanets[2]?.placement).toEqual({ kind: 'orbit', orbitId: primaryOrbit.id })
  expect(afterResolvedObjectAdd.layout.objectAngles[newPlanets[2]!.id]).toBeCloseTo(Math.PI / 4, 1)
  expect(afterResolvedObjectAdd.layout.objectAngles[oldPlanet.id]).toBeDefined()
  const oldMoon = initial.system!.objects.find(object => object.name === 'Old Moon')!
  expect(afterResolvedObjectAdd.layout.objectAngles[oldMoon.id]).toBeDefined()
  expect(afterResolvedObjectAdd.system!.orbits.find(orbit => orbit.id === primaryOrbit.id)).toEqual(primaryOrbit)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue(newPlanets[2]!.name)
  await expect(inspector.getByRole('button', { name: 'Apply changes Save map object', exact: true })).toBeVisible()
})
