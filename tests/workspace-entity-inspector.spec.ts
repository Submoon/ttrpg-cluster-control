import { expect, test } from '@playwright/test'
import {
  addCatalogueObject,
  addCustomFieldThroughDialog,
  captureMapExportBlobs,
  dragHtmlElementToWorldPoint,
  downloadJson,
  editFieldDefinition,
  editMapObject,
  ensureMapDragPointsReachable,
  openWorkspaceHierarchy,
  openFieldDefinitionDialog,
  readInspectorSelection,
  quitSystemAdd,
  saveMapObject,
  selectInspectorOption,
  setWorkspaceMapMode,
} from './helpers'

test('same-kind object switches keep Inspector labels attached to the selected controls', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Iria')
})

test('native and custom single-select options can store the literal unset token', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const nativeFields = await openFieldDefinitionDialog(page)
  await nativeFields.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(nativeFields)
  await nativeFields.getByLabel('Atmosphere choices').fill('Breathable\nUnbreathable\nVacuum\n__not_recorded__')
  await nativeFields.getByRole('button', { name: 'Apply field changes' }).click()
  await nativeFields.getByRole('button', { name: 'Close field definitions' }).click()
  await addCustomFieldThroughDialog(page, 'Signal designation', 'single-select', 'Amber\n__not_recorded__')

  await editMapObject(page)
  const atmosphere = page.getByLabel('Atmosphere', { exact: true })
  const designation = page.getByLabel('Signal designation', { exact: true })
  await selectInspectorOption(atmosphere, '__not_recorded__')
  await selectInspectorOption(designation, '__not_recorded__')
  expect(await readInspectorSelection(atmosphere)).toBe('__not_recorded__')
  expect(await readInspectorSelection(designation)).toBe('__not_recorded__')
  await page.getByRole('button', { name: 'Apply changes' }).click()

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('__not_recorded__')
  expect(await readInspectorSelection(page.getByLabel('Signal designation', { exact: true }))).toBe('__not_recorded__')

  const exported = await downloadJson(page, 'Export star system JSON')
  const object = exported.system?.objects.find(candidate => candidate.name === 'Iria')
  expect(object?.atmosphere).toBe('__not_recorded__')
  const field = exported.objectFieldSettings.customFields.find(candidate => candidate.name === 'Signal designation')
  expect(field).toBeDefined()
  expect(object?.customFieldValues?.[field!.id]).toBe('__not_recorded__')
})

test('an object inspector keeps its draft across Hide and offers persistent Apply actions', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Name').fill('Primary Star, edited')

  await expect(inspector.getByRole('button', { name: 'Apply changes' })).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Object details' })).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Hide inspector', exact: true })).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Discard changes' })).toBeVisible()

  await inspector.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()

  await expect(inspector.getByLabel('Name')).toHaveValue('Primary Star, edited')
  await inspector.getByRole('button', { name: 'Apply changes' }).click()
  await expect(hierarchy.getByRole('button', { name: 'Select A, Primary Star, edited', exact: true })).toBeVisible()
})

test('an Orbit Inspector applies rotation and numeric geometry in Select mode', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
  const center = { x: 360, y: 320 }
  await ensureMapDragPointsReachable(page, map, addOrbit, center)
  await dragHtmlElementToWorldPoint(page, addOrbit, map, center)
  await expect(map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })).toBeVisible()
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Select')

  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()

  await expect(page.getByRole('spinbutton', { name: 'Rotation', exact: true })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('250')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('75')
  await page.getByRole('spinbutton', { name: 'Center X', exact: true }).fill('0.2')
  await page.getByRole('spinbutton', { name: 'Center Y', exact: true }).fill('0.5')
  await page.getByRole('spinbutton', { name: 'Rotation', exact: true }).fill('45')
  const committedBeforeInvalidApply = await downloadJson(page, 'Export star system JSON')
  const centerX = page.getByRole('spinbutton', { name: 'Center X', exact: true })
  await centerX.fill('')
  await page.getByRole('button', { name: 'Apply changes' }).click()
  const validation = page.getByRole('alert')
  await expect(validation).toContainText('Center X is required.')
  const centerXIssue = validation.getByRole('button', { name: 'Center X is required.' })
  await centerXIssue.click()
  await expect(centerX).toBeFocused()
  const committedAfterInvalidApply = await downloadJson(page, 'Export star system JSON')
  expect(committedAfterInvalidApply).toEqual(committedBeforeInvalidApply)

  await centerX.fill('0.2')
  await page.getByRole('button', { name: 'Apply changes' }).click()

  const exported = await downloadJson(page, 'Export star system JSON')
  const orbit = exported.system?.orbits[0]
  expect(orbit).toMatchObject({ center: { x: 0.2, y: 0.5 } })
  const orbitId = orbit?.id
  expect(orbitId).toBeTruthy()
  expect(exported.layout.orbitRadii[orbitId!]).toEqual({ horizontal: 250, vertical: 75 })
  expect(exported.layout.orbitRotations?.[orbitId!]).toBe(45)
})

test('the Orbit Inspector footer stays visible and hittable after its body scrolls', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
  const center = { x: 360, y: 320 }
  await ensureMapDragPointsReachable(page, map, addOrbit, center)
  await dragHtmlElementToWorldPoint(page, addOrbit, map, center)
  await expect(map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })).toBeVisible()
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Select')
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('spinbutton', { name: 'Rotation', exact: true }).fill('13')

  const inspector = page.locator('.entity-inspector[aria-label="Orbit inspector"]')
  const body = inspector.locator('.entity-inspector-body')
  const apply = inspector.getByRole('button', { name: 'Apply changes' })
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 500 }]) {
    await page.setViewportSize(viewport)
    await expect(body).toBeVisible()
    await body.evaluate(element => { element.scrollTop = 0 })
    await expect(page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }))
      .toBeInViewport()
    await body.evaluate(element => { element.scrollTop = element.scrollHeight })
    expect(await body.evaluate(element => element.scrollTop), `${viewport.width}x${viewport.height} body scrolls`)
      .toBeGreaterThan(0)
    await expect(apply).toBeVisible()
    await expect(page.locator('.workspace-compact-recovery')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Close inspector panel' })).toHaveCount(0)
    const receivesPointer = await apply.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      return !!target && (target === element || element.contains(target))
    })
    expect(receivesPointer, `${viewport.width}x${viewport.height} Apply is the hit target`).toBe(true)
    await page.getByLabel('Center Y', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(apply, `${viewport.width}x${viewport.height} Apply can receive keyboard focus`).toBeFocused()
  }

  await apply.click()
  await expect(page.getByRole('button', { name: 'Edit Orbit' })).toBeVisible()
})
