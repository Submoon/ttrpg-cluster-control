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
    unresolvedExitPositions?: Record<string, WorldPoint>
    orbitRadii: Record<string, number | { horizontal: number; vertical: number }>
    orbitEllipseRadii?: Record<string, { horizontal: number; vertical: number }>
    orbitRotations?: Record<string, number>
    objectAngles: Record<string, number>
  }
}

export type ScreenPoint = { x: number; y: number }

type AffineTransform = Readonly<{
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}>

export type SvgCoordinates = Readonly<{
  matrix: AffineTransform
  toClient(point: WorldPoint): ScreenPoint
  fromClient(point: ScreenPoint): WorldPoint
}>

export type MouseDragDelivery = Readonly<{
  down: ScreenPoint
  up: ScreenPoint
}>

/** Captures an SVG element's current screen transform as portable affine values. */
export async function snapshotSvgCoordinates(
  space: import('@playwright/test').Locator,
): Promise<SvgCoordinates> {
  const values = await space.evaluate((element) => {
    const transform = element instanceof SVGGraphicsElement ? element.getScreenCTM() : null
    if (!transform) throw new Error('The SVG coordinate space is not attached to the document.')
    return {
      a: transform.a,
      b: transform.b,
      c: transform.c,
      d: transform.d,
      e: transform.e,
      f: transform.f,
    }
  })
  const matrix = Object.freeze(values)
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (!Number.isFinite(determinant) || determinant === 0) {
    throw new Error('The SVG coordinate space has a non-invertible screen transform.')
  }

  const coordinates: SvgCoordinates = {
    matrix,
    toClient(point) {
      return Object.freeze({
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      })
    },
    fromClient(point) {
      const x = point.x - matrix.e
      const y = point.y - matrix.f
      return Object.freeze({
        x: (matrix.d * x - matrix.c * y) / determinant,
        y: (-matrix.b * x + matrix.a * y) / determinant,
      })
    },
  }
  return Object.freeze(coordinates)
}

type MouseDragProbeWindow = Window & {
  __testMouseDragProbe?: {
    id: string
    events: Array<{ type: 'down' | 'up'; x: number; y: number }>
    cleanup: () => void
  }
}

/** Drives a six-step native mouse drag and returns the captured window-level input points. */
export async function measureMouseDrag(
  page: import('@playwright/test').Page,
  start: ScreenPoint,
  end: ScreenPoint,
): Promise<MouseDragDelivery> {
  const requestedStart = { x: Math.round(start.x), y: Math.round(start.y) }
  const requestedEnd = { x: Math.round(end.x), y: Math.round(end.y) }
  const probeId = `${Date.now()}-${Math.random()}`
  let mouseMayBeDown = false
  let observerMayBeInstalled = false
  let gestureFailed = false
  let gestureFailure: unknown
  let delivery: MouseDragDelivery | undefined
  const cleanupFailures: unknown[] = []

  try {
    observerMayBeInstalled = true
    await page.evaluate((id) => {
      const probeWindow = window as MouseDragProbeWindow
      if (probeWindow.__testMouseDragProbe) {
        throw new Error('A native mouse drag probe is already active.')
      }

      const events: Array<{ type: 'down' | 'up'; x: number; y: number }> = []
      const recordDown = (event: MouseEvent) => {
        events.push({ type: 'down', x: event.clientX, y: event.clientY })
      }
      const recordUp = (event: MouseEvent) => {
        events.push({ type: 'up', x: event.clientX, y: event.clientY })
      }
      const cleanup = () => {
        window.removeEventListener('mousedown', recordDown, true)
        window.removeEventListener('mouseup', recordUp, true)
      }
      probeWindow.__testMouseDragProbe = { id, events, cleanup }
      window.addEventListener('mousedown', recordDown, true)
      window.addEventListener('mouseup', recordUp, true)
    }, probeId)

    await page.mouse.move(requestedStart.x, requestedStart.y)
    mouseMayBeDown = true
    await page.mouse.down()
    await page.mouse.move(requestedEnd.x, requestedEnd.y, { steps: 6 })
    await page.mouse.up()
    mouseMayBeDown = false

    delivery = await page.evaluate((id) => {
      const probeWindow = window as MouseDragProbeWindow
      const probe = probeWindow.__testMouseDragProbe
      if (probe?.id !== id) throw new Error('The native mouse drag probe is no longer available.')
      const events = probe.events
      const down = events.find(event => event.type === 'down')
      const up = [...events].reverse().find(event => event.type === 'up')
      if (!down || !up) throw new Error('Could not measure the delivered native mouse drag.')
      return Object.freeze({
        down: Object.freeze({ x: down.x, y: down.y }),
        up: Object.freeze({ x: up.x, y: up.y }),
      })
    }, probeId)
  } catch (error) {
    gestureFailed = true
    gestureFailure = error
  } finally {
    if (mouseMayBeDown) {
      try {
        await page.mouse.up()
      } catch (error) {
        if (!page.isClosed()) cleanupFailures.push(error)
      }
    }
    if (observerMayBeInstalled) {
      try {
        await page.evaluate((id) => {
          const probeWindow = window as MouseDragProbeWindow
          const probe = probeWindow.__testMouseDragProbe
          if (probe?.id !== id) return
          probe.cleanup()
          delete probeWindow.__testMouseDragProbe
        }, probeId)
      } catch (error) {
        if (!page.isClosed()) cleanupFailures.push(error)
      }
    }
  }

  if (gestureFailed) {
    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        [gestureFailure, ...cleanupFailures],
        'The native mouse drag failed, and cleanup also failed.',
      )
    }
    throw gestureFailure
  }
  if (cleanupFailures.length === 1) throw cleanupFailures[0]
  if (cleanupFailures.length > 1) {
    throw new AggregateError(cleanupFailures, 'Could not clean up after the native mouse drag.')
  }
  if (!delivery) throw new Error('The native mouse drag did not return its delivered input points.')
  return delivery
}

