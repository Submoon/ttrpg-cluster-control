import { readFile } from 'node:fs/promises'
import { parsePlayerJson } from '../domain/workspace'
import { expect, test } from './fixtures'
import {
  editMapObject,
  openChartDetailsEditor,
  openMapFilesSection,
  openPlayerPreview,
  openWorkspaceHierarchy,
  saveMapObject,
  selectDraftPublication,
  waitForWorkspaceSaved,
  wardenMap,
} from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

test('published player content opens in a separate browser context and survives reload @preview-smoke', async ({
  page, browser, previewCookies,
}) => {
  const publicText = 'A sheltered landing basin.'
  const privateNotes = 'GM ONLY: smuggler entrance'
  const publicTitle = 'Survey chart'
  await importCampaignWorkspace(page, undefined, { width: 1440, height: 900 })
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('treeitem', { name: 'Vesper Prime', exact: true }).click()

  const chart = await openChartDetailsEditor(page)
  await chart.getByLabel('Player-facing title', { exact: true }).fill(publicTitle)
  await selectDraftPublication(chart, 'Revealed')
  await chart.getByRole('button', { name: 'Apply details', exact: true }).click()

  await hierarchy.getByRole('treeitem', { name: /Select PL-01, Iria in Vesper Prime/ }).click()
  await page.getByRole('button', { name: 'Center selected target', exact: true }).click()
  const map = wardenMap(page)
  const objectMark = map.getByRole('button', { name: 'Select PL-01, Iria', exact: true })
  await expect(objectMark).toBeVisible()
  const badgeIdentity = `object-${await objectMark.getAttribute('data-system-id')}-${await objectMark.getAttribute('data-object-id')}`
  const badge = map.locator(`[data-publication-identity="${badgeIdentity}"]`)
  await expect(badge).toBeInViewport()
  await expect(badge).toHaveCSS('pointer-events', 'none')
  const previousGlyph = await badge.locator('.gm-publication-badge-icon').innerHTML()
  await editMapObject(page)
  const inspector = page.getByRole('region', { name: 'Object inspector', exact: true })
  await inspector.getByLabel('Player text', { exact: true }).fill(publicText)
  await inspector.getByLabel('GM notes', { exact: true }).fill(privateNotes)
  const visibility = inspector.getByRole('group', { name: 'Draft visibility', exact: true })
  const knownType = visibility.getByRole('button', { name: 'Set visibility to Known type', exact: true })
  await expect(visibility.locator('button[title]')).toHaveCount(0)
  await knownType.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Known type')
  await selectDraftPublication(inspector, 'Revealed')
  await expect(visibility).toHaveAccessibleDescription('Revealed. Players see its name and type.')
  await expect(inspector.getByText('Revealed. Players see its name and type.', { exact: true })).toBeVisible()
  await saveMapObject(page)
  await expect(badge).toBeVisible()
  await expect(badge.locator('.gm-publication-badge-icon')).not.toHaveJSProperty('innerHTML', previousGlyph)

  await hierarchy.getByRole('treeitem', { name: /^Select Jump Level 1:/ }).click()
  await page.getByRole('button', { name: 'Set Jump Route visibility to Shared', exact: true }).click()
  await waitForWorkspaceSaved(page)

  const preview = await openPlayerPreview(page)
  const previewMap = preview.getByRole('region', { name: 'Player-visible continuous map', exact: true })
  await expect(previewMap.locator('[data-gm-publication-admin]')).toHaveCount(0)
  await expect(previewMap.getByRole('button', { name: /Jump Level 1 from/ })).toBeVisible()
  await previewMap.locator('.player-continuous-name-target')
    .and(previewMap.getByRole('button', { name: 'Inspect Vesper Prime', exact: true })).press('Enter')
  await previewMap.getByRole('button', { name: 'Center selection', exact: true }).click()
  await previewMap.getByRole('button', { name: 'Inspect Iria', exact: true }).press('Enter')
  const publicInspector = preview.getByRole('region', { name: 'Player object details', exact: true })
  await expect(publicInspector).toContainText(publicText)
  await expect(publicInspector).not.toContainText(privateNotes)
  await preview.getByRole('button', { name: 'Close player preview', exact: true }).click()

  const share = await openMapFilesSection(page, 'Share with players')
  const pending = page.waitForEvent('download')
  await share.getByRole('menuitem', { name: 'Export player JSON', exact: true }).click()
  const json = await readFile(await (await pending).path(), 'utf8')
  const document = parsePlayerJson(json)
  expect(document.routes).toHaveLength(1)
  expect(json).toContain(publicText)
  expect(json).not.toContain(privateNotes)

  const links = await openMapFilesSection(page, 'Share with players', 'keyboard')
  await links.getByRole('menuitem', { name: 'Generate player link', exact: true }).press('Enter')
  const link = page.getByRole('dialog', { name: 'Player snapshot link', exact: true }).getByRole('textbox')
  await expect(link).toHaveValue(/\/player#player=/)
  const url = await link.inputValue()

  const context = await browser.newContext()
  try {
    if (previewCookies.length) await context.addCookies(previewCookies)
    const player = await context.newPage()
    await player.goto(url)
    await expect(player.getByRole('heading', { name: publicTitle, exact: true })).toBeVisible()
    await player.reload()
    const map = player.getByRole('region', { name: 'Player-visible continuous map', exact: true })
    await expect(map.locator('.player-continuous-name-target')
      .and(map.getByRole('button', { name: 'Inspect Vesper Prime', exact: true }))).toBeVisible()
    await expect(map.getByRole('button', { name: /Jump Level 1 from/ })).toBeVisible()
  } finally {
    await context.close()
  }
})
