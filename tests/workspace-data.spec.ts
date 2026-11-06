import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { captureMapExportBlobs, importReviewDialog, resolveImportReview, selectInspectorOption, waitForWorkspaceSaved } from './helpers'
import { returnToClusterMap, openWorkspaceHierarchy, clickDockAction, jsonMapImportInput, setWorkspaceMapMode } from './helpers'
import { setHeaderMapActionsOpen, downloadJson, editMapObject, saveMapObject, addCustomFieldThroughDialog, setJsonFile, addCatalogueObject } from './helpers'
import { createLocalWorkspace, restoreLocalWorkspace } from '../domain/workspace'

test('older saved Jump Routes and circle/ellipse layouts restore and reject invalid levels @pure', () => {
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

test('restoring a workspace removes legacy object targets without deleting values @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const fieldId = 'legacy-field'
  const restored = restoreLocalWorkspace({
    ...workspace,
    version: undefined,
    cluster: {
      ...workspace.cluster,
      playerTitle: undefined,
      systems: workspace.cluster.systems.map(currentSystem => ({
        ...currentSystem,
        publication: undefined,
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


test('the Warden can validate and import an independent JSON copy', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const initialExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const originalSystemIds = initialExport.cluster!.systems.map(system => system.id)
  const importFile = jsonMapImportInput(page)
  await setHeaderMapActionsOpen(page, true)
  const invalidFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(importFile, 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(initialExport)

  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  await setJsonFile(importFile, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
  const canceledPreview = importReviewDialog(page)
  await expect(canceledPreview).toContainText('Star systems: 2')
  await expect(canceledPreview).toContainText('Jump Routes: 1')
  await resolveImportReview(canceledPreview, 'cancel')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(initialExport)

  await setJsonFile(importFile, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
  const acceptedPreview = importReviewDialog(page)
  await expect(acceptedPreview).toContainText('Star systems: 2')
  await resolveImportReview(acceptedPreview, 'confirm')
  await waitForWorkspaceSaved(page)
  await page.reload()
  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', {
    name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/,
  })).toBeVisible()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(importedExport.cluster!.systems.map(system => system.id).slice(0, originalSystemIds.length))
    .toEqual(originalSystemIds)
  const importedVesper = importedExport.cluster!.systems.find(system =>
    system.name === 'Vesper Prime' && !originalSystemIds.includes(system.id),
  )!
  const importedHarrow = importedExport.cluster!.systems.find(system => system.name === 'Harrow')!
  const importedDeparture = importedVesper.objects.find(object => object.name === 'Vesper Departure')!
  const importedArrival = importedHarrow.objects.find(object => object.name === 'Harrow Arrival')!
  const importedRoute = importedExport.cluster!.routes.find(route =>
    route.fromPointId === importedDeparture.id && route.toPointId === importedArrival.id,
  )
  expect(importedVesper.id).not.toBe(campaignBaselineFixture.cluster.systems[0]?.id)
  expect(importedDeparture.id).not.toBe('campaign-baseline-departure')
  expect(importedArrival.id).not.toBe('campaign-baseline-arrival')
  expect(importedRoute).toMatchObject({
    jumpLevel: 1,
    fromPointId: importedDeparture.id,
    toPointId: importedArrival.id,
  })

  await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map' }).last().click()
  const importedHierarchy = await openWorkspaceHierarchy(page)
  await importedHierarchy.getByRole('treeitem', { name: /Select PL-01, Iria/ }).click()
  await expect(page.getByLabel('Warden notes')).toHaveValue('Existing campaign record.')
})

test('the Warden can import a standalone system without adding cluster routes', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const exportedSystem = await downloadJson(page, 'Export star system JSON')
  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'system-copy.json', JSON.stringify(exportedSystem))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  expect(previewSummary).toContain('Jump Routes: 0')
  expect(previewSummary).toContain('Primary Star')
  await resolveImportReview(preview, 'confirm')

  await returnToClusterMap(page)
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
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

test('public campaign creation persists a custom value and unresolved route through reload', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit chart details' }).click()
  const chartNames = page.getByRole('dialog', { name: 'Edit chart details' })
  await chartNames.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await chartNames.getByLabel('Star system').fill('Vesper Prime')
  await chartNames.getByRole('button', { name: 'Apply details' }).click()
  await addCustomFieldThroughDialog(page, 'Warden notes', 'text')

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Departure')
  await page.getByLabel('Warden notes').fill('A durable campaign note.')
  await saveMapObject(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })
  await clickDockAction(page, 'Add Jump Route')
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await routeInspector.getByRole('spinbutton', { name: 'Jump level' }).fill('12')
  await selectInspectorOption(routeInspector.getByLabel('From Jump Point'), 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(routeInspector.getByLabel('Route destination'), 'Unresolved external exit')
  await routeInspector.getByLabel('Unknown destination label').fill('The Quiet Expanse')
  await routeInspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect(clusterMap.getByRole('button', {
    name: /Select Jump Level 12 route from Vesper Departure \(Vesper Prime\) to unknown destination: The Quiet Expanse/,
  })).toBeVisible()

  await waitForWorkspaceSaved(page)
  const beforeReload = await downloadJson(page, 'Export Jump Cluster JSON')
  const exportedSystem = beforeReload.cluster!.systems.find(system => system.name === 'Vesper Prime')!
  const exportedPoint = exportedSystem.objects.find(object => object.name === 'Vesper Departure')!
  const exportedField = beforeReload.objectFieldSettings.customFields.find(field => field.name === 'Warden notes')!
  expect(exportedPoint.customFieldValues?.[exportedField.id]).toBe('A durable campaign note.')
  expect(beforeReload.cluster!.routes).toEqual([expect.objectContaining({
    jumpLevel: 12,
    fromPointId: exportedPoint.id,
    toPointId: null,
    unresolvedExit: 'The Quiet Expanse',
  })])

  await page.reload()
  await returnToClusterMap(page)
  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterReload).toEqual(beforeReload)
  await expect(page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })
    .getByRole('button', {
      name: /Select Jump Level 12 route from Vesper Departure \(Vesper Prime\) to unknown destination: The Quiet Expanse/,
    }))
    .toBeVisible()
})
