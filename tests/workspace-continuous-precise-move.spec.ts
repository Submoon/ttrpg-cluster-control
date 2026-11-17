import { expect, test } from './fixtures'
import {
  clickDockAction,
  createSingleSystemWorkspace,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  workspaceZoomControls,
} from './helpers'

type LocalPoint = { x: number; y: number }

async function prepareContinuousOrbitMap(page: import('@playwright/test').Page) {
  const { clusterName } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 960 },
  })
  const orbitId = await clickDockAction(page, 'Add orbit', {
    target: { kind: 'center', x: 0.3, y: 0.3 },
  })
  if (!orbitId) throw new Error('The unoccupied Orbit could not be created.')

  await page.goto('/?map=continuous')
  await waitForWorkspaceStartup(page)
  const map = page.getByRole('group', { name: `${clusterName} continuous map`, exact: true })
  await expect(map).toBeVisible()
  await setWorkspaceMapMode(page, 'Move')

  const orbit = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 32 && await orbit.count() === 0; step += 1) {
    await zoomIn.click()
  }
  await expect(orbit).toHaveCount(1)
  return { map, orbit, orbitId }
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
  const { map, orbitId } = await prepareContinuousOrbitMap(page)
  const object = map.locator('.continuous-warden-object[data-object-id]').first()
  const objectId = await object.getAttribute('data-object-id')
  if (!objectId) throw new Error('The continuous map object is missing its identity.')

  await object.click()
  const placement = page.getByRole('button', { name: 'Placement', exact: true })
  await expect(placement).toBeVisible()
  await placement.click()
  await page.getByRole('button', { name: 'Move on map', exact: true }).click()

  const ringPoint = await orbitClientPoint(map, orbitId, 0)
  const target = await orbitClientPoint(map, orbitId, 0, 18)
  expect(Math.hypot(target.local.x - ringPoint.local.x, target.local.y - ringPoint.local.y))
    .toBeCloseTo(18, 1)
  await page.mouse.click(target.client.x, target.client.y)

  await placement.click()
  await expect(page.getByRole('button', { name: 'Confirm position', exact: true })).toBeVisible()
  const previewPosition = objectLocalPosition(await object.getAttribute('transform'))
  expect(previewPosition.x).toBeCloseTo(target.local.x, 1)
  expect(previewPosition.y).toBeCloseTo(target.local.y, 1)

  await page.getByRole('button', { name: 'Confirm position', exact: true }).click()
  await expect.poll(async () => objectLocalPosition(await object.getAttribute('transform')).x)
    .toBeCloseTo(target.local.x, 1)
  await expect.poll(async () => objectLocalPosition(await object.getAttribute('transform')).y)
    .toBeCloseTo(target.local.y, 1)
  await waitForWorkspaceSaved(page)
})

test('continuous Orbit resize rolls back on Escape and accepts the next pointer gesture', async ({ page }) => {
  const { map, orbitId } = await prepareContinuousOrbitMap(page)
  const ringHit = await orbitClientPoint(map, orbitId, 0.7)
  await page.mouse.click(ringHit.client.x, ringHit.client.y)
  const resize = map.locator(
    `.continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id="${orbitId}"][data-resize-axis="horizontal"]`,
  )
  await expect(resize).toBeVisible()

  const ring = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)
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
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(ring).toHaveAttribute('rx', String(initialRadius))

  await dragHandle(32)
  await page.mouse.up()
  await expect.poll(async () => Number(await ring.getAttribute('rx')))
    .toBeGreaterThan(initialRadius)
  await waitForWorkspaceSaved(page)
})
