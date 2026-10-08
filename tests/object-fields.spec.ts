import { expect, test } from '@playwright/test'
import { downloadJson, openFieldDefinitionDialog, editFieldDefinition, editMapObject, saveMapObject, addCustomFieldThroughDialog, catalogueSubtypes, addCatalogueObject } from './helpers'
import type { DownloadWindow } from './helpers'

test('the Warden can build and edit a nested star-system map', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const palette = page.getByRole('region', { name: 'Object palette' })

  await expect(map).toBeVisible()
  await expect(palette.getByRole('group', { name: 'Object categories' }).getByRole('button'))
    .toHaveCount(7)
  await expect(palette.getByRole('group', { name: 'Celestial bodies' }).getByRole('button'))
    .toHaveCount(3)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 2 around Primary Star/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('button', { name: 'Move orbit up' }).click()
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(inspector.getByRole('heading', { name: 'Orbit 1' })).toBeVisible()

  await addCatalogueObject(page, 'planet')
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
  await saveMapObject(page)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'belt')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
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

  const generatedNames = new Map([
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
    ['other', /New other/],
  ] as const)

  for (const subtype of catalogueSubtypes) {
    await addCatalogueObject(page, subtype)
    await expect(inspector.getByRole('heading', { name: generatedNames.get(subtype)! })).toBeVisible()
  }

  await editMapObject(page)
  await page.getByLabel('Type label').fill('Relay Beacon')
  await page.getByLabel('Name', { exact: true }).fill('Relay Beacon Kestrel')
  await page.getByLabel('Schematic X').fill('0.75')
  await page.getByLabel('Schematic Y').fill('0.25')
  await saveMapObject(page)
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Relay Beacon Kestrel' })).toBeVisible()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ }).click()
  await expect(inspector.getByLabel('Type label')).toHaveValue('Relay Beacon')
  await expect(inspector.getByLabel('Schematic X')).toHaveValue('0.75')
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
})

