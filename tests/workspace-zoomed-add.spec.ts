import { expect, test } from './fixtures'
import {
  createSingleSystemWorkspace,
  selectCatalogueObjectButton,
  waitForWorkspaceSaved,
  wardenMap,
  wardenObjectMark,
  workspaceZoomControls,
} from './helpers'

test('zoom keeps the visibility badge close and Add accepts clear space beside an object @preview-smoke', async ({ page }) => {
  const { systemId, primaryObjectId } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 900 },
  })
  const map = wardenMap(page)
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  const hitArea = star.locator('.continuous-warden-object-hit-target')
  const badge = map.locator(`[data-publication-identity="object-${systemId}-${primaryObjectId}"] .gm-publication-badge-backing`)
  await expect(badge).toBeInViewport()

  async function badgeOffset() {
    const [hit, disk] = await Promise.all([hitArea.boundingBox(), badge.boundingBox()])
    if (!hit || !disk) throw new Error('The object hit area and visibility badge must be painted.')
    return {
      x: disk.x + disk.width / 2 - hit.x - hit.width / 2,
      y: disk.y + disk.height / 2 - hit.y - hit.height / 2,
    }
  }

  const initialOffset = await badgeOffset()
  const initialHitWidth = (await hitArea.boundingBox())!.width
  const zoomIn = workspaceZoomControls(page).getByRole('button', { name: 'Zoom in', exact: true })
  for (let step = 0; step < 8 && await zoomIn.isEnabled(); step++) await zoomIn.click()
  await expect.poll(async () => (await hitArea.boundingBox())?.width ?? 0).toBeGreaterThan(Math.max(55, initialHitWidth + 10))
  const zoomedOffset = await badgeOffset()
  expect(Math.abs(zoomedOffset.x - initialOffset.x)).toBeLessThan(1)
  expect(Math.abs(zoomedOffset.y - initialOffset.y)).toBeLessThan(1)

  await (await selectCatalogueObjectButton(page, 'planet')).click()
  await expect(page.getByRole('button', { name: 'Quit Add and return to Select', exact: true })).toBeVisible()
  const hit = await hitArea.boundingBox()
  if (!hit) throw new Error('The Primary Star must be visible when Add is armed.')
  const x = hit.x + hit.width / 2
  const y = hit.y + hit.height / 2
  await page.mouse.click(x, y)
  await expect(page.getByText('This object mark is occupied. Choose an Orbit or clear map position.', { exact: true })).toBeVisible()
  await expect(map.locator('.continuous-warden-object')).toHaveCount(1)

  const updatedHit = await hitArea.boundingBox()
  if (!updatedHit) throw new Error('The Primary Star must remain visible after the occupied click.')
  await page.mouse.click(updatedHit.x + updatedHit.width / 2 + 34, updatedHit.y + updatedHit.height / 2)
  await expect(map.locator('.continuous-warden-object')).toHaveCount(2)
  await waitForWorkspaceSaved(page)
})
