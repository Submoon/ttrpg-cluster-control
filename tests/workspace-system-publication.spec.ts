import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster, updateChartDetails } from '../domain/workspace'
import {
  activeWorkspaceFeedback,
  addClusterSystem,
  addCatalogueObject,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  editMapObject,
  installWorkspaceWriteFailureGate,
  importReviewDialog,
  jsonMapImportInput,
  openChartDetails,
  readWorkspaceWriteFailureCount,
  restoreWorkspaceWriteFailureGate,
  returnToClusterMap,
  selectInspectorOption,
  saveMapObject,
  setWorkspaceMapMode,
  setHeaderMapActionsOpen,
  setJsonFile,
  resolveImportReview,
} from './helpers'

async function choosePublication(
  dialog: import('@playwright/test').Locator,
  label: 'Hidden' | 'Unknown presence' | 'Known type' | 'Revealed',
): Promise<void> {
  await selectInspectorOption(dialog.getByLabel('How players see this system'), label)
}

test('a Warden can publish a player title and open its cluster preview', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { clusterName: 'Private Reach', systemName: 'Private Vesper' })
  await addCatalogueObject(page, 'planet')
  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill('Private Object Marker')
  await objectInspector.getByLabel('Description', { exact: true }).fill('Private Source Note')
  const privateLocationKey = await objectInspector.getByLabel('Location key', { exact: true }).inputValue()
  await saveMapObject(page)
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)
  const source = await downloadJson(page, 'Export Jump Cluster JSON')
  const privateObjectId = source.cluster?.systems[0]?.objects[0]?.id
  expect(privateObjectId).toBeTruthy()
  if (!privateObjectId) throw new Error('The private object fixture needs a source ID.')

  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  const playerTitle = edit.getByLabel('Player-facing title')
  await expect(playerTitle).toBeVisible()
  await playerTitle.fill('Pilgrim Reach')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()
  await expect(details.getByRole('region', { name: 'Player publication settings' })).toContainText('Pilgrim Reach')

  await details.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await expect(preview).toContainText('Pilgrim Reach')
  await expect(preview).not.toContainText('Private Reach')
  await expect(preview).not.toContainText('Private Vesper')
  await expect(preview).toContainText('Star system')
  await expect(preview.getByRole('button', { name: 'Close player preview' })).toBeVisible()
  await expect(preview.getByRole('link')).toHaveCount(0)
  await expect(preview.getByRole('button', { name: /export|download/i })).toHaveCount(0)
  const previewDom = await preview.evaluate(element => element.outerHTML)
  for (const privateMarker of ['Private Reach', 'Private Vesper', 'Private Object Marker', 'Private Source Note', privateLocationKey, privateObjectId]) {
    expect(previewDom).not.toContain(privateMarker)
  }
  await expect(preview).not.toContainText('Map objects')
  await expect(preview).not.toContainText('Jump Routes')
  await expect(preview).not.toContainText('Fields')
  const previewTrigger = details.getByRole('button', { name: 'Preview player view' })
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await expect(previewTrigger).toBeFocused()
})

