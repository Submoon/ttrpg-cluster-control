import { expect, test } from '@playwright/test'
import { activeWorkspaceFeedback } from './helpers'

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
    for (const name of ['Add to map', 'Fit map']) {
      const control = dock.getByRole('button', { name, exact: name === 'Add to map' })
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
      await inspector.getByRole('button', { name: 'Chart details' }).click()
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
