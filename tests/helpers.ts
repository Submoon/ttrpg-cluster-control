import { expect } from '@playwright/test'

/** Returns the visible page-level or compact-panel workspace feedback owner. */
export function activeWorkspaceFeedback(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.locator('.workspace-feedback:not([inert]), .workspace-compact-recovery')
}

export type WorldPoint = { x: number; y: number }

export type DownloadWindow = Window & { __mapExportBlobs?: Blob[] }

/** Captures real map export blobs so assertions can inspect their serialized contents. */
export async function captureMapExportBlobs(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
}

export type ExportedObject = {
  id: string
  name: string
  family: string
  subtype: string
  locationKey: string
  description: string
  placement: { kind: 'system'; x: number; y: number } | { kind: 'orbit'; orbitId: string }
  atmosphere?: string
  portClass?: string
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

type ScreenPoint = { x: number; y: number }

async function worldPointOnScreen(
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<ScreenPoint> {
  return map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('The system map content is not attached to the document.')
    const screenPoint = new DOMPoint(target.x, target.y).matrixTransform(transform)
    return { x: screenPoint.x, y: screenPoint.y }
  }, point)
}

/** Recovers a measured native drag through public Fit and bounded Zoom out controls. */
export async function ensureMapDragPointsReachable(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<void> {
  const sourceCount = await source.count()
  if (sourceCount === 0) {
    const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
    await expect(addToggle).toBeVisible()
    if (await addToggle.getAttribute('aria-expanded') !== 'true') await addToggle.click()
    await expect(source).toBeVisible()
  }
  const paletteSource = await source.getAttribute('draggable') === 'true'
  const ensureSourceVisible = async (): Promise<void> => {
    if (!paletteSource) return
    const addToggle = page.getByRole('button', { name: 'Add to map', exact: true })
    if (await addToggle.getAttribute('aria-expanded') !== 'true') await addToggle.click()
    await expect(source).toBeVisible()
    await source.scrollIntoViewIfNeeded()
  }
  await ensureSourceVisible()
  await source.scrollIntoViewIfNeeded()

  const isReachable = async (): Promise<boolean> => {
    await ensureSourceVisible()
    const sourceBox = await source.boundingBox()
    if (!sourceBox) throw new Error('Could not find the map element to drag.')
    const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }
    const end = await worldPointOnScreen(map, point)
    const sourceReachable = await source.evaluate((element, point) => {
      const hit = document.elementFromPoint(point.x, point.y)
      return point.x >= 0 && point.y >= 0
        && point.x < window.innerWidth && point.y < window.innerHeight
        && !!hit && (hit === element || element.contains(hit))
    }, start)
    const targetReachable = await map.evaluate((element, point) => {
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(point.x, point.y)
      return point.x >= Math.max(0, bounds.left) && point.y >= Math.max(0, bounds.top)
        && point.x < Math.min(window.innerWidth, bounds.right)
        && point.y < Math.min(window.innerHeight, bounds.bottom)
        && !!hit && (hit === element || element.contains(hit))
    }, end)
    return sourceReachable && targetReachable
  }

  const initialZoom = (await workspaceZoomOutput(page).textContent())?.trim()
  if (await isReachable()) return

  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  await ensureSourceVisible()
  if (initialZoom === '25%') {
    await zoomOutMapToMinimum(page)
    if (!(await isReachable())) {
      throw new Error('Map drag points are unreachable at the required 25% zoom after Fit.')
    }
    return
  }

  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out' })
  for (let attempt = 0; attempt < 64; attempt += 1) {
    if (await isReachable()) return
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }

  throw new Error('Map drag points are still unreachable after public Fit and bounded Zoom out recovery.')
}

export async function dragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
  roundEndpoint = false,
): Promise<void> {
  await beginDragToWorldPoint(page, map, source, point, roundEndpoint)
  await page.mouse.up()
}

export async function beginDragToWorldPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  source: import('@playwright/test').Locator,
  point: WorldPoint,
  roundEndpoint = false,
): Promise<void> {
  await setWorkspaceMapMode(page, 'Move')
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('Could not find the map element to drag.')
  const screenPoint = await worldPointOnScreen(map, point)
  const destination = roundEndpoint
    ? { x: Math.round(screenPoint.x), y: Math.round(screenPoint.y) }
    : screenPoint

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
  if (!(await source.isVisible())) {
    await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  }
  await source.scrollIntoViewIfNeeded()
  await map.scrollIntoViewIfNeeded()
  const sourceBounds = await source.boundingBox()
  const bounds = await map.boundingBox()
  if (!sourceBounds || !bounds) throw new Error('Could not find the map or palette object to drag.')

  const destination = await worldPointOnScreen(map, point)
  await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + sourceBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 12 })
  if (duringDrag) await duringDrag()
  await page.mouse.up()
}

export async function dragOrbitToWorldPoint(
  page: import('@playwright/test').Page,
  orbit: import('@playwright/test').Locator,
  point: WorldPoint,
  startAngle = 0,
): Promise<void> {
  await setWorkspaceMapMode(page, 'Move')
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

  // Capture the source while its Navigate-mode accessible name is still current.
  // Switching to Move changes map-entity labels to their Select action names.
  await setWorkspaceMapMode(page, 'Move')
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
  const toggle = page.getByRole('button', { name: 'Map files', exact: true })
  await expect(toggle).toBeVisible()
  const isOpen = await toggle.getAttribute('aria-expanded') === 'true'
  if (isOpen !== open) await toggle.click()
}

/** Finds the shared Dock containing map interaction modes and Add. */
export function workspaceNavigation(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('toolbar', { name: 'Workspace navigation' })
}

