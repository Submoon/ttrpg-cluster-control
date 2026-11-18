import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  clickWardenSystemPoint,
  dockAction,
  downloadJson,
  createSingleSystemWorkspace,
  openWorkspaceHierarchy,
  quitSystemAdd,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
  workspaceZoomOutput,
} from './helpers'

type LocalPoint = { x: number; y: number }

async function prepareContinuousOrbitMap(page: import('@playwright/test').Page) {
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId, systemName } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })
  const map = wardenMap(page)
  const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await (await dockAction(page, 'Add orbit')).click()
  const delivered = await clickWardenSystemPoint(page, systemId, { x: 0.3, y: 0.3 })
  await expect(orbit).toHaveCount(1)
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const snapshot = await downloadJson(page, 'Export Jump Cluster JSON')
  const createdOrbit = snapshot.cluster?.systems.find(system => system.id === systemId)?.orbits[0]
  if (!createdOrbit) throw new Error('The saved unoccupied Orbit is missing from its owner.')
  expect(createdOrbit.hostId).toBeNull()
  expect(createdOrbit.center?.x).toBeCloseTo(delivered.x, 5)
  expect(createdOrbit.center?.y).toBeCloseTo(delivered.y, 5)
  await setWorkspaceMapMode(page, 'Move')
  return { map, orbit, orbitId: createdOrbit.id, primaryObjectId, systemId, systemName }
}

