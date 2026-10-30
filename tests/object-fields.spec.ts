import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, deletionReviewDialog, resolveDeletionReview } from './helpers'
import { addClusterSystem, captureMapExportBlobs, openWorkspaceHierarchy, readInspectorSelection, selectInspectorOption, setWorkspaceMapMode } from './helpers'
import { returnToClusterMap, clickDockAction, workspaceZoomControls } from './helpers'
import { downloadJson, openFieldDefinitionDialog, editFieldDefinition, editMapObject, saveMapObject, addCustomFieldThroughDialog, catalogueSubtypes, addCatalogueObject } from './helpers'
import type { DownloadWindow } from './helpers'
import { RENDER_GEOMETRY_TOLERANCE_PX } from './render-tolerances'

const generatedNames = new Map<typeof catalogueSubtypes[number], RegExp>([
  ['star', /New star/],
  ['planet', /New planet/],
  ['moon', /New moon/],
  ['asteroid', /New asteroid/],
  ['belt', /New belt/],
  ['station', /New station/],
  ['base', /New base/],
  ['colony', /New colony/],
  ['vessel', /New vessel/],
  ['derelict', /New derelict/],
  ['jump-point', /New jump point/],
  ['anomaly', /New anomaly/],
  ['nebula', /New nebula/],
  ['hazard', /New hazard/],
  ['other', /New other/i],
] as const)

const catalogueFamilies = [
  {
    label: 'celestial bodies and fields',
    subtypes: ['star', 'planet', 'moon', 'asteroid', 'belt'],
  },
  {
    label: 'installations and vessels',
    subtypes: ['station', 'base', 'colony', 'vessel', 'derelict'],
  },
  {
    label: 'jump points and phenomena',
    subtypes: ['jump-point', 'anomaly', 'nebula', 'hazard', 'other'],
  },
] as const

async function createCatalogueWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
}

