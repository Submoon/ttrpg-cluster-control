import { expect, test, preparedCampaignTest as campaignTest, type Page } from './fixtures'
import { importCampaignWorkspace, openImportedCampaignWorkspace } from './scenarios/campaign-workspace'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  addCatalogueObject,
  clickDockAction,
  downloadJson,
  readInspectorSelection,
  releaseMapExportBlobs,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  workspaceNavigation,
} from './helpers'

campaignTest.use({
  campaignViewport: { width: 1440, height: 960 },
})


campaignTest('prepared campaign snapshots stay isolated between fresh browser contexts', async ({
  campaignWorkspacePage: page,
  browser,
  campaignSnapshotProvider,
}) => {
  const baseline = await campaignSnapshotProvider()
  const systemName = 'Vesper Prime'
  await setWorkspaceMapMode(page, 'Navigate')
  const firstMap = page.getByRole('group', { name: /Jump Cluster map$/ })
  await firstMap.getByRole('button', { name: `Open ${systemName} system map`, exact: true }).click()
  const originalWorkspace = await downloadJson(page, 'Export star system JSON')
  const originalSystem = originalWorkspace.system
  if (!originalSystem) throw new Error('The prepared campaign must export its active star system.')
  expect(originalSystem.objects.length).toBeGreaterThan(0)

  const isolatedObjectId = await addCatalogueObject(page, 'other', {
    target: { kind: 'free', x: 0.2, y: 0.2 },
    typeLabel: 'Ticket 05 context sentinel',
    noSelection: true,
  })
  const firstSystemMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  await expect(firstSystemMap.locator(`.system-object[data-object-id="${isolatedObjectId}"]`)).toHaveCount(1)
  await waitForWorkspaceSaved(page)

  const secondContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    storageState: structuredClone(baseline),
  })
  let secondPage: Page | undefined
  try {
    secondPage = await secondContext.newPage()
    await openImportedCampaignWorkspace(secondPage, { width: 1440, height: 960 })
    await setWorkspaceMapMode(secondPage, 'Navigate')

    const secondMap = secondPage.getByRole('group', { name: /Jump Cluster map$/ })
    await secondMap.getByRole('button', { name: `Open ${systemName} system map`, exact: true }).click()
    const isolatedWorkspace = await downloadJson(secondPage, 'Export star system JSON')
    expect(isolatedWorkspace.system).toEqual(originalSystem)
  } finally {
    try {
      if (secondPage) await releaseMapExportBlobs(secondPage)
    } finally {
      await secondContext.close()
    }
  }
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

  await importCampaignWorkspace(page, stagingFixture, { width: 1440, height: 960 })
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
