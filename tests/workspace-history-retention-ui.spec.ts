import { expect, test } from './fixtures'
import {
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  dockAction,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  quitSystemAdd,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenOrbitLocalGeometry,
  wardenMap,
} from './helpers'

function orbitRotationAngle(transform: string | null): number {
  const angle = transform?.match(/rotate\(\s*([-+.\deE]+)/)?.[1]
  return angle === undefined ? 0 : Number(angle)
}

test('History list scrolls without moving and resets after reload', async ({ page }) => {
  test.setTimeout(180_000)
  const { systemId, systemName } = await createSingleSystemWorkspace(page, { viewport: { width: 1280, height: 900 } })
  const map = wardenMap(page)
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await (await dockAction(page, 'Add orbit')).click()
  await expect(page.getByRole('group', { name: 'Orbit creation controls', exact: true })).toBeVisible()
  await clickWardenSystemPoint(page, systemId, { x: 0.3, y: 0.3 })
  await expect(ring).toHaveCount(1)
  const orbitId = await ring.getAttribute('data-orbit-id')
  if (!orbitId) throw new Error('The unoccupied Orbit must expose its identity.')
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Move')
  await ring.press('Enter')
  await hideWorkspaceInspector(page)
  const resize = map.locator(
    `.continuous-warden-orbit-edit-handle[data-system-id="${systemId}"][data-orbit-id="${orbitId}"][data-resize-axis="horizontal"]`,
  )
  await expect(resize).toBeVisible()
  const undo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Undo(?:\b|:)/, includeHidden: true })
  const redo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Redo(?:\b|:)/, includeHidden: true })
  await expect(undo).toBeEnabled()
  await waitForWorkspaceSaved(page)

  const initialRadii = (await wardenOrbitLocalGeometry(ring, systemId)).radii
  const initialHorizontalRadius = initialRadii.horizontal
  // Enough entries to overflow the dialog at this viewport; the coordinator checks eviction.
  const adjustmentCount = 12
  expect(initialHorizontalRadius + adjustmentCount).toBeLessThanOrEqual(400)
  await resize.focus()

  for (let adjustment = 0; adjustment < adjustmentCount; adjustment += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(initialHorizontalRadius + adjustmentCount, 3)
  await waitForWorkspaceSaved(page)

  const historyButton = page.getByRole('button', { name: 'History', exact: true })
  const historyControls = page.locator('.workspace-history-controls')
  const historyFeedback = historyControls.getByRole('status')
  const appliedGeometry = await wardenOrbitLocalGeometry(ring, systemId)
  const appliedRadii = appliedGeometry.radii
  const appliedState = {
    center: appliedGeometry.center,
    rotationAngle: orbitRotationAngle(await ring.getAttribute('transform')),
    horizontalRadius: appliedRadii.horizontal,
    verticalRadius: appliedRadii.vertical,
    ringTransform: await ring.getAttribute('transform'),
    undoLabel: await undo.getAttribute('aria-label'),
    historyFeedback: await historyFeedback.innerText(),
  }

  await historyButton.click()
  const historyDialog = page.getByRole('dialog', { name: 'History', exact: true })
  await expect(historyDialog).toBeVisible()
  const retainedActions = historyDialog.getByRole('list', { name: 'Retained actions in chronological order' })
  const retainedActionText = await retainedActions.innerText()

  const scrollport = historyDialog.locator('.overflow-y-auto')
  await expect(scrollport).toHaveCount(1)
  const initialScrollState = await scrollport.evaluate(element => ({
    scrollTop: element.scrollTop,
    maxScrollTop: element.scrollHeight - element.clientHeight,
  }))
  expect(initialScrollState.maxScrollTop).toBeGreaterThan(0)
  const scrollBounds = await scrollport.boundingBox()
  if (!scrollBounds) throw new Error('The History list scroll area is not visible.')
  await page.mouse.move(scrollBounds.x + scrollBounds.width / 2, scrollBounds.y + scrollBounds.height / 2)
  await page.mouse.wheel(0, initialScrollState.maxScrollTop + 1000)
  await expect.poll(() => scrollport.evaluate(element => element.scrollTop)).toBeGreaterThan(initialScrollState.scrollTop)
  const position = retainedActions.getByRole('status', { name: 'Current history position', exact: true })
  await expect.poll(() => historyDialog.evaluate(dialog => {
    const viewport = dialog.querySelector('.overflow-y-auto')?.getBoundingClientRect()
    const currentPosition = dialog.querySelector('[aria-label="Current history position"]')?.getBoundingClientRect()
    return !!viewport && !!currentPosition
      && currentPosition.top >= viewport.top - 1
      && currentPosition.bottom <= viewport.bottom + 1
  })).toBe(true)
  await expect(position).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await expect(undo).toHaveAttribute('aria-label', appliedState.undoLabel ?? '')
  await expect(historyFeedback).toHaveText(appliedState.historyFeedback ?? '')
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(appliedState.horizontalRadius, 3)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical)
    .toBeCloseTo(appliedState.verticalRadius, 3)
  await expect(ring).toHaveAttribute('transform', appliedState.ringTransform ?? '')

  await historyButton.click()
  await expect.poll(() => retainedActions.innerText()).toBe(retainedActionText)
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toHaveAttribute('aria-label', appliedState.undoLabel ?? '')
  await expect(redo).toBeDisabled()

  await page.reload()
  await waitForWorkspaceStartup(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: `Inspect ${systemName}`, exact: true }).click()
  const orbitRow = hierarchy.getByRole('treeitem', { name: /^Orbit 1 around unoccupied center/ })
  await orbitRow.click()
  await centerWorkspaceSelection(page)
  await hideWorkspaceInspector(page)
  await setWorkspaceMapMode(page, 'Move')
  await expect(ring).toHaveAttribute('data-orbit-id', orbitId)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(appliedState.horizontalRadius, 3)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical)
    .toBeCloseTo(appliedState.verticalRadius, 3)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(appliedState.center.x, 3)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.y)
    .toBeCloseTo(appliedState.center.y, 3)
  await expect.poll(async () => orbitRotationAngle(await ring.getAttribute('transform')))
    .toBeCloseTo(appliedState.rotationAngle, 3)
  await expect(resize).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()

  await historyButton.click()
  await expect(historyDialog).toBeVisible()
  await expect(historyDialog.getByRole('list', { name: 'Retained actions in chronological order' })).toHaveCount(0)
  await expect(historyDialog).toContainText('No actions yet.')
  await expect(historyDialog).toContainText('Current position: initial baseline')
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
})
