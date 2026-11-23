import { expect, test } from './fixtures'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  editMapObject,
  exposedContinuousObjectHitPoint,
  fitWorkspaceMap,
  hideWorkspaceInspector,
  openChartDetailsEditor,
  quitSystemAdd,
  saveMapObject,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setWorkspaceMapMode,
  snapshotSvgCoordinates,
  waitForWorkspaceSaved,
  wardenLocalCoordinates,
  wardenMap,
  wardenObjectLocalPosition,
  wardenObjectMark,
  wardenSystemMark,
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


test('a held map move blocks traversal and its completed position round-trips exactly', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId } = await createSingleSystemWorkspace(page)
  const names = await openChartDetailsEditor(page)
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(names).toBeHidden()
  await hideWorkspaceInspector(page)
  await fitWorkspaceMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const map = wardenMap(page)
  const system = map.locator(`.continuous-warden-name-target[data-system-id="${systemId}"]`)
  await expect(system).toHaveAccessibleName('Select Vesper Prime')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await setWorkspaceMapMode(page, 'Move')
  const nameHitPoint = () => system.evaluate((element) => {
    const background = element.querySelector('.continuous-warden-name-background')
    if (!background) throw new Error('The owning system name has no painted background.')
    const bounds = background.getBoundingClientRect()
    for (const x of [.5, .25, .75]) {
      for (const y of [.5, .25, .75]) {
        const point = { x: Math.round(bounds.x + bounds.width * x), y: Math.round(bounds.y + bounds.height * y) }
        if (document.elementFromPoint(point.x, point.y)?.closest('.continuous-warden-name-target') === element) return point
      }
    }
    throw new Error('The owning system name has no frontmost native hit for Move.')
  })
  const selectPoint = await nameHitPoint()
  await page.mouse.click(selectPoint.x, selectPoint.y)
  await hideWorkspaceInspector(page)
  const start = await nameHitPoint()
  const end = { x: start.x + 100, y: start.y + 50 }
  expect(await map.evaluate((element, points) => Array.from({ length: 7 }, (_, step) =>
    element.contains(document.elementFromPoint(
      points.start.x + (points.end.x - points.start.x) * step / 6,
      points.start.y + (points.end.y - points.start.y) * step / 6,
    ))).every(Boolean), { start, end })).toBe(true)
  await page.mouse.move(start.x, start.y)
  try {
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 6 })
    await expect(undo).toBeDisabled()
    await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('Finish the active map gesture first.')
  } finally {
    await page.mouse.up()
  }
  await expect(undo).toBeEnabled()
  const moved = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(moved.layout.systemPositions?.[systemId]).not.toEqual(before.layout.systemPositions?.[systemId])
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
  const names = await openChartDetailsEditor(page)
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await openChartDetailsEditor(page)
  await names.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await expect(undo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('modified Jump Cluster details draft')
  await page.setViewportSize({ width: 390, height: 844 })
  const compactInspector = page.getByRole('dialog', { name: 'Jump Cluster details', exact: true })
  await expect(compactInspector).toBeVisible()
  await expect(compactInspector.getByRole('button', { name: 'Resume Jump Cluster details draft' })).toBeVisible()
  await compactInspector.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
  await expect(compactInspector).toBeHidden()
  await expect(undo).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('modified Jump Cluster details draft')
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await names.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await hideWorkspaceInspector(page)
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
  await openChartDetailsEditor(page)
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Vesper Prime')
  await hideWorkspaceInspector(page)
  await undo.click()
  await expect(page.getByRole('button', { name: /^Redo(?:\b|:)/ })).toBeEnabled()
  await openChartDetailsEditor(page)
  await expect(names.getByLabel('Star system', { exact: true })).toHaveValue('Vesper')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Redo(?:\b|:)/ })).toBeEnabled()
})

