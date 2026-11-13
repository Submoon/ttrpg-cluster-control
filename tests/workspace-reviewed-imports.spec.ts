import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  createSystemObject,
  exportStarSystem,
} from '../domain/workspace'
import {
  abortNextWorkspaceWrite,
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  hideWorkspaceInspector,
  openChartDetailsEditor,
  returnToClusterMap,
  resolveImportReview,
  reviewStarSystemImport,
  setHeaderMapActionsOpen,
} from './helpers'

function incomingSystem(): {
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

  return {
    content: JSON.stringify(exportStarSystem({
      ...source,
      cluster: { ...source.cluster, systems: [system] },
    }, system.id)),
    systemId: system.id,
    objectIds: [firstPoint.id, secondPoint.id],
  }
}

test('standalone system review preserves an unrelated chart draft and adds an independent system only on confirm', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  const chartEditor = await openChartDetailsEditor(page)
  await chartEditor.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartEditor.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const incoming = incomingSystem()
  const openReview = async () => reviewStarSystemImport(page, 'incoming-reach.json', incoming.content)

  const review = await openReview()
  await expect(review).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })).toHaveCount(0)
  await review.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' })).toBeVisible()

  const afterCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterCancel.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  await openReview()
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Import independent copy', exact: true }).click()
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await waitForWorkspaceSaved(page)
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper', 'Incoming Vesper'])
  const importedSystem = exported.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem?.id).not.toBe(incoming.systemId)
  const importedObjectIds = new Set(importedSystem?.objects.map(object => object.id))
  for (const sourceId of incoming.objectIds) expect(importedObjectIds.has(sourceId)).toBe(false)
  expect(exported.cluster?.routes).toHaveLength(0)
})

test('an applied import closes review before save failure and Retry persists the copy without clearing an unrelated draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const chartEditor = await openChartDetailsEditor(page)
  await chartEditor.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartEditor.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const incoming = incomingSystem()
  const review = await reviewStarSystemImport(page, 'incoming-reach.json', incoming.content)
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

  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await page.reload()
  await returnToClusterMap(page)

  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  const persistedImport = afterReload.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(persistedImport).toBeDefined()
  expect(persistedImport?.id).not.toBe(incoming.systemId)
})
