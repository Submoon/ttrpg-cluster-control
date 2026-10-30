import { expect, test, campaignTest } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import { waitForWorkspaceSaved, deletionReviewDialog, importReviewDialog, resolveDeletionReview, resolveImportReview } from './helpers'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickDockAction,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  panMap,
  quitSystemAdd,
  readInspectorSelection,
  returnToClusterMap,
  selectInspectorOption,
  setJsonFile,
  setWorkspaceMapMode,
  workspaceZoomControls,
} from './helpers'

type RouteWriteGateWindow = Window & {
  __routeWriteGate?: {
    originalPut: typeof IDBObjectStore.prototype.put
    failed: boolean
  }
}

campaignTest.use({ campaignPreparation: 'prepared-snapshot' })

test('Add Jump Route retains its origin through pan and zoom, then clears both endpoints after applying', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await page.getByLabel('First star system').fill('Campaign staging')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()

  await setJsonFile(
    jsonMapImportInput(page),
    'campaign-baseline.json',
    JSON.stringify(campaignBaselineFixture),
  )
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Jump Routes: 1')
  await resolveImportReview(preview, 'confirm')
  await returnToClusterMap(page)

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map' })
  const initialExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(initialExport.cluster?.routes).toHaveLength(1)

  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const jumpLevel = inspector.getByRole('spinbutton', { name: 'Jump level' })
  const fromPoint = inspector.getByLabel('From Jump Point')
  const destination = inspector.getByLabel('Route destination')
  await expect(fromPoint).toContainText('Choose an origin Jump Point')

  await selectInspectorOption(destination, 'Known Jump Point')
  const toPoint = inspector.getByLabel('To Jump Point')
  await expect(toPoint).toContainText('Choose a different Jump Point')

  await jumpLevel.fill('12')
  await selectInspectorOption(fromPoint, 'Vesper Departure (Vesper Prime)')
  const originPointId = initialExport.cluster?.systems
    .flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Vesper Departure')?.id
  expect(originPointId).toBeTruthy()
  const mapContent = clusterMap.locator('.cluster-map-content')
  const transformBeforeZoom = await mapContent.getAttribute('transform')
  await workspaceZoomControls(page).getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(() => mapContent.getAttribute('transform')).not.toBe(transformBeforeZoom)

  const transformBeforePan = await mapContent.getAttribute('transform')
  await panMap(page, clusterMap, { x: 36, y: 24 })
  await expect.poll(() => mapContent.getAttribute('transform')).not.toBe(transformBeforePan)
  await expect.poll(() => readInspectorSelection(fromPoint)).toContain('Vesper Departure')
  await expect(toPoint).toContainText('Choose a different Jump Point')
  await expect(clusterMap.getByRole('button', { name: /Jump Level/ })).toHaveCount(1)

  await selectInspectorOption(toPoint, 'Harrow Arrival (Harrow)')
  const destinationPointId = initialExport.cluster?.systems
    .flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Harrow Arrival')?.id
  expect(destinationPointId).toBeTruthy()
  await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()

  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('')
  await expect(clusterMap.getByRole('button', { name: /Jump Level 12.*Vesper Departure.*Harrow Arrival/ }))
    .toBeVisible()
  await waitForWorkspaceSaved(page)

  await page.reload()
  await returnToClusterMap(page)
  const savedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(savedExport.cluster?.routes).toHaveLength(2)
  expect(savedExport.cluster?.routes).toContainEqual(expect.objectContaining({
    jumpLevel: 12,
    fromPointId: originPointId,
    toPointId: destinationPointId,
  }))
})

campaignTest('invalid route edits focus the validation summary and Stay preserves the edit context', async ({ campaignWorkspacePage: page }) => {
  await setWorkspaceMapMode(page, 'Select')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const routeMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ })
  await routeMark.click()

  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await inspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const jumpLevel = inspector.getByRole('spinbutton', { name: 'Jump level' })
  const apply = inspector.getByRole('button', { name: 'Apply Jump Route', exact: true })
  await jumpLevel.fill('0')
  await apply.click()

  const validation = inspector.getByRole('alert')
  await expect(validation).toContainText('Jump level must be a positive integer.')
  await expect(validation).toBeFocused()
  const jumpLevelIssue = validation.getByRole('button', { name: /Jump level: Jump level must be a positive integer/ })
  await jumpLevelIssue.click()
  await expect(jumpLevel).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('12')
  await expect(jumpLevel).toHaveValue('12')
  await expect(jumpLevel).toBeFocused()

  await jumpLevel.fill('0')
  await apply.click()
  await expect(validation).toBeFocused()
  await clickDockAction(page, 'Add Jump Route')
  const transition = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(transition.getByText('Continue without this draft?')).toBeVisible()
  await transition.getByRole('button', { name: 'Stay here', exact: true }).click()

  await expect(transition).toBeHidden()
  await expect(clusterMap).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Edit Jump Route' })).toBeVisible()
  await expect(jumpLevel).toHaveValue('0')
  await expect(validation).toContainText('Jump level must be a positive integer.')
})

