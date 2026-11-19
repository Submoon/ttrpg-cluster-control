import { readFile } from 'node:fs/promises'
import { exportJumpCluster, restoreJumpClusterBackup } from '../domain/workspace'
import { expect, test, type Page } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  waitForWorkspaceSaved, downloadImage, downloadJson, openChartDetailsEditor, openMapFilesSection,
  openWorkspaceHierarchy, centerWorkspaceSelection, hideWorkspaceInspector, selectInspectorOption,
  setWorkspaceMapMode, workspaceZoomControls, wardenMap, wardenObjectMark,
} from './helpers'
import type { DownloadWindow, ExportedMap } from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

type SceneBounds = { x: number; y: number; width: number; height: number }
type LegacyCampaignMap = ExportedMap<{
  id: string; jumpLevel: number; fromPointId: string; toPointId: string | null; unresolvedExit?: string
}>

function campaignWithUnresolvedExit(): LegacyCampaignMap {
  const fixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as LegacyCampaignMap
  if (!fixture.cluster) throw new Error('The campaign export fixture is missing its Cluster.')
  fixture.cluster.routes.push({
    id: 'campaign-baseline-unresolved-route',
    jumpLevel: 12,
    fromPointId: 'campaign-baseline-departure',
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  return fixture
}

function campaignWithExportPreviews(): LegacyCampaignMap {
  const fixture = campaignWithUnresolvedExit()
  const unresolvedRoute = fixture.cluster?.routes.find(route => route.id === 'campaign-baseline-unresolved-route')
  if (!unresolvedRoute || !fixture.layout) throw new Error('The export preview fixture is missing its unresolved route layout.')
  unresolvedRoute.unresolvedExit = 'Uncharted exit beyond the Perseus Reach and outer navigation boundary'
  fixture.layout.unresolvedExitPositions = {
    ...fixture.layout.unresolvedExitPositions,
    [unresolvedRoute.id]: { x: 40, y: 260 },
  }
  const system = fixture.cluster?.systems[0]
  if (!system) throw new Error('The export preview fixture is missing its Star System.')
  fixture.cluster?.routes.push({
    id: 'ticket19-incoming-route',
    jumpLevel: 3,
    fromPointId: 'campaign-baseline-arrival',
    toPointId: 'campaign-baseline-departure',
  })

  const orbitId = 'ticket28-preview-unoccupied-orbit'
  const nestedOrbitId = 'ticket28-preview-nested-orbit'
  const passengerId = 'ticket28-preview-transfer-moon'
  const nestedObjectId = 'ticket28-preview-nested-traveler'
  system.orbits.push(
    { id: orbitId, hostId: null, center: { x: 0.85, y: 0.2 }, order: 1 },
    { id: nestedOrbitId, hostId: passengerId, order: 1 },
  )
  system.objects.push(
    {
      id: passengerId,
      family: 'CelestialBody',
      subtype: 'moon',
      locationKey: 'MO-03',
      name: 'Transfer Moon',
      description: '',
      placement: { kind: 'orbit', orbitId },
    },
    {
      id: nestedObjectId,
      family: 'CelestialBody',
      subtype: 'moon',
      locationKey: 'MO-04',
      name: 'Nested Traveler',
      description: '',
      placement: { kind: 'orbit', orbitId: nestedOrbitId },
    },
  )
  fixture.layout.orbitRadii[orbitId] = { horizontal: 16, vertical: 60 }
  fixture.layout.orbitRadii[nestedOrbitId] = { horizontal: 46, vertical: 46 }
  fixture.layout.objectAngles[passengerId] = 0
  fixture.layout.objectAngles[nestedObjectId] = 0
  return fixture
}

async function inspectContinuousImage(
  page: import('@playwright/test').Page,
  content: string,
): Promise<{
  viewBox: [number, number, number, number]
  width: number
  height: number
  contentTransform: string | null
  systemIds: string[]
  systemNames: string[]
  routeIds: string[]
  routeLabelIds: string[]
  routePaths: Record<string, string>
  dashedRouteIds: string[]
  detailedSystemIds: string[]
  orbitIds: string[]
  objectIds: string[]
  dimmedObjectIds: string[]
  anchorTransforms: Record<string, string | null>
  systemNameBounds: Record<string, SceneBounds>
  unresolvedExitMarkerIds: string[]
  unresolvedCaptions: Array<{ routeId: string; text: string; x: number; fontSize: string | null; fontFamily: string | null; anchor: string | null }>
  searchLocatorObjectIds: string[]
  texts: string[]
}> {
  return page.evaluate((source) => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox')
    if (svg.localName !== 'svg' || !viewBox) throw new Error('The continuous map SVG is invalid.')
    const values = viewBox.trim().split(/\s+/).map(Number)
    if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
      throw new Error('The continuous map SVG has invalid bounds.')
    }
    const [x, y, width, height] = values
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      throw new Error('The continuous map SVG has invalid bounds.')
    }
    const routeMarks = [...svg.querySelectorAll<SVGGElement>('.cluster-route[data-route-id]')]
    const systems = [...svg.querySelectorAll<SVGGElement>('.continuous-warden-system[data-system-id]')]
    const anchors = systems.flatMap(system => {
      const id = system.getAttribute('data-system-id')
      const anchor = system.querySelector<SVGGElement>('.continuous-warden-system-anchor')
      return id ? [[id, anchor?.getAttribute('transform') ?? null] as const] : []
    })
    const objects = [...svg.querySelectorAll<SVGGElement>('.continuous-warden-object[data-object-id]')]
    const nameBounds = [...svg.querySelectorAll<SVGGElement>('.continuous-warden-name-target[data-system-id]')].flatMap(target => {
      const id = target.getAttribute('data-system-id')
      const transform = target.getAttribute('transform')?.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/)
      const background = target.querySelector<SVGRectElement>('.continuous-warden-name-background')
      if (!id || !transform || !background) return []
      return [[id, {
        x: Number(transform[1]) + Number(background.getAttribute('x')),
        y: Number(transform[2]) + Number(background.getAttribute('y') ?? 0),
        width: Number(background.getAttribute('width')),
        height: Number(background.getAttribute('height')),
      }] as const]
    })
    return {
      viewBox: [x, y, width, height],
      width: Number(svg.getAttribute('width')),
      height: Number(svg.getAttribute('height')),
      contentTransform: svg.querySelector('.cluster-map-content')?.getAttribute('transform') ?? null,
      systemIds: systems.map(system => system.getAttribute('data-system-id')!).filter(Boolean),
      systemNames: [...svg.querySelectorAll('.continuous-warden-system-name')]
        .map(name => name.textContent?.trim() ?? '').filter(Boolean),
      routeIds: routeMarks.map(route => route.getAttribute('data-route-id')!).filter(Boolean),
      routeLabelIds: routeMarks.filter(route => route.querySelector('.cluster-route-label-bg'))
        .map(route => route.getAttribute('data-route-id')!).filter(Boolean),
      routePaths: Object.fromEntries(routeMarks.flatMap(route => {
        const id = route.getAttribute('data-route-id')
        const path = route.querySelector('.cluster-route-line')?.getAttribute('d')
        return id && path ? [[id, path]] : []
      })),
      dashedRouteIds: routeMarks.flatMap(route => route.querySelector('.cluster-route-line')?.getAttribute('stroke-dasharray')
        ? [route.getAttribute('data-route-id')!]
        : []),
      detailedSystemIds: systems.filter(system => system.querySelector('.continuous-warden-system-envelope.is-detailed'))
        .map(system => system.getAttribute('data-system-id')!).filter(Boolean),
      orbitIds: [...svg.querySelectorAll<SVGElement>('.system-orbits [data-orbit-id]')]
        .map(orbit => orbit.getAttribute('data-orbit-id')!).filter(Boolean),
      objectIds: objects.map(object => object.getAttribute('data-object-id')!).filter(Boolean),
      dimmedObjectIds: objects.filter(object => object.classList.contains('is-dimmed'))
        .map(object => object.getAttribute('data-object-id')!).filter(Boolean),
      anchorTransforms: Object.fromEntries(anchors),
      systemNameBounds: Object.fromEntries(nameBounds),
      unresolvedExitMarkerIds: routeMarks.filter(route => route.querySelector('.cluster-exit-mark'))
        .map(route => route.getAttribute('data-route-id')!).filter(Boolean),
      unresolvedCaptions: routeMarks.flatMap(route => {
        const label = route.querySelector<SVGTextElement>('.cluster-exit-label')
        const routeId = route.getAttribute('data-route-id')
        return label && routeId ? [{
          routeId,
          text: label.textContent?.trim() ?? '',
          x: Number(label.getAttribute('x')),
          fontSize: label.getAttribute('font-size'),
          fontFamily: label.getAttribute('font-family'),
          anchor: label.getAttribute('text-anchor'),
        }] : []
      }),
      searchLocatorObjectIds: [...svg.querySelectorAll<SVGElement>('.continuous-warden-search-locator')]
        .map(locator => locator.closest('.continuous-warden-object')?.getAttribute('data-object-id') ?? '')
        .filter(Boolean),
      texts: [...svg.querySelectorAll('text')].map(text => text.textContent?.trim() ?? '').filter(Boolean),
    }
  }, content)
}

