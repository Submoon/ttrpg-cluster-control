import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  downloadJson,
  openWorkspaceHierarchy,
  quitSystemAdd,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
} from './helpers'

test('an independent Add saves while Stay keeps the inspected object draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star in Vesper', exact: true }).click()

  const inspector = page.getByRole('region', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')
  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const status = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
    .locator('.workspace-add-status')
  await expect(status).toContainText(/planet/i)
  const delivered = await clickWardenSystemPoint(page, systemId, { x: 0.41, y: 0.64 })
  await expect(wardenMap(page).locator('.continuous-warden-object')).toHaveCount(2)
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  const savedOwner = after.cluster?.systems.find(system => system.id === systemId)
  const added = savedOwner?.objects.find(object => object.subtype === 'planet')
  expect(savedOwner?.objects[0]).toEqual(before.cluster?.systems[0]?.objects[0])
  if (!added || added.placement.kind !== 'system') throw new Error('The added Planet needs a saved position in Vesper.')
  expect(added.placement.x).toBeCloseTo(delivered.x, 5)
  expect(added.placement.y).toBeCloseTo(delivered.y, 5)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')

  await quitSystemAdd(page)
  await wardenObjectMark(page, systemId, added.id).press('Enter')
  const guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', {
    name: 'Select A, Unapplied Primary Star in Vesper', exact: true,
  })).toHaveAttribute('aria-selected', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await expect(wardenObjectMark(page, systemId, added.id)).toHaveAttribute('aria-pressed', 'false')
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(after)
})
