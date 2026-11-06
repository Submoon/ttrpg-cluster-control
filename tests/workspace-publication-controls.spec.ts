import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  downloadImage,
  editMapObject,
  openChartDetails,
  openPlayerPreview,
  openWorkspaceHierarchy,
  returnToClusterMap,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
} from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

const modes = ['Hidden', 'Unknown presence', 'Known type', 'Revealed'] as const

async function setVisibility(control: import('@playwright/test').Locator, mode: typeof modes[number]): Promise<void> {
  const button = control.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(control.locator('button[aria-pressed="true"]')).toHaveCount(1)
}

test('Inspector visibility buttons update committed system and object settings without entering edit mode', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  const chartDetails = await openChartDetails(page)
  const systemControls = chartDetails.getByRole('region', { name: 'Configured visibility', exact: true })
  await expect(systemControls).toBeVisible()

  for (const mode of ['Hidden', 'Unknown presence', 'Revealed', 'Known type'] as const) {
    await setVisibility(systemControls, mode)
    if (mode === 'Hidden') {
      await expect(systemControls).toContainText('Players do not see this system.')
      await expect(systemControls).not.toContainText('orbital hosts')
    }
  }
  await expect(systemControls).toContainText('Configured visibility: Known type')

  const hierarchy = await openWorkspaceHierarchy(page)
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' })
  await expect(primaryStar).toBeVisible()
  await primaryStar.click()
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()

  const objectControls = page.getByRole('region', { name: 'Configured visibility', exact: true })
  await expect(objectControls).toBeVisible()
  await setVisibility(objectControls, 'Hidden')
  await expect(objectControls).toContainText('Required orbital hosts may appear as Unknown in the player view.')
  await setVisibility(objectControls, 'Revealed')
  await expect(objectControls).toContainText('Configured visibility: Revealed')
  await expect(objectControls).toContainText('System map unavailable to players until this system is Revealed.')
  await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await expect(primaryStar).toHaveAttribute('aria-description', /System map unavailable to players/)
  await page.mouse.move(600, 100)
  const screenshot = testInfo.outputPath('quick-publication-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('quick-publication-desktop', { path: screenshot, contentType: 'image/png' })
})

for (const width of [1280, 390]) {
  test(`Hierarchy supports keyboard and touch context actions without changing selection at ${width}px`, async ({ page }, testInfo) => {
    await createSingleSystemWorkspace(page, { viewport: { width, height: 844 } })
    const hierarchy = await openWorkspaceHierarchy(page)
    const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' })
    await expect(primaryStar).toBeVisible()

    await primaryStar.focus()
    await page.keyboard.press('Shift+F10')
    let menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
    await expect(menu).toBeVisible()
    const settings = menu.getByRole('menuitemcheckbox')
    await expect(settings).toHaveCount(4)
    await expect(menu.locator('[role="menuitemcheckbox"][aria-checked="true"]')).toHaveCount(1)
    const screenshot = testInfo.outputPath('quick-publication-menu.png')
    await menu.screenshot({ path: screenshot })
    await testInfo.attach('quick-publication-menu', { path: screenshot, contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(primaryStar).toBeFocused()

    const touchAction = hierarchy.getByRole('button', { name: 'Change visibility for Primary Star', exact: true })
    const hitArea = await touchAction.boundingBox()
    expect(hitArea).not.toBeNull()
    expect(hitArea!.width).toBeGreaterThanOrEqual(28)
    await touchAction.click()
    menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).click()
    await expect(menu).toHaveCount(0)
    await expect(primaryStar).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
    await expect(page.getByRole('region', { name: 'Object inspector', exact: true })).toHaveCount(0)
  })
}

test('compact Inspector keeps all four visibility controls comfortably tappable', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, { viewport: { width: 390, height: 844 } })
  const details = await openChartDetails(page)
  const controls = details.getByRole('group', { name: 'Configured visibility', exact: true })
  await expect(controls).toBeVisible()

  for (const mode of modes) {
    const button = controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
    const bounds = await button.boundingBox()
    expect(bounds, `${mode} control should be visible at 390px`).not.toBeNull()
    expect(bounds!.width, `${mode} touch target width`).toBeGreaterThanOrEqual(36)
    expect(bounds!.height, `${mode} touch target height`).toBeGreaterThanOrEqual(36)
  }

  await setVisibility(controls, 'Revealed')
  await page.mouse.move(100, 30)
  const screenshot = testInfo.outputPath('quick-publication-compact.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('quick-publication-compact', { path: screenshot, contentType: 'image/png' })
})

