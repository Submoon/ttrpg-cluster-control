import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  projectPlayerCluster,
  serializePlayerJson,
  updateChartDetails,
} from '../domain/workspace'
import type {
  PlayerClusterDocument,
  PlayerObjectMarker,
  PlayerOrbit,
} from '../domain/workspace'
import {
  addCatalogueObject,
  createSingleSystemWorkspace,
  editMapObject,
  openChartDetails,
  returnToClusterMap,
  saveMapObject,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
} from './helpers'

async function gatePlayerReaderScripts(page: import('@playwright/test').Page): Promise<{
  release: () => void
  cleanup: () => Promise<void>
}> {
  let releaseScripts!: () => void
  const scriptsReleased = new Promise<void>(resolve => { releaseScripts = resolve })

  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'script') await scriptsReleased
    await route.continue()
  })

  return {
    release: releaseScripts,
    async cleanup() {
      releaseScripts()
      await page.unrouteAll({ behavior: 'wait' })
    },
  }
}

async function downloadJsonArtifact(
  page: import('@playwright/test').Page,
  buttonName: string,
): Promise<{ fileName: string; path: string; text: string }> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error(`The downloaded ${buttonName} file has no readable path.`)
  return {
    fileName: download.suggestedFilename(),
    path,
    text: await readFile(path, 'utf8'),
  }
}

function createRevealedPlayerJson(title: string, systemName: string): string {
  const workspace = createLocalWorkspace(`PRIVATE ${title} workspace`, systemName)
  const system = workspace.cluster.systems[0]!
  const published = updateChartDetails(workspace, system.id, {
    clusterName: workspace.cluster.name,
    systemName: system.name,
    playerTitle: title,
    publication: 'revealed',
  })
  return serializePlayerJson(projectPlayerCluster(published))
}

async function uploadPlayerJson(
  input: import('@playwright/test').Locator,
  fileName: string,
  playerJson: string,
): Promise<void> {
  await input.setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(playerJson, 'utf8'),
  })
}

