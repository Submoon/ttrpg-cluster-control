import { expect, test } from './fixtures'
import type { TestInfo } from '@playwright/test'
import { serializePlayerJson } from '../domain/workspace'
import type { PlayerClusterDocument } from '../domain/workspace'
import { measureMouseDrag, snapshotSvgCoordinates } from './helpers'

const playerTitle = 'Starlight Reach'
const systemName = 'Vesper'
const knownStarLabel = 'Star'
const revealedObjectName = 'Sanctuary'
const publicTextTail = 'PUBLIC-END-MARKER'
const publicPlayerText = `${'A quiet sanctuary rests beneath a violet sky. '.repeat(36)}${'A'.repeat(512)} ${publicTextTail}`

function createPlayerDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: playerTitle,
    systems: [{
      id: 'system-1',
      position: { x: 480, y: 280 },
      disclosure: 'revealed',
      type: 'star-system',
      label: systemName,
      map: {
        objects: [
          {
            id: 'object-1',
            position: { x: 480, y: 280 },
            placement: { kind: 'system' },
            disclosure: 'known-type',
            family: 'CelestialBody',
            subtype: 'star',
            label: knownStarLabel,
          },
          {
            id: 'object-2',
            position: { x: 720, y: 400 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'CelestialBody',
            subtype: 'planet',
            label: revealedObjectName,
            playerText: publicPlayerText,
            fields: [],
          },
        ],
        orbits: [],
      },
    }],
    routes: [],
  }
}

async function openPlayerDocument(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/player')
  const fileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(fileInput).toBeEnabled()
  await fileInput.setInputFiles({
    name: 'starlight-reach.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializePlayerJson(createPlayerDocument()), 'utf8'),
  })
  const workspaceHeader = page.locator('header.workspace-header')
  await expect(workspaceHeader).toBeVisible()
  await expect(workspaceHeader.getByRole('heading', { name: playerTitle, exact: true })).toBeVisible()
}

async function openRevealedSystem(page: import('@playwright/test').Page) {
  const clusterOpener = page.getByRole('button', {
    name: `Open ${systemName} system preview`,
    exact: true,
  })
  await clusterOpener.click()
  const backButton = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  await expect(backButton).toBeVisible()
  await expect(backButton).toBeFocused()
  const systemMap = page.getByRole('region', { name: 'Player-visible system map', exact: true })
  const systemScene = systemMap.locator('svg.player-system-map-scene')
  await expect(systemScene).toBeVisible()
  return { clusterOpener, backButton, systemMap, systemScene }
}

async function expectSceneToFillViewport(
  page: import('@playwright/test').Page,
  scene: import('@playwright/test').Locator,
  testInfo: TestInfo,
): Promise<void> {
  const bounds = await scene.boundingBox()
  if (!bounds) throw new Error('The visible player map scene has no rendered bounds.')
  const headerBounds = await page.locator('header.workspace-header').boundingBox()
  if (!headerBounds) throw new Error('The public Workspace header has no rendered bounds.')
  const mapBoard = page.locator('[data-map-board]')
  const boardBounds = await mapBoard.boundingBox()
  if (!boardBounds) throw new Error('The public map board has no rendered bounds.')
  const boardClientWidth = await mapBoard.evaluate(element => element.clientWidth)
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  await testInfo.attach('player-map-scene-viewport-bounds', {
    body: Buffer.from(JSON.stringify({
      label: await scene.getAttribute('aria-label'),
      bounds,
      headerBounds,
      boardBounds,
      boardClientWidth,
      viewport,
    }, null, 2)),
    contentType: 'application/json',
  })
  expect(Math.abs(bounds.width - boardClientWidth)).toBeLessThanOrEqual(1)
  expect(bounds.height).toBeGreaterThanOrEqual(viewport.height * 0.65)
  expect(bounds.y).toBeGreaterThanOrEqual(headerBounds.y + headerBounds.height - 1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(boardBounds.width).toBeGreaterThanOrEqual(viewport.width - 20)
  expect(boardBounds.x).toBeLessThanOrEqual(10)
  expect(viewport.width - (boardBounds.x + boardBounds.width)).toBeLessThanOrEqual(10)
}

function readViewBox(value: string | null): { left: number; top: number; width: number; height: number } {
  if (!value) throw new Error('The player map scene has no viewBox.')
  const [left, top, width, height] = value.trim().split(/\s+/).map(Number)
  if ([left, top, width, height].some(number => !Number.isFinite(number))) {
    throw new Error('The player map scene has an invalid viewBox.')
  }
  return { left: left!, top: top!, width: width!, height: height! }
}

async function expectNoMutationControls(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByRole('button', { name: /\b(Add|Create|Edit|Delete|Remove|Save|Apply)\b/i }))
    .toHaveCount(0)
}

