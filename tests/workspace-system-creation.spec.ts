import { expect, test } from './fixtures'
import { waitForWorkspaceSaved } from './helpers'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickNormalizedSystemPoint,
  dockAction,
  downloadJson,
  openWorkspaceHierarchy,
  readInspectorSelection,
  selectCatalogueObjectButton,
  selectInspectorOption,
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

  await test.step('Three clicks on the same host in one Add Orbit session create distinct rings', async () => {
    const host = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
      .locator('.object-hit-target')
    const rings = map.getByRole('group', { name: /^Orbit \d+ around Primary Star$/ }).locator('.orbit-ring')
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
      await host.click()
      await expect(rings).toHaveCount(count)
      const current = await readRings()
      expect(current).toEqual(expect.arrayContaining(previous))
      previous = current
    }
    await expect(quitAdd).toBeVisible()
    expect(new Set(previous.map(ring => JSON.stringify(ring.geometry))).size, 'distinct rings').toBe(3)
  })
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
