import { expect, test } from './fixtures'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/player-projection'
import { parsePlayerJson } from '../domain/player-codec'
import type { DownloadWindow, ExportedMap } from './helpers'
import {
  captureMapExportBlobs,
  downloadImage,
  downloadJson,
  importReviewDialog,
  jsonMapImportInput,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setHeaderMapActionsOpen,
  setJsonFile,
  setWorkspaceMapMode,
  waitForWorkspaceSaved,
} from './helpers'

function campaignWithPrivateImageMarkers(): ExportedMap {
  const fixture = JSON.parse(JSON.stringify(campaignBaselineFixture)) as ExportedMap
  if (!fixture.cluster) throw new Error('The player image fixture is missing its Jump Cluster.')

  fixture.version = 4
  fixture.cluster.name = 'PRIVATE_WARDEN_CHART'
  fixture.cluster.playerTitle = 'PRIVATE_INCOMING_TITLE'

  const revealedSystem = fixture.cluster.systems.find(system => system.id === 'campaign-baseline-vesper')
  const hiddenSystem = fixture.cluster.systems.find(system => system.id === 'campaign-baseline-harrow')
  if (!revealedSystem || !hiddenSystem) {
    throw new Error('The player image fixture needs its Revealed and Hidden Star Systems.')
  }

  revealedSystem.name = 'PUBLIC_VESPER'
  revealedSystem.publication = 'revealed'
  hiddenSystem.name = 'PRIVATE_HIDDEN_SYSTEM'
  hiddenSystem.publication = 'hidden'

  for (const system of fixture.cluster.systems) {
    for (const object of system.objects) {
      object.publication = 'hidden'
      object.name = `PRIVATE_SOURCE_OBJECT_NAME_${object.id}`
      object.locationKey = `PRIVATE_SOURCE_LOCATION_KEY_${object.id}`
      object.description = `PRIVATE_GM_PROSE_${object.id}`
      object.playerText = `PRIVATE_PLAYER_TEXT_${object.id}`
      object.playerFieldMasks = []
    }
  }

  const privateLocation = revealedSystem.objects.find(object => object.id === 'campaign-baseline-iria')
  if (!privateLocation) throw new Error('The player image fixture is missing its private location.')
  privateLocation.name = 'PRIVATE_LOCATION_NAME'
  privateLocation.locationKey = 'PRIVATE_LOCATION_KEY'
  privateLocation.description = 'PRIVATE_GM_PROSE'

  fixture.cluster.routes = [
    {
      id: 'campaign-baseline-route',
      name: 'PRIVATE_SHARED_ROUTE_NAME',
      jumpLevel: 8,
      fromPointId: 'campaign-baseline-departure',
      toPointId: 'campaign-baseline-arrival',
      playerShared: true,
    },
    {
      id: 'ticket07-private-route',
      name: 'PRIVATE_UNSHARED_ROUTE_NAME',
      jumpLevel: 9,
      fromPointId: 'campaign-baseline-departure',
      toPointId: 'campaign-baseline-arrival',
      playerShared: false,
    },
  ]

  fixture.objectFieldSettings.nativePlayerSharing = { atmosphere: false, portClass: false }
  fixture.objectFieldSettings.customFields = fixture.objectFieldSettings.customFields.map(field => ({
    ...field,
    name: 'PRIVATE_GM_FIELD_NAME',
    type: 'single-select',
    playerShared: false,
    options: ['PRIVATE_GM_USED_OPTION', 'PRIVATE_GM_UNUSED_OPTION'],
  }))
  fixture.objectFieldSettings.customFields.forEach((field) => {
    const location = revealedSystem.objects.find(object => object.id === 'campaign-baseline-iria')
    if (location?.customFieldValues) {
      location.customFieldValues[field.id] = 'PRIVATE_GM_USED_OPTION'
    }
  })

  return fixture
}

function campaignWithNestedPublicSystem(): ExportedMap {
  const fixture = campaignWithPrivateImageMarkers()
  const system = fixture.cluster?.systems.find(candidate => candidate.id === 'campaign-baseline-vesper')
  if (!fixture.cluster || !system) throw new Error('The nested system fixture is missing its Revealed Star System.')

  system.name = 'PUBLIC_SYSTEM_NAME'
  system.publication = 'revealed'
  const rootHost = system.objects.find(object => object.id === 'campaign-baseline-star')
  const nestedHost = system.objects.find(object => object.id === 'campaign-baseline-iria')
  const revealedObject = system.objects.find(object => object.id === 'campaign-baseline-nix')
  if (!rootHost || !nestedHost || !revealedObject) {
    throw new Error('The nested system fixture is missing its public object host chain.')
  }

  rootHost.publication = 'known-type'
  rootHost.name = 'PRIVATE_ROOT_HOST_NAME'
  rootHost.locationKey = 'PRIVATE_ROOT_HOST_KEY'
  rootHost.description = 'PRIVATE_ROOT_HOST_GM_NOTES'
  nestedHost.publication = 'hidden'
  nestedHost.name = 'PRIVATE_NESTED_HOST_NAME'
  nestedHost.locationKey = 'PRIVATE_NESTED_HOST_KEY'
  nestedHost.description = 'PRIVATE_NESTED_HOST_GM_NOTES'
  revealedObject.publication = 'revealed'
  revealedObject.name = 'PUBLIC_NIX'
  revealedObject.locationKey = 'PRIVATE_REVEALED_OBJECT_KEY'
  revealedObject.description = 'PRIVATE_REVEALED_OBJECT_GM_NOTES'
  revealedObject.playerText = 'PRIVATE_REVEALED_OBJECT_PLAYER_TEXT'

  system.objects.push({
    id: 'ticket07-private-unrelated-satellite',
    publication: 'hidden',
    name: 'PRIVATE_UNRELATED_SATELLITE',
    family: 'CelestialBody',
    subtype: 'moon',
    locationKey: 'PRIVATE_UNRELATED_SATELLITE_KEY',
    description: 'PRIVATE_UNRELATED_SATELLITE_NOTES',
    playerText: 'PRIVATE_UNRELATED_SATELLITE_TEXT',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.9, y: 0.9 },
  })
  return fixture
}

