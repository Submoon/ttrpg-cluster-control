import { expect, test } from '@playwright/test'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  replaceWorkspaceSystem,
} from '../domain/workspace'
import {
  clickDockAction,
  deletionReviewDialog,
  dockAction,
  editMapObject,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  readInspectorSelection,
  resolveDeletionReview,
  resolveImportReview,
  returnToClusterMap,
  selectInspectorOption,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

function appendNamedObject(
  workspace: ReturnType<typeof createLocalWorkspace>,
  systemId: string,
  subtype: 'jump-point' | 'planet',
  name: string,
) {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)!
  const object = { ...createSystemObject(system, subtype), name }
  return {
    object,
    workspace: replaceWorkspaceSystem(workspace, { ...system, objects: [...system.objects, object] }),
  }
}

function makeRouteReviewWorkspace() {
  let workspace = createLocalWorkspace('Kestrel Reach', 'A')
  const systemA = workspace.cluster.systems[0]!
  const { workspace: withB, system: systemB } = addStarSystem(workspace, 'B')
  workspace = withB

  const origin = appendNamedObject(workspace, systemA.id, 'jump-point', 'A Origin')
  workspace = origin.workspace
  const firstDestination = appendNamedObject(workspace, systemB.id, 'jump-point', 'B Entry')
  workspace = firstDestination.workspace
  const secondDestination = appendNamedObject(workspace, systemB.id, 'jump-point', 'C Entry')
  workspace = secondDestination.workspace
  const route = createJumpRoute(workspace.cluster, 1, origin.object.id, firstDestination.object.id)
  return { ...workspace, cluster: { ...workspace.cluster, routes: [route] } }
}

function makeOrbitReviewWorkspace() {
  const workspace = createLocalWorkspace('Kestrel Reach', 'A')
  const system = workspace.cluster.systems[0]!
  return appendNamedObject(workspace, system.id, 'planet', 'Iria').workspace
}

async function importWorkspaceSeed(
  page: import('@playwright/test').Page,
  workspace: ReturnType<typeof createLocalWorkspace>,
): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill(workspace.cluster.name)
  await page.getByLabel('First star system', { exact: true }).fill('Temporary system')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await returnToClusterMap(page)
  await setJsonFile(
    jsonMapImportInput(page),
    'review-seed.json',
    JSON.stringify(exportJumpCluster(workspace)),
  )
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await expect(page.getByRole('group', { name: `${workspace.cluster.name} Jump Cluster map`, exact: true }))
    .toBeVisible()
}

test('object deletion reviews the current cascade before resolving its inspector draft', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()

  await clickDockAction(page, 'Add orbit', {
    target: { kind: 'host', name: 'Primary Star' },
    noSelection: true,
  })

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await editMapObject(page)
  const nameInput = page.getByLabel('Name', { exact: true })
  await nameInput.fill('Unapplied star')

  const deleteButton = page.getByRole('button', { name: 'Delete Primary Star', exact: true })
  await expect(deleteButton).toBeVisible()
  await expect(deleteButton).toBeEnabled()
  await deleteButton.click()

  const review = page.getByRole('dialog', { name: 'Review deletion', exact: true })
  await expect(review).toBeVisible()
  await expect(review).toContainText('Primary Star')
  await expect(review).toContainText('Orbit 1 around Primary Star')
  await expect(page.getByRole('dialog', { name: 'Edit chart names', exact: true })).toHaveCount(0)
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(review).toBeHidden()
  await expect(nameInput).toHaveValue('Unapplied star')

  await deleteButton.click()
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Confirm deletion', exact: true }).click()

  const inspectorGuard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(inspectorGuard).toBeVisible()
  await inspectorGuard.getByRole('button', { name: 'Apply and continue', exact: true }).click()

  await expect(inspectorGuard).toBeHidden()
  await expect(review).toBeVisible()
  await expect(review).toContainText('Unapplied star')
  await expect(review).toContainText('Orbit 1 around Unapplied star')
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(review).toBeHidden()

  await expect(hierarchy.getByRole('button', { name: 'Select A, Unapplied star', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unapplied star')
})

test('deletion review refreshes route endpoint effects after applying a changed route draft', async ({ page }) => {
  const workspace = makeRouteReviewWorkspace()
  await importWorkspaceSeed(page, workspace)

  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('button', { name: /Select Jump Level 1:.*A Origin.*B Entry/ }).click()

  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await routeInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await selectInspectorOption(routeInspector.getByLabel('To Jump Point'), 'C Entry (B)')

  await hierarchy.getByRole('button', { name: 'Delete A system', exact: true }).click()
  const review = deletionReviewDialog(page)
  await expect(review).toContainText('Jump Route (Level 1)')
  await review.getByRole('button', { name: 'Confirm deletion', exact: true }).click()

  const routeGuard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(routeGuard).toBeVisible()
  await routeGuard.getByRole('button', { name: 'Apply and continue', exact: true }).click()

  await expect(review).toBeVisible()
  await expect(review).toContainText('C Entry')
  await resolveDeletionReview(review, 'cancel')
})

test('deleting an Orbit host prunes only its pending Add target and keeps the other inputs', async ({ page }) => {
  await importWorkspaceSeed(page, makeOrbitReviewWorkspace())
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open A system map', exact: true }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await (await dockAction(page, 'Add orbit')).click()

  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  const placement = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  const host = page.getByLabel('Orbit center or host', { exact: true })
  await selectInspectorOption(host, 'Around Primary Star')
  await page.getByLabel('Horizontal radius', { exact: true }).fill('39')
  await page.getByLabel('Vertical radius', { exact: true }).fill('80')
  await page.getByLabel('Rotation', { exact: true }).fill('37')
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()
  await expect(host).toBeHidden()

  await page.getByRole('button', { name: 'Delete Primary Star', exact: true }).click()
  const review = deletionReviewDialog(page)
  await resolveDeletionReview(review, 'confirm')

  await expect(controls).toBeVisible()
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect.poll(() => readInspectorSelection(host)).toBe('Unoccupied center')
  await expect(page.getByLabel('Horizontal radius', { exact: true })).toHaveValue('39')
  await expect(page.getByLabel('Vertical radius', { exact: true })).toHaveValue('80')
  await expect(page.getByLabel('Rotation', { exact: true })).toHaveValue('37')

  await selectInspectorOption(host, 'Around Iria')
  await page.getByRole('form', { name: 'Placement', exact: true }).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria/ })).toBeVisible()
})

test('current-system deletion uses the review flow and protects the final system', async ({ page }) => {
  const workspace = addStarSystem(createLocalWorkspace('Kestrel Reach', 'A'), 'B').workspace
  await importWorkspaceSeed(page, workspace)

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open A system map', exact: true }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  const deleteCurrent = inspector.getByRole('button', { name: 'Delete A system', exact: true })
  await expect(deleteCurrent).toBeVisible()
  await deleteCurrent.click()
  const review = deletionReviewDialog(page)
  await expect(review).toContainText('A')
  await resolveDeletionReview(review, 'cancel')
  await expect(page.getByRole('group', { name: 'A star system map', exact: true })).toBeVisible()

  await deleteCurrent.click()
  await resolveDeletionReview(review, 'confirm')
  await expect(page.getByRole('group', { name: 'A star system map', exact: true })).toHaveCount(0)
})

test('the current-system inspector disables deletion of the final system', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('A')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector.getByRole('button', { name: 'Delete A system', exact: true })).toBeDisabled()
  await expect(inspector.getByText('A Jump Cluster must keep at least one star system.', { exact: true })).toBeVisible()
})
