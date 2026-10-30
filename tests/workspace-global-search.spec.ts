import { expect, test, type Locator, type Page } from './fixtures'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import {
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  type StarSystem,
} from '../domain/workspace'
import {
  createSingleSystemWorkspace,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  panMap,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

async function expectPaintedInsideUsableMap(page: Page, map: Locator, painted: readonly Locator[]): Promise<void> {
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The revealed star system map has no measurable bounds.')
  const obstructions: ScreenRect[] = []
  const obstructionElements = page.locator('[data-map-obstruction]')

  for (let index = 0; index < await obstructionElements.count(); index += 1) {
    const obstruction = obstructionElements.nth(index)
    const visible = await obstruction.evaluate((element) => {
      if (!element.isConnected || element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false
      if (element.getClientRects().length === 0) return false
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })
    if (!visible) continue
    const bounds = await obstruction.boundingBox()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue
    obstructions.push({
      left: bounds.x,
      top: bounds.y,
      right: bounds.x + bounds.width,
      bottom: bounds.y + bounds.height,
    })
  }

  for (const element of painted) {
    await expect(element).toBeVisible()
    const bounds = await element.boundingBox()
    if (!bounds) throw new Error('A visible branch label or Orbit has no measurable bounds.')
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x - 1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width + 1)
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y - 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height + 1)

    for (const obstruction of obstructions) {
      const overlaps = bounds.x < obstruction.right
        && bounds.x + bounds.width > obstruction.left
        && bounds.y < obstruction.bottom
        && bounds.y + bounds.height > obstruction.top
      expect(overlaps).toBe(false)
    }
  }
}

async function importIndependentCopy(page: Page, fileName: string, content: string): Promise<void> {
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), fileName, content)
  const review = page.getByRole('dialog', { name: 'Review import', exact: true })
  await resolveImportReview(review, 'confirm')
  await expect(review).toHaveCount(0)
}

function identicalSearchSystemContent(): string {
  const workspace = createLocalWorkspace('Duplicate Search Atlas', 'Duplicate Port')
  const sourceSystem = workspace.cluster.systems[0]
  const sourceObject = sourceSystem?.objects[0]
  if (!sourceSystem || !sourceObject) throw new Error('The duplicate-system fixture needs an initial object.')
  const system = {
    ...sourceSystem,
    name: 'Duplicate Port',
    objects: [{ ...sourceObject, name: 'Shared Echo', locationKey: 'DUP-01' }],
  }
  const source = { ...workspace, cluster: { ...workspace.cluster, systems: [system] } }
  return JSON.stringify(exportStarSystem(source, system.id))
}

function largeSearchClusterContent(systemCount: number, matchingObjectsPerSystem: number): string {
  const source = createLocalWorkspace('Global Search Atlas', 'Global System 01')
  const systems: StarSystem[] = []
  const systemPositions: Record<string, { x: number; y: number }> = {}

  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const name = `Global System ${String(systemIndex + 1).padStart(2, '0')}`
    const workspace = systemIndex === 0 ? source : createLocalWorkspace('Global Search Atlas', name)
    const sourceSystem = workspace.cluster.systems[0]
    if (!sourceSystem) throw new Error(`The global search fixture did not create ${name}.`)
    let system = { ...sourceSystem, name }

    for (let objectIndex = 0; objectIndex < matchingObjectsPerSystem; objectIndex += 1) {
      const object = createSystemObject(system, 'planet')
      system = {
        ...system,
        objects: [...system.objects, {
          ...object,
          name: 'Global Beacon',
          locationKey: `GS${String(systemIndex + 1).padStart(2, '0')}-${String(objectIndex + 1).padStart(2, '0')}`,
        }],
      }
    }

    systems.push(system)
    systemPositions[system.id] = {
      x: 0.14 + (systemIndex % 5) * 0.17,
      y: 0.20 + Math.floor(systemIndex / 5) * 0.16,
    }
  }

  return JSON.stringify(exportJumpCluster({
    ...source,
    cluster: { ...source.cluster, systems, routes: [] },
    layout: { ...source.layout, systemPositions },
  }))
}

