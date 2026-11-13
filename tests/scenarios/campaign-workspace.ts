import { expect, type Page } from '@playwright/test'
import campaignBaselineFixture from '../fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  jumpClusterRestoreReviewDialog,
  openJumpClusterRestorePicker,
  resolveJumpClusterRestoreReview,
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
  await page.getByLabel('Jump Cluster').fill('Campaign staging')
  await page.getByLabel('First star system').fill('Campaign staging')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await setJsonFile(
    await openJumpClusterRestorePicker(page),
    'campaign-baseline.json',
    JSON.stringify(fixture),
  )
  const preview = jumpClusterRestoreReviewDialog(page)
  await expect(preview).toContainText('Campaign staging')
  await expect(preview).toContainText(fixture.cluster.name)
  await resolveJumpClusterRestoreReview(preview, 'confirm')
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
