import { expect, test } from '@playwright/test'

type WorldPoint = { x: number; y: number }
type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }
type ExportedObject = {
  id: string
  name: string
  family: string
  subtype: string
  locationKey: string
  placement: { kind: 'system'; x: number; y: number } | { kind: 'orbit'; orbitId: string }
  jumpStationId?: string | null
  customFieldValues?: Record<string, string | number | boolean>
}
type ExportedSystem = {
  id: string
  name: string
  objects: ExportedObject[]
  orbits: Array<{ id: string; hostId: string; order: number }>
}
type ExportedRoute = {
  id: string
  name: string
  fromPointId: string
  toPointId: string | null
  unresolvedExit?: string
}
type ExportedMap = {
  format: string
  version: number
  type: 'cluster' | 'system'
  cluster?: { id: string; name: string; systems: ExportedSystem[]; routes: ExportedRoute[] }
  system?: ExportedSystem
  objectFieldSettings: {
    customFields: Array<{ id: string; name: string; type: string; options?: string[] }>
  }
  layout: {
    version: number
    systemPositions?: Record<string, WorldPoint>
    orbitRadii: Record<string, number>
    objectAngles: Record<string, number>
  }
}

async function dragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  await beginDragToWorldPoint(page, map, source, point)
  await page.mouse.up()
}

async function beginDragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('Could not find the map element to drag.')

  const destination = await map.evaluate((element, target) => {
    const transform = (element as SVGSVGElement).getScreenCTM()
    if (!transform) throw new Error('The map SVG is not attached to the document.')
    const screenPoint = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screenPoint.x, y: screenPoint.y }
  }, point)

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 6 })
}

async function dragHtmlElementToWorldPoint(
  page: import('@playwright/test').Page,
  source: import('@playwright/test').Locator,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  await source.scrollIntoViewIfNeeded()
  await map.scrollIntoViewIfNeeded()
  const sourceBounds = await source.boundingBox()
  const bounds = await map.boundingBox()
  if (!sourceBounds || !bounds) throw new Error('Could not find the map or palette object to drag.')

  const destination = await map.evaluate((element, target) => {
    const transform = (element as SVGSVGElement).getScreenCTM()
    if (!transform) throw new Error('The map SVG is not attached to the document.')
    const screenPoint = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screenPoint.x - target.boundsX, y: screenPoint.y - target.boundsY }
  }, { x: point.x, y: point.y, boundsX: bounds.x, boundsY: bounds.y })
  await page.mouse.move(
    sourceBounds.x + sourceBounds.width / 2,
    sourceBounds.y + sourceBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(bounds.x + destination.x, bounds.y + destination.y, { steps: 12 })
  await page.mouse.up()
}

async function dragOrbitToWorldPoint(
  page: import('@playwright/test').Page,
  orbit: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  await orbit.scrollIntoViewIfNeeded()
  const coordinates = await orbit.evaluate((element, target) => {
    const circle = element as SVGCircleElement
    const matrix = circle.getScreenCTM()
    if (!matrix) throw new Error('The Orbit is not attached to the map.')
    const start = new DOMPoint(
      Number(circle.getAttribute('cx')) + Number(circle.getAttribute('r')),
      Number(circle.getAttribute('cy')),
    ).matrixTransform(matrix)
    const end = new DOMPoint(target.x, target.y).matrixTransform(matrix)
    return {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    }
  }, point)

  await page.mouse.move(coordinates.start.x, coordinates.start.y)
  await page.mouse.down()
  await page.mouse.move(coordinates.end.x, coordinates.end.y, { steps: 6 })
  await page.mouse.up()
}

async function panMap(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  delta: WorldPoint,
): Promise<void> {
  await map.scrollIntoViewIfNeeded()
  const start = await map.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + 12, y: bounds.bottom - 12 }
  })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 })
  await page.mouse.up()
}

async function dragBy(
  page: import('@playwright/test').Page,
  source: import('@playwright/test').Locator,
  delta: WorldPoint,
): Promise<void> {
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('Could not find the map element to drag.')

  const x = sourceBox.x + sourceBox.width / 2
  const y = sourceBox.y + sourceBox.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + delta.x, y + delta.y, { steps: 6 })
  await page.mouse.up()
}

async function orbitalAngle(map: import('@playwright/test').Locator): Promise<number> {
  return map.evaluate((element) => {
    const objects = [...element.querySelectorAll<SVGGElement>('.system-object')]
    const host = objects.find(object => object.getAttribute('aria-label')?.includes('Primary Star'))
    const planet = objects.find(object => object.getAttribute('aria-label')?.includes('Iria'))
    if (!host || !planet) throw new Error('Could not locate the star and orbiting object.')

    const center = (object: SVGGElement) => {
      const transform = object.getScreenCTM()
      if (!transform) throw new Error('An orbital object is not attached to the map.')
      return new DOMPoint(0, 0).matrixTransform(transform)
    }
    const hostCenter = center(host)
    const planetCenter = center(planet)
    return Math.atan2(
      planetCenter.y - hostCenter.y,
      planetCenter.x - hostCenter.x,
    )
  })
}

async function downloadJson(page: import('@playwright/test').Page, buttonName: string): Promise<ExportedMap> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: buttonName }).click()
  await downloadPromise
  const json = await page.evaluate(async () => {
    const blob = (window as DownloadWindow).__mapExportBlobs?.shift()
    if (!blob) throw new Error('Could not read the downloaded JSON file.')
    return blob.text()
  })
  return JSON.parse(json) as ExportedMap
}

type DownloadedImage = {
  type: string
  size: number
  text?: string
  width?: number
  height?: number
  signature?: number[]
}

async function downloadImage(
  page: import('@playwright/test').Page,
  buttonName: string,
  mimeType: 'image/svg+xml' | 'image/png',
): Promise<DownloadedImage> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: buttonName }).click()
  await downloadPromise
  return page.evaluate(async (expectedType) => {
    const blobs = (window as DownloadWindow).__mapExportBlobs ?? []
    const index = blobs.findIndex(blob => blob.type.startsWith(expectedType))
    if (index < 0) throw new Error(`Could not read the downloaded ${expectedType} file.`)
    const [blob] = blobs.splice(index, 1)

    if (expectedType === 'image/svg+xml') {
      return { type: blob.type, size: blob.size, text: await blob.text() }
    }

    const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer())
    const dimensions = new DataView(bytes.buffer)
    const intermediateSvg = blobs.findIndex(item => item.type.startsWith('image/svg+xml'))
    if (intermediateSvg >= 0) blobs.splice(intermediateSvg, 1)
    return {
      type: blob.type,
      size: blob.size,
      signature: Array.from(bytes.slice(0, 8)),
      width: dimensions.getUint32(16),
      height: dimensions.getUint32(20),
    }
  }, mimeType)
}

async function inspectImageSvg(
  page: import('@playwright/test').Page,
  text: string,
): Promise<{
  viewBox: number[]
  width: number
  height: number
  contentTransform: string | null
  texts: string[]
  titleStyle: string | null
  backgroundFill: string | null
  glyphFill: string | null
  textFills: string[]
  markColors: string[]
}> {
  return page.evaluate((content) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox')
    if (svg.localName !== 'svg' || !viewBox) throw new Error('The downloaded SVG is invalid.')
    const fill = (selector: string) => svg.querySelector<SVGElement>(selector)?.style.getPropertyValue('fill') ?? null
    const stroke = (selector: string) => svg.querySelector<SVGElement>(selector)?.style.getPropertyValue('stroke') ?? null
    return {
      viewBox: viewBox.split(/\s+/).map(Number),
      width: Number(svg.getAttribute('width')?.replace('px', '')),
      height: Number(svg.getAttribute('height')?.replace('px', '')),
      contentTransform: svg.querySelector('.cluster-map-content, .system-map-content')?.getAttribute('transform') ?? null,
      texts: Array.from(svg.querySelectorAll('text')).map(element => element.textContent?.trim() ?? ''),
      titleStyle: svg.querySelector('.cluster-map-title, .map-title')?.getAttribute('style') ?? null,
      backgroundFill: fill('.cluster-map-background, .map-background'),
      glyphFill: fill('.system-object-glyph'),
      textFills: Array.from(svg.querySelectorAll<SVGElement>('text'), element => element.style.getPropertyValue('fill'))
        .filter(Boolean),
      markColors: [
        fill('.system-object-glyph'),
        fill('.cluster-exit-mark'),
        fill('.cluster-system-seal'),
        stroke('.cluster-route-line'),
        stroke('.orbit-ring'),
        stroke('.cluster-system-card'),
      ].filter((color): color is string => Boolean(color) && color !== 'none' && color !== 'transparent'),
    }
  }, text)
}

