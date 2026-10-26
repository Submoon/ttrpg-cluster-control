import { expect, test } from '@playwright/test'
import { importReviewDialog, resolveImportReview } from './helpers'
import { activeWorkspaceFeedback, quitSystemAdd } from './helpers'
import { clickDockAction } from './helpers'
import { returnToClusterMap, openWorkspaceHierarchy, workspaceZoomControls, jsonMapImportInput, setWorkspaceMapMode, ensureMapDragPointsReachable } from './helpers'
import { dragToWorldPoint, beginDragToWorldPoint, dragHtmlElementToWorldPoint, dragOrbitToWorldPoint, panMap, setHeaderMapActionsOpen, downloadJson, editMapObject, saveMapObject, downloadImage, setJsonFile, selectCatalogueObjectButton, addCatalogueObject, completeCatalogueObjectCreation } from './helpers'
import type { WorldPoint, DownloadWindow } from './helpers'

type DragPreviewWindow = Window & {
  __nativeDragTypes?: string[][]
  __dragPreview?: {
    height: number
    offsetX: number
    offsetY: number
    tagName: string
    text: string
    width: number
  }
  __nativeEllipseDrop?: {
    clientPoint: { x: number; y: number }
    contentMatrix: { a: number; b: number; c: number; d: number; e: number; f: number }
    ellipse: { cx: number; cy: number; rx: number; ry: number; rotation: number }
  } | null
}

function recordNativeDragTypes(): void {
  const dragWindow = window as DragPreviewWindow
  dragWindow.__nativeDragTypes = []
  document.addEventListener('dragstart', (event) => {
    dragWindow.__nativeDragTypes?.push(Array.from(event.dataTransfer?.types ?? []))
  })
}

async function waitForFiniteAnimations(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const animations = document.getAnimations().filter((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime
      return typeof endTime === 'number' && Number.isFinite(endTime)
        && (animation.playState === 'running' || animation.pending)
    })
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
  })
}

async function moveToVisibleMapBackground(
  page: import('@playwright/test').Page,
  map: import('@playwright/test').Locator,
): Promise<void> {
  const point = await map.evaluate(element => {
    const svg = element instanceof SVGSVGElement ? element : element.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) throw new Error('The system map SVG is not available.')

    const svgBounds = svg.getBoundingClientRect()
    let left = Math.max(0, svgBounds.left)
    let right = Math.min(window.innerWidth, svgBounds.right)
    let top = Math.max(0, svgBounds.top)
    let bottom = Math.min(window.innerHeight, svgBounds.bottom)
    let ancestor = svg.parentElement
    while (ancestor && ancestor !== document.documentElement) {
      const style = getComputedStyle(ancestor)
      const bounds = ancestor.getBoundingClientRect()
      if (['auto', 'clip', 'hidden', 'scroll'].includes(style.overflowX)) {
        left = Math.max(left, bounds.left)
        right = Math.min(right, bounds.right)
      }
      if (['auto', 'clip', 'hidden', 'scroll'].includes(style.overflowY)) {
        top = Math.max(top, bounds.top)
        bottom = Math.min(bottom, bounds.bottom)
      }
      ancestor = ancestor.parentElement
    }

    const columns = 13
    const rows = 9
    for (let row = 1; row <= rows; row += 1) {
      for (let column = 1; column <= columns; column += 1) {
        const x = left + (right - left) * column / (columns + 1)
        const y = top + (bottom - top) * row / (rows + 1)
        const hit = document.elementFromPoint(x, y)
        if (hit === svg || (hit instanceof Element && hit.matches('.map-background, .map-grid'))) {
          return { x, y }
        }
      }
    }

    throw new Error('No visible background hit was found within the clipped system map SVG.')
  })
  await page.mouse.move(point.x, point.y)
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

