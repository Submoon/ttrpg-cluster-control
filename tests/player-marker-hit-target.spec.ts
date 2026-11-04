import { expect, test } from './fixtures'
import type { PlayerClusterDocument } from '../domain/workspace'
import { serializePlayerJson } from '../domain/workspace'
import { snapshotSvgCoordinates } from './helpers'

const playerDocument: PlayerClusterDocument = {
  format: 'ttrpg-cluster-control-player',
  version: 1,
  title: 'Origin Reach',
  systems: [{
    id: 'system-1',
    position: { x: 480, y: 280 },
    disclosure: 'revealed',
    type: 'star-system',
    label: 'Far Exit Origin',
    map: { objects: [], orbits: [] },
  }],
  routes: [],
}

test('the gap between a Revealed system circle and label opens its public map', async ({ page }) => {
  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled()
  await playerFileInput.setInputFiles({
    name: 'origin-reach-player.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializePlayerJson(playerDocument), 'utf8'),
  })

  await expect(page.getByRole('heading', { name: playerDocument.title, exact: true })).toBeVisible()
  const clusterMap = page.locator('svg.player-cluster-map-scene')
  await expect(clusterMap).toBeVisible()
  const marker = clusterMap.getByRole('button', { name: 'Open Far Exit Origin system preview', exact: true })
  await expect(marker).toBeVisible()

  // The circle ends at x+18 and its label begins at x+28, so x+23 is a real painted-area gap.
  const coordinates = await snapshotSvgCoordinates(clusterMap)
  const gap = coordinates.toClient({
    x: playerDocument.systems[0]!.position.x + 23,
    y: playerDocument.systems[0]!.position.y,
  })
  await page.mouse.click(gap.x, gap.y)

  await expect(page.getByRole('region', { name: 'Player-visible system map', exact: true })).toBeVisible()
})
