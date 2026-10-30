import { expect, test } from './fixtures'
import entitySessionFixture from './fixtures/workspace-entity-sessions.json' with { type: 'json' }
import {
  captureMapExportBlobs,
  clickNormalizedSystemPoint,
  clickSystemOrbitPoint,
  downloadJson,
  editMapObject,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  quitSystemAdd,
  resolveImportReview,
  returnToClusterMap,
  saveMapObject,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
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
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()

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
  await setWorkspaceMapMode(page, 'Move')

  const objectSelector = map.getByRole('button', {
    name: new RegExp(`^Select ${addedObject.locationKey}, ${addedObject.name}`),
  })
  await objectSelector.press('Enter')
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await placement.press('Enter')
  const placementForm = page.getByRole('form', { name: 'Object placement', exact: true })
  await placementForm.getByRole('button', { name: 'Move on map', exact: true }).press('Enter')
  await expect(map).toHaveAttribute('data-system-object-move-targeting', 'true')
  await map.press('ArrowRight')
  await placement.press('Enter')
  const confirm = placementForm.getByRole('button', { name: 'Confirm position', exact: true })
  await expect(confirm).toBeVisible()
  await confirm.press('Enter')
  const keyboardMoved = await downloadJson(page, 'Export star system JSON')
  const moved = keyboardMoved.system?.objects.find(object => object.id === addedObject.id)
  if (!moved || moved.placement.kind !== 'system') throw new Error('Keyboard movement lost the new free object.')
  expect(moved.placement.x).not.toBe(addedObject.placement.x)
  expect(moved.placement.y).toBe(addedObject.placement.y)
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
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
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

test('an Orbit object metadata draft survives map moves, relationship transfers, Apply and Discard', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  await setJsonFile(jsonMapImportInput(page), 'placement-draft-session.json', JSON.stringify(entitySessionFixture))
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  await setHeaderMapActionsOpen(page, false)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true }).click()
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const map = page.getByRole('group', { name: 'Session Lab star system map', exact: true })
  await setWorkspaceMapMode(page, 'Move')
  await hierarchy.getByRole('treeitem', { name: /^Select PL-01, Iria/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  const initial = await downloadJson(page, 'Export star system JSON')
  const initialObject = initial.system?.objects.find(object => object.name === 'Iria')
  if (!initialObject || initialObject.placement.kind !== 'orbit') throw new Error('Iria is not on its fixture Orbit.')
  const initialPlanetId = initialObject.id
  const initialSystem = initial.system
  if (!initialSystem) throw new Error('The imported system fixture is missing.')
  const primaryStar = initialSystem.objects.find(object => object.name === 'Primary Star')
  if (!primaryStar) throw new Error('The imported fixture is missing its Primary Star.')
  const secondOrbit = initialSystem.orbits.find(orbit => orbit.hostId === primaryStar.id && orbit.order === 2)
  if (!secondOrbit) throw new Error('The imported fixture is missing its second Primary Star Orbit.')

  async function orbitTarget(orbitLabel: string, degrees: number): Promise<{ point: { x: number; y: number }; minorRadius: number }> {
    const ring = map.getByRole('group', { name: orbitLabel, exact: true }).locator('.orbit-ring')
    return await ring.evaluate((element, targetDegrees) => {
      const ellipse = element as SVGEllipseElement
      const content = ellipse.closest('svg')?.querySelector<SVGGElement>('.system-map-content')
      const ringMatrix = ellipse.getScreenCTM()
      const contentMatrix = content?.getScreenCTM()
      if (!ringMatrix || !contentMatrix) throw new Error('The target Orbit is not attached to the system map.')
      const angle = targetDegrees * Math.PI / 180
      const localPoint = new DOMPoint(
        ellipse.cx.baseVal.value + ellipse.rx.baseVal.value * Math.cos(angle),
        ellipse.cy.baseVal.value + ellipse.ry.baseVal.value * Math.sin(angle),
      )
      const point = localPoint.matrixTransform(ringMatrix).matrixTransform(contentMatrix.inverse())
      return {
        point: { x: point.x, y: point.y },
        minorRadius: Math.min(ellipse.rx.baseVal.value, ellipse.ry.baseVal.value),
      }
    }, degrees)
  }

  function expectAngleWithinPointerError(actual: number | undefined, degrees: number, clickError: number, minorRadius: number): void {
    expect(actual).toBeDefined()
    if (actual === undefined) return
    const expected = degrees * Math.PI / 180
    const difference = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected))
    const angularBound = 2 * Math.asin(Math.min(1, clickError / minorRadius)) + 1e-5
    expect(Math.abs(difference)).toBeLessThanOrEqual(angularBound)
  }

  async function previewAtOrbit(orbitLabel: string, angleDegrees: number): Promise<{ clickError: number; minorRadius: number }> {
    if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
    const form = page.getByRole('form', { name: 'Object placement', exact: true })
    await selectInspectorOption(form.getByLabel('Destination', { exact: true }), orbitLabel)
    await form.getByRole('button', { name: 'Move on map', exact: true }).click()
    const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
    if (await closeHierarchy.isVisible()) await closeHierarchy.click()
    const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
    if (await closeInspector.isVisible()) await closeInspector.click()
    const requested = await orbitTarget(orbitLabel, angleDegrees)
    const delivered = await clickSystemOrbitPoint(page, map, orbitLabel, angleDegrees)
    const deliveredScene = { x: 64 + delivered.x * 832, y: 72 + delivered.y * 416 }
    const clickError = Math.hypot(deliveredScene.x - requested.point.x, deliveredScene.y - requested.point.y)
    const previewPosition = await map.locator(`.system-object[data-object-id="${initialPlanetId}"]`).getAttribute('transform')
    const match = previewPosition?.match(/^translate\(([-\d.e]+)\s+([-\d.e]+)\)$/)
    if (!match) throw new Error('The Orbit move preview has no resolved object position.')
    const projectedError = Math.hypot(Number(match[1]) - requested.point.x, Number(match[2]) - requested.point.y)
    expect(projectedError).toBeLessThanOrEqual(2 * clickError + 1e-6)
    if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
    await expect(form.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
    await form.getByRole('button', { name: 'Confirm position', exact: true }).click()
    const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
    if (await inspect.getAttribute('aria-expanded') !== 'true') await inspect.click()
    await expect(inspector).toBeVisible()
    return { clickError, minorRadius: requested.minorRadius }
  }

  async function previewAtFreePoint(point: { x: number; y: number }): Promise<{ x: number; y: number }> {
    if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
    const form = page.getByRole('form', { name: 'Object placement', exact: true })
    await selectInspectorOption(form.getByLabel('Destination', { exact: true }), 'Free placement')
    await form.getByRole('button', { name: 'Move on map', exact: true }).click()
    const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
    if (await closeHierarchy.isVisible()) await closeHierarchy.click()
    const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
    if (await closeInspector.isVisible()) await closeInspector.click()
    const delivered = await clickNormalizedSystemPoint(page, map, point)
    if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
    await expect(form.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
    await form.getByRole('button', { name: 'Confirm position', exact: true }).click()
    const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
    if (await inspect.getAttribute('aria-expanded') !== 'true') await inspect.click()
    await expect(inspector).toBeVisible()
    return delivered
  }

  await editMapObject(page)
  await inspector.getByLabel('Description', { exact: true }).fill('Applied after an Orbit move.')
  const firstPointer = await previewAtOrbit('Orbit 1 around Primary Star', 125)
  await expect(inspector.getByLabel('Description', { exact: true })).toHaveValue('Applied after an Orbit move.')
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  let exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system?.objects.find(object => object.id === initialPlanetId)?.description)
    .toBe(initialObject.description)
  const orbitMovedAngle = exported.layout.objectAngles[initialPlanetId]
  expectAngleWithinPointerError(orbitMovedAngle, 125, firstPointer.clickError, firstPointer.minorRadius)
  await saveMapObject(page)
  exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system?.objects.find(object => object.id === initialPlanetId)?.description)
    .toBe('Applied after an Orbit move.')
  expect(exported.layout.objectAngles[initialPlanetId]).toBe(orbitMovedAngle)

  await editMapObject(page)
  await inspector.getByLabel('Description', { exact: true }).fill('Applied after an Orbit transfer.')
  const transferPointer = await previewAtOrbit('Orbit 2 around Primary Star', -55)
  exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system?.objects.find(object => object.id === initialPlanetId)?.placement)
    .toEqual({ kind: 'orbit', orbitId: secondOrbit.id })
  expect(exported.system?.objects.find(object => object.id === initialPlanetId)?.description)
    .toBe('Applied after an Orbit move.')
  const transferAngle = exported.layout.objectAngles[initialPlanetId]
  expectAngleWithinPointerError(transferAngle, -55, transferPointer.clickError, transferPointer.minorRadius)
  expect(inspector.getByLabel('Description', { exact: true })).toHaveValue('Applied after an Orbit transfer.')
  await saveMapObject(page)
  exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system?.objects.find(object => object.id === initialPlanetId)?.description)
    .toBe('Applied after an Orbit transfer.')
  expect(exported.layout.objectAngles[initialPlanetId]).toBe(transferAngle)

  await editMapObject(page)
  await inspector.getByLabel('Description', { exact: true }).fill('Discarded after free placement.')
  const freePoint = await previewAtFreePoint({ x: 0.22, y: 0.78 })
  exported = await downloadJson(page, 'Export star system JSON')
  const movedFree = exported.system?.objects.find(object => object.id === initialPlanetId)
  if (!movedFree || movedFree.placement.kind !== 'system') throw new Error('The confirmed free placement was not committed.')
  expect(movedFree.placement.x).toBeCloseTo(freePoint.x, 6)
  expect(movedFree.placement.y).toBeCloseTo(freePoint.y, 6)
  expect(movedFree.description).toBe('Applied after an Orbit transfer.')
  await inspector.getByRole('button', { name: 'Discard changes' }).click()
  exported = await downloadJson(page, 'Export star system JSON')
  const discardedFree = exported.system?.objects.find(object => object.id === initialPlanetId)
  expect(discardedFree?.description).toBe('Applied after an Orbit transfer.')
  expect(discardedFree?.placement).toEqual(movedFree.placement)
})