test('dragging an Orbit ring scales both axes and the system caption stays concise', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 480, y: 280 },
  )
  await expect(map.getByRole('group', { name: 'Orbit 1 around Primary Star' })).toBeVisible()
  await quitSystemAdd(page)
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })

  await expect(map.locator('.map-caption')).toHaveCount(0)
  const resizeKnobs = map.locator('.orbit-resize-handle')
  await expect(resizeKnobs).toHaveCount(0)

  await setWorkspaceMapMode(page, 'Move')
  const orbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  const orbitRing = orbit.locator('.orbit-ring')
  const orbitTarget = orbit.locator('.orbit-hit-target')
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
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

test('the Warden can edit, save, export, and import an elliptical Orbit around an unoccupied center', async ({ page }, testInfo) => {
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

  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const dropPoint = { x: 360, y: 320 }
  await ensureMapDragPointsReachable(page, map, page.getByRole('button', { name: 'Add orbit', exact: true }), dropPoint)
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

  await quitSystemAdd(page)
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await setWorkspaceMapMode(page, 'Move')
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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('300')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('50')
  await page.getByLabel('Center X').fill('0.2')
  await page.getByLabel('Center Y').fill('0.5')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(ring).toHaveAttribute('rx', '300')
  await expect(ring).toHaveAttribute('ry', '50')

  await addCatalogueObject(page, 'star', {
    target: { kind: 'orbit', label: 'Orbit 1 around unoccupied center' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary A')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center/ }).click()
  await addCatalogueObject(page, 'star', {
    target: { kind: 'orbit', label: 'Orbit 1 around unoccupied center', angleDegrees: 180 },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Binary B')
  await saveMapObject(page)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 2 objects/ }))
    .toBeVisible()
  const binaryATransform = await map.getByRole('button', { name: /Binary A/ }).getAttribute('transform')
  const binaryBTransform = await map.getByRole('button', { name: /Binary B/ }).getAttribute('transform')
  expect(binaryATransform).not.toBe(binaryBTransform)

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
  await ensureMapDragPointsReachable(
    page,
    map,
    map.getByRole('button', { name: /Binary A/ }).locator('.object-hit-target'),
    firstDropPoint,
  )
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary A/ }).locator('.object-hit-target'),
    firstDropPoint,
  )
  const secondDropPoint = {
    x: geometry.cx + geometry.rx * Math.cos(secondAngle),
    y: geometry.cy + geometry.ry * Math.sin(secondAngle),
  }
  await ensureMapDragPointsReachable(
    page,
    map,
    map.getByRole('button', { name: /Binary B/ }).locator('.object-hit-target'),
    secondDropPoint,
  )
  await dragToWorldPoint(
    page,
    map,
    map.getByRole('button', { name: /Binary B/ }).locator('.object-hit-target'),
    secondDropPoint,
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
  await dragToWorldPoint(page, map, horizontalHandle, { x: geometry.cx + 320, y: geometry.cy }, true)
  await expect(ring).toHaveAttribute('rx', '320')
  await expect(ring).toHaveAttribute('ry', '50')
  const verticalHandleCenterIsHitTarget = await verticalHandle.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    const hit = document.elementFromPoint(center.x, center.y)
    return !!hit && (hit === element || element.contains(hit))
  })
  expect(verticalHandleCenterIsHitTarget).toBe(true)
  // Playwright mouse coordinates are integral CSS pixels. Find the nearest delivered pixel
  // that maps back to a world radius which rounds to 60, instead of letting the browser's
  // screen-to-world quantization move the test across the 59.5 radius boundary.
  const verticalResizeTarget = await map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('Could not measure the vertical Orbit resize transform.')

    const screenTarget = new DOMPoint(target.point.x, target.point.y).matrixTransform(transform)
    const baseClientPoint = { x: Math.round(screenTarget.x), y: Math.round(screenTarget.y) }
    const inverse = transform.inverse()
    let nearest: { point: { x: number; y: number }; distance: number } | null = null

    for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
      for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
        const clientPoint = {
          x: baseClientPoint.x + offsetX,
          y: baseClientPoint.y + offsetY,
        }
        const worldPoint = new DOMPoint(clientPoint.x, clientPoint.y).matrixTransform(inverse)
        const verticalRadius = target.center.y - worldPoint.y
        if (Math.round(verticalRadius) !== 60) continue

        const distance = Math.hypot(
          clientPoint.x - screenTarget.x,
          clientPoint.y - screenTarget.y,
        )
        if (!nearest || distance < nearest.distance) {
          nearest = { point: { x: worldPoint.x, y: worldPoint.y }, distance }
        }
      }
    }

    if (!nearest) {
      throw new Error('Could not find an integral pointer position that produces a 60-unit vertical radius.')
    }
    return nearest.point
  }, {
    point: { x: geometry.cx, y: geometry.cy - 60 },
    center: { x: geometry.cx, y: geometry.cy },
  })
  await dragToWorldPoint(page, map, verticalHandle, verticalResizeTarget, true)
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
  const rotatedVerticalDropPoint = {
    x: geometry.cx + 90 * Math.sin(handleRotationRadians),
    y: geometry.cy - 90 * Math.cos(handleRotationRadians),
  }
  const roundedClientVerticalRadius = await map.evaluate((element, target) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const transform = content?.getScreenCTM()
    if (!transform) throw new Error('Could not measure the rotated Orbit drag transform.')
    const screenPoint = new DOMPoint(target.point.x, target.point.y).matrixTransform(transform)
    const roundedClientPoint = new DOMPoint(Math.round(screenPoint.x), Math.round(screenPoint.y))
    const deliveredWorldPoint = roundedClientPoint.matrixTransform(transform.inverse())
    return (deliveredWorldPoint.x - target.center.x) * Math.sin(target.rotationRadians)
      - (deliveredWorldPoint.y - target.center.y) * Math.cos(target.rotationRadians)
  }, {
    point: rotatedVerticalDropPoint,
    center: { x: geometry.cx, y: geometry.cy },
    rotationRadians: handleRotationRadians,
  })
  expect(Math.round(roundedClientVerticalRadius)).toBe(90)
  await dragToWorldPoint(page, map, verticalHandle, rotatedVerticalDropPoint, true)
  await expect(ring).toHaveAttribute('rx', String(globallyResizedHorizontalRadius))
  await expect(ring).toHaveAttribute('ry', '90')
  const resizedHorizontalRadius = Number(await ring.getAttribute('rx'))
  const resizedVerticalRadius = Number(await ring.getAttribute('ry'))
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'Binary A'))
    .toBeCloseTo(angleBeforeResize, 2)

  const navigation = workspaceZoomControls(page)
  const zoomLevel = navigation.locator('output')
  const zoomBeforeBackgroundWheel = await zoomLevel.textContent()
  await moveToVisibleMapBackground(page, map)
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
  const newPlanetDropPoint = await ellipticalOrbitPoint(map, orbitLabel, newPlanetAngle)
  const intendedDropScreenPoint = await map.evaluate((element, point) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const matrix = content?.getScreenCTM()
    if (!matrix) throw new Error('Could not measure the native drop target on the system map.')
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix)
    return { x: screenPoint.x, y: screenPoint.y }
  }, newPlanetDropPoint)
  await map.evaluate((element, label) => {
    const content = element.querySelector<SVGGElement>('.system-map-content')
    const orbit = [...element.querySelectorAll<SVGGElement>('.orbit-mark')]
      .find(candidate => candidate.getAttribute('aria-label') === label)
    const ellipse = orbit?.querySelector<SVGEllipseElement>('.orbit-ring')
    if (!content || !ellipse) throw new Error('Could not observe the native Orbit drop geometry.')

    const document = element.ownerDocument
    const dropWindow = document.defaultView as DragPreviewWindow | null
    if (!dropWindow) throw new Error('Could not observe the native Orbit drop window.')
    dropWindow.__nativeEllipseDrop = null
    const captureDrop = (event: Event) => {
      if (!(event instanceof DragEvent)
        || !(event.target instanceof Node)
        || !element.contains(event.target)) return
      const matrix = content.getScreenCTM()
      if (!matrix) return
      dropWindow.__nativeEllipseDrop = {
        clientPoint: { x: event.clientX, y: event.clientY },
        contentMatrix: {
          a: matrix.a,
          b: matrix.b,
          c: matrix.c,
          d: matrix.d,
          e: matrix.e,
          f: matrix.f,
        },
        ellipse: {
          cx: Number(ellipse.getAttribute('cx')),
          cy: Number(ellipse.getAttribute('cy')),
          rx: Number(ellipse.getAttribute('rx')),
          ry: Number(ellipse.getAttribute('ry')),
          rotation: Number(ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+)/)?.[1] ?? 0),
        },
      }
      document.removeEventListener('drop', captureDrop, true)
    }
    document.addEventListener('drop', captureDrop, true)
  }, orbitLabel)
  await dragHtmlElementToWorldPoint(
    page,
    planetButton,
    map,
    newPlanetDropPoint,
  )
  const newPlanet = map.getByRole('button', { name: /New planet 1/ })
  const nativeDropProbe = await map.evaluate((element, target) => {
    const dropWindow = element.ownerDocument.defaultView as DragPreviewWindow | null
    const nativeDrop = dropWindow?.__nativeEllipseDrop ?? null
    const object = [...element.querySelectorAll<SVGGElement>('.system-object')]
      .find(candidate => candidate.getAttribute('aria-label')?.includes('New planet 1'))
    const transform = object?.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    const scenePoint = transform ? { x: Number(transform[1]), y: Number(transform[2]) } : null
    const contentMatrix = nativeDrop?.contentMatrix ?? null
    const screenPoint = scenePoint && contentMatrix ? {
      x: contentMatrix.a * scenePoint.x + contentMatrix.c * scenePoint.y + contentMatrix.e,
      y: contentMatrix.b * scenePoint.x + contentMatrix.d * scenePoint.y + contentMatrix.f,
    } : null
    let renderedAngle: number | null = null
    if (scenePoint && nativeDrop) {
      const radians = nativeDrop.ellipse.rotation * Math.PI / 180
      const dx = scenePoint.x - nativeDrop.ellipse.cx
      const dy = scenePoint.y - nativeDrop.ellipse.cy
      const localX = dx * Math.cos(radians) + dy * Math.sin(radians)
      const localY = -dx * Math.sin(radians) + dy * Math.cos(radians)
      renderedAngle = Math.atan2(localY / nativeDrop.ellipse.ry, localX / nativeDrop.ellipse.rx)
    }
    return {
      nativeDrop,
      rendered: scenePoint ? { scenePoint, screenPoint, angle: renderedAngle } : null,
      intendedScreenPoint: target.intendedScreenPoint,
    }
  }, { intendedScreenPoint: intendedDropScreenPoint })
  await testInfo.attach('native-ellipse-drop-probe.json', {
    body: JSON.stringify({
      intendedAngle: newPlanetAngle,
      intendedWorldPoint: newPlanetDropPoint,
      ...nativeDropProbe,
    }, null, 2),
    contentType: 'application/json',
  })
  const nativeDrop = nativeDropProbe.nativeDrop
  const renderedDrop = nativeDropProbe.rendered
  if (!nativeDrop || !renderedDrop?.scenePoint || !renderedDrop.screenPoint) {
    throw new Error('The native Orbit drop geometry probe did not capture the completed placement.')
  }

  const normalizedEllipseRadius = (point: WorldPoint) => {
    const rotation = nativeDrop.ellipse.rotation * Math.PI / 180
    const dx = point.x - nativeDrop.ellipse.cx
    const dy = point.y - nativeDrop.ellipse.cy
    const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation)
    const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation)
    return (localX / nativeDrop.ellipse.rx) ** 2 + (localY / nativeDrop.ellipse.ry) ** 2
  }
  expect(normalizedEllipseRadius(newPlanetDropPoint)).toBeCloseTo(1, 10)
  expect(normalizedEllipseRadius(renderedDrop.scenePoint)).toBeCloseTo(1, 10)

  const intendedPointerDistance = Math.hypot(
    intendedDropScreenPoint.x - nativeDrop.clientPoint.x,
    intendedDropScreenPoint.y - nativeDrop.clientPoint.y,
  )
  expect(Math.abs(intendedDropScreenPoint.x - nativeDrop.clientPoint.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(intendedDropScreenPoint.y - nativeDrop.clientPoint.y)).toBeLessThanOrEqual(1)
  const renderedPointerDistance = Math.hypot(
    renderedDrop.screenPoint.x - nativeDrop.clientPoint.x,
    renderedDrop.screenPoint.y - nativeDrop.clientPoint.y,
  )
  expect(renderedPointerDistance).toBeLessThanOrEqual(intendedPointerDistance + 1e-4)
  await quitSystemAdd(page)
  const movedPlanetAngle = 1.5
  await dragToWorldPoint(
    page,
    map,
    newPlanet.locator('.object-hit-target'),
    await ellipticalOrbitPoint(map, orbitLabel, movedPlanetAngle),
  )
  await expect.poll(() => ellipticalOrbitAngle(map, orbitLabel, 'New planet 1'))
    .toBeCloseTo(movedPlanetAngle, 2)
  const renderedNewPlanetAngle = await ellipticalOrbitAngle(map, orbitLabel, 'New planet 1')

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
  const exportedNewPlanet = system.objects.find(object => object.name === 'New planet 1')!
  expect(exportedOrbit.center).toEqual({ x: 0.2, y: 0.5 })
  expect(exportedNewPlanet.placement).toEqual({ kind: 'orbit', orbitId: exportedOrbit.id })
  expect(systemExport.layout.objectAngles[exportedNewPlanet.id]).toBeCloseTo(renderedNewPlanetAngle, 10)
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

  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await page.reload()
  await openWorkspaceHierarchy(page)
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

  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'elliptical-system.json', JSON.stringify(systemExport))
  const importPreview = importReviewDialog(page)
  const importSummary = await importPreview.innerText()
  expect(importSummary).toContain('Star systems: 1')
  await resolveImportReview(importPreview, 'confirm')
  await returnToClusterMap(page)
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
  await setJsonFile(input, 'elliptical-cluster.json', JSON.stringify(clusterExport))
  const clusterPreview = importReviewDialog(page)
  const clusterSummary = await clusterPreview.innerText()
  expect(clusterSummary).toContain('Star systems: 2')
  await resolveImportReview(clusterPreview, 'confirm')
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

  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
  await addCatalogueObject(page, 'moon', {
    target: { kind: 'orbit', label: 'Orbit 1 around Iria' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)

  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
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

  await setWorkspaceMapMode(page, 'Move')
  const centerHandle = detachedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  const objectBeforeMove = await map.getByRole('button', { name: /Nix/ }).getAttribute('transform')
  const movedCenter = { x: detachedCenter.x + 64, y: detachedCenter.y + 32 }
  await ensureMapDragPointsReachable(page, map, centerHandle, movedCenter)
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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

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
  await openWorkspaceHierarchy(page)
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

  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('button', { name: /Select PL-01, Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
  await addCatalogueObject(page, 'moon', {
    target: { kind: 'orbit', label: 'Orbit 1 around Iria' },
  })

  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  const innerOrbit = map.getByRole('group', { name: 'Orbit 1 around Iria' }).locator('.orbit-ring')
  const orbitCenterBefore = await innerOrbit.getAttribute('cx')
  const planetBefore = await planet.getAttribute('transform')
  await ensureMapDragPointsReachable(page, map, planet.locator('.object-hit-target'), { x: 545, y: 185 })
  await beginDragToWorldPoint(page, map, planet.locator('.object-hit-target'), { x: 545, y: 185 })
  await expect(planet).toHaveClass(/is-dragging/)
  await expect.poll(async () => planet.getAttribute('transform'))
    .not.toBe(planetBefore)
  await expect.poll(async () => innerOrbit.getAttribute('cx'))
    .not.toBe(orbitCenterBefore)
  await page.mouse.up()
})

test('dragging Add Orbit onto a map object hosts it there', async ({ page }) => {
  await page.addInitScript(recordNativeDragTypes)
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
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

  const orbitDragTypes = await page.evaluate(() =>
    (window as DragPreviewWindow).__nativeDragTypes?.slice(-1)[0],
  )
  expect(orbitDragTypes).toContain('application/x-ttrpg-cluster-control-map-orbit')
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()
  const ring = map.getByRole('group', { name: 'Orbit 1 around Primary Star' }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x),
  ).toBeLessThan(1)
  await expect.poll(async () =>
    Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y),
  ).toBeLessThan(1)
  await quitSystemAdd(page)
})

