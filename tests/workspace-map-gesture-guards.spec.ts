import { expect, test, type Page } from './fixtures'
import { addCatalogueObject, captureMapExportBlobs, downloadJson, openWorkspaceZoomNavigation, parseMapCameraTransform, workspaceZoomOutput } from './helpers'

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

async function createWorkspace(page: Page, options: WorkspacePreparationOptions = {}): Promise<void> {
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
}

async function dragMapBackground(page: Page): Promise<void> {
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const bounds = await map.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + 24
  const startY = bounds!.y + 24
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 48, startY + 28, { steps: 4 })
  await page.mouse.up()
}

// The cold trace measured first root SSR at 127s; allow bounded client/preparation headroom.
// This provisional preparation ceiling does not change the scenario's standard 30s budget.
const MOVE_DRAFT_PREPARATION_TIMEOUT = 180_000

async function prepareMoveDraft(page: Page) {
  return await test.step('Prepare the workspace and unresolved metadata draft', async () => {
    await captureMapExportBlobs(page)
    await createWorkspace(page, {
      measurePhases: true,
      startupTimeout: MOVE_DRAFT_PREPARATION_TIMEOUT,
    })
    const map = page.getByRole('group', { name: 'Vesper star system map' })
    const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
    const object = map.locator('.system-object').filter({ hasText: 'Primary Star' })

    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
    await addCatalogueObject(page, 'planet', { noSelection: true })
    await expect(map.locator('.system-object')).toHaveCount(2)
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Select' }).click()
    await object.click()
    const objectId = await object.getAttribute('data-object-id')
    const committedBefore = await downloadJson(page, 'Export star system JSON')
    const committedObject = committedBefore.system!.objects.find(candidate => candidate.id === objectId)!
    await page.getByRole('button', { name: 'Edit map object' }).click()
    await page.getByLabel('GM notes').fill('Unresolved map-object draft')
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')

    return { map, inspectorToggle, object, objectId, committedObject }
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
  const { map, inspectorToggle, object, objectId, committedObject } = preparedMoveDraft

  await test.step('Move the object while metadata remains unresolved', async () => {
    await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

    const originalObjectTransform = await object.getAttribute('transform')
    const bounds = await object.boundingBox()
    expect(bounds).not.toBeNull()
    const startX = bounds!.x + bounds!.width / 2
    const startY = bounds!.y + bounds!.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 52, startY + 34, { steps: 5 })
    await expect(object).not.toHaveAttribute('transform', originalObjectTransform!)
    await page.mouse.up()

    await expect(object).not.toHaveAttribute('transform', originalObjectTransform!)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    const committedAfterMove = await downloadJson(page, 'Export star system JSON')
    const movedObject = committedAfterMove.system!.objects.find(candidate => candidate.id === objectId)!
    expect(movedObject.placement).not.toEqual(committedObject.placement)
    expect({ ...movedObject, placement: committedObject.placement }).toEqual(committedObject)
    await inspectorToggle.click()
    const inspector = page.locator('#workspace-inspector-panel')
    await expect(inspector.getByLabel('GM notes')).toHaveValue('Unresolved map-object draft')
    await expect(inspector.getByRole('button', { name: /^Apply changes/ })).toBeVisible()
    await inspector.getByRole('button', { name: 'Cancel map object edits' }).click()
    const committedAfterDiscard = await downloadJson(page, 'Export star system JSON')
    expect(committedAfterDiscard.system!.objects.find(candidate => candidate.id === objectId)).toEqual(movedObject)
  })

  await test.step('Check independent map targets and navigation controls', async () => {
    await inspectorToggle.click()
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
    const shortTapBounds = await object.boundingBox()
    expect(shortTapBounds).not.toBeNull()
    await page.mouse.click(shortTapBounds!.x + shortTapBounds!.width / 2, shortTapBounds!.y + shortTapBounds!.height / 2)
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')

    await page.getByRole('button', { name: 'Fit map' }).click()
    const independentObject = map.locator('.system-object').filter({ hasText: 'New planet 1' })
    const independentTransform = await independentObject.getAttribute('transform')
    const independentHitTarget = independentObject.locator('.object-hit-target')
    const independentBounds = await independentHitTarget.boundingBox()
    expect(independentBounds).not.toBeNull()
    await page.mouse.move(independentBounds!.x + independentBounds!.width / 2, independentBounds!.y + independentBounds!.height / 2)
    await page.mouse.down()
    await page.mouse.move(independentBounds!.x + independentBounds!.width / 2 + 44, independentBounds!.y + independentBounds!.height / 2 + 26, { steps: 4 })
    await expect(independentObject).not.toHaveAttribute('transform', independentTransform!)
    await page.mouse.up()
    await expect(independentObject).not.toHaveAttribute('transform', independentTransform!)

    const zoomNavigation = await openWorkspaceZoomNavigation(page)
    const scene = page.locator('.system-map-content')
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
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const object = map.getByRole('button', { name: 'Select A, Primary Star (Star)' })
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

test('changing mode while a Navigate entity press is held cancels its inspection long press', async ({ page }) => {
  await createWorkspace(page)
  const map = page.getByRole('group', { name: 'Vesper star system map' })
  const object = map.locator('.system-object').filter({ hasText: 'Primary Star' })
  const inspectorToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click()
  const modeGroup = page.getByRole('group', { name: 'Map interaction mode' })
  const navigateMode = modeGroup.getByRole('button', { name: 'Navigate' })
  const selectMode = modeGroup.getByRole('button', { name: 'Select' })
  await navigateMode.click()
  await expect(navigateMode).toHaveAttribute('aria-pressed', 'true')
  const bounds = await object.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + bounds!.width / 2
  const startY = bounds!.y + bounds!.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Keep the native entity press held while activating the public mode button. A second mouse
  // action would release that press first, so use the button's native activation without moving focus.
  await selectMode.evaluate(button => (button as HTMLButtonElement).click())
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await expect(navigateMode).toHaveAttribute('aria-pressed', 'false')
  // Inspection arms at 560 ms; both that delay and the 900 ms fallback expire while still held.
  await page.waitForTimeout(1_200)

  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(0)
  await page.mouse.up()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(0)
  await expect(map).toBeVisible()

  await map.getByRole('button', { name: 'Select A, Primary Star (Star)' }).click()
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(map.locator('.system-object.is-selected')).toHaveCount(1)
})