test('a downloaded player JSON opens in the standalone reader for Revealed inspection', async ({ browser, page, previewCookies }, testInfo) => {
  test.setTimeout(60_000)
  const privateClusterName = 'PRIVATE Reach'
  const privateNotes = 'GM ONLY: a concealed passage runs below the garden.'
  const publicSystemName = 'Vesper'
  const publicObjectName = 'Pilgrim World'
  const publicPlayerText = 'A quiet sanctuary rests beneath a violet sky.'

  await createSingleSystemWorkspace(page, {
    clusterName: privateClusterName,
    systemName: publicSystemName,
  })
  await addCatalogueObject(page, 'planet')

  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill(publicObjectName)
  await objectInspector.getByLabel('Player text', { exact: true }).fill(publicPlayerText)
  await objectInspector.getByLabel('GM notes', { exact: true }).fill(privateNotes)
  await selectInspectorOption(objectInspector.getByLabel('How players see this object'), 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await chartEdit.getByLabel('Player-facing title').fill('Pilgrim Reach')
  await selectInspectorOption(chartEdit.getByLabel('How players see this system'), 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  const playerExport = page.getByRole('button', { name: 'Export player JSON', exact: true })
  await expect(playerExport).toBeVisible({ timeout: 5_000 })
  const playerFile = await downloadJsonArtifact(page, 'Export player JSON')
  expect(playerFile.fileName).toMatch(/\.json$/i)
  expect(playerFile.fileName).not.toContain(privateClusterName)
  const playerJson = playerFile.text
  expect(playerJson).not.toContain(privateClusterName)
  expect(playerJson).not.toContain(privateNotes)
  expect(playerJson).toContain('Pilgrim Reach')
  expect(playerJson).toContain(publicSystemName)
  expect(playerJson).toContain(publicObjectName)

  await setHeaderMapActionsOpen(page, true)
  const completeBackup = (await downloadJsonArtifact(page, 'Export Jump Cluster JSON')).text
  expect(completeBackup).toContain(privateClusterName)
  expect(completeBackup).toContain(privateNotes)

  const recipientContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    if (previewCookies.length) await recipientContext.addCookies(previewCookies)
    const recipientPage = await recipientContext.newPage()
    await recipientPage.goto('/player')
    const playerFileInput = recipientPage.getByLabel('Open player JSON', { exact: true })
    await expect(playerFileInput).toBeEnabled({ timeout: 30_000 })
    await playerFileInput.setInputFiles(playerFile.path)

    await expect(recipientPage.getByRole('heading', { name: 'Pilgrim Reach', exact: true }))
      .toBeVisible({ timeout: 30_000 })
    const clusterMap = recipientPage.getByRole('region', { name: 'Player-visible Jump Cluster map' })
    await clusterMap.getByRole('button', { name: new RegExp(`Open ${publicSystemName}`) }).click()
    const systemMap = recipientPage.getByRole('region', { name: 'Player-visible system map' })
    const playerNavigation = recipientPage.getByRole('toolbar', { name: 'Player map navigation', exact: true })
    const inspectToggle = playerNavigation.getByRole('button', { name: 'Inspect', exact: true })
    if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
    await systemMap.getByRole('button', { name: `Inspect ${publicObjectName}`, exact: true }).click()

    const publicDetails = recipientPage.getByRole('region', { name: 'Player object details', exact: true })
    await expect(publicDetails).toBeVisible()
    await expect(publicDetails).toContainText(publicPlayerText)
    await expect(recipientPage.locator('body')).not.toContainText(privateClusterName)
    await expect(recipientPage.locator('body')).not.toContainText(privateNotes)

    const desktopScreenshot = testInfo.outputPath('player-reader-desktop.png')
    await recipientPage.screenshot({ path: desktopScreenshot, fullPage: true })
    await testInfo.attach('player-reader-desktop', { path: desktopScreenshot, contentType: 'image/png' })

    await recipientPage.setViewportSize({ width: 390, height: 844 })
    const compactBackButton = recipientPage.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
    const compactFitButton = systemMap.getByRole('button', { name: 'Fit player map', exact: true })
    await expect(compactBackButton).toBeVisible()
    await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
    await inspectToggle.click()
    const compactDetailsPanel = recipientPage.getByRole('dialog', { name: 'Player details', exact: true })
    await expect(compactDetailsPanel).toBeVisible()
    await expect(publicDetails).toContainText(publicPlayerText)
    await compactDetailsPanel.getByRole('button', { name: 'Return to map', exact: true }).click()
    await expect(compactDetailsPanel).toBeHidden()
    await expect(inspectToggle).toBeFocused()
    await compactFitButton.scrollIntoViewIfNeeded()
    await expect(compactFitButton).toBeVisible()
    const compactWidth = await recipientPage.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(compactWidth.document).toBeLessThanOrEqual(compactWidth.viewport)

    const compactScreenshot = testInfo.outputPath('player-reader-compact-390x844.png')
    await recipientPage.screenshot({ path: compactScreenshot, fullPage: true })
    await testInfo.attach('player-reader-compact-390x844', { path: compactScreenshot, contentType: 'image/png' })

    await compactFitButton.click()
    await compactBackButton.click()
    await expect(recipientPage.getByRole('region', { name: 'Player-visible Jump Cluster map' }))
      .toBeVisible()
    await expect(recipientPage.getByRole('button', { name: new RegExp(`Open ${publicSystemName}`) }))
      .toBeVisible()
  } finally {
    await recipientContext.close()
  }
})

test('the player reader keeps file selection disabled until its client is ready', async ({ page }) => {
  test.setTimeout(60_000)
  const scriptGate = await gatePlayerReaderScripts(page)
  try {
    await page.goto('/player', { waitUntil: 'commit' })
    const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
    const openPlayerButton = page.getByRole('button', { name: 'Open player JSON', exact: true })
    await expect(openPlayerButton).toBeVisible()
    await expect(openPlayerButton).toBeDisabled()
    await expect(playerFileInput).toBeHidden()
    await expect(playerFileInput).toBeDisabled()

    scriptGate.release()
    await expect(openPlayerButton).toBeEnabled({ timeout: 30_000 })
    await expect(playerFileInput).toBeEnabled({ timeout: 30_000 })

    const workspace = createLocalWorkspace('Private readiness workspace', 'Readiness Vesper')
    const system = workspace.cluster.systems[0]!
    const published = updateChartDetails(workspace, system.id, {
      clusterName: workspace.cluster.name,
      systemName: system.name,
      playerTitle: 'Reader Readiness Reach',
      publication: 'revealed',
    })
    const playerJson = serializePlayerJson(projectPlayerCluster(published))
    await playerFileInput.setInputFiles({
      name: 'reader-readiness.json',
      mimeType: 'application/json',
      buffer: Buffer.from(playerJson, 'utf8'),
    })
    await expect(page.getByRole('heading', { name: 'Reader Readiness Reach', exact: true }))
      .toBeVisible({ timeout: 30_000 })
  } finally {
    await scriptGate.cleanup()
  }
})

test('invalid and oversized replacements clear the player map without falling back to the saved GM workspace', async ({ page }) => {
  test.setTimeout(60_000)
  const gmClusterName = 'PRIVATE GM Reach'
  const gmSystemName = 'PRIVATE GM Vesper'
  await createSingleSystemWorkspace(page, { clusterName: gmClusterName, systemName: gmSystemName })
  await waitForWorkspaceSaved(page)

  const readerPage = await page.context().newPage()
  try {
    await readerPage.addInitScript(() => {
      type FileReadWindow = Window & { __playerFileTextCalls?: number }
      const instrumentedWindow = window as FileReadWindow
      instrumentedWindow.__playerFileTextCalls = 0
      const nativeText = File.prototype.text
      File.prototype.text = function () {
        instrumentedWindow.__playerFileTextCalls = (instrumentedWindow.__playerFileTextCalls ?? 0) + 1
        return nativeText.call(this)
      }
    })
    await readerPage.goto('/player')
    const input = readerPage.getByLabel('Open player JSON', { exact: true })
    await expect(input).toBeEnabled({ timeout: 30_000 })
    const publicTitle = 'Replacement Reach'
    await uploadPlayerJson(input, 'replacement.json', createRevealedPlayerJson(publicTitle, 'Public Vesper'))
    await expect(readerPage.getByRole('heading', { name: publicTitle, exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(readerPage.locator('body')).not.toContainText(gmClusterName)
    await expect(readerPage.locator('body')).not.toContainText(gmSystemName)

    await uploadPlayerJson(input, 'truncated.json', '{"private":"PRIVATE-TRUNCATED-MARKER"')
    await expect(readerPage.getByRole('alert')).toHaveText('The player JSON file is not valid JSON.')
    await expect(readerPage.getByRole('heading', { name: publicTitle, exact: true })).toHaveCount(0)
    await expect(readerPage.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    await expect(readerPage.getByRole('heading', { name: 'Open a player map', exact: true })).toBeVisible()
    await expect(readerPage.locator('body')).not.toContainText(gmClusterName)
    await expect(readerPage.locator('body')).not.toContainText(gmSystemName)

    await uploadPlayerJson(input, 'replacement-again.json', createRevealedPlayerJson(publicTitle, 'Public Vesper'))
    await expect(readerPage.getByRole('heading', { name: publicTitle, exact: true })).toBeVisible({ timeout: 30_000 })
    const readsBeforeOversizedSelection = await readerPage.evaluate(() =>
      (window as Window & { __playerFileTextCalls?: number }).__playerFileTextCalls ?? 0,
    )
    expect(readsBeforeOversizedSelection).toBeGreaterThan(0)
    await input.setInputFiles({
      name: 'oversized.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 0x20),
    })
    await expect(readerPage.getByRole('alert')).toHaveText('The player document exceeds the supported size or work limit.')
    await expect(readerPage.getByRole('heading', { name: publicTitle, exact: true })).toHaveCount(0)
    await expect(readerPage.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    const readsAfterOversizedSelection = await readerPage.evaluate(() =>
      (window as Window & { __playerFileTextCalls?: number }).__playerFileTextCalls ?? 0,
    )
    expect(readsAfterOversizedSelection).toBe(readsBeforeOversizedSelection)
    await expect(readerPage.locator('body')).not.toContainText(gmClusterName)
    await expect(readerPage.locator('body')).not.toContainText(gmSystemName)
  } finally {
    await readerPage.close()
  }
})

test('player documents stay independent across tabs and reload returns to the chooser without affecting saved GM data', async ({ page }) => {
  test.setTimeout(90_000)
  const gmClusterName = 'PRIVATE Saved GM Reach'
  const gmSystemName = 'PRIVATE Saved GM Vesper'
  await createSingleSystemWorkspace(page, { clusterName: gmClusterName, systemName: gmSystemName })
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)
  await setHeaderMapActionsOpen(page, true)
  const originalGmBackup = await downloadJsonArtifact(page, 'Export Jump Cluster JSON')

  const firstReader = await page.context().newPage()
  const secondReader = await page.context().newPage()
  try {
    await Promise.all([firstReader.goto('/player'), secondReader.goto('/player')])
    const firstInput = firstReader.getByLabel('Open player JSON', { exact: true })
    const secondInput = secondReader.getByLabel('Open player JSON', { exact: true })
    await Promise.all([
      expect(firstInput).toBeEnabled({ timeout: 30_000 }),
      expect(secondInput).toBeEnabled({ timeout: 30_000 }),
    ])

    const firstTitle = 'First Private File Reach'
    const secondTitle = 'Second Private File Reach'
    await Promise.all([
      uploadPlayerJson(firstInput, 'first-player.json', createRevealedPlayerJson(firstTitle, 'First File Vesper')),
      uploadPlayerJson(secondInput, 'second-player.json', createRevealedPlayerJson(secondTitle, 'Second File Vesper')),
    ])
    await Promise.all([
      expect(firstReader.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible({ timeout: 30_000 }),
      expect(secondReader.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible({ timeout: 30_000 }),
    ])
    await expect(firstReader.getByRole('region', { name: 'Player-visible Jump Cluster map' })
      .getByRole('button', { name: /Open First File Vesper/ })).toBeVisible()
    await expect(secondReader.getByRole('region', { name: 'Player-visible Jump Cluster map' })
      .getByRole('button', { name: /Open Second File Vesper/ })).toBeVisible()
    await expect(firstReader.locator('body')).not.toContainText(secondTitle)
    await expect(secondReader.locator('body')).not.toContainText(firstTitle)
    await expect(firstReader.locator('body')).not.toContainText(gmClusterName)
    await expect(secondReader.locator('body')).not.toContainText(gmClusterName)

    await firstReader.reload()
    await expect(firstInput).toBeEnabled({ timeout: 30_000 })
    await expect(firstReader.getByRole('heading', { name: 'Open a player map', exact: true })).toBeVisible()
    await expect(firstReader.getByRole('heading', { name: firstTitle, exact: true })).toHaveCount(0)
    await expect(firstReader.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
    await expect(secondReader.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible()

    await page.reload()
    await waitForWorkspaceStartup(page)
    await returnToClusterMap(page)
    await setHeaderMapActionsOpen(page, true)
    const savedGmBackup = await downloadJsonArtifact(page, 'Export Jump Cluster JSON')
    expect(JSON.parse(savedGmBackup.text)).toEqual(JSON.parse(originalGmBackup.text))
  } finally {
    await firstReader.close()
    await secondReader.close()
  }
})

test('a delayed older File.text result cannot replace a newer player selection', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    type DeferredReadWindow = Window & { __releaseOlderPlayerRead?: () => void }
    const instrumentedWindow = window as DeferredReadWindow
    const nativeText = File.prototype.text
    File.prototype.text = function () {
      const fileName = this.name
      return nativeText.call(this).then((text) => {
        if (fileName !== 'older-player.json') return text
        return new Promise<string>((resolve) => {
          instrumentedWindow.__releaseOlderPlayerRead = () => resolve(text)
        })
      })
    }
  })
  await page.goto('/player')
  const input = page.getByLabel('Open player JSON', { exact: true })
  await expect(input).toBeEnabled({ timeout: 30_000 })

  await uploadPlayerJson(input, 'older-player.json', createRevealedPlayerJson('Older File Reach', 'Older File Vesper'))
  await expect.poll(async () => page.evaluate(() =>
    typeof (window as Window & { __releaseOlderPlayerRead?: () => void }).__releaseOlderPlayerRead === 'function',
  ), { timeout: 30_000 }).toBe(true)

  const latestTitle = 'Latest File Reach'
  await uploadPlayerJson(input, 'newer-player.json', createRevealedPlayerJson(latestTitle, 'Latest File Vesper'))
  await expect(page.getByRole('heading', { name: latestTitle, exact: true })).toBeVisible({ timeout: 30_000 })
  await page.evaluate(() => {
    const instrumentedWindow = window as Window & { __releaseOlderPlayerRead?: () => void }
    instrumentedWindow.__releaseOlderPlayerRead?.()
    delete instrumentedWindow.__releaseOlderPlayerRead
  })

  await expect(page.getByRole('heading', { name: latestTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Older File Reach', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Player-visible Jump Cluster map' })
    .getByRole('button', { name: /Open Latest File Vesper/ })).toBeVisible()
})

test('the player reader exposes nested hierarchy levels and bounded public parent context', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const suffix = '-TAIL-MUST-NOT-REPEAT'
  const prefix = 'Custom Other '
  const longSubtype = `${prefix}${'A'.repeat(512 - prefix.length - suffix.length)}${suffix}`
  expect(longSubtype).toHaveLength(512)

  const objects: PlayerObjectMarker[] = [{
    id: 'object-1',
    position: { x: 480, y: 280 },
    placement: { kind: 'system' },
    disclosure: 'known-type',
    family: 'Other',
    subtype: longSubtype,
    label: longSubtype,
  }]
  const orbits: PlayerOrbit[] = []
  const addRevealedPlanet = (
    id: string,
    label: string,
    placement: PlayerObjectMarker['placement'],
    index: number,
  ): void => {
    objects.push({
      id,
      position: { x: 120 + index * 8, y: 160 + index * 4 },
      placement,
      disclosure: 'revealed',
      family: 'CelestialBody',
      subtype: 'planet',
      label,
      playerText: '',
      fields: [],
    })
  }
  const addOrbit = (index: number, hostId: string): string => {
    const id = `orbit-${index}`
    orbits.push({
      id,
      hostId,
      center: { x: 480 + index, y: 280 + index },
      radii: { horizontal: 40 + index, vertical: 30 + index },
      rotation: 0,
    })
    return id
  }

  for (let index = 1; index <= 20; index += 1) {
    const orbitId = addOrbit(index, 'object-1')
    addRevealedPlanet(`object-${index + 1}`, `Child ${index}`, { kind: 'orbit', orbitId, angle: 0 }, index)
  }

  addRevealedPlanet('object-22', 'Link 1', { kind: 'system' }, 21)
  for (let link = 2; link <= 10; link += 1) {
    const orbitId = addOrbit(20 + link - 1, `object-${20 + link}`)
    addRevealedPlanet(`object-${21 + link}`, `Link ${link}`, { kind: 'orbit', orbitId, angle: 0 }, 20 + link)
  }
  const leafOrbitId = addOrbit(30, 'object-31')
  addRevealedPlanet('object-32', 'Deep leaf', { kind: 'orbit', orbitId: leafOrbitId, angle: 0 }, 32)

  const document: PlayerClusterDocument = {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Breadcrumb Reach',
    systems: [{
      id: 'system-1',
      position: { x: 480, y: 280 },
      disclosure: 'revealed',
      type: 'star-system',
      label: 'Breadcrumb System',
      map: { objects, orbits },
    }],
    routes: [],
  }
  const playerJson = serializePlayerJson(document)

  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled({ timeout: 30_000 })
  await playerFileInput.setInputFiles({
    name: 'breadcrumb-player.json',
    mimeType: 'application/json',
    buffer: Buffer.from(playerJson, 'utf8'),
  })
  await expect(page.getByRole('heading', { name: 'Breadcrumb Reach', exact: true }))
    .toBeVisible({ timeout: 30_000 })

  const clusterMap = page.getByRole('region', { name: 'Player-visible Jump Cluster map' })
  await clusterMap.getByRole('button', { name: /Open Breadcrumb System/ }).click()
  const playerNavigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  const hierarchyToggle = playerNavigation.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectToggle = playerNavigation.getByRole('button', { name: 'Inspect', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const hierarchy = page.getByRole('region', { name: 'Visible system hierarchy', exact: true })
  const tree = hierarchy.getByRole('tree', { name: 'Player object and Orbit hierarchy', exact: true })
  const longHost = tree.getByRole('treeitem', { name: /^Custom Other / })
  await expect(longHost).toHaveAttribute('aria-level', '1')
  expect(await longHost.textContent()).toContain(longSubtype)
  await longHost.press('ArrowRight')
  await expect(longHost).toHaveAttribute('aria-expanded', 'true')

  const hostOrbits = tree.getByRole('treeitem', { name: /^Orbit around Custom Other / })
  await expect(hostOrbits).toHaveCount(20)
  for (let index = 0; index < 20; index += 1) {
    const orbit = hostOrbits.nth(index)
    await expect(orbit).toHaveAttribute('aria-level', '2')
    await orbit.press('ArrowRight')
    await expect(orbit).toHaveAttribute('aria-expanded', 'true')
  }

  const childRows = tree.getByRole('treeitem', { name: /^Child \d+,/ })
  await expect(childRows).toHaveCount(20)
  for (let index = 0; index < 20; index += 1) {
    const child = childRows.nth(index)
    await expect(child).toHaveAttribute('aria-level', '3')
    const path = (await child.locator('.player-system-hierarchy-path').textContent())?.trim() ?? ''
    expect(path).toMatch(/^Orbit around /)
    const pathSegment = path.slice('Orbit around '.length)
    expect(pathSegment.length).toBeLessThanOrEqual(80)
    expect(pathSegment).not.toContain(suffix)
  }

  for (let link = 1; link <= 10; link += 1) {
    const object = tree.getByRole('treeitem', { name: new RegExp(`^Link ${link},`) })
    await expect(object).toHaveAttribute('aria-level', String(link * 2 - 1))
    await object.press('ArrowRight')
    await expect(object).toHaveAttribute('aria-expanded', 'true')
    const orbit = tree.getByRole('treeitem', { name: `Orbit around Link ${link}`, exact: true })
    await expect(orbit).toHaveAttribute('aria-level', String(link * 2))
    await orbit.press('ArrowRight')
    await expect(orbit).toHaveAttribute('aria-expanded', 'true')
  }

  const deepLeaf = tree.getByRole('treeitem', { name: /^Deep leaf,/ })
  await expect(deepLeaf).toHaveAttribute('aria-level', '21')
  const deepContext = (await deepLeaf.locator('.player-system-hierarchy-path').textContent())?.trim() ?? ''
  expect(deepContext).toBe('Orbit around Link 10')
  expect(deepContext).not.toContain('Link 9')
  expect(deepContext).not.toContain('→')

  const hierarchyPanel = page.locator('#workspace-hierarchy-panel')
  const resizeHandle = hierarchyPanel.getByRole('separator', { name: 'Resize player hierarchy panel', exact: true })
  const minimumWidth = await resizeHandle.getAttribute('aria-valuemin')
  await resizeHandle.focus()
  await page.keyboard.press('Home')
  await expect(resizeHandle).toHaveAttribute('aria-valuenow', minimumWidth ?? '220')
  const deepBranch = tree.getByRole('treeitem', { name: /^Link 10,/ })
  await deepBranch.click()
  await expect(deepBranch).toHaveAttribute('aria-expanded', 'true')
  for (const row of [deepBranch, deepLeaf]) {
    const metrics = await row.evaluate(element => {
      const title = element.querySelector('.player-system-hierarchy-title')
      const glyph = element.querySelector('.player-system-hierarchy-glyph')
      const glyphSpace = glyph && title
        ? glyph.getBoundingClientRect().width + (Number.parseFloat(getComputedStyle(title).columnGap) || 0)
        : 0
      return {
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        // Measure available name space, rather than the ink width of a short name.
        labelWidth: (title?.getBoundingClientRect().width ?? 0) - glyphSpace,
      }
    })
    expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.width)
    expect(metrics.labelWidth).toBeGreaterThanOrEqual(80)
  }
  await deepLeaf.scrollIntoViewIfNeeded()
  const minimumScreenshot = testInfo.outputPath('player-deep-hierarchy-minimum-width.png')
  await page.screenshot({ path: minimumScreenshot, animations: 'disabled' })
  await testInfo.attach('player-deep-hierarchy-minimum-width', { path: minimumScreenshot, contentType: 'image/png' })

  await hostOrbits.first().click()
  const orbitDetails = page.getByRole('region', { name: 'Player Orbit details', exact: true })
  await expect(orbitDetails).toContainText(longSubtype)
  await expect(orbitDetails.getByRole('region', { name: 'Public objects in this Orbit', exact: true }))
    .toContainText('Child 1')

  await longHost.click()
  await expect(longHost).toHaveAttribute('aria-expanded', 'true')
  const details = page.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toContainText(longSubtype)
  const documentWidth = await page.evaluate(() => ({
    document: window.document.documentElement.scrollWidth,
    viewport: window.document.documentElement.clientWidth,
  }))
  expect(documentWidth.document).toBeLessThanOrEqual(documentWidth.viewport)
  const publicDom = await page.locator('body').evaluate(body => body.innerHTML)
  expect(publicDom).not.toContain('PRIVATE')
})
