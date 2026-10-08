import { expect, test } from '@playwright/test'
import { dragToWorldPoint, panMap, dragBy, setHeaderMapActionsOpen, downloadJson, openFieldDefinitionDialog, editFieldDefinition, editMapObject, saveMapObject, addCustomFieldThroughDialog, downloadImage, inspectImageSvg, setJsonFile, addCatalogueObject } from './helpers'
import type { DownloadWindow } from './helpers'
import { createLocalWorkspace, restoreLocalWorkspace } from '../domain/workspace'

function relativeLuminance(color: string): number {
  const channels = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!channels) throw new Error(`Expected an opaque RGB color, received "${color}".`)
  const [, red, green, blue] = channels
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Expected an opaque RGB color, received "${color}".`)
  }
  const linearize = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(Number(red) / 255)
    + 0.7152 * linearize(Number(green) / 255)
    + 0.0722 * linearize(Number(blue) / 255)
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function expectReadableExport(info: {
  backgroundFill: string | null
  textFills: string[]
  markColors: string[]
}): void {
  if (!info.backgroundFill) throw new Error('The downloaded map has no background fill.')
  expect(info.textFills.length).toBeGreaterThan(0)
  expect(info.markColors.length).toBeGreaterThan(0)
  for (const fill of info.textFills) {
    expect(contrastRatio(fill, info.backgroundFill)).toBeGreaterThanOrEqual(4.5)
  }
  for (const color of info.markColors) {
    expect(contrastRatio(color, info.backgroundFill)).toBeGreaterThanOrEqual(3)
  }
}

async function inspectExportedSvg(
  page: import('@playwright/test').Page,
  text: string,
): Promise<{ viewBox: number[]; width: number; height: number; text: string }> {
  return page.evaluate((content) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox')
    if (svg.localName !== 'svg' || !viewBox) throw new Error('The downloaded SVG is invalid.')
    return {
      viewBox: viewBox.split(/\s+/).map(Number),
      width: Number(svg.getAttribute('width')),
      height: Number(svg.getAttribute('height')),
      text: svg.textContent ?? '',
    }
  }, text)
}

test('deleting a map object without dependents still asks for confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  let confirmation = ''
  page.once('dialog', async dialog => {
    confirmation = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Primary Star' }).click()

  expect(confirmation).toMatch(/^Delete Primary Star/)
  await expect(primaryStar).toBeVisible()
})

test('older saved Jump Routes and circle/ellipse layouts restore and reject invalid levels', () => {
  const savedWorkspace = {
    id: 'workspace',
    cluster: {
      id: 'cluster',
      name: 'Kestrel Reach',
      systems: [{
        id: 'vesper',
        name: 'Vesper',
        objects: [
          {
            id: 'origin',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Vesper Exit',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          },
          {
            id: 'destination',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.2',
            name: 'Harrow Entry',
            description: '',
            placement: { kind: 'system', x: 0.7, y: 0.5 },
          },
        ],
        orbits: [],
      }],
      routes: [{
        id: 'route',
        name: 'Jump-01',
        fromPointId: 'origin',
        toPointId: 'destination',
      }],
    },
    layout: { systemPositions: { vesper: { x: 0.5, y: 0.5 } } },
  }
  const restored = restoreLocalWorkspace(savedWorkspace)

  expect(restored?.cluster.routes).toMatchObject([{
    id: 'route',
    jumpLevel: 1,
    fromPointId: 'origin',
    toPointId: 'destination',
  }])
  expect(restored?.layout.orbitRotations).toEqual({})

  const legacyOrbitWorkspace = {
    ...savedWorkspace,
    cluster: {
      ...savedWorkspace.cluster,
      systems: savedWorkspace.cluster.systems.map(system => ({
        ...system,
        orbits: [
          { id: 'legacy-circle', hostId: 'origin', order: 1 },
          { id: 'legacy-ellipse', hostId: 'origin', order: 2 },
        ],
      })),
    },
    layout: {
      ...savedWorkspace.layout,
      orbitRadii: { 'legacy-circle': 100 },
      orbitEllipseRadii: { 'legacy-ellipse': { horizontal: 200, vertical: 80 } },
    },
  }
  const migrated = restoreLocalWorkspace(legacyOrbitWorkspace)
  expect(migrated?.layout.orbitRadii).toEqual({
    'legacy-circle': { horizontal: 100, vertical: 100 },
    'legacy-ellipse': { horizontal: 200, vertical: 80 },
  })
  expect(migrated?.layout).not.toHaveProperty('orbitEllipseRadii')

  for (const jumpLevel of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(restoreLocalWorkspace({
      ...savedWorkspace,
      cluster: {
        ...savedWorkspace.cluster,
        routes: savedWorkspace.cluster.routes.map(route => ({ ...route, jumpLevel })),
      },
    })).toBeNull()
  }
})

test('restoring a workspace removes legacy object targets without deleting values', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const fieldId = 'legacy-field'
  const restored = restoreLocalWorkspace({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(currentSystem => ({
        ...currentSystem,
        objects: currentSystem.objects.map(currentObject => currentObject.id === object.id
          ? { ...currentObject, customFieldValues: { [fieldId]: 'Still here.' } }
          : currentObject),
      })),
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [{
        id: fieldId,
        name: 'Campaign notes',
        type: 'text',
        applicability: [
          { kind: 'object', objectId: object.id },
          { kind: 'category', family: object.family },
          { kind: 'subtype', family: object.family, subtype: object.subtype },
        ],
      }],
    },
  })

  expect(restored?.objectFieldSettings.customFields[0]?.applicability).toEqual([
    { kind: 'category', family: object.family },
    { kind: 'subtype', family: object.family, subtype: object.subtype },
  ])
  expect(restored?.cluster.systems[0]?.objects[0]?.customFieldValues?.[fieldId]).toBe('Still here.')
})

test('custom field category and subtype scopes are united on independent system import', async ({ page }) => {
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
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('Planet survey.')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Aster')
  await page.getByLabel('Campaign notes').fill('Remote survey.')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()

  const definitionDialog = await openFieldDefinitionDialog(page)
  await definitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(definitionDialog)
  await definitionDialog.getByRole('radio', { name: 'Selected catalogue targets' }).check()
  await definitionDialog.getByLabel('Subtype Planet').check()
  await definitionDialog.getByRole('button', { name: 'Save changes' }).click()
  await definitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const sourceExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const sourceSystem = sourceExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const sourcePlanet = sourceSystem.objects.find(object => object.name === 'Iria')!
  const remoteSystem = sourceExport.cluster!.systems.find(system => system.name === 'New System 2')!
  const remotePlanet = remoteSystem.objects.find(object => object.name === 'Aster')!
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  const systemExport = await downloadJson(page, 'Export star system JSON')
  const exportedField = systemExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(exportedField.applicability).toEqual([{
    kind: 'subtype',
    family: 'CelestialBody',
    subtype: 'planet',
  }])

  const existingDefinitionDialog = await openFieldDefinitionDialog(page)
  await existingDefinitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(existingDefinitionDialog)
  await existingDefinitionDialog.getByLabel('Subtype Planet').uncheck()
  await existingDefinitionDialog.getByLabel('Category Celestial bodies').check()
  await existingDefinitionDialog.getByRole('button', { name: 'Save changes' }).click()
  await existingDefinitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const legacySystemExport: unknown = {
    ...systemExport,
    objectFieldSettings: {
      ...systemExport.objectFieldSettings,
      customFields: systemExport.objectFieldSettings.customFields.map(field =>
        field.id === exportedField.id
          ? {
              ...field,
              applicability: [
                ...(field.applicability ?? []),
                { kind: 'object', objectId: sourcePlanet.id },
                { kind: 'object', objectId: remotePlanet.id },
              ],
            }
          : field,
      ),
    },
  }

  const input = page.getByLabel('JSON map file')
  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(input, 'scoped-system.json', JSON.stringify(legacySystemExport))
  const preview = await previewPromise
  expect(preview.message()).toContain('Compatible custom field definitions are reused')
  await preview.accept()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = importedExport.cluster!.systems.find(system =>
    system.id !== sourceSystem.id && system.name === sourceSystem.name,
  )!
  const importedPlanet = importedSystem.objects.find(object => object.name === 'Iria')!
  expect(importedPlanet.id).not.toBe(sourcePlanet.id)
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(importedField.applicability).toEqual([
    { kind: 'category', family: 'CelestialBody' },
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(importedPlanet.customFieldValues?.[importedField.id]).toBe('Planet survey.')

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).last().click()
  const importedHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await importedHierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
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

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria/ }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
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
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('1')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Harrow Entry/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('2')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2.*Harrow Entry/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Jump Routes' })
    .getByRole('button', { name: /Select Jump Level 2/ })
    .click()
  let directRouteDeletionRequested = false
  let directRouteDeletionPreview = ''
  const routeDeletionDialog = async (dialog: import('@playwright/test').Dialog) => {
    directRouteDeletionRequested = true
    directRouteDeletionPreview = dialog.message()
    await dialog.accept()
  }
  page.on('dialog', routeDeletionDialog)
  await page.getByRole('button', { name: 'Delete Jump Route (Level 2)' }).click()
  await page.off('dialog', routeDeletionDialog)
  expect(directRouteDeletionRequested).toBe(true)
  expect(directRouteDeletionPreview).toContain('Level 2')
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2/ })).toHaveCount(0)

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
  expect(deletionPreview).toContain('Level 1')
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredClusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

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
  await expect(updatedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const reloadedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(reloadedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)
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
  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Gate')
  await saveMapObject(page)
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Arrival')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  await editMapObject(page)
  const physicalStation = page.getByLabel('Physical Jump Station')
  const stationId = await page.getByRole('option', { name: /Vesper Gate/ }).getAttribute('value')
  expect(stationId).toBeTruthy()
  await physicalStation.selectOption(stationId!)
  await saveMapObject(page)
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
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('8')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const createdRoute = clusterMap.getByRole('button', { name: /Jump Level 8.*Harrow Entry/ })
  await expect(createdRoute).toBeVisible()
  await expect(createdRoute).toHaveClass(/is-selected/)
  await expect(createdRoute.locator('.cluster-route-label')).toHaveText('Jump-8')
  const clusterMapText = await clusterMap.locator('text').allTextContents()
  expect(clusterMapText).not.toContain('Kestrel Reach')
  expect(clusterMapText).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterMapText).not.toContain('2 SYSTEMS / 1 ROUTES')

  const secondSystem = clusterMap.getByRole('button', { name: 'Open New System 2 system map' })
  await dragBy(page, secondSystem.locator('.cluster-system-card'), { x: 48, y: 24 })
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 24, y: 18 })
  const clusterViewportTransform = await clusterMap.locator('.cluster-map-content').getAttribute('transform')
  expect(clusterViewportTransform).not.toBe('translate(0,0) scale(1)')
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expect(clusterSvg.text).toContain('Kestrel Reach')
  const clusterSvgInfo = await inspectImageSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.contentTransform).toBeNull()
  expect(clusterSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(clusterSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  expect(clusterSvgInfo.texts).toEqual(expect.arrayContaining(['Vesper', 'New System 2', 'Jump-8']))
  expect(clusterSvgInfo.texts).not.toContain('Kestrel Reach')
  expect(clusterSvgInfo.texts).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterSvgInfo.texts).not.toContain('2 SYSTEMS / 1 ROUTES')
  expect(clusterSvgInfo.systemTitle).toBeNull()
  expect(clusterSvgInfo.titleStyle).toBeNull()
  expectReadableExport(clusterSvgInfo)
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.size).toBeGreaterThan(100)
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(clusterExport).toMatchObject({
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    layout: { version: 1 },
  })
  expect(clusterExport.cluster?.systems).toHaveLength(2)
  expect(clusterExport.cluster?.routes).toHaveLength(1)
  expect(clusterExport.cluster?.routes[0]?.jumpLevel).toBe(8)
  expect(Object.keys(clusterExport.layout.systemPositions ?? {}).sort())
    .toEqual(clusterExport.cluster!.systems.map(system => system.id).sort())
  expect(clusterExport.layout).not.toHaveProperty('zoom')
  expect(clusterExport.layout).not.toHaveProperty('pan')
  expect(clusterExport).not.toHaveProperty('selectedRouteId')
  const exportedSecondSystem = clusterExport.cluster!.systems.find(system => system.name === 'New System 2')!
  const secondSystemPosition = clusterExport.layout.systemPositions?.[exportedSecondSystem.id]
  if (!secondSystemPosition) throw new Error('The exported second system is missing its position.')
  expect(secondSystemPosition.x).not.toBe(0.5)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('A local secret.')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()

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
  if (!orbit) throw new Error('The exported star system does not contain an Orbit.')
  const field = updatedClusterExport.objectFieldSettings.customFields.find(item => item.name === 'Campaign notes')!
  expect(planet.customFieldValues?.[field.id]).toBe('A local secret.')
  expect(updatedClusterExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(updatedClusterExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(Number.isFinite(updatedClusterExport.layout.objectAngles[planet.id])).toBe(true)
  expect(updatedClusterExport.layout).not.toHaveProperty('zoom')
  expect(updatedClusterExport.layout).not.toHaveProperty('pan')
  expect(updatedClusterExport).not.toHaveProperty('selectedSystemId')
  expect(updatedClusterExport).not.toHaveProperty('selectedObjectId')

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })
  const systemViewportTransform = await systemMap.locator('.system-map-content').getAttribute('transform')
  expect(systemViewportTransform).not.toBe('translate(0,0) scale(1)')
  const systemSceneTop = await systemMap.locator('.system-map-content')
    .evaluate(element => (element as SVGGraphicsElement).getBBox().y)
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  expect(systemSvg.text).toContain('Iria')
  const systemSvgInfo = await inspectImageSvg(page, systemSvg.text!)
  expect(systemSvgInfo.contentTransform).toBeNull()
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThan(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThan(560)
  expect(systemSvgInfo.texts).toContain('Iria')
  const systemTitle = systemSvgInfo.systemTitle
  if (!systemTitle) throw new Error('The exported star system SVG is missing its title.')
  expect(systemTitle.text).toBe('Vesper')
  expect(systemTitle.x).toBeGreaterThan(systemSvgInfo.viewBox[0])
  expect(systemTitle.x + systemTitle.width)
    .toBeLessThanOrEqual(systemSvgInfo.viewBox[0] + systemSvgInfo.viewBox[2] - 24)
  expect(systemTitle.y - systemTitle.fontSize / 2).toBeGreaterThan(systemSvgInfo.viewBox[1])
  expect(systemTitle.y + systemTitle.fontSize / 2).toBeLessThan(systemSceneTop)
  expect(systemSvgInfo.titleStyle).toBeNull()
  expect(systemSvgInfo.glyphFill).toBeTruthy()
  expectReadableExport(systemSvgInfo)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.size).toBeGreaterThan(100)
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  if (!systemPng.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  const systemPngInfo = await inspectImageSvg(page, systemPng.sourceSvgText)
  expect(systemPngInfo.systemTitle?.text).toBe('Vesper')
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
  expect(systemExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(systemExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(systemExport.layout.objectAngles[planet.id]).toBe(updatedClusterExport.layout.objectAngles[planet.id])
  expect(systemExport.layout).not.toHaveProperty('zoom')
  expect(systemExport.layout).not.toHaveProperty('pan')
  expect(systemExport).not.toHaveProperty('selectedObjectId')
  expect(systemExport.objectFieldSettings.customFields).toContainEqual(field)
  expect(systemExport.system?.objects.find(object => object.name === 'Iria')?.customFieldValues?.[field.id])
    .toBe('A local secret.')

  const renamedSystemName = 'W'.repeat(80)
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Star system').fill(renamedSystemName)
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await expect(page.getByRole('group', { name: `${renamedSystemName} star system map` })).toBeVisible()
  const renamedSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const renamedSvgInfo = await inspectImageSvg(page, renamedSvg.text!)
  const renamedTitle = renamedSvgInfo.systemTitle
  if (!renamedTitle) throw new Error('The renamed star system SVG is missing its title.')
  expect(renamedTitle.text).toBe(renamedSystemName)
  expect(renamedSvgInfo.width).toBeGreaterThan(systemSvgInfo.width)
  expect(renamedTitle.x + renamedTitle.width)
    .toBeLessThanOrEqual(renamedSvgInfo.viewBox[0] + renamedSvgInfo.viewBox[2] - 24)
  expectReadableExport(renamedSvgInfo)
  const renamedPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  if (!renamedPng.sourceSvgText) throw new Error('The renamed star system PNG has no source SVG.')
  const renamedPngInfo = await inspectImageSvg(page, renamedPng.sourceSvgText)
  expect(renamedPngInfo.systemTitle?.text).toBe(renamedSystemName)
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
  await setHeaderMapActionsOpen(page, true)
  const invalidFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(importFile, 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
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
          jumpLevel: 12,
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
  const importedRoutes = page.getByRole('navigation', { name: 'Jump Routes' })
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 1.*Alpha Gate.*Beta Gate.*Far Vesper/,
  })).toBeVisible()
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 12.*Beta Gate.*Unknown destination.*Uncharted exit/,
  })).toBeVisible()
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
  if (!importedOrbit) throw new Error('The imported star system does not contain an Orbit.')
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
  expect(importedField.applicability).toBeUndefined()
  expect(firstImport.cluster!.routes.find(route => route.name === 'Known route')).toMatchObject({
    jumpLevel: 1,
    fromPointId: importedPoint.id,
    toPointId: importedBetaPoint.id,
  })
  expect(firstImport.cluster!.routes.find(route => route.name === 'Unknown route')).toMatchObject({
    jumpLevel: 12,
    fromPointId: importedBetaPoint.id,
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  expect(firstImport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(firstImport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 100, vertical: 100 })
  expect(firstImport.layout.objectAngles[importedPlanet.id]).toBe(1.2)

  await alphaNode.click()
  const importedHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await importedHierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await importedHierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('The key is hidden.')
  await page.getByRole('button', { name: 'Cluster map' }).click()

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
  const exportedSystems = exportedCluster.cluster?.systems
  if (!exportedSystems || exportedSystems.length !== 2) {
    throw new Error('The exported Cluster does not contain both star systems.')
  }
  const [firstSystem, secondSystem] = exportedSystems
  const firstObject = firstSystem?.objects[0]
  const secondObject = secondSystem?.objects[0]
  if (!firstSystem || !secondSystem || !firstObject || !secondObject) {
    throw new Error('The exported star systems do not contain their expected objects.')
  }
  expect(firstSystem.id).not.toBe(secondSystem.id)
  expect(firstObject.id).not.toBe(secondObject.id)
})

test('the Warden can complete the local campaign workflow end to end', async ({ page }) => {
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

  const clusterName = 'Kestrel Reach Prime'
  const systemName = 'Vesper Prime'
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Jump Cluster').fill(clusterName)
  await inspector.getByLabel('Star system').fill(systemName)
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await addCustomFieldThroughDialog(page, 'Warden notes', 'text')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Warden notes').fill('Existing campaign record.')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Departure')
  await saveMapObject(page)

  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map` })
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Star system').fill('Harrow')
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Arrival')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Departure (Vesper Prime)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Arrival (Harrow)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ }))
    .toBeVisible()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: systemName, level: 1 })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Warden notes')).toHaveValue('Existing campaign record.')
  const systemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const mapPlanet = systemMap.getByRole('button', { name: /Select PL-01, Iria/ })
  await mapPlanet.focus()
  await mapPlanet.press('Enter')
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  const systemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(systemNavigation.getByLabel('Zoom level')).toHaveText('120%')
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const harrowNode = clusterMap.getByRole('button', { name: 'Open Harrow system map' })
  await harrowNode.focus()
  await harrowNode.press('Enter')
  await expect(page.getByRole('heading', { name: 'Harrow', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(clusterNavigation.getByLabel('Zoom level')).toHaveText('120%')
  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()

  const baseline = await downloadJson(page, 'Export Jump Cluster JSON')
  const originalSystem = baseline.cluster!.systems.find(system => system.name === systemName)!
  const originalStar = originalSystem.objects.find(object => object.name === 'Primary Star')!
  const originalPlanet = originalSystem.objects.find(object => object.name === 'Iria')!
  const originalRoute = baseline.cluster!.routes.find(route => route.jumpLevel === 1)!
  const existingField = baseline.objectFieldSettings.customFields.find(field => field.name === 'Warden notes')!
  const originalSystemIds = baseline.cluster!.systems.map(system => system.id)
  expect(originalPlanet.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

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
          name: systemName,
          objects: [
            {
              id: originalStar.id,
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
              name: 'Imported Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { [existingField.id]: 'Imported campaign record.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: originalStar.id, order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [{
            id: 'incoming-point-beta',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Beta Gate',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          }],
          orbits: [],
        },
      ],
      routes: [{
        id: 'incoming-route',
        name: 'Imported route',
        fromPointId: 'incoming-point-alpha',
        toPointId: 'incoming-point-beta',
      }],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{
        id: existingField.id,
        name: 'Imported observations',
        type: 'text',
      }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 120 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const importFile = page.getByLabel('JSON map file')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  const canceledImport = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const preview = await canceledImport
  expect(preview.message()).toContain('Star systems: 2')
  expect(preview.message()).toContain('Map objects: 5')
  expect(preview.message()).toContain('Original-ID collisions (2)')
  expect(preview.message()).toContain('Primary Star')
  expect(preview.message()).toContain('Possible existing matches by name or location key')
  await preview.dismiss()
  await expect(systemList.getByRole('button', { name: /Open .* system map/ }))
    .toHaveCount(originalSystemIds.length)
  const unchanged = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(unchanged.cluster!.systems.map(system => system.id)).toEqual(originalSystemIds)
  expect(unchanged.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])

  const acceptedImport = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  await (await acceptedImport).accept()
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(1)
  await page.reload()
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ }))
    .toBeVisible()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(importedExport.cluster!.systems).toHaveLength(4)
  const importedAlpha = importedExport.cluster!.systems.find(system =>
    system.name === systemName && system.id !== originalSystem.id,
  )!
  const importedBeta = importedExport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedStar = importedAlpha.objects.find(object => object.name === 'Primary Star')!
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Imported Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  if (!importedOrbit) throw new Error('The imported star system does not contain an Orbit.')
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Imported observations')!
  const importedRoute = importedExport.cluster!.routes.find(route => route.name === 'Imported route')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedStar.id).not.toBe(originalStar.id)
  expect(importedStation.id).not.toBe('incoming-station')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.placement).toEqual({ kind: 'orbit', orbitId: importedOrbit.id })
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'Imported campaign record.' })
  expect(importedField.id).not.toBe(existingField.id)
  expect(importedRoute.fromPointId).toBe(importedPoint.id)
  expect(importedRoute.toPointId).toBe(importedBetaPoint.id)
  expect(importedRoute.jumpLevel).toBe(1)
  expect(importedExport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(importedExport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 120, vertical: 120 })
  expect(importedExport.layout.objectAngles[importedPlanet.id]).toBe(1.2)
  const preservedSystem = importedExport.cluster!.systems.find(system => system.id === originalSystem.id)!
  expect(preservedSystem.objects.find(object => object.id === originalPlanet.id)?.customFieldValues?.[existingField.id])
    .toBe('Existing campaign record.')
  expect(importedExport.cluster!.routes.some(route => route.id === originalRoute.id)).toBe(true)

  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 1000, y: 300 })
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  const clusterSvgInfo = await inspectExportedSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.text).toContain(systemName)
  expect(clusterSvgInfo.text).toContain('Harrow')
  expect(clusterSvgInfo.text).toContain('Far Vesper')
  expect(clusterSvgInfo.text).toContain('Jump-1')
  expect(clusterSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(clusterSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)

  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  await clusterMap.getByRole('button', { name: `Open ${systemName} system map` }).first().click()
  const activeSystemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const activeSystemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  await activeSystemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, activeSystemMap, { x: 1000, y: 300 })
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const systemSvgInfo = await inspectExportedSvg(page, systemSvg.text!)
  expect(systemSvgInfo.text).toContain('Iria')
  expect(systemSvgInfo.text).toContain('Nix')
  expect(systemSvgInfo.text).toContain('Vesper Departure')
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport.type).toBe('system')
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport.system?.objects.map(object => object.name))
    .toEqual(expect.arrayContaining(['Iria', 'Nix', 'Vesper Departure']))
  expect(systemExport.system?.objects.find(object => object.id === originalPlanet.id)
    ?.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const deleteImportedSystem = page.getByRole('button', { name: 'Delete Far Vesper system' })
  let deletionPreview = ''
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await deleteImportedSystem.click()
  expect(deletionPreview).toContain('Beta Gate')
  expect(deletionPreview).toContain('Level 1')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toBeVisible()
  const importedRouteMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ })
  await expect(importedRouteMark).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await deleteImportedSystem.click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(importedRouteMark).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()
  const finalExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(finalExport.cluster!.systems).toHaveLength(3)
  expect(finalExport.cluster!.systems.some(system => system.id === originalSystem.id)).toBe(true)
  expect(finalExport.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])
})
