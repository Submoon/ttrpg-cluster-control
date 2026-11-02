import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  exportJumpCluster,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import {
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  addCatalogueObject,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  editMapObject,
  installWorkspaceWriteFailureGate,
  importReviewDialog,
  jsonMapImportInput,
  openChartDetails,
  openWorkspaceHierarchy,
  overwriteWorkspaceRecord,
  readWorkspaceWriteFailureCount,
  resolveImportReview,
  restoreWorkspaceWriteFailureGate,
  returnToClusterMap,
  saveMapObject,
  setHeaderMapActionsOpen,
  setJsonFile,
  selectInspectorOption,
} from './helpers'

function createNestedHostChainImport(): { json: string; privateMarkers: string[]; sourceIds: string[] } {
  const sourceWorkspace = createLocalWorkspace('Private Imported Reach', 'Published Chain')
  const initialSystem = sourceWorkspace.cluster.systems[0]
  const star = initialSystem?.objects[0]
  if (!initialSystem || !star) throw new Error('The host-chain fixture needs its initial star.')

  let system: StarSystem = {
    ...initialSystem,
    publication: 'revealed',
    objects: initialSystem.objects.map(object => object.id === star.id
      ? {
          ...object,
          publication: 'hidden',
          locationKey: 'STAR-PRIVATE',
          name: 'Private Root Star',
          description: 'Private star preparation.',
        }
      : object),
  }
  const privateMarkers = ['Private Imported Reach', 'Private Root Star', 'Private Nested Host',
    'Private Sibling', 'Private Branch Station', 'STAR-PRIVATE', 'ROOT-PRIVATE', 'NEST-PRIVATE',
    'SIBLING-PRIVATE', 'BRANCH-PRIVATE', 'PUBLIC-OBJECT', 'Private star preparation.',
    'Private root host preparation.', 'Private nested host preparation.', 'Private sibling preparation.',
    'Private branch preparation.', 'Player-facing prose is added in a later ticket.']
  const sourceIds = [sourceWorkspace.id, sourceWorkspace.cluster.id, initialSystem.id, star.id]

  function addOrbit(hostId: string): string {
    const orbit = createOrbit(system, hostId)
    system = { ...system, orbits: [...system.orbits, orbit] }
    sourceIds.push(orbit.id)
    return orbit.id
  }

  function addObject(
    orbitId: string,
    subtype: 'planet' | 'moon' | 'station',
    publication: 'hidden' | 'revealed',
    locationKey: string,
    name: string,
    description: string,
  ): SystemObject {
    const object = createSystemObject(system, subtype, orbitId)
    const prepared = { ...object, publication, locationKey, name, description }
    system = { ...system, objects: [...system.objects, prepared] }
    sourceIds.push(object.id)
    return prepared
  }

  const outerOrbitId = addOrbit(star.id)
  const rootHost = addObject(
    outerOrbitId,
    'planet',
    'hidden',
    'ROOT-PRIVATE',
    'Private Root Host',
    'Private root host preparation.',
  )
  privateMarkers.push('Private Root Host', 'Private root host preparation.')

  const middleOrbitId = addOrbit(rootHost.id)
  const middleHost = addObject(
    middleOrbitId,
    'moon',
    'hidden',
    'NEST-PRIVATE',
    'Private Nested Host',
    'Private nested host preparation.',
  )

  const innerOrbitId = addOrbit(middleHost.id)
  addObject(
    innerOrbitId,
    'planet',
    'hidden',
    'SIBLING-PRIVATE',
    'Private Sibling',
    'Private sibling preparation.',
  )
  addObject(
    innerOrbitId,
    'planet',
    'revealed',
    'PUBLIC-OBJECT',
    'Pilgrim World',
    'Player-facing prose is added in a later ticket.',
  )

  const unrelatedOrbitId = addOrbit(star.id)
  addObject(
    unrelatedOrbitId,
    'station',
    'hidden',
    'BRANCH-PRIVATE',
    'Private Branch Station',
    'Private branch preparation.',
  )

  const workspace = {
    ...sourceWorkspace,
    cluster: {
      ...sourceWorkspace.cluster,
      systems: sourceWorkspace.cluster.systems.map(candidate => candidate.id === system.id ? system : candidate),
    },
  }
  return {
    json: JSON.stringify(exportJumpCluster(workspace)),
    privateMarkers,
    sourceIds,
  }
}