/** Chooses a map point through a real pointer, accounting for the current view and pixel rounding. */
async function clickNormalizedMapPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
  kind: 'cluster' | 'system',
): Promise<WorldPoint> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const target = await map.evaluate((element, request) => {
      const content = element.querySelector<SVGGElement>(request.kind === 'cluster' ? '.cluster-map-content' : '.system-map-content')
      const transform = content?.getScreenCTM()
      if (!transform) throw new Error('The map content is not attached to the document.')
      const origin = request.kind === 'cluster' ? { x: 112, y: 96 } : { x: 64, y: 72 }
      const size = request.kind === 'cluster' ? { x: 736, y: 368 } : { x: 832, y: 416 }
      const screen = new DOMPoint(origin.x + request.point.x * size.x, origin.y + request.point.y * size.y)
        .matrixTransform(transform)
      const clickPoint = { x: Math.floor(screen.x), y: Math.floor(screen.y) }
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(clickPoint.x, clickPoint.y)
      const delivered = new DOMPoint(clickPoint.x, clickPoint.y).matrixTransform(transform.inverse())
      return {
        clickPoint,
        point: { x: (delivered.x - origin.x) / size.x, y: (delivered.y - origin.y) / size.y },
        reachable: clickPoint.x >= Math.max(0, bounds.left) && clickPoint.y >= Math.max(0, bounds.top)
          && clickPoint.x < Math.min(window.innerWidth, bounds.right)
          && clickPoint.y < Math.min(window.innerHeight, bounds.bottom)
          && !!hit && (hit === element || element.contains(hit)),
      }
    }, { point, kind })
    if (target.reachable) {
      await page.mouse.click(target.clickPoint.x, target.clickPoint.y)
      return target.point
    }
    if (await zoomOut.isDisabled()) break
    await zoomOut.click()
  }
  throw new Error(`Map point (${point.x}, ${point.y}) is unreachable through public zoom controls.`)
}

export function clickNormalizedSystemPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<WorldPoint> {
  return clickNormalizedMapPoint(page, map, point, 'system')
}

/** Clicks an Orbit's parametric position through the real map; returns the delivered normalized map point. */
export async function clickSystemOrbitPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  orbitLabel: string,
  angleDegrees: number,
): Promise<WorldPoint> {
  const ring = map.getByRole('group', { name: orbitLabel, exact: true }).locator('.orbit-ring')
  const point = await ring.evaluate((element, degrees) => {
    const ellipse = element as SVGEllipseElement
    const content = ellipse.closest('svg')?.querySelector<SVGGElement>('.system-map-content')
    const ringMatrix = ellipse.getScreenCTM()
    const contentMatrix = content?.getScreenCTM()
    if (!ringMatrix || !contentMatrix) throw new Error('The Orbit is not attached to the map.')
    const angle = degrees * Math.PI / 180
    const local = new DOMPoint(
      ellipse.cx.baseVal.value + ellipse.rx.baseVal.value * Math.cos(angle),
      ellipse.cy.baseVal.value + ellipse.ry.baseVal.value * Math.sin(angle),
    )
    const scene = local.matrixTransform(ringMatrix).matrixTransform(contentMatrix.inverse())
    return { x: (scene.x - 64) / 832, y: (scene.y - 72) / 416 }
  }, angleDegrees)
  return clickNormalizedSystemPoint(page, map, point)
}

