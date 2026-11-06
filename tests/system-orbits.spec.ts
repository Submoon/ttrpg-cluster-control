import { expect, test, preparedCampaignTest as campaignTest, type Page } from './fixtures'
import { createSingleSystemWorkspace } from './helpers'
import { captureMapExportBlobs, quitSystemAdd, waitForWorkspaceSaved } from './helpers'
import { clickDockAction, dockAction, selectInspectorOption, clickNormalizedSystemPoint } from './helpers'
import { returnToClusterMap, openWorkspaceHierarchy, setWorkspaceMapMode, ensureMapDragPointsReachable } from './helpers'
import { dragToWorldPoint, downloadJson } from './helpers'



const detachedOrbitJourneyTest = campaignTest.extend<{ detachedOrbitPage: Page }>({
  detachedOrbitPage: [async ({ campaignWorkspacePage: page }, use) => {
    await captureMapExportBlobs(page)
    await test.step('Open Vesper Prime and prepare the empty sibling Orbit', async () => {
      const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
      await clusterHierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
        .getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
      const hierarchy = await openWorkspaceHierarchy(page)
      await hierarchy.getByRole('treeitem', { name: /Select PL-01, Iria/ }).click()
      await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
      await expect(hierarchy.getByRole('treeitem', { name: /Orbit 2 around Iria, 0 objects/ }))
        .toBeVisible()
    })
    await use(page)
  }, { timeout: 45_000 }],
})









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