type PublicationModeLabel = 'Hidden' | 'Unknown presence' | 'Known type' | 'Revealed'

type PrivatePlanetFixture = {
  clusterName: string
  systemName: string
  objectName: string
  locationKey: string
  description: string
}

async function createPrivatePlanet(page: import('@playwright/test').Page): Promise<PrivatePlanetFixture> {
  const clusterName = 'Private Planet Reach'
  const systemName = 'Private Planet Vesper'
  const objectName = 'Private Planet Marker'
  const description = 'Private object preparation notes.'
  await createSingleSystemWorkspace(page, { clusterName, systemName })
  await addCatalogueObject(page, 'planet')

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await inspector.getByLabel('Name', { exact: true }).fill(objectName)
  await inspector.getByLabel('GM notes', { exact: true }).fill(description)
  const locationKey = await inspector.getByLabel('Location key', { exact: true }).inputValue()
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)

  return { clusterName, systemName, objectName, locationKey, description }
}

async function selectPrivatePlanet(
  page: import('@playwright/test').Page,
  fixture: PrivatePlanetFixture,
): Promise<import('@playwright/test').Locator> {
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', {
    name: `Select ${fixture.locationKey}, ${fixture.objectName}`,
    exact: true,
  }).click()
  await editMapObject(page)
  return page.getByRole('complementary', { name: 'Object inspector' })
}

async function setPrivatePlanetPublication(
  page: import('@playwright/test').Page,
  fixture: PrivatePlanetFixture,
  publication: PublicationModeLabel,
): Promise<void> {
  const inspector = await selectPrivatePlanet(page, fixture)
  await selectInspectorOption(inspector.getByLabel('How players see this object'), publication)
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)
}

async function setSourceSystemPublication(
  page: import('@playwright/test').Page,
  publication: PublicationModeLabel,
): Promise<void> {
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), publication)
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
}

async function openSourceSystemFromCluster(
  page: import('@playwright/test').Page,
  systemName: string,
): Promise<void> {
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: `Open ${systemName} system map`, exact: true }).click()
}

async function openSystemPlayerPreview(
  page: import('@playwright/test').Page,
  systemName: string,
): Promise<{
  preview: import('@playwright/test').Locator
  trigger: import('@playwright/test').Locator
  systemPreview: import('@playwright/test').Locator
}> {
  const details = await openChartDetails(page)
  const trigger = details.getByRole('button', { name: 'Preview player view', exact: true })
  await trigger.click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: `Open ${systemName} system preview`, exact: true }).click()
  return {
    preview,
    trigger,
    systemPreview: preview.getByRole('region', { name: 'Player-visible system map' }),
  }
}

async function exportPrivatePlanet(
  page: import('@playwright/test').Page,
  fixture: PrivatePlanetFixture,
) {
  await returnToClusterMap(page)
  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const system = exported.cluster?.systems.find(candidate => candidate.name === fixture.systemName)
  if (!system) throw new Error('The public export must contain the source system.')
  const object = system.objects.find(candidate => candidate.locationKey === fixture.locationKey)
  if (!object) throw new Error('The public export must contain the source map object.')
  return { system, object }
}

