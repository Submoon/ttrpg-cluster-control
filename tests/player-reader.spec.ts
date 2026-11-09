import { readFile } from 'node:fs/promises'
import { serializePlayerJson } from '../domain/workspace'
import { createPlayerShareUrl } from '../utils/player-share-link'
import { expect, test, type Locator } from './fixtures'
import { createPlayerInterfaceFixture } from './fixtures/player-interface-fixture'

type PlayerReadProbe = Window & {
  releaseOlderPlayerRead?: () => void
  restorePlayerRead?: () => void
}

function uploadPlayerJson(input: Locator, name: string, text: string): Promise<void> {
  return input.setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })
}

interface PlayerMarkerAnchorBounds {
  x: number
  y: number
  left: number
  top: number
  right: number
  bottom: number
}

function isPlayerAnchorInsideMap(bounds: PlayerMarkerAnchorBounds): boolean {
  return bounds.x >= bounds.left && bounds.x <= bounds.right
    && bounds.y >= bounds.top && bounds.y <= bounds.bottom
}

function readPlayerMarkerAnchor(marker: Locator): Promise<PlayerMarkerAnchorBounds> {
  return marker.evaluate((element) => {
    const graphic = element as SVGGraphicsElement
    const scene = graphic.ownerSVGElement
    const transform = graphic.getScreenCTM()
    if (!scene || !transform) throw new Error('The player object has no screen transform.')
    const anchor = new DOMPoint(0, 0).matrixTransform(transform)
    const bounds = scene.getBoundingClientRect()
    return {
      x: anchor.x,
      y: anchor.y,
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
    }
  })
}

