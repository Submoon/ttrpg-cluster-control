import { expect, campaignTest } from './fixtures'
import {
  openWorkspaceHierarchy,
  setWorkspaceMapMode,
  workspaceNavigation,
} from './helpers'



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
