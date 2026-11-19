import { expect, preparedCampaignTest as campaignTest, type Page } from './fixtures'
import {
  captureMapExportBlobs,
  clickDockAction,
  downloadImage,
  setWorkspaceMapMode,
  wardenMap,
} from './helpers'

campaignTest('invalid route edits focus the validation summary and Stay preserves the edit context', async ({ campaignWorkspacePage: page }) => {
  await setWorkspaceMapMode(page, 'Select')

  const clusterMap = wardenMap(page)
  await expect(clusterMap).toHaveAccessibleName('Kestrel Reach Prime continuous map')
  const initialRoute = clusterMap.getByRole('button', { name: /Jump Level 1.*Vesper Departure.*Harrow Arrival/ })
  const routeId = await initialRoute.getAttribute('data-route-id')
  if (!routeId) throw new Error('The selected route mark has no route identity.')
  const routeMark = clusterMap.locator(`.cluster-route[data-route-id="${routeId}"]`)
  await captureMapExportBlobs(page)
  const appliedImage = await downloadImage(page, 'image/svg+xml', 'Entire Cluster')
  if (!appliedImage.text) throw new Error('The applied Warden SVG did not contain a map.')
  const appliedRoute = await exportedRouteGeometry(page, appliedImage.text, routeId)
  expect(appliedRoute.label).toBe('Jump-1')
  expect(appliedRoute.length).toBeGreaterThan(0)
  expect(Number.isFinite(appliedRoute.length)).toBe(true)
  expect(appliedRoute.hasExit).toBe(false)
  await routeMark.press('Enter')

  const inspector = page.getByRole('complementary', { name: 'Jump Route inspector' })
  await inspector.getByRole('button', { name: 'Edit Jump Route', exact: true }).click()
  const jumpLevel = inspector.getByRole('spinbutton', { name: 'Jump level' })
  const apply = inspector.getByRole('button', { name: 'Apply Jump Route', exact: true })
  await jumpLevel.fill('0')
  await apply.click()

  const validation = inspector.getByRole('alert')
  await expect(validation).toContainText('Jump level must be a positive integer.')
  await expect(validation).toBeFocused()
  const jumpLevelIssue = validation.getByRole('button', { name: /Jump level: Jump level must be a positive integer/ })
  await jumpLevelIssue.click()
  await expect(jumpLevel).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('12')
  await expect(jumpLevel).toHaveValue('12')
  await expect(routeMark).toHaveAccessibleName(/Jump Level 12.*Vesper Departure.*Harrow Arrival/)
  await expect(jumpLevel).toBeFocused()

  await jumpLevel.fill('0')
  await apply.click()
  await expect(validation).toBeFocused()
  await clickDockAction(page, 'Add Jump Route')
  const transition = page.getByRole('dialog', { name: 'Edit Jump Cluster details' })
  await expect(transition.getByText('Continue without this draft?')).toBeVisible()
  await transition.getByRole('button', { name: 'Stay here', exact: true }).click()

  await expect(transition).toBeHidden()
  await expect(clusterMap).toBeVisible()
  await expect(inspector.getByRole('heading', { name: 'Edit Jump Route' })).toBeVisible()
  await expect(jumpLevel).toHaveValue('0')
  await expect(validation).toContainText('Jump level must be a positive integer.')
  await expect(routeMark).toHaveAccessibleName(/Jump Level 1.*Vesper Departure.*Harrow Arrival/)

  await inspector.getByLabel('Route destination', { exact: true }).click()
  await page.getByRole('option', { name: 'Unresolved external exit', exact: true }).click()
  await inspector.getByLabel('Unknown destination label', { exact: true }).fill('Beyond Kestrel')
  await expect(routeMark).toHaveAccessibleName(/Jump Level 1.*Vesper Departure.*Beyond Kestrel/)
  await expect(routeMark.locator('.cluster-exit-mark')).toBeVisible()

  const exported = await downloadImage(page, 'image/svg+xml', 'Entire Cluster')
  if (!exported.text) throw new Error('The Warden SVG did not contain a map.')
  const exportedRoute = await exportedRouteGeometry(page, exported.text, routeId)
  expect(exportedRoute).toEqual(appliedRoute)
  expect(exported.text).not.toContain('Beyond Kestrel')
  await expect(routeMark.locator('.cluster-exit-mark')).toBeVisible()

  await inspector.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(routeMark).toHaveAccessibleName(/Jump Level 1.*Vesper Departure.*Harrow Arrival/)
  await expect(routeMark.locator('.cluster-exit-mark')).toHaveCount(0)
})

async function exportedRouteGeometry(page: Page, text: string, routeId: string) {
  return page.evaluate(({ text, id }) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
    const mark = svg.querySelector(`.cluster-route[data-route-id="${id}"]`)
    const path = mark?.querySelector<SVGPathElement>('.cluster-route-line')
    if (!mark || !path) throw new Error('The applied image is missing its identified Jump Route geometry.')
    return {
      label: mark.querySelector('.cluster-route-label')?.textContent,
      path: path.getAttribute('d'),
      length: path.getTotalLength(),
      hasExit: Boolean(mark.querySelector('.cluster-exit-mark')),
    }
  }, { text, id: routeId })
}
