import { expect, test } from './fixtures'
import { activeWorkspaceFeedback, addCatalogueObject, editMapObject, workspaceZoomControls } from './helpers'

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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
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

test('save feedback has one compact bottom owner and leaves map controls hit-testable', async ({ page }) => {
  await createWorkspace(page)

  const feedback = page.getByRole('region', { name: 'Workspace feedback and recovery' })
  await expect(feedback).toBeVisible()
  await expect(page.locator('.workspace-header-save-state')).toHaveCount(0)
  await expect(page.locator('.workspace-dock [role="status"][aria-live]')).toHaveCount(0)
  await expect(feedback.locator('.save-feedback')).toHaveCount(1)

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 500 }]) {
    await page.setViewportSize(viewport)
    if (viewport.width === 390) {
      const compactRecovery = page.locator('.workspace-compact-recovery')
      await expect(page.getByRole('dialog', { name: 'Object inspector' })).toBeVisible()
      await expect(compactRecovery).toBeVisible()
      await expect(page.locator('.workspace-feedback')).toHaveAttribute('inert', '')
      await expect(compactRecovery.locator('.save-feedback')).toHaveCount(1)
      const bounds = await compactRecovery.boundingBox()
      if (!bounds) throw new Error('The compact panel recovery surface has no visible bounds.')
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
      expect(bounds.y + bounds.height).toBeGreaterThan(viewport.height - 200)
      continue
    }

    await expect(feedback).toBeVisible()
    const geometry = await page.evaluate(() => {
      const feedback = document.querySelector<HTMLElement>('.workspace-feedback:not([inert])')
      const shell = document.querySelector<HTMLElement>('.map-workspace-shell')
      const canvas = document.querySelector<HTMLElement>('.workspace-canvas')
      const missing = [
        !shell && 'workspace shell',
        !feedback && 'active workspace feedback',
        !canvas && 'map canvas',
      ].filter(Boolean)
      if (missing.length) throw new Error(`Missing ${missing.join(', ')}.`)
      if (!shell || !feedback || !canvas) throw new Error('Workspace geometry could not be read.')
      const shellBounds = shell.getBoundingClientRect()
      const feedbackBounds = feedback.getBoundingClientRect()
      const canvasBounds = canvas.getBoundingClientRect()
      return {
        feedbackWidth: feedbackBounds.width,
        feedbackHeight: feedbackBounds.height,
        shellWidth: shellBounds.width,
        shellBottom: shellBounds.bottom,
        feedbackBottom: feedbackBounds.bottom,
        canvasBottom: canvasBounds.bottom,
      }
    })
    expect(geometry.feedbackWidth).toBeLessThan(geometry.shellWidth * 0.8)
    expect(geometry.feedbackHeight).toBeLessThanOrEqual(112)
    expect(Math.abs(geometry.shellBottom - geometry.feedbackBottom)).toBeLessThanOrEqual(20)
    expect(geometry.canvasBottom).toBeGreaterThan(geometry.feedbackBottom - geometry.feedbackHeight)

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
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()

  await addCatalogueObject(page, 'planet', { noSelection: true })
  await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  await closeCompactPanels(page)

  await page.getByRole('button', { name: 'Hierarchy', exact: true }).click()
  const hierarchy = page.locator('#workspace-hierarchy-panel')
  await hierarchy.getByRole('button', { name: /^Select PL-01, New planet 1/ }).click()
  await closeCompactPanels(page)
  await page.getByRole('button', { name: 'Inspect', exact: true }).click()
  const inspector = page.locator('#workspace-inspector-panel')
  await editMapObject(page)
  await inspector.getByLabel('Schematic X', { exact: true }).fill('0.9')
  await inspector.getByLabel('Schematic Y', { exact: true }).fill('0.9')
  await inspector.getByRole('button', { name: /^Apply changes/ }).click()
  await expect(inspector.locator('.entity-inspector-save-feedback').getByRole('status', { name: 'Saved on this device', exact: true })).toBeVisible()
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
})
