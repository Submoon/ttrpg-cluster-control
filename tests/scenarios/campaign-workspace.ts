import { expect, type Page } from '@playwright/test'
import campaignBaselineFixture from '../fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  importReviewDialog,
  jsonMapImportInput,
  resolveImportReview,
  returnToClusterMap,
  setJsonFile,
  waitForWorkspaceStartup,
  workspaceZoomControls,
} from '../helpers'

export type CampaignFixture = typeof campaignBaselineFixture

/** Imports the public baseline through the UI and waits for its IndexedDB save to finish. */
export async function importCampaignWorkspace(
  page: Page,
  fixture: CampaignFixture = campaignBaselineFixture,
  viewport?: { width: number; height: number },
): Promise<void> {
  await captureMapExportBlobs(page)
  if (viewport) await page.setViewportSize(viewport)
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await page.getByLabel('First star system').fill('Campaign staging')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await setJsonFile(jsonMapImportInput(page), 'campaign-baseline.json', JSON.stringify(fixture))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Jump Routes: 1')
  await resolveImportReview(preview, 'confirm')
  await returnToClusterMap(page)
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await waitForWorkspaceSaved(page)
}

/** Opens imported IndexedDB state and restores the transient cluster/Fit view for each test. */
export async function openImportedCampaignWorkspace(
  page: Page,
  viewport?: { width: number; height: number },
): Promise<void> {
  await captureMapExportBlobs(page)
  if (viewport) await page.setViewportSize(viewport)
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await returnToClusterMap(page)
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await waitForWorkspaceSaved(page)
}
