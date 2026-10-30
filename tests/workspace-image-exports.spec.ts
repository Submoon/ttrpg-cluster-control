import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import {
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadImage,
  downloadJson,
  inspectImageSvg,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  panMap,
  returnToClusterMap,
  resolveImportReview,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  workspaceNavigation,
  workspaceZoomControls,
} from './helpers'
import { importReviewDialog } from './helpers'
import type { DownloadWindow, ExportedMap, ExportedSystem } from './helpers'
import { RENDER_GEOMETRY_TOLERANCE_PX } from './render-tolerances'

type ImageCaptureWindow = Window & { __ticket28PngBlob?: Blob }
type FailureInjectionWindow = Window & {
  __ticket28OriginalWorkspacePut?: typeof IDBObjectStore.prototype.put
  __ticket28AbortNextWorkspaceWrite?: boolean
  __ticket28OriginalCreateObjectUrl?: typeof URL.createObjectURL
}

type SceneBounds = { x: number; y: number; width: number; height: number }

async function capturePngForPixelChecks(page: import('@playwright/test').Page): Promise<void> {
  await captureMapExportBlobs(page)
  await page.addInitScript(() => {
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob && object.type.startsWith('image/png')) {
        (window as ImageCaptureWindow).__ticket28PngBlob = object
      }
      return createObjectURL(object)
    }
  })
}

function campaignWithUnresolvedExit(): ExportedMap {
  const fixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as ExportedMap
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

function campaignWithExportPreviews(): ExportedMap {
  const fixture = campaignWithUnresolvedExit()
  const system = fixture.cluster?.systems[0]
  if (!system) throw new Error('The export preview fixture is missing its Star System.')

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

function findImportedSystem(exported: ExportedMap, name: string): ExportedSystem {
  const system = exported.cluster?.systems.find(candidate => candidate.name === name)
  if (!system) throw new Error(`The imported campaign is missing the ${name} Star System.`)
  return system
}

async function createImportedCampaign(
  page: import('@playwright/test').Page,
  colorScheme: 'light' | 'dark',
  fixture: ExportedMap = campaignWithUnresolvedExit(),
) {
  await page.setViewportSize({ width: 1440, height: 960 })
  await capturePngForPixelChecks(page)
  await page.emulateMedia({ colorScheme })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'campaign-baseline.json', JSON.stringify(fixture))
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await closeInspector.isVisible()) await closeInspector.click()
  else if (await hideInspector.isVisible()) await hideInspector.click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  return clusterMap
}

async function setPrintChoice(page: import('@playwright/test').Page, enabled: boolean): Promise<void> {
  await setHeaderMapActionsOpen(page, true)
  const printChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
  await expect(printChoice).toBeVisible()
  if (enabled) await printChoice.check()
  else await expect(printChoice).not.toBeChecked()
}

async function inspectFeatureBounds(
  page: import('@playwright/test').Page,
  svgText: string,
  mapKind: 'cluster' | 'system',
): Promise<SceneBounds> {
  return page.evaluate(({ content, kind }) => {
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement as unknown as SVGSVGElement
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(parsed)
    document.body.append(host)
    try {
      const selectors = kind === 'cluster'
        ? ['.cluster-map-items']
        : ['.system-map-items', '.system-orbits']
      const boxes = selectors.flatMap(selector => {
        const group = parsed.querySelector<SVGGElement>(selector)
        if (!group) return []
        const { x, y, width, height } = group.getBBox()
        return [x, y, width, height].every(Number.isFinite) && (width > 0 || height > 0)
          ? [{ x, y, width, height }]
          : []
      })
      if (!boxes.length) throw new Error('The exported scene has no feature bounds.')
      const left = Math.min(...boxes.map(box => box.x))
      const top = Math.min(...boxes.map(box => box.y))
      const right = Math.max(...boxes.map(box => box.x + box.width))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    } finally {
      host.remove()
    }
  }, { content: svgText, kind: mapKind })
}

async function inspectLiveFeatureBounds(
  map: import('@playwright/test').Locator,
  mapKind: 'cluster' | 'system',
): Promise<SceneBounds> {
  return map.evaluate((element, kind) => {
    const source = element.matches('svg') ? element : element.querySelector('svg')
    if (!source) throw new Error('The live map has no SVG element.')
    const clone = source.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll(
      '.system-creation-preview, .orbit-edit-control, .object-hit-target, .orbit-hit-target',
    ).forEach(node => node.remove())
    for (const className of [
      'is-selected',
      'is-dragging',
      'is-move-preview',
      'is-resizing',
      'is-moving',
      'is-rotating',
    ]) {
      clone.querySelectorAll(`.${className}`).forEach(node => node.classList.remove(className))
    }
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(clone)
    document.body.append(host)
    try {
      const content = clone.querySelector('.cluster-map-content, .system-map-content')
    if (!content) throw new Error('The live map has no content group.')
      const selectors = kind === 'cluster'
        ? ['.cluster-map-items']
        : ['.system-map-items', '.system-orbits']
      const boxes = selectors.flatMap(selector => {
        const group = content.querySelector<SVGGElement>(selector)
        if (!group) return []
        const { x, y, width, height } = group.getBBox()
        return [x, y, width, height].every(Number.isFinite) && (width > 0 || height > 0)
          ? [{ x, y, width, height }]
          : []
      })
      if (!boxes.length) throw new Error('The live map has no feature bounds.')
      const left = Math.min(...boxes.map(box => box.x))
      const top = Math.min(...boxes.map(box => box.y))
      const right = Math.max(...boxes.map(box => box.x + box.width))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    } finally {
      host.remove()
    }
  }, mapKind)
}

type SystemSceneGeometry = {
  objects: Array<{ id: string; transform: string | null }>
  orbits: Array<{
    id: string
    cx: string | null
    cy: string | null
    rx: string | null
    ry: string | null
    transform: string | null
  }>
}

type ClusterSceneGeometry = {
  systems: Array<{ id: string; transform: string | null }>
  routes: Array<{
    id: string
    path: string | null
    labelX: string | null
    labelY: string | null
    exitX: string | null
    exitY: string | null
  }>
}

