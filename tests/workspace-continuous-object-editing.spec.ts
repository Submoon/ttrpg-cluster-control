import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  dockAction,
  downloadJson,
  quitSystemAdd,
  selectCatalogueObjectButton,
  selectInspectorOption,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  workspaceZoomControls,
} from './helpers'

type ScreenPoint = { x: number; y: number }

async function screenOrigin(locator: import('@playwright/test').Locator): Promise<ScreenPoint> {
  return locator.evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement)) throw new Error('The target is not SVG geometry.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The target is not attached to an SVG scene.')
    const point = new DOMPoint(0, 0).matrixTransform(transform)
    return { x: point.x, y: point.y }
  })
}

async function screenOrbitPoint(orbit: import('@playwright/test').Locator): Promise<ScreenPoint> {
  return orbit.evaluate((element) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit target is not an SVG ellipse.')
    const transform = element.getScreenCTM()
    if (!transform) throw new Error('The Orbit is not attached to an SVG scene.')
    const local = new DOMPoint(
      element.cx.baseVal.value + element.rx.baseVal.value,
      element.cy.baseVal.value,
    )
    const point = local.matrixTransform(transform)
    return { x: point.x, y: point.y }
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
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  const { systemId, systemName, primaryObjectId } = await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  const existingOrbits = new Set(await systemMap.locator('.orbit-mark[data-orbit-id]').evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-orbit-id')).filter((value): value is string => value !== null),
  ))
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
  const orbitMarks = systemMap.locator('.orbit-mark[data-orbit-id]')
  await expect(orbitMarks).toHaveCount(existingOrbits.size + 1)
  const orbitId = await orbitMarks.evaluateAll((elements, oldIds) =>
    elements.map(element => element.getAttribute('data-orbit-id'))
      .find((value): value is string => value !== null && !oldIds.includes(value)),
    [...existingOrbits],
  )
  if (!orbitId) throw new Error('The added Orbit is missing its domain identity.')
  await quitSystemAdd(page)
  await waitForWorkspaceSaved(page)

  await page.goto('/?map=continuous')
  await waitForWorkspaceStartup(page)
  const map = page.getByRole('group', { name: /continuous map$/ }).first()
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${systemId}"][data-orbit-id="${orbitId}"]`)
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
  const occupiedMarkPoint = await screenOrigin(addedMark)
  expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)
    ?.closest('.continuous-warden-object')?.getAttribute('data-object-id'), occupiedMarkPoint)).toBe(freeObject.id)
  await page.mouse.click(occupiedMarkPoint.x, occupiedMarkPoint.y)
  const mapContext = page.getByRole('navigation', { name: 'Map context and commands', exact: true })
  await expect(mapContext.locator('.workspace-add-status')).toContainText(`${systemName} owns this placement`)
  const pinnedFreePoint = await freePointInUniqueEnvelope(map)
  await page.mouse.click(pinnedFreePoint.x, pinnedFreePoint.y)
  await expect(page.getByRole('dialog', { name: 'Choose the owning system', exact: true })).toBeHidden()
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
  await page.setViewportSize({ width: 1440, height: 960 })
  const { systemName } = await createSingleSystemWorkspace(page)
  await page.goto('/?map=continuous')
  await waitForWorkspaceStartup(page)

  await (await dockAction(page, 'Add Jump Route')).click()
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  const origin = inspector.getByLabel('From system', { exact: true })
  await selectInspectorOption(origin, systemName)
  await expect(origin).toContainText(systemName)
  await (await dockAction(page, 'Add star system')).click()

  await (await selectCatalogueObjectButton(page, 'other')).click()
  const stay = page.getByRole('button', { name: 'Stay here', exact: true })
  await expect(stay).toBeVisible()
  await stay.click()

  await expect(page.getByRole('dialog', { name: 'Name this object type', exact: true })).toBeHidden()
  await expect(origin).toContainText(systemName)
})