test('route staging survives view gestures and unrelated deletion, while Quit starts a blank route', async ({ page }) => {
  const stagingFixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as typeof campaignBaselineFixture
  const originSystem = stagingFixture.cluster.systems.find(system => system.name === 'Vesper Prime')
  const destinationSystem = stagingFixture.cluster.systems.find(system => system.name === 'Harrow')
  if (!originSystem || !destinationSystem) throw new Error('The campaign route fixture needs Vesper Prime and Harrow.')
  const originalPoint = originSystem.objects.find(object => object.family === 'JumpPoint')
  if (!originalPoint) throw new Error('The campaign route fixture needs a Vesper Prime Jump Point.')
  originSystem.objects.push({
    ...originalPoint,
    id: 'campaign-baseline-alternate-departure',
    locationKey: 'JP-02',
    name: 'Vesper Alternate',
  })
  stagingFixture.cluster.systems.push({
    ...destinationSystem,
    id: 'campaign-baseline-unrelated-system',
    name: 'Unrelated',
    objects: destinationSystem.objects.map((object, index) => ({
      ...object,
      id: `campaign-baseline-unrelated-object-${index + 1}`,
      name: index === 0 ? 'Primary Star' : 'Unrelated Arrival',
    })),
    orbits: [],
  })
  stagingFixture.layout.systemPositions = {
    ...stagingFixture.layout.systemPositions,
    'campaign-baseline-unrelated-system': { x: 0.92, y: 0.78 },
  } as typeof stagingFixture.layout.systemPositions

  await importCampaignWorkspace(page, stagingFixture, { width: 1440, height: 960 })

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const originalExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(originalExport.cluster?.routes).toHaveLength(1)
  await clickDockAction(page, 'Add Jump Route')

  const inspector = page.locator('#workspace-inspector-panel')
  const fromPoint = inspector.getByLabel('From Jump Point')
  const destination = inspector.getByLabel('Route destination')
  await selectInspectorOption(destination, 'Known Jump Point')
  const originLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Vesper Prime$/ })
  await expect(originLabel).toBeVisible()
  await originLabel.click()
  await selectInspectorOption(fromPoint, 'Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  const scene = clusterMap.locator('.cluster-map-content')
  const rightPanBounds = await clusterMap.boundingBox()
  if (!rightPanBounds) throw new Error('The cluster map has no bounds for Add Jump Route right-pan input.')
  const rightPanBefore = await scene.getAttribute('transform')
  const panStart = { x: rightPanBounds.x + rightPanBounds.width * 0.2, y: rightPanBounds.y + rightPanBounds.height * 0.76 }
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(panStart.x + 52, panStart.y + 28, { steps: 4 })
  await page.mouse.up({ button: 'right' })
  await expect.poll(() => scene.getAttribute('transform')).not.toBe(rightPanBefore)
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')

  const toPoint = inspector.getByLabel('To Jump Point')
  const destinationLabel = clusterMap.locator('.cluster-system-name').filter({ hasText: /^Harrow$/ })
  await expect(destinationLabel).toBeVisible()
  await destinationLabel.click()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')

  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    const bounds = await clusterMap.boundingBox()
    if (!bounds) throw new Error('The cluster map has no bounds for Add Jump Route two-contact input.')
    const first = { id: 1, x: bounds.x + bounds.width * 0.28, y: bounds.y + bounds.height * 0.34 }
    const second = { id: 2, x: bounds.x + bounds.width * 0.7, y: bounds.y + bounds.height * 0.4 }
    const sceneBeforeTouch = await scene.getAttribute('transform')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ ...first, radiusX: 2, radiusY: 2, force: 1 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...first, radiusX: 2, radiusY: 2, force: 1 },
        { ...second, radiusX: 2, radiusY: 2, force: 1 },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { ...first, x: first.x - 14, y: first.y + 15, radiusX: 2, radiusY: 2, force: 1 },
        { ...second, x: second.x + 22, y: second.y + 18, radiusX: 2, radiusY: 2, force: 1 },
      ],
    })
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(sceneBeforeTouch)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await cdp.detach()
  }
  await expect(inspector).toBeVisible()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')

  await page.setViewportSize({ width: 390, height: 500 })
  await expect(inspector).toBeVisible()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
  await page.setViewportSize({ width: 1440, height: 960 })
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: 'Delete Unrelated system', exact: true }).click()
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Unrelated star system')
  await resolveDeletionReview(deletionReview, 'confirm')
  await expect(clusterMap.getByRole('button', { name: /Unrelated system/ })).toHaveCount(0)
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') === 'true') await hierarchyToggle.click()
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  await expect(inspector).toBeVisible()
  await expect.poll(() => readInspectorSelection(fromPoint)).toBe('Vesper Alternate (Vesper Prime)')
  await expect.poll(() => readInspectorSelection(toPoint)).toBe('Harrow Arrival (Harrow)')
  const afterUnrelatedDeletion = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterUnrelatedDeletion.cluster?.routes).toEqual(originalExport.cluster?.routes)
  const originalSystems = originalExport.cluster?.systems ?? []
  const survivingSystems = afterUnrelatedDeletion.cluster?.systems ?? []
  expect(originalSystems.filter(system => system.name === 'Unrelated')).toHaveLength(1)
  expect(survivingSystems).toHaveLength(originalSystems.length - 1)
  expect(survivingSystems.map(({ id, name }) => ({ id, name }))).toEqual(
    originalSystems.filter(system => system.name !== 'Unrelated').map(({ id, name }) => ({ id, name })),
  )

  await quitSystemAdd(page)
  await clickDockAction(page, 'Add Jump Route')
  const freshInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  await expect(freshInspector).toBeVisible()
  await expect.poll(() => readInspectorSelection(freshInspector.getByLabel('From Jump Point'))).toBe('')
  await expect.poll(() => readInspectorSelection(freshInspector.getByLabel('To Jump Point'))).toBe('')
  const afterQuit = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterQuit.cluster?.routes).toEqual(originalExport.cluster?.routes)
})

