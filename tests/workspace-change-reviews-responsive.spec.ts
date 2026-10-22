import { expect, test, type Locator, type Page } from '@playwright/test'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  captureMapExportBlobs,
  downloadJson,
  jsonMapImportInput,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

type ReviewViewport = {
  width: number
  height: number
  theme: 'dark' | 'light'
}

const reviewViewports: ReviewViewport[] = [
  { width: 390, height: 500, theme: 'dark' },
  { width: 844, height: 390, theme: 'light' },
]

async function expectReviewActionInViewport(
  review: Locator,
  button: Locator,
  viewport: ReviewViewport,
): Promise<void> {
  await expect(button).toBeVisible()
  await expect(button).toBeInViewport({ ratio: 1 })
  const reviewBounds = await review.boundingBox()
  const buttonBounds = await button.boundingBox()
  if (!reviewBounds || !buttonBounds) throw new Error('A review action has no visible bounds.')
  expect(buttonBounds.x).toBeGreaterThanOrEqual(0)
  expect(buttonBounds.y).toBeGreaterThanOrEqual(0)
  expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(viewport.width)
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(viewport.height)
  expect(buttonBounds.y).toBeGreaterThan(reviewBounds.y + reviewBounds.height / 2)
  expect(await button.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || Boolean(hit && element.contains(hit))
  })).toBe(true)
  await button.click({ trial: true })
}

async function attachViewportScreenshot(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ animations: 'disabled', fullPage: false }),
    contentType: 'image/png',
  })
}

for (const viewport of reviewViewports) {
  test(`deletion and import reviews fit and return focus at ${viewport.width}×${viewport.height} ${viewport.theme}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ colorScheme: viewport.theme })
    await captureMapExportBlobs(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${viewport.theme}\\b`))
    await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
    await page.getByLabel('First star system', { exact: true }).fill('Vesper')
    await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()

    await setWorkspaceMapMode(page, 'Select')
    const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true })
    const primaryStar = systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
    await expect(primaryStar).toBeInViewport()
    await primaryStar.click()
    const inspector = page.locator('#workspace-inspector-panel')
    await expect(inspector).toBeVisible()
    const deleteButton = page.getByRole('button', { name: 'Delete Primary Star', exact: true })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    const deletionReview = page.getByRole('dialog', { name: 'Review deletion', exact: true })
    await expect(deletionReview).toBeVisible()
    await expect(deletionReview).toContainText('Primary Star')
    const confirmDeletion = deletionReview.getByRole('button', { name: 'Confirm deletion', exact: true })
    const cancelDeletion = deletionReview.getByRole('button', { name: 'Cancel deletion', exact: true })
    await expectReviewActionInViewport(deletionReview, confirmDeletion, viewport)
    await expectReviewActionInViewport(deletionReview, cancelDeletion, viewport)
    await confirmDeletion.focus()
    await expect(confirmDeletion).toBeFocused()
    await attachViewportScreenshot(page, `deletion-review-${viewport.width}x${viewport.height}-${viewport.theme}`)

    await page.keyboard.press('Escape')
    await expect(deletionReview).toBeHidden()
    await expect(deleteButton).toBeFocused()
    await expect(deleteButton).toBeVisible()
    await expect(inspector).toContainText('Primary Star')
    await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
    await returnToClusterMap(page)

    const incomingJson = JSON.stringify(exportJumpCluster(createLocalWorkspace('Incoming Reach', 'Incoming Vesper')))
    await setHeaderMapActionsOpen(page, true)
    const importButton = page.getByRole('button', { name: 'Import JSON copy', exact: true })
    await expect(importButton).toBeVisible()
    await importButton.focus()
    await expect(importButton).toBeFocused()
    await setJsonFile(jsonMapImportInput(page), 'incoming-reach.json', incomingJson)

    const importReview = page.getByRole('dialog', { name: 'Review import', exact: true })
    await expect(importReview).toBeVisible()
    await expect(importReview.getByRole('region', { name: 'Import effects', exact: true }))
      .toContainText('Import this Jump Cluster as an independent copy?')
    const importCounts = importReview.getByRole('list', { name: 'Import counts', exact: true })
    await expect(importCounts).toContainText('Star systems: 1')
    await expect(importCounts).toContainText('Map objects: 1')
    await expect(importCounts).toContainText('Orbits: 0')
    await expect(importCounts).toContainText('Jump Routes: 0')
    await expect(importCounts).toContainText('Custom fields: 0')
    await expect(importReview).toContainText('Original-ID collisions (0):')
    await expect(importReview).toContainText('Possible existing matches by name or location key (0):')
    await expect(importReview).toContainText('Map entities remain separate copies and receive new IDs.')
    const confirmImport = importReview.getByRole('button', { name: 'Import independent copy', exact: true })
    const cancelImport = importReview.getByRole('button', { name: 'Cancel import', exact: true })
    await expectReviewActionInViewport(importReview, confirmImport, viewport)
    await expectReviewActionInViewport(importReview, cancelImport, viewport)
    await confirmImport.focus()
    await expect(confirmImport).toBeFocused()
    await attachViewportScreenshot(page, `import-review-${viewport.width}x${viewport.height}-${viewport.theme}`)

    await cancelImport.click()
    await expect(importReview).toBeHidden()
    await expect(importButton).toBeVisible()
    await expect(importButton).toBeFocused()
    await expect(importButton).toBeInViewport({ ratio: 1 })
    await setHeaderMapActionsOpen(page, false)
    const unchanged = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(unchanged.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  })
}