function campaignWithImageEligibilityCases(): ExportedMap {
  const fixture = campaignWithPrivateImageMarkers()
  const emptySystem = fixture.cluster?.systems.find(system => system.id === 'campaign-baseline-vesper')
  const partialSystem = fixture.cluster?.systems.find(system => system.id === 'campaign-baseline-harrow')
  if (!fixture.cluster || !emptySystem || !partialSystem) {
    throw new Error('The image eligibility fixture needs empty and partial Star Systems.')
  }

  fixture.cluster.routes = []
  emptySystem.name = 'PUBLIC_EMPTY_SYSTEM'
  emptySystem.publication = 'revealed'
  partialSystem.name = 'PRIVATE_PARTIAL_SYSTEM'
  partialSystem.publication = 'known-type'
  const privateObject = partialSystem.objects.find(object => object.id === 'campaign-baseline-arrival')
  if (!privateObject) throw new Error('The partial system fixture needs a private source object.')
  privateObject.publication = 'revealed'
  privateObject.name = 'PRIVATE_PARTIAL_SYSTEM_OBJECT'
  privateObject.playerText = 'PRIVATE_PARTIAL_SYSTEM_TEXT'
  return fixture
}

async function importPlayerImageFixture(
  page: import('@playwright/test').Page,
  fixture: ExportedMap,
): Promise<import('@playwright/test').Locator> {
  const clusterName = 'PRIVATE_WARDEN_CHART'
  await captureMapExportBlobs(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster', { exact: true }).fill(clusterName)
  await page.getByLabel('First star system', { exact: true }).fill('PRIVATE_STARTER_SYSTEM')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'player-image-private-markers.json', JSON.stringify(fixture))
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  await waitForWorkspaceSaved(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  await expect(clusterMap).toBeVisible()
  return clusterMap
}

async function inspectPlayerImageSvg(
  page: import('@playwright/test').Page,
  content: string,
) {
  return page.evaluate((svgText) => {
    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    const svg = parsed.documentElement
    if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) {
      throw new Error('The player image SVG is invalid.')
    }
    const elements = [svg, ...svg.querySelectorAll('*')]
    const attributes = elements.flatMap(element => [...element.attributes]
      .map(attribute => ({ name: attribute.name, value: attribute.value })))
    const unknownMarkerSelector = '.player-system-object-marker:not(.player-system-object-marker--known-type):not(.player-system-object-marker--revealed)'
    const unknownMarker = svg.querySelector<SVGGElement>(unknownMarkerSelector)
    const knownMarker = svg.querySelector<SVGGElement>('.player-system-object-marker--known-type')
    const revealedMarker = svg.querySelector<SVGGElement>('.player-system-object-marker--revealed')
    const objectMarkers = [...svg.querySelectorAll<SVGGElement>('.player-system-object-marker')]
    const orbitEllipses = [...svg.querySelectorAll<SVGEllipseElement>('.player-system-orbits ellipse')]
    return {
      rootLabel: svg.getAttribute('aria-label'),
      text: svg.textContent ?? '',
      textNodes: [...svg.querySelectorAll('text')].map(element => (element.textContent ?? '').trim()),
      attributeValues: attributes.map(attribute => attribute.value),
      metadataAttributeNames: attributes.map(attribute => attribute.name)
        .filter(name => /(?:location.?key|source|(?:system|object|route|field).?id)/i.test(name)),
      ids: attributes.filter(attribute => attribute.name === 'id').map(attribute => attribute.value),
      markerLabels: [...svg.querySelectorAll<SVGGElement>('.player-system-object-marker')]
        .map(marker => marker.getAttribute('aria-label')),
      markerGlyphs: objectMarkers.map(marker =>
        marker.querySelector('text.player-system-object-glyph')?.textContent?.trim() ?? null,
      ),
      markerCircleCounts: objectMarkers.map(marker => marker.querySelectorAll('circle').length),
      markerHitTargetCount: svg.querySelectorAll('.player-system-object-hit-target').length,
      knownMarkerCount: svg.querySelectorAll('.player-system-object-marker--known-type').length,
      unknownMarkerCount: svg.querySelectorAll(unknownMarkerSelector).length,
      revealedMarkerCount: svg.querySelectorAll('.player-system-object-marker--revealed').length,
      orbitCount: svg.querySelectorAll('.player-system-orbits ellipse').length,
      orbitDashPatterns: orbitEllipses.map(ellipse => ellipse.getAttribute('stroke-dasharray')),
      markerTransforms: [...svg.querySelectorAll<SVGGElement>('.player-system-object-marker')]
        .map(marker => ({
          label: marker.getAttribute('aria-label'),
          transform: marker.getAttribute('transform'),
        })),
      orbitEllipses: [...svg.querySelectorAll<SVGEllipseElement>('.player-system-orbits ellipse')]
        .map(ellipse => ({
          cx: ellipse.getAttribute('cx'),
          cy: ellipse.getAttribute('cy'),
          rx: ellipse.getAttribute('rx'),
          ry: ellipse.getAttribute('ry'),
          transform: ellipse.getAttribute('transform'),
        })),
      backgroundFill: svg.querySelector('rect[aria-hidden="true"]')?.getAttribute('fill') ?? null,
      textFills: [...svg.querySelectorAll<SVGTextElement>('text')]
        .map(element => element.getAttribute('fill'))
        .filter((value): value is string => value !== null),
      unknownStroke: unknownMarker?.querySelector('circle')?.getAttribute('stroke') ?? null,
      knownGlyphFill: knownMarker?.querySelector('text.player-system-object-glyph')?.getAttribute('fill') ?? null,
      revealedGlyphFill: revealedMarker?.querySelector('text.player-system-object-glyph')?.getAttribute('fill') ?? null,
    }
  }, content)
}

