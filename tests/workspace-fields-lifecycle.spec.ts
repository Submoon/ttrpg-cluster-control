import { expect, test } from './fixtures'
import {
  selectInspectorOption,
} from './helpers'
test('mobile Fields retains an unsaved native-field draft across Back, hide, theme, and reflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchyToggle).toBeVisible()
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.getByRole('dialog', { name: 'System hierarchy' })
  await expect(hierarchy).toBeVisible()
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  const manageFields = page.getByRole('button', { name: 'Manage field definitions' })
  await expect(manageFields).toBeVisible()
  await manageFields.click()
  const dialog = page.getByRole('dialog', { name: 'Field definitions' })
  await expect(dialog).toBeVisible()
  const fieldList = dialog.getByRole('navigation', { name: 'Field definitions' })
  const atmosphere = fieldList.getByRole('button', { name: /Atmosphere/ })
  await atmosphere.click()
  await dialog.getByRole('button', { name: 'Edit field definition' }).click()

  const savedOptions = 'Breathable\nUnbreathable\nVacuum\nDraft-only atmosphere'
  await dialog.getByLabel('Atmosphere choices').fill(savedOptions)
  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await atmosphere.click()
  await expect(dialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)

  await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  const inspector = page.getByRole('dialog', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Hide inspector' }).click()
  await expect(inspector).toBeHidden()
  const theme = page.getByRole('group', { name: 'Theme' })
  const currentTheme = (await theme.locator('.workspace-header-theme-status').textContent())?.trim()
  await theme.getByRole('button', { name: /switch to (light|dark) mode/i }).click()
  await expect(theme.locator('.workspace-header-theme-status')).not.toHaveText(currentTheme ?? '')

  await page.setViewportSize({ width: 844, height: 390 })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const resumedInspector = page.getByRole('dialog', { name: 'Object inspector' })
  await expect(resumedInspector).toBeVisible()
  const resumedManageFields = resumedInspector.getByRole('button', { name: 'Manage field definitions' })
  await resumedManageFields.click()
  const resumedDialog = page.getByRole('dialog', { name: 'Field definitions' })
  await expect(resumedDialog).toBeVisible()
  await expect(resumedDialog.getByRole('heading', { name: 'Atmosphere', exact: true })).toBeVisible()
  await expect(resumedDialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)

  await resumedDialog.getByRole('button', { name: 'Back to definitions' }).click()
  await resumedDialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Port class/ }).click()
  await expect(resumedDialog.getByRole('status', { name: 'Unsaved field draft' })).toBeVisible()
  await resumedDialog.getByRole('button', { name: 'Stay here' }).click()
  await resumedDialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Atmosphere/ }).click()
  await expect(resumedDialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)
})





test('a type-change review names exact impacts and refreshes after Inspector resolution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.getByRole('dialog', { name: 'System hierarchy' })
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  const inspector = page.getByRole('dialog', { name: 'Object inspector' })
  await expect(inspector).toBeVisible()

  await inspector.getByRole('button', { name: 'Manage field definitions' }).click()
  const definitions = page.getByRole('dialog', { name: 'Field definitions' })
  await definitions.getByRole('button', { name: 'New custom field' }).click()
  await definitions.getByLabel('Custom field label').fill('Lifecycle note')
  await definitions.getByRole('button', { name: 'Add custom field' }).click()
  await expect(definitions.getByRole('heading', { name: 'Lifecycle note', exact: true })).toBeVisible()
  await definitions.getByRole('button', { name: 'Close field definitions' }).click()

  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Lifecycle note').fill('First')
  await inspector.getByRole('button', { name: /^Apply changes/ }).click()
  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Lifecycle note').fill('Updated')
  await inspector.getByRole('button', { name: 'Manage field definitions' }).click()

  await definitions.getByRole('button', { name: 'Edit field definition' }).click()
  await selectInspectorOption(definitions.getByLabel('Value type'), 'Number')
  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  const review = definitions.getByRole('region', { name: 'Field change review' })
  await expect(review).toBeVisible()
  await expect(review).toContainText('text → number')
  await expect(review).toContainText('Primary Star / Vesper')
  await expect(review).toContainText('First')
  await expect(review).toContainText('Clear this value')

  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  const inspectorGuard = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await expect(inspectorGuard).toBeVisible()
  await inspectorGuard.getByRole('button', { name: 'Apply and continue' }).click()
  await expect(inspectorGuard).toBeHidden()
  await expect(review).toContainText('Updated')
  await expect(review).not.toContainText('First')

  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  await expect(review).toBeHidden()
  await expect(definitions.getByRole('heading', { name: 'Lifecycle note', exact: true })).toBeVisible()
})