async function tapVisibleTarget(cdp: import('@playwright/test').CDPSession, target: Locator): Promise<void> {
  const bounds = await target.boundingBox()
  if (!bounds) throw new Error('The touch target has no visible bounds.')
  const point = {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('search reveals an object from an unopened star system on the cluster map', async ({ page }, testInfo) => {
  await importCampaignWorkspace(page)
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const targetObject = exported.cluster?.systems.find(system => system.name === 'Harrow')
    ?.objects.find(object => object.name === 'Harrow Arrival')
  if (!targetObject) throw new Error('The public cluster export has no Harrow Arrival object.')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('Harrow Arrival')

  const result = searchDialog.getByRole('button', { name: /Harrow Arrival/ })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Star System: Harrow')
  await expect(result).toContainText('Location key: JP-01')

  const resultsScreenshot = testInfo.outputPath('global-search-unopened-object-desktop.png')
  await page.screenshot({ path: resultsScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-unopened-object-desktop', {
    path: resultsScreenshot,
    contentType: 'image/png',
  })

  await result.click()

  const destinationMap = page.getByRole('group', { name: 'Harrow star system map', exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  const selectedObject = destinationMap.locator(`.system-object[data-object-id="${targetObject.id}"]`)
  await expect(selectedObject).toHaveClass(/is-selected/)
  await expect(selectedObject).toHaveAttribute('aria-label', /^Select JP-01, Harrow Arrival/)
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
})

test('cluster search frames an unopened object and its hosted Orbit branch', async ({ page }, testInfo) => {
  await importCampaignWorkspace(page)
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const destinationSystem = exported.cluster?.systems.find(system => system.name === 'Vesper Prime')
  const targetObject = destinationSystem?.objects.find(object => object.name === 'Iria')
  const branchObject = destinationSystem?.objects.find(object => object.name === 'Nix')
  const hostedOrbit = destinationSystem?.orbits.find(orbit => orbit.hostId === targetObject?.id)
  if (!targetObject || !branchObject || !hostedOrbit) {
    throw new Error('The public cluster export is missing the Iria–Orbit–Nix branch.')
  }

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('Iria')
  const result = searchDialog.getByRole('button', { name: /Iria/ })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Star System: Vesper Prime')
  await expect(result).toContainText('Location key: PL-01')
  await result.click()

  const destinationMap = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  const selectedObject = destinationMap.locator(`.system-object[data-object-id="${targetObject.id}"]`)
  const hostedOrbitMark = destinationMap.locator(`.orbit-mark[data-orbit-id="${hostedOrbit.id}"] .orbit-ring`)
  const targetLabel = destinationMap.locator('.object-name').filter({ hasText: targetObject.name })
  const branchLabel = destinationMap.locator('.object-name').filter({ hasText: branchObject.name })
  await expect(selectedObject).toHaveClass(/is-selected/)
  await expect(selectedObject).toHaveAttribute('aria-label', /^Select PL-01, Iria/)
  await expect(branchLabel).toHaveCount(1)
  await expect(targetLabel).toHaveCount(1)
  await expectPaintedInsideUsableMap(page, destinationMap, [targetLabel, branchLabel, hostedOrbitMark])
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  const screenshotPath = testInfo.outputPath('global-search-branch-reveal-desktop.png')
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('global-search-branch-reveal-desktop', { path: screenshotPath, contentType: 'image/png' })
})

test('an exact Location-key result from system A overrides system B selection and remembered camera', async ({ page }, testInfo) => {
  await importCampaignWorkspace(page)
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const harrowSystem = exported.cluster?.systems.find(system => system.name === 'Harrow')
  const targetObject = harrowSystem?.objects.find(object => object.name === 'Primary Star')
  const rememberedObject = harrowSystem?.objects.find(object => object.name === 'Harrow Arrival')
  if (!targetObject || !rememberedObject) throw new Error('The public cluster export has no Harrow search targets.')

  let hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: 'Open Harrow system map', exact: true }).click()
  const harrowMap = page.getByRole('group', { name: 'Harrow star system map', exact: true })
  const harrowContent = harrowMap.locator('.system-map-content')
  await expect(harrowMap).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await panMap(page, harrowMap, { x: 42, y: 24 })
  const rememberedCamera = await harrowContent.getAttribute('transform')
  if (!rememberedCamera) throw new Error('The Harrow map has no remembered camera transform.')
  await setWorkspaceMapMode(page, 'Select')
  const rememberedMark = harrowMap.locator(`.system-object[data-object-id="${rememberedObject.id}"]`)
  await rememberedMark.click()
  await expect(rememberedMark).toHaveClass(/is-selected/)
  if (await inspectToggle.getAttribute('aria-expanded') === 'true') await inspectToggle.click()
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  await returnToClusterMap(page)
  hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  const sourceMap = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await expect(sourceMap).toBeVisible()

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('A')
  const harrowResult = searchDialog.getByRole('button', {
    name: /Primary Star.*Star System: Harrow.*Location key: A/,
  })
  await expect(harrowResult).toBeVisible()
  await expect(harrowResult).toContainText('Star System: Harrow')
  await expect(harrowResult).toContainText('Location key: A')
  await harrowResult.click()

  await expect(harrowMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(harrowMap).toBeFocused()
  const exactTarget = harrowMap.locator(`.system-object[data-object-id="${targetObject.id}"]`)
  const previousSelection = harrowMap.locator(`.system-object[data-object-id="${rememberedObject.id}"]`)
  await expect(exactTarget).toHaveClass(/is-selected/)
  await expect(exactTarget).toHaveAttribute('aria-label', /^Select A, Primary Star/)
  await expect(previousSelection).not.toHaveClass(/is-selected/)
  const searchCamera = await harrowContent.getAttribute('transform')
  expect(searchCamera).not.toBe(rememberedCamera)
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  const screenshotPath = testInfo.outputPath('global-search-system-a-to-b-desktop.png')
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('global-search-system-a-to-b-desktop', { path: screenshotPath, contentType: 'image/png' })
})

test('two identical imported systems expose distinct same-label object destinations', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const content = identicalSearchSystemContent()
  await importIndependentCopy(page, 'duplicate-search-port-first.json', content)
  await importIndependentCopy(page, 'duplicate-search-port-second.json', content)
  await returnToClusterMap(page)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('Shared Echo')
  const resultButtons = searchDialog.locator('#workspace-search-results').getByRole('button')
  await expect(resultButtons).toHaveCount(2)
  await expect(resultButtons.nth(0)).toHaveAccessibleName(/Shared Echo.*Star System: Duplicate Port.*DUP-01.*occurrence 1/i)
  await expect(resultButtons.nth(1)).toHaveAccessibleName(/Shared Echo.*Star System: Duplicate Port.*DUP-01.*occurrence 2/i)

  await resultButtons.nth(0).click()
  const destinationMap = page.getByRole('group', { name: 'Duplicate Port star system map', exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  const firstSelectedId = await destinationMap.locator('.system-object.is-selected').getAttribute('data-object-id')
  if (!firstSelectedId) throw new Error('The first duplicate import did not select its Shared Echo object.')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(query).toHaveValue('Shared Echo')
  await expect(resultButtons).toHaveCount(2)
  await resultButtons.nth(1).click()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  await expect.poll(async () => destinationMap.locator('.system-object.is-selected').getAttribute('data-object-id'))
    .not.toBe(firstSelectedId)
  await expect(destinationMap.locator('.system-object.is-selected'))
    .toHaveAttribute('aria-label', /^Select DUP-01, Shared Echo/)
})

test('compact search reaches the last of 500 objects after rotation and activates it by touch', async ({ page }, testInfo) => {
  const largeWorkspace = largeSearchClusterContent(20, 25)
  await createSingleSystemWorkspace(page, { viewport: { width: 844, height: 390 } })
  await returnToClusterMap(page)
  await importIndependentCopy(page, 'global-search-five-hundred-objects.json', largeWorkspace)

  const selectMode = page.locator('.workspace-dock-mode button[aria-label="Select"]')
  const addButton = page.locator('.workspace-dock-add')
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await expect(addButton).toHaveAttribute('aria-expanded', 'false')
  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('searchbox', { name: 'Search workspace', exact: true })
  await query.fill('Global Beacon')
  const resultList = searchDialog.locator('#workspace-search-results')
  const resultButtons = resultList.getByRole('button')
  await expect(resultButtons).toHaveCount(500)
  await expect(searchDialog.getByRole('status')).toContainText('500 matches')

  await query.press('ArrowDown')
  const firstResult = resultButtons.first()
  await expect(firstResult).toBeFocused()
  for (const key of ['n', 's', 'm', 'a']) {
    await page.keyboard.press(key)
    await expect(searchDialog).toBeVisible()
    await expect(firstResult).toBeFocused()
    await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
    await expect(addButton).toHaveAttribute('aria-expanded', 'false')
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue('Global Beacon')
  await expect(resultButtons).toHaveCount(500)
  const resultListScrolls = await resultList.evaluate(element => element.scrollHeight > element.clientHeight)
  expect(resultListScrolls).toBe(true)

  await query.focus()
  await query.press('ArrowDown')
  await page.keyboard.press('End')
  const lastResult = resultButtons.last()
  await expect(lastResult).toBeFocused()
  await expect(lastResult).toBeInViewport()
  const contextText = await lastResult.locator('.workspace-search-result-context > span').first().textContent()
  const systemName = contextText?.match(/Star System:\s*(.+)$/)?.[1]?.trim()
  const locationKeyText = await lastResult.locator('.workspace-search-location-key').textContent()
  const locationKey = locationKeyText?.trim().replace(/^Location key:\s*/, '').trim()
  if (!systemName || !locationKey) throw new Error('The last result has no visible system and Location-key labels.')

  const resultsScreenshot = testInfo.outputPath('global-search-500-results-compact-portrait.png')
  await page.screenshot({ path: resultsScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-500-results-compact-portrait', {
    path: resultsScreenshot,
    contentType: 'image/png',
  })

  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    await tapVisibleTarget(cdp, lastResult)
  } finally {
    await cdp.detach()
  }

  const destinationMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  const selectedObject = destinationMap.locator('.system-object.is-selected')
  await expect(selectedObject).toHaveCount(1)
  await expect(selectedObject).toHaveAttribute('aria-label', `Select ${locationKey}, Global Beacon (Planet)`)
  const selectedNameLabel = selectedObject.locator('.object-name')
  const selectedKeyLabel = selectedObject.locator('.object-key')
  await expect(selectedNameLabel).toHaveText('Global Beacon')
  await expect(selectedKeyLabel).toHaveText(locationKey)
  await expectPaintedInsideUsableMap(page, destinationMap, [selectedObject, selectedNameLabel, selectedKeyLabel])
  await expect(inspectToggle(page)).toHaveAttribute('aria-expanded', 'false')

  const revealScreenshot = testInfo.outputPath('global-search-500-reveal-compact-portrait.png')
  await page.screenshot({ path: revealScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-500-reveal-compact-portrait', {
    path: revealScreenshot,
    contentType: 'image/png',
  })

  await searchButton.click()
  await expect(query).toHaveValue('Global Beacon')
})

function inspectToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Inspect', exact: true })
}
