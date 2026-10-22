import { expect, test } from '@playwright/test'
import { activeWorkspaceFeedback } from './helpers'

for (const variant of ['A', 'B', 'C', 'baseline'] as const) {
  test(`?variant=${variant} opens a persisted workspace without comparison controls`, async ({ page }) => {
    await page.goto(`/?variant=${variant}`)

    await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
    await page.getByLabel('Jump Cluster').fill(`Variant ${variant} Cluster`)
    await page.getByLabel('First star system').fill('Lark')
    await page.getByRole('button', { name: 'Create local workspace' }).click()

    const workspaceNavigation = page.getByRole('navigation', { name: 'Map context and commands' })
    await expect(workspaceNavigation.getByRole('heading', { name: 'Lark' })).toBeVisible()
    await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
    await expect(page.getByLabel('Prototype variants')).toHaveCount(0)

    await page.reload()

    await expect(workspaceNavigation.getByRole('heading', { name: 'Lark' })).toBeVisible()
    await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
    await expect(page.getByLabel('Prototype variants')).toHaveCount(0)
  })
}
