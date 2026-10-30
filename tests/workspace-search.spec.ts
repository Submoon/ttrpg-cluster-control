import { expect, test } from './fixtures'
import { expectPaletteOptionActive } from './scenarios/search-palette'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  clickDockAction,
  clickNormalizedClusterPoint,
  createSingleSystemWorkspace,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setWorkspaceMapMode,
  setJsonFile,
} from './helpers'

function repeatedSystemImportContent(systemCount: number): string {
  const source = createLocalWorkspace('Imported Reach', 'Vesper')
  const systems = [...source.cluster.systems]
  const systemPositions = { ...source.layout.systemPositions }

  for (let index = 1; index < systemCount; index += 1) {
    const importedSource = createLocalWorkspace('Imported Reach', 'Vesper')
    const system = importedSource.cluster.systems[0]
    if (!system) throw new Error('The repeated-system import needs a star system.')
    systems.push(system)
    systemPositions[system.id] = { x: 0.2 + (index % 4) * 0.16, y: 0.2 + Math.floor(index / 4) * 0.18 }
  }

  return JSON.stringify(exportJumpCluster({
    ...source,
    cluster: { ...source.cluster, systems },
    layout: { ...source.layout, systemPositions },
  }))
}

async function tapVisibleTarget(
  cdp: import('@playwright/test').CDPSession,
  target: import('@playwright/test').Locator,
): Promise<void> {
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('The touch target has no visible bounds.')
  const point = { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }
  const touchPoint = { ...point, id: 1, radiusX: 2, radiusY: 2, force: 1 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

type SearchKeydownOverrides = {
  shift?: boolean
  alt?: boolean
  meta?: boolean
  altGraph?: boolean
  repeat?: boolean
  composing?: boolean
  keyCode?: number
  handled?: boolean
  compositionActive?: boolean
}

async function dispatchSearchKeydown(
  target: import('@playwright/test').Locator,
  overrides: SearchKeydownOverrides = {},
): Promise<{ preventedBefore: boolean; preventedAfter: boolean }> {
  return target.evaluate((element, options) => {
    if (!(element instanceof HTMLElement)) throw new Error('The shortcut test target is not an HTML element.')
    if (options.compositionActive) element.dispatchEvent(new Event('compositionstart', { bubbles: true }))
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      metaKey: options.meta ?? false,
      altKey: options.alt ?? false,
      shiftKey: options.shift ?? false,
      bubbles: true,
      cancelable: true,
    })
    if (options.altGraph) {
      Object.defineProperty(event, 'getModifierState', { value: (key: string) => key === 'AltGraph' })
    }
    if (options.repeat !== undefined) Object.defineProperty(event, 'repeat', { value: options.repeat })
    if (options.composing !== undefined) Object.defineProperty(event, 'isComposing', { value: options.composing })
    if (options.keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: options.keyCode })
    if (options.handled) event.preventDefault()
    const preventedBefore = event.defaultPrevented
    element.dispatchEvent(event)
    if (options.compositionActive) element.dispatchEvent(new Event('compositionend', { bubbles: true }))
    return { preventedBefore, preventedAfter: event.defaultPrevented }
  }, overrides)
}

test('workspace search is visibly available from system and cluster map contexts', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(mapContext.getByRole('button', { name: 'Search', exact: true })).toBeVisible()

  await returnToClusterMap(page)
  await expect(mapContext.getByRole('button', { name: 'Search', exact: true })).toBeVisible()
})

