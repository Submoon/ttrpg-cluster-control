import { expect, test } from '@playwright/test'
import { setHeaderMapActionsOpen, editMapObject, catalogueSubtypes, selectCatalogueObjectButton } from './helpers'

test('the dark map-first workspace stays usable at narrow viewport widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const hierarchyPanel = page.getByRole('complementary', { name: 'Jump Cluster contents' })
  const inspectorPanel = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const desktopLayout = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.editor-grid')
    const map = grid?.querySelector<HTMLElement>('.map-frame')
    const hierarchy = grid?.querySelector<HTMLElement>('.hierarchy-panel')
    const inspector = grid?.querySelector<HTMLElement>('.inspector-panel')
    if (!grid || !map || !hierarchy || !inspector) throw new Error('The map workspace layout is incomplete.')
    return {
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      mapWidth: map.getBoundingClientRect().width,
      hierarchyWidth: hierarchy.getBoundingClientRect().width,
      inspectorWidth: inspector.getBoundingClientRect().width,
      mapTop: map.getBoundingClientRect().top,
      gridHeight: grid.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })
  expect(desktopLayout.colorScheme).toBe('dark')
  expect(desktopLayout.mapWidth).toBeGreaterThan(desktopLayout.viewportWidth * 0.9)
  expect(desktopLayout.mapWidth).toBeGreaterThan(desktopLayout.hierarchyWidth * 2)
  expect(desktopLayout.inspectorWidth).toBeGreaterThan(0)
  expect(desktopLayout.gridHeight).toBeGreaterThanOrEqual(desktopLayout.viewportHeight * 0.75)
  await expect(hierarchyPanel).toBeVisible()
  await expect(inspectorPanel).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Fit map' }))
    .toBeVisible()

  const collapseHierarchy = page.getByRole('button', { name: 'Collapse hierarchy panel' })
  await expect(collapseHierarchy.locator('span')).toHaveText('‹')
  await collapseHierarchy.click()
  await expect(hierarchyPanel).toBeHidden()
  const reopenHierarchy = page.getByRole('button', { name: 'Show hierarchy panel' })
  await expect(reopenHierarchy).toBeVisible()
  const hierarchyTabBounds = await reopenHierarchy.boundingBox()
  if (!hierarchyTabBounds) throw new Error('The hierarchy panel reopen tab is not visible.')
  expect(hierarchyTabBounds.x).toBe(0)
  expect(hierarchyTabBounds.height).toBeGreaterThan(hierarchyTabBounds.width)
  await reopenHierarchy.click()
  await expect(hierarchyPanel).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileLayout = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.editor-grid')
    const map = grid?.querySelector<HTMLElement>('.map-frame')
    const hierarchy = grid?.querySelector<HTMLElement>('.hierarchy-panel')
    if (!map || !hierarchy) throw new Error('The map workspace layout is incomplete.')
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mapTop: map.getBoundingClientRect().top,
      hierarchyTop: hierarchy.getBoundingClientRect().top,
    }
  })
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth)
  expect(mobileLayout.mapTop).toBeLessThan(mobileLayout.hierarchyTop)
  await expect(inspectorPanel).toBeHidden()
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Fit map' }))
    .toBeVisible()
  const inspectorTabBounds = await page.getByRole('button', { name: 'Show inspector panel' }).boundingBox()
  if (!inspectorTabBounds) throw new Error('The inspector panel reopen tab is not visible.')
  expect(inspectorTabBounds.x + inspectorTabBounds.width).toBe(mobileLayout.viewportWidth)
  expect(inspectorTabBounds.height).toBeGreaterThan(inspectorTabBounds.width)

  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspectorPanel).toBeVisible()
  await expect(hierarchyPanel).toBeHidden()
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchyPanel).toBeVisible()
  await expect(inspectorPanel).toBeHidden()
})

