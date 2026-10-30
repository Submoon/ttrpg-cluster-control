import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { deletionReviewDialog, importReviewDialog, resolveDeletionReview, resolveImportReview } from './helpers'
import { activeWorkspaceFeedback, addClusterSystem, readInspectorSelection, selectInspectorOption } from './helpers'
import { returnToClusterMap, openWorkspaceHierarchy, workspaceZoomControls, clickDockAction, jsonMapImportInput, setWorkspaceMapMode } from './helpers'
import { dragToWorldPoint, ensureMapDragPointsReachable, panMap, dragBy, setHeaderMapActionsOpen, downloadJson, openFieldDefinitionDialog, editFieldDefinition, editMapObject, saveMapObject, addCustomFieldThroughDialog, downloadImage, inspectImageSvg, setJsonFile, addCatalogueObject } from './helpers'
import type { DownloadWindow } from './helpers'
import { createLocalWorkspace, restoreLocalWorkspace } from '../domain/workspace'

function relativeLuminance(color: string): number {
  const channels = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!channels) throw new Error(`Expected an opaque RGB color, received "${color}".`)
  const [, red, green, blue] = channels
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Expected an opaque RGB color, received "${color}".`)
  }
  const linearize = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(Number(red) / 255)
    + 0.7152 * linearize(Number(green) / 255)
    + 0.0722 * linearize(Number(blue) / 255)
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function expectReadableExport(info: {
  backgroundFill: string | null
  textFills: string[]
  markColors: string[]
}): void {
  if (!info.backgroundFill) throw new Error('The downloaded map has no background fill.')
  expect(info.textFills.length).toBeGreaterThan(0)
  expect(info.markColors.length).toBeGreaterThan(0)
  for (const fill of info.textFills) {
    expect(contrastRatio(fill, info.backgroundFill)).toBeGreaterThanOrEqual(4.5)
  }
  for (const color of info.markColors) {
    expect(contrastRatio(color, info.backgroundFill)).toBeGreaterThanOrEqual(3)
  }
}

async function inspectExportedSvg(
  page: import('@playwright/test').Page,
  text: string,
): Promise<{ viewBox: number[]; width: number; height: number; text: string }> {
  return page.evaluate((content) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox')
    if (svg.localName !== 'svg' || !viewBox) throw new Error('The downloaded SVG is invalid.')
    return {
      viewBox: viewBox.split(/\s+/).map(Number),
      width: Number(svg.getAttribute('width')),
      height: Number(svg.getAttribute('height')),
      text: svg.textContent ?? '',
    }
  }, text)
}

async function expectExportedFeaturesInsideViewBox(
  page: import('@playwright/test').Page,
  text: string,
  viewBox: number[],
  mapKind: 'cluster' | 'system',
): Promise<{ x: number; y: number; width: number; height: number }> {
  const bounds = await page.evaluate(({ content, kind }) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement as unknown as SVGSVGElement
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(svg)
    document.body.append(host)
    try {
      const selectors = kind === 'cluster'
        ? ['.cluster-map-items']
        : ['.system-map-items', '.system-orbits']
      const boxes = selectors.flatMap(selector => {
        const group = svg.querySelector<SVGGElement>(selector)
        if (!group) return []
        const { x, y, width, height } = group.getBBox()
        return [x, y, width, height].every(Number.isFinite) && (width > 0 || height > 0)
          ? [{ x, y, width, height }]
          : []
      })
      if (!boxes.length) throw new Error('The exported SVG has no measurable map features.')
      const left = Math.min(...boxes.map(box => box.x))
      const top = Math.min(...boxes.map(box => box.y))
      const right = Math.max(...boxes.map(box => box.x + box.width))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    } finally {
      host.remove()
    }
  }, { content: text, kind: mapKind })
  const [left, top, width, height] = viewBox
  if (left === undefined || top === undefined || width === undefined || height === undefined) {
    throw new Error('The exported SVG has an incomplete viewBox.')
  }
  expect(bounds.width).toBeGreaterThan(0)
  expect(bounds.height).toBeGreaterThan(0)
  expect(bounds.x).toBeGreaterThanOrEqual(left)
  expect(bounds.y).toBeGreaterThanOrEqual(top)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(left + width)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(top + height)
  return bounds
}

test('deleting a map object without dependents still asks for confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' })
  await primaryStar.click()
  await page.getByRole('button', { name: 'Delete Primary Star' }).click()
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Primary Star (Star, A)')
  await expect(deletionReview.getByRole('button', { name: 'Confirm deletion', exact: true })).toBeVisible()
  await resolveDeletionReview(deletionReview, 'cancel')
  await expect(primaryStar).toBeVisible()
})

test('older saved Jump Routes and circle/ellipse layouts restore and reject invalid levels @pure', () => {
  const savedWorkspace = {
    id: 'workspace',
    cluster: {
      id: 'cluster',
      name: 'Kestrel Reach',
      systems: [{
        id: 'vesper',
        name: 'Vesper',
        objects: [
          {
            id: 'origin',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Vesper Exit',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          },
          {
            id: 'destination',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.2',
            name: 'Harrow Entry',
            description: '',
            placement: { kind: 'system', x: 0.7, y: 0.5 },
          },
        ],
        orbits: [],
      }],
      routes: [{
        id: 'route',
        name: 'Jump-01',
        fromPointId: 'origin',
        toPointId: 'destination',
      }],
    },
    layout: { systemPositions: { vesper: { x: 0.5, y: 0.5 } } },
  }
  const restored = restoreLocalWorkspace(savedWorkspace)

  expect(restored?.cluster.routes).toMatchObject([{
    id: 'route',
    jumpLevel: 1,
    fromPointId: 'origin',
    toPointId: 'destination',
  }])
  expect(restored?.layout.orbitRotations).toEqual({})

  const legacyOrbitWorkspace = {
    ...savedWorkspace,
    cluster: {
      ...savedWorkspace.cluster,
      systems: savedWorkspace.cluster.systems.map(system => ({
        ...system,
        orbits: [
          { id: 'legacy-circle', hostId: 'origin', order: 1 },
          { id: 'legacy-ellipse', hostId: 'origin', order: 2 },
        ],
      })),
    },
    layout: {
      ...savedWorkspace.layout,
      orbitRadii: { 'legacy-circle': 100 },
      orbitEllipseRadii: { 'legacy-ellipse': { horizontal: 200, vertical: 80 } },
    },
  }
  const migrated = restoreLocalWorkspace(legacyOrbitWorkspace)
  expect(migrated?.layout.orbitRadii).toEqual({
    'legacy-circle': { horizontal: 100, vertical: 100 },
    'legacy-ellipse': { horizontal: 200, vertical: 80 },
  })
  expect(migrated?.layout).not.toHaveProperty('orbitEllipseRadii')

  for (const jumpLevel of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(restoreLocalWorkspace({
      ...savedWorkspace,
      cluster: {
        ...savedWorkspace.cluster,
        routes: savedWorkspace.cluster.routes.map(route => ({ ...route, jumpLevel })),
      },
    })).toBeNull()
  }
})

test('restoring a workspace removes legacy object targets without deleting values @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const fieldId = 'legacy-field'
  const restored = restoreLocalWorkspace({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(currentSystem => ({
        ...currentSystem,
        objects: currentSystem.objects.map(currentObject => currentObject.id === object.id
          ? { ...currentObject, customFieldValues: { [fieldId]: 'Still here.' } }
          : currentObject),
      })),
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [{
        id: fieldId,
        name: 'Campaign notes',
        type: 'text',
        applicability: [
          { kind: 'object', objectId: object.id },
          { kind: 'category', family: object.family },
          { kind: 'subtype', family: object.family, subtype: object.subtype },
        ],
      }],
    },
  })

  expect(restored?.objectFieldSettings.customFields[0]?.applicability).toEqual([
    { kind: 'category', family: object.family },
    { kind: 'subtype', family: object.family, subtype: object.subtype },
  ])
  expect(restored?.cluster.systems[0]?.objects[0]?.customFieldValues?.[fieldId]).toBe('Still here.')
})

test('custom field category and subtype scopes are united on independent system import', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('Planet survey.')
  await saveMapObject(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Aster')
  await page.getByLabel('Campaign notes').fill('Remote survey.')
  await saveMapObject(page)
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()

  const definitionDialog = await openFieldDefinitionDialog(page)
  await definitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(definitionDialog)
  await definitionDialog.getByLabel('All catalogue objects').uncheck()
  await definitionDialog.getByLabel('Subtype Planet').check()
  await definitionDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await definitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await returnToClusterMap(page)
  const sourceExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const sourceSystem = sourceExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const sourcePlanet = sourceSystem.objects.find(object => object.name === 'Iria')!
  const remoteSystem = sourceExport.cluster!.systems.find(system => system.name === 'New System 2')!
  const remotePlanet = remoteSystem.objects.find(object => object.name === 'Aster')!
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  const systemExport = await downloadJson(page, 'Export star system JSON')
  const exportedField = systemExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(exportedField.applicability).toEqual([{
    kind: 'subtype',
    family: 'CelestialBody',
    subtype: 'planet',
  }])

  const existingDefinitionDialog = await openFieldDefinitionDialog(page)
  await existingDefinitionDialog.getByRole('button', { name: /Campaign notes/ }).click()
  await editFieldDefinition(existingDefinitionDialog)
  await existingDefinitionDialog.getByLabel('Subtype Planet').uncheck()
  await existingDefinitionDialog.getByLabel('Category Celestial bodies').check()
  await existingDefinitionDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await existingDefinitionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const legacySystemExport: unknown = {
    ...systemExport,
    objectFieldSettings: {
      ...systemExport.objectFieldSettings,
      customFields: systemExport.objectFieldSettings.customFields.map(field =>
        field.id === exportedField.id
          ? {
              ...field,
              applicability: [
                ...(field.applicability ?? []),
                { kind: 'object', objectId: sourcePlanet.id },
                { kind: 'object', objectId: remotePlanet.id },
              ],
            }
          : field,
      ),
    },
  }

  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'scoped-system.json', JSON.stringify(legacySystemExport))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Compatible custom field definitions are reused')
  await resolveImportReview(preview, 'confirm')

  await returnToClusterMap(page)
  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = importedExport.cluster!.systems.find(system =>
    system.id !== sourceSystem.id && system.name === sourceSystem.name,
  )!
  const importedPlanet = importedSystem.objects.find(object => object.name === 'Iria')!
  expect(importedPlanet.id).not.toBe(sourcePlanet.id)
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Campaign notes')!
  expect(importedField.applicability).toEqual([
    { kind: 'category', family: 'CelestialBody' },
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  expect(importedPlanet.customFieldValues?.[importedField.id]).toBe('Planet survey.')

  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).last().click()
  const importedHierarchy = await openWorkspaceHierarchy(page)
  await importedHierarchy.getByRole('treeitem', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('Planet survey.')
})

test('the Warden can review and safely confirm dependent map deletions', async ({ page }) => {
  // This journey spans several review cycles and reloads, which pushes it past 30s with compiled UI.
  test.setTimeout(60_000)

  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  await returnToClusterMap(page)
  const initialHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await expect(initialHierarchy.getByRole('button', { name: 'Delete Vesper system', exact: true })).toBeDisabled()
  await setWorkspaceMapMode(page, 'Navigate')
  await page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
    .getByRole('button', { name: 'Open Vesper system map' })
    .click()

  const hierarchy = await openWorkspaceHierarchy(page)

  await addCatalogueObject(page, 'planet')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Iria/ }).click()
  await addCatalogueObject(page, 'jump-point', {
    target: { kind: 'orbit', label: 'Orbit 1 around Iria' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Vesper Exit/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Vesper Exit' } })
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Vesper Exit/ }).click()
  await addCatalogueObject(page, 'moon', {
    target: { kind: 'orbit', label: 'Orbit 1 around Vesper Exit' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Vesper Exit/ }).click()
  await page.getByRole('button', { name: 'Delete Orbit 1 around Vesper Exit' }).click()
  const orbitDeletionReview = deletionReviewDialog(page)
  const orbitDeletionSummary = await orbitDeletionReview.innerText()
  expect(orbitDeletionSummary).toContain('Nix')
  await resolveDeletionReview(orbitDeletionReview, 'cancel')
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Nix/ })).toBeVisible()

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await returnToClusterMap(page)

  await clickDockAction(page, 'Add Jump Route')
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('1')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Exit (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Harrow Entry (New System 2)')
  await page.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Harrow Entry/ })).toBeVisible()

  await clickDockAction(page, 'Add Jump Route')
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('2')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Exit (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Harrow Entry (New System 2)')
  await page.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2.*Harrow Entry/ })).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await setWorkspaceMapMode(page, 'Select')
  await page.getByRole('navigation', { name: 'Jump Routes' })
    .getByRole('button', { name: /Select Jump Level 2/ })
    .click()
  await page.getByRole('button', { name: 'Delete Jump Route (Level 2)' }).click()
  const routeDeletionReview = deletionReviewDialog(page)
  const routeDeletionSummary = await routeDeletionReview.innerText()
  expect(routeDeletionSummary).toContain('Level 2')
  await resolveDeletionReview(routeDeletionReview, 'confirm')
  await expect(clusterMap.getByRole('button', { name: /Jump Level 2/ })).toHaveCount(0)

  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('treeitem', { name: /Select .*Iria/ }).click()
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Orbit 1 around Iria')
  expect(deletionSummary).toContain('Vesper Exit')
  expect(deletionSummary).toContain('Orbit 1 around Vesper Exit')
  expect(deletionSummary).toContain('Nix')
  expect(deletionSummary).toContain('Level 1')
  await resolveDeletionReview(deletionReview, 'cancel')
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Vesper Exit/ })).toBeVisible()
  await returnToClusterMap(page)
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

  await page.reload()
  await openWorkspaceHierarchy(page)
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Nix/ })).toBeVisible()
  await returnToClusterMap(page)
  const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(restoredClusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()

  await setWorkspaceMapMode(page, 'Navigate')
  await restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('treeitem', { name: /Select .*Iria/ }).click()
  await page.getByRole('button', { name: 'Delete Iria' }).click()
  const confirmedDeletionReview = deletionReviewDialog(page)
  const confirmedDeletionSummary = await confirmedDeletionReview.innerText()
  expect(confirmedDeletionSummary).toContain('Orbit 1 around Iria')
  await resolveDeletionReview(confirmedDeletionReview, 'confirm')
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })).toHaveCount(0)
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Vesper Exit/ })).toHaveCount(0)
  await returnToClusterMap(page)
  const updatedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(updatedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)

  await page.reload()
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })).toHaveCount(0)
  await returnToClusterMap(page)
  const reloadedClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await expect(reloadedClusterMap.getByRole('button', { name: /Jump Level 1/ })).toHaveCount(0)
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toBeVisible()
  const reloadedClusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await reloadedClusterHierarchy.getByRole('button', { name: 'Delete New System 2 system' }).click()
  const systemDeletionReview = deletionReviewDialog(page)
  const systemDeletionSummary = await systemDeletionReview.innerText()
  expect(systemDeletionSummary).toContain('Harrow Entry')
  await resolveDeletionReview(systemDeletionReview, 'confirm')
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open New System 2 system map' })).toHaveCount(0)
  await expect(reloadedClusterMap.getByRole('button', { name: 'Open Vesper system map' })).toBeVisible()
})

test('deleting an associated physical Station clears the Jump Point association after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await expect(page.getByRole('group', { name: 'Vesper star system map' })).toBeVisible()
  await addCatalogueObject(page, 'station')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Gate')
  await saveMapObject(page)
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Arrival')
  await saveMapObject(page)
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: /Vesper Arrival/ }).click()
  await editMapObject(page)
  const physicalStation = page.getByLabel('Physical Station association')
  await selectInspectorOption(physicalStation, { label: /Vesper Gate/ })
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Vesper Gate/ }).click()
  await page.getByRole('button', { name: 'Delete Vesper Gate' }).click()
  const deletionReview = deletionReviewDialog(page)
  const deletionSummary = await deletionReview.innerText()
  expect(deletionSummary).toContain('Vesper Arrival')
  expect(deletionSummary).toContain('Vesper Gate')
  await resolveDeletionReview(deletionReview, 'confirm')
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Vesper Gate/ })).toHaveCount(0)
  await hierarchy.getByRole('treeitem', { name: /Select .*Vesper Arrival/ }).click()
  expect(await readInspectorSelection(physicalStation)).toBe('No physical Station')

  await page.reload()
  await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: /Select .*Vesper Arrival/ }).click()
  expect(await readInspectorSelection(page.getByLabel('Physical Station association'))).toBe('No physical Station')
})

test('the Warden can export a cluster and standalone system as versioned JSON', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchy = await openWorkspaceHierarchy(page)
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Exit')
  await saveMapObject(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  await addClusterSystem(page, { open: true })
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Entry')
  await saveMapObject(page)
  await returnToClusterMap(page)

  await clickDockAction(page, 'Add Jump Route')
  await page.getByRole('spinbutton', { name: 'Jump level' }).fill('8')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Exit (Vesper)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Harrow Entry (New System 2)')
  await page.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  const createdRoute = clusterMap.getByRole('button', { name: /Jump Level 8.*Harrow Entry/ })
  await expect(createdRoute).toBeVisible()
  await setWorkspaceMapMode(page, 'Navigate')
  await setWorkspaceMapMode(page, 'Select')
  await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await createdRoute.locator('.cluster-route-label').click()
  await expect(createdRoute).toHaveClass(/is-selected/)
  await expect(createdRoute.locator('.cluster-route-label')).toHaveText('Jump-8')
  const clusterMapText = await clusterMap.locator('text').allTextContents()
  expect(clusterMapText).not.toContain('Kestrel Reach')
  expect(clusterMapText).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterMapText).not.toContain('2 SYSTEMS / 1 ROUTES')

  await setWorkspaceMapMode(page, 'Navigate')
  const secondSystem = clusterMap.getByRole('button', { name: 'Open New System 2 system map' })
  await dragBy(page, secondSystem.locator('.cluster-system-card'), { x: 48, y: 24 })
  await workspaceZoomControls(page).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 24, y: 18 })
  const clusterViewportTransform = await clusterMap.locator('.cluster-map-content').getAttribute('transform')
  expect(clusterViewportTransform).not.toBe('translate(0,0) scale(1)')
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expect(clusterSvg.text).toContain('Kestrel Reach')
  const clusterSvgInfo = await inspectImageSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.contentTransform).toBeNull()
  await expectExportedFeaturesInsideViewBox(page, clusterSvg.text!, clusterSvgInfo.viewBox, 'cluster')
  expect(clusterSvgInfo.texts).toEqual(expect.arrayContaining(['Vesper', 'New System 2', 'Jump-8']))
  expect(clusterSvgInfo.texts).not.toContain('Kestrel Reach')
  expect(clusterSvgInfo.texts).not.toContain('JUMP CLUSTER / KNOWN SYSTEMS AND ROUTES')
  expect(clusterSvgInfo.texts).not.toContain('2 SYSTEMS / 1 ROUTES')
  expect(clusterSvgInfo.systemTitle).toBeNull()
  expect(clusterSvgInfo.titleStyle).toBeNull()
  expectReadableExport(clusterSvgInfo)
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.size).toBeGreaterThan(100)
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)
  const clusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(clusterExport).toMatchObject({
    format: 'ttrpg-cluster-control-map',
    version: 1,
    type: 'cluster',
    layout: { version: 1 },
  })
  expect(clusterExport.cluster?.systems).toHaveLength(2)
  expect(clusterExport.cluster?.routes).toHaveLength(1)
  expect(clusterExport.cluster?.routes[0]?.jumpLevel).toBe(8)
  expect(Object.keys(clusterExport.layout.systemPositions ?? {}).sort())
    .toEqual(clusterExport.cluster!.systems.map(system => system.id).sort())
  expect(clusterExport.layout).not.toHaveProperty('zoom')
  expect(clusterExport.layout).not.toHaveProperty('pan')
  expect(clusterExport).not.toHaveProperty('selectedRouteId')
  const exportedSecondSystem = clusterExport.cluster!.systems.find(system => system.name === 'New System 2')!
  const secondSystemPosition = clusterExport.layout.systemPositions?.[exportedSecondSystem.id]
  if (!secondSystemPosition) throw new Error('The exported second system is missing its position.')
  expect(secondSystemPosition.x).not.toBe(0.5)

  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await addCustomFieldThroughDialog(page, 'Campaign notes', 'text')
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await hierarchy.getByRole('treeitem', { name: /Orbit 1 around Primary Star/ }).click()
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Campaign notes').fill('A local secret.')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Iria/ }).click()

  const systemMap = page.getByRole('group', { name: 'Vesper star system map' })
  const iriaHitTarget = systemMap.getByRole('button', { name: /Iria/ }).locator('.object-hit-target')
  const iriaDropPoint = {
    x: 480 + 112 * Math.SQRT1_2,
    y: 280 - 112 * Math.SQRT1_2,
  }
  await ensureMapDragPointsReachable(page, systemMap, iriaHitTarget, iriaDropPoint)
  await dragToWorldPoint(page, systemMap, iriaHitTarget, iriaDropPoint)
  const orbitHandle = systemMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  await orbitHandle.press('End')
  await workspaceZoomControls(page).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })

  await returnToClusterMap(page)
  const updatedClusterExport = await downloadJson(page, 'Export Jump Cluster JSON')
  const clusterSystem = updatedClusterExport.cluster!.systems.find(system => system.name === 'Vesper')!
  const planet = clusterSystem.objects.find(object => object.name === 'Iria')!
  const orbit = clusterSystem.orbits[0]
  if (!orbit) throw new Error('The exported star system does not contain an Orbit.')
  const field = updatedClusterExport.objectFieldSettings.customFields.find(item => item.name === 'Campaign notes')!
  expect(planet.customFieldValues?.[field.id]).toBe('A local secret.')
  expect(updatedClusterExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(updatedClusterExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(Number.isFinite(updatedClusterExport.layout.objectAngles[planet.id])).toBe(true)
  expect(updatedClusterExport.layout).not.toHaveProperty('zoom')
  expect(updatedClusterExport.layout).not.toHaveProperty('pan')
  expect(updatedClusterExport).not.toHaveProperty('selectedSystemId')
  expect(updatedClusterExport).not.toHaveProperty('selectedObjectId')

  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: 'Open Vesper system map' }).click()
  await hierarchy.getByRole('treeitem', { name: /Iria/ }).click()
  await workspaceZoomControls(page).getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, systemMap, { x: 24, y: 18 })
  const systemViewportTransform = await systemMap.locator('.system-map-content').getAttribute('transform')
  expect(systemViewportTransform).not.toBe('translate(0,0) scale(1)')
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  expect(systemSvg.text).toContain('Iria')
  const systemSvgInfo = await inspectImageSvg(page, systemSvg.text!)
  expect(systemSvgInfo.contentTransform).toBeNull()
  expect(systemSvgInfo.viewBox[2]).toBeGreaterThan(960)
  expect(systemSvgInfo.viewBox[3]).toBeGreaterThan(560)
  expect(systemSvgInfo.texts).toContain('Iria')
  const systemFeatureBounds = await expectExportedFeaturesInsideViewBox(page, systemSvg.text!, systemSvgInfo.viewBox, 'system')
  const systemTitle = systemSvgInfo.systemTitle
  if (!systemTitle) throw new Error('The exported star system SVG is missing its title.')
  expect(systemTitle.text).toBe('Vesper')
  expect(systemTitle.x).toBeGreaterThan(systemSvgInfo.viewBox[0])
  expect(systemTitle.x + systemTitle.width)
    .toBeLessThanOrEqual(systemSvgInfo.viewBox[0] + systemSvgInfo.viewBox[2] - 24)
  expect(systemTitle.y - systemTitle.fontSize / 2).toBeGreaterThan(systemSvgInfo.viewBox[1])
  expect(systemTitle.y + systemTitle.fontSize / 2).toBeLessThan(systemFeatureBounds.y)
  expect(systemSvgInfo.titleStyle).toBeNull()
  expect(systemSvgInfo.glyphFill).toBeTruthy()
  expectReadableExport(systemSvgInfo)
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.size).toBeGreaterThan(100)
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  if (!systemPng.sourceSvgText) throw new Error('The star system PNG has no source SVG.')
  const systemPngInfo = await inspectImageSvg(page, systemPng.sourceSvgText)
  expect(systemPngInfo.systemTitle?.text).toBe('Vesper')
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport).toMatchObject({
    format: 'ttrpg-cluster-control-map',
    version: 1,
    type: 'system',
    layout: { version: 1 },
  })
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport).not.toHaveProperty('routes')
  expect(systemExport.system?.name).toBe('Vesper')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Vesper Exit')
  expect(systemExport.system?.objects.map(object => object.name)).toContain('Iria')
  expect(systemExport.system?.objects.map(object => object.name)).not.toContain('Harrow Entry')
  expect(systemExport.layout.systemPositions).toBeUndefined()
  expect(systemExport.layout.orbitRadii[orbit.id])
    .toEqual({ horizontal: 512, vertical: 512 })
  expect(systemExport.layout).not.toHaveProperty('orbitEllipseRadii')
  expect(systemExport.layout.objectAngles[planet.id]).toBe(updatedClusterExport.layout.objectAngles[planet.id])
  expect(systemExport.layout).not.toHaveProperty('zoom')
  expect(systemExport.layout).not.toHaveProperty('pan')
  expect(systemExport).not.toHaveProperty('selectedObjectId')
  expect(systemExport.objectFieldSettings.customFields).toContainEqual(field)
  expect(systemExport.system?.objects.find(object => object.name === 'Iria')?.customFieldValues?.[field.id])
    .toBe('A local secret.')

  const renamedSystemName = 'W'.repeat(80)
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const chartNamesDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartNamesDialog.getByLabel('Star system').fill(renamedSystemName)
  await chartNamesDialog.getByRole('button', { name: 'Apply names' }).click()
  await expect(page.getByRole('group', { name: `${renamedSystemName} star system map` })).toBeVisible()
  const renamedSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const renamedSvgInfo = await inspectImageSvg(page, renamedSvg.text!)
  const renamedTitle = renamedSvgInfo.systemTitle
  if (!renamedTitle) throw new Error('The renamed star system SVG is missing its title.')
  expect(renamedTitle.text).toBe(renamedSystemName)
  expect(renamedSvgInfo.width).toBeGreaterThan(systemSvgInfo.width)
  expect(renamedTitle.x + renamedTitle.width)
    .toBeLessThanOrEqual(renamedSvgInfo.viewBox[0] + renamedSvgInfo.viewBox[2] - 24)
  expectReadableExport(renamedSvgInfo)
  const renamedPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  if (!renamedPng.sourceSvgText) throw new Error('The renamed star system PNG has no source SVG.')
  const renamedPngInfo = await inspectImageSvg(page, renamedPng.sourceSvgText)
  expect(renamedPngInfo.systemTitle?.text).toBe(renamedSystemName)
})

test('the Warden can validate and import an independent JSON copy', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const importFile = jsonMapImportInput(page)
  await setHeaderMapActionsOpen(page, true)
  const invalidFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  expect((await invalidFileChooser).isMultiple()).toBe(false)
  await setJsonFile(importFile, 'invalid.json', '{')
  await setHeaderMapActionsOpen(page, false)
  await expect(page.getByRole('alert').last()).toContainText('valid JSON')
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  const incoming = {
    format: 'ttrpg-cluster-control-map',
    version: 1,
    type: 'cluster',
    cluster: {
      id: 'incoming-cluster',
      name: 'Imported Reach',
      systems: [
        {
          id: 'incoming-alpha',
          name: 'Vesper',
          objects: [
            {
              id: 'incoming-star',
              family: 'CelestialBody',
              subtype: 'star',
              locationKey: 'A',
              name: 'Primary Star',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
            {
              id: 'incoming-station',
              family: 'Installation',
              subtype: 'station',
              locationKey: 'ST.1',
              name: 'Relay Station',
              description: '',
              placement: { kind: 'system', x: 0.6, y: 0.5 },
            },
            {
              id: 'incoming-point-alpha',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Alpha Gate',
              description: '',
              placement: { kind: 'system', x: 0.7, y: 0.5 },
              jumpStationId: 'incoming-station',
            },
            {
              id: 'incoming-planet',
              family: 'CelestialBody',
              subtype: 'planet',
              locationKey: 'PL.1',
              name: 'Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { 'incoming-field': 'The key is hidden.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: 'incoming-star', order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [
            {
              id: 'incoming-point-beta',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Beta Gate',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
          ],
          orbits: [],
        },
      ],
      routes: [
        {
          id: 'incoming-route',
          name: 'Known route',
          fromPointId: 'incoming-point-alpha',
          toPointId: 'incoming-point-beta',
        },
        {
          id: 'incoming-exit',
          name: 'Unknown route',
          jumpLevel: 12,
          fromPointId: 'incoming-point-beta',
          toPointId: null,
          unresolvedExit: 'Uncharted exit',
        },
      ],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{ id: 'incoming-field', name: 'Campaign notes', type: 'text' }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 100 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const invalidLayout = {
    ...incoming,
    layout: {
      ...incoming.layout,
      systemPositions: {
        ...incoming.layout.systemPositions,
        'missing-system': { x: 0.5, y: 0.5 },
      },
    },
  }
  await setJsonFile(importFile, 'invalid-layout.json', JSON.stringify(invalidLayout))
  await expect(page.getByRole('alert').last()).toContainText('valid version 1')
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const canceledPreview = importReviewDialog(page)
  const previewText = await canceledPreview.innerText()
  expect(previewText).toContain('Star systems: 2')
  expect(previewText).toContain('Map objects: 5')
  expect(previewText).toContain('Orbits: 1')
  expect(previewText).toContain('Jump Routes: 2')
  expect(previewText).toContain('Custom fields: 1')
  expect(previewText).toContain('Possible existing matches by name or location key')
  expect(previewText).toContain('Primary Star')
  expect(previewText).toContain('same name')
  await resolveImportReview(canceledPreview, 'cancel')
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(1)

  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const acceptedPreview = importReviewDialog(page)
  const acceptedSummary = await acceptedPreview.innerText()
  expect(acceptedSummary).toContain('Star systems: 2')
  await resolveImportReview(acceptedPreview, 'confirm')
  const alphaNode = systemList.getByRole('button', { name: 'Open Vesper system map' }).last()
  const betaNode = systemList.getByRole('button', { name: 'Open Far Vesper system map' })
  await expect(alphaNode).toBeVisible()
  await expect(betaNode).toBeVisible()
  const importedRoutes = page.getByRole('navigation', { name: 'Jump Routes' })
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 1.*Alpha Gate.*Beta Gate.*Far Vesper/,
  })).toBeVisible()
  await expect(importedRoutes.getByRole('button', {
    name: /Jump Level 12.*Beta Gate.*Unknown destination.*Uncharted exit/,
  })).toBeVisible()
  await workspaceZoomControls(page).getByRole('button', { name: 'Fit map' }).click()
  await betaNode.click()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Far Vesper' })).toBeVisible()

  await returnToClusterMap(page)
  const firstImport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedAlpha = firstImport.cluster!.systems.find(system =>
    system.name === 'Vesper' && system.objects.some(object => object.name === 'Iria'),
  )!
  const importedBeta = firstImport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  if (!importedOrbit) throw new Error('The imported star system does not contain an Orbit.')
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = firstImport.objectFieldSettings.customFields.find(field => field.name === 'Campaign notes')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedBeta.id).not.toBe('incoming-beta')
  expect(importedPlanet.id).not.toBe('incoming-planet')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'The key is hidden.' })
  expect(importedField.id).not.toBe('incoming-field')
  expect(importedField.applicability).toBeUndefined()
  expect(firstImport.cluster!.routes.find(route => route.name === 'Known route')).toMatchObject({
    jumpLevel: 1,
    fromPointId: importedPoint.id,
    toPointId: importedBetaPoint.id,
  })
  expect(firstImport.cluster!.routes.find(route => route.name === 'Unknown route')).toMatchObject({
    jumpLevel: 12,
    fromPointId: importedBetaPoint.id,
    toPointId: null,
    unresolvedExit: 'Uncharted exit',
  })
  expect(firstImport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(firstImport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 100, vertical: 100 })
  expect(firstImport.layout.objectAngles[importedPlanet.id]).toBe(1.2)

  await alphaNode.click()
  const importedHierarchy = await openWorkspaceHierarchy(page)
  await importedHierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
  await expect(page.getByLabel('Campaign notes')).toBeVisible()
  await importedHierarchy.getByRole('treeitem', { name: /Iria/ }).click()
  await expect(page.getByLabel('Campaign notes')).toHaveValue('The key is hidden.')
  await returnToClusterMap(page)

  await setJsonFile(importFile, 'duplicate.json', JSON.stringify(firstImport))
  const duplicatePreview = importReviewDialog(page)
  const duplicateSummary = await duplicatePreview.innerText()
  expect(duplicateSummary).toContain('Original-ID collisions')
  expect(duplicateSummary).toContain('Primary Star')
  await resolveImportReview(duplicatePreview, 'confirm')
  await expect(systemList.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(4)
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(2)
})

test('the Warden can import a standalone system without adding cluster routes', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const exportedSystem = await downloadJson(page, 'Export star system JSON')
  const input = jsonMapImportInput(page)
  await setJsonFile(input, 'system-copy.json', JSON.stringify(exportedSystem))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 1')
  expect(previewSummary).toContain('Jump Routes: 0')
  expect(previewSummary).toContain('Primary Star')
  await resolveImportReview(preview, 'confirm')

  await returnToClusterMap(page)
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systems = page.getByRole('navigation', { name: 'Star systems' })
  await expect(systems.getByRole('button', { name: 'Open Vesper system map' })).toHaveCount(2)
  const exportedCluster = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exportedCluster.cluster?.systems).toHaveLength(2)
  expect(exportedCluster.cluster?.routes).toHaveLength(0)
  const exportedSystems = exportedCluster.cluster?.systems
  if (!exportedSystems || exportedSystems.length !== 2) {
    throw new Error('The exported Cluster does not contain both star systems.')
  }
  const [firstSystem, secondSystem] = exportedSystems
  const firstObject = firstSystem?.objects[0]
  const secondObject = secondSystem?.objects[0]
  if (!firstSystem || !secondSystem || !firstObject || !secondObject) {
    throw new Error('The exported star systems do not contain their expected objects.')
  }
  expect(firstSystem.id).not.toBe(secondSystem.id)
  expect(firstObject.id).not.toBe(secondObject.id)
})

test('the Warden can construct, edit, and reload the local campaign', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await expect.poll(() => page.evaluate(async () =>
    (await indexedDB.databases()).some(database => database.name === 'ttrpg-cluster-control'),
  )).toBe(true)

  const clusterName = 'Kestrel Reach Prime'
  const systemName = 'Vesper Prime'
  const hierarchy = await openWorkspaceHierarchy(page)
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  let chartNamesDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartNamesDialog.getByLabel('Jump Cluster').fill(clusterName)
  await chartNamesDialog.getByLabel('Star system').fill(systemName)
  await chartNamesDialog.getByRole('button', { name: 'Apply names' }).click()
  await addCustomFieldThroughDialog(page, 'Warden notes', 'text')

  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Primary Star' } })
  await addCatalogueObject(page, 'planet', {
    target: { kind: 'orbit', label: 'Orbit 1 around Primary Star' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Iria')
  await page.getByLabel('Warden notes').fill('Existing campaign record.')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: /Iria/ }).click()
  await clickDockAction(page, 'Add orbit', { target: { kind: 'host', name: 'Iria' } })
  await addCatalogueObject(page, 'moon', {
    target: { kind: 'orbit', label: 'Orbit 1 around Iria' },
  })
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Nix')
  await saveMapObject(page)
  await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Vesper Departure')
  await saveMapObject(page)

  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map` })
  await returnToClusterMap(page)
  await addClusterSystem(page, { open: true })
  await expect(page.getByRole('group', { name: 'New System 2 star system map' })).toBeVisible()
  await page.getByRole('button', { name: 'Chart details' }).click()
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  chartNamesDialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await chartNamesDialog.getByLabel('Star system').fill('Harrow')
  await chartNamesDialog.getByRole('button', { name: 'Apply names' }).click()
  await addCatalogueObject(page, 'jump-point')
  await editMapObject(page)
  await page.getByLabel('Name', { exact: true }).fill('Harrow Arrival')
  await saveMapObject(page)
  await returnToClusterMap(page)
  await clickDockAction(page, 'Add Jump Route')
  await selectInspectorOption(page.getByLabel('From Jump Point'), 'Vesper Departure (Vesper Prime)')
  await selectInspectorOption(page.getByLabel('Route destination'), 'Known Jump Point')
  await selectInspectorOption(page.getByLabel('To Jump Point'), 'Harrow Arrival (Harrow)')
  await page.getByRole('button', { name: 'Create Jump Route', exact: true }).click()
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ }))
    .toBeVisible()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await page.reload()
  await openWorkspaceHierarchy(page)
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: systemName })).toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Select .*Iria/ })).toBeVisible()
  await expect(hierarchy.getByRole('treeitem', { name: /Nix/ })).toBeVisible()
  await hierarchy.getByRole('treeitem', { name: /Select .*Iria/ }).click()
  await expect(page.getByLabel('Warden notes')).toHaveValue('Existing campaign record.')
  const systemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const mapPlanet = systemMap.getByRole('button', { name: /Select PL-01, Iria/ })
  await mapPlanet.focus()
  await mapPlanet.press('Enter')
  await expect(inspector.getByRole('heading', { name: 'Iria' })).toBeVisible()
  const systemNavigation = workspaceZoomControls(page)
  await expect(systemNavigation.locator('output').first()).toHaveText(/^\d+%$/)
  const systemZoomBefore = Number((await systemNavigation.locator('output').first().textContent())?.replace('%', ''))
  await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => Number((await systemNavigation.locator('output').first().textContent())?.replace('%', '')))
    .toBeGreaterThan(systemZoomBefore)
  await systemNavigation.getByRole('button', { name: 'Fit map' }).click()

  await returnToClusterMap(page)
  const clusterNavigation = workspaceZoomControls(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const harrowNode = clusterMap.getByRole('button', { name: 'Open Harrow system map' })
  await harrowNode.focus()
  await harrowNode.press('Enter')
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Harrow' })).toBeVisible()
  await returnToClusterMap(page)
  await expect(clusterNavigation.locator('output').first()).toHaveText(/^\d+%$/)
  const clusterZoomBefore = Number((await clusterNavigation.locator('output').first().textContent())?.replace('%', ''))
  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => Number((await clusterNavigation.locator('output').first().textContent())?.replace('%', '')))
    .toBeGreaterThan(clusterZoomBefore)
  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()

  const baseline = await downloadJson(page, 'Export Jump Cluster JSON')
  const originalSystem = baseline.cluster!.systems.find(system => system.name === systemName)!
  const originalPlanet = originalSystem.objects.find(object => object.name === 'Iria')!
  const existingField = baseline.objectFieldSettings.customFields.find(field => field.name === 'Warden notes')!
  expect(originalPlanet.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')
  expect(baseline.cluster!.systems).toHaveLength(2)
  expect(baseline.cluster!.routes).toHaveLength(1)
})