function sourceSystemPrivateCanaries(source: ExportedMap, permittedNames: readonly string[]) {
  const permitted = new Set(permittedNames)
  const systems = source.cluster?.systems ?? []
  const markers = [
    source.cluster?.name,
    ...systems.filter(system => system.publication !== 'revealed').map(system => system.name),
    ...systems.flatMap(system => system.objects.flatMap(object => [
      object.name,
      object.description,
      object.playerText,
      ...Object.values(object.customFieldValues ?? {}).map(value => String(value)),
    ])),
    ...source.cluster?.routes.map(route => route.name) ?? [],
    ...source.objectFieldSettings.customFields.flatMap(field => [field.name, ...(field.options ?? [])]),
    'PRIVATE_INCOMING_TITLE',
  ].filter((value): value is string => typeof value === 'string' && value.length > 0 && !permitted.has(value))
  const ids = [
    source.cluster?.id,
    ...systems.flatMap(system => [
      system.id,
      ...system.objects.map(object => object.id),
      ...system.orbits.map(orbit => orbit.id),
    ]),
    ...(source.cluster?.routes.map(route => route.id) ?? []),
    ...source.objectFieldSettings.customFields.map(field => field.id),
  ].filter((value): value is string => Boolean(value))
  const locationKeys = systems.flatMap(system => system.objects.map(object => object.locationKey))
  return {
    markers,
    ids,
    locationKeys,
    multiCharacterLocationKeys: locationKeys.filter(key => Array.from(key).length > 1),
    singleCharacterLocationKeys: locationKeys.filter(key => Array.from(key).length === 1),
  }
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const hex = color.match(/^#([0-9a-f]{6})$/i)?.[1]
    if (!hex) throw new Error(`Expected a six-digit hex color, received "${color}".`)
    const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    const linear = channels.map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
  }
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

function requireSvgColor(value: string | null, name: string): string {
  if (value === null) throw new Error(`The exported SVG is missing its ${name} color.`)
  return value
}

async function capturePlayerImageDownload(
  page: import('@playwright/test').Page,
  buttonName: string,
  mimeType: 'image/svg+xml' | 'image/png',
) {
  const downloadPromise = page.waitForEvent('download')
  const imagePromise = downloadImage(page, buttonName, mimeType)
  const [image, download] = await Promise.all([imagePromise, downloadPromise])
  return { image, download }
}

async function downloadPlayerJsonDocument(
  page: import('@playwright/test').Page,
): Promise<{ fileName: string; text: string; document: PlayerClusterDocument }> {
  await setHeaderMapActionsOpen(page, true)
  try {
    const pendingDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export player JSON', exact: true }).click()
    const download = await pendingDownload
    const text = await page.evaluate(async () => {
      const blobs = (window as DownloadWindow).__mapExportBlobs ?? []
      const index = blobs.findIndex(blob => blob.type.startsWith('application/json'))
      if (index < 0) throw new Error('The player JSON download did not produce a JSON Blob.')
      const blob = blobs.splice(index, 1)[0]
      if (!blob) throw new Error('The player JSON Blob could not be read.')
      return blob.text()
    })
    return {
      fileName: download.suggestedFilename(),
      text,
      document: parsePlayerJson(text),
    }
  } finally {
    await setHeaderMapActionsOpen(page, false)
  }
}

test('player SVG exports only the published cluster scene and preserves the complete source', async ({ page }) => {
  const clusterName = 'PRIVATE_WARDEN_CHART'
  await captureMapExportBlobs(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster', { exact: true }).fill(clusterName)
  await page.getByLabel('First star system', { exact: true }).fill('PRIVATE_STARTER_SYSTEM')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'player-image-private-markers.json', JSON.stringify(campaignWithPrivateImageMarkers()))
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  await waitForWorkspaceSaved(page)

  await returnToClusterMap(page)
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  await expect(clusterMap).toBeVisible()

  const sourceBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(sourceBefore.cluster?.name).toBe(clusterName)
  expect(sourceBefore.cluster?.playerTitle).toBe('Player Jump Cluster')
  expect(sourceBefore.cluster?.systems.some(system => system.name === 'PUBLIC_VESPER' && system.publication === 'revealed'))
    .toBe(true)
  expect(sourceBefore.cluster?.systems.some(system => system.name === 'PRIVATE_HIDDEN_SYSTEM' && system.publication === 'hidden'))
    .toBe(true)

  await setHeaderMapActionsOpen(page, true)
  const playerSvgAction = page.getByRole('button', { name: 'Export player SVG', exact: true })
  await expect(playerSvgAction).toBeVisible()

  const { image, download } = await capturePlayerImageDownload(page, 'Export player SVG', 'image/svg+xml')
  expect(download.suggestedFilename()).toBe('Player Jump Cluster-player-jump-cluster.svg')
  expect(download.suggestedFilename()).not.toContain(clusterName)
  expect(image.type).toContain('image/svg+xml')
  expect(image.text).toBeTruthy()
  if (!image.text) throw new Error('The player SVG download did not contain serialized content.')

  const inspection = await page.evaluate((content) => {
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml')
    const svg = parsed.documentElement
    if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) {
      throw new Error('The player SVG download is not a valid standalone SVG document.')
    }
    const elements = [svg, ...svg.querySelectorAll('*')]
    const attributes = elements.flatMap(element => [...element.attributes]
      .map(attribute => ({ name: attribute.name, value: attribute.value })))
    return {
      text: svg.textContent ?? '',
      accessibleLabels: [
        svg.getAttribute('aria-label') ?? '',
        ...[...svg.querySelectorAll('[aria-label]')]
          .map(element => element.getAttribute('aria-label') ?? ''),
      ],
      textNodes: [...svg.querySelectorAll('text')].map(element => (element.textContent ?? '').trim()),
      attributeValues: attributes.map(attribute => attribute.value),
      metadataAttributeNames: attributes.map(attribute => attribute.name)
        .filter(name => /(?:location.?key|source|(?:system|object|route|field).?id)/i.test(name)),
      ids: attributes.filter(attribute => attribute.name === 'id').map(attribute => attribute.value),
    }
  }, image.text)

  expect(inspection.text).toContain('PUBLIC_VESPER')
  expect(inspection.text).toContain('Jump Level 8')
  expect(inspection.text).toContain('Unknown destination')
  expect(inspection.accessibleLabels.join('\n')).toContain('Player Jump Cluster')

  const sourceIds = [
    sourceBefore.cluster?.id,
    ...(sourceBefore.cluster?.systems.flatMap(system => [
      system.id,
      ...system.objects.map(object => object.id),
      ...system.orbits.map(orbit => orbit.id),
    ]) ?? []),
    ...(sourceBefore.cluster?.routes.map(route => route.id) ?? []),
    ...sourceBefore.objectFieldSettings.customFields.map(field => field.id),
  ].filter((value): value is string => Boolean(value))
  const sourceLocationKeys = sourceBefore.cluster?.systems.flatMap(system =>
    system.objects.map(object => object.locationKey),
  ) ?? []
  const singleCharacterLocationKeys = sourceLocationKeys.filter(key => Array.from(key).length === 1)
  const privateMarkers = [
    sourceBefore.cluster?.name,
    ...(sourceBefore.cluster?.systems
      .filter(system => system.publication !== 'revealed')
      .map(system => system.name) ?? []),
    ...sourceBefore.cluster?.systems.flatMap(system => system.objects.flatMap(object => [
      object.name,
      object.description,
      object.playerText,
      ...Object.values(object.customFieldValues ?? {}).map(value => String(value)),
    ])) ?? [],
    ...sourceBefore.cluster?.routes.map(route => route.name) ?? [],
    ...sourceBefore.objectFieldSettings.customFields.flatMap(field => [
      field.name,
      ...(field.options ?? []),
    ]),
    'PRIVATE_INCOMING_TITLE',
    'PRIVATE_GM_FIELD_NAME',
    'PRIVATE_SHARED_ROUTE_NAME',
    'PRIVATE_UNSHARED_ROUTE_NAME',
  ].filter((value): value is string => Boolean(value) && value !== 'PUBLIC_VESPER')

  for (const privateMarker of [...privateMarkers, ...sourceLocationKeys.filter(key => key.length > 1), ...sourceIds]) {
    expect(image.text).not.toContain(privateMarker)
  }
  for (const sourceKey of singleCharacterLocationKeys) {
    expect(inspection.textNodes).not.toContain(sourceKey)
    expect(inspection.attributeValues).not.toContain(sourceKey)
  }
  expect(inspection.metadataAttributeNames).toEqual([])
  expect(inspection.ids).toEqual([])

  const sourceAfter = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(sourceAfter).toEqual(sourceBefore)
})