test('a Warden can publish an object and open its Revealed system preview', async ({ page }) => {
  const { clusterName, systemName } = await createSingleSystemWorkspace(page, {
    clusterName: 'Private Reach',
    systemName: 'Private Vesper',
  })
  await addCatalogueObject(page, 'planet')

  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill('Pilgrim World')
  await objectInspector.getByLabel('GM notes', { exact: true }).fill('Private Source Notes')
  const objectPublication = objectInspector.getByLabel('How players see this object')
  await expect(objectPublication).toBeVisible({ timeout: 5_000 })
  await selectInspectorOption(objectPublication, 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const systemDetails = await openChartDetails(page)
  await systemDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)

  const previewTrigger = systemDetails.getByRole('button', { name: 'Preview player view' })
  await previewTrigger.click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await expect(preview).toBeVisible()
  await preview.getByRole('button', { name: `Open ${systemName} system preview` }).click()

  const systemPreview = preview.getByRole('region', { name: 'Player-visible system map' })
  await expect(preview).toContainText(systemName)
  await expect(systemPreview).toContainText('Pilgrim World')
  await expect(systemPreview).not.toContainText('Private Source Notes')
  await expect(preview).not.toContainText(clusterName)
  await systemPreview.getByRole('button', { name: 'Inspect Pilgrim World' }).click()
  await expect(systemPreview.getByRole('region', { name: 'Player object details' })).toContainText('Pilgrim World')
  const accessibleSystemPreview = await systemPreview.ariaSnapshot()
  expect(accessibleSystemPreview).toContain('Inspect Pilgrim World')
  expect(accessibleSystemPreview).not.toContain('Private Source Notes')

  await preview.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  const systemMarker = preview.getByRole('button', { name: `Open ${systemName} system preview` })
  await expect(systemMarker).toBeFocused()
  await systemMarker.click()

  // The modal owns keyboard input even if a keydown is delivered from the Warden map beneath it.
  const wardenMap = page.getByRole('group', {
    name: `${systemName} star system map`,
    includeHidden: true,
  })
  await wardenMap.dispatchEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true })
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation', includeHidden: true })
    .getByRole('button', { name: 'Select', exact: true, includeHidden: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(preview).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await expect(previewTrigger).toBeFocused()
})

