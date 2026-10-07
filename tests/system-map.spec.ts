import { expect, test } from '@playwright/test'
import { createLocalWorkspace, restoreLocalWorkspace } from '../domain/workspace'

type WorldPoint = { x: number; y: number }
type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }
type DragPreviewWindow = Window & {
  __dragPreview?: {
    height: number
    offsetX: number
    offsetY: number
    tagName: string
    text: string
    width: number
  }
}
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
  orbits: Array<{ id: string; hostId: string | null; center?: WorldPoint; order: number }>
}
type ExportedRoute = {
  id: string
  name?: string
  jumpLevel?: number
  fromPointId: string
  toPointId: string | null
  unresolvedExit?: string
}
type ExportedCustomFieldApplicabilityTarget =
  | { kind: 'category'; family: string }
  | { kind: 'subtype'; family: string; subtype: string }
type ExportedMap = {
  format: string
  version: number
  type: 'cluster' | 'system'
  cluster?: { id: string; name: string; systems: ExportedSystem[]; routes: ExportedRoute[] }
  system?: ExportedSystem
  objectFieldSettings: {
    atmosphereOptions: string[]
    portClassOptions: string[]
    customFields: Array<{
      id: string
      name: string
      type: string
      options?: string[]
      applicability?: ExportedCustomFieldApplicabilityTarget[]
    }>
  }
  layout: {
    version: number
    systemPositions?: Record<string, WorldPoint>
    orbitRadii: Record<string, number | { horizontal: number; vertical: number }>
    orbitEllipseRadii?: Record<string, { horizontal: number; vertical: number }>
    orbitRotations?: Record<string, number>
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

async function moveToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  const screenPoint = await map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
    const screen = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screen.x, y: screen.y }
  }, point)
  await page.mouse.move(screenPoint.x, screenPoint.y)
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
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
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
  duringDrag?: () => Promise<void>,
): Promise<void> {
  await source.scrollIntoViewIfNeeded()
  await map.scrollIntoViewIfNeeded()
  const sourceBounds = await source.boundingBox()
  const bounds = await map.boundingBox()
  if (!sourceBounds || !bounds) throw new Error('Could not find the map or palette object to drag.')

  const destination = await map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
    const screenPoint = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screenPoint.x - target.boundsX, y: screenPoint.y - target.boundsY }
  }, { x: point.x, y: point.y, boundsX: bounds.x, boundsY: bounds.y })
  await page.mouse.move(
    sourceBounds.x + sourceBounds.width / 2,
    sourceBounds.y + sourceBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(bounds.x + destination.x, bounds.y + destination.y, { steps: 12 })
  if (duringDrag) await duringDrag()
  await page.mouse.up()
}

async function dragOrbitToWorldPoint(
  page: import('@playwright/test').Page,
  orbit: import('@playwright/test').Locator,
  point: WorldPoint,
  startAngle = 0,
): Promise<void> {
  await orbit.scrollIntoViewIfNeeded()
  const coordinates = await orbit.evaluate((element, target) => {
    const shape = element as SVGCircleElement | SVGEllipseElement
    const matrix = shape.getScreenCTM()
    if (!matrix) throw new Error('The Orbit is not attached to the map.')
    const radiusX = Number(shape.getAttribute('rx') ?? shape.getAttribute('r'))
    const radiusY = Number(shape.getAttribute('ry') ?? shape.getAttribute('r'))
    const start = new DOMPoint(
      Number(shape.getAttribute('cx')) + radiusX * Math.cos(target.startAngle),
      Number(shape.getAttribute('cy')) + radiusY * Math.sin(target.startAngle),
    ).matrixTransform(matrix)
    const end = new DOMPoint(target.point.x, target.point.y).matrixTransform(matrix)
    return {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    }
  }, { point, startAngle })

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

async function ellipticalOrbitAngle(
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  objectName: string,
): Promise<number> {
  return map.evaluate((element, target) => {
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === target.orbitLabel)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    const object = [...element.querySelectorAll<SVGGElement>('.system-object')]
      .find(candidate => candidate.getAttribute('aria-label')?.includes(target.objectName))
    const transform = object?.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!ellipse || !transform) throw new Error('Could not locate the Orbit or its child object.')

    const rotation = Number(
      ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
    ) * Math.PI / 180
    const x = Number(transform[1]) - Number(ellipse.getAttribute('cx'))
    const y = Number(transform[2]) - Number(ellipse.getAttribute('cy'))
    const localX = x * Math.cos(rotation) + y * Math.sin(rotation)
    const localY = -x * Math.sin(rotation) + y * Math.cos(rotation)
    return Math.atan2(
      localY / Number(ellipse.getAttribute('ry')),
      localX / Number(ellipse.getAttribute('rx')),
    )
  }, { orbitLabel, objectName })
}

async function orbitRotationDegrees(
  orbitRing: import('@playwright/test').Locator,
): Promise<number> {
  return orbitRing.evaluate(element => Number(
    element.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
  ))
}

async function ellipticalOrbitPoint(
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  angle: number,
): Promise<WorldPoint> {
  return map.evaluate((element, target) => {
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === target.orbitLabel)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    if (!ellipse) throw new Error('Could not locate the Orbit.')
    const rotation = Number(
      ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0,
    ) * Math.PI / 180
    const localX = Number(ellipse.getAttribute('rx')) * Math.cos(target.angle)
    const localY = Number(ellipse.getAttribute('ry')) * Math.sin(target.angle)
    return {
      x: Number(ellipse.getAttribute('cx')) + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      y: Number(ellipse.getAttribute('cy')) + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    }
  }, { orbitLabel, angle })
}

async function setHeaderMapActionsOpen(
  page: import('@playwright/test').Page,
  open: boolean,
): Promise<void> {
  const toggle = page.locator('.header-map-actions-toggle')
  const isOpen = await toggle.getAttribute('aria-expanded') === 'true'
  if (isOpen !== open) await toggle.click()
}

async function downloadJson(page: import('@playwright/test').Page, buttonName: string): Promise<ExportedMap> {
  await setHeaderMapActionsOpen(page, true)
  try {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: buttonName }).click()
    await downloadPromise
    const json = await page.evaluate(async () => {
      const blob = (window as DownloadWindow).__mapExportBlobs?.shift()
      if (!blob) throw new Error('Could not read the downloaded JSON file.')
      return blob.text()
    })
    return JSON.parse(json) as ExportedMap
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

async function openFieldDefinitionDialog(
  page: import('@playwright/test').Page,
): Promise<import('@playwright/test').Locator> {
  await page.getByRole('button', { name: 'Open field definitions' }).click()
  return page.getByRole('dialog', { name: 'Field definitions' })
}

async function editFieldDefinition(dialog: import('@playwright/test').Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Edit field definition' }).click()
}

async function editMapObject(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit map object' }).click()
}

async function saveMapObject(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Save map object' }).click()
}

async function addCustomFieldThroughDialog(
  page: import('@playwright/test').Page,
  name: string,
  type: string,
  options?: string,
): Promise<void> {
  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await dialog.getByLabel('Custom field label').fill(name)
  await dialog.getByLabel('Value type').selectOption(type)
  if (options !== undefined) {
    await dialog.getByLabel('New field choices').fill(options)
  }
  await dialog.getByRole('button', { name: 'Add custom field', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close field definitions' }).click()
}

type DownloadedImage = {
  type: string
  size: number
  text?: string
  sourceSvgText?: string
  width?: number
  height?: number
  signature?: number[]
}

async function downloadImage(
  page: import('@playwright/test').Page,
  buttonName: string,
  mimeType: 'image/svg+xml' | 'image/png',
): Promise<DownloadedImage> {
  await setHeaderMapActionsOpen(page, true)
  try {
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
      const sourceSvg = intermediateSvg >= 0 ? blobs.splice(intermediateSvg, 1)[0] : undefined
      return {
        type: blob.type,
        size: blob.size,
        sourceSvgText: sourceSvg ? await sourceSvg.text() : undefined,
        signature: Array.from(bytes.slice(0, 8)),
        width: dimensions.getUint32(16),
        height: dimensions.getUint32(20),
      }
    }, mimeType)
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
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
  systemTitle: {
    text: string
    x: number
    y: number
    width: number
    fontSize: number
    fill: string
  } | null
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
    const title = svg.querySelector<SVGTextElement>('.system-map-export-title')
    const systemTitle = title
      ? (() => {
          const text = title.textContent?.trim() ?? ''
          const fontSize = Number(title.style.fontSize.replace('px', ''))
          const context = document.createElement('canvas').getContext('2d')
          if (!context) throw new Error('Could not measure the exported system title.')
          context.font = `${title.style.fontWeight} ${fontSize}px ${title.style.fontFamily}`
          return {
            text,
            x: Number(title.getAttribute('x')),
            y: Number(title.getAttribute('y')),
            width: context.measureText(text).width,
            fontSize,
            fill: title.style.getPropertyValue('fill'),
          }
        })()
      : null
    return {
      viewBox: viewBox.split(/\s+/).map(Number),
      width: Number(svg.getAttribute('width')?.replace('px', '')),
      height: Number(svg.getAttribute('height')?.replace('px', '')),
      contentTransform: svg.querySelector('.cluster-map-content, .system-map-content')?.getAttribute('transform') ?? null,
      texts: Array.from(svg.querySelectorAll('text')).map(element => element.textContent?.trim() ?? ''),
      systemTitle,
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

test('the object palette clears the header summary and adapts to narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const clusterMapButton = page.getByRole('button', { name: 'Cluster map' })
  const layout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button'))
    const clusterMapButton = buttons.find(button => button.textContent?.trim() === 'Cluster map')
    const chartDetailsButton = buttons.find(button => button.textContent?.trim() === 'Chart details')
    const mapCanvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const hierarchy = document.querySelector<HTMLElement>('#workspace-hierarchy-panel')
    const inspector = document.querySelector<HTMLElement>('#workspace-inspector-panel')
    const mapSvg = document.querySelector<SVGSVGElement>('.system-map-canvas .system-map-svg')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (!palette || !clusterMapButton || !mapCanvas || !hierarchy || !inspector || !mapSvg || !summary || !tools) {
      throw new Error('The map editing controls are incomplete.')
    }
    const background = getComputedStyle(clusterMapButton).backgroundColor
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
      noMapToolbar: tools.querySelector('.map-toolbar') === null,
      paletteCenteredInViewport: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      noFloatingSummary: document.querySelector('.editor-heading') === null,
      allObjectButtonsFit: objectButtons.length > 0 && objectButtons.every((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= paletteBounds.left
          && bounds.right <= paletteBounds.right
          && bounds.top >= paletteBounds.top
          && bounds.bottom <= paletteBounds.bottom
      }),
      objectButtonCount: objectButtons.length,
      toolsClearPanels: toolsBounds.bottom <= hierarchyBounds.top
        && toolsBounds.bottom <= inspectorBounds.top,
      clusterButtonIsOpaque: background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent',
      clusterButtonInHierarchy: Boolean(clusterMapButton?.closest('#workspace-hierarchy-panel')),
      chartDetailsButtonInInspector: Boolean(
        chartDetailsButton?.closest('#workspace-inspector-panel'),
      ),
      mapFillsCanvas: mapSvg.getBoundingClientRect().height / mapBounds.height >= 0.92,
    }
  })
  expect({
    paletteFloatsAboveMap: layout.paletteFloatsAboveMap,
    addOrbitGroupedWithPalette: layout.addOrbitGroupedWithPalette,
    noMapToolbar: layout.noMapToolbar,
    paletteCenteredInViewport: layout.paletteCenteredInViewport,
    paletteBelowHeader: layout.paletteBelowHeader,
    noFloatingSummary: layout.noFloatingSummary,
    allObjectButtonsFit: layout.allObjectButtonsFit,
    activeCategoryOnly: layout.objectButtonCount === 3,
    toolsClearPanels: layout.toolsClearPanels,
    clusterButtonIsOpaque: layout.clusterButtonIsOpaque,
    clusterButtonInHierarchy: layout.clusterButtonInHierarchy,
    chartDetailsButtonInInspector: layout.chartDetailsButtonInInspector,
    mapFillsCanvas: layout.mapFillsCanvas,
  }).toEqual({
    paletteFloatsAboveMap: true,
    addOrbitGroupedWithPalette: true,
    noMapToolbar: true,
    paletteCenteredInViewport: true,
    paletteBelowHeader: true,
    noFloatingSummary: true,
    allObjectButtonsFit: true,
    activeCategoryOnly: true,
    toolsClearPanels: true,
    clusterButtonIsOpaque: true,
    clusterButtonInHierarchy: true,
    chartDetailsButtonInInspector: true,
    mapFillsCanvas: true,
  })
  await expect(palette).toBeVisible()
  await expect(page.locator('.header-map-actions-toggle')).toBeVisible()
  await expect(clusterMapButton).toBeVisible()

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
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
      headerWithinViewport: summaryBounds.left >= 0 && summaryBounds.right <= window.innerWidth,
      centered: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
      belowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
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
  expect(narrowLayout.headerWithinViewport).toBe(true)
  expect(narrowLayout.centered).toBe(true)
  expect(narrowLayout.belowHeader).toBe(true)
  expect(narrowLayout.toolbarClearsHierarchy).toBe(true)
  expect(narrowLayout.toolbarClearsPanelToggles).toBe(true)
  expect(narrowLayout.objectButtonCount).toBe(3)
  expect(narrowLayout.allButtonsFit).toBe(true)

  await page.setViewportSize({ width: 479, height: 252 })
  const compactLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
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
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      headerWithinViewport: summaryBounds.left >= 0 && summaryBounds.right <= window.innerWidth,
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
    paletteBelowHeader: true,
    headerWithinViewport: true,
    paletteWithinViewport: true,
    allActionsVisible: true,
    allActionsReachable: true,
    navigationClearsPalette: true,
    panelsClearTools: true,
  })
})

