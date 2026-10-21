import { expect, test } from '@playwright/test'
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
    expect(context.getByRole('button', { name: 'Quit Add and return to Navigate', exact: true })).toBeVisible(),
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

test('Add System keeps coordinate errors visible while closed and accepts a corrected numeric point', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)
  await returnToClusterMap(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  await (await dockAction(page, 'Add star system')).click()
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()

  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  await placement.click()
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill('1.2')
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill('0.7')
  await page.getByRole('button', { name: 'Add at coordinates', exact: true }).click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('alert')).toContainText('X must be between 0 and 1.')
  const afterInvalid = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterInvalid).toEqual(before)

  const target = { x: 0.84, y: 0.78 }
  await placement.click()
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill(String(target.x))
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill(String(target.y))
  await page.getByRole('button', { name: 'Add at coordinates', exact: true }).click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  await expect(map).toBeVisible()
  await expect(inspector).toBeHidden()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)

  const afterCorrected = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterCorrected.cluster?.systems).toHaveLength(2)
  const newSystem = afterCorrected.cluster?.systems.find(system => system.name === 'New System 2')
  expect(newSystem).toBeDefined()
  expectSystemPosition(afterCorrected.layout.systemPositions?.[newSystem!.id], target)
})