test('a Revealed system previews only public objects and the anonymous required host chain', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const fixture = createNestedHostChainImport()
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, {
    clusterName: 'Private Destination Reach',
    systemName: 'Private Destination Vesper',
  })

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'published-host-chain.json', fixture.json)
  const importReview = importReviewDialog(page)
  await resolveImportReview(importReview, 'confirm')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)
  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = exported.cluster?.systems.find(system => system.name === 'Published Chain')
  if (!importedSystem) throw new Error('The public export must contain the imported system.')
  const currentSourceIds = [importedSystem.id,
    ...importedSystem.objects.map(object => object.id),
    ...importedSystem.orbits.map(orbit => orbit.id)]
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systems = page.getByRole('navigation', { name: 'Star systems', exact: true })
  await systems.getByRole('button', { name: 'Open Published Chain system map' }).click()

  async function openPublishedSystemPreview(): Promise<{
    preview: import('@playwright/test').Locator
    systemPreview: import('@playwright/test').Locator
  }> {
    const details = await openChartDetails(page)
    await details.getByRole('button', { name: 'Preview player view' }).click()
    const preview = page.getByRole('dialog', { name: 'Player view preview' })
    await preview.getByRole('button', { name: 'Open Published Chain system preview' }).click()
    return { preview, systemPreview: preview.getByRole('region', { name: 'Player-visible system map' }) }
  }

  const desktop = await openPublishedSystemPreview()
  const hierarchy = desktop.systemPreview.getByRole('region', { name: 'Visible system hierarchy' })
  await expect(desktop.systemPreview).toContainText('Pilgrim World')
  const unknownHierarchyRows = hierarchy.getByRole('button', { name: /^Unknown presence(?:\s|$)/ })
  await expect(unknownHierarchyRows).toHaveCount(3)
  const publicObject = hierarchy.getByRole('button', { name: /Pilgrim World/ })
  await expect(publicObject).toContainText(/Orbit around Unknown presence.*Orbit around Unknown presence.*Orbit around Unknown presence/)
  for (let index = 0; index < 3; index += 1) {
    const unknownRowSnapshot = await unknownHierarchyRows.nth(index).ariaSnapshot()
    expect(unknownRowSnapshot).not.toMatch(/\b(?:star|planet|moon)\b/i)
  }
  const unknownRowMarkup = await unknownHierarchyRows.evaluateAll(elements => elements.map(element => element.outerHTML).join('\n'))
  expect(unknownRowMarkup).not.toMatch(/\b(?:star|planet|moon)\b/i)
  const unknownMarkers = desktop.systemPreview.getByRole('button', { name: 'Inspect Unknown presence' })
  await expect(unknownMarkers).toHaveCount(3)
  const unknownAccessibleMarker = await unknownMarkers.first().ariaSnapshot()
  expect(unknownAccessibleMarker).not.toMatch(/\b(?:star|planet|moon)\b/i)

  const previewDom = await desktop.preview.evaluate(element => element.outerHTML)
  const previewAccessibility = await desktop.preview.ariaSnapshot()
  for (const privateMarker of fixture.privateMarkers.concat(fixture.sourceIds, currentSourceIds)) {
    expect(previewDom).not.toContain(privateMarker)
    expect(previewAccessibility).not.toContain(privateMarker)
  }
  expect(previewDom).not.toContain('Private Destination Reach')
  expect(previewAccessibility).not.toContain('Private Destination Reach')

  const desktopScreenshot = testInfo.outputPath('ticket02-host-chain-preview-desktop.png')
  await page.screenshot({ path: desktopScreenshot, animations: 'disabled' })
  await testInfo.attach('ticket02-host-chain-preview-desktop', {
    path: desktopScreenshot,
    contentType: 'image/png',
  })
  await page.keyboard.press('Escape')
  await expect(desktop.preview).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  const compact = await openPublishedSystemPreview()
  await expect(compact.systemPreview.getByRole('region', { name: 'Visible system hierarchy' }))
    .toContainText('Pilgrim World')
  const compactScreenshot = testInfo.outputPath('ticket02-host-chain-preview-compact.png')
  await page.screenshot({ path: compactScreenshot, animations: 'disabled' })
  await testInfo.attach('ticket02-host-chain-preview-compact', {
    path: compactScreenshot,
    contentType: 'image/png',
  })
})

test('80-character revealed object labels fit the map and wrap in the public hierarchy', async ({ page }) => {
  const longObjectName = 'W'.repeat(80)
  const { systemName } = await createSingleSystemWorkspace(page, {
    clusterName: 'Wide Private Reach',
    systemName: 'Wide Vesper',
  })
  await addCatalogueObject(page, 'planet')
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill(longObjectName)
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(edit.getByLabel('How players see this system'), 'Revealed')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()

  await details.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: `Open ${systemName} system preview` }).click()
  const systemPreview = preview.getByRole('region', { name: 'Player-visible system map' })
  const markerLabel = systemPreview.locator('.player-system-object-marker--revealed text')
  await expect(markerLabel).toBeVisible()
  const labelBounds = await markerLabel.evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement) || !element.ownerSVGElement) {
      throw new Error('The public object label must belong to the player SVG scene.')
    }
    const box = element.getBBox()
    const viewBox = element.ownerSVGElement.viewBox.baseVal
    const mapMatrix = element.ownerSVGElement.getCTM()
    const labelMatrix = element.getCTM()
    if (!mapMatrix || !labelMatrix) throw new Error('The public object label must have a rendered SVG transform.')
    const labelInMap = mapMatrix.inverse().multiply(labelMatrix)
    const corners = [
      new DOMPoint(box.x, box.y),
      new DOMPoint(box.x + box.width, box.y),
      new DOMPoint(box.x, box.y + box.height),
      new DOMPoint(box.x + box.width, box.y + box.height),
    ].map(point => point.matrixTransform(labelInMap))
    return {
      left: Math.min(...corners.map(point => point.x)),
      right: Math.max(...corners.map(point => point.x)),
      top: Math.min(...corners.map(point => point.y)),
      bottom: Math.max(...corners.map(point => point.y)),
      viewLeft: viewBox.x,
      viewRight: viewBox.x + viewBox.width,
      viewTop: viewBox.y,
      viewBottom: viewBox.y + viewBox.height,
    }
  })
  expect(labelBounds.left).toBeGreaterThanOrEqual(labelBounds.viewLeft)
  expect(labelBounds.right).toBeLessThanOrEqual(labelBounds.viewRight)
  expect(labelBounds.top).toBeGreaterThanOrEqual(labelBounds.viewTop)
  expect(labelBounds.bottom).toBeLessThanOrEqual(labelBounds.viewBottom)

  const hierarchy = systemPreview.getByRole('region', { name: 'Visible system hierarchy' })
  const longObjectRow = hierarchy.getByRole('button', { name: new RegExp(longObjectName) })
  await expect(longObjectRow).toBeVisible()
  const hierarchyMetrics = await longObjectRow.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(hierarchyMetrics.scrollWidth).toBeLessThanOrEqual(hierarchyMetrics.clientWidth)
})

