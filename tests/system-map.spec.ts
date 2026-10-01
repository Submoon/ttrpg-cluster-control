import { expect, test } from '@playwright/test'

type WorldPoint = { x: number; y: number }
type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }
type ExportedObject = {
  id: string
  name: string
  family: string
  subtype: string
  locationKey: string
  placement: { kind: 'system'; x: number; y: number } | { kind: 'orbit'; orbitId: string }
  jumpStationId?: string | null
  customFieldValues?: Record<string, string | number | boolean>
}
type ExportedSystem = {
  id: string
  name: string
  objects: ExportedObject[]
  orbits: Array<{ id: string; hostId: string; order: number }>
}
type ExportedRoute = {
  id: string
  name: string
  fromPointId: string
  toPointId: string | null
  unresolvedExit?: string
}
type ExportedMap = {
  format: string
  version: number
  type: 'cluster' | 'system'
  cluster?: { id: string; name: string; systems: ExportedSystem[]; routes: ExportedRoute[] }
  system?: ExportedSystem
  objectFieldSettings: {
    customFields: Array<{ id: string; name: string; type: string; options?: string[] }>
  }
  layout: {
    version: number
    systemPositions?: Record<string, WorldPoint>
    orbitRadii: Record<string, number>
    objectAngles: Record<string, number>
  }
}

async function dragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('Could not find the map element to drag.')

  const destination = await map.evaluate((element, target) => {
    const transform = (element as SVGSVGElement).getScreenCTM()
    if (!transform) throw new Error('The map SVG is not attached to the document.')
    const screenPoint = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screenPoint.x, y: screenPoint.y }
  }, point)

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 6 })
  await page.mouse.up()
}

async function panMap(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  delta: WorldPoint,
): Promise<void> {
  await map.scrollIntoViewIfNeeded()
  const start = await map.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + 12, y: bounds.bottom - 12 }
  })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 })
  await page.mouse.up()
}

async function dragBy(
  page: import('@playwright/test').Page,
  source: import('@playwright/test').Locator,
  delta: WorldPoint,
): Promise<void> {
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('Could not find the map element to drag.')

  const x = sourceBox.x + sourceBox.width / 2
  const y = sourceBox.y + sourceBox.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + delta.x, y + delta.y, { steps: 6 })
  await page.mouse.up()
}

async function orbitalAngle(map: import('@playwright/test').Locator): Promise<number> {
  return map.evaluate((element) => {
    const host = element.querySelector<SVGCircleElement>('.system-object .star-core')
    const planet = [...element.querySelectorAll<SVGGElement>('.system-object')]
      .find(object => object.getAttribute('aria-label')?.includes('Iria'))
      ?.querySelector<SVGCircleElement>('.object-core')
    if (!host || !planet) throw new Error('Could not locate the star and orbiting object.')

    const hostBounds = host.getBoundingClientRect()
    const planetBounds = planet.getBoundingClientRect()
    return Math.atan2(
      planetBounds.y + planetBounds.height / 2 - hostBounds.y - hostBounds.height / 2,
      planetBounds.x + planetBounds.width / 2 - hostBounds.x - hostBounds.width / 2,
    )
  })
}

async function downloadJson(page: import('@playwright/test').Page, buttonName: string): Promise<ExportedMap> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: buttonName }).click()
  await downloadPromise
  const json = await page.evaluate(async () => {
    const blob = (window as DownloadWindow).__mapExportBlobs?.shift()
    if (!blob) throw new Error('Could not read the downloaded JSON file.')
    return blob.text()
  })
  return JSON.parse(json) as ExportedMap
}