test('player PNG rasterizes the public cluster scene within bounds without changing Warden state', async ({ page }) => {
  const clusterName = 'PRIVATE_WARDEN_CHART'
  await page.emulateMedia({ colorScheme: 'dark' })
  await captureMapExportBlobs(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Give the unknown a name.' })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Jump Cluster', { exact: true }).fill(clusterName)
  await page.getByLabel('First star system', { exact: true }).fill('PRIVATE_STARTER_SYSTEM')
  await page.getByRole('button', { name: 'Create local workspace', exact: true }).click()
  await returnToClusterMap(page)

  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Import JSON copy', exact: true }).click()
  await setHeaderMapActionsOpen(page, false)
  await setJsonFile(jsonMapImportInput(page), 'player-image-private-markers.json', JSON.stringify(campaignWithPrivateImageMarkers()))
  const review = importReviewDialog(page)
  await expect(review).toBeVisible()
  await resolveImportReview(review, 'confirm')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)

  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  await expect(clusterMap).toBeVisible()
  const sourceBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  const cameraBefore = await clusterMap.locator('.cluster-map-content').getAttribute('transform')
  const selectionCountBefore = await clusterMap.locator('.is-selected').count()
  const history = page.getByRole('group', { name: 'Edit history', exact: true })
  const historyBefore = await history.innerText()
  const pagePaletteBefore = await page.locator('html').getAttribute('class')

  await setHeaderMapActionsOpen(page, true)
  const printChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
  const printChoiceBefore = await printChoice.isChecked()
  await setHeaderMapActionsOpen(page, false)

  const { image: png, download: pngDownload } = await capturePlayerImageDownload(
    page,
    'Export player PNG',
    'image/png',
  )
  expect(pngDownload.suggestedFilename()).toBe('Player Jump Cluster-player-jump-cluster.png')
  expect(pngDownload.suggestedFilename()).not.toContain(clusterName)

  const pngPath = test.info().outputPath('player-cluster.png')
  await pngDownload.saveAs(pngPath)
  await test.info().attach('player-cluster-png', { path: pngPath, contentType: 'image/png' })
  if (!png.sourceSvgText) throw new Error('The player PNG download has no intermediate SVG.')
  await test.info().attach('player-cluster-png-source-svg', {
    body: png.sourceSvgText,
    contentType: 'image/svg+xml',
  })

  expect(png.type).toContain('image/png')
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(png.width).toBeGreaterThan(0)
  expect(png.height).toBeGreaterThan(0)
  expect(png.width).toBeLessThanOrEqual(4096)
  expect(png.height).toBeLessThanOrEqual(4096)
  expect((png.width ?? 0) * (png.height ?? 0)).toBeLessThanOrEqual(4_194_304)

  const inspection = await page.evaluate((content) => {
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml')
    const svg = parsed.documentElement
    if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) {
      throw new Error('The player PNG intermediate SVG is invalid.')
    }
    const elements = [svg, ...svg.querySelectorAll('*')]
    const attributes = elements.flatMap(element => [...element.attributes]
      .map(attribute => ({ name: attribute.name, value: attribute.value })))
    return {
      text: svg.textContent ?? '',
      textNodes: [...svg.querySelectorAll('text')].map(element => (element.textContent ?? '').trim()),
      attributeValues: attributes.map(attribute => attribute.value),
      metadataAttributeNames: attributes.map(attribute => attribute.name)
        .filter(name => /(?:location.?key|source|(?:system|object|route|field).?id)/i.test(name)),
      ids: attributes.filter(attribute => attribute.name === 'id').map(attribute => attribute.value),
    }
  }, png.sourceSvgText)
  expect(inspection.text).toContain('PUBLIC_VESPER')
  expect(inspection.text).toContain('Jump Level 8')
  expect(inspection.text).toContain('Unknown destination')

  const sourceIds = [
    sourceBefore.cluster?.id,
    ...(sourceBefore.cluster?.systems.flatMap(system => [
      system.id,
      ...system.objects.map(object => object.id),
      ...system.orbits.map(orbit => orbit.id),
    ]) ?? []),
    ...(sourceBefore.cluster?.routes.map(route => route.id) ?? []),
    ...sourceBefore.objectFieldSettings.customFields.map(field => field.id),
  ].filter((value): value is string => Boolean(value))
  const sourceLocationKeys = sourceBefore.cluster?.systems.flatMap(system =>
    system.objects.map(object => object.locationKey),
  ) ?? []
  const privateMarkers = [
    sourceBefore.cluster?.name,
    ...(sourceBefore.cluster?.systems
      .filter(system => system.publication !== 'revealed')
      .map(system => system.name) ?? []),
    ...sourceBefore.cluster?.systems.flatMap(system => system.objects.flatMap(object => [
      object.name,
      object.description,
      object.playerText,
      ...Object.values(object.customFieldValues ?? {}).map(value => String(value)),
    ])) ?? [],
    ...sourceBefore.cluster?.routes.map(route => route.name) ?? [],
    ...sourceBefore.objectFieldSettings.customFields.flatMap(field => [field.name, ...(field.options ?? [])]),
    'PRIVATE_INCOMING_TITLE',
  ].filter((value): value is string => Boolean(value) && value !== 'PUBLIC_VESPER')
  for (const privateMarker of [...privateMarkers, ...sourceLocationKeys.filter(key => key.length > 1), ...sourceIds]) {
    expect(png.sourceSvgText).not.toContain(privateMarker)
  }
  for (const sourceKey of sourceLocationKeys.filter(key => Array.from(key).length === 1)) {
    expect(inspection.textNodes).not.toContain(sourceKey)
    expect(inspection.attributeValues).not.toContain(sourceKey)
  }
  expect(inspection.metadataAttributeNames).toEqual([])
  expect(inspection.ids).toEqual([])

  const sourceAfter = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(sourceAfter).toEqual(sourceBefore)
  expect(await clusterMap.locator('.cluster-map-content').getAttribute('transform')).toBe(cameraBefore)
  expect(await clusterMap.locator('.is-selected').count()).toBe(selectionCountBefore)
  expect(await history.innerText()).toBe(historyBefore)
  expect(await page.locator('html').getAttribute('class')).toBe(pagePaletteBefore)
  await setHeaderMapActionsOpen(page, true)
  expect(await page.getByRole('checkbox', { name: /^Light for printing$/i }).isChecked()).toBe(printChoiceBefore)
  await setHeaderMapActionsOpen(page, false)
})

