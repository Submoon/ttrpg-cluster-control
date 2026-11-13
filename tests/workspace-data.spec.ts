import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  captureMapExportBlobs,
  abortNextWorkspaceWrite,
  activeWorkspaceFeedback,
  clickDockAction,
  downloadJson,
  editMapObject,
  hideWorkspaceInspector,
  jumpClusterBackupInput,
  openChartDetailsEditor,
  openWorkspaceHierarchy,
  resolveImportReview,
  resolveJumpClusterRestoreReview,
  reviewJumpClusterBackup,
  reviewStarSystemImport,
  returnToClusterMap,
  saveMapObject,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  addCustomFieldThroughDialog,
  addCatalogueObject,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'
import { createLocalWorkspace, restoreLocalWorkspace } from '../domain/workspace'

async function readWorkspaceRecoveryRecords(page: import('@playwright/test').Page): Promise<{ current: unknown; backup: unknown }> {
  return await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control', 1)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
    })
    try {
      const transaction = database.transaction('workspace', 'readonly')
      const complete = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not read recovery records.'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not read recovery records.'))
      })
      const store = transaction.objectStore('workspace')
      const currentRequest = store.get('current')
      const backupRequest = store.get('last-valid')
      const [current, backup] = await Promise.all([
        new Promise<unknown>((resolve, reject) => {
          currentRequest.onsuccess = () => resolve(currentRequest.result)
          currentRequest.onerror = () => reject(currentRequest.error ?? new Error('Could not read current workspace.'))
        }),
        new Promise<unknown>((resolve, reject) => {
          backupRequest.onsuccess = () => resolve(backupRequest.result)
          backupRequest.onerror = () => reject(backupRequest.error ?? new Error('Could not read recovery backup.'))
        }),
        complete,
      ]).then(([currentWorkspace, lastValid]) => [currentWorkspace, lastValid] as const)
      return { current, backup }
    } finally {
      database.close()
    }
  })
}

async function readReviewedDownload(page: import('@playwright/test').Page, review: import('@playwright/test').Locator): Promise<unknown> {
  const download = page.waitForEvent('download')
  await review.getByRole('button', { name: 'Download current Jump Cluster JSON', exact: true }).click()
  await download
  const json = await page.evaluate(async () => {
    const blob = (window as Window & { __mapExportBlobs?: Blob[] }).__mapExportBlobs?.shift()
    if (!blob) throw new Error('The reviewed current workspace download was not captured.')
    return await blob.text()
  })
  return JSON.parse(json) as unknown
}

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


