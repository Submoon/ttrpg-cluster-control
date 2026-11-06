import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  editMapObject,
  openWorkspaceHierarchy,
  saveMapObject,
} from './helpers'

test('same-kind object switches keep Inspector labels attached to the selected controls', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
  await hierarchy.getByRole('treeitem', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Iria')
})
