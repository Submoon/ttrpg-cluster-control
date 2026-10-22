import { expect, test } from '@playwright/test'
import {
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
} from '../domain/workspace'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  importReviewDialog,
  jsonMapImportInput,
  openFieldDefinitionDialog,
  openWorkspaceHierarchy,
  returnToClusterMap,
  resolveImportReview,
  setHeaderMapActionsOpen,
  setJsonFile,
  type ExportedMap,
} from './helpers'

type WorkspaceWriteFailpointWindow = Window & {
  __reviewedImportWriteAbort?: { original: PropertyDescriptor; aborted: number }
}

async function abortNextWorkspaceWrite(
  page: import('@playwright/test').Page,
  operation: () => Promise<void>,
): Promise<void> {
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    if (!original) throw new Error('IndexedDB put is unavailable.')
    const state = { original, aborted: 0 }
    ;(window as WorkspaceWriteFailpointWindow).__reviewedImportWriteAbort = state
    Object.defineProperty(IDBObjectStore.prototype, 'put', {
      ...original,
      value: function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
        const request = original.value!.apply(this, args)
        if (!state.aborted && this.transaction.db.name === 'ttrpg-cluster-control'
          && this.name === 'workspace' && this.transaction.mode === 'readwrite' && args[1] === 'current') {
          state.aborted += 1
          this.transaction.abort()
        }
        return request
      },
    })
  })

  try {
    await operation()
    const aborted = await page.evaluate(() =>
      (window as WorkspaceWriteFailpointWindow).__reviewedImportWriteAbort?.aborted ?? 0,
    )
    expect(aborted).toBe(1)
  } finally {
    await page.evaluate(() => {
      const state = (window as WorkspaceWriteFailpointWindow).__reviewedImportWriteAbort
      if (!state) return
      Object.defineProperty(IDBObjectStore.prototype, 'put', state.original)
      delete (window as WorkspaceWriteFailpointWindow).__reviewedImportWriteAbort
    })
  }
}

function incomingCluster(): {
  content: string
  systemId: string
  objectIds: string[]
} {
  const source = createLocalWorkspace('Incoming Reach', 'Incoming Vesper')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The import fixture needs its initial star system.')

  const firstPoint = createSystemObject(sourceSystem, 'jump-point')
  const withFirstPoint = { ...sourceSystem, objects: [...sourceSystem.objects, firstPoint] }
  const secondPoint = createSystemObject(withFirstPoint, 'jump-point')
  const system = { ...withFirstPoint, objects: [...withFirstPoint.objects, secondPoint] }
  const cluster = { ...source.cluster, systems: [system] }
  const route = createJumpRoute(cluster, 1, firstPoint.id, secondPoint.id)

  return {
    content: JSON.stringify(exportJumpCluster({
      ...source,
      cluster: { ...cluster, routes: [route] },
    })),
    systemId: system.id,
    objectIds: [firstPoint.id, secondPoint.id],
  }
}

test('JSON import review preserves an unrelated chart draft and publishes an independent copy only on confirm', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)

  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await chartDialog.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartDialog.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  const incoming = incomingCluster()
  const importFile = async () => {
    await setHeaderMapActionsOpen(page, true)
    await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
    await setHeaderMapActionsOpen(page, false)
    await setJsonFile(jsonMapImportInput(page), 'incoming-reach.json', incoming.content)
  }

  await importFile()
  const review = page.getByRole('dialog', { name: 'Review import', exact: true })
  await expect(review).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit chart names', exact: true })).toHaveCount(0)
  await review.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' })).toBeVisible()

  const afterCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterCancel.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(chartDialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartDialog.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await page.keyboard.press('Escape')

  await importFile()
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Import independent copy', exact: true }).click()
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartDialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartDialog.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper', 'Incoming Vesper'])
  const importedSystem = exported.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem?.id).not.toBe(incoming.systemId)
  const importedObjectIds = new Set(importedSystem?.objects.map(object => object.id))
  for (const sourceId of incoming.objectIds) expect(importedObjectIds.has(sourceId)).toBe(false)
  expect(exported.cluster?.routes).toHaveLength(1)
  expect(importedObjectIds.has(exported.cluster?.routes[0]?.fromPointId ?? '')).toBe(true)
  expect(importedObjectIds.has(exported.cluster?.routes[0]?.toPointId ?? '')).toBe(true)
})