test('the Warden can validate and restore a complete Jump Cluster backup', async ({ page }) => {
  test.setTimeout(90_000)
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const activeEditor = await openChartDetailsEditor(page)
  await activeEditor.getByLabel('Jump Cluster', { exact: true }).fill('Active Reach')
  await activeEditor.getByRole('button', { name: 'Apply details', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await hideWorkspaceInspector(page)

  const initialExport = await downloadJson(page, 'Export Jump Cluster JSON')
  await setHeaderMapActionsOpen(page, true)
  const invalidFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Restore Jump Cluster', exact: true }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(jumpClusterBackupInput(page), 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(initialExport)

  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const canceledPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
  await expect(canceledPreview).toContainText('Active Reach')
  await expect(canceledPreview).toContainText('Kestrel Reach Prime')
  await resolveJumpClusterRestoreReview(canceledPreview, 'cancel')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(initialExport)

  const undo = page.getByRole('group', { name: 'Edit history' }).getByRole('button', { name: /^Undo(?:$|:)/ })
  await expect(undo).toHaveAttribute('aria-description', /1 action available to undo/)

  const draftEditor = await openChartDetailsEditor(page)
  await draftEditor.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await hideWorkspaceInspector(page)
  const recordsBeforeReplacement = await readWorkspaceRecoveryRecords(page)
  const oldWorkspaceId = (recordsBeforeReplacement.current as { id: string }).id

  const staleTab = await page.context().newPage()
  try {
    await staleTab.goto('/')
    await waitForWorkspaceStartup(staleTab)
    await returnToClusterMap(staleTab)

    const draftReview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
    await expect(draftReview).toContainText('Unapplied editor drafts are open.')
    await expect(draftReview.getByRole('checkbox', {
      name: /discard current drafts if the replacement succeeds/i,
      exact: true,
    })).not.toBeChecked()
    expect(await readReviewedDownload(page, draftReview)).toEqual(initialExport)
    await resolveJumpClusterRestoreReview(draftReview, 'cancel')
    const resumedDraftEditor = await openChartDetailsEditor(page)
    await expect(resumedDraftEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
    await hideWorkspaceInspector(page)

    const acceptedPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
    await expect(acceptedPreview.getByRole('checkbox', {
      name: /discard current drafts if the replacement succeeds/i,
      exact: true,
    })).not.toBeChecked()

    await abortNextWorkspaceWrite(page, async () => {
      await resolveJumpClusterRestoreReview(acceptedPreview, 'confirm', true)
      await expect(acceptedPreview.getByRole('alert')).toContainText(/abort|transaction/i)
    })
    await expect(acceptedPreview).toBeVisible()
    expect(await readWorkspaceRecoveryRecords(page)).toEqual(recordsBeforeReplacement)
    expect(await readReviewedDownload(page, acceptedPreview)).toEqual(initialExport)

    await resolveJumpClusterRestoreReview(acceptedPreview, 'cancel')
    const draftAfterFailedReplacement = await openChartDetailsEditor(page)
    await expect(draftAfterFailedReplacement.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
    await hideWorkspaceInspector(page)

    const retryPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
    await resolveJumpClusterRestoreReview(retryPreview, 'confirm', true)
    await expect(retryPreview).toBeHidden()
    await waitForWorkspaceSaved(page)
    const restoredWorkspaceId = await page.evaluate(async () => {
      const request = indexedDB.open('ttrpg-cluster-control', 1)
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Could not open the workspace database.'))
      })
      try {
        return await new Promise<string>((resolve, reject) => {
          const transaction = database.transaction('workspace', 'readonly')
          const read = transaction.objectStore('workspace').get('current')
          read.onsuccess = () => resolve((read.result as { id: string }).id)
          read.onerror = () => reject(read.error ?? new Error('Could not read the restored workspace.'))
        })
      } finally {
        database.close()
      }
    })
    expect(restoredWorkspaceId).not.toBe(oldWorkspaceId)
    await expect(undo).toBeDisabled()
    await expect(undo).toHaveAttribute('aria-description', /0 actions available to undo/)
    await expect(page.getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true })).toHaveCount(0)

    const staleEditor = await openChartDetailsEditor(staleTab)
    await staleEditor.getByLabel('Jump Cluster', { exact: true }).fill('Stale Overwrite')
    await staleEditor.getByRole('button', { name: 'Apply details', exact: true }).click()
    await expect(activeWorkspaceFeedback(staleTab).locator('.save-feedback')).toContainText('Not saved.', { timeout: 10_000 })
    const recordsAfterStaleSave = await readWorkspaceRecoveryRecords(page)
    expect((recordsAfterStaleSave.current as { cluster: { name: string } }).cluster.name).toBe('Kestrel Reach Prime')
    expect((recordsAfterStaleSave.backup as { cluster: { name: string } }).cluster.name).toBe('Active Reach')
  } finally {
    await staleTab.close()
  }

  await page.reload()
  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', {
    name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/,
  })).toBeVisible()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(importedExport.cluster?.id).toBe(campaignBaselineFixture.cluster.id)
  expect(importedExport.cluster!.systems.map(system => system.name)).toEqual(['Vesper Prime', 'Harrow'])
  const importedVesper = importedExport.cluster!.systems.find(system => system.name === 'Vesper Prime')!
  const importedHarrow = importedExport.cluster!.systems.find(system => system.name === 'Harrow')!
  const importedDeparture = importedVesper.objects.find(object => object.name === 'Vesper Departure')!
  const importedArrival = importedHarrow.objects.find(object => object.name === 'Harrow Arrival')!
  const importedRoute = importedExport.cluster!.routes.find(route =>
    route.fromPointId === importedDeparture.id && route.toPointId === importedArrival.id,
  )
  expect(importedVesper.id).toBe(campaignBaselineFixture.cluster.systems[0]?.id)
  expect(importedDeparture.id).toBe('campaign-baseline-departure')
  expect(importedArrival.id).toBe('campaign-baseline-arrival')
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

test('the Warden can explicitly add a standalone system without adding cluster routes', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const exportedSystem = await downloadJson(page, 'Export star system JSON')
  const preview = await reviewStarSystemImport(page, 'system-copy.json', JSON.stringify(exportedSystem))
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

  const chartNames = await openChartDetailsEditor(page)
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