test('the Warden can build and edit a nested star-system map', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const palette = page.getByRole('region', { name: 'Object palette' })

  await expect(map).toBeVisible()
  await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  await expect(palette.getByRole('group', { name: 'Object categories' }).getByRole('button'))
    .toHaveCount(7)
  await expect(palette.getByRole('group', { name: 'Celestial bodies' }).getByRole('button'))
    .toHaveCount(3)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await hierarchy.getByRole('button', { name: /Orbit 2 around Primary Star/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('spinbutton', { name: 'Orbit order', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Apply changes' }).click()
  await expect(inspector.getByRole('heading', { name: 'Orbit 1' })).toBeVisible()

  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Description').fill('A chlorine cloud deck.')
  await saveMapObject(page)
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ })).toBeVisible()

  const key = page.getByLabel('Location key')
  const originalKey = await key.inputValue()
  await editMapObject(page)
  await key.fill('A')
  await saveMapObject(page)
  await expect(page.getByRole('alert')).toContainText('already used')
  await expect(key).toHaveValue('A')
  await key.fill(originalKey)
  await page.getByLabel('Description').fill('A chlorine cloud deck with recovered edits.')
  await expect(page.getByRole('button', { name: /Apply changes/ })).toBeEnabled()
  await saveMapObject(page)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'belt', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
  await addCatalogueObject(page, 'moon', {
    target: { kind: 'orbit', label: 'Orbit 1 around Iria' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Nix')
  await saveMapObject(page)
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Nix/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toHaveAttribute('aria-current', 'true')

  await addCatalogueObject(page, 'other', { target: { kind: 'free', x: 0.75, y: 0.25 } })
  await expect(inspector.getByRole('heading', { name: generatedNames.get('other')! })).toBeVisible()

  await editMapObject(page)
  await page.getByLabel('Type label').fill('Relay Beacon')
  await page.getByLabel('Name', { exact: true }).fill('Relay Beacon Kestrel')
  await saveMapObject(page)
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Relay Beacon Kestrel' })).toBeVisible()
  await waitForWorkspaceSaved(page)

  await page.reload()
  await openWorkspaceHierarchy(page)
  await waitForWorkspaceSaved(page)
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ }).click()
  await expect(inspector.getByLabel('Type label')).toHaveValue('Relay Beacon')
  await expect(inspector.getByLabel('Schematic X')).toHaveCount(0)
  const afterReload = await downloadJson(page, 'Export star system JSON')
  const beacon = afterReload.system?.objects.find(object => object.name === 'Relay Beacon Kestrel')
  expect(beacon?.placement.kind).toBe('system')
  if (beacon?.placement.kind !== 'system') throw new Error('Expected the beacon to keep its free map position.')
  expect(beacon.placement.x).toBeCloseTo(0.75, 2)
  expect(beacon.placement.y).toBeCloseTo(0.25, 2)
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
})

for (const family of catalogueFamilies) {
  test(`the Warden adds and reloads ${family.label}`, async ({ page }) => {
    await createCatalogueWorkspace(page)
    const inspector = page.getByRole('complementary', { name: 'Object inspector' })
    const createdObjects: Array<{ subtype: string; name: string }> = []

    for (const [index, subtype] of family.subtypes.entries()) {
      await addCatalogueObject(page, subtype, {
        target: { kind: 'free', x: [0.1, 0.3, 0.5, 0.7, 0.9][index]!, y: 0.2 },
      })
      const heading = inspector.getByRole('heading', { name: generatedNames.get(subtype)! })
      await expect(heading).toBeVisible()
      createdObjects.push({
        subtype: subtype === 'other' ? 'Other object' : subtype,
        name: await inspector.getByRole('textbox', { name: 'Name', exact: true }).inputValue(),
      })
    }

    await waitForWorkspaceSaved(page)
    const exported = await downloadJson(page, 'Export star system JSON')
    for (const created of createdObjects) {
      expect(exported.system?.objects).toContainEqual(expect.objectContaining(created))
    }

    await page.reload()
    const hierarchy = await openWorkspaceHierarchy(page)
    for (const created of createdObjects) {
      await expect(hierarchy.getByRole('button', { name: new RegExp(created.name) })).toBeVisible()
    }
    const reloaded = await downloadJson(page, 'Export star system JSON')
    for (const created of createdObjects) {
      expect(reloaded.system?.objects).toContainEqual(expect.objectContaining(created))
    }
  })
}

test('Chart details is an active, keyboard-accessible inspector view', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const chartDetails = page.getByRole('button', { name: 'Chart details' })
  const hierarchy = await openWorkspaceHierarchy(page)
  const systemInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  const activeAppearance = await chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await expect(systemInspector.getByRole('heading', { name: 'Object details' })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.move(0, 0)
  await expect.poll(() => chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })).not.toBe(activeAppearance)
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await expect(systemInspector.getByRole('heading', { name: 'Axes and rotation' })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await addCatalogueObject(page, 'jump-point', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await clickDockAction(page, 'Add Jump Route')
  await expect(page.getByRole('button', { name: 'Chart details' })).toHaveCount(0)
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Exit (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Unresolved external exit')
  await page.getByLabel('Unknown destination label').fill('Beyond the Reach')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const route = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Exit/ })
  await expect(route).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await setWorkspaceMapMode(page, 'Select')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await route.locator('.cluster-route-label').click()
  await expect(routeInspector.getByText('JUMP ROUTE / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(routeInspector.getByText('CLUSTER DETAILS')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
})

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  // This round trip edits six definitions and creates objects in two systems through the public UI.
  test.slow()
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await fieldDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await expect(fieldDialog.getByRole('region', { name: 'Field change review' }))
    .toContainText('No saved values are affected.')
  await fieldDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await fieldDialog.getByRole('button', { name: /Port class/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Port class choices').fill('Class I\nClass II')
  await fieldDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await expect(fieldDialog.getByRole('region', { name: 'Field change review' }))
    .toContainText('No saved values are affected.')
  await fieldDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await addCustomFieldThroughDialog(page, 'Threat level', 'number')
  await addCustomFieldThroughDialog(page, 'Hostile', 'boolean')
  await addCustomFieldThroughDialog(page, 'Signal class', 'single-select', 'Amber\nBlue')
  const signalClassDialog = await openFieldDefinitionDialog(page)
  await signalClassDialog.getByRole('button', { name: /Signal class/ }).click()
  await editFieldDefinition(signalClassDialog)
  await signalClassDialog.getByLabel('Signal class choices').fill('Amber\nBlue\nRed')
  await signalClassDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await signalClassDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Atmosphere', { exact: true }), 'Chlorine')
  await page.getByLabel('Campaign notes', { exact: true }).fill('Relay station under the ice.')
  await page.getByLabel('Threat level').fill('4')
  await selectInspectorOption(page.getByLabel('Hostile'), 'Yes')
  await selectInspectorOption(page.getByLabel('Signal class', { exact: true }), 'Red')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('')
  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Port class', { exact: true }), 'Class II')
  await saveMapObject(page)

  await addCatalogueObject(page, 'moon')
  await expect(page.getByLabel('Atmosphere', { exact: true })).toBeVisible()
  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Atmosphere', { exact: true }), 'Thin')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveCount(0)

  await returnToClusterMap(page)
  await addClusterSystem(page, { open: true })
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await addCatalogueObject(page, 'planet')
  await expect(page.getByLabel('Campaign notes', { exact: true })).toBeVisible()
  await editMapObject(page)
  await page.getByLabel('Campaign notes', { exact: true }).fill('Reusable in the next system.')
  await saveMapObject(page)

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('Chlorine')
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Relay station under the ice.')
  await expect(page.getByLabel('Threat level')).toHaveValue('4')
  expect(await readInspectorSelection(page.getByLabel('Hostile'))).toBe('Yes')
  expect(await readInspectorSelection(page.getByLabel('Signal class', { exact: true }))).toBe('Red')
  await hierarchy.getByRole('button', { name: /New moon 1/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('Thin')
  await waitForWorkspaceSaved(page)
  await hierarchy.getByRole('button', { name: /New station/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Port class', { exact: true }))).toBe('Class II')

  await returnToClusterMap(page)
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  await restoredClusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  const secondSystemHierarchy = await openWorkspaceHierarchy(page)
  await secondSystemHierarchy.getByRole('button', { name: /New planet 1/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Reusable in the next system.')
})

test('custom field category and subtype scopes hide ineligible objects without deleting values', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes', { exact: true }).fill('Planet survey.')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Relay Station')
  await page.getByLabel('Campaign notes', { exact: true }).fill('Station report.')
  await saveMapObject(page)

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(dialog)
  await expect(dialog.getByLabel('All catalogue objects')).toBeChecked()
  await dialog.getByLabel('All catalogue objects').uncheck()
  await expect(dialog.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Subtypes', exact: true })).toBeVisible()
  await dialog.getByLabel('Category Celestial bodies').check()
  await dialog.getByRole('button', { name: 'Apply field changes' }).click()
  await dialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveCount(0)

  const categoryDialog = await openFieldDefinitionDialog(page)
  await categoryDialog.getByRole('button', { name: /Campaign notes/ }).click()
  const existingValues = categoryDialog.getByRole('region', { name: 'Existing field values' })
  await expect(existingValues).toContainText('Planet survey.')
  await expect(existingValues).toContainText('Station report.')
  await editFieldDefinition(categoryDialog)
  await categoryDialog.getByLabel('Category Celestial bodies').uncheck()
  await categoryDialog.getByLabel('Subtype Planet').check()
  await categoryDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await categoryDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveCount(0)

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Iria')
  await resolveDeletionReview(deletionReview, 'confirm')
  await expect(hierarchy.getByRole('button', { name: /Iria/ })).toHaveCount(0)

  await returnToClusterMap(page)
  const cleanupExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const cleanedField = cleanupExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  const remainingStation = cleanupExport.cluster!.systems[0]!.objects
    .find(object => object.name === 'Relay Station')!
  expect(cleanedField.applicability).toEqual([
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(remainingStation.customFieldValues?.[cleanedField.id]).toBe('Station report.')
})

test('field definitions dialog stays centered on desktop and narrow viewports', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()

  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 720 }]) {
    await page.setViewportSize(viewport)
    const dialog = await openFieldDefinitionDialog(page)
    const bounds = await dialog.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height, viewportWidth: innerWidth, viewportHeight: innerHeight }
    })

    const size = `${viewport.width}x${viewport.height}`
    expect.soft(Math.abs(bounds.x + bounds.width / 2 - bounds.viewportWidth / 2), size)
      .toBeLessThanOrEqual(RENDER_GEOMETRY_TOLERANCE_PX)
    expect.soft(Math.abs(bounds.y + bounds.height / 2 - bounds.viewportHeight / 2), size)
      .toBeLessThanOrEqual(RENDER_GEOMETRY_TOLERANCE_PX)
    expect.soft(bounds.x, size).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.y, size).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.x + bounds.width, size).toBeLessThanOrEqual(bounds.viewportWidth)
    expect.soft(bounds.y + bounds.height, size).toBeLessThanOrEqual(bounds.viewportHeight)
    await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  }
})