test('object category tabs reveal one group and fit on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const palette = page.getByRole('region', { name: 'Object palette' })
  const categories = palette.getByRole('group', { name: 'Object categories' })
  const tabs = categories.getByRole('button')
  const activeItems = palette.locator('.object-palette-items')
  await expect(page.locator('.editor-heading')).toHaveCount(0)
  await expect(tabs).toHaveCount(7)
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(activeItems).toHaveAttribute('aria-label', 'Celestial bodies')
  await expect(activeItems.getByRole('button')).toHaveCount(3)
  await expect(palette.getByRole('button', { name: 'Add orbit' })).toBeVisible()

  const desktopLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    if (!summary || !palette) throw new Error('The header summary or object palette is missing.')
    const summaryBounds = summary.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    return {
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      paletteCenteredInViewport: Math.abs(
        paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2,
      ) <= 1,
    }
  })
  expect(desktopLayout).toEqual({
    paletteBelowHeader: true,
    paletteCenteredInViewport: true,
  })

  await page.setViewportSize({ width: 479, height: 720 })
  const narrowLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const tools = document.querySelector<HTMLElement>('.system-map-tools')
    if (!summary || !tools) throw new Error('The header summary or object palette is missing.')
    return {
      toolsBelowHeader: tools.getBoundingClientRect().top
        >= summary.getBoundingClientRect().bottom + 4,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(narrowLayout).toEqual({
    toolsBelowHeader: true,
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
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)
  const compactLayout = await page.evaluate(() => {
    const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
    const categories = palette?.querySelector<HTMLElement>('.object-palette-categories')
    if (!palette || !categories) throw new Error('The object palette categories are missing.')

    const categoryBounds = categories.getBoundingClientRect()
    const actions = Array.from(palette.querySelectorAll<HTMLElement>('.object-palette-button'))
    const categoryButtons = Array.from(categories.querySelectorAll<HTMLButtonElement>('button'))
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      categoriesWithinViewport: categoryBounds.left >= 0 && categoryBounds.right <= window.innerWidth,
      categoriesCanScroll: categories.scrollWidth > categories.clientWidth,
      categoryButtonsFocusable: categoryButtons.length === 7
        && categoryButtons.every(button => button.tabIndex >= 0),
      actionsFit: actions.length > 0 && actions.every((action) => {
        const bounds = action.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight
          && bounds.left >= 0 && bounds.right <= window.innerWidth
      }),
    }
  })
  expect(compactLayout).toEqual({
    noHorizontalOverflow: true,
    categoriesWithinViewport: true,
    categoriesCanScroll: true,
    categoryButtonsFocusable: true,
    actionsFit: true,
  })

  const finalCategory = categories.getByRole('button', { name: 'Other' })
  await finalCategory.focus()
  expect(await finalCategory.evaluate((button) => {
    const categories = button.closest<HTMLElement>('.object-palette-categories')
    if (!categories) return false
    const categoryBounds = categories.getBoundingClientRect()
    const buttonBounds = button.getBoundingClientRect()
    return buttonBounds.left >= categoryBounds.left && buttonBounds.right <= categoryBounds.right
  })).toBe(true)
})

test('cluster creation actions stay in their palette and header file actions follow the active map', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Cluster map' }).click()

  const clusterSummary = page.getByRole('group', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.getByRole('group', { name: 'Current Jump Cluster contents' })
  const systemSummary = page.getByRole('group', { name: 'Active Star System summary' })
  await expect(clusterSummary).toBeVisible()
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(clusterContents).toContainText('0 ROUTES')
  await expect(clusterContents).toContainText('0 JUMP POINTS')
  await expect(systemSummary).toBeVisible()
  await expect(systemSummary).toContainText('Vesper')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kestrel Reach')
  await expect(page.locator(
    '.cluster-map-header .editor-heading, .cluster-map-header [aria-label="Current Jump Cluster contents"]',
  )).toHaveCount(0)

  const fileActionsMenu = page.locator('.header-map-actions')
  const fileActionsToggle = fileActionsMenu.locator('.header-map-actions-toggle')
  const clusterPaletteLayout = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
    const palette = document.querySelector<HTMLElement>('.cluster-edit-palette')
    const map = document.querySelector<SVGSVGElement>('.cluster-map-svg')
    if (!summary || !palette || !map) throw new Error('The header summary, palette, or map is missing.')
    const summaryBounds = summary.getBoundingClientRect()
    const paletteBounds = palette.getBoundingClientRect()
    return {
      centered: Math.abs(paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2) <= 1,
      paletteBelowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
      noFloatingSummary: document.querySelector('.editor-heading') === null,
      mapText: Array.from(map.querySelectorAll('text'), text => text.textContent?.trim() ?? ''),
    }
  })
  expect(clusterPaletteLayout.centered).toBe(true)
  expect(clusterPaletteLayout.paletteBelowHeader).toBe(true)
  expect(clusterPaletteLayout.noFloatingSummary).toBe(true)
  expect(clusterPaletteLayout.mapText).not.toContain('Kestrel Reach')
  expect(clusterPaletteLayout.mapText).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterPaletteLayout.mapText.some(text => /\d+\s*SYSTEMS\s*\/\s*\d+\s*ROUTES/i.test(text))).toBe(false)

  for (const width of [1024, 479]) {
    await page.setViewportSize({ width, height: 720 })
    const narrowClusterPalette = await page.evaluate(() => {
      const summary = document.querySelector<HTMLElement>('.workspace-header-summary')
      const palette = document.querySelector<HTMLElement>('.cluster-edit-palette')
      if (!summary || !palette) throw new Error('The header summary or palette is missing.')
      const summaryBounds = summary.getBoundingClientRect()
      const paletteBounds = palette.getBoundingClientRect()
      return {
        centered: Math.abs(paletteBounds.left + paletteBounds.width / 2 - window.innerWidth / 2) <= 1,
        belowHeader: paletteBounds.top >= summaryBounds.bottom + 4,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      }
    })
    expect(narrowClusterPalette, `layout at ${width}px`).toEqual({
      centered: true,
      belowHeader: true,
      noHorizontalOverflow: true,
    })
  }
  await page.setViewportSize({ width: 1440, height: 960 })

  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Open map file actions for Jump Cluster Kestrel Reach',
  )
  await fileActionsToggle.focus()
  await page.keyboard.press('Enter')
  await expect(fileActionsToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Close map file actions for Jump Cluster Kestrel Reach',
  )
  const clusterActions = page.getByRole('group', {
    name: 'Map file actions for Jump Cluster Kestrel Reach',
  })
  await expect(clusterActions.getByRole('button', { name: 'Export Jump Cluster JSON' })).toBeVisible()
  await expect(clusterActions.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(clusterActions)
    .toContainText('Import JSON creates a separate copy in the current Jump Cluster: Kestrel Reach.')
  await expect(page.locator('.cluster-map-tools .map-toolbar')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(fileActionsToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(fileActionsToggle).toBeFocused()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await expect(fileActionsToggle).toHaveAttribute(
    'aria-label',
    'Open map file actions for star system Vesper',
  )
  await setHeaderMapActionsOpen(page, true)
  const systemActions = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  await expect(systemActions.getByRole('button', { name: 'Export star system JSON' })).toBeVisible()
  await expect(systemActions.getByRole('button', { name: 'Export star system PNG' })).toBeVisible()
  await expect(systemActions.getByRole('button', { name: 'Import JSON copy' })).toBeVisible()
  await expect(page.locator('.system-map-tools .map-toolbar')).toHaveCount(0)

  await page.setViewportSize({ width: 320, height: 720 })
  const narrowLayout = await systemActions.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const buttons = Array.from(element.querySelectorAll('button'))
    return {
      panelWithinViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
      buttonsFit: buttons.every((button) => {
        const buttonBounds = button.getBoundingClientRect()
        return buttonBounds.left >= bounds.left && buttonBounds.right <= bounds.right
      }),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(narrowLayout).toEqual({
    panelWithinViewport: true,
    buttonsFit: true,
    noHorizontalOverflow: true,
  })
  await setHeaderMapActionsOpen(page, false)
})

test('cluster and system summaries stay in the header, outside the map scene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const clusterSummary = page.getByRole('group', { name: 'Active Jump Cluster summary' })
  const clusterContents = page.getByRole('group', { name: 'Current Jump Cluster contents' })
  const systemSummary = page.getByRole('group', { name: 'Active Star System summary' })
  const systemContents = page.getByRole('group', { name: 'Current system contents' })
  await expect(clusterSummary).toBeVisible()
  await expect(clusterSummary).toContainText('Kestrel Reach')
  await expect(clusterContents).toContainText('1 SYSTEMS')
  await expect(clusterContents).toContainText('0 ROUTES')
  await expect(clusterContents).toContainText('0 JUMP POINTS')
  await expect(systemSummary).toBeVisible()
  await expect(systemSummary).toContainText('Vesper')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vesper')
  await expect(page.locator(
    '.system-map-header .editor-heading, .system-map-header [aria-label="Current system contents"]',
  )).toHaveCount(0)
  await expect(systemContents).toContainText('1 STARS')
  await expect(systemContents).toContainText('1 OBJECTS')
  await expect(systemContents).toContainText('0 ORBITS')

  const layout = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.workspace-header-summary')
    const topbar = document.querySelector<HTMLElement>('.topbar')
    const canvas = document.querySelector<HTMLElement>('.system-map-canvas')
    const map = canvas?.querySelector<SVGSVGElement>('.system-map-svg')
    const clusterStats = document.querySelector<HTMLElement>('[aria-label="Current Jump Cluster contents"]')
    const systemStats = document.querySelector<HTMLElement>('[aria-label="Current system contents"]')
    if (!header || !topbar || !canvas || !map || !clusterStats || !systemStats) {
      throw new Error('The system-map canvas and header summaries are incomplete.')
    }

    const canvasBounds = canvas.getBoundingClientRect()
    const mapBounds = map.getBoundingClientRect()
    const mapText = Array.from(map.querySelectorAll('text'), element => element.textContent?.trim() ?? '')
    return {
      mapHeightRatio: mapBounds.height / canvasBounds.height,
      summariesInHeader: topbar.contains(header)
        && header.contains(clusterStats)
        && header.contains(systemStats),
      summaryStatsOutsideMap: !map.contains(clusterStats) && !map.contains(systemStats),
      summaryStatsVisible: [clusterStats, systemStats].every(stats =>
        getComputedStyle(stats).display !== 'none' && stats.getBoundingClientRect().width > 0,
      ),
      clusterStats: Array.from(clusterStats.querySelectorAll('strong'), counter =>
        counter.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
      systemStats: Array.from(systemStats.querySelectorAll('strong'), counter =>
        counter.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
      floatingSummaryCount: document.querySelectorAll('.editor-heading').length,
      systemNameInSvg: mapText.includes('Vesper'),
      objectSummaryInSvg: mapText.some(text => text.includes('OBJECTS') && text.includes('ORBITS')),
    }
  })

  expect(layout.mapHeightRatio, JSON.stringify(layout)).toBeGreaterThanOrEqual(0.92)
  expect(layout.summariesInHeader).toBe(true)
  expect(layout.summaryStatsOutsideMap).toBe(true)
  expect(layout.summaryStatsVisible).toBe(true)
  expect(layout.clusterStats).toEqual(['1 SYSTEMS', '0 ROUTES', '0 JUMP POINTS'])
  expect(layout.systemStats).toEqual(['1 STARS', '1 OBJECTS', '0 ORBITS'])
  expect(layout.floatingSummaryCount).toBe(0)
  expect(layout.systemNameInSvg).toBe(false)
  expect(layout.objectSummaryInSvg).toBe(false)

  await page.getByRole('button', { name: 'Add Star', exact: true }).click()
  await expect(systemContents).toContainText('2 STARS')
  await expect(systemContents).toContainText('2 OBJECTS')

  for (const width of [1024, 479]) {
    await page.setViewportSize({ width, height: 720 })
    const responsiveLayout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.workspace-header-summary')
      const cluster = document.querySelector<HTMLElement>('.cluster-stamp')
      const system = document.querySelector<HTMLElement>('.system-stamp')
      const palette = document.querySelector<HTMLElement>('[aria-label="Object palette"]')
      if (!header || !cluster || !system || !palette) {
        throw new Error('The header summaries or object palette are unavailable.')
      }

      const headerBounds = header.getBoundingClientRect()
      const clusterBounds = cluster.getBoundingClientRect()
      const systemBounds = system.getBoundingClientRect()
      const paletteBounds = palette.getBoundingClientRect()
      const overlaps = (first: DOMRect, second: DOMRect) =>
        first.left < second.right && first.right > second.left
          && first.top < second.bottom && first.bottom > second.top
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        headerWithinViewport: headerBounds.left >= 0 && headerBounds.right <= window.innerWidth,
        summariesVisible: clusterBounds.width > 0 && systemBounds.width > 0,
        summariesWithinViewport: clusterBounds.left >= 0
          && clusterBounds.right <= window.innerWidth
          && systemBounds.left >= 0
          && systemBounds.right <= window.innerWidth,
        summariesDoNotOverlap: !overlaps(clusterBounds, systemBounds),
        paletteBelowHeader: paletteBounds.top >= headerBounds.bottom + 4,
      }
    })
    expect(responsiveLayout, `header layout at ${width}px`).toEqual({
      noHorizontalOverflow: true,
      headerWithinViewport: true,
      summariesVisible: true,
      summariesWithinViewport: true,
      summariesDoNotOverlap: true,
      paletteBelowHeader: true,
    })
  }
})

