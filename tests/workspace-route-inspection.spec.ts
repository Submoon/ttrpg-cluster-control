import { expect, test } from '@playwright/test'
import {
  addCatalogueObject,
  addClusterSystem,
  captureMapExportBlobs,
  clickDockAction,
  downloadJson,
  editMapObject,
  selectInspectorOption,
  returnToClusterMap,
  saveMapObject,
  setWorkspaceMapMode,
} from './helpers'

test('Add Jump Route opens a route draft while a cluster system is inspected', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Departure')
  await saveMapObject(page)
  await returnToClusterMap(page)

  await addClusterSystem(page, { open: true })
  await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Object palette' })).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Arrival')
  await saveMapObject(page)
  await returnToClusterMap(page)

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Select')
  await page.getByRole('button', { name: 'Fit map' }).click()
  await clusterMap.getByRole('button', { name: 'Select New System 2 system' }).click()
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(inspector.getByRole('heading', { name: 'New System 2' })).toBeVisible()

  await clickDockAction(page, 'Add Jump Route')
  const jumpLevel = page.getByRole('spinbutton', { name: 'Jump level' })
  const fromPoint = page.getByLabel('From Jump Point')
  await expect(jumpLevel).toBeVisible()
  await expect(fromPoint).toBeVisible()
  await selectInspectorOption(fromPoint, 'Arrival (New System 2)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Departure (Vesper)')
  await jumpLevel.fill('7')
  await expect(inspector.getByRole('heading', { name: 'Connect Jump Points' })).toBeVisible()
  await expect(inspector.getByText('Destination system: Vesper')).toBeVisible()

  await inspector.getByRole('button', { name: 'Discard route draft', exact: true }).click()
  await expect(jumpLevel).toHaveCount(0)

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.routes).toEqual([])
})