async function inspectLiveSystemGeometry(map: import('@playwright/test').Locator): Promise<SystemSceneGeometry> {
  return map.evaluate(element => {
    const svg = element.matches('svg') ? element : element.querySelector('svg')
    if (!svg) throw new Error('The live System map has no SVG scene.')
    const objects = Array.from(svg.querySelectorAll<SVGGElement>('.system-map-items .system-object[data-object-id]'))
      .map(mark => ({ id: mark.getAttribute('data-object-id')!, transform: mark.getAttribute('transform') }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const orbits = Array.from(svg.querySelectorAll<SVGGElement>('.system-orbits .orbit-mark[data-orbit-id]'))
      .map(mark => {
        const ring = mark.querySelector<SVGEllipseElement>('.orbit-ring')
        if (!ring) throw new Error('A live Orbit is missing its ring.')
        return {
          id: mark.getAttribute('data-orbit-id')!,
          cx: ring.getAttribute('cx'),
          cy: ring.getAttribute('cy'),
          rx: ring.getAttribute('rx'),
          ry: ring.getAttribute('ry'),
          transform: ring.getAttribute('transform'),
        }
      })
      .sort((left, right) => left.id.localeCompare(right.id))
    return { objects, orbits }
  })
}

async function inspectSystemSvgGeometry(
  page: import('@playwright/test').Page,
  svgText: string,
): Promise<SystemSceneGeometry> {
  return page.evaluate(content => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const objects = Array.from(svg.querySelectorAll<SVGGElement>('.system-map-items .system-object[data-object-id]'))
      .map(mark => ({ id: mark.getAttribute('data-object-id')!, transform: mark.getAttribute('transform') }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const orbits = Array.from(svg.querySelectorAll<SVGGElement>('.system-orbits .orbit-mark[data-orbit-id]'))
      .map(mark => {
        const ring = mark.querySelector<SVGEllipseElement>('.orbit-ring')
        if (!ring) throw new Error('An exported Orbit is missing its ring.')
        return {
          id: mark.getAttribute('data-orbit-id')!,
          cx: ring.getAttribute('cx'),
          cy: ring.getAttribute('cy'),
          rx: ring.getAttribute('rx'),
          ry: ring.getAttribute('ry'),
          transform: ring.getAttribute('transform'),
        }
      })
      .sort((left, right) => left.id.localeCompare(right.id))
    return { objects, orbits }
  }, svgText)
}

async function inspectLiveClusterGeometry(map: import('@playwright/test').Locator): Promise<ClusterSceneGeometry> {
  return map.evaluate(element => {
    const svg = element.matches('svg') ? element : element.querySelector('svg')
    if (!svg) throw new Error('The live Cluster map has no SVG scene.')
    const systems = Array.from(svg.querySelectorAll<SVGGElement>('.cluster-map-items .cluster-system-node[data-system-id]'))
      .map(mark => ({ id: mark.getAttribute('data-system-id')!, transform: mark.getAttribute('transform') }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const routes = Array.from(svg.querySelectorAll<SVGGElement>('.cluster-map-items .cluster-route[data-route-id]'))
      .map(mark => ({
        id: mark.getAttribute('data-route-id')!,
        path: mark.querySelector('.cluster-route-line')?.getAttribute('d') ?? null,
        labelX: mark.querySelector('.cluster-route-label')?.getAttribute('x') ?? null,
        labelY: mark.querySelector('.cluster-route-label')?.getAttribute('y') ?? null,
        exitX: mark.querySelector('.cluster-exit-mark')?.getAttribute('cx') ?? null,
        exitY: mark.querySelector('.cluster-exit-mark')?.getAttribute('cy') ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
    return { systems, routes }
  })
}

async function inspectClusterSvgGeometry(
  page: import('@playwright/test').Page,
  svgText: string,
): Promise<ClusterSceneGeometry> {
  return page.evaluate(content => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const systems = Array.from(svg.querySelectorAll<SVGGElement>('.cluster-map-items .cluster-system-node[data-system-id]'))
      .map(mark => ({ id: mark.getAttribute('data-system-id')!, transform: mark.getAttribute('transform') }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const routes = Array.from(svg.querySelectorAll<SVGGElement>('.cluster-map-items .cluster-route[data-route-id]'))
      .map(mark => ({
        id: mark.getAttribute('data-route-id')!,
        path: mark.querySelector('.cluster-route-line')?.getAttribute('d') ?? null,
        labelX: mark.querySelector('.cluster-route-label')?.getAttribute('x') ?? null,
        labelY: mark.querySelector('.cluster-route-label')?.getAttribute('y') ?? null,
        exitX: mark.querySelector('.cluster-exit-mark')?.getAttribute('cx') ?? null,
        exitY: mark.querySelector('.cluster-exit-mark')?.getAttribute('cy') ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
    return { systems, routes }
  }, svgText)
}

async function downloadSvgWhilePointerHeld(
  page: import('@playwright/test').Page,
  buttonName: string,
): Promise<string> {
  const mapFiles = page.getByRole('button', { name: 'Map files', exact: true })
  await expect(mapFiles).toBeVisible()
  if (await mapFiles.getAttribute('aria-expanded') !== 'true') await mapFiles.press('Enter')
  const exportButton = page.getByRole('button', { name: buttonName, exact: true })
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
  if (await mapFiles.getAttribute('aria-expanded') === 'true') await mapFiles.press('Enter')
  return text
}

async function inspectSemanticMarkColors(
  page: import('@playwright/test').Page,
  svgText: string,
): Promise<string[]> {
  return page.evaluate(content => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const fill = (selector: string) => svg.querySelector<SVGElement>(selector)?.style.getPropertyValue('fill') ?? null
    const stroke = (selector: string) => svg.querySelector<SVGElement>(selector)?.style.getPropertyValue('stroke') ?? null
    return [
      fill('.system-object-glyph'),
      fill('.cluster-system-seal'),
      stroke('.cluster-route-line'),
      stroke('.orbit-ring'),
      stroke('.cluster-system-card'),
      stroke('.cluster-exit-mark'),
    ].filter((color): color is string => Boolean(color) && color !== 'none' && color !== 'transparent')
  }, svgText)
}

async function inspectPngTopLeftPixel(page: import('@playwright/test').Page, fill: string): Promise<number[]> {
  return page.evaluate(async expectedFill => {
    const blob = (window as ImageCaptureWindow).__ticket28PngBlob
    if (!blob) throw new Error('The PNG encoder did not expose its actual image blob for pixel inspection.')
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not decode the exported PNG into a Canvas.')
    context.drawImage(bitmap, 0, 0)
    const actual = Array.from(context.getImageData(0, 0, 1, 1).data)
    const expectedCanvas = document.createElement('canvas')
    expectedCanvas.width = 1
    expectedCanvas.height = 1
    const expectedContext = expectedCanvas.getContext('2d')
    if (!expectedContext) throw new Error('Could not read the expected SVG background fill.')
    expectedContext.fillStyle = expectedFill
    expectedContext.fillRect(0, 0, 1, 1)
    const expected = Array.from(expectedContext.getImageData(0, 0, 1, 1).data)
    bitmap.close()
    if (actual.some((channel, index) => channel !== expected[index])) {
      throw new Error(`The PNG top-left pixel ${actual.join(',')} does not match its SVG background ${expected.join(',')}.`)
    }
    return actual
  }, fill)
}

async function inspectDecodedPngPixels(
  page: import('@playwright/test').Page,
): Promise<{ width: number; height: number; sha256: string }> {
  return page.evaluate(async () => {
    const blob = (window as ImageCaptureWindow).__ticket28PngBlob
    if (!blob) throw new Error('The PNG encoder did not expose its actual image blob for pixel hashing.')
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Could not read the decoded PNG pixels.')
      context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
      const pixelBytes = new Uint8Array(pixels.length)
      pixelBytes.set(pixels)
      const digest = await crypto.subtle.digest('SHA-256', pixelBytes)
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      return { width: bitmap.width, height: bitmap.height, sha256 }
    } finally {
      bitmap.close()
    }
  })
}

async function expectFeatureBoundsInsideViewBox(
  page: import('@playwright/test').Page,
  svgText: string,
  viewBox: [number, number, number, number],
  mapKind: 'cluster' | 'system',
  expectedLiveBounds: SceneBounds,
): Promise<void> {
  const bounds = await inspectFeatureBounds(page, svgText, mapKind)
  for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(bounds[coordinate] - expectedLiveBounds[coordinate]))
      .toBeLessThanOrEqual(RENDER_GEOMETRY_TOLERANCE_PX)
  }
  expect(bounds.width).toBeGreaterThan(0)
  expect(bounds.height).toBeGreaterThan(0)
  expect(bounds.x).toBeGreaterThanOrEqual(viewBox[0])
  expect(bounds.y).toBeGreaterThanOrEqual(viewBox[1])
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewBox[0] + viewBox[2])
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewBox[1] + viewBox[3])
}

async function expectExportedFeatureBoundsInsideViewBox(
  page: import('@playwright/test').Page,
  svgText: string,
  viewBox: [number, number, number, number],
  mapKind: 'cluster' | 'system',
): Promise<void> {
  const bounds = await inspectFeatureBounds(page, svgText, mapKind)
  expect(bounds.width).toBeGreaterThan(0)
  expect(bounds.height).toBeGreaterThan(0)
  expect(bounds.x).toBeGreaterThanOrEqual(viewBox[0])
  expect(bounds.y).toBeGreaterThanOrEqual(viewBox[1])
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewBox[0] + viewBox[2])
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewBox[1] + viewBox[3])
}

async function expectCleanExport(page: import('@playwright/test').Page, svgText: string): Promise<void> {
  const transientCount = await page.evaluate(content => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml')
    return svg.querySelectorAll(
      '.system-creation-preview, .orbit-edit-control, .object-hit-target, .orbit-hit-target, '
      + '.orbit-axis-handle, .orbit-center-handle, .orbit-rotation-handle, '
      + '.is-selected, .is-dragging, .is-move-preview, .is-resizing, .is-moving, .is-rotating',
    ).length
  }, svgText)
  expect(transientCount).toBe(0)
}

const paletteCases = [
  { label: 'active-light', colorScheme: 'light', printLight: false },
  { label: 'active-dark', colorScheme: 'dark', printLight: false },
  { label: 'print-from-dark', colorScheme: 'dark', printLight: true },
] as const

const mapCases = [
  { label: 'cluster', kind: 'cluster' },
  { label: 'system', kind: 'system' },
] as const

test('print-light image export preserves the live dark workspace and hidden chart-name draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const theme = page.getByRole('group', { name: 'Theme' })
  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(theme.getByText('Dark', { exact: true })).toBeVisible()
  await expect(systemMap).toBeVisible()

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Edit chart names' }).click()
  const chartDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartDialog.getByLabel('Star system').fill('Unapplied Vesper')
  await page.keyboard.press('Escape')
  await expect(chartDialog).toBeHidden()
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' })
  await expect(resumeDraft).toBeVisible()

  const appliedBefore = await downloadJson(page, 'Export star system JSON')
  expect(appliedBefore.system?.name).toBe('Vesper')

  await page.getByRole('button', { name: 'Map files', exact: true }).click()
  const printLight = page.getByRole('checkbox', { name: /^Light for printing$/i })
  await expect(printLight).toBeVisible({ timeout: 5_000 })
  await printLight.check()

  const svg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!svg.text) throw new Error('The star system SVG download is empty.')
  const svgInfo = await inspectImageSvg(page, svg.text)
  expect(svgInfo.backgroundFill).toBe('rgb(245, 244, 238)')
  expect(svgInfo.glyphFill).toBe('rgb(38, 48, 44)')
  expect(svgInfo.texts).toContain('Primary Star')
  expect(svgInfo.viewBox[2]).toBeGreaterThan(0)
  expect(svgInfo.viewBox[3]).toBeGreaterThan(0)
  expect(svgInfo.systemTitle?.text).toBe('Vesper')

  await setHeaderMapActionsOpen(page, true)
  await expect(printLight).not.toBeChecked()
  await printLight.check()
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBe(svgInfo.width)
  expect(png.height).toBe(svgInfo.height)
  if (!png.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  const pngInfo = await inspectImageSvg(page, png.sourceSvgText)
  expect(pngInfo.viewBox).toEqual(svgInfo.viewBox)
  expect(pngInfo.texts).toEqual(svgInfo.texts)
  expect(pngInfo.systemTitle).toEqual(svgInfo.systemTitle)
  expect(pngInfo.backgroundFill).toBe(svgInfo.backgroundFill)
  expect(pngInfo.glyphFill).toBe(svgInfo.glyphFill)
  await setHeaderMapActionsOpen(page, true)
  await expect(printLight).not.toBeChecked()

  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await expect(theme.getByText('Dark', { exact: true })).toBeVisible()
  await waitForWorkspaceSaved(page)
  const appliedAfter = await downloadJson(page, 'Export star system JSON')
  expect(appliedAfter).toEqual(appliedBefore)
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartDialog.getByLabel('Star system')).toHaveValue('Unapplied Vesper')
})

function relativeLuminance(color: string): number {
  const channels = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!channels) throw new Error(`Expected an opaque RGB color, received "${color}".`)
  const red = Number(channels[1]) / 255
  const green = Number(channels[2]) / 255
  const blue = Number(channels[3]) / 255
  const linearize = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
}