function relativeLuminance(color: string): number {
  const channels = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!channels) throw new Error(`Expected an opaque RGB color, received "${color}".`)
  const [red, green, blue] = channels.slice(1).map(channel => Number(channel) / 255)
  const linearize = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function expectReadableExport(info: {
  backgroundFill: string | null
  textFills: string[]
  markColors: string[]
}): void {
  if (!info.backgroundFill) throw new Error('The downloaded map has no background fill.')
  expect(info.textFills.length).toBeGreaterThan(0)
  expect(info.markColors.length).toBeGreaterThan(0)
  for (const fill of info.textFills) {
    expect(contrastRatio(fill, info.backgroundFill)).toBeGreaterThanOrEqual(4.5)
  }
  for (const color of info.markColors) {
    expect(contrastRatio(color, info.backgroundFill)).toBeGreaterThanOrEqual(3)
  }
}

async function inspectExportedSvg(
  page: import('@playwright/test').Page,
  text: string,
): Promise<{ viewBox: number[]; width: number; height: number; text: string }> {
  return page.evaluate((content) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox')
    if (svg.localName !== 'svg' || !viewBox) throw new Error('The downloaded SVG is invalid.')
    return {
      viewBox: viewBox.split(/\s+/).map(Number),
      width: Number(svg.getAttribute('width')),
      height: Number(svg.getAttribute('height')),
      text: svg.textContent ?? '',
    }
  }, text)
}

async function setJsonFile(
  input: import('@playwright/test').Locator,
  name: string,
  content: string,
): Promise<void> {
  await input.evaluate((element, file) => {
    const input = element as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File([file.content], file.name, { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, { name, content })
}

const catalogueSubtypes = [
  'star',
  'planet',
  'moon',
  'asteroid',
  'belt',
  'station',
  'base',
  'colony',
  'vessel',
  'derelict',
  'jump-point',
  'anomaly',
  'nebula',
  'hazard',
  'other',
] as const

const objectPaletteCategoryBySubtype: Record<typeof catalogueSubtypes[number], string> = {
  star: 'Celestial bodies',
  planet: 'Celestial bodies',
  moon: 'Celestial bodies',
  asteroid: 'Small bodies and fields',
  belt: 'Small bodies and fields',
  station: 'Installations',
  base: 'Installations',
  colony: 'Installations',
  vessel: 'Vessels',
  derelict: 'Vessels',
  'jump-point': 'Jump Points',
  anomaly: 'Phenomena',
  nebula: 'Phenomena',
  hazard: 'Phenomena',
  other: 'Other',
}

async function selectCatalogueObjectButton(
  page: import('@playwright/test').Page,
  subtype: typeof catalogueSubtypes[number],
): Promise<import('@playwright/test').Locator> {
  const label = subtype.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const palette = page.getByRole('region', { name: 'Object palette' })
  const category = objectPaletteCategoryBySubtype[subtype]
  await palette.getByRole('group', { name: 'Object categories' })
    .getByRole('button', { name: category, exact: true })
    .click()
  return palette.getByRole('group', { name: category })
    .getByRole('button', { name: `Add ${label}` })
}

async function addCatalogueObject(
  page: import('@playwright/test').Page,
  subtype: typeof catalogueSubtypes[number],
): Promise<void> {
  await (await selectCatalogueObjectButton(page, subtype)).click()
}

test('the dark map-first workspace stays usable at narrow viewport widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const hierarchyPanel = page.getByRole('complementary', { name: 'Jump Cluster contents' })
  const inspectorPanel = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const desktopLayout = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.editor-grid')
    const map = grid?.querySelector<HTMLElement>('.map-frame')
    const hierarchy = grid?.querySelector<HTMLElement>('.hierarchy-panel')
    const inspector = grid?.querySelector<HTMLElement>('.inspector-panel')
    if (!grid || !map || !hierarchy || !inspector) throw new Error('The map workspace layout is incomplete.')
    return {
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      mapWidth: map.getBoundingClientRect().width,
      hierarchyWidth: hierarchy.getBoundingClientRect().width,
      inspectorWidth: inspector.getBoundingClientRect().width,
      mapTop: map.getBoundingClientRect().top,
      gridHeight: grid.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })
  expect(desktopLayout.colorScheme).toBe('dark')
  expect(desktopLayout.mapWidth).toBeGreaterThan(desktopLayout.viewportWidth * 0.9)
  expect(desktopLayout.mapWidth).toBeGreaterThan(desktopLayout.hierarchyWidth * 2)
  expect(desktopLayout.inspectorWidth).toBeGreaterThan(0)
  expect(desktopLayout.gridHeight).toBeGreaterThanOrEqual(desktopLayout.viewportHeight * 0.75)
  await expect(hierarchyPanel).toBeVisible()
  await expect(inspectorPanel).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Fit map' }))
    .toBeVisible()

  const collapseHierarchy = page.getByRole('button', { name: 'Collapse hierarchy panel' })
  await expect(collapseHierarchy.locator('span')).toHaveText('‹')
  await collapseHierarchy.click()
  await expect(hierarchyPanel).toBeHidden()
  const reopenHierarchy = page.getByRole('button', { name: 'Show hierarchy panel' })
  await expect(reopenHierarchy).toBeVisible()
  const hierarchyTabBounds = await reopenHierarchy.boundingBox()
  if (!hierarchyTabBounds) throw new Error('The hierarchy panel reopen tab is not visible.')
  expect(hierarchyTabBounds.x).toBe(0)
  expect(hierarchyTabBounds.height).toBeGreaterThan(hierarchyTabBounds.width)
  await reopenHierarchy.click()
  await expect(hierarchyPanel).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileLayout = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.editor-grid')
    const map = grid?.querySelector<HTMLElement>('.map-frame')
    const hierarchy = grid?.querySelector<HTMLElement>('.hierarchy-panel')
    if (!map || !hierarchy) throw new Error('The map workspace layout is incomplete.')
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mapTop: map.getBoundingClientRect().top,
      hierarchyTop: hierarchy.getBoundingClientRect().top,
    }
  })
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth)
  expect(mobileLayout.mapTop).toBeLessThan(mobileLayout.hierarchyTop)
  await expect(inspectorPanel).toBeHidden()
  await expect(clusterMap).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Fit map' }))
    .toBeVisible()
  const inspectorTabBounds = await page.getByRole('button', { name: 'Show inspector panel' }).boundingBox()
  if (!inspectorTabBounds) throw new Error('The inspector panel reopen tab is not visible.')
  expect(inspectorTabBounds.x + inspectorTabBounds.width).toBe(mobileLayout.viewportWidth)
  expect(inspectorTabBounds.height).toBeGreaterThan(inspectorTabBounds.width)

  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspectorPanel).toBeVisible()
  await expect(hierarchyPanel).toBeHidden()
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchyPanel).toBeVisible()
  await expect(inspectorPanel).toBeHidden()
})

test('the system map can zoom well beyond 400 percent', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const zoomIn = navigation.getByRole('button', { name: 'Zoom in' })
  for (let step = 0; step < 25 && !(await zoomIn.isDisabled()); step += 1) {
    await zoomIn.click()
  }
  await expect(navigation.getByLabel('Zoom level')).toHaveText('1600%')
})

