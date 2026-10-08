import { expect } from '@playwright/test'

export type WorldPoint = { x: number; y: number }

export type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }

export type ExportedObject = {
  id: string
  name: string
  family: string
  subtype: string
  locationKey: string
  placement: { kind: 'system'; x: number; y: number } | { kind: 'orbit'; orbitId: string }
  jumpStationId?: string | null
  customFieldValues?: Record<string, string | number | boolean>
}

export type ExportedSystem = {
  id: string
  name: string
  objects: ExportedObject[]
  orbits: Array<{ id: string; hostId: string | null; center?: WorldPoint; order: number }>
}

export type ExportedRoute = {
  id: string
  name?: string
  jumpLevel?: number
  fromPointId: string
  toPointId: string | null
  unresolvedExit?: string
}

export type ExportedCustomFieldApplicabilityTarget =
  | { kind: 'category'; family: string }
  | { kind: 'subtype'; family: string; subtype: string }

export type ExportedMap = {
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

export async function dragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  await beginDragToWorldPoint(page, map, source, point)
  await page.mouse.up()
}

export async function beginDragToWorldPoint(
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

export async function dragHtmlElementToWorldPoint(
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

export async function dragOrbitToWorldPoint(
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

export async function panMap(
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

export async function dragBy(
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

export async function setHeaderMapActionsOpen(
  page: import('@playwright/test').Page,
  open: boolean,
): Promise<void> {
  const toggle = page.locator('.header-map-actions-toggle')
  const isOpen = await toggle.getAttribute('aria-expanded') === 'true'
  if (isOpen !== open) await toggle.click()
}

export async function downloadJson(page: import('@playwright/test').Page, buttonName: string): Promise<ExportedMap> {
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

export async function openFieldDefinitionDialog(
  page: import('@playwright/test').Page,
): Promise<import('@playwright/test').Locator> {
  await page.getByRole('button', { name: 'Open field definitions' }).click()
  return page.getByRole('dialog', { name: 'Field definitions' })
}

export async function editFieldDefinition(dialog: import('@playwright/test').Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Edit field definition' }).click()
}

export async function editMapObject(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit map object' }).click()
}

export async function saveMapObject(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Save map object' }).click()
}

export async function addCustomFieldThroughDialog(
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

export type DownloadedImage = {
  type: string
  size: number
  text?: string
  sourceSvgText?: string
  width?: number
  height?: number
  signature?: number[]
}

export async function downloadImage(
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
      const blob = blobs[index]
      if (!blob) throw new Error(`Could not read the downloaded ${expectedType} file.`)
      blobs.splice(index, 1)

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

export async function inspectImageSvg(
  page: import('@playwright/test').Page,
  text: string,
): Promise<{
  viewBox: [number, number, number, number]
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
    const viewBoxValues = viewBox.trim().split(/\s+/).map(Number)
    if (viewBoxValues.length !== 4 || viewBoxValues.some(value => !Number.isFinite(value))) {
      throw new Error('The downloaded SVG has an invalid viewBox.')
    }
    const [minX, minY, width, height] = viewBoxValues
    if (minX === undefined || minY === undefined || width === undefined || height === undefined) {
      throw new Error('The downloaded SVG has an invalid viewBox.')
    }
    const parsedViewBox: [number, number, number, number] = [minX, minY, width, height]
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
      viewBox: parsedViewBox,
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

export async function setJsonFile(
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

export const catalogueSubtypes = [
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

export const objectPaletteCategoryBySubtype: Record<typeof catalogueSubtypes[number], string> = {
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

export async function selectCatalogueObjectButton(
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

export async function addCatalogueObject(
  page: import('@playwright/test').Page,
  subtype: typeof catalogueSubtypes[number],
): Promise<void> {
  await (await selectCatalogueObjectButton(page, subtype)).click()
}
