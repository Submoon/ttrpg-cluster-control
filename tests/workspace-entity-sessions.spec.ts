import { expect, test, type Page } from '@playwright/test'
import entitySessionFixture from './fixtures/workspace-entity-sessions.json' with { type: 'json' }
import { importReviewDialog, resolveImportReview } from './helpers'
import {
  activeWorkspaceFeedback,
  beginDragToWorldPoint,
  captureMapExportBlobs,
  downloadJson,
  dragHtmlElementToWorldPoint,
  dragToWorldPoint,
  editFieldDefinition,
  ensureMapDragPointsReachable,
  jsonMapImportInput,
  openFieldDefinitionDialog,
  openWorkspaceHierarchy,
  readInspectorSelection,
  quitSystemAdd,
  returnToClusterMap,
  selectInspectorOption,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
} from './helpers'

async function openSessionLab(page: Page): Promise<{
  hierarchy: Awaited<ReturnType<typeof openWorkspaceHierarchy>>
  map: import('@playwright/test').Locator
  inspector: import('@playwright/test').Locator
}> {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')
  await returnToClusterMap(page)

  await setJsonFile(jsonMapImportInput(page), 'entity-session-lab.json', JSON.stringify(entitySessionFixture))
  const importPreview = importReviewDialog(page)
  const importSummary = await importPreview.innerText()
  expect(importSummary).toContain('Star systems: 1')
  await resolveImportReview(importPreview, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const system = clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true })
  await expect(system).toBeVisible()
  await system.click()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  return {
    hierarchy,
    map: page.getByRole('group', { name: 'Session Lab star system map', exact: true }),
    inspector: page.getByRole('complementary', { name: 'Object inspector', exact: true }),
  }
}

async function abortNextWorkspaceWrite(page: Page, operation: () => Promise<void>): Promise<void> {
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    if (!original) throw new Error('IndexedDB put is unavailable.')
    const state = { original, aborted: 0 }
    ;(window as Window & { __entitySessionAbort?: typeof state }).__entitySessionAbort = state
    Object.defineProperty(IDBObjectStore.prototype, 'put', {
      ...original,
      value: function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
        const request = original.value!.apply(this, args)
        if (!state.aborted && this.transaction.db.name === 'ttrpg-cluster-control'
          && this.name === 'workspace' && this.transaction.mode === 'readwrite' && args[1] === 'current') {
          state.aborted += 1
          this.transaction.abort()
        }
        return request
      },
    })
  })

  try {
    await operation()
    const aborted = await page.evaluate(() =>
      (window as Window & { __entitySessionAbort?: { aborted: number } }).__entitySessionAbort?.aborted ?? 0,
    )
    expect(aborted).toBe(1)
  } finally {
    await page.evaluate(() => {
      const state = (window as Window & { __entitySessionAbort?: { original: PropertyDescriptor } }).__entitySessionAbort
      if (!state) return
      Object.defineProperty(IDBObjectStore.prototype, 'put', state.original)
      delete (window as Window & { __entitySessionAbort?: unknown }).__entitySessionAbort
    })
  }
}