test('dropping an existing unoccupied Orbit center onto an object raises too-small radii and round-trips', async ({ page }) => {
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

  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
  await ensureMapDragPointsReachable(page, map, addOrbit, { x: 360, y: 320 })
  await dragHtmlElementToWorldPoint(
    page,
    addOrbit,
    map,
    { x: 360, y: 320 },
  )

  const unoccupiedOrbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })
  const orbitId = await unoccupiedOrbit.getAttribute('data-orbit-id')
  await expect(unoccupiedOrbit).toBeVisible()
  await quitSystemAdd(page)
  await setWorkspaceMapMode(page, 'Move')
  const centerHandle = unoccupiedOrbit.locator('.orbit-center-handle')
  await expect(centerHandle).toBeVisible()
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('16')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('60')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  const unoccupiedRing = unoccupiedOrbit.locator('.orbit-ring')
  await expect(unoccupiedRing).toHaveAttribute('rx', '16')
  await expect(unoccupiedRing).toHaveAttribute('ry', '60')

  const host = map.getByRole('button', { name: /Primary Star/ })
  const hostPoint = await host.evaluate(element => {
    const transform = element.getAttribute('transform')?.match(/^translate\(([^ ]+) ([^)]+)\)$/)
    if (!transform) throw new Error('Could not locate the host object on the map.')
    return { x: Number(transform[1]), y: Number(transform[2]) }
  })

  await ensureMapDragPointsReachable(page, map, centerHandle, hostPoint)
  await dragToWorldPoint(page, map, centerHandle, hostPoint)

  const hostedOrbit = map.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  await expect(hostedOrbit).toBeVisible()
  const ring = hostedOrbit.locator('.orbit-ring')
  await expect(ring).toHaveAttribute('rx', '39')
  await expect(ring).toHaveAttribute('ry', '60')
  await expect.poll(async () => Math.abs(Number(await ring.getAttribute('cx')) - hostPoint.x))
    .toBeLessThan(1)
  await expect.poll(async () => Math.abs(Number(await ring.getAttribute('cy')) - hostPoint.y))
    .toBeLessThan(1)
  const radiusNotice = page.getByRole('status').filter({
    hasText: 'Orbit radii increased to the new host minimum of 39.',
  })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  const inspectorPanel = page.locator('#workspace-inspector-panel')
  await inspectorToggle.click()
  await expect(inspectorPanel).toBeHidden()
  await expect(radiusNotice).toBeVisible()
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 0 objects/ }))
    .toBeVisible()

  await inspectorToggle.click()
  await expect(inspectorPanel).toBeVisible()
  await ensureMapDragPointsReachable(page, map, addOrbit, { x: 660, y: 350 })
  await dragHtmlElementToWorldPoint(
    page,
    page.getByRole('button', { name: 'Add orbit' }),
    map,
    { x: 660, y: 350 },
  )
  const smallOrbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })
  const smallOrbitId = await smallOrbit.getAttribute('data-orbit-id')
  await expect(smallOrbit).toBeVisible()
  await quitSystemAdd(page)
  await hierarchy.getByRole('button', { name: /Orbit 1 around unoccupied center, 0 objects/ }).click()
  await page.getByRole('button', { name: 'Edit Orbit' }).click()
  await page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true }).fill('16')
  await page.getByRole('spinbutton', { name: 'Vertical radius', exact: true }).fill('16')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(smallOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '16')
  await expect(smallOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '16')
  await ensureMapDragPointsReachable(page, map, smallOrbit.locator('.orbit-center-handle'), hostPoint)
  await dragToWorldPoint(page, map, smallOrbit.locator('.orbit-center-handle'), hostPoint)
  const secondHostedOrbit = map.getByRole('group', { name: 'Orbit 2 around Primary Star' })
  await expect(secondHostedOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '39')
  await expect(secondHostedOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '39')

  const exported = await downloadJson(page, 'Export star system JSON')
  const exportedOrbit = exported.system?.orbits.find(orbit => orbit.id === orbitId)
  expect(exportedOrbit).toMatchObject({ id: orbitId, hostId: expect.any(String), order: 1 })
  expect(exported.layout.orbitRadii[orbitId!]).toEqual({ horizontal: 39, vertical: 60 })
  expect(exported.system?.orbits.find(orbit => orbit.id === smallOrbitId))
    .toMatchObject({ id: smallOrbitId, hostId: expect.any(String), order: 2 })
  expect(exported.layout.orbitRadii[smallOrbitId!]).toEqual({ horizontal: 39, vertical: 39 })

  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'hosted-orbit.json', JSON.stringify(exported))
  const confirmation = importReviewDialog(page)
  const confirmationSummary = await confirmation.innerText()
  expect(confirmationSummary).toContain('Star systems: 1')
  await resolveImportReview(confirmation, 'confirm')

  await returnToClusterMap(page)
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systems = page.getByRole('navigation', { name: 'Star systems' })
  const openSystem = systems.getByRole('button', { name: 'Open Vesper system map' }).last()
  await openSystem.click()
  const copiedMap = page.getByRole('group', { name: 'Vesper star system map' })
  const copiedOrbit = copiedMap.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  await expect(copiedOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '39')
  await expect(copiedOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '60')
  const copiedSecondOrbit = copiedMap.getByRole('group', { name: 'Orbit 2 around Primary Star' })
  await expect(copiedSecondOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '39')
  await expect(copiedSecondOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '39')
  await page.reload()
  await openWorkspaceHierarchy(page)
  const restoredSystems = page.getByRole('navigation', { name: 'Star systems' })
  await restoredSystems.getByRole('button').last().click()
  const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  const restoredOrbit = restoredMap.getByRole('group', { name: 'Orbit 1 around Primary Star' })
  await expect(restoredOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '39')
  await expect(restoredOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '60')
  const restoredSecondOrbit = restoredMap.getByRole('group', { name: 'Orbit 2 around Primary Star' })
  await expect(restoredSecondOrbit.locator('.orbit-ring')).toHaveAttribute('rx', '39')
  await expect(restoredSecondOrbit.locator('.orbit-ring')).toHaveAttribute('ry', '39')

  await returnToClusterMap(page)
  const exportedCluster = await downloadJson(page, 'Export Jump Cluster JSON')
  const hostedOrbits = exportedCluster.cluster!.systems.flatMap(system =>
    system.orbits.filter(orbit => orbit.hostId !== null),
  )
  expect(hostedOrbits).toHaveLength(4)
  for (const hostedOrbit of hostedOrbits) {
    const expected = hostedOrbit.order === 1
      ? { horizontal: 39, vertical: 60 }
      : { horizontal: 39, vertical: 39 }
    expect(exportedCluster.layout.orbitRadii[hostedOrbit.id]).toEqual(expected)
  }
  await setJsonFile(input, 'hosted-orbit-cluster.json', JSON.stringify(exportedCluster))
  const clusterImportPreview = importReviewDialog(page)
  const clusterImportSummary = await clusterImportPreview.innerText()
  expect(clusterImportSummary).toContain('Star systems: 2')
  await resolveImportReview(clusterImportPreview, 'confirm')
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await page.getByRole('navigation', { name: 'Star systems' })
    .getByRole('button', { name: 'Open Vesper system map' }).last().click()
  const clusteredMapCopy = page.getByRole('group', { name: 'Vesper star system map' })
  await expect(clusteredMapCopy.getByRole('group', { name: 'Orbit 1 around Primary Star' }).locator('.orbit-ring'))
    .toHaveAttribute('rx', '39')
  await expect(clusteredMapCopy.getByRole('group', { name: 'Orbit 2 around Primary Star' }).locator('.orbit-ring'))
    .toHaveAttribute('ry', '39')
})