test('traversal keeps its visible result through delayed and failed IndexedDB saving, then Retry restores access', async ({ page }) => {
  test.setTimeout(60_000)
  const { systemId } = await createSingleSystemWorkspace(page)
  const names = await openChartDetailsEditor(page)
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  const system = wardenSystemMark(page, systemId)
  await expect(undo).toBeEnabled()
  await installHistoryStorageGate(page)
  try {
    await setHistoryStorageGate(page, { hold: true })
    await undo.click()
    const mapContext = page.getByRole('region', { name: 'Current Jump Cluster', exact: true })
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(system).toHaveAccessibleName('Select Vesper')
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBeGreaterThan(0)
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()
    await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('Wait until the latest changes are saved.')
    await releaseHistoryAcknowledgements(page)
    await expect(redo).toBeEnabled()

    await setHistoryStorageGate(page, { abortNext: true })
    await redo.click()
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(system).toHaveAccessibleName('Select Vesper Prime')
    await expect(activeWorkspaceFeedback(page)).toContainText('Not saved.')
    await expect(undo).toBeDisabled()
    await expect(redo).toBeDisabled()
    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
    await expect(undo).toBeEnabled()
    await expect(redo).toBeDisabled()
    await undo.click()
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(system).toHaveAccessibleName('Select Vesper')
    await expect(redo).toBeEnabled()
  } finally {
    await releaseHistoryAcknowledgements(page, true)
  }
})

test('an older real save acknowledgement cannot enable traversal of a newer applied revision', async ({ page }) => {
  test.setTimeout(60_000)
  const { systemId } = await createSingleSystemWorkspace(page)
  const system = wardenSystemMark(page, systemId)
  await waitForWorkspaceSaved(page)
  await installHistoryStorageGate(page)
  try {
    await setHistoryStorageGate(page, { hold: true })
    for (const nextName of ['Vesper Second', 'Vesper Third']) {
      const names = await openChartDetailsEditor(page)
      await names.getByLabel('Star system', { exact: true }).fill(nextName)
      await names.getByRole('button', { name: 'Apply details', exact: true }).click()
      await expect(names).toBeHidden()
    }
    const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBe(1)
    await expect(undo).toBeDisabled()
    await releaseNextHistoryAcknowledgement(page)
    await expect.poll(() => pendingHistoryAcknowledgements(page)).toBe(1)
    await expect(page.locator('.workspace-feedback-content').first()).toHaveAttribute('data-save-state', 'saving')
    await expect(undo).toBeDisabled()
    await expect(system).toHaveAccessibleName('Select Vesper Third')
    await releaseHistoryAcknowledgements(page)
    await expect(undo).toBeEnabled()
    await undo.click()
    const mapContext = page.getByRole('region', { name: 'Current Jump Cluster', exact: true })
    await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
    await expect(system).toHaveAccessibleName('Select Vesper Second')
  } finally {
    await releaseHistoryAcknowledgements(page, true)
  }
})

