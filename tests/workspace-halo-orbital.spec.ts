import type { Locator } from '@playwright/test'
import {
  addStarSystem,
  createOrbit,
  createSystemObject,
  exportJumpCluster,
} from '../domain/workspace'
import { expect, test } from './fixtures'
import { createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import {
  addClusterSystem,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  exposedContinuousObjectHitPoint,
  fitWorkspaceMap,
  hideWorkspaceInspector,
  resolveJumpClusterRestoreReview,
  reviewJumpClusterBackup,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenMap,
  wardenObjectMark,
} from './helpers'

function readFrame(contour: Locator) {
  return contour.evaluate(element => {
    if (!(element instanceof SVGGeometryElement)) throw new Error('The visible frame is missing.')
    const { x, y, width, height } = element.getBBox()
    return { x, y, width, height }
  })
}

function requireSystemPosition(backup: Awaited<ReturnType<typeof downloadJson>>, systemId: string) {
  const position = backup.layout.systemPositions?.[systemId]
  if (!position) throw new Error(`The backup is missing the map position for ${systemId}.`)
  return position
}

test('create, name, move, resize, and reload a Warden system', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId: firstSystemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 900 } })
  const systemId = await addClusterSystem(page, { open: true, position: { x: 0.32, y: 0.35 } })
  if (!systemId) throw new Error('The created system has no domain identity.')
  await fitWorkspaceMap(page)

  const map = wardenMap(page)
  await expect(map.locator('.continuous-warden-anchor-mark, .continuous-warden-anchor-core')).toHaveCount(0)
  const nameTarget = map.locator(`.continuous-warden-name-target[data-system-id="${systemId}"]`)
  await expect(nameTarget).toBeVisible()
  await nameTarget.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  await menu.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  const systemName = inspector.getByLabel('Zone', { exact: true })
  await expect(systemName).toBeEditable()
  await systemName.fill('Helion')
  await inspector.getByRole('button', { name: 'Apply details', exact: true }).click()
  await waitForWorkspaceSaved(page)
  const renamedTarget = map.locator(`.continuous-warden-name-target[data-system-id="${systemId}"]`)
    .and(map.getByRole('button', { name: 'Select Helion', exact: true }))
  await expect(renamedTarget).toBeVisible()

  const beforeMove = await downloadJson(page, 'Export Jump Cluster JSON')
  const positionBefore = requireSystemPosition(beforeMove, systemId)

  await setWorkspaceMapMode(page, 'Select')
  await renamedTarget.click()
  await hideWorkspaceInspector(page)
  const nameBounds = await renamedTarget.locator('.continuous-warden-name-background').boundingBox()
  if (!nameBounds) throw new Error('The selected system name is missing its real drag target.')
  const start = { x: nameBounds.x + nameBounds.width / 2, y: nameBounds.y + nameBounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 22, start.y, { steps: 5 })
  await page.mouse.up()
  await waitForWorkspaceSaved(page)
  const afterNameDrag = await downloadJson(page, 'Export Jump Cluster JSON')
  const positionAfterMove = requireSystemPosition(afterNameDrag, systemId)
  expect(positionAfterMove.x).toBeGreaterThan(positionBefore.x)
  expect(positionAfterMove.y).toBeCloseTo(positionBefore.y, 8)
  expect(requireSystemPosition(afterNameDrag, firstSystemId)).toEqual(requireSystemPosition(beforeMove, firstSystemId))

  const frame = map.locator(`.continuous-warden-system[data-system-id="${systemId}"] .continuous-warden-system-envelope`)
  const initialFrame = await readFrame(frame)
  const corner = map.getByLabel('Resize top right corner of Helion', { exact: true })
  await expect(corner).toBeVisible()
  await expect(map.getByLabel('Resize top right corner of Vesper', { exact: true })).toHaveCount(0)
  await corner.focus()
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => (await readFrame(frame)).height).toBeGreaterThan(initialFrame.height)
  await waitForWorkspaceSaved(page)
  const resizedFrame = await readFrame(frame)
  const afterResize = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterResize.layout.systemFrames?.[systemId]).toBeDefined()
  expect(afterResize.layout.systemFrames?.[systemId]).not.toEqual(afterNameDrag.layout.systemFrames?.[systemId])
  const positionAfterResize = requireSystemPosition(afterResize, systemId)
  expect(positionAfterResize).toEqual(positionAfterMove)

  await page.reload()
  await waitForWorkspaceStartup(page)
  const reloadedMap = wardenMap(page)
  const reloadedName = reloadedMap.locator(`.continuous-warden-name-target[data-system-id="${systemId}"]`)
    .and(page.getByRole('button', { name: 'Select Helion', exact: true }))
  await expect(reloadedName).toBeVisible()
  await expect.poll(() => readFrame(reloadedMap.locator(
    `.continuous-warden-system[data-system-id="${systemId}"] .continuous-warden-system-envelope`,
  ))).toEqual(resizedFrame)
  const reloaded = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(requireSystemPosition(reloaded, systemId)).toEqual(positionAfterResize)
  expect(reloaded.layout.systemFrames?.[systemId]).toEqual(afterResize.layout.systemFrames?.[systemId])
})

