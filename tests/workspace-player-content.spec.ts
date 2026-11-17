import { readFile } from 'node:fs/promises'
import { parsePlayerJson } from '../domain/workspace'
import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  createSingleSystemWorkspace,
  editMapObject,
  openChartDetailsEditor,
  openMapFilesSection,
  openPlayerPreview,
  openWorkspaceHierarchy,
  saveMapObject,
  selectDraftPublication,
  setHeaderMapActionsOpen,
  waitForWorkspaceSaved,
} from './helpers'

test('a Warden shares applied player text and marker color while keeping drafts and GM notes private', async ({ page, context }) => {
  test.setTimeout(45_000)
  const publicText = 'A sheltered landing basin.'
  const privateNotes = 'GM ONLY: smuggler entrance'
  const unappliedText = 'UNAPPLIED: secret tunnel'
  const markerColor = '#a151bf'
  const markerFill = 'rgb(161, 81, 191)'
  const { systemName } = await createSingleSystemWorkspace(page)
  await addCatalogueObject(page, 'planet')

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await inspector.getByLabel('Name', { exact: true }).fill('Pilgrim World')
  const playerText = inspector.getByLabel('Player text', { exact: true })
  await playerText.fill(publicText)
  await inspector.getByLabel('GM notes', { exact: true }).fill(privateNotes)
  const colorButton = inspector.getByRole('button', { name: /^Marker color:/ })
  await colorButton.click()
  const hexColor = inspector.getByLabel('Hex color', { exact: true })
  await hexColor.fill(markerColor)
  await expect(colorButton).toHaveAccessibleName(`Marker color: ${markerColor}`)
  await page.keyboard.press('Escape')
  await expect(colorButton).toBeFocused()
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const chartEditor = await openChartDetailsEditor(page)
  await selectDraftPublication(chartEditor, 'Revealed')
  await chartEditor.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(chartEditor).toBeHidden()

  const hierarchy = await openWorkspaceHierarchy(page)
  const planet = hierarchy.getByRole('treeitem', { name: /Select .*Pilgrim World/ })
  await planet.click()
  await editMapObject(page)
  await playerText.fill(unappliedText)
  const menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  const publishButton = planet.getByRole('button', { name: 'Change visibility for Pilgrim World', exact: true })
  const publish = async () => {
    await publishButton.click()
    await menu.getByRole('menuitem', { name: 'Change Visibility', exact: true }).hover()
    const revealAction = page.getByRole('menu', { name: 'Change Visibility', exact: true })
      .getByRole('menuitemcheckbox', { name: 'Revealed', exact: true })
    await expect(revealAction).toBeVisible()
    await revealAction.click()
  }
  const guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await publish()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(playerText).toHaveValue(unappliedText)
  await expect(planet).toHaveAttribute('aria-description', /Configured visibility: Known type/)
  await publish()
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(planet).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await waitForWorkspaceSaved(page)

  await editMapObject(page)
  await expect(inspector.getByLabel('GM notes', { exact: true })).toHaveValue(privateNotes)
  await playerText.fill(unappliedText)
  await colorButton.click()
  await hexColor.fill('#22664c')
  await page.keyboard.press('Escape')
  await expect(colorButton).toHaveAccessibleName('Marker color: #22664c')
  const preview = await openPlayerPreview(page)
  await preview.getByRole('button', { name: `Open ${systemName} system preview`, exact: true }).click()
  const previewMarker = preview.getByRole('button', { name: 'Inspect Pilgrim World', exact: true })
  const previewGlyph = previewMarker.locator('.player-system-object-glyph')
  await expect(previewGlyph).toHaveCSS('fill', markerFill)
  await preview.getByRole('button', { name: 'Filters', exact: true }).click()
  const previewFilters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await previewFilters.getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await expect(preview.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })).toBeVisible()
  await expect(previewMarker).not.toHaveClass(/player-system-object-marker--dimmed/)
  await previewFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await previewMarker.locator('.player-system-object-hit-target').click()
  await expect(previewGlyph).toHaveCSS('fill', markerFill)
  await expect(preview.getByRole('region', { name: 'Player object details' })).toContainText(publicText)
  await expect(preview).not.toContainText(privateNotes)
  await expect(preview).not.toContainText(unappliedText)
  await preview.getByRole('button', { name: 'Close player preview', exact: true }).click()

  const reopenedPreview = await openPlayerPreview(page)
  await reopenedPreview.getByRole('button', { name: `Open ${systemName} system preview`, exact: true }).click()
  await expect(reopenedPreview.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  await reopenedPreview.getByRole('button', { name: 'Close player preview', exact: true }).click()

  const shareActions = await openMapFilesSection(page, 'Share with players')
  const pendingDownload = page.waitForEvent('download')
  await shareActions.getByRole('menuitem', { name: 'Export player JSON', exact: true }).click()
  const path = await (await pendingDownload).path()
  if (!path) throw new Error('The player JSON download has no readable path.')
  const json = await readFile(path, 'utf8')
  const system = parsePlayerJson(json).systems.find(candidate => candidate.disclosure === 'revealed' && candidate.label === systemName)
  expect(system?.disclosure === 'revealed' ? system.map.objects : []).toContainEqual(expect.objectContaining({
    disclosure: 'revealed',
    label: 'Pilgrim World',
    playerText: publicText,
    markerColor,
  }))
  expect(json).not.toContain(privateNotes)
  expect(json).not.toContain(unappliedText)

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const generate = (await openMapFilesSection(page, 'Share with players', 'keyboard'))
    .getByRole('menuitem', { name: 'Generate player link', exact: true })
  await generate.press('Enter')
  const linkDialog = page.getByRole('dialog', { name: 'Player snapshot link', exact: true })
  const linkField = linkDialog.getByRole('textbox')
  await expect(linkField).toHaveValue(/\/player#player=1\.gzip\./)
  const url = await linkField.inputValue()
  await linkDialog.getByRole('button', { name: 'Copy player link', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url)
  await page.keyboard.press('Escape')
  await expect(linkDialog).toBeHidden()
  await expect(generate).toBeFocused()
  const view = shareActions.getByRole('menuitem', { name: 'View generated link', exact: true })
  await view.press('Enter')
  await expect(linkField).toHaveValue(url)
  await page.keyboard.press('Escape')
  await expect(view).toBeFocused()
  await setHeaderMapActionsOpen(page, false)
  await expect(playerText).toHaveValue(unappliedText)
  await expect(colorButton).toHaveAccessibleName('Marker color: #22664c')
})
