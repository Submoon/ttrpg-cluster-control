import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  exportStarSystem,
} from '../domain/workspace'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'
import {
  abortNextWorkspaceWrite,
  waitForWorkspaceSaved,
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  dockAction,
  hideWorkspaceInspector,
  importReviewDialog,
  openStarSystemImportPicker,
  openChartDetailsEditor,
  returnToClusterMap,
  resolveImportReview,
  reviewStarSystemImport,
  setJsonFile,
  setHeaderMapActionsOpen,
  workspaceZoomControls,
} from './helpers'

function incomingSystem(): {
  content: string
  systemId: string
  objectIds: string[]
  orbitId: string
} {
  const source = createLocalWorkspace('Incoming Reach', 'Incoming Vesper')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The import fixture needs its initial star system.')

  const star = sourceSystem.objects[0]
  if (!star) throw new Error('The import fixture needs its host star.')
  const orbit = createOrbit(sourceSystem, star.id)
  const systemWithOrbit = { ...sourceSystem, orbits: [orbit] }
  const distantPlanet = createSystemObject(systemWithOrbit, 'planet', orbit.id)
  const system = { ...systemWithOrbit, objects: [...sourceSystem.objects, distantPlanet] }
  const sourceWithGeometry = {
    ...source,
    cluster: { ...source.cluster, systems: [system] },
    layout: {
      ...source.layout,
      orbitRadii: { [orbit.id]: { horizontal: 4200, vertical: 1900 } },
      orbitRotations: { [orbit.id]: 31 },
      objectAngles: { [distantPlanet.id]: 1.1 },
    },
  }
  const legacyExport = JSON.parse(JSON.stringify(exportStarSystem(sourceWithGeometry, system.id))) as {
    version: number
    system: { objects: Array<Record<string, unknown>> }
  }
  legacyExport.version = 3
  for (const object of legacyExport.system.objects) {
    delete object.playerText
    delete object.playerFieldMasks
  }

  return {
    content: JSON.stringify(legacyExport),
    systemId: system.id,
    objectIds: system.objects.map(object => object.id),
    orbitId: orbit.id,
  }
}

