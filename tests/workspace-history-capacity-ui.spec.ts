import { expect, test } from './fixtures'
import { exportJumpCluster } from '../domain/workspace'
import { createHistoryMeasurementWorkspace } from './fixtures/history-workspace'
import {
  waitForWorkspaceSaved,
  activeWorkspaceFeedback, createSingleSystemWorkspace, importReviewDialog, jsonMapImportInput, openChartDetails,
  resolveImportReview, returnToClusterMap, setHeaderMapActionsOpen, setJsonFile,
} from './helpers'

test('an oversized edit requires explicit consent and cancellation preserves its data and history', async ({ page }) => {
  test.setTimeout(120_000)
  await createSingleSystemWorkspace(page)
  await returnToClusterMap(page)
  const incoming = exportJumpCluster(createHistoryMeasurementWorkspace(32, 120))
  await setJsonFile(jsonMapImportInput(page), 'large-history-workspace.json', JSON.stringify(incoming))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await setHeaderMapActionsOpen(page, false)
  await waitForWorkspaceSaved(page)
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Jump Cluster', { exact: true }).fill('Accepted large baseline')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  const consent = page.getByRole('dialog', { name: 'This change cannot be undone', exact: true })
  await expect(consent).toBeVisible()
  await expect(consent).toContainText('clears all Undo and Redo history')
  await consent.getByRole('button', { name: 'Cancel change', exact: true }).click()
  await expect(consent).toBeHidden()
  await expect(names.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Accepted large baseline')
  await page.keyboard.press('Escape')
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' }).click()
  await names.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect(undo).toBeEnabled()
  await expect(undo).toHaveText('Undo 1')
  await expect(undo).toHaveAttribute('aria-description', '1 action available to undo')

  await details.getByRole('button', { name: 'Edit chart names' }).click()
  await names.getByLabel('Jump Cluster', { exact: true }).fill('Accepted large baseline')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(consent).toBeVisible()
  await consent.getByRole('button', { name: 'Continue and clear history', exact: true }).click()
  await expect(names).toBeHidden()
  await waitForWorkspaceSaved(page)
  await expect(mapContext.getByRole('heading', { name: 'Accepted large baseline', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('This action cannot be undone.')
})
