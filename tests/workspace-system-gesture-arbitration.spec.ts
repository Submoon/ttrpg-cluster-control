import { expect, test, type Locator, type Page } from './fixtures'
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  dockAction,
  quitSystemAdd,
  selectInspectorOption,
  wardenMap,
  wardenObjectMark,
  wardenOrbitLocalGeometry,
  workspaceZoomControls,
} from './helpers'

type ScreenPoint = { x: number; y: number }
async function createWorkspace(page: Page) {
  await captureMapExportBlobs(page)
  const identity = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })
  await waitForWorkspaceSaved(page)
  return identity
}

async function createHostedOrbit(page: Page): Promise<{
  map: Locator
  ring: Locator
  systemId: string
  primaryObjectId: string
}> {
  const { systemId, primaryObjectId } = await createWorkspace(page)
  await (await dockAction(page, 'Add orbit')).click()
  const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  const placement = controls.getByRole('button', { name: 'Placement', exact: true })
  if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
  await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
    identity: { attribute: 'data-object-id', id: primaryObjectId },
  })
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()
  await quitSystemAdd(page)
  const map = wardenMap(page)
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(ring).toHaveCount(1)
  const { start } = await orbitDragPoints(ring, 1, .5)
  await page.mouse.click(start.x, start.y)
  await closeVisiblePanels(page)
  await centerWorkspaceSelection(page)
  await waitForWorkspaceSaved(page)
  return { map, ring, systemId, primaryObjectId }
}

async function closeVisiblePanels(page: Page): Promise<void> {
  const hierarchy = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchy.count() && await hierarchy.getAttribute('aria-expanded') === 'true') {
    await hierarchy.click()
  }
  const inspect = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspect.count() && await inspect.getAttribute('aria-expanded') === 'true') {
    await inspect.click()
  }
}

async function orbitDragPoints(
  orbitTarget: Locator,
  scale: number,
  angle: number,
): Promise<{ start: ScreenPoint; end: ScreenPoint }> {
  return orbitTarget.evaluate((element, target) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit input target is not an ellipse.')
    const ellipse = element
    const systemId = ellipse.getAttribute('data-system-id')
    const orbitId = ellipse.getAttribute('data-orbit-id')
    if (!systemId || !orbitId) throw new Error('The Orbit input target has no owner-qualified identity.')
    const transform = ellipse.getScreenCTM()
    if (!transform) throw new Error('The Orbit hit target is not attached to the map.')
    const cx = Number(ellipse.getAttribute('cx'))
    const cy = Number(ellipse.getAttribute('cy'))
    const rx = Number(ellipse.getAttribute('rx'))
    const ry = Number(ellipse.getAttribute('ry'))
    const map = element.closest('svg')
    const screenRadius = Math.max(
      Math.hypot(transform.a * rx, transform.b * rx),
      Math.hypot(transform.c * ry, transform.d * ry),
    )
    // Sample at most half a CSS pixel apart, preferring the requested angle over distant paint.
    // Native hits must land on the dashed ring itself; axis handles would change the drag's meaning.
    const sampleCount = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    const inverse = transform.inverse()
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const offset = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / sampleCount
      const point = new DOMPoint(cx + rx * Math.cos(target.angle + offset), cy + ry * Math.sin(target.angle + offset))
        .matrixTransform(transform)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const start = { x: Math.round(point.x) + dx, y: Math.round(point.y) + dy }
          const hit = document.elementFromPoint(start.x, start.y)
          const visibleArc = hit?.matches('.continuous-warden-orbit-visible-arc')
            && hit.getAttribute('data-system-id') === systemId && hit.getAttribute('data-orbit-id') === orbitId
          if (hit !== ellipse && !visibleArc) continue
          const localStart = new DOMPoint(start.x, start.y).matrixTransform(inverse)
          const destination = new DOMPoint(
            cx + (localStart.x - cx) * target.scale,
            cy + (localStart.y - cy) * target.scale,
          ).matrixTransform(transform)
          const end = { x: Math.round(destination.x), y: Math.round(destination.y) }
          const reachable = Array.from({ length: 7 }, (_, step) => {
            const x = start.x + (end.x - start.x) * step / 6
            const y = start.y + (end.y - start.y) * step / 6
            return map?.contains(document.elementFromPoint(x, y))
          }).every(Boolean)
          if (reachable) return { start, end }
        }
      }
    }
    throw new Error(`Orbit ${orbitId} in system ${systemId} has no frontmost painted ring hit with an unobstructed native drag path.`)
  }, { scale, angle })
}

