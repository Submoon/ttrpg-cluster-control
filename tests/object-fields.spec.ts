import { expect, test } from './fixtures'
import {
  addCustomFieldThroughDialog,
  editFieldDefinition,
  editMapObject,
  openFieldDefinitionDialog,
  openWorkspaceHierarchy,
  saveMapObject,
  selectInspectorOption,
  waitForWorkspaceSaved,
} from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

test('removing an assigned Field choice clears the reviewed value', async ({ page }) => {
  await importCampaignWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Vesper Prime', exact: true }).click()
  const planet = hierarchy.getByRole('treeitem', { name: /Select PL-01, Iria in Vesper Prime/ })
  await planet.click()
  await addCustomFieldThroughDialog(page, 'Survey status', 'single-select', 'Pending\nDone')

  await editMapObject(page)
  const status = page.getByLabel('Survey status', { exact: true })
  await selectInspectorOption(status, 'Done')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
  await expect(status).toHaveText('Done')

  const definitions = await openFieldDefinitionDialog(page)
  await definitions.getByRole('button', { name: /Survey status/ }).click()
  await editFieldDefinition(definitions)
  const applicability = definitions.getByRole('group', { name: 'Field applicability', exact: true })
  await applicability.getByRole('checkbox', { name: /all catalogue objects/i }).uncheck()
  await applicability.getByRole('checkbox', { name: /subtype planet/i }).check()
  await definitions.getByLabel('Survey status choices', { exact: true }).fill('Pending')
  const apply = definitions.getByRole('button', { name: 'Apply field changes', exact: true })
  await apply.click()
  const review = definitions.getByRole('region', { name: 'Field change review', exact: true })
  await expect(review).toContainText('Iria / Vesper Prime')
  await expect(review).toContainText('Done')
  await expect(review).toContainText('Clear this value')
  await apply.click()
  await definitions.getByRole('button', { name: 'Close field definitions' }).click()
  await waitForWorkspaceSaved(page)
  await expect(status).toHaveText('Not recorded')
})
