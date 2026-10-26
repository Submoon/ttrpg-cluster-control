import { expect, test } from '@playwright/test'
import {
  activeWorkspaceFeedback,
  captureMapExportBlobs,
  downloadJson,
  openFieldDefinitionDialog,
  selectInspectorOption,
} from './helpers'

async function setWorkspaceTheme(page: import('@playwright/test').Page, target: 'light' | 'dark'): Promise<void> {
  const theme = page.getByRole('group', { name: 'Theme' })
  const status = theme.locator('.workspace-header-theme-status')
  const current = (await status.textContent())?.toLowerCase() ?? ''
  if (!current.includes(target)) {
    await theme.getByRole('button', { name: new RegExp(`switch to ${target} mode`, 'i') }).click()
  }
  await expect(status).toContainText(new RegExp(target, 'i'))
}

async function expectDialogGeometry(
  dialog: import('@playwright/test').Locator,
  compact: boolean,
): Promise<void> {
  await expect.poll(async () => dialog.evaluate((element, isCompact) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    const actions = element.querySelector<HTMLElement>('.field-definitions-actions')
    if (!actions) return null
    const actionsBounds = actions.getBoundingClientRect()
    const dialogBottom = y + height
    const actionsBottomGap = dialogBottom - (actionsBounds.y + actionsBounds.height)
    const withinViewport = x >= 0
      && y >= 0
      && x + width <= innerWidth + 1
      && y + height <= innerHeight + 1
    const aligned = isCompact
      ? x <= 1 && y <= 1 && width >= innerWidth - 1
      : Math.abs(x + width / 2 - innerWidth / 2) <= 1
        && Math.abs(y + height / 2 - innerHeight / 2) <= 1
    const actionsWithinViewport = actionsBounds.x >= 0
      && actionsBounds.y >= 0
      && actionsBounds.x + actionsBounds.width <= innerWidth + 1
      && actionsBounds.y + actionsBounds.height <= innerHeight + 1
    const actionsAtDialogBottom = actionsBottomGap >= 0 && actionsBottomGap <= 32
    return { withinViewport, aligned, actionsWithinViewport, actionsAtDialogBottom }
  }, compact)).toEqual({
    withinViewport: true,
    aligned: true,
    actionsWithinViewport: true,
    actionsAtDialogBottom: true,
  })
}

