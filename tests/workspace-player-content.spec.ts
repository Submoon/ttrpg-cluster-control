import { readFile } from 'node:fs/promises'
import { parsePlayerJson } from '../domain/workspace'
import { expect, test } from './fixtures'
import {
  addCatalogueObject,
  createSingleSystemWorkspace,
  editMapObject,
  openChartDetails,
  openPlayerPreview,
  openWorkspaceHierarchy,
  saveMapObject,
  selectDraftPublication,
  setHeaderMapActionsOpen,
  waitForWorkspaceSaved,
} from './helpers'

test('a Warden publishes committed Player text while keeping drafts and GM notes private', async ({ page }) => {
  test.setTimeout(45_000)
  const publicText = 'A sheltered landing basin.'
  const privateNotes = 'GM ONLY: smuggler entrance'
  const unappliedText = 'UNAPPLIED: secret tunnel'
  const { systemName } = await createSingleSystemWorkspace(page)
  await addCatalogueObject(page, 'planet')

  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await editMapObject(page)
  await inspector.getByLabel('Name', { exact: true }).fill('Pilgrim World')
  const playerText = inspector.getByLabel('Player text', { exact: true })
  await playerText.fill(publicText)
  await inspector.getByLabel('GM notes', { exact: true }).fill(privateNotes)
  await saveMapObject(page)
  await waitForWorkspaceSaved(page)

  const details = await openChartDetails(page)
  await details.getByRole('button', { name: 'Edit chart details', exact: true }).click()
  const editDetails = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
  await selectDraftPublication(editDetails, 'Revealed')
  await editDetails.getByRole('button', { name: 'Apply details', exact: true }).click()
  await expect(editDetails).toBeHidden()

  const hierarchy = await openWorkspaceHierarchy(page)
  const planet = hierarchy.getByRole('treeitem', { name: /Select .*Pilgrim World/ })
  await planet.click()
  await editMapObject(page)
  await playerText.fill(unappliedText)
  const menu = page.getByRole('menu', { name: 'Player visibility', exact: true })
  const publish = async () => {
    await planet.click({ button: 'right' })
    await menu.getByRole('menuitemcheckbox', { name: 'Revealed', exact: true }).click()
  }
  await publish()
  await editDetails.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(playerText).toHaveValue(unappliedText)
  await expect(planet).toHaveAttribute('aria-description', /Configured visibility: Known type/)
  await publish()
  await editDetails.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(planet).toHaveAttribute('aria-description', /Configured visibility: Revealed/)
  await waitForWorkspaceSaved(page)

  await editMapObject(page)
  await expect(inspector.getByLabel('GM notes', { exact: true })).toHaveValue(privateNotes)
  await playerText.fill(unappliedText)
  const preview = await openPlayerPreview(page)
  await preview.getByRole('button', { name: `Open ${systemName} system preview`, exact: true }).click()
  await preview.getByRole('button', { name: 'Filters', exact: true }).click()
  const previewFilters = page.getByRole('dialog', { name: /^Filters(?: \(1 active criterion\))?$/ })
  await previewFilters.getByRole('checkbox', { name: 'Planet', exact: true }).check()
  await expect(preview.getByRole('button', { name: 'Filters (1 active criterion)', exact: true })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Inspect Pilgrim World', exact: true }))
    .not.toHaveClass(/player-system-object-marker--dimmed/)
  await previewFilters.getByRole('button', { name: 'Close filters', exact: true }).click()
  await preview.getByRole('button', { name: 'Inspect Pilgrim World', exact: true })
    .locator('.player-system-object-hit-target').click()
  await expect(preview.getByRole('region', { name: 'Player object details' })).toContainText(publicText)
  await expect(preview).not.toContainText(privateNotes)
  await expect(preview).not.toContainText(unappliedText)
  await preview.getByRole('button', { name: 'Close player preview', exact: true }).click()

  const reopenedPreview = await openPlayerPreview(page)
  await reopenedPreview.getByRole('button', { name: `Open ${systemName} system preview`, exact: true }).click()
  await expect(reopenedPreview.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  await reopenedPreview.getByRole('button', { name: 'Close player preview', exact: true }).click()

  await setHeaderMapActionsOpen(page, true)
  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export player JSON', exact: true }).click()
  const path = await (await pendingDownload).path()
  if (!path) throw new Error('The player JSON download has no readable path.')
  const json = await readFile(path, 'utf8')
  const system = parsePlayerJson(json).systems.find(candidate => candidate.disclosure === 'revealed' && candidate.label === systemName)
  expect(system?.disclosure === 'revealed' ? system.map.objects : []).toContainEqual(expect.objectContaining({
    disclosure: 'revealed',
    label: 'Pilgrim World',
    playerText: publicText,
  }))
  expect(json).not.toContain(privateNotes)
  expect(json).not.toContain(unappliedText)
  await setHeaderMapActionsOpen(page, false)
  await expect(playerText).toHaveValue(unappliedText)
})