test('the object palette stays aligned with the system summary and adapts to narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const toolbar = page.getByRole('toolbar', { name: 'System map editing' })
  const clusterMapButton = page.getByRole('button', { name: 'Cluster map' })
  const layout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const toolbar = document.querySelector<HTMLElement>('[aria-label="System map editing"]')
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button'))
    const clusterMapButton = buttons.find(button => button.textContent?.trim() === 'Cluster map')
    const chartDetailsButton = buttons.find(button => button.textContent?.trim() === 'Chart details')
    const mapCanvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const hierarchy = document.querySelector<HTMLElement>('#workspace-hierarchy-panel')
    const inspector = document.querySelector<HTMLElement>('#workspace-inspector-panel')
    const mapSvg = document.querySelector<SVGSVGElement>('.system-map-canvas .system-map-svg')
    const summary = document.querySelector<HTMLElement>('.editor-heading')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (
      !palette || !toolbar || !clusterMapButton || !mapCanvas || !hierarchy || !inspector
      || !mapSvg || !summary || !tools
    ) {
      throw new Error('The map editing controls are incomplete.')
    }
    const background = getComputedStyle(clusterMapButton).backgroundColor
    const exportBar = toolbar.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    const mapBounds = mapCanvas.getBoundingClientRect()
    const hierarchyBounds = hierarchy.getBoundingClientRect()
    const inspectorBounds = inspector.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const toolsBounds = tools.getBoundingClientRect()
    const objectButtons = Array.from(
      palette.querySelectorAll<HTMLElement>('.object-palette-items .object-palette-button'),
    )
    return {
      paletteFloatsAboveMap: palette.closest('.map-tools') !== null,
      addOrbitGroupedWithPalette: palette.contains(document.querySelector('[aria-label="Add orbit"]')),
      exportBarWidth: exportBar.width,
      viewportWidth: window.innerWidth,
      paletteCenteredInTools: Math.abs(
        paletteBounds.left + paletteBounds.width / 2
          - toolsBounds.left - toolsBounds.width / 2,
      ) <= 1,
      sameTopRow: Math.abs(summaryBounds.top - toolsBounds.top) <= 1,
      allObjectButtonsFit: objectButtons.length > 0 && objectButtons.every((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= paletteBounds.left
          && bounds.right <= paletteBounds.right
          && bounds.top >= paletteBounds.top
          && bounds.bottom <= paletteBounds.bottom
      }),
      objectButtonCount: objectButtons.length,
      toolbarClearsPanels: toolsBounds.bottom <= hierarchyBounds.top
        && toolsBounds.bottom <= inspectorBounds.top,
      clusterButtonIsOpaque: background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent',
      clusterButtonInHierarchy: Boolean(clusterMapButton?.closest('#workspace-hierarchy-panel')),
      clusterButtonBesideChartDetails: Boolean(
        clusterMapButton && chartDetailsButton && clusterMapButton.parentElement === chartDetailsButton.parentElement,
      ),
      mapFillsCanvas: mapSvg.getBoundingClientRect().height / mapBounds.height >= 0.92,
    }
  })
  expect({
    paletteFloatsAboveMap: layout.paletteFloatsAboveMap,
    addOrbitGroupedWithPalette: layout.addOrbitGroupedWithPalette,
    exportBarIsCompact: layout.exportBarWidth <= layout.viewportWidth * 0.45,
    paletteCenteredInTools: layout.paletteCenteredInTools,
    sameTopRow: layout.sameTopRow,
    allObjectButtonsFit: layout.allObjectButtonsFit,
    activeCategoryOnly: layout.objectButtonCount === 3,
    toolbarClearsPanels: layout.toolbarClearsPanels,
    clusterButtonIsOpaque: layout.clusterButtonIsOpaque,
    clusterButtonInHierarchy: layout.clusterButtonInHierarchy,
    clusterButtonBesideChartDetails: layout.clusterButtonBesideChartDetails,
    mapFillsCanvas: layout.mapFillsCanvas,
  }).toEqual({
    paletteFloatsAboveMap: true,
    addOrbitGroupedWithPalette: true,
    exportBarIsCompact: true,
    paletteCenteredInTools: true,
    sameTopRow: true,
    allObjectButtonsFit: true,
    activeCategoryOnly: true,
    toolbarClearsPanels: true,
    clusterButtonIsOpaque: true,
    clusterButtonInHierarchy: true,
    clusterButtonBesideChartDetails: true,
    mapFillsCanvas: true,
  })
  await expect(palette).toBeVisible()
  await expect(toolbar).toBeVisible()
  await expect(clusterMapButton).toBeVisible()

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.editor-heading')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    const hierarchy = document.querySelector<HTMLElement>('.system-map-editor-grid .hierarchy-panel')
    const panelToggles = Array.from(
      document.querySelectorAll<HTMLElement>('.system-map-editor-grid .panel-reopen'),
    )
    if (!palette || !summary || !tools || !hierarchy) {
      throw new Error('The map palette, summary, or hierarchy panel is unavailable.')
    }

    const paletteBounds = palette.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const toolsBounds = tools.getBoundingClientRect()
    const hierarchyBounds = hierarchy.getBoundingClientRect()
    const buttons = Array.from(
      palette.querySelectorAll<HTMLElement>('.object-palette-items .object-palette-button'),
    )
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      objectButtonCount: buttons.length,
      centered: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      belowSummary: paletteBounds.top >= summaryBounds.bottom + 4,
      toolbarClearsHierarchy: toolsBounds.bottom <= hierarchyBounds.top,
      toolbarClearsPanelToggles: panelToggles.every((toggle) => {
        const bounds = toggle.getBoundingClientRect()
        return toolsBounds.right <= bounds.left || toolsBounds.left >= bounds.right
          || toolsBounds.bottom <= bounds.top || toolsBounds.top >= bounds.bottom
      }),
      allButtonsFit: buttons.length > 0 && buttons.every((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= paletteBounds.left
          && bounds.right <= paletteBounds.right
          && bounds.top >= paletteBounds.top
          && bounds.bottom <= paletteBounds.bottom
      }),
    }
  })
  expect(narrowLayout.documentWidth).toBeLessThanOrEqual(narrowLayout.viewportWidth)
  expect(narrowLayout.centered).toBe(true)
  expect(narrowLayout.belowSummary).toBe(true)
  expect(narrowLayout.toolbarClearsHierarchy).toBe(true)
  expect(narrowLayout.toolbarClearsPanelToggles).toBe(true)
  expect(narrowLayout.objectButtonCount).toBe(3)
  expect(narrowLayout.allButtonsFit).toBe(true)

  await page.setViewportSize({ width: 479, height: 252 })
  const compactLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.editor-heading')
    const navigation = document.querySelector<HTMLElement>('.map-navigation')
    const panelToggles = Array.from(
      document.querySelectorAll<HTMLElement>('.system-map-editor-grid .panel-reopen'),
    )
    if (!palette || !summary || !navigation) {
      throw new Error('The map palette, summary, or navigation is unavailable.')
    }

    const paletteBounds = palette.getBoundingClientRect()
    const summaryBounds = summary.getBoundingClientRect()
    const navigationBounds = navigation.getBoundingClientRect()
    const actions = Array.from(palette.querySelectorAll<HTMLElement>('.object-palette-button'))
    const overlaps = (first: DOMRect, second: DOMRect) =>
      first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top

    return {
      paletteCentered: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      paletteBelowSummary: paletteBounds.top >= summaryBounds.bottom + 4,
      paletteWithinViewport: paletteBounds.top >= 0 && paletteBounds.bottom <= window.innerHeight,
      allActionsVisible: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight
      }),
      allActionsReachable: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        const target = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        return target === action || action.contains(target)
      }),
      navigationClearsPalette: !overlaps(navigationBounds, paletteBounds),
      panelsClearTools: panelToggles.every((toggle) => {
        const bounds = toggle.getBoundingClientRect()
        return !overlaps(bounds, paletteBounds) && !overlaps(bounds, navigationBounds)
      }),
    }
  })
  expect(compactLayout).toEqual({
    paletteCentered: true,
    paletteBelowSummary: true,
    paletteWithinViewport: true,
    allActionsVisible: true,
    allActionsReachable: true,
    navigationClearsPalette: true,
    panelsClearTools: true,
  })
})

test('object category tabs reveal one group beside the title or below it when space runs out', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const categories = palette.getByRole('group', { name: 'Object categories' })
  const tabs = categories.getByRole('button')
  const activeItems = palette.locator('.object-palette-items')
  await expect(tabs).toHaveCount(7)
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Celestial bodies')
  await expect(activeItems.getByRole('button')).toHaveCount(3)
  await expect(palette.getByRole('button', { name: 'Add orbit' })).toBeVisible()

  const desktopLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.editor-heading')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    if (!summary || !tools || !palette) throw new Error('The system heading or object palette is missing.')
    const summaryBounds = summary.getBoundingClientRect()
    const toolsBounds = tools.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    return {
      sameTopRow: Math.abs(summaryBounds.top - toolsBounds.top) <= 1,
      besideSummary: toolsBounds.left >= summaryBounds.right,
      paletteCenteredInTools: Math.abs(
        paletteBounds.left + paletteBounds.width / 2
          - toolsBounds.left - toolsBounds.width / 2,
      ) <= 1,
    }
  })
  expect(desktopLayout).toEqual({
    sameTopRow: true,
    besideSummary: true,
    paletteCenteredInTools: true,
  })

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.editor-heading')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (!summary || !tools) throw new Error('The system heading or object palette is missing.')
    return {
      toolsBelowSummary: tools.getBoundingClientRect().top
        >= summary.getBoundingClientRect().bottom + 4,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(narrowLayout).toEqual({
    toolsBelowSummary: true,
    noHorizontalOverflow: true,
  })

  await categories.getByRole('button', { name: 'Small bodies and fields' }).click()
  await expect(categories.getByRole('button', { name: 'Small bodies and fields' }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Small bodies and fields')
  await expect(activeItems.getByRole('button')).toHaveCount(2)
  await expect(palette.getByRole('button', { name: 'Add Asteroid' })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Add Star' })).toHaveCount(0)

  await page.setViewportSize({ width: 479, height: 252 })
  const compactLayout = await palette.locator('button').evaluateAll(buttons =>
    buttons.every((button) => {
      const bounds = button.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight
        && bounds.left >= 0 && bounds.right <= window.innerWidth
    }),
  )
  expect(compactLayout).toBe(true)
})

test('cluster creation actions share a floating palette separate from export controls', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const groups = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Cluster editing palette"]')
    const toolbar = document.querySelector<HTMLElement>('[aria-label="Jump Cluster export and import"]')
    return {
      addSystemInPalette: Boolean(palette?.querySelector('[aria-label="Add star system"]')),
      addRouteInPalette: Boolean(palette?.querySelector('[aria-label="Add Jump Route"]')),
      addSystemInExportToolbar: Boolean(toolbar?.querySelector('[aria-label="Add star system"]')),
      addRouteInExportToolbar: Boolean(toolbar?.querySelector('[aria-label="Add Jump Route"]')),
    }
  })

  expect(groups).toEqual({
    addSystemInPalette: true,
    addRouteInPalette: true,
    addSystemInExportToolbar: false,
    addRouteInExportToolbar: false,
  })
})

