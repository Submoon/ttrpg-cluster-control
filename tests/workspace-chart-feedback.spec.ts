import { expect, test, type Locator, type Page } from './fixtures'
import {
  abortNextWorkspaceWrite,
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  clickWardenSystemPoint,
  createSingleSystemWorkspace,
  downloadJson,
  exposedContinuousObjectHitPoint,
  hideWorkspaceInspector,
  openChartDetailsEditor,
  openWorkspaceHierarchy,
  quitSystemAdd,
  selectCatalogueObjectButton,
  snapshotSvgCoordinates,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
  wardenSystemMark,
  workspaceZoomControls,
} from './helpers'

async function closeCompactPanels(page: import('@playwright/test').Page): Promise<void> {
  const inspectorClose = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const inspectorHide = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await inspectorClose.isVisible()) await inspectorClose.click()
  else if (await inspectorHide.isVisible()) await inspectorHide.click()

  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()
}

/** Uses public zoom and right-drag navigation without inspecting a target or resolving the hidden draft. */
async function navigateToPlanet(page: Page, map: Locator, planet: Locator): Promise<void> {
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let attempt = 0; attempt < 32 && !await planet.isVisible(); attempt += 1) {
    if (await zoomIn.isDisabled()) break
    await zoomIn.click()
  }
  await expect(planet).toBeVisible()
  const panStart = await map.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 }
    let closest: { x: number; y: number } | null = null
    let distance = Number.POSITIVE_INFINITY
    for (let y = Math.ceil(Math.max(0, bounds.top) + 32); y < Math.min(window.innerHeight, bounds.bottom) - 32; y += 8) {
      for (let x = Math.ceil(Math.max(0, bounds.left) + 32); x < Math.min(window.innerWidth, bounds.right) - 32; x += 8) {
        const reachable = [-32, 0, 32].every(dx => [-32, 0, 32].every(dy =>
          element.contains(document.elementFromPoint(x + dx, y + dy))))
        const nextDistance = (x - center.x) ** 2 + (y - center.y) ** 2
        if (reachable && nextDistance < distance) {
          closest = { x, y }
          distance = nextDistance
        }
      }
    }
    if (!closest) throw new Error('The feedback leaves no unobstructed area for native map navigation.')
    return closest
  })
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const coordinates = await snapshotSvgCoordinates(planet)
    const current = coordinates.toClient({ x: 0, y: 0 })
    const delta = { x: panStart.x - current.x, y: panStart.y - current.y }
    if (Math.hypot(delta.x, delta.y) < 8) return
    await page.mouse.move(panStart.x, panStart.y)
    await page.mouse.down({ button: 'right' })
    try {
      await page.mouse.move(
        panStart.x + Math.max(-24, Math.min(24, delta.x)),
        panStart.y + Math.max(-24, Math.min(24, delta.y)),
        { steps: 3 },
      )
    } finally {
      await page.mouse.up({ button: 'right' })
    }
  }
  throw new Error('The lower-right Planet did not reach the unobstructed map area through native navigation.')
}