test('the standalone player workspace fills desktop view while preserving read-only map navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await openPlayerDocument(page)
  const desktopClusterScreenshot = testInfo.outputPath('player-workspace-desktop-cluster.png')
  await page.screenshot({ path: desktopClusterScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-desktop-cluster', {
    path: desktopClusterScreenshot,
    contentType: 'image/png',
  })
  await expectNoMutationControls(page)

  const playerNavigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  await expect(playerNavigation).toBeVisible()
  const clusterNavigation = page.getByRole('group', { name: 'Player cluster map navigation', exact: true })
  await expect(clusterNavigation.getByRole('button', { name: 'Pan left', exact: true })).toBeVisible()
  await expect(clusterNavigation.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
  await expect(clusterNavigation.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible()
  await expect(clusterNavigation.getByRole('button', { name: 'Fit player map', exact: true })).toBeVisible()

  const clusterScene = page.locator('svg.player-cluster-map-scene')
  await expect(clusterScene).toBeVisible()
  await expectSceneToFillViewport(page, clusterScene, testInfo)
  const clusterOpener = page.getByRole('button', {
    name: `Open ${systemName} system preview`,
    exact: true,
  })
  await clusterNavigation.getByRole('button', { name: 'Fit player map', exact: true }).click()
  const clusterMarkerBounds = await clusterOpener.locator('circle').boundingBox()
  if (!clusterMarkerBounds) throw new Error('The sparse player system marker has no rendered circle bounds.')
  expect(clusterMarkerBounds.width).toBeLessThanOrEqual(40)
  expect(clusterMarkerBounds.height).toBeLessThanOrEqual(40)

  const theme = page.getByRole('group', { name: 'Theme', exact: true })
  await expect(theme).toBeVisible()
  const clusterLight = await clusterScene.evaluate(element => getComputedStyle(element).backgroundColor)
  await theme.getByRole('button', { name: /switch to dark mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  const clusterDark = await clusterScene.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(clusterDark).not.toBe(clusterLight)
  const darkScreenshot = testInfo.outputPath('player-workspace-desktop-dark.png')
  await page.screenshot({ path: darkScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-desktop-dark', { path: darkScreenshot, contentType: 'image/png' })
  await theme.getByRole('button', { name: /switch to light mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  const { backButton, systemMap, systemScene } = await openRevealedSystem(page)
  const desktopSystemScreenshot = testInfo.outputPath('player-workspace-desktop-system.png')
  await page.screenshot({ path: desktopSystemScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-desktop-system', {
    path: desktopSystemScreenshot,
    contentType: 'image/png',
  })
  await expectSceneToFillViewport(page, systemScene, testInfo)
  await expectNoMutationControls(page)
  const systemNavigation = page.getByRole('group', { name: 'Player system map navigation', exact: true })

  const details = page.getByRole('region', { name: 'Player object details', exact: true })
  const inspectToggle = playerNavigation.getByRole('button', { name: 'Inspect', exact: true })
  await expect(inspectToggle).toBeVisible()
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const knownStar = systemScene.getByRole('button', { name: `Inspect ${knownStarLabel}`, exact: true })
  const starCircle = knownStar.locator('circle')
  await expect(knownStar).toBeVisible()
  await systemNavigation.getByRole('button', { name: 'Fit player map', exact: true }).click()
  const starBounds = await starCircle.boundingBox()
  if (!starBounds) throw new Error('The known-type Star marker has no rendered circle bounds.')
  expect(starBounds.width).toBeLessThanOrEqual(40)
  expect(starBounds.height).toBeLessThanOrEqual(40)

  await knownStar.click()
  await expect(knownStar).toHaveAttribute('aria-pressed', 'true')
  await expect(details).toBeVisible()
  await expect(details).toContainText(knownStarLabel)
  await expect(details).toContainText(/star/i)
  await expect(details).not.toContainText(publicPlayerText)

  const hierarchyToggle = playerNavigation.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchyToggle).toBeVisible()
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.getByRole('region', { name: 'Visible system hierarchy', exact: true })
  await expect(hierarchy).toBeVisible()
  await hierarchy.getByRole('treeitem', { name: new RegExp(revealedObjectName) }).click()
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  await expect(details).toBeVisible()
  await expect(details).toContainText(publicPlayerText)
  await expect(page.locator('body')).not.toContainText('GM ONLY')

  const systemLight = await systemScene.evaluate(element => getComputedStyle(element).backgroundColor)
  await theme.getByRole('button', { name: /switch to dark mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  const systemDark = await systemScene.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(systemDark).not.toBe(systemLight)
  await theme.getByRole('button', { name: /switch to light mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  const fitButton = systemNavigation.getByRole('button', { name: 'Fit player map', exact: true })
  await fitButton.click()
  const zoomIn = systemNavigation.getByRole('button', { name: 'Zoom in', exact: true })
  const viewBeforeZoom = readViewBox(await systemScene.getAttribute('viewBox'))
  await zoomIn.click()
  await expect.poll(async () => readViewBox(await systemScene.getAttribute('viewBox')).width)
    .toBeLessThan(viewBeforeZoom.width)

  const sceneBounds = await systemScene.boundingBox()
  if (!sceneBounds) throw new Error('The player system scene has no bounds for native pan input.')
  const dragStart = await systemScene.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const candidates = [0.35, 0.5, 0.65].flatMap(xFraction =>
      [0.25, 0.5, 0.75].map(yFraction => ({
        x: bounds.left + bounds.width * xFraction,
        y: bounds.top + bounds.height * yFraction,
      })),
    )
    const markers = Array.from(element.querySelectorAll('.player-system-object-marker'))
      .map(marker => marker.getBoundingClientRect())
    const point = candidates.find(candidate => {
      const target = document.elementFromPoint(candidate.x, candidate.y)
      return target !== null && element.contains(target)
        && !target.closest('.player-system-object-marker')
        && markers.every(marker => Math.hypot(
          candidate.x - (marker.left + marker.width / 2),
          candidate.y - (marker.top + marker.height / 2),
        ) > 48)
    })
    if (!point) throw new Error('Could not find an unobstructed empty point on the player map.')
    return point
  })
  const coordinates = await snapshotSvgCoordinates(systemScene)
  const viewBeforePan = readViewBox(await systemScene.getAttribute('viewBox'))
  const zoomedStarTransform = await knownStar.getAttribute('transform')
  if (zoomedStarTransform === null) throw new Error('The known-type Star marker lost its public position.')
  const delivery = await measureMouseDrag(page, dragStart, {
    x: dragStart.x + 24,
    y: dragStart.y + 18,
  }, { eventFamily: 'pointer' })
  const deliveredDelta = coordinates.fromClient(delivery.up)
  const startingDelta = coordinates.fromClient(delivery.down)
  const expectedLeft = viewBeforePan.left - (deliveredDelta.x - startingDelta.x)
  const expectedTop = viewBeforePan.top - (deliveredDelta.y - startingDelta.y)
  const viewAfterPan = readViewBox(await systemScene.getAttribute('viewBox'))
  expect(viewAfterPan.left).toBeCloseTo(expectedLeft, 1)
  expect(viewAfterPan.top).toBeCloseTo(expectedTop, 1)
  await expect(knownStar).toHaveAttribute('transform', zoomedStarTransform)
  const zoomOut = systemNavigation.getByRole('button', { name: 'Zoom out', exact: true })
  await zoomOut.click()
  await expect.poll(async () => readViewBox(await systemScene.getAttribute('viewBox')).width)
    .toBeGreaterThan(viewAfterPan.width)
  await fitButton.click()

  const screenshot = testInfo.outputPath('player-workspace-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('player-workspace-desktop', { path: screenshot, contentType: 'image/png' })

  await backButton.click()
  await expect(clusterOpener).toBeFocused()
  await expect(systemMap).toBeHidden()
})

test('compact player panels switch exclusively, preserve map focus, and scroll long public prose without overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 650 })
  await openPlayerDocument(page)
  const compactClusterScreenshot = testInfo.outputPath('player-workspace-compact-cluster.png')
  await page.screenshot({ path: compactClusterScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-compact-cluster', {
    path: compactClusterScreenshot,
    contentType: 'image/png',
  })

  const clusterScene = page.locator('svg.player-cluster-map-scene')
  await expect(clusterScene).toBeVisible()
  await expectSceneToFillViewport(page, clusterScene, testInfo)

  const navigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  const hierarchyToggle = navigation.getByRole('button', { name: 'Hierarchy', exact: true })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  const clusterHierarchyPanel = page.getByRole('dialog', { name: 'Player hierarchy', exact: true })
  await expect(clusterHierarchyPanel).toBeVisible()
  await expect(clusterHierarchyPanel.getByRole('button', { name: 'Hierarchy', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await clusterHierarchyPanel.getByRole('button', {
    name: `${systemName} Open shared system map`,
    exact: true,
  }).click()
  const compactHierarchySystemScreenshot = testInfo.outputPath('player-workspace-compact-hierarchy-system.png')
  await page.screenshot({ path: compactHierarchySystemScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-compact-hierarchy-system', {
    path: compactHierarchySystemScreenshot,
    contentType: 'image/png',
  })

  const backButton = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  await expect(clusterHierarchyPanel).toBeHidden()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(backButton).toBeFocused()
  await backButton.click()
  const clusterOpener = page.getByRole('button', {
    name: `Open ${systemName} system preview`,
    exact: true,
  })
  await expect(clusterOpener).toBeFocused()

  const reopenedSystem = await openRevealedSystem(page)
  const systemScene = reopenedSystem.systemScene
  const compactSystemScreenshot = testInfo.outputPath('player-workspace-compact-system.png')
  await page.screenshot({ path: compactSystemScreenshot, fullPage: true })
  await testInfo.attach('player-workspace-compact-system', {
    path: compactSystemScreenshot,
    contentType: 'image/png',
  })
  await expectSceneToFillViewport(page, systemScene, testInfo)

  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')

  await hierarchyToggle.click()
  const hierarchyPanel = page.getByRole('dialog', { name: 'Player hierarchy', exact: true })
  const detailsPanel = page.getByRole('dialog', { name: 'Player details', exact: true })
  await expect(hierarchyPanel).toBeVisible()
  await expect(hierarchyPanel.getByRole('button', { name: 'Hierarchy', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(detailsPanel).toBeHidden()
  const hierarchy = hierarchyPanel.getByRole('region', { name: 'Visible system hierarchy', exact: true })
  await expect(hierarchy).toBeVisible()
  const revealedObjectRow = hierarchy.getByRole('treeitem', { name: new RegExp(revealedObjectName) })
  await revealedObjectRow.click()
  await expect(hierarchyPanel).toBeHidden()
  await expect(detailsPanel).toBeVisible()
  await expect(detailsPanel.getByRole('button', { name: 'Hierarchy', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(detailsPanel.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'true')
  const details = detailsPanel.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toContainText(publicPlayerText)
  await page.getByText(publicTextTail, { exact: false }).scrollIntoViewIfNeeded()

  const panelScrollState = await detailsPanel.evaluate((panel) => {
    const candidates = [panel, ...Array.from(panel.querySelectorAll<HTMLElement>('*'))]
    return candidates
      .filter(element => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
      .map(element => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
  })
  expect(panelScrollState.some(state => state.scrollHeight > state.clientHeight && state.scrollTop > 0)).toBe(true)
  const compactWidth = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(compactWidth.document).toBeLessThanOrEqual(compactWidth.viewport)

  const screenshot = testInfo.outputPath('player-workspace-compact-390x650.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('player-workspace-compact-390x650', { path: screenshot, contentType: 'image/png' })

  await expectNoMutationControls(page)
  const returnToMap = detailsPanel.getByRole('button', { name: 'Return to map', exact: true })
  await returnToMap.click()
  await expect(hierarchyToggle).toBeFocused()
  await expect(detailsPanel).toBeHidden()
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inspectToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(backButton).toBeVisible()
  const compactAfterClose = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(compactAfterClose.document).toBeLessThanOrEqual(compactAfterClose.viewport)

  await backButton.click()
  await expect(clusterOpener).toBeFocused()
})
