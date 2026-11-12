import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  activeWorkspaceFeedback, importReviewDialog, jsonMapImportInput, openChartDetailsEditor, resolveImportReview,
  returnToClusterMap, setHeaderMapActionsOpen, setJsonFile, waitForWorkspaceSaved, waitForWorkspaceStartup,
} from './helpers'

test('an oversized edit requires explicit consent and cancellation preserves its data and history', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const incoming = createLocalWorkspace('Measured Reach', 'Measured System')
  const primary = incoming.cluster.systems[0]?.objects[0]
  if (!primary) throw new Error('The oversized history fixture requires a primary star.')
  // Import fits the real 32 MiB budget. Retaining both sides of a later edit does not.
  const mebibyte = 1024 * 1024
  primary.description = 'x'.repeat(17 * mebibyte)
  const portableMap = JSON.stringify(exportJumpCluster(incoming))
  const portableBytes = Buffer.byteLength(portableMap)
  expect(portableBytes).toBeGreaterThan(16 * mebibyte)
  expect(portableBytes).toBeLessThan(32 * mebibyte)
  await setJsonFile(jsonMapImportInput(page), 'large-history-workspace.json', portableMap)
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await setHeaderMapActionsOpen(page, false)
  await waitForWorkspaceSaved(page)
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  const names = await openChartDetailsEditor(page)
  await names.getByLabel('Jump Cluster', { exact: true }).fill('Accepted large baseline')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
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
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart details draft' }).click()
  await names.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect(undo).toBeEnabled()
  await expect(undo).toHaveText('Undo 1')
  await expect(undo).toHaveAttribute('aria-description', '1 action available to undo')

  await openChartDetailsEditor(page)
  await names.getByLabel('Jump Cluster', { exact: true }).fill('Accepted large baseline')
  await names.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(consent).toBeVisible()
  await consent.getByRole('button', { name: 'Continue and clear history', exact: true }).click()
  await expect(names).toBeHidden()
  await waitForWorkspaceSaved(page)
  await expect(mapContext.getByRole('heading', { name: 'Accepted large baseline', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Edit history' })).toContainText('This action cannot be undone.')
})