test('the system map fills the canvas and its summary floats above the scene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const map = canvas?.querySelector<SVGSVGElement>('.system-map-svg')
    const stats = document.querySelector<HTMLElement>('.editor-heading [aria-label="Current system contents"]')
    if (!canvas || !map || !stats) throw new Error('The system-map canvas and summary are incomplete.')

    const canvasBounds = canvas.getBoundingClientRect()
    const mapBounds = map.getBoundingClientRect()
    const mapText = Array.from(map.querySelectorAll('text'), element => element.textContent?.trim() ?? '')
    return {
      mapHeightRatio: mapBounds.height / canvasBounds.height,
      floatingStatsVisible: getComputedStyle(stats).display !== 'none' && stats.getBoundingClientRect().width > 0,
      floatingSystemName: document.querySelector('.editor-heading h1')?.textContent?.trim(),
      floatingStats: Array.from(stats.querySelectorAll('strong'), counter =>
        counter.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
      floatingStatsOutsideSvg: !map.contains(stats),
      systemNameInSvg: mapText.includes('Vesper'),
      objectSummaryInSvg: mapText.some(text => text.includes('OBJECTS') && text.includes('ORBITS')),
    }
  })

  expect(layout.mapHeightRatio, JSON.stringify(layout)).toBeGreaterThanOrEqual(0.92)
  expect(layout.floatingStatsVisible).toBe(true)
  expect(layout.floatingSystemName).toBe('Vesper')
  expect(layout.floatingStats).toEqual(['1 STARS', '1 OBJECTS', '0 ORBITS'])
  expect(layout.floatingStatsOutsideSvg).toBe(true)
  expect(layout.systemNameInSvg).toBe(false)
  expect(layout.objectSummaryInSvg).toBe(false)
})

test('side panels animate and Delete removes the selected object', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  const expectPanelTransition = async (panel: import('@playwright/test').Locator, buttonName: string) => {
    await panel.evaluate(element => {
      const track = (event: Event) => {
        if (event.target !== element) return
        element.setAttribute('data-transition-started', 'true')
        element.removeEventListener('transitionrun', track)
      }
      element.removeAttribute('data-transition-started')
      element.addEventListener('transitionrun', track)
    })
    await page.getByRole('button', { name: buttonName }).click()
    await expect(panel).toHaveAttribute('data-transition-started', 'true')
  }

  await expectPanelTransition(hierarchy, 'Collapse hierarchy panel')
  await expect(hierarchy).toBeHidden()
  await expectPanelTransition(hierarchy, 'Show hierarchy panel')
  await expect(hierarchy).toBeVisible()

  await expectPanelTransition(inspector, 'Collapse inspector panel')
  await expect(inspector).toBeHidden()
  await expectPanelTransition(inspector, 'Show inspector panel')
  await expect(inspector).toBeVisible()

  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  const nameInput = page.getByLabel('Name')
  await nameInput.focus()
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeVisible()
  await primaryStar.click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await primaryStar.click()
  page.once('dialog', async dialog => dialog.accept())
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeHidden()
})

test('map object glyphs match the Add object palette', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const mapObjects = map.locator('.system-object')

  for (const subtype of catalogueSubtypes) {
    const button = await selectCatalogueObjectButton(page, subtype)
    const menuMark = (await button.locator('.object-mark').textContent())?.trim()
    const objectCount = await mapObjects.count()
    await button.click()
    await expect(mapObjects).toHaveCount(objectCount + 1)
    await expect(mapObjects.nth(objectCount).locator('.system-object-glyph')).toHaveText(menuMark!)
  }
})

test('deleting a map object without dependents still asks for confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  let confirmation = ''
  page.once('dialog', async dialog => {
    confirmation = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Primary Star' }).click()

  expect(confirmation).toMatch(/^Delete Primary Star/)
  await expect(primaryStar).toBeVisible()
})

test('the Warden can navigate and arrange both maps', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const clusterNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const clusterZoom = clusterNavigation.getByLabel('Zoom level')
  await expect(clusterZoom).toHaveText('100%')
  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(clusterZoom).toHaveText('120%')

  const clusterBounds = await clusterMap.boundingBox()
  if (!clusterBounds) throw new Error('The Jump Cluster map is not visible.')
  await page.mouse.move(
    clusterBounds.x + clusterBounds.width / 2,
    clusterBounds.y + clusterBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(120)
  await page.mouse.wheel(0, -5000)
  await expect(clusterZoom).toHaveText('1600%')
  await page.mouse.wheel(0, 5000)
  await expect(clusterZoom).toHaveText('25%')
  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(400)

  const clusterContent = clusterMap.locator('.cluster-map-content')
  const beforePan = await clusterContent.getAttribute('transform')
  await panMap(page, clusterMap, { x: 36, y: 24 })
  await expect(clusterContent).not.toHaveAttribute('transform', beforePan!)

  const systemNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const nodeBeforeDrag = await systemNode.getAttribute('transform')
  await dragBy(page, systemNode.locator('.cluster-system-card'), { x: 48, y: 24 })
  await expect(systemNode).not.toHaveAttribute('transform', nodeBeforeDrag!)
  const nodeAfterDrag = await systemNode.getAttribute('transform')
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const restoredNode = restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' })
  await expect(restoredNode).toHaveAttribute('transform', nodeAfterDrag!)
  await expect(page.getByLabel('Zoom level')).toHaveText('100%')
  await restoredNode.click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')

  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const angleBeforeResize = await orbitalAngle(map)
  const orbitRadius = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await dragOrbitToWorldPoint(page, orbitRadius, { x: 633, y: 280 })
  await expect(orbitRadius).toHaveAttribute('aria-valuenow', '152')
  expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
  await largeOrbitRadius.press('End')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
  await page.keyboard.press('ArrowRight')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')

  await addCatalogueObject(page, 'hazard')
  await page.getByLabel('Name').fill('Glass Wake')
  await page.getByLabel('Name').press('Tab')
  const hazard = map.getByRole('button', { name: /Glass Wake/ })
  await dragToWorldPoint(page, map, hazard.locator('.object-hit-target'), { x: 230, y: 180 })
  const hazardTransform = await hazard.getAttribute('transform')
  await expect(page.getByText('Saved on this device')).toBeVisible()

  const systemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const systemZoom = systemNavigation.getByLabel('Zoom level')
  await expect(systemZoom).toHaveText('100%')
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(systemZoom).toHaveText('120%')
  const systemBounds = await map.boundingBox()
  if (!systemBounds) throw new Error('The star system map is not visible.')
  await page.mouse.move(
    systemBounds.x + systemBounds.width / 2,
    systemBounds.y + systemBounds.height / 2,
  )
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
    .toBeGreaterThan(120)
  await page.mouse.wheel(0, -5000)
  await expect(systemZoom).toHaveText('1600%')
  await page.mouse.wheel(0, 5000)
  await expect(systemZoom).toHaveText('25%')
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()
  await expect(systemZoom).not.toHaveText('100%')
  const fittedMapBounds = await map.boundingBox()
  const fittedOrbitBounds = await map.getByRole('group', { name: 'Orbit 2 around Primary Star' })
    .locator('.orbit-ring').boundingBox()
  if (!fittedMapBounds || !fittedOrbitBounds) throw new Error('The fitted Orbit is not visible.')
  expect(fittedOrbitBounds.x).toBeGreaterThanOrEqual(fittedMapBounds.x)
  expect(fittedOrbitBounds.x + fittedOrbitBounds.width)
    .toBeLessThanOrEqual(fittedMapBounds.x + fittedMapBounds.width)
  expect(fittedOrbitBounds.y).toBeGreaterThanOrEqual(fittedMapBounds.y)
  expect(fittedOrbitBounds.y + fittedOrbitBounds.height)
    .toBeLessThanOrEqual(fittedMapBounds.y + fittedMapBounds.height)
  const systemContent = map.locator('.system-map-content')
  const systemBeforePan = await systemContent.getAttribute('transform')
  await panMap(page, map, { x: 24, y: 18 })
  await expect(systemContent).not.toHaveAttribute('transform', systemBeforePan!)

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', '152')
  await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' }))
    .toHaveAttribute('aria-valuenow', '571')
  await expect(page.getByLabel('Zoom level')).toHaveText('100%')
  await expect(restoredMap.getByRole('button', { name: /Glass Wake/ }))
    .toHaveAttribute('transform', hazardTransform!)
  expect(Math.abs(await orbitalAngle(restoredMap) - angleBeforeResize)).toBeLessThan(0.02)
})

test('the Jump Route line follows a system while it is being dragged', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Departure')
  await page.getByLabel('Name').press('Tab')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Arrival')
  await page.getByLabel('Name').press('Tab')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Departure (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Arrival (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()

  const routeMark = clusterMap.getByRole('button', { name: /Jump-01/ })
  const routeLine = routeMark.locator('.cluster-route-line')
  const routeBefore = await routeLine.getAttribute('d')
  const sourceNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  const nodeBefore = await sourceNode.getAttribute('transform')
  const source = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
    .locator('.cluster-system-card')
  const sourceBox = await source.boundingBox()
  if (!routeBefore || !nodeBefore || !sourceBox) throw new Error('Could not locate the route or its source system.')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 100, sourceBox.y + sourceBox.height / 2 + 30, { steps: 4 })
  await expect.poll(async () => sourceNode.getAttribute('transform'))
    .not.toBe(nodeBefore)
  await expect.poll(async () => routeLine.getAttribute('d'))
    .not.toBe(routeBefore)
  await page.mouse.up()
})

test('the Orbit ring itself resizes and the system caption stays concise', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(map.locator('.map-caption')).toHaveCount(0)
  const resizeKnobs = map.locator('.orbit-resize-handle')
  await expect(resizeKnobs).toHaveCount(0)

  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  const orbitRing = orbit.locator('.orbit-ring')
  const orbitTarget = orbit.locator('.orbit-hit-target')
  await orbitTarget.scrollIntoViewIfNeeded()
  await expect(orbitTarget).toHaveAttribute('role', 'slider')
  const radiusBefore = Number(await orbitRing.getAttribute('r'))
  const planet = map.getByRole('button', { name: /New planet 1/ })
  const planetBefore = await planet.getAttribute('transform')
  const points = await orbitTarget.evaluate((element) => {
    const circle = element as SVGCircleElement
    const matrix = circle.getScreenCTM()
    if (!matrix) throw new Error('The Orbit is not attached to the map.')
    const start = new DOMPoint(
      Number(circle.getAttribute('cx')) + Number(circle.getAttribute('r')),
      Number(circle.getAttribute('cy')),
    ).matrixTransform(matrix)
    const end = new DOMPoint(
      Number(circle.getAttribute('cx')) + Number(circle.getAttribute('r')) + 48,
      Number(circle.getAttribute('cy')),
    ).matrixTransform(matrix)
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
  })

  await page.mouse.move(points.start.x, points.start.y)
  await page.mouse.down()
  await page.mouse.move(points.end.x, points.end.y, { steps: 4 })
  await expect.poll(async () => Number(await orbitRing.getAttribute('r')))
    .toBeGreaterThan(radiusBefore)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
  await page.mouse.up()
})

test('an object drag keeps its hosted Orbit with it before release', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  const innerOrbit = map.getByRole('group', { name: 'Orbit 1 around Iria' }).locator('.orbit-ring')
  const orbitCenterBefore = await innerOrbit.getAttribute('cx')
  const planetBefore = await planet.getAttribute('transform')
  await beginDragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 545, y: 185 })
  await expect(planet).toHaveClass(/is-dragging/)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
  await expect.poll(async () => innerOrbit.getAttribute('cx'))
    .not.toBe(orbitCenterBefore)
  await page.mouse.up()
})

test('the object palette adds objects by drag or keyboard and drops planets into Orbits', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const palette = page.getByRole('region', { name: 'Object palette' })
  await expect(palette).toBeVisible()
  expect(await palette.evaluate(element => element.closest('.system-map-tools') !== null)).toBe(true)
  const toolbar = page.getByRole('toolbar', { name: 'System map editing' })
  const toolbarBefore = await toolbar.evaluate(element => {
    const exportButton = element.querySelector('[aria-label="Export star system JSON"]')
    const buttonsFit = Array.from(element.querySelectorAll('button')).every(button => {
      const bounds = button.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= window.innerWidth
    })
    return {
      top: element.getBoundingClientRect().top,
      exportTop: exportButton?.getBoundingClientRect().top ?? null,
      buttonsFit,
    }
  })
  expect(toolbarBefore.exportTop).not.toBeNull()
  expect(toolbarBefore.buttonsFit).toBe(true)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const addPlanet = palette.getByRole('button', { name: 'Add Planet' })
  await expect(addPlanet.locator('.object-mark')).toHaveText('◉')
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(page, addPlanet, map, { x: 592, y: 280 })
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ }))
    .toBeVisible()

  await hierarchy.getByRole('button', { name: 'Chart details' }).click()
  await addPlanet.press('Enter')
  const systemPlanet = hierarchy.getByRole('button', { name: /Select PL-02, New planet 2/ })
  await expect(systemPlanet).toBeVisible()
  await expect(systemPlanet.locator('.object-mark')).toHaveText('◉')
  await dragToWorldPoint(page, map, map.getByRole('button', { name: /New planet 2/ })
    .locator('.object-hit-target'), { x: 592, y: 280 })
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ }))
    .toBeVisible()
  const toolbarAfter = await toolbar.evaluate(element => {
    const exportButton = element.querySelector('[aria-label="Export star system JSON"]')
    const buttonsFit = Array.from(element.querySelectorAll('button')).every(button => {
      const bounds = button.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= window.innerWidth
    })
    return {
      top: element.getBoundingClientRect().top,
      exportTop: exportButton?.getBoundingClientRect().top ?? null,
      buttonsFit,
    }
  })
  expect(toolbarAfter.top).toBe(toolbarBefore.top)
  expect(toolbarAfter.exportTop).toBe(toolbarBefore.exportTop)
  expect(toolbarAfter.buttonsFit).toBe(true)

  const exported = await downloadJson(page, 'Export star system JSON')
  const system = exported.system
  if (!system) throw new Error('The exported file does not contain a star system.')
  const orbitId = system.orbits[0].id
  const planets = system.objects.filter(object => object.subtype === 'planet')
  expect(planets).toHaveLength(2)
  expect(planets.map(object => object.placement)).toEqual([
    { kind: 'orbit', orbitId },
    { kind: 'orbit', orbitId },
  ])
})

test('the Warden can build and edit a nested star-system map', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const palette = page.getByRole('region', { name: 'Object palette' })

  await expect(map).toBeVisible()
  await expect(palette.getByRole('group', { name: 'Object categories' }).getByRole('button'))
    .toHaveCount(7)
  await expect(palette.getByRole('group', { name: 'Celestial bodies' }).getByRole('button'))
    .toHaveCount(3)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 2 around Primary Star/ }).click()
  await page.getByRole('button', { name: 'Move orbit up' }).click()
  await expect(inspector.getByRole('heading', { name: 'Orbit 1' })).toBeVisible()

  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await page.getByLabel('Description').fill('A chlorine cloud deck.')
  await page.getByLabel('Description').press('Tab')
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ })).toBeVisible()

  const key = page.getByLabel('Location key')
  const originalKey = await key.inputValue()
  await key.fill('A')
  await key.press('Tab')
  await expect(page.getByRole('alert')).toContainText('already used')
  await expect(key).toHaveValue('A')
  await key.fill(originalKey)
  await key.press('Tab')
  await expect(page.getByRole('alert')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'belt')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await page.getByLabel('Name').fill('Nix')
  await expect(page.getByLabel('Name')).toHaveValue('Nix')
  await page.getByLabel('Name').press('Tab')
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await map.getByRole('button', { name: /Nix/ }).click()
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toHaveAttribute('aria-current', 'true')

  const generatedNames = new Map([
    ['star', /New star/],
    ['planet', /New planet/],
    ['moon', /New moon/],
    ['asteroid', /New asteroid/],
    ['belt', /New belt/],
    ['station', /New station/],
    ['base', /New base/],
    ['colony', /New colony/],
    ['vessel', /New vessel/],
    ['derelict', /New derelict/],
    ['jump-point', /New jump point/],
    ['anomaly', /New anomaly/],
    ['nebula', /New nebula/],
    ['hazard', /New hazard/],
    ['other', /New other/],
  ] as const)

  for (const subtype of catalogueSubtypes) {
    await addCatalogueObject(page, subtype)
    await expect(inspector.getByRole('heading', { name: generatedNames.get(subtype)! })).toBeVisible()
  }

  await page.getByLabel('Type label').fill('Relay Beacon')
  await page.getByLabel('Type label').press('Tab')
  await page.getByLabel('Name').fill('Relay Beacon Kestrel')
  await page.getByLabel('Name').press('Tab')
  await page.getByLabel('Schematic X').fill('0.75')
  await page.getByLabel('Schematic X').press('Tab')
  await page.getByLabel('Schematic Y').fill('0.25')
  await page.getByLabel('Schematic Y').press('Tab')
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Relay Beacon Kestrel' })).toBeVisible()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Relay Beacon Kestrel/ }).click()
  await expect(inspector.getByLabel('Type label')).toHaveValue('Relay Beacon')
  await expect(inspector.getByLabel('Schematic X')).toHaveValue('0.75')
  await expect(map.getByRole('button', { name: /Relay Beacon Kestrel/ })).toBeVisible()
})