test('the Warden can import, export, and safely delete versioned campaign data', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadWindow = window as DownloadWindow
    downloadWindow.__mapExportBlobs = []
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) downloadWindow.__mapExportBlobs?.push(object)
      return createObjectURL(object)
    }
  })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach Prime')
  await page.getByLabel('First star system').fill('Campaign staging')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const clusterName = 'Kestrel Reach Prime'
  const systemName = 'Vesper Prime'
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map` })
  await setJsonFile(jsonMapImportInput(page), 'campaign-baseline.json', JSON.stringify(campaignBaselineFixture))
  const baselinePreview = importReviewDialog(page)
  const baselineSummary = await baselinePreview.innerText()
  expect(baselineSummary).toContain('Star systems: 2')
  expect(baselineSummary).toContain('Map objects: 6')
  expect(baselineSummary).toContain('Jump Routes: 1')
  await resolveImportReview(baselinePreview, 'confirm')

  await returnToClusterMap(page)
  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await clusterHierarchy.getByRole('button', { name: 'Delete Campaign staging system', exact: true }).click()
  const stagingDeletionReview = deletionReviewDialog(page)
  const stagingDeletionSummary = await stagingDeletionReview.innerText()
  expect(stagingDeletionSummary).toContain('Campaign staging')
  await resolveDeletionReview(stagingDeletionReview, 'confirm')
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', { name: 'Open Campaign staging system map' })).toHaveCount(0)
  await page.reload()
  await returnToClusterMap(page)

  const clusterNavigation = workspaceZoomControls(page)
  const baseline = await downloadJson(page, 'Export Jump Cluster JSON')
  const originalSystem = baseline.cluster!.systems.find(system => system.name === systemName)!
  const originalStar = originalSystem.objects.find(object => object.name === 'Primary Star')!
  const originalPlanet = originalSystem.objects.find(object => object.name === 'Iria')!
  const originalRoute = baseline.cluster!.routes.find(route => route.jumpLevel === 1)!
  const existingField = baseline.objectFieldSettings.customFields.find(field => field.name === 'Warden notes')!
  const originalSystemIds = baseline.cluster!.systems.map(system => system.id)
  expect(baseline.cluster!.systems).toHaveLength(2)
  expect(originalPlanet.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

  const incoming = {
    format: 'ttrpg-cluster-control-map',
    version: 1,
    type: 'cluster',
    cluster: {
      id: 'incoming-cluster',
      name: 'Imported Reach',
      systems: [
        {
          id: 'incoming-alpha',
          name: systemName,
          objects: [
            {
              id: originalStar.id,
              family: 'CelestialBody',
              subtype: 'star',
              locationKey: 'A',
              name: 'Primary Star',
              description: '',
              placement: { kind: 'system', x: 0.5, y: 0.5 },
            },
            {
              id: 'incoming-station',
              family: 'Installation',
              subtype: 'station',
              locationKey: 'ST.1',
              name: 'Relay Station',
              description: '',
              placement: { kind: 'system', x: 0.6, y: 0.5 },
            },
            {
              id: 'incoming-point-alpha',
              family: 'JumpPoint',
              subtype: 'jump-point',
              locationKey: 'JP.1',
              name: 'Alpha Gate',
              description: '',
              placement: { kind: 'system', x: 0.7, y: 0.5 },
              jumpStationId: 'incoming-station',
            },
            {
              id: 'incoming-planet',
              family: 'CelestialBody',
              subtype: 'planet',
              locationKey: 'PL.1',
              name: 'Imported Iria',
              description: '',
              placement: { kind: 'orbit', orbitId: 'incoming-orbit' },
              customFieldValues: { [existingField.id]: 'Imported campaign record.' },
            },
          ],
          orbits: [{ id: 'incoming-orbit', hostId: originalStar.id, order: 1 }],
        },
        {
          id: 'incoming-beta',
          name: 'Far Vesper',
          objects: [{
            id: 'incoming-point-beta',
            family: 'JumpPoint',
            subtype: 'jump-point',
            locationKey: 'JP.1',
            name: 'Beta Gate',
            description: '',
            placement: { kind: 'system', x: 0.5, y: 0.5 },
          }],
          orbits: [],
        },
      ],
      routes: [{
        id: 'incoming-route',
        name: 'Imported route',
        fromPointId: 'incoming-point-alpha',
        toPointId: 'incoming-point-beta',
      }],
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
      portClassOptions: ['Class I', 'Class II', 'Class III'],
      customFields: [{
        id: existingField.id,
        name: 'Imported observations',
        type: 'text',
      }],
    },
    layout: {
      version: 1,
      systemPositions: {
        'incoming-alpha': { x: 0.25, y: 0.75 },
        'incoming-beta': { x: 0.8, y: 0.3 },
      },
      orbitRadii: { 'incoming-orbit': 120 },
      objectAngles: { 'incoming-planet': 1.2 },
    },
  }
  const importFile = jsonMapImportInput(page)
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const systemList = page.getByRole('navigation', { name: 'Star systems' })
  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const preview = importReviewDialog(page)
  const previewSummary = await preview.innerText()
  expect(previewSummary).toContain('Star systems: 2')
  expect(previewSummary).toContain('Map objects: 5')
  expect(previewSummary).toContain('Original-ID collisions (2)')
  expect(previewSummary).toContain('Primary Star')
  expect(previewSummary).toContain('Possible existing matches by name or location key')
  await resolveImportReview(preview, 'cancel')
  await expect(systemList.getByRole('button', { name: /Open .* system map/ }))
    .toHaveCount(originalSystemIds.length)
  const unchanged = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(unchanged.cluster!.systems.map(system => system.id)).toEqual(originalSystemIds)
  expect(unchanged.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])

  await setJsonFile(importFile, 'imported-reach.json', JSON.stringify(incoming))
  const acceptedImport = importReviewDialog(page)
  const acceptedSummary = await acceptedImport.innerText()
  expect(acceptedSummary).toContain('Star systems: 2')
  await resolveImportReview(acceptedImport, 'confirm')
  await expect(systemList.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(1)
  await page.reload()
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await returnToClusterMap(page)
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ }))
    .toBeVisible()

  const importedExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(importedExport.cluster!.systems).toHaveLength(4)
  const importedAlpha = importedExport.cluster!.systems.find(system =>
    system.name === systemName && system.id !== originalSystem.id,
  )!
  const importedBeta = importedExport.cluster!.systems.find(system => system.name === 'Far Vesper')!
  const importedStar = importedAlpha.objects.find(object => object.name === 'Primary Star')!
  const importedStation = importedAlpha.objects.find(object => object.name === 'Relay Station')!
  const importedPoint = importedAlpha.objects.find(object => object.name === 'Alpha Gate')!
  const importedPlanet = importedAlpha.objects.find(object => object.name === 'Imported Iria')!
  const importedOrbit = importedAlpha.orbits[0]
  if (!importedOrbit) throw new Error('The imported star system does not contain an Orbit.')
  const importedBetaPoint = importedBeta.objects.find(object => object.name === 'Beta Gate')!
  const importedField = importedExport.objectFieldSettings.customFields
    .find(field => field.name === 'Imported observations')!
  const importedRoute = importedExport.cluster!.routes.find(route => route.name === 'Imported route')!
  expect(importedAlpha.id).not.toBe('incoming-alpha')
  expect(importedStar.id).not.toBe(originalStar.id)
  expect(importedStation.id).not.toBe('incoming-station')
  expect(importedPoint.jumpStationId).toBe(importedStation.id)
  expect(importedPlanet.placement).toEqual({ kind: 'orbit', orbitId: importedOrbit.id })
  expect(importedPlanet.customFieldValues).toEqual({ [importedField.id]: 'Imported campaign record.' })
  expect(importedField.id).not.toBe(existingField.id)
  expect(importedRoute.fromPointId).toBe(importedPoint.id)
  expect(importedRoute.toPointId).toBe(importedBetaPoint.id)
  expect(importedRoute.jumpLevel).toBe(1)
  expect(importedExport.layout.systemPositions?.[importedAlpha.id]).toEqual({ x: 0.25, y: 0.75 })
  expect(importedExport.layout.orbitRadii[importedOrbit.id])
    .toEqual({ horizontal: 120, vertical: 120 })
  expect(importedExport.layout.objectAngles[importedPlanet.id]).toBe(1.2)
  const preservedSystem = importedExport.cluster!.systems.find(system => system.id === originalSystem.id)!
  expect(preservedSystem.objects.find(object => object.id === originalPlanet.id)?.customFieldValues?.[existingField.id])
    .toBe('Existing campaign record.')
  expect(importedExport.cluster!.routes.some(route => route.id === originalRoute.id)).toBe(true)

  await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, clusterMap, { x: 1000, y: 300 })
  const clusterSvg = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  const clusterSvgInfo = await inspectExportedSvg(page, clusterSvg.text!)
  expect(clusterSvgInfo.text).toContain(systemName)
  expect(clusterSvgInfo.text).toContain('Harrow')
  expect(clusterSvgInfo.text).toContain('Far Vesper')
  expect(clusterSvgInfo.text).toContain('Jump-1')
  await expectExportedFeaturesInsideViewBox(page, clusterSvg.text!, clusterSvgInfo.viewBox, 'cluster')
  const clusterPng = await downloadImage(page, 'Export Jump Cluster PNG', 'image/png')
  expect(clusterPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(clusterPng.width).toBe(clusterSvgInfo.width)
  expect(clusterPng.height).toBe(clusterSvgInfo.height)

  await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  await setWorkspaceMapMode(page, 'Navigate')
  await clusterMap.getByRole('button', { name: `Open ${systemName} system map` }).first().click()
  const activeSystemMap = page.getByRole('group', { name: `${systemName} star system map` })
  const activeSystemNavigation = workspaceZoomControls(page)
  await activeSystemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  await panMap(page, activeSystemMap, { x: 1000, y: 300 })
  const systemSvg = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  const systemSvgInfo = await inspectExportedSvg(page, systemSvg.text!)
  expect(systemSvgInfo.text).toContain('Iria')
  expect(systemSvgInfo.text).toContain('Nix')
  expect(systemSvgInfo.text).toContain('Vesper Departure')
  await expectExportedFeaturesInsideViewBox(page, systemSvg.text!, systemSvgInfo.viewBox, 'system')
  const systemPng = await downloadImage(page, 'Export star system PNG', 'image/png')
  expect(systemPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(systemPng.width).toBe(systemSvgInfo.width)
  expect(systemPng.height).toBe(systemSvgInfo.height)
  const systemExport = await downloadJson(page, 'Export star system JSON')
  expect(systemExport.type).toBe('system')
  expect(systemExport.cluster).toBeUndefined()
  expect(systemExport.system?.objects.map(object => object.name))
    .toEqual(expect.arrayContaining(['Iria', 'Nix', 'Vesper Departure']))
  expect(systemExport.system?.objects.find(object => object.id === originalPlanet.id)
    ?.customFieldValues?.[existingField.id]).toBe('Existing campaign record.')

  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const importedClusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const deleteImportedSystem = importedClusterHierarchy.getByRole('button', { name: 'Delete Far Vesper system' })
  await deleteImportedSystem.click()
  const canceledDeletionReview = deletionReviewDialog(page)
  const canceledDeletionSummary = await canceledDeletionReview.innerText()
  expect(canceledDeletionSummary).toContain('Beta Gate')
  expect(canceledDeletionSummary).toContain('Level 1')
  await resolveDeletionReview(canceledDeletionReview, 'cancel')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toBeVisible()
  const importedRouteMark = clusterMap.getByRole('button', { name: /Jump Level 1.*Alpha Gate.*Beta Gate/ })
  await expect(importedRouteMark).toBeVisible()

  const staleClusterPositionErrors: string[] = []
  const captureClusterPositionPageError = (error: Error): void => {
    if (error.message.includes('No cluster-map position')) staleClusterPositionErrors.push(error.message)
  }
  const captureClusterPositionConsoleError = (message: import('@playwright/test').ConsoleMessage): void => {
    if (message.type() === 'error' && message.text().includes('No cluster-map position')) {
      staleClusterPositionErrors.push(message.text())
    }
  }
  page.on('pageerror', captureClusterPositionPageError)
  page.on('console', captureClusterPositionConsoleError)
  await deleteImportedSystem.click()
  const confirmedDeletionReview = deletionReviewDialog(page)
  const confirmedDeletionSummary = await confirmedDeletionReview.innerText()
  expect(confirmedDeletionSummary).toContain('Beta Gate')
  expect(confirmedDeletionSummary).toContain('Level 1')
  await resolveDeletionReview(confirmedDeletionReview, 'confirm')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(importedRouteMark).toHaveCount(0)
  expect(staleClusterPositionErrors).toEqual([])
  page.off('pageerror', captureClusterPositionPageError)
  page.off('console', captureClusterPositionConsoleError)
  await page.reload()
  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  await expect(clusterMap.getByRole('button', { name: 'Open Far Vesper system map' })).toHaveCount(0)
  await expect(clusterMap.getByRole('button', { name: /Jump Level 1/ })).toBeVisible()
  const finalExport = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(finalExport.cluster!.systems).toHaveLength(3)
  expect(finalExport.cluster!.systems.some(system => system.id === originalSystem.id)).toBe(true)
  expect(finalExport.cluster!.routes.map(route => route.id)).toEqual([originalRoute.id])
})
