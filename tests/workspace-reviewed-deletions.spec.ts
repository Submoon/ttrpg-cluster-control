import { expect, test } from './fixtures'
import {
  clickDockAction,
  createSingleSystemWorkspace,
  editMapObject,
  openWorkspaceHierarchy,
} from './helpers'

test('object deletion reviews the current cascade before resolving its inspector draft', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()

  await clickDockAction(page, 'Add orbit', {
    target: { kind: 'host', name: 'Primary Star' },
    noSelection: true,
  })

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await editMapObject(page)
  const nameInput = page.getByLabel('Name', { exact: true })
  await nameInput.fill('Unapplied star')

  const deleteButton = page.getByRole('button', { name: 'Delete Primary Star', exact: true })
  await expect(deleteButton).toBeVisible()
  await expect(deleteButton).toBeEnabled()
  await deleteButton.click()

  const review = page.getByRole('dialog', { name: 'Review deletion', exact: true })
  await expect(review).toBeVisible()
  await expect(review).toContainText('Primary Star')
  await expect(review).toContainText('Orbit 1 around Primary Star')
  await expect(page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })).toHaveCount(0)
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(review).toBeHidden()
  await expect(nameInput).toHaveValue('Unapplied star')

  await deleteButton.click()
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Confirm deletion', exact: true }).click()

  const inspectorGuard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await expect(inspectorGuard).toBeVisible()
  await inspectorGuard.getByRole('button', { name: 'Apply and continue', exact: true }).click()

  await expect(inspectorGuard).toBeHidden()
  await expect(review).toBeVisible()
  await expect(review).toContainText('Unapplied star')
  await expect(review).toContainText('Orbit 1 around Unapplied star')
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(review).toBeHidden()

  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Unapplied star', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unapplied star')
})




test('the current-system inspector disables deletion of the final system', async ({ page }) => {
  await createSingleSystemWorkspace(page, { clusterName: 'Kestrel Reach', systemName: 'A' })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector.getByRole('button', { name: 'Delete A system', exact: true })).toBeDisabled()
  await expect(inspector.getByText('A Jump Cluster must keep at least one star system.', { exact: true })).toBeVisible()
})
