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
    x: playerDocument.systems[0]!.position.x - 55,
    y: playerDocument.systems[0]!.position.y + 16,
  })
  await page.mouse.click(blankCardSpace.x, blankCardSpace.y)

  await expect(page.getByRole('region', { name: 'Player-visible system map', exact: true })).toBeVisible()
})

test('a later Unknown presence label does not intercept an overlapping object marker click', async ({ page }) => {
  const document: PlayerClusterDocument = {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Marker Reach',
    systems: [{
      id: 'system-1',
      position: { x: 480, y: 280 },
      disclosure: 'revealed',
      type: 'star-system',
      label: 'Marker System',
      map: {
        objects: [
          {
            id: 'object-1',
            position: { x: 52, y: 200 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'CelestialBody',
            subtype: 'star',
            label: 'Target Star',
            playerText: 'The selected public star.',
            fields: [],
          },
          {
            id: 'object-2',
            position: { x: 0, y: 200 },
            placement: { kind: 'system' },
            disclosure: 'unknown',
            label: 'Unknown presence',
          },
        ],
        orbits: [],
      },
    }],
    routes: [],
  }

  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled()
  await playerFileInput.setInputFiles({
    name: 'marker-reach-player.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializePlayerJson(document), 'utf8'),
  })

  const clusterMap = page.getByRole('region', { name: 'Player-visible Jump Cluster map', exact: true })
  await clusterMap.getByRole('button', { name: 'Open Marker System system preview', exact: true }).click()
  const systemMap = page.getByRole('region', { name: 'Player-visible system map', exact: true })
  const target = systemMap.getByRole('button', { name: 'Inspect Target Star', exact: true })
  const targetGlyph = target.locator('.player-system-object-glyph')
  const anonymous = systemMap.getByRole('button', { name: 'Inspect Unknown presence', exact: true })
  const anonymousLabel = anonymous.locator('.player-system-object-label')
  const glyphBounds = await targetGlyph.boundingBox()
  const labelBounds = await anonymousLabel.boundingBox()
  if (!glyphBounds || !labelBounds) throw new Error('The public marker and overlapping label need rendered bounds.')

  const clickPoint = {
    x: glyphBounds.x + glyphBounds.width / 2,
    y: glyphBounds.y + glyphBounds.height / 2,
  }
  expect(clickPoint.x).toBeGreaterThanOrEqual(labelBounds.x)
  expect(clickPoint.x).toBeLessThanOrEqual(labelBounds.x + labelBounds.width)
  expect(clickPoint.y).toBeGreaterThanOrEqual(labelBounds.y)
  expect(clickPoint.y).toBeLessThanOrEqual(labelBounds.y + labelBounds.height)

  await page.mouse.click(clickPoint.x, clickPoint.y)
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  await expect(anonymous).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('region', { name: 'Player object details', exact: true }))
    .toContainText('Target Star')
})