test('the object palette clears the header summary and adapts to narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const clusterMapButton = page.getByRole('button', { name: 'Cluster map' })
  const layout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button'))
    const clusterMapButton = buttons.find(button => button.textContent?.trim() === 'Cluster map')
    const chartDetailsButton = buttons.find(button => button.textContent?.trim() === 'Chart details')
    const mapCanvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const hierarchy = document.querySelector<HTMLElement>('#workspace-hierarchy-panel')
    const inspector = document.querySelector<HTMLElement>('#workspace-inspector-panel')
    const mapSvg = document.querySelector<SVGSVGElement>('.system-map-canvas .system-map-svg')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (!palette || !clusterMapButton || !mapCanvas || !hierarchy || !inspector || !mapSvg || !summary || !tools) {
      throw new Error('The map editing controls are incomplete.')
    }
    const background = getComputedStyle(clusterMapButton).backgroundColor
    const paletteBounds = palette.getBoundingClientRect()
    const mapBounds = mapCanvas.getBoundingClientRect()
    const hierarchyBounds = hierarchy.getBoundingClientRect()
    const inspectorBounds = inspector.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const toolsBounds = tools.getBoundingClientRect()
    const objectButtons = Array.from(
      palette.querySelectorAll<HTMLElement>('.object-palette-items .object-palette-button'),
    )
    return {
      paletteFloatsAboveMap: palette.closest('.map-tools') !== null,
      addOrbitGroupedWithPalette: palette.contains(document.querySelector('[aria-label="Add orbit"]')),
      noMapToolbar: tools.querySelector('.map-toolbar') === null,
      paletteCenteredInViewport: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      noFloatingSummary: document.querySelector('.editor-heading') === null,
      allObjectButtonsFit: objectButtons.length > 0 && objectButtons.every((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= paletteBounds.left
          && bounds.right <= paletteBounds.right
          && bounds.top >= paletteBounds.top
          && bounds.bottom <= paletteBounds.bottom
      }),
      objectButtonCount: objectButtons.length,
      toolsClearPanels: toolsBounds.bottom <= hierarchyBounds.top
        && toolsBounds.bottom <= inspectorBounds.top,
      clusterButtonIsOpaque: background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent',
      clusterButtonInHierarchy: Boolean(clusterMapButton?.closest('#workspace-hierarchy-panel')),
      chartDetailsButtonInInspector: Boolean(
        chartDetailsButton?.closest('#workspace-inspector-panel'),
      ),
      mapFillsCanvas: mapSvg.getBoundingClientRect().height / mapBounds.height >= 0.92,
    }
  })
  expect({
    paletteFloatsAboveMap: layout.paletteFloatsAboveMap,
    addOrbitGroupedWithPalette: layout.addOrbitGroupedWithPalette,
    noMapToolbar: layout.noMapToolbar,
    paletteCenteredInViewport: layout.paletteCenteredInViewport,
    paletteBelowHeader: layout.paletteBelowHeader,
    noFloatingSummary: layout.noFloatingSummary,
    allObjectButtonsFit: layout.allObjectButtonsFit,
    activeCategoryOnly: layout.objectButtonCount === 3,
    toolsClearPanels: layout.toolsClearPanels,
    clusterButtonIsOpaque: layout.clusterButtonIsOpaque,
    clusterButtonInHierarchy: layout.clusterButtonInHierarchy,
    chartDetailsButtonInInspector: layout.chartDetailsButtonInInspector,
    mapFillsCanvas: layout.mapFillsCanvas,
  }).toEqual({
    paletteFloatsAboveMap: true,
    addOrbitGroupedWithPalette: true,
    noMapToolbar: true,
    paletteCenteredInViewport: true,
    paletteBelowHeader: true,
    noFloatingSummary: true,
    allObjectButtonsFit: true,
    activeCategoryOnly: true,
    toolsClearPanels: true,
    clusterButtonIsOpaque: true,
    clusterButtonInHierarchy: true,
    chartDetailsButtonInInspector: true,
    mapFillsCanvas: true,
  })
  await expect(palette).toBeVisible()
  await expect(page.locator('.header-map-actions-toggle')).toBeVisible()
  await expect(clusterMapButton).toBeVisible()

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    const hierarchy = document.querySelector<HTMLElement>('.system-map-editor-grid .hierarchy-panel')
    const panelToggles = Array.from(
      document.querySelectorAll<HTMLElement>('.system-map-editor-grid .panel-reopen'),
    )
    if (!palette || !summary || !tools || !hierarchy) {
      throw new Error('The map palette, summary, or hierarchy panel is unavailable.')
    }

    const paletteBounds = palette.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const toolsBounds = tools.getBoundingClientRect()
    const hierarchyBounds = hierarchy.getBoundingClientRect()
    const buttons = Array.from(
      palette.querySelectorAll<HTMLElement>('.object-palette-items .object-palette-button'),
    )
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      objectButtonCount: buttons.length,
      headerWithinViewport: summaryBounds.left >= 0 && summaryBounds.right <= window.innerWidth,
      centered: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      belowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      toolbarClearsHierarchy: toolsBounds.bottom <= hierarchyBounds.top,
      toolbarClearsPanelToggles: panelToggles.every((toggle) => {
        const bounds = toggle.getBoundingClientRect()
        return toolsBounds.right <= bounds.left || toolsBounds.left >= bounds.right
          || toolsBounds.bottom <= bounds.top || toolsBounds.top >= bounds.bottom
      }),
      allButtonsFit: buttons.length > 0 && buttons.every((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= paletteBounds.left
          && bounds.right <= paletteBounds.right
          && bounds.top >= paletteBounds.top
          && bounds.bottom <= paletteBounds.bottom
      }),
    }
  })
  expect(narrowLayout.documentWidth).toBeLessThanOrEqual(narrowLayout.viewportWidth)
  expect(narrowLayout.headerWithinViewport).toBe(true)
  expect(narrowLayout.centered).toBe(true)
  expect(narrowLayout.belowHeader).toBe(true)
  expect(narrowLayout.toolbarClearsHierarchy).toBe(true)
  expect(narrowLayout.toolbarClearsPanelToggles).toBe(true)
  expect(narrowLayout.objectButtonCount).toBe(3)
  expect(narrowLayout.allButtonsFit).toBe(true)

  await page.setViewportSize({ width: 479, height: 252 })
  const compactLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const navigation = document.querySelector<HTMLElement>('.map-navigation')
    const panelToggles = Array.from(
      document.querySelectorAll<HTMLElement>('.system-map-editor-grid .panel-reopen'),
    )
    if (!palette || !summary || !navigation) {
      throw new Error('The map palette, summary, or navigation is unavailable.')
    }

    const paletteBounds = palette.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const navigationBounds = navigation.getBoundingClientRect()
    const actions = Array.from(palette.querySelectorAll<HTMLElement>('.object-palette-button'))
    const overlaps = (first: DOMRect, second: DOMRect) =>
      first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top

    return {
      paletteCentered: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      headerWithinViewport: summaryBounds.left >= 0 && summaryBounds.right <= window.innerWidth,
      paletteWithinViewport: paletteBounds.top >= 0 && paletteBounds.bottom <= window.innerHeight,
      allActionsVisible: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight
      }),
      allActionsReachable: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        const target = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        return target === action || action.contains(target)
      }),
      navigationClearsPalette: !overlaps(navigationBounds, paletteBounds),
      panelsClearTools: panelToggles.every((toggle) => {
        const bounds = toggle.getBoundingClientRect()
        return !overlaps(bounds, paletteBounds) && !overlaps(bounds, navigationBounds)
      }),
    }
  })
  expect(compactLayout).toEqual({
    paletteCentered: true,
    paletteBelowHeader: true,
    headerWithinViewport: true,
    paletteWithinViewport: true,
    allActionsVisible: true,
    allActionsReachable: true,
    navigationClearsPalette: true,
    panelsClearTools: true,
  })
})

