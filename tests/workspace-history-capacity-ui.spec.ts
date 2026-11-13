import { expect, test } from './fixtures'
import { createLocalWorkspace, exportStarSystem } from '../domain/workspace'
import {
  activeWorkspaceFeedback,
  hideWorkspaceInspector,
  openChartDetailsEditor,
  resolveImportReview,
  returnToClusterMap,
  reviewStarSystemImport,
  setHeaderMapActionsOpen,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
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
  const incomingSystem = incoming.cluster.systems[0]
  if (!incomingSystem) throw new Error('The oversized history fixture has no star system.')
  const portableMap = JSON.stringify(exportStarSystem(incoming, incomingSystem.id))
  const portableBytes = Buffer.byteLength(portableMap)
  expect(portableBytes).toBeGreaterThan(16 * mebibyte)
  expect(portableBytes).toBeLessThan(32 * mebibyte)
  const review = await reviewStarSystemImport(page, 'large-history-workspace.json', portableMap)
  await resolveImportReview(review, 'confirm')
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
  await hideWorkspaceInspector(page)
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(mapContext.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
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