async function orbitClientPoint(
  map: import('@playwright/test').Locator,
  orbitId: string,
  angle: number,
  offset = 0,
): Promise<{ client: LocalPoint; local: LocalPoint; radius: number }> {
  return map.evaluate((element, input) => {
    const ellipse = [...element.querySelectorAll<SVGEllipseElement>('.continuous-warden-orbit-target')]
      .find(candidate => candidate.getAttribute('data-orbit-id') === input.orbitId)
    const detail = element.querySelector<SVGGElement>('.continuous-warden-system-detail')
    const matrix = detail?.getScreenCTM()
    if (!ellipse || !matrix) throw new Error('The continuous map Orbit is not measurable.')

    const cx = Number(ellipse.getAttribute('cx'))
    const cy = Number(ellipse.getAttribute('cy'))
    const radius = Number(ellipse.getAttribute('rx'))
    const rotation = Number(ellipse.getAttribute('transform')?.match(/^rotate\(([-+.\deE]+)/)?.[1] ?? 0)
      * Math.PI / 180
    const paramX = (radius + input.offset) * Math.cos(input.angle)
    const paramY = Number(ellipse.getAttribute('ry')) * Math.sin(input.angle)
    const local = {
      x: cx + paramX * Math.cos(rotation) - paramY * Math.sin(rotation),
      y: cy + paramX * Math.sin(rotation) + paramY * Math.cos(rotation),
    }
    const screen = new DOMPoint(local.x, local.y).matrixTransform(matrix)
    return { client: { x: screen.x, y: screen.y }, local, radius }
  }, { orbitId, angle, offset })
}

function objectLocalPosition(transform: string | null): LocalPoint {
  const match = transform?.match(/^translate\(([-+.\deE]+)[ ,]+([-+.\deE]+)/)
  if (!match) throw new Error(`Unexpected continuous object transform: ${transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

test('continuous precise Free placement stays exact beside an Orbit and commits to its inspected owner', async ({ page }) => {
  const { map, orbitId, primaryObjectId, systemId, systemName } = await prepareContinuousOrbitMap(page)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemBranch = hierarchy.getByRole('treeitem', { name: systemName, exact: true })
  const primaryObject = hierarchy.getByRole('treeitem', { name: /^Select [^,]+, Primary Star\b/ })
  if (await systemBranch.getAttribute('aria-expanded') === 'true') {
    await systemBranch.getByRole('button', { name: `Collapse ${systemName}`, exact: true }).click()
  }
  await expect(systemBranch).toHaveAttribute('aria-expanded', 'false')
  await expect(primaryObject).toBeHidden()
  await systemBranch.getByRole('button', { name: `Expand ${systemName}`, exact: true }).click()
  await expect(primaryObject).toBeVisible()
  await expect(systemBranch).toBeFocused()
  await systemBranch.press('ArrowLeft')
  await expect(primaryObject).toBeHidden()
  await systemBranch.getByRole('button', { name: `Expand ${systemName}`, exact: true }).click()
  await expect(systemBranch).toHaveAttribute('aria-expanded', 'true')
  await expect(primaryObject).toBeVisible()
  await primaryObject.click()
  const object = wardenObjectMark(page, systemId, primaryObjectId)
  await expect(object).toBeVisible()
  const placement = page.getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()

  const ringPoint = await orbitClientPoint(map, orbitId, 0)
  const target = await orbitClientPoint(map, orbitId, 0, 18)
  expect(Math.hypot(target.local.x - ringPoint.local.x, target.local.y - ringPoint.local.y))
    .toBeCloseTo(18, 1)
  const click = { x: Math.round(target.client.x), y: Math.round(target.client.y) }
  const expected = await map.locator('.continuous-warden-system-detail').evaluate((element, point) => {
    if (!(element instanceof SVGGraphicsElement)) throw new Error('The owning system has no geometry.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The owning system has no screen transform.')
    const local = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }, click)
  await page.mouse.click(click.x, click.y)

  await placement.click()
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  const previewPosition = objectLocalPosition(await object.getAttribute('transform'))
  expect(previewPosition.x).toBeCloseTo(expected.x, 1)
  expect(previewPosition.y).toBeCloseTo(expected.y, 1)

  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect.poll(async () => objectLocalPosition(await object.getAttribute('transform')).x)
    .toBeCloseTo(expected.x, 1)
  await expect.poll(async () => objectLocalPosition(await object.getAttribute('transform')).y)
    .toBeCloseTo(expected.y, 1)
  await waitForWorkspaceSaved(page)
})

test('continuous Orbit resize rolls back on Escape and accepts the next pointer gesture', async ({ page }) => {
  const { map, orbit, orbitId, systemId } = await prepareContinuousOrbitMap(page)
  const ringHit = await orbit.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit has no ellipse.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The Orbit has no screen transform.')
    const length = element.getTotalLength()
    for (let step = 0; step < 32; step++) {
      const point = element.getPointAtLength(length * step / 32).matrixTransform(transform)
      const x = Math.round(point.x)
      const y = Math.round(point.y)
      if (document.elementFromPoint(x, y) === element) return { x, y }
    }
    throw new Error('No painted Orbit stroke is reachable.')
  })
  await page.mouse.click(ringHit.x, ringHit.y)
  const resize = map.locator(
    `.continuous-warden-orbit-edit-handle[data-system-id="${systemId}"][data-orbit-id="${orbitId}"][data-resize-axis="horizontal"]`,
  )
  await expect(resize).toBeVisible()

  const ring = orbit
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const initialRadius = Number(await ring.getAttribute('rx'))
  const dragHandle = async (distance: number): Promise<void> => {
    const bounds = await resize.boundingBox()
    if (!bounds) throw new Error('The continuous Orbit resize handle has no visible bounds.')
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + distance, point.y, { steps: 3 })
  }

  await dragHandle(32)
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(initialRadius)
  await page.keyboard.press('Escape')
  await expect(ring).toHaveAttribute('rx', String(initialRadius))
  // Keep the canceled contact held past the compatibility-click deadline.
  await page.waitForTimeout(1_200)
  await page.mouse.up()
  await expect(ring).toHaveAttribute('rx', String(initialRadius))
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)

  await dragHandle(32)
  await page.mouse.up()
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(initialRadius)
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.layout.orbitRadii[orbitId]).not.toEqual(before.layout.orbitRadii[orbitId])

  await resize.focus()
  await expect(resize).toBeFocused()
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The continuous map is not visible.')
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2)
  await page.mouse.wheel(0, 1800)
  await expect(resize).toHaveCount(0)
  const appliedPercentage = await map.locator('.cluster-map-content').evaluate(element => {
    if (!(element instanceof SVGGElement)) throw new Error('The camera group has no SVG transform.')
    return element.transform.baseVal.getItem(1).matrix.a * 100
  })
  await expect(workspaceZoomOutput(page)).toHaveText(`${Math.round(appliedPercentage)}%`)
  await expect.poll(() => map.evaluate(element => {
    const focused = document.activeElement
    return focused === element || (element.contains(focused) && focused?.classList.contains('continuous-warden-name-target'))
  })).toBe(true)
})
