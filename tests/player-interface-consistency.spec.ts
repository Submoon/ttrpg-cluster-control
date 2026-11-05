import { expect, test } from './fixtures'
import { createPlayerInterfaceFixture } from './fixtures/player-interface-fixture'
import { createPlayerShareUrl } from '../utils/player-share-link'

async function openRevealedSystem(page: import('@playwright/test').Page) {
  const systemOpener = page.getByRole('button', { name: 'Open Public System system preview', exact: true })
  await systemOpener.click()
  const backButton = page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  await expect(backButton).toBeVisible()
  return { systemOpener, backButton }
}

async function openHierarchy(page: import('@playwright/test').Page) {
  const playerNavigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  const hierarchyToggle = playerNavigation.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()

  const hierarchy = page.getByRole('tree', { name: 'Player object and Orbit hierarchy', exact: true })
  await expect(hierarchy).toBeVisible()
  return hierarchy
}

test('standalone player Hierarchy opens useful inspection and returns to the cluster', async ({ page }, testInfo) => {
  const { json } = createPlayerInterfaceFixture()
  expect(json).not.toContain('PRIVATE_SOURCE_')
  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled()
  await playerFileInput.setInputFiles({
    name: 'interface-reach.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf8'),
  })
  await expect(page.getByRole('heading', { name: 'Interface Reach', exact: true })).toBeVisible()

  const { systemOpener, backButton } = await openRevealedSystem(page)
  const hierarchy = await openHierarchy(page)
  const hiddenHost = hierarchy.getByRole('treeitem', { name: 'Unknown presence', exact: true })
  await expect(hiddenHost).toHaveAttribute('aria-level', '1')
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'true')

  const hostOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around Unknown presence', exact: true })
  await expect(hostOrbit).toHaveAttribute('aria-level', '2')
  await expect(hostOrbit).toHaveAttribute('aria-expanded', 'true')

  const harborWorld = hierarchy.getByRole('treeitem', { name: /^Harbor World,/ })
  await expect(harborWorld).toHaveAttribute('aria-level', '3')
  await expect(harborWorld).toHaveAttribute('aria-expanded', 'true')

  const harborOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around Harbor World', exact: true })
  await expect(harborOrbit).toHaveAttribute('aria-level', '4')
  await expect(harborOrbit).toHaveAttribute('aria-expanded', 'true')

  const moon = hierarchy.getByRole('treeitem', { name: /^Quiet Moon,/ })
  await expect(moon).toHaveAttribute('aria-level', '5')
  await expect(moon).toBeVisible()

  await hierarchy.getByRole('button', { name: 'Collapse Unknown presence', exact: true }).click()
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'false')
  await expect(hostOrbit).toBeHidden()
  await hierarchy.getByRole('button', { name: 'Expand Unknown presence', exact: true }).click()
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'true')
  await expect(hostOrbit).toBeVisible()

  const playerNavigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  await expect(backButton).toBeVisible()
  const backPrecedesSystemTitle = await playerNavigation.evaluate((toolbar) => {
    const back = toolbar.querySelector('[data-player-back-to-cluster]')
    const title = toolbar.querySelector('.player-workspace-map-caption h2')
    return back !== null && title !== null
      && (back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  })
  expect(backPrecedesSystemTitle).toBe(true)

  await harborWorld.click()
  await expect(harborWorld).toHaveAttribute('aria-expanded', 'true')
  await expect(hierarchy.getByRole('treeitem', { name: /^Quiet Moon,/ })).toBeVisible()
  const details = page.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toBeVisible()
  await expect(details.locator('dt').getByText('Name', { exact: true })).toBeVisible()
  await expect(details.locator('dd').getByText('Harbor World', { exact: true })).toBeVisible()
  await expect(details.locator('dt').getByText('Type', { exact: true })).toBeVisible()
  await expect(details.locator('dd').filter({ hasText: 'Planet' })).toBeVisible()
  const playerText = details.getByRole('region', { name: 'Player text', exact: true })
  await expect(playerText).toContainText('A calm world with a sheltered landing basin.')
  const publishedFields = details.getByRole('region', { name: 'Published Fields', exact: true })
  await expect(publishedFields.getByRole('heading', { name: 'Fields', exact: true })).toBeVisible()
  await expect(publishedFields.locator('dt')).toHaveText(['Atmosphere', 'Survey index', 'Safe route'])
  await expect(publishedFields.locator('dd')).toHaveText(['Breathable', '0', 'false'])
  await expect(details).toContainText('A calm world with a sheltered landing basin.')
  await expect(details).toContainText('Survey index')
  await expect(details).toContainText('0')
  await expect(details).toContainText('Safe route')
  await expect(details).toContainText('false')
  await expect(details).not.toContainText('number:')
  await expect(details).not.toContainText('boolean:')
  await expect(details).not.toContainText('single-select:')
  await expect(details).toContainText('Orbit around Unknown presence')
  const harborMarker = page.getByRole('region', { name: 'Player-visible system map', exact: true })
    .getByRole('button', { name: /Inspect Harbor World/ })
  await expect(harborMarker).toHaveAttribute('aria-pressed', 'true')
  const toolbarBounds = await playerNavigation.boundingBox()
  const systemMap = page.getByRole('region', { name: 'Player-visible system map', exact: true })
  const mapPalette = await page.evaluate(() => {
    const resolve = (token: string) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${token})`
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }
    return { accent: resolve('--accent'), neutral: resolve('--text-secondary'), background: resolve('--map-bg') }
  })
  const publicStarMarker = systemMap.getByRole('button', { name: 'Inspect Public Star', exact: true })
  await expect(publicStarMarker.locator('.player-system-object-marker-art')).toHaveCount(0)
  await expect(publicStarMarker.locator('.player-system-object-glyph')).toBeVisible()
  const publicStarGlyph = publicStarMarker.locator('.player-system-object-glyph')
  expect(await publicStarGlyph.evaluate(glyph => getComputedStyle(glyph).fill)).toBe(mapPalette.accent)
  await expect(publicStarGlyph).toHaveCSS('pointer-events', 'visiblepainted')
  const liveGlyphTypography = await publicStarGlyph.evaluate((glyph) => {
    const style = getComputedStyle(glyph)
    return { fontFamily: style.fontFamily, fontSize: style.fontSize }
  })
  expect(liveGlyphTypography.fontFamily).toContain('Consolas')
  expect(liveGlyphTypography.fontSize).toBe('20px')
  const unknownMarker = systemMap.getByRole('button', { name: 'Inspect Unknown presence', exact: true }).first()
  await expect(unknownMarker.locator('.player-system-object-marker-art')).toHaveCount(1)
  await expect(unknownMarker.locator('.player-system-object-glyph')).toHaveCount(0)
  expect(await unknownMarker.locator('.player-system-object-marker-art').evaluate(mark => getComputedStyle(mark).fill))
    .toBe(mapPalette.background)
  const sceneBounds = await systemMap.locator('svg.player-system-map-scene').boundingBox()
  const markerBounds = await harborMarker.locator('.player-system-object-glyph').boundingBox()
  await expect(harborMarker.locator('.player-system-object-hit-target')).toHaveAttribute('r', '10')
  await expect(harborMarker.locator('.player-system-object-marker-art')).toHaveCount(0)
  await expect(harborMarker.locator('.player-system-object-selection-outline')).toHaveCSS('opacity', '1')
  await expect(playerNavigation).toHaveAttribute('data-player-map-obstruction', '')
  if (!toolbarBounds || !sceneBounds || !markerBounds) {
    throw new Error('The selected public marker, player toolbar, or system map has no rendered bounds.')
  }
  const toolbarOverlapsScene = toolbarBounds.x < sceneBounds.x + sceneBounds.width
    && toolbarBounds.x + toolbarBounds.width > sceneBounds.x
    && toolbarBounds.y < sceneBounds.y + sceneBounds.height
    && toolbarBounds.y + toolbarBounds.height > sceneBounds.y
  expect(toolbarOverlapsScene).toBe(true)
  const markerAvoidsToolbar = markerBounds.x + markerBounds.width <= toolbarBounds.x
    || markerBounds.x >= toolbarBounds.x + toolbarBounds.width
    || markerBounds.y + markerBounds.height <= toolbarBounds.y
    || markerBounds.y >= toolbarBounds.y + toolbarBounds.height
  expect(markerAvoidsToolbar).toBe(true)
  const desktopScreenshot = testInfo.outputPath('player-interface-inspect-desktop.png')
  await page.screenshot({ path: desktopScreenshot, fullPage: true })
  await testInfo.attach('player-interface-inspect-desktop', {
    path: desktopScreenshot,
    contentType: 'image/png',
  })

  await details.getByRole('button', { name: 'Inspect Orbit around Unknown presence', exact: true }).click()
  const orbitDetails = page.getByRole('region', { name: 'Player Orbit details', exact: true })
  await expect(orbitDetails).toContainText('Unknown presence')
  await expect(orbitDetails.getByRole('region', { name: 'Public objects in this Orbit', exact: true }))
    .toContainText('Harbor World')
  await orbitDetails.getByRole('button', { name: 'Inspect Harbor World', exact: true }).click()
  await expect(details).toBeVisible()

  const gatePoint = hierarchy.getByRole('treeitem', { name: /^Gate Point,/ })
  await gatePoint.click()
  await expect(details.getByRole('region', { name: 'Physical Station association', exact: true }))
    .toContainText('Public Station')
  await details.getByRole('button', { name: 'Inspect Public Station', exact: true }).click()
  await expect(details).toContainText('A quiet exchange station.')

  await hiddenHost.click()
  await expect(details).toContainText('No further details are shared.')
  await expect(details).not.toContainText('PRIVATE_SOURCE_HOST_NAME')
  await expect(details.locator('dt').getByText('Name', { exact: true })).toHaveCount(0)
  await expect(details.locator('dt').getByText('Type', { exact: true })).toHaveCount(0)

  const unoccupiedOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around unoccupied center', exact: true })
  await unoccupiedOrbit.press('ArrowRight')
  await expect(unoccupiedOrbit).toHaveAttribute('aria-expanded', 'true')
  const knownBase = hierarchy.getByRole('treeitem', { name: /^Base,/ })
  await knownBase.click()
  await expect(details).toContainText('No additional text or Fields were shared.')
  await expect(details.locator('dt').getByText('Name', { exact: true })).toHaveCount(0)
  await expect(details.locator('dt').getByText('Type', { exact: true })).toBeVisible()
  await expect(details).not.toContainText('PRIVATE_SOURCE_OUTPOST_NAME')
  const knownBaseMarker = systemMap.getByRole('button', { name: 'Inspect Base', exact: true })
  await expect(knownBaseMarker.locator('.player-system-object-marker-art')).toHaveCount(0)
  await expect(knownBaseMarker.locator('.player-system-object-glyph')).toBeVisible()
  expect(await knownBaseMarker.locator('.player-system-object-glyph').evaluate(glyph => getComputedStyle(glyph).fill))
    .toBe(mapPalette.neutral)

  await hierarchy.getByRole('button', { name: 'Collapse Unknown presence', exact: true }).click()
  await expect(moon).toBeHidden()
  await systemMap.getByRole('button', { name: 'Inspect Quiet Moon', exact: true }).click()
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'true')
  await expect(moon).toBeVisible()
  await expect(details).toContainText('Its horizon glows softly at night.')

  await page.setViewportSize({ width: 390, height: 844 })
  const hierarchyToggle = playerNavigation.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchyToggle).toHaveAttribute('aria-expanded', 'false')
  await hierarchyToggle.click()
  const compactHierarchy = page.getByRole('tree', { name: 'Player object and Orbit hierarchy', exact: true })
  const compactHarborWorld = compactHierarchy.getByRole('treeitem', { name: /^Harbor World,/ })
  await compactHarborWorld.click()
  const compactInspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await expect(compactInspector).toBeVisible()
  await expect(compactInspector.getByRole('region', { name: 'Player object details', exact: true }))
    .toContainText('A calm world with a sheltered landing basin.')
  await expect(compactInspector.getByRole('button', { name: 'Hierarchy', exact: true }))
    .toHaveAttribute('aria-expanded', 'false')
  await expect(compactInspector.getByRole('button', { name: 'Inspect', exact: true }))
    .toHaveAttribute('aria-expanded', 'true')
  const compactScreenshot = testInfo.outputPath('player-interface-inspect-compact.png')
  await page.screenshot({ path: compactScreenshot, fullPage: true })
  await testInfo.attach('player-interface-inspect-compact', {
    path: compactScreenshot,
    contentType: 'image/png',
  })
  await compactInspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(compactInspector).toBeHidden()
  await backButton.click()
  await expect(systemOpener).toBeFocused()

  await expect(page.locator('body')).not.toContainText(/PRIVATE_SOURCE_/)
  const publicDom = await page.locator('body').evaluate(body => body.innerHTML)
  expect(publicDom).not.toContain('PRIVATE_SOURCE_')
})

test('player map native left and right drags pan marks and Orbits without activating them', async ({ page }) => {
  // Keep this decorative center away from labels that Chromium can favor for touch hit adjustment.
  const { json } = createPlayerInterfaceFixture({ x: 0.78, y: 0.2 })
  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled()
  await playerFileInput.setInputFiles({
    name: 'mouse-map-input.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf8'),
  })

  const clusterMap = page.getByRole('region', { name: 'Player-visible Jump Cluster map', exact: true })
  const clusterScene = clusterMap.locator('svg.player-cluster-map-scene')
  const clusterNavigation = clusterMap.getByRole('group', { name: 'Player cluster map navigation', exact: true })
  const clusterFit = clusterNavigation.getByRole('button', { name: 'Fit player map', exact: true })
  const clusterZoomIn = clusterNavigation.getByRole('button', { name: 'Zoom in', exact: true })
  const systemOpener = clusterMap.getByRole('button', { name: 'Open Public System system preview', exact: true })
  const systemMarker = systemOpener.locator('.player-cluster-map-marker-geometry circle')

  async function dragAndCheckPan(
    scene: import('@playwright/test').Locator,
    fit: import('@playwright/test').Locator,
    zoom: import('@playwright/test').Locator,
    point: () => Promise<{ x: number; y: number }>,
    button: 'left' | 'right',
    systemIsOpen = false,
  ) {
    await fit.click()
    await zoom.click()
    const before = await scene.getAttribute('viewBox')
    const start = await point()
    await page.mouse.move(start.x, start.y)
    await page.mouse.down({ button })
    await page.mouse.move(start.x + 32, start.y + 18, { steps: 3 })
    await page.mouse.up({ button })
    await expect.poll(() => scene.getAttribute('viewBox')).not.toBe(before)
    if (systemIsOpen) {
      await expect(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('region', { name: 'Player object details', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Player Orbit details', exact: true })).toHaveCount(0)
  }

  const clusterMarkerPoint = async () => {
    const bounds = await systemMarker.boundingBox()
    if (!bounds) throw new Error('The Revealed Cluster marker must have a native hit location.')
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }
  await dragAndCheckPan(clusterScene, clusterFit, clusterZoomIn, clusterMarkerPoint, 'left')
  await dragAndCheckPan(clusterScene, clusterFit, clusterZoomIn, clusterMarkerPoint, 'right')

  await clusterFit.click()
  const markerBounds = await systemMarker.boundingBox()
  if (!markerBounds) throw new Error('The Revealed Cluster marker must have a click location.')
  await page.mouse.click(markerBounds.x + markerBounds.width / 2, markerBounds.y + markerBounds.height / 2)
  await expect(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })).toBeVisible()

  const systemMap = page.getByRole('region', { name: 'Player-visible system map', exact: true })
  const systemScene = systemMap.locator('svg.player-system-map-scene')
  const systemNavigation = systemMap.getByRole('group', { name: 'Player system map navigation', exact: true })
  const systemFit = systemNavigation.getByRole('button', { name: 'Fit player map', exact: true })
  const systemZoomIn = systemNavigation.getByRole('button', { name: 'Zoom in', exact: true })
  const starMarker = systemMap.getByRole('button', { name: 'Inspect Public Star', exact: true })
  const starHitTarget = starMarker.locator('.player-system-object-hit-target')
  await expect(starHitTarget).toHaveAttribute('r', '10')
  await expect(starMarker.locator('.player-system-object-glyph')).toHaveCSS('pointer-events', 'visiblepainted')
  const starPoint = async () => {
    const bounds = await starHitTarget.boundingBox()
    if (!bounds) throw new Error('The Revealed object must retain an invisible live hit envelope.')
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }

  await dragAndCheckPan(systemScene, systemFit, systemZoomIn, starPoint, 'left', true)
  await dragAndCheckPan(systemScene, systemFit, systemZoomIn, starPoint, 'right', true)

  const orbitHitTarget = systemMap.getByRole('button', {
    name: 'Inspect Orbit around Unknown presence',
    exact: true,
  })
  const orbitStrokePoint = async () => orbitHitTarget.evaluate((element) => {
    const orbit = element as SVGEllipseElement
    const matrix = orbit.getScreenCTM()
    if (!matrix) throw new Error('The public Orbit must have a screen transform.')
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI / 8
      const point = new DOMPoint(
        orbit.cx.baseVal.value + orbit.rx.baseVal.value * Math.cos(angle),
        orbit.cy.baseVal.value + orbit.ry.baseVal.value * Math.sin(angle),
      ).matrixTransform(matrix)
      if (orbit.ownerDocument.elementFromPoint(point.x, point.y) === orbit) {
        return { x: point.x, y: point.y }
      }
    }
    throw new Error('The public Orbit has no unobstructed native hit point.')
  })
  await dragAndCheckPan(systemScene, systemFit, systemZoomIn, orbitStrokePoint, 'left', true)
  await dragAndCheckPan(systemScene, systemFit, systemZoomIn, orbitStrokePoint, 'right', true)

  await systemFit.click()
  const leftOrbitPoint = await orbitStrokePoint()
  await page.mouse.click(leftOrbitPoint.x, leftOrbitPoint.y)
  await expect(page.getByRole('region', { name: 'Player Orbit details', exact: true })).toBeVisible()

  await systemFit.click()
  const starGlyphBounds = await starMarker.locator('.player-system-object-glyph').boundingBox()
  if (!starGlyphBounds) throw new Error('The public typed glyph must remain a visible activation target.')
  await page.mouse.click(starGlyphBounds.x + starGlyphBounds.width / 2, starGlyphBounds.y + starGlyphBounds.height / 2)
  await expect(page.getByRole('region', { name: 'Player object details', exact: true })).toBeVisible()
  await starMarker.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Player object details', exact: true })).toBeVisible()

  const inspectorToggle = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
    .getByRole('button', { name: 'Inspect', exact: true })
  await inspectorToggle.click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await systemFit.click()
  await systemZoomIn.click()
  const directManipulationTarget = systemMap.locator('.player-system-unoccupied-center').first()
  const touchTarget = await directManipulationTarget.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    const point = { x: x + width / 2, y: y + height / 2 }
    if (element.ownerDocument.elementFromPoint(point.x, point.y) !== element) {
      throw new Error('The unoccupied center must receive the native touch.')
    }
    return point
  })
  const touchStart = {
    id: 1,
    ...touchTarget,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  }
  const touchMoved = (offset: number) => ({ ...touchStart, x: touchStart.x + offset, y: touchStart.y + offset / 2 })
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    const beforeTouch = await systemScene.getAttribute('viewBox')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchStart] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchMoved(20)] })
    await expect.poll(() => systemScene.getAttribute('viewBox')).not.toBe(beforeTouch)
    const afterCaptureTransfer = await systemScene.getAttribute('viewBox')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchMoved(38)] })
    await expect.poll(() => systemScene.getAttribute('viewBox')).not.toBe(afterCaptureTransfer)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(starMarker).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})
    await cdp.detach()
  }
})

test('replacing a player link clears a covered selection even when public IDs are reused', async ({ page }) => {
  const { document: first } = createPlayerInterfaceFixture()
  const replacement = {
    ...first,
    title: 'Replacement Reach',
    systems: first.systems.map(system => system.disclosure === 'revealed' ? {
      ...system,
      label: 'Replacement System',
      map: {
        ...system.map,
        objects: system.map.objects.map(object => object.disclosure === 'revealed' && object.label === 'Public Star'
          ? { ...object, label: 'Replacement Star', playerText: 'The new snapshot has different published details.' }
          : object),
      },
    } : system),
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/player')
  await expect(page.getByLabel('Open player JSON', { exact: true })).toBeEnabled()
  const readerUrl = new URL('/player', page.url()).href
  const [firstUrl, replacementUrl] = await Promise.all([
    createPlayerShareUrl(first, readerUrl),
    createPlayerShareUrl(replacement, readerUrl),
  ])
  await page.goto(firstUrl)
  await expect(page.getByRole('heading', { name: 'Interface Reach', exact: true })).toBeVisible()
  await openRevealedSystem(page)
  await page.getByRole('region', { name: 'Player-visible system map', exact: true })
    .getByRole('button', { name: 'Inspect Public Star', exact: true }).click()
  const inspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await expect(inspector.getByRole('heading', { name: 'Public Star', exact: true })).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Player map navigation', exact: true })).toBeHidden()

  // Public hash navigation replaces the document while compact coverage defers reveal.
  await page.evaluate(hash => { window.location.hash = hash }, new URL(replacementUrl).hash)
  await expect(page.getByRole('heading', { name: 'Replacement Reach', exact: true })).toBeVisible()
  await expect(inspector).toBeHidden()
  await page.getByRole('button', { name: 'Open Replacement System system preview', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })).toBeFocused()
  await expect(page.locator('.player-system-object-marker[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Inspect Replacement Star', exact: true }))
    .toHaveAttribute('aria-pressed', 'false')
  const navigation = page.getByRole('toolbar', { name: 'Player map navigation', exact: true })
  await navigation.getByRole('button', { name: 'Inspect', exact: true }).click()
  await expect(inspector).toContainText('Select a visible object to inspect its shared details.')
  await expect(inspector.getByRole('region', { name: 'Player object details', exact: true })).toHaveCount(0)
  expect(await page.locator('body').evaluate(body => body.innerHTML)).not.toContain('PRIVATE_SOURCE_')
})