test('side panels collapse in ordered phases and Delete removes the selected object', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const sidebars = ['hierarchy', 'inspector'] as const
  const expectReopenHandle = async (
    sidebar: typeof sidebars[number],
    verticalPosition: 'center' | 'system-bottom' = 'center',
    reducedMotion = false,
  ) => {
    const handle = page.getByRole('button', { name: `Show ${sidebar} panel` })
    await expect(handle).toBeVisible()
    await expect(handle).toHaveAttribute('aria-controls', `workspace-${sidebar}-panel`)
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
    const metrics = await handle.evaluate((element) => {
      const label = element.querySelector<HTMLElement>('.panel-reopen-label')
      const grid = element.closest<HTMLElement>('.editor-grid')
      if (!label || !grid) throw new Error('The sidebar reopen control is incomplete.')
      const bounds = element.getBoundingClientRect()
      const labelBounds = label.getBoundingClientRect()
      const gridBounds = grid.getBoundingClientRect()
      const style = getComputedStyle(label)
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: window.innerWidth,
        gridCenterY: gridBounds.top + gridBounds.height / 2,
        gridBottom: gridBounds.bottom,
        writingMode: style.writingMode,
        textOrientation: style.textOrientation,
        labelFontSize: Number.parseFloat(style.fontSize),
        labelWidth: labelBounds.width,
        labelHeight: labelBounds.height,
        animationName: style.animationName,
      }
    })
    expect(metrics.width).toBeCloseTo(2.35 * 16, 1)
    expect(metrics.height, JSON.stringify(metrics)).toBeCloseTo(7 * 16, 1)
    expect(metrics.x).toBeCloseTo(
      sidebar === 'hierarchy' ? 0 : metrics.viewportWidth - metrics.width,
      1,
    )
    if (verticalPosition === 'system-bottom') {
      expect(metrics.gridBottom - metrics.bottom).toBeCloseTo(2 * 16, 1)
    } else {
      expect(metrics.y + metrics.height / 2).toBeCloseTo(metrics.gridCenterY, 1)
    }
    expect(metrics.writingMode).toBe('vertical-rl')
    expect(metrics.textOrientation).toBe('upright')
    expect(metrics.labelFontSize).toBeCloseTo(0.58 * 16, 1)
    expect(metrics.labelHeight).toBeGreaterThan(metrics.labelWidth * 3)
    expect(metrics.animationName).toBe(reducedMotion ? 'none' : 'panel-label-reveal')
    return handle
  }

  const collapseAndReopen = async (sidebar: typeof sidebars[number]) => {
    const panel = page.locator(`#workspace-${sidebar}-panel`)
    const initialBounds = await panel.boundingBox()
    if (!initialBounds) throw new Error(`The ${sidebar} panel is not visible.`)
    await panel.evaluate((element) => {
      element.dataset.collapseSequence = ''
      element.addEventListener('transitionstart', (event) => {
        const transition = event as TransitionEvent
        if (event.target === element && transition.propertyName === 'width') {
          element.dataset.collapseSequence += 'panel'
          element.dataset.contentsOpacityAtPanel = String(Math.max(
            ...Array.from(element.children, child => Number(getComputedStyle(child).opacity)),
          ))
          const handleClass = element.classList.contains('hierarchy-panel')
            ? '.panel-reopen-left'
            : '.panel-reopen-right'
          element.dataset.handlePresentAtPanel = String(
            Boolean(element.parentElement?.querySelector(handleClass)),
          )
        } else if (
          event.target instanceof Element
          && event.target.parentElement === element
          && transition.propertyName === 'opacity'
          && !element.dataset.contentWidthAtFade
        ) {
          element.dataset.collapseSequence += 'contents,'
          element.dataset.contentWidthAtFade = String(element.getBoundingClientRect().width)
        }
      }, true)
    })

    await page.getByRole('button', { name: `Collapse ${sidebar} panel` }).click()
    await expect(panel).toBeHidden()
    const sequence = (await panel.getAttribute('data-collapse-sequence'))?.split(',') ?? []
    expect(sequence).toEqual(['contents', 'panel'])
    expect(Number(await panel.getAttribute('data-content-width-at-fade')))
      .toBeCloseTo(initialBounds.width, 1)
    expect(Number(await panel.getAttribute('data-contents-opacity-at-panel'))).toBeLessThan(0.1)
    expect(await panel.getAttribute('data-handle-present-at-panel')).toBe('false')
    const handle = await expectReopenHandle(sidebar)

    await page.keyboard.press('Tab')
    await handle.focus()
    const focusState = await handle.evaluate(element => ({
      visibleFocus: element.matches(':focus-visible'),
      outline: getComputedStyle(element).outlineWidth,
    }))
    expect(focusState.visibleFocus).toBe(true)
    expect(Number.parseFloat(focusState.outline)).toBeGreaterThan(0)
    await panel.evaluate((element) => {
      element.dataset.openSequence = ''
      element.dataset.openWidthAtPanel = ''
      element.dataset.openWidthAtContents = ''
      element.addEventListener('transitionstart', (event) => {
        const transition = event as TransitionEvent
        if (event.target === element && transition.propertyName === 'width') {
          element.dataset.openSequence += 'panel,'
          element.dataset.openWidthAtPanel = String(element.getBoundingClientRect().width)
        } else if (
          event.target instanceof Element
          && event.target.parentElement === element
          && transition.propertyName === 'opacity'
          && !element.dataset.openWidthAtContents
        ) {
          element.dataset.openSequence += 'contents,'
          element.dataset.openWidthAtContents = String(element.getBoundingClientRect().width)
        }
      }, true)
    })
    await page.keyboard.press('Enter')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('transform', 'none')
    await expect(panel).toHaveAttribute('data-open-sequence', 'panel,contents,')
    const openMetrics = await panel.evaluate((element) => ({
      sequence: element.dataset.openSequence?.split(',').filter(Boolean) ?? [],
      widthAtPanelStart: Number(element.dataset.openWidthAtPanel),
      widthAtContentsStart: Number(element.dataset.openWidthAtContents),
    }))
    expect(openMetrics.sequence).toEqual(['panel', 'contents'])
    expect(openMetrics.widthAtPanelStart).toBeLessThan(initialBounds.width / 2)
    expect(openMetrics.widthAtContentsStart).toBeGreaterThan(initialBounds.width * 0.9)
    await expect(handle).toBeHidden()
  }

  for (const view of ['system', 'cluster'] as const) {
    if (view === 'cluster') await page.getByRole('button', { name: 'Cluster map' }).click()
    for (const sidebar of sidebars) await collapseAndReopen(sidebar)
  }

  await page.locator('#workspace-hierarchy-panel')
    .getByRole('button', { name: 'Open Vesper system map' }).click()
  const reducedMotionPanel = page.locator('#workspace-hierarchy-panel')
  await expect(reducedMotionPanel).toHaveCSS('transform', 'none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const transitionDuration = await reducedMotionPanel.evaluate((element) => {
    element.classList.add('hierarchy-panel-leave-active')
    const duration = getComputedStyle(element).transitionDuration
    element.classList.remove('hierarchy-panel-leave-active')
    return duration
  })
  const duration = transitionDuration.split(',')[0]!.trim()
  const durationMilliseconds = Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000)
  expect(durationMilliseconds).toBeLessThan(0.02)
  await page.getByRole('button', { name: 'Collapse hierarchy panel' }).click()
  await expect(reducedMotionPanel).toBeHidden()
  const reducedMotionHandle = await expectReopenHandle('hierarchy', 'center', true)
  await reducedMotionHandle.focus()
  await page.keyboard.press('Enter')
  await expect(reducedMotionPanel).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.setViewportSize({ width: 390, height: 844 })
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeHidden()
  const expectNoHorizontalOverflow = async () => {
    const viewport = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth)
  }
  await expectReopenHandle('inspector', 'system-bottom')
  await expectNoHorizontalOverflow()
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expectReopenHandle('hierarchy', 'system-bottom')
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expectReopenHandle('inspector', 'system-bottom')
  await expectNoHorizontalOverflow()

  await page.setViewportSize({ width: 390, height: 300 })
  const compactLabelStyle = await page.getByRole('button', { name: 'Show inspector panel' })
    .locator('.panel-reopen-label')
    .evaluate(label => {
      const style = getComputedStyle(label)
      return {
        fontSize: style.fontSize,
        writingMode: style.writingMode,
      }
    })
  expect(compactLabelStyle).toEqual({
    fontSize: '8px',
    writingMode: 'horizontal-tb',
  })
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()
  await expect(hierarchy).toBeHidden()
  await expectReopenHandle('hierarchy')
  await page.getByRole('button', { name: 'Show hierarchy panel' }).click()
  await expect(hierarchy).toBeVisible()
  await expect(inspector).toBeHidden()
  await expectReopenHandle('inspector')
  await expectNoHorizontalOverflow()

  await page.locator('#workspace-hierarchy-panel')
    .getByRole('button', { name: 'Open Vesper system map' }).click()
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'Show inspector panel' }).click()
  await expect(inspector).toBeVisible()

  const primaryStar = hierarchy.getByRole('button', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  await editMapObject(page)
  const nameInput = page.getByLabel('Name', { exact: true })
  await nameInput.focus()
  await page.keyboard.press('Delete')
  await expect(primaryStar).toBeVisible()
  await page.getByRole('button', { name: 'Cancel map object edits' }).click()
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

test('the system map expands beyond its initial bounds and exports the full layout', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  for (let index = 0; index < 8; index += 1) {
    await navigation.getByRole('button', { name: 'Zoom out' }).click()
  }
  await expect(navigation.getByLabel('Zoom level')).toHaveText('25%')
  await dragOrbitToWorldPoint(page, orbit, { x: 1550, y: 280 })
  expect(Number(await orbit.getAttribute('aria-valuenow'))).toBeGreaterThan(960)

  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await dragHtmlElementToWorldPoint(page, planetButton, map, { x: 1400, y: 700 })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Far Planet')
  await saveMapObject(page)
  const planet = map.getByRole('button', { name: /Far Planet/ })
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 1750, y: 800 })
  const farPosition = await planet.evaluate((element) => {
    const values = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!values) throw new Error('The moved map object has no schematic position.')
    return { x: Number(values[1]), y: Number(values[2]) }
  })
  expect(farPosition.x).toBeGreaterThan(960)
  expect(farPosition.y).toBeGreaterThan(560)
  const farTransform = await planet.getAttribute('transform')
  if (!farTransform) throw new Error('The expanded planet has no map position.')

  const surfaces = await map.evaluate((element) => {
    const rect = (selector: string) => {
      const surface = element.querySelector<SVGRectElement>(selector)
      if (!surface) throw new Error(`The map is missing ${selector}.`)
      return Object.fromEntries(['x', 'y', 'width', 'height'].map(attribute => [
        attribute,
        Number(surface.getAttribute(attribute)),
      ]))
    }
    return { background: rect('.map-background'), grid: rect('.map-grid') }
  })
  expect(surfaces.background).toEqual(surfaces.grid)
  expect(surfaces.background.x).toBeLessThan(0)
  expect(surfaces.background.y).toBeLessThan(0)
  expect(surfaces.background.x + surfaces.background.width).toBeGreaterThan(farPosition.x)
  expect(surfaces.background.y + surfaces.background.height).toBeGreaterThan(farPosition.y)

  await navigation.getByRole('button', { name: 'Fit map' }).click()
  const mapBounds = await map.boundingBox()
  const orbitBounds = await map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
    .locator('.orbit-ring').boundingBox()
  const planetBounds = await planet.boundingBox()
  if (!mapBounds || !orbitBounds || !planetBounds) {
    throw new Error('The expanded system map did not render its contents.')
  }
  for (const bounds of [orbitBounds, planetBounds]) {
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)
  }

  const svg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const svgInfo = await inspectImageSvg(page, svg.text!)
  expect(svgInfo.texts).toContain('Far Planet')
  expect(svgInfo.viewBox[0]).toBeLessThan(0)
  expect(svgInfo.viewBox[1]).toBeLessThan(0)
  expect(svgInfo.viewBox[0] + svgInfo.viewBox[2]).toBeGreaterThan(farPosition.x)
  expect(svgInfo.viewBox[1] + svgInfo.viewBox[3]).toBeGreaterThan(farPosition.y)
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBe(svgInfo.width)
  expect(png.height).toBe(svgInfo.height)
  if (!png.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  expect((await inspectImageSvg(page, png.sourceSvgText)).texts).toContain('Far Planet')

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('button', { name: 'Select A, Primary Star' }))
    .toHaveAttribute('transform', 'translate(480 280)')
  const restoredPlanet = restoredMap.getByRole('button', { name: /Far Planet/ })
  await expect(restoredPlanet).toHaveAttribute('transform', farTransform)
  const restoredNavigation = page.getByRole('toolbar', { name: 'Map navigation' })
  for (let index = 0; index < 8; index += 1) {
    await restoredNavigation.getByRole('button', { name: 'Zoom out' }).click()
  }
  await dragToWorldPoint(page, restoredMap, restoredPlanet.locator('.object-hit-target'), {
    x: 1850,
    y: 850,
  })
  const editedPosition = await restoredPlanet.getAttribute('transform')
  expect(editedPosition).toContain('translate(')
  expect(Number(editedPosition?.match(/^translate\(([^ ]+)/)?.[1])).toBeGreaterThan(1800)
  await expect(page.getByText('Saved on this device')).toBeVisible()
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  })
  const angleBeforeResize = await orbitalAngle(map)
  const orbitRadius = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  const radiusBeforeResize = Number(await orbitRadius.getAttribute('rx'))
  const uniformResizeStartAngle = 0.5
  await dragOrbitToWorldPoint(page, orbitRadius, {
    x: 480 + 153 * Math.cos(uniformResizeStartAngle),
    y: 280 + 153 * Math.sin(uniformResizeStartAngle),
  }, uniformResizeStartAngle)
  await expect.poll(async () => {
    const horizontalRadius = Number(await orbitRadius.getAttribute('rx'))
    const verticalRadius = Number(await orbitRadius.getAttribute('ry'))
    return horizontalRadius > radiusBeforeResize && horizontalRadius === verticalRadius
  }).toBe(true)
  const resizedOrbitRadius = Number(await orbitRadius.getAttribute('aria-valuenow'))
  expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
  await largeOrbitRadius.press('End')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
  await page.keyboard.press('ArrowRight')
  await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')

  await addCatalogueObject(page, 'hazard')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Glass Wake')
  await saveMapObject(page)
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
    .toHaveAttribute('aria-valuenow', String(resizedOrbitRadius))
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Departure')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Arrival')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('From Jump Point').selectOption({ label: 'Departure (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Arrival (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()

  const routeMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Departure.*Arrival/ })
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

