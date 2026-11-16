import { expect, test, preparedCampaignTest as campaignTest, type Page } from './fixtures'
import { importCampaignWorkspace, openImportedCampaignWorkspace } from './scenarios/campaign-workspace'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  addCatalogueObject,
  clickDockAction,
  downloadJson,
  readInspectorSelection,
  releaseMapExportBlobs,
  returnToClusterMap,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
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
  const originStar = originSystem?.objects.find(object => object.family === 'CelestialBody' && object.subtype === 'star')
  if (!originSystem || !originPoint || !originStar) throw new Error('The campaign fixture needs a Vesper Prime Jump Point and star.')
  originSystem.objects.push({
    ...originPoint,
    id: 'campaign-baseline-alternate-departure',
    locationKey: 'JP-02',
    name: 'Vesper Alternate',
  })
  const anchorSystemId = 'campaign-baseline-anchor-system'
  stagingFixture.cluster.systems.push({
    ...originSystem,
    id: anchorSystemId,
    name: 'Anchor Only',
    objects: [{ ...originStar, id: 'campaign-baseline-anchor-star', locationKey: 'A', name: 'Anchor Star' }],
    orbits: [],
  })
  stagingFixture.layout.systemPositions[anchorSystemId] = { ...stagingFixture.layout.systemPositions[originSystem.id]! }

  await importCampaignWorkspace(page, stagingFixture, { width: 1440, height: 960 })
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(before.cluster?.routes).toHaveLength(1)
  const originPointId = before.cluster?.systems.flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Vesper Alternate')?.id
  expect(originPointId).toBeTruthy()
  const originSystemId = before.cluster?.systems.find(system => system.name === 'Vesper Prime')?.id
  const anchorSystemIdAfterImport = before.cluster?.systems.find(system => system.name === 'Anchor Only')?.id
  expect(originSystemId).toBeTruthy()
  expect(anchorSystemIdAfterImport).toBeTruthy()
  if (!originPointId || !originSystemId || !anchorSystemIdAfterImport) {
    throw new Error('The imported campaign needs its Vesper and Jump-Point-free system endpoints.')
  }
  await clickDockAction(page, 'Add Jump Route')

  const addButton = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const fromSystem = inspector.getByLabel('From system')
  const toSystem = inspector.getByLabel('To system')
  const fromPoint = inspector.getByLabel('From Jump Point')
  await selectInspectorOption(inspector.getByLabel('Route destination'), 'Known system')

  const overlappingAnchorMark = clusterMap.locator(`.cluster-system-node[data-system-id="${anchorSystemIdAfterImport}"]`)
  await expect(overlappingAnchorMark).toBeVisible()
  await overlappingAnchorMark.click()
  await fromSystem.click()
  const originChoice = page.getByRole('option', { name: 'Vesper Prime', exact: true })
  await expect(originChoice).toBeVisible()
  await expect(page.getByRole('option', { name: 'Anchor Only', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Harrow', exact: true })).toHaveCount(0)
  await originChoice.click()
  await expect.poll(() => readInspectorSelection(fromSystem)).toBe('Vesper Prime')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('No local Jump Point')
  await expect(inspector.getByRole('heading', { name: 'Connect Systems', exact: true })).toBeVisible()

  await fromPoint.click()
  const originPointChoice = page.getByRole('option', { name: 'Vesper Alternate (Vesper Prime)', exact: true })
  await expect(originPointChoice).toBeVisible()
  await expect(page.getByRole('option', { name: 'Harrow Arrival (Harrow)', exact: true })).toHaveCount(0)
  await originPointChoice.click()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  await inspector.getByRole('spinbutton', { name: 'Jump level', exact: true }).fill('12')
  await fromPoint.click()
  await expect(page.getByRole('option', { name: 'Harrow Arrival (Harrow)', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(addButton).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  await overlappingAnchorMark.click()
  const toPoint = inspector.getByLabel('To Jump Point')
  await expect.poll(() => readInspectorSelection(toSystem)).toBe('Anchor Only')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('No local Jump Point')

  await toPoint.click()
  await expect(page.getByRole('option', { name: 'Vesper Departure (Vesper Prime)', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const beforeApply = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(beforeApply).toEqual(before)

  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('No local Jump Point')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('No local Jump Point')
  const afterApply = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterApply.cluster?.routes).toHaveLength(2)
  expect(afterApply.cluster?.routes).toContainEqual(expect.objectContaining({
    fromSystemId: originSystemId,
    fromPointId: originPointId,
    toSystemId: anchorSystemIdAfterImport,
    toPointId: null,
  }))

  await waitForWorkspaceSaved(page)
  await page.reload()
  await waitForWorkspaceStartup(page)
  await returnToClusterMap(page)
  const reloaded = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloaded.cluster?.routes).toHaveLength(2)
  expect(reloaded.cluster?.routes).toContainEqual(expect.objectContaining({
    fromSystemId: originSystemId,
    fromPointId: originPointId,
    toSystemId: anchorSystemIdAfterImport,
    toPointId: null,
  }))
})