function expectReadablePalette(
  info: Awaited<ReturnType<typeof inspectImageSvg>>,
  semanticMarkColors: string[],
): void {
  if (!info.backgroundFill) throw new Error('The exported map is missing its background fill.')
  expect(info.textFills.length).toBeGreaterThan(0)
  expect(semanticMarkColors.length).toBeGreaterThan(0)
  const background = relativeLuminance(info.backgroundFill)
  for (const fill of info.textFills) {
    const foreground = relativeLuminance(fill)
    expect((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05))
      .toBeGreaterThanOrEqual(4.5)
  }
  for (const fill of semanticMarkColors) {
    const foreground = relativeLuminance(fill)
    expect((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05))
      .toBeGreaterThanOrEqual(3)
  }
}

async function expectMapFilesControlsUsable(
  page: import('@playwright/test').Page,
  mapKind: 'cluster' | 'system',
): Promise<void> {
  const printChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
  const mapFilesGroup = page.locator('.workspace-map-print-light')
  await expect(mapFilesGroup).toContainText(/Light for printing/i)
  const svgButton = page.getByRole('button', {
    name: mapKind === 'cluster' ? 'Export Jump Cluster SVG' : 'Export star system SVG', exact: true,
  })
  const pngButton = page.getByRole('button', {
    name: mapKind === 'cluster' ? 'Export Jump Cluster PNG' : 'Export star system PNG', exact: true,
  })
  for (const control of [printChoice, svgButton, pngButton]) {
    await expect(control).toBeVisible()
    await expect(control).toBeEnabled()
    const receivesPointer = await control.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return hit === element || element.contains(hit)
    })
    expect(receivesPointer).toBe(true)
    await control.focus()
    await expect(control).toBeFocused()
  }
}

