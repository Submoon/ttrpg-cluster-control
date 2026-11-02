import { expect, test, type Locator, type Page } from './fixtures'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import { expectPaintedInsideUsableMap } from './scenarios/search-assertions'
import { expectPaletteOptionActive } from './scenarios/search-palette'
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

async function expectSearchListboxAssociation(page: Page, searchDialog: Locator, query: Locator): Promise<Locator> {
  const controlledId = await query.getAttribute('aria-controls')
  expect(controlledId).toBe('workspace-search-results')
  await expect(searchDialog.locator('[role="listbox"]')).toHaveCount(1)
  const controlledListbox = page.locator(`[id="${controlledId}"]`)
  await expect(controlledListbox).toHaveCount(1)
  await expect(controlledListbox).toHaveAttribute('role', 'listbox')
  await expect(controlledListbox).toHaveAttribute('aria-label', 'Search results')
  return controlledListbox
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
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Harrow Arrival')

  const result = searchDialog.getByRole('option', { name: /Harrow Arrival/ })
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
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Iria')
  const result = searchDialog.getByRole('option', { name: /Iria/ })
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
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('A')
  const harrowResult = searchDialog.getByRole('option', {
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
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Shared Echo')
  const resultOptions = searchDialog.getByRole('listbox').getByRole('option')
  await expect(resultOptions).toHaveCount(2)
  await expect(resultOptions.nth(0)).toHaveAccessibleName(/Shared Echo.*Star System: Duplicate Port.*DUP-01.*occurrence 1/i)
  await expect(resultOptions.nth(1)).toHaveAccessibleName(/Shared Echo.*Star System: Duplicate Port.*DUP-01.*occurrence 2/i)

  await resultOptions.nth(0).click()
  const destinationMap = page.getByRole('group', { name: 'Duplicate Port star system map', exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  const firstSelectedId = await destinationMap.locator('.system-object.is-selected').getAttribute('data-object-id')
  if (!firstSelectedId) throw new Error('The first duplicate import did not select its Shared Echo object.')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(query).toHaveValue('Shared Echo')
  await expect(resultOptions).toHaveCount(2)
  await resultOptions.nth(1).click()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  await expect.poll(async () => destinationMap.locator('.system-object.is-selected').getAttribute('data-object-id'))
    .not.toBe(firstSelectedId)
  await expect(destinationMap.locator('.system-object.is-selected'))
    .toHaveAttribute('aria-label', /^Select DUP-01, Shared Echo/)
})

test('native search consults and reveals the last of 500 ordered objects by keyboard', async ({ page }, testInfo) => {
  const largeWorkspace = largeSearchClusterContent(20, 25)
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  await returnToClusterMap(page)
  await importIndependentCopy(page, 'global-search-five-hundred-objects.json', largeWorkspace)
  const initialClusterTransform = await page.locator('.cluster-map-content').getAttribute('transform')
  if (!initialClusterTransform) throw new Error('The cluster consultation fixture has no map camera transform.')

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await expect(query).toBeVisible()
  await expectSearchListboxAssociation(page, searchDialog, query)

  await query.fill('Global Beacon')
  const resultList = searchDialog.getByRole('listbox')
  const resultOptions = resultList.getByRole('option')
  await expect(resultOptions).toHaveCount(500)
  await expect(searchDialog.getByRole('status')).toContainText('500 matches')
  await expect(resultOptions.first()).toContainText('Global Beacon')
  await expect(resultOptions.first()).toContainText('Star System: Global System 01')
  await expect(resultOptions.first()).toContainText(/Location key:\s*GS01-\d{2}/)
  await expect(resultOptions.nth(24)).toContainText('Star System: Global System 01')
  await expect(resultOptions.nth(24)).toContainText(/Location key:\s*GS01-\d{2}/)
  await expect(resultOptions.nth(25)).toContainText('Star System: Global System 02')
  await expect(resultOptions.nth(25)).toContainText(/Location key:\s*GS02-\d{2}/)
  await expect(resultOptions.last()).toContainText('Global Beacon')
  await expect(resultOptions.last()).toContainText('Star System: Global System 20')
  await expect(resultOptions.last()).toContainText(/Location key:\s*GS20-\d{2}/)

  await query.press('ArrowDown')
  await expect(query).toBeFocused()
  const firstOptionId = await resultOptions.first().getAttribute('id')
  if (!firstOptionId) throw new Error('The first Palette option has no stable DOM id.')
  await expect(query).toHaveAttribute('aria-activedescendant', firstOptionId)
  await expect(resultList.getByRole('option').first()).toHaveAttribute('id', firstOptionId)
  await expect(page.locator('.cluster-map-content')).toHaveAttribute('transform', initialClusterTransform)
  const resultListViewport = resultList.locator('[data-slot="viewport"]')
  const resultListScrolls = await resultListViewport.evaluate(element => element.scrollHeight > element.clientHeight)
  expect(resultListScrolls).toBe(true)

  await query.focus()
  await query.press('ArrowDown')
  await query.press('End')
  const lastOption = resultOptions.last()
  await expect(query).toBeFocused()
  const lastOptionId = await lastOption.getAttribute('id')
  if (!lastOptionId) throw new Error('The last Palette option has no stable DOM id.')
  await expect(query).toHaveAttribute('aria-activedescendant', lastOptionId)
  await expect(lastOption).toBeInViewport()
  await expect(page.locator('.cluster-map-content')).toHaveAttribute('transform', initialClusterTransform)
  const contextText = await lastOption.locator('.workspace-search-result-context > span').first().textContent()
  const systemName = contextText?.match(/Star System:\s*(.+)$/)?.[1]?.trim()
  const locationKeyText = await lastOption.locator('.workspace-search-location-key').textContent()
  const locationKey = locationKeyText?.trim().replace(/^Location key:\s*/, '').trim()
  if (!systemName || !locationKey) throw new Error('The last option has no visible system and Location-key labels.')

  const resultsScreenshot = testInfo.outputPath('global-search-500-results-compact.png')
  await page.screenshot({ path: resultsScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-500-results-compact', {
    path: resultsScreenshot,
    contentType: 'image/png',
  })

  await query.press('Enter')

  const destinationMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  const selectedObject = destinationMap.locator('.system-object.is-selected')
  await expect(selectedObject).toHaveCount(1)
  await expect(selectedObject).toHaveAttribute('aria-label', `Select ${locationKey}, Global Beacon (Planet)`)
  const selectedNameLabel = selectedObject.locator('.object-name')
  const selectedKeyLabel = selectedObject.locator('.object-key')
  const selectedGlyph = selectedObject.locator('.system-object-glyph')
  const selectedTypeMark = selectedObject.locator('.object-type-mark')
  await expect(selectedNameLabel).toHaveText('Global Beacon')
  await expect(selectedKeyLabel).toHaveText(locationKey)
  await expectPaintedInsideUsableMap(page, destinationMap, [
    selectedGlyph,
    selectedTypeMark,
    selectedNameLabel,
    selectedKeyLabel,
  ])
  await expect(inspectToggle(page)).toHaveAttribute('aria-expanded', 'false')

  const revealScreenshot = testInfo.outputPath('global-search-500-reveal-compact-portrait.png')
  await page.screenshot({ path: revealScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-500-reveal-compact-portrait', {
    path: revealScreenshot,
    contentType: 'image/png',
  })

  await searchButton.click()
  await expect(query).toHaveValue('Global Beacon')
  const reopenedListbox = await expectSearchListboxAssociation(page, searchDialog, query)
  await expect(reopenedListbox.getByRole('option')).toHaveCount(500)
})

test('compact Palette reaches and touch-activates the last of 500 results after rotation', async ({ page }, testInfo) => {
  const largeWorkspace = largeSearchClusterContent(20, 25)
  await createSingleSystemWorkspace(page, { viewport: { width: 844, height: 390 } })
  await returnToClusterMap(page)
  await importIndependentCopy(page, 'global-search-five-hundred-touch.json', largeWorkspace)

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Global Beacon')
  const resultList = await expectSearchListboxAssociation(page, searchDialog, query)
  const resultOptions = resultList.getByRole('option')
  await expect(resultOptions).toHaveCount(500)
  await expect(resultOptions.last()).toContainText('Star System: Global System 20')
  await expect(resultOptions.last()).toContainText(/Location key:\s*GS20-\d{2}/)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(searchDialog).toBeVisible()
  await expect(query).toHaveValue('Global Beacon')
  await expect(resultOptions).toHaveCount(500)
  await query.press('ArrowDown')
  await query.press('End')
  await expectPaletteOptionActive(query, resultOptions.last())
  await expect(resultOptions.last()).toBeInViewport()

  const contextText = await resultOptions.last().locator('.workspace-search-result-context > span').first().textContent()
  const systemName = contextText?.match(/Star System:\s*(.+)$/)?.[1]?.trim()
  const locationKeyText = await resultOptions.last().locator('.workspace-search-location-key').textContent()
  const locationKey = locationKeyText?.trim().replace(/^Location key:\s*/, '').trim()
  if (!systemName || !locationKey) throw new Error('The last touched result has no visible system and Location-key labels.')
  const resultsScreenshot = testInfo.outputPath('global-search-500-touch-results-compact-portrait.png')
  await page.screenshot({ path: resultsScreenshot, animations: 'disabled' })
  await testInfo.attach('global-search-500-touch-results-compact-portrait', {
    path: resultsScreenshot,
    contentType: 'image/png',
  })

  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    await tapVisibleTarget(cdp, resultOptions.last())
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => undefined)
    await cdp.detach()
  }

  const destinationMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  await expect(destinationMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(destinationMap).toBeFocused()
  await expect(destinationMap.locator('.system-object.is-selected'))
    .toHaveAttribute('aria-label', `Select ${locationKey}, Global Beacon (Planet)`)

  await searchButton.click()
  await expect(query).toHaveValue('Global Beacon')
})

function inspectToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Inspect', exact: true })
}
