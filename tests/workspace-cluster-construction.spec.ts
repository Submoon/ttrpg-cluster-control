import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  downloadJson,
  dockAction,
  returnToClusterMap,
  workspaceNavigation,
  workspaceZoomControls,
  type ExportedMap,
  type WorldPoint,
} from './helpers'

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
}

async function clickNormalizedClusterPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<WorldPoint> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const target = await map.evaluate((element, normalized) => {
      const content = element.querySelector<SVGGElement>('.cluster-map-content')
      const transform = content?.getScreenCTM()
      if (!transform) throw new Error('The cluster map content is not attached to the document.')

      const requestedScenePoint = new DOMPoint(
        112 + normalized.x * 736,
        96 + normalized.y * 368,
      ).matrixTransform(transform)
      const clickPoint = {
        x: Math.floor(requestedScenePoint.x),
        y: Math.floor(requestedScenePoint.y),
      }
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(clickPoint.x, clickPoint.y)
      const deliveredScenePoint = new DOMPoint(clickPoint.x, clickPoint.y)
        .matrixTransform(transform.inverse())

      return {
        clickPoint,
        deliveredPoint: {
          x: (deliveredScenePoint.x - 112) / 736,
          y: (deliveredScenePoint.y - 96) / 368,
        },
        reachable: clickPoint.x >= Math.max(0, bounds.left)
          && clickPoint.y >= Math.max(0, bounds.top)
          && clickPoint.x < Math.min(window.innerWidth, bounds.right)
          && clickPoint.y < Math.min(window.innerHeight, bounds.bottom)
          && !!hit
          && (hit === element || element.contains(hit)),
      }
    }, point)

    if (target.reachable) {
      await page.mouse.click(target.clickPoint.x, target.clickPoint.y)
      return target.deliveredPoint
    }
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }

  throw new Error(`Normalized cluster point (${point.x}, ${point.y}) is unreachable after public Zoom out recovery.`)
}

function expectSystemPosition(actual: WorldPoint | undefined, expected: WorldPoint): void {
  expect(actual).toBeDefined()
  if (!actual) return
  // The delivered native mouse coordinates are integer CSS pixels; the map stores normalized floats.
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

function expectSystemAddArmed(page: import('@playwright/test').Page): Promise<void[]> {
  const addButton = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  const context = page.getByRole('navigation', { name: 'Map context and commands', exact: true })

  return Promise.all([
    expect(addButton).toContainText(/system/i),
    expect(context.getByRole('status')).toContainText(/add.*system/i),
    expect(context.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible(),
  ])
}

function expectPositionsAdded(
  before: ExportedMap,
  after: ExportedMap,
  expected: WorldPoint[],
): string[] {
  expect(before.type).toBe('cluster')
  expect(after.type).toBe('cluster')
  expect(after.cluster?.systems).toHaveLength((before.cluster?.systems.length ?? 0) + expected.length)

  const previousIds = new Set(before.cluster?.systems.map(system => system.id) ?? [])
  const created = after.cluster?.systems.filter(system => !previousIds.has(system.id)) ?? []
  expect(created).toHaveLength(expected.length)

  return expected.map((point) => {
    const system = created.find(candidate => {
      const position = after.layout.systemPositions?.[candidate.id]
      return position !== undefined
        && Math.abs(position.x - point.x) < 0.000001
        && Math.abs(position.y - point.y) < 0.000001
    })
    expect(system).toBeDefined()
    if (!system) throw new Error('The cluster export does not contain a system at the expected position.')
    expectSystemPosition(after.layout.systemPositions?.[system.id], point)
    return system.id
  })
}

test('Add System places two systems at targeted cluster points and reloads their coordinates', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await returnToClusterMap(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  const beforeAdding = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeAdding.type).toBe('cluster')
  expect(beforeAdding.cluster?.systems).toHaveLength(1)

  await (await dockAction(page, 'Add star system')).click()

  // Add System is a placement mode: choosing it keeps this map active and does not open Inspect.
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: /star system map$/i })).toHaveCount(0)
  await expect(inspector).toBeHidden()
  await expectSystemAddArmed(page)

  const firstPoint = { x: 0.45, y: 0.1 }
  const firstDeliveredPoint = await clickNormalizedClusterPoint(page, clusterMap, firstPoint)
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: /star system map$/i })).toHaveCount(0)
  await expect(inspector).toBeHidden()
  await expectSystemAddArmed(page)

  const secondPoint = { x: 0.84, y: 0.78 }
  const secondDeliveredPoint = await clickNormalizedClusterPoint(page, clusterMap, secondPoint)
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('group', { name: /star system map$/i })).toHaveCount(0)
  await expect(inspector).toBeHidden()
  await expectSystemAddArmed(page)

  const afterBothAdds = await downloadJson(page, 'Export Jump Cluster JSON')
  const createdIds = expectPositionsAdded(
    beforeAdding,
    afterBothAdds,
    [firstDeliveredPoint, secondDeliveredPoint],
  )
  const firstCreatedId = createdIds[0]!
  const secondCreatedId = createdIds[1]!

  await page.reload()
  await returnToClusterMap(page)
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()
  await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })).toBeVisible()
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterReload.cluster?.systems).toHaveLength(3)
  expectSystemPosition(afterReload.layout.systemPositions?.[firstCreatedId], firstDeliveredPoint)
  expectSystemPosition(afterReload.layout.systemPositions?.[secondCreatedId], secondDeliveredPoint)
})

