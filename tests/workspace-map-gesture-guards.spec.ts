import { expect, test, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  clickWardenSystemPoint,
  downloadJson,
  exposedContinuousObjectHitPoint,
  hideWorkspaceInspector,
  openWorkspaceZoomNavigation,
  parseMapCameraTransform,
  quitSystemAdd,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
  workspaceZoomOutput,
} from './helpers'

type WorkspacePreparationOptions = {
  measurePhases?: boolean
  startupTimeout?: number
}

async function measuredStep<T>(
  enabled: boolean,
  title: string,
  action: () => Promise<T>,
): Promise<T> {
  return enabled ? test.step(title, action) : action()
}

async function createWorkspace(page: Page, options: WorkspacePreparationOptions = {}) {
  await page.setViewportSize({ width: 1440, height: 960 })
  const { measurePhases = false } = options
  await measuredStep(measurePhases, 'Navigate to the local workspace form', () => options.startupTimeout === undefined
    ? page.goto('/')
    : page.goto('/', { timeout: options.startupTimeout }))

  const clusterName = page.getByRole('textbox', { name: 'Jump Cluster' })
  if (measurePhases) {
    await test.step('Wait for the client-rendered Jump Cluster field', async () => {
      if (options.startupTimeout === undefined) await expect(clusterName).toBeVisible()
      else await expect(clusterName).toBeVisible({ timeout: options.startupTimeout })
      await expect(clusterName).toBeEditable()
    })
  }

  await measuredStep(measurePhases, 'Fill the Jump Cluster field', () => clusterName.fill('Kestrel Reach'))
  await measuredStep(measurePhases, 'Complete local workspace creation', async () => {
    await page.getByRole('textbox', { name: 'First star system' }).fill('Vesper')
    await page.getByRole('button', { name: 'Create local workspace' }).click()
    await expect(page.getByRole('toolbar', { name: 'Workspace navigation' })).toBeVisible()
  })

  const map = wardenMap(page)
  const anchor = map.locator('.continuous-warden-system-anchor')
  await expect(anchor).toHaveCount(1)
  const systemId = await anchor.getAttribute('data-system-id')
  if (!systemId) throw new Error('The created system must expose its owner identity.')
  await map.locator('.continuous-warden-name-target').click()
  await hideWorkspaceInspector(page)
  await centerWorkspaceSelection(page)
  const star = map.locator(`.continuous-warden-object[data-system-id="${systemId}"]`)
  await expect(star).toHaveCount(1)
  const objectId = await star.getAttribute('data-object-id')
  if (!objectId) throw new Error('The primary Star must expose its domain identity.')
  return { map, systemId, object: wardenObjectMark(page, systemId, objectId), objectId }
}

async function dragMapBackground(page: Page): Promise<void> {
  const map = wardenMap(page)
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The visible map is needed for the right-button pan.')
  const startX = bounds.x + 24
  const startY = bounds.y + 24
  const scene = map.locator('.cluster-map-content')
  const cameraBefore = await scene.getAttribute('transform')
  await page.mouse.move(startX, startY)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(startX + 48, startY + 28, { steps: 4 })
  await page.mouse.up({ button: 'right' })
  await expect(scene).not.toHaveAttribute('transform', cameraBefore ?? '')
}

// The cold trace measured first root SSR at 127s; allow bounded client/preparation headroom.
// This provisional preparation ceiling does not change the scenario's standard 30s budget.
const MOVE_DRAFT_PREPARATION_TIMEOUT = 180_000

async function prepareMoveDraft(page: Page) {
  return await test.step('Prepare the workspace and unresolved metadata draft', async () => {
    await captureMapExportBlobs(page)
    const { map, systemId, object, objectId } = await createWorkspace(page, {
      measurePhases: true,
      startupTimeout: MOVE_DRAFT_PREPARATION_TIMEOUT,
    })
    const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
    await (await selectCatalogueObjectButton(page, 'planet')).click()
    await clickWardenSystemPoint(page, systemId, { x: 0.33, y: 0.67 })
    await quitSystemAdd(page)
    await waitForWorkspaceSaved(page)
    await object.press('Enter')
    const before = await downloadJson(page, 'Export Jump Cluster JSON')
    const owner = before.cluster?.systems.find(system => system.id === systemId)
    const committedObject = owner?.objects.find(candidate => candidate.id === objectId)
    const planet = owner?.objects.find(candidate => candidate.subtype === 'planet')
    if (!committedObject || !planet) throw new Error('The saved owner needs its primary Star and independent Planet.')
    await page.getByRole('button', { name: 'Edit map object' }).click()
    await page.getByLabel('GM notes').fill('Unresolved map-object draft')
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')

    return { map, inspectorToggle, object, objectId, committedObject, systemId, planetId: planet.id }
  })
}