test('standalone system review preserves an unrelated chart draft and adds an independent system only on confirm', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.goto('/?map=continuous')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const context = page.getByRole('navigation', { name: 'Map context and commands' })
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  const chartEditor = await openChartDetailsEditor(page)
  await chartEditor.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartEditor.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const incoming = incomingSystem()
  const openPlacementReview = async () => {
    await setJsonFile(await openStarSystemImportPicker(page), 'incoming-reach.json', incoming.content)
    const placement = page.getByRole('group', { name: 'Standalone star system placement controls', exact: true })
    await expect(placement).toBeVisible()
    const preview = page.locator('.continuous-warden-import-placement-preview')
    await expect(preview).toBeVisible()
    await expect(preview.locator('.continuous-warden-import-orbit')).toHaveCount(1)
    const map = page.locator('svg.continuous-warden-map-svg')
    const envelope = preview.locator('.continuous-warden-import-envelope')
    const expectEnvelopeFramed = async () => {
      const mapBounds = await map.boundingBox()
      const envelopeBounds = await envelope.boundingBox()
      if (!mapBounds || !envelopeBounds) throw new Error('The imported system envelope is not measurable.')
      expect(envelopeBounds.x).toBeGreaterThanOrEqual(mapBounds.x)
      expect(envelopeBounds.y).toBeGreaterThanOrEqual(mapBounds.y)
      expect(envelopeBounds.x + envelopeBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width)
      expect(envelopeBounds.y + envelopeBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height)
    }
    await placement.getByRole('button', { name: 'Frame preview', exact: true }).click()
    await expectEnvelopeFramed()
    const initialX = await preview.getAttribute('data-anchor-x')
    const bounds = await map.boundingBox()
    if (!bounds) throw new Error('The continuous Cluster map is not visible.')
    await map.click({ position: { x: bounds.width * 0.6, y: bounds.height * 0.62 } })
    await expect.poll(async () => preview.getAttribute('data-anchor-x')).not.toBe(initialX)
    const anchor = {
      x: Number(await preview.getAttribute('data-anchor-x')),
      y: Number(await preview.getAttribute('data-anchor-y')),
    }
    await placement.getByRole('button', { name: 'Frame preview', exact: true }).click()
    await expectEnvelopeFramed()
    await placement.getByRole('button', { name: 'Review placement', exact: true }).click()
    return { review: importReviewDialog(page), anchor }
  }

  const firstPlacement = await openPlacementReview()
  const review = firstPlacement.review
  await expect(review).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })).toHaveCount(0)
  await resolveImportReview(review, 'cancel')
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' })).toBeVisible()

  const afterCancel = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterCancel.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' }).click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const acceptedPlacement = await openPlacementReview()
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  await expect(review).toBeHidden()
  await setHeaderMapActionsOpen(page, false)
  await expect(context.getByRole('heading', { name: 'Kestrel Reach', exact: true })).toBeVisible()
  await waitForWorkspaceSaved(page)
  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft' })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.systems.map(system => system.name)).toEqual(['Vesper', 'Incoming Vesper'])
  const importedSystem = exported.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem?.id).not.toBe(incoming.systemId)
  expect(importedSystem && exported.layout.systemPositions?.[importedSystem.id]).toEqual(acceptedPlacement.anchor)
  const importedOrbit = importedSystem?.orbits[0]
  expect(importedOrbit).toBeDefined()
  expect(importedOrbit?.id).not.toBe(incoming.orbitId)
  expect(importedOrbit && exported.layout.orbitRadii?.[importedOrbit.id]).toEqual({ horizontal: 4200, vertical: 1900 })
  expect(importedOrbit && exported.layout.orbitRotations?.[importedOrbit.id]).toBe(31)
  const importedObjectIds = new Set(importedSystem?.objects.map(object => object.id))
  for (const sourceId of incoming.objectIds) expect(importedObjectIds.has(sourceId)).toBe(false)
  expect(exported.cluster?.routes).toHaveLength(0)

  await resumeDraft.click()
  await chartEditor.getByRole('button', { name: 'Discard draft', exact: true }).click()
  const undo = page.getByRole('button', { name: /^Undo\b/ })
  await expect(undo).toBeEnabled()
  await (await dockAction(page, 'Add star system')).click()
  await setJsonFile(await openStarSystemImportPicker(page), 'incoming-reach-copy.json', incoming.content)
  const placement = page.getByRole('group', { name: 'Standalone star system placement controls', exact: true })
  await expect(placement).toBeVisible()
  await expect(undo).toBeDisabled()
  const map = page.locator('svg.continuous-warden-map-svg')
  const preview = page.locator('.continuous-warden-import-placement-preview')
  const initialAnchor = await preview.getAttribute('data-anchor-x')
  const camera = map.locator('.cluster-map-content')
  const initialCamera = await camera.getAttribute('transform')
  await map.focus()
  await page.keyboard.press('ArrowRight')
  await expect(camera).not.toHaveAttribute('transform', initialCamera ?? '')
  await expect(preview).toHaveAttribute('data-anchor-x', initialAnchor ?? '')
  await page.keyboard.press('Control+z')
  await expect(placement).toBeVisible()
  await expect(page.locator('.continuous-warden-system-anchor[data-system-id]')).toHaveCount(2)
  await expect(undo).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(placement).toBeHidden()
  await expect(page.locator('.continuous-warden-system-anchor[data-system-id]')).toHaveCount(2)
  await expect(undo).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Add to map', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Select', exact: true }).click()

  await page.reload()
  await returnToClusterMap(page)
  const persisted = await downloadJson(page, 'Export Jump Cluster JSON')
  const persistedSystem = persisted.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(persistedSystem).toBeDefined()
  expect(persistedSystem && persisted.layout.systemPositions?.[persistedSystem.id]).toEqual(acceptedPlacement.anchor)
  const persistedOrbit = persistedSystem?.orbits[0]
  expect(persistedOrbit && persisted.layout.orbitRadii?.[persistedOrbit.id]).toEqual({ horizontal: 4200, vertical: 1900 })
  expect(persistedOrbit && persisted.layout.orbitRotations?.[persistedOrbit.id]).toBe(31)
})