test('mobile Fields opens to its list and resumes the last valid screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const opener = page.getByRole('button', { name: 'Open field definitions' })
  const dialog = await openFieldDefinitionDialog(page)
  const fieldList = dialog.getByRole('navigation', { name: 'Field definitions' })
  const detail = dialog.getByRole('region', { name: 'Field definition editor' })

  await expect(dialog).toBeVisible()
  await expect(fieldList).toBeVisible()
  await expect(detail).toBeHidden()

  const atmosphere = fieldList.getByRole('button', { name: /Atmosphere/ })
  await atmosphere.click()
  await expect(fieldList).toBeHidden()
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: 'Atmosphere', exact: true })).toBeVisible()
  const savedDetails = detail.getByRole('region', { name: 'Saved definition details' })
  await expect(savedDetails.getByRole('heading', { name: 'Saved choices' })).toBeVisible()
  await expect(savedDetails.getByRole('listitem')).toHaveText([
    'Breathable',
    'Unbreathable',
    'Vacuum',
  ])
  await expect(detail.getByRole('button', { name: 'Edit field definition' })).toHaveCount(0)
  const fieldActions = dialog.locator('.field-definitions-actions')
  await expect(fieldActions.getByRole('button', { name: 'Edit field definition' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Edit field definition' })).toHaveCount(1)

  await fieldActions.getByRole('button', { name: 'Edit field definition' }).click()
  await expect(fieldActions.getByRole('button', { name: 'Apply field changes' })).toBeDisabled()
  await expect(fieldActions.getByRole('button', { name: 'Discard field edits' })).toBeEnabled()
  await fieldActions.getByRole('button', { name: 'Discard field edits' }).click()
  await expect(detail.getByRole('heading', { name: 'Atmosphere', exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await expect(fieldList).toBeVisible()
  await expect(detail).toBeHidden()
  await expect(atmosphere).toHaveAttribute('aria-pressed', 'true')
  await expect(atmosphere).toBeFocused()

  await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()

  const resumedDialog = await openFieldDefinitionDialog(page)
  const resumedList = resumedDialog.getByRole('navigation', { name: 'Field definitions' })
  await expect(resumedDialog).toBeVisible()
  await expect(resumedList).toBeVisible()
  await expect(resumedDialog.getByRole('region', { name: 'Field definition editor' })).toBeHidden()
  await expect(resumedList.getByRole('button', { name: /Atmosphere/ })).toHaveAttribute('aria-pressed', 'true')
})

test('Fields modal geometry holds across mobile, short landscape, and desktop themes', async ({ page }, testInfo) => {
  const viewports = [
    { width: 390, height: 844, compact: true, theme: 'light' as const },
    { width: 844, height: 390, compact: true, theme: 'dark' as const },
    { width: 390, height: 500, compact: true, theme: 'dark' as const },
    { width: 1440, height: 960, compact: false, theme: 'light' as const },
  ]
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await setWorkspaceTheme(page, viewport.theme)
    const dialog = await openFieldDefinitionDialog(page)
    await expect(dialog).toBeVisible()
    await expectDialogGeometry(dialog, viewport.compact)
    if (viewport.width === 844) {
      await page.screenshot({ path: testInfo.outputPath('fields-dark-compact-landscape.png') })
    }
    await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  }
})

test('mobile Fields retains an unsaved native-field draft across Back, hide, theme, and reflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  await expect(hierarchyToggle).toBeVisible()
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.getByRole('dialog', { name: 'System hierarchy' })
  await expect(hierarchy).toBeVisible()
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  const manageFields = page.getByRole('button', { name: 'Manage field definitions' })
  await expect(manageFields).toBeVisible()
  await manageFields.click()
  const dialog = page.getByRole('dialog', { name: 'Field definitions' })
  await expect(dialog).toBeVisible()
  const fieldList = dialog.getByRole('navigation', { name: 'Field definitions' })
  const atmosphere = fieldList.getByRole('button', { name: /Atmosphere/ })
  await atmosphere.click()
  await dialog.getByRole('button', { name: 'Edit field definition' }).click()

  const savedOptions = 'Breathable\nUnbreathable\nVacuum\nDraft-only atmosphere'
  await dialog.getByLabel('Atmosphere choices').fill(savedOptions)
  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await atmosphere.click()
  await expect(dialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)

  await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  const inspector = page.getByRole('dialog', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Hide inspector' }).click()
  await expect(inspector).toBeHidden()
  const theme = page.getByRole('group', { name: 'Theme' })
  const currentTheme = (await theme.locator('.workspace-header-theme-status').textContent())?.trim()
  await theme.getByRole('button', { name: /switch to (light|dark) mode/i }).click()
  await expect(theme.locator('.workspace-header-theme-status')).not.toHaveText(currentTheme ?? '')

  await page.setViewportSize({ width: 844, height: 390 })
  const inspectToggle = page.getByRole('button', { name: 'Inspect', exact: true })
  if (await inspectToggle.getAttribute('aria-expanded') !== 'true') await inspectToggle.click()
  const resumedInspector = page.getByRole('dialog', { name: 'Object inspector' })
  await expect(resumedInspector).toBeVisible()
  const resumedManageFields = resumedInspector.getByRole('button', { name: 'Manage field definitions' })
  await resumedManageFields.click()
  const resumedDialog = page.getByRole('dialog', { name: 'Field definitions' })
  await expect(resumedDialog).toBeVisible()
  await expectDialogGeometry(resumedDialog, true)
  await expect(resumedDialog.getByRole('heading', { name: 'Atmosphere', exact: true })).toBeVisible()
  await expect(resumedDialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)

  await resumedDialog.getByRole('button', { name: 'Back to definitions' }).click()
  await resumedDialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Port class/ }).click()
  await expect(resumedDialog.getByRole('status', { name: 'Unsaved field draft' })).toBeVisible()
  await resumedDialog.getByRole('button', { name: 'Stay here' }).click()
  await resumedDialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Atmosphere/ }).click()
  await expect(resumedDialog.getByLabel('Atmosphere choices')).toHaveValue(savedOptions)
})

test('removing a saved choice opens a field change review before applying', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const dialog = await openFieldDefinitionDialog(page)
  const fieldList = dialog.getByRole('navigation', { name: 'Field definitions' })
  await fieldList.getByRole('button', { name: /Atmosphere/ }).click()
  await dialog.getByRole('button', { name: 'Edit field definition' }).click()
  await dialog.getByLabel('Atmosphere choices').fill('Breathable\nUnbreathable')
  await dialog.getByRole('button', { name: 'Apply field changes' }).click()

  await expect(dialog.getByRole('region', { name: 'Field change review' })).toBeVisible()
})