test('Revealed system images preserve anonymous host geometry in active and light-print palettes', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ colorScheme: 'dark' })
  await importPlayerImageFixture(page, campaignWithNestedPublicSystem())
  const sourceBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  await setWorkspaceMapMode(page, 'Navigate')
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const publicSystemEntry = hierarchy.getByRole('button', {
    name: 'Open PUBLIC_SYSTEM_NAME system map',
    exact: true,
  })
  await expect(publicSystemEntry).toBeVisible()
  await publicSystemEntry.click()
  const hierarchyClose = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await hierarchyClose.isVisible().catch(() => false)) await hierarchyClose.click()
  const systemMap = page.getByRole('group', { name: 'PUBLIC_SYSTEM_NAME star system map', exact: true })
  await expect(systemMap).toBeVisible()

  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  const darkMapBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim(),
  )
  expect(darkMapBackground).toBe('#0c1719')
  const systemCameraBefore = await systemMap.locator('.system-map-content').getAttribute('transform')
  const systemSelectionBefore = await systemMap.locator('.is-selected').count()
  const history = page.getByRole('group', { name: 'Edit history', exact: true })
  const historyBefore = await history.innerText()

  const { image: activeSvg, download: activeSvgDownload } = await capturePlayerImageDownload(
    page,
    'Export player SVG',
    'image/svg+xml',
  )
  expect(activeSvgDownload.suggestedFilename()).toBe('PUBLIC_SYSTEM_NAME-player-star-system.svg')
  expect(activeSvgDownload.suggestedFilename()).not.toContain('PRIVATE_WARDEN_CHART')
  if (!activeSvg.text) throw new Error('The Revealed system SVG did not contain serialized content.')
  await test.info().attach('revealed-system-active-svg', {
    body: activeSvg.text,
    contentType: 'image/svg+xml',
  })

  const active = await inspectPlayerImageSvg(page, activeSvg.text)
  expect(active.rootLabel).toBe('PUBLIC_SYSTEM_NAME player system map')
  expect(active.textNodes).toContain('PUBLIC_SYSTEM_NAME')
  expect(active.textNodes).toContain('PUBLIC_NIX')
  expect(active.markerLabels).toEqual(['Star', 'Unknown presence', 'PUBLIC_NIX'])
  expect(active.markerCircleCounts).toEqual([0, 1, 0])
  expect(active.knownMarkerCount).toBe(1)
  expect(active.unknownMarkerCount).toBe(1)
  expect(active.revealedMarkerCount).toBe(1)
  expect(active.orbitCount).toBe(2)
  expect(active.markerGlyphs).toEqual(['✦', null, '☾'])
  expect(active.orbitDashPatterns).toEqual(['3 6', '3 6'])
  expect(active.markerHitTargetCount).toBe(0)
  const activeBackgroundFill = requireSvgColor(active.backgroundFill, 'background')
  expect(activeBackgroundFill).toBe('#0c1719')
  expect(active.textFills.length).toBeGreaterThan(0)
  for (const fill of active.textFills) expect(contrastRatio(fill, activeBackgroundFill)).toBeGreaterThanOrEqual(4.5)
  const activeKnownGlyphFill = requireSvgColor(active.knownGlyphFill, 'known-type glyph fill')
  expect(activeKnownGlyphFill).toBe('#c0cbc4')
  expect(contrastRatio(activeKnownGlyphFill, activeBackgroundFill)).toBeGreaterThanOrEqual(3)
  const activeRevealedFill = requireSvgColor(active.revealedGlyphFill, 'revealed glyph fill')
  expect(activeRevealedFill).toBe('#efa16f')
  expect(contrastRatio(activeRevealedFill, activeBackgroundFill)).toBeGreaterThanOrEqual(3)
  const activeUnknownStroke = requireSvgColor(active.unknownStroke, 'unknown marker stroke')
  expect(activeUnknownStroke).toBe('#9caaa2')
  expect(contrastRatio(activeUnknownStroke, activeBackgroundFill)).toBeGreaterThanOrEqual(3)

  const sourceCanaries = sourceSystemPrivateCanaries(sourceBefore, ['PUBLIC_SYSTEM_NAME', 'PUBLIC_NIX'])
  for (const privateMarker of [...sourceCanaries.markers, ...sourceCanaries.multiCharacterLocationKeys, ...sourceCanaries.ids]) {
    expect(activeSvg.text).not.toContain(privateMarker)
  }
  for (const sourceKey of sourceCanaries.singleCharacterLocationKeys) {
    expect(active.textNodes).not.toContain(sourceKey)
    expect(active.attributeValues).not.toContain(sourceKey)
  }
  expect(active.metadataAttributeNames).toEqual([])
  expect(active.ids).toEqual([])

  await setHeaderMapActionsOpen(page, true)
  const printChoice = page.getByRole('checkbox', { name: /^Light for printing$/i })
  await printChoice.check()
  expect(await printChoice.isChecked()).toBe(true)
  await setHeaderMapActionsOpen(page, false)

  const { image: printPng, download: printPngDownload } = await capturePlayerImageDownload(
    page,
    'Export player PNG',
    'image/png',
  )
  expect(printPngDownload.suggestedFilename()).toBe('PUBLIC_SYSTEM_NAME-player-star-system.png')
  expect(printPngDownload.suggestedFilename()).not.toContain('PRIVATE_WARDEN_CHART')
  const pngPath = test.info().outputPath('revealed-system-player.png')
  await printPngDownload.saveAs(pngPath)
  await test.info().attach('revealed-system-player-png', { path: pngPath, contentType: 'image/png' })
  if (!printPng.sourceSvgText) throw new Error('The Revealed system PNG did not contain its intermediate SVG.')
  await test.info().attach('revealed-system-print-light-source-svg', {
    body: printPng.sourceSvgText,
    contentType: 'image/svg+xml',
  })

  expect(printPng.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(printPng.width).toBeGreaterThan(0)
  expect(printPng.height).toBeGreaterThan(0)
  expect(printPng.width).toBeLessThanOrEqual(4096)
  expect(printPng.height).toBeLessThanOrEqual(4096)
  expect((printPng.width ?? 0) * (printPng.height ?? 0)).toBeLessThanOrEqual(4_194_304)

  const printed = await inspectPlayerImageSvg(page, printPng.sourceSvgText)
  expect(printed.rootLabel).toBe(active.rootLabel)
  expect(printed.textNodes).toEqual(active.textNodes)
  expect(printed.markerLabels).toEqual(active.markerLabels)
  expect(printed.markerCircleCounts).toEqual(active.markerCircleCounts)
  expect(printed.knownMarkerCount).toBe(1)
  expect(printed.unknownMarkerCount).toBe(1)
  expect(printed.revealedMarkerCount).toBe(1)
  expect(printed.orbitCount).toBe(2)
  expect(printed.markerGlyphs).toEqual(active.markerGlyphs)
  expect(printed.markerHitTargetCount).toBe(0)
  expect(printed.orbitDashPatterns).toEqual(active.orbitDashPatterns)
  const printedBackgroundFill = requireSvgColor(printed.backgroundFill, 'print background')
  expect(printedBackgroundFill).toBe('#f5f4ee')
  expect(printed.textFills.length).toBeGreaterThan(0)
  for (const fill of printed.textFills) expect(contrastRatio(fill, printedBackgroundFill)).toBeGreaterThanOrEqual(4.5)
  const printedKnownGlyphFill = requireSvgColor(printed.knownGlyphFill, 'print known-type glyph fill')
  expect(printedKnownGlyphFill).toBe('#45504a')
  expect(contrastRatio(printedKnownGlyphFill, printedBackgroundFill)).toBeGreaterThanOrEqual(3)
  const printedRevealedFill = requireSvgColor(printed.revealedGlyphFill, 'print revealed glyph fill')
  expect(printedRevealedFill).toBe('#9c4a16')
  expect(contrastRatio(printedRevealedFill, printedBackgroundFill)).toBeGreaterThanOrEqual(3)
  const printedUnknownStroke = requireSvgColor(printed.unknownStroke, 'print unknown marker stroke')
  expect(printedUnknownStroke).toBe('#59645d')
  expect(contrastRatio(printedUnknownStroke, printedBackgroundFill)).toBeGreaterThanOrEqual(3)
  for (const privateMarker of [...sourceCanaries.markers, ...sourceCanaries.multiCharacterLocationKeys, ...sourceCanaries.ids]) {
    expect(printPng.sourceSvgText).not.toContain(privateMarker)
  }
  for (const sourceKey of sourceCanaries.singleCharacterLocationKeys) {
    expect(printed.textNodes).not.toContain(sourceKey)
    expect(printed.attributeValues).not.toContain(sourceKey)
  }
  expect(printed.metadataAttributeNames).toEqual([])
  expect(printed.ids).toEqual([])

  const playerFile = await downloadPlayerJsonDocument(page)
  expect(playerFile.fileName).toBe(`${sourceBefore.cluster?.playerTitle}-player-jump-cluster.json`)
  expect(playerFile.document.title).toBe(sourceBefore.cluster?.playerTitle)
  const projectedSystem = playerFile.document.systems.find((marker): marker is Extract<
    PlayerSystemMarker,
    { disclosure: 'revealed' }
  > => marker.disclosure === 'revealed' && marker.label === 'PUBLIC_SYSTEM_NAME')
  if (!projectedSystem) throw new Error('The whole-cluster player JSON is missing its Revealed system map.')

  const expectedMarkerTransforms = projectedSystem.map.objects.map(object => ({
    label: object.label,
    transform: `translate(${object.position.x} ${object.position.y})`,
  }))
  const expectedOrbitEllipses = projectedSystem.map.orbits.map(orbit => ({
    cx: String(orbit.center.x),
    cy: String(orbit.center.y),
    rx: String(orbit.radii.horizontal),
    ry: String(orbit.radii.vertical),
    transform: `rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`,
  }))
  expect(active.markerTransforms).toEqual(expectedMarkerTransforms)
  expect(active.orbitEllipses).toEqual(expectedOrbitEllipses)
  expect(printed.markerTransforms).toEqual(expectedMarkerTransforms)
  expect(printed.orbitEllipses).toEqual(expectedOrbitEllipses)

  for (const privateMarker of sourceCanaries.markers.filter(value => value !== 'PRIVATE_REVEALED_OBJECT_PLAYER_TEXT')) {
    expect(playerFile.text).not.toContain(privateMarker)
  }
  for (const sourceKey of sourceCanaries.multiCharacterLocationKeys) expect(playerFile.text).not.toContain(sourceKey)
  for (const sourceKey of sourceCanaries.singleCharacterLocationKeys) {
    expect(playerFile.text).not.toContain(JSON.stringify(sourceKey))
  }
  expect(playerFile.text).not.toContain('"locationKey"')
  for (const sourceId of sourceCanaries.ids) expect(playerFile.text).not.toContain(sourceId)

  expect(await systemMap.locator('.system-map-content').getAttribute('transform')).toBe(systemCameraBefore)
  expect(await systemMap.locator('.is-selected').count()).toBe(systemSelectionBefore)
  expect(await history.innerText()).toBe(historyBefore)
  expect(await page.locator('html').getAttribute('class')).toMatch(/\bdark\b/)
  await setHeaderMapActionsOpen(page, true)
  expect(await page.getByRole('checkbox', { name: /^Light for printing$/i }).isChecked()).toBe(false)
  await setHeaderMapActionsOpen(page, false)
  expect(await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim(),
  )).toBe(darkMapBackground)

  await returnToClusterMap(page)
  const sourceAfter = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(sourceAfter).toEqual(sourceBefore)
})

