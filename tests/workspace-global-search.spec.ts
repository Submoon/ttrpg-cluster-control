import { expect, test } from './fixtures'
import campaignFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { exportJumpCluster, restoreJumpClusterBackup } from '../domain/workspace'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import { expectPaintedInsideUsableMap } from './scenarios/search-assertions'
import {
  centerWorkspaceSelection,
  downloadJson,
  fitWorkspaceMap,
  hideWorkspaceInspector,
  openWorkspaceHierarchy,
  openWorkspaceZoomNavigation,
  wardenMap,
  wardenObjectMark,
} from './helpers'
test('global Search reveals an exact Location key independently of the map filter', async ({ page }) => {
  const campaign = restoreJumpClusterBackup(structuredClone(campaignFixture))
  const route = campaign.cluster.routes[0]!
  const { branch, root, occupant, workspace } = workspaceWithRouteObjects()
  const routeObject = { ...occupant, locationKey: 'TRANSIT-HAZARD' }
  campaign.cluster.routeContents[route.id] = {
    ...branch,
    objects: [{ ...root, locationKey: 'TRANSIT-ROOT' }, routeObject],
  }
  Object.assign(campaign.layout.orbitRadii, workspace.layout.orbitRadii)
  Object.assign(campaign.layout.orbitRotations, workspace.layout.orbitRotations)
  Object.assign(campaign.layout.objectAngles, workspace.layout.objectAngles)
  await importCampaignWorkspace(page, exportJumpCluster(campaign), { width: 1440, height: 960 })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const harrowSystem = exported.cluster?.systems.find(system => system.name === 'Harrow')
  const targetObject = harrowSystem?.objects.find(object => object.name === 'Primary Star')
  const rememberedObject = harrowSystem?.objects.find(object => object.name === 'Harrow Arrival')
  if (!harrowSystem || !targetObject || !rememberedObject) throw new Error('The public cluster export has no Harrow search targets.')

  const map = wardenMap(page)
  const scene = map.locator('.cluster-map-content')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Harrow', exact: true }).click()
  await centerWorkspaceSelection(page)
  const previousSelection = wardenObjectMark(page, harrowSystem.id, rememberedObject.id)
  await previousSelection.press('Enter')
  await expect(previousSelection).toHaveAttribute('aria-pressed', 'true')
  await hideWorkspaceInspector(page)

  await hierarchy.getByRole('treeitem', { name: 'Vesper Prime', exact: true }).click()
  await centerWorkspaceSelection(page)
  await hideWorkspaceInspector(page)
  const beforePan = await scene.getAttribute('transform')
  if (!beforePan) throw new Error('The Warden camera must be initialized.')
  await (await openWorkspaceZoomNavigation(page)).getByRole('button', { name: 'Pan map right', exact: true }).click()
  await expect(scene).not.toHaveAttribute('transform', beforePan)
  const sourceCamera = await scene.getAttribute('transform')
  if (!sourceCamera) throw new Error('The panned workspace needs a live camera.')

  const filters = page.getByRole('button', { name: 'Filters', exact: true })
  await filters.click()
  const mapFilters = page.getByRole('dialog', { name: /^Filters(?: \(|$)/ })
  await mapFilters.getByRole('checkbox', { name: 'Jump Point', exact: true }).check()
  await mapFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(mapFilters).toBeHidden()
  await page.getByRole('button', { name: 'Search', exact: true }).press('Enter')
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('A')
  const harrowResult = searchDialog.getByRole('option', {
    name: /Primary Star.*Zone: Harrow.*Location key: A/,
  })
  await expect(harrowResult).toBeVisible()
  await expect(harrowResult).toContainText('Zone: Harrow')
  await searchDialog.getByRole('button', { name: 'Search filters', exact: true }).click()
  await searchDialog.getByRole('checkbox', { name: 'Star', exact: true }).check()
  await searchDialog.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(harrowResult).toBeVisible()
  await harrowResult.click()

  await expect(map).toHaveCount(1)
  await expect(searchDialog).toHaveCount(0)
  await expect(map).toBeFocused()
  const exactTarget = wardenObjectMark(page, harrowSystem.id, targetObject.id)
  await expect(exactTarget).toHaveAttribute('aria-pressed', 'true')
  await expect(exactTarget).toHaveAccessibleName('Select A, Primary Star')
  await expect(exactTarget).toHaveClass(/is-dimmed/)
  await expect(previousSelection).toHaveAttribute('aria-pressed', 'false')
  await expect(scene).not.toHaveAttribute('transform', sourceCamera)
  await expectPaintedInsideUsableMap(page, map, [exactTarget.locator('.continuous-warden-object-glyph')])
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Search', exact: true }).press('Enter')
  await query.fill(routeObject.locationKey)
  await searchDialog.getByRole('button', { name: 'Search filters (1 active criterion)', exact: true }).click()
  await searchDialog.getByRole('checkbox', { name: 'Star', exact: true }).uncheck()
  await searchDialog.getByRole('checkbox', { name: 'Anomaly', exact: true }).check()
  await searchDialog.getByRole('button', { name: 'Close filters', exact: true }).click()
  await searchDialog.getByRole('option', { name: /Captured echo.*Jump Route.*TRANSIT-HAZARD/ }).click()

  const routeMark = map.getByRole('button', { name: 'Select TRANSIT-HAZARD, Captured echo (Anomaly)', exact: true })
  await expect(routeMark).toHaveAttribute('aria-pressed', 'true')
  await expect(routeMark).toHaveClass(/is-dimmed/)
  await expect(routeMark.locator('[data-map-search-locator]')).toBeVisible()
  const routeRow = hierarchy.getByRole('treeitem', { name: /^Select TRANSIT-HAZARD, Captured echo in / })
  await expect(routeRow).toHaveAttribute('aria-level', '4')
  await expect(routeRow).toHaveAttribute('aria-selected', 'true')
  await fitWorkspaceMap(page)
  await expect(routeMark).toHaveAttribute('aria-pressed', 'true')
})
