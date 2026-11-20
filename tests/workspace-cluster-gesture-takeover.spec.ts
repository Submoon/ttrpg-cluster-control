import { expect, test, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  dockAction,
  downloadJson,
  fitWorkspaceMap,
  wardenMap,
  wardenSystemMark,
  workspaceNavigation,
} from './helpers'


type TouchPoint = { id: number; x: number; y: number }


async function enableTouch(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
  return cdp
}

async function dispatchTouch(
  cdp: Awaited<ReturnType<typeof enableTouch>>,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: TouchPoint[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(point => ({ ...point, radiusX: 2, radiusY: 2, force: 1 })),
  })
}

async function createWorkspace(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await fitWorkspaceMap(page)
  const inspector = page.locator('#workspace-inspector-panel')
  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspect.click()
  await expect(inspector).toBeHidden()
}

async function beginTwoContactViewGesture(
  page: Page,
  cdp: Awaited<ReturnType<typeof enableTouch>>,
  map: import('@playwright/test').Locator,
): Promise<void> {
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The cluster map has no visible bounds for touch input.')
  const first: TouchPoint = {
    id: 1,
    x: bounds.x + bounds.width * 0.28,
    y: bounds.y + bounds.height * 0.36,
  }
  const second: TouchPoint = {
    id: 2,
    x: bounds.x + bounds.width * 0.7,
    y: bounds.y + bounds.height * 0.4,
  }
  const firstMove = { ...first, x: first.x - 12, y: first.y + 14 }
  const secondMove = { ...second, x: second.x + 30, y: second.y + 18 }
  const scene = map.locator('.cluster-map-content')
  const viewportBefore = await scene.getAttribute('transform')

  await dispatchTouch(cdp, 'touchStart', [first])
  await dispatchTouch(cdp, 'touchStart', [first, second])
  await dispatchTouch(cdp, 'touchMove', [firstMove, secondMove])
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportBefore)
  await dispatchTouch(cdp, 'touchEnd', [])
  await page.waitForTimeout(80)
}



test('cluster two-contact takeover cancels an active anchor drag without selecting or adding a system', async ({ page }) => {
  await captureMapExportBlobs(page)
  const cdp = await enableTouch(page)
  await createWorkspace(page)

  const map = wardenMap(page)
  const inspector = page.locator('#workspace-inspector-panel')
  const before = await downloadJson(page, 'Export Jump Cluster JSON')

  try {
    const modeButtons = workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    await modeButtons.getByRole('button', { name: 'Move', exact: true }).click()
    const sourceId = before.cluster?.systems[0]?.id
    if (!sourceId) throw new Error('The saved Cluster is missing its source anchor.')
    const sourceNode = wardenSystemMark(page, sourceId)
    const sourceName = map.locator(`.continuous-warden-name-target[data-system-id="${sourceId}"]`)
    const originalTransform = await sourceNode.getAttribute('transform')
    await sourceName.click()
    await expect(inspector).toBeHidden()
    const mapBounds = await map.boundingBox()
    const sourceBounds = await sourceNode.boundingBox()
    if (!mapBounds || !sourceBounds) throw new Error('The selected system has no visible bounds for touch input.')
    const scene = map.locator('.cluster-map-content')
    const viewportBefore = await scene.getAttribute('transform')
    const dragStart: TouchPoint = {
      id: 1,
      x: sourceBounds.x + sourceBounds.width / 2,
      y: sourceBounds.y + sourceBounds.height / 2,
    }
    const dragMove = { ...dragStart, x: dragStart.x + 24, y: dragStart.y + 18 }
    await dispatchTouch(cdp, 'touchStart', [dragStart])
    await dispatchTouch(cdp, 'touchMove', [dragMove])
    await expect.poll(() => sourceNode.getAttribute('transform')).not.toBe(originalTransform)

    const direction = dragMove.x < mapBounds.x + mapBounds.width / 2 ? 1 : -1
    const secondStart: TouchPoint = {
      id: 2,
      x: direction > 0 ? mapBounds.x + mapBounds.width - 24 : mapBounds.x + 24,
      y: Math.min(mapBounds.y + mapBounds.height - 24, dragMove.y + 36),
    }
    await dispatchTouch(cdp, 'touchStart', [dragMove, secondStart])
    await expect(sourceNode).toHaveAttribute('transform', originalTransform!)

    const spread = direction > 0
      ? mapBounds.x + mapBounds.width - 8 - secondStart.x
      : secondStart.x - mapBounds.x - 8
    const pinchMove = [
      { ...dragMove, x: dragMove.x - 12 * direction, y: dragMove.y + 18 },
      { ...secondStart, x: secondStart.x + Math.min(42, spread) * direction, y: secondStart.y + 18 },
    ]
    await dispatchTouch(cdp, 'touchMove', pinchMove)
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportBefore)
    await dispatchTouch(cdp, 'touchEnd', [])
    await page.waitForTimeout(80)
    await expect(map).toBeVisible()
    await expect(inspector).toBeHidden()

    const select = modeButtons.getByRole('button', { name: 'Select', exact: true })
    await select.click()
    await beginTwoContactViewGesture(page, cdp, map)
    await expect(map).toHaveCount(1)
    await expect(inspector).toBeHidden()

    await (await dockAction(page, 'Add star system')).click()
    await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)
    await beginTwoContactViewGesture(page, cdp, map)
    await expect(map).toHaveCount(1)
    await expect(inspector).toBeHidden()
    await expect(map.locator('.continuous-warden-system-anchor')).toHaveCount(1)
    await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)
  } finally {
    await cdp.detach()
  }

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after).toEqual(before)
})