test('object category tabs reveal one group and fit on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const categories = palette.getByRole('group', { name: 'Object categories' })
  const tabs = categories.getByRole('button')
  const activeItems = palette.locator('.object-palette-items')
  await expect(page.locator('.editor-heading')).toHaveCount(0)
  await expect(tabs).toHaveCount(7)
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Celestial bodies')
  await expect(activeItems.getByRole('button')).toHaveCount(3)
  await expect(palette.getByRole('button', { name: 'Add orbit' })).toBeVisible()

  const desktopLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    if (!summary || !palette) throw new Error('The header summary or object palette is missing.')
    const summaryBounds = summary.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    return {
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      paletteCenteredInViewport: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
    }
  })
  expect(desktopLayout).toEqual({
    paletteBelowHeader: true,
    paletteCenteredInViewport: true,
  })

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (!summary || !tools) throw new Error('The header summary or object palette is missing.')
    return {
      toolsBelowHeader: tools.getBoundingClientRect().top
        >= summary.getBoundingClientRect().bottom + 4,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(narrowLayout).toEqual({
    toolsBelowHeader: true,
    noHorizontalOverflow: true,
  })

  await categories.getByRole('button', { name: 'Small bodies and fields' }).click()
  await expect(categories.getByRole('button', { name: 'Small bodies and fields' }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Small bodies and fields')
  await expect(activeItems.getByRole('button')).toHaveCount(2)
  await expect(palette.getByRole('button', { name: 'Add Asteroid' })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Add Star' })).toHaveCount(0)

  await page.setViewportSize({ width: 479, height: 252 })
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)
  const compactLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const categories = palette?.querySelector<HTMLElement>('.object-palette-categories')
    if (!palette || !categories) throw new Error('The object palette categories are missing.')

    const categoryBounds = categories.getBoundingClientRect()
    const actions = Array.from(palette.querySelectorAll<HTMLElement>('.object-palette-button'))
    const categoryButtons = Array.from(categories.querySelectorAll<HTMLButtonElement>('button'))
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      categoriesWithinViewport: categoryBounds.left >= 0 && categoryBounds.right <= window.innerWidth,
      categoriesCanScroll: categories.scrollWidth > categories.clientWidth,
      categoryButtonsFocusable: categoryButtons.length === 7
        && categoryButtons.every(button => button.tabIndex >= 0),
      actionsFit: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight
          && bounds.left >= 0 && bounds.right <= window.innerWidth
      }),
    }
  })
  expect(compactLayout).toEqual({
    noHorizontalOverflow: true,
    categoriesWithinViewport: true,
    categoriesCanScroll: true,
    categoryButtonsFocusable: true,
    actionsFit: true,
  })

  const finalCategory = categories.getByRole('button', { name: 'Other' })
  await finalCategory.focus()
  expect(await finalCategory.evaluate((button) => {
    const categories = button.closest<HTMLElement>('.object-palette-categories')
    if (!categories) return false
    const categoryBounds = categories.getBoundingClientRect()
    const buttonBounds = button.getBoundingClientRect()
    return buttonBounds.left >= categoryBounds.left && buttonBounds.right <= categoryBounds.right
  })).toBe(true)
})