async function setPrintChoice(page: import('@playwright/test').Page, enabled: boolean): Promise<void> {
  const images = await openMapFilesSection(page, 'Export an image')
  const printChoice = images.getByRole('menuitemcheckbox', { name: 'Light for printing', exact: true })
  if (enabled) {
    await printChoice.press('Space')
    await expect(printChoice).toBeChecked()
  }
  else await expect(printChoice).not.toBeChecked()
}

async function downloadSvgWhilePointerHeld(page: import('@playwright/test').Page): Promise<string> {
  const images = await openMapFilesSection(page, 'Export an image', 'keyboard')
  const exportButton = images.getByRole('menuitem', { name: 'Warden SVG', exact: true })
  await expect(exportButton).toBeVisible()
  const pendingDownload = page.waitForEvent('download')
  await exportButton.press('Enter')
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.svg$/i)
  const text = await page.evaluate(async () => {
    const blobs = (window as DownloadWindow).__mapExportBlobs
    const index = blobs?.findIndex(blob => blob.type.startsWith('image/svg+xml')) ?? -1
    if (index < 0) throw new Error('The active preview export did not produce an SVG Blob.')
    const blob = blobs?.splice(index, 1)[0]
    if (!blob) throw new Error('The active preview SVG Blob could not be read.')
    return blob.text()
  })
  return text
}