test('empty Revealed and partial current systems are refused for player images', async ({ page }) => {
  await importPlayerImageFixture(page, campaignWithImageEligibilityCases())
  const sourceBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  const observedDownloads: string[] = []
  const observeDownload = (download: import('@playwright/test').Download) => {
    observedDownloads.push(download.suggestedFilename())
  }
  page.on('download', observeDownload)

  await setWorkspaceMapMode(page, 'Navigate')
  const emptySystemHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await emptySystemHierarchy.getByRole('button', {
    name: 'Open PUBLIC_EMPTY_SYSTEM system map', exact: true,
  }).click()
  const closeEmptySystemHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closeEmptySystemHierarchy.isVisible().catch(() => false)) await closeEmptySystemHierarchy.click()
  await expect(page.getByRole('group', { name: 'PUBLIC_EMPTY_SYSTEM star system map', exact: true })).toBeVisible()
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Export player SVG', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This player map has no public features to export as an image.')
  await setHeaderMapActionsOpen(page, false)
  expect(observedDownloads).toEqual([])

  const playerFile = await downloadPlayerJsonDocument(page)
  expect(playerFile.fileName).toBe(`${sourceBefore.cluster?.playerTitle}-player-jump-cluster.json`)
  expect(playerFile.document.title).toBe(sourceBefore.cluster?.playerTitle)
  const publicEmptySystem = playerFile.document.systems.find((marker): marker is Extract<
    PlayerSystemMarker,
    { disclosure: 'revealed' }
  > => marker.disclosure === 'revealed' && marker.label === 'PUBLIC_EMPTY_SYSTEM')
  if (!publicEmptySystem) throw new Error('The whole-cluster player JSON is missing its empty Revealed system.')
  expect(publicEmptySystem.map.objects).toEqual([])
  expect(publicEmptySystem.map.orbits).toEqual([])
  expect(observedDownloads).toEqual([playerFile.fileName])
  const playerJsonCanaries = sourceSystemPrivateCanaries(sourceBefore, ['PUBLIC_EMPTY_SYSTEM'])
  for (const privateMarker of playerJsonCanaries.markers) expect(playerFile.text).not.toContain(privateMarker)
  for (const sourceKey of playerJsonCanaries.locationKeys) expect(playerFile.text).not.toContain(sourceKey)
  for (const sourceId of playerJsonCanaries.ids) expect(playerFile.text).not.toContain(sourceId)
  observedDownloads.length = 0

  await returnToClusterMap(page)
  await setWorkspaceMapMode(page, 'Navigate')
  const partialSystemHierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  await partialSystemHierarchy.getByRole('button', {
    name: 'Open PRIVATE_PARTIAL_SYSTEM system map', exact: true,
  }).click()
  const closePartialSystemHierarchy = page.getByRole('button', { name: 'Close hierarchy panel', exact: true })
  if (await closePartialSystemHierarchy.isVisible().catch(() => false)) await closePartialSystemHierarchy.click()
  await expect(page.getByRole('group', { name: 'PRIVATE_PARTIAL_SYSTEM star system map', exact: true })).toBeVisible()
  await setHeaderMapActionsOpen(page, true)
  await page.getByRole('button', { name: 'Export player PNG', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The current system is not revealed for player image export.')
  await setHeaderMapActionsOpen(page, false)
  expect(observedDownloads).toEqual([])
  page.off('download', observeDownload)

  await returnToClusterMap(page)
  const sourceAfter = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(sourceAfter).toEqual(sourceBefore)
})