test('player system pan and zoom stay local to the preview and do not add history', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemName } = await createSingleSystemWorkspace(page, {
    clusterName: 'Viewport Private Reach',
    systemName: 'Viewport Vesper',
  })
  await addCatalogueObject(page, 'planet')
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectInspectorOption(edit.getByLabel('How players see this system'), 'Revealed')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()

  await returnToClusterMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const historyBefore = await page.getByRole('group', { name: 'Edit history' }).locator('button')
    .evaluateAll(buttons => buttons.map(button => ({
      label: button.getAttribute('aria-label'),
      disabled: button.matches(':disabled'),
    })))

  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await page.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: `Open ${systemName} system map` }).click()
  const previewDetails = await openChartDetails(page)
  await previewDetails.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: `Open ${systemName} system preview` }).click()
  const systemPreview = preview.getByRole('region', { name: 'Player-visible system map' })
  const map = systemPreview.locator('svg.player-system-map-scene')
  const navigation = systemPreview.getByRole('group', { name: 'Player system map navigation' })
  await expect(navigation).toBeVisible({ timeout: 5_000 })

  const fitButton = navigation.getByRole('button', { name: 'Fit player map', exact: true })
  const zoomIn = navigation.getByRole('button', { name: 'Zoom in', exact: true })
  const panRight = navigation.getByRole('button', { name: 'Pan right', exact: true })
  const fittedViewBox = await map.getAttribute('viewBox')
  if (!fittedViewBox) throw new Error('The player system map needs a fitted viewBox.')
  await zoomIn.click()
  const zoomedViewBox = await map.getAttribute('viewBox')
  expect(zoomedViewBox).not.toBe(fittedViewBox)
  await panRight.click()
  const pannedViewBox = await map.getAttribute('viewBox')
  expect(pannedViewBox).not.toBe(zoomedViewBox)

  const pointerStartViewBox = await map.getAttribute('viewBox')
  const mapBounds = await map.boundingBox()
  if (!pointerStartViewBox || !mapBounds) throw new Error('The player map needs a visible pointer target.')
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(mapBounds.x + mapBounds.width / 2 + 42, mapBounds.y + mapBounds.height / 2 + 18, { steps: 3 })
  await page.mouse.up()
  expect(await map.getAttribute('viewBox')).not.toBe(pointerStartViewBox)

  const wheelStartViewBox = await map.getAttribute('viewBox')
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2)
  await page.mouse.wheel(0, -120)
  await expect.poll(async () => map.getAttribute('viewBox')).not.toBe(wheelStartViewBox)

  await map.focus()
  const keyboardStartViewBox = await map.getAttribute('viewBox')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => map.getAttribute('viewBox')).not.toBe(keyboardStartViewBox)
  await fitButton.click()
  await expect.poll(async () => map.getAttribute('viewBox')).toBe(fittedViewBox)

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await returnToClusterMap(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  const historyAfter = await page.getByRole('group', { name: 'Edit history' }).locator('button')
    .evaluateAll(buttons => buttons.map(button => ({
      label: button.getAttribute('aria-label'),
      disabled: button.matches(':disabled'),
    })))
  expect(after).toEqual(before)
  expect(historyAfter).toEqual(historyBefore)
})