async function setJsonFile(
  input: import('@playwright/test').Locator,
  name: string,
  content: string,
): Promise<void> {
  await input.evaluate((element, file) => {
    const input = element as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File([file.content], file.name, { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, { name, content })
}

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

test('the Warden can navigate and arrange both maps', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const clusterNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const clusterZoom = clusterNavigation.getByLabel('Zoom level')
  await expect(clusterZoom).toHaveText('100%')
  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(clusterZoom).toHaveText('120%')

  const clusterBounds = await clusterMap.boundingBox()
  if (!clusterBounds) throw new Error('The Jump Cluster map is not visible.')
  await page.mouse.move(
    clusterBounds.x + clusterBounds.width / 2,
    clusterBounds.y + clusterBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(120)
  await page.mouse.wheel(0, -5000)
  await expect(clusterZoom).toHaveText('400%')
  await page.mouse.wheel(0, 5000)
  await expect(clusterZoom).toHaveText('25%')
  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  await expect(clusterZoom).toHaveText('400%')

  const clusterContent = clusterMap.locator('.cluster-map-content')
  const beforePan = await clusterContent.getAttribute('transform')
  await panMap(page, clusterMap, { x: 36, y: 24 })
  await expect(clusterContent).not.toHaveAttribute('transform', beforePan!)

  const systemNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const nodeBeforeDrag = await systemNode.getAttribute('transform')
  await dragBy(page, systemNode.locator('.cluster-system-card'), { x: 48, y: 24 })
  await expect(systemNode).not.toHaveAttribute('transform', nodeBeforeDrag!)
  const nodeAfterDrag = await systemNode.getAttribute('transform')
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const restoredNode = restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' })
  await expect(restoredNode).toHaveAttribute('transform', nodeAfterDrag!)
  await expect(page.getByLabel('Zoom level')).toHaveText('100%')
  await restoredNode.click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })
  await typePicker.selectOption('planet')
  await addObject.click()
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')

  const planet = map.getByRole('button', { name: /Iria/ })
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const angleBeforeResize = await orbitalAngle(map)
  const orbitRadius = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await dragToWorldPoint(page, map, orbitRadius, { x: 633, y: 280 })
  await expect(orbitRadius).toHaveAttribute('aria-valuenow', '152')
  expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
  await largeOrbitRadius.press('End')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
  await page.keyboard.press('ArrowRight')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')

  await typePicker.selectOption('hazard')
  await addObject.click()
  await page.getByLabel('Name').fill('Glass Wake')
  await page.getByLabel('Name').press('Tab')
  const hazard = map.getByRole('button', { name: /Glass Wake/ })
  await dragToWorldPoint(page, map, hazard.locator('.object-hit-target'), { x: 230, y: 180 })
  const hazardTransform = await hazard.getAttribute('transform')
  await expect(page.getByText('Saved on this device')).toBeVisible()

  const systemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const systemZoom = systemNavigation.getByLabel('Zoom level')
  await expect(systemZoom).toHaveText('100%')
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(systemZoom).toHaveText('120%')
  const systemBounds = await map.boundingBox()
  if (!systemBounds) throw new Error('The star system map is not visible.')
  await page.mouse.move(
    systemBounds.x + systemBounds.width / 2,
    systemBounds.y + systemBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(120)
  await page.mouse.wheel(0, -5000)
  await expect(systemZoom).toHaveText('400%')
  await page.mouse.wheel(0, 5000)
  await expect(systemZoom).toHaveText('25%')
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()
  await expect(systemZoom).not.toHaveText('100%')
  const fittedMapBounds = await map.boundingBox()
  const fittedOrbitBounds = await map.getByRole('group', { name: 'Orbit 2 around Primary Star' })
    .locator('.orbit-ring').boundingBox()
  if (!fittedMapBounds || !fittedOrbitBounds) throw new Error('The fitted Orbit is not visible.')
  expect(fittedOrbitBounds.x).toBeGreaterThanOrEqual(fittedMapBounds.x)
  expect(fittedOrbitBounds.x + fittedOrbitBounds.width)
    .toBeLessThanOrEqual(fittedMapBounds.x + fittedMapBounds.width)
  expect(fittedOrbitBounds.y).toBeGreaterThanOrEqual(fittedMapBounds.y)
  expect(fittedOrbitBounds.y + fittedOrbitBounds.height)
    .toBeLessThanOrEqual(fittedMapBounds.y + fittedMapBounds.height)
  const systemContent = map.locator('.system-map-content')
  const systemBeforePan = await systemContent.getAttribute('transform')
  await panMap(page, map, { x: 24, y: 18 })
  await expect(systemContent).not.toHaveAttribute('transform', systemBeforePan!)

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', '152')
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', '571')
  await expect(page.getByLabel('Zoom level')).toHaveText('100%')
  await expect(restoredMap.getByRole('button', { name: /Glass Wake/ }))
    .toHaveAttribute('transform', hazardTransform!)
  expect(Math.abs(await orbitalAngle(restoredMap) - angleBeforeResize)).toBeLessThan(0.02)
})

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
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
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

test('the Warden can review and safely confirm dependent map deletions', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(page.getByRole('button', { name: 'Delete Vesper system' })).toBeDisabled()
  await page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    .getByRole('button', { name: 'Open Vesper system map' })
    .click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })

  await typePicker.selectOption('planet')
  await addObject.click()
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria/ }).click()
  await typePicker.selectOption('jump-point')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  await typePicker.selectOption('moon')
  await addObject.click()
  await page.getByLabel('Name').fill('Nix')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  let orbitDeletionPreview = ''
  page.once('dialog', async (dialog) => {
    orbitDeletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Orbit 1 around Vesper Exit' }).click()
  expect(orbitDeletionPreview).toContain('Nix')
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()

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
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-02')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-02/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Jump Routes' })
    .getByRole('button', { name: 'Select Jump-02 route' })
    .click()
  let directRouteDeletionRequested = false
  const routeDeletionDialog = async (dialog: import('@playwright/test').Dialog) => {
    directRouteDeletionRequested = true
    await dialog.accept()
  }
  page.on('dialog', routeDeletionDialog)
  await page.getByRole('button', { name: 'Delete Jump Route Jump-02' }).click()
  await page.off('dialog', routeDeletionDialog)
  expect(directRouteDeletionRequested).toBe(false)
  await expect(clusterMap.getByRole('button', { name: /Jump-02/ })).toHaveCount(0)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  let deletionPreview = ''
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  expect(deletionPreview).toContain('Orbit 1 around Iria')
  expect(deletionPreview).toContain('Vesper Exit')
  expect(deletionPreview).toContain('Orbit 1 around Vesper Exit')
  expect(deletionPreview).toContain('Nix')
  expect(deletionPreview).toContain('Jump-01')
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredClusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const updatedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(updatedClusterMap.getByRole('button', { name: /Jump-01/ })).toHaveCount(0)

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const reloadedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(reloadedClusterMap.getByRole('button', { name: /Jump-01/ })).toHaveCount(0)
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toBeVisible()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete New System 2 system' }).click()
  expect(deletionPreview).toContain('Harrow Entry')
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toHaveCount(0)
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open Vesper system map' })).toBeVisible()

  await reloadedClusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await typePicker.selectOption('station')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Gate')
  await page.getByLabel('Name').press('Tab')
  await typePicker.selectOption('jump-point')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Arrival')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  const physicalStation = page.getByLabel('Physical Jump Station')
  const stationId = await page.getByRole('option', { name: /Vesper Gate/ }).getAttribute('value')
  expect(stationId).toBeTruthy()
  await physicalStation.selectOption(stationId!)
  await hierarchy.getByRole('button', { name: /Vesper Gate/ }).click()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete Vesper Gate' }).click()
  expect(deletionPreview).toContain('Vesper Arrival')
  expect(deletionPreview).toContain('Vesper Gate')
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Gate/ })).toHaveCount(0)
  await hierarchy.getByRole('button', { name: /Select .*Vesper Arrival/ }).click()
  await expect(physicalStation).toHaveValue('')

  await page.reload()
  await hierarchy.getByRole('button', { name: /Select .*Vesper Arrival/ }).click()
  await expect(page.getByLabel('Physical Jump Station')).toHaveValue('')
})

