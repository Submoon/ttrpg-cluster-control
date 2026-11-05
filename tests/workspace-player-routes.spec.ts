import { expect, test } from './fixtures'
import {
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  moveUnresolvedExitTarget,
  updateSystemObject,
  type StarSystem,
} from '../domain/workspace'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  importReviewDialog,
  jsonMapImportInput,
  openChartDetails,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

test('a shared route to a Hidden system previews a generic destination at its exact position', async ({ page }, testInfo) => {
  await importCampaignWorkspace(page)

  const source = await downloadJson(page, 'Export Jump Cluster JSON')
  const cluster = source.cluster
  if (!cluster) throw new Error('The campaign import must contain its source Jump Cluster.')
  const originSystem = cluster.systems.find(system => system.name === 'Vesper Prime')
  const hiddenSystem = cluster.systems.find(system => system.name === 'Harrow')
  if (!originSystem || !hiddenSystem) throw new Error('The campaign import must contain both route systems.')
  const originPoint = originSystem.objects.find(object => object.name === 'Vesper Departure')
  const hiddenPoint = hiddenSystem.objects.find(object => object.name === 'Harrow Arrival')
  if (!originPoint || !hiddenPoint) throw new Error('The campaign import must contain both logical Jump Points.')
  const sourceRoute = cluster.routes.find(route =>
    route.fromPointId === originPoint.id && route.toPointId === hiddenPoint.id,
  )
  if (!sourceRoute) throw new Error('The campaign import must contain its Vesper-to-Harrow Jump Route.')
  const systemPositions = source.layout.systemPositions
  if (!systemPositions) throw new Error('The imported Cluster must have saved system positions.')
  const hiddenPosition = clusterSystemPosition(systemPositions, hiddenSystem.id)

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  const systemDetails = await openChartDetails(page)
  await systemDetails.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const beforeSharing = await downloadJson(page, 'Export Jump Cluster JSON')
  const beforeSharingRoute = beforeSharing.cluster?.routes.find(route => route.id === sourceRoute.id)
  if (!beforeSharingRoute) throw new Error('The source Jump Route must remain after publishing its system.')
  expect(beforeSharingRoute.playerShared).toBe(false)

  await setWorkspaceMapMode(page, 'Select')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  await clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ }).click()
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await routeInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()

  const shareRoute = routeInspector.getByRole('checkbox', { name: /^Share with players$/i })
  await expect(shareRoute).toBeVisible({ timeout: 5_000 })
  await shareRoute.check()
  await routeInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const appliedSharing = await downloadJson(page, 'Export Jump Cluster JSON')
  const appliedSharingRoute = appliedSharing.cluster?.routes.find(route => route.id === sourceRoute.id)
  expect(appliedSharingRoute).toEqual({ ...beforeSharingRoute, playerShared: true })
  expect(appliedSharing.layout).toEqual(beforeSharing.layout)

  const history = page.getByRole('group', { name: 'Edit history' })
  const undoSharing = history.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undoSharing).toBeEnabled()
  await undoSharing.click()
  await waitForWorkspaceSaved(page)
  const undoneSharing = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(undoneSharing.cluster?.routes.find(route => route.id === sourceRoute.id)).toEqual(beforeSharingRoute)
  expect(undoneSharing.layout).toEqual(beforeSharing.layout)

  const redoSharing = history.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(redoSharing).toBeEnabled()
  await redoSharing.click()
  await waitForWorkspaceSaved(page)
  const redoneSharing = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(redoneSharing.cluster?.routes.find(route => route.id === sourceRoute.id))
    .toEqual({ ...beforeSharingRoute, playerShared: true })
  expect(redoneSharing.layout).toEqual(beforeSharing.layout)

  await page.reload()
  await returnToClusterMap(page)
  const reloadedSharing = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloadedSharing.cluster?.routes.find(route => route.id === sourceRoute.id))
    .toEqual({ ...beforeSharingRoute, playerShared: true })
  expect(reloadedSharing.layout).toEqual(beforeSharing.layout)

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Preview player view', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  const playerMap = preview.locator('svg.player-cluster-map-scene')
  await expect(playerMap).toBeVisible()
  await expect(playerMap).toContainText('Jump Level 1')
  await expect(playerMap).toContainText('Unknown destination')

  const publicRoute = playerMap.getByRole('group', { name: /Jump Level 1.*Unknown destination/ })
  const unknownDestination = publicRoute.locator('circle').last()
  await expect(unknownDestination).toBeVisible()
  expect(Number(await unknownDestination.getAttribute('cx'))).toBe(hiddenPosition.x)
  expect(Number(await unknownDestination.getAttribute('cy'))).toBe(hiddenPosition.y)

  const routeLabelBounds = await publicRoute.locator('.player-cluster-route-level rect').boundingBox()
  const revealedSystemLabelBounds = await playerMap.locator('.player-cluster-map-marker--revealed .cluster-system-name').boundingBox()
  if (!routeLabelBounds || !revealedSystemLabelBounds) {
    throw new Error('The public route badge and revealed system label must have rendered bounds.')
  }
  const labelGap = 4
  const hasReadableGap = routeLabelBounds.x + routeLabelBounds.width + labelGap <= revealedSystemLabelBounds.x
    || revealedSystemLabelBounds.x + revealedSystemLabelBounds.width + labelGap <= routeLabelBounds.x
    || routeLabelBounds.y + routeLabelBounds.height + labelGap <= revealedSystemLabelBounds.y
    || revealedSystemLabelBounds.y + revealedSystemLabelBounds.height + labelGap <= routeLabelBounds.y
  expect(hasReadableGap).toBe(true)

  const previewMarkup = await preview.evaluate(element => element.outerHTML)
  const previewAccessibility = await preview.ariaSnapshot()
  for (const privateId of [hiddenSystem.id, originPoint.id, hiddenPoint.id, sourceRoute.id]) {
    expect(previewMarkup).not.toContain(privateId)
    expect(previewAccessibility).not.toContain(privateId)
  }
  for (const privateName of ['Harrow', 'Vesper Departure', 'Harrow Arrival']) {
    expect(previewMarkup).not.toContain(privateName)
    expect(previewAccessibility).not.toContain(privateName)
  }

  await playerMap.scrollIntoViewIfNeeded()
  await expect(playerMap).toBeInViewport()
  const desktopScreenshot = testInfo.outputPath('ticket04-route-preview-desktop.png')
  await page.screenshot({ path: desktopScreenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('ticket04-route-preview-desktop', {
    path: desktopScreenshot,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await playerMap.scrollIntoViewIfNeeded()
  await expect(playerMap).toBeInViewport()
  const compactScreenshot = testInfo.outputPath('ticket04-route-preview-compact.png')
  await page.screenshot({ path: compactScreenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('ticket04-route-preview-compact', {
    path: compactScreenshot,
    contentType: 'image/png',
  })

  const closePreview = preview.getByRole('button', { name: 'Close player preview', exact: true })
  await expect(closePreview).toBeInViewport()
  await closePreview.click()
  await expect(preview).toBeHidden()
})

test('far player routes stay inspectable with local camera controls without changing the source workspace', async ({ page }, testInfo) => {
  const workspace = createLocalWorkspace('Far Exit Source Reach', 'Far Exit Origin')
  const initialSystem = workspace.cluster.systems[0]
  if (!initialSystem) throw new Error('The far-route import needs its Revealed system.')
  const sourcePoint = {
    ...createSystemObject(initialSystem, 'jump-point'),
    publication: 'hidden' as const,
    name: 'Private far-route Jump Point',
  }
  const revealedSystem = {
    ...initialSystem,
    publication: 'revealed' as const,
    objects: [...initialSystem.objects, sourcePoint],
  }
  const cluster = { ...workspace.cluster, systems: [revealedSystem] }
  const route = createJumpRoute(cluster, 2, sourcePoint.id, null, 'Private external exit name', true)
  const sourceWithRoute = {
    ...workspace,
    cluster: { ...cluster, routes: [route] },
    layout: {
      ...workspace.layout,
      systemPositions: { ...workspace.layout.systemPositions, [revealedSystem.id]: { x: 0.68, y: 0.55 } },
    },
  }
  const sourceWithFarExit = moveUnresolvedExitTarget(
    sourceWithRoute,
    route.id,
    { x: 12_000, y: 9_000 },
  )
  const sourceJson = JSON.stringify(exportJumpCluster(sourceWithFarExit))

  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, {
    clusterName: 'Far Route Camera Consumer',
    systemName: 'Camera Staging',
    viewport: { width: 1280, height: 900 },
  })
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'far-shared-route-v4.json', sourceJson)
  const importReview = importReviewDialog(page)
  await expect(importReview).toContainText('Jump Routes: 1')
  await resolveImportReview(importReview, 'confirm')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const sourceCluster = before.cluster
  if (!sourceCluster) throw new Error('The imported source must remain in the current Jump Cluster backup.')
  const importedSystem = sourceCluster.systems.find(system => system.name === 'Far Exit Origin')
  if (!importedSystem) throw new Error('The imported source system must retain its Revealed name.')
  const importedPoint = importedSystem.objects.find(object => object.name === 'Private far-route Jump Point')
  if (!importedPoint) throw new Error('The full source backup must retain its Hidden logical Jump Point.')
  const importedRoute = sourceCluster.routes.find(candidate => candidate.fromPointId === importedPoint.id)
  if (!importedRoute || importedRoute.toPointId !== null) {
    throw new Error('The imported source must retain its shared unresolved Jump Route.')
  }
  expect(importedSystem.publication).toBe('revealed')
  expect(importedPoint.publication).toBe('hidden')
  expect(importedRoute.playerShared).toBe(true)
  expect(before.objectFieldSettings.nativePlayerSharing).toEqual({ atmosphere: false, portClass: false })
  const sourceExitPosition = before.layout.unresolvedExitPositions?.[importedRoute.id]
  expect(sourceExitPosition).toEqual({ x: 12_000, y: 9_000 })
  if (!sourceExitPosition) throw new Error('The imported route must keep its saved far endpoint position.')

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Preview player view', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  const fitButton = preview.getByRole('button', { name: 'Fit player map', exact: true })
  await expect(fitButton).toBeVisible({ timeout: 5_000 })

  const navigation = preview.getByRole('group', { name: 'Player cluster map navigation', exact: true })
  const playerMap = preview.locator('svg.player-cluster-map-scene')
  await expect(playerMap).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
  const zoomIn = navigation.getByRole('button', { name: 'Zoom in', exact: true })
  const zoomOut = navigation.getByRole('button', { name: 'Zoom out', exact: true })
  const panLeft = navigation.getByRole('button', { name: 'Pan left', exact: true })
  const panRight = navigation.getByRole('button', { name: 'Pan right', exact: true })
  const panUp = navigation.getByRole('button', { name: 'Pan up', exact: true })
  const panDown = navigation.getByRole('button', { name: 'Pan down', exact: true })
  const unknownDestination = playerMap.locator('.player-cluster-route-unknown-destination')
  const unknownDestinationLabel = playerMap.locator('.player-cluster-route-unknown-label')
  await expect(unknownDestination).toHaveCount(1)
  await expect(unknownDestinationLabel).toHaveText('Unknown destination')
  const endpointCoordinates = {
    x: await unknownDestination.getAttribute('cx'),
    y: await unknownDestination.getAttribute('cy'),
  }
  expect(Number(endpointCoordinates.x)).toBe(sourceExitPosition.x)
  expect(Number(endpointCoordinates.y)).toBe(sourceExitPosition.y)

  async function assertDestinationLabelReadable(): Promise<void> {
    for (let step = 0; step < 64; step += 1) {
      const bounds = await unknownDestinationLabel.boundingBox()
      if (bounds && bounds.height >= 12) break
      if (!bounds) break
      const viewBoxBeforeZoom = await playerMap.getAttribute('viewBox')
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.mouse.wheel(0, -120)
      if (await playerMap.getAttribute('viewBox') === viewBoxBeforeZoom) break
    }

    const labelBounds = await unknownDestinationLabel.boundingBox()
    expect(labelBounds?.height ?? 0).toBeGreaterThanOrEqual(12)

    for (let step = 0; step < 32; step += 1) {
      const label = await unknownDestinationLabel.boundingBox()
      const mapBounds = await playerMap.boundingBox()
      if (!label || !mapBounds) break
      const fullyVisible = label.x >= mapBounds.x && label.y >= mapBounds.y
        && label.x + label.width <= mapBounds.x + mapBounds.width
        && label.y + label.height <= mapBounds.y + mapBounds.height
      if (fullyVisible) return

      if (label.x < mapBounds.x && await panLeft.isEnabled()) await panLeft.click()
      else if (label.x + label.width > mapBounds.x + mapBounds.width && await panRight.isEnabled()) await panRight.click()
      if (label.y < mapBounds.y && await panUp.isEnabled()) await panUp.click()
      else if (label.y + label.height > mapBounds.y + mapBounds.height && await panDown.isEnabled()) await panDown.click()
    }

    const finalLabel = await unknownDestinationLabel.boundingBox()
    const finalMap = await playerMap.boundingBox()
    expect(finalLabel && finalMap
      && finalLabel.x >= finalMap.x && finalLabel.y >= finalMap.y
      && finalLabel.x + finalLabel.width <= finalMap.x + finalMap.width
      && finalLabel.y + finalLabel.height <= finalMap.y + finalMap.height).toBe(true)
  }

  await fitButton.click()
  const desktopFitViewBox = await playerMap.getAttribute('viewBox')
  if (!desktopFitViewBox) throw new Error('The player Cluster map must expose its fitted viewBox.')
  await expect(zoomOut).toBeDisabled()
  await zoomIn.click()
  await expect(zoomOut).toBeEnabled()
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(desktopFitViewBox)
  await fitButton.click()
  await expect(playerMap).toHaveAttribute('viewBox', desktopFitViewBox)

  const desktopLabelAtFit = await unknownDestinationLabel.boundingBox()
  if (!desktopLabelAtFit) throw new Error('The unknown destination label must have a rendered location.')
  await page.mouse.move(desktopLabelAtFit.x + desktopLabelAtFit.width / 2, desktopLabelAtFit.y + desktopLabelAtFit.height / 2)
  const desktopWheelViewBox = await playerMap.getAttribute('viewBox')
  await page.mouse.wheel(0, -120)
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(desktopWheelViewBox)
  await assertDestinationLabelReadable()
  const desktopFarRouteScreenshot = testInfo.outputPath('ticket04-far-route-preview-desktop.png')
  await page.screenshot({ path: desktopFarRouteScreenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('ticket04-far-route-preview-desktop', {
    path: desktopFarRouteScreenshot,
    contentType: 'image/png',
  })

  await fitButton.click()
  await zoomIn.click()
  const panControlViewBox = await playerMap.getAttribute('viewBox')
  await panRight.click()
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(panControlViewBox)

  const mapBounds = await playerMap.boundingBox()
  if (!mapBounds) throw new Error('The player Cluster map must have a pointer surface.')
  const gestureStart = { x: mapBounds.x + mapBounds.width * 0.12, y: mapBounds.y + mapBounds.height * 0.82 }
  const pointerViewBox = await playerMap.getAttribute('viewBox')
  await page.mouse.move(gestureStart.x, gestureStart.y)
  await page.mouse.down()
  await page.mouse.move(gestureStart.x + 38, gestureStart.y + 26, { steps: 3 })
  await page.mouse.up()
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(pointerViewBox)

  const cancelStartViewBox = await playerMap.getAttribute('viewBox')
  await page.mouse.move(gestureStart.x, gestureStart.y)
  await page.mouse.down()
  await page.mouse.move(gestureStart.x + 30, gestureStart.y + 20, { steps: 3 })
  await playerMap.dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 0,
    isPrimary: true,
  })
  await page.mouse.up()
  await expect(playerMap).toHaveAttribute('viewBox', cancelStartViewBox ?? '')

  const keyboardStartViewBox = await playerMap.getAttribute('viewBox')
  await playerMap.focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(keyboardStartViewBox)
  expect(await unknownDestination.getAttribute('cx')).toBe(endpointCoordinates.x)
  expect(await unknownDestination.getAttribute('cy')).toBe(endpointCoordinates.y)

  await fitButton.click()
  await expect(playerMap).toHaveAttribute('viewBox', desktopFitViewBox)

  await page.setViewportSize({ width: 390, height: 844 })
  await fitButton.click()
  const compactFitViewBox = await playerMap.getAttribute('viewBox')
  if (!compactFitViewBox) throw new Error('The compact player map must expose its fitted viewBox.')
  await assertDestinationLabelReadable()
  const compactFarRouteScreenshot = testInfo.outputPath('ticket04-far-route-preview-compact.png')
  await page.screenshot({ path: compactFarRouteScreenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('ticket04-far-route-preview-compact', {
    path: compactFarRouteScreenshot,
    contentType: 'image/png',
  })
  expect(await unknownDestination.getAttribute('cx')).toBe(endpointCoordinates.x)
  expect(await unknownDestination.getAttribute('cy')).toBe(endpointCoordinates.y)
  await fitButton.click()
  await expect(playerMap).toHaveAttribute('viewBox', compactFitViewBox)

  const beforeSystemNavigationViewBox = await playerMap.getAttribute('viewBox')
  const revealedSystemButton = playerMap.getByRole('button', { name: 'Open Far Exit Origin system preview', exact: true })
  const revealedMarkerBounds = await revealedSystemButton.boundingBox()
  if (!revealedMarkerBounds) throw new Error('The Revealed system marker must be visible in the fitted Cluster map.')
  await page.mouse.move(revealedMarkerBounds.x + revealedMarkerBounds.width / 2, revealedMarkerBounds.y + revealedMarkerBounds.height / 2)
  await page.mouse.wheel(0, -120)
  const navigableClusterViewBox = await playerMap.getAttribute('viewBox')
  await expect.poll(() => playerMap.getAttribute('viewBox')).not.toBe(beforeSystemNavigationViewBox)
  await revealedSystemButton.click()
  await expect(preview.getByRole('region', { name: 'Player-visible system map' })).toBeVisible()
  await expect(playerMap).toBeHidden()
  await preview.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
  await expect(playerMap).toBeVisible()
  await expect(playerMap).toHaveAttribute('viewBox', navigableClusterViewBox ?? '')

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  await expect(closeInspector).toBeVisible()
  await closeInspector.click()
  await returnToClusterMap(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after).toEqual(before)
})

test('player inspection shows a Jump Point Station only when both objects are Revealed', async ({ page }) => {
  const workspace = createLocalWorkspace('Station Association Source Reach', 'Station Association System')
  const initialSystem = workspace.cluster.systems[0]
  if (!initialSystem) throw new Error('The Station association import needs one system.')

  let system: StarSystem = { ...initialSystem, publication: 'revealed' }
  const revealedStation = createSystemObject(system, 'station')
  system = { ...system, objects: [...system.objects, revealedStation] }
  const hiddenStation = createSystemObject(system, 'station')
  system = { ...system, objects: [...system.objects, hiddenStation] }
  const revealedJumpPoint = createSystemObject(system, 'jump-point')
  system = { ...system, objects: [...system.objects, revealedJumpPoint] }
  const hiddenStationJumpPoint = createSystemObject(system, 'jump-point')
  system = { ...system, objects: [...system.objects, hiddenStationJumpPoint] }

  system = updateSystemObject(system, revealedStation.id, {
    name: 'Common Gate Station',
    publication: 'revealed',
  }, workspace.objectFieldSettings)
  system = updateSystemObject(system, hiddenStation.id, {
    name: 'Private Anchorage',
    publication: 'hidden',
  }, workspace.objectFieldSettings)
  system = updateSystemObject(system, revealedJumpPoint.id, {
    name: 'Dawn Gateway',
    publication: 'revealed',
    jumpStationId: revealedStation.id,
  }, workspace.objectFieldSettings)
  system = updateSystemObject(system, hiddenStationJumpPoint.id, {
    name: 'Silent Gateway',
    publication: 'revealed',
    jumpStationId: hiddenStation.id,
  }, workspace.objectFieldSettings)

  const sourceJson = JSON.stringify(exportJumpCluster({
    ...workspace,
    cluster: { ...workspace.cluster, systems: [system] },
  }))

  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, {
    clusterName: 'Station Association Consumer Reach',
    systemName: 'Station Staging',
    viewport: { width: 1280, height: 900 },
  })
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'revealed-station-associations-v4.json', sourceJson)
  const importReview = importReviewDialog(page)
  await expect(importReview).toContainText('Star systems: 1')
  await resolveImportReview(importReview, 'confirm')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const source = await downloadJson(page, 'Export Jump Cluster JSON')
  const sourceCluster = source.cluster
  if (!sourceCluster) throw new Error('The Station fixture must be retained in the full source backup.')
  const importedSystem = sourceCluster.systems.find(candidate => candidate.name === 'Station Association System')
  if (!importedSystem) throw new Error('The imported Revealed Station system must remain in the source backup.')
  const importedPublicStation = importedSystem.objects.find(object => object.name === 'Common Gate Station')
  const importedHiddenStation = importedSystem.objects.find(object => object.name === 'Private Anchorage')
  const importedPublicPoint = importedSystem.objects.find(object => object.name === 'Dawn Gateway')
  const importedHiddenStationPoint = importedSystem.objects.find(object => object.name === 'Silent Gateway')
  if (!importedPublicStation || !importedHiddenStation || !importedPublicPoint || !importedHiddenStationPoint) {
    throw new Error('The source backup must retain both Station links and their Jump Points.')
  }
  expect(importedPublicPoint.jumpStationId).toBe(importedPublicStation.id)
  expect(importedHiddenStationPoint.jumpStationId).toBe(importedHiddenStation.id)

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Preview player view', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: 'Open Station Association System system preview', exact: true }).click()
  const playerView = preview.getByRole('region', { name: 'Warden-side player preview', exact: true })
  const systemPreview = playerView.getByRole('region', { name: 'Player-visible system map' })
  const publicDetails = playerView.getByRole('region', { name: 'Player object details' })

  await systemPreview.getByRole('button', { name: 'Inspect Dawn Gateway', exact: true }).click()
  await expect(publicDetails).toContainText('Common Gate Station', { timeout: 5_000 })
  const publicDetailsAccessibility = await publicDetails.ariaSnapshot()
  expect(publicDetailsAccessibility).toContain('Common Gate Station')

  await systemPreview.getByRole('button', { name: 'Inspect Silent Gateway', exact: true }).click()
  await expect(publicDetails).toContainText('Silent Gateway')
  await expect(publicDetails).not.toContainText('Private Anchorage')
  await expect(publicDetails).not.toContainText('Station')

  const previewMarkup = await preview.evaluate(element => element.outerHTML)
  const previewAccessibility = await preview.ariaSnapshot()
  for (const sourceId of [
    importedPublicStation.id,
    importedHiddenStation.id,
    importedPublicPoint.id,
    importedHiddenStationPoint.id,
  ]) {
    expect(previewMarkup).not.toContain(sourceId)
    expect(previewAccessibility).not.toContain(sourceId)
  }
  expect(previewMarkup).not.toContain('Private Anchorage')
  expect(previewAccessibility).not.toContain('Private Anchorage')

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
})