function approximateCubicRouteLength(path: string): number {
  const values = path.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number) ?? []
  if (values.length !== 8 || values.some(value => !Number.isFinite(value))) {
    throw new Error('A Warden image route is not a cubic Bezier path.')
  }
  const [x0, y0, x1, y1, x2, y2, x3, y3] = values as [number, number, number, number, number, number, number, number]
  let length = 0
  let previousX = x0
  let previousY = y0
  for (let index = 1; index <= 32; index += 1) {
    const t = index / 32
    const inverse = 1 - t
    const x = inverse ** 3 * x0 + 3 * inverse ** 2 * t * x1 + 3 * inverse * t ** 2 * x2 + t ** 3 * x3
    const y = inverse ** 3 * y0 + 3 * inverse ** 2 * t * y1 + 3 * inverse * t ** 2 * y2 + t ** 3 * y3
    length += Math.hypot(x - previousX, y - previousY)
    previousX = x
    previousY = y
  }
  return length
}

async function exportedGeometry(page: Page, text: string) {
  return page.evaluate(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
    return {
      objects: [...svg.querySelectorAll('.continuous-warden-object')].map(object => ({
        id: object.getAttribute('data-object-id'), transform: object.getAttribute('transform'),
      })),
      orbits: [...svg.querySelectorAll('.continuous-warden-orbit-target')].map(orbit => ({
        id: orbit.getAttribute('data-orbit-id'), cx: orbit.getAttribute('cx'), cy: orbit.getAttribute('cy'),
        rx: orbit.getAttribute('rx'), ry: orbit.getAttribute('ry'), transform: orbit.getAttribute('transform'),
      })),
    }
  }, text)
}

async function exportedPalette(page: Page, text: string) {
  return page.evaluate(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml')
    const background = svg.querySelector<SVGElement>('.continuous-warden-export-background')?.style.fill
    if (!background) throw new Error('The Warden SVG needs an opaque background.')
    return {
      background,
      text: [...svg.querySelectorAll<SVGElement>('.continuous-warden-object-name, .continuous-warden-system-name')].map(node => node.style.fill),
      marks: [...svg.querySelectorAll<SVGElement>('.orbit-ring')].map(node => node.style.stroke),
    }
  }, text)
}

function luminance(color: string): number {
  const channels = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!channels) throw new Error(`Expected an opaque RGB export color, received ${color}.`)
  const linear = (value: string) => {
    const channel = Number(value) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  }
  return .2126 * linear(channels[1]!) + .7152 * linear(channels[2]!) + .0722 * linear(channels[3]!)
}