test('object Apply preserves typed zero, false and hidden assignments while an unrelated definition changes', async ({ page }) => {
  const { hierarchy, inspector } = await openSessionLab(page)
  await hierarchy.getByRole('button', { name: 'Select PL-01, Iria', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()

  await expect(inspector.getByLabel('Threat level', { exact: true })).toHaveValue('3')
  await expect(inspector.getByLabel('Installation record', { exact: true })).toHaveCount(0)
  expect(await readInspectorSelection(inspector.getByLabel('Hostile', { exact: true }))).toBe('Yes')
  await inspector.getByLabel('Name', { exact: true }).fill('Iria, revised')
  await inspector.getByLabel('Description', { exact: true }).fill('A distinct world description.')
  await inspector.getByLabel('Threat level', { exact: true }).fill('0')
  await selectInspectorOption(inspector.getByLabel('Hostile', { exact: true }), 'No')
  await inspector.getByLabel('Session note', { exact: true }).fill('A separate campaign note.')

  const definitions = await openFieldDefinitionDialog(page)
  await definitions.getByRole('button', { name: /Unused installation notes/ }).click()
  await editFieldDefinition(definitions)
  await definitions.getByLabel('Custom field name', { exact: true }).fill('Archived installation notes')
  await definitions.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  await expect(definitions.getByRole('button', { name: /Archived installation notes/ })).toBeVisible()
  await definitions.getByRole('button', { name: 'Close field definitions', exact: true }).click()

  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Iria, revised')
  await expect(inspector.getByRole('button', { name: /Apply changes/ })).toBeVisible()
  await inspector.getByRole('button', { name: /Apply changes/ }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')

  const exported = await downloadJson(page, 'Export star system JSON')
  const planet = exported.system!.objects.find(object => object.name === 'Iria, revised')!
  const threat = exported.objectFieldSettings.customFields.find(field => field.name === 'Threat level')!
  const hostile = exported.objectFieldSettings.customFields.find(field => field.name === 'Hostile')!
  const note = exported.objectFieldSettings.customFields.find(field => field.name === 'Session note')!
  const hidden = exported.objectFieldSettings.customFields.find(field => field.name === 'Installation record')!
  expect(exported.objectFieldSettings.customFields.map(field => field.name)).toContain('Archived installation notes')
  expect(planet.description).toBe('A distinct world description.')
  expect(planet.customFieldValues).toMatchObject({
    [threat.id]: 0,
    [hostile.id]: false,
    [note.id]: 'A separate campaign note.',
    [hidden.id]: 'Keep this out-of-scope assignment.',
  })

  await page.reload()
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true }).click()
  const reloadedHierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await reloadedHierarchy.getByRole('button', { name: 'Select PL-01, Iria, revised', exact: true }).click()
  await expect(inspector.getByLabel('Threat level', { exact: true })).toHaveValue('0')
  expect(await readInspectorSelection(inspector.getByLabel('Hostile', { exact: true }))).toBe('No')
  await expect(inspector.getByLabel('Description', { exact: true })).toHaveValue('A distinct world description.')
  await expect(inspector.getByLabel('Session note', { exact: true })).toHaveValue('A separate campaign note.')
  await expect(inspector.getByLabel('Installation record', { exact: true })).toHaveCount(0)
})

test('object transitions keep Stay, Apply and Discard distinct, while a clean edit leaves directly', async ({ page }) => {
  const { hierarchy, inspector } = await openSessionLab(page)
  let iria = hierarchy.getByRole('button', { name: 'Select PL-01, Iria', exact: true })
  const nix = hierarchy.getByRole('button', { name: 'Select MO-01, Nix', exact: true })
  await iria.click()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Applied Iria')

  await nix.click()
  let guard = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(iria).toHaveAttribute('aria-current', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Applied Iria')

  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit chart names' })
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-current', 'true')
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')

  iria = hierarchy.getByRole('button', { name: 'Select PL-01, Applied Iria', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await iria.click()
  await expect(page.getByRole('dialog', { name: 'Edit chart names' })).toHaveCount(0)
  await expect(iria).toHaveAttribute('aria-current', 'true')
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Discarded Iria draft')
  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit chart names' })
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-current', 'true')

  const exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system!.objects.map(object => object.name)).toContain('Applied Iria')
  expect(exported.system!.objects.map(object => object.name)).toContain('Nix')
  expect(exported.system!.objects.map(object => object.name)).not.toContain('Discarded Iria draft')
})

test('Orbit sessions allow occupant-angle and unrelated-host changes, block related creation, and preserve both radii when reordered', async ({ page }) => {
  const { hierarchy, map } = await openSessionLab(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const primary = initial.system!.objects.find(object => object.name === 'Primary Star')!
  const nix = initial.system!.objects.find(object => object.name === 'Nix')!
  const firstOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 1)!
  const secondOrbit = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)!

  await hierarchy.getByRole('button', { name: 'Orbit 2 around Primary Star, 1 object', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Horizontal radius', exact: true })).toHaveValue('170')
  await expect(page.getByRole('spinbutton', { name: 'Vertical radius', exact: true })).toHaveValue('170')
  await page.getByRole('spinbutton', { name: 'Orbit order', exact: true }).fill('1')

  const addOrbit = page.getByRole('button', { name: 'Add orbit', exact: true })
  await ensureMapDragPointsReachable(page, map, addOrbit, { x: 480, y: 280 })
  await dragHtmlElementToWorldPoint(page, addOrbit, map, { x: 480, y: 280 })
  const orbitCreation = page.getByRole('group', { name: 'Orbit creation controls', exact: true })
  await expect(orbitCreation.getByRole('alert'))
    .toContainText('Resolve the Inspector draft before adding another Orbit to this host.')
  await expect(orbitCreation.getByRole('button', { name: 'Confirm placement', exact: true })).toHaveCount(0)
  let exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system!.orbits).toHaveLength(3)
  expect(exported.system!.orbits).toEqual(initial.system!.orbits)
  await quitSystemAdd(page)

  // Nix sits at angle 0 on this Orbit, directly over the horizontal axis handle.
  // Use the unobstructed vertical handle so the real handle receives pointerdown.
  const axisHandle = map.locator(`.orbit-axis-handle--vertical[data-orbit-id="${secondOrbit.id}"]`)
  const radiusBeforeDrag = await axisHandle.getAttribute('aria-valuenow')
  const geometryBeforeDrag = await downloadJson(page, 'Export star system JSON')
  await setWorkspaceMapMode(page, 'Move')
  await ensureMapDragPointsReachable(page, map, axisHandle, { x: 500, y: 250 })
  await beginDragToWorldPoint(page, map, axisHandle, { x: 500, y: 250 })
  await expect(axisHandle).toHaveAttribute('aria-valuenow', radiusBeforeDrag!)
  await page.mouse.up()
  const geometryAfterDrag = await downloadJson(page, 'Export star system JSON')
  expect(geometryAfterDrag.system!.orbits).toEqual(geometryBeforeDrag.system!.orbits)
  expect(geometryAfterDrag.layout.orbitRadii).toEqual(geometryBeforeDrag.layout.orbitRadii)
  expect(geometryAfterDrag.layout.orbitRotations).toEqual(geometryBeforeDrag.layout.orbitRotations)

  const nixNode = map.locator(`.system-object[data-object-id="${nix.id}"]`)
  await ensureMapDragPointsReachable(page, map, nixNode, { x: 480, y: 450 })
  await dragToWorldPoint(page, map, nixNode, { x: 480, y: 450 })
  exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.layout.objectAngles[nix.id]).toBeCloseTo(Math.PI / 2, 1)

  await ensureMapDragPointsReachable(page, map, addOrbit, { x: 771, y: 280 })
  await dragHtmlElementToWorldPoint(page, addOrbit, map, { x: 771, y: 280 })
  await expect(hierarchy.getByRole('button', { name: 'Orbit 2 around Distant Star, 0 objects', exact: true })).toBeVisible()
  await quitSystemAdd(page)
  await expect(page.getByRole('spinbutton', { name: 'Orbit order', exact: true })).toHaveValue('1')
  await expect(page.getByRole('button', { name: /Apply changes/ })).toBeVisible()

  const primaryNode = map.locator(`.system-object[data-object-id="${primary.id}"]`)
  const hostTransformBefore = await primaryNode.getAttribute('transform')
  const beforeHostAttempt = await downloadJson(page, 'Export star system JSON')
  await ensureMapDragPointsReachable(page, map, primaryNode, { x: 800, y: 420 })
  await beginDragToWorldPoint(page, map, primaryNode, { x: 800, y: 420 })
  await expect(primaryNode).toHaveAttribute('transform', hostTransformBefore!)
  await page.mouse.up()
  const afterHostAttempt = await downloadJson(page, 'Export star system JSON')
  expect(afterHostAttempt.system!.objects.find(object => object.id === primary.id)?.placement)
    .toEqual(beforeHostAttempt.system!.objects.find(object => object.id === primary.id)?.placement)
  expect(afterHostAttempt.system!.orbits).toEqual(beforeHostAttempt.system!.orbits)
  await expect(page.getByRole('complementary', { name: 'Object inspector', exact: true }).getByRole('alert'))
    .toContainText('Resolve the Inspector draft before moving this object or changing a related placement.')

  await page.getByRole('button', { name: /Apply changes/ }).click()
  await expect(page.getByRole('complementary', { name: 'Object inspector', exact: true }).getByRole('alert'))
    .toHaveCount(0)

  exported = await downloadJson(page, 'Export star system JSON')
  const reorderedFirst = exported.system!.orbits.find(orbit => orbit.id === firstOrbit.id)!
  const reorderedSecond = exported.system!.orbits.find(orbit => orbit.id === secondOrbit.id)!
  expect(reorderedFirst.order).toBe(2)
  expect(reorderedSecond.order).toBe(1)
  expect(exported.layout.orbitRadii[firstOrbit.id]).toMatchObject({ horizontal: 112, vertical: 112 })
  expect(exported.layout.orbitRadii[secondOrbit.id]).toMatchObject({ horizontal: 170, vertical: 170 })
  expect(exported.system!.orbits).toHaveLength(4)
  expect(exported.layout.objectAngles[nix.id]).toBeCloseTo(Math.PI / 2, 1)
})

test('a failed Inspector save leaves current memory intact and Retry save persists only the applied record', async ({ page }) => {
  const { hierarchy, inspector } = await openSessionLab(page)
  await hierarchy.getByRole('button', { name: 'Select PL-01, Iria', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Durable Iria')
  await abortNextWorkspaceWrite(page, async () => {
    await inspector.getByRole('button', { name: /Apply changes/ }).click()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')
  })

  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Hidden draft Iria')
  await inspector.getByRole('button', { name: 'Hide inspector', exact: true }).click()
  const currentMemory = await downloadJson(page, 'Export star system JSON')
  expect(currentMemory.system!.objects.find(object => object.locationKey === 'PL-01')?.name).toBe('Durable Iria')

  const recovery = activeWorkspaceFeedback(page)
  await recovery.getByRole('button', { name: 'Recovery details', exact: true }).click()
  const details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  await details.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')

  await page.reload()
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true }).click()
  const reloadedHierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  await reloadedHierarchy.getByRole('button', { name: 'Select PL-01, Durable Iria', exact: true }).click()
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Durable Iria')
})

test('a failed Orbit Apply and continue keeps the transition and Retry persists its applied rotation', async ({ page }) => {
  const { hierarchy } = await openSessionLab(page)
  const initial = await downloadJson(page, 'Export star system JSON')
  const primary = initial.system!.objects.find(object => object.name === 'Primary Star')!
  const target = initial.system!.orbits.find(orbit => orbit.hostId === primary.id && orbit.order === 2)!
  const sibling = hierarchy.getByRole('button', { name: 'Orbit 1 around Primary Star, 1 object', exact: true })

  await hierarchy.getByRole('button', { name: 'Orbit 2 around Primary Star, 1 object', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Orbit', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Rotation', exact: true }).fill('45')
  await sibling.click()
  const guard = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(guard.getByRole('button', { name: 'Apply and continue', exact: true })).toBeVisible()

  await abortNextWorkspaceWrite(page, async () => {
    await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
    await expect(guard).toBeHidden()
    await expect(sibling).toHaveAttribute('aria-current', 'true')
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')
  })

  let currentMemory = await downloadJson(page, 'Export star system JSON')
  expect(currentMemory.layout.orbitRotations?.[target.id]).toBe(45)
  const recovery = activeWorkspaceFeedback(page)
  await recovery.getByRole('button', { name: 'Recovery details', exact: true }).click()
  const details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await details.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')

  await page.reload()
  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true }).click()
  currentMemory = await downloadJson(page, 'Export star system JSON')
  expect(currentMemory.layout.orbitRotations?.[target.id]).toBe(45)
})
