import { expect, test } from './fixtures'
import { createSingleSystemWorkspace } from './helpers'

test('compact landscape workspace menu keeps Help, Fields, theme, privacy, and focus usable @ui-smoke', async ({ page }) => {
  const clusterName = 'Vesper Observatory and the Outer Beacon of the Meridian Expanse'
  await createSingleSystemWorkspace(page, {
    clusterName,
    viewport: { width: 844, height: 390 },
  })

  const toolbar = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const header = page.locator('header.workspace-header')
  const menuButton = header.getByRole('button', { name: 'Open workspace menu', exact: true })
  const menu = page.getByRole('dialog', { name: 'Workspace menu', exact: true })
  await expect(header.getByText('TTRPG Cluster Control', { exact: true })).toBeVisible()
  await expect(header.getByText(clusterName, { exact: true })).toBeHidden()
  await expect(header.getByRole('button', { name: 'Help', exact: true })).toHaveCount(0)
  await expect(toolbar).toBeInViewport({ ratio: 1 })

  await menuButton.focus()
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await expect(menu.getByText(clusterName, { exact: true })).toBeInViewport({ ratio: 1 })
  const options = menu.getByRole('navigation', { name: 'Workspace options', exact: true })
  await expect(options.getByRole('listitem')).toHaveCount(4)
  const privacy = options.getByRole('link', { name: /Privacy policy/i })
  await expect(privacy).toHaveAttribute('href', '/privacy')

  const theme = options.getByRole('button', { name: /Switch to (light|dark) mode/ })
  const themeBefore = await theme.innerText()
  await theme.click()
  await expect(theme).not.toHaveText(themeBefore)

  await options.getByRole('button', { name: 'Open field definitions', exact: true }).click()
  const fields = page.getByRole('dialog', { name: 'Field definitions', exact: true })
  await expect(fields).toBeVisible()
  await fields.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(fields).toBeHidden()
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()

  await menuButton.press('Enter')
  const help = options.getByRole('button', { name: 'Help', exact: true })
  await help.click()
  const guide = page.getByRole('dialog', { name: 'Map editor help', exact: true })
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(guide).toBeHidden()
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()

  await menuButton.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(menuButton).toBeFocused()
  await expect(toolbar).toBeInViewport({ ratio: 1 })
  await expect(toolbar.getByRole('button', { name: 'Map files', exact: true })).toBeInViewport({ ratio: 1 })
})