import { expect, test } from './fixtures'
import { activeWorkspaceFeedback, addCatalogueObject, waitForWorkspaceSaved, workspaceZoomControls } from './helpers'

async function closeCompactPanels(page: import('@playwright/test').Page): Promise<void> {
  const inspectorClose = page.getByRole('button', { name: 'Close inspector panel', exact: true })
  const inspectorHide = page.getByRole('button', { name: 'Hide inspector', exact: true })
  if (await inspectorClose.isVisible()) await inspectorClose.click()
  else if (await inspectorHide.isVisible()) await inspectorHide.click()

  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible()) await hierarchyClose.click()
}

async function abortNextWorkspaceWrite(
  page: import('@playwright/test').Page,
  operation: () => Promise<void>,
): Promise<void> {
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
    if (!original) throw new Error('IndexedDB put is unavailable.')
    const state = { original, aborted: 0 }
    ;(window as Window & { __feedbackAbort?: typeof state }).__feedbackAbort = state
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
    await operation()
    const aborted = await page.evaluate(() => (window as Window & { __feedbackAbort?: { aborted: number } }).__feedbackAbort?.aborted ?? 0)
    expect(aborted).toBe(1)
  } finally {
    await page.evaluate(() => {
      const state = (window as Window & { __feedbackAbort?: { original: PropertyDescriptor } }).__feedbackAbort
      if (!state) return
      Object.defineProperty(IDBObjectStore.prototype, 'put', state.original)
      delete (window as Window & { __feedbackAbort?: unknown }).__feedbackAbort
    })
  }
}

async function createWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  await page.getByLabel('First star system').fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)
}