test('dragging an Orbit ring scales both axes and the system caption stays concise', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 480, y: 280 },
  )
  await expect(map.getByRole('group', { name: 'Orbit 1 around Primary Star' })).toBeVisible()
  await addCatalogueObject(page, 'planet')

  await expect(map.locator('.map-caption')).toHaveCount(0)
  const resizeKnobs = map.locator('.orbit-resize-handle')
  await expect(resizeKnobs).toHaveCount(0)

  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  const orbitRing = orbit.locator('.orbit-ring')
  const orbitTarget = orbit.locator('.orbit-hit-target')
  await orbitTarget.scrollIntoViewIfNeeded()
  await expect(orbitTarget).toHaveAttribute('role', 'slider')
  const radiusXBefore = Number(await orbitRing.getAttribute('rx'))
  const radiusYBefore = Number(await orbitRing.getAttribute('ry'))
  const planet = map.getByRole('button', { name: /New planet 1/ })
  const planetBefore = await planet.getAttribute('transform')
  const globalScale = 1.25
  const globalStartAngle = 0.5
  await dragOrbitToWorldPoint(page, orbitTarget, {
    x: 480 + radiusXBefore * globalScale * Math.cos(globalStartAngle),
    y: 280 + radiusYBefore * globalScale * Math.sin(globalStartAngle),
  }, globalStartAngle)
  await expect.poll(async () => Number(await orbitRing.getAttribute('rx')))
    .toBeGreaterThan(radiusXBefore)
  await expect.poll(async () => Number(await orbitRing.getAttribute('ry')))
    .toBeGreaterThan(radiusYBefore)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
})

