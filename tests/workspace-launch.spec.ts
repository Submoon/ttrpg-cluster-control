import { expect, test } from './fixtures'
import { waitForWorkspaceSaved, waitForWorkspaceStartup, wardenMap } from './helpers'

async function expectOpenedWorkspace(
  page: import('@playwright/test').Page,
  clusterName: string,
  systemName: string,
): Promise<void> {
  const map = wardenMap(page)
  await expect(map).toHaveCount(1)
  await expect(map).toBeVisible()
  await expect(map).toHaveAccessibleName(`${clusterName} continuous map`)
  const system = map.getByRole('button', { name: `Select ${systemName}`, exact: true })
  await expect(system).toHaveAccessibleName(`Select ${systemName}`)
  await expect(system).toBeVisible()
  const hierarchy = page.getByRole('complementary', { name: 'Jump Cluster contents', exact: true })
  await expect(hierarchy.getByText('0 records', { exact: true })).toBeVisible()
}
test('the product root creates and resumes a saved local workspace @preview-smoke', async ({ page }) => {
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Privacy policy' })).toBeVisible()
  await page.getByLabel('Jump Cluster').fill('Halcyon Spur')
  await page.getByLabel('First star system').fill('Lark')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await expectOpenedWorkspace(page, 'Halcyon Spur', 'Lark')
  await waitForWorkspaceSaved(page)

  await page.reload()

  await waitForWorkspaceStartup(page)
  await expectOpenedWorkspace(page, 'Halcyon Spur', 'Lark')
  await waitForWorkspaceSaved(page)
})