test('each object publication mode renders only its permitted player marker', async ({ page }) => {
  const fixture = await createPrivatePlanet(page)
  const modes: PublicationModeLabel[] = ['Hidden', 'Unknown presence', 'Known type', 'Revealed']
  let hiddenMarkerCount: number | undefined

  for (const mode of modes) {
    await setPrivatePlanetPublication(page, fixture, mode)
    const { preview, trigger, systemPreview } = await openSystemPlayerPreview(page, fixture.systemName)
    const markers = systemPreview.locator('.player-system-object-marker')
    const hierarchy = systemPreview.getByRole('region', { name: 'Visible system hierarchy' })

    if (mode === 'Hidden') {
      hiddenMarkerCount = await markers.count()
      await expect(markers).toHaveCount(1)
      await expect(markers).toHaveAttribute('aria-label', 'Inspect Star')
      await expect(hierarchy).toContainText('Star')
      await expect(systemPreview).not.toContainText(fixture.objectName)
    } else if (mode === 'Unknown presence') {
      if (hiddenMarkerCount === undefined) throw new Error('The Hidden mode must establish the baseline marker count.')
      await expect(markers).toHaveCount(hiddenMarkerCount + 1)
      const unknownMarkers = systemPreview.locator('.player-system-object-marker:not(.player-system-object-marker--known-type):not(.player-system-object-marker--revealed)')
      await expect(unknownMarkers).toHaveCount(1)
      await expect(unknownMarkers).toHaveAttribute('aria-label', 'Inspect Unknown presence')
      const unknownMarkup = await unknownMarkers.evaluate(element => element.outerHTML)
      expect(unknownMarkup).not.toMatch(/\b(?:planet|star|moon|family|subtype|glyph|halo)\b/i)
      await expect(systemPreview).not.toContainText(fixture.objectName)
    } else if (mode === 'Known type') {
      if (hiddenMarkerCount === undefined) throw new Error('The Hidden mode must establish the baseline marker count.')
      await expect(markers).toHaveCount(hiddenMarkerCount + 1)
      await expect(systemPreview.locator('.player-system-object-marker--known-type').filter({ hasText: 'Planet' }))
        .toHaveCount(1)
      await expect(systemPreview).not.toContainText(fixture.objectName)
    } else {
      if (hiddenMarkerCount === undefined) throw new Error('The Hidden mode must establish the baseline marker count.')
      await expect(markers).toHaveCount(hiddenMarkerCount + 1)
      await expect(systemPreview.locator('.player-system-object-marker--revealed').filter({ hasText: fixture.objectName }))
        .toHaveCount(1)
      await systemPreview.getByRole('button', { name: `Inspect ${fixture.objectName}`, exact: true }).click()
      await expect(systemPreview.getByRole('region', { name: 'Player object details' })).toContainText(fixture.objectName)
    }

    const previewDom = await preview.evaluate(element => element.outerHTML)
    const previewAccessibility = await preview.ariaSnapshot()
    expect(previewDom).not.toContain(fixture.locationKey)
    expect(previewDom).not.toContain(fixture.description)
    expect(previewAccessibility).not.toContain(fixture.locationKey)
    expect(previewAccessibility).not.toContain(fixture.description)
    if (mode !== 'Revealed') {
      expect(previewDom).not.toContain(fixture.objectName)
      expect(previewAccessibility).not.toContain(fixture.objectName)
    }

    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()
    await expect(trigger).toBeFocused()
  }
})

