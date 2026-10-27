import { expect, test, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  dockAction,
  downloadJson,
  returnToClusterMap,
  workspaceNavigation,
} from './helpers'

type TouchPoint = { id: number; x: number; y: number }
type WorldPoint = { x: number; y: number }

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
  await returnToClusterMap(page)
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

async function placeNumericMovePreview(page: Page, point: WorldPoint): Promise<void> {
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await page.getByRole('textbox', { name: 'System position X', exact: true }).fill(String(point.x))
  await page.getByRole('textbox', { name: 'System position Y', exact: true }).fill(String(point.y))
  await page.getByRole('button', { name: 'Preview move', exact: true }).click()
  await expect(placement).toHaveAttribute('aria-expanded', 'false')
}

test('cluster two-contact takeover cancels an active Move drag and never activates Navigate, Select, or Add System', async ({ page }) => {
  await captureMapExportBlobs(page)
  const cdp = await enableTouch(page)
  await createWorkspace(page)

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const inspector = page.locator('#workspace-inspector-panel')
  const before = await downloadJson(page, 'Export Jump Cluster JSON')

  try {
    const modeButtons = workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    await modeButtons.getByRole('button', { name: 'Move', exact: true }).click()
    const sourceNode = map.getByRole('button', { name: 'Select Vesper system', exact: true })
    const originalTransform = await sourceNode.getAttribute('transform')
    await sourceNode.click()
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
    await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
    await expect(inspector).toBeHidden()

    for (const mode of ['Navigate', 'Select'] as const) {
      await modeButtons.getByRole('button', { name: mode, exact: true }).click()
      await beginTwoContactViewGesture(page, cdp, map)
      await expect(map).toBeVisible()
      await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
      await expect(inspector).toBeHidden()
    }

    await (await dockAction(page, 'Add star system')).click()
    await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)
    await beginTwoContactViewGesture(page, cdp, map)
    await expect(map).toBeVisible()
    await expect(page.getByRole('group', { name: 'Vesper star system map' })).toHaveCount(0)
    await expect(inspector).toBeHidden()
    await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)
  } finally {
    await cdp.detach()
  }

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after).toEqual(before)
})

test('Add System ignores right-pan and exits when Navigate is reselected', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const inspector = page.locator('#workspace-inspector-panel')
  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspector.isVisible()) await inspect.click()
  await expect(inspector).toBeHidden()
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  await (await dockAction(page, 'Add star system')).click()

  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The cluster map has no visible bounds for right-pan input.')
  const scene = map.locator('.cluster-map-content')
  const viewportBefore = await scene.getAttribute('transform')
  const x = bounds.x + bounds.width * 0.34
  const y = bounds.y + bounds.height * 0.4
  await page.mouse.move(x, y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x + 74, y + 32, { steps: 4 })
  await page.mouse.up({ button: 'right' })
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(viewportBefore)
  await expect(map).toBeVisible()
  await expect(inspector).toBeHidden()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)

  await page.mouse.click(x + 74, y + 32, { button: 'right' })
  await expect(map).toBeVisible()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).toContainText(/system/i)

  // Clicking Navigate while it is already selected must still exit the explicit Add intent.
  await workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
    .getByRole('button', { name: 'Navigate', exact: true }).click()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })).not.toContainText(/system/i)

  const modeButtons = workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
  await modeButtons.getByRole('button', { name: 'Move', exact: true }).click()
  const sourceNode = map.getByRole('button', { name: 'Select Vesper system', exact: true })
  const originalTransform = await sourceNode.getAttribute('transform')
  await sourceNode.click()
  await expect(sourceNode).toHaveClass(/is-selected/)
  await placeNumericMovePreview(page, { x: 0.82, y: 0.18 })
  await expect(sourceNode).not.toHaveAttribute('transform', originalTransform!)

  await modeButtons.getByRole('button', { name: 'Select', exact: true }).click()
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)

  await modeButtons.getByRole('button', { name: 'Move', exact: true }).click()
  await placeNumericMovePreview(page, { x: 0.82, y: 0.18 })
  const moveViewportBeforePan = await scene.getAttribute('transform')
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The cluster map has no visible bounds for Move right-pan input.')
  const panX = mapBounds.x + mapBounds.width * 0.3
  const panY = mapBounds.y + mapBounds.height * 0.42
  await page.mouse.move(panX, panY)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(panX + 68, panY + 30, { steps: 4 })
  await page.mouse.up({ button: 'right' })
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(moveViewportBeforePan)

  await placeNumericMovePreview(page, { x: 0.82, y: 0.18 })
  // This emulates a browser blur event; it does not exercise physical tab switching or OS focus loss.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(sourceNode).toHaveAttribute('transform', originalTransform!)
  await expect(page.getByRole('button', { name: 'Confirm system move', exact: true })).toHaveCount(0)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after).toEqual(before)
})