test('a refused free placement move leaves visible feedback and restores reachable focus', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  await setJsonFile(jsonMapImportInput(page), 'placement-guard-session.json', JSON.stringify(entitySessionFixture))
  const importReview = importReviewDialog(page)
  await expect(importReview).toBeVisible()
  await resolveImportReview(importReview, 'confirm')
  await setHeaderMapActionsOpen(page, false)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true }).click()
  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')

  const map = page.getByRole('group', { name: 'Session Lab star system map', exact: true })
  await setWorkspaceMapMode(page, 'Move')
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await editMapObject(page)
  await selectInspectorOption(inspector.getByLabel('Placement', { exact: true }), 'Orbit 1 around Distant Star')
  await expect(inspector.getByLabel('Placement', { exact: true })).toContainText('Orbit 1 around Distant Star')

  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  await placement.click()
  const form = page.getByRole('form', { name: 'Object placement', exact: true })
  await form.getByRole('button', { name: 'Move on map', exact: true }).click()

  await expect(map).not.toHaveAttribute('data-system-object-move-targeting', 'true')
  const refusal = form.getByRole('alert').filter({ hasText: 'Resolve the Inspector relationship draft before moving this object.' })
  await expect(refusal).toBeVisible()
  await expect(refusal).toBeInViewport()
  await expect(placement).toBeFocused()

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(refusal).toBeInViewport()
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