test('canceling a held import placement click leaves Add ready for the next click', async ({ page }) => {
  await page.goto('/?map=continuous')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  await (await dockAction(page, 'Add star system')).click()
  await setJsonFile(await openStarSystemImportPicker(page), 'incoming-reach-copy.json', incomingSystem().content)
  const placement = page.getByRole('group', { name: 'Standalone star system placement controls', exact: true })
  await expect(placement).toBeVisible()

  const map = page.locator('svg.continuous-warden-map-svg')
  const anchorMarks = map.locator('.continuous-warden-system-anchor[data-system-id]')
  const safeCandidates = [{ x: 0.75, y: 0.65 }, { x: 0.64, y: 0.5 }, { x: 0.75, y: 0.35 }]
    .map(position => clusterSystemPosition({ candidate: position }, 'candidate'))
  const clearContactPoint = () => map.evaluate((element, candidates) => {
    const transform = element.querySelector<SVGGElement>('.cluster-map-content')?.getScreenCTM()
    if (!transform) throw new Error('The map must expose its current scene transform.')
    for (const candidate of candidates) {
      const screen = new DOMPoint(candidate.x, candidate.y).matrixTransform(transform)
      const x = Math.round(screen.x)
      const y = Math.round(screen.y)
      if (document.elementFromPoint(x, y) === element) return { x, y }
    }
    return null
  }, safeCandidates)
  const zoomOut = workspaceZoomControls(page).getByRole('button', { name: 'Zoom out', exact: true })
  let contact = await clearContactPoint()
  for (let step = 0; !contact && step < 12 && !await zoomOut.isDisabled(); step += 1) {
    await zoomOut.click()
    contact = await clearContactPoint()
  }
  if (!contact) throw new Error('The held pointer must reach clear map space.')

  await map.focus()
  await page.mouse.move(contact.x, contact.y)
  await page.mouse.down()
  await page.keyboard.press('Escape')
  await expect(placement).toBeHidden()
  await page.mouse.up()
  await expect(anchorMarks).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Add to map', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.mouse.click(contact.x, contact.y)
  await expect(anchorMarks).toHaveCount(2)
  await waitForWorkspaceSaved(page)
})

test('an applied import closes review before save failure and Retry persists the copy without clearing an unrelated draft', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await returnToClusterMap(page)

  const chartEditor = await openChartDetailsEditor(page)
  await chartEditor.getByLabel('Jump Cluster', { exact: true }).fill('Unapplied Reach')
  await chartEditor.getByLabel('Star system', { exact: true }).fill('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  const incoming = incomingSystem()
  const review = await reviewStarSystemImport(page, 'incoming-reach.json', incoming.content)
  await expect(review).toBeVisible()

  const saveFeedback = activeWorkspaceFeedback(page).locator('.save-feedback')
  await abortNextWorkspaceWrite(page, async () => {
    await resolveImportReview(review, 'confirm')
    await expect(review).toBeHidden()
    await expect(saveFeedback).toContainText('Not saved.')
  })

  const appliedMemory = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = appliedMemory.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(importedSystem).toBeDefined()
  expect(importedSystem?.id).not.toBe(incoming.systemId)
  await expect(saveFeedback).toContainText('Not saved.')

  const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume Jump Cluster details draft', exact: true })
  await expect(resumeDraft).toBeVisible()
  await resumeDraft.click()
  await expect(chartEditor.getByLabel('Jump Cluster', { exact: true })).toHaveValue('Unapplied Reach')
  await expect(chartEditor.getByLabel('Star system', { exact: true })).toHaveValue('Unapplied Vesper')
  await hideWorkspaceInspector(page)

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Retry save', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await page.reload()
  await returnToClusterMap(page)

  const afterReload = await downloadJson(page, 'Export Jump Cluster JSON')
  const persistedImport = afterReload.cluster?.systems.find(system => system.name === 'Incoming Vesper')
  expect(persistedImport).toBeDefined()
  expect(persistedImport?.id).not.toBe(incoming.systemId)
})