test('the Warden can connect Jump Points across a cluster and record an unresolved exit', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')

  await addCatalogueObject(page, 'station')
  await page.getByLabel('Name').fill('Vesper Gate')
  await page.getByLabel('Name').press('Tab')

  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  const station = page.getByLabel('Physical Jump Station')
  const stationOption = page.getByRole('option', { name: /Vesper Gate/ })
  const stationId = await stationOption.getAttribute('value')
  expect(stationId).toBeTruthy()
  await station.selectOption(stationId!)
  await expect(station).toHaveValue(stationId!)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Harrow Entry')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01.*Vesper Exit.*Harrow Entry/ })).toBeVisible()

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByLabel('Name').fill('Vesper Arrival')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01.*Vesper Arrival.*Harrow Entry/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-02')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Arrival (Vesper)' })
  await page.getByLabel('Route destination').selectOption('external')
  await page.getByLabel('Unresolved exit label').fill('Unknown Rim')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-02.*Vesper Arrival.*Unknown Rim.*unresolved exit/ })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /Open .* system map/ })).toHaveCount(2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredMap.getByRole('button', { name: /Jump-01.*Vesper Arrival.*Harrow Entry/ })).toBeVisible()
  await expect(restoredMap.getByRole('button', { name: /Jump-02.*Vesper Arrival.*Unknown Rim.*unresolved exit/ })).toBeVisible()
  await restoredMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  await expect(page.getByLabel('Physical Jump Station')).toHaveValue(stationId!)
})

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')

  await page.getByText('Field definitions', { exact: true }).click()
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await page.getByLabel('Port class choices').fill('Class I\nClass II')
  await page.getByRole('button', { name: 'Save native field options' }).click()
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Chlorine')
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin')
  await page.getByRole('button', { name: 'Save native field options' }).click()
  await expect(page.getByRole('alert')).toContainText('Cannot remove "Chlorine"')
  await page.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await page.getByRole('button', { name: 'Save native field options' }).click()

  const addCustomField = async (name: string, type: string, options?: string) => {
    await page.getByLabel('Custom field label').fill(name)
    await page.getByLabel('Value type').selectOption(type)
    if (options !== undefined) {
      await page.getByLabel('New field choices').fill(options)
    }
    await page.getByRole('button', { name: 'Add custom field' }).click()
  }

  await addCustomField('Campaign notes', 'text')
  await page.getByLabel('Campaign notes').fill('Relay station under the ice.')
  await page.getByLabel('Campaign notes').blur()

  await addCustomField('Threat level', 'number')
  await page.getByLabel('Threat level').fill('4')
  await page.getByLabel('Threat level').blur()

  await addCustomField('Hostile', 'boolean')
  await page.getByLabel('Hostile').selectOption('true')

  await addCustomField('Signal class', 'single-select', 'Amber\nBlue')
  await page.getByLabel('Signal class choices').fill('Amber\nBlue\nRed')
  await page.getByRole('button', { name: 'Save Signal class choices' }).click()
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')

  await addCatalogueObject(page, 'station')
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes')).toHaveValue('')
  await page.getByLabel('Port class', { exact: true }).selectOption('Class II')

  await addCatalogueObject(page, 'moon')
  await expect(page.getByLabel('Atmosphere', { exact: true })).toBeVisible()
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Thin')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'planet')
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await page.getByLabel('Campaign notes').fill('Reusable in the next system.')
  await page.getByLabel('Campaign notes').blur()

  await page.reload()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Chlorine')
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Relay station under the ice.')
  await expect(page.getByLabel('Threat level')).toHaveValue('4')
  await expect(page.getByLabel('Hostile')).toHaveValue('true')
  await expect(page.getByLabel('Signal class', { exact: true })).toHaveValue('Red')
  await hierarchy.getByRole('button', { name: /New moon 1/ }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Thin')
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await hierarchy.getByRole('button', { name: /New station/ }).click()
  await expect(page.getByLabel('Port class', { exact: true })).toHaveValue('Class II')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await restoredClusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  const secondSystemHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await secondSystemHierarchy.getByRole('button', { name: /New planet 1/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Reusable in the next system.')
})

test('the Warden can review and safely confirm dependent map deletions', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(page.getByRole('button', { name: 'Delete Vesper system' })).toBeDisabled()
  await page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    .getByRole('button', { name: 'Open Vesper system map' })
    .click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria/ }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  await addCatalogueObject(page, 'moon')
  await page.getByLabel('Name').fill('Nix')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  let orbitDeletionPreview = ''
  page.once('dialog', async (dialog) => {
    orbitDeletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Orbit 1 around Vesper Exit' }).click()
  expect(orbitDeletionPreview).toContain('Nix')
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Harrow Entry')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-02')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-02/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Jump Routes' })
    .getByRole('button', { name: 'Select Jump-02 route' })
    .click()
  let directRouteDeletionRequested = false
  let directRouteDeletionPreview = ''
  const routeDeletionDialog = async (dialog: import('@playwright/test').Dialog) => {
    directRouteDeletionRequested = true
    directRouteDeletionPreview = dialog.message()
    await dialog.accept()
  }
  page.on('dialog', routeDeletionDialog)
  await page.getByRole('button', { name: 'Delete Jump Route Jump-02' }).click()
  await page.off('dialog', routeDeletionDialog)
  expect(directRouteDeletionRequested).toBe(true)
  expect(directRouteDeletionPreview).toContain('Jump-02')
  await expect(clusterMap.getByRole('button', { name: /Jump-02/ })).toHaveCount(0)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  let deletionPreview = ''
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  expect(deletionPreview).toContain('Orbit 1 around Iria')
  expect(deletionPreview).toContain('Vesper Exit')
  expect(deletionPreview).toContain('Orbit 1 around Vesper Exit')
  expect(deletionPreview).toContain('Nix')
  expect(deletionPreview).toContain('Jump-01')
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredClusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  await restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const updatedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(updatedClusterMap.getByRole('button', { name: /Jump-01/ })).toHaveCount(0)

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const reloadedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(reloadedClusterMap.getByRole('button', { name: /Jump-01/ })).toHaveCount(0)
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toBeVisible()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete New System 2 system' }).click()
  expect(deletionPreview).toContain('Harrow Entry')
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toHaveCount(0)
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open Vesper system map' })).toBeVisible()

  await reloadedClusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await addCatalogueObject(page, 'station')
  await page.getByLabel('Name').fill('Vesper Gate')
  await page.getByLabel('Name').press('Tab')
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Vesper Arrival')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  const physicalStation = page.getByLabel('Physical Jump Station')
  const stationId = await page.getByRole('option', { name: /Vesper Gate/ }).getAttribute('value')
  expect(stationId).toBeTruthy()
  await physicalStation.selectOption(stationId!)
  await hierarchy.getByRole('button', { name: /Vesper Gate/ }).click()
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete Vesper Gate' }).click()
  expect(deletionPreview).toContain('Vesper Arrival')
  expect(deletionPreview).toContain('Vesper Gate')
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Gate/ })).toHaveCount(0)
  await hierarchy.getByRole('button', { name: /Select .*Vesper Arrival/ }).click()
  await expect(physicalStation).toHaveValue('')

  await page.reload()
  await hierarchy.getByRole('button', { name: /Select .*Vesper Arrival/ }).click()
  await expect(page.getByLabel('Physical Jump Station')).toHaveValue('')
})