for (const mapCase of mapCases) {
  for (const paletteCase of paletteCases) {
    test(`${mapCase.label} SVG and PNG exports preserve applied content in ${paletteCase.label}`, async ({ page }) => {
      const clusterMap = await createImportedCampaign(page, paletteCase.colorScheme)
      let map: import('@playwright/test').Locator = clusterMap
      let expectedTitle: string | null = null
      if (mapCase.kind === 'system') {
        await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
        await setWorkspaceMapMode(page, 'Navigate')
        await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
        expectedTitle = 'Vesper Prime — Outer Circumstellar Survey and Transit Observatory'
        const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
        if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
        await page.getByRole('button', { name: 'Chart details', exact: true }).click()
        const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
        await inspector.getByRole('button', { name: 'Edit chart names', exact: true }).click()
        const names = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
        await names.getByLabel('Star system', { exact: true }).fill(expectedTitle)
        await names.getByRole('button', { name: 'Apply names', exact: true }).click()
        map = page.getByRole('group', { name: `${expectedTitle} star system map`, exact: true })
        await expect(map).toBeVisible()
      }

      const liveBounds = await inspectLiveFeatureBounds(map, mapCase.kind)
      const routeSelection = mapCase.kind === 'cluster'
        ? map.getByRole('button', { name: /Jump Level 12.*Uncharted exit/ })
        : null
      const selectedObject = mapCase.kind === 'system'
        ? map.getByRole('button', { name: /^Select PL-01, Iria \(Planet\)$/ })
        : null

      if (routeSelection) {
        await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
        await setWorkspaceMapMode(page, 'Select')
        await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })
          .getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
        const routeLabel = routeSelection.locator('.cluster-route-label')
        await routeLabel.click()
        await expect(routeSelection).toHaveClass(/is-selected/)
        await routeSelection.focus()
        await routeLabel.hover()
        const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
        const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
        if (await closeInspector.isVisible()) await closeInspector.click()
        else if (await hideInspector.isVisible()) await hideInspector.click()
        await expect(routeSelection).toHaveClass(/is-selected/)
      } else if (selectedObject) {
        const hierarchy = await openWorkspaceHierarchy(page)
        await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
        await expect(selectedObject).toHaveClass(/is-selected/)
        const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
        if (await closeHierarchy.isVisible()) await closeHierarchy.click()
        const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
        if (await hideInspector.isVisible()) await hideInspector.click()
        await expect(selectedObject).toHaveClass(/is-selected/)
        await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
        await setWorkspaceMapMode(page, 'Move')
        const moveMode = page.getByRole('toolbar', { name: 'Workspace navigation' })
          .getByRole('button', { name: 'Move', exact: true })
        await expect(moveMode).toHaveAttribute('aria-pressed', 'true')
        const resizeHandle = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star', exact: true })
        await expect(resizeHandle).toBeVisible()
        await resizeHandle.focus()
        await expect(resizeHandle).toBeFocused()
        await selectedObject.hover()
      }

      const zoomControls = workspaceZoomControls(page)
      await zoomControls.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await panMap(page, map, { x: mapCase.kind === 'cluster' ? 1000 : 760, y: 300 })
      const cameraTransform = await map.locator(
        mapCase.kind === 'cluster' ? '.cluster-map-content' : '.system-map-content',
      ).getAttribute('transform')
      expect(cameraTransform).not.toBe('translate(0,0) scale(1)')

      const compactViewport = (mapCase.kind === 'system' && paletteCase.label === 'print-from-dark')
        ? { width: 390, height: 500 }
        : (mapCase.kind === 'cluster' && paletteCase.label === 'active-light')
          ? { width: 844, height: 390 }
          : null
      if (compactViewport) {
        await page.setViewportSize(compactViewport)
        await expect(map).toBeVisible()
        await setHeaderMapActionsOpen(page, true)
        const compactPrintChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
        if (paletteCase.printLight) await compactPrintChoice.check()
        await expectMapFilesControlsUsable(page, mapCase.kind)
        await page.screenshot({ path: test.info().outputPath(`${mapCase.label}-${paletteCase.label}-map-files.png`) })
      }

      const exportCameraTransform = await map.locator(
        mapCase.kind === 'cluster' ? '.cluster-map-content' : '.system-map-content',
      ).getAttribute('transform')
      expect(exportCameraTransform).not.toBe('translate(0,0) scale(1)')

      const jsonButton = mapCase.kind === 'cluster' ? 'Export Jump Cluster JSON' : 'Export star system JSON'
      const appliedBefore = await downloadJson(page, jsonButton)
      if (mapCase.kind === 'system') {
        expect(appliedBefore.system?.name).toBe(expectedTitle)
        expect(appliedBefore.cluster).toBeUndefined()
      } else {
        expect(appliedBefore.cluster?.routes).toContainEqual(expect.objectContaining({
          jumpLevel: 12,
          toPointId: null,
          unresolvedExit: 'Uncharted exit',
        }))
      }

      const liveBackground = await map.evaluate(element => {
        const surface = element.querySelector('.cluster-map-background, .map-background')
        if (!surface) throw new Error('The live map has no background surface.')
        return getComputedStyle(surface).fill
      })
      const printLight = paletteCase.printLight
      await setPrintChoice(page, printLight)
      const svg = await downloadImage(page,
        mapCase.kind === 'cluster' ? 'Export Jump Cluster SVG' : 'Export star system SVG', 'image/svg+xml')
      if (!svg.text) throw new Error('The SVG export is empty.')
      const svgInfo = await inspectImageSvg(page, svg.text)
      const semanticMarkColors = await inspectSemanticMarkColors(page, svg.text)
      expect(svgInfo.contentTransform).toBeNull()
      expect(svgInfo.backgroundFill).toBeTruthy()
      expect(svgInfo.viewBox[2]).toBeGreaterThan(0)
      expect(svgInfo.viewBox[3]).toBeGreaterThan(0)
      expectReadablePalette(svgInfo, semanticMarkColors)
      await expectFeatureBoundsInsideViewBox(page, svg.text, svgInfo.viewBox, mapCase.kind, liveBounds)
      await expectCleanExport(page, svg.text)
      if (printLight) expect(svgInfo.backgroundFill).not.toBe(liveBackground)
      else expect(svgInfo.backgroundFill).toBe(liveBackground)

      if (mapCase.kind === 'cluster') {
        expect(svgInfo.systemTitle).toBeNull()
        expect(svgInfo.texts).toContain('Unknown: Uncharted exit')
        expect(svgInfo.texts).toContain('Jump-12')
      } else {
        expect(svgInfo.systemTitle?.text).toBe(expectedTitle)
        expect(svgInfo.systemTitle!.x + svgInfo.systemTitle!.width)
          .toBeLessThanOrEqual(svgInfo.viewBox[0] + svgInfo.viewBox[2] - 24)
        expect(svgInfo.texts).toContain('Iria')
        expect(svgInfo.texts).toContain('Nix')
      }

      await setHeaderMapActionsOpen(page, true)
      const printChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
      await expect(printChoice).not.toBeChecked()
      if (printLight) await printChoice.check()
      const png = await downloadImage(page,
        mapCase.kind === 'cluster' ? 'Export Jump Cluster PNG' : 'Export star system PNG', 'image/png')
      expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      expect(png.width).toBe(svgInfo.width)
      expect(png.height).toBe(svgInfo.height)
      if (!png.sourceSvgText) throw new Error('The PNG rasterizer did not retain its serialized SVG source.')
      const pngInfo = await inspectImageSvg(page, png.sourceSvgText)
      expect(pngInfo.viewBox).toEqual(svgInfo.viewBox)
      expect(pngInfo.width).toBe(png.width)
      expect(pngInfo.height).toBe(png.height)
      expect(pngInfo.texts).toEqual(svgInfo.texts)
      expect(pngInfo.systemTitle).toEqual(svgInfo.systemTitle)
      expect(pngInfo.backgroundFill).toBe(svgInfo.backgroundFill)
      expect(pngInfo.glyphFill).toBe(svgInfo.glyphFill)
      await expectCleanExport(page, png.sourceSvgText)
      const topLeftPixel = await inspectPngTopLeftPixel(page, svgInfo.backgroundFill!)
      expect(topLeftPixel).toHaveLength(4)
      expect(topLeftPixel[3]).toBe(255)

      await setHeaderMapActionsOpen(page, true)
      await expect(printChoice).not.toBeChecked()
      const appliedAfter = await downloadJson(page, jsonButton)
      expect(appliedAfter).toEqual(appliedBefore)
      expect(await map.locator(
        mapCase.kind === 'cluster' ? '.cluster-map-content' : '.system-map-content',
      ).getAttribute('transform')).toBe(exportCameraTransform)
      if (paletteCase.colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    })
  }
}