test('Add System rejects an occupied map point and accepts a clear point without coordinate fields', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await returnToClusterMap(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const existingSystem = before.cluster?.systems[0]
  expect(existingSystem).toBeDefined()
  if (!existingSystem) throw new Error('The cluster export does not contain its first system.')
  const occupiedPoint = before.layout.systemPositions?.[existingSystem.id]
  expect(occupiedPoint).toBeDefined()
  if (!occupiedPoint) throw new Error('The first system has no saved Cluster position.')
  await (await dockAction(page, 'Add star system')).click()
  await expect(page.getByRole('textbox', { name: /System position [XY]/ })).toHaveCount(0)
  await expect(workspaceNavigation(page).getByText('Click a clear point on the Cluster map to add a system.', { exact: true })).toBeVisible()

  await clickNormalizedClusterPoint(page, map, occupiedPoint)
  await expect(page.getByRole('alert')).toContainText('Choose an open point clear of existing systems.')
  const afterInvalid = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterInvalid).toEqual(before)

  const target = { x: 0.84, y: 0.78 }
  const deliveredTarget = await clickNormalizedClusterPoint(page, map, target)
  await expect(map).toBeVisible()
  await expect(inspector).toBeHidden()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)

  const afterCorrected = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterCorrected.cluster?.systems).toHaveLength(2)
  const newSystem = afterCorrected.cluster?.systems.find(system => system.name === 'New System 2')
  expect(newSystem).toBeDefined()
  expectSystemPosition(afterCorrected.layout.systemPositions?.[newSystem!.id], deliveredTarget)
})

test('Add System can be created from the keyboard at the panned Cluster viewport center', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await returnToClusterMap(page)

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const firstSystem = before.cluster?.systems[0]
  expect(firstSystem).toBeDefined()
  if (!firstSystem) throw new Error('The cluster export does not contain its first system.')
  const firstPosition = before.layout.systemPositions?.[firstSystem.id]
  expect(firstPosition).toBeDefined()
  if (!firstPosition) throw new Error('The first system has no saved Cluster position.')

  await (await dockAction(page, 'Add star system')).click()
  await expect(map).toBeFocused()
  const content = map.locator('.cluster-map-content')
  const viewportBeforePan = await content.getAttribute('transform')
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('ArrowLeft')
  await expect.poll(() => content.getAttribute('transform')).not.toBe(viewportBeforePan)
  const keyboardTarget = await map.evaluate((element) => {
    const contentElement = element.querySelector<SVGGElement>('.cluster-map-content')
    const matrix = contentElement?.getScreenCTM()
    if (!matrix) throw new Error('The Cluster map content is not attached to the document.')
    const bounds = element.getBoundingClientRect()
    const point = new DOMPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      .matrixTransform(matrix.inverse())
    return { x: (point.x - 112) / 736, y: (point.y - 96) / 368 }
  })
  expect(keyboardTarget.x).toBeGreaterThanOrEqual(0)
  expect(keyboardTarget.x).toBeLessThanOrEqual(1)
  expect(Math.abs(keyboardTarget.x - firstPosition.x) * 736).toBeGreaterThanOrEqual(156)
  await page.keyboard.press('Enter')

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.cluster?.systems).toHaveLength((before.cluster?.systems.length ?? 0) + 1)
  const addedSystem = after.cluster?.systems.find(system => system.name === 'New System 2')
  expect(addedSystem).toBeDefined()
  const addedPosition = after.layout.systemPositions?.[addedSystem!.id]
  expect(addedPosition).toBeDefined()
  expect(Math.abs(addedPosition!.x - firstPosition.x) * 736).toBeGreaterThanOrEqual(156)
  expect(addedPosition!.y).toBeCloseTo(firstPosition.y, 2)
  await expect(page.getByRole('textbox', { name: /System position [XY]/ })).toHaveCount(0)
})
