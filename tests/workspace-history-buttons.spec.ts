import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback, addCatalogueObject, captureMapExportBlobs, clickDockAction,
  createSingleSystemWorkspace, dragToWorldPoint, downloadJson, editMapObject,
  ensureMapDragPointsReachable, openChartDetails, openWorkspaceHierarchy,
  returnToClusterMap, saveMapObject, setWorkspaceMapMode, workspaceZoomControls,
} from './helpers'
import {
  installHistoryStorageGate, pendingHistoryAcknowledgements, releaseHistoryAcknowledgements,
  releaseNextHistoryAcknowledgement, setHistoryStorageGate,
} from './scenarios/history-storage-gate'

async function historyUndoDepth(page: import('@playwright/test').Page): Promise<number> {
  const undo = page.getByRole('group', { name: 'Edit history' })
    .getByRole('button', { name: /^Undo(?:$|:)/ })
  const description = await undo.getAttribute('aria-description')
  const match = description?.match(/^(\d+)/)
  if (!match) throw new Error(`Could not read the Undo depth from "${description}".`)
  return Number(match[1])
}

test('saved names can be undone and redone through directly reachable history buttons', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await expect(undo).toHaveText('Undo 0')
  await expect(redo).toHaveText('Redo 0')
  await expect(undo).toHaveAttribute('aria-description', '0 actions available to undo')

  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await expect(undo).toBeEnabled()
  await expect(undo).toHaveText('Undo 1')
  await expect(redo).toHaveText('Redo 0')
  await expect(undo).toHaveAttribute('aria-description', '1 action available to undo')

  await undo.click()
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands' })
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper system(?: map)?$/ })).toBeVisible()
  await expect(redo).toBeEnabled()
  await expect(undo).toHaveText('Undo 0')
  await expect(redo).toHaveText('Redo 1')
  await redo.click()
  await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper Prime system(?: map)?$/ })).toBeVisible()
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await expect(undo).toHaveText('Undo 1')
  await expect(redo).toHaveText('Redo 0')

  await page.reload()
  await expect(mapContext.getByRole('heading', { name: 'Vesper Prime', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
})

test('Back stays to the left of the system name across desktop and compact viewports', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  const longName = 'The Very Long Star System Name That Must Remain Legible'
  await names.getByLabel('Star system', { exact: true }).fill(longName)
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspect.getAttribute('aria-expanded') === 'true') await inspect.click()

  const context = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const back = context.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  const heading = context.getByRole('heading', { name: longName, exact: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect(back).toBeVisible()
    await expect(heading).toBeVisible()
    const [backBounds, headingBounds] = await Promise.all([back.boundingBox(), heading.boundingBox()])
    expect(backBounds).not.toBeNull()
    expect(headingBounds).not.toBeNull()
    if (!backBounds || !headingBounds) throw new Error('The Back button or system title is not positioned.')
    expect(backBounds.x + backBounds.width).toBeLessThanOrEqual(headingBounds.x)
    expect(headingBounds.x + headingBounds.width).toBeLessThanOrEqual(viewport.width)
    expect(backBounds.y + backBounds.height).toBeGreaterThan(headingBounds.y)
    expect(backBounds.y).toBeLessThan(headingBounds.y + headingBounds.height)
    await testInfo.attach(`system-header-${viewport.width}x${viewport.height}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
  await back.click()
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
})

test('a held map move blocks traversal and its completed position round-trips exactly', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()
  await returnToClusterMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const map = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const system = map.getByRole('button', { name: 'Select Vesper Prime system', exact: true })
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await setWorkspaceMapMode(page, 'Move')
  await system.click()
  const start = await system.boundingBox()
  if (!start) throw new Error('The cluster system is not visible for dragging.')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 100, start.y + start.height / 2 + 50, { steps: 6 })
  await expect(undo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('Finish the active map gesture first.')
  await page.mouse.up()
  await expect(undo).toBeEnabled()
  const moved = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(moved.layout.systemPositions).not.toEqual(before.layout.systemPositions)
  await undo.click()
  await expect(redo).toBeEnabled()
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
  await redo.click()
  await expect(undo).toBeEnabled()
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(moved)
})

test('a hidden name draft blocks history through reflow and clean sessions cannot overwrite restored names', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  await names.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await page.keyboard.press('Escape')
  await expect(undo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('modified chart-name draft')
  await page.setViewportSize({ width: 390, height: 844 })
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  if (await closeInspector.isVisible()) await closeInspector.click()
  await expect(undo).toBeVisible()
  await expect(undo).toBeDisabled()
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await names.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect(undo).toBeEnabled()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect(undo).toBeVisible()
    const box = await undo.boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error('The Undo command is outside the compact viewport.')
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    await expect.poll(() => undo.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`history-${viewport.width}x${viewport.height}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const cleanDetails = await openChartDetails(page)
  await cleanDetails.getByRole('button', { name: 'Edit chart names' }).click()
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Vesper Prime')
  await page.keyboard.press('Escape')
  await undo.click()
  await expect(page.getByRole('button', { name: /^Redo(?:\b|:)/ })).toBeEnabled()
  await cleanDetails.getByRole('button', { name: 'Edit chart names' }).click()
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Vesper')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Redo(?:\b|:)/ })).toBeEnabled()
})

test('traversal keeps its visible result through delayed and failed IndexedDB saving, then Retry restores access', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(undo).toBeEnabled()
  await installHistoryStorageGate(page)
  try {
    await setHistoryStorageGate(page, { hold: true })
    await undo.click()
    const mapContext = page.getByRole('navigation', { name: 'Map context and commands' })
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper system(?: map)?$/ })).toBeVisible()
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBeGreaterThan(0)
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()
    await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('Wait until the latest changes are saved.')
    await releaseHistoryAcknowledgements(page)
    await expect(redo).toBeEnabled()

    await setHistoryStorageGate(page, { abortNext: true })
    await redo.click()
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper Prime system(?: map)?$/ })).toBeVisible()
    await expect(activeWorkspaceFeedback(page)).toContainText('Not saved.')
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
    await expect(undo).toBeEnabled()
    await expect(redo).toBeDisabled()
    await undo.click()
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(clusterMap.getByRole('button', { name: /^(Open|Select) Vesper system(?: map)?$/ })).toBeVisible()
    await expect(redo).toBeEnabled()
  } finally {
    await releaseHistoryAcknowledgements(page, true)
  }
})

