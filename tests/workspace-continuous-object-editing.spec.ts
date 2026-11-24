import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  exposedContinuousObjectHitPoint,
  quitSystemAdd,
  selectCatalogueObjectButton,
  selectInspectorOption,
  waitForWorkspaceSaved,
  wardenMap,
  workspaceZoomControls,
} from './helpers'

type ScreenPoint = { x: number; y: number }

async function screenOrbitPoint(orbit: import('@playwright/test').Locator): Promise<ScreenPoint> {
  await expect(orbit.and(orbit.page().locator('.continuous-warden-system-detail:not([inert]) .continuous-warden-orbit-target')))
    .toBeVisible()
  return orbit.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit target is not an SVG ellipse.')
    const systemId = element.getAttribute('data-system-id')
    const orbitId = element.getAttribute('data-orbit-id')
    if (!systemId || !orbitId) throw new Error('The Orbit target has no owner-qualified identity.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The Orbit is not attached to an SVG scene.')
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const screenRadius = Math.max(
      Math.hypot(transform.a * rx, transform.b * rx),
      Math.hypot(transform.c * ry, transform.d * ry),
    )
    const sampleCount = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    // Prefer the original rim, but require a painted dash above every other map mark and overlay.
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const angle = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / sampleCount
      const screen = new DOMPoint(
        element.cx.baseVal.value + rx * Math.cos(angle),
        element.cy.baseVal.value + ry * Math.sin(angle),
      ).matrixTransform(transform)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const point = { x: Math.round(screen.x) + dx, y: Math.round(screen.y) + dy }
          const hit = document.elementFromPoint(point.x, point.y)
          if (hit === element || (hit?.matches('.continuous-warden-orbit-visible-arc')
            && hit.getAttribute('data-system-id') === systemId && hit.getAttribute('data-orbit-id') === orbitId)) return point
        }
      }
    }
    throw new Error(`Orbit ${orbitId} in system ${systemId} has no frontmost painted native Add target.`)
  })
}

async function freePointInUniqueEnvelope(map: import('@playwright/test').Locator): Promise<ScreenPoint> {
  return map.evaluate((svg) => {
    const envelope = svg.querySelector<SVGRectElement>('.continuous-warden-system-envelope')
    if (!envelope) throw new Error('The continuous map has no system envelope.')
    const transform = envelope.getScreenCTM()
    if (!transform) throw new Error('The system envelope is not attached to the SVG scene.')
    const x = envelope.x.baseVal.value
    const y = envelope.y.baseVal.value
    const width = envelope.width.baseVal.value
    const height = envelope.height.baseVal.value
    const insets = [
      [12, 12], [width - 12, 12], [12, height - 12], [width - 12, height - 12],
      [width / 2, 12], [width / 2, height - 12], [12, height / 2], [width - 12, height / 2],
    ]
    const systemId = envelope.closest<SVGGElement>('.continuous-warden-system')?.getAttribute('data-system-id')
    for (const [offsetX, offsetY] of insets) {
      const candidate = new DOMPoint(x + offsetX!, y + offsetY!).matrixTransform(transform)
      const target = document.elementFromPoint(candidate.x, candidate.y)
      if (!target || !svg.contains(target)) continue
      if (target.closest('.continuous-warden-object, .continuous-warden-orbit-target, .cluster-system-node')) continue
      const scene = svg.querySelector<SVGGElement>('.cluster-map-content')?.getScreenCTM()?.inverse()
      if (!scene || !systemId) continue
      const local = new DOMPoint(candidate.x, candidate.y).matrixTransform(scene)
      const otherEnvelopeHit = [...svg.querySelectorAll<SVGRectElement>('.continuous-warden-system-envelope')]
        .some((other) => {
          const bounds = other.getBBox()
          const otherId = other.closest<SVGGElement>('.continuous-warden-system')?.getAttribute('data-system-id')
          return otherId !== systemId && local.x >= bounds.x && local.x <= bounds.x + bounds.width
            && local.y >= bounds.y && local.y <= bounds.y + bounds.height
        })
      if (!otherEnvelopeHit) return { x: candidate.x, y: candidate.y }
    }
    throw new Error('Could not find an unoccupied point inside the unique system envelope.')
  })
}

