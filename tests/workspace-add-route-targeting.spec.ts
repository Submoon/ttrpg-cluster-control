import { expect, test } from '@playwright/test'
import { importReviewDialog, resolveImportReview } from './helpers'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickDockAction,
  downloadJson,
  jsonMapImportInput,
  readInspectorSelection,
  returnToClusterMap,
  selectInspectorOption,
  setJsonFile,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

async function importCampaignWorkspace(
  page: import('@playwright/test').Page,
  fixture = campaignBaselineFixture,
): Promise<void> {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
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
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
}

test('Add Jump Route deselects ordinary map modes and switching mode exits Add', async ({ page }) => {
  await importCampaignWorkspace(page)
  const modeGroup = workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode', exact: true })
  await modeGroup.getByRole('button', { name: 'Move', exact: true }).click()

  await clickDockAction(page, 'Add Jump Route')
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const addButton = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  await expect(mapContext.getByRole('status')).toContainText(/ADD Jump Route/)
  await expect(addButton).toHaveAttribute('aria-pressed', 'true')
  for (const mode of ['Navigate', 'Select', 'Move']) {
    await expect(modeGroup.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'false')
  }

  await modeGroup.getByRole('button', { name: 'Select', exact: true }).click()
  await expect(modeGroup.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(addButton).toHaveAttribute('aria-pressed', 'false')
  await expect(mapContext.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toHaveCount(0)
  await expect(mapContext.getByRole('status').filter({ hasText: /ADD Jump Route/ })).toHaveCount(0)
})

test('Add Jump Route uses scoped From and To controls for map-picked systems without mutating before Apply', async ({ page }) => {
  const stagingFixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as typeof campaignBaselineFixture
  const originSystem = stagingFixture.cluster.systems.find(system => system.name === 'Vesper Prime')
  const originPoint = originSystem?.objects.find(object => object.family === 'JumpPoint')
  if (!originSystem || !originPoint) throw new Error('The campaign fixture needs a Vesper Prime Jump Point.')
  originSystem.objects.push({
    ...originPoint,
    id: 'campaign-baseline-alternate-departure',
    locationKey: 'JP-02',
    name: 'Vesper Alternate',
  })

  await importCampaignWorkspace(page, stagingFixture)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(before.cluster?.routes).toHaveLength(1)
  const originPointId = before.cluster?.systems.flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Vesper Alternate')?.id
  const destinationPointId = before.cluster?.systems.flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Harrow Arrival')?.id
  expect(originPointId).toBeTruthy()
  expect(destinationPointId).toBeTruthy()
  if (!originPointId || !destinationPointId) throw new Error('The imported campaign needs both expected Jump Points.')
  await clickDockAction(page, 'Add Jump Route')

  const addButton = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const fromPoint = inspector.getByLabel('From Jump Point')
  await selectInspectorOption(inspector.getByLabel('Route destination'), 'Known Jump Point')

  const originLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Vesper Prime$/ })
  await expect(originLabel).toBeVisible()
  await originLabel.click()
  await expect(inspector.getByLabel('Jump Points in the chosen system')).toHaveCount(0)
  await expect(inspector.getByText('This system has multiple logical Jump Points. Choose the intended endpoint by name.', { exact: true }))
    .toHaveCount(0)

  await fromPoint.click()
  const originChoice = page.getByRole('option', { name: 'Vesper Alternate (Vesper Prime)', exact: true })
  await expect(originChoice).toBeVisible()
  await expect(page.getByRole('option', { name: 'Harrow Arrival (Harrow)', exact: true })).toHaveCount(0)
  await originChoice.click()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  await inspector.getByRole('spinbutton', { name: 'Jump level', exact: true }).fill('12')
  await fromPoint.click()
  await expect(page.getByRole('option', { name: 'Harrow Arrival (Harrow)', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(addButton).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  const destinationLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Harrow$/ })
  await expect(destinationLabel).toBeVisible()
  await destinationLabel.click()
  const toPoint = inspector.getByLabel('To Jump Point')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
  await expect(inspector.getByLabel('Jump Points in the chosen system')).toHaveCount(0)

  await toPoint.click()
  await expect(page.getByRole('option', { name: 'Vesper Departure (Vesper Prime)', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const beforeApply = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeApply).toEqual(before)

  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('')
  const afterApply = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterApply.cluster?.routes).toHaveLength(2)
  expect(afterApply.cluster?.routes).toContainEqual(expect.objectContaining({
    fromPointId: originPointId,
    toPointId: destinationPointId,
  }))
})

test('Resetting either route endpoint returns that choice to map targeting and preserves the other endpoint', async ({ page }) => {
  const stagingFixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as typeof campaignBaselineFixture
  const originSystem = stagingFixture.cluster.systems.find(system => system.name === 'Vesper Prime')
  const originPoint = originSystem?.objects.find(object => object.family === 'JumpPoint')
  if (!originSystem || !originPoint) throw new Error('The campaign fixture needs a Vesper Prime Jump Point.')
  originSystem.objects.push({
    ...originPoint,
    id: 'campaign-baseline-alternate-departure',
    locationKey: 'JP-02',
    name: 'Vesper Alternate',
  })

  await importCampaignWorkspace(page, stagingFixture)
  await clickDockAction(page, 'Add Jump Route')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const fromPoint = inspector.getByLabel('From Jump Point')
  const toPoint = inspector.getByLabel('To Jump Point')
  const originLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Vesper Prime$/ })
  const destinationLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Harrow$/ })

  await originLabel.click()
  await selectInspectorOption(fromPoint, 'Vesper Alternate (Vesper Prime)')
  await selectInspectorOption(fromPoint, 'Choose on map…')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('')
  await originLabel.click()
  await selectInspectorOption(fromPoint, 'Vesper Departure (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Departure (Vesper Prime)')

  await destinationLabel.click()
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
  await selectInspectorOption(toPoint, 'Choose on map…')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Departure (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('')
  await destinationLabel.click()
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
})