test('an older real save acknowledgement cannot enable traversal of a newer applied revision', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page)
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await installHistoryStorageGate(page)
  try {
    await setHistoryStorageGate(page, { hold: true })
    for (const nextName of ['Vesper Second', 'Vesper Third']) {
      const details = await openChartDetails(page)
      await details.getByRole('button', { name: 'Edit chart names' }).click()
      const names = page.getByRole('dialog', { name: 'Edit chart names' })
      await names.getByLabel('Star system', { exact: true }).fill(nextName)
      await names.getByRole('button', { name: 'Apply names', exact: true }).click()
      await expect(names).toBeHidden()
    }
    const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBe(1)
    await expect(undo).toBeDisabled()
    await releaseNextHistoryAcknowledgement(page)
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBe(1)
    await expect(activeWorkspaceFeedback(page)).toContainText('Saving to this browser.')
    await expect(undo).toBeDisabled()
    await expect(page.getByRole('navigation', { name: 'Map context and commands' })
      .getByRole('heading', { name: 'Vesper Third', exact: true })).toBeVisible()
    await releaseHistoryAcknowledgements(page)
    await expect(undo).toBeEnabled()
    await undo.click()
    const mapContext = page.getByRole('navigation', { name: 'Map context and commands' })
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
      .getByRole('button', { name: /^(Open|Select) Vesper Second system(?: map)?$/ })).toBeVisible()
  } finally {
    await releaseHistoryAcknowledgements(page, true)
  }
})

test('releasing an object drag over disabled history chrome cancels cleanly and permits the next drag', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const history = page.getByRole('group', { name: 'Edit history' })
  const undo = history.getByRole('button', { name: /^Undo(?:$|:)/ })
  const redo = history.getByRole('button', { name: /^Redo(?:$|:)/ })
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await setWorkspaceMapMode(page, 'Move')

  const planet = map.getByRole('button', { name: 'Select PL-01, Iria (Planet)', exact: true })
  const hitTarget = planet.locator('.object-hit-target')
  const initialTransform = await planet.getAttribute('transform')
  if (!initialTransform) throw new Error('The Orbit object has no initial map position.')
  const historyDepthBeforeBlockedRelease = await historyUndoDepth(page)
  const redoBounds = await redo.boundingBox()
  const sourceBounds = await hitTarget.boundingBox()
  if (!redoBounds || !sourceBounds) throw new Error('The source or disabled Redo command is outside the viewport.')
  const obstructedClientPoint = {
    x: redoBounds.x + redoBounds.width / 2,
    y: redoBounds.y + redoBounds.height / 2,
  }
  const obstructedHit = await page.evaluate((point) => {
    const element = document.elementFromPoint(point.x, point.y)
    const button = element?.closest('button')
    return {
      ariaLabel: button?.getAttribute('aria-label'),
      disabled: button instanceof HTMLButtonElement ? button.disabled : null,
    }
  }, obstructedClientPoint)
  expect(obstructedHit).toEqual({ ariaLabel: 'Redo', disabled: true })

  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(obstructedClientPoint.x, obstructedClientPoint.y, { steps: 6 })
  await expect(undo).toBeDisabled()
  await expect(history).toContainText('Finish the active map gesture first.')
  await page.mouse.up()

  await expect(undo).toBeEnabled()
  await expect(history).not.toContainText('Finish the active map gesture first.')
  await expect(planet).toHaveAttribute('transform', initialTransform)
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease)

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await expect(planet).toHaveAttribute('transform', initialTransform)
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease)

  const validDestination = {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  }
  await ensureMapDragPointsReachable(page, map, hitTarget, validDestination)
  await dragToWorldPoint(page, map, hitTarget, validDestination)
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease + 1)
  await expect(undo).toHaveAccessibleName('Undo: Place Iria in Orbit · Iria · Vesper')
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await expect(planet).not.toHaveAttribute('transform', initialTransform)
})