test('an applied import closes review before save failure and Retry persists the copy without clearing an unrelated draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await chartDialog.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartDialog.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  const incoming = incomingCluster()
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'incoming-reach.json', incoming.content)
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()

  const saveFeedback = activeWorkspaceFeedback(page).locator('.save-feedback')
  await abortNextWorkspaceWrite(page, async () => {
    await resolveImportReview(review, 'confirm')
    await expect(review).toBeHidden()
    await expect(saveFeedback).toContainText('Not saved.')
  })

  const appliedMemory = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = appliedMemory.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem).toBeDefined()
  expect(importedSystem?.id).not.toBe(incoming.systemId)
  await expect(saveFeedback).toContainText('Not saved.')

  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartDialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartDialog.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await page.keyboard.press('Escape')

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(saveFeedback).toHaveText('Saved on this device')
  await page.reload()
  await returnToClusterMap(page)

  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  const persistedImport = afterReload.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(persistedImport).toBeDefined()
  expect(persistedImport?.id).not.toBe(incoming.systemId)
})

test('a conflicting import resumes its retained Fields draft until the user applies it', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const fields = await openFieldDefinitionDialog(page)
  await fields.getByRole('navigation', { name: 'Field definitions' })
    .getByRole('button', { name: /Atmosphere/ }).click()
  await fields.getByRole('button', { name: 'Edit field definition', exact: true }).click()
  const atmosphereChoices = fields.getByLabel('Atmosphere choices', { exact: true })
  const originalAtmosphereChoices = await atmosphereChoices.inputValue()
  const localDraftChoices = `${originalAtmosphereChoices}\nLocal draft atmosphere`
  await atmosphereChoices.fill(localDraftChoices)
  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open field definitions' }).getByText('Draft', { exact: true })).toBeVisible()

  const incoming = incomingCluster()
  const source = JSON.parse(incoming.content) as ExportedMap
  source.objectFieldSettings.atmosphereOptions.push('Thin')
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'incoming-atmosphere.json', JSON.stringify(source))

  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Import independent copy', exact: true }).click()
  await expect(review.getByRole('status')).toContainText('Fields draft is dirty')
  await review.getByRole('button', { name: 'Review Fields draft', exact: true }).click()
  await expect(review).toBeHidden()
  await expect(fields).toBeVisible()
  await expect(fields.getByLabel('Atmosphere choices', { exact: true })).toHaveValue(localDraftChoices)

  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(review).toBeVisible()
  await expect(review.getByRole('status')).toContainText('Fields draft is dirty')

  await review.getByRole('button', { name: 'Review Fields draft', exact: true }).click()
  await expect(fields.getByLabel('Atmosphere choices', { exact: true })).toHaveValue(localDraftChoices)
  await fields.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  await expect(fields.getByRole('button', { name: 'Edit field definition', exact: true })).toBeVisible()
  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(review).toBeVisible()

  await resolveImportReview(review, 'confirm')
  await expect(review.getByRole('alert')).toContainText('workspace changed while you reviewed this import')
  await expect(review.getByRole('status')).toHaveCount(0)
  await resolveImportReview(review, 'confirm')
  await expect(review).toBeHidden()

  const imported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(imported.cluster?.systems.map(system => system.name)).toContain('Incoming Vesper')
  expect(imported.objectFieldSettings.atmosphereOptions).toContain('Local draft atmosphere')
  expect(imported.objectFieldSettings.atmosphereOptions).toContain('Thin')
})