async function expectDownloadedPngBackground(page: Page, fill: string) {
  const pending = page.waitForEvent('download')
  const png = await downloadImage(page, 'image/png')
  const path = await (await pending).path()
  if (!path) throw new Error('The PNG download has no readable file.')
  const base64 = (await readFile(path)).toString('base64')
  const pixels = await page.evaluate(async ({ base64, fill }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The actual PNG needs a decoding canvas.')
    context.drawImage(image, 0, 0)
    const actual = [...context.getImageData(0, 0, 1, 1).data]
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = fill
    context.fillRect(0, 0, 1, 1)
    return { actual, expected: [...context.getImageData(0, 0, 1, 1).data] }
  }, { base64, fill })
  expect(pixels.actual).toEqual(pixels.expected)
  expect(pixels.actual[3]).toBe(255)
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  return png
}

test('Warden system images keep applied geometry through drafts and preserve the printable palette', async ({ page }) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ colorScheme: 'dark' })
  const fixture = exportJumpCluster(restoreJumpClusterBackup(campaignWithExportPreviews()))
  const system = fixture.cluster.systems[0]!
  system.name = `Vesper ${'W'.repeat(70)}`
  const star = system.objects.find(object => object.name === 'Primary Star')!
  star.publication = 'hidden'
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  const map = wardenMap(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: `Inspect ${system.name}`, exact: true }).click()
  await centerWorkspaceSelection(page)
  await hideWorkspaceInspector(page)
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog', { name: /^Filters(?: \(\d+ active criteri(?:on|a)\))?$/ })
  await filters.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filters.getByRole('checkbox', { name: 'Hidden', exact: true }).check()
  await filters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(wardenObjectMark(page, system.id, star.id)).toHaveClass(/is-dimmed/)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const applied = await downloadImage(page, 'image/svg+xml', 'Selected system')
  if (!applied.text) throw new Error('The applied Warden system SVG is missing.')
  const appliedScene = await inspectContinuousImage(page, applied.text)
  expect(appliedScene.objectIds).toContain(star.id)
  expect(appliedScene.dimmedObjectIds).toEqual([])
  const title = appliedScene.systemNameBounds[system.id]
  if (!title) throw new Error('The long applied system name needs export bounds.')
  expect(title.x).toBeGreaterThanOrEqual(appliedScene.viewBox[0])
  expect(title.x + title.width).toBeLessThanOrEqual(appliedScene.viewBox[0] + appliedScene.viewBox[2])
  const viewport = await downloadImage(page, 'image/svg+xml', 'Current viewport')
  if (!viewport.text) throw new Error('The filtered viewport SVG is missing.')
  expect((await inspectContinuousImage(page, viewport.text)).dimmedObjectIds).toContain(star.id)
  const darkPalette = await exportedPalette(page, applied.text)
  await expectDownloadedPngBackground(page, darkPalette.background)

  const iria = wardenObjectMark(page, system.id, 'campaign-baseline-iria')
  await iria.press('Enter')
  const inspector = page.locator('#workspace-inspector-panel')
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const draftName = 'UNAPPLIED image name'
  await inspector.getByLabel('Name', { exact: true }).fill(draftName)
  await expect(iria.locator('.continuous-warden-object-name')).toHaveText(draftName)
  const objectDraftSvg = await downloadImage(page, 'image/svg+xml', 'Selected system')
  if (!objectDraftSvg.text) throw new Error('The object draft SVG is missing.')
  expect(objectDraftSvg.text).not.toContain(draftName)
  expect(await exportedGeometry(page, objectDraftSvg.text)).toEqual(await exportedGeometry(page, applied.text))
  await expect(iria.locator('.continuous-warden-object-name')).toHaveText(draftName)
  await inspector.getByRole('button', { name: /^Discard changes/ }).click()

  const orbitId = 'ticket28-preview-unoccupied-orbit'
  await map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`).press('Enter')
  await inspector.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await selectInspectorOption(inspector.getByLabel('Host', { exact: true }), 'A, Primary Star (Star)')
  await inspector.getByLabel('Horizontal radius', { exact: true }).fill('220')
  await inspector.getByLabel('Vertical radius', { exact: true }).fill('180')
  const passenger = wardenObjectMark(page, system.id, 'ticket28-preview-transfer-moon')
  const passengerBefore = await passenger.getAttribute('transform')
  await inspector.getByRole('button', { name: 'Preview placement', exact: true }).click()
  await expect(inspector.getByRole('status').filter({ hasText: /Preview ready/i })).toBeVisible()
  await expect(passenger).not.toHaveAttribute('transform', passengerBefore ?? '')
  const previewTransform = await passenger.getAttribute('transform')
  const orbitDraftSvg = await downloadImage(page, 'image/svg+xml', 'Selected system')
  if (!orbitDraftSvg.text) throw new Error('The Orbit preview SVG is missing.')
  expect(await exportedGeometry(page, orbitDraftSvg.text)).toEqual(await exportedGeometry(page, applied.text))
  expect((await inspectContinuousImage(page, orbitDraftSvg.text)).viewBox).toEqual(appliedScene.viewBox)
  await expect(passenger).toHaveAttribute('transform', previewTransform ?? '')
  const previewPng = await expectDownloadedPngBackground(page, darkPalette.background)
  if (!previewPng.sourceSvgText) throw new Error('The preview PNG needs its serialized applied source.')
  expect(await exportedGeometry(page, previewPng.sourceSvgText)).toEqual(await exportedGeometry(page, applied.text))
  await inspector.getByRole('button', { name: /^Discard changes/ }).click()
  await expect(passenger).toHaveAttribute('transform', passengerBefore ?? '')

  await setPrintChoice(page, true)
  const printSvg = await downloadImage(page, 'image/svg+xml')
  if (!printSvg.text) throw new Error('The printable Warden SVG is missing.')
  const palette = await exportedPalette(page, printSvg.text)
  expect(palette.background).not.toBe(darkPalette.background)
  for (const current of [darkPalette, palette]) {
    const background = luminance(current.background)
    for (const [colors, minimum] of [[current.text, 4.5], [current.marks, 3]] as const) {
      expect(colors.length).toBeGreaterThan(0)
      for (const color of colors) {
        const foreground = luminance(color)
        expect((Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05)).toBeGreaterThanOrEqual(minimum)
      }
    }
  }
  await setPrintChoice(page, true)
  const printablePng = await expectDownloadedPngBackground(page, palette.background)
  if (!printablePng.sourceSvgText) throw new Error('The printable PNG needs its source SVG.')
  expect((await exportedPalette(page, printablePng.sourceSvgText)).background).toBe(palette.background)
  await setPrintChoice(page, false)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
})

test('the default Warden map exports all three scopes from applied layout and camera state', async ({ page }) => {
  test.setTimeout(120_000)
  const fixture = exportJumpCluster(restoreJumpClusterBackup(campaignWithExportPreviews()))
  await importCampaignWorkspace(page, fixture, { width: 1440, height: 960 })
  const orbitId = 'ticket28-preview-unoccupied-orbit'
  const transferMoonId = 'ticket28-preview-transfer-moon'
  const nestedTravelerId = 'ticket28-preview-nested-traveler'
  const iriaId = 'campaign-baseline-iria'
  const nixId = 'campaign-baseline-nix'
  const continuousMap = page.locator('svg.continuous-warden-map-svg')
  await expect(continuousMap).toBeVisible()
  await setWorkspaceMapMode(page, 'Select')
  const zoom = workspaceZoomControls(page)
  await zoom.getByRole('button', { name: 'Fit map', exact: true }).click()
  await continuousMap.locator('.continuous-warden-system-anchor[data-system-id="campaign-baseline-vesper"]').click()
  await zoom.getByRole('button', { name: 'Center selected target', exact: true }).click()
  const vesperObjects = continuousMap.locator('.continuous-warden-object[data-system-id="campaign-baseline-vesper"]')
  for (let step = 0; await vesperObjects.count() === 0 && step < 12; step++) {
    await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  }
  await expect(vesperObjects.first()).toBeVisible()
  const harrowAnchor = continuousMap.locator('.continuous-warden-system-anchor[data-system-id="campaign-baseline-harrow"]')
  const harrowOverlapsLiveViewport = async () => harrowAnchor.evaluate(anchor => {
    if (!(anchor instanceof SVGElement)) throw new Error('The Harrow anchor is missing its SVG geometry.')
    const svg = anchor.ownerSVGElement
    if (!svg) return false
    const mapBounds = svg.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    return anchorBounds.right > mapBounds.left && anchorBounds.left < mapBounds.right
      && anchorBounds.bottom > mapBounds.top && anchorBounds.top < mapBounds.bottom
  })
  for (let step = 0; await harrowOverlapsLiveViewport() && step < 12; step++) {
    await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
  }
  expect(await harrowOverlapsLiveViewport()).toBe(false)

  const filterButton = page.getByRole('button', { name: /^Filters(?: \(|$)/ })
  await filterButton.click()
  const filterPanel = page.getByRole('dialog', { name: /^Filters(?: \(\d+ active criteri(?:on|a)\))?$/ })
  await filterPanel.getByRole('checkbox', { name: 'Moon', exact: true }).check()
  await filterPanel.getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await filterPanel.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(filterButton).toHaveAccessibleName('Filters (1 active criterion)')
  const liveDimmedIds = await continuousMap.locator('.continuous-warden-object.is-dimmed')
    .evaluateAll(objects => objects.map(object => object.getAttribute('data-object-id')).filter((id): id is string => Boolean(id)).sort())
  expect(liveDimmedIds).toContain('campaign-baseline-star')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const searchQuery = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await searchQuery.fill('Primary Star')
  const starSearchResult = searchDialog.getByRole('option', { name: /Primary Star.*Star System: Vesper Prime/ })
  await expect(starSearchResult).toBeVisible()
  await starSearchResult.click()
  const filteredSearchStar = continuousMap.locator('.continuous-warden-object[data-object-id="campaign-baseline-star"]')
  await expect(filteredSearchStar).toHaveClass(/is-dimmed/)
  const searchLocator = filteredSearchStar.locator('.continuous-warden-search-locator')
  await expect(searchLocator).toBeVisible()
  expect(await searchLocator.evaluate((element) => {
    let effectiveOpacity = 1
    for (let current: Element | null = element; current; current = current.parentElement) {
      effectiveOpacity *= Number.parseFloat(getComputedStyle(current).opacity)
    }
    return effectiveOpacity
  })).toBe(1)
  const liveViewportTransform = await continuousMap.locator('.cluster-map-content').getAttribute('transform')
  if (!liveViewportTransform) throw new Error('The continuous map camera transform is missing.')

  const imageScopes = [
    { label: 'Entire Cluster' as const, expectedSystemIds: ['campaign-baseline-harrow', 'campaign-baseline-vesper'] },
    { label: 'Selected system' as const, expectedSystemIds: ['campaign-baseline-vesper'] },
    { label: 'Current viewport' as const, expectedSystemIds: ['campaign-baseline-harrow', 'campaign-baseline-vesper'] },
  ]
  const scopeScenes: Record<string, Awaited<ReturnType<typeof inspectContinuousImage>>> = {}
  for (const scope of imageScopes) {
    const svg = await downloadImage(page, 'image/svg+xml', scope.label)
    if (!svg.text) throw new Error(`The ${scope.label} Warden SVG is empty.`)
    const scene = await inspectContinuousImage(page, svg.text)
    scopeScenes[scope.label] = scene
    expect(scene.systemIds.sort()).toEqual(scope.expectedSystemIds)
    expect(scene.texts).not.toContain('Export an image')
    expect(scene.texts).not.toContain('Map files')

    const png = await downloadImage(page, 'image/png', scope.label)
    expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.width).toBeGreaterThan(0)
    expect(png.height).toBeGreaterThan(0)
    expect(png.width).toBeLessThanOrEqual(4096)
    expect(png.height).toBeLessThanOrEqual(4096)
    expect(png.width! * png.height!).toBeLessThanOrEqual(4_194_304)
    if (!png.sourceSvgText) throw new Error(`The ${scope.label} Warden PNG did not retain its source SVG.`)
    const pngScene = await inspectContinuousImage(page, png.sourceSvgText)
    expect(pngScene.viewBox).toEqual(scene.viewBox)
    expect(pngScene.systemIds.sort()).toEqual(scene.systemIds.sort())
    expect(pngScene.routeIds.sort()).toEqual(scene.routeIds.sort())
    expect(pngScene.routeLabelIds.sort()).toEqual(scene.routeLabelIds.sort())
  }

  const clusterScene = scopeScenes['Entire Cluster']
  const selectedScene = scopeScenes['Selected system']
  const viewportScene = scopeScenes['Current viewport']
  if (!clusterScene || !selectedScene || !viewportScene) throw new Error('A Warden image scope was not exported.')
  expect(clusterScene.systemNames).toEqual(expect.arrayContaining(['Vesper Prime', 'Harrow']))
  for (const bounds of Object.values(clusterScene.systemNameBounds)) {
    expect(bounds.x).toBeGreaterThanOrEqual(clusterScene.viewBox[0])
    expect(bounds.y).toBeGreaterThanOrEqual(clusterScene.viewBox[1])
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(clusterScene.viewBox[0] + clusterScene.viewBox[2])
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(clusterScene.viewBox[1] + clusterScene.viewBox[3])
  }
  expect(clusterScene.routeIds.sort()).toEqual([
    'campaign-baseline-route',
    'campaign-baseline-unresolved-route',
    'ticket19-incoming-route',
  ])
  expect(clusterScene.texts).toEqual(expect.arrayContaining(['Jump-1', 'Jump-3', 'Jump-12']))
  expect(clusterScene.routeLabelIds.sort()).toEqual(clusterScene.routeIds.sort())
  const longCaption = 'Unknown: Uncharted exit beyond the Perseus Reach and outer navigation boundary'
  expect(clusterScene.texts).toContain(longCaption)
  expect(clusterScene.unresolvedExitMarkerIds).toContain('campaign-baseline-unresolved-route')
  const caption = clusterScene.unresolvedCaptions.find(item => item.routeId === 'campaign-baseline-unresolved-route')
  if (!caption) throw new Error('The Cluster export is missing the long unresolved destination caption.')
  expect(caption.fontSize).toBe('11')
  expect(caption.fontFamily).toBe('Consolas, monospace')
  expect(caption.anchor).toBe('end')
  const captionWidth = await page.evaluate(({ text, fontSize, fontFamily }) => {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('Could not measure the exported unresolved destination caption.')
    context.font = `${fontSize}px ${fontFamily}`
    return context.measureText(text).width
  }, { text: caption.text, fontSize: Number(caption.fontSize), fontFamily: caption.fontFamily ?? 'Consolas, monospace' })
  expect(caption.x - captionWidth).toBeGreaterThanOrEqual(clusterScene.viewBox[0])
  expect(viewportScene.texts).not.toContain(longCaption)
  expect(viewportScene.unresolvedCaptions).toEqual([])
  expect(viewportScene.unresolvedExitMarkerIds).toContain('campaign-baseline-unresolved-route')
  expect(viewportScene.searchLocatorObjectIds).toEqual([])
  expect(selectedScene.routeIds.sort()).toEqual([
    'campaign-baseline-route',
    'campaign-baseline-unresolved-route',
    'ticket19-incoming-route',
  ])
  expect(selectedScene.dashedRouteIds.sort()).toEqual(selectedScene.routeIds.sort())
  expect(selectedScene.routeLabelIds).toEqual([])
  expect(selectedScene.dimmedObjectIds).toEqual([])
  expect(selectedScene.texts).not.toContain(longCaption)
  for (const routeId of selectedScene.routeIds) {
    const path = selectedScene.routePaths[routeId]
    if (!path) throw new Error(`The selected-system export is missing incident route ${routeId}.`)
    expect(approximateCubicRouteLength(path)).toBeLessThanOrEqual(61)
  }
  expect(selectedScene.orbitIds).toEqual(expect.arrayContaining([orbitId, 'campaign-baseline-primary-orbit']))
  expect(selectedScene.objectIds).toEqual(expect.arrayContaining([transferMoonId, nestedTravelerId, iriaId, nixId]))
  expect(selectedScene.viewBox[2]).toBeLessThan(clusterScene.viewBox[2])
  expect(selectedScene.systemIds).not.toContain('campaign-baseline-harrow')
  expect(viewportScene.contentTransform).toBe(liveViewportTransform)
  const liveViewportRouteLabelIds = await continuousMap.locator('.continuous-warden-route-layer .cluster-route')
    .evaluateAll(routes => routes.filter(route => route.querySelector('.cluster-route-label-bg'))
      .map(route => route.getAttribute('data-route-id')).filter((id): id is string => Boolean(id)).sort())
  expect(viewportScene.routeLabelIds.sort()).toEqual(liveViewportRouteLabelIds)
  expect([...viewportScene.detailedSystemIds].sort()).toEqual(
    (await continuousMap.locator('.continuous-warden-system-envelope.is-detailed')
      .evaluateAll(envelopes => envelopes.map(envelope => envelope.closest('.continuous-warden-system')?.getAttribute('data-system-id'))
        .filter((id): id is string => Boolean(id)).sort())),
  )
  expect(viewportScene.dimmedObjectIds.sort()).toEqual(liveDimmedIds)

  const appliedAnchorTransform = await continuousMap
    .locator('.continuous-warden-system-anchor[data-system-id="campaign-baseline-vesper"]')
    .getAttribute('transform')
  if (!appliedAnchorTransform) throw new Error('Vesper Prime has no applied anchor transform.')
  await setWorkspaceMapMode(page, 'Move')
  const anchor = continuousMap.locator('.continuous-warden-system-anchor[data-system-id="campaign-baseline-vesper"]')
  const anchorBounds = await anchor.boundingBox()
  if (!anchorBounds) throw new Error('Vesper Prime has no visible anchor for the movement preview.')
  await page.mouse.move(anchorBounds.x + anchorBounds.width / 2, anchorBounds.y + anchorBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(anchorBounds.x + anchorBounds.width / 2 + 38, anchorBounds.y + anchorBounds.height / 2 + 18, { steps: 3 })
  await expect(anchor).toHaveClass(/is-move-preview/)
  expect(await anchor.getAttribute('transform')).not.toBe(appliedAnchorTransform)
  const viewportPreviewSvg = await downloadSvgWhilePointerHeld(page)
  const viewportPreviewScene = await inspectContinuousImage(page, viewportPreviewSvg)
  expect(viewportPreviewScene.contentTransform).toBe(liveViewportTransform)
  expect(viewportPreviewScene.anchorTransforms['campaign-baseline-vesper']).toBe(appliedAnchorTransform)
  await expect(anchor).toHaveClass(/is-move-preview/)
  await page.mouse.up()
  await waitForWorkspaceSaved(page)

  const chartDetails = await openChartDetailsEditor(page)
  const draftClusterName = 'Unapplied export title'
  await chartDetails.getByLabel('Jump Cluster', { exact: true }).fill(draftClusterName)
  await expect(continuousMap.locator(':scope > title')).toHaveText(`${draftClusterName} continuous Warden map`)

  const downloads: string[] = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.evaluate(() => {
    const windowWithGate = window as Window & {
      __ticket19DecodeStarted?: boolean
      __ticket19DecodeSettled?: boolean
      __ticket19ReleaseDecode?: () => void
    }
    const prototype = HTMLImageElement.prototype
    const originalDecode = prototype.decode
    windowWithGate.__ticket19DecodeStarted = false
    windowWithGate.__ticket19DecodeSettled = false
    windowWithGate.__ticket19ReleaseDecode = undefined
    prototype.decode = function decodeWithExportGate() {
      windowWithGate.__ticket19DecodeStarted = true
      return new Promise<void>((resolve, reject) => {
        windowWithGate.__ticket19ReleaseDecode = () => {
          prototype.decode = originalDecode
          void originalDecode.call(this).then(() => {
            windowWithGate.__ticket19DecodeSettled = true
            resolve()
          }, error => {
            windowWithGate.__ticket19DecodeSettled = true
            reject(error)
          })
        }
      })
    }
  })
  const imageMenu = await openMapFilesSection(page, 'Export an image')
  await imageMenu.getByRole('menuitem', { name: 'Warden PNG', exact: true }).click()
  await page.waitForFunction(() => (window as Window & { __ticket19DecodeStarted?: boolean }).__ticket19DecodeStarted === true)
  await page.evaluate(() => { (window as DownloadWindow).__mapExportBlobs?.splice(0) })
  const replacementSvg = await downloadImage(page, 'image/svg+xml', 'Entire Cluster')
  expect(replacementSvg.text).toBeTruthy()
  expect(replacementSvg.text).not.toContain(draftClusterName)
  expect(await page.evaluate(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
    return svg.querySelector(':scope > title')?.textContent
  }, replacementSvg.text!)).toBe(`${campaignBaselineFixture.cluster.name} Jump Cluster image`)
  const replacementScene = await inspectContinuousImage(page, replacementSvg.text!)
  expect(replacementScene.systemIds.sort()).toEqual(['campaign-baseline-harrow', 'campaign-baseline-vesper'])
  await page.evaluate(() => (window as Window & { __ticket19ReleaseDecode?: () => void }).__ticket19ReleaseDecode?.())
  await page.waitForFunction(() => (window as Window & { __ticket19DecodeSettled?: boolean }).__ticket19DecodeSettled === true)
  await page.waitForTimeout(100)
  expect(downloads).toHaveLength(1)
  expect(downloads[0]).toMatch(/\.svg$/i)
})