/** Finds the separate bottom-right map zoom controls. */
export function workspaceZoomControls(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('toolbar', { name: 'Map zoom controls' })
}

export function workspaceZoomOutput(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return workspaceZoomControls(page).locator('output').first()
}

/** Reaches the public minimum zoom without assuming a particular starting level. */
export async function zoomOutMapToMinimum(page: import('@playwright/test').Page): Promise<void> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out' })
  for (let step = 0; step < 64 && !(await zoomOut.isDisabled()); step += 1) {
    await zoomOut.click()
  }
  await expect(workspaceZoomOutput(page)).toHaveText('25%')
}

/** Opens the compact popover that contains the zoom slider and named pan controls. */
export async function openWorkspaceZoomNavigation(
  page: import('@playwright/test').Page,
): Promise<import('@playwright/test').Locator> {
  const toggle = workspaceZoomControls(page).getByRole('button', { name: 'Open map navigation controls' })
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  const controls = page.getByRole('group', { name: 'Map zoom' })
  await expect(controls).toBeVisible()
  return controls
}

/** Opens Hierarchy through its public Map chrome control when a test needs its contents. */
export async function openWorkspaceHierarchy(
  page: import('@playwright/test').Page,
  name: 'System hierarchy' | 'Jump Cluster contents' = 'System hierarchy',
): Promise<import('@playwright/test').Locator> {
  const toggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  const hierarchy = page.getByRole('complementary', { name })
  await expect(hierarchy).toBeVisible()
  return hierarchy
}

/** Shows the consultation summary in the inspector without changing map selection. */
export async function openChartDetails(
  page: import('@playwright/test').Page,
): Promise<import('@playwright/test').Locator> {
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await expect(inspectToggle).toBeVisible()
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const chartDetails = page.getByRole('button', { name: 'Chart details', exact: true })
  await expect(chartDetails).toBeVisible()
  if (await chartDetails.getAttribute('aria-pressed') !== 'true') await chartDetails.click()
  return page.getByRole('region', { name: /^(Jump Cluster|Star System) details$/ })
}

/** Selects a map interaction mode through the shared Dock before a map gesture. */
export async function setWorkspaceMapMode(
  page: import('@playwright/test').Page,
  mode: 'Navigate' | 'Select' | 'Move',
): Promise<void> {
  const button = workspaceNavigation(page).getByRole('button', { name: mode, exact: true })
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click()
}

/** Returns to the cluster through the real compact-context Back control. */
export async function returnToClusterMap(page: import('@playwright/test').Page): Promise<void> {
  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context).toBeVisible()
  const contextKind = context.locator('.workspace-map-context > span')
  await expect(contextKind).toHaveText(/^(Jump Cluster|Star System)$/)
  const back = context.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  if (await back.isVisible()) {
    await back.click()
  } else {
    await expect(contextKind).toHaveText('Jump Cluster')
  }
  await expect(contextKind).toHaveText('Jump Cluster')
}

/** Reveals the Dock's legacy action popover only when its requested command is not already visible. */
export async function dockAction(
  page: import('@playwright/test').Page,
  name: string,
): Promise<import('@playwright/test').Locator> {
  const toggle = page.getByRole('button', { name: 'Add to map', exact: true })
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  const actions = page.getByRole('group', { name: 'Add to map', exact: true })
  await expect(actions).toBeVisible()
  const action = actions.getByRole('button', { name, exact: true })
  await expect(action).toBeVisible()
  return action
}

export async function clickDockAction(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  await (await dockAction(page, name)).click()
}

export function jsonMapImportInput(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByLabel('Import map JSON')
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
  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  if (await addToggle.getAttribute('aria-expanded') === 'true') {
    await addToggle.click()
    await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  }
  await page.getByRole('button', { name: 'Edit map object' }).click()
}

export async function saveMapObject(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Save map object' }).click()
}

export type InspectorSelectionOption = string | { label: string | RegExp; value?: string }

/** Selects through the Inspector's public semantic control, whether a legacy native select or Nuxt UI Select. */
export async function selectInspectorOption(
  control: import('@playwright/test').Locator,
  option: InspectorSelectionOption,
): Promise<void> {
  const tagName = await control.evaluate(element => element.tagName)
  if (tagName === 'SELECT') {
    if (typeof option === 'string') {
      await control.selectOption(option)
    } else if (option.value !== undefined) {
      await control.selectOption(option.value)
    } else if (typeof option.label === 'string') {
      await control.selectOption({ label: option.label })
    } else {
      throw new Error('Native select options need a string label or value.')
    }
    return
  }

  const label = typeof option === 'string' ? option : option.label
  await control.click()
  const optionControl = control.page().getByRole('option', { name: label, exact: typeof label === 'string' })
  await expect(optionControl).toBeVisible()
  await optionControl.click()
}

/** Reads the current Inspector selection from its visible value label, preserving USelect semantics. */
export async function readInspectorSelection(control: import('@playwright/test').Locator): Promise<string> {
  const tagName = await control.evaluate(element => element.tagName)
  if (tagName === 'SELECT') return control.inputValue()

  const selectedValue = control.locator('[data-slot="value"]')
  if (await selectedValue.count()) return (await selectedValue.innerText()).trim()
  return ''
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
  await setHeaderMapActionsOpen(input.page(), true)
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
  const addMenu = page.getByRole('button', { name: 'Add to map', exact: true })
  const palette = page.getByRole('region', { name: 'Object palette' })
  if (await addMenu.getAttribute('aria-expanded') !== 'true') {
    await addMenu.click()
  }
  await expect(addMenu).toHaveAttribute('aria-expanded', 'true')
  await expect(palette).toBeVisible()
  const label = subtype.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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
