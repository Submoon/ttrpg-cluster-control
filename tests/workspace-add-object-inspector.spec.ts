import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  clickNormalizedSystemPoint,
  openWorkspaceHierarchy,
  selectCatalogueObjectButton,
  selectInspectorOption,
} from './helpers'

type Point = { x: number; y: number }











async function addObjectAt(page: import('@playwright/test').Page, subtype: 'planet' | 'moon', point: Point): Promise<void> {
  const label = subtype === 'planet' ? 'Planet' : 'Moon'
  const controls = page.getByRole('group', { name: `${label} creation controls`, exact: true })
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), 'Free map position')
  await placementToggle.click()
  await clickNormalizedSystemPoint(page, page.getByRole('group', { name: /star system map$/ }), point)
}

async function beginObjectAdd(page: import('@playwright/test').Page, subtype: 'planet' | 'moon'): Promise<void> {
  await (await selectCatalogueObjectButton(page, subtype)).click()
  await expect(page.getByRole('group', {
    name: `${subtype === 'planet' ? 'Planet' : 'Moon'} creation controls`,
    exact: true,
  })).toBeVisible()
}



test('Stay keeps a dirty object draft and does not publish or select a new object Add', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')
  await beginObjectAdd(page, 'planet')
  await addObjectAt(page, 'planet', { x: 0.25, y: 0.25 })

  const guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Unapplied Primary Star')
  await expect(page.getByRole('group', { name: 'Vesper star system map', exact: true }).locator('.system-object')).toHaveCount(1)
  await expect(page.getByRole('group', { name: 'Planet creation controls', exact: true })).toBeVisible()
})