test('system image exports retain applied geometry during local and parent-owned previews', async ({ page }) => {
  test.setTimeout(60_000)
  const clusterMap = await createImportedCampaign(page, 'light', campaignWithExportPreviews())
  const importedCampaign = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = findImportedSystem(importedCampaign, 'Vesper Prime')
  const orbitId = importedSystem.orbits.find(orbit => orbit.hostId === null)?.id
  if (!orbitId) throw new Error('The imported campaign is missing its unoccupied Orbit.')
  const transferMoonId = importedSystem.objects.find(object => object.name === 'Transfer Moon')?.id
  const nestedTravelerId = importedSystem.objects.find(object => object.name === 'Nested Traveler')?.id
  const iriaId = importedSystem.objects.find(object => object.name === 'Iria')?.id
  const nixId = importedSystem.objects.find(object => object.name === 'Nix')?.id
  if (!transferMoonId || !nestedTravelerId || !iriaId || !nixId) {
    throw new Error('The imported preview fixture is missing one or more named objects.')
  }
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await expect(map).toBeVisible()
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Move')

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  const closeHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeHierarchy.isVisible()) await closeHierarchy.click()
  const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await hideInspector.isVisible()) await hideInspector.click()

  const vertical = map.locator(`.orbit-axis-handle--vertical[data-orbit-id="${orbitId}"]`)
  const ring = map.locator(`.orbit-mark[data-orbit-id="${orbitId}"] .orbit-ring`)
  await expect(vertical).toBeVisible()
  const appliedBeforeResize = await inspectLiveSystemGeometry(map)
  const appliedRing = appliedBeforeResize.orbits.find(orbit => orbit.id === orbitId)
  if (!appliedRing) throw new Error('The applied scene is missing its selected Orbit.')
  const appliedSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!appliedSvg.text) throw new Error('The applied system SVG before Orbit resize is empty.')
  const appliedSvgInfo = await inspectImageSvg(page, appliedSvg.text)
  const scene = map.locator('.system-map-content')
  const cameraBeforeResize = await scene.getAttribute('transform')
  const handleBounds = await vertical.boundingBox()
  if (!handleBounds) throw new Error('The selected Orbit resize handle has no visible bounds.')
  const handleX = handleBounds.x + handleBounds.width / 2
  const handleY = handleBounds.y + handleBounds.height / 2
  const handleReceivesPointer = await page.evaluate(({ x, y, selectedOrbitId }) => {
    const target = document.elementFromPoint(x, y)
    return target?.closest('.orbit-axis-handle--vertical')?.getAttribute('data-orbit-id') === selectedOrbitId
  }, { x: handleX, y: handleY, selectedOrbitId: orbitId })
  expect(handleReceivesPointer).toBe(true)
  await page.mouse.move(handleX, handleY)
  await page.mouse.down()
  await page.mouse.move(handleX + 14, handleY - 38, { steps: 4 })
  await expect(vertical).toHaveClass(/is-resizing/)
  await expect.poll(async () => ring.getAttribute('ry')).not.toBe(appliedRing.ry)
  const liveResizePreview = await inspectLiveSystemGeometry(map)
  expect(liveResizePreview).not.toEqual(appliedBeforeResize)

  const localResizeSvg = await downloadSvgWhilePointerHeld(page, 'Export star system SVG')
  const localResizeSvgInfo = await inspectImageSvg(page, localResizeSvg)
  expect(localResizeSvgInfo.viewBox).toEqual(appliedSvgInfo.viewBox)
  expect(await inspectSystemSvgGeometry(page, localResizeSvg)).toEqual(appliedBeforeResize)
  await expect(vertical).toHaveClass(/is-resizing/)
  expect(await inspectLiveSystemGeometry(map)).toEqual(liveResizePreview)
  expect(await scene.getAttribute('transform')).toBe(cameraBeforeResize)
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.mouse.up()
  await waitForWorkspaceSaved(page)

  const appliedBeforeObjectPreview = await inspectLiveSystemGeometry(map)
  const appliedBeforeObjectSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!appliedBeforeObjectSvg.text) throw new Error('The applied system SVG before object placement preview is empty.')
  const appliedBeforeObjectSvgInfo = await inspectImageSvg(page, appliedBeforeObjectSvg.text)
  const objectHierarchy = await openWorkspaceHierarchy(page)
  await objectHierarchy.getByRole('button', { name: /^Select PL-01, Iria$/ }).click()
  const closeObjectHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeObjectHierarchy.isVisible()) await closeObjectHierarchy.click()
  const hideObjectInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await hideObjectInspector.isVisible()) await hideObjectInspector.click()
  const placement = workspaceNavigation(page).getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(page.getByRole('spinbutton', { name: 'Orbit position (degrees)', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()
  await page.keyboard.press('ArrowRight')
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  const objectPreview = await inspectLiveSystemGeometry(map)
  const appliedIria = appliedBeforeObjectPreview.objects.find(object => object.id === iriaId)
  const previewIria = objectPreview.objects.find(object => object.id === iriaId)
  const appliedNix = appliedBeforeObjectPreview.objects.find(object => object.id === nixId)
  const previewNix = objectPreview.objects.find(object => object.id === nixId)
  expect(previewIria?.transform).not.toBe(appliedIria?.transform)
  expect(previewNix?.transform).not.toBe(appliedNix?.transform)

  const objectPreviewSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!objectPreviewSvg.text) throw new Error('The parent-owned object preview export is empty.')
  const objectPreviewSvgInfo = await inspectImageSvg(page, objectPreviewSvg.text)
  expect(objectPreviewSvgInfo.viewBox).toEqual(appliedBeforeObjectSvgInfo.viewBox)
  expect(await inspectSystemSvgGeometry(page, objectPreviewSvg.text)).toEqual(appliedBeforeObjectPreview)
  expect(await inspectLiveSystemGeometry(map)).toEqual(objectPreview)
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  expect(await inspectLiveSystemGeometry(map)).toEqual(objectPreview)
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  expect(await inspectLiveSystemGeometry(map)).toEqual(appliedBeforeObjectPreview)
  if (await placement.getAttribute('aria-expanded') === 'true') await placement.click()

  const orbitHierarchy = await openWorkspaceHierarchy(page)
  await orbitHierarchy.getByRole('button', { name: 'Orbit 1 around unoccupied center, 1 object', exact: true }).click()
  const orbitInspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  const orbitAppliedGeometry = await inspectLiveSystemGeometry(map)
  const orbitAppliedSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!orbitAppliedSvg.text) throw new Error('The applied system SVG before Orbit preview is empty.')
  const orbitAppliedSvgInfo = await inspectImageSvg(page, orbitAppliedSvg.text)
  await expectExportedFeatureBoundsInsideViewBox(
    page, orbitAppliedSvg.text, orbitAppliedSvgInfo.viewBox, 'system',
  )
  const orbitAppliedPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  const orbitAppliedPixelHash = await inspectDecodedPngPixels(page)
  expect(orbitAppliedPixelHash.width).toBe(orbitAppliedPng.width)
  expect(orbitAppliedPixelHash.height).toBe(orbitAppliedPng.height)
  expect(orbitAppliedPng.width).toBe(orbitAppliedSvgInfo.width)
  expect(orbitAppliedPng.height).toBe(orbitAppliedSvgInfo.height)
  await orbitInspector.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  const host = orbitInspector.getByLabel('Host', { exact: true })
  await selectInspectorOption(host, 'A, Primary Star (Star)')
  await orbitInspector.getByLabel('Horizontal radius', { exact: true }).fill('220')
  await orbitInspector.getByLabel('Vertical radius', { exact: true }).fill('180')
  await orbitInspector.getByRole('button', { name: 'Preview placement', exact: true }).click()
  await expect(orbitInspector.getByRole('status').filter({ hasText: /Preview ready/i })).toBeVisible()
  const orbitPreview = await inspectLiveSystemGeometry(map)
  expect(orbitPreview).not.toEqual(orbitAppliedGeometry)
  expect(orbitPreview.objects.find(object => object.id === transferMoonId)?.transform)
    .not.toBe(orbitAppliedGeometry.objects.find(object => object.id === transferMoonId)?.transform)
  expect(orbitPreview.objects.find(object => object.id === nestedTravelerId)?.transform)
    .not.toBe(orbitAppliedGeometry.objects.find(object => object.id === nestedTravelerId)?.transform)

  const orbitPreviewSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  if (!orbitPreviewSvg.text) throw new Error('The parent-owned Orbit preview export is empty.')
  const orbitPreviewSvgInfo = await inspectImageSvg(page, orbitPreviewSvg.text)
  expect(orbitPreviewSvgInfo.viewBox).toEqual(orbitAppliedSvgInfo.viewBox)
  expect(await inspectSystemSvgGeometry(page, orbitPreviewSvg.text)).toEqual(orbitAppliedGeometry)
  expect(await inspectLiveSystemGeometry(map)).toEqual(orbitPreview)
  await expect(orbitInspector.getByRole('status').filter({ hasText: /Preview ready/i })).toBeVisible()
  await expect(map.locator(`.orbit-mark[data-orbit-id="${orbitId}"]`)).toHaveClass(/is-selected/)
  const orbitPreviewPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  const orbitPreviewPixelHash = await inspectDecodedPngPixels(page)
  expect(orbitPreviewPixelHash).toEqual(orbitAppliedPixelHash)
  expect(orbitPreviewPng.width).toBe(orbitAppliedPng.width)
  expect(orbitPreviewPng.height).toBe(orbitAppliedPng.height)
  if (!orbitPreviewPng.sourceSvgText) throw new Error('The Orbit preview PNG has no source SVG.')
  const orbitPreviewPngInfo = await inspectImageSvg(page, orbitPreviewPng.sourceSvgText)
  expect(orbitPreviewPngInfo.viewBox).toEqual(orbitAppliedSvgInfo.viewBox)
  expect(orbitPreviewPngInfo.width).toBe(orbitPreviewPng.width)
  expect(orbitPreviewPngInfo.height).toBe(orbitPreviewPng.height)
  expect(await inspectSystemSvgGeometry(page, orbitPreviewPng.sourceSvgText)).toEqual(orbitAppliedGeometry)
  await expectExportedFeatureBoundsInsideViewBox(
    page, orbitPreviewPng.sourceSvgText, orbitPreviewPngInfo.viewBox, 'system',
  )
})

