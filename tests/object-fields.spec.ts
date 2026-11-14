import {
  addCustomFieldDefinition,
  addStarSystem,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  replaceWorkspaceSystem,
} from '../domain/workspace'
import { expect, test, type Page } from './fixtures'
import {
  addCustomFieldThroughDialog,
  editFieldDefinition,
  editMapObject,
  openFieldDefinitionDialog,
  openWorkspaceHierarchy,
  readInspectorSelection,
  resolveJumpClusterRestoreReview,
  returnToClusterMap,
  reviewJumpClusterBackup,
  saveMapObject,
  selectInspectorOption,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'

function objectFieldsCampaign() {
  let workspace = createLocalWorkspace('Field Survey', 'Vesper')
  const vesper = workspace.cluster.systems[0]
  if (!vesper) throw new Error('The fields campaign requires its initial system.')
  const iria = { ...createSystemObject(vesper, 'planet'), name: 'Iria' }
  const vesperWithPlanet = { ...vesper, objects: [...vesper.objects, iria] }
  const station = { ...createSystemObject(vesperWithPlanet, 'station'), name: 'Survey Station' }
  workspace = replaceWorkspaceSystem(workspace, {
    ...vesperWithPlanet,
    objects: [...vesperWithPlanet.objects, station],
  })

  const { workspace: twoSystems, system: deneb } = addStarSystem(workspace, 'Deneb')
  const nivalis = { ...createSystemObject(deneb, 'planet'), name: 'Nivalis' }
  workspace = replaceWorkspaceSystem(twoSystems, { ...deneb, objects: [...deneb.objects, nivalis] })
  workspace = addCustomFieldDefinition(workspace, 'Threat level', 'number')
  workspace = addCustomFieldDefinition(workspace, 'Hostile', 'boolean')
  workspace = addCustomFieldDefinition(workspace, 'Signal class', 'single-select', ['Amber', 'Red'])
  return exportJumpCluster(workspace)
}

async function openSystemHierarchy(page: Page, systemName: string) {
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: `Open ${systemName} system map`, exact: true }).click()
  return openWorkspaceHierarchy(page)
}

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  test.slow()
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Staging')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  const restoreReview = await reviewJumpClusterBackup(page, 'object-fields.json', JSON.stringify(objectFieldsCampaign()))
  await resolveJumpClusterRestoreReview(restoreReview, 'confirm')
  await waitForWorkspaceSaved(page)

  const vesper = await openSystemHierarchy(page, 'Vesper')
  await vesper.getByRole('treeitem', { name: /Iria/ }).click()
  const definitions = await openFieldDefinitionDialog(page)
  await definitions.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(definitions)
  await definitions.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  const applyFieldChanges = definitions.getByRole('button', { name: 'Apply field changes' })
  await applyFieldChanges.click()
  await expect(definitions.getByRole('region', { name: 'Field change review' }))
    .toContainText('No saved values are affected.')
  await applyFieldChanges.click()
  await definitions.getByRole('button', { name: 'Close field definitions' }).click()
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await editMapObject(page)
  await selectInspectorOption(page.getByLabel('Atmosphere', { exact: true }), 'Chlorine')
  await page.getByLabel('Campaign notes', { exact: true }).fill('Relay station under the ice.')
  await page.getByLabel('Threat level', { exact: true }).fill('4')
  await selectInspectorOption(page.getByLabel('Hostile', { exact: true }), 'Yes')
  await selectInspectorOption(page.getByLabel('Signal class', { exact: true }), 'Red')
  await saveMapObject(page)

  await vesper.getByRole('treeitem', { name: /Survey Station/ }).click()
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('')

  const deneb = await openSystemHierarchy(page, 'Deneb')
  await deneb.getByRole('treeitem', { name: /Nivalis/ }).click()
  await editMapObject(page)
  await page.getByLabel('Campaign notes', { exact: true }).fill('Reusable in the next system.')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  await page.reload()
  await waitForWorkspaceStartup(page)
  const restoredVesper = await openSystemHierarchy(page, 'Vesper')
  await restoredVesper.getByRole('treeitem', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Relay station under the ice.')
  await expect(page.getByLabel('Threat level', { exact: true })).toHaveValue('4')
  expect(await readInspectorSelection(page.getByLabel('Atmosphere', { exact: true }))).toBe('Chlorine')
  expect(await readInspectorSelection(page.getByLabel('Hostile', { exact: true }))).toBe('Yes')
  expect(await readInspectorSelection(page.getByLabel('Signal class', { exact: true }))).toBe('Red')

  const restoredDeneb = await openSystemHierarchy(page, 'Deneb')
  await restoredDeneb.getByRole('treeitem', { name: /Nivalis/ }).click()
  await expect(page.getByLabel('Campaign notes', { exact: true })).toHaveValue('Reusable in the next system.')
})