test('the Warden can export a cluster and standalone system as versioned JSON', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Vesper Exit')
  await page.getByLabel('Name').press('Tab')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Harrow Entry')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()

  const secondSystem = clusterMap.getByRole('button', { name: 'Open New System 2 system map' })
  await dragBy(page, secondSystem, { x: 48, y: 24 })
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 24, y: 18 })
  const clusterViewportTransform = await clusterMap.locator('.cluster-map-content').getAttribute('transform')
  expect(clusterViewportTransform).not.toBe('translate(0,0) scale(1)')
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expect(clusterSvg.text).toContain('Kestrel Reach')
  const clusterSvgInfo = await inspectImageSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.contentTransform).toBeNull()
  expect(clusterSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(clusterSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  expect(clusterSvgInfo.texts).toEqual(expect.arrayContaining(['Vesper', 'New System 2', 'Jump-01']))
  expect(clusterSvgInfo.titleStyle).toContain('fill:')
  expectReadableExport(clusterSvgInfo)
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.size).toBeGreaterThan(100)
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(clusterExport).toMatchObject({
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    layout: { version: 1 },
  })
  expect(clusterExport.cluster?.systems).toHaveLength(2)
  expect(clusterExport.cluster?.routes).toHaveLength(1)
  expect(Object.keys(clusterExport.layout.systemPositions ?? {}).sort())
    .toEqual(clusterExport.cluster!.systems.map(system => system.id).sort())
  expect(clusterExport.layout).not.toHaveProperty('zoom')
  expect(clusterExport.layout).not.toHaveProperty('pan')
  expect(clusterExport).not.toHaveProperty('selectedRouteId')
  const exportedSecondSystem = clusterExport.cluster!.systems.find(system => system.name === 'New System 2')!
  expect(clusterExport.layout.systemPositions?.[exportedSecondSystem.id].x).not.toBe(0.5)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await page.getByText('Field definitions', { exact: true }).click()
  await page.getByLabel('Custom field label').fill('Campaign notes')
  await page.getByRole('button', { name: 'Add custom field' }).click()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByLabel('Campaign notes').fill('A local secret.')
  await page.getByLabel('Campaign notes').press('Tab')

  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  await dragToWorldPoint(page, systemMap, systemMap.getByRole('button', { name: /Iria/ }).locator('.object-hit-target'), {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const orbitHandle = systemMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await orbitHandle.press('End')
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const updatedClusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const clusterSystem = updatedClusterExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const planet = clusterSystem.objects.find(object => object.name === 'Iria')!
  const orbit = clusterSystem.orbits[0]
  const field = updatedClusterExport.objectFieldSettings.customFields.find(item => item.name === 'Campaign notes')!
  expect(planet.customFieldValues?.[field.id]).toBe('A local secret.')
  expect(updatedClusterExport.layout.orbitRadii[orbit.id]).toBe(512)
  expect(Number.isFinite(updatedClusterExport.layout.objectAngles[planet.id])).toBe(true)
  expect(updatedClusterExport.layout).not.toHaveProperty('zoom')
  expect(updatedClusterExport.layout).not.toHaveProperty('pan')
  expect(updatedClusterExport).not.toHaveProperty('selectedSystemId')
  expect(updatedClusterExport).not.toHaveProperty('selectedObjectId')

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('toolbar', { name: 'Map navigation' }).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })
  const systemViewportTransform = await systemMap.locator('.system-map-content').getAttribute('transform')
  expect(systemViewportTransform).not.toBe('translate(0,0) scale(1)')
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  expect(systemSvg.text).toContain('Iria')
  const systemSvgInfo = await inspectImageSvg(page, systemSvg.text!)
  expect(systemSvgInfo.contentTransform).toBeNull()
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThan(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThan(560)
  expect(systemSvgInfo.texts).toContain('Iria')
  expect(systemSvgInfo.titleStyle).toBeNull()
  expect(systemSvgInfo.glyphFill).toBeTruthy()
  expectReadableExport(systemSvgInfo)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.size).toBeGreaterThan(100)
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport).toMatchObject({
    format: 'mothership-campaign-map',
    version: 1,
    type: 'system',
    layout: { version: 1 },
  })
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport).not.toHaveProperty('routes')
  expect(systemExport.system?.name).toBe('Vesper')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Vesper Exit')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Iria')
  expect(systemExport.system?.objects.map(object => object.name)).not.toContain('Harrow Entry')
  expect(systemExport.layout.systemPositions).toBeUndefined()
  expect(systemExport.layout.orbitRadii[orbit.id]).toBe(512)
  expect(systemExport.layout.objectAngles[planet.id]).toBe(updatedClusterExport.layout.objectAngles[planet.id])
  expect(systemExport.layout).not.toHaveProperty('zoom')
  expect(systemExport.layout).not.toHaveProperty('pan')
  expect(systemExport).not.toHaveProperty('selectedObjectId')
  expect(systemExport.objectFieldSettings.customFields).toContainEqual(field)
  expect(systemExport.system?.objects.find(object => object.name === 'Iria')?.customFieldValues?.[field.id])
    .toBe('A local secret.')
})