test('Ctrl+K opens Search from a dirty Inspector and preserves its session and map state', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  const systemContent = systemMap.locator('.system-map-content')
  const initialCamera = await systemContent.getAttribute('transform')
  if (!initialCamera) throw new Error('The active system map has no rendered camera transform.')

  await systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill('Primary Star draft')
  const selectedObject = systemMap.locator('.system-object.is-selected')
  await expect(selectedObject).toHaveCount(1)
  const selectMode = page.locator('.workspace-dock-mode button[aria-label="Select"]')

  await page.keyboard.press('Control+k')

  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await expect(searchDialog).toBeVisible()
  await expect(query).toBeFocused()
  const emptySearchScreenshot = testInfo.outputPath('search-shortcut-empty-state.png')
  await page.screenshot({ path: emptySearchScreenshot, animations: 'disabled' })
  await testInfo.attach('search-shortcut-empty-state', {
    path: emptySearchScreenshot,
    contentType: 'image/png',
  })
  await expect(objectName).toHaveValue('Primary Star draft')
  await expect(selectedObject).toHaveCount(1)
  await expect(systemContent).toHaveAttribute('transform', initialCamera)
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')

  await query.fill('Vesper')
  await expect(searchDialog.getByRole('option', { name: /Vesper.*Star System/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(objectName).toBeFocused()
  await expect(objectName).toHaveValue('Primary Star draft')
  await expect(systemContent).toHaveAttribute('transform', initialCamera)
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Control+k')
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue('Vesper')
  await expect(query).toBeFocused()

  await query.evaluate(input => {
    if (!(input instanceof HTMLInputElement)) throw new Error('Search query is not a native input.')
    input.blur()
  })
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toBeVisible()
  await expect(query).toBeFocused()
  await expect(query).toHaveValue('Vesper')
})

test('Meta+K opens Search on macOS and the button advertises the platform chord', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
  })
  await createSingleSystemWorkspace(page)

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  await expect(searchButton).toHaveAttribute('aria-keyshortcuts', 'Meta+K')
  await expect(searchButton.locator('kbd').first()).toHaveText('⌘')
  await expect(searchButton.locator('kbd').nth(1)).toHaveText('K')

  await searchButton.focus()
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toHaveCount(0)
  await page.keyboard.press('Meta+k')
  await expect(searchDialog).toBeVisible()
  await expect(searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })).toBeFocused()
})

test('Search shortcut ignores composition, handled events, repeats, and modified chords', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  await systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill('Primary Star draft')
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })

  const suppressedEvents = [
    await dispatchSearchKeydown(objectName, { compositionActive: true }),
    await dispatchSearchKeydown(objectName, { composing: true }),
    await dispatchSearchKeydown(objectName, { keyCode: 229 }),
    await dispatchSearchKeydown(objectName, { repeat: true }),
    await dispatchSearchKeydown(objectName, { shift: true }),
    await dispatchSearchKeydown(objectName, { alt: true }),
    await dispatchSearchKeydown(objectName, { meta: true }),
    await dispatchSearchKeydown(objectName, { altGraph: true }),
    await dispatchSearchKeydown(objectName, { handled: true }),
  ]

  expect(suppressedEvents).toEqual([
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: false, preventedAfter: false },
    { preventedBefore: true, preventedAfter: true },
  ])
  await expect(searchDialog).toHaveCount(0)
  await expect(objectName).toHaveValue('Primary Star draft')
})

test('Search shortcut yields to Fields, chart-name, and compact panel dialogs', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const fieldsButton = page.getByRole('button', { name: 'Open field definitions', exact: true })
  await fieldsButton.click()
  const fieldsDialog = page.getByRole('dialog', { name: 'Field definitions', exact: true })
  await expect(fieldsDialog).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toHaveCount(0)
  await expect(fieldsDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(fieldsDialog).toBeHidden()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await hierarchy.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(chartDialog).toBeVisible()
  await chartDialog.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach shortcut draft')
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toHaveCount(0)
  await expect(chartDialog.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Kestrel Reach shortcut draft')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  const compactHierarchy = page.getByRole('dialog', { name: 'System hierarchy', exact: true })
  await expect(compactHierarchy).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toHaveCount(0)
  await expect(compactHierarchy).toBeVisible()
})

for (const view of ['system', 'cluster'] as const) {
  test(`Ctrl+K waits until a held ${view} map pan ends`, async ({ page }) => {
    await createSingleSystemWorkspace(page)
    if (view === 'cluster') await returnToClusterMap(page)
    await setWorkspaceMapMode(page, 'Navigate')

    const mapName = view === 'system' ? 'Vesper star system map' : 'Kestrel Reach Jump Cluster map'
    const map = page.getByRole('group', { name: mapName, exact: true })
    const scene = map.locator(view === 'system' ? '.system-map-content' : '.cluster-map-content')
    const initialCamera = await scene.getAttribute('transform')
    const bounds = await map.boundingBox()
    if (!initialCamera || !bounds) throw new Error(`The active ${view} map has no usable pan bounds.`)
    const start = { x: bounds.x + 24, y: bounds.y + 24 }
    const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })

    await map.focus()
    await page.mouse.move(start.x, start.y)
    await page.mouse.down({ button: 'right' })
    try {
      await page.mouse.move(start.x + 54, start.y + 32, { steps: 4 })
      await page.keyboard.press('Control+k')
      await expect(searchDialog).toHaveCount(0)
      await expect(map).toBeVisible()
    } finally {
      await page.mouse.up({ button: 'right' })
    }

    await expect.poll(() => scene.getAttribute('transform')).not.toBe(initialCamera)
    await page.keyboard.press('Control+k')
    await expect(searchDialog).toBeVisible()
    await expect(searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })).toBeFocused()
  })
}