async function screenPointOutsideEveryEnvelope(map: import('@playwright/test').Locator): Promise<ScreenPoint> {
  return map.evaluate((svg) => {
    const content = svg.querySelector<SVGGElement>('.cluster-map-content')
    const sceneTransform = content?.getScreenCTM()?.inverse()
    if (!sceneTransform) throw new Error('The map camera transform is not available.')
    const bounds = svg.getBoundingClientRect()
    const envelopes = [...svg.querySelectorAll<SVGRectElement>('.continuous-warden-system-envelope')]
      .map((envelope) => envelope.getBBox())
    for (let y = bounds.top + 32; y < bounds.bottom - 32; y += 24) {
      for (let x = bounds.left + 32; x < bounds.right - 32; x += 24) {
        const target = document.elementFromPoint(x, y)
        if (!target || !svg.contains(target)) continue
        if (target.closest('.continuous-warden-object, .continuous-warden-orbit-target, .cluster-system-node')) continue
        const scene = new DOMPoint(x, y).matrixTransform(sceneTransform)
        if (envelopes.some(rect => scene.x >= rect.x && scene.x <= rect.x + rect.width
          && scene.y >= rect.y && scene.y <= rect.y + rect.height)) continue
        return { x, y }
      }
    }
    throw new Error('Could not find a visible point outside every system envelope.')
  })
}