type MoveDraftFixtures = {
  preparedMoveDraft: Awaited<ReturnType<typeof prepareMoveDraft>>
}

const moveDraftTest = test.extend<MoveDraftFixtures>({
  preparedMoveDraft: [async ({ page }, use) => {
    await use(await prepareMoveDraft(page))
  }, {
    timeout: MOVE_DRAFT_PREPARATION_TIMEOUT,
    title: 'Prepare the Move draft in the test browser context',
  }],
})

moveDraftTest('Move commits a free position independently of an unresolved metadata draft', async ({ page, preparedMoveDraft }) => {
  const { map, inspectorToggle, object, objectId, committedObject, systemId, planetId } = preparedMoveDraft

  await test.step('Move the object while metadata remains unresolved', async () => {
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

    const originalObjectTransform = await object.getAttribute('transform')
    const start = await exposedContinuousObjectHitPoint(object)
    if (!start) throw new Error('The primary Star must have a reachable native Move target.')
    const { x: startX, y: startY } = start
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 52, startY + 34, { steps: 5 })
    await expect(object).not.toHaveAttribute('transform', originalObjectTransform!)
    await page.mouse.up()

    await expect(object).not.toHaveAttribute('transform', originalObjectTransform!)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    const committedAfterMove = await downloadJson(page, 'Export Jump Cluster JSON')
    const movedObject = committedAfterMove.cluster?.systems.find(system => system.id === systemId)
      ?.objects.find(candidate => candidate.id === objectId)
    if (!movedObject) throw new Error('Move must preserve the Star in the same owning system.')
    expect(movedObject.placement).not.toEqual(committedObject.placement)
    expect({ ...movedObject, placement: committedObject.placement }).toEqual(committedObject)
    await inspectorToggle.click()
    const inspector = page.locator('#workspace-inspector-panel')
    await expect(inspector.getByLabel('GM notes')).toHaveValue('Unresolved map-object draft')
    await expect(inspector.getByRole('button', { name: /^Apply changes/ })).toBeVisible()
    await inspector.getByRole('button', { name: 'Cancel map object edits' }).click()
    const committedAfterDiscard = await downloadJson(page, 'Export Jump Cluster JSON')
    expect(committedAfterDiscard.cluster?.systems.find(system => system.id === systemId)
      ?.objects.find(candidate => candidate.id === objectId)).toEqual(movedObject)
  })

  await test.step('Check independent map targets and navigation controls', async () => {
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    const shortTap = await exposedContinuousObjectHitPoint(object)
    if (!shortTap) throw new Error('The moved Star must remain hittable after its commit.')
    await page.mouse.click(shortTap.x, shortTap.y)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')

    const independentObject = wardenObjectMark(page, systemId, planetId)
    const independentTransform = await independentObject.getAttribute('transform')
    const start = await exposedContinuousObjectHitPoint(independentObject)
    if (!start || !independentTransform) throw new Error('The independent Planet is not ready for native Move.')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 44, start.y + 26, { steps: 4 })
    await expect(independentObject).not.toHaveAttribute('transform', independentTransform)
    await page.mouse.up()
    await expect(independentObject).not.toHaveAttribute('transform', independentTransform)

    const zoomNavigation = await openWorkspaceZoomNavigation(page)
    const scene = map.locator('.cluster-map-content')
    const cameraBeforePan = parseMapCameraTransform(await scene.getAttribute('transform'))
    await zoomNavigation.getByRole('button', { name: 'Pan map right' }).click()
    await expect.poll(async () => parseMapCameraTransform(await scene.getAttribute('transform'))).toEqual({
      ...cameraBeforePan,
      x: cameraBeforePan.x + 80,
    })
    const zoomOutput = workspaceZoomOutput(page)
    const originalZoomPercent = Number.parseFloat((await zoomOutput.textContent()) ?? '')
    expect(Number.isFinite(originalZoomPercent)).toBe(true)
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(async () => Number.parseFloat((await zoomOutput.textContent()) ?? ''))
      .toBeGreaterThan(originalZoomPercent)
  })
})

test('keyboard Enter and Space still activate a map object immediately after pointer pan', async ({ page }) => {
  const { object } = await createWorkspace(page)
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()

  for (const key of ['Enter', 'Space'] as const) {
    await dragMapBackground(page)
    await object.focus()
    await page.keyboard.press(key)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true')
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  }
})
