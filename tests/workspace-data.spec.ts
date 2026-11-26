import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  captureMapExportBlobs,
  abortNextWorkspaceWrite,
  activeWorkspaceFeedback,
  downloadJson,
  fitWorkspaceMap,
  hideWorkspaceInspector,
  jumpClusterBackupInput,
  openChartDetailsEditor,
  openMapFilesSection,
  openWorkspaceHierarchy,
  resolveJumpClusterRestoreReview,
  reviewJumpClusterBackup,
  setHeaderMapActionsOpen,
  setJsonFile,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenMap,
} from './helpers'
import { addStarSystem, createLocalWorkspace, createSystemObject, restoreLocalWorkspace } from '../domain/workspace'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

async function readWorkspaceRecoveryRecords(page: import('@playwright/test').Page): Promise<{ current: unknown; backup: unknown }> {
  return await page.evaluate(async () => {
    const request = indexedDB.open('ttrpg-cluster-control')
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
        ],
        orbits: [],
      }, {
        id: 'harrow',
        name: 'Harrow',
        objects: [{
          id: 'destination',
          family: 'JumpPoint',
          subtype: 'jump-point',
          locationKey: 'JP.2',
          name: 'Harrow Entry',
          description: '',
          placement: { kind: 'system', x: 0.7, y: 0.5 },
        }],
        orbits: [],
      }],
      routes: [{
        id: 'route',
        name: 'Jump-01',
        fromPointId: 'origin',
        toPointId: 'destination',
      }],
    },
    layout: { systemPositions: { vesper: { x: 0.25, y: 0.5 }, harrow: { x: 0.75, y: 0.5 } } },
  }
  const restored = restoreLocalWorkspace(savedWorkspace)

  expect(restored?.cluster.routes).toMatchObject([{
    id: 'route',
    jumpLevel: 1,
    fromSystemId: 'vesper',
    fromPointId: 'origin',
    toSystemId: 'harrow',
    toPointId: 'destination',
  }])
  expect(restored?.layout.orbitRotations).toEqual({})

  const legacyOrbitWorkspace = {
    ...savedWorkspace,
    cluster: {
      ...savedWorkspace.cluster,
      systems: savedWorkspace.cluster.systems.map(system => ({
        ...system,
        orbits: system.id === 'vesper'
          ? [
              { id: 'legacy-circle', hostId: 'origin', order: 1 },
              { id: 'legacy-ellipse', hostId: 'origin', order: 2 },
            ]
          : [],
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

test('version 4 route restoration infers systems and preserves route identity and exit placement @pure', () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const appended = addStarSystem(initial, 'Harrow')
  const [originSystem, destinationSystem] = appended.workspace.cluster.systems
  if (!originSystem || !destinationSystem) throw new Error('The route fixture needs two systems.')
  const originPoint = createSystemObject(originSystem, 'jump-point')
  const destinationPoint = createSystemObject(destinationSystem, 'jump-point')
  const current = {
    ...appended.workspace,
    cluster: {
      ...appended.workspace.cluster,
      systems: [
        { ...originSystem, objects: [...originSystem.objects, originPoint] },
        { ...destinationSystem, objects: [...destinationSystem.objects, destinationPoint] },
      ],
      routes: [],
    },
  }
  const externalPosition = { x: 920, y: -310 }
  const legacy = {
    ...current,
    version: 4,
    cluster: {
      ...current.cluster,
      routes: [
        {
          id: 'saved-route-id',
          name: 'Known Link',
          jumpLevel: 6,
          fromPointId: originPoint.id,
          toPointId: destinationPoint.id,
          playerShared: true,
        },
        {
          id: 'saved-exit-id',
          jumpLevel: 2,
          fromPointId: destinationPoint.id,
          toPointId: null,
          unresolvedExit: 'The Quiet Expanse',
          playerShared: false,
        },
      ],
    },
    layout: {
      ...current.layout,
      unresolvedExitPositions: { 'saved-exit-id': externalPosition },
    },
  }

  const restored = restoreLocalWorkspace(legacy)

  expect(restored).toMatchObject({
    version: 6,
    cluster: {
      routes: [
        {
          id: 'saved-route-id',
          name: 'Known Link',
          jumpLevel: 6,
          fromSystemId: originSystem.id,
          fromPointId: originPoint.id,
          toSystemId: destinationSystem.id,
          toPointId: destinationPoint.id,
          playerShared: true,
        },
        {
          id: 'saved-exit-id',
          fromSystemId: destinationSystem.id,
          fromPointId: destinationPoint.id,
          toSystemId: null,
          toPointId: null,
          unresolvedExit: 'The Quiet Expanse',
        },
      ],
    },
    layout: { unresolvedExitPositions: { 'saved-exit-id': externalPosition } },
  })
})

test('legacy same-system routes lose only their route metadata and corrupt loops remain invalid @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const firstPoint = createSystemObject(system, 'jump-point')
  const secondPoint = createSystemObject({ ...system, objects: [...system.objects, firstPoint] }, 'jump-point')
  const legacy = {
    ...workspace,
    version: 4,
    cluster: {
      ...workspace.cluster,
      systems: [{ ...system, objects: [...system.objects, firstPoint, secondPoint] }],
      routes: [{
        id: 'legacy-loop-id',
        jumpLevel: 3,
        fromPointId: firstPoint.id,
        toPointId: secondPoint.id,
        playerShared: true,
      }],
    },
    layout: {
      ...workspace.layout,
      unresolvedExitPositions: { 'legacy-loop-id': { x: 1000, y: 300 } },
    },
  }

  const restored = restoreLocalWorkspace(legacy)
  const missingEndpoint = structuredClone(legacy)
  ;(missingEndpoint.cluster.routes[0] as { fromPointId: string }).fromPointId = 'missing-jump-point'
  const entityIdCollision = structuredClone(legacy)
  ;(entityIdCollision.cluster.routes[0] as { id: string }).id = firstPoint.id
  const fieldIdCollision = structuredClone(legacy)
  const settings = fieldIdCollision.objectFieldSettings as { customFields: Array<Record<string, unknown>> }
  settings.customFields.push({ id: 'legacy-loop-id', name: 'Campaign Field', type: 'text', playerShared: false })

  expect(restored?.cluster.routes).toEqual([])
  expect(restored?.cluster.systems[0]?.objects.map(object => object.id)).toContain(firstPoint.id)
  expect(restored?.layout.unresolvedExitPositions).toEqual({})
  expect(restoreLocalWorkspace(missingEndpoint)).toBeNull()
  expect(restoreLocalWorkspace(entityIdCollision)).toBeNull()
  expect(restoreLocalWorkspace(fieldIdCollision)).toBeNull()
})

test('workspace snapshots reject stale legacy routes instead of migrating the detached mutation @pure', () => {
  const base = addStarSystem(createLocalWorkspace('Snapshot Reach', 'Vesper'), 'Harrow').workspace
  const [originSystem, destinationSystem] = base.cluster.systems
  if (!originSystem || !destinationSystem) throw new Error('The snapshot fixture needs two systems.')
  const originPoint = createSystemObject(originSystem, 'jump-point')
  const destinationPoint = createSystemObject(destinationSystem, 'jump-point')
  const legacyCandidate = {
    ...base,
    version: 4,
    cluster: {
      ...base.cluster,
      systems: [
        { ...originSystem, objects: [...originSystem.objects, originPoint] },
        { ...destinationSystem, objects: [...destinationSystem.objects, destinationPoint] },
      ],
      routes: [{
        id: 'stale-route',
        jumpLevel: 2,
        fromPointId: originPoint.id,
        toPointId: destinationPoint.id,
        playerShared: false,
      }],
    },
  } as unknown as ReturnType<typeof createLocalWorkspace>

  expect(restoreLocalWorkspace(legacyCandidate)?.cluster.routes[0]).toMatchObject({
    fromSystemId: originSystem.id,
    toSystemId: destinationSystem.id,
    fromPointId: originPoint.id,
    toPointId: destinationPoint.id,
  })
  expect(() => createWorkspaceSnapshot(legacyCandidate)).toThrow('The workspace is invalid and cannot be saved.')
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


test('the default Warden map restores a legacy backup with retained layout and valid route attachments', async ({ page }) => {
  test.setTimeout(90_000)
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await fitWorkspaceMap(page)

  const activeEditor = await openChartDetailsEditor(page)
  await activeEditor.getByLabel('Jump Cluster', { exact: true }).fill('Active Reach')
  await activeEditor.getByRole('button', { name: 'Apply details', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await hideWorkspaceInspector(page)

  const initialExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const incoming = structuredClone(campaignBaselineFixture)
  const vesper = incoming.cluster.systems[0]
  const departure = vesper?.objects.find(object => object.id === 'campaign-baseline-departure')
  if (!vesper || !departure) throw new Error('The backup fixture needs the Vesper departure point.')
  vesper.objects.push({
    id: 'legacy-loop-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP-02',
    name: 'Legacy return point',
    description: '',
    placement: { kind: 'system', x: 0.68, y: 0.56 },
  })
  incoming.cluster.routes.push({
    id: 'legacy-loop-route', jumpLevel: 2, fromPointId: departure.id, toPointId: 'legacy-loop-point',
  })
  const legacyBackupText = JSON.stringify(incoming)
  const restoreOptions = await openMapFilesSection(page, 'Import or restore')
  const invalidFileChooser = page.waitForEvent('filechooser')
  await restoreOptions.getByRole('menuitem', { name: 'Restore Jump Cluster from JSON', exact: true }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(jumpClusterBackupInput(page), 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(initialExport)

  const hierarchyBeforeRestore = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await expect(hierarchyBeforeRestore.getByRole('navigation', { name: 'Star systems', exact: true })).toHaveCount(0)
  await expect(hierarchyBeforeRestore.getByRole('treeitem', { name: 'Vesper', exact: true })).toHaveCount(1)

  const canceledPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', legacyBackupText)
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
    await fitWorkspaceMap(staleTab)

    const draftReview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', legacyBackupText)
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

    const acceptedPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', legacyBackupText)
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

    const retryPreview = await reviewJumpClusterBackup(page, 'campaign-baseline.json', legacyBackupText)
    await resolveJumpClusterRestoreReview(retryPreview, 'confirm', true)
    await expect(retryPreview).toBeHidden()
    await waitForWorkspaceSaved(page)
    const restoredWorkspaceId = await page.evaluate(async () => {
      const request = indexedDB.open('ttrpg-cluster-control')
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
  await fitWorkspaceMap(page)
  const map = wardenMap(page)
  await expect(map).toHaveAccessibleName('Kestrel Reach Prime continuous map')
  await expect(map.locator('.cluster-route[data-route-id="campaign-baseline-route"]')).toBeVisible()
  await expect(map.locator('.cluster-route[data-route-id="legacy-loop-route"]')).toHaveCount(0)

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
    id: 'campaign-baseline-route',
    fromSystemId: importedVesper.id,
    toSystemId: importedHarrow.id,
    jumpLevel: 1,
    fromPointId: importedDeparture.id,
    toPointId: importedArrival.id,
  })

  expect(importedExport.cluster?.routes).toHaveLength(1)
  expect(importedVesper.objects.map(object => object.id)).toContain('legacy-loop-point')
  expect(importedExport.layout.systemPositions).toEqual(campaignBaselineFixture.layout.systemPositions)
  expect(importedExport.layout.orbitRadii).toMatchObject(campaignBaselineFixture.layout.orbitRadii)
  expect(importedExport.layout.objectAngles).toEqual(campaignBaselineFixture.layout.objectAngles)

  const importedHierarchy = await openWorkspaceHierarchy(page)
  await importedHierarchy.getByRole('treeitem', { name: 'Vesper Prime', exact: true }).click()
  await importedHierarchy.getByRole('treeitem', { name: /Select PL-01, Iria/ }).click()
  await expect(page.getByLabel('Warden notes')).toHaveValue('Existing campaign record.')
})