export function clickNormalizedClusterPoint(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<WorldPoint> {
  return clickNormalizedMapPoint(page, map, point, 'cluster')
}

async function worldPointOnScreen(
  map: import('@playwright/test').Locator,
  point: WorldPoint,
): Promise<ScreenPoint> {
  const coordinates = await snapshotSvgCoordinates(map.locator('.system-map-content'))
  return coordinates.toClient(point)
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
  const closeChooserBeforeCameraChange = async (): Promise<void> => {
    if (!paletteSource) return
    await dismissAddChooser(page)
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

  await closeChooserBeforeCameraChange()
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  if (initialZoom === '25%') {
    await closeChooserBeforeCameraChange()
    await zoomOutMapToMinimum(page)
    if (!(await isReachable())) {
      throw new Error('Map drag points are unreachable at the required 25% zoom after Fit.')
    }
    return
  }

  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out' })
  for (let attempt = 0; attempt < 64; attempt += 1) {
    if (await isReachable()) return
    await closeChooserBeforeCameraChange()
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
  await dismissAddChooser(page)
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
  await dismissAddChooser(page)
  await setWorkspaceMapMode(page, 'Move')
  await orbit.scrollIntoViewIfNeeded()
  const geometry = await orbit.evaluate((element) => {
    const shape = element as SVGCircleElement | SVGEllipseElement
    const radiusX = Number(shape.getAttribute('rx') ?? shape.getAttribute('r'))
    const radiusY = Number(shape.getAttribute('ry') ?? shape.getAttribute('r'))
    return {
      center: {
        x: Number(shape.getAttribute('cx')),
        y: Number(shape.getAttribute('cy')),
      },
      radiusX,
      radiusY,
    }
  })
  const coordinates = await snapshotSvgCoordinates(orbit)
  const start = coordinates.toClient({
    x: geometry.center.x + geometry.radiusX * Math.cos(startAngle),
    y: geometry.center.y + geometry.radiusY * Math.sin(startAngle),
  })
  await measureMouseDrag(page, start, coordinates.toClient(point))
}

export async function panMap(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  delta: WorldPoint,
): Promise<void> {
  await dismissAddChooser(page)
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
  await dismissAddChooser(page)
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
  if (isOpen !== open) {
    await dismissAddChooser(page)
    await toggle.click()
  }
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

export type SingleSystemWorkspaceOptions = {
  clusterName?: string
  systemName?: string
  viewport?: { width: number; height: number }
}

/** Creates a fresh one-system workspace and leaves its system map ready for interaction. */
export async function createSingleSystemWorkspace(
  page: import('@playwright/test').Page,
  options: SingleSystemWorkspaceOptions = {},
): Promise<{ clusterName: string; systemName: string }> {
  const clusterName = options.clusterName ?? 'Kestrel Reach'
  const systemName = options.systemName ?? 'Vesper'
  if (options.viewport) await page.setViewportSize(options.viewport)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster', { exact: true }).fill(clusterName)
  await page.getByLabel('First star system', { exact: true }).fill(systemName)
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await expect(page.getByRole('group', { name: `${systemName} star system map`, exact: true })).toBeVisible()

  await returnToClusterMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systems = hierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
  const systemEntry = systems.getByRole('button', { name: /^Open .* system map$/ })
  await expect(systemEntry).toHaveCount(1)
  await expect(systemEntry).toHaveAccessibleName(`Open ${systemName} system map`)
  await systemEntry.click()
  const compactHierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await compactHierarchyClose.isVisible().catch(() => false)) await compactHierarchyClose.click()
  await expect(page.getByRole('group', { name: `${systemName} star system map`, exact: true })).toBeVisible()

  for (const panel of ['hierarchy', 'inspector'] as const) {
    const compactClose = page.getByRole('button', { name: `Close ${panel} panel`, exact: true })
    if (await compactClose.isVisible().catch(() => false)) {
      await compactClose.click()
      continue
    }

    const toggleName = panel === 'hierarchy' ? 'Hierarchy' : 'Inspect'
    const toggle = page.getByRole('button', { name: toggleName, exact: true })
    if (await toggle.isVisible().catch(() => false) && await toggle.getAttribute('aria-expanded') === 'true') {
      await toggle.click()
    }
  }

  await expect(page.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  return { clusterName, systemName }
}

/** Reaches the public minimum zoom without assuming a particular starting level. */
export async function zoomOutMapToMinimum(page: import('@playwright/test').Page): Promise<void> {
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out' })
  if (!(await zoomOut.isDisabled())) await dismissAddChooser(page)
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
  await dismissAddChooser(page)
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click()
  }
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
  await dismissAddChooser(page)
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click()
  }
  const desktopHierarchy = page.getByRole('complementary', { name, exact: true })
  const compactHierarchy = page.getByRole('dialog', { name, exact: true })
  await expect.poll(async () =>
    await desktopHierarchy.isVisible() || await compactHierarchy.isVisible(),
  ).toBe(true)
  return await compactHierarchy.isVisible() ? compactHierarchy : desktopHierarchy
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
  if (await button.getAttribute('aria-pressed') !== 'true') {
    await dismissAddChooser(page)
    await button.click()
  }
}

/** Returns to the cluster through the real compact-context Back control. */
export async function returnToClusterMap(page: import('@playwright/test').Page): Promise<void> {
  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context).toBeVisible()
  const contextKind = context.locator('.workspace-map-context > span')
  await expect(contextKind).toHaveText(/^(Jump Cluster|Star System)$/)
  const back = context.getByRole('button', { name: 'Back to Jump Cluster', exact: true })
  if (await back.isVisible()) {
    await dismissAddChooser(page)
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
  options: OrbitCreationOptions = {},
): Promise<void> {
  await (await dockAction(page, name)).click()
  await dismissAddChooser(page)

  if (name === 'Add orbit') await completeOrbitCreation(page, options)
}

/** Creates a Cluster system at a public map point and optionally enters it. */
export async function addClusterSystem(
  page: import('@playwright/test').Page,
  options: { open?: boolean; position?: WorldPoint } = {},
): Promise<string | undefined> {
  const clusterMap = page.getByRole('group', { name: /Jump Cluster map$/ })
  const existingSystemNames = options.open
    ? await Promise.all((await clusterMap.locator('.cluster-system-node').all()).map(async button => {
      const label = await button.getAttribute('aria-label')
      const match = label?.match(/^(?:Select (.+) system|Open (.+) system map)$/)
      const systemName = match?.[1] ?? match?.[2]
      if (!systemName) throw new Error(`Could not read a system name from "${label}".`)
      return systemName
    }))
    : []

  await clickDockAction(page, 'Add star system')

  const position = options.position ?? { x: 0.75, y: 0.75 }
  const previousSystemCount = await clusterMap.locator('.cluster-system-node').count()
  await clickNormalizedClusterPoint(page, clusterMap, position)
  await expect(clusterMap.locator('.cluster-system-node')).toHaveCount(previousSystemCount + 1)
  await quitSystemAdd(page)

  if (!options.open) return undefined

  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap).toBeVisible()
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const existingSystemActions = clusterMap.getByRole('button', { name: /^Open .* system map$/ })
  await expect(existingSystemActions).toHaveCount(existingSystemNames.length + 1)
  const currentSystemActions = await existingSystemActions.all()
  let createdAction: import('@playwright/test').Locator | undefined
  let createdLabel: string | null = null
  for (const action of currentSystemActions) {
    const label = await action.getAttribute('aria-label')
    const systemName = label?.match(/^Open (.+) system map$/)?.[1]
    if (systemName && !existingSystemNames.includes(systemName)) {
      createdAction = action
      createdLabel = label
      break
    }
  }
  if (!createdAction || !createdLabel) throw new Error('The cluster map does not expose the newly added system.')

  const systemName = createdLabel.match(/^Open (.+) system map$/)?.[1]
  if (!systemName) throw new Error(`Could not read the new system name from "${createdLabel}".`)
  await createdAction.click()
  await expect(page.getByRole('group', { name: `${systemName} star system map`, exact: true })).toBeVisible()
  return systemName
}

async function dismissAddChooser(page: import('@playwright/test').Page): Promise<void> {
  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  if (await addToggle.getAttribute('aria-expanded') === 'true') {
    // Its outside-dismiss capture consumes the first pointer gesture on another control.
    // Dismiss only the chooser; Add remains armed until Confirm or Quit Add.
    await page.keyboard.press('Escape')
    await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  }
}

export function jsonMapImportInput(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByLabel('Import map JSON')
}

/** Returns the public review dialog for a prepared destructive change. */
export function deletionReviewDialog(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('dialog', { name: 'Review deletion', exact: true })
}

/** Returns the public review dialog for a validated independent JSON import. */
export function importReviewDialog(page: import('@playwright/test').Page): import('@playwright/test').Locator {
  return page.getByRole('dialog', { name: 'Review import', exact: true })
}

/** Resolves a deletion review through its visible action. Read its summary before calling this helper. */
export async function resolveDeletionReview(
  review: import('@playwright/test').Locator,
  choice: 'confirm' | 'cancel',
): Promise<void> {
  await expect(review).toBeVisible()
  await review.getByRole('button', {
    name: choice === 'confirm' ? 'Confirm deletion' : 'Cancel deletion',
    exact: true,
  }).click()
}

/** Resolves an import review through its visible action. Read its summary before calling this helper. */
export async function resolveImportReview(
  review: import('@playwright/test').Locator,
  choice: 'confirm' | 'cancel',
): Promise<void> {
  await expect(review).toBeVisible()
  await review.getByRole('button', {
    name: choice === 'confirm' ? 'Import independent copy' : 'Cancel import',
    exact: true,
  }).click()
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
  const edit = page.getByRole('button', { name: 'Edit map object', exact: true })
  const apply = page.getByRole('button', { name: /^Apply changes/ })
  await expect(edit.or(apply)).toBeVisible()
  if (await edit.isVisible()) await edit.click()
  else await expect(apply).toBeVisible()
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
  const typeLabel = ({
    text: 'Text',
    number: 'Number',
    boolean: 'Boolean',
    'single-select': 'Single-select',
  } as Record<string, string>)[type] ?? type
  await selectInspectorOption(dialog.getByLabel('Value type'), typeLabel)
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

export type CatalogueCreationTarget =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'orbit'; label: string; angleDegrees?: number }

export type CatalogueCreationOptions = {
  target?: CatalogueCreationTarget
  preserveDraft?: boolean
  noSelection?: boolean
  typeLabel?: string
}

export type OrbitCreationTarget =
  | { kind: 'center'; x: number; y: number }
  | { kind: 'host'; name: string }

export type OrbitCreationOptions = {
  target?: OrbitCreationTarget
  preserveDraft?: boolean
  noSelection?: boolean
}

export async function selectCatalogueObjectButton(
  page: import('@playwright/test').Page,
  subtype: typeof catalogueSubtypes[number],
): Promise<import('@playwright/test').Locator> {
  // The modal Add popover aria-hides its trigger while open, so keep this locator stable
  // for the expanded-state assertion after opening it.
  const addMenu = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
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
  options: CatalogueCreationOptions = {},
): Promise<void> {
  await (await selectCatalogueObjectButton(page, subtype)).click()
  await completeCatalogueObjectCreation(page, subtype, options)
}

/** Completes an armed catalogue type by choosing its logical destination and clicking the map. */
export async function completeCatalogueObjectCreation(
  page: import('@playwright/test').Page,
  subtype: typeof catalogueSubtypes[number],
  options: CatalogueCreationOptions = {},
): Promise<void> {
  const subtypeLabel = subtype.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const controls = page.getByRole('group', { name: `${subtypeLabel} creation controls` })
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()

  const map = page.getByRole('group', { name: /star system map$/ }).first()
  const target = options.target ?? await defaultCatalogueCreationTarget(page, map, options)
  if (subtype === 'other') {
    await page.getByLabel('Type label', { exact: true }).fill(options.typeLabel ?? 'Other object')
  }

  if (target.kind === 'orbit') {
    await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), target.label)
    if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
    await clickSystemOrbitPoint(page, map, target.label, target.angleDegrees ?? 0)
  } else {
    await selectInspectorOption(page.getByLabel('Orbit placement', { exact: true }), 'Free map position')
    if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
    await clickNormalizedSystemPoint(page, map, target)
  }

  if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
  await quitSystemAdd(page)

  if (!options.noSelection && !options.preserveDraft) {
    const hierarchy = await openWorkspaceHierarchy(page)
    const generatedType = subtype.toLowerCase() === 'jump-point' ? 'jump point' : subtype
    const createdObject = hierarchy.getByRole('button', { name: new RegExp(`New ${escapeRegExp(generatedType)}`, 'i') }).last()
    await expect(createdObject).toBeVisible()
    await createdObject.click()
  }
}