test('cluster image export keeps applied routes and unresolved exits during a held system drag', async ({ page }) => {
  const map = await createImportedCampaign(page, 'light')
  const importedCampaign = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystemId = findImportedSystem(importedCampaign, 'Vesper Prime').id
  const unresolvedRouteId = importedCampaign.cluster?.routes.find(route => route.unresolvedExit === 'Uncharted exit')?.id
  if (!unresolvedRouteId) throw new Error('The imported campaign is missing the unresolved exit.')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Select')
  const unresolvedRoute = map.locator(`.cluster-route[data-route-id="${unresolvedRouteId}"]`)
  await unresolvedRoute.locator('.cluster-route-label').click()
  await expect(unresolvedRoute).toHaveClass(/is-selected/)
  const closeInspector = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await closeInspector.isVisible()) await closeInspector.click()
  else if (await hideInspector.isVisible()) await hideInspector.click()
  await setWorkspaceMapMode(page, 'Move')

  const appliedGeometry = await inspectLiveClusterGeometry(map)
  const appliedRoutes = appliedGeometry.routes
  const appliedSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  if (!appliedSvg.text) throw new Error('The applied Cluster SVG before system drag is empty.')
  const appliedSvgInfo = await inspectImageSvg(page, appliedSvg.text)
  const source = map.locator(`.cluster-system-node[data-system-id="${importedSystemId}"]`)
  const sourceBounds = await source.boundingBox()
  if (!sourceBounds) throw new Error('The Cluster-system mark has no visible bounds.')
  const cameraBeforeDrag = await map.locator('.cluster-map-content').getAttribute('transform')
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2 + 76, sourceBounds.y + sourceBounds.height / 2 + 54, { steps: 4 })
  await expect(source).toHaveClass(/is-dragging/)
  const liveDragGeometry = await inspectLiveClusterGeometry(map)
  expect(liveDragGeometry).not.toEqual(appliedGeometry)
  expect(liveDragGeometry.routes).not.toEqual(appliedRoutes)

  const svgText = await downloadSvgWhilePointerHeld(page, 'Export Jump Cluster SVG')
  const dragSvgInfo = await inspectImageSvg(page, svgText)
  expect(dragSvgInfo.viewBox).toEqual(appliedSvgInfo.viewBox)
  expect(await inspectClusterSvgGeometry(page, svgText)).toEqual(appliedGeometry)
  const svgInfo = await inspectImageSvg(page, svgText)
  expect(svgInfo.texts).toContain('Unknown: Uncharted exit')
  expect(svgInfo.texts).toContain('Jump-12')
  await expect(source).toHaveClass(/is-dragging/)
  await expect(unresolvedRoute).toHaveClass(/is-selected/)
  expect(await inspectLiveClusterGeometry(map)).toEqual(liveDragGeometry)
  expect(await map.locator('.cluster-map-content').getAttribute('transform')).toBe(cameraBeforeDrag)
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.mouse.up()
})