test('overview Fit and explicit navigation reach a lower-right planet beside failed-save feedback and a hidden chart draft', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await captureMapExportBlobs(page)
  const { systemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  await waitForWorkspaceSaved(page)

  await (await selectCatalogueObjectButton(page, 'planet')).click()
  const delivered = await clickWardenSystemPoint(page, systemId, { x: 0.9, y: 0.9 })
  await page.getByRole('dialog', { name: 'Choose the owning system', exact: true })
    .getByRole('button', { name: 'Add Planet to Vesper', exact: true }).click()
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const addedPlanet = exported.cluster?.systems.find(system => system.id === systemId)
    ?.objects.find(object => object.subtype === 'planet')
  if (!addedPlanet) throw new Error('The compact feedback check needs its applied lower-right Planet.')
  if (addedPlanet.placement.kind !== 'system') throw new Error('The lower-right Planet needs a free map position.')
  expect(addedPlanet.placement.x).toBeCloseTo(delivered.x, 5)
  expect(addedPlanet.placement.y).toBeCloseTo(delivered.y, 5)
  await page.setViewportSize({ width: 390, height: 500 })
  await closeCompactPanels(page)

  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await hierarchy.getByRole('treeitem', { name: /^Select PL-01, New planet 1/ }).click()
  await closeCompactPanels(page)
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await closeCompactPanels(page)

  const map = wardenMap(page)
  const camera = map.locator('.cluster-map-content')
  const cameraBeforeFeedback = await camera.getAttribute('transform')
  const appliedEditor = await openChartDetailsEditor(page)
  await appliedEditor.getByLabel('Jump Cluster', { exact: true }).fill('Applied recovery reach')
  await appliedEditor.getByLabel('Star system', { exact: true }).fill('Applied recovery star')
  await abortNextWorkspaceWrite(page, async () => {
    await appliedEditor.getByRole('button', { name: 'Apply details', exact: true }).click()
    await expect(appliedEditor).toBeHidden()
  })
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')

  const draftEditor = await openChartDetailsEditor(page)
  await draftEditor.getByLabel('Jump Cluster', { exact: true }).fill('Hidden unapplied draft reach')
  await draftEditor.getByLabel('Star system', { exact: true }).fill('Hidden unapplied draft star')
  await hideWorkspaceInspector(page)
  await expect(draftEditor).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true })).toBeVisible()
  await expect(camera).toHaveAttribute('transform', cameraBeforeFeedback!)

  const systemHierarchy = await openWorkspaceHierarchy(page)
  await systemHierarchy.getByRole('button', { name: 'Open Jump Cluster details', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Jump Cluster details', exact: true })).toBeVisible()
  const compactRecovery = page.getByRole('region', { name: 'Workspace save and recovery' })
  await expect(compactRecovery).toBeVisible()
  const compactDetailsTrigger = compactRecovery.getByRole('button', { name: 'Recovery details', exact: true })
  await compactDetailsTrigger.click()
  let details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details).toBeVisible()
  await expect(details.getByRole('alert')).toContainText('Save failed:')
  await expect(details.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  const pendingDownload = page.waitForEvent('download')
  await details.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true }).click()
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.json$/i)
  await page.keyboard.press('Escape')
  await expect(compactDetailsTrigger).toBeFocused()

  await closeCompactPanels(page)
  const normalFeedback = activeWorkspaceFeedback(page)
  const normalDetailsTrigger = normalFeedback.getByRole('button', { name: 'Recovery details', exact: true })
  await normalDetailsTrigger.click()
  details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details.getByRole('alert')).toContainText('Save failed:')
  await expect(details.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(normalDetailsTrigger).toBeFocused()

  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  const anchor = wardenSystemMark(page, systemId)
  await expect(anchor).toBeInViewport({ ratio: 1 })
  const anchorCoordinates = await snapshotSvgCoordinates(anchor)
  expect(await anchor.evaluate((element, point) =>
    document.elementFromPoint(point.x, point.y)
      ?.closest<SVGGElement>('.continuous-warden-system-anchor, .continuous-warden-name-target')
      ?.getAttribute('data-system-id') === element.getAttribute('data-system-id'),
  anchorCoordinates.toClient({ x: 0, y: 0 }))).toBe(true)
  const planet = wardenObjectMark(page, systemId, addedPlanet.id)
  await navigateToPlanet(page, map, planet)
  await expect(draftEditor).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true }))
    .toBeVisible()
  const ordinaryHit = await exposedContinuousObjectHitPoint(planet)
  expect(ordinaryHit).not.toBeNull()
  if (!ordinaryHit) throw new Error('Explicit navigation must expose a real pointer target on the lower-right Planet.')

  await page.mouse.click(ordinaryHit.x, ordinaryHit.y)
  const guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(draftEditor).toBeVisible()
  await expect(draftEditor.getByLabel('Star system', { exact: true })).toHaveValue('Hidden unapplied draft star')
  await hideWorkspaceInspector(page)

  const recoveryDetailsTrigger = activeWorkspaceFeedback(page).getByRole('button', { name: 'Recovery details', exact: true })
  await recoveryDetailsTrigger.click()
  const retryDetails = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await retryDetails.getByRole('button', { name: 'Retry save', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(page.locator('#workspace-main')).toBeFocused()
})