test('desktop and compact previews render only the label allowed by each publication mode', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page, {
    clusterName: 'Private Reach',
    systemName: 'Private Vesper',
    viewport: { width: 1440, height: 960 },
  })
  const details = await openChartDetails(page)
  const savedPublication = details.getByRole('region', { name: 'Player publication settings' })
  await expect(savedPublication).toContainText('Player Jump Cluster')
  await expect(savedPublication).toContainText('Known type: Star system')
  const expectedLabels = new Map([
    ['unknown', 'Unknown presence'],
    ['known-type', 'Star system'],
    ['revealed', 'Private Vesper'],
  ] as const)

  for (const mode of ['unknown', 'known-type', 'revealed', 'hidden'] as const) {
    await details.getByRole('button', { name: 'Edit chart details' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit chart details' })
    const optionLabel = mode === 'unknown' ? 'Unknown presence'
      : mode === 'known-type' ? 'Known type'
        : mode === 'revealed' ? 'Revealed'
          : 'Hidden'
    await choosePublication(edit, optionLabel)
    await edit.getByRole('button', { name: 'Apply details' }).click()
    await expect(edit).toBeHidden()
    await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
    const expectedSummary = mode === 'unknown' ? 'Unknown presence'
      : mode === 'known-type' ? 'Known type: Star system'
        : mode === 'revealed' ? 'Revealed: system name visible'
          : 'Hidden'
    await expect(savedPublication).toContainText(expectedSummary)

    const trigger = details.getByRole('button', { name: 'Preview player view' })
    await trigger.click()
    const preview = page.getByRole('dialog', { name: 'Player view preview' })
    await expect(preview).toContainText('Player Jump Cluster')
    if (mode === 'hidden') {
      await expect(preview).toContainText('No star systems are visible to players.')
      await expect(preview.getByRole('list', { name: 'Visible marker labels' })).toHaveCount(0)
    } else {
      const expected = expectedLabels.get(mode)
      if (!expected) throw new Error(`No expected label is defined for ${mode}.`)
      await expect(preview.getByRole('list', { name: 'Visible marker labels' })).toHaveText(expected)
      if (mode === 'revealed') await expect(preview).toContainText('Private Vesper')
      else await expect(preview).not.toContainText('Private Vesper')
      if (mode === 'unknown') {
        await expect(preview).not.toContainText('Star system')
        const exposedMapContent = await preview.locator('.player-cluster-map').evaluate(element => {
          const nodes = [element, ...element.querySelectorAll('*')]
          const ariaAttributes = nodes.flatMap(node => Array.from(node.attributes)
            .filter(attribute => attribute.name.startsWith('aria-'))
            .map(attribute => `${attribute.name}=${attribute.value}`))
          return [...ariaAttributes, element.textContent ?? ''].join('\n')
        })
        expect(exposedMapContent).not.toMatch(/star\s+systems?/i)
      }
    }
    await expect(preview).not.toContainText('Private Reach')
    if (mode === 'unknown') {
      const screenshotPath = testInfo.outputPath('desktop-player-preview-unknown.png')
      await page.screenshot({ path: screenshotPath, animations: 'disabled' })
      await testInfo.attach('desktop-player-preview-unknown', {
        path: screenshotPath,
        contentType: 'image/png',
      })
    }
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()
    await expect(trigger).toBeFocused()
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const compactDetails = await openChartDetails(page)
  await compactDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const compactEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await choosePublication(compactEdit, 'Unknown presence')
  await compactEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(compactEdit).toBeHidden()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const compactTrigger = compactDetails.getByRole('button', { name: 'Preview player view' })
  await compactTrigger.click()
  const compactPreview = page.getByRole('dialog', { name: 'Player view preview' })
  await expect(compactPreview).toContainText('Player Jump Cluster')
  await expect(compactPreview.getByRole('list', { name: 'Visible marker labels' })).toHaveText('Unknown presence')
  const compactScreenshotPath = testInfo.outputPath('compact-player-preview-unknown.png')
  await page.screenshot({ path: compactScreenshotPath, animations: 'disabled' })
  await testInfo.attach('compact-player-preview-unknown', {
    path: compactScreenshotPath,
    contentType: 'image/png',
  })
  await page.keyboard.press('Escape')
  await expect(compactPreview).toBeHidden()
  await expect(compactTrigger).toBeFocused()
})

test('publication-only chart details stay resumable, honor Stay and Discard, and remain clean in history', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { clusterName: 'Private Reach', systemName: 'Private Vesper' })
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await edit.getByLabel('Player-facing title').fill('Uncommitted Reach')
  await choosePublication(edit, 'Hidden')
  await edit.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(edit).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByText('Unapplied chart details')).toBeVisible()

  await activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart details draft' }).click()
  await expect(edit.getByLabel('Player-facing title')).toHaveValue('Uncommitted Reach')
  await expect(edit.getByLabel('How players see this system')).toContainText('Hidden')
  await edit.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await expect(edit.getByRole('button', { name: 'Stay here' })).toBeVisible()
  await edit.getByRole('button', { name: 'Stay here' }).click()
  await expect(edit.getByLabel('Player-facing title')).toHaveValue('Uncommitted Reach')
  await expect(edit.getByLabel('How players see this system')).toContainText('Hidden')
  await edit.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Private Vesper' })).toBeVisible()

  await page.getByRole('button', { name: 'Back to Jump Cluster' }).click()
  await expect(edit.getByRole('button', { name: 'Discard and continue' })).toBeVisible()
  await edit.getByRole('button', { name: 'Discard and continue' }).click()
  await expect(edit).toBeHidden()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  const history = page.getByRole('group', { name: 'Edit history' })
  await expect(history.getByRole('button', { name: /^Undo(?:\b|:)/ })).toBeDisabled()

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Player Jump Cluster')
  expect(exported.cluster?.systems[0]?.publication).toBe('known-type')
})