test('a system result can be searched without changing the map and deliberately revealed on the cluster', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  const systemContent = systemMap.locator('.system-map-content')
  const systemViewport = await systemContent.getAttribute('transform')
  if (!systemViewport) throw new Error('The active system map has no rendered viewport transform.')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  await expect(searchDialog).toBeVisible()
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  const systemResult = searchDialog.getByRole('option', { name: /Vesper.*Star system.*Kestrel Reach/i })
  await expect(systemResult).toBeVisible()
  await expect(systemContent).toHaveAttribute('transform', systemViewport)
  const resultsScreenshot = testInfo.outputPath('search-system-results-desktop.png')
  await page.screenshot({ path: resultsScreenshot, animations: 'disabled' })
  await testInfo.attach('search-system-results-desktop', {
    path: resultsScreenshot,
    contentType: 'image/png',
  })

  await systemResult.click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  const systemNode = clusterMap.locator('.cluster-system-node').filter({ hasText: 'Vesper' })
  await expect(systemNode).toHaveClass(/is-selected/)
  const mapBounds = await clusterMap.boundingBox()
  const nodeBounds = await systemNode.boundingBox()
  if (!mapBounds || !nodeBounds) throw new Error('The revealed system node has no visible map bounds.')
  expect(nodeBounds.x).toBeGreaterThanOrEqual(mapBounds.x)
  expect(nodeBounds.x + nodeBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
  expect(nodeBounds.y).toBeGreaterThanOrEqual(mapBounds.y)
  expect(nodeBounds.y + nodeBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)
  await expect(clusterMap).toBeFocused()

  const revealScreenshot = testInfo.outputPath('search-system-reveal-desktop.png')
  await page.screenshot({ path: revealScreenshot, animations: 'disabled' })
  await testInfo.attach('search-system-reveal-desktop', {
    path: revealScreenshot,
    contentType: 'image/png',
  })
})

test('keyboard search keeps composition in the input, returns focus on Escape, and preserves its query', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  const systemResult = searchDialog.getByRole('option', { name: /Vesper.*Star system.*Kestrel Reach/i })
  await expect(systemResult).toBeVisible()

  await query.evaluate(input => {
    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
    Object.defineProperty(composingEnter, 'isComposing', { value: true })
    Object.defineProperty(composingEnter, 'keyCode', { value: 229 })
    input.dispatchEvent(composingEnter)
  })
  await expect(searchDialog).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()

  await searchButton.click()
  await expect(query).toHaveValue('Vesper')
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, systemResult)
  await systemResult.press('Enter')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(clusterMap).toBeFocused()

  await searchButton.click()
  await expect(query).toHaveValue('Vesper')
})

