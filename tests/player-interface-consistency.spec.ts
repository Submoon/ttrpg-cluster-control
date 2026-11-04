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
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'false')
  await hiddenHost.press('ArrowRight')
  await expect(hiddenHost).toHaveAttribute('aria-expanded', 'true')

  const hostOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around Unknown presence', exact: true })
  await expect(hostOrbit).toHaveAttribute('aria-level', '2')
  await expect(hostOrbit).toHaveAttribute('aria-expanded', 'false')
  await hostOrbit.press('ArrowRight')
  await expect(hostOrbit).toHaveAttribute('aria-expanded', 'true')

  const harborWorld = hierarchy.getByRole('treeitem', { name: /^Harbor World,/ })
  await expect(harborWorld).toHaveAttribute('aria-level', '3')
  await expect(harborWorld).toHaveAttribute('aria-expanded', 'false')
  await harborWorld.press('ArrowRight')
  await expect(harborWorld).toHaveAttribute('aria-expanded', 'true')

  const harborOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around Harbor World', exact: true })
  await expect(harborOrbit).toHaveAttribute('aria-level', '4')
  await expect(harborOrbit).toHaveAttribute('aria-expanded', 'false')
  await harborOrbit.press('ArrowRight')
  await expect(harborOrbit).toHaveAttribute('aria-expanded', 'true')

  const moon = hierarchy.getByRole('treeitem', { name: /^Quiet Moon,/ })
  await expect(moon).toHaveAttribute('aria-level', '5')

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
  const sceneBounds = await systemMap.locator('svg.player-system-map-scene').boundingBox()
  const markerBounds = await harborMarker.locator('circle').boundingBox()
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

  const unoccupiedOrbit = hierarchy.getByRole('treeitem', { name: 'Orbit around unoccupied center', exact: true })
  await unoccupiedOrbit.press('ArrowRight')
  await expect(unoccupiedOrbit).toHaveAttribute('aria-expanded', 'true')
  const knownBase = hierarchy.getByRole('treeitem', { name: /^Base,/ })
  await knownBase.click()
  await expect(details).toContainText('No additional text or Fields were shared.')
  await expect(details).not.toContainText('PRIVATE_SOURCE_OUTPOST_NAME')

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