test('a hidden create draft applies before continuing to another saved field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await dialog.getByLabel('Custom field label').fill('Deferred notes')
  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await dialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Atmosphere/ }).click()

  await expect(dialog.getByRole('status', { name: 'Unsaved field draft' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Apply and continue' }).click()
  await expect(dialog.getByRole('heading', { name: 'Atmosphere', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  const deferredField = dialog.getByRole('navigation', { name: 'Field definitions' }).getByRole('button', { name: /Deferred notes/ })
  await expect(deferredField).toHaveCount(1)
})

test('an invalid create draft keeps its error and advertises the draft after reopening', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await dialog.getByLabel('Custom field label').fill('Duplicate marker')
  await dialog.getByRole('button', { name: 'Add custom field' }).click()
  await expect(dialog.getByRole('heading', { name: 'Duplicate marker', exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await dialog.getByLabel('Custom field label').fill('Duplicate marker')
  await dialog.getByRole('button', { name: 'Add custom field' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already exists')

  await dialog.getByRole('button', { name: 'Close field definitions' }).click()
  const opener = page.getByRole('button', { name: 'Open field definitions' })
  await expect(opener.getByText('Draft', { exact: true })).toBeVisible()
  await expect(opener).toHaveAttribute('aria-description', 'An unsaved field draft is retained.')
  await opener.click()

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('alert')).toContainText('already exists')
  await expect(dialog.getByLabel('Custom field label')).toHaveValue('Duplicate marker')
  await dialog.getByRole('button', { name: 'Back to definitions' }).click()
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already exists')
  await expect(dialog.getByLabel('Custom field label')).toHaveValue('Duplicate marker')
})

test('creating a field applies once and retry persists the same definition identity', async ({ page }) => {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: 'New custom field' }).click()
  await dialog.getByLabel('Custom field label').fill('Retry marker')
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    if (!original) throw new Error('IndexedDB put is unavailable.')
    const state = { original, aborted: 0 }
    ;(window as Window & { __fieldCreationAbort?: typeof state }).__fieldCreationAbort = state
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
    await dialog.getByRole('button', { name: 'Add custom field' }).click()
    await expect(dialog.getByRole('heading', { name: 'Retry marker', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close field definitions' }).click()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')
    const aborted = await page.evaluate(() =>
      (window as Window & { __fieldCreationAbort?: { aborted: number } }).__fieldCreationAbort?.aborted ?? 0,
    )
    expect(aborted).toBe(1)
  } finally {
    await page.evaluate(() => {
      const state = (window as Window & { __fieldCreationAbort?: { original: PropertyDescriptor } }).__fieldCreationAbort
      if (!state) return
      Object.defineProperty(IDBObjectStore.prototype, 'put', state.original)
      delete (window as Window & { __fieldCreationAbort?: unknown }).__fieldCreationAbort
    })
  }

  const beforeRetry = await downloadJson(page, 'Export star system JSON')
  const beforeRetryFields = beforeRetry.objectFieldSettings.customFields.filter(field => field.name === 'Retry marker')
  expect(beforeRetryFields).toHaveLength(1)
  const fieldId = beforeRetryFields[0]!.id
  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Recovery details', exact: true }).click()
  const recovery = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await recovery.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Saved on this device')

  const afterRetry = await downloadJson(page, 'Export star system JSON')
  const afterRetryFields = afterRetry.objectFieldSettings.customFields.filter(field => field.name === 'Retry marker')
  expect(afterRetryFields).toHaveLength(1)
  expect(afterRetryFields[0]!.id).toBe(fieldId)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Open field definitions' })).toBeVisible()
  const afterReload = await downloadJson(page, 'Export star system JSON')
  const afterReloadFields = afterReload.objectFieldSettings.customFields.filter(field => field.name === 'Retry marker')
  expect(afterReloadFields).toHaveLength(1)
  expect(afterReloadFields[0]!.id).toBe(fieldId)
})

test('a type-change review names exact impacts and refreshes after Inspector resolution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()

  const hierarchyToggle = page.getByRole('button', { name: 'Hierarchy', exact: true })
  if (await hierarchyToggle.getAttribute('aria-expanded') !== 'true') await hierarchyToggle.click()
  const hierarchy = page.getByRole('dialog', { name: 'System hierarchy' })
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).click()
  const inspector = page.getByRole('dialog', { name: 'Object inspector' })
  await expect(inspector).toBeVisible()

  await inspector.getByRole('button', { name: 'Manage field definitions' }).click()
  const definitions = page.getByRole('dialog', { name: 'Field definitions' })
  await definitions.getByRole('button', { name: 'New custom field' }).click()
  await definitions.getByLabel('Custom field label').fill('Lifecycle note')
  await definitions.getByRole('button', { name: 'Add custom field' }).click()
  await expect(definitions.getByRole('heading', { name: 'Lifecycle note', exact: true })).toBeVisible()
  await definitions.getByRole('button', { name: 'Close field definitions' }).click()

  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Lifecycle note').fill('First')
  await inspector.getByRole('button', { name: 'Save map object' }).click()
  await inspector.getByRole('button', { name: 'Edit map object' }).click()
  await inspector.getByLabel('Lifecycle note').fill('Updated')
  await inspector.getByRole('button', { name: 'Manage field definitions' }).click()

  await definitions.getByRole('button', { name: 'Edit field definition' }).click()
  await selectInspectorOption(definitions.getByLabel('Value type'), 'Number')
  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  const review = definitions.getByRole('region', { name: 'Field change review' })
  await expect(review).toBeVisible()
  await expect(review).toContainText('text → number')
  await expect(review).toContainText('Primary Star / Vesper')
  await expect(review).toContainText('First')
  await expect(review).toContainText('Clear this value')

  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  const inspectorGuard = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(inspectorGuard).toBeVisible()
  await inspectorGuard.getByRole('button', { name: 'Apply and continue' }).click()
  await expect(inspectorGuard).toBeHidden()
  await expect(review).toContainText('Updated')
  await expect(review).not.toContainText('First')

  await definitions.getByRole('button', { name: 'Apply field changes' }).click()
  await expect(review).toBeHidden()
  await expect(definitions.getByRole('heading', { name: 'Lifecycle note', exact: true })).toBeVisible()
})
