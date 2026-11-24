import { expect, preparedCampaignTest as campaignTest, type Locator, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  dockAction,
  downloadJson,
  hideWorkspaceInspector,
  measureMouseDrag,
  openWorkspaceHierarchy,
  quitSystemAdd,
  selectCatalogueObjectButton,
  selectInspectorOption,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
  waitForWorkspaceStartup,
  wardenMap,
  wardenObjectMark,
  wardenOrbitLocalGeometry,
  type ExportedMap,
} from './helpers'

async function hidePanels(page: Page): Promise<void> {
  await hideWorkspaceInspector(page)
  const hierarchy = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchy.getAttribute('aria-expanded') === 'true') await hierarchy.click()
}

async function rightPanMap(page: Page, map: Locator): Promise<void> {
  const start = await map.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    for (const x of [.25, .5, .75]) {
      for (const y of [.25, .5, .75]) {
        const point = { x: bounds.left + bounds.width * x, y: bounds.top + bounds.height * y }
        const hit = document.elementFromPoint(point.x, point.y)
        if (hit && element.contains(hit)) return point
      }
    }
    return null
  })
  if (!start) throw new Error('The Warden map needs a reachable surface for native right-pan.')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  try {
    await page.mouse.move(start.x + 36, start.y + 24, { steps: 6 })
  } finally {
    await page.mouse.up({ button: 'right' })
  }
}

async function orbitalAngle(host: Locator, planet: Locator): Promise<number> {
  const center = (object: Locator) => object.evaluate(element => {
    const transform = (element as SVGGraphicsElement).getScreenCTM()
    if (!transform) throw new Error('An orbital object is not attached to the map.')
    const point = new DOMPoint(0, 0).matrixTransform(transform)
    return { x: point.x, y: point.y }
  })
  const [a, b] = await Promise.all([center(host), center(planet)])
  return Math.atan2(b.y - a.y, b.x - a.x)
}

async function resizePaintedOrbit(page: Page, ring: Locator, factor: number): Promise<void> {
  const points = await ring.evaluate((element, factor) => {
    if (!(element instanceof SVGEllipseElement)) throw new Error('The Orbit target is not an ellipse.')
    const matrix = element.getScreenCTM()
    if (!matrix) throw new Error('The Orbit target is not attached to the map.')
    const cx = element.cx.baseVal.value
    const cy = element.cy.baseVal.value
    const rx = element.rx.baseVal.value
    const ry = element.ry.baseVal.value
    const center = new DOMPoint(cx, cy).matrixTransform(matrix)
    const screenRadius = Math.max(Math.hypot(matrix.a * rx, matrix.b * rx), Math.hypot(matrix.c * ry, matrix.d * ry))
    const samples = Math.max(64, Math.ceil(4 * Math.PI * screenRadius))
    const map = element.closest('svg')
    // Dashed paint and edit handles move with the live camera. Sample the exact rounded native hit.
    for (let sample = 0; sample < samples; sample += 1) {
      const offset = Math.ceil(sample / 2) * (sample % 2 ? 1 : -1) * Math.PI * 2 / samples
      const point = new DOMPoint(cx + rx * Math.cos(.5 + offset), cy + ry * Math.sin(.5 + offset)).matrixTransform(matrix)
      for (const dx of [0, -1, 1]) {
        for (const dy of [0, -1, 1]) {
          const start = { x: Math.round(point.x) + dx, y: Math.round(point.y) + dy }
          if (document.elementFromPoint(start.x, start.y) !== element) continue
          const end = { x: Math.round(center.x + (start.x - center.x) * factor), y: Math.round(center.y + (start.y - center.y) * factor) }
          const reachable = Array.from({ length: 7 }, (_, step) => map?.contains(document.elementFromPoint(
            start.x + (end.x - start.x) * step / 6, start.y + (end.y - start.y) * step / 6,
          ))).every(Boolean)
          if (reachable) return { start, end }
        }
      }
    }
    throw new Error('The Orbit has no frontmost painted ring hit with a reachable native resize path.')
  }, factor)
  await measureMouseDrag(page, points.start, points.end, { eventFamily: 'pointer' })
}

function radii(snapshot: ExportedMap, orbitId: string): { horizontal: number; vertical: number } {
  const value = snapshot.layout.orbitEllipseRadii?.[orbitId] ?? snapshot.layout.orbitRadii[orbitId]
  if (value === undefined) throw new Error('The saved Orbit has no radii.')
  return typeof value === 'number' ? { horizontal: value, vertical: value } : value
}

