import type { Locator } from '@playwright/test'
import { addStarSystem, createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  exposedContinuousObjectHitPoint,
  fitWorkspaceMap,
  resolveJumpClusterRestoreReview,
  reviewJumpClusterBackup,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenMap,
  wardenObjectMark,
  workspaceZoomControls,
} from './helpers'

function readFrame(contour: Locator) {
  return contour.evaluate(element => {
    if (!(element instanceof SVGGeometryElement)) throw new Error('The visible frame is missing.')
    const { x, y, width, height } = element.getBBox()
    return { x, y, width, height }
  })
}

test('equivalent systems glide into detail together even with different halo sizes', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 900 } })
  const base = createLocalWorkspace('Halo Zoom', 'Vesper')
  const first = base.cluster.systems[0]!
  const { system: second, workspace } = addStarSystem(base, 'Helion')
  workspace.layout.systemPositions[first.id] = { x: 0.29, y: 0.5 }
  workspace.layout.systemPositions[second.id] = { x: 0.74, y: 0.5 }
  workspace.layout.systemFrames = {
    [first.id]: { left: 140, right: 140, top: 95, bottom: 95 },
  }
  const review = await reviewJumpClusterBackup(page, 'halo-zoom.json', JSON.stringify(exportJumpCluster(workspace)))
  await resolveJumpClusterRestoreReview(review, 'confirm')
  const map = wardenMap(page)
  await expect(map).toHaveAccessibleName('Halo Zoom continuous map')
  const envelope = (id: string) =>
    map.locator(`.continuous-warden-system[data-system-id="${id}"] .continuous-warden-system-envelope`)
  expect((await readFrame(envelope(first.id))).width).toBeGreaterThan((await readFrame(envelope(second.id))).width * 1.5)
  const detailed = map.locator('.continuous-warden-system-envelope.is-detailed')
  const controls = workspaceZoomControls(page)
  const zoomIn = controls.getByRole('button', { name: 'Zoom in', exact: true })
  const zoomOut = controls.getByRole('button', { name: 'Zoom out', exact: true })
  for (let step = 0; step < 20 && await zoomOut.isEnabled(); step += 1) await zoomOut.click()
  await expect(detailed).toHaveCount(0)
  const nameMotion = await map.evaluateHandle((element, systemId) => {
    const positions = new Set<string>()
    const camera = element.querySelector('.cluster-map-content')
    let revealCamera: string | null = null
    const observer = new MutationObserver(() => {
      const detailed = element.querySelector('.continuous-warden-system-envelope.is-detailed')
      const cameraTransform = camera?.getAttribute('transform')
      const position = element.querySelector(`.continuous-warden-name-target[data-system-id="${systemId}"]`)?.getAttribute('transform')
      if (!detailed || !cameraTransform || !position) return
      revealCamera ??= cameraTransform
      if (cameraTransform === revealCamera) positions.add(position)
    })
    observer.observe(element, { attributes: true, childList: true, subtree: true })
    return { positions, observer }
  }, first.id)
  for (let step = 0; step < 20 && await zoomIn.isEnabled(); step += 1) {
    await zoomIn.click()
    const count = await detailed.count()
    expect(count).not.toBe(1)
    if (count === 2) break
  }
  await expect(detailed).toHaveCount(2)
  await expect.poll(() => nameMotion.evaluate(({ positions }) => positions.size)).toBeGreaterThan(2)
  await nameMotion.evaluate(({ observer }) => observer.disconnect())
  await nameMotion.dispose()
})

test('a Warden can resize a halo corner and save the larger regular frame', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId, systemName } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 900 },
  })
  const map = wardenMap(page)
  const frame = map.locator(`.continuous-warden-system[data-system-id="${systemId}"] .continuous-warden-system-envelope`)
  await expect(frame).toBeVisible()
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  await page.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Move', exact: true }).click()

  const corner = map.getByLabel(`Resize top right corner of ${systemName}`, { exact: true })
  await expect(corner).toBeVisible()
  const target = await corner.boundingBox()
  if (!target) throw new Error('The frame resize corner needs a painted pointer target.')
  const original = await readFrame(frame)
  const handle = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  const distanceToEdge = await frame.evaluate((element, handleCenter) => {
    if (!(element instanceof SVGGeometryElement)) throw new Error('The system outline has no geometry.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The system outline has no screen transform.')
    const length = element.getTotalLength()
    let distance = Infinity
    for (let step = 0; step <= 512; step += 1) {
      const point = element.getPointAtLength(step * length / 512).matrixTransform(transform)
      distance = Math.min(distance, Math.hypot(point.x - handleCenter.x, point.y - handleCenter.y))
    }
    return distance
  }, handle)
  expect(distanceToEdge).toBeLessThan(2)
  const camera = map.locator('.cluster-map-content')
  const originalCamera = await camera.getAttribute('transform')
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x + 22, handle.y - 18, { steps: 8 })
  const preview = await readFrame(frame)
  expect(preview.width).toBeGreaterThan(original.width)
  expect(preview.height).toBeGreaterThan(original.height)
  expect(preview.x).toBeCloseTo(original.x, 4)
  expect(preview.y + preview.height).toBeCloseTo(original.y + original.height, 4)
  expect(await camera.getAttribute('transform')).toBe(originalCamera)
  await page.mouse.up()
  await expect.poll(() => readFrame(frame)).toEqual(preview)
  await waitForWorkspaceSaved(page)

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(before.type).toBe('cluster')
  expect(after.type).toBe('cluster')
  if (before.type !== 'cluster' || after.type !== 'cluster') throw new Error('Expected complete Cluster backups.')
  expect(after.cluster).toEqual(before.cluster)
  expect(after.layout.systemPositions).toEqual(before.layout.systemPositions)
  expect(after.layout.systemFrames?.[systemId]).toBeDefined()
  expect(after.layout.systemFrames?.[systemId]).not.toEqual(before.layout.systemFrames?.[systemId])

  await page.reload()
  await waitForWorkspaceStartup(page)
  await expect.poll(() => readFrame(frame)).toEqual(preview)
})