test('object palette drag previews match placed marks and preserve map, Orbit, and keyboard adds', async ({ page }) => {
  await page.addInitScript(recordNativeDragTypes)
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

  const hierarchy = await openWorkspaceHierarchy(page)
  await page.getByRole('button', { name: 'Add to map', exact: true }).click()
  const palette = page.getByRole('region', { name: 'Object palette' })
  await expect(palette).toBeVisible()
  expect(await palette.evaluate(element => element.closest('[aria-label="Add to map"]') !== null)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await setHeaderMapActionsOpen(page, true)
  await waitForFiniteAnimations(page)
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
  await ensureMapDragPointsReachable(page, map, addStar, { x: 320, y: 400 })
  await dragHtmlElementToWorldPoint(page, addStar, map, { x: 320, y: 400 }, async () => {
    starPreviewText = await assertDragPreview(starMark)
  })
  const objectDragTypes = await page.evaluate(() =>
    (window as DragPreviewWindow).__nativeDragTypes?.slice(-1)[0],
  )
  expect(objectDragTypes).toContain('application/x-ttrpg-cluster-control-map-object')
  await expect(mapObjects).toHaveCount(objectsBeforeStarDrop + 1)
  await expect(mapObjects.nth(objectsBeforeStarDrop).locator('.system-object-glyph'))
    .toHaveText(starPreviewText)

  await quitSystemAdd(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  const addPlanet = await selectCatalogueObjectButton(page, 'planet')
  const planetMark = (await addPlanet.locator('.object-mark').textContent())?.trim() ?? ''
  const objectsBeforePlanetDrop = await mapObjects.count()
  let planetPreviewText = ''
  await page.evaluate(() => {
    (window as DragPreviewWindow).__dragPreview = undefined
  })
  await ensureMapDragPointsReachable(page, map, addPlanet, { x: 592, y: 280 })
  await dragHtmlElementToWorldPoint(page, addPlanet, map, { x: 592, y: 280 }, async () => {
    planetPreviewText = await assertDragPreview(planetMark)
  })
  await expect(mapObjects).toHaveCount(objectsBeforePlanetDrop + 1)
  await expect(mapObjects.nth(objectsBeforePlanetDrop).locator('.system-object-glyph'))
    .toHaveText(planetPreviewText)
  await expect(hierarchy.getByRole('button', { name: /Orbit 1 around Primary Star, 1 object/ }))
    .toBeVisible()

  await quitSystemAdd(page)
  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const keyboardAddPlanet = await selectCatalogueObjectButton(page, 'planet')
  await keyboardAddPlanet.press('Enter')
  await completeCatalogueObjectCreation(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star', angleDegrees: 45 },
    noSelection: true,
  })
  const systemPlanet = hierarchy.getByRole('button', { name: /Select PL-02, New planet 2/ })
  await expect(systemPlanet).toBeVisible()
  await expect(systemPlanet.locator('.object-mark')).toHaveText('◉')
  await setWorkspaceMapMode(page, 'Move')
  const secondPlanetTarget = map.getByRole('button', { name: /New planet 2/ })
    .locator('.object-hit-target')
  const secondPlanetDropPoint = { x: 592, y: 280 }
  await ensureMapDragPointsReachable(page, map, secondPlanetTarget, secondPlanetDropPoint)
  await dragToWorldPoint(page, map, secondPlanetTarget, secondPlanetDropPoint)
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
  await waitForFiniteAnimations(page)
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
  const orbit = system.orbits[0]
  if (!orbit) throw new Error('The exported star system does not contain an Orbit.')
  const orbitId = orbit.id
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
