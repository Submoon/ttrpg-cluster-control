import { expect, preparedCampaignTest as campaignTest } from './fixtures'



import {
  clickDockAction,
  setWorkspaceMapMode,
} from './helpers'


campaignTest('invalid route edits focus the validation summary and Stay preserves the edit context', async ({ campaignWorkspacePage: page }) => {
  await setWorkspaceMapMode(page, 'Select')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const routeMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ })
  await routeMark.click()

  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await inspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const jumpLevel = inspector.getByRole('spinbutton', { name: 'Jump level' })
  const apply = inspector.getByRole('button', { name: 'Apply Jump Route', exact: true })
  await jumpLevel.fill('0')
  await apply.click()

  const validation = inspector.getByRole('alert')
  await expect(validation).toContainText('Jump level must be a positive integer.')
  await expect(validation).toBeFocused()
  const jumpLevelIssue = validation.getByRole('button', { name: /Jump level: Jump level must be a positive integer/ })
  await jumpLevelIssue.click()
  await expect(jumpLevel).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('12')
  await expect(jumpLevel).toHaveValue('12')
  await expect(jumpLevel).toBeFocused()

  await jumpLevel.fill('0')
  await apply.click()
  await expect(validation).toBeFocused()
  await clickDockAction(page, 'Add Jump Route')
  const transition = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await expect(transition.getByText('Continue without this draft?')).toBeVisible()
  await transition.getByRole('button', { name: 'Stay here', exact: true }).click()

  await expect(transition).toBeHidden()
  await expect(clusterMap).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Edit Jump Route' })).toBeVisible()
  await expect(jumpLevel).toHaveValue('0')
  await expect(validation).toContainText('Jump level must be a positive integer.')
})
