import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickNormalizedClusterPoint,
  downloadJson,
  dragBy,
  openWorkspaceHierarchy,
  returnToClusterMap,
  workspaceNavigation,
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

function expectPosition(actual: WorldPoint | undefined, expected: WorldPoint): void {
  expect(actual).toBeDefined()
  expect(actual?.x).toBe(expected.x)
  expect(actual?.y).toBe(expected.y)
}

test('Move System previews map and keyboard destinations, cancels without changing JSON, then confirms and reloads', async ({ page }) => {
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

  await expect(page.getByRole('textbox', { name: /System position [XY]/ })).toHaveCount(0)
  const moveOnMap = workspaceNavigation(page).getByRole('button', { name: 'Move selected system on map', exact: true })
  await expect(moveOnMap).toBeVisible()
  const mapTarget = { x: 0.82, y: 0.2 }
  await moveOnMap.click()
  await expect.poll(() => clusterMap.evaluate(map => document.activeElement === map)).toBe(true)
  await clickNormalizedClusterPoint(page, clusterMap, mapTarget)
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)
  const afterMapPreview = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapPreview).toEqual(beforeMove)

  await page.getByRole('button', { name: 'Cancel system move', exact: true }).click()
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)
  const afterMapCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapCancel).toEqual(beforeMove)

  await moveOnMap.click()
  await page.keyboard.press('ArrowRight')
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)
  await page.getByRole('button', { name: 'Confirm system move', exact: true }).click()
  const afterConfirm = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterConfirm.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expect(afterConfirm.layout.systemPositions?.[source.id]?.x).toBeCloseTo(originalPosition!.x + 1 / 736, 8)
  expect(afterConfirm.layout.systemPositions?.[source.id]?.y).toBeCloseTo(originalPosition!.y, 8)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await returnToClusterMap(page)
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterReload.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expectPosition(afterReload.layout.systemPositions?.[source.id], afterConfirm.layout.systemPositions![source.id]!)
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
  const originalMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const originalNode = originalMap.getByRole('button', { name: 'Select Vesper system', exact: true })
  await workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Move', exact: true }).click()
  await originalNode.click()
  const originalTransform = await originalNode.getAttribute('transform')

  const moveOnMap = workspaceNavigation(page).getByRole('button', { name: 'Move selected system on map', exact: true })
  await moveOnMap.click()
  const deliveredTarget = await clickNormalizedClusterPoint(page, originalMap, target)
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
  expect(afterConfirm.layout.systemPositions?.[source.id]?.x).toBeCloseTo(deliveredTarget.x, 7)
  expect(afterConfirm.layout.systemPositions?.[source.id]?.y).toBeCloseTo(deliveredTarget.y, 7)
})

test('Move-mode direct dragging still commits before the explicit preview action is armed', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createWorkspace(page)

  const inspector = page.locator('#workspace-inspector-panel')
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const source = before.cluster?.systems.find(system => system.name === 'Vesper')
  if (!source) throw new Error('The cluster export does not contain Vesper.')
  const beforePosition = before.layout.systemPositions?.[source.id]
  expect(beforePosition).toBeDefined()
  const sourceNode = clusterMap.getByRole('button', { name: 'Select Vesper system', exact: true })
  await workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Move', exact: true }).click()
  await sourceNode.click()
  await expect(workspaceNavigation(page)
    .getByRole('button', { name: 'Move selected system on map', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm system move', exact: true })).toHaveCount(0)

  const originalTransform = await sourceNode.getAttribute('transform')
  await dragBy(page, sourceNode.locator('.cluster-system-card'), { x: 36, y: 24 })
  const movedNode = clusterMap.getByRole('button', { name: 'Select Vesper system', exact: true })
  await expect(movedNode).not.toHaveAttribute('transform', originalTransform!)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.cluster?.systems).toHaveLength(before.cluster?.systems.length ?? 0)
  expect(after.layout.systemPositions?.[source.id]).not.toEqual(beforePosition)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await returnToClusterMap(page)
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expectPosition(afterReload.layout.systemPositions?.[source.id], after.layout.systemPositions![source.id]!)
})
