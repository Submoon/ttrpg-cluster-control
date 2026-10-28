import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  createSingleSystemWorkspace, importReviewDialog, jsonMapImportInput, openChartDetails, resolveImportReview, setJsonFile,
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

test('Hierarchy still activates when an imported workspace closes the Map files menu under the pointer', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const incoming = exportJumpCluster(createLocalWorkspace('Incoming', 'Incoming system'))
  await setJsonFile(jsonMapImportInput(page), 'hierarchy-after-import.json', JSON.stringify(incoming))
  await resolveImportReview(importReviewDialog(page), 'confirm')

  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  await expect(mapFiles).toHaveAttribute('aria-expanded', 'true')
  const notice = page.locator('.workspace-history-notices')
  await expect(notice).toBeVisible()
  const context = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const hierarchy = context.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchy).toHaveAttribute('aria-expanded', 'false')
  const historyFeedback = page.locator('#workspace-history-feedback')
  await expect(historyFeedback).not.toBeEmpty()

  const bounds = await hierarchy.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) throw new Error('Hierarchy is not positioned for the outside dismissal.')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.up()

  await expect(mapFiles).toHaveAttribute('aria-expanded', 'false')
  await expect(hierarchy).toHaveAttribute('aria-expanded', 'true')
})

test('an Inspector draft reason is visible beside the desktop panel and remains available after compact hide', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart names' }).click()
  const names = page.getByRole('dialog', { name: 'Edit chart names' })
  await names.getByLabel('Star system', { exact: true }).fill('Vesper Prime')
  await names.getByRole('button', { name: 'Apply names', exact: true }).click()
  await expect(names).toBeHidden()

  const context = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const systemMap = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await systemMap.getByRole('button', { name: /^Select .*Primary Star/ }).click()
  const inspectButton = context.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectButton.getAttribute('aria-expanded') !== 'true') await inspectButton.click()
  const inspector = page.getByRole('region', { name: 'Object inspector' })
  await expect(inspector.getByRole('heading', { name: 'Primary Star', exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Star Name')

  const status = page.locator('#workspace-history-feedback')
  const notice = page.locator('.workspace-history-notices')
  const chromeRegion = page.locator('.workspace-map-chrome-region')
  const inspectorPanel = page.locator('.workspace-resizable-panel').filter({ has: inspector })
  await page.setViewportSize({ width: 1000, height: 900 })
  await expect(inspector).toBeVisible()
  await expect(status).toContainText('modified Inspector draft')
  await expect(notice).toContainText('modified Inspector draft')
  await expect(notice).toBeVisible()
  await expect(inspectorPanel).toHaveCount(1)
  const [noticeBounds, panelBounds, chromeLayer, panelLayer] = await Promise.all([
    notice.boundingBox(),
    inspectorPanel.boundingBox(),
    chromeRegion.evaluate(element => Number(getComputedStyle(element).zIndex)),
    inspectorPanel.evaluate(element => Number(getComputedStyle(element).zIndex)),
  ])
  expect(noticeBounds).not.toBeNull()
  expect(panelBounds).not.toBeNull()
  if (!noticeBounds || !panelBounds) throw new Error('The history notice or Inspector is not positioned.')
  expect(noticeBounds.x).toBeGreaterThanOrEqual(0)
  expect(noticeBounds.y).toBeGreaterThanOrEqual(0)
  expect(noticeBounds.x + noticeBounds.width).toBeLessThanOrEqual(1000)
  expect(noticeBounds.y + noticeBounds.height).toBeLessThanOrEqual(900)
  expect(chromeLayer).toBeGreaterThan(panelLayer)

  await page.setViewportSize({ width: 390, height: 844 })
  await inspector.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  await expect(inspector).toBeHidden()
  await expect(status).toContainText('modified Inspector draft')
  await expect(notice).toContainText('modified Inspector draft')
  await expect(notice).toBeVisible()

  await context.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toBeVisible()
  const nameInput = inspector.getByLabel('Name', { exact: true })
  await expect(nameInput).toHaveValue('Unapplied Star Name')
  const compactInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true })
  await expect.poll(() => compactInspector.evaluate(element => element.contains(document.activeElement))).toBe(true)
})
