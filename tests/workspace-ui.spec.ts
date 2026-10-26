import { expect, test } from '@playwright/test'
import { deletionReviewDialog, resolveDeletionReview } from './helpers'
import {
  addCatalogueObject,
  addClusterSystem,
  catalogueSubtypes,
  completeCatalogueObjectCreation,
  editMapObject,
  openChartDetails,
  returnToClusterMap,
  selectCatalogueObjectButton,
  setHeaderMapActionsOpen,
  setWorkspaceMapMode,
  openWorkspaceZoomNavigation,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
}

test('the application exposes its generic brand visibly and accessibly', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('banner')).toContainText('TTRPG Cluster Control')
  await expect(page.getByText('TTRPG Cluster Control', { exact: true })).toBeVisible()
  await expect(page).toHaveTitle('TTRPG Cluster Control')
})

test('Hierarchy starts closed, desktop panels overlay the map, and compact panels stay exclusive', async ({ page }) => {
  await createWorkspace(page)

  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  const zoomControls = workspaceZoomControls(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeVisible()
  await expect(workspaceNavigation(page)).toBeVisible()
  await expect(zoomControls.getByRole('button', { name: 'Fit map' })).toBeVisible()

  const boardBounds = await page.locator('[data-map-board]').boundingBox()
  const mapBounds = await map.boundingBox()
  if (!boardBounds || !mapBounds) throw new Error('The full-map board did not render.')
  expect(boardBounds.x).toBeLessThanOrEqual(1)
  expect(boardBounds.width).toBeGreaterThanOrEqual(1400)
  expect(mapBounds.width).toBeGreaterThan(900)

  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
  const overlayHitTest = await page.evaluate(() => {
    const hierarchy = document.querySelector<HTMLElement>('#workspace-hierarchy-panel')
    const inspector = document.querySelector<HTMLElement>('#workspace-inspector-panel')
    if (!hierarchy || !inspector) throw new Error('The visible workspace panels are missing.')
    const hitIsInside = (panel: HTMLElement) => {
      const bounds = panel.getBoundingClientRect()
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      return !!hit && panel.contains(hit)
    }
    return { hierarchyHit: hitIsInside(hierarchy), inspectorHit: hitIsInside(inspector) }
  })
  expect(overlayHitTest).toEqual({ hierarchyHit: true, inspectorHit: true })

  await hierarchyToggle.click()
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeVisible()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await inspectorToggle.click()
  await expect(inspector).toBeHidden()
  await expect(hierarchy).toBeVisible()
  await inspectorToggle.click()
  await expect(inspector).toBeVisible()

  await hierarchyToggle.click()
  await inspectorToggle.click()
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })

  const zoomNavigation = await openWorkspaceZoomNavigation(page)
  const zoomToggle = page.getByRole('toolbar', { name: 'Map zoom controls', includeHidden: true })
    .getByRole('button', { name: 'Open map navigation controls', includeHidden: true })
  await expect(zoomNavigation.getByRole('slider', { name: 'Map zoom level' })).toBeVisible()
  await hierarchyToggle.click()
  await expect(hierarchy).toHaveAttribute('role', 'dialog')
  await expect(hierarchy).toHaveAttribute('aria-modal', 'true')
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expect(workspaceNavigation(page)).toBeHidden()
  await expect(zoomToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('slider', { name: 'Map zoom level' })).toBeHidden()
  const hierarchyBounds = await hierarchy.boundingBox()
  if (!hierarchyBounds) throw new Error('The compact Hierarchy panel has no visible bounds.')
  expect(hierarchyBounds.x).toBeLessThanOrEqual(1)
  expect(hierarchyBounds.y).toBeLessThanOrEqual(1)
  expect(hierarchyBounds.width).toBeGreaterThanOrEqual(388)
  expect(hierarchyBounds.height).toBeGreaterThanOrEqual(842)
  await page.getByRole('button', { name: 'Close hierarchy panel' }).click()
  await expect(hierarchyToggle).toBeFocused()
  await expect(workspaceNavigation(page)).toBeVisible()

  await openWorkspaceZoomNavigation(page)
  await inspectorToggle.click()
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expect(workspaceNavigation(page)).toBeHidden()
  await expect(zoomToggle).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Close inspector panel' }).click()
  await expect(inspectorToggle).toBeFocused()
  await expect(workspaceNavigation(page)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('the Add to map palette stays reachable inside its Dock popover at desktop and compact widths', async ({ page }) => {
  await createWorkspace(page)

  const openPalette = async () => {
    await page.getByRole('button', { name: 'Add to map', exact: true }).click()
    const palette = page.getByRole('region', { name: 'Object palette' })
    await expect(palette).toBeVisible()
    return palette
  }
  const assertReachable = async (palette: import('@playwright/test').Locator) => {
    const buttons = palette.getByRole('button', { name: /^Add / })
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      await expect(button).toBeVisible()
      expect(await button.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return target === element || element.contains(target)
      })).toBe(true)
    }
  }

  let palette = await openPalette()
  await assertReachable(palette)
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await hierarchyToggle.click()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'true')
  await inspectorToggle.click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')

  await page.setViewportSize({ width: 479, height: 720 })
  await expect(workspaceNavigation(page)).toBeVisible()
  palette = await openPalette()
  await assertReachable(palette)
  const menuBounds = await palette.boundingBox()
  if (!menuBounds) throw new Error('The compact Add to map palette has no visible bounds.')
  expect(menuBounds.x).toBeGreaterThanOrEqual(0)
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(479)
  expect(menuBounds.y).toBeGreaterThanOrEqual(0)
  expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(720)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('object categories reveal their matching catalogue actions on narrow screens', async ({ page }) => {
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Add to map', exact: true }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const categories = palette.getByRole('group', { name: 'Object categories' })
  const categoryButtons = categories.getByRole('button')
  const activeItems = palette.locator('.object-palette-items')
  await expect(categoryButtons).toHaveCount(7)
  await expect(categoryButtons.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Celestial bodies')
  await expect(activeItems.getByRole('button')).toHaveCount(3)
  await expect(palette.getByRole('button', { name: 'Add Star' })).toBeVisible()

  await categories.getByRole('button', { name: 'Small bodies and fields' }).click()
  await expect(categories.getByRole('button', { name: 'Small bodies and fields' }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Small bodies and fields')
  await expect(activeItems.getByRole('button')).toHaveCount(2)
  await expect(palette.getByRole('button', { name: 'Add Asteroid' })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Add Star' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await hierarchyToggle.click()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'true')
  await inspectorToggle.click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await page.setViewportSize({ width: 390, height: 500 })
  await expect(workspaceNavigation(page)).toBeVisible()
  await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  await expect(categories.getByRole('button', { name: 'Small bodies and fields' }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await expect(palette).toBeVisible()
  const asteroidButton = palette.getByRole('button', { name: 'Add Asteroid' })
  await expect(asteroidButton).toBeVisible()
  expect(await asteroidButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return target === element || element.contains(target)
  })).toBe(true)
})

test('cluster creation actions and Map files follow the active map context', async ({ page }) => {
  await createWorkspace(page)
  await returnToClusterMap(page)

  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context.getByRole('heading', { name: 'Kestrel Reach' })).toBeVisible()
  const clusterDetails = await openChartDetails(page)
  const clusterStats = clusterDetails.getByRole('region', { name: 'Jump Cluster statistics' })
  await expect(clusterStats.getByText('Star systems', { exact: true })).toBeVisible()
  await expect(clusterStats.locator('strong').nth(0)).toHaveText('1')
  await expect(clusterStats.locator('strong').nth(1)).toHaveText('0')
  await expect(clusterStats.locator('strong').nth(2)).toHaveText('0')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()

  await setHeaderMapActionsOpen(page, true)
  const clusterFiles = page.getByRole('group', { name: 'Map file actions for Jump Cluster Kestrel Reach' })
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster JSON' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster PNG' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster SVG' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(clusterFiles).toContainText('Import JSON creates a separate copy in the current Jump Cluster: Kestrel Reach.')
  expect(await clusterFiles.evaluate(element => element.closest('.workspace-header'))).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Map files', exact: true })).toBeFocused()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(context.getByRole('heading', { name: 'Vesper' })).toBeVisible()
  await setHeaderMapActionsOpen(page, true)
  const systemFiles = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  await expect(systemFiles.getByRole('button', { name: 'Export star system JSON' })).toBeVisible()
  await expect(systemFiles.getByRole('button', { name: 'Export star system PNG' })).toBeVisible()
  await expect(systemFiles.getByRole('button', { name: 'Export star system SVG' })).toBeVisible()
})

test('Map context and consultation details retain chart names and counts outside the SVG', async ({ page }) => {
  await createWorkspace(page)

  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(context.getByRole('heading', { name: 'Vesper' })).toBeVisible()
  const systemDetails = await openChartDetails(page)
  await expect(systemDetails.getByRole('heading', { name: 'Vesper', level: 2 })).toBeVisible()
  const systemStats = systemDetails.getByRole('region', { name: 'Star System statistics' })
  await expect(systemStats.getByText('Map objects', { exact: true })).toBeVisible()
  await expect(systemStats.locator('strong').nth(0)).toHaveText('1')
  await expect(systemStats.locator('strong').nth(1)).toHaveText('1')
  await expect(systemStats.locator('strong').nth(2)).toHaveText('0')
  const svgLabels = await systemMap.locator('text').allTextContents()
  expect(svgLabels).not.toContain('Kestrel Reach')
  expect(svgLabels).not.toContain('Vesper')

  await returnToClusterMap(page)
  await expect(context.getByRole('heading', { name: 'Kestrel Reach' })).toBeVisible()
  const clusterDetails = await openChartDetails(page)
  await expect(clusterDetails.getByRole('heading', { name: 'Kestrel Reach', level: 2 })).toBeVisible()
  const clusterStats = clusterDetails.getByRole('region', { name: 'Jump Cluster statistics' })
  await expect(clusterStats.locator('strong').nth(0)).toHaveText('1')
  await expect(clusterStats.locator('strong').nth(1)).toHaveText('0')
  await expect(clusterStats.locator('strong').nth(2)).toHaveText('0')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await addCatalogueObject(page, 'star')
  const updatedDetails = await openChartDetails(page)
  const updatedStats = updatedDetails.getByRole('region', { name: 'Star System statistics' })
  await expect(updatedStats.locator('strong').nth(0)).toHaveText('2')
  await expect(updatedStats.locator('strong').nth(1)).toHaveText('2')
  await expect(updatedStats.locator('strong').nth(2)).toHaveText('0')
})

test('panel toggles preserve the active mode and Delete remains safe while editing', async ({ page }) => {
  await createWorkspace(page)

  const navigation = workspaceNavigation(page)
  const move = navigation.getByRole('button', { name: 'Move', exact: true })
  await setWorkspaceMapMode(page, 'Move')
  await expect(move).toHaveAttribute('aria-pressed', 'true')

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  await hierarchyToggle.click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
  await expect(move).toHaveAttribute('aria-pressed', 'true')
  await inspectorToggle.click()
  await expect(inspector).toBeHidden()
  await expect(hierarchy).toBeVisible()
  await inspectorToggle.click()
  await expect(inspector).toBeVisible()
  await expect(move).toHaveAttribute('aria-pressed', 'true')

  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  await editMapObject(page)
  const nameInput = page.getByLabel('Name', { exact: true })
  await nameInput.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Delete')
  await expect(nameInput).toHaveValue('')
  await expect(primaryStar).toBeVisible()
  await page.getByRole('button', { name: 'Cancel map object edits' }).click()
  await primaryStar.click()
  await page.keyboard.press('Delete')
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Primary Star')
  await resolveDeletionReview(deletionReview, 'confirm')
  await expect(primaryStar).toBeHidden()
})

test('every catalogue glyph matches the corresponding Add object action', async ({ page }) => {
  await createWorkspace(page)

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const mapObjects = map.locator('.system-object')

  for (const subtype of catalogueSubtypes) {
    const button = await selectCatalogueObjectButton(page, subtype)
    const menuMark = (await button.locator('.object-mark').textContent())?.trim()
    const objectCount = await mapObjects.count()
    await button.click()
    await completeCatalogueObjectCreation(page, subtype, { noSelection: true })
    await expect(mapObjects).toHaveCount(objectCount + 1)
    await expect(mapObjects.nth(objectCount).locator('.system-object-glyph')).toHaveText(menuMark!)
  }
})