test('applying title and publication drafts uses history, survives reload and supports Undo and Redo', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { clusterName: 'Private Reach', systemName: 'Private Vesper' })
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await edit.getByLabel('Player-facing title').fill('Pilgrim Reach')
  await choosePublication(edit, 'Revealed')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)

  let exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Pilgrim Reach')
  expect(exported.cluster?.systems[0]?.publication).toBe('revealed')
  const undo = page.getByRole('group', { name: 'Edit history' }).getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toHaveAccessibleName(/Update player-facing chart details/)

  await undo.click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)
  exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Player Jump Cluster')
  expect(exported.cluster?.systems[0]?.publication).toBe('known-type')

  const redo = page.getByRole('group', { name: 'Edit history' }).getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)
  exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Pilgrim Reach')
  expect(exported.cluster?.systems[0]?.publication).toBe('revealed')

  await page.reload()
  await returnToClusterMap(page)
  exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Pilgrim Reach')
  expect(exported.cluster?.systems[0]?.publication).toBe('revealed')
})

test('editing an inspected system keeps its publication target when another system is active', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { clusterName: 'Private Reach', systemName: 'Private Vesper' })
  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: /Jump Cluster map$/ })
  await addClusterSystem(page, { open: false, position: { x: 0.75, y: 0.75 } })
  await setWorkspaceMapMode(page, 'Select')
  await clusterMap.getByRole('button', { name: 'Select New System 2 system' }).click()
  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await expect(inspector.getByRole('heading', { name: 'New System 2' })).toBeVisible()

  const previewTrigger = inspector.getByRole('button', { name: 'Preview player view' })
  await previewTrigger.click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Player Jump Cluster')
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await expect(previewTrigger).toBeFocused()
  await expect(inspector.getByRole('heading', { name: 'New System 2' })).toBeVisible()

  await inspector.getByRole('button', { name: 'Edit chart details' }).click()

  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await expect(edit.getByLabel('Star system')).toHaveValue('New System 2')
  await choosePublication(edit, 'Revealed')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Map context and commands' })
    .getByRole('heading', { name: 'Private Reach' })).toBeVisible()

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.systems.map(system => [system.name, system.publication])).toEqual([
    ['Private Vesper', 'known-type'],
    ['New System 2', 'revealed'],
  ])
})

