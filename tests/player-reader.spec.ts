import { gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import { projectPlayerCluster, serializePlayerJson } from '../domain/workspace'
import { createPlayerShareUrl } from '../utils/player-share-link'
import { expect, test, type Locator } from './fixtures'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'
import { createPlayerInterfaceFixture } from './fixtures/player-interface-fixture'
import { parseMapCameraTransform } from './helpers'
import { largestUnobstructedClientRect } from '../utils/map-usable-area'

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

interface PlayerRouteScreenPoint {
  x: number
  y: number
}

function playerRouteStrokePoint(path: Locator, requireClipping = false): Promise<PlayerRouteScreenPoint | null> {
  return path.evaluate((element, clippedOnly) => {
    if (!(element instanceof SVGPathElement)) return null
    const scene = element.ownerSVGElement
    const matrix = element.getScreenCTM()
    if (!scene || !matrix) return null
    const viewport = scene.getBoundingClientRect()
    const length = element.getTotalLength()
    const pointAt = (fraction: number) => element.getPointAtLength(length * fraction).matrixTransform(matrix)
    const inside = (point: DOMPoint) => point.x > viewport.left && point.x < viewport.right
      && point.y > viewport.top && point.y < viewport.bottom
    if (clippedOnly && inside(pointAt(0)) && inside(pointAt(1))) return null
    for (let sample = 1; sample < 40; sample++) {
      const point = pointAt(sample / 40)
      if (inside(point) && document.elementFromPoint(point.x, point.y) === element) {
        return { x: point.x, y: point.y }
      }
    }
    return null
  }, requireClipping)
}

function playerRouteFitsViewport(path: Locator): Promise<boolean> {
  return path.evaluate((element) => {
    if (!(element instanceof SVGPathElement)) return false
    const scene = element.ownerSVGElement
    const matrix = element.getScreenCTM()
    if (!scene || !matrix) return false
    const viewport = scene.getBoundingClientRect()
    const bounds = element.getBBox()
    const topLeft = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix)
    const bottomRight = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height).matrixTransform(matrix)
    return topLeft.x > viewport.left && bottomRight.x < viewport.right
      && topLeft.y > viewport.top && bottomRight.y < viewport.bottom
  })
}