test('the Warden can validate and import an independent JSON copy', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const importFile = page.getByLabel('JSON map file')
  await setJsonFile(importFile, 'invalid.json', '{')
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const incoming = {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    cluster: {
      id: 'incoming-cluster',
      name: 'Imported Reach',
      systems: [
        {
          id: 'incoming-alpha',
          name: 'Vesper',
          objects: [
            {
              id: 'incoming-star',
              family: 'CelestialBody',
              subtype: 'star',
              locationKey: 'A',
              name: 'Primary Star',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
            {
              id: 'incoming-station',
              family: 'Installation',
              subtype: 'station',
              locationKey: 'ST.1',
              name: 'Relay Station',
              description: '',
              placement: { kind: 'system', x: 0.6, y: 0.5 },
            },
            {
              id: 'incoming-point-alpha',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Alpha Gate',
              description: '',
              placement: { kind: 'system', x: 0.7, y: 0.5 },
              jumpStationId: 'incoming-station',
            },
            {
              id: 'incoming-planet',
              family: 'CelestialBody',
              subtype: 'planet',
              locationKey: 'PL.1',
              name: 'Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { 'incoming-field': 'The key is hidden.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: 'incoming-star', order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [
            {
              id: 'incoming-point-beta',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Beta Gate',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
          ],
          orbits: [],
        },
      ],
      routes: [
        {
          id: 'incoming-route',
          name: 'Known route',
          fromPointId: 'incoming-point-alpha',
          toPointId: 'incoming-point-beta',
        },
        {
          id: 'incoming-exit',
          name: 'Unknown route',
          fromPointId: 'incoming-point-beta',
          toPointId: null,
          unresolvedExit: 'Uncharted exit',
        },
      ],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{ id: 'incoming-field', name: 'Campaign notes', type: 'text' }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 100 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const invalidLayout = {
    ...incoming,
    layout: {
      ...incoming.layout,
      systemPositions: {
        ...incoming.layout.systemPositions,
        'missing-system': { x: 0.5, y: 0.5 },
      },
    },
  }
  await setJsonFile(importFile, 'invalid-layout.json', JSON.stringify(invalidLayout))
  await expect(page.getByRole('alert').last()).toContainText('valid version 1')
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const canceledPreview = await previewPromise
  const previewText = canceledPreview.message()
  expect(previewText).toContain('Star systems: 2')
  expect(previewText).toContain('Map objects: 5')
  expect(previewText).toContain('Orbits: 1')
  expect(previewText).toContain('Jump Routes: 2')
  expect(previewText).toContain('Custom fields: 1')
  expect(previewText).toContain('Possible existing matches by name or location key')
  expect(previewText).toContain('Primary Star')
  expect(previewText).toContain('same name')
  await canceledPreview.dismiss()
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const acceptedPreview = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  await (await acceptedPreview).accept()
  const alphaNode = systemList.getByRole('button', { name: 'Open Vesper system map' }).last()
  const betaNode = systemList.getByRole('button', { name: 'Open Far Vesper system map' })
  await expect(alphaNode).toBeVisible()
  await expect(betaNode).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Jump Routes' }).getByRole('button', { name: /Known route/ })).toBeVisible()
  await betaNode.click()
  await expect(page.getByRole('heading', { name: 'Far Vesper', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const firstImport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedAlpha = firstImport.cluster!.systems.find(system =>
    system.name === 'Vesper' && system.objects.some(object => object.name === 'Iria'),
  )!
  const importedBeta = firstImport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = firstImport.objectFieldSettings.customFields.find(field => field.name === 'Campaign notes')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedBeta.id).not.toBe('incoming-beta')
  expect(importedPlanet.id).not.toBe('incoming-planet')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'The key is hidden.' })
  expect(importedField.id).not.toBe('incoming-field')
  expect(firstImport.cluster!.routes.find(route => route.name === 'Known route')).toMatchObject({
    fromPointId: importedPoint.id,
    toPointId: importedBetaPoint.id,
  })
  expect(firstImport.cluster!.routes.find(route => route.name === 'Unknown route')).toMatchObject({
    fromPointId: importedBetaPoint.id,
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  expect(firstImport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(firstImport.layout.orbitRadii[importedOrbit.id]).toBe(100)
  expect(firstImport.layout.objectAngles[importedPlanet.id]).toBe(1.2)

  const duplicatePreviewPromise = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'duplicate.json', JSON.stringify(firstImport))
  const duplicatePreview = await duplicatePreviewPromise
  expect(duplicatePreview.message()).toContain('Original-ID collisions')
  expect(duplicatePreview.message()).toContain('Primary Star')
  await duplicatePreview.accept()
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(4)
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(2)
})

test('the Warden can import a standalone system without adding cluster routes', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const exportedSystem = await downloadJson(page, 'Export star system JSON')
  const input = page.getByLabel('JSON map file')
  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(input, 'system-copy.json', JSON.stringify(exportedSystem))
  const preview = await previewPromise
  expect(preview.message()).toContain('Star systems: 1')
  expect(preview.message()).toContain('Jump Routes: 0')
  expect(preview.message()).toContain('Primary Star')
  await preview.accept()

  const systems = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systems.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(2)
  const exportedCluster = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exportedCluster.cluster?.systems).toHaveLength(2)
  expect(exportedCluster.cluster?.routes).toHaveLength(0)
  expect(exportedCluster.cluster?.systems[0].id).not.toBe(exportedCluster.cluster?.systems[1].id)
  expect(exportedCluster.cluster?.systems[0].objects[0].id)
    .not.toBe(exportedCluster.cluster?.systems[1].objects[0].id)
})

test('the Warden can complete the local campaign workflow end to end', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const clusterName = 'Kestrel Reach Prime'
  const systemName = 'Vesper Prime'
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByLabel('Jump Cluster').fill(clusterName)
  await inspector.getByLabel('Star system').fill(systemName)
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await page.getByText('Field definitions', { exact: true }).click()
  await page.getByLabel('Custom field label').fill('Warden notes')
  await page.getByRole('button', { name: 'Add custom field' }).click()

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await page.getByLabel('Name').fill('Iria')
  await page.getByLabel('Name').press('Tab')
  await page.getByLabel('Warden notes').fill('Existing campaign record.')
  await page.getByLabel('Warden notes').press('Tab')
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await page.getByLabel('Name').fill('Nix')
  await page.getByLabel('Name').press('Tab')
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Vesper Departure')
  await page.getByLabel('Name').press('Tab')

  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map` })
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByLabel('Star system').fill('Harrow')
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await addCatalogueObject(page, 'jump-point')
  await page.getByLabel('Name').fill('Harrow Arrival')
  await page.getByLabel('Name').press('Tab')
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('Route name').fill('Jump-01')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Departure (Vesper Prime)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Arrival (Harrow)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump-01.*Vesper Departure.*Harrow Arrival/ }))
    .toBeVisible()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: systemName, level: 1 })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Warden notes')).toHaveValue('Existing campaign record.')
  const systemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const mapPlanet = systemMap.getByRole('button', { name: /Select PL-01, Iria/ })
  await mapPlanet.focus()
  await mapPlanet.press('Enter')
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  const systemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(systemNavigation.getByLabel('Zoom level')).toHaveText('120%')
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const harrowNode = clusterMap.getByRole('button', { name: 'Open Harrow system map' })
  await harrowNode.focus()
  await harrowNode.press('Enter')
  await expect(page.getByRole('heading', { name: 'Harrow', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect(clusterNavigation.getByLabel('Zoom level')).toHaveText('120%')
  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()

  const baseline = await downloadJson(page, 'Export Jump Cluster JSON')
  const originalSystem = baseline.cluster!.systems.find(system => system.name === systemName)!
  const originalStar = originalSystem.objects.find(object => object.name === 'Primary Star')!
  const originalPlanet = originalSystem.objects.find(object => object.name === 'Iria')!
  const originalRoute = baseline.cluster!.routes.find(route => route.name === 'Jump-01')!
  const existingField = baseline.objectFieldSettings.customFields.find(field => field.name === 'Warden notes')!
  const originalSystemIds = baseline.cluster!.systems.map(system => system.id)
  expect(originalPlanet.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

  const incoming = {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    cluster: {
      id: 'incoming-cluster',
      name: 'Imported Reach',
      systems: [
        {
          id: 'incoming-alpha',
          name: systemName,
          objects: [
            {
              id: originalStar.id,
              family: 'CelestialBody',
              subtype: 'star',
              locationKey: 'A',
              name: 'Primary Star',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
            {
              id: 'incoming-station',
              family: 'Installation',
              subtype: 'station',
              locationKey: 'ST.1',
              name: 'Relay Station',
              description: '',
              placement: { kind: 'system', x: 0.6, y: 0.5 },
            },
            {
              id: 'incoming-point-alpha',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Alpha Gate',
              description: '',
              placement: { kind: 'system', x: 0.7, y: 0.5 },
              jumpStationId: 'incoming-station',
            },
            {
              id: 'incoming-planet',
              family: 'CelestialBody',
              subtype: 'planet',
              locationKey: 'PL.1',
              name: 'Imported Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { [existingField.id]: 'Imported campaign record.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: originalStar.id, order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [{
            id: 'incoming-point-beta',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Beta Gate',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          }],
          orbits: [],
        },
      ],
      routes: [{
        id: 'incoming-route',
        name: 'Imported route',
        fromPointId: 'incoming-point-alpha',
        toPointId: 'incoming-point-beta',
      }],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{
        id: existingField.id,
        name: 'Imported observations',
        type: 'text',
      }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 120 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const importFile = page.getByLabel('JSON map file')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  const canceledImport = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const preview = await canceledImport
  expect(preview.message()).toContain('Star systems: 2')
  expect(preview.message()).toContain('Map objects: 5')
  expect(preview.message()).toContain('Original-ID collisions (2)')
  expect(preview.message()).toContain('Primary Star')
  expect(preview.message()).toContain('Possible existing matches by name or location key')
  await preview.dismiss()
  await expect(systemList.getByRole('button', { name: /Open .* system map/ }))
    .toHaveCount(originalSystemIds.length)
  const unchanged = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(unchanged.cluster!.systems.map(system => system.id)).toEqual(originalSystemIds)
  expect(unchanged.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])

  const acceptedImport = page.waitForEvent('dialog')
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  await (await acceptedImport).accept()
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(1)
  await page.reload()
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Imported route.*Alpha Gate.*Beta Gate/ }))
    .toBeVisible()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(importedExport.cluster!.systems).toHaveLength(4)
  const importedAlpha = importedExport.cluster!.systems.find(system =>
    system.name === systemName && system.id !== originalSystem.id,
  )!
  const importedBeta = importedExport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedStar = importedAlpha.objects.find(object => object.name === 'Primary Star')!
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Imported Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Imported observations')!
  const importedRoute = importedExport.cluster!.routes.find(route => route.name === 'Imported route')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedStar.id).not.toBe(originalStar.id)
  expect(importedStation.id).not.toBe('incoming-station')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.placement).toEqual({ kind: 'orbit', orbitId: importedOrbit.id })
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'Imported campaign record.' })
  expect(importedField.id).not.toBe(existingField.id)
  expect(importedRoute.fromPointId).toBe(importedPoint.id)
  expect(importedRoute.toPointId).toBe(importedBetaPoint.id)
  expect(importedExport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(importedExport.layout.orbitRadii[importedOrbit.id]).toBe(120)
  expect(importedExport.layout.objectAngles[importedPlanet.id]).toBe(1.2)
  const preservedSystem = importedExport.cluster!.systems.find(system => system.id === originalSystem.id)!
  expect(preservedSystem.objects.find(object => object.id === originalPlanet.id)?.customFieldValues?.[existingField.id])
    .toBe('Existing campaign record.')
  expect(importedExport.cluster!.routes.some(route => route.id === originalRoute.id)).toBe(true)

  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 1000, y: 300 })
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  const clusterSvgInfo = await inspectExportedSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.text).toContain(systemName)
  expect(clusterSvgInfo.text).toContain('Harrow')
  expect(clusterSvgInfo.text).toContain('Far Vesper')
  expect(clusterSvgInfo.text).toContain('Imported route')
  expect(clusterSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(clusterSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)

  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  await clusterMap.getByRole('button', { name: `Open ${systemName} system map` }).first().click()
  const activeSystemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const activeSystemNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  await activeSystemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, activeSystemMap, { x: 1000, y: 300 })
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const systemSvgInfo = await inspectExportedSvg(page, systemSvg.text!)
  expect(systemSvgInfo.text).toContain('Iria')
  expect(systemSvgInfo.text).toContain('Nix')
  expect(systemSvgInfo.text).toContain('Vesper Departure')
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThanOrEqual(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThanOrEqual(560)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport.type).toBe('system')
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport.system?.objects.map(object => object.name))
    .toEqual(expect.arrayContaining(['Iria', 'Nix', 'Vesper Departure']))
  expect(systemExport.system?.objects.find(object => object.id === originalPlanet.id)
    ?.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const deleteImportedSystem = page.getByRole('button', { name: 'Delete Far Vesper system' })
  let deletionPreview = ''
  page.once('dialog', async (dialog) => {
    deletionPreview = dialog.message()
    await dialog.dismiss()
  })
  await deleteImportedSystem.click()
  expect(deletionPreview).toContain('Beta Gate')
  expect(deletionPreview).toContain('Imported route')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /Imported route/ })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await deleteImportedSystem.click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(clusterMap.getByRole('button', { name: /Imported route/ })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(clusterMap.getByRole('button', { name: /Jump-01/ })).toBeVisible()
  const finalExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(finalExport.cluster!.systems).toHaveLength(3)
  expect(finalExport.cluster!.systems.some(system => system.id === originalSystem.id)).toBe(true)
  expect(finalExport.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])
})
