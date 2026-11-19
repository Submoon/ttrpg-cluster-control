import { expect, test } from './fixtures'
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
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
} from './helpers'

async function closeCompactPanels(page: import('@playwright/test').Page): Promise<void> {
  const inspectorClose = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const inspectorHide = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await inspectorClose.isVisible()) await inspectorClose.click()
  else if (await inspectorHide.isVisible()) await inspectorHide.click()

  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()
}

test('explicit Fit keeps a lower-right planet reachable beside failed-save feedback and a hidden chart draft', async ({ page }) => {
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

  const systemMap = wardenMap(page).locator('.cluster-map-content')
  const cameraBeforeFeedback = await systemMap.getAttribute('transform')
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
  await expect(systemMap).toHaveAttribute('transform', cameraBeforeFeedback!)

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
  const planet = wardenObjectMark(page, systemId, addedPlanet.id)
  await expect(planet).toBeVisible()
  const ordinaryHit = await exposedContinuousObjectHitPoint(planet)
  expect(ordinaryHit).not.toBeNull()
  if (!ordinaryHit) throw new Error('Fit must leave a real pointer target on the lower-right Planet.')

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
