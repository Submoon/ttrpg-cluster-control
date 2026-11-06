import { expect, test, type Page } from './fixtures'
import entitySessionFixture from './fixtures/workspace-entity-sessions.json' with { type: 'json' }
import { importReviewDialog, resolveImportReview, waitForWorkspaceSaved } from './helpers'
import {
  captureMapExportBlobs,
  downloadJson,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
} from './helpers'

async function openSessionLab(page: Page): Promise<{
  hierarchy: Awaited<ReturnType<typeof openWorkspaceHierarchy>>
  map: import('@playwright/test').Locator
  inspector: import('@playwright/test').Locator
}> {
  await captureMapExportBlobs(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  await setJsonFile(jsonMapImportInput(page), 'entity-session-lab.json', JSON.stringify(entitySessionFixture))
  const importPreview = importReviewDialog(page)
  const importSummary = await importPreview.innerText()
  expect(importSummary).toContain('Star systems: 1')
  await resolveImportReview(importPreview, 'confirm')
  await setHeaderMapActionsOpen(page, false)

  const clusterHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const system = clusterHierarchy.getByRole('button', { name: 'Open Session Lab system map', exact: true })
  await expect(system).toBeVisible()
  await system.click()

  const hierarchy = await openWorkspaceHierarchy(page, 'System hierarchy')
  return {
    hierarchy,
    map: page.getByRole('group', { name: 'Session Lab star system map', exact: true }),
    inspector: page.getByRole('complementary', { name: 'Object inspector', exact: true }),
  }
}

test('object transitions keep Stay, Apply and Discard distinct, while a clean edit leaves directly', async ({ page }) => {
  const { hierarchy, inspector } = await openSessionLab(page)
  let iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria', exact: true })
  const nix = hierarchy.getByRole('treeitem', { name: 'Select MO-01, Nix', exact: true })
  await iria.click()
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Applied Iria')

  await nix.click()
  let guard = page.getByRole('dialog', { name: 'Edit chart details' })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(iria).toHaveAttribute('aria-current', 'true')
  await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Applied Iria')

  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit chart details' })
  await guard.getByRole('button', { name: 'Apply and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-current', 'true')
  await waitForWorkspaceSaved(page)

  iria = hierarchy.getByRole('treeitem', { name: 'Select PL-01, Applied Iria', exact: true })
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await iria.click()
  await expect(page.getByRole('dialog', { name: 'Edit chart details' })).toHaveCount(0)
  await expect(iria).toHaveAttribute('aria-current', 'true')
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  await inspector.getByLabel('Name', { exact: true }).fill('Discarded Iria draft')
  await nix.click()
  guard = page.getByRole('dialog', { name: 'Edit chart details' })
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()
  await expect(guard).toBeHidden()
  await expect(nix).toHaveAttribute('aria-current', 'true')

  const exported = await downloadJson(page, 'Export star system JSON')
  expect(exported.system!.objects.map(object => object.name)).toContain('Applied Iria')
  expect(exported.system!.objects.map(object => object.name)).toContain('Nix')
  expect(exported.system!.objects.map(object => object.name)).not.toContain('Discarded Iria draft')
})
