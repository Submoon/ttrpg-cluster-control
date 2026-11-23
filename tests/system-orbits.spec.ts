import { expect, test, preparedCampaignTest as campaignTest, type Locator, type Page } from './fixtures'
import {
  captureMapExportBlobs, centerWorkspaceSelection, clickWardenSystemPoint, createSingleSystemWorkspace,
  dockAction, downloadJson, hideWorkspaceInspector, measureMouseDrag, openWorkspaceHierarchy,
  quitSystemAdd, selectInspectorOption, setWorkspaceMapMode, waitForWorkspaceSaved,
  wardenLocalCoordinates, wardenMap, wardenObjectMark, wardenOrbitLocalGeometry, workspaceZoomControls, type WorldPoint,
} from './helpers'



const detachedOrbitJourneyTest = campaignTest.extend<{ detachedOrbitPage: Page }>({
  detachedOrbitPage: [async ({ campaignWorkspacePage: page }, use) => {
    await captureMapExportBlobs(page)
    await test.step('Open Vesper Prime and prepare the empty sibling Orbit', async () => {
      await inspectSystem(page, 'Vesper Prime')
      const hierarchy = await openWorkspaceHierarchy(page)
      await hierarchy.getByRole('treeitem', { name: /Select PL-01, Iria/ }).click()
      const initial = await downloadJson(page, 'Export star system JSON')
      const iria = initial.system?.objects.find(object => object.name === 'Iria')
      if (!iria) throw new Error('The campaign fixture has no Iria host.')
      await (await dockAction(page, 'Add orbit')).click()
      const placement = page.getByRole('group', { name: 'Orbit creation controls' })
        .getByRole('button', { name: 'Placement', exact: true })
      if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
      await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
        identity: { attribute: 'data-object-id', id: iria.id },
      })
      await page.getByRole('form', { name: 'Placement', exact: true })
        .getByRole('button', { name: 'Add', exact: true }).click()
      await quitSystemAdd(page)
      await openWorkspaceHierarchy(page)
      await expect(hierarchy.getByRole('treeitem', { name: /Orbit 2 around Iria, 0 objects/ }))
        .toBeVisible()
      await waitForWorkspaceSaved(page)
    })
    await use(page)
  }, { timeout: 45_000 }],
})









async function ellipticalOrbitAngle(
  map: import('@playwright/test').Locator,
  orbitId: string,
  objectId: string,
): Promise<number> {
  return map.evaluate((element, target) => {
    const ellipse = [...element.querySelectorAll<SVGEllipseElement>('.continuous-warden-orbit-target')]
      .find(candidate => candidate.getAttribute('data-orbit-id') === target.orbitId)
    const object = [...element.querySelectorAll<SVGGElement>('.continuous-warden-object')]
      .find(candidate => candidate.getAttribute('data-object-id') === target.objectId)
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
  }, { orbitId, objectId })
}

async function inspectSystem(page: Page, name: string): Promise<string> {
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: `${name}`, exact: true }).click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const exported = await downloadJson(page, 'Export star system JSON')
  if (!exported.system) throw new Error('The inspected system did not export its applied data.')
  return exported.system.id
}

async function dragCenterTo(page: Page, systemId: string, handle: Locator, target: WorldPoint): Promise<WorldPoint> {
  const exposedStart = () => handle.evaluate((element) => {
    if (!(element instanceof SVGCircleElement)) throw new Error('The detached center has no circle handle.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The detached center handle is not attached.')
    for (const fraction of [0, .5, .85]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8
        const point = new DOMPoint(
          element.cx.baseVal.value + Math.cos(angle) * element.r.baseVal.value * fraction,
          element.cy.baseVal.value + Math.sin(angle) * element.r.baseVal.value * fraction,
        ).matrixTransform(matrix)
        const hit = { x: Math.round(point.x), y: Math.round(point.y) }
        if (document.elementFromPoint(hit.x, hit.y) === element) return hit
      }
    }
    return null
  })
  let start = await exposedStart()
  if (!start) {
    // Detachment keeps this center beside its former host, where the overview name badge can cover it.
    await centerWorkspaceSelection(page)
    start = await exposedStart()
    const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
    for (let step = 0; !start && step < 8; step += 1) {
      await zoomIn.click()
      start = await exposedStart()
    }
  }
  if (!start) throw new Error('The detached center handle has no frontmost native hit after framing its detail.')
  const coordinates = await wardenLocalCoordinates(page, systemId)
  const requested = coordinates.toClient(target)
  const end = { x: Math.round(requested.x), y: Math.round(requested.y) }
  expect(await wardenMap(page).evaluate((map, point) => map.contains(document.elementFromPoint(point.x, point.y)), end))
    .toBe(true)
  const delivered = await measureMouseDrag(page, start, end, { eventFamily: 'pointer' })
  return coordinates.fromClient(delivered.up)
}