test('failed saves preserve the latest applied image and separate PNG export errors', async ({ page }) => {
  test.setTimeout(60_000)
  const clusterMap = await createImportedCampaign(page, 'light')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
  await expect(map).toBeVisible()
  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector', exact: true })
  await inspector.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const chartNames = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  const expectedTitle = 'Vesper Prime Applied Despite Save Failure'
  await chartNames.getByLabel('Star system', { exact: true }).fill(expectedTitle)

  await page.evaluate(() => {
    const tracked = window as FailureInjectionWindow
    const storePrototype = IDBObjectStore.prototype
    const originalPut = storePrototype.put
    tracked.__ticket28OriginalWorkspacePut = originalPut
    tracked.__ticket28AbortNextWorkspaceWrite = true
    storePrototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = originalPut.call(this, value, key)
      const isCurrentWorkspaceWrite = this.transaction.db.name === 'ttrpg-cluster-control'
        && this.transaction.mode === 'readwrite'
        && this.name === 'workspace'
        && key === 'current'
      if (isCurrentWorkspaceWrite && tracked.__ticket28AbortNextWorkspaceWrite) {
        tracked.__ticket28AbortNextWorkspaceWrite = false
        this.transaction.abort()
      }
      return request
    }
  })

  try {
    await chartNames.getByRole('button', { name: 'Apply names', exact: true }).click()
    await expect(chartNames).toBeHidden()
    const feedback = activeWorkspaceFeedback(page)
    await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')
    await expect(feedback.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
    await page.evaluate(() => {
      const tracked = window as FailureInjectionWindow
      if (!tracked.__ticket28OriginalWorkspacePut) throw new Error('The save-failure hook was not installed.')
      IDBObjectStore.prototype.put = tracked.__ticket28OriginalWorkspacePut
      delete tracked.__ticket28OriginalWorkspacePut
      delete tracked.__ticket28AbortNextWorkspaceWrite
    })

    const appliedBefore = await downloadJson(page, 'Export star system JSON')
    expect(appliedBefore.system?.name).toBe(expectedTitle)
    const latestSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
    if (!latestSvg.text) throw new Error('The latest applied system SVG is empty.')
    expect((await inspectImageSvg(page, latestSvg.text)).systemTitle?.text).toBe(expectedTitle)
    expect(await downloadJson(page, 'Export star system JSON')).toEqual(appliedBefore)
    await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')

    await page.evaluate(() => {
      const tracked = window as FailureInjectionWindow
      tracked.__ticket28OriginalCreateObjectUrl = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (object) => {
        if (object instanceof Blob && object.type.startsWith('image/png')) {
          throw new Error('Synthetic PNG failure.')
        }
        return tracked.__ticket28OriginalCreateObjectUrl!(object)
      }
    })
    try {
      await setHeaderMapActionsOpen(page, true)
      await page.getByRole('button', { name: 'Export star system PNG', exact: true }).click()
      const recoveryDetailsButton = feedback.getByRole('button', { name: 'Recovery details', exact: true })
      await recoveryDetailsButton.click()
      const recoveryDetails = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
      await expect(recoveryDetails.getByRole('alert').filter({ hasText: 'Export failed: Synthetic PNG failure.' }))
        .toBeVisible()
      await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')
      await expect(feedback.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
      await page.evaluate(() => {
        const blobs = (window as DownloadWindow).__mapExportBlobs
        const intermediateSvg = blobs?.findIndex(blob => blob.type.startsWith('image/svg+xml')) ?? -1
        if (intermediateSvg < 0) throw new Error('The failed PNG export did not leave its intermediate SVG Blob.')
        blobs?.splice(intermediateSvg, 1)
      })
      expect(await downloadJson(page, 'Export star system JSON')).toEqual(appliedBefore)
      const appliedMap = page.getByRole('group', { name: `${expectedTitle} star system map`, exact: true })
      await expect(appliedMap).toBeVisible()
    } finally {
      await page.evaluate(() => {
        const tracked = window as FailureInjectionWindow
        if (tracked.__ticket28OriginalCreateObjectUrl) {
          URL.createObjectURL = tracked.__ticket28OriginalCreateObjectUrl
          delete tracked.__ticket28OriginalCreateObjectUrl
        }
      })
    }
  } finally {
    await page.evaluate(() => {
      const tracked = window as FailureInjectionWindow
      if (tracked.__ticket28OriginalWorkspacePut) {
        IDBObjectStore.prototype.put = tracked.__ticket28OriginalWorkspacePut
        delete tracked.__ticket28OriginalWorkspacePut
        delete tracked.__ticket28AbortNextWorkspaceWrite
      }
    })
  }
})
