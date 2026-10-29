import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback,
  clickDockAction,
  createSingleSystemWorkspace,
  openWorkspaceHierarchy,
  returnToClusterMap,
  setWorkspaceMapMode,
  workspaceZoomControls,
} from './helpers'

test('History displays its retained limit, scrolls without moving, and resets after reload', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const { systemName } = await createSingleSystemWorkspace(page, { viewport: { width: 1280, height: 900 } })
  await clickDockAction(page, 'Add orbit', { target: { kind: 'center', x: 0.3, y: 0.3 } })
  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()

  await setWorkspaceMapMode(page, 'Move')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const map = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  const orbitLabel = 'Orbit 1 around unoccupied center'
  const orbit = map.getByRole('group', { name: orbitLabel, exact: true })
  const ring = orbit.locator('.orbit-ring')
  const resize = orbit.getByRole('slider', { name: `Resize ${orbitLabel}`, exact: true })
  const rotate = orbit.getByRole('slider', { name: `Rotate ${orbitLabel}`, exact: true })
  const undo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Undo(?:\b|:)/, includeHidden: true })
  const redo = page.locator('.workspace-history-controls').getByRole('button', { name: /^Redo(?:\b|:)/, includeHidden: true })
  await expect(undo).toBeEnabled()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const initialHorizontalRadius = Number(await resize.getAttribute('aria-valuenow'))
  expect(initialHorizontalRadius + 101).toBeLessThanOrEqual(400)
  await resize.focus()

  for (let adjustment = 1; adjustment <= 101; adjustment += 1) {
    await page.keyboard.press('ArrowRight')
    await expect(resize).toHaveAttribute('aria-valuenow', String(initialHorizontalRadius + adjustment))
    await expect(undo).toBeEnabled()
    await expect(redo).toBeDisabled()
  }
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  const historyButton = page.getByRole('button', { name: 'History', exact: true })
  const historyControls = page.locator('.workspace-history-controls')
  const historyFeedback = historyControls.getByRole('status')
  const appliedState = {
    horizontalRadius: await ring.getAttribute('rx'),
    verticalRadius: await ring.getAttribute('ry'),
    rotation: await rotate.getAttribute('aria-valuenow'),
    undoLabel: await undo.getAttribute('aria-label'),
    historyFeedback: await historyFeedback.innerText(),
    undoEnabled: await undo.isEnabled(),
    redoEnabled: await redo.isEnabled(),
  }

  await historyButton.click()
  const historyDialog = page.getByRole('dialog', { name: 'History', exact: true })
  await expect(historyDialog).toBeVisible()
  await expect(historyDialog.getByText('Older Undo history was removed to stay within the history limit.', { exact: true })).toBeVisible()
  const retainedActions = historyDialog.getByRole('list', { name: 'Retained actions in chronological order' })
  const appliedRows = retainedActions.getByRole('listitem').filter({ hasText: 'Applied' })
  await expect(appliedRows).toHaveCount(100)
  await expect(retainedActions).not.toContainText('Add Orbit 1')
  await expect(retainedActions.getByRole('listitem').first()).toContainText('Resize Orbit 1')
  const positionSummary = historyDialog.getByText('100 available to undo · 0 available through Redo', { exact: true })
  await expect(positionSummary).toBeVisible()
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
  await testInfo.attach('history-limit-at-current-position', { body: await page.screenshot(), contentType: 'image/png' })

  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await expect(undo).toHaveAttribute('aria-label', appliedState.undoLabel ?? '')
  await expect(historyFeedback).toHaveText(appliedState.historyFeedback ?? '')
  await expect(ring).toHaveAttribute('rx', appliedState.horizontalRadius ?? '')
  await expect(ring).toHaveAttribute('ry', appliedState.verticalRadius ?? '')
  await expect(rotate).toHaveAttribute('aria-valuenow', appliedState.rotation ?? '')

  await historyButton.click()
  await expect.poll(() => retainedActions.innerText()).toBe(retainedActionText)
  await expect(appliedRows).toHaveCount(100)
  await expect(positionSummary).toHaveText('100 available to undo · 0 available through Redo')
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toHaveAttribute('aria-label', appliedState.undoLabel ?? '')
  await expect(redo).toBeDisabled()

  await page.reload()
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemEntry = clusterHierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: `Open ${systemName} system map`, exact: true })
  await systemEntry.click()
  const restoredMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  await expect(restoredMap).toBeVisible()
  const restoredHierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await restoredHierarchy.getByRole('button', { name: new RegExp(`^${orbitLabel}`) }).click()
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()
  await setWorkspaceMapMode(page, 'Move')
  const restoredOrbit = restoredMap.getByRole('group', { name: orbitLabel, exact: true })
  const restoredRing = restoredOrbit.locator('.orbit-ring')
  const restoredResize = restoredOrbit.getByRole('slider', { name: `Resize ${orbitLabel}`, exact: true })
  const restoredRotate = restoredOrbit.getByRole('slider', { name: `Rotate ${orbitLabel}`, exact: true })
  await expect(restoredRing).toHaveAttribute('rx', appliedState.horizontalRadius ?? '')
  await expect(restoredRing).toHaveAttribute('ry', appliedState.verticalRadius ?? '')
  await expect(restoredRotate).toHaveAttribute('aria-valuenow', appliedState.rotation ?? '')
  await expect(restoredResize).toHaveAttribute('aria-valuenow', appliedState.horizontalRadius ?? '')
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()

  await historyButton.click()
  await expect(historyDialog).toBeVisible()
  await expect(historyDialog.getByRole('list', { name: 'Retained actions in chronological order' })).toHaveCount(0)
  await expect(historyDialog).toContainText('No actions yet.')
  await expect(historyDialog).toContainText('Current position: initial baseline')
  await testInfo.attach('history-after-reload-baseline', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await expect(historyDialog).toBeHidden()
  await expect(historyButton).toBeFocused()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
})
