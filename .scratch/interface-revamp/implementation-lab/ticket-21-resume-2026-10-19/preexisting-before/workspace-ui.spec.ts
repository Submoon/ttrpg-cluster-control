import { expect, test } from '@playwright/test'
import {
  addCatalogueObject,
  catalogueSubtypes,
  clickDockAction,
  editMapObject,
  returnToClusterMap,
  selectCatalogueObjectButton,
  setHeaderMapActionsOpen,
  setWorkspaceMapMode,
  workspaceNavigation,
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

  await expect(page.getByRole('link', { name: 'TTRPG Cluster Control home' })).toBeVisible()
  await expect(page.getByText('TTRPG Cluster Control', { exact: true })).toBeVisible()
  await expect(page).toHaveTitle('TTRPG Cluster Control')
})

test('desktop panels coexist and compact panels become exclusive fullscreen dialogs', async ({ page }) => {
  await createWorkspace(page)

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeVisible()
  await expect(workspaceNavigation(page)).toBeVisible()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Fit map' })).toBeVisible()

  const desktopColumns = await page.evaluate(() => {
    const hierarchy = document.querySelector<HTMLElement>('#workspace-hierarchy-panel')
    const map = document.querySelector<HTMLElement>('.workspace-map-column')
    const inspector = document.querySelector<HTMLElement>('#workspace-inspector-panel')
    if (!hierarchy || !map || !inspector) throw new Error('The three workspace columns are incomplete.')
    const rects = [hierarchy, map, inspector].map(element => element.getBoundingClientRect())
    return {
      hierarchyWidth: rects[0]!.width,
      mapWidth: rects[1]!.width,
      inspectorWidth: rects[2]!.width,
      ordered: rects[0]!.right <= rects[1]!.left && rects[1]!.right <= rects[2]!.left,
    }
  })
  expect(desktopColumns.ordered).toBe(true)
  expect(desktopColumns.hierarchyWidth).toBeGreaterThan(0)
  expect(desktopColumns.mapWidth).toBeGreaterThan(0)
  expect(desktopColumns.inspectorWidth).toBeGreaterThan(0)

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

  await page.setViewportSize({ width: 390, height: 844 })
  await hierarchyToggle.click()
  await expect(hierarchy).toHaveAttribute('role', 'dialog')
  await expect(hierarchy).toHaveAttribute('aria-modal', 'true')
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expect(workspaceNavigation(page)).toBeHidden()
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

  await inspectorToggle.click()
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expect(workspaceNavigation(page)).toBeHidden()
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
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()

  await page.setViewportSize({ width: 479, height: 720 })
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
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 500 })
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

  const clusterSummary = page.getByRole('region', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.locator('[aria-label="Jump Cluster contents"]')
  const selectedSystemSummary = page.getByRole('region', { name: 'Selected Star System summary' })
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(clusterContents).toContainText('0 ROUTES')
  await expect(clusterContents).toContainText('0 JUMP POINTS')
  await expect(selectedSystemSummary).toContainText('Vesper')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kestrel Reach')

  await setHeaderMapActionsOpen(page, true)
  const clusterFiles = page.getByRole('group', { name: 'Map file actions for Jump Cluster Kestrel Reach' })
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster JSON' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster PNG' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Export Jump Cluster SVG' })).toBeVisible()
  await expect(clusterFiles.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(clusterFiles).toContainText('Import JSON creates a separate copy in the current Jump Cluster: Kestrel Reach.')
  expect(await clusterFiles.evaluate(element => element.closest('.workspace-header'))).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Open map file actions for Jump Cluster Kestrel Reach/ }))
    .toBeFocused()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clickDockAction(page, 'Add star system')
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await returnToClusterMap(page)
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(page.getByRole('button', { name: 'Back to Jump Cluster' })).toBeVisible()
  await setHeaderMapActionsOpen(page, true)
  const systemFiles = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  await expect(systemFiles.getByRole('button', { name: 'Export star system JSON' })).toBeVisible()
  await expect(systemFiles.getByRole('button', { name: 'Export star system PNG' })).toBeVisible()
  await expect(systemFiles.getByRole('button', { name: 'Export star system SVG' })).toBeVisible()
})

test('cluster and system names and summaries stay in the header instead of the SVG scene', async ({ page }) => {
  await createWorkspace(page)

  const clusterSummary = page.getByRole('region', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.locator('[aria-label="Jump Cluster contents"]')
  const systemSummary = page.getByRole('region', { name: 'Active Star System summary' })
  const systemContents = page.locator('[aria-label="Star System contents"]')
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(systemSummary).toContainText('Vesper')
  await expect(systemContents).toContainText('1 STARS')
  await expect(systemContents).toContainText('1 OBJECTS')
  await expect(systemContents).toContainText('0 ORBITS')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kestrel Reach')
  await expect(systemSummary.getByRole('heading', { level: 2 })).toHaveText('Vesper')

  const summaryPlacement = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.workspace-header')
    const cluster = document.querySelector<HTMLElement>('[aria-label="Active Jump Cluster summary"]')
    const system = document.querySelector<HTMLElement>('[aria-label="Active Star System summary"]')
    const clusterStats = document.querySelector<HTMLElement>('[aria-label="Jump Cluster contents"]')
    const systemStats = document.querySelector<HTMLElement>('[aria-label="Star System contents"]')
    const map = document.querySelector<SVGSVGElement>('.system-map-svg')
    if (!header || !cluster || !system || !clusterStats || !systemStats || !map) {
      throw new Error('The active summaries or system map are missing.')
    }
    const mapText = Array.from(map.querySelectorAll('text'), element => element.textContent?.trim() ?? '')
    return {
      summariesInHeader: header.contains(cluster) && header.contains(system),
      statsInHeader: header.contains(clusterStats) && header.contains(systemStats),
      statsOutsideScene: !map.contains(clusterStats) && !map.contains(systemStats),
      clusterNameInScene: mapText.includes('Kestrel Reach'),
      systemNameInScene: mapText.includes('Vesper'),
      duplicateSummary: document.querySelectorAll('.editor-heading').length,
    }
  })
  expect(summaryPlacement).toEqual({
    summariesInHeader: true,
    statsInHeader: true,
    statsOutsideScene: true,
    clusterNameInScene: false,
    systemNameInScene: false,
    duplicateSummary: 0,
  })

  await addCatalogueObject(page, 'star')
  await expect(systemContents).toContainText('2 STARS')
  await expect(systemContents).toContainText('2 OBJECTS')
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
  await expect(hierarchy).toBeHidden()
  await expect(inspector).toBeVisible()
  await expect(move).toHaveAttribute('aria-pressed', 'true')
  await hierarchyToggle.click()
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
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeVisible()
  await page.getByRole('button', { name: 'Cancel map object edits' }).click()
  await primaryStar.click()
  page.once('dialog', async dialog => dialog.accept())
  await page.keyboard.press('Delete')
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
    await expect(mapObjects).toHaveCount(objectCount + 1)
    await expect(mapObjects.nth(objectCount).locator('.system-object-glyph')).toHaveText(menuMark!)
  }
})