test('cluster creation actions stay in their palette and header file actions follow the active map', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const clusterSummary = page.getByRole('group', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.getByRole('group', { name: 'Current Jump Cluster contents' })
  const systemSummary = page.getByRole('group', { name: 'Active Star System summary' })
  await expect(clusterSummary).toBeVisible()
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(clusterContents).toContainText('0 ROUTES')
  await expect(clusterContents).toContainText('0 JUMP POINTS')
  await expect(systemSummary).toBeVisible()
  await expect(systemSummary).toContainText('Vesper')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kestrel Reach')
  await expect(page.locator(
    '.cluster-map-header .editor-heading, .cluster-map-header [aria-label="Current Jump Cluster contents"]',
  )).toHaveCount(0)

  const fileActionsMenu = page.locator('.header-map-actions')
  const fileActionsToggle = fileActionsMenu.locator('.header-map-actions-toggle')
  const clusterPaletteLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const palette = document.querySelector<HTMLElement>('.cluster-edit-palette')
    const map = document.querySelector<SVGSVGElement>('.cluster-map-svg')
    if (!summary || !palette || !map) throw new Error('The header summary, palette, or map is missing.')
    const summaryBounds = summary.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    return {
      centered: Math.abs(paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2) <= 1,
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      noFloatingSummary: document.querySelector('.editor-heading') === null,
      mapText: Array.from(map.querySelectorAll('text'), text => text.textContent?.trim() ?? ''),
    }
  })
  expect(clusterPaletteLayout.centered).toBe(true)
  expect(clusterPaletteLayout.paletteBelowHeader).toBe(true)
  expect(clusterPaletteLayout.noFloatingSummary).toBe(true)
  expect(clusterPaletteLayout.mapText).not.toContain('Kestrel Reach')
  expect(clusterPaletteLayout.mapText).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterPaletteLayout.mapText.some(text => /\d+\s*SYSTEMS\s*\/\s*\d+\s*ROUTES/i.test(text))).toBe(false)

  for (const width of [1024, 479]) {
    await page.setViewportSize({ width, height: 720 })
    const narrowClusterPalette = await page.evaluate(() => {
      const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
      const palette = document.querySelector<HTMLElement>('.cluster-edit-palette')
      if (!summary || !palette) throw new Error('The header summary or palette is missing.')
      const summaryBounds = summary.getBoundingClientRect()
      const paletteBounds = palette.getBoundingClientRect()
      return {
        centered: Math.abs(paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2) <= 1,
        belowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      }
    })
    expect(narrowClusterPalette, `layout at ${width}px`).toEqual({
      centered: true,
      belowHeader: true,
      noHorizontalOverflow: true,
    })
  }
  await page.setViewportSize({ width: 1440, height: 960 })

  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Open map file actions for Jump Cluster Kestrel Reach',
  )
  await fileActionsToggle.focus()
  await page.keyboard.press('Enter')
  await expect(fileActionsToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Close map file actions for Jump Cluster Kestrel Reach',
  )
  const clusterActions = page.getByRole('group', {
    name: 'Map file actions for Jump Cluster Kestrel Reach',
  })
  await expect(clusterActions.getByRole('button', { name: 'Export Jump Cluster JSON' })).toBeVisible()
  await expect(clusterActions.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(clusterActions)
    .toContainText('Import JSON creates a separate copy in the current Jump Cluster: Kestrel Reach.')
  await expect(page.locator('.cluster-map-tools .map-toolbar')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(fileActionsToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(fileActionsToggle).toBeFocused()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Open map file actions for star system Vesper',
  )
  await setHeaderMapActionsOpen(page, true)
  const systemActions = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  await expect(systemActions.getByRole('button', { name: 'Export star system JSON' })).toBeVisible()
  await expect(systemActions.getByRole('button', { name: 'Export star system PNG' })).toBeVisible()
  await expect(systemActions.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(page.locator('.system-map-tools .map-toolbar')).toHaveCount(0)

  await page.setViewportSize({ width: 320, height: 720 })
  const narrowLayout = await systemActions.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const buttons = Array.from(element.querySelectorAll('button'))
    return {
      panelWithinViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
      buttonsFit: buttons.every((button) => {
        const buttonBounds = button.getBoundingClientRect()
        return buttonBounds.left >= bounds.left && buttonBounds.right <= bounds.right
      }),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(narrowLayout).toEqual({
    panelWithinViewport: true,
    buttonsFit: true,
    noHorizontalOverflow: true,
  })
  await setHeaderMapActionsOpen(page, false)
})

test('cluster and system summaries stay in the header, outside the map scene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const clusterSummary = page.getByRole('group', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.getByRole('group', { name: 'Current Jump Cluster contents' })
  const systemSummary = page.getByRole('group', { name: 'Active Star System summary' })
  const systemContents = page.getByRole('group', { name: 'Current system contents' })
  await expect(clusterSummary).toBeVisible()
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(clusterContents).toContainText('0 ROUTES')
  await expect(clusterContents).toContainText('0 JUMP POINTS')
  await expect(systemSummary).toBeVisible()
  await expect(systemSummary).toContainText('Vesper')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vesper')
  await expect(page.locator(
    '.system-map-header .editor-heading, .system-map-header [aria-label="Current system contents"]',
  )).toHaveCount(0)
  await expect(systemContents).toContainText('1 STARS')
  await expect(systemContents).toContainText('1 OBJECTS')
  await expect(systemContents).toContainText('0 ORBITS')

  const layout = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.workspace-header-summary')
    const topbar = document.querySelector<HTMLElement>('.topbar')
    const canvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const map = canvas?.querySelector<SVGSVGElement>('.system-map-svg')
    const clusterStats = document.querySelector<HTMLElement>('[aria-label="Current Jump Cluster contents"]')
    const systemStats = document.querySelector<HTMLElement>('[aria-label="Current system contents"]')
    if (!header || !topbar || !canvas || !map || !clusterStats || !systemStats) {
      throw new Error('The system-map canvas and header summaries are incomplete.')
    }

    const canvasBounds = canvas.getBoundingClientRect()
    const mapBounds = map.getBoundingClientRect()
    const mapText = Array.from(map.querySelectorAll('text'), element => element.textContent?.trim() ?? '')
    return {
      mapHeightRatio: mapBounds.height / canvasBounds.height,
      summariesInHeader: topbar.contains(header)
        && header.contains(clusterStats)
        && header.contains(systemStats),
      summaryStatsOutsideMap: !map.contains(clusterStats) && !map.contains(systemStats),
      summaryStatsVisible: [clusterStats, systemStats].every(stats =>
        getComputedStyle(stats).display !== 'none' && stats.getBoundingClientRect().width > 0,
      ),
      clusterStats: Array.from(clusterStats.querySelectorAll('strong'), counter =>
        counter.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
      systemStats: Array.from(systemStats.querySelectorAll('strong'), counter =>
        counter.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
      floatingSummaryCount: document.querySelectorAll('.editor-heading').length,
      systemNameInSvg: mapText.includes('Vesper'),
      objectSummaryInSvg: mapText.some(text => text.includes('OBJECTS') && text.includes('ORBITS')),
    }
  })

  expect(layout.mapHeightRatio, JSON.stringify(layout)).toBeGreaterThanOrEqual(0.92)
  expect(layout.summariesInHeader).toBe(true)
  expect(layout.summaryStatsOutsideMap).toBe(true)
  expect(layout.summaryStatsVisible).toBe(true)
  expect(layout.clusterStats).toEqual(['1 SYSTEMS', '0 ROUTES', '0 JUMP POINTS'])
  expect(layout.systemStats).toEqual(['1 STARS', '1 OBJECTS', '0 ORBITS'])
  expect(layout.floatingSummaryCount).toBe(0)
  expect(layout.systemNameInSvg).toBe(false)
  expect(layout.objectSummaryInSvg).toBe(false)

  await page.getByRole('button', { name: 'Add Star', exact: true }).click()
  await expect(systemContents).toContainText('2 STARS')
  await expect(systemContents).toContainText('2 OBJECTS')

  for (const width of [1024, 479]) {
    await page.setViewportSize({ width, height: 720 })
    const responsiveLayout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.workspace-header-summary')
      const cluster = document.querySelector<HTMLElement>('.cluster-stamp')
      const system = document.querySelector<HTMLElement>('.system-stamp')
      const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
      if (!header || !cluster || !system || !palette) {
        throw new Error('The header summaries or object palette are unavailable.')
      }

      const headerBounds = header.getBoundingClientRect()
      const clusterBounds = cluster.getBoundingClientRect()
      const systemBounds = system.getBoundingClientRect()
      const paletteBounds = palette.getBoundingClientRect()
      const overlaps = (first: DOMRect, second: DOMRect) =>
        first.left < second.right && first.right > second.left
          && first.top < second.bottom && first.bottom > second.top
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        headerWithinViewport: headerBounds.left >= 0 && headerBounds.right <= window.innerWidth,
        summariesVisible: clusterBounds.width > 0 && systemBounds.width > 0,
        summariesWithinViewport: clusterBounds.left >= 0
          && clusterBounds.right <= window.innerWidth
          && systemBounds.left >= 0
          && systemBounds.right <= window.innerWidth,
        summariesDoNotOverlap: !overlaps(clusterBounds, systemBounds),
        paletteBelowHeader: paletteBounds.top >= headerBounds.bottom + 4,
      }
    })
    expect(responsiveLayout, `header layout at ${width}px`).toEqual({
      noHorizontalOverflow: true,
      headerWithinViewport: true,
      summariesVisible: true,
      summariesWithinViewport: true,
      summariesDoNotOverlap: true,
      paletteBelowHeader: true,
    })
  }
})