test('the Warden can preview and confirm an unoccupied Orbit center move without losing Orbit drafts', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { systemName } = await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: `${systemName} star system map` })
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
  await clickNormalizedSystemPoint(page, map, { x: 0.24, y: 0.31 })
  await quitSystemAdd(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  const orbitItem = hierarchy.getByRole('treeitem', { name: /Orbit 1 around unoccupied center, 0 objects/ })
  await orbitItem.click()
  const orbit = map.getByRole('group', { name: 'Orbit 1 around unoccupied center' })
  const ring = orbit.locator('.orbit-ring')
  const initialCenter = {
    x: Number(await ring.getAttribute('cx')),
    y: Number(await ring.getAttribute('cy')),
  }
  await setWorkspaceMapMode(page, 'Move')
  const centerHandle = orbit.locator('.orbit-center-handle')
  await centerHandle.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(initialCenter.x, 2)
  await expect.poll(async () => Number(await ring.getAttribute('cy')))
    .toBeCloseTo(initialCenter.y, 2)
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Orbit center placement controls' })
  const moveButton = controls.getByRole('button', { name: 'Move center on map', exact: true })
  await expect(moveButton).toBeVisible()
  await moveButton.click()
  const originalExport = await downloadJson(page, 'Export star system JSON')
  const originalExportCenter = originalExport.system?.orbits.find(candidate => candidate.hostId === null)?.center
  if (!originalExportCenter) throw new Error('The unoccupied Orbit did not export its applied center.')

  const clickedPoint = await clickNormalizedSystemPoint(page, map, { x: 0.69, y: 0.61 })
  await expect(map).toBeFocused()
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(64 + clickedPoint.x * 832, 1)
  await expect.poll(async () => Number(await ring.getAttribute('cy')))
    .toBeCloseTo(72 + clickedPoint.y * 416, 1)
  const previewExport = await downloadJson(page, 'Export star system JSON')
  expect(previewExport.system?.orbits.find(candidate => candidate.hostId === null)?.center)
    .toEqual(originalExportCenter)

  await map.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(65 + clickedPoint.x * 832, 1)
  await controls.getByRole('button', { name: 'Cancel preview', exact: true }).click()
  await expect(map).toBeFocused()
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(initialCenter.x, 2)
  await expect.poll(async () => Number(await ring.getAttribute('cy')))
    .toBeCloseTo(initialCenter.y, 2)
  const canceledExport = await downloadJson(page, 'Export star system JSON')
  expect(canceledExport.system?.orbits.find(candidate => candidate.hostId === null)?.center)
    .toEqual(originalExportCenter)

  await moveButton.click()
  const confirmedTarget = await clickNormalizedSystemPoint(page, map, { x: 0.72, y: 0.58 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await expect(map).toBeFocused()
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(64 + confirmedTarget.x * 832, 1)
  const confirmedExport = await downloadJson(page, 'Export star system JSON')
  const confirmedCenter = confirmedExport.system?.orbits.find(candidate => candidate.hostId === null)?.center
  expect(confirmedCenter?.x).toBeCloseTo(confirmedTarget.x, 5)
  expect(confirmedCenter?.y).toBeCloseTo(confirmedTarget.y, 5)

  await page.getByLabel('Horizontal radius', { exact: true }).fill('240')
  await moveButton.click()
  const applyDraftTarget = await clickNormalizedSystemPoint(page, map, { x: 0.64, y: 0.73 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await expect(page.getByLabel('Horizontal radius', { exact: true })).toHaveValue('240')
  await page.getByRole('button', { name: 'Save Orbit' }).click()
  await expect(ring).toHaveAttribute('rx', '240')
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(64 + applyDraftTarget.x * 832, 1)

  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await page.getByLabel('Vertical radius', { exact: true }).fill('250')
  await moveButton.click()
  const discardDraftTarget = await clickNormalizedSystemPoint(page, map, { x: 0.34, y: 0.68 })
  await controls.getByRole('button', { name: 'Confirm center position', exact: true }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(ring).toHaveAttribute('rx', '240')
  await expect(ring).not.toHaveAttribute('ry', '250')
  await expect.poll(async () => Number(await ring.getAttribute('cx')))
    .toBeCloseTo(64 + discardDraftTarget.x * 832, 1)

  await page.reload()
  await openWorkspaceHierarchy(page)
  const restoredMap = page.getByRole('group', { name: `${systemName} star system map` })
  const restoredRing = restoredMap.getByRole('group', { name: 'Orbit 1 around unoccupied center' }).locator('.orbit-ring')
  await expect.poll(async () => Number(await restoredRing.getAttribute('cx')))
    .toBeCloseTo(64 + discardDraftTarget.x * 832, 1)
  await expect(restoredRing).toHaveAttribute('rx', '240')
})

detachedOrbitJourneyTest('the Warden can detach a hosted Orbit and move its unoccupied center', async ({ detachedOrbitPage: page }) => {
  test.setTimeout(30_000)
  const hierarchy = await openWorkspaceHierarchy(page)
  const map = page.getByRole('group', { name: 'Vesper Prime star system map' })

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
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 1 object/ }).click()
  await page.getByRole('button', { name: 'Detach Orbit', exact: true }).click()

  const detachedOrbitLabel = 'Orbit 1 around unoccupied center'
  const detachedOrbit = map.getByRole('group', { name: detachedOrbitLabel })
  const detachedRing = detachedOrbit.locator('.orbit-ring')
  await expect(hierarchy.getByRole('treeitem', { name: /Orbit 1 around unoccupied center, 1 object/ }))
    .toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Detach Orbit', exact: true })).toHaveCount(0)
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
  await waitForWorkspaceSaved(page)

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
  await returnToClusterMap(page)
  const restoredClusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await restoredClusterHierarchy.getByRole('navigation', { name: 'Star systems', exact: true })
    .getByRole('button', { name: 'Open Vesper Prime system map', exact: true }).click()
  const restoredHierarchy = await openWorkspaceHierarchy(page)
  const restoredMap = page.getByRole('group', { name: 'Vesper Prime star system map' })
  const restoredRing = restoredMap.getByRole('group', { name: detachedOrbitLabel }).locator('.orbit-ring')
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cx')) - persistedCenter.x),
  ).toBeLessThan(0.01)
  await expect.poll(async () =>
    Math.abs(Number(await restoredRing.getAttribute('cy')) - persistedCenter.y),
  ).toBeLessThan(0.01)
  await expect(restoredHierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria, 0 objects/ }))
    .toBeVisible()
  await expect.poll(() => ellipticalOrbitAngle(restoredMap, detachedOrbitLabel, 'Nix'))
    .toBeCloseTo(angleBeforeDetach, 2)
})







test('keyboard object selection keeps focus on its logical system mark after redraw', async ({ page }) => {
  const { systemName } = await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: `${systemName} star system map` })
  const primaryStar = map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })

  await primaryStar.focus()
  await page.keyboard.press('Enter')

  await expect(map.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })).toBeFocused()
})