test('non-Revealed systems gate their child map and preserve the child publication setting', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = await createPrivatePlanet(page)
  await setPrivatePlanetPublication(page, fixture, 'Revealed')

  for (const mode of ['Hidden', 'Unknown presence', 'Known type'] as const) {
    await setSourceSystemPublication(page, mode)
    const details = await openChartDetails(page)
    await details.getByRole('button', { name: 'Preview player view', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Player view preview' })
    const labels = preview.getByRole('list', { name: 'Visible marker labels' })

    if (mode === 'Hidden') {
      await expect(preview).toContainText('No star systems are visible to players.')
      await expect(labels).toHaveCount(0)
    } else {
      await expect(labels).toHaveText(mode === 'Unknown presence' ? 'Unknown presence' : 'Star system')
    }

    await expect(preview.getByRole('button', { name: `Open ${fixture.systemName} system preview`, exact: true }))
      .toHaveCount(0)
    await expect(preview.getByRole('region', { name: 'Player-visible system map' })).toHaveCount(0)
    await expect(preview).not.toContainText(fixture.systemName)
    await expect(preview).not.toContainText(fixture.objectName)
    const snapshot = await preview.ariaSnapshot()
    expect(snapshot).not.toContain(fixture.description)
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()
  }

  const { system, object } = await exportPrivatePlanet(page, fixture)
  expect(system.publication).toBe('known-type')
  expect(object.publication).toBe('revealed')
})

test('object publication changes survive Undo, Redo, reload, and a retried durable save', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = await createPrivatePlanet(page)
  await setPrivatePlanetPublication(page, fixture, 'Revealed')

  const history = page.getByRole('group', { name: 'Edit history' })
  await history.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  let state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('known-type')

  await history.getByRole('button', { name: /^Redo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('revealed')

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toBeVisible()
  state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('revealed')

  await openSourceSystemFromCluster(page, fixture.systemName)
  const inspector = await selectPrivatePlanet(page, fixture)
  const publication = inspector.getByLabel('How players see this object')
  await installWorkspaceWriteFailureGate(page)
  try {
    await selectInspectorOption(publication, 'Unknown presence')
    await saveMapObject(page)
    const feedback = activeWorkspaceFeedback(page)
    await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')
    await expect(feedback.getByRole('button', { name: 'Retry save' })).toBeVisible()
    const historyAfterFailedWrite = await history.locator('button').evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('aria-label')),
    )

    await feedback.getByRole('button', { name: 'Retry save' }).click()
    await waitForWorkspaceSaved(page)
    expect(await readWorkspaceWriteFailureCount(page)).toBe(2)
    const historyAfterRetry = await history.locator('button').evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('aria-label')),
    )
    expect(historyAfterRetry).toEqual(historyAfterFailedWrite)
  } finally {
    await restoreWorkspaceWriteFailureGate(page)
  }

  state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('unknown')
})

test('restoring the last valid backup restores Revealed object publication and private source content', async ({ page }) => {
  await captureMapExportBlobs(page)
  const fixture = await createPrivatePlanet(page)
  await setPrivatePlanetPublication(page, fixture, 'Revealed')
  await setPrivatePlanetPublication(page, fixture, 'Unknown presence')

  await overwriteWorkspaceRecord(page, 'current', { damaged: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your workspace could not be opened.' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore last valid backup' }).click()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })).toContainText(fixture.systemName)
  await waitForWorkspaceSaved(page)

  let state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('revealed')
  expect(state.object.name).toBe(fixture.objectName)
  expect(state.object.locationKey).toBe(fixture.locationKey)
  expect(state.object.description).toBe(fixture.description)

  await page.reload()
  state = await exportPrivatePlanet(page, fixture)
  expect(state.object.publication).toBe('revealed')
  expect(state.object.description).toBe(fixture.description)
})
