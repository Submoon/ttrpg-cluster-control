import { expect, test, type Page } from './fixtures'
import entitySessionFixture from './fixtures/workspace-entity-sessions.json' with { type: 'json' }
import { resolveImportReview, reviewStarSystemImport, waitForWorkspaceSaved } from './helpers'
import {
  captureMapExportBlobs,
  centerWorkspaceSelection,
  downloadJson,
  openWorkspaceHierarchy,
  setHeaderMapActionsOpen,
  wardenMap,
} from './helpers'

async function openSessionLab(page: Page): Promise<{
  hierarchy: Awaited<ReturnType<typeof openWorkspaceHierarchy>>
  map: import('@playwright/test').Locator
  systemId: string
  inspector: import('@playwright/test').Locator
}> {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  const importPreview = await reviewStarSystemImport(page, 'entity-session-lab.json', JSON.stringify(entitySessionFixture))
  const importSummary = await importPreview.innerText()
  expect(importSummary).toContain('Star systems: 1')
  await resolveImportReview(importPreview, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const backup = await downloadJson(page, 'Export Jump Cluster JSON')
  const system = backup.cluster?.systems.find(system => system.name === 'Session Lab')
  if (!system) throw new Error('The reviewed import did not add Session Lab.')
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Inspect Session Lab', exact: true }).click()
  await centerWorkspaceSelection(page)
  return {
    hierarchy,
    map: wardenMap(page).locator(`.continuous-warden-system[data-system-id="${system.id}"]`),
    systemId: system.id,
    inspector: page.getByRole('complementary', { name: 'Object inspector', exact: true }),
  }
}

test('object transitions keep Stay, Apply and Discard distinct, while a clean edit leaves directly', async ({ page }) => {
  const { hierarchy, inspector, map, systemId } = await openSessionLab(page)
  const iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Applied Iria in Session Lab', exact: true })
  const previewMarker = (name: string) => map.getByRole('button', { name: `Select PL-01, ${name}`, exact: true })
  const nix = hierarchy.getByRole('treeitem', { name: 'Select MO-01, Nix in Session Lab', exact: true })
  await hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria in Session Lab', exact: true }).click()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Applied Iria')
  await expect(previewMarker('Applied Iria')).toBeVisible()
  await expect(iria).toBeVisible()

  await nix.click()
  let guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Applied Iria')

  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-selected', 'true')
  await waitForWorkspaceSaved(page)

  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await iria.click()
  await expect(page.getByRole('dialog', { name: 'Edit Jump Cluster details' })).toHaveCount(0)
  await expect(iria).toHaveAttribute('aria-selected', 'true')
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Discarded Iria draft')
  await expect(previewMarker('Discarded Iria draft')).toBeVisible()
  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-selected', 'true')
  await expect(previewMarker('Applied Iria')).toBeVisible()

  const exported = await downloadJson(page, 'Export Jump Cluster JSON')
  const appliedNames = exported.cluster?.systems.find(system => system.id === systemId)?.objects.map(object => object.name)
  expect(appliedNames).toContain('Applied Iria')
  expect(appliedNames).toContain('Nix')
  expect(appliedNames).not.toContain('Discarded Iria draft')
})
