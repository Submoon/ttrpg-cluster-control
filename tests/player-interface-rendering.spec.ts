import { expect, test } from './fixtures'
import type { PlayerSystemMarker } from '../domain/player-projection'
import { createPlayerInterfaceFixture } from './fixtures/player-interface-fixture'

async function openRevealedSystem(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Open Public System system preview', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Back to Jump Cluster', exact: true })).toBeVisible()
}

function normalizedDashPattern(pattern: string): string {
  return pattern.replaceAll('px', '').replaceAll(',', ' ').trim().replace(/\s+/g, ' ')
}

test('player system renders published Warden glyphs and dashed Orbits from its public document', async ({ page }) => {
  const { document, json } = createPlayerInterfaceFixture()
  expect(json).not.toContain('PRIVATE_SOURCE_')

  await page.goto('/player')
  const playerFileInput = page.getByLabel('Open player JSON', { exact: true })
  await expect(playerFileInput).toBeEnabled()
  await playerFileInput.setInputFiles({
    name: 'interface-reach.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf8'),
  })
  await expect(page.getByRole('heading', { name: 'Interface Reach', exact: true })).toBeVisible()
  await openRevealedSystem(page)

  const revealedSystem = document.systems.find((system): system is Extract<
    PlayerSystemMarker,
    { disclosure: 'revealed' }
  > => system.disclosure === 'revealed')
  if (!revealedSystem) throw new Error('The player interface fixture is missing its Revealed system.')

  const playerSystem = page.getByRole('group', { name: 'Public System player system map', exact: true })
  await expect(playerSystem).toBeVisible()

  // These literal glyphs match the Warden catalogue marks in utils/catalogue-marks.ts.
  const revealedGlyphs: Array<[string, string]> = [
    ['Public Star', '✦'],
    ['Harbor World', '◉'],
    ['Quiet Moon', '☾'],
    ['Public Station', '⌂'],
    ['Gate Point', '⊕'],
  ]
  for (const [label, glyph] of revealedGlyphs) {
    const marker = playerSystem.locator('.player-system-object-marker--revealed').filter({ hasText: label })
    await expect(marker).toHaveCount(1)
    await expect(marker.locator('text').filter({ hasText: glyph })).toBeVisible()
  }
  const knownTypeMarker = playerSystem.locator('.player-system-object-marker--known-type')
  await expect(knownTypeMarker).toHaveCount(1)
  await expect(knownTypeMarker.locator('text').filter({ hasText: '▤' })).toBeVisible()

  const orbitEllipses = playerSystem.locator('.player-system-orbits ellipse')
  await expect(orbitEllipses).toHaveCount(revealedSystem.map.orbits.length)
  const dashPatterns = await orbitEllipses.evaluateAll(ellipses => ellipses.map(ellipse => ({
    attribute: ellipse.getAttribute('stroke-dasharray'),
    computed: getComputedStyle(ellipse).strokeDasharray,
  })))
  for (const pattern of dashPatterns) {
    expect(normalizedDashPattern(pattern.attribute || pattern.computed)).toBe('3 6')
  }

  const unknownMarker = playerSystem.locator(
    '.player-system-object-marker:not(.player-system-object-marker--known-type):not(.player-system-object-marker--revealed)',
  )
  await expect(unknownMarker).toHaveCount(1)
  await expect(unknownMarker).toHaveAttribute('aria-label', 'Inspect Unknown presence')
  await expect(unknownMarker).not.toContainText('station')
  await expect(page.locator('body')).not.toContainText('PRIVATE_SOURCE_')
})
