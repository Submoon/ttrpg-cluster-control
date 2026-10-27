import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  clickNormalizedSystemPoint,
  downloadJson,
  editMapObject,
  openWorkspaceHierarchy,
  quitSystemAdd,
  saveMapObject,
  selectCatalogueObjectButton,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'

test('free object placement is chosen on the map instead of with coordinate fields', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await setWorkspaceMapMode(page, 'Move')
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()

  const dock = workspaceNavigation(page)
  const placement = dock.getByRole('button', { name: 'Placement', exact: true })
  await placement.click()
  const form = page.getByRole('form', { name: 'Object placement', exact: true })
  await expect(form.getByLabel('Object position X', { exact: true })).toHaveCount(0)
  await expect(form.getByLabel('Object position Y', { exact: true })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Move on map', exact: true })).toBeVisible()
})

test('Add can create a free object from the visible map center with the keyboard', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const initial = await downloadJson(page, 'Export star system JSON')
  const existingObjectCount = initial.system?.objects.length ?? 0
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  await addPlanet.press('Enter')
  await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toBeVisible()
  await map.focus()
  const mapContent = map.locator('.system-map-content')
  const transformBeforePan = await mapContent.getAttribute('transform')
  for (let step = 0; step < 12; step += 1) await map.press('ArrowRight')
  await expect(mapContent).not.toHaveAttribute('transform', transformBeforePan ?? '')
  const expectedPosition = await map.evaluate(element => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const inverse = content?.getScreenCTM()?.inverse()
    if (!inverse) throw new Error('The system-map scene is not ready for keyboard creation.')
    const bounds = element.getBoundingClientRect()
    const center = new DOMPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      .matrixTransform(inverse)
    return { x: (center.x - 64) / 832, y: (center.y - 72) / 416 }
  })

  await map.press('Enter')
  await expect(map.locator('.system-object')).toHaveCount(existingObjectCount + 1)
  const created = await downloadJson(page, 'Export star system JSON')
  const addedObjects = created.system?.objects.filter(object =>
    !initial.system?.objects.some(existing => existing.id === object.id),
  ) ?? []
  expect(addedObjects).toHaveLength(1)
  const addedObject = addedObjects[0]
  if (!addedObject || addedObject.placement.kind !== 'system') {
    throw new Error('Keyboard creation did not place the new object freely on the map.')
  }
  expect(addedObject.placement.x).toBeCloseTo(expectedPosition.x)
  expect(addedObject.placement.y).toBeCloseTo(expectedPosition.y)
  await quitSystemAdd(page)
})

test('map movement commits independently while object changes stay in their draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const hierarchy = await openWorkspaceHierarchy(page)
  await setWorkspaceMapMode(page, 'Move')
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  const initial = await downloadJson(page, 'Export star system JSON')
  const star = initial.system?.objects.find(candidate => candidate.name === 'Primary Star')
  if (!star) throw new Error('The new workspace does not contain its Primary Star.')

  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Unapplied Star')
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  await placement.click()
  const placementForm = page.getByRole('form', { name: 'Object placement', exact: true })
  await placementForm.getByRole('button', { name: 'Move on map', exact: true }).click()
  await expect(map).toHaveAttribute('data-system-object-move-targeting', 'true')
  const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeHierarchy.isVisible()) await closeHierarchy.click()
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  if (await closeInspector.isVisible()) await closeInspector.click()
  const firstTarget = await clickNormalizedSystemPoint(page, map, { x: 0.24, y: 0.42 })
  await expect(map).toHaveAttribute('data-system-object-move-targeting', 'true')
  await placement.click()
  await expect(placementForm.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible({ timeout: 5000 })
  await placementForm.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(placement).toBeFocused()

  let exported = await downloadJson(page, 'Export star system JSON')
  let movedObject = exported.system?.objects.find(candidate => candidate.id === star.id)
  expect(movedObject?.name).toBe('Primary Star')
  if (movedObject?.placement.kind !== 'system') throw new Error('The moved Primary Star is not free on the map.')
  expect(movedObject.placement.x).toBeCloseTo(firstTarget.x)
  expect(movedObject.placement.y).toBeCloseTo(firstTarget.y)

  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspect.getAttribute('aria-expanded') !== 'true') await inspect.click()
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Discard changes' }).click()
  exported = await downloadJson(page, 'Export star system JSON')
  movedObject = exported.system?.objects.find(candidate => candidate.id === star.id)
  expect(movedObject?.name).toBe('Primary Star')
  if (movedObject?.placement.kind !== 'system') throw new Error('Discarding the draft removed the committed move.')
  expect(movedObject.placement.x).toBeCloseTo(firstTarget.x)
  expect(movedObject.placement.y).toBeCloseTo(firstTarget.y)
  const positionBeforeKeyboardMove = { x: movedObject.placement.x, y: movedObject.placement.y }

  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Applied Star')
  await placement.click()
  await placementForm.getByRole('button', { name: 'Move on map', exact: true }).click()
  const closeInspectorAgain = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  if (await closeInspectorAgain.isVisible()) await closeInspectorAgain.click()
  await expect(map).toHaveAttribute('data-system-object-move-targeting', 'true')
  await expect(map).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await placement.click()
  await expect(placementForm.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(exported)
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await placementForm.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect(placement).toBeFocused()
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await saveMapObject(page)

  exported = await downloadJson(page, 'Export star system JSON')
  movedObject = exported.system?.objects.find(candidate => candidate.id === star.id)
  expect(movedObject?.name).toBe('Applied Star')
  if (movedObject?.placement.kind !== 'system') throw new Error('The moved Primary Star is not free on the map.')
  expect(movedObject.placement.x).toBeGreaterThan(positionBeforeKeyboardMove.x)
  expect(movedObject.placement.y).toBeCloseTo(positionBeforeKeyboardMove.y)
})

test('armed object Add owns Placement and cancels an existing-object preview', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const dock = workspaceNavigation(page)
  const modeGroup = dock.getByRole('group', { name: 'Map interaction mode', exact: true })
  await setWorkspaceMapMode(page, 'Move')
  const initialExport = await downloadJson(page, 'Export star system JSON')
  const star = map.locator('.system-object').filter({ hasText: 'Primary Star' })
  const originalTransform = await star.getAttribute('transform')
  if (!originalTransform) throw new Error('The initial Primary Star has no rendered position.')
  await star.locator('.object-hit-target').click()

  const placement = dock.getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  const existingPlacement = page.getByRole('form', { name: 'Object placement', exact: true })
  await existingPlacement.getByRole('button', { name: 'Move on map', exact: true }).click()
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  if (await closeInspector.isVisible()) await closeInspector.click()
  await clickNormalizedSystemPoint(page, map, { x: 0.62, y: 0.64 })
  await expect(star).not.toHaveAttribute('transform', originalTransform)
  await placement.click()
  await expect(existingPlacement.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()

  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const addToggle = dock.getByRole('button', { name: 'Add to map', exact: true })
  await expect(addToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(dock.getByRole('button', { name: 'Placement', exact: true })).toHaveCount(1)
  await expect(page.getByLabel('Object position X', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toHaveCount(0)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)

  await modeGroup.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(addToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(modeGroup.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(star).toHaveAttribute('transform', originalTransform)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)
})