test('the Warden can export a cluster and standalone system as versioned JSON', async ({ page }) => {
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
  const typePicker = page.getByLabel('Catalogue object type')
  const addObject = page.getByRole('button', { name: 'Add object' })
  await typePicker.selectOption('jump-point')
  await addObject.click()
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')

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
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  const secondSystem = clusterMap.getByRole('button', { name: 'Open New System 2 system map' })
  await dragBy(page, secondSystem.locator('.cluster-system-card'), { x: 48, y: 24 })
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 24, y: 18 })
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(clusterExport).toMatchObject({
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    layout: { version: 1 },
  })
  expect(clusterExport.cluster?.systems).toHaveLength(2)
  expect(clusterExport.cluster?.routes).toHaveLength(1)
  expect(Object.keys(clusterExport.layout.systemPositions ?? {}).sort())
    .toEqual(clusterExport.cluster!.systems.map(system => system.id).sort())
  expect(clusterExport.layout).not.toHaveProperty('zoom')
  expect(clusterExport.layout).not.toHaveProperty('pan')
  expect(clusterExport).not.toHaveProperty('selectedRouteId')
  const exportedSecondSystem = clusterExport.cluster!.systems.find(system => system.name === 'New System 2')!
  expect(clusterExport.layout.systemPositions?.[exportedSecondSystem.id].x).not.toBe(0.5)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await page.getByText('Field definitions', { exact: true }).click()
  await page.getByLabel('Custom field label').fill('Campaign notes')
  await page.getByRole('button', { name: 'Add custom field' }).click()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await typePicker.selectOption('planet')
  await addObject.click()
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByLabel('Campaign notes').fill('A local secret.')
  await page.getByLabel('Campaign notes').press('Tab')

  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  await dragToWorldPoint(page, systemMap, systemMap.getByRole('button', { name: /Iria/ }).locator('.object-hit-target'), {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const orbitHandle = systemMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await orbitHandle.press('End')
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const updatedClusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const clusterSystem = updatedClusterExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const planet = clusterSystem.objects.find(object => object.name === 'Iria')!
  const orbit = clusterSystem.orbits[0]
  const field = updatedClusterExport.objectFieldSettings.customFields.find(item => item.name === 'Campaign notes')!
  expect(planet.customFieldValues?.[field.id]).toBe('A local secret.')
  expect(updatedClusterExport.layout.orbitRadii[orbit.id]).toBe(512)
  expect(Number.isFinite(updatedClusterExport.layout.objectAngles[planet.id])).toBe(true)
  expect(updatedClusterExport.layout).not.toHaveProperty('zoom')
  expect(updatedClusterExport.layout).not.toHaveProperty('pan')
  expect(updatedClusterExport).not.toHaveProperty('selectedSystemId')
  expect(updatedClusterExport).not.toHaveProperty('selectedObjectId')

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport).toMatchObject({
    format: 'mothership-campaign-map',
    version: 1,
    type: 'system',
    layout: { version: 1 },
  })
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport).not.toHaveProperty('routes')
  expect(systemExport.system?.name).toBe('Vesper')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Vesper Exit')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Iria')
  expect(systemExport.system?.objects.map(object => object.name)).not.toContain('Harrow Entry')
  expect(systemExport.layout.systemPositions).toBeUndefined()
  expect(systemExport.layout.orbitRadii[orbit.id]).toBe(512)
  expect(systemExport.layout.objectAngles[planet.id]).toBe(updatedClusterExport.layout.objectAngles[planet.id])
  expect(systemExport.layout).not.toHaveProperty('zoom')
  expect(systemExport.layout).not.toHaveProperty('pan')
  expect(systemExport).not.toHaveProperty('selectedObjectId')
  expect(systemExport.objectFieldSettings.customFields).toContainEqual(field)
  expect(systemExport.system?.objects.find(object => object.name === 'Iria')?.customFieldValues?.[field.id])
    .toBe('A local secret.')
})