test('a drop near the reach of the elastic halo grows a regular frame and undoes both changes together', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 900 },
  })
  const map = wardenMap(page)
  const frame = map.locator(`.continuous-warden-system[data-system-id="${systemId}"] .continuous-warden-system-envelope`)
  const stretch = map.locator(`.continuous-warden-elastic-envelope[data-system-id="${systemId}"]`)
  const object = wardenObjectMark(page, systemId, primaryObjectId)
  await page.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Move', exact: true }).click()
  await expect(object).toBeVisible()
  const original = await readFrame(frame)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const hit = await exposedContinuousObjectHitPoint(object)
  if (!hit) throw new Error('The starting object needs a visible pointer target.')
  const origin = await object.evaluate(element => {
    if (!(element instanceof SVGGraphicsElement)) throw new Error('Expected a mark on the continuous map.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The mark needs a screen transform.')
    const point = new DOMPoint().matrixTransform(transform)
    return { x: point.x, y: point.y }
  })
  const screen = await frame.boundingBox()
  if (!screen) throw new Error('The starting frame needs a visible outline.')
  const drop = {
    x: screen.x + screen.width + 39 + hit.x - origin.x,
    y: screen.y + screen.height / 2 + hit.y - origin.y,
  }
  const dragToEdge = async () => {
    await page.mouse.move(hit.x, hit.y)
    await page.mouse.down()
    await page.mouse.move(drop.x, drop.y, { steps: 12 })
    await expect(stretch).toBeVisible()
  }
  await map.focus()
  await dragToEdge()
  await page.keyboard.press('Escape')
  await expect(stretch).toHaveCount(0)
  await page.mouse.up()
  expect(await readFrame(frame)).toEqual(original)

  await dragToEdge()
  await page.mouse.up()
  await expect(stretch).toHaveCount(0)
  await expect.poll(async () => (await readFrame(frame)).width).toBeGreaterThan(original.width)
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  if (before.type !== 'cluster' || after.type !== 'cluster') throw new Error('Expected complete Cluster backups.')
  expect(after.cluster?.systems[0]?.objects[0]?.placement).not.toEqual(before.cluster?.systems[0]?.objects[0]?.placement)
  expect(after.layout.systemFrames?.[systemId]).toBeDefined()

  await page.getByRole('button', { name: /^Undo(?:\b|:)/ }).click()
  await expect.poll(() => readFrame(frame)).toEqual(original)
  await waitForWorkspaceSaved(page)
  const restored = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(restored).toEqual(before)
})

test('dropping into another halo opens a seeded review when the Location key conflicts', async ({ page }) => {
  test.setTimeout(60_000)
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 900 } })
  const base = createLocalWorkspace('Halo Trial', 'Vesper')
  const source = base.cluster.systems[0]!
  const root = source.objects[0]!
  const { system: destination, workspace } = addStarSystem(base, 'Helion')
  workspace.layout.systemPositions[source.id] = { x: 0.37, y: 0.5 }
  workspace.layout.systemPositions[destination.id] = { x: 0.61, y: 0.5 }
  const restore = await reviewJumpClusterBackup(page, 'halo-trial.json', JSON.stringify(exportJumpCluster(workspace)))
  await resolveJumpClusterRestoreReview(restore, 'confirm')
  await expect(restore).toBeHidden()
  for (const name of ['Hierarchy', 'Inspect']) {
    const toggle = page.getByRole('button', { name, exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click()
  }
  await fitWorkspaceMap(page)
  const map = wardenMap(page)
  await expect(map).toHaveAccessibleName('Halo Trial continuous map')
  const sourceMark = wardenObjectMark(page, source.id, root.id)
  await page.getByRole('group', { name: 'Map interaction mode' })
    .getByRole('button', { name: 'Move', exact: true }).click()
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 4 && !await sourceMark.isVisible(); step += 1) await zoomIn.click()
  await expect(sourceMark).toBeVisible()
  const destinationFrame = map.locator(`.continuous-warden-system[data-system-id="${destination.id}"] .continuous-warden-system-envelope`)
  const bounds = await destinationFrame.boundingBox()
  const hit = await exposedContinuousObjectHitPoint(sourceMark)
  if (!bounds || !hit) throw new Error('The source object and destination frame need visible pointer targets.')
  await page.mouse.move(hit.x, hit.y)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 14 })
  await page.mouse.up()

  const review = page.getByRole('dialog', { name: 'Change system', exact: true })
  await expect(review).toBeVisible()
  await expect(review.getByLabel('Destination star system')).toHaveValue(destination.id)
  await expect(review.getByLabel('Replacement Location key for Primary Star')).not.toHaveValue(root.locationKey)
  await expect(sourceMark).toBeAttached()
  await review.getByRole('button', { name: 'Apply transfer', exact: true }).click()
  await expect(review).toBeHidden()
  await expect(wardenObjectMark(page, destination.id, root.id)).toBeVisible()
  await expect(sourceMark).toHaveCount(0)
})
