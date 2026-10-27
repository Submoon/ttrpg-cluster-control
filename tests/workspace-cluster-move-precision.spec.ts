import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  openWorkspaceHierarchy,
  returnToClusterMap,
  workspaceNavigation,
  zoomOutMapToMinimum,
  type WorldPoint,
} from './helpers'

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await returnToClusterMap(page)
}

async function ensurePlacementOpen(page: import('@playwright/test').Page): Promise<void> {
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(placement).toHaveAttribute('aria-expanded', 'true')
}

async function clickClusterPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  normalized: WorldPoint,
): Promise<void> {
  const screenPoint = await map.evaluate((element, point) => {
    const content = element.querySelector<SVGGElement>('.cluster-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The cluster map content is not attached to the document.')
    const requested = new DOMPoint(112 + point.x * 736, 96 + point.y * 368).matrixTransform(transform)
    return { x: Math.floor(requested.x), y: Math.floor(requested.y) }
  }, normalized)
  await page.mouse.click(screenPoint.x, screenPoint.y)
}

function expectPosition(actual: WorldPoint | undefined, expected: WorldPoint): void {
  expect(actual).toBeDefined()
  expect(actual?.x).toBe(expected.x)
  expect(actual?.y).toBe(expected.y)
}

test('Move System previews numeric cluster coordinates, cancels without changing JSON, then confirms and reloads', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(clusterMap).toBeVisible()
  const beforeMove = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeMove.type).toBe('cluster')
  const source = beforeMove.cluster?.systems.find(system => system.name === 'Vesper')
  expect(source).toBeDefined()
  if (!source) throw new Error('The cluster export does not contain Vesper.')
  const originalPosition = beforeMove.layout.systemPositions?.[source.id]
  expect(originalPosition).toBeDefined()
  const sourceNode = clusterMap.getByRole('button', { name: 'Select Vesper system', exact: true })

  const moveMode = workspaceNavigation(page)
    .getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Move', exact: true })
  await moveMode.click()
  await sourceNode.click()
  await expect(sourceNode).toHaveClass(/is-selected/)
  await expect(inspector).toBeHidden()
  const originalTransform = await sourceNode.getAttribute('transform')
  expect(originalTransform).toBeTruthy()

  const target = { x: 0.65, y: 0.6 }
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()

  const mapTarget = { x: 0.82, y: 0.2 }
  await zoomOutMapToMinimum(page)
  await clickClusterPoint(page, clusterMap, mapTarget)
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)
  const afterMapPreview = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapPreview).toEqual(beforeMove)

  await page.getByRole('button', { name: 'Cancel system move', exact: true }).click()
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)
  const afterMapCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapCancel).toEqual(beforeMove)

  await ensurePlacementOpen(page)
  await expect(page.getByRole('textbox', { name: 'System position X', exact: true })).toHaveValue(String(originalPosition!.x))
  await expect(page.getByRole('textbox', { name: 'System position Y', exact: true })).toHaveValue(String(originalPosition!.y))
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill(String(target.x))
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill(String(target.y))
  await page.getByRole('button', { name: 'Preview move', exact: true }).click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)
  await page.getByRole('button', { name: 'Cancel system move', exact: true }).click()
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)

  await ensurePlacementOpen(page)
  await expect(page.getByRole('textbox', { name: 'System position X', exact: true })).toHaveValue(String(originalPosition!.x))
  await expect(page.getByRole('textbox', { name: 'System position Y', exact: true })).toHaveValue(String(originalPosition!.y))
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill(String(target.x))
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill(String(target.y))
  await page.getByRole('button', { name: 'Preview move', exact: true }).click()
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)
  await page.getByRole('button', { name: 'Confirm system move', exact: true }).click()
  const afterConfirm = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterConfirm.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expectPosition(afterConfirm.layout.systemPositions?.[source.id], target)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await returnToClusterMap(page)
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterReload.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expectPosition(afterReload.layout.systemPositions?.[source.id], target)
})

test('Move System keeps its preview visible after applying an independent chart-name change', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const beforeMove = await downloadJson(page, 'Export Jump Cluster JSON')
  const source = beforeMove.cluster?.systems.find(system => system.name === 'Vesper')
  if (!source) throw new Error('The cluster export does not contain Vesper.')
  const target = { x: 0.72, y: 0.24 }
  const originalNode = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
    .getByRole('button', { name: 'Select Vesper system', exact: true })
  await workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Move', exact: true }).click()
  await originalNode.click()
  const originalTransform = await originalNode.getAttribute('transform')

  await ensurePlacementOpen(page)
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill(String(target.x))
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill(String(target.y))
  await page.getByRole('button', { name: 'Preview move', exact: true }).click()
  await expect(originalNode).not.toHaveAttribute('transform', originalTransform!)

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartDialog.getByLabel('Jump Cluster').fill('Kestrel Reach Updated')
  await chartDialog.getByRole('button', { name: 'Apply names' }).click()
  await expect(chartDialog).toBeHidden()

  const updatedMap = page.getByRole('group', { name: 'Kestrel Reach Updated Jump Cluster map', exact: true })
  const updatedNode = updatedMap.getByRole('button', { name: 'Select Vesper system', exact: true })
  await expect(updatedMap).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Map context and commands', exact: true })
    .locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect(updatedNode).not.toHaveAttribute('transform', originalTransform!)
  await expect(page.getByRole('button', { name: 'Confirm system move', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Confirm system move', exact: true }).click()
  const afterConfirm = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterConfirm.cluster?.name).toBe('Kestrel Reach Updated')
  expectPosition(afterConfirm.layout.systemPositions?.[source.id], target)
})