function createTransferWorkspace() {
  const initial = createWorkspaceWithPrimaryStar('Halo Transfer', 'Vesper')
  const source = initial.cluster.systems[0]!
  const root = { ...createSystemObject(source, 'planet'), name: 'Herma' }
  const sourceWithRoot = { ...source, objects: [...source.objects, root] }
  const orbit = createOrbit(sourceWithRoot, root.id)
  const sourceWithOrbit = { ...sourceWithRoot, orbits: [...sourceWithRoot.orbits, orbit] }
  const child = { ...createSystemObject(sourceWithOrbit, 'moon', orbit.id), name: 'Nix' }
  const sourceWithBranch = { ...sourceWithOrbit, objects: [...sourceWithOrbit.objects, child] }
  const added = addStarSystem(initial, 'Helion')
  const destination = added.system
  const conflict = { ...createSystemObject(destination, 'planet'), name: 'Existing Planet' }
  const destinationWithConflict = { ...destination, objects: [...destination.objects, conflict] }
  const systems = added.workspace.cluster.systems.map(system => system.id === source.id
    ? sourceWithBranch
    : system.id === destination.id ? destinationWithConflict : system)
  return {
    workspace: {
      ...added.workspace,
      cluster: { ...added.workspace.cluster, systems },
      layout: {
        ...added.workspace.layout,
        systemPositions: {
          ...added.workspace.layout.systemPositions,
          [source.id]: { x: 0.34, y: 0.5 },
          [destination.id]: { x: 0.68, y: 0.5 },
        },
      },
    },
    source,
    destination,
    root,
    child,
    orbit,
    conflict,
  }
}

test('transferring a hosted branch reviews and resolves a destination Location key conflict', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 900 } })
  const fixture = createTransferWorkspace()
  const restore = await reviewJumpClusterBackup(page, 'halo-transfer.json', JSON.stringify(exportJumpCluster(fixture.workspace)))
  await resolveJumpClusterRestoreReview(restore, 'confirm')
  await waitForWorkspaceSaved(page)
  for (const name of ['Hierarchy', 'Inspect']) {
    const toggle = page.getByRole('button', { name, exact: true })
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click()
  }
  await fitWorkspaceMap(page)

  const map = wardenMap(page)
  const sourceMark = wardenObjectMark(page, fixture.source.id, fixture.root.id)
  await setWorkspaceMapMode(page, 'Move')
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 5 && !await sourceMark.isVisible(); step += 1) await zoomIn.click()
  await expect.poll(() => exposedContinuousObjectHitPoint(sourceMark)).not.toBeNull()
  const destinationFrame = map.locator(`.continuous-warden-system[data-system-id="${fixture.destination.id}"] .continuous-warden-system-envelope`)
  const bounds = await destinationFrame.boundingBox()
  const hit = await exposedContinuousObjectHitPoint(sourceMark)
  if (!bounds || !hit) throw new Error('The source branch and destination frame need visible pointer targets.')
  const origin = await sourceMark.evaluate(element => {
    if (!(element instanceof SVGGraphicsElement)) throw new Error('Expected a mark on the continuous map.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The mark needs a screen transform.')
    const point = new DOMPoint().matrixTransform(transform)
    return { x: point.x, y: point.y }
  })
  await page.mouse.move(hit.x, hit.y)
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width / 2 + hit.x - origin.x,
    bounds.y + bounds.height / 2 + hit.y - origin.y,
    { steps: 14 },
  )
  await page.mouse.up()

  const review = page.getByRole('dialog', { name: 'Change Zone', exact: true })
  await expect(review).toBeVisible()
  await expect(review.getByLabel('Destination Zone')).toHaveValue(fixture.destination.id)
  await expect(review).toContainText('2 objects and 1 hosted Orbits will move together.')
  await expect(review).toContainText('Herma')
  await expect(review).toContainText('Nix')
  const replacementKey = review.getByLabel('Replacement Location key for Herma', { exact: true })
  await expect(replacementKey).not.toHaveValue(fixture.root.locationKey)
  const appliedRootKey = await replacementKey.inputValue()
  await review.getByRole('button', { name: 'Apply transfer', exact: true }).click()
  await expect(review).toBeHidden()
  await waitForWorkspaceSaved(page)

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  if (after.type !== 'cluster' || !after.cluster) throw new Error('Expected a complete Jump Cluster backup.')
  const sourceAfter = after.cluster.systems.find(system => system.id === fixture.source.id)
  const destinationAfter = after.cluster.systems.find(system => system.id === fixture.destination.id)
  if (!sourceAfter || !destinationAfter) throw new Error('The transfer must retain both system identities.')
  expect(sourceAfter.objects.map(object => object.name)).toEqual(['Primary Star'])
  expect(sourceAfter.orbits).toEqual([])
  const movedRoot = destinationAfter.objects.find(object => object.id === fixture.root.id)
  const movedChild = destinationAfter.objects.find(object => object.id === fixture.child.id)
  expect(movedRoot?.locationKey).toBe(appliedRootKey)
  expect(movedRoot?.locationKey).not.toBe(fixture.root.locationKey)
  expect(movedChild?.placement).toEqual({ kind: 'orbit', orbitId: fixture.orbit.id })
  expect(destinationAfter.orbits).toContainEqual({ ...fixture.orbit, hostId: fixture.root.id })
  expect(destinationAfter.objects.find(object => object.id === fixture.conflict.id)?.locationKey)
    .toBe(fixture.conflict.locationKey)
})