test('field definition management previews destructive changes in a map-bound dialog', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Atmosphere', { exact: true }), 'Breathable')
  await saveMapObject(page)

  const openButton = page.getByRole('button', { name: 'Open field definitions' })
  const dialog = await openFieldDefinitionDialog(page)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveAttribute('aria-current', 'true')

  const nativeDialog = await openFieldDefinitionDialog(page)
  await nativeDialog.getByRole('button', { name: /Atmosphere/ }).click()
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Breathable')
  await editFieldDefinition(nativeDialog)
  await nativeDialog.getByLabel('Atmosphere choices').fill('Thin\nVacuum')
  await nativeDialog.getByRole('button', { name: 'Apply field changes' }).click()
  const nativeReview = nativeDialog.getByRole('region', { name: 'Field change review' })
  await expect(nativeReview).toContainText('Iria')
  await expect(nativeReview).toContainText('Breathable')
  await nativeDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(nativeDialog.getByLabel('Atmosphere choices')).toHaveValue('Thin\nVacuum')
  await nativeDialog.getByRole('button', { name: 'Close field definitions' }).click()
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('Breathable')
  const resumedNativeDialog = await openFieldDefinitionDialog(page)
  await expect(resumedNativeDialog.getByLabel('Atmosphere choices')).toHaveValue('Thin\nVacuum')
  await resumedNativeDialog.getByRole('button', { name: 'Apply field changes' }).click()
  const resumedNativeReview = resumedNativeDialog.getByRole('region', { name: 'Field change review' })
  await expect(resumedNativeReview).toContainText('Iria')
  await expect(resumedNativeReview).toContainText('Breathable')
  await resumedNativeDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await resumedNativeDialog.getByRole('button', { name: 'Close field definitions' }).click()
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('Not recorded')
  const savedNativeDialog = await openFieldDefinitionDialog(page)
  await expect(savedNativeDialog.getByRole('region', { name: 'Saved definition details' })).toContainText('Thin')
  await expect(savedNativeDialog.getByRole('region', { name: 'Saved definition details' })).toContainText('Vacuum')
  await savedNativeDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: 'New custom field' }).click()
  await fieldDialog.getByLabel('Custom field label').fill('Signal class')
  await selectInspectorOption(fieldDialog.getByLabel('Value type'), 'Single-select')
  await fieldDialog.getByLabel('New field choices').fill('Amber\nRed')
  await fieldDialog.getByRole('button', { name: 'Add custom field', exact: true }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Signal class', { exact: true }), 'Red')
  await saveMapObject(page)
  const editDialog = await openFieldDefinitionDialog(page)
  await editDialog.getByRole('button', { name: /Signal class/ }).click()
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Red')
  await editFieldDefinition(editDialog)
  await editDialog.getByLabel('Custom field name').fill('Signal designation')
  await editDialog.getByLabel('Signal designation choices').fill('Amber')
  await editDialog.getByRole('button', { name: 'Apply field changes' }).click()
  const review = editDialog.getByRole('region', { name: 'Field change review' })
  await expect(review).toContainText('Iria')
  await expect(review).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(editDialog.getByLabel('Custom field name')).toHaveValue('Signal designation')
  await expect(editDialog.getByLabel('Signal designation choices')).toHaveValue('Amber')
  await editDialog.getByRole('button', { name: 'Close field definitions' }).click()
  expect(await readInspectorSelection(page.getByLabel('Signal class', { exact: true }))).toBe('Red')
  const resumedEditDialog = await openFieldDefinitionDialog(page)
  await expect(resumedEditDialog.getByLabel('Custom field name')).toHaveValue('Signal designation')
  await expect(resumedEditDialog.getByLabel('Signal designation choices')).toHaveValue('Amber')
  await resumedEditDialog.getByRole('button', { name: 'Apply field changes' }).click()
  const resumedReview = resumedEditDialog.getByRole('region', { name: 'Field change review' })
  await expect(resumedReview).toContainText('Iria')
  await expect(resumedReview).toContainText('Red')
  await resumedEditDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await expect(resumedEditDialog.getByRole('button', { name: /Signal designation/ })).toBeVisible()
  await expect(resumedEditDialog.getByRole('region', { name: 'Saved definition details' })).toContainText('Amber')
  await resumedEditDialog.getByRole('button', { name: 'Close field definitions' }).click()
  expect(await readInspectorSelection(page.getByLabel('Signal designation', { exact: true }))).toBe('Not recorded')

  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Signal designation', { exact: true }), 'Amber')
  await saveMapObject(page)
  const updatedExport = await downloadJson(page, 'Export star system JSON')
  expect(updatedExport.objectFieldSettings.customFields).toContainEqual(
    expect.objectContaining({
      name: 'Signal designation',
      type: 'single-select',
      options: ['Amber'],
    }),
  )
  const exportedIria = updatedExport.system!.objects.find(object => object.name === 'Iria')!
  expect(exportedIria.customFieldValues).toMatchObject({
    [updatedExport.objectFieldSettings.customFields.find(field => field.name === 'Signal designation')!.id]: 'Amber',
  })

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Signal designation', { exact: true }))).toBe('Amber')
  const deleteDialog = await openFieldDefinitionDialog(page)
  await deleteDialog.getByRole('button', { name: /Signal designation/ }).click()
  await expect(deleteDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Amber')
  await editFieldDefinition(deleteDialog)
  await deleteDialog.getByRole('button', { name: 'Delete field…' }).click()
  const deleteReview = deleteDialog.getByRole('region', { name: 'Field change review' })
  await expect(deleteReview).toContainText('Iria')
  await expect(deleteReview).toContainText('Amber')
  await deleteDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await deleteDialog.getByRole('button', { name: 'Close field definitions' }).click()
  expect(await readInspectorSelection(page.getByLabel('Signal designation', { exact: true }))).toBe('Amber')
  const resumedDeleteDialog = await openFieldDefinitionDialog(page)
  await resumedDeleteDialog.getByRole('button', { name: 'Delete field…' }).click()
  const resumedDeleteReview = resumedDeleteDialog.getByRole('region', { name: 'Field change review' })
  await expect(resumedDeleteReview).toContainText('Iria')
  await expect(resumedDeleteReview).toContainText('Amber')
  await resumedDeleteDialog.getByRole('button', { name: 'Delete field and clear values' }).click()
  const fieldList = resumedDeleteDialog.getByRole('navigation', { name: 'Field definitions' })
  await expect(fieldList).toBeVisible()
  await expect(fieldList.getByRole('button', { name: /Signal designation/ })).toHaveCount(0)
  const focusedNeighbor = fieldList.getByRole('button', { name: /Port class/ })
  await expect(focusedNeighbor).toBeFocused()
  await expect(resumedDeleteDialog.getByLabel('Signal designation choices')).toHaveCount(0)
  await resumedDeleteDialog.getByRole('button', { name: 'Close field definitions' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
})

test('the retired field-definition prototype route is unavailable', async ({ page }) => {
  const response = await page.goto('/prototype/field-definitions')
  expect(response?.status()).toBe(404)
})
