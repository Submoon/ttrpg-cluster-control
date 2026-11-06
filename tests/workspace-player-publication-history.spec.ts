import { expect, test, type Page } from './fixtures'
import {
  addCustomFieldDefinition,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  replaceWorkspaceSystem,
} from '../domain/workspace'
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  editFieldDefinition,
  editMapObject,
  importReviewDialog,
  jsonMapImportInput,
  openFieldDefinitionDialog,
  openChartDetails,
  openWorkspaceHierarchy,
  overwriteWorkspaceRecord,
  resolveImportReview,
  returnToClusterMap,
  saveMapObject,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

function historyLabExport() {
  const initial = createLocalWorkspace('Source Reach', 'History Lab')
  const system = initial.cluster.systems[0]!
  const world = {
    ...createSystemObject(system, 'planet'),
    name: 'History World',
    publication: 'revealed' as const,
    atmosphere: 'Breathable',
    playerText: 'Initial public text.',
    description: 'Initial private notes.',
  }
  const source = replaceWorkspaceSystem(initial, {
    ...system,
    publication: 'revealed',
    objects: [...system.objects, world],
  })
  return exportStarSystem(source, system.id)
}

function recoveryLabExport() {
  const initial = addCustomFieldDefinition(
    createLocalWorkspace('Source Reach', 'Recovery Lab'),
    'Backup faction',
    'single-select',
    ['Merchants', 'Cult'],
    true,
  )
  const definition = initial.objectFieldSettings.customFields[0]!
  const system = initial.cluster.systems[0]!
  const world = {
    ...createSystemObject(system, 'planet'),
    name: 'Recovery World',
    publication: 'revealed' as const,
    playerText: 'Public recovery text.',
    description: '  PRIVATE recovery notes.\n',
    playerFieldMasks: [definition.id],
    customFieldValues: { [definition.id]: 'Merchants' },
  }
  const withWorld = { ...system, objects: [...system.objects, world] }
  const point = {
    ...createSystemObject(withWorld, 'jump-point'),
    name: 'PRIVATE recovery Jump Point',
    publication: 'hidden' as const,
  }
  const withObjects = replaceWorkspaceSystem(initial, {
    ...withWorld,
    publication: 'revealed',
    objects: [...withWorld.objects, point],
  })
  const route = createJumpRoute(withObjects.cluster, 3, point.id, null, 'PRIVATE external label', true)
  return exportJumpCluster({
    ...withObjects,
    cluster: { ...withObjects.cluster, routes: [route] },
    layout: {
      ...withObjects.layout,
      unresolvedExitPositions: { [route.id]: { x: 1700, y: 900 } },
    },
  })
}

async function openHistoryLab(page: Page): Promise<void> {
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await clusterMap.getByRole('button', { name: 'Open History Lab system map', exact: true }).click()
  await expect(page.getByRole('group', { name: 'History Lab star system map', exact: true })).toBeVisible()
}

async function expectSaved(page: Page): Promise<void> {
  await waitForWorkspaceSaved(page)
}

test('Field publication, object masks and separate prose round-trip through real Undo, Redo and reload', async ({ page }) => {
  // Two independent edits, their exact backup states, four traversals and a fresh hydration.
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await setJsonFile(jsonMapImportInput(page), 'player-history-lab.json', JSON.stringify(historyLabExport()))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await expectSaved(page)
  await openHistoryLab(page)
  const before = await downloadJson(page, 'Export star system JSON')
  expect(before.objectFieldSettings.nativePlayerSharing?.atmosphere).toBe(false)

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: /^Select .*, History World$/ }).click()
  const definitions = await openFieldDefinitionDialog(page)
  await definitions.getByRole('button', { name: /^Atmosphere\b/ }).click()
  await editFieldDefinition(definitions)
  const sharing = definitions.getByRole('checkbox', { name: /^Share with players$/i })
  await expect(sharing).not.toBeChecked()
  await sharing.check()
  await definitions.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  await definitions.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expectSaved(page)
  const shared = await downloadJson(page, 'Export star system JSON')
  expect(shared.objectFieldSettings.nativePlayerSharing?.atmosphere).toBe(true)

  await editMapObject(page)
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByLabel('Player text', { exact: true }).fill('Published history text.')
  await inspector.getByLabel('GM notes', { exact: true }).fill('Private history notes.')
  await inspector.getByRole('region', { name: 'Catalogue fields', exact: true })
    .getByRole('checkbox', { name: /^Hide this value from players$/i }).check()
  await saveMapObject(page)
  await expectSaved(page)
  const edited = await downloadJson(page, 'Export star system JSON')
  expect(edited.system?.objects.find(object => object.name === 'History World')).toMatchObject({
    playerText: 'Published history text.',
    description: 'Private history notes.',
    playerFieldMasks: ['native:atmosphere'],
    atmosphere: 'Breathable',
  })

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await undo.click()
  await expectSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(shared)
  await expect(undo).toBeEnabled()
  await undo.click()
  await expectSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(before)
  await expect(redo).toBeEnabled()
  await redo.click()
  await expectSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(shared)
  await expect(redo).toBeEnabled()
  await redo.click()
  await expectSaved(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(edited)

  await page.reload()
  await expectSaved(page)
  await openHistoryLab(page)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(edited)
})

test('last-valid recovery retains complete player content, Field masks and shared routes', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await setJsonFile(jsonMapImportInput(page), 'player-recovery-lab.json', JSON.stringify(recoveryLabExport()))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await expectSaved(page)
  await returnToClusterMap(page)
  const expected = await downloadJson(page, 'Export Jump Cluster JSON')
  const field = expected.objectFieldSettings.customFields.find(candidate => candidate.name === 'Backup faction')
  if (!field) throw new Error('The imported recovery Field is missing.')
  expect(field.playerShared).toBe(true)
  const world = expected.cluster?.systems.flatMap(system => system.objects)
    .find(object => object.name === 'Recovery World')
  expect(world).toMatchObject({
    playerText: 'Public recovery text.',
    description: '  PRIVATE recovery notes.\n',
    playerFieldMasks: [field.id],
    customFieldValues: { [field.id]: 'Merchants' },
  })
  expect(expected.cluster?.routes.find(route => route.jumpLevel === 3)?.playerShared).toBe(true)

  // A durable edit moves the complete desired prior state into last-valid.
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await chartEdit.getByLabel('Player-facing title', { exact: true }).fill('Current-only title')
  await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEdit).toBeHidden()
  await expectSaved(page)

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup', exact: true }).click()
  await expectSaved(page)
  await returnToClusterMap(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(expected)
  await page.reload()
  await expectSaved(page)
  await returnToClusterMap(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(expected)
})