test('Chart details is an active, keyboard-accessible inspector view', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const chartDetails = page.getByRole('button', { name: 'Chart details' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const systemInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  const activeAppearance = await chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await expect(systemInspector.getByText('MAP OBJECT / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.move(0, 0)
  const selectedAppearance = await chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })
  expect(activeAppearance).not.toBe(selectedAppearance)
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await expect(systemInspector.getByText('SYSTEM STRUCTURE / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await expect(page.getByRole('button', { name: 'Chart details' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const route = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Exit/ })
  await expect(route).toBeVisible()
  await route.click()
  await expect(routeInspector.getByText('JUMP ROUTE / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(routeInspector.getByText('CLUSTER DETAILS')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
})

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await fieldDialog.getByRole('button', { name: 'Save changes' }).click()
  await fieldDialog.getByRole('button', { name: /Port class/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Port class choices').fill('Class I\nClass II')
  await fieldDialog.getByRole('button', { name: 'Save changes' }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await addCustomFieldThroughDialog(page, 'Threat level', 'number')
  await addCustomFieldThroughDialog(page, 'Hostile', 'boolean')
  await addCustomFieldThroughDialog(page, 'Signal class', 'single-select', 'Amber\nBlue')
  const signalClassDialog = await openFieldDefinitionDialog(page)
  await signalClassDialog.getByRole('button', { name: /Signal class/ }).click()
  await editFieldDefinition(signalClassDialog)
  await signalClassDialog.getByLabel('Signal class choices').fill('Amber\nBlue\nRed')
  await signalClassDialog.getByRole('button', { name: 'Save changes' }).click()
  await signalClassDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Chlorine')
  await page.getByLabel('Campaign notes').fill('Relay station under the ice.')
  await page.getByLabel('Threat level').fill('4')
  await page.getByLabel('Hostile').selectOption('true')
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes')).toHaveValue('')
  await editMapObject(page)
  await page.getByLabel('Port class', { exact: true }).selectOption('Class II')
  await saveMapObject(page)

  await addCatalogueObject(page, 'moon')
  await expect(page.getByLabel('Atmosphere', { exact: true })).toBeVisible()
  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Thin')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'planet')
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await editMapObject(page)
  await page.getByLabel('Campaign notes').fill('Reusable in the next system.')
  await saveMapObject(page)

  await page.reload()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Chlorine')
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Relay station under the ice.')
  await expect(page.getByLabel('Threat level')).toHaveValue('4')
  await expect(page.getByLabel('Hostile')).toHaveValue('true')
  await expect(page.getByLabel('Signal class', { exact: true })).toHaveValue('Red')
  await hierarchy.getByRole('button', { name: /New moon 1/ }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Thin')
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await hierarchy.getByRole('button', { name: /New station/ }).click()
  await expect(page.getByLabel('Port class', { exact: true })).toHaveValue('Class II')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await restoredClusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  const secondSystemHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await secondSystemHierarchy.getByRole('button', { name: /New planet 1/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Reusable in the next system.')
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

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('Planet survey.')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Relay Station')
  await page.getByLabel('Campaign notes').fill('Station report.')
  await saveMapObject(page)

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: /Campaign notes/ }).click()
  await expect(dialog.getByRole('radio', { name: 'All catalogue objects' })).toBeChecked()
  await editFieldDefinition(dialog)
  await dialog.getByRole('radio', { name: 'Selected catalogue targets' }).check()
  await expect(dialog.getByRole('heading', { name: 'Objects', exact: true })).toHaveCount(0)
  await dialog.getByLabel('Category Celestial bodies').check()
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await dialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  const categoryDialog = await openFieldDefinitionDialog(page)
  await categoryDialog.getByRole('button', { name: /Campaign notes/ }).click()
  const existingValues = categoryDialog.getByRole('region', { name: 'Existing field values' })
  await expect(existingValues).toContainText('Planet survey.')
  await expect(existingValues).toContainText('Station report.')
  await editFieldDefinition(categoryDialog)
  await categoryDialog.getByLabel('Category Celestial bodies').uncheck()
  await categoryDialog.getByLabel('Subtype Planet').check()
  await categoryDialog.getByRole('button', { name: 'Save changes' }).click()
  await categoryDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await page.reload()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  await expect(hierarchy.getByRole('button', { name: /Iria/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Cluster map' }).click()
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

  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 720 }]) {
    await page.setViewportSize(viewport)
    const dialog = await openFieldDefinitionDialog(page)
    const bounds = await dialog.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height, viewportWidth: innerWidth, viewportHeight: innerHeight }
    })

    const size = `${viewport.width}x${viewport.height}`
    expect.soft(Math.abs(bounds.x + bounds.width / 2 - bounds.viewportWidth / 2), size).toBeLessThanOrEqual(1)
    expect.soft(Math.abs(bounds.y + bounds.height / 2 - bounds.viewportHeight / 2), size).toBeLessThanOrEqual(1)
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

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Breathable')
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
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Breathable')
  await editFieldDefinition(nativeDialog)
  await nativeDialog.getByLabel('Atmosphere choices').fill('Thin\nVacuum')
  await expect(nativeDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Breathable')
  await nativeDialog.getByRole('button', { name: 'Save changes' }).click()
  const nativeConfirmation = nativeDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(nativeConfirmation).toContainText('Iria')
  await expect(nativeConfirmation).toContainText('Breathable')
  await nativeDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Breathable')
  await nativeDialog.getByLabel('Atmosphere choices').fill('Thin\nVacuum')
  await nativeDialog.getByRole('button', { name: 'Save changes' }).click()
  await nativeDialog.getByRole('button', { name: 'Remove options and clear affected values' }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('')
  await nativeDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: 'New custom field' }).click()
  await fieldDialog.getByLabel('Custom field label').fill('Signal class')
  await fieldDialog.getByLabel('Value type').selectOption('single-select')
  await fieldDialog.getByLabel('New field choices').fill('Amber\nRed')
  await fieldDialog.getByRole('button', { name: 'Add custom field', exact: true }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')
  await saveMapObject(page)
  const editDialog = await openFieldDefinitionDialog(page)
  await editDialog.getByRole('button', { name: /Signal class/ }).click()
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Red')
  await editFieldDefinition(editDialog)
  await editDialog.getByLabel('Custom field name').fill('Signal designation')
  await editDialog.getByLabel('Signal class choices').fill('Amber')
  await expect(editDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Iria')
  await expect(editDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  const confirmation = editDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(confirmation).toContainText('Iria')
  await expect(confirmation).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Signal class', { exact: true })).toHaveValue('Red')
  await expect(editDialog.getByRole('button', { name: /Signal class/ })).toBeVisible()

  await editDialog.getByLabel('Custom field name').fill('Signal designation')
  await editDialog.getByLabel('Signal class choices').fill('Amber')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(confirmation).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Remove options and clear affected values' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('')
  await expect(editDialog.getByRole('button', { name: /Signal designation/ })).toBeVisible()
  await expect(editDialog.getByLabel('Signal designation choices')).toHaveValue('Amber')
  await editDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Signal designation', { exact: true }).selectOption('Amber')
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
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('Amber')
  const deleteDialog = await openFieldDefinitionDialog(page)
  await deleteDialog.getByRole('button', { name: /Signal designation/ }).click()
  await expect(deleteDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Amber')
  await editFieldDefinition(deleteDialog)
  await deleteDialog.getByRole('button', { name: 'Delete field definition' }).click()
  const deleteConfirmation = deleteDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(deleteConfirmation).toContainText('Iria')
  await expect(deleteConfirmation).toContainText('Amber')
  await deleteDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('Amber')
  await deleteDialog.getByRole('button', { name: 'Delete field definition' }).click()
  await deleteDialog.getByRole('button', { name: 'Delete field and clear values' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
  await expect(deleteDialog.getByLabel('Atmosphere choices')).toBeVisible()
  await deleteDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await page.reload()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
})

test('the retired field-definition prototype route is unavailable', async ({ page }) => {
  const response = await page.goto('/prototype/field-definitions')
  expect(response?.status()).toBe(404)
})