test('the Warden can edit, save, export, and import an elliptical Orbit around an unoccupied center', async ({ page }) => {
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
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const dropPoint = { x: 360, y: 320 }
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    dropPoint,
  )
  const orbitLabel = 'Orbit 1 around unoccupied center'
  const orbit = map.getByRole('group', { name: orbitLabel })
  const ring = orbit.locator('.orbit-ring')
  await expect(map.locator('.orbit-label')).toHaveCount(0)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - dropPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - dropPoint.y),
  ).toBeLessThan(1)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }))
    .toBeVisible()

  const centerHandle = orbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const movedCenter = { x: dropPoint.x + 32, y: dropPoint.y + 24 }
  await dragToWorldPoint(page, map, centerHandle, movedCenter)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - movedCenter.x),
  ).toBeLessThan(2)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - movedCenter.y),
  ).toBeLessThan(2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByLabel('Horizontal radius').fill('300')
  await page.getByLabel('Vertical radius').fill('50')
  await page.getByLabel('Center X').fill('0.2')
  await page.getByLabel('Center Y').fill('0.5')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(ring).toHaveAttribute('rx', '300')
  await expect(ring).toHaveAttribute('ry', '50')

  await addCatalogueObject(page, 'star')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary A')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  await addCatalogueObject(page, 'star')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary B')
  await saveMapObject(page)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 2 objects/ }))
    .toBeVisible()

  const geometry = await ring.evaluate(element => ({
    cx: Number(element.getAttribute('cx')),
    cy: Number(element.getAttribute('cy')),
    rx: Number(element.getAttribute('rx')),
    ry: Number(element.getAttribute('ry')),
  }))
  const firstAngle = Math.PI / 4
  const secondAngle = 2.4
  const normalX = Math.cos(firstAngle) / geometry.rx
  const normalY = Math.sin(firstAngle) / geometry.ry
  const normalLength = Math.hypot(normalX, normalY)
  const firstDropPoint = {
    x: geometry.cx + geometry.rx * Math.cos(firstAngle) + 10 * normalX / normalLength,
    y: geometry.cy + geometry.ry * Math.sin(firstAngle) + 10 * normalY / normalLength,
  }
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary A/ }).locator('.object-hit-target'),
    firstDropPoint,
  )
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary B/ }).locator('.object-hit-target'),
    {
      x: geometry.cx + geometry.rx * Math.cos(secondAngle),
      y: geometry.cy + geometry.ry * Math.sin(secondAngle),
    },
  )
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(firstAngle, 2)
  const angleBeforeResize = await ellipticalOrbitAngle(map, orbitLabel, 'Binary A')
  const secondAngleBeforeResize = await ellipticalOrbitAngle(map, orbitLabel, 'Binary B')
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  const horizontalHandle = orbit.locator('.orbit-axis-handle--horizontal')
  const verticalHandle = orbit.locator('.orbit-axis-handle--vertical')
  await expect(horizontalHandle).toBeVisible()
  await expect(verticalHandle).toBeVisible()
  await dragToWorldPoint(page, map, horizontalHandle, { x: geometry.cx + 320, y: geometry.cy })
  await expect(ring).toHaveAttribute('rx', '320')
  await expect(ring).toHaveAttribute('ry', '50')
  await dragToWorldPoint(page, map, verticalHandle, { x: geometry.cx, y: geometry.cy - 60 })
  await expect(ring).toHaveAttribute('rx', '320')
  await expect(ring).toHaveAttribute('ry', '60')

  const globalScale = 1.25
  const globalStartAngle = 1.4
  await dragOrbitToWorldPoint(
    page,
    orbit.locator('.orbit-hit-target'),
    {
      x: geometry.cx + 320 * globalScale * Math.cos(globalStartAngle),
      y: geometry.cy + 60 * globalScale * Math.sin(globalStartAngle),
    },
    globalStartAngle,
  )
  const globallyResizedHorizontalRadius = Number(await ring.getAttribute('rx'))
  const globallyResizedVerticalRadius = Number(await ring.getAttribute('ry'))
  expect(Math.abs(globallyResizedHorizontalRadius - 400)).toBeLessThanOrEqual(3)
  expect(Math.abs(globallyResizedVerticalRadius - 75)).toBeLessThanOrEqual(3)
  expect(Math.abs(globallyResizedHorizontalRadius / 320 - globallyResizedVerticalRadius / 60))
    .toBeLessThan(0.02)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary B'))
    .toBeCloseTo(secondAngleBeforeResize, 2)

  const rotationHandle = orbit.locator('.orbit-rotation-handle')
  await expect(rotationHandle).toBeVisible()
  const handlePosition = await rotationHandle.evaluate(element => ({
    x: Number(element.getAttribute('cx')),
    y: Number(element.getAttribute('cy')),
  }))
  const handleTurn = Math.PI / 4
  await dragToWorldPoint(page, map, rotationHandle, {
    x: geometry.cx
      + (handlePosition.x - geometry.cx) * Math.cos(handleTurn)
      - (handlePosition.y - geometry.cy) * Math.sin(handleTurn),
    y: geometry.cy
      + (handlePosition.x - geometry.cx) * Math.sin(handleTurn)
      + (handlePosition.y - geometry.cy) * Math.cos(handleTurn),
  })
  await expect.poll(() => orbitRotationDegrees(ring)).toBeCloseTo(45, 0)
  const handleRotationRadians = await orbitRotationDegrees(ring) * Math.PI / 180
  await dragToWorldPoint(page, map, verticalHandle, {
    x: geometry.cx + 90 * Math.sin(handleRotationRadians),
    y: geometry.cy - 90 * Math.cos(handleRotationRadians),
  })
  await expect(ring).toHaveAttribute('rx', String(globallyResizedHorizontalRadius))
  await expect(ring).toHaveAttribute('ry', '90')
  const resizedHorizontalRadius = Number(await ring.getAttribute('rx'))
  const resizedVerticalRadius = Number(await ring.getAttribute('ry'))
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const navigation = page.getByRole('toolbar', { name: 'Map navigation' })
  const zoomLevel = navigation.getByLabel('Zoom level')
  const zoomBeforeBackgroundWheel = await zoomLevel.textContent()
  await moveToWorldPoint(page, map, { x: 900, y: 100 })
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect.poll(() => zoomLevel.textContent()).not.toBe(zoomBeforeBackgroundWheel)
  await navigation.getByRole('button', { name: 'Fit map' }).click()

  const rotationBeforeWheel = await orbitRotationDegrees(ring)
  const zoomBeforeOrbitWheel = await zoomLevel.textContent()
  await moveToWorldPoint(page, map, await ellipticalOrbitPoint(map, orbitLabel, 5.3))
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect.poll(() => orbitRotationDegrees(ring))
    .toBeCloseTo(rotationBeforeWheel - 5, 1)
  await expect.poll(() => zoomLevel.textContent()).toBe(zoomBeforeOrbitWheel)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const newPlanetAngle = 3.1
  const planetButton = await selectCatalogueObjectButton(page, 'planet')
  await dragHtmlElementToWorldPoint(
    page,
    planetButton,
    map,
    await ellipticalOrbitPoint(map, orbitLabel, newPlanetAngle),
  )
  const newPlanet = map.getByRole('button', { name: /New planet 1/ })
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'New planet 1'))
    .toBeCloseTo(newPlanetAngle, 2)
  const movedPlanetAngle = 1.5
  await dragToWorldPoint(
    page,
    map,
    newPlanet.locator('.object-hit-target'),
    await ellipticalOrbitPoint(map, orbitLabel, movedPlanetAngle),
  )
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'New planet 1'))
    .toBeCloseTo(movedPlanetAngle, 2)

  const finalRotation = await orbitRotationDegrees(ring)

  const centerIsOccupied = await map.evaluate((element, label) => {
    const orbitMark = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === label)
    const ellipse = orbitMark?.querySelector<SVGEllipseElement>('.orbit-ring')
    if (!ellipse) throw new Error('The unhosted Orbit did not render as an ellipse.')
    return [...element.querySelectorAll<SVGGElement>('.system-object')].some((object) => {
      const transform = object.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
      return !!transform
        && Number(transform[1]) === Number(ellipse.getAttribute('cx'))
        && Number(transform[2]) === Number(ellipse.getAttribute('cy'))
    })
  }, orbitLabel)
  expect(centerIsOccupied).toBe(false)

  await navigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, map, { x: 24, y: 18 })
  await navigation.getByRole('button', { name: 'Fit map' }).click()
  await expect(ring).toBeVisible()

  const systemExport = await downloadJson(page, 'Export star system JSON')
  const system = systemExport.system!
  const exportedOrbit = system.orbits.find(candidate => candidate.hostId === null)!
  expect(exportedOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(systemExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(systemExport.layout.orbitRadii[exportedOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(systemExport.layout.orbitRotations?.[exportedOrbit.id]).toBeCloseTo(finalRotation, 4)
  const exportedStars = system.objects.filter(object => object.name.startsWith('Binary '))
  expect(exportedStars).toHaveLength(2)
  expect(exportedStars.map(object => object.placement))
    .toEqual([{ kind: 'orbit', orbitId: exportedOrbit.id }, { kind: 'orbit', orbitId: exportedOrbit.id }])
  expect(exportedStars.every(object => Number.isFinite(systemExport.layout.objectAngles[object.id])))
    .toBe(true)

  const svg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const scene = await page.evaluate((content) => {
    const document = new DOMParser().parseFromString(content, 'image/svg+xml')
    const orbitRing = document.querySelector<SVGEllipseElement>('.orbit-ring')
    return {
      tagName: orbitRing?.tagName,
      rx: Number(orbitRing?.getAttribute('rx')),
      ry: Number(orbitRing?.getAttribute('ry')),
      orbitLabelCount: document.querySelectorAll('.orbit-label').length,
      resizeHandleCount: document.querySelectorAll('.orbit-axis-handle').length,
      editControlCount: document.querySelectorAll('.orbit-edit-control').length,
      rotation: Number(orbitRing?.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+) /)?.[1] ?? 0),
      text: document.documentElement.textContent ?? '',
    }
  }, svg.text!)
  expect(scene).toMatchObject({
    tagName: 'ellipse',
    rx: resizedHorizontalRadius,
    ry: resizedVerticalRadius,
    orbitLabelCount: 0,
    resizeHandleCount: 0,
    editControlCount: 0,
    rotation: finalRotation,
  })
  expect(scene.text).toContain('Binary A')
  expect(scene.text).toContain('Binary B')
  expect(scene.text).not.toContain('Orbit 1')
  const png = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.sourceSvgText).toContain('<ellipse')
  expect(png.sourceSvgText).toContain('Binary A')
  expect(png.sourceSvgText).toContain('Binary B')
  expect(png.sourceSvgText).not.toContain('orbit-axis-handle')
  expect(png.sourceSvgText).not.toContain('orbit-rotation-handle')
  expect(png.sourceSvgText).not.toContain('orbit-edit-control')
  expect(png.sourceSvgText).not.toContain('class="orbit-label"')

  await expect(page.getByText('Saved on this device')).toBeVisible()
  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  const restoredOrbit = restoredMap.getByRole('group', { name: orbitLabel })
  const restoredRing = restoredOrbit.locator('.orbit-ring')
  await expect(restoredRing).toHaveAttribute('rx', String(resizedHorizontalRadius))
  await expect(restoredRing).toHaveAttribute('ry', String(resizedVerticalRadius))
  await expect.poll(() => orbitRotationDegrees(restoredRing)).toBeCloseTo(finalRotation, 4)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 3 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const input = page.getByLabel('JSON map file')
  const importPreview = page.waitForEvent('dialog')
  await setJsonFile(input, 'elliptical-system.json', JSON.stringify(systemExport))
  await (await importPreview).accept()
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = clusterExport.cluster!.systems.find(candidate =>
    candidate.id !== system.id && candidate.name === system.name,
  )!
  const importedOrbit = importedSystem.orbits.find(candidate => candidate.hostId === null)!
  expect(importedOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(clusterExport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(clusterExport.layout.orbitRotations?.[importedOrbit.id]).toBeCloseTo(finalRotation, 4)
  const importedStars = importedSystem.objects.filter(object => object.name.startsWith('Binary '))
  expect(importedStars).toHaveLength(2)
  expect(importedStars.every(object => object.placement.kind === 'orbit'
    && object.placement.orbitId === importedOrbit.id)).toBe(true)
  expect(importedStars.every(object => Number.isFinite(clusterExport.layout.objectAngles[object.id])))
    .toBe(true)

  const sourceSystemIds = new Set(clusterExport.cluster!.systems.map(candidate => candidate.id))
  const clusterPreview = page.waitForEvent('dialog')
  await setJsonFile(input, 'elliptical-cluster.json', JSON.stringify(clusterExport))
  await (await clusterPreview).accept()
  const clusterRoundTrip = await downloadJson(page, 'Export Jump Cluster JSON')
  const roundTripSystem = clusterRoundTrip.cluster!.systems
    .filter(candidate => !sourceSystemIds.has(candidate.id))
    .find(candidate => candidate.orbits.some(orbit => orbit.hostId === null))!
  const roundTripOrbit = roundTripSystem.orbits.find(orbit => orbit.hostId === null)!
  expect(roundTripOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(clusterRoundTrip.layout.orbitRadii[roundTripOrbit.id])
    .toEqual({ horizontal: resizedHorizontalRadius, vertical: resizedVerticalRadius })
  expect(clusterRoundTrip.layout.orbitRotations?.[roundTripOrbit.id])
    .toBeCloseTo(finalRotation, 4)
  const roundTripStars = roundTripSystem.objects.filter(object => object.name.startsWith('Binary '))
  expect(roundTripStars).toHaveLength(2)
  expect(roundTripStars.every(object => object.placement.kind === 'orbit'
    && object.placement.orbitId === roundTripOrbit.id)).toBe(true)
})

test('the Warden can detach a hosted Orbit and move its unoccupied center', async ({ page }) => {
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
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await expect(hierarchy.getByRole('button', { name: /Orbit 2 around Iria, 0 objects/ }))
    .toBeVisible()

  const hostedOrbitLabel = 'Orbit 1 around Iria'
  const hostedOrbit = map.getByRole('group', { name: hostedOrbitLabel })
  const hostedRing = hostedOrbit.locator('.orbit-ring')
  const originalCenter = {
    x: Number(await hostedRing.getAttribute('cx')),
    y: Number(await hostedRing.getAttribute('cy')),
  }
  const originalRadii = {
    horizontal: Number(await hostedRing.getAttribute('rx')),
    vertical: Number(await hostedRing.getAttribute('ry')),
  }
  const angleBeforeDetach = await ellipticalOrbitAngle(map, hostedOrbitLabel, 'Nix')
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ }).click()
  await page.getByRole('button', { name: 'Detach Orbit' }).click()

  const detachedOrbitLabel = 'Orbit 1 around unoccupied center'
  const detachedOrbit = map.getByRole('group', { name: detachedOrbitLabel })
  const detachedRing = detachedOrbit.locator('.orbit-ring')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 1 object/ }))
    .toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Detach Orbit' })).toHaveCount(0)
  await expect(detachedRing).toHaveAttribute('rx', String(originalRadii.horizontal))
  await expect(detachedRing).toHaveAttribute('ry', String(originalRadii.vertical))

  const detachedCenter = {
    x: Number(await detachedRing.getAttribute('cx')),
    y: Number(await detachedRing.getAttribute('cy')),
  }
  expect(Math.hypot(
    detachedCenter.x - originalCenter.x,
    detachedCenter.y - originalCenter.y,
  )).toBeGreaterThanOrEqual(40)
  await expect.poll(() => ellipticalOrbitAngle(map, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)

  const centerHandle = detachedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const objectBeforeMove = await map.getByRole('button', { name: /Nix/ }).getAttribute('transform')
  const movedCenter = { x: detachedCenter.x + 64, y: detachedCenter.y + 32 }
  await dragToWorldPoint(page, map, centerHandle, movedCenter)
  await expect.poll(async () =>
    Math.abs(Number(await detachedRing.getAttribute('cx')) - movedCenter.x),
  ).toBeLessThan(2)
  await expect.poll(async () =>
    Math.abs(Number(await detachedRing.getAttribute('cy')) - movedCenter.y),
  ).toBeLessThan(2)
  await expect.poll(async () => map.getByRole('button', { name: /Nix/ }).getAttribute('transform'))
    .not.toBe(objectBeforeMove)
  await expect.poll(() => ellipticalOrbitAngle(map, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  const exported = await downloadJson(page, 'Export star system JSON')
  const exportedSystem = exported.system
  if (!exportedSystem) throw new Error('The exported file does not contain a star system.')
  const exportedDetachedOrbit = exportedSystem.orbits.find(orbit => orbit.hostId === null)
  const persistedCenter = {
    x: Number(await detachedRing.getAttribute('cx')),
    y: Number(await detachedRing.getAttribute('cy')),
  }
  expect(exportedDetachedOrbit?.order).toBe(1)
  expect(exportedDetachedOrbit?.center?.x).toBeCloseTo((persistedCenter.x - 64) / 832, 5)
  expect(exportedDetachedOrbit?.center?.y).toBeCloseTo((persistedCenter.y - 72) / 416, 5)
  const iria = exportedSystem.objects.find(object => object.name === 'Iria')
  if (!iria) throw new Error('The exported Orbit host was not found.')
  expect(exportedSystem.orbits.filter(orbit => orbit.hostId === iria.id).map(orbit => orbit.order))
    .toEqual([1])

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  const restoredRing = restoredMap.getByRole('group', { name: detachedOrbitLabel }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cx')) - persistedCenter.x),
  ).toBeLessThan(0.01)
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cy')) - persistedCenter.y),
  ).toBeLessThan(0.01)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
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

test('dragging Add Orbit onto a map object hosts it there', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const host = map.getByRole('button', { name: /Primary Star/ })
  const hostPoint = await host.evaluate(element => {
    const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!transform) throw new Error('Could not locate the host object on the map.')
    return { x: Number(transform[1]), y: Number(transform[2]) }
  })

  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    hostPoint,
  )

  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()
  const ring = map.getByRole('group', { name: 'Orbit 1 around Primary Star' }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y),
  ).toBeLessThan(1)
})