campaignTest('a failed route save keeps the applied route and Retry persists it once', async ({ campaignWorkspacePage: page }) => {
  const initialExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const originPointId = initialExport.cluster?.systems
    .flatMap(system => system.objects)
    .find(point => point.family === 'JumpPoint' && point.name === 'Vesper Departure')?.id
  expect(originPointId).toBeTruthy()
  if (!originPointId) throw new Error('The route save fixture needs the Vesper Departure Jump Point.')

  await clickDockAction(page, 'Add Jump Route')
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const fromPoint = inspector.getByLabel('From Jump Point')
  await selectInspectorOption(fromPoint, 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(inspector.getByLabel('Route destination'), 'Unresolved external exit')
  await inspector.getByLabel('Unknown destination label').fill('The Quiet Expanse')
  await inspector.getByRole('spinbutton', { name: 'Jump level' }).fill('12')

  await page.evaluate(() => {
    const trackedWindow = window as RouteWriteGateWindow
    const storePrototype = IDBObjectStore.prototype
    const originalPut = storePrototype.put
    const gate = { originalPut, failed: false }
    trackedWindow.__routeWriteGate = gate
    Object.defineProperty(storePrototype, 'put', {
      configurable: true,
      writable: true,
      value: function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        const request = originalPut.call(this, value, key)
        if (!gate.failed && this.transaction.db.name === 'ttrpg-cluster-control'
          && this.name === 'workspace' && key === 'current' && this.transaction.mode === 'readwrite') {
          gate.failed = true
          this.transaction.abort()
        }
        return request
      },
    })
  })

  try {
    await inspector.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
    const saveStatus = activeWorkspaceFeedback(page).locator('.save-feedback')
    await expect(saveStatus).toHaveText('Not saved.')
    const fromAfterFailure = inspector.getByLabel('From Jump Point')
    const toAfterFailure = inspector.getByLabel('To Jump Point')
    await expect.poll(() => readInspectorSelection(fromAfterFailure)).toBe('')
    await expect.poll(() => readInspectorSelection(toAfterFailure)).toBe('')
    const failedWriteExport = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(failedWriteExport.cluster?.routes).toHaveLength(2)
    expect(failedWriteExport.cluster?.routes?.filter(route => route.jumpLevel === 12
      && route.fromPointId === originPointId && route.toPointId === null
      && route.unresolvedExit === 'The Quiet Expanse')).toHaveLength(1)

    await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
    await waitForWorkspaceSaved(page)
    const retriedExport = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(retriedExport.cluster?.routes).toHaveLength(2)
    expect(retriedExport.cluster?.routes?.filter(route => route.jumpLevel === 12
      && route.fromPointId === originPointId && route.toPointId === null
      && route.unresolvedExit === 'The Quiet Expanse')).toHaveLength(1)
  } finally {
    await page.evaluate(() => {
      const trackedWindow = window as RouteWriteGateWindow
      const gate = trackedWindow.__routeWriteGate
      if (!gate) return
      IDBObjectStore.prototype.put = gate.originalPut
      delete trackedWindow.__routeWriteGate
    })
  }

  await page.reload()
  await returnToClusterMap(page)
  const reloadedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloadedExport.cluster?.routes).toHaveLength(2)
  expect(reloadedExport.cluster?.routes?.filter(route => route.jumpLevel === 12
    && route.fromPointId === originPointId && route.toPointId === null
    && route.unresolvedExit === 'The Quiet Expanse')).toHaveLength(1)
})