test('a hidden clean chart-name session remains resumable without claiming unapplied changes', async ({ page }) => {
  await createWorkspace(page)

  await page.getByRole('button', { name: 'Chart details' }).click()
  const inspector = page.getByRole('complementary', { name: 'Object inspector' })
  await inspector.getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')

  const feedback = activeWorkspaceFeedback(page)
  await expect(dialog).toBeHidden()
  await expect(feedback.getByRole('button', { name: 'Resume chart name draft' })).toBeVisible()
  await expect(feedback.getByText('Chart names ready to resume')).toBeVisible()
  await expect(feedback.getByText('Unapplied chart-name changes')).toHaveCount(0)

  await feedback.getByRole('button', { name: 'Resume chart name draft' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Jump Cluster')).toHaveValue('Kestrel Reach')
  await expect(dialog.getByLabel('Star system')).toHaveValue('Vesper')
})

test('routine save feedback takes no space on desktop or in compact recovery', async ({ page }, testInfo) => {
  await createWorkspace(page)

  const feedback = page.locator('.workspace-feedback:not([inert])')
  await expect(feedback).toBeHidden()
  expect(await feedback.boundingBox()).toBeNull()
  await expect(feedback.locator('.save-feedback')).toHaveCount(0)
  await expect(page.locator('.workspace-header-save-state')).toHaveCount(0)
  await expect(page.locator('.workspace-dock [role="status"][aria-live]')).toHaveCount(0)
  const desktopScreenshot = testInfo.outputPath('clean-save-feedback-desktop.png')
  await page.screenshot({ path: desktopScreenshot })
  await testInfo.attach('clean-save-feedback-desktop', { path: desktopScreenshot, contentType: 'image/png' })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 500 }]) {
    await page.setViewportSize(viewport)
    if (viewport.width === 390) {
      const compactRecovery = page.locator('.workspace-compact-recovery')
      await expect(page.getByRole('dialog', { name: 'Object inspector' })).toBeVisible()
      const inspectorContent = page.locator('#workspace-inspector-panel .workspace-side-panel-content')
      await expect(inspectorContent).toHaveCSS('padding-bottom', '0px')
      await expect(compactRecovery).toBeHidden()
      expect(await compactRecovery.boundingBox()).toBeNull()
      await expect(page.locator('.workspace-feedback')).toHaveAttribute('inert', '')

      await page.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
      await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'System hierarchy' })).toBeVisible()
      const hierarchyContent = page.locator('#workspace-hierarchy-panel .workspace-side-panel-content')
      const hierarchyPadding = await hierarchyContent.evaluate(element => {
        const style = getComputedStyle(element)
        return { bottom: style.paddingBottom, top: style.paddingTop }
      })
      expect(hierarchyPadding.bottom).toBe(hierarchyPadding.top)
      await expect(compactRecovery).toBeHidden()
      expect(await compactRecovery.boundingBox()).toBeNull()
      const compactScreenshot = testInfo.outputPath('clean-save-feedback-compact.png')
      await page.screenshot({ path: compactScreenshot })
      await testInfo.attach('clean-save-feedback-compact', { path: compactScreenshot, contentType: 'image/png' })

      await page.getByRole('button', { name: 'Close hierarchy panel', exact: true }).click()
      const cleanControlsLayout = await page.locator('.workspace-bottom-controls').evaluate(element => {
        const feedbackRegion = element.querySelector<HTMLElement>('.workspace-feedback-region')
        const zoomRegion = element.querySelector<HTMLElement>('.workspace-zoom-region')
        const dockRegion = element.querySelector<HTMLElement>('.workspace-dock-region')
        if (!feedbackRegion || !zoomRegion || !dockRegion) throw new Error('A bottom-control region is missing.')
        const controlsBounds = element.getBoundingClientRect()
        const zoomBounds = zoomRegion.getBoundingClientRect()
        const dockBounds = dockRegion.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          firstRow: style.gridTemplateRows.split(' ')[0],
          rowGap: style.rowGap,
          feedbackDisplay: getComputedStyle(feedbackRegion).display,
          controlsBottom: controlsBounds.bottom,
          zoomBottom: zoomBounds.bottom,
          dockTop: dockBounds.top,
        }
      })
      expect(cleanControlsLayout.firstRow).toBe('0px')
      expect(cleanControlsLayout.rowGap).toBe('0px')
      expect(cleanControlsLayout.feedbackDisplay).toBe('none')
      expect(cleanControlsLayout.dockTop - cleanControlsLayout.zoomBottom).toBeCloseTo(5.6, 0)
      expect(cleanControlsLayout.dockTop).toBeLessThan(cleanControlsLayout.controlsBottom)
      continue
    }

    await expect(feedback).toBeHidden()
    expect(await feedback.boundingBox()).toBeNull()

    const dock = page.getByRole('toolbar', { name: 'Workspace navigation' })
    const controls = [
      dock.getByRole('button', { name: 'Add to map', exact: true }),
      workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }),
    ]
    for (const control of controls) {
      await expect(control).toBeVisible()
      expect(await control.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return target === element || element.contains(target)
      })).toBe(true)
    }

    if (viewport.width > 760) {
      const back = page.getByRole('button', { name: 'Back to Jump Cluster' })
      await expect(back).toBeVisible()
      expect(await back.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return target === element || element.contains(target)
      })).toBe(true)

      const inspector = page.getByRole('complementary', { name: 'Object inspector' })
      await page.getByRole('button', { name: 'Chart details', exact: true }).click()
      const chartNames = inspector.getByRole('button', { name: 'Edit chart names' })
      await expect(chartNames).toBeVisible()
      expect(await chartNames.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return target === element || element.contains(target)
      })).toBe(true)

      await chartNames.click()
      const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
      const apply = dialog.getByRole('button', { name: 'Apply names' })
      await expect(apply).toBeVisible()
      expect(await apply.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        return target === element || element.contains(target)
      })).toBe(true)
      await dialog.getByRole('button', { name: 'Close' }).click()
      const resumeDraft = activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft' })
      await expect(resumeDraft).toBeVisible()
      await resumeDraft.click()
      await page.getByRole('dialog', { name: 'Edit chart names' }).getByRole('button', { name: 'Discard draft' }).click()
      await expect(page.locator('.workspace-feedback')).toBeHidden()
    }
  }
})