async function defaultCatalogueCreationTarget(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  options: CatalogueCreationOptions,
): Promise<CatalogueCreationTarget> {
  if (options.preserveDraft || options.noSelection) return { kind: 'free', ...await nextFreeSystemPoint(map) }

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  if (await hierarchy.count() > 0) {
    const selected = hierarchy.locator('button[aria-current="true"]')
    if (await selected.count() > 0) {
      const selectedLabel = await selected.first().getAttribute('aria-label') ?? await selected.first().innerText()
      const orbitLabel = selectedLabel.replace(/\s+/g, ' ').match(/Orbit \d+ around .+?(?=, \d+ objects?$|$)/i)?.[0]
      if (orbitLabel) return { kind: 'orbit', label: orbitLabel }
    }
  }

  return { kind: 'free', ...await nextFreeSystemPoint(map) }
}

async function nextFreeSystemPoint(map: import('@playwright/test').Locator): Promise<WorldPoint> {
  const objectCount = await map.locator('.system-object').count()
  const gridIndex = Math.max(0, objectCount - 1) % 16
  return {
    x: ((gridIndex % 4) + 1) / 5,
    y: (Math.floor(gridIndex / 4) + 1) / 5,
  }
}

/** Creates an Orbit through its public Placement Add action and optionally inspects it from Hierarchy. */
export async function completeOrbitCreation(
  page: import('@playwright/test').Page,
  options: OrbitCreationOptions = {},
): Promise<void> {
  const controls = page.getByRole('group', { name: 'Orbit creation controls' })
  const placementToggle = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()

  const map = page.getByRole('group', { name: /star system map$/ }).first()
  const target = options.target ?? await defaultOrbitCreationTarget(page, map, options)
  const targetControl = page.getByLabel('Orbit center or host', { exact: true })
  if (target.kind === 'host') {
    await selectInspectorOption(targetControl, `Around ${target.name}`)
  } else {
    await selectInspectorOption(targetControl, 'Unoccupied center')
    if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
    await clickNormalizedSystemPoint(page, map, target)
  }

  if (target.kind === 'host') {
    const placementForm = page.getByRole('form', { name: 'Placement', exact: true })
    await placementForm.getByRole('button', { name: 'Add', exact: true }).click()
  }
  if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
  await quitSystemAdd(page)

  if (!options.noSelection && !options.preserveDraft) {
    const hierarchy = await openWorkspaceHierarchy(page)
    const hostLabel = target.kind === 'host' ? target.name : 'unoccupied center'
    const createdOrbit = hierarchy.getByRole('button', {
      name: new RegExp(`^Orbit \\d+ around ${escapeRegExp(hostLabel)}`, 'i'),
    }).last()
    await expect(createdOrbit).toBeVisible()
    await createdOrbit.click()
  }
}