test('a failed chart-details save retains the applied memory and Retry adds no history action', async ({ page }) => {
  await createSingleSystemWorkspace(page, { clusterName: 'Private Reach', systemName: 'Private Vesper' })
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await installWorkspaceWriteFailureGate(page)
  try {
    await edit.getByLabel('Player-facing title').fill('Saved After Retry')
    await edit.getByRole('button', { name: 'Apply details' }).click()
    await expect(edit).toBeHidden()
    const feedback = activeWorkspaceFeedback(page)
    await expect(feedback.locator('.save-feedback')).toContainText('Not saved.')
    await expect(feedback.getByRole('button', { name: 'Retry save' })).toBeVisible()

    const previewTrigger = details.getByRole('button', { name: 'Preview player view' })
    await previewTrigger.click()
    const preview = page.getByRole('dialog', { name: 'Player view preview' })
    await expect(preview).toContainText('Saved After Retry')
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()

    await feedback.getByRole('button', { name: 'Retry save' }).click()
    await expect(feedback.locator('.save-feedback')).toHaveText('Saved on this device')
    expect(await readWorkspaceWriteFailureCount(page)).toBe(2)
    const undo = page.getByRole('group', { name: 'Edit history' }).getByRole('button', { name: /^Undo(?:\b|:)/ })
    await expect(undo).toHaveAccessibleName(/Update player-facing chart details/)
    await expect(undo).toContainText('1')
  } finally {
    await restoreWorkspaceWriteFailureGate(page)
  }
})

test('public v3 JSON import preserves source publication and the destination player title through Undo and Redo', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page, { clusterName: 'Destination Private Reach', systemName: 'Vesper' })
  const destinationDetails = await openChartDetails(page)
  await destinationDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await edit.getByLabel('Player-facing title').fill('Destination Public Title')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  await returnToClusterMap(page)

  const sourceWorkspace = createLocalWorkspace('Source Private Reach', 'Source Private System')
  const sourceSystem = sourceWorkspace.cluster.systems[0]
  if (!sourceSystem) throw new Error('The source fixture needs its first star system.')
  const sourceWithPublication = updateChartDetails(sourceWorkspace, sourceSystem.id, {
    clusterName: sourceWorkspace.cluster.name,
    systemName: sourceSystem.name,
    playerTitle: 'Source Public Title',
    publication: 'revealed',
  })
  const incomingJson = JSON.stringify(exportJumpCluster(sourceWithPublication))

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy' }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'publication-source.json', incomingJson)
  const review = importReviewDialog(page)
  await expect(review).toContainText('Star systems: 1')
  await resolveImportReview(review, 'confirm')
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')

  let exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Destination Public Title')
  expect(exported.cluster?.systems.map(system => [system.name, system.publication])).toEqual([
    ['Vesper', 'known-type'],
    ['Source Private System', 'revealed'],
  ])

  const history = page.getByRole('group', { name: 'Edit history' })
  const undo = history.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toHaveAccessibleName(/Import/)
  await undo.click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Destination Public Title')
  expect(exported.cluster?.systems.map(system => [system.name, system.publication])).toEqual([
    ['Vesper', 'known-type'],
  ])

  const redo = history.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toHaveText('Saved on this device')
  exported = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(exported.cluster?.playerTitle).toBe('Destination Public Title')
  expect(exported.cluster?.systems[1]?.publication).toBe('revealed')
})

test('80-character revealed public labels fit within the rendered SVG viewBox', async ({ page }) => {
  const wideSystemName = 'W'.repeat(80)
  await createSingleSystemWorkspace(page, { clusterName: 'Wide Public Reach', systemName: wideSystemName })
  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit chart details' })
  await choosePublication(edit, 'Revealed')
  await edit.getByRole('button', { name: 'Apply details' }).click()
  await expect(edit).toBeHidden()

  await details.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  const label = preview.locator('.player-cluster-map-marker--revealed text')
  await expect(label).toBeVisible()
  const bounds = await label.evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement) || !element.ownerSVGElement) {
      throw new Error('The revealed public label must belong to a rendered SVG scene.')
    }
    const box = element.getBBox()
    const viewBox = element.ownerSVGElement.viewBox.baseVal
    return {
      left: box.x,
      right: box.x + box.width,
      top: box.y,
      bottom: box.y + box.height,
      viewLeft: viewBox.x,
      viewRight: viewBox.x + viewBox.width,
      viewTop: viewBox.y,
      viewBottom: viewBox.y + viewBox.height,
    }
  })
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.viewLeft)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewRight)
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.viewTop)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewBottom)
})