async function orbitOffStrokeDragPoints(
  orbitTarget: Locator,
  angle: number,
  offsetPixels: number,
  dragPixels: number,
): Promise<{ start: ScreenPoint; end: ScreenPoint; hitClass: string; hitOrbitId: string | null }> {
  const painted = await orbitDragPoints(orbitTarget, 1, angle)
  return orbitTarget.evaluate((element, input) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit input target is not an ellipse.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The Orbit hit target is not attached to the map.')
    const cx = element.cx.baseVal.value
    const cy = element.cy.baseVal.value
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const localStart = new DOMPoint(input.start.x, input.start.y).matrixTransform(matrix.inverse())
    const angleOnEllipse = Math.atan2((localStart.y - cy) / ry, (localStart.x - cx) / rx)
    const tangentLocal = {
      x: -rx * Math.sin(angleOnEllipse),
      y: ry * Math.cos(angleOnEllipse),
    }
    const tangent = {
      x: matrix.a * tangentLocal.x + matrix.c * tangentLocal.y,
      y: matrix.b * tangentLocal.x + matrix.d * tangentLocal.y,
    }
    const tangentLength = Math.hypot(tangent.x, tangent.y)
    if (!Number.isFinite(tangentLength) || tangentLength === 0) {
      throw new Error('The Orbit ring has no measurable screen-space tangent.')
    }
    let normal = { x: tangent.y / tangentLength, y: -tangent.x / tangentLength }
    const center = new DOMPoint(cx, cy).matrixTransform(matrix)
    const radial = { x: input.start.x - center.x, y: input.start.y - center.y }
    if (normal.x * radial.x + normal.y * radial.y < 0) normal = { x: -normal.x, y: -normal.y }
    const start = {
      x: Math.round(input.start.x + normal.x * input.offsetPixels),
      y: Math.round(input.start.y + normal.y * input.offsetPixels),
    }
    const end = {
      x: Math.round(start.x + normal.x * input.dragPixels),
      y: Math.round(start.y + normal.y * input.dragPixels),
    }
    const hit = document.elementFromPoint(start.x, start.y)
    return {
      start,
      end,
      hitClass: hit?.getAttribute('class') ?? '',
      hitOrbitId: hit?.closest('[data-orbit-id]')?.getAttribute('data-orbit-id') ?? null,
    }
  }, { start: painted.start, offsetPixels, dragPixels })
}

test('Select supports resizing a selected Orbit from its near-ring target at maximum zoom', async ({ page }) => {
  const { map, ring, systemId, primaryObjectId } = await createHostedOrbit(page)
  const controls = workspaceZoomControls(page)
  const zoomIn = controls.getByRole('button', { name: 'Zoom in', exact: true })
  await expect(ring).not.toHaveClass(/is-clipped/)
  const keyboardTarget = await ring.elementHandle()
  try {
    for (let step = 0; step < 18 && await zoomIn.isEnabled(); step++) await zoomIn.click()
    await expect(controls.locator('output').first()).toHaveText('320%')
    await expect(map.locator('.continuous-warden-orbit-visible-arc').first()).toBeVisible()
    // Arc paint replaces the visible stroke while the same native ellipse keeps keyboard ownership.
    expect(await ring.evaluate((element, original) => element === original, keyboardTarget)).toBe(true)
  } finally {
    await keyboardTarget.dispose()
  }
  await expect(map.getByRole('button', { name: 'Select Orbit 1', exact: true })).toHaveCount(1)

  await wardenObjectMark(page, systemId, primaryObjectId).press('Enter')
  await ring.press('Enter')
  await expect(page.getByRole('button', { name: 'Edit Orbit', exact: true })).toBeVisible()
  await wardenObjectMark(page, systemId, primaryObjectId).press('Enter')
  await closeVisiblePanels(page)
  const unselectedRadii = (await wardenOrbitLocalGeometry(ring, systemId)).radii
  const unselectedDrag = await orbitOffStrokeDragPoints(ring, .65, 8, 24)
  await page.mouse.move(unselectedDrag.start.x, unselectedDrag.start.y)
  await page.mouse.down()
  await page.mouse.move(unselectedDrag.end.x, unselectedDrag.end.y, { steps: 5 })
  await page.mouse.up()
  const afterUnselectedDrag = (await wardenOrbitLocalGeometry(ring, systemId)).radii
  expect(afterUnselectedDrag.horizontal).toBeCloseTo(unselectedRadii.horizontal, 2)
  expect(afterUnselectedDrag.vertical).toBeCloseTo(unselectedRadii.vertical, 2)
  const painted = await orbitDragPoints(ring, 1, .65)
  await page.mouse.click(painted.start.x, painted.start.y)
  await expect(page.getByRole('button', { name: 'Edit Orbit', exact: true })).toBeVisible()
  await expect(ring).toBeFocused()
  await closeVisiblePanels(page)
  const rotateHandle = map.getByRole('slider', { name: /Rotate .*Orbit 1$/ })
  const beforeRotation = await rotateHandle.getAttribute('aria-valuenow')
  expect(beforeRotation).not.toBeNull()
  await rotateHandle.press('ArrowRight')
  await expect(rotateHandle).not.toHaveAttribute('aria-valuenow', beforeRotation!)
  await waitForWorkspaceSaved(page)
  const before = await wardenOrbitLocalGeometry(ring, systemId)
  const drag = await orbitOffStrokeDragPoints(ring, .65, 8, 24)
  expect(drag.hitClass.split(/\s+/)).toContain('continuous-warden-orbit-hit-target')
  expect(drag.hitOrbitId).toBe(await ring.getAttribute('data-orbit-id'))
  await page.mouse.move(drag.start.x, drag.start.y)
  await page.mouse.down()
  try {
    await page.mouse.move(drag.end.x, drag.end.y, { steps: 5 })
    await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
      .toBeGreaterThan(before.radii.horizontal + .5)
  } finally {
    await page.mouse.up()
  }
  await waitForWorkspaceSaved(page)
  expect((await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeGreaterThan(before.radii.horizontal + .5)

  const wheelPoint = (await orbitDragPoints(ring, 1, .65)).start
  const rotationBeforeWheel = await rotateHandle.getAttribute('aria-valuenow')
  await page.mouse.move(wheelPoint.x, wheelPoint.y)
  await page.keyboard.down('Control')
  try {
    await page.mouse.wheel(0, 100)
  } finally {
    await page.keyboard.up('Control')
  }
  await expect(rotateHandle).not.toHaveAttribute('aria-valuenow', rotationBeforeWheel!)
  await expect(page.getByRole('button', { name: /^Undo: Rotate Orbit 1/ })).toBeEnabled()
})
