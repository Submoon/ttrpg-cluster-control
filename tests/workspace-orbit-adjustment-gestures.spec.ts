import { expect, test } from './fixtures'
import {
  waitForWorkspaceSaved,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  dockAction,
  hideWorkspaceInspector,
  quitSystemAdd,
  setWorkspaceMapMode,
  wardenOrbitLocalGeometry,
  wardenMap,
  workspaceZoomOutput,
} from './helpers'

async function orbitScreenPoint(
  ring: import('@playwright/test').Locator,
  angle: number,
): Promise<{ x: number; y: number }> {
  return ring.evaluate((element, angle) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit wheel target is not an ellipse.')
    const systemId = element.getAttribute('data-system-id')
    const orbitId = element.getAttribute('data-orbit-id')
    if (!systemId || !orbitId) throw new Error('The Orbit wheel target has no owner-qualified identity.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('Could not measure the Warden Orbit wheel target.')
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const screenRadius = Math.max(
      Math.hypot(transform.a * rx, transform.b * rx),
      Math.hypot(transform.c * ry, transform.d * ry),
    )
    const sampleCount = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    // A mathematical ellipse point can fall in a dash gap or behind an edit handle.
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const offset = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / sampleCount
      const screen = new DOMPoint(
        element.cx.baseVal.value + rx * Math.cos(angle + offset),
        element.cy.baseVal.value + ry * Math.sin(angle + offset),
      ).matrixTransform(transform)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const point = { x: Math.round(screen.x) + dx, y: Math.round(screen.y) + dy }
          if (document.elementFromPoint(point.x, point.y) === element) return point
        }
      }
    }
    throw new Error(`Orbit ${orbitId} in system ${systemId} has no frontmost painted ring pixel for native wheel input.`)
  }, angle)
}

test('held keyboard repeats and a Ctrl-wheel sequence each undo as one Orbit adjustment', async ({ page }, testInfo) => {
  await page.clock.install()
  const { systemId } = await createSingleSystemWorkspace(page)
  await (await dockAction(page, 'Add orbit')).click()
  await clickWardenSystemPoint(page, systemId, { x: .3, y: .3 })
  await quitSystemAdd(page)
  const map = wardenMap(page)
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(ring).toHaveCount(1)
  const desktopViewport = page.viewportSize()
  const historyButton = page.getByRole('button', { name: 'History', exact: true })
  await historyButton.click()
  const historyDialog = page.getByRole('dialog', { name: 'History' })
  await expect(historyDialog).toBeVisible()
  await testInfo.attach('history-desktop', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await hideWorkspaceInspector(page)
  await expect(page.getByRole('dialog', { name: 'Object inspector' })).toBeHidden()
  // Establish detail at compact width before testing a held adjustment through responsive reflow.
  await centerWorkspaceSelection(page)
  await historyButton.click()
  await expect(historyDialog).toBeVisible()
  await testInfo.attach('history-compact-390x844', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  if (desktopViewport) await page.setViewportSize(desktopViewport)
  await ring.focus()
  await page.keyboard.press('Enter')
  await hideWorkspaceInspector(page)
  await setWorkspaceMapMode(page, 'Move')
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') === 'true') await hierarchyToggle.click()

  const orbitId = await ring.getAttribute('data-orbit-id')
  if (!orbitId) throw new Error('The created Warden Orbit has no domain identity.')
  const handles = map.locator(`[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`)
  const resize = handles.and(map.getByRole('slider', { name: 'Resize horizontal radius of Select Orbit 1', exact: true }))
  const rotate = handles.and(map.getByRole('slider', { name: 'Rotate Select Orbit 1', exact: true }))
  const undo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Redo(?:\b|:)/ })

  await centerWorkspaceSelection(page)
  const initialRadii = (await wardenOrbitLocalGeometry(ring, systemId)).radii
  const initialRadius = initialRadii.horizontal
  const initialVerticalRadius = initialRadii.vertical
  const initialRotation = Number(await rotate.getAttribute('aria-valuenow'))
  const initialZoom = (await workspaceZoomOutput(page).textContent())?.trim()
  if (!initialZoom) throw new Error('The zoom readout must be available before editing the Orbit.')
  const wheelPoint = await orbitScreenPoint(ring, 0.7)
  const wheelHitTarget = await map.evaluate((map, point) => {
    const target = document.elementFromPoint(point.x, point.y)
    return {
      point,
      tag: target?.tagName,
      className: target instanceof Element ? target.getAttribute('class') : null,
      orbitId: target instanceof Element ? target.closest('.continuous-warden-orbit-target')?.getAttribute('data-orbit-id') : null,
      systemId: target instanceof Element ? target.closest('.continuous-warden-orbit-target')?.getAttribute('data-system-id') : null,
      mapContainsTarget: target instanceof Element && map.contains(target),
    }
  }, wheelPoint)
  expect(wheelHitTarget.mapContainsTarget).toBe(true)
  expect(wheelHitTarget.orbitId).toBe(orbitId)
  expect(wheelHitTarget.systemId).toBe(systemId)

  // Preserve one history-grouping window despite variable real browser-event delivery latency.
  const futurePageEpoch = await page.evaluate(() => Date.now() + 10_000)
  await page.clock.pauseAt(futurePageEpoch)
  try {
    await page.keyboard.down('Control')
    await page.mouse.move(wheelPoint.x, wheelPoint.y)
    await page.mouse.wheel(0, 100)
    await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 5) % 360))
    // The first rotation moves dashed paint; measure the next native hit from that live preview.
    const nextWheelPoint = await orbitScreenPoint(ring, 0.7)
    await page.mouse.move(nextWheelPoint.x, nextWheelPoint.y)
    await page.mouse.wheel(0, 100)
    await page.keyboard.up('Control')
    await page.clock.runFor(32)
    await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 10) % 360))
    await expect(undo).toBeDisabled()
    await expect(workspaceZoomOutput(page)).toHaveText(initialZoom)
  } finally {
    await page.keyboard.up('Control')
    await page.clock.resume()
  }
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 10) % 360))
  await waitForWorkspaceSaved(page)

  await undo.click()
  await expect(rotate).toHaveAttribute('aria-valuenow', String(initialRotation))
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(initialRadius, 3)
  await expect(redo).toBeEnabled()

  const horizontalBeforeKeyboard = Number(await resize.getAttribute('aria-valuenow'))
  await resize.focus()
  await page.keyboard.down('ArrowRight')
  await expect(resize).toBeFocused()
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(horizontalBeforeKeyboard + 2, 3)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical)
    .toBeCloseTo(initialVerticalRadius, 3)
  await expect(resize).toBeFocused()
  await expect(undo).toBeDisabled()
  await waitForWorkspaceSaved(page)
  await testInfo.attach('held-orbit-key-repeat', { body: await page.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(horizontalBeforeKeyboard + 2, 3)
  await expect(undo).toBeDisabled()
  await waitForWorkspaceSaved(page)
  await page.keyboard.up('ArrowRight')
  await expect(undo).toBeEnabled()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(horizontalBeforeKeyboard + 2, 3)
  if (desktopViewport) await page.setViewportSize(desktopViewport)

  await undo.click()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(horizontalBeforeKeyboard, 3)
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(horizontalBeforeKeyboard + 2, 3)
  await expect(undo).toBeEnabled()
  await waitForWorkspaceSaved(page)
})