test('compact short-landscape search keeps imported homonyms distinct and makes every result reachable', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 844, height: 390 } })
  await setJsonFile(jsonMapImportInput(page), 'repeated-systems.json', repeatedSystemImportContent(12))
  const importReview = page.getByRole('dialog', { name: 'Review import', exact: true })
  await resolveImportReview(importReview, 'confirm')
  await expect(importReview).toHaveCount(0)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await expect(searchDialog).toBeVisible()
  await query.fill('Vesper')

  const results = searchDialog.getByRole('listbox')
  const resultsViewport = results.locator('[data-slot="viewport"]')
  const resultOptions = results.getByRole('option')
  await expect(resultOptions).toHaveCount(13)
  await expect(resultOptions.first()).toHaveAccessibleName(/Vesper.*Star System.*Jump Cluster: Kestrel Reach.*occurrence 1/i)
  await expect(resultOptions.last()).toHaveAccessibleName(/Vesper.*Star System.*Jump Cluster: Kestrel Reach.*occurrence 13/i)
  await expect(resultOptions.first()).toContainText('Star System')
  await expect(resultOptions.first()).toContainText('Jump Cluster: Kestrel Reach')

  const searchBounds = await searchDialog.boundingBox()
  const inputBounds = await query.boundingBox()
  const resultsBounds = await results.boundingBox()
  if (!searchBounds || !inputBounds || !resultsBounds) throw new Error('The compact search controls have no visible bounds.')
  expect(searchBounds.y + searchBounds.height).toBeLessThanOrEqual(390)
  expect(inputBounds.width).toBeGreaterThan(250)
  expect(resultsBounds.height).toBeGreaterThan(60)
  expect(await resultsViewport.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)

  const screenshotPath = testInfo.outputPath('search-homonyms-compact-short-landscape.png')
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('search-homonyms-compact-short-landscape', { path: screenshotPath, contentType: 'image/png' })

  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, resultOptions.first())
  await page.keyboard.press('End')
  await expectPaletteOptionActive(query, resultOptions.last())
  await expect(resultOptions.last()).toBeInViewport()

  await query.fill('no such chart')
  await expect(searchDialog.getByRole('status')).toContainText('No matches for')
})

test('a real Inspector draft survives search Stay and compact Discard reveals without covering the map', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  const systemContent = systemMap.locator('.system-map-content')
  const initialViewport = await systemContent.getAttribute('transform')
  if (!initialViewport) throw new Error('The active system map has no rendered viewport transform.')
  const primaryStar = systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  await primaryStar.click()

  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(1)
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill('Primary Star draft')

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Kestrel')
  const clusterResult = searchDialog.getByRole('option', { name: /Kestrel Reach.*Jump Cluster.*Current workspace/i })
  await clusterResult.click()

  let guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toHaveCount(0)
  await expect(query).toHaveValue('Kestrel')
  await expect(query).toBeFocused()
  await expect(page.locator('.workspace-map-heading > span')).toHaveText('Star System')
  await expect(systemContent).toHaveAttribute('transform', initialViewport)
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()
  await expect(objectName).toHaveValue('Primary Star draft')

  await searchButton.click()
  await expect(query).toHaveValue('Kestrel')
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(inspector).toBeVisible()
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await expect(searchDialog).toBeVisible()

  const compactSearchScreenshot = testInfo.outputPath('search-inspector-draft-compact.png')
  await page.screenshot({ path: compactSearchScreenshot, animations: 'disabled' })
  await testInfo.attach('search-inspector-draft-compact', {
    path: compactSearchScreenshot,
    contentType: 'image/png',
  })

  await clusterResult.click()
  guard = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await expect(guard.getByRole('button', { name: 'Discard edits and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(inspector).toBeHidden()
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(clusterMap).toBeFocused()

  const compactRevealScreenshot = testInfo.outputPath('search-inspector-draft-reveal-compact.png')
  await page.screenshot({ path: compactRevealScreenshot, animations: 'disabled' })
  await testInfo.attach('search-inspector-draft-reveal-compact', {
    path: compactRevealScreenshot,
    contentType: 'image/png',
  })

  await searchButton.click()
  await expect(query).toHaveValue('Kestrel')
})

test('portrait touch search keeps controls in view and reveals a framed system', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
    const searchButton = mapContext.getByRole('button', { name: 'Search', exact: true })
    const searchBounds = await searchButton.boundingBox()
    if (!searchBounds) throw new Error('Search has no visible touch bounds.')
    expect(searchBounds.x).toBeGreaterThanOrEqual(0)
    expect(searchBounds.x + searchBounds.width).toBeLessThanOrEqual(390)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await tapVisibleTarget(cdp, searchButton)
    const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
    const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
    await expect(query).toBeVisible()
    const queryBounds = await query.boundingBox()
    if (!queryBounds) throw new Error('The portrait search input has no visible bounds.')
    expect(queryBounds.y + queryBounds.height).toBeLessThanOrEqual(844)
    await query.fill('Vesper')
    const result = searchDialog.getByRole('option', { name: /Vesper.*Star System.*Kestrel Reach/i })
    await expect(result).toBeVisible()

    const resultScreenshot = testInfo.outputPath('search-portrait-touch-results.png')
    await page.screenshot({ path: resultScreenshot, animations: 'disabled' })
    await testInfo.attach('search-portrait-touch-results', { path: resultScreenshot, contentType: 'image/png' })
    await tapVisibleTarget(cdp, result)

    const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
    await expect(clusterMap).toBeVisible()
    await expect(searchDialog).toHaveCount(0)
    const systemNode = clusterMap.locator('.cluster-system-node').filter({ hasText: 'Vesper' })
    await expect(systemNode).toHaveClass(/is-selected/)
    const systemNameLabel = systemNode.locator('.cluster-system-name')
    const nameBounds = await systemNameLabel.boundingBox()
    if (!nameBounds) throw new Error('The portrait system name has no rendered bounds.')
    expect(nameBounds.height).toBeGreaterThanOrEqual(12)
    const mapBounds = await clusterMap.boundingBox()
    const nodeBounds = await systemNode.boundingBox()
    if (!mapBounds || !nodeBounds) throw new Error('The portrait system result has no visible map bounds.')
    expect(nodeBounds.x).toBeGreaterThanOrEqual(mapBounds.x)
    expect(nodeBounds.x + nodeBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
    expect(nodeBounds.y).toBeGreaterThanOrEqual(mapBounds.y)
    expect(nodeBounds.y + nodeBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)

    const revealScreenshot = testInfo.outputPath('search-portrait-touch-reveal.png')
    await page.screenshot({ path: revealScreenshot, animations: 'disabled' })
    await testInfo.attach('search-portrait-touch-reveal', { path: revealScreenshot, contentType: 'image/png' })
  } finally {
    await cdp.detach()
  }
})

test('Delete while a Search option is active does not open a deletion review', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true })
  await systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true }).click()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  const result = searchDialog.getByRole('option', { name: /Vesper.*Star System.*Kestrel Reach/i })
  await expect(result).toBeVisible()
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, result)

  await page.keyboard.press('Delete')

  await expect(page.getByRole('dialog', { name: 'Review deletion', exact: true })).toHaveCount(0)
})