test('side panels collapse in ordered phases and Delete removes the selected object', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const sidebars = ['hierarchy', 'inspector'] as const
  const expectReopenHandle = async (
    sidebar: typeof sidebars[number],
    verticalPosition: 'center' | 'system-bottom' = 'center',
    reducedMotion = false,
  ) => {
    const handle = page.getByRole('button', { name: `Show ${sidebar} panel` })
    await expect(handle).toBeVisible()
    await expect(handle).toHaveAttribute('aria-controls', `workspace-${sidebar}-panel`)
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
    const metrics = await handle.evaluate((element) => {
      const label = element.querySelector<HTMLElement>('.panel-reopen-label')
      const grid = element.closest<HTMLElement>('.editor-grid')
      if (!label || !grid) throw new Error('The sidebar reopen control is incomplete.')
      const bounds = element.getBoundingClientRect()
      const labelBounds = label.getBoundingClientRect()
      const gridBounds = grid.getBoundingClientRect()
      const style = getComputedStyle(label)
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: window.innerWidth,
        gridCenterY: gridBounds.top + gridBounds.height / 2,
        gridBottom: gridBounds.bottom,
        writingMode: style.writingMode,
        textOrientation: style.textOrientation,
        labelFontSize: Number.parseFloat(style.fontSize),
        labelWidth: labelBounds.width,
        labelHeight: labelBounds.height,
        animationName: style.animationName,
      }
    })
    expect(metrics.width).toBeCloseTo(2.35 * 16, 1)
    expect(metrics.height, JSON.stringify(metrics)).toBeCloseTo(7 * 16, 1)
    expect(metrics.x).toBeCloseTo(
      sidebar === 'hierarchy' ? 0 : metrics.viewportWidth - metrics.width,
      1,
    )
    if (verticalPosition === 'system-bottom') {
      expect(metrics.gridBottom - metrics.bottom).toBeCloseTo(2 * 16, 1)
    } else {
      expect(metrics.y + metrics.height / 2).toBeCloseTo(metrics.gridCenterY, 1)
    }
    expect(metrics.writingMode).toBe('vertical-rl')
    expect(metrics.textOrientation).toBe('upright')
    expect(metrics.labelFontSize).toBeCloseTo(0.58 * 16, 1)
    expect(metrics.labelHeight).toBeGreaterThan(metrics.labelWidth * 3)
    expect(metrics.animationName).toBe(reducedMotion ? 'none' : 'panel-label-reveal')
    return handle
  }

  const collapseAndReopen = async (sidebar: typeof sidebars[number]) => {
    const panel = page.locator(`#workspace-${sidebar}-panel`)
    const initialBounds = await panel.boundingBox()
    if (!initialBounds) throw new Error(`The ${sidebar} panel is not visible.`)
    await panel.evaluate((element) => {
      element.dataset.collapseSequence = ''
      delete element.dataset.contentWidthAtFade
      delete element.dataset.contentsOpacityAtPanel
      delete element.dataset.handlePresentAtPanel
      const captureCollapse = (event: Event) => {
        const transition = event as TransitionEvent
        if (event.target === element && transition.propertyName === 'width') {
          element.dataset.collapseSequence += 'panel'
          element.dataset.contentsOpacityAtPanel = String(Math.max(
            ...Array.from(element.children, child => Number(getComputedStyle(child).opacity)),
          ))
          const handleClass = element.classList.contains('hierarchy-panel')
            ? '.panel-reopen-left'
            : '.panel-reopen-right'
          element.dataset.handlePresentAtPanel = String(
            Boolean(element.parentElement?.querySelector(handleClass)),
          )
        } else if (
          event.target instanceof Element
          && event.target.parentElement === element
          && transition.propertyName === 'opacity'
          && !element.dataset.contentWidthAtFade
        ) {
          element.dataset.collapseSequence += 'contents,'
          element.dataset.contentWidthAtFade = String(element.getBoundingClientRect().width)
        }
        if (event.target === element && transition.propertyName === 'width') {
          element.removeEventListener('transitionstart', captureCollapse, true)
        }
      }
      element.addEventListener('transitionstart', captureCollapse, true)
    })

    await page.getByRole('button', { name: `Collapse ${sidebar} panel` }).click()
    await expect(panel).toBeHidden()
    const sequence = (await panel.getAttribute('data-collapse-sequence'))?.split(',') ?? []
    expect(sequence).toEqual(['contents', 'panel'])
    expect(Number(await panel.getAttribute('data-content-width-at-fade')))
      .toBeCloseTo(initialBounds.width, 1)
    expect(Number(await panel.getAttribute('data-contents-opacity-at-panel'))).toBeLessThan(0.1)
    expect(await panel.getAttribute('data-handle-present-at-panel')).toBe('false')
    const handle = await expectReopenHandle(sidebar)

    await page.keyboard.press('Tab')
    await handle.focus()
    const focusState = await handle.evaluate(element => ({
      visibleFocus: element.matches(':focus-visible'),
      outline: getComputedStyle(element).outlineWidth,
    }))
    expect(focusState.visibleFocus).toBe(true)
    expect(Number.parseFloat(focusState.outline)).toBeGreaterThan(0)
    await panel.evaluate((element) => {
      element.dataset.openSequence = ''
      element.dataset.openWidthAtPanel = ''
      element.dataset.openWidthAtContents = ''
      const captureOpen = (event: Event) => {
        const transition = event as TransitionEvent
        if (event.target === element && transition.propertyName === 'width') {
          element.dataset.openSequence += 'panel,'
          element.dataset.openWidthAtPanel = String(element.getBoundingClientRect().width)
        } else if (
          event.target instanceof Element
          && event.target.parentElement === element
          && transition.propertyName === 'opacity'
          && !element.dataset.openWidthAtContents
        ) {
          element.dataset.openSequence += 'contents,'
          element.dataset.openWidthAtContents = String(element.getBoundingClientRect().width)
        }
        if (
          event.target instanceof Element
          && event.target.parentElement === element
          && transition.propertyName === 'opacity'
        ) {
          element.removeEventListener('transitionstart', captureOpen, true)
        }
      }
      element.addEventListener('transitionstart', captureOpen, true)
    })
    await page.keyboard.press('Enter')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('transform', 'none')
    await expect(panel).toHaveAttribute('data-open-sequence', 'panel,contents,')
    const openMetrics = await panel.evaluate((element) => ({
      sequence: element.dataset.openSequence?.split(',').filter(Boolean) ?? [],
      widthAtPanelStart: Number(element.dataset.openWidthAtPanel),
      widthAtContentsStart: Number(element.dataset.openWidthAtContents),
    }))
    expect(openMetrics.sequence).toEqual(['panel', 'contents'])
    expect(openMetrics.widthAtPanelStart).toBeLessThan(initialBounds.width / 2)
    expect(openMetrics.widthAtContentsStart).toBeGreaterThan(initialBounds.width * 0.9)
    await expect(handle).toBeHidden()
  }

  for (const view of ['system', 'cluster'] as const) {
    if (view === 'cluster') await page.getByRole('button', { name: 'Cluster map' }).click()
    for (const sidebar of sidebars) await collapseAndReopen(sidebar)
  }

  await page.locator('#workspace-hierarchy-panel')
    .getByRole('button', { name: 'Open Vesper system map' }).click()
  const reducedMotionPanel = page.locator('#workspace-hierarchy-panel')
  await expect(reducedMotionPanel).toHaveCSS('transform', 'none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const transitionDuration = await reducedMotionPanel.evaluate((element) => {
    element.classList.add('hierarchy-panel-leave-active')
    const duration = getComputedStyle(element).transitionDuration
    element.classList.remove('hierarchy-panel-leave-active')
    return duration
  })
  const duration = transitionDuration.split(',')[0]!.trim()
  const durationMilliseconds = Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000)
  expect(durationMilliseconds).toBeLessThan(0.02)
  await page.getByRole('button', { name: 'Collapse hierarchy panel' }).click()
  await expect(reducedMotionPanel).toBeHidden()
  const reducedMotionHandle = await expectReopenHandle('hierarchy', 'center', true)
  await reducedMotionHandle.focus()
  await page.keyboard.press('Enter')
  await expect(reducedMotionPanel).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.setViewportSize({ width: 390, height: 844 })
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeHidden()
  const expectNoHorizontalOverflow = async () => {
    const viewport = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth)
  }
  await expectReopenHandle('inspector', 'system-bottom')
  await expectNoHorizontalOverflow()
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expectReopenHandle('hierarchy', 'system-bottom')
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expectReopenHandle('inspector', 'system-bottom')
  await expectNoHorizontalOverflow()

  await page.setViewportSize({ width: 390, height: 300 })
  const compactLabelStyle = await page.getByRole('button', { name: 'Show inspector panel' })
    .locator('.panel-reopen-label')
    .evaluate(label => {
      const style = getComputedStyle(label)
      return {
        fontSize: style.fontSize,
        writingMode: style.writingMode,
      }
    })
  expect(compactLabelStyle).toEqual({
    fontSize: '8px',
    writingMode: 'horizontal-tb',
  })
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expectReopenHandle('hierarchy')
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expectReopenHandle('inspector')
  await expectNoHorizontalOverflow()

  await page.locator('#workspace-hierarchy-panel')
    .getByRole('button', { name: 'Open Vesper system map' }).click()
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()

  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  await editMapObject(page)
  const nameInput = page.getByLabel('Name', { exact: true })
  await nameInput.focus()
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeVisible()
  await page.getByRole('button', { name: 'Cancel map object edits' }).click()
  await primaryStar.click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await primaryStar.click()
  page.once('dialog', async dialog => dialog.accept())
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeHidden()
})

test('map object glyphs match the Add object palette', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

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
