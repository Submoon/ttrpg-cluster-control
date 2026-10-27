import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  createSingleSystemWorkspace, importReviewDialog, jsonMapImportInput, resolveImportReview, setJsonFile,
} from './helpers'

test('Back after an import activates once while the Map files menu closes', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const incoming = exportJumpCluster(createLocalWorkspace('Incoming', 'Incoming system'))
  await setJsonFile(jsonMapImportInput(page), 'navigation-copy.json', JSON.stringify(incoming))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  const back = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  await expect(back).toBeVisible()
  await expect(page.getByRole('button', { name: 'Map files', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await back.click()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .locator('.workspace-map-context > span')).toHaveText('Jump Cluster')
})