test('Palette editing retains native caret and IME behavior while shielding map shortcuts', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const selectMode = page.locator('.workspace-dock-mode button[aria-label="Select"]')
  const addButton = page.locator('.workspace-dock-add')
  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()

  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.setSelectionRange(3, 3)
  })
  await query.press('Home')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe(0)
  await query.press('End')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe('Vesper'.length)

  const resultOptions = searchDialog.getByRole('listbox').getByRole('option')
  await expect(resultOptions.first()).toBeVisible()
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, resultOptions.first())
  await query.press('End')
  await expectPaletteOptionActive(query, resultOptions.last())
  await query.press('Home')
  await expectPaletteOptionActive(query, resultOptions.first())
  await query.press('ArrowUp')
  await expect(query).toBeFocused()
  await query.press('End')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe('Vesper'.length)

  const composingEnter = await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(event)
    return { defaultPrevented: event.defaultPrevented, value: input.value }
  })
  expect(composingEnter).toEqual({ defaultPrevented: false, value: 'Vesper' })
  await expect(searchDialog).toBeVisible()
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
  })

  await query.press('Control+A')
  for (const key of ['n', 's', 'm', 'a']) await query.press(key)
  await expect(query).toHaveValue('nsma')
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await expect(addButton).toHaveAttribute('aria-expanded', 'false')
  await expect(searchDialog).toBeVisible()

  const composingEscape = await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(event)
    return { defaultPrevented: event.defaultPrevented, value: input.value }
  })
  expect(composingEscape).toEqual({ defaultPrevented: false, value: 'nsma' })
  await expect(searchDialog).toBeVisible()
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
  })

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()
})

test('revealing a system from armed Cluster Add cannot place a system on the map', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  await returnToClusterMap(page)

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  const systemNodes = clusterMap.locator('.cluster-system-node')
  const initialCount = await systemNodes.count()
  await clickDockAction(page, 'Add star system')
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  const result = searchDialog.getByRole('option', { name: /Vesper.*Star System.*Kestrel Reach/i })
  await expect(result).toBeVisible()
  await result.click()

  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(systemNodes).toHaveCount(initialCount)
  const selectMode = page.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Select', exact: true })
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')

  await clickNormalizedClusterPoint(page, clusterMap, { x: 0.75, y: 0.75 })

  await expect(systemNodes).toHaveCount(initialCount)
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toHaveCount(0)
})