test('the default player reader opens shared links and files with one camera and public image scopes', async ({ page, baseURL }) => {
  // This journey exercises file and fragment replacement as well as two document shapes.
  test.setTimeout(90_000)
  if (!baseURL) throw new Error('The player reader requires a configured base URL.')
  const { document } = createPlayerInterfaceFixture()
  const publicSystem = document.systems.find(system => system.disclosure === 'revealed')
  if (!publicSystem || publicSystem.disclosure !== 'revealed') {
    throw new Error('The player fixture has no Revealed system.')
  }
  const harborWorld = publicSystem.map.objects.find(object => object.label === 'Harbor World')
  const publicStation = publicSystem.map.objects.find(object => object.label === 'Public Station')
  if (!harborWorld || harborWorld.disclosure !== 'revealed' || !publicStation || publicStation.disclosure !== 'revealed') {
    throw new Error('The player fixture has no Revealed Harbor World and station.')
  }
  Object.assign(harborWorld, { markerColor: '#A13B7C' })
  Object.assign(publicStation, { markerColor: '#35A7C2' })
  document.systems.push({
    id: 'system-2',
    position: { x: 620, y: 360 },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Zone',
  })
  document.systems.push({
    id: 'system-3',
    position: { x: 780, y: 470 },
    disclosure: 'revealed',
    type: 'star-system',
    label: 'Remote System',
    map: {
      objects: [{
        ...publicStation,
        id: 'object-1',
        label: 'Remote Echo',
        position: { x: 250, y: 250 },
        placement: { kind: 'system' },
        fields: [{ name: 'Atmosphere', type: 'single-select', value: 'Toxic' }],
      }],
      orbits: [],
    },
  })
  const sharedRoute = {
    id: 'route-2',
    jumpLevel: 3,
    fromSystemId: publicSystem.id,
    destination: { kind: 'system', systemId: 'system-3' },
  } as const
  document.routes.push(sharedRoute)
  const readerAddress = new URL('player', `${baseURL.replace(/\/$/, '')}/`)
  const readerUrl = readerAddress.href
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
  await expect(title).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-player-continuous-map] svg.player-continuous-map-scene')).toHaveCount(1)
  await page.getByRole('link', { name: 'Open player JSON instead', exact: true }).click()

  const input = page.getByLabel('Open player JSON', { exact: true })
  await expect(input).toBeEnabled({ timeout: 30_000 })
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

  const system = page.getByRole('region', { name: 'Player-visible continuous map', exact: true })
  const scene = system.locator('svg.player-continuous-map-scene')
  const camera = scene.locator(':scope > g[transform]')
  const publicSystemMarks = system.locator(`.player-continuous-system[data-player-system-id="${publicSystem.id}"]`)
  const publicSystemName = system.locator('.player-continuous-name-target')
    .and(system.getByRole('button', { name: 'Inspect Public System', exact: true }))
  const knownSystemMark = system.locator('.player-continuous-system-anchor[data-player-system-id="system-2"]')
  // At the compact Fit scale the frontmost revealed anchor can cover this marker.
  await knownSystemMark.press('Enter')
  await expect(knownSystemMark).toHaveAttribute('aria-pressed', 'true')
  await expect(system.locator('.player-continuous-object[data-player-system-id="system-2"]')).toHaveCount(0)

  await system.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const cameraBeforePan = await camera.getAttribute('transform')
  if (!cameraBeforePan) throw new Error('The public camera is not ready for panning.')
  await system.getByRole('button', { name: 'Pan left', exact: true }).click()
  await expect(camera).not.toHaveAttribute('transform', cameraBeforePan)
  const cameraBeforeInspect = await camera.getAttribute('transform')
  if (!cameraBeforeInspect) throw new Error('The public camera did not retain its transform.')
  // Select the name through its keyboard action after panning may move it behind map controls.
  await publicSystemName.press('Enter')
  await expect(publicSystemName).toHaveAttribute('aria-pressed', 'true')
  await expect(camera).toHaveAttribute('transform', cameraBeforeInspect)
  await system.getByRole('button', { name: 'Center selection', exact: true }).click()
  await expect(publicSystemMarks.getByRole('button', { name: 'Inspect Harbor World', exact: true })).toBeVisible()
  await expect(scene).toHaveCount(1)

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(\d+ active criteri(?:on|a)\))?$/ })
  const celestialTypes = filters.getByRole('group', { name: 'Celestial body', exact: true })
  await celestialTypes.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const harborMarker = publicSystemMarks.getByRole('button', { name: 'Inspect Harbor World', exact: true })
  const moonMarker = publicSystemMarks.getByRole('button', { name: 'Inspect Quiet Moon', exact: true })
  const unknownMarker = publicSystemMarks.getByRole('button', { name: 'Inspect Unknown presence', exact: true })
  await expect(harborMarker).toHaveClass(/player-continuous-object--dimmed/)
  await expect(moonMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await expect(unknownMarker).toHaveClass(/player-continuous-object--dimmed/)
  const filterButton = page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })
  await expect(filterButton).toBeVisible()
  await expect(system.locator('.player-continuous-system-orbits ellipse').first()).toHaveCSS('opacity', '1')

  await filterButton.click()
  await filters.getByRole('combobox', { name: 'Add Field filter', exact: true }).click()
  await page.getByRole('option', { name: 'Single select · Atmosphere', exact: true }).click()
  await filters.getByRole('combobox', { name: 'Single select · Atmosphere operator', exact: true }).click()
  await expect(page.getByRole('option', { name: 'No value', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await filters.getByRole('checkbox', { name: 'Breathable', exact: true }).check()
  await expect(filters).toHaveCount(1)
  await expect(filters).toHaveAccessibleName('Filters (2 active criteria)')
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(harborMarker).toHaveClass(/player-continuous-object--dimmed/)
  await expect(moonMarker).toHaveClass(/player-continuous-object--dimmed/)
  await expect(page.getByText('No objects match', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Filters (2 active criteria)', exact: true }).click()
  await celestialTypes.getByRole('checkbox', { name: 'Moon', exact: true }).uncheck()
  await expect(filters).toHaveCount(1)
  await expect(filters).toHaveAccessibleName('Filters (1 active criterion)')
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const fieldFilterButton = page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })
  await expect(fieldFilterButton).toHaveCount(1)
  await expect(harborMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await expect(moonMarker).toHaveClass(/player-continuous-object--dimmed/)
  await fieldFilterButton.click()
  await filters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('button', { name: 'Clear all', exact: true }).click()
  await expect(filters).toHaveCount(1)
  await expect(filters).toHaveAccessibleName('Filters')
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const clearedFilterButton = page.getByRole('button', { name: 'Filters', exact: true })
  await expect(clearedFilterButton).toHaveCount(1)
  await expect(harborMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await expect(moonMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await clearedFilterButton.click()
  await filters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })).toHaveCount(1)
  await expect(harborMarker).toHaveClass(/player-continuous-object--dimmed/)
  await expect(moonMarker).not.toHaveClass(/player-continuous-object--dimmed/)

  const systemZoom = system.getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 8; step += 1) {
    if (await systemZoom.isDisabled()) break
    await systemZoom.click()
  }
  await harborMarker.press('Enter')
  const inspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await inspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  // Center the actual object so its complete label fits before testing zoom-preserving search.
  await system.getByRole('button', { name: 'Center selection', exact: true }).click()
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
  const scaleBeforeSearch = parseMapCameraTransform(await camera.getAttribute('transform')).k
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const search = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await search.getByRole('combobox').fill('Harbor World')
  await search.getByRole('option', { name: /Harbor World/ }).click()
  const details = inspector.getByRole('region', { name: 'Player object details', exact: true })
  await expect(details).toContainText('A calm world with a sheltered landing basin.')
  await expect(system.locator('[data-map-search-locator]')).toHaveCount(0)
  const fields = details.getByRole('region', { name: 'Published Fields', exact: true })
  await expect(fields.locator('dt')).toHaveText(['Atmosphere', 'Survey index', 'Safe route'])
  await expect(fields.locator('dd')).toHaveText(['Breathable', '0', 'false'])
  await inspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(inspector).toBeHidden()
  await expect(scene).toBeFocused()
  harborAnchor = await readPlayerMarkerAnchor(harborMarker)
  expect(isPlayerAnchorInsideMap(harborAnchor)).toBe(true)
  expect(parseMapCameraTransform(await camera.getAttribute('transform')).k).toBe(scaleBeforeSearch)
  await expect(harborMarker).toHaveAttribute('aria-pressed', 'true')
  const harborGlyph = harborMarker.locator('.player-continuous-object-glyph')
  const markerOutline = harborMarker.locator('.player-continuous-object-marker-outline')
  await expect(harborGlyph).toHaveCSS('fill', 'rgb(161, 59, 124)')
  await expect(markerOutline).not.toHaveCSS('stroke', 'rgba(0, 0, 0, 0)')
  await expect(harborMarker).toHaveClass(/player-continuous-object--dimmed/)
  const searchLocator = system.locator('[data-map-search-locator]')
  await expect(searchLocator).toBeVisible()
  await scene.focus()
  let harborHasKeyboardFocus = false
  for (let index = 0; index < 36 && !harborHasKeyboardFocus; index += 1) {
    await page.keyboard.press('Tab')
    harborHasKeyboardFocus = await harborMarker.evaluate(element => element.matches(':focus-visible'))
  }
  expect(harborHasKeyboardFocus).toBe(true)
  await expect(harborGlyph).toHaveCSS('fill', 'rgb(161, 59, 124)')
  await expect(markerOutline).not.toHaveCSS('stroke', 'rgba(0, 0, 0, 0)')
  await expect(searchLocator).toBeVisible()
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const imageFiles = page.getByRole('dialog', { name: 'Map files', exact: true })
  await imageFiles.getByRole('radio', { name: /^selected Zone$/i }).click()
  const svgDownloadPromise = page.waitForEvent('download')
  await imageFiles.getByRole('button', { name: 'Export Selected Zone SVG', exact: true }).click()
  const svgDownload = await svgDownloadPromise
  const exportedSvg = await readFile(await svgDownload.path(), 'utf8')
  for (const publicName of ['Public Star', 'Harbor World', 'Quiet Moon', 'Unknown presence']) {
    expect(exportedSvg).toContain(publicName)
  }
  expect(exportedSvg).toContain('fill="#A13B7C"')
  expect(exportedSvg).not.toContain('map-search-locator')
  const jumpCaptions = await page.evaluate(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
    return [...svg.querySelectorAll('.player-image-system-route-caption')]
      .map(caption => [...caption.querySelectorAll('text')].map(line => line.textContent))
  }, exportedSvg)
  expect(jumpCaptions).toContainEqual(['Jump-3', 'Remote System'])
  await expect(searchLocator).toBeVisible()
  await page.getByRole('button', { name: 'Map files', exact: true }).click()

  await system.getByRole('button', { name: 'Fit player map', exact: true }).click()
  await expect(searchLocator).toHaveCount(0)
  await system.getByRole('button', { name: 'Center selection', exact: true }).click()
  await expect(harborMarker).toHaveClass(/player-continuous-object--dimmed/)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const normalResultSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await normalResultSearch.getByRole('combobox').fill('Quiet Moon')
  await normalResultSearch.getByRole('option', { name: /Quiet Moon/ }).click()
  const normalResultInspector = page.getByRole('dialog', { name: 'Player details', exact: true })
  await normalResultInspector.getByRole('button', { name: 'Return to map', exact: true }).click()
  await expect(normalResultInspector).toBeHidden()
  await expect(moonMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await expect(searchLocator).toHaveCount(0)

  const activeTypeFilters = page.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })
  await activeTypeFilters.click()
  await filters.getByRole('combobox', { name: 'Add Field filter', exact: true }).click()
  await page.getByRole('option', { name: 'Single select · Atmosphere', exact: true }).click()
  await filters.getByRole('checkbox', { name: 'Breathable', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Filters (2 active criteria)', exact: true })).toBeVisible()

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
  await expect(remoteMarker).toHaveClass(/player-continuous-object--dimmed/)
  await expect(remoteMarker.locator('.player-continuous-object-label')).toHaveText('Remote Echo')
  await expect(searchLocator).toBeVisible()

  await page.getByRole('button', { name: 'Filters (2 active criteria)', exact: true }).click()
  const activeFilters = page.getByRole('dialog', { name: /^Filters(?: \(\d+ active criteri(?:on|a)\))?$/ })
  await activeFilters.getByRole('button', { name: 'Clear all', exact: true }).click()
  await activeFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  await expect(remoteMarker).not.toHaveClass(/player-continuous-object--dimmed/)
  await expect(searchLocator).toHaveCount(0)
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  await imageFiles.getByRole('radio', { name: /^entire cluster$/i }).click()
  const overviewDownload = page.waitForEvent('download')
  await imageFiles.getByRole('button', { name: 'Export Entire Cluster SVG', exact: true }).click()
  const overviewSvg = await readFile(await (await overviewDownload).path(), 'utf8')
  expect(overviewSvg).toContain('Public System')
  expect(overviewSvg).toContain('Remote System')
  expect(overviewSvg).toContain('class="cluster-route-line"')
  expect(overviewSvg).not.toContain('Harbor World')
  await imageFiles.getByRole('radio', { name: /^selected Zone$/i }).click()
  const pendingDownload = page.waitForEvent('download')
  await imageFiles.getByRole('button', { name: 'Export Selected Zone PNG', exact: true }).click()
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.png$/i)
  expect((await readFile(await download.path())).subarray(0, 8))
    .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const remoteFilters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await remoteFilters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await remoteFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(remoteMarker).toHaveClass(/player-continuous-object--dimmed/)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const deferredSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await deferredSearch.getByRole('combobox').fill('Remote Echo')
  await deferredSearch.getByRole('option', { name: /Remote Echo/ }).click()
  await expect(page.getByRole('dialog', { name: 'Player details', exact: true })).toBeVisible()
  const replacementDocument = { ...document, title: 'Replacement Reach' }
  await uploadPlayerJson(input, 'replacement-player.json', serializePlayerJson(replacementDocument))
  await expect(page.getByRole('heading', { name: 'Replacement Reach', exact: true })).toBeVisible()
  await expect(page.locator('[data-map-search-locator]')).toHaveCount(0)
  await expect(scene).toHaveCount(1)
  await expect(system.locator('[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Player details', exact: true })).toBeHidden()
  await expect(system.getByRole('button', { name: 'Center selection', exact: true })).toBeDisabled()

  await uploadPlayerJson(input, 'invalid-player.json', '{"private":"PRIVATE-TRUNCATED-MARKER"')
  await expect(page.getByRole('alert')).toHaveText('The player JSON file is not valid JSON.')
  await expect(page.getByRole('region', { name: 'Player document', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE-TRUNCATED-MARKER')

  if (publicSystem?.disclosure !== 'revealed') throw new Error('The player reader fixture must include a revealed system.')
  const legacyLoop = {
    id: 'route-1',
    jumpLevel: 2,
    fromSystemId: publicSystem.id,
    destination: { kind: 'system' as const, systemId: publicSystem.id },
  }
  const legacyShareUrl = new URL(readerUrl)
  legacyShareUrl.hash = `player=1.gzip.${gzipSync(Buffer.from(JSON.stringify({
    ...document,
    routeBranches: undefined,
    version: 1,
    routes: [legacyLoop, sharedRoute],
  }), 'utf8')).toString('base64url')}`
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(legacyShareUrl.href)
  await expect(page.getByRole('heading', { name: document.title, exact: true })).toBeVisible()
  expect(page.url()).toBe(legacyShareUrl.href)
  const continuousMap = page.getByRole('region', { name: 'Player-visible continuous map', exact: true })
  const continuousScene = continuousMap.getByRole('group', { name: `${document.title} continuous player map`, exact: true })
  await expect(continuousScene).toBeVisible()
  await expect(continuousMap.locator('.cluster-route[data-route-id="route-1"]')).toHaveCount(0)
  const publicRouteMark = continuousMap.locator('.cluster-route[data-route-id="route-2"]')
  const publicRouteStroke = publicRouteMark.locator('.cluster-route-hit-target')
  await expect(publicRouteMark).toBeVisible()
  const initialRoutePoint = await playerRouteStrokePoint(publicRouteStroke)
  if (!initialRoutePoint) throw new Error('The public route has no visible initial stroke segment.')
  await page.mouse.click(initialRoutePoint.x, initialRoutePoint.y)
  const routeDetails = page.getByRole('region', { name: 'Jump Route details', exact: true })
  await expect(routeDetails.getByRole('heading', { name: 'Jump Level 3', exact: true })).toBeVisible()
  await expect(routeDetails).toContainText('Public System')
  await expect(routeDetails).toContainText('Remote System')
  const centerRoute = routeDetails.getByRole('button', { name: 'Center selected Jump Route', exact: true })
  await centerRoute.click()
  await expect.poll(() => playerRouteFitsViewport(publicRouteMark.locator('.cluster-route-line'))).toBe(true)

  const knownMarker = continuousMap.locator('.player-continuous-system-anchor[data-player-system-id="system-2"]')
  await knownMarker.press('Enter')
  const zoomInForRoute = continuousMap.getByRole('button', { name: 'Zoom in', exact: true })
  let clippedRoutePoint = await playerRouteStrokePoint(publicRouteStroke, true)
  for (let step = 0; !clippedRoutePoint && step < 14; step++) {
    if (await zoomInForRoute.isDisabled()) break
    await zoomInForRoute.click()
    clippedRoutePoint = await playerRouteStrokePoint(publicRouteStroke, true)
  }
  if (!clippedRoutePoint) throw new Error('The public route needs a selectable segment while an endpoint is clipped.')
  await page.mouse.click(clippedRoutePoint.x, clippedRoutePoint.y)
  await expect(routeDetails.getByRole('heading', { name: 'Jump Level 3', exact: true })).toBeVisible()
  await centerRoute.click()
  await expect.poll(() => playerRouteFitsViewport(publicRouteMark.locator('.cluster-route-line'))).toBe(true)

  const revealedMarker = document.systems.find(system => system.disclosure === 'revealed')
  if (!revealedMarker || revealedMarker.disclosure !== 'revealed') {
    throw new Error('The public player document has no Revealed system anchor.')
  }
  const anchor = continuousMap.locator(`.player-continuous-system-anchor[data-player-system-id="${revealedMarker.id}"]`)
  const playerHierarchy = page.getByRole('complementary', { name: 'Player hierarchy', exact: true })
  await playerHierarchy.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
  await expect(playerHierarchy).toBeHidden()
  const anchorBeforeSelect = await readPlayerMarkerAnchor(anchor)
  const cameraBeforeSystemSelect = await camera.getAttribute('transform')
  if (!cameraBeforeSystemSelect) throw new Error('The route-framed public camera is not ready for system selection.')
  const revealedName = continuousMap.locator(`.player-continuous-name-target[data-player-system-id="${revealedMarker.id}"]`)
  await revealedName.locator('.player-continuous-name-background').click()
  await expect(anchor).toHaveAttribute('aria-pressed', 'true')
  await expect(revealedName).toHaveAttribute('aria-pressed', 'true')
  await expect(camera).toHaveAttribute('transform', cameraBeforeSystemSelect)
  const anchorAfterSelect = await readPlayerMarkerAnchor(anchor)
  expect(Math.hypot(anchorAfterSelect.x - anchorBeforeSelect.x, anchorAfterSelect.y - anchorBeforeSelect.y)).toBeLessThan(1)

  const centerSelection = continuousMap.getByRole('button', { name: 'Center selection', exact: true })
  await centerSelection.click()
  const publicObject = revealedMarker.map.objects.find(object => object.label === 'Harbor World' && object.disclosure === 'revealed')
  if (!publicObject || publicObject.disclosure !== 'revealed') {
    throw new Error('The public player document has no distinct Revealed world to inspect.')
  }
  const objectMarker = continuousMap.locator(
    `.player-continuous-object[data-player-system-id="${revealedMarker.id}"][data-player-object-id="${publicObject.id}"]`,
  )
  const zoomIn = continuousMap.getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 24 && (await objectMarker.count()) === 0; step += 1) {
    if (await zoomIn.isDisabled()) break
    await zoomIn.click()
  }
  await expect(objectMarker).toBeVisible()
  const continuousGlyph = objectMarker.locator('.player-continuous-object-glyph')
  await expect(continuousGlyph).toHaveCSS('fill', 'rgb(161, 59, 124)')
  await expect.poll(async () => isPlayerAnchorInsideMap(await readPlayerMarkerAnchor(objectMarker))).toBe(true)
  const objectBeforeInspect = await readPlayerMarkerAnchor(objectMarker)
  await objectMarker.locator('.player-continuous-object-hit-target').click()
  await expect(centerSelection).toBeEnabled()
  await expect(objectMarker).toHaveAttribute('aria-pressed', 'true')
  await expect(continuousGlyph).toHaveCSS('fill', 'rgb(161, 59, 124)')
  await expect(objectMarker.locator('.player-continuous-object-marker-outline')).not.toHaveCSS('stroke', 'rgba(0, 0, 0, 0)')
  const objectDetails = page.getByRole('region', { name: 'Player object details', exact: true })
  await expect(objectDetails.getByRole('heading', { name: 'Harbor World', exact: true })).toBeVisible()
  const objectAfterInspect = await readPlayerMarkerAnchor(objectMarker)
  expect(Math.hypot(objectAfterInspect.x - objectBeforeInspect.x, objectAfterInspect.y - objectBeforeInspect.y)).toBeLessThan(1)
  const scaleBeforeCenter = parseMapCameraTransform(await camera.getAttribute('transform')).k
  await centerSelection.click()
  const objectAfterCenter = await readPlayerMarkerAnchor(objectMarker)
  const { drawable, obstructions, target } = await objectMarker.evaluate((element) => {
    const scene = (element as SVGGraphicsElement).ownerSVGElement
    const root = scene?.closest('.player-document-view')
    if (!scene || !root) throw new Error('The selected public object needs its rendered map and panel owner.')
    const rect = (node: Element) => {
      const bounds = node.getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
    }
    return {
      drawable: rect(scene),
      target: rect(element),
      obstructions: [...root.querySelectorAll('[data-map-obstruction], [data-player-map-obstruction]')]
        .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
          && !node.closest('[inert], [aria-hidden="true"]'))
        .map(rect),
    }
  })
  const usable = largestUnobstructedClientRect(drawable, obstructions)
  if (!usable) throw new Error('The selected public object needs unobstructed map space.')
  // Center frames the marker and its right-hand label in the space left by the visible panels.
  expect(isPlayerAnchorInsideMap({ ...objectAfterCenter, ...usable })).toBe(true)
  expect(target.left).toBeGreaterThanOrEqual(usable.left)
  expect(target.right).toBeLessThanOrEqual(usable.right)
  expect(target.top).toBeGreaterThanOrEqual(usable.top)
  expect(target.bottom).toBeLessThanOrEqual(usable.bottom)
  const centeredCamera = await camera.getAttribute('transform')
  if (!centeredCamera) throw new Error('The public camera is missing after Center.')
  expect(parseMapCameraTransform(centeredCamera).k).toBe(scaleBeforeCenter)
  await centerSelection.click()
  await expect(camera).toHaveAttribute('transform', centeredCamera)

  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const continuousFilters = page.getByRole('dialog', { name: /^Filters(?: \(\d+ active criteri(?:on|a)\))?$/ })
  await continuousFilters.getByRole('group', { name: 'Celestial body', exact: true })
    .getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await continuousFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  const continuousSearch = page.getByRole('button', { name: 'Search', exact: true })
  const revealHarbor = async () => {
    await continuousSearch.click()
    const dialog = page.getByRole('dialog', { name: 'Search player map', exact: true })
    await dialog.getByRole('combobox').fill('Harbor World')
    await dialog.getByRole('option', { name: /Harbor World/ }).click()
    await expect(objectDetails).toContainText('Harbor World')
    await expect(continuousMap.locator('[data-map-search-locator]')).toBeVisible()
  }
  await revealHarbor()
  await expect(continuousGlyph).toHaveCSS('opacity', '0.14')
  await expect(continuousGlyph).toHaveCSS('fill', 'rgb(161, 59, 124)')
  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  await mapFiles.click()
  const viewportScope = imageFiles.getByRole('radio', { name: /^current viewport$/i })
  await viewportScope.click()
  await expect(viewportScope).toBeChecked()
  const paintedViewport = await continuousScene.evaluate(element => {
    if (!(element instanceof SVGSVGElement)) throw new Error('The public scene is not an SVG.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The public scene is not painted.')
    const box = element.getBoundingClientRect()
    const inverse = matrix.inverse()
    const start = new DOMPoint(box.left, box.top).matrixTransform(inverse)
    const end = new DOMPoint(box.right, box.bottom).matrixTransform(inverse)
    return [start.x, start.y, end.x - start.x, end.y - start.y]
  })
  const viewportDownload = page.waitForEvent('download')
  await imageFiles.getByRole('button', { name: 'Export Current viewport SVG', exact: true }).click()
  const viewportSvg = await readFile(await (await viewportDownload).path(), 'utf8')
  expect(viewportSvg).toContain('fill="#A13B7C"')
  const exportedViewport = viewportSvg.match(/viewBox="([^"]+)"/)?.[1]?.split(' ').map(Number)
  expect(exportedViewport).toHaveLength(4)
  for (const [index, value] of paintedViewport.entries()) expect(exportedViewport?.[index]).toBeCloseTo(value, 3)
  expect(viewportSvg).toMatch(/opacity="\.14"[^>]*>.*?Harbor World<\/text>/)
  expect(viewportSvg).toContain('class="cluster-route-line"')
  expect(viewportSvg.match(/class="cluster-route-line"/g)).toHaveLength(1)
  expect(viewportSvg).not.toContain('data-map-search-locator')
  await mapFiles.click()
  await continuousMap.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await expect(continuousMap.locator('[data-map-search-locator]')).toHaveCount(0)
  await revealHarbor()
  await continuousScene.focus()
  await continuousScene.press('-')
  await expect(continuousMap.locator('[data-map-search-locator]')).toHaveCount(0)

  await revealHarbor()
  await expect(objectMarker).toBeVisible()
  const objectLayer = continuousMap.locator(`.player-continuous-system[data-player-system-id="${revealedMarker.id}"] .player-continuous-system-detail`)
  await expect(objectLayer).not.toHaveAttribute('inert')
  await objectMarker.focus()
  await expect(objectMarker).toBeFocused()
  for (let step = 0; step < 24 && await objectLayer.getAttribute('aria-hidden') !== 'true'; step += 1) {
    await page.keyboard.press('-')
  }
  await expect(objectLayer).toHaveAttribute('inert', '')
  await expect(objectMarker).toBeHidden()
  await expect(continuousMap.locator(`.player-continuous-name-target[data-player-system-id="${revealedMarker.id}"]`)).toBeFocused()
  await expect(objectDetails).toContainText('Harbor World')

  await page.setViewportSize({ width: 390, height: 844 })
  await continuousMap.getByRole('button', { name: 'Fit player map', exact: true }).click()
  const compactRoutePoint = await playerRouteStrokePoint(publicRouteStroke)
  if (!compactRoutePoint) throw new Error('The public route has no visible stroke segment in compact view.')
  await page.mouse.click(compactRoutePoint.x, compactRoutePoint.y)
  await expect(routeDetails.getByRole('heading', { name: 'Jump Level 3', exact: true })).toBeVisible()
  await centerRoute.click()
  await expect(continuousMap.locator('.player-continuous-map-scene')).toBeFocused()
  await expect.poll(() => playerRouteFitsViewport(publicRouteMark.locator('.cluster-route-line'))).toBe(true)

  await continuousSearch.click()
  const compactSearch = page.getByRole('dialog', { name: 'Search player map', exact: true })
  await compactSearch.getByRole('combobox').fill('Harbor World')
  await compactSearch.getByRole('option', { name: /Harbor World/ }).click()
  const compactDetails = page.getByRole('dialog', { name: 'Player details', exact: true })
  await expect(compactDetails).toContainText('Harbor World')
  await expect(continuousMap.locator('[data-map-search-locator]')).toHaveCount(0)

  const nextDocument = {
    ...document,
    title: 'Updated Player Reach',
    routes: [...document.routes, {
      id: 'route-3',
      jumpLevel: 4,
      fromSystemId: 'system-3',
      destination: { kind: 'unknown' as const, position: revealedMarker.position, label: 'Unknown destination' as const },
    }],
  }
  const nextHash = new URL(await createPlayerShareUrl(nextDocument, readerUrl)).hash
  await page.evaluate(hash => { window.location.hash = hash }, nextHash)
  await expect(page.getByRole('heading', { name: nextDocument.title, exact: true })).toBeVisible()
  await expect(compactDetails).toBeHidden()
  await expect(publicRouteMark).toHaveAttribute('aria-pressed', 'false')
  await expect(continuousMap.locator('[data-map-search-locator]')).toHaveCount(0)

  await page.setViewportSize({ width: 1280, height: 800 })
  await continuousMap.getByRole('button', { name: 'Fit player map', exact: true }).click()
  const anonymousExit = continuousMap.locator('[data-player-destination-route-id="route-3"] > .cluster-exit-mark')
  await anonymousExit.click()
  const anonymousRoute = continuousMap.getByRole('button', { name: /jump level 4 .* unknown destination/i })
  await expect(anonymousRoute).toBeFocused()
  await expect(anonymousRoute).toHaveAttribute('aria-pressed', 'true')
  await expect(routeDetails).toContainText('Unknown destination')

  const { workspace, route, root } = workspaceWithRouteObjects()
  for (const zone of workspace.cluster.systems) zone.publication = 'hidden'
  workspace.cluster.routeContents[route.id]!.objects[0]!.publication = 'revealed'
  await page.goto(readerUrl)
  await uploadPlayerJson(page.getByLabel('Open player JSON', { exact: true }), 'route-object-only.json',
    serializePlayerJson(projectPlayerCluster(workspace)))
  const detached = page.getByRole('region', { name: 'Player-visible continuous map', exact: true })
  const detachedMarker = detached.getByRole('button', { name: `Inspect ${root.name}`, exact: true })
  await expect(detachedMarker).toBeInViewport()
  await detachedMarker.press('Enter')
  await expect(page.getByRole('region', { name: 'Player object details', exact: true })).toContainText(root.playerText)
  await expect(page.getByRole('region', { name: 'Public Jump Route association', exact: true })).toHaveCount(0)
  await expect(detached.getByRole('button', { name: /Jump Level/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  await expect(imageFiles.getByRole('radio', { name: /^selected Zone$/i })).toBeDisabled()
  const detachedDownload = page.waitForEvent('download')
  await imageFiles.getByRole('button', { name: 'Export Entire Cluster SVG', exact: true }).click()
  const detachedSvg = await readFile(await (await detachedDownload).path(), 'utf8')
  expect(detachedSvg).toContain(root.name)
  expect(detachedSvg).not.toMatch(/Vesper|Aster|Jump-3|Unknown destination|Private expedition log/)
})