test('Hierarchy visibility resolves real object drafts and survives a reload without revealing its parent', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
  await primaryStar.click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const name = page.getByLabel('Name', { exact: true })
  const guard = page.getByRole('dialog', { name: 'Edit chart details', exact: true })

  async function invokeHierarchyVisibility(mode: typeof modes[number]): Promise<void> {
    await primaryStar.click({ button: 'right' })
    const menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitemcheckbox', { name: mode, exact: true }).click()
  }

  await editMapObject(page)
  await name.fill('Unapplied star name')
  await invokeHierarchyVisibility('Revealed')
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(name).toHaveValue('Unapplied star name')
  await expect(inspector.getByRole('group', { name: 'Draft visibility', exact: true })
    .getByRole('button', { name: 'Set visibility to Known type', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await invokeHierarchyVisibility('Revealed')
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Primary Star')
  await expect(inspector.getByRole('group', { name: 'Configured visibility', exact: true })
    .getByRole('button', { name: 'Set visibility to Revealed', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await editMapObject(page)
  await name.fill('Published setting, private star name')
  await invokeHierarchyVisibility('Hidden')
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(name).toHaveValue('Published setting, private star name')
  await expect(inspector.getByRole('group', { name: 'Configured visibility', exact: true })
    .getByRole('button', { name: 'Set visibility to Hidden', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await waitForWorkspaceSaved(page)

  const before = await downloadJson(page, 'Export star system JSON')
  expect(before.system?.publication).toBe('known-type')
  expect(before.system?.objects[0]).toMatchObject({
    name: 'Published setting, private star name', publication: 'hidden',
  })
  await page.reload()
  const reopenedHierarchy = await openWorkspaceHierarchy(page)
  await reopenedHierarchy.getByRole('treeitem', {
    name: 'Select A, Published setting, private star name', exact: true,
  }).click()
  await expect(page.getByRole('complementary', { name: 'Object inspector', exact: true })
    .getByRole('group', { name: 'Configured visibility', exact: true })
    .getByRole('button', { name: 'Set visibility to Hidden', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(before)
})

test('map keyboard publication restores focus to the surviving marker without selecting it', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const mark = page.locator('.system-object[data-object-id]').first()
  await mark.focus()
  await page.keyboard.press('Shift+F10')
  const menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(mark.locator('desc.gm-publication-description')).toContainText('Configured visibility: Revealed')
  await expect(mark).toBeFocused()
  await expect(page.locator('.system-object.is-selected')).toHaveCount(0)
})

test('visibility buttons fit the minimum Inspector width for systems and objects', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)
  await openChartDetails(page)
  const panel = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const resize = panel.getByRole('separator', { name: 'Resize object inspector panel', exact: true })
  await resize.focus()
  await page.keyboard.press('Home')
  await expect(resize).toHaveAttribute('aria-valuenow', '220')

  async function expectButtonsContained(): Promise<void> {
    const controls = panel.getByRole('region', { name: 'Configured visibility', exact: true })
    const bounds = await controls.boundingBox()
    expect(bounds).not.toBeNull()
    for (const mode of modes) {
      const button = await controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true }).boundingBox()
      expect(button).not.toBeNull()
      expect(button!.width).toBeGreaterThanOrEqual(36)
      expect(button!.x).toBeGreaterThanOrEqual(bounds!.x - 1)
      expect(button!.x + button!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1)
    }
  }

  await expectButtonsContained()
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await expectButtonsContained()
  const screenshot = testInfo.outputPath('quick-publication-minimum-inspector.png')
  await panel.screenshot({ path: screenshot })
  await testInfo.attach('quick-publication-minimum-inspector', { path: screenshot, contentType: 'image/png' })
})

async function revealHarrow(page: import('@playwright/test').Page): Promise<void> {
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: 'Open Harrow system map', exact: true }).click()
  const systemDetails = await openChartDetails(page)
  const systemVisibility = systemDetails.getByRole('region', { name: 'Configured visibility', exact: true })
  await systemVisibility.getByRole('button', { name: 'Set visibility to Revealed', exact: true }).click()
  await expect(systemVisibility.getByRole('button', { name: 'Set visibility to Revealed', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)
}

test('route Inspect sharing is a committed setting with a status badge, history, and image preservation', async ({ page }, testInfo) => {
  await importCampaignWorkspace(page)
  await setWorkspaceMapMode(page, 'Select')

  const source = await downloadJson(page, 'Export Jump Cluster JSON')
  const initialRoute = source.cluster?.routes[0]
  if (!source.cluster || !initialRoute) throw new Error('The imported campaign must contain its Jump Route.')
  expect(initialRoute.playerShared).toBe(false)
  const originSystem = source.cluster.systems.find(system =>
    system.objects.some(object => object.id === initialRoute.fromPointId),
  )
  const destinationSystem = source.cluster.systems.find(system =>
    system.objects.some(object => object.id === initialRoute.toPointId),
  )
  if (!originSystem || !destinationSystem || !initialRoute.toPointId) {
    throw new Error('The imported route must resolve to both endpoint systems.')
  }
  expect(originSystem.publication).toBe('hidden')
  expect(destinationSystem.publication).toBe('hidden')

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  const routeMark = clusterMap.locator(`.cluster-route[data-route-id="${initialRoute.id}"]`)
  await routeMark.click()
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  const visibility = routeInspector.getByRole('region', { name: 'Configured visibility', exact: true })
  await expect(visibility).toBeVisible()
  const privateButton = visibility.getByRole('button', { name: 'Set Jump Route visibility to Private', exact: true })
  const sharedButton = visibility.getByRole('button', { name: 'Set Jump Route visibility to Shared', exact: true })
  await expect(privateButton).toHaveAttribute('aria-pressed', 'true')
  await expect(sharedButton).toHaveAttribute('aria-pressed', 'false')
  await expect(routeMark).toHaveAttribute('aria-describedby', /^gm-publication-description-/)
  await expect(clusterMap.locator('desc.gm-publication-description').filter({ hasText: 'Configured visibility: Private' })).toHaveCount(1)

  const clusterBeforePublication = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  if (!clusterBeforePublication.text) throw new Error('The cluster SVG export must contain text.')
  expect(clusterBeforePublication.text).not.toContain('gm-publication')
  expect(clusterBeforePublication.text).not.toContain('Configured visibility:')

  await sharedButton.click()
  await expect(visibility).toContainText('Configured visibility: Shared with players.')
  await expect(visibility).toContainText(
    'This shared route has no visible endpoint because both endpoint systems are Hidden.',
  )
  const routeBadge = clusterMap.locator(`.gm-publication-decorations [data-route-id="${initialRoute.id}"] .gm-publication-badge`)
  await expect(routeBadge).toHaveAttribute('data-route-sharing', 'shared')
  await expect(routeBadge.locator('.gm-publication-lock-icon')).toHaveCount(1)
  await expect(clusterMap.locator('.cluster-map-items .gm-publication-badge')).toHaveCount(0)
  const screenshot = testInfo.outputPath('route-sharing-inspect-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('route-sharing-inspect-desktop', { path: screenshot, contentType: 'image/png' })

  await waitForWorkspaceSaved(page)
  const shared = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(shared.cluster?.routes.find(route => route.id === initialRoute.id))
    .toEqual({ ...initialRoute, playerShared: true })
  expect(shared.layout).toEqual(source.layout)
  const clusterAfterPublication = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  if (!clusterAfterPublication.text) throw new Error('The cluster SVG export must contain text.')
  expect(clusterAfterPublication.text).not.toContain('gm-publication')
  expect(clusterAfterPublication.text).not.toContain('Configured visibility:')
  expect(/viewBox="([^"]+)"/.exec(clusterAfterPublication.text)?.[1])
    .toBe(/viewBox="([^"]+)"/.exec(clusterBeforePublication.text)?.[1])

  const history = page.getByRole('group', { name: 'Edit history' })
  await history.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  const undone = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(undone.cluster?.routes.find(route => route.id === initialRoute.id)).toEqual(initialRoute)
  expect(undone.layout).toEqual(source.layout)
  await history.getByRole('button', { name: /^Redo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  expect((await downloadJson(page, 'Export Jump Cluster JSON')).cluster?.routes.find(route => route.id === initialRoute.id))
    .toEqual({ ...initialRoute, playerShared: true })

  await page.reload()
  await returnToClusterMap(page)
  const reloaded = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(reloaded.cluster?.routes.find(route => route.id === initialRoute.id))
    .toEqual({ ...initialRoute, playerShared: true })
  await setWorkspaceMapMode(page, 'Select')
  const reloadedMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  await reloadedMap.locator(`.cluster-route[data-route-id="${initialRoute.id}"]`).click()
  const reloadedInspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  await expect(reloadedInspector.getByRole('button', { name: 'Set Jump Route visibility to Shared', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(reloadedInspector).toContainText(
    'This shared route has no visible endpoint because both endpoint systems are Hidden.',
  )
  const reloadedBadge = reloadedMap.locator(`.gm-publication-decorations [data-route-id="${initialRoute.id}"] .gm-publication-badge`)
  await expect(reloadedBadge.locator('.gm-publication-lock-icon')).toHaveCount(1)
})

test('an unresolved shared route with a Hidden origin stays out of the player map and shows its blocked setting', async ({ page }) => {
  await importCampaignWorkspace(page)
  await revealHarrow(page)
  await setWorkspaceMapMode(page, 'Select')

  const source = await downloadJson(page, 'Export Jump Cluster JSON')
  const route = source.cluster?.routes[0]
  if (!route) throw new Error('The imported campaign must contain its Jump Route.')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
  await clusterMap.locator(`.cluster-route[data-route-id="${route.id}"]`).click()
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector', exact: true })
  const sharedButton = routeInspector.getByRole('button', { name: 'Set Jump Route visibility to Shared', exact: true })
  await sharedButton.click()
  await waitForWorkspaceSaved(page)
  await expect(routeInspector).not.toContainText('no visible endpoint')

  await routeInspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  await expect(routeInspector.getByRole('region', { name: 'Configured visibility', exact: true })).toHaveCount(0)
  await selectInspectorOption(routeInspector.getByLabel('Route destination'), 'Unresolved external exit')
  await routeInspector.getByLabel('Unknown destination label').fill('Private external exit name')
  await expect(routeInspector.getByRole('checkbox', { name: /^share with players$/i })).toBeChecked()
  await routeInspector.getByRole('button', { name: 'Apply Jump Route', exact: true }).click()
  await waitForWorkspaceSaved(page)

  await expect(routeInspector).toContainText(
    'This shared route has no visible endpoint because its origin system is Hidden.',
  )
  const badge = clusterMap.locator(`.gm-publication-decorations [data-route-id="${route.id}"] .gm-publication-badge`)
  await expect(badge).toHaveAttribute('data-route-sharing', 'shared')
  await expect(badge.locator('.gm-publication-lock-icon')).toHaveCount(1)
  await expect(clusterMap.locator(`.cluster-route[data-route-id="${route.id}"] desc.gm-publication-description`))
    .toContainText('Configured visibility: Shared with players.')
  await expect(clusterMap.locator(`.cluster-route[data-route-id="${route.id}"] desc.gm-publication-description`))
    .toContainText('origin system is Hidden')

  const blockedImage = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  if (!blockedImage.text) throw new Error('The cluster SVG export must contain text.')
  expect(blockedImage.text).not.toContain('gm-publication')
  expect(blockedImage.text).not.toContain('Configured visibility:')

  const preview = await openPlayerPreview(page)
  const playerMap = preview.locator('svg.player-cluster-map-scene')
  await expect(playerMap.locator('.player-cluster-map-marker--revealed')).toHaveCount(1)
  await expect(playerMap.locator('.player-cluster-route')).toHaveCount(0)
  const previewMarkup = await preview.evaluate(element => element.outerHTML)
  expect(previewMarkup).not.toContain('Private external exit name')
})