campaignTest.describe('prepared campaign map layout', () => {
  campaignTest('create and populate an Orbit and preserve its occupant when resizing', async ({ campaignWorkspacePage: page }) => {
    await captureMapExportBlobs(page)
    const before = await downloadJson(page, 'Export Jump Cluster JSON')
    const system = before.cluster?.systems.find(candidate => candidate.name === 'Vesper Prime')
    const primary = system?.objects.find(object => object.name === 'Primary Star')
    const planet = system?.objects.find(object => object.name === 'Iria')
    const primaryOrbit = system?.orbits.find(orbit => orbit.hostId === primary?.id)
    if (!system || !primary || !planet || !primaryOrbit) throw new Error('The campaign needs its occupied primary Orbit.')
    const hierarchy = await openWorkspaceHierarchy(page)
    await hierarchy.getByRole('treeitem', { name: `${system.name}`, exact: true }).click()
    await centerWorkspaceSelection(page)
    await hidePanels(page)
    const map = wardenMap(page)
    const host = wardenObjectMark(page, system.id, primary.id)
    const orbiting = wardenObjectMark(page, system.id, planet.id)
    const orbit = map.locator(`.continuous-warden-orbit-target[data-system-id="${system.id}"][data-orbit-id="${primaryOrbit.id}"]`)
    await orbit.press('Enter')
    await hideWorkspaceInspector(page)
    await setWorkspaceMapMode(page, 'Move')
    const angle = await orbitalAngle(host, orbiting)
    const initialRadius = (await wardenOrbitLocalGeometry(orbit, system.id)).radii.horizontal
    expect(initialRadius).toBeCloseTo(112, 2)
    await resizePaintedOrbit(page, orbit, 153 / initialRadius)
    await expect.poll(async () => (await wardenOrbitLocalGeometry(orbit, system.id)).radii.horizontal)
      .toBeGreaterThan(initialRadius)
    const resizedRadii = (await wardenOrbitLocalGeometry(orbit, system.id)).radii
    const resizedRadius = resizedRadii.horizontal
    expect(resizedRadii.vertical).toBeCloseTo(resizedRadius, 2)
    expect(Math.abs(await orbitalAngle(host, orbiting) - angle)).toBeLessThan(.02)
    await (await dockAction(page, 'Add orbit')).click()
    const controls = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
    const placement = controls.getByRole('button', { name: 'Placement', exact: true })
    if (await placement.getAttribute('aria-expanded') !== 'true') await placement.click()
    await selectInspectorOption(page.getByLabel('Orbit center or host', { exact: true }), {
      identity: { attribute: 'data-object-id', id: primary.id },
    })
    await page.getByRole('form', { name: 'Placement', exact: true })
      .getByRole('button', { name: 'Add', exact: true }).click()
    await quitSystemAdd(page)
    const added = await downloadJson(page, 'Export Jump Cluster JSON')
    const addedOrbits = added.cluster?.systems.find(candidate => candidate.id === system.id)?.orbits ?? []
    expect(addedOrbits).toHaveLength(system.orbits.length + 1)
    const newOrbits = addedOrbits.filter(candidate => !system.orbits.some(original => original.id === candidate.id))
    expect(newOrbits).toHaveLength(1)
    const second = newOrbits[0]
    if (!second) throw new Error('The Star needs its newly added second Orbit.')
    expect(second.hostId).toBe(primary.id)
    expect(second.order).toBe(2)
    expect(radii(added, second.id)).not.toEqual(radii(added, primaryOrbit.id))
    const secondRing = map.locator(`.continuous-warden-orbit-target[data-system-id="${system.id}"][data-orbit-id="${second.id}"]`)
    await expect(secondRing).toHaveAccessibleName('Select Orbit 2')
    await (await selectCatalogueObjectButton(page, 'moon')).click()
    await secondRing.press('Enter')
    await quitSystemAdd(page)
    await waitForWorkspaceSaved(page)
    const populated = await downloadJson(page, 'Export Jump Cluster JSON')
    const addedMoon = populated.cluster?.systems.find(candidate => candidate.id === system.id)?.objects
      .find(object => object.subtype === 'moon' && !system.objects.some(original => original.id === object.id))
    expect(addedMoon?.placement).toEqual({ kind: 'orbit', orbitId: second.id })
    await secondRing.press('Enter')
    await hideWorkspaceInspector(page)
    await setWorkspaceMapMode(page, 'Move')
    const horizontal = map.locator(`[data-system-id="${system.id}"][data-orbit-id="${second.id}"]`)
      .and(map.getByRole('slider', { name: 'Resize horizontal radius of Select Orbit 2', exact: true }))
    await expect(horizontal).toBeVisible()
    const secondInitial = Number(await horizontal.getAttribute('aria-valuenow'))
    await horizontal.press('End')
    await expect(horizontal).toHaveAttribute('aria-valuenow', String(secondInitial + 400))
    await horizontal.press('ArrowRight')
    await expect(horizontal).toHaveAttribute('aria-valuenow', String(secondInitial + 401))
    expect(Math.abs(await orbitalAngle(host, orbiting) - angle)).toBeLessThan(.02)
    const beforePan = await map.locator('.cluster-map-content').getAttribute('transform')
    await rightPanMap(page, map)
    await expect(map.locator('.cluster-map-content')).not.toHaveAttribute('transform', beforePan ?? '')
    await waitForWorkspaceSaved(page)
    const saved = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(saved.cluster?.systems.find(candidate => candidate.id === system.id)?.objects
      .find(object => object.id === addedMoon?.id)?.placement).toEqual({ kind: 'orbit', orbitId: second.id })
    expect(radii(saved, primaryOrbit.id).horizontal).toBeCloseTo(resizedRadii.horizontal, 2)
    expect(radii(saved, primaryOrbit.id).vertical).toBeCloseTo(resizedRadii.vertical, 2)
    expect(radii(saved, second.id).horizontal).toBe(secondInitial + 401)
    await page.reload()
    await waitForWorkspaceStartup(page)
    const restored = await openWorkspaceHierarchy(page)
    await restored.getByRole('treeitem', { name: `${system.name}`, exact: true }).click()
    await centerWorkspaceSelection(page)
    await hidePanels(page)
    expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(saved)
    await expect.poll(async () => (await wardenOrbitLocalGeometry(orbit, system.id)).radii.horizontal)
      .toBeCloseTo(resizedRadius, 2)
    await expect.poll(async () => (await wardenOrbitLocalGeometry(secondRing, system.id)).radii.horizontal)
      .toBeCloseTo(secondInitial + 401, 2)
    expect(Math.abs(await orbitalAngle(host, orbiting) - angle)).toBeLessThan(.02)
  })
})