test('the standalone player reader opens a shared snapshot and keeps the latest file selection', async ({ page, baseURL }) => {
  test.setTimeout(60_000)
  if (!baseURL) throw new Error('The player reader requires a configured base URL.')
  const { document } = createPlayerInterfaceFixture()
  document.systems.push({
    id: 'system-2',
    position: { x: 620, y: 360 },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Star system',
  })
  const publicSystem = document.systems.find(system => system.disclosure === 'revealed')
  const publicStation = publicSystem?.disclosure === 'revealed'
    ? publicSystem.map.objects.find(object => object.label === 'Public Station')
    : undefined
  if (!publicStation || publicStation.disclosure !== 'revealed') {
    throw new Error('The player fixture has no revealed station for cross-system navigation.')
  }
  document.systems.push({
    id: 'system-3',
    position: { x: 780, y: 470 },
    disclosure: 'revealed',
    type: 'star-system',
    label: 'Remote System',
    map: {
      objects: [{ ...publicStation, id: 'object-1', label: 'Remote Echo', position: { x: 250, y: 250 }, placement: { kind: 'system' } }],
      orbits: [],
    },
  })
  const readerUrl = new URL('player', `${baseURL.replace(/\/$/, '')}/`).href
  const shareUrl = await createPlayerShareUrl(document, readerUrl)
  const fragment = new URL(shareUrl).hash
  const compressed = fragment.split('.').at(-1)
  if (!compressed) throw new Error('The prepared link has no compressed payload.')

  await page.setViewportSize({ width: 390, height: 844 })
  const response = await page.goto(shareUrl)
  if (!response) throw new Error('The player page has no document response.')
  const html = await response.text()
  expect(response.request().url()).toBe(readerUrl)
  expect(html).not.toContain(compressed)
  expect(html).not.toContain(document.title)
  const title = page.getByRole('heading', { name: document.title, exact: true })
  await expect(title).toBeVisible()
  await page.getByRole('link', { name: 'Open player JSON instead', exact: true }).click()

  const input = page.getByLabel('Open player JSON', { exact: true })
  await expect(input).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Open a player map', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const probe = window as PlayerReadProbe
    const nativeText = File.prototype.text
    File.prototype.text = async function () {
      const text = await nativeText.call(this)
      if (this.name !== 'older-player.json') return text
      return new Promise<string>((resolve) => {
        probe.releaseOlderPlayerRead = () => resolve(text)
      })
    }
    probe.restorePlayerRead = () => {
      File.prototype.text = nativeText
      probe.releaseOlderPlayerRead?.()
      delete probe.releaseOlderPlayerRead
      delete probe.restorePlayerRead
    }
  })

  const olderTitle = 'Older File Reach'
  try {
    await uploadPlayerJson(input, 'older-player.json', serializePlayerJson({ ...document, title: olderTitle }))
    await expect.poll(() => page.evaluate(() =>
      typeof (window as PlayerReadProbe).releaseOlderPlayerRead,
    )).toBe('function')
    await uploadPlayerJson(input, 'player-interface.json', serializePlayerJson(document))
    await expect(title).toBeVisible()
    await page.evaluate(async () => {
      const release = (window as PlayerReadProbe).releaseOlderPlayerRead
      if (!release) throw new Error('The older file read was not pending.')
      release()
      // Let the completed read and any resulting UI update settle before checking the current document.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    })
    await expect(title).toBeVisible()
    await expect(page.getByRole('heading', { name: olderTitle, exact: true })).toHaveCount(0)
  } finally {
    await page.evaluate(() => (window as PlayerReadProbe).restorePlayerRead?.())
  }

  const cluster = page.getByRole('region', { name: 'Player-visible Jump Cluster map', exact: true })
  const system = page.getByRole('region', { name: 'Player-visible system map', exact: true })
  const opener = cluster.getByRole('button', { name: 'Open Public System system preview', exact: true })
  await cluster.getByRole('group', { name: 'Star system', exact: true }).click()
  await expect(system).toHaveCount(0)
  await cluster.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const scene = cluster.getByRole('group', { name: `${document.title} player map`, exact: true })
  const cameraBeforePan = await scene.getAttribute('viewBox')
  const bounds = await opener.boundingBox()
  if (!bounds || !cameraBeforePan) throw new Error('The player cluster map is not ready for panning.')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y + 15, { steps: 4 })
  await page.mouse.up()
  await expect(scene).not.toHaveAttribute('viewBox', cameraBeforePan)
  await expect(system).toHaveCount(0)
  await opener.click()
  await expect(system).toBeVisible()

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await filters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const harborMarker = system.getByRole('button', { name: 'Inspect Harbor World', exact: true })
  const moonMarker = system.getByRole('button', { name: 'Inspect Quiet Moon', exact: true })
  const unknownMarker = system.getByRole('button', { name: 'Inspect Unknown presence', exact: true })
  await expect(harborMarker).toHaveClass(/player-system-object-marker--dimmed/)
  await expect(moonMarker).not.toHaveClass(/player-system-object-marker--dimmed/)
  await expect(unknownMarker).toHaveClass(/player-system-object-marker--dimmed/)
  await expect(page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })).toBeVisible()
  await expect(system.locator('.player-system-orbits ellipse').first()).toHaveCSS('opacity', '1')

  const systemZoom = system.getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 8; step += 1) {
    if (await systemZoom.isDisabled()) break
    await systemZoom.click()
  }
  let harborAnchor = await readPlayerMarkerAnchor(harborMarker)
  for (let step = 0; step < 12 && isPlayerAnchorInsideMap(harborAnchor); step += 1) {
    const horizontalOffset = harborAnchor.x - (harborAnchor.left + harborAnchor.right) / 2
    const verticalOffset = harborAnchor.y - (harborAnchor.top + harborAnchor.bottom) / 2
    const horizontalControl = horizontalOffset >= 0 ? 'Pan left' : 'Pan right'
    const verticalControl = verticalOffset >= 0 ? 'Pan up' : 'Pan down'
    const controls = Math.abs(horizontalOffset) >= Math.abs(verticalOffset)
      ? [horizontalControl, verticalControl]
      : [verticalControl, horizontalControl]
    let moved = false
    for (const control of controls) {
      const button = system.getByRole('button', { name: control, exact: true })
      if (await button.isDisabled()) continue
      await button.click()
      const nextAnchor = await readPlayerMarkerAnchor(harborMarker)
      if (Math.hypot(nextAnchor.x - harborAnchor.x, nextAnchor.y - harborAnchor.y) > 1) {
        harborAnchor = nextAnchor
        moved = true
        break
      }
    }
    if (!moved) break
  }
  expect(isPlayerAnchorInsideMap(harborAnchor)).toBe(false)
  const viewBoxBeforeSearch = await system.locator('svg.player-system-map-scene').getAttribute('viewBox')
  if (!viewBoxBeforeSearch) throw new Error('The player system map has no camera viewBox.')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const search = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await search.getByRole('combobox').fill('Harbor World')
  await search.getByRole('option', { name: /Harbor World/ }).click()
  const inspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  const details = inspector.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toContainText('A calm world with a sheltered landing basin.')
  await expect(system.locator('[data-map-search-locator]')).toHaveCount(0)
  const fields = details.getByRole('region', { name: 'Published Fields', exact: true })
  await expect(fields.locator('dt')).toHaveText(['Atmosphere', 'Survey index', 'Safe route'])
  await expect(fields.locator('dd')).toHaveText(['Breathable', '0', 'false'])
  await inspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(inspector).toBeHidden()
  await expect(system.locator('svg.player-system-map-scene')).toBeFocused()
  harborAnchor = await readPlayerMarkerAnchor(harborMarker)
  expect(isPlayerAnchorInsideMap(harborAnchor)).toBe(true)
  const viewBoxAfterReveal = await system.locator('svg.player-system-map-scene').getAttribute('viewBox')
  if (!viewBoxAfterReveal) throw new Error('The player system map lost its camera viewBox.')
  expect(viewBoxAfterReveal.split(/\s+/).slice(2).map(Number))
    .toEqual(viewBoxBeforeSearch.split(/\s+/).slice(2).map(Number))
  await expect(harborMarker).toHaveAttribute('aria-pressed', 'true')
  await expect(harborMarker).toHaveClass(/player-system-object-marker--dimmed/)
  const searchLocator = system.locator('[data-map-search-locator]')
  await expect(searchLocator).toBeVisible()
  await system.locator('svg.player-system-map-scene').focus()
  await expect(searchLocator).toBeVisible()
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const svgDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export star system Public System SVG', exact: true }).click()
  const svgDownload = await svgDownloadPromise
  const exportedSvg = await readFile(await svgDownload.path(), 'utf8')
  for (const publicName of ['Public Star', 'Harbor World', 'Quiet Moon', 'Unknown presence']) {
    expect(exportedSvg).toContain(publicName)
  }
  expect(exportedSvg).not.toContain('map-search-locator')
  await expect(searchLocator).toBeVisible()

  await system.getByRole('button', { name: 'Fit player map', exact: true }).click()
  await expect(searchLocator).toHaveCount(0)
  await expect(harborMarker).toHaveClass(/player-system-object-marker--dimmed/)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const normalResultSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await normalResultSearch.getByRole('combobox').fill('Quiet Moon')
  await normalResultSearch.getByRole('option', { name: /Quiet Moon/ }).click()
  const normalResultInspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await normalResultInspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(normalResultInspector).toBeHidden()
  await expect(moonMarker).not.toHaveClass(/player-system-object-marker--dimmed/)
  await expect(searchLocator).toHaveCount(0)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const crossSystemSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await crossSystemSearch.getByRole('combobox').fill('Remote Echo')
  await crossSystemSearch.getByRole('option', { name: /Remote Echo/ }).click()
  const crossSystemInspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await expect(crossSystemInspector.getByRole('region', { name: 'Player object details', exact: true }))
    .toContainText('A quiet exchange station.')
  await crossSystemInspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(crossSystemInspector).toBeHidden()
  const remoteMarker = system.getByRole('button', { name: 'Inspect Remote Echo', exact: true })
  await expect(remoteMarker).toHaveClass(/player-system-object-marker--dimmed/)
  await expect(searchLocator).toBeVisible()

  await page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true }).click()
  const activeFilters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await activeFilters.getByRole('button', { name: 'Clear all', exact: true }).click()
  await activeFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  await expect(remoteMarker).not.toHaveClass(/player-system-object-marker--dimmed/)
  await expect(searchLocator).toHaveCount(0)
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export star system Remote System PNG', exact: true }).click()
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.png$/i)
  expect((await readFile(await download.path())).subarray(0, 8))
    .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const remoteFilters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await remoteFilters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await remoteFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(remoteMarker).toHaveClass(/player-system-object-marker--dimmed/)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const deferredSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await deferredSearch.getByRole('combobox').fill('Remote Echo')
  await deferredSearch.getByRole('option', { name: /Remote Echo/ }).click()
  await expect(page.getByRole('dialog', { name: 'Player details', exact: true })).toBeVisible()
  const replacementDocument = { ...document, title: 'Replacement Reach' }
  await uploadPlayerJson(input, 'replacement-player.json', serializePlayerJson(replacementDocument))
  await expect(page.getByRole('heading', { name: 'Replacement Reach', exact: true })).toBeVisible()
  await expect(page.locator('[data-map-search-locator]')).toHaveCount(0)
  await expect(system).toHaveCount(0)

  await uploadPlayerJson(input, 'invalid-player.json', '{"private":"PRIVATE-TRUNCATED-MARKER"')
  await expect(page.getByRole('alert')).toHaveText('The player JSON file is not valid JSON.')
  await expect(page.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE-TRUNCATED-MARKER')
})
