import { expect, campaignTest } from './fixtures'
import {
  activeWorkspaceFeedback,
  openWorkspaceHierarchy,
  selectInspectorOption,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'

campaignTest('selecting a parent Orbit tree item keeps a dirty nested object draft until accepted', async ({ campaignWorkspacePage: page }) => {
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  await expect(iria).toBeVisible()
  await iria.click()
  await expect(iria).toHaveAttribute('aria-selected', 'true')

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const draftName = 'Iria discard stays unapplied'
  const nameField = inspector.getByLabel('Name', { exact: true })
  await nameField.fill(draftName)
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()

  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  const mapContent = map.locator('.system-map-content')
  const cameraBefore = await mapContent.getAttribute('transform')
  if (!cameraBefore) throw new Error('The system map has no rendered camera transform.')
  const selectedObject = map.locator('.system-object.is-selected')
  await expect(selectedObject).toHaveCount(1)
  const selectedObjectId = await selectedObject.getAttribute('data-object-id')
  if (!selectedObjectId) throw new Error('The selected object has no stable map identity.')

  await primaryOrbit.click()
  let guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()

  await expect(guard).toBeHidden()
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-selected', 'false')
  await expect(nameField).toHaveValue(draftName)
  await expect(inspector.getByText('Unapplied changes', { exact: true })).toBeVisible()
  await expect(selectedObject).toHaveAttribute('data-object-id', selectedObjectId)
  await expect(mapContent).toHaveAttribute('transform', cameraBefore)

  await primaryOrbit.click()
  guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Discard edits and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()

  await expect(guard).toBeHidden()
  await expect(iria).toHaveAttribute('aria-selected', 'false')
  await expect(primaryOrbit).toHaveAttribute('aria-selected', 'true')
  await expect(map.locator('.orbit-mark.is-selected')).toHaveCount(1)
  await expect(map.locator('.system-object.is-selected')).toHaveCount(0)
})

campaignTest('tree keyboard expansion and shortcuts stay local through hierarchy hide and compact reflow', async ({ campaignWorkspacePage: page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()

  let hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const departure = hierarchy.getByRole('treeitem', { name: 'Select JP-01, Vesper Departure', exact: true })
  await testInfo.attach('hierarchy-tree-expanded', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  await primaryStar.click()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.type('Iria')
  await expect(iria).toBeFocused()

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await testInfo.attach('hierarchy-tree-collapsed', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
  await expect(iria).toBeHidden()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowRight')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await expect(iria).toBeVisible()
  await page.keyboard.press('Home')
  await expect(primaryStar).toBeFocused()
  await page.keyboard.press('End')
  await expect(departure).toBeFocused()

  await setWorkspaceMapMode(page, 'Navigate')
  await iria.focus()
  const navigation = workspaceNavigation(page)
  const navigateButton = navigation.getByRole('button', { name: 'Navigate', exact: true })
  const selectButton = navigation.getByRole('button', { name: 'Select', exact: true })
  const moveButton = navigation.getByRole('button', { name: 'Move', exact: true })
  const addButton = navigation.getByRole('button', { name: 'Add to map', exact: true })
  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  const selectedMapObject = map.locator('.system-object.is-selected')
  await expect(selectedMapObject).toHaveAttribute('data-object-id', /.+/)
  const selectedObjectId = await selectedMapObject.getAttribute('data-object-id')
  if (!selectedObjectId) throw new Error('The selected map object has no stable identity.')

  for (const key of ['n', 's', 'm', 'a']) {
    await page.keyboard.press(key)
    await expect(navigateButton).toHaveAttribute('aria-pressed', 'true')
    await expect(selectButton).toHaveAttribute('aria-pressed', 'false')
    await expect(moveButton).toHaveAttribute('aria-pressed', 'false')
    await expect(addButton).toHaveAttribute('aria-expanded', 'false')
    await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
    await expect(selectedMapObject).toHaveAttribute('data-object-id', selectedObjectId)
  }

  await primaryOrbit.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await expect(hierarchy).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const compactPrimaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  await expect(compactPrimaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })).toBeHidden()
  await expect(hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }))
    .toHaveAttribute('aria-selected', 'true')
})

campaignTest('map selection and relationship Undo/Redo reveal nested rows without moving focus into the tree', async ({ campaignWorkspacePage: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  const primaryOrbit = hierarchy.getByRole('treeitem', {
    name: 'Orbit 1 around Primary Star, 1 object',
    exact: true,
  })
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const nix = hierarchy.getByRole('treeitem', { name: 'Select MO-01, Nix', exact: true })
  await nix.click()

  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await selectInspectorOption(inspector.getByLabel('Placement', { exact: true }), 'System-level position')
  await inspector.getByRole('button', { name: /Apply changes/ }).click()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device', { exact: true })).toBeVisible()
  await expect(nix).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')

  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  const mapContent = map.locator('.system-map-content')
  const cameraBeforeTraversal = await mapContent.getAttribute('transform')
  if (!cameraBeforeTraversal) throw new Error('The system map has no rendered camera transform.')
  const mapNix = map.getByRole('button', { name: 'Select MO-01, Nix (Moon)', exact: true })
  const mapPrimaryStar = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  const historyControls = page.locator('.workspace-history-controls')
  const undo = historyControls.getByRole('button', { name: /^Undo(?:\b|:)/, includeHidden: true })
  const redo = historyControls.getByRole('button', { name: /^Redo(?:\b|:)/, includeHidden: true })

  await hierarchy.getByRole('button', {
    name: 'Collapse Orbit 1 around Primary Star, 1 object',
    exact: true,
  }).click()
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'false')
  await expect(iria).toBeHidden()

  await undo.click()
  await expect(redo).toBeEnabled()
  await expect(hierarchy.locator(':focus')).toHaveCount(0)
  await expect(nix).toBeVisible()
  await expect(nix).toHaveAttribute('aria-selected', 'true')
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await expect(iria).toBeVisible()

  await redo.click()
  await expect(undo).toBeEnabled()
  await expect(hierarchy.locator(':focus')).toHaveCount(0)
  await expect(nix).toBeVisible()
  await expect(nix).toHaveAttribute('aria-selected', 'true')

  await undo.click()
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await mapPrimaryStar.click()
  await expect(primaryStar).toHaveAttribute('aria-selected', 'true')
  await hierarchy.getByRole('button', {
    name: 'Collapse Orbit 1 around Primary Star, 1 object',
    exact: true,
  }).click()
  await expect(nix).toBeHidden()

  await mapNix.click()
  await expect(primaryOrbit).toHaveAttribute('aria-expanded', 'true')
  await expect(iria).toBeVisible()
  await expect(nix).toBeVisible()
  await expect(nix).toHaveAttribute('aria-selected', 'true')
  await expect(nix).not.toBeFocused()
  await expect(mapNix).toBeFocused()
  await expect(mapContent).toHaveAttribute('transform', cameraBeforeTraversal)
})
