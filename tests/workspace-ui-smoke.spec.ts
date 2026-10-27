import { expect, test, type Locator } from './fixtures'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
} from '../domain/workspace'
import {
  activeWorkspaceFeedback,
  createSingleSystemWorkspace,
  deletionReviewDialog,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
} from './helpers'

type Viewport = { width: number; height: number }

const smokeViewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
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
  expect(actionBounds.x).toBeGreaterThanOrEqual(Math.max(0, panelBounds.x) - 1)
  expect(actionBounds.y).toBeGreaterThanOrEqual(Math.max(0, panelBounds.y) - 1)
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(Math.min(viewport.width, panelBounds.x + panelBounds.width) + 1)
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(Math.min(viewport.height, panelBounds.y + panelBounds.height) + 1)
  expect(await action.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || Boolean(hit && element.contains(hit))
  })).toBe(true)
}

async function expectFullWidthFooterAction(
  actions: Locator,
  action: Locator,
): Promise<void> {
  const actionCount = await actions.getByRole('button').count()
  expect(actionCount).toBe(1)
  const actionsBounds = await actions.boundingBox()
  const actionBounds = await action.boundingBox()
  if (!actionsBounds || !actionBounds) throw new Error('A full-width footer action has no measurable bounds.')
  expect(Math.abs(actionBounds.x - actionsBounds.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(actionBounds.width - actionsBounds.width)).toBeLessThanOrEqual(1)
}

async function expectEqualWidthFooterActions(
  actions: Locator,
  firstAction: Locator,
  secondAction: Locator,
): Promise<void> {
  const actionCount = await actions.getByRole('button').count()
  expect(actionCount).toBe(2)
  const actionsBounds = await actions.boundingBox()
  const firstBounds = await firstAction.boundingBox()
  const secondBounds = await secondAction.boundingBox()
  if (!actionsBounds || !firstBounds || !secondBounds) {
    throw new Error('The paired footer actions have no measurable bounds.')
  }
  expect(Math.abs(firstBounds.width - secondBounds.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(firstBounds.y - secondBounds.y)).toBeLessThanOrEqual(1)
  expect(firstBounds.x).toBeGreaterThanOrEqual(actionsBounds.x - 1)
  expect(secondBounds.x + secondBounds.width).toBeLessThanOrEqual(actionsBounds.x + actionsBounds.width + 1)
  expect(secondBounds.x).toBeGreaterThan(firstBounds.x + firstBounds.width)
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

test('object footer distinguishes clean, editing, and dirty drafts, then discards to clean @ui-smoke', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  await map.getByRole('button', { name: /^Select A, Primary Star/ }).click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const footer = inspector.locator('.entity-inspector-footer-actions')
  const edit = footer.getByRole('button', { name: 'Edit map object', exact: true })
  const apply = footer.getByRole('button', { name: 'Apply changes' })
  const discard = footer.getByRole('button', { name: 'Discard changes' })
  await expect(edit).toBeVisible()
  await expect(apply).toHaveCount(0)
  await expect(discard).toHaveCount(0)

  await edit.click()
  await expect(apply).toBeEnabled()
  await expect(discard).toBeEnabled()
  await inspector.getByLabel('Name', { exact: true }).fill('Unapplied Primary Star')
  await expect(apply).toBeEnabled()
  await expect(edit).toHaveCount(0)
  await expect(discard).toBeVisible()

  await discard.click()
  await expect(edit).toBeVisible()
  await expect(apply).toHaveCount(0)
  await expect(discard).toHaveCount(0)
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
})

for (const viewport of smokeViewports) {
  test(`chart, system, and route footer actions fit and receive pointer hits at ${viewport.width}×${viewport.height} @ui-smoke`, async ({ page }) => {
    await createSingleSystemWorkspace(page, {
      clusterName: 'Footer Reach',
      systemName: 'Temporary',
      viewport,
    })
    await importRouteFooterWorkspace(page)

    const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
    if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
    const inspector = page.locator('#workspace-inspector-panel')

    const clusterChartDetailsButton = inspector.getByRole('button', { name: 'Chart details', exact: true }).first()
    if (await clusterChartDetailsButton.getAttribute('aria-pressed') !== 'true') await clusterChartDetailsButton.click()
    const clusterDetails = page.getByRole('region', { name: 'Jump Cluster details', exact: true })
    const clusterActions = clusterDetails.locator('.chart-details-actions')
    const clusterEdit = clusterActions.getByRole('button', { name: 'Edit chart names', exact: true })
    await expectFooterActionToFit(
      clusterDetails,
      clusterEdit,
      viewport,
    )
    await expectFullWidthFooterAction(clusterActions, clusterEdit)

    await closeInspector(page)
    const clusterMap = page.getByRole('group', { name: 'Footer Reach Jump Cluster map', exact: true })
    const systemNode = clusterMap.getByRole('button', { name: 'Select A system', exact: true })
    await systemNode.click()
    await ensureInspectorOpen(page, inspector)
    const selectedSystemDetails = page.getByRole('region', { name: 'Star System details', exact: true })
    const systemActions = selectedSystemDetails.locator('.chart-details-actions')
    const systemEdit = systemActions.getByRole('button', { name: 'Edit chart names', exact: true })
    const openSystem = systemActions.getByRole('button', { name: 'Open system', exact: true })
    await expectFooterActionToFit(
      selectedSystemDetails,
      systemEdit,
      viewport,
    )
    await expectFooterActionToFit(selectedSystemDetails, openSystem, viewport)
    await expectEqualWidthFooterActions(systemActions, systemEdit, openSystem)
    await expect(selectedSystemDetails.getByRole('button', { name: 'Delete A system', exact: true })).toBeVisible()
    if (viewport.width === 390) {
      await test.info().attach('system-chart-footer-390x844', {
        body: await page.screenshot({ animations: 'disabled', fullPage: false }),
        contentType: 'image/png',
      })
    }
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

test('object deletion names the selected target, uses the destructive color, and cancels cleanly @ui-smoke', async ({ page }) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  const map = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  await map.getByRole('button', { name: /^Select A, Primary Star/ }).click()

  const inspector = page.locator('#workspace-inspector-panel')
  const deleteButton = inspector.getByRole('button', { name: 'Delete Primary Star', exact: true })
  await deleteButton.scrollIntoViewIfNeeded()
  await expect(deleteButton).toBeVisible()
  const usesDestructiveColor = await deleteButton.evaluate(element => {
    const sample = document.createElement('span')
    sample.style.color = 'var(--error)'
    document.body.append(sample)
    const expected = getComputedStyle(sample).color
    sample.remove()
    return getComputedStyle(element).color === expected
  })
  expect(usesDestructiveColor).toBe(true)

  await deleteButton.click()
  const review = deletionReviewDialog(page)
  await expect(review).toContainText('Primary Star')
  const cancel = review.getByRole('button', { name: 'Cancel deletion', exact: true })
  await expectFooterActionToFit(review, cancel, { width: 390, height: 844 })
  await cancel.click()
  await expect(review).toBeHidden()
  await closeInspector(page)
  await expect(map.getByRole('button', { name: /Primary Star/ })).toBeVisible()
})