test('explicit Fit keeps a lower-right planet reachable beside failed-save feedback and a hidden chart draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await page.getByLabel('Jump Cluster', { exact: true }).fill('Kestrel Reach')
  await page.getByLabel('First star system', { exact: true }).fill('Vesper')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await waitForWorkspaceSaved(page)

  await addCatalogueObject(page, 'planet', { noSelection: true, target: { kind: 'free', x: 0.9, y: 0.9 } })
  await waitForWorkspaceSaved(page)
  await closeCompactPanels(page)

  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await hierarchy.getByRole('button', { name: /^Select PL-01, New planet 1/ }).click()
  await closeCompactPanels(page)
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await closeCompactPanels(page)

  const systemMap = page.locator('.system-map-content')
  const cameraBeforeFeedback = await systemMap.getAttribute('transform')
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  const chartInspector = page.locator('#workspace-inspector-panel')
  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  await chartInspector.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const appliedDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await appliedDialog.getByLabel('Jump Cluster', { exact: true }).fill('Applied recovery reach')
  await appliedDialog.getByLabel('Star system', { exact: true }).fill('Applied recovery star')
  await abortNextWorkspaceWrite(page, async () => {
    await appliedDialog.getByRole('button', { name: 'Apply names', exact: true }).click()
    await expect(appliedDialog).toBeHidden()
  })
  await expect(activeWorkspaceFeedback(page).locator('.save-feedback')).toContainText('Not saved.')

  await closeCompactPanels(page)
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  const draftInspector = page.locator('#workspace-inspector-panel')
  await page.getByRole('button', { name: 'Chart details', exact: true }).click()
  await draftInspector.getByRole('button', { name: 'Edit chart names', exact: true }).click()
  const draftDialog = page.getByRole('dialog', { name: 'Edit chart names', exact: true })
  await draftDialog.getByLabel('Jump Cluster', { exact: true }).fill('Hidden unapplied draft reach')
  await draftDialog.getByLabel('Star system', { exact: true }).fill('Hidden unapplied draft star')
  await page.keyboard.press('Escape')
  await expect(draftDialog).toBeHidden()
  await expect(activeWorkspaceFeedback(page).getByRole('button', { name: 'Resume chart name draft', exact: true })).toBeVisible()
  await expect(systemMap).toHaveAttribute('transform', cameraBeforeFeedback!)

  const compactRecovery = page.getByRole('region', { name: 'Workspace save and recovery' })
  const compactDetailsTrigger = compactRecovery.getByRole('button', { name: 'Recovery details', exact: true })
  await compactDetailsTrigger.click()
  let details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details).toBeVisible()
  await expect(details.getByRole('alert')).toContainText('Save failed:')
  await expect(details.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  const pendingDownload = page.waitForEvent('download')
  await details.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true }).click()
  const download = await pendingDownload
  expect(download.suggestedFilename()).toMatch(/\.json$/i)
  await page.keyboard.press('Escape')
  await expect(compactDetailsTrigger).toBeFocused()

  await closeCompactPanels(page)
  const normalFeedback = activeWorkspaceFeedback(page)
  const normalDetailsTrigger = normalFeedback.getByRole('button', { name: 'Recovery details', exact: true })
  await normalDetailsTrigger.click()
  details = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await expect(details.getByRole('alert')).toContainText('Save failed:')
  await expect(details.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  await expect(details.getByRole('button', { name: 'Export current Jump Cluster JSON', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(normalDetailsTrigger).toBeFocused()

  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('button', { name: 'Fit map', exact: true }).click()
  const planet = page.getByRole('button', { name: /^Select PL-01, New planet 1 \(/ })
  await expect(planet).toBeVisible()
  const ordinaryHit = await planet.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    return hit === element || element.contains(hit)
  })
  expect(ordinaryHit).toBe(true)

  await planet.click()
  const guard = page.getByRole('dialog', { name: 'Edit chart names' })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Edit chart names' })).toBeHidden()

  const recoveryDetailsTrigger = activeWorkspaceFeedback(page).getByRole('button', { name: 'Recovery details', exact: true })
  await recoveryDetailsTrigger.click()
  const retryDetails = page.getByRole('group', { name: 'Workspace recovery details', exact: true })
  await retryDetails.getByRole('button', { name: 'Retry save', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(page.locator('#workspace-main')).toBeFocused()
})
