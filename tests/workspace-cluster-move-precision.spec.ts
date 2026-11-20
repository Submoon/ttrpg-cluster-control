import { expect, test } from './fixtures'
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  clickNormalizedClusterPoint,
  downloadJson,
  fitWorkspaceMap,
  wardenMap,
  wardenSystemMark,
  workspaceNavigation,
  type WorldPoint,
} from './helpers'

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await fitWorkspaceMap(page)
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

  const clusterMap = wardenMap(page)
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(clusterMap).toBeVisible()
  const beforeMove = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeMove.type).toBe('cluster')
  const source = beforeMove.cluster?.systems.find(system => system.name === 'Vesper')
  expect(source).toBeDefined()
  if (!source) throw new Error('The cluster export does not contain Vesper.')
  const originalPosition = beforeMove.layout.systemPositions?.[source.id]
  expect(originalPosition).toBeDefined()
  const sourceNode = wardenSystemMark(page, source.id)

  const moveMode = workspaceNavigation(page)
    .getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Move', exact: true })
  await moveMode.click()
  const sourceName = clusterMap.locator(`.continuous-warden-name-target[data-system-id="${source.id}"]`)
  const nameBounds = await sourceName.locator('.continuous-warden-name-background').boundingBox()
  if (!nameBounds) throw new Error('Vesper needs a visible painted system name for native selection.')
  const selectionPoint = { x: Math.round(nameBounds.x + nameBounds.width / 2), y: Math.round(nameBounds.y + nameBounds.height / 2) }
  // A revealed Primary Star can cover the anchor center; the painted name remains the system target.
  expect(await sourceName.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), selectionPoint)).toBe(true)
  await page.mouse.click(selectionPoint.x, selectionPoint.y)
  await expect(sourceNode).toHaveClass(/is-selected/)
  await expect(inspector).toBeHidden()
  const anchorPosition = () => sourceNode.evaluate(element => {
    const transforms = (element as SVGGElement).transform.baseVal
    if (!transforms.numberOfItems) throw new Error('The system anchor has no scene translation.')
    // The following badge scale tracks the camera independently of this scene translation.
    const matrix = transforms.getItem(0).matrix
    return { x: matrix.e, y: matrix.f }
  })
  const originalAnchor = await anchorPosition()

  await expect(page.getByRole('textbox', { name: /System position [XY]/ })).toHaveCount(0)
  const moveOnMap = workspaceNavigation(page).getByRole('button', { name: 'Move selected system on map', exact: true })
  await expect(moveOnMap).toBeVisible()
  const mapTarget = { x: 0.82, y: 0.2 }
  await moveOnMap.click()
  await expect.poll(() => clusterMap.evaluate(map => document.activeElement === map)).toBe(true)
  await clickNormalizedClusterPoint(page, clusterMap, mapTarget)
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect.poll(anchorPosition).not.toEqual(originalAnchor)
  const afterMapPreview = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapPreview).toEqual(beforeMove)

  await page.getByRole('button', { name: 'Cancel system move', exact: true }).click()
  await expect.poll(anchorPosition).toEqual(originalAnchor)
  const afterMapCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterMapCancel).toEqual(beforeMove)

  await moveOnMap.click()
  await page.keyboard.press('ArrowRight')
  await expect(mapContext.locator('.workspace-add-status')).toContainText(/move.*preview/i)
  await expect.poll(anchorPosition).not.toEqual(originalAnchor)
  await page.getByRole('button', { name: 'Confirm system move', exact: true }).click()
  const afterConfirm = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterConfirm.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expect(afterConfirm.layout.systemPositions?.[source.id]?.x).toBeCloseTo(originalPosition!.x + 1 / 736, 8)
  expect(afterConfirm.layout.systemPositions?.[source.id]?.y).toBeCloseTo(originalPosition!.y, 8)
  await waitForWorkspaceSaved(page)

  await page.reload()
  await fitWorkspaceMap(page)
  if (await inspector.isVisible()) await inspectToggle.click()
  await expect(inspector).toBeHidden()
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterReload.cluster?.systems).toHaveLength(beforeMove.cluster?.systems.length ?? 0)
  expectPosition(afterReload.layout.systemPositions?.[source.id], afterConfirm.layout.systemPositions![source.id]!)
})
