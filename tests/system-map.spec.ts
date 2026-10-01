import { expect, test } from '@playwright/test'

const catalogueSubtypes = [
  'star',
  'planet',
  'moon',
  'asteroid',
  'belt',
  'station',
  'base',
  'colony',
  'vessel',
  'derelict',
  'jump-point',
  'anomaly',
  'nebula',
  'hazard',
  'other',
] as const

test('the Warden can build and edit a nested star-system map', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })

  await expect(map).toBeVisible()
  await expect(typePicker.locator('option')).toHaveCount(catalogueSubtypes.length)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 2 around Primary Star/ }).click()
  await page.getByRole('button', { name: 'Move orbit up' }).click()
  await expect(inspector.getByRole('heading', { name: 'Orbit 1' })).toBeVisible()

  await typePicker.selectOption('planet')
  await addObject.click()
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await page.getByLabel('Description').fill('A chlorine cloud deck.')
  await page.getByLabel('Description').press('Tab')
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ })).toBeVisible()

  const key = page.getByLabel('Location key')
  const originalKey = await key.inputValue()
  await key.fill('A')
  await key.press('Tab')
  await expect(page.getByRole('alert')).toContainText('already used')
  await expect(key).toHaveValue('A')
  await key.fill(originalKey)
  await key.press('Tab')
  await expect(page.getByRole('alert')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await typePicker.selectOption('belt')
  await addObject.click()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await typePicker.selectOption('moon')
  await addObject.click()
  await page.getByLabel('Name').fill('Nix')
  await expect(page.getByLabel('Name')).toHaveValue('Nix')
  await page.getByLabel('Name').press('Tab')
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await map.getByRole('button', { name: /Nix/ }).click()
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
    await typePicker.selectOption(subtype)
    await addObject.click()
    await expect(inspector.getByRole('heading', { name: generatedNames.get(subtype)! })).toBeVisible()
  }

  await page.getByLabel('Type label').fill('Relay Beacon')
  await page.getByLabel('Type label').press('Tab')
  await page.getByLabel('Name').fill('Relay Beacon Kestrel')
  await page.getByLabel('Name').press('Tab')
  await page.getByLabel('Schematic X').fill('0.75')
  await page.getByLabel('Schematic X').press('Tab')
  await page.getByLabel('Schematic Y').fill('0.25')
  await page.getByLabel('Schematic Y').press('Tab')
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

test('the Warden can connect Jump Points across a cluster and record an unresolved exit', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await typePicker.selectOption('jump-point')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')

  await typePicker.selectOption('station')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Gate')
  await page.getByLabel('Name').press('Tab')

  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  const station = page.getByLabel('Physical Jump Station')
  const stationOption = page.getByRole('option', { name: /Vesper Gate/ })
  const stationId = await stationOption.getAttribute('value')
  expect(stationId).toBeTruthy()
  await station.selectOption(stationId!)
  await expect(station).toHaveValue(stationId!)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await typePicker.selectOption('jump-point')
  await addObject.click()
  await page.getByLabel('Name').fill('Harrow Entry')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01.*Vesper Exit.*Harrow Entry/ })).toBeVisible()

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByLabel('Name').fill('Vesper Arrival')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01.*Vesper Arrival.*Harrow Entry/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-02')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Arrival (Vesper)' })
  await page.getByLabel('Route destination').selectOption('external')
  await page.getByLabel('Unresolved exit label').fill('Unknown Rim')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-02.*Vesper Arrival.*Unknown Rim.*unresolved exit/ })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /Open .* system map/ })).toHaveCount(2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredMap.getByRole('button', { name: /Jump-01.*Vesper Arrival.*Harrow Entry/ })).toBeVisible()
  await expect(restoredMap.getByRole('button', { name: /Jump-02.*Vesper Arrival.*Unknown Rim.*unresolved exit/ })).toBeVisible()
  await restoredMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  await expect(page.getByLabel('Physical Jump Station')).toHaveValue(stationId!)
})

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })

  await typePicker.selectOption('planet')
  await addObject.click()
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')

  await page.getByText('Field definitions', { exact: true }).click()
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await page.getByLabel('Port class choices').fill('Class I\nClass II')
  await page.getByRole('button', { name: 'Save native field options' }).click()
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Chlorine')
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin')
  await page.getByRole('button', { name: 'Save native field options' }).click()
  await expect(page.getByRole('alert')).toContainText('Cannot remove "Chlorine"')
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await page.getByRole('button', { name: 'Save native field options' }).click()

  const addCustomField = async (name: string, type: string, options?: string) => {
    await page.getByLabel('Custom field label').fill(name)
    await page.getByLabel('Value type').selectOption(type)
    if (options !== undefined) {
      await page.getByLabel('New field choices').fill(options)
    }
    await page.getByRole('button', { name: 'Add custom field' }).click()
  }

  await addCustomField('Campaign notes', 'text')
  await page.getByLabel('Campaign notes').fill('Relay station under the ice.')
  await page.getByLabel('Campaign notes').blur()

  await addCustomField('Threat level', 'number')
  await page.getByLabel('Threat level').fill('4')
  await page.getByLabel('Threat level').blur()

  await addCustomField('Hostile', 'boolean')
  await page.getByLabel('Hostile').selectOption('true')

  await addCustomField('Signal class', 'single-select', 'Amber\nBlue')
  await page.getByLabel('Signal class choices').fill('Amber\nBlue\nRed')
  await page.getByRole('button', { name: 'Save Signal class choices' }).click()
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')

  await typePicker.selectOption('station')
  await addObject.click()
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes')).toHaveValue('')
  await page.getByLabel('Port class', { exact: true }).selectOption('Class II')

  await typePicker.selectOption('moon')
  await addObject.click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toBeVisible()
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Thin')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await typePicker.selectOption('planet')
  await addObject.click()
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await page.getByLabel('Campaign notes').fill('Reusable in the next system.')
  await page.getByLabel('Campaign notes').blur()

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