test('dropping an existing unoccupied Orbit center onto an object hosts it there', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 360, y: 320 },
  )

  const unoccupiedOrbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })
  const centerHandle = unoccupiedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const host = map.getByRole('button', { name: /Primary Star/ })
  const hostPoint = await host.evaluate(element => {
    const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!transform) throw new Error('Could not locate the host object on the map.')
    return { x: Number(transform[1]), y: Number(transform[2]) }
  })

  await dragToWorldPoint(page, map, centerHandle, hostPoint)

  const hostedOrbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  await expect(hostedOrbit).toBeVisible()
  const ring = hostedOrbit.locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y),
  ).toBeLessThan(1)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()

  await page.reload()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(restoredMap.getByRole('group', { name: 'Orbit 1 around Primary Star' }))
    .toBeVisible()
})

test('object palette drag previews match placed marks and preserve map, Orbit, and keyboard adds', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
    const originalSetDragImage = DataTransfer.prototype.setDragImage
    DataTransfer.prototype.setDragImage = function (image, offsetX, offsetY) {
      const bounds = image.getBoundingClientRect()
      const dragPreviewWindow = window as DragPreviewWindow
      dragPreviewWindow.__dragPreview = {
        height: bounds.height,
        offsetX,
        offsetY,
        tagName: image.tagName,
        text: image.textContent?.trim() ?? '',
        width: bounds.width,
      }
      originalSetDragImage.call(this, image, offsetX, offsetY)
    }
  })
  const assertDragPreview = async (expectedText: string): Promise<string> => {
    const preview = await page.evaluate(() => (window as DragPreviewWindow).__dragPreview)
    if (!preview) throw new Error('The drag did not set a custom preview.')
    expect(preview).toMatchObject({ tagName: 'SPAN', text: expectedText })
    expect(preview.width).toBeGreaterThan(0)
    expect(preview.offsetX).toBeGreaterThan(preview.width)
    expect(preview.offsetX - preview.width).toBeLessThanOrEqual(12)
    expect(preview.offsetY).toBeCloseTo(preview.height / 2, 1)
    return preview.text
  }
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const palette = page.getByRole('region', { name: 'Object palette' })
  await expect(palette).toBeVisible()
  expect(await palette.evaluate(element => element.closest('.system-map-tools') !== null)).toBe(true)
  await setHeaderMapActionsOpen(page, true)
  const fileActions = page.getByRole('group', { name: 'Map file actions for star system Vesper' })
  const fileActionsBefore = await fileActions.evaluate(element => {
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
  expect(fileActionsBefore.exportTop).not.toBeNull()
  expect(fileActionsBefore.buttonsFit).toBe(true)
  await setHeaderMapActionsOpen(page, false)

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const mapObjects = map.locator('.system-object')
  const addStar = await selectCatalogueObjectButton(page, 'star')
  const starMark = (await addStar.locator('.object-mark').textContent())?.trim() ?? ''
  const objectsBeforeStarDrop = await mapObjects.count()
  let starPreviewText = ''
  await page.evaluate(() => {
    (window as DragPreviewWindow).__dragPreview = undefined
  })
  await dragHtmlElementToWorldPoint(page, addStar, map, { x: 320, y: 400 }, async () => {
    starPreviewText = await assertDragPreview(starMark)
  })
  await expect(mapObjects).toHaveCount(objectsBeforeStarDrop + 1)
  await expect(mapObjects.nth(objectsBeforeStarDrop).locator('.system-object-glyph'))
    .toHaveText(starPreviewText)

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  const planetMark = (await addPlanet.locator('.object-mark').textContent())?.trim() ?? ''
  const objectsBeforePlanetDrop = await mapObjects.count()
  let planetPreviewText = ''
  await page.evaluate(() => {
    (window as DragPreviewWindow).__dragPreview = undefined
  })
  await dragHtmlElementToWorldPoint(page, addPlanet, map, { x: 592, y: 280 }, async () => {
    planetPreviewText = await assertDragPreview(planetMark)
  })
  await expect(mapObjects).toHaveCount(objectsBeforePlanetDrop + 1)
  await expect(mapObjects.nth(objectsBeforePlanetDrop).locator('.system-object-glyph'))
    .toHaveText(planetPreviewText)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ }))
    .toBeVisible()

  await page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Chart details' }).click()
  await addPlanet.press('Enter')
  const systemPlanet = hierarchy.getByRole('button', { name: /Select PL-02, New planet 2/ })
  await expect(systemPlanet).toBeVisible()
  await expect(systemPlanet.locator('.object-mark')).toHaveText('◉')
  await dragToWorldPoint(page, map, map.getByRole('button', { name: /New planet 2/ })
    .locator('.object-hit-target'), { x: 592, y: 280 })
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ }))
    .toBeVisible()

  const addHazard = await selectCatalogueObjectButton(page, 'hazard')
  const transformsBeforeCancel = await mapObjects.evaluateAll(objects =>
    objects.map(object => object.getAttribute('transform')),
  )
  const hazardBounds = await addHazard.boundingBox()
  if (!hazardBounds) throw new Error('Could not find the Hazard palette button.')
  await page.mouse.move(hazardBounds.x + hazardBounds.width / 2, hazardBounds.y + hazardBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(1, 1, { steps: 12 })
  await page.mouse.up()
  await expect(mapObjects).toHaveCount(transformsBeforeCancel.length)
  expect(await mapObjects.evaluateAll(objects =>
    objects.map(object => object.getAttribute('transform')),
  )).toEqual(transformsBeforeCancel)

  await setHeaderMapActionsOpen(page, true)
  const fileActionsAfter = await fileActions.evaluate(element => {
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
  expect(fileActionsAfter.top).toBe(fileActionsBefore.top)
  expect(fileActionsAfter.exportTop).toBe(fileActionsBefore.exportTop)
  expect(fileActionsAfter.buttonsFit).toBe(true)
  await setHeaderMapActionsOpen(page, false)

  const exported = await downloadJson(page, 'Export star system JSON')
  const system = exported.system
  if (!system) throw new Error('The exported file does not contain a star system.')
  const orbitId = system.orbits[0].id
  const stars = system.objects.filter(object => object.subtype === 'star')
  expect(stars).toHaveLength(2)
  expect(stars[1]?.placement.kind).toBe('system')
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
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('button', { name: 'Move orbit up' }).click()
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(inspector.getByRole('heading', { name: 'Orbit 1' })).toBeVisible()

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Description').fill('A chlorine cloud deck.')
  await saveMapObject(page)
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ })).toBeVisible()

  const key = page.getByLabel('Location key')
  const originalKey = await key.inputValue()
  await editMapObject(page)
  await key.fill('A')
  await saveMapObject(page)
  await expect(page.getByRole('alert')).toContainText('already used')
  await expect(key).toHaveValue('A')
  await key.fill(originalKey)
  await saveMapObject(page)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'belt')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 2 objects/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Nix')
  await saveMapObject(page)
  await expect(inspector.getByRole('heading', { name: 'Nix' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Iria, 1 object/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Nix/ })).toBeVisible()
  await hierarchy.getByRole('button', { name: /Select .*Nix/ }).click()
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

  await editMapObject(page)
  await page.getByLabel('Type label').fill('Relay Beacon')
  await page.getByLabel('Name', { exact: true }).fill('Relay Beacon Kestrel')
  await page.getByLabel('Schematic X').fill('0.75')
  await page.getByLabel('Schematic Y').fill('0.25')
  await saveMapObject(page)
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

test('older saved Jump Routes and circle/ellipse layouts restore and reject invalid levels', () => {
  const savedWorkspace = {
    id: 'workspace',
    cluster: {
      id: 'cluster',
      name: 'Kestrel Reach',
      systems: [{
        id: 'vesper',
        name: 'Vesper',
        objects: [
          {
            id: 'origin',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Vesper Exit',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          },
          {
            id: 'destination',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.2',
            name: 'Harrow Entry',
            description: '',
            placement: { kind: 'system', x: 0.7, y: 0.5 },
          },
        ],
        orbits: [],
      }],
      routes: [{
        id: 'route',
        name: 'Jump-01',
        fromPointId: 'origin',
        toPointId: 'destination',
      }],
    },
    layout: { systemPositions: { vesper: { x: 0.5, y: 0.5 } } },
  }
  const restored = restoreLocalWorkspace(savedWorkspace)

  expect(restored?.cluster.routes).toMatchObject([{
    id: 'route',
    jumpLevel: 1,
    fromPointId: 'origin',
    toPointId: 'destination',
  }])
  expect(restored?.layout.orbitRotations).toEqual({})

  const legacyOrbitWorkspace = {
    ...savedWorkspace,
    cluster: {
      ...savedWorkspace.cluster,
      systems: savedWorkspace.cluster.systems.map(system => ({
        ...system,
        orbits: [
          { id: 'legacy-circle', hostId: 'origin', order: 1 },
          { id: 'legacy-ellipse', hostId: 'origin', order: 2 },
        ],
      })),
    },
    layout: {
      ...savedWorkspace.layout,
      orbitRadii: { 'legacy-circle': 100 },
      orbitEllipseRadii: { 'legacy-ellipse': { horizontal: 200, vertical: 80 } },
    },
  }
  const migrated = restoreLocalWorkspace(legacyOrbitWorkspace)
  expect(migrated?.layout.orbitRadii).toEqual({
    'legacy-circle': { horizontal: 100, vertical: 100 },
    'legacy-ellipse': { horizontal: 200, vertical: 80 },
  })
  expect(migrated?.layout).not.toHaveProperty('orbitEllipseRadii')

  for (const jumpLevel of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(restoreLocalWorkspace({
      ...savedWorkspace,
      cluster: {
        ...savedWorkspace.cluster,
        routes: savedWorkspace.cluster.routes.map(route => ({ ...route, jumpLevel })),
      },
    })).toBeNull()
  }
})

test('restoring a workspace removes legacy object targets without deleting values', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const fieldId = 'legacy-field'
  const restored = restoreLocalWorkspace({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(currentSystem => ({
        ...currentSystem,
        objects: currentSystem.objects.map(currentObject => currentObject.id === object.id
          ? { ...currentObject, customFieldValues: { [fieldId]: 'Still here.' } }
          : currentObject),
      })),
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [{
        id: fieldId,
        name: 'Campaign notes',
        type: 'text',
        applicability: [
          { kind: 'object', objectId: object.id },
          { kind: 'category', family: object.family },
          { kind: 'subtype', family: object.family, subtype: object.subtype },
        ],
      }],
    },
  })

  expect(restored?.objectFieldSettings.customFields[0]?.applicability).toEqual([
    { kind: 'category', family: object.family },
    { kind: 'subtype', family: object.family, subtype: object.subtype },
  ])
  expect(restored?.cluster.systems[0]?.objects[0]?.customFieldValues?.[fieldId]).toBe('Still here.')
})

test('the Warden can connect Jump Points across a cluster and record an unresolved exit', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Gate')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await editMapObject(page)
  const station = page.getByLabel('Physical Jump Station')
  const stationOption = page.getByRole('option', { name: /Vesper Gate/ })
  const stationId = await stationOption.getAttribute('value')
  expect(stationId).toBeTruthy()
  await station.selectOption(stationId!)
  await saveMapObject(page)
  await expect(station).toHaveValue(stationId!)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('3')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const knownRoute = clusterMap.getByRole('button', {
    name: /Jump Level 3.*Vesper Exit.*Harrow Entry.*New System 2/,
  })
  await expect(knownRoute).toBeVisible()
  await knownRoute.click()
  await expect(routeInspector.getByRole('heading', { name: 'Jump Level 3', level: 2 })).toBeVisible()
  await expect(routeInspector.locator('.orbit-facts')).toContainText('New System 2')
  await routeInspector.getByRole('button', { name: 'Edit Jump Route' }).click()
  await expect(routeInspector.getByText('Destination system: New System 2')).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('12')
  await routeInspector.getByRole('button', { name: 'Save Jump Route' }).click()
  const customLevelRoute = clusterMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Exit.*Harrow Entry.*New System 2/,
  })
  await expect(customLevelRoute).toBeVisible()

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Arrival')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Arrival.*Harrow Entry.*New System 2/,
  })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('15')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Arrival (Vesper)' })
  await page.getByLabel('Route destination').selectOption('external')
  await page.getByLabel('Unknown destination label').fill('Unknown Rim')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const unknownRoute = clusterMap.getByRole('button', {
    name: /Jump Level 15.*Vesper Arrival.*unknown destination.*Unknown Rim/i,
  })
  await expect(unknownRoute).toBeVisible()
  await expect(routeInspector.getByRole('heading', { name: 'Jump Level 15', level: 2 })).toBeVisible()
  await expect(routeInspector.getByText('Unknown destination: Unknown Rim', { exact: true })).toBeVisible()
  await expect(clusterMap.getByRole('button', { name: /Open .* system map/ })).toHaveCount(2)
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredMap.getByRole('button', {
    name: /Jump Level 12.*Vesper Arrival.*Harrow Entry.*New System 2/,
  })).toBeVisible()
  await expect(restoredMap.getByRole('button', {
    name: /Jump Level 15.*Vesper Arrival.*unknown destination.*Unknown Rim/i,
  })).toBeVisible()
  await restoredMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  await expect(page.getByLabel('Physical Jump Station')).toHaveValue(stationId!)
})

