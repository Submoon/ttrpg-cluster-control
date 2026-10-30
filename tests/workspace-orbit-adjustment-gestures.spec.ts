import { expect, test } from './fixtures'
import {
  waitForWorkspaceSaved,
  clickDockAction,
  createSingleSystemWorkspace,
  setWorkspaceMapMode,
  workspaceZoomControls,
  workspaceZoomOutput,
} from './helpers'

async function orbitScreenPoint(
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  angle: number,
): Promise<{ x: number; y: number }> {
  return map.evaluate((element, target) => {
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === target.orbitLabel)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!ellipse || !transform) throw new Error('Could not measure the Orbit wheel target.')
    const rotation = Number(ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+)/)?.[1] ?? 0)
      * Math.PI / 180
    const localX = Number(ellipse.getAttribute('rx')) * Math.cos(target.angle)
    const localY = Number(ellipse.getAttribute('ry')) * Math.sin(target.angle)
    const world = new DOMPoint(
      Number(ellipse.getAttribute('cx')) + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      Number(ellipse.getAttribute('cy')) + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    )
    const screen = world.matrixTransform(transform)
    return { x: screen.x, y: screen.y }
  }, { orbitLabel, angle })
}

test('held keyboard repeats and a Ctrl-wheel sequence each undo as one Orbit adjustment', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  await clickDockAction(page, 'Add orbit', { target: { kind: 'center', x: 0.3, y: 0.3 } })
  const desktopViewport = page.viewportSize()
  const historyButton = page.getByRole('button', { name: 'History', exact: true })
  await historyButton.click()
  const historyDialog = page.getByRole('dialog', { name: 'History' })
  await expect(historyDialog).toBeVisible()
  await testInfo.attach('history-desktop', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  const compactInspectorClose = page.getByRole('button', { name: 'Hide inspector', exact: true })
  await compactInspectorClose.click()
  await expect(page.getByRole('dialog', { name: 'Object inspector' })).toBeHidden()
  await historyButton.click()
  await expect(historyDialog).toBeVisible()
  await testInfo.attach('history-compact-390x844', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  if (desktopViewport) await page.setViewportSize(desktopViewport)
  await setWorkspaceMapMode(page, 'Move')
  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const orbitLabel = 'Orbit 1 around unoccupied center'
  const orbit = map.getByRole('group', { name: orbitLabel, exact: true })
  const ring = orbit.locator('.orbit-ring')
  const resize = orbit.getByRole('slider', { name: `Resize ${orbitLabel}`, exact: true })
  const rotate = orbit.getByRole('slider', { name: `Rotate ${orbitLabel}`, exact: true })
  const undo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Redo(?:\b|:)/ })

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const initialRadius = Number(await ring.getAttribute('rx'))
  const initialVerticalRadius = Number(await ring.getAttribute('ry'))
  const initialRotation = Number(await rotate.getAttribute('aria-valuenow'))
  const initialZoom = (await workspaceZoomOutput(page).textContent())?.trim()
  const wheelPoint = await orbitScreenPoint(map, orbitLabel, 0.7)
  const wheelHitTarget = await page.evaluate((point) => {
    const target = document.elementFromPoint(point.x, point.y)
    return {
      point,
      tag: target?.tagName,
      className: target instanceof Element ? target.getAttribute('class') : null,
      orbitId: target instanceof Element ? target.closest('.orbit-mark')?.getAttribute('data-orbit-id') : null,
      mapContainsTarget: target instanceof Element && !!document.querySelector('[aria-label="Vesper star system map"]')?.contains(target),
    }
  }, wheelPoint)
  expect(wheelHitTarget.mapContainsTarget).toBe(true)
  expect(wheelHitTarget.orbitId).toBe(await orbit.getAttribute('data-orbit-id'))

  const rotateFromWheel = async (holdControlBeforeHover: boolean): Promise<void> => {
    if (holdControlBeforeHover) await page.keyboard.down('Control')
    await page.mouse.move(wheelPoint.x, wheelPoint.y)
    if (!holdControlBeforeHover) await page.keyboard.down('Control')
    await page.mouse.wheel(0, 100)
    await page.mouse.wheel(0, 100)
    await page.keyboard.up('Control')
  }
  await rotateFromWheel(true)
  await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 10) % 360))
  await expect(undo).toBeDisabled()
  await expect(workspaceZoomOutput(page)).toHaveText(initialZoom ?? '100%')
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 10) % 360))
  await waitForWorkspaceSaved(page)

  await undo.click()
  await expect(rotate).toHaveAttribute('aria-valuenow', String(initialRotation))
  await expect(ring).toHaveAttribute('rx', String(initialRadius))
  await expect(redo).toBeEnabled()

  await rotateFromWheel(false)
  await expect(rotate).toHaveAttribute('aria-valuenow', String((initialRotation + 10) % 360))
  await expect(undo).toBeDisabled()
  await expect(workspaceZoomOutput(page)).toHaveText(initialZoom ?? '100%')
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await undo.click()
  await expect(rotate).toHaveAttribute('aria-valuenow', String(initialRotation))
  await expect(redo).toBeEnabled()

  const horizontalBeforeKeyboard = Number(await resize.getAttribute('aria-valuenow'))
  await resize.focus()
  await page.keyboard.down('ArrowRight')
  await expect(resize).toBeFocused()
  await page.keyboard.down('ArrowRight')
  await expect(ring).toHaveAttribute('rx', String(horizontalBeforeKeyboard + 2))
  await expect(ring).toHaveAttribute('ry', String(initialVerticalRadius))
  await expect(resize).toBeFocused()
  await expect(undo).toBeDisabled()
  await waitForWorkspaceSaved(page)
  await testInfo.attach('held-orbit-key-repeat', { body: await page.screenshot(), contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(ring).toHaveAttribute('rx', String(horizontalBeforeKeyboard + 2))
  await expect(undo).toBeDisabled()
  await waitForWorkspaceSaved(page)
  await page.keyboard.up('ArrowRight')
  await expect(undo).toBeEnabled()
  await expect(ring).toHaveAttribute('rx', String(horizontalBeforeKeyboard + 2))
  if (desktopViewport) await page.setViewportSize(desktopViewport)

  await undo.click()
  await expect(ring).toHaveAttribute('rx', String(horizontalBeforeKeyboard))
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(ring).toHaveAttribute('rx', String(horizontalBeforeKeyboard + 2))
  await expect(undo).toBeEnabled()
})
