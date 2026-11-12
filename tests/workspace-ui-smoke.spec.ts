import { expect, test, type Locator } from './fixtures'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
} from '../domain/workspace'
import {
  waitForWorkspaceSaved,
  createSingleSystemWorkspace,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
} from './helpers'
import { RENDER_GEOMETRY_TOLERANCE_PX } from './render-tolerances'

type Viewport = { width: number; height: number }

const smokeViewports: Viewport[] = [
  { width: 844, height: 390 },
]

function makeRouteFooterWorkspace() {
  let workspace = createLocalWorkspace('Footer Reach', 'A')
  const firstSystem = workspace.cluster.systems[0]
  if (!firstSystem) throw new Error('The route footer fixture needs its first system.')
  workspace = addStarSystem(workspace, 'B').workspace

  const firstPoint = createSystemObject(firstSystem, 'jump-point')
  firstPoint.name = 'A Origin'
  const secondSystem = workspace.cluster.systems.find(system => system.name === 'B')
  if (!secondSystem) throw new Error('The route footer fixture needs its second system.')
  const secondPoint = createSystemObject(secondSystem, 'jump-point')
  secondPoint.name = 'B Entry'

  const systems = workspace.cluster.systems.map(system => {
    if (system.id === firstSystem.id) return { ...system, objects: [...system.objects, firstPoint] }
    if (system.id === secondSystem.id) return { ...system, objects: [...system.objects, secondPoint] }
    return system
  })
  const cluster = { ...workspace.cluster, systems }
  const route = createJumpRoute(cluster, 1, firstPoint.id, secondPoint.id)
  return { ...workspace, cluster: { ...cluster, routes: [route] } }
}

async function importRouteFooterWorkspace(page: import('@playwright/test').Page): Promise<void> {
  const incoming = makeRouteFooterWorkspace()
  await returnToClusterMap(page)
  await setJsonFile(jsonMapImportInput(page), 'footer-routes.json', JSON.stringify(exportJumpCluster(incoming)))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await setHeaderMapActionsOpen(page, false)
  await returnToClusterMap(page)
  await waitForWorkspaceSaved(page)
}

async function expectFooterActionToFit(
  panel: Locator,
  action: Locator,
  viewport: Viewport,
): Promise<void> {
  await expect(action).toBeVisible()
  await expect(action).toBeInViewport({ ratio: 1 })
  const panelBounds = await panel.boundingBox()
  const actionBounds = await action.boundingBox()
  if (!panelBounds || !actionBounds) throw new Error('A visible footer action has no measurable bounds.')
  expect(actionBounds.x).toBeGreaterThanOrEqual(Math.max(0, panelBounds.x) - RENDER_GEOMETRY_TOLERANCE_PX)
  expect(actionBounds.y).toBeGreaterThanOrEqual(Math.max(0, panelBounds.y) - RENDER_GEOMETRY_TOLERANCE_PX)
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(
    Math.min(viewport.width, panelBounds.x + panelBounds.width) + RENDER_GEOMETRY_TOLERANCE_PX,
  )
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(
    Math.min(viewport.height, panelBounds.y + panelBounds.height) + RENDER_GEOMETRY_TOLERANCE_PX,
  )
  expect(await action.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || Boolean(hit && element.contains(hit))
  })).toBe(true)
}

async function closeInspector(page: import('@playwright/test').Page): Promise<void> {
  const inspector = page.locator('#workspace-inspector-panel')
  const compactClose = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  if (await compactClose.isVisible().catch(() => false)) {
    await compactClose.click()
  } else {
    const entityHide = inspector.getByRole('button', { name: 'Hide inspector', exact: true })
    if (await entityHide.isVisible().catch(() => false)) {
      await entityHide.click()
    } else {
      const toggle = page.getByRole('button', { name: 'Inspect', exact: true })
      if (await toggle.isVisible().catch(() => false) && await toggle.getAttribute('aria-expanded') === 'true') {
        await toggle.click()
      }
    }
  }
  await expect(inspector).toBeHidden()
}

async function ensureInspectorOpen(
  page: import('@playwright/test').Page,
  inspector: Locator,
): Promise<void> {
  if (await inspector.isVisible()) return
  const toggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  await expect(inspector).toBeVisible()
}


for (const viewport of smokeViewports) {
  test(`chart, system, and route footer actions fit and receive pointer hits at ${viewport.width}×${viewport.height} @ui-smoke`, async ({ page }) => {
    await createSingleSystemWorkspace(page, {
      clusterName: 'Footer Reach',
      systemName: 'Temporary',
      viewport,
    })
    await importRouteFooterWorkspace(page)

    const inspector = page.locator('#workspace-inspector-panel')
    const chartHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
    await chartHierarchy.getByRole('button', { name: 'Open chart details', exact: true }).click()
    const clusterDetails = page.getByRole('region', { name: 'Jump Cluster details', exact: true })
    const editChartDetails = clusterDetails.getByRole('button', { name: 'Edit chart details', exact: true })
    await expectFooterActionToFit(clusterDetails, editChartDetails, viewport)
    await expect(clusterDetails.getByRole('region', { name: 'Player publication settings' })).toBeVisible()
    await closeInspector(page)
    const clusterMap = page.getByRole('group', { name: 'Footer Reach Jump Cluster map', exact: true })
    const systemNode = clusterMap.getByRole('button', { name: 'Select A system', exact: true })
    await systemNode.click()
    await ensureInspectorOpen(page, inspector)
    const selectedSystemDetails = page.getByRole('region', { name: 'Star System details', exact: true })
    const systemActions = selectedSystemDetails.locator('.chart-details-actions')
    const openSystem = systemActions.getByRole('button', { name: 'Open system', exact: true })
    await expectFooterActionToFit(selectedSystemDetails, openSystem, viewport)
    await expect(selectedSystemDetails.getByRole('group', { name: 'Configured visibility', exact: true })).toBeVisible()
    await expect(selectedSystemDetails.getByRole('button', { name: 'Delete A system', exact: true })).toBeVisible()
    await openSystem.click()
    await closeInspector(page)
    await expect(page.getByRole('navigation', { name: 'Map context and commands' })
      .getByRole('heading', { name: 'A', exact: true })).toBeVisible()
    await returnToClusterMap(page)
    const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
    const route = hierarchy.getByRole('button', { name: /^Select Jump Level 1: .*A Origin.*B Entry/ })
    await expect(route).toBeVisible()
    await route.click()
    const compactHierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
    if (await compactHierarchyClose.isVisible().catch(() => false)) await compactHierarchyClose.click()
    await ensureInspectorOpen(page, inspector)
    const routeDetails = page.getByRole('region', { name: 'Jump Route details', exact: true })
    await expect(routeDetails).toContainText('A Origin')
    const editRoute = routeDetails.getByRole('button', { name: 'Edit Jump Route', exact: true })
    await expectFooterActionToFit(routeDetails, editRoute, viewport)

    if (viewport.width === 844) {
      await test.info().attach('route-footer-844x390', {
        body: await page.screenshot({ animations: 'disabled', fullPage: false }),
        contentType: 'image/png',
      })
    }
  })
}