test('the Warden can validate and import an independent JSON copy', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const importFile = page.getByLabel('JSON map file')
  await setJsonFile(importFile, 'invalid.json', '{')
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const incoming = {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    cluster: {
      id: 'incoming-cluster',
      name: 'Imported Reach',
      systems: [
        {
          id: 'incoming-alpha',
          name: 'Vesper',
          objects: [
            {
              id: 'incoming-star',
              family: 'CelestialBody',
              subtype: 'star',
              locationKey: 'A',
              name: 'Primary Star',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
            {
              id: 'incoming-station',
              family: 'Installation',
              subtype: 'station',
              locationKey: 'ST.1',
              name: 'Relay Station',
              description: '',
              placement: { kind: 'system', x: 0.6, y: 0.5 },
            },
            {
              id: 'incoming-point-alpha',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Alpha Gate',
              description: '',
              placement: { kind: 'system', x: 0.7, y: 0.5 },
              jumpStationId: 'incoming-station',
            },
            {
              id: 'incoming-planet',
              family: 'CelestialBody',
              subtype: 'planet',
              locationKey: 'PL.1',
              name: 'Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { 'incoming-field': 'The key is hidden.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: 'incoming-star', order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [
            {
              id: 'incoming-point-beta',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Beta Gate',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
          ],
          orbits: [],
        },
      ],
      routes: [
        {
          id: 'incoming-route',
          name: 'Known route',
          fromPointId: 'incoming-point-alpha',
          toPointId: 'incoming-point-beta',
        },
        {
          id: 'incoming-exit',
          name: 'Unknown route',
          fromPointId: 'incoming-point-beta',
          toPointId: null,
          unresolvedExit: 'Uncharted exit',
        },
      ],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{ id: 'incoming-field', name: 'Campaign notes', type: 'text' }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 100 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const invalidLayout = {
    ...incoming,
    layout: {
      ...incoming.layout,
      systemPositions: {
        ...incoming.layout.systemPositions,
        'missing-system': { x: 0.5, y: 0.5 },
      },
    },
  }
  await setJsonFile(importFile, 'invalid-layout.json', JSON.stringify(invalidLayout))
  await expect(page.getByRole('alert').last()).toContainText('valid version 1')
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const canceledPreview = await previewPromise
  const previewText = canceledPreview.message()
  expect(previewText).toContain('Star systems: 2')
  expect(previewText).toContain('Map objects: 5')
  expect(previewText).toContain('Orbits: 1')
  expect(previewText).toContain('Jump Routes: 2')
  expect(previewText).toContain('Custom fields: 1')
  expect(previewText).toContain('Possible existing matches by name or location key')
  expect(previewText).toContain('Primary Star')
  expect(previewText).toContain('same name')
  await canceledPreview.dismiss()
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const acceptedPreview = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  await (await acceptedPreview).accept()
  const alphaNode = systemList.getByRole('button', { name: 'Open Vesper system map' }).last()
  const betaNode = systemList.getByRole('button', { name: 'Open Far Vesper system map' })
  await expect(alphaNode).toBeVisible()
  await expect(betaNode).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Jump Routes' }).getByRole('button', { name: /Known route/ })).toBeVisible()
  await betaNode.click()
  await expect(page.getByRole('heading', { name: 'Far Vesper', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const firstImport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedAlpha = firstImport.cluster!.systems.find(system =>
    system.name === 'Vesper' && system.objects.some(object => object.name === 'Iria'),
  )!
  const importedBeta = firstImport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = firstImport.objectFieldSettings.customFields.find(field => field.name === 'Campaign notes')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedBeta.id).not.toBe('incoming-beta')
  expect(importedPlanet.id).not.toBe('incoming-planet')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'The key is hidden.' })
  expect(importedField.id).not.toBe('incoming-field')
  expect(firstImport.cluster!.routes.find(route => route.name === 'Known route')).toMatchObject({
    fromPointId: importedPoint.id,
    toPointId: importedBetaPoint.id,
  })
  expect(firstImport.cluster!.routes.find(route => route.name === 'Unknown route')).toMatchObject({
    fromPointId: importedBetaPoint.id,
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  expect(firstImport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(firstImport.layout.orbitRadii[importedOrbit.id]).toBe(100)
  expect(firstImport.layout.objectAngles[importedPlanet.id]).toBe(1.2)

  const duplicatePreviewPromise = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'duplicate.json', JSON.stringify(firstImport))
  const duplicatePreview = await duplicatePreviewPromise
  expect(duplicatePreview.message()).toContain('Original-ID collisions')
  expect(duplicatePreview.message()).toContain('Primary Star')
  await duplicatePreview.accept()
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(4)
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(2)
})

test('the Warden can import a standalone system without adding cluster routes', async ({ page }) => {
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

  const exportedSystem = await downloadJson(page, 'Export star system JSON')
  const input = page.getByLabel('JSON map file')
  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(input, 'system-copy.json', JSON.stringify(exportedSystem))
  const preview = await previewPromise
  expect(preview.message()).toContain('Star systems: 1')
  expect(preview.message()).toContain('Jump Routes: 0')
  expect(preview.message()).toContain('Primary Star')
  await preview.accept()

  const systems = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systems.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(2)
  const exportedCluster = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exportedCluster.cluster?.systems).toHaveLength(2)
  expect(exportedCluster.cluster?.routes).toHaveLength(0)
  expect(exportedCluster.cluster?.systems[0].id).not.toBe(exportedCluster.cluster?.systems[1].id)
  expect(exportedCluster.cluster?.systems[0].objects[0].id)
    .not.toBe(exportedCluster.cluster?.systems[1].objects[0].id)
})
