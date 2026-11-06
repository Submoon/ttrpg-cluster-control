import { expect, test, type Locator, type Page } from './fixtures'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import { expectPaintedInsideUsableMap } from './scenarios/search-assertions'

import {
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  type StarSystem,
} from '../domain/workspace'
import {
  downloadJson,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  panMap,
  resolveImportReview,
  returnToClusterMap,
  setJsonFile,
  setWorkspaceMapMode,
  waitForWorkspaceStartup,
} from './helpers'

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



test('native search consults and reveals the last of 500 ordered objects by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForWorkspaceStartup(page)
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Search staging')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await setJsonFile(jsonMapImportInput(page), 'global-search-five-hundred-objects.json', largeSearchClusterContent(20, 25))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await returnToClusterMap(page)
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
  await expect(resultOptions.last()).toContainText('Global Beacon')
  await expect(resultOptions.last()).toContainText('Star System: Global System 20')
  await expect(resultOptions.last()).toContainText(/Location key:\s*GS20-\d{2}/)

  await query.press('ArrowDown')
  await expect(query).toBeFocused()
  const firstOptionId = await resultOptions.first().getAttribute('id')
  if (!firstOptionId) throw new Error('The first Palette option has no stable DOM id.')
  await expect(query).toHaveAttribute('aria-activedescendant', firstOptionId)
  await expect(page.locator('.cluster-map-content')).toHaveAttribute('transform', initialClusterTransform)
  const resultListViewport = resultList.locator('[data-slot="viewport"]')
  const resultListScrolls = await resultListViewport.evaluate(element => element.scrollHeight > element.clientHeight)
  expect(resultListScrolls).toBe(true)

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
})


function inspectToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Inspect', exact: true })
}