test('releasing an object drag over disabled history chrome cancels cleanly and permits the next drag', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })
  const map = wardenMap(page)
  await (await dockAction(page, 'Add orbit')).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
    identity: { attribute: 'data-object-id', id: primaryObjectId },
  })
  await page.getByLabel('Horizontal radius', { exact: true }).fill('112')
  await page.getByLabel('Vertical radius', { exact: true }).fill('112')
  await page.getByRole('form', { name: 'Placement', exact: true }).getByRole('button', { name: 'Add', exact: true }).click()
  const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(orbit).toHaveCount(1)
  const orbitId = await orbit.getAttribute('data-orbit-id')
  if (!orbitId) throw new Error('The hosted Orbit needs its domain identity.')
  await quitSystemAdd(page)
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  await orbit.press('Enter')
  await expect(map.locator(`.continuous-warden-object[data-system-id="${systemId}"]`)).toHaveCount(2)
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const created = await downloadJson(page, 'Export Jump Cluster JSON')
  const createdPlanet = created.cluster?.systems.find(system => system.id === systemId)
    ?.objects.find(object => object.subtype === 'planet')
  if (!createdPlanet) throw new Error('The added Planet is missing from the same owner.')
  expect(createdPlanet.placement).toEqual({ kind: 'orbit', orbitId })
  const planet = wardenObjectMark(page, systemId, createdPlanet.id)
  await planet.press('Enter')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
  await hideWorkspaceInspector(page)

  const history = page.getByRole('group', { name: 'Edit history' })
  const undo = history.getByRole('button', { name: /^Undo(?:$|:)/ })
  const redo = history.getByRole('button', { name: /^Redo(?:$|:)/ })
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
  await setWorkspaceMapMode(page, 'Move')
  const beforeBlockedRelease = await downloadJson(page, 'Export Jump Cluster JSON')

  await expect(planet).toHaveAccessibleName('Select PL-01, Iria')
  const initialTransform = await planet.getAttribute('transform')
  if (!initialTransform) throw new Error('The Orbit object has no initial map position.')
  const initialLocalPosition = await wardenObjectLocalPosition(planet)
  const historyDepthBeforeBlockedRelease = await historyUndoDepth(page)
  const redoBounds = await redo.boundingBox()
  const source = await exposedContinuousObjectHitPoint(planet)
  if (!redoBounds || !source) throw new Error('The source or disabled Redo command is outside the viewport.')
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

  await page.mouse.move(source.x, source.y)
  await page.mouse.down()
  await page.mouse.move(obstructedClientPoint.x, obstructedClientPoint.y, { steps: 6 })
  await expect(undo).toBeDisabled()
  await expect(history).toContainText('Finish the active map gesture first.')
  await page.mouse.up()

  await expect(undo).toBeEnabled()
  await expect(history).not.toContainText('Finish the active map gesture first.')
  await expect(planet).toHaveAttribute('transform', initialTransform)
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(beforeBlockedRelease)

  await centerWorkspaceSelection(page)
  const centeredLocalPosition = await wardenObjectLocalPosition(planet)
  expect(centeredLocalPosition.x).toBeCloseTo(initialLocalPosition.x, 3)
  expect(centeredLocalPosition.y).toBeCloseTo(initialLocalPosition.y, 3)
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease)

  const nextSource = await exposedContinuousObjectHitPoint(planet)
  if (!nextSource) throw new Error('The canceled drag must leave the Planet reachable.')
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const planetOrigin = (await snapshotSvgCoordinates(planet)).toClient({ x: 0, y: 0 })
  const destinationOrigin = coordinates.toClient({
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const destination = {
    x: destinationOrigin.x + nextSource.x - planetOrigin.x,
    y: destinationOrigin.y + nextSource.y - planetOrigin.y,
  }
  const destinationIsOnMap = await map.evaluate((element, point) =>
    element.contains(document.elementFromPoint(point.x, point.y)), destination)
  expect(destinationIsOnMap).toBe(true)
  await page.mouse.move(nextSource.x, nextSource.y)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => historyUndoDepth(page)).toBe(historyDepthBeforeBlockedRelease + 1)
  await expect(undo).toHaveAccessibleName('Undo: Move Iria · Iria · Vesper')
  await waitForWorkspaceSaved(page)
  const movedLocalPosition = await wardenObjectLocalPosition(planet)
  expect(Math.hypot(
    movedLocalPosition.x - initialLocalPosition.x,
    movedLocalPosition.y - initialLocalPosition.y,
  )).toBeGreaterThan(1)
  const moved = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(moved.cluster?.systems.find(system => system.id === systemId)
    ?.objects.find(object => object.id === createdPlanet.id)?.placement).toEqual({ kind: 'orbit', orbitId })
  expect(moved.layout.objectAngles[createdPlanet.id]).not.toEqual(beforeBlockedRelease.layout.objectAngles[createdPlanet.id])
})