async function defaultOrbitCreationTarget(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
  options: OrbitCreationOptions,
): Promise<OrbitCreationTarget> {
  if (options.preserveDraft || options.noSelection) return { kind: 'center', x: 0.25, y: 0.25 }

  const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  if (await hierarchy.count() > 0) {
    const selected = hierarchy.locator('button[aria-current="true"]')
    if (await selected.count() > 0) {
      const selectedLabel = (await selected.first().getAttribute('aria-label') ?? await selected.first().innerText())
        .replace(/\s+/g, ' ')
      const orbitHost = selectedLabel.match(/Orbit \d+ around (.+?)(?=, \d+ objects?$|$)/i)?.[1]
      if (orbitHost && !/^unoccupied center$/i.test(orbitHost)) return { kind: 'host', name: orbitHost }

      const objectName = selectedLabel.match(/^Select [^,]+,\s*(.+?)(?:\s+\([^)]*\))?$/i)?.[1]
      if (objectName) return { kind: 'host', name: objectName }
    }
  }

  return { kind: 'center', ...await nextFreeSystemPoint(map) }
}

export async function quitSystemAdd(page: import('@playwright/test').Page): Promise<void> {
  await dismissAddChooser(page)
  const context = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  const quit = context.getByRole('button', { name: 'Quit Add and return to Select', exact: true })
  await expect(quit).toBeVisible()
  await quit.click()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
