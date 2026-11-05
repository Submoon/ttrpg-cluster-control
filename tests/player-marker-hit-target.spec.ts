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

test('blank space inside a Revealed system card opens its public map', async ({ page }) => {
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

  // The card hit envelope includes whitespace around the public name and disclosure caption.
  const coordinates = await snapshotSvgCoordinates(clusterMap)
  const formerLocalHitPosition = coordinates.toClient({ x: 60, y: 24 })
  await page.mouse.click(formerLocalHitPosition.x, formerLocalHitPosition.y)
  await expect(page.getByRole('region', { name: 'Player-visible system map', exact: true })).toHaveCount(0)

  const blankCardSpace = coordinates.toClient({
    x: playerDocument.systems[0]!.position.x + 60,
    y: playerDocument.systems[0]!.position.y - 24,
  })
  await page.mouse.click(blankCardSpace.x, blankCardSpace.y)

  await expect(page.getByRole('region', { name: 'Player-visible system map', exact: true })).toBeVisible()
})