test('the Warden can preview and confirm an unoccupied Orbit center move without losing Orbit drafts', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemName, systemId } = await createSingleSystemWorkspace(page)
  const map = wardenMap(page)
  await (await dockAction(page, 'Add orbit')).click()
  const addToggle = page.getByRole('button', { name: 'Add to map', exact: true, includeHidden: true })
  if (await addToggle.getAttribute('aria-expanded') === 'true') await addToggle.click()
  const creationControls = page.getByRole('group', { name: 'Orbit creation controls' })
  const placementToggle = creationControls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  const centerOrHost = page.getByLabel('Orbit center or host', { exact: true })
  await selectInspectorOption(centerOrHost, 'Unoccupied center')
  await expect(page.getByLabel('X', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Y', { exact: true })).toHaveCount(0)
  if (await placementToggle.getAttribute('aria-expanded') === 'true') await placementToggle.click()
  await clickWardenSystemPoint(page, systemId, { x: 0.24, y: 0.31 })
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)
  const created = await downloadJson(page, 'Export star system JSON')
  const orbitId = created.system?.orbits[0]?.id
  if (!orbitId) throw new Error('The created unoccupied Orbit has no applied identity.')
  const hierarchy = await openWorkspaceHierarchy(page)
  const orbitItem = hierarchy.getByRole('treeitem', { name: /Orbit 1 around unoccupied center, 0 objects/ })
  await orbitItem.click()
  const ring = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`)
  const initialGeometry = await wardenOrbitLocalGeometry(ring, systemId)
  const initialCenter = initialGeometry.center
  const initialVerticalRadius = initialGeometry.radii.vertical
  await setWorkspaceMapMode(page, 'Move')
  const centerHandle = map.locator(`.continuous-warden-orbit-center-handle[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`)
  await centerHandle.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(initialCenter.x, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.y)
    .toBeCloseTo(initialCenter.y, 2)
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit center placement controls' })
  const moveButton = controls.getByRole('button', { name: 'Move center on map', exact: true })
  await expect(moveButton).toBeVisible()
  await moveButton.click()
  const originalExport = await downloadJson(page, 'Export star system JSON')
  const originalExportCenter = originalExport.system?.orbits.find(candidate => candidate.hostId === null)?.center
  if (!originalExportCenter) throw new Error('The unoccupied Orbit did not export its applied center.')

  const clickedPoint = await clickWardenSystemPoint(page, systemId, { x: 0.69, y: 0.61 })
  await expect(map).toBeFocused()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(64 + clickedPoint.x * 832, 1)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.y)
    .toBeCloseTo(72 + clickedPoint.y * 416, 1)
  const previewExport = await downloadJson(page, 'Export star system JSON')
  expect(previewExport.system?.orbits.find(candidate => candidate.hostId === null)?.center)
    .toEqual(originalExportCenter)

  await map.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(65 + clickedPoint.x * 832, 1)
  await controls.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  await expect(map).toBeFocused()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(initialCenter.x, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.y)
    .toBeCloseTo(initialCenter.y, 2)
  const canceledExport = await downloadJson(page, 'Export star system JSON')
  expect(canceledExport.system?.orbits.find(candidate => candidate.hostId === null)?.center)
    .toEqual(originalExportCenter)

  await moveButton.click()
  const confirmedTarget = await clickWardenSystemPoint(page, systemId, { x: 0.72, y: 0.58 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await expect(map).toBeFocused()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(64 + confirmedTarget.x * 832, 1)
  const confirmedExport = await downloadJson(page, 'Export star system JSON')
  const confirmedCenter = confirmedExport.system?.orbits.find(candidate => candidate.hostId === null)?.center
  expect(confirmedCenter?.x).toBeCloseTo(confirmedTarget.x, 5)
  expect(confirmedCenter?.y).toBeCloseTo(confirmedTarget.y, 5)

  await page.getByLabel('Horizontal radius', { exact: true }).fill('240')
  await moveButton.click()
  const applyDraftTarget = await clickWardenSystemPoint(page, systemId, { x: 0.64, y: 0.73 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await expect(page.getByLabel('Horizontal radius', { exact: true })).toHaveValue('240')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(240, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(64 + applyDraftTarget.x * 832, 1)

  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await page.getByLabel('Vertical radius', { exact: true }).fill('250')
  await moveButton.click()
  const discardDraftTarget = await clickWardenSystemPoint(page, systemId, { x: 0.34, y: 0.68 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.horizontal)
    .toBeCloseTo(240, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).radii.vertical)
    .toBeCloseTo(initialVerticalRadius, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(ring, systemId)).center.x)
    .toBeCloseTo(64 + discardDraftTarget.x * 832, 1)

  await waitForWorkspaceSaved(page)
  await page.reload()
  await inspectSystem(page, systemName)
  const restoredRing = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(restoredRing, systemId)).center.x)
    .toBeCloseTo(64 + discardDraftTarget.x * 832, 1)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(restoredRing, systemId)).radii.horizontal)
    .toBeCloseTo(240, 2)
})

detachedOrbitJourneyTest('the Warden can detach a hosted Orbit and move its unoccupied center', async ({ detachedOrbitPage: page }) => {
  test.setTimeout(30_000)
  const hierarchy = await openWorkspaceHierarchy(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const system = initial.system
  const iria = system?.objects.find(object => object.name === 'Iria')
  const nix = system?.objects.find(object => object.name === 'Nix')
  const orbitId = system?.orbits.find(orbit => orbit.hostId === iria?.id && orbit.order === 1)?.id
  if (!system || !iria || !nix || !orbitId) throw new Error('The campaign is missing its hosted Orbit branch.')
  const systemId = system.id
  const map = wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
  const hostedRing = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)
  const originalOrbitGeometry = await wardenOrbitLocalGeometry(hostedRing, systemId)
  const originalCenter = originalOrbitGeometry.center
  const originalRadii = originalOrbitGeometry.radii
  const angleBeforeDetach = await ellipticalOrbitAngle(map, orbitId, nix.id)
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 1 object/ }).click()
  await page.getByRole('button', { name: 'Detach Orbit', exact: true }).click()

  const detachedRing = map.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)
  await expect(hierarchy.getByRole('treeitem', { name: /Orbit 1 around unoccupied center, 1 object/ }))
    .toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Detach Orbit', exact: true })).toHaveCount(0)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(detachedRing, systemId)).radii.horizontal)
    .toBeCloseTo(originalRadii.horizontal, 2)
  await expect.poll(async () => (await wardenOrbitLocalGeometry(detachedRing, systemId)).radii.vertical)
    .toBeCloseTo(originalRadii.vertical, 2)

  const detachedCenter = (await wardenOrbitLocalGeometry(detachedRing, systemId)).center
  expect(Math.hypot(
    detachedCenter.x - originalCenter.x,
    detachedCenter.y - originalCenter.y,
  )).toBeGreaterThanOrEqual(40)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitId, nix.id))
    .toBeCloseTo(angleBeforeDetach, 2)

  await setWorkspaceMapMode(page, 'Move')
  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  await hideWorkspaceInspector(page)
  const centerHandle = map.locator(`.continuous-warden-orbit-center-handle[data-orbit-id="${orbitId}"]`)
  await expect(centerHandle).toBeVisible()
  const nixMark = wardenObjectMark(page, systemId, nix.id)
  const objectBeforeMove = await nixMark.getAttribute('transform')
  // Make the first native movement clear drag intent instead of lingering inside the Inspector hold area.
  const movedCenter = { x: detachedCenter.x + 256, y: detachedCenter.y + 128 }
  const deliveredCenter = await dragCenterTo(page, systemId, centerHandle, movedCenter)
  await expect.poll(async () =>
    Math.abs((await wardenOrbitLocalGeometry(detachedRing, systemId)).center.x - deliveredCenter.x),
  ).toBeLessThan(0.01)
  await expect.poll(async () =>
    Math.abs((await wardenOrbitLocalGeometry(detachedRing, systemId)).center.y - deliveredCenter.y),
  ).toBeLessThan(0.01)
  await expect.poll(async () => nixMark.getAttribute('transform'))
    .not.toBe(objectBeforeMove)
  await expect.poll(() => ellipticalOrbitAngle(map, orbitId, nix.id))
    .toBeCloseTo(angleBeforeDetach, 2)
  await waitForWorkspaceSaved(page)

  const exported = await downloadJson(page, 'Export star system JSON')
  const exportedSystem = exported.system
  if (!exportedSystem) throw new Error('The exported file does not contain a star system.')
  const exportedDetachedOrbit = exportedSystem.orbits.find(orbit => orbit.hostId === null)
  const persistedCenter = (await wardenOrbitLocalGeometry(detachedRing, systemId)).center
  expect(exportedDetachedOrbit?.order).toBe(1)
  expect(exportedDetachedOrbit?.center?.x).toBeCloseTo((persistedCenter.x - 64) / 832, 5)
  expect(exportedDetachedOrbit?.center?.y).toBeCloseTo((persistedCenter.y - 72) / 416, 5)
  expect(exportedSystem.orbits.filter(orbit => orbit.hostId === iria.id).map(orbit => orbit.order))
    .toEqual([1])

  await page.reload()
  await inspectSystem(page, 'Vesper Prime')
  const restoredHierarchy = await openWorkspaceHierarchy(page)
  const restoredMap = wardenMap(page).locator(`.continuous-warden-system[data-system-id="${systemId}"]`)
  const restoredRing = restoredMap.locator(`.continuous-warden-orbit-target[data-orbit-id="${orbitId}"]`)
  await expect.poll(async () =>
    Math.abs((await wardenOrbitLocalGeometry(restoredRing, systemId)).center.x - persistedCenter.x),
  ).toBeLessThan(0.01)
  await expect.poll(async () =>
    Math.abs((await wardenOrbitLocalGeometry(restoredRing, systemId)).center.y - persistedCenter.y),
  ).toBeLessThan(0.01)
  await expect(restoredHierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, orbitId, nix.id))
    .toBeCloseTo(angleBeforeDetach, 2)
})







test('keyboard object selection keeps focus on its logical system mark after redraw', async ({ page }) => {
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page)
  const primaryStar = wardenObjectMark(page, systemId, primaryObjectId)

  await primaryStar.focus()
  await page.keyboard.press('Enter')

  await expect(wardenObjectMark(page, systemId, primaryObjectId)).toBeFocused()
})
