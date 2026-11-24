import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  hideWorkspaceInspector,
  openChartDetailsEditor,
  waitForWorkspaceSaved,
  wardenMap,
  wardenSystemMark,
} from './helpers'

test('a retained chart draft becomes one action that can be undone and redone', async ({ page }) => {
  const { systemId } = await createSingleSystemWorkspace(page)
  const editor = await openChartDetailsEditor(page)
  const name = editor.getByLabel('Star system', { exact: true })
  await name.fill('Vesper Prime')
  await hideWorkspaceInspector(page)
  await openChartDetailsEditor(page)
  await expect(name).toHaveValue('Vesper Prime')
  await editor.getByRole('button', { name: 'Apply details', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await hideWorkspaceInspector(page)

  const map = wardenMap(page)
  const system = wardenSystemMark(page, systemId)
  await expect(system).toHaveAccessibleName('Select Vesper Prime')
  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await map.focus()
  await page.keyboard.press('Control+z')
  await waitForWorkspaceSaved(page)
  await expect(system).toHaveAccessibleName('Select Vesper')

  const history = page.getByRole('button', { name: 'History', exact: true })
  await history.click()
  const dialog = page.getByRole('dialog', { name: 'History', exact: true })
  await expect(dialog.getByRole('list', { name: 'Retained actions in chronological order' })).toContainText('Available through Redo')
  await expect(dialog.getByRole('status', { name: 'Current history position' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(history).toBeFocused()

  await page.getByRole('button', { name: /^Redo(?:\b|:)/ }).click()
  await waitForWorkspaceSaved(page)
  await expect(system).toHaveAccessibleName('Select Vesper Prime')
})
