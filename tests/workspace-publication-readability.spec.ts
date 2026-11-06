import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  editMapObject,
  openChartDetails,
  openWorkspaceHierarchy,
  selectDraftPublication,
  waitForWorkspaceSaved,
} from './helpers'

const modes = ['Hidden', 'Unknown presence', 'Known type', 'Revealed'] as const

async function expectDraftVisibilityGroup(scope: import('@playwright/test').Locator): Promise<import('@playwright/test').Locator> {
  const groups = scope.getByRole('group', { name: 'Draft visibility', exact: true })
  await expect(groups).toHaveCount(1)
  await expect(groups.getByRole('button')).toHaveCount(modes.length)
  await expect(groups.locator('button[aria-pressed="true"]')).toHaveCount(1)
  return groups
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`chart visibility uses one draft icon group and stages changes at ${viewport.width}px`, async ({ page }, testInfo) => {
    await createSingleSystemWorkspace(page, { viewport })
    const details = await openChartDetails(page)
    await details.getByRole('button', { name: 'Edit chart details', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
    const controls = await expectDraftVisibilityGroup(dialog)
    const visibilityRegion = dialog.getByRole('region', { name: 'Draft visibility', exact: true })
    await expect(dialog.getByRole('combobox')).toHaveCount(0)
    await expect(controls).toHaveAttribute('aria-describedby', 'chart-dialog-publication-guidance')
    await expect(controls.getByRole('button', { name: 'Set visibility to Known type', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')

    for (const mode of modes) {
      const button = controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
      await expect(button).toBeVisible()
      await expect.poll(async () => {
        const bounds = await button.boundingBox()
        return bounds ? Math.min(bounds.width, bounds.height) : 0
      }, { message: `${mode} icon target should reach 36px after the dialog opens` }).toBeGreaterThanOrEqual(36)
    }

    await selectDraftPublication(dialog, 'Hidden')
    await expect(visibilityRegion).toContainText('Players do not see this system.')
    await expect(visibilityRegion).not.toContainText('orbital hosts')
    await selectDraftPublication(dialog, 'Revealed')
    await expect(visibilityRegion).toContainText('Draft visibility: Revealed')
    const screenshot = testInfo.outputPath('chart-draft-visibility-icons.png')
    await dialog.screenshot({ path: screenshot })
    await testInfo.attach('chart-draft-visibility-icons', { path: screenshot, contentType: 'image/png' })

    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toBeHidden()
    const savedSettings = details.getByRole('region', { name: 'Player publication settings', exact: true })
    await expect(savedSettings).toContainText('Known type: Star system')
    await details.getByRole('button', { name: 'Resume chart details draft', exact: true }).click()
    await expect(dialog).toBeVisible()
    await expectDraftVisibilityGroup(dialog)
    await expect(dialog.getByRole('button', { name: 'Set visibility to Revealed', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')

    await dialog.getByRole('button', { name: 'Apply details', exact: true }).click()
    await expect(dialog).toBeHidden()
    await waitForWorkspaceSaved(page)
    await expect(savedSettings).toContainText('Revealed: system name visible')
  })
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`object visibility stages in one Inspector group until Apply or Discard at ${viewport.width}px`, async ({ page }, testInfo) => {
    await createSingleSystemWorkspace(page, { viewport })
    const hierarchy = await openWorkspaceHierarchy(page)
    await hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true }).click()
    await editMapObject(page)

    const inspector = viewport.width < 600
      ? page.getByRole('dialog', { name: 'Object inspector', exact: true })
      : page.getByRole('complementary', { name: 'Object inspector', exact: true })
    const controls = await expectDraftVisibilityGroup(inspector)
    const visibilityRegion = inspector.getByRole('region', { name: 'Draft visibility', exact: true })
    await expect(inspector.getByRole('group', { name: 'Configured visibility', exact: true })).toHaveCount(0)
    for (const mode of modes) {
      const button = controls.getByRole('button', { name: `Set visibility to ${mode}`, exact: true })
      const bounds = await button.boundingBox()
      expect(bounds, `${mode} icon target should be visible at ${viewport.width}px`).not.toBeNull()
      expect(bounds!.width).toBeGreaterThanOrEqual(36)
      expect(bounds!.height).toBeGreaterThanOrEqual(36)
    }
    await selectDraftPublication(inspector, 'Hidden')
    await expect(visibilityRegion).toContainText('Draft visibility: Hidden')
    await expect(visibilityRegion).toContainText('Required orbital hosts may appear as Unknown in the player view.')
    const screenshot = testInfo.outputPath('object-draft-visibility-icons.png')
    await inspector.screenshot({ path: screenshot })
    await testInfo.attach('object-draft-visibility-icons', { path: screenshot, contentType: 'image/png' })

    await inspector.getByRole('button', { name: 'Discard changes' }).click()
    const committedAfterDiscard = inspector.getByRole('group', { name: 'Configured visibility', exact: true })
    await expect(committedAfterDiscard.getByRole('button', { name: 'Set visibility to Known type', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')

    await editMapObject(page)
    await selectDraftPublication(inspector, 'Revealed')
    await inspector.getByRole('button', { name: 'Apply changes' }).click()
    await waitForWorkspaceSaved(page)
    const committedAfterApply = inspector.getByRole('group', { name: 'Configured visibility', exact: true })
    await expect(committedAfterApply.getByRole('button', { name: 'Set visibility to Revealed', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })
}
