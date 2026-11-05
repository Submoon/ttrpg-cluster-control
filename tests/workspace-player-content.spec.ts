import { expect, test } from './fixtures'
import {
  waitForWorkspaceSaved,
  addCustomFieldThroughDialog,
  addCatalogueObject,
  createSingleSystemWorkspace,
  editFieldDefinition,
  editMapObject,
  openChartDetails,
  openFieldDefinitionDialog,
  saveMapObject,
  selectDraftPublication,
  selectInspectorOption,
} from './helpers'

test('a Warden can edit Player text separately from GM notes and preview only the public text', async ({ page }, testInfo) => {
  const playerTextValue = 'A quiet sanctuary rests beneath the violet sky, where hidden gardens bloom through the long winter.'
  const gmNotesValue = 'GM ONLY: the sanctuary conceals a smuggler entrance.'
  const { systemName } = await createSingleSystemWorkspace(page, {
    clusterName: 'Private Reach',
    systemName: 'Private Vesper',
  })
  await addCatalogueObject(page, 'planet')

  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill('Pilgrim World')
  const playerText = objectInspector.getByLabel('Player text', { exact: true })
  await expect(playerText).toBeVisible({ timeout: 5_000 })
  await playerText.fill(playerTextValue)
  await objectInspector.getByLabel('GM notes', { exact: true }).fill(gmNotesValue)
  await selectDraftPublication(objectInspector, 'Revealed')
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectDraftPublication(chartEdit, 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()

  await chartDetails.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: `Open ${systemName} system preview` }).click()
  const playerView = preview.getByRole('region', { name: 'Warden-side player preview', exact: true })
  const systemPreview = playerView.getByRole('region', { name: 'Player-visible system map' })
  await systemPreview.getByRole('button', { name: 'Inspect Pilgrim World' }).click()

  const publicDetails = playerView.getByRole('region', { name: 'Player object details' })
  await expect(publicDetails).toContainText(playerTextValue)
  await expect(preview).not.toContainText(gmNotesValue)
  await page.screenshot({ path: testInfo.outputPath('player-prose-preview-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(publicDetails).toBeVisible()
  await publicDetails.scrollIntoViewIfNeeded()
  await expect(publicDetails).toBeInViewport()
  await expect(publicDetails).toContainText(playerTextValue)
  await expect(preview).not.toContainText(gmNotesValue)
  await page.screenshot({ path: testInfo.outputPath('player-prose-preview-compact.png'), fullPage: true })

  const closePreview = preview.getByRole('button', { name: 'Close player preview', exact: true })
  await expect(closePreview).toBeInViewport()
  await closePreview.click()
  await expect(preview).toBeHidden()
})

test('shared native and custom Fields preview permitted values and respect an object mask', async ({ page }, testInfo) => {
  const { systemName } = await createSingleSystemWorkspace(page, {
    clusterName: 'Private Reach',
    systemName: 'Private Vesper',
  })
  await addCatalogueObject(page, 'planet')

  const objectInspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await objectInspector.getByLabel('Name', { exact: true }).fill('Pilgrim World')
  await selectDraftPublication(objectInspector, 'Revealed')
  await saveMapObject(page)

  await addCustomFieldThroughDialog(page, 'Faction', 'single-select', 'Merchants\nCult')

  const atmosphereDialog = await openFieldDefinitionDialog(page)
  await atmosphereDialog.getByRole('button', { name: /Atmosphere/ }).click()
  await editFieldDefinition(atmosphereDialog)
  const atmosphereSharing = atmosphereDialog.getByRole('checkbox', { name: /^Share with players$/i })
  await expect(atmosphereSharing).toBeVisible({ timeout: 5_000 })
  await atmosphereSharing.check()
  await atmosphereDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await atmosphereDialog.getByRole('button', { name: 'Close field definitions' }).click()

  const factionDialog = await openFieldDefinitionDialog(page)
  await factionDialog.getByRole('button', { name: /Faction/ }).click()
  await editFieldDefinition(factionDialog)
  const factionSharing = factionDialog.getByRole('checkbox', { name: /^Share with players$/i })
  await expect(factionSharing).toBeVisible({ timeout: 5_000 })
  await factionSharing.check()
  await factionDialog.getByRole('button', { name: 'Apply field changes' }).click()
  await factionDialog.getByRole('button', { name: 'Close field definitions' }).click()

  await editMapObject(page)
  await selectInspectorOption(objectInspector.getByLabel('Atmosphere', { exact: true }), 'Breathable')
  await selectInspectorOption(objectInspector.getByLabel('Faction', { exact: true }), 'Merchants')
  const hideAtmosphere = objectInspector.getByRole('region', { name: 'Catalogue fields' })
    .getByRole('checkbox', { name: /^Hide this value from players$/i })
  await expect(hideAtmosphere).toBeVisible({ timeout: 5_000 })
  const atmosphereValue = objectInspector.getByLabel('Atmosphere', { exact: true })
  await expect(atmosphereValue).toHaveCount(1)
  expect(await hideAtmosphere.getAttribute('id')).not.toBe(await atmosphereValue.getAttribute('id'))
  await hideAtmosphere.check()
  await saveMapObject(page)

  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  const chartDetails = await openChartDetails(page)
  await chartDetails.getByRole('button', { name: 'Edit chart details' }).click()
  const chartEdit = page.getByRole('dialog', { name: 'Edit chart details' })
  await selectDraftPublication(chartEdit, 'Revealed')
  await chartEdit.getByRole('button', { name: 'Apply details' }).click()
  await expect(chartEdit).toBeHidden()

  await chartDetails.getByRole('button', { name: 'Preview player view' }).click()
  const preview = page.getByRole('dialog', { name: 'Player view preview' })
  await preview.getByRole('button', { name: `Open ${systemName} system preview` }).click()
  const playerView = preview.getByRole('region', { name: 'Warden-side player preview', exact: true })
  const systemPreview = playerView.getByRole('region', { name: 'Player-visible system map' })
  await systemPreview.getByRole('button', { name: 'Inspect Pilgrim World' }).click()

  const publicDetails = playerView.getByRole('region', { name: 'Player object details' })
  await expect(publicDetails).toContainText('Faction')
  await expect(publicDetails).toContainText('Merchants')
  await expect(publicDetails).not.toContainText('Cult')
  await expect(publicDetails).not.toContainText('Atmosphere')
  await expect(publicDetails).not.toContainText('Breathable')
  await expect(preview).not.toContainText('Cult')
  await expect(preview).not.toContainText('Atmosphere')
  await expect(preview).not.toContainText('Breathable')
  const accessibleDetails = await publicDetails.ariaSnapshot()
  expect(accessibleDetails).toContain('Faction')
  expect(accessibleDetails).toContain('Merchants')
  expect(accessibleDetails).not.toContain('Cult')
  expect(accessibleDetails).not.toContain('Atmosphere')
  expect(accessibleDetails).not.toContain('Breathable')
  await publicDetails.scrollIntoViewIfNeeded()
  await expect(publicDetails).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('field-public-details-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await publicDetails.scrollIntoViewIfNeeded()
  await expect(publicDetails).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('field-public-details-compact.png'), fullPage: true })
})