test('Chart details is an active, keyboard-accessible inspector view', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const chartDetails = page.getByRole('button', { name: 'Chart details' })
  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  const systemInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  const activeAppearance = await chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await expect(systemInspector.getByText('MAP OBJECT / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.move(0, 0)
  const selectedAppearance = await chartDetails.evaluate((button) => {
    const style = getComputedStyle(button)
    return `${style.borderColor} ${style.backgroundColor}`
  })
  expect(activeAppearance).not.toBe(selectedAppearance)
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await expect(systemInspector.getByText('SYSTEM STRUCTURE / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(systemInspector.getByText('CHART DETAILS', { exact: true })).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')

  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  const routeInspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await expect(page.getByRole('button', { name: 'Chart details' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const route = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Exit/ })
  await expect(route).toBeVisible()
  await route.click()
  await expect(routeInspector.getByText('JUMP ROUTE / SELECTED')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'false')
  await chartDetails.press('Enter')
  await expect(routeInspector.getByText('CLUSTER DETAILS')).toBeVisible()
  await expect(chartDetails).toHaveAttribute('aria-pressed', 'true')
})

test('the Warden can configure native and reusable custom object fields', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Atmosphere choices').fill('Breathable\nThin\nChlorine')
  await fieldDialog.getByRole('button', { name: 'Save changes' }).click()
  await fieldDialog.getByRole('button', { name: /Port class/ }).click()
  await editFieldDefinition(fieldDialog)
  await fieldDialog.getByLabel('Port class choices').fill('Class I\nClass II')
  await fieldDialog.getByRole('button', { name: 'Save changes' }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await addCustomFieldThroughDialog(page, 'Threat level', 'number')
  await addCustomFieldThroughDialog(page, 'Hostile', 'boolean')
  await addCustomFieldThroughDialog(page, 'Signal class', 'single-select', 'Amber\nBlue')
  const signalClassDialog = await openFieldDefinitionDialog(page)
  await signalClassDialog.getByRole('button', { name: /Signal class/ }).click()
  await editFieldDefinition(signalClassDialog)
  await signalClassDialog.getByLabel('Signal class choices').fill('Amber\nBlue\nRed')
  await signalClassDialog.getByRole('button', { name: 'Save changes' }).click()
  await signalClassDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Chlorine')
  await page.getByLabel('Campaign notes').fill('Relay station under the ice.')
  await page.getByLabel('Threat level').fill('4')
  await page.getByLabel('Hostile').selectOption('true')
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await expect(page.getByLabel('Port class', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Campaign notes')).toHaveValue('')
  await editMapObject(page)
  await page.getByLabel('Port class', { exact: true }).selectOption('Class II')
  await saveMapObject(page)

  await addCatalogueObject(page, 'moon')
  await expect(page.getByLabel('Atmosphere', { exact: true })).toBeVisible()
  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Thin')
  await saveMapObject(page)

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
  await editMapObject(page)
  await page.getByLabel('Campaign notes').fill('Reusable in the next system.')
  await saveMapObject(page)

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

test('custom field category and subtype scopes hide ineligible objects without deleting values', async ({ page }) => {
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
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('Planet survey.')
  await saveMapObject(page)

  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Relay Station')
  await page.getByLabel('Campaign notes').fill('Station report.')
  await saveMapObject(page)

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: /Campaign notes/ }).click()
  await expect(dialog.getByRole('radio', { name: 'All catalogue objects' })).toBeChecked()
  await editFieldDefinition(dialog)
  await dialog.getByRole('radio', { name: 'Selected catalogue targets' }).check()
  await expect(dialog.getByRole('heading', { name: 'Objects', exact: true })).toHaveCount(0)
  await dialog.getByLabel('Category Celestial bodies').check()
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await dialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  const categoryDialog = await openFieldDefinitionDialog(page)
  await categoryDialog.getByRole('button', { name: /Campaign notes/ }).click()
  const existingValues = categoryDialog.getByRole('region', { name: 'Existing field values' })
  await expect(existingValues).toContainText('Planet survey.')
  await expect(existingValues).toContainText('Station report.')
  await editFieldDefinition(categoryDialog)
  await categoryDialog.getByLabel('Category Celestial bodies').uncheck()
  await categoryDialog.getByLabel('Subtype Planet').check()
  await categoryDialog.getByRole('button', { name: 'Save changes' }).click()
  await categoryDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await page.reload()
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
  await hierarchy.getByRole('button', { name: /Relay Station/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveCount(0)

  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  await expect(hierarchy.getByRole('button', { name: /Iria/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const cleanupExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const cleanedField = cleanupExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  const remainingStation = cleanupExport.cluster!.systems[0]!.objects
    .find(object => object.name === 'Relay Station')!
  expect(cleanedField.applicability).toEqual([
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(remainingStation.customFieldValues?.[cleanedField.id]).toBe('Station report.')
})

test('custom field category and subtype scopes are united on independent system import', async ({ page }) => {
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
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('Planet survey.')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Aster')
  await page.getByLabel('Campaign notes').fill('Remote survey.')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()

  const definitionDialog = await openFieldDefinitionDialog(page)
  await definitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(definitionDialog)
  await definitionDialog.getByRole('radio', { name: 'Selected catalogue targets' }).check()
  await definitionDialog.getByLabel('Subtype Planet').check()
  await definitionDialog.getByRole('button', { name: 'Save changes' }).click()
  await definitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const sourceExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const sourceSystem = sourceExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const sourcePlanet = sourceSystem.objects.find(object => object.name === 'Iria')!
  const remoteSystem = sourceExport.cluster!.systems.find(system => system.name === 'New System 2')!
  const remotePlanet = remoteSystem.objects.find(object => object.name === 'Aster')!
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  const systemExport = await downloadJson(page, 'Export star system JSON')
  const exportedField = systemExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(exportedField.applicability).toEqual([{
    kind: 'subtype',
    family: 'CelestialBody',
    subtype: 'planet',
  }])

  const existingDefinitionDialog = await openFieldDefinitionDialog(page)
  await existingDefinitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(existingDefinitionDialog)
  await existingDefinitionDialog.getByLabel('Subtype Planet').uncheck()
  await existingDefinitionDialog.getByLabel('Category Celestial bodies').check()
  await existingDefinitionDialog.getByRole('button', { name: 'Save changes' }).click()
  await existingDefinitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const legacySystemExport: unknown = {
    ...systemExport,
    objectFieldSettings: {
      ...systemExport.objectFieldSettings,
      customFields: systemExport.objectFieldSettings.customFields.map(field =>
        field.id === exportedField.id
          ? {
              ...field,
              applicability: [
                ...(field.applicability ?? []),
                { kind: 'object', objectId: sourcePlanet.id },
                { kind: 'object', objectId: remotePlanet.id },
              ],
            }
          : field,
      ),
    },
  }

  const input = page.getByLabel('JSON map file')
  const previewPromise = page.waitForEvent('dialog')
  await setJsonFile(input, 'scoped-system.json', JSON.stringify(legacySystemExport))
  const preview = await previewPromise
  expect(preview.message()).toContain('Compatible custom field definitions are reused')
  await preview.accept()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = importedExport.cluster!.systems.find(system =>
    system.id !== sourceSystem.id && system.name === sourceSystem.name,
  )!
  const importedPlanet = importedSystem.objects.find(object => object.name === 'Iria')!
  expect(importedPlanet.id).not.toBe(sourcePlanet.id)
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(importedField.applicability).toEqual([
    { kind: 'category', family: 'CelestialBody' },
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(importedPlanet.customFieldValues?.[importedField.id]).toBe('Planet survey.')

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).last().click()
  const importedHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await importedHierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
})

test('field definitions dialog stays centered on desktop and narrow viewports', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 720 }]) {
    await page.setViewportSize(viewport)
    const dialog = await openFieldDefinitionDialog(page)
    const bounds = await dialog.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height, viewportWidth: innerWidth, viewportHeight: innerHeight }
    })

    const size = `${viewport.width}x${viewport.height}`
    expect.soft(Math.abs(bounds.x + bounds.width / 2 - bounds.viewportWidth / 2), size).toBeLessThanOrEqual(1)
    expect.soft(Math.abs(bounds.y + bounds.height / 2 - bounds.viewportHeight / 2), size).toBeLessThanOrEqual(1)
    expect.soft(bounds.x, size).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.y, size).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.x + bounds.width, size).toBeLessThanOrEqual(bounds.viewportWidth)
    expect.soft(bounds.y + bounds.height, size).toBeLessThanOrEqual(bounds.viewportHeight)
    await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  }
})

test('field definition management previews destructive changes in a map-bound dialog', async ({ page }) => {
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
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await editMapObject(page)
  await page.getByLabel('Atmosphere', { exact: true }).selectOption('Breathable')
  await saveMapObject(page)

  const openButton = page.getByRole('button', { name: 'Open field definitions' })
  const dialog = await openFieldDefinitionDialog(page)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveAttribute('aria-current', 'true')

  const nativeDialog = await openFieldDefinitionDialog(page)
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(nativeDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Breathable')
  await editFieldDefinition(nativeDialog)
  await nativeDialog.getByLabel('Atmosphere choices').fill('Thin\nVacuum')
  await expect(nativeDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Breathable')
  await nativeDialog.getByRole('button', { name: 'Save changes' }).click()
  const nativeConfirmation = nativeDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(nativeConfirmation).toContainText('Iria')
  await expect(nativeConfirmation).toContainText('Breathable')
  await nativeDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('Breathable')
  await nativeDialog.getByLabel('Atmosphere choices').fill('Thin\nVacuum')
  await nativeDialog.getByRole('button', { name: 'Save changes' }).click()
  await nativeDialog.getByRole('button', { name: 'Remove options and clear affected values' }).click()
  await expect(page.getByLabel('Atmosphere', { exact: true })).toHaveValue('')
  await nativeDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const fieldDialog = await openFieldDefinitionDialog(page)
  await fieldDialog.getByRole('button', { name: 'New custom field' }).click()
  await fieldDialog.getByLabel('Custom field label').fill('Signal class')
  await fieldDialog.getByLabel('Value type').selectOption('single-select')
  await fieldDialog.getByLabel('New field choices').fill('Amber\nRed')
  await fieldDialog.getByRole('button', { name: 'Add custom field', exact: true }).click()
  await fieldDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Signal class', { exact: true }).selectOption('Red')
  await saveMapObject(page)
  const editDialog = await openFieldDefinitionDialog(page)
  await editDialog.getByRole('button', { name: /Signal class/ }).click()
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Iria')
  await expect(editDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Red')
  await editFieldDefinition(editDialog)
  await editDialog.getByLabel('Custom field name').fill('Signal designation')
  await editDialog.getByLabel('Signal class choices').fill('Amber')
  await expect(editDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Iria')
  await expect(editDialog.getByRole('region', { name: 'Affected values preview' })).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  const confirmation = editDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(confirmation).toContainText('Iria')
  await expect(confirmation).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Signal class', { exact: true })).toHaveValue('Red')
  await expect(editDialog.getByRole('button', { name: /Signal class/ })).toBeVisible()

  await editDialog.getByLabel('Custom field name').fill('Signal designation')
  await editDialog.getByLabel('Signal class choices').fill('Amber')
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(confirmation).toContainText('Red')
  await editDialog.getByRole('button', { name: 'Remove options and clear affected values' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('')
  await expect(editDialog.getByRole('button', { name: /Signal designation/ })).toBeVisible()
  await expect(editDialog.getByLabel('Signal designation choices')).toHaveValue('Amber')
  await editDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await page.getByLabel('Signal designation', { exact: true }).selectOption('Amber')
  await saveMapObject(page)
  const updatedExport = await downloadJson(page, 'Export star system JSON')
  expect(updatedExport.objectFieldSettings.customFields).toContainEqual(
    expect.objectContaining({
      name: 'Signal designation',
      type: 'single-select',
      options: ['Amber'],
    }),
  )
  const exportedIria = updatedExport.system!.objects.find(object => object.name === 'Iria')!
  expect(exportedIria.customFieldValues).toMatchObject({
    [updatedExport.objectFieldSettings.customFields.find(field => field.name === 'Signal designation')!.id]: 'Amber',
  })

  await page.reload()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('Amber')
  const deleteDialog = await openFieldDefinitionDialog(page)
  await deleteDialog.getByRole('button', { name: /Signal designation/ }).click()
  await expect(deleteDialog.getByRole('region', { name: 'Existing field values' })).toContainText('Amber')
  await editFieldDefinition(deleteDialog)
  await deleteDialog.getByRole('button', { name: 'Delete field definition' }).click()
  const deleteConfirmation = deleteDialog.getByRole('region', { name: 'Field change confirmation' })
  await expect(deleteConfirmation).toContainText('Iria')
  await expect(deleteConfirmation).toContainText('Amber')
  await deleteDialog.getByRole('button', { name: 'Cancel field changes' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveValue('Amber')
  await deleteDialog.getByRole('button', { name: 'Delete field definition' }).click()
  await deleteDialog.getByRole('button', { name: 'Delete field and clear values' }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
  await deleteDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await page.reload()
  await hierarchy.getByRole('button', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Signal designation', { exact: true })).toHaveCount(0)
})

test('the retired field-definition prototype route is unavailable', async ({ page }) => {
  const response = await page.goto('/prototype/field-definitions')
  expect(response?.status()).toBe(404)
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Iria/ }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Vesper Exit/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Vesper Exit/ }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('1')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Harrow Entry/ })).toBeVisible()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('2')
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2.*Harrow Entry/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Jump Routes' })
    .getByRole('button', { name: /Select Jump Level 2/ })
    .click()
  let directRouteDeletionRequested = false
  let directRouteDeletionPreview = ''
  const routeDeletionDialog = async (dialog: import('@playwright/test').Dialog) => {
    directRouteDeletionRequested = true
    directRouteDeletionPreview = dialog.message()
    await dialog.accept()
  }
  page.on('dialog', routeDeletionDialog)
  await page.getByRole('button', { name: 'Delete Jump Route (Level 2)' }).click()
  await page.off('dialog', routeDeletionDialog)
  expect(directRouteDeletionRequested).toBe(true)
  expect(directRouteDeletionPreview).toContain('Level 2')
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2/ })).toHaveCount(0)

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
  expect(deletionPreview).toContain('Level 1')
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Vesper Exit/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Select .*Nix/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredClusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

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
  await expect(updatedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)

  await page.reload()
  await expect(hierarchy.getByRole('button', { name: /Select .*Iria/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  const reloadedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(reloadedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Gate')
  await saveMapObject(page)
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Arrival')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Vesper Arrival/ }).click()
  await editMapObject(page)
  const physicalStation = page.getByLabel('Physical Jump Station')
  const stationId = await page.getByRole('option', { name: /Vesper Gate/ }).getAttribute('value')
  expect(stationId).toBeTruthy()
  await physicalStation.selectOption(stationId!)
  await saveMapObject(page)
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
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Cluster map' }).click()
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()

  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('8')
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Exit (Vesper)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Entry (New System 2)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  const createdRoute = clusterMap.getByRole('button', { name: /Jump Level 8.*Harrow Entry/ })
  await expect(createdRoute).toBeVisible()
  await expect(createdRoute).toHaveClass(/is-selected/)
  await expect(createdRoute.locator('.cluster-route-label')).toHaveText('Jump-8')
  const clusterMapText = await clusterMap.locator('text').allTextContents()
  expect(clusterMapText).not.toContain('Kestrel Reach')
  expect(clusterMapText).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterMapText).not.toContain('2 SYSTEMS / 1 ROUTES')

  const secondSystem = clusterMap.getByRole('button', { name: 'Open New System 2 system map' })
  await dragBy(page, secondSystem.locator('.cluster-system-card'), { x: 48, y: 24 })
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
  expect(clusterSvgInfo.texts).toEqual(expect.arrayContaining(['Vesper', 'New System 2', 'Jump-8']))
  expect(clusterSvgInfo.texts).not.toContain('Kestrel Reach')
  expect(clusterSvgInfo.texts).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterSvgInfo.texts).not.toContain('2 SYSTEMS / 1 ROUTES')
  expect(clusterSvgInfo.systemTitle).toBeNull()
  expect(clusterSvgInfo.titleStyle).toBeNull()
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
  expect(clusterExport.cluster?.routes[0]?.jumpLevel).toBe(8)
  expect(Object.keys(clusterExport.layout.systemPositions ?? {}).sort())
    .toEqual(clusterExport.cluster!.systems.map(system => system.id).sort())
  expect(clusterExport.layout).not.toHaveProperty('zoom')
  expect(clusterExport.layout).not.toHaveProperty('pan')
  expect(clusterExport).not.toHaveProperty('selectedRouteId')
  const exportedSecondSystem = clusterExport.cluster!.systems.find(system => system.name === 'New System 2')!
  expect(clusterExport.layout.systemPositions?.[exportedSecondSystem.id].x).not.toBe(0.5)

  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('A local secret.')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()

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
  expect(updatedClusterExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(updatedClusterExport.layout).not.toHaveProperty('orbitEllipseRadii')
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
  const systemSceneTop = await systemMap.locator('.system-map-content')
    .evaluate(element => (element as SVGGraphicsElement).getBBox().y)
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  expect(systemSvg.text).toContain('Iria')
  const systemSvgInfo = await inspectImageSvg(page, systemSvg.text!)
  expect(systemSvgInfo.contentTransform).toBeNull()
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThan(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThan(560)
  expect(systemSvgInfo.texts).toContain('Iria')
  const systemTitle = systemSvgInfo.systemTitle
  if (!systemTitle) throw new Error('The exported star system SVG is missing its title.')
  expect(systemTitle.text).toBe('Vesper')
  expect(systemTitle.x).toBeGreaterThan(systemSvgInfo.viewBox[0])
  expect(systemTitle.x + systemTitle.width)
    .toBeLessThanOrEqual(systemSvgInfo.viewBox[0] + systemSvgInfo.viewBox[2] - 24)
  expect(systemTitle.y - systemTitle.fontSize / 2).toBeGreaterThan(systemSvgInfo.viewBox[1])
  expect(systemTitle.y + systemTitle.fontSize / 2).toBeLessThan(systemSceneTop)
  expect(systemSvgInfo.titleStyle).toBeNull()
  expect(systemSvgInfo.glyphFill).toBeTruthy()
  expectReadableExport(systemSvgInfo)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.size).toBeGreaterThan(100)
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  if (!systemPng.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  const systemPngInfo = await inspectImageSvg(page, systemPng.sourceSvgText)
  expect(systemPngInfo.systemTitle?.text).toBe('Vesper')
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
  expect(systemExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(systemExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(systemExport.layout.objectAngles[planet.id]).toBe(updatedClusterExport.layout.objectAngles[planet.id])
  expect(systemExport.layout).not.toHaveProperty('zoom')
  expect(systemExport.layout).not.toHaveProperty('pan')
  expect(systemExport).not.toHaveProperty('selectedObjectId')
  expect(systemExport.objectFieldSettings.customFields).toContainEqual(field)
  expect(systemExport.system?.objects.find(object => object.name === 'Iria')?.customFieldValues?.[field.id])
    .toBe('A local secret.')

  const renamedSystemName = 'W'.repeat(80)
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Star system').fill(renamedSystemName)
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await expect(page.getByRole('group', { name: `${renamedSystemName} star system map` })).toBeVisible()
  const renamedSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const renamedSvgInfo = await inspectImageSvg(page, renamedSvg.text!)
  const renamedTitle = renamedSvgInfo.systemTitle
  if (!renamedTitle) throw new Error('The renamed star system SVG is missing its title.')
  expect(renamedTitle.text).toBe(renamedSystemName)
  expect(renamedSvgInfo.width).toBeGreaterThan(systemSvgInfo.width)
  expect(renamedTitle.x + renamedTitle.width)
    .toBeLessThanOrEqual(renamedSvgInfo.viewBox[0] + renamedSvgInfo.viewBox[2] - 24)
  expectReadableExport(renamedSvgInfo)
  const renamedPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  if (!renamedPng.sourceSvgText) throw new Error('The renamed star system PNG has no source SVG.')
  const renamedPngInfo = await inspectImageSvg(page, renamedPng.sourceSvgText)
  expect(renamedPngInfo.systemTitle?.text).toBe(renamedSystemName)
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
  await setHeaderMapActionsOpen(page, true)
  const invalidFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(importFile, 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
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
          jumpLevel: 12,
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
  const importedRoutes = page.getByRole('navigation', { name: 'Jump Routes' })
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 1.*Alpha Gate.*Beta Gate.*Far Vesper/,
  })).toBeVisible()
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 12.*Beta Gate.*Unknown destination.*Uncharted exit/,
  })).toBeVisible()
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
  expect(importedField.applicability).toBeUndefined()
  expect(firstImport.cluster!.routes.find(route => route.name === 'Known route')).toMatchObject({
    jumpLevel: 1,
    fromPointId: importedPoint.id,
    toPointId: importedBetaPoint.id,
  })
  expect(firstImport.cluster!.routes.find(route => route.name === 'Unknown route')).toMatchObject({
    jumpLevel: 12,
    fromPointId: importedBetaPoint.id,
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  expect(firstImport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(firstImport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 100, vertical: 100 })
  expect(firstImport.layout.objectAngles[importedPlanet.id]).toBe(1.2)

  await alphaNode.click()
  const importedHierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  await importedHierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await importedHierarchy.getByRole('button', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('The key is hidden.')
  await page.getByRole('button', { name: 'Cluster map' }).click()

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
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Jump Cluster').fill(clusterName)
  await inspector.getByLabel('Star system').fill(systemName)
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await addCustomFieldThroughDialog(page, 'Warden notes', 'text')

  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Warden notes').fill('Existing campaign record.')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Iria/ }).click()
  await page.getByRole('button', { name: 'Add orbit' }).click()
  await addCatalogueObject(page, 'moon')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Departure')
  await saveMapObject(page)

  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map` })
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add star system' }).click()
  await clusterMap.getByRole('button', { name: 'Open New System 2 system map' }).click()
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  await inspector.getByLabel('Star system').fill('Harrow')
  await inspector.getByRole('button', { name: 'Save chart names' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Arrival')
  await saveMapObject(page)
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await page.getByRole('button', { name: 'Add Jump Route' }).click()
  await page.getByLabel('From Jump Point').selectOption({ label: 'Vesper Departure (Vesper Prime)' })
  await page.getByLabel('Route destination').selectOption('point')
  await page.getByLabel('To Jump Point').selectOption({ label: 'Harrow Arrival (Harrow)' })
  await page.getByRole('button', { name: 'Create Jump Route' }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ }))
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
  const originalRoute = baseline.cluster!.routes.find(route => route.jumpLevel === 1)!
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
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ }))
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
  expect(importedRoute.jumpLevel).toBe(1)
  expect(importedExport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(importedExport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 120, vertical: 120 })
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
  expect(clusterSvgInfo.text).toContain('Jump-1')
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
  expect(deletionPreview).toContain('Level 1')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toBeVisible()
  const importedRouteMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ })
  await expect(importedRouteMark).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await deleteImportedSystem.click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(importedRouteMark).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Cluster map' }).click()
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()
  const finalExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(finalExport.cluster!.systems).toHaveLength(3)
  expect(finalExport.cluster!.systems.some(system => system.id === originalSystem.id)).toBe(true)
  expect(finalExport.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])
})
