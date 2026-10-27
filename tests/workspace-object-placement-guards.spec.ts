import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  downloadJson,
  selectCatalogueObjectButton,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'

test('armed object Add owns Placement and cancels an existing-object preview', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  const dock = workspaceNavigation(page)
  const modeGroup = dock.getByRole('group', { name: 'Map interaction mode', exact: true })
  await setWorkspaceMapMode(page, 'Move')
  const initialExport = await downloadJson(page, 'Export star system JSON')
  const star = map.locator('.system-object').filter({ hasText: 'Primary Star' })
  const originalTransform = await star.getAttribute('transform')
  if (!originalTransform) throw new Error('The initial Primary Star has no rendered position.')
  await star.locator('.object-hit-target').click()

  const placement = dock.getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  const existingPlacement = page.getByRole('form', { name: 'Object placement', exact: true })
  await existingPlacement.getByLabel('Object position X', { exact: true }).fill('0.62')
  await existingPlacement.getByLabel('Object position Y', { exact: true }).fill('0.64')
  await existingPlacement.getByRole('button', { name: 'Preview position', exact: true }).click()
  await expect(star).not.toHaveAttribute('transform', originalTransform)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)

  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const addToggle = dock.getByRole('button', { name: 'Add to map', exact: true })
  await expect(addToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(dock.getByRole('button', { name: 'Placement', exact: true })).toHaveCount(1)
  await expect(page.getByLabel('Object position X', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toHaveCount(0)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)

  await modeGroup.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(addToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(modeGroup.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(star).toHaveAttribute('transform', originalTransform)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(initialExport)
})