test('continuous Add keeps a definite owner, uses local geometry, and asks before outside placement @ui-smoke', async ({ page }) => {
  test.setTimeout(90_000)
  await captureMapExportBlobs(page)
  const { systemId, systemName, primaryObjectId } = await createSingleSystemWorkspace(page)

  const map = wardenMap(page)
  const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"]`)
  await expect(orbit).toHaveCount(0)
  await (await dockAction(page, 'Add orbit')).click()
  const orbitControls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  const placementToggle = orbitControls.getByRole('button', { name: 'Placement', exact: true })
  if (await placementToggle.getAttribute('aria-expanded') !== 'true') await placementToggle.click()
  await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
    identity: { attribute: 'data-object-id', id: primaryObjectId },
  })
  await page.getByLabel('Horizontal radius', { exact: true }).fill('400')
  await page.getByLabel('Vertical radius', { exact: true }).fill('320')
  await page.getByLabel('Rotation', { exact: true }).fill('23')
  await page.getByRole('form', { name: 'Placement', exact: true })
    .getByRole('button', { name: 'Add', exact: true }).click()
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)

  const addedOrbitSnapshot = await downloadJson(page, 'Export Jump Cluster JSON')
  const createdOrbit = addedOrbitSnapshot.cluster?.systems.find(system => system.id === systemId)?.orbits[0]
  if (!createdOrbit) throw new Error('The added Orbit is missing from its owner in the saved layout.')
  const orbitId = createdOrbit.id
  expect(createdOrbit.hostId).toBe(primaryObjectId)
  expect(addedOrbitSnapshot.layout.orbitRadii[orbitId]).toEqual({ horizontal: 400, vertical: 320 })
  expect(addedOrbitSnapshot.layout.orbitRotations?.[orbitId]).toBe(23)
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let attempt = 0; attempt < 18 && !(await orbit.isVisible().catch(() => false)); attempt += 1) {
    await zoomIn.click()
  }
  await expect(orbit).toBeVisible()

  const mapObjects = map.locator(`.continuous-warden-object[data-system-id="${systemId}"]`)
  const beforePointerCount = await mapObjects.count()
  const planetAdd = await selectCatalogueObjectButton(page, 'planet')
  await planetAdd.click()
  const orbitPoint = await screenOrbitPoint(orbit)
  await page.mouse.click(orbitPoint.x, orbitPoint.y)
  await expect(mapObjects).toHaveCount(beforePointerCount + 1)
  await waitForWorkspaceSaved(page)
  const afterOrbitAdd = await downloadJson(page, 'Export Jump Cluster JSON')
  const afterOrbitSystem = afterOrbitAdd.cluster?.systems.find(system => system.id === systemId)
  const orbitObject = afterOrbitSystem?.objects.find(object => object.subtype === 'planet')
  expect(orbitObject?.placement).toMatchObject({ kind: 'orbit', orbitId })
  expect(afterOrbitSystem?.objects).toHaveLength(beforePointerCount + 1)

  const afterPointerCount = beforePointerCount + 1
  await orbit.focus()
  await expect(orbit).toBeFocused()
  await page.keyboard.down('Enter')
  try {
    await expect(mapObjects).toHaveCount(afterPointerCount + 1)
    await waitForWorkspaceSaved(page)
    await expect(orbit).toBeFocused()
    await page.keyboard.down('Enter')
  } finally {
    await page.keyboard.up('Enter')
  }
  await waitForWorkspaceSaved(page)
  const afterHeldKey = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterHeldKey.cluster?.systems.find(system => system.id === systemId)?.objects)
    .toHaveLength(afterPointerCount + 1)

  await (await selectCatalogueObjectButton(page, 'moon')).click()
  const uniqueEnvelopePoint = await freePointInUniqueEnvelope(map)
  await page.mouse.click(uniqueEnvelopePoint.x, uniqueEnvelopePoint.y)
  await expect(page.getByRole('dialog', { name: 'Choose the owning system', exact: true })).toBeHidden()
  await expect(mapObjects).toHaveCount(afterPointerCount + 2)
  await waitForWorkspaceSaved(page)
  const afterFreeAdd = await downloadJson(page, 'Export Jump Cluster JSON')
  const freeObject = afterFreeAdd.cluster?.systems.find(system => system.id === systemId)
    ?.objects.find(object => object.subtype === 'moon' && object.placement.kind === 'system')
  if (!freeObject) throw new Error('The unique envelope did not receive a free Moon.')

  const otherAdd = await selectCatalogueObjectButton(page, 'other')
  await otherAdd.click()
  const typeDialog = page.getByRole('dialog', { name: 'Name this object type', exact: true })
  await typeDialog.getByLabel('Type name', { exact: true }).fill('Habitat')
  await typeDialog.getByRole('button', { name: 'Start Add', exact: true }).click()

  const addedMark = map.locator(`.continuous-warden-object[data-system-id="${systemId}"][data-object-id="${freeObject.id}"]`)
  await expect(addedMark).toBeVisible()
  // The type dialog can still intercept the map during its closing animation.
  await expect.poll(() => exposedContinuousObjectHitPoint(addedMark)).not.toBeNull()
  const occupiedMarkPoint = await exposedContinuousObjectHitPoint(addedMark)
  if (!occupiedMarkPoint) throw new Error('The free Moon needs an exposed native hit while Habitat Add stays armed.')
  expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)
    ?.closest('.continuous-warden-object')?.getAttribute('data-object-id'), occupiedMarkPoint)).toBe(freeObject.id)
  await page.mouse.click(occupiedMarkPoint.x, occupiedMarkPoint.y)
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(mapContext.locator('.workspace-add-status')).toContainText(`${systemName} owns this placement`)
  const pinnedFreePoint = await freePointInUniqueEnvelope(map)
  await page.mouse.click(pinnedFreePoint.x, pinnedFreePoint.y)
  await expect(page.getByRole('dialog', { name: 'Choose the owning system', exact: true })).toBeHidden()
  await expect(mapObjects).toHaveCount(afterPointerCount + 3)
  await waitForWorkspaceSaved(page)
  const afterPinnedAdd = await downloadJson(page, 'Export Jump Cluster JSON')
  const pinnedSystem = afterPinnedAdd.cluster?.systems.find(system => system.id === systemId)
  const habitat = pinnedSystem?.objects.find(object => object.subtype === 'Habitat')
  expect(habitat?.family).toBe('Other')
  expect(habitat?.placement.kind).toBe('system')

  await (await selectCatalogueObjectButton(page, 'moon')).click()
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  const outsidePoint = await screenPointOutsideEveryEnvelope(map)
  await page.mouse.click(outsidePoint.x, outsidePoint.y)
  const ownerDialog = page.getByRole('dialog', { name: 'Choose the owning system', exact: true })
  await expect(ownerDialog).toBeVisible()
  await expect(ownerDialog.getByRole('button', { name: `Add Moon to ${systemName}`, exact: true })).toBeVisible()
  await ownerDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(ownerDialog).toBeHidden()
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(afterPinnedAdd)
})

test('continuous Add protects a modified route draft after a different Cluster Add tool was armed', async ({ page }) => {
  const { systemName } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 960 } })

  await (await dockAction(page, 'Add Jump Route')).click()
  const resumeRoute = page.getByRole('button', { name: 'Resume Jump Route', exact: true })
  await resumeRoute.click()
  const inspector = page.locator('#workspace-inspector-panel')
  const origin = inspector.getByLabel('From system', { exact: true })
  await selectInspectorOption(origin, systemName)
  await expect(origin).toContainText(systemName)
  await (await dockAction(page, 'Add star system')).click()

  await (await selectCatalogueObjectButton(page, 'other')).click()
  const stay = page.getByRole('button', { name: 'Stay here', exact: true })
  await expect(stay).toBeVisible()
  await stay.click()

  await expect(page.getByRole('dialog', { name: 'Name this object type', exact: true })).toBeHidden()
  if (!await origin.isVisible()) await resumeRoute.click()
  await expect(origin).toContainText(systemName)
})
