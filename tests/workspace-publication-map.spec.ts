import { expect, test } from './fixtures'
import {
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  downloadImage,
} from './helpers'

function expectNoAdministrativePublicationMarkup(svg: string): void {
  expect(svg).not.toContain('gm-publication')
  expect(svg).not.toContain('Configured visibility:')
  expect(svg).not.toContain('System map unavailable to players')
  expect(svg).not.toContain('Required orbital hosts may appear as Unknown')
}

async function expectSvgViewBoxContainsFeatureGroups(
  page: import('@playwright/test').Page,
  svgText: string,
  kind: 'cluster' | 'system',
): Promise<void> {
  const geometry = await page.evaluate(({ content, mapKind }) => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement as unknown as SVGSVGElement
    const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number)
    if (!viewBox || viewBox.length !== 4) throw new Error('The exported map has no finite view box.')
    const host = document.createElement('div')
    Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden' })
    host.append(svg)
    document.body.append(host)
    try {
      const selectors = mapKind === 'cluster' ? ['.cluster-map-items'] : ['.system-map-items', '.system-orbits']
      const boxes = selectors.flatMap(selector => {
        const group = svg.querySelector<SVGGElement>(selector)
        if (!group) return []
        const { x, y, width, height } = group.getBBox()
        return width > 0 || height > 0 ? [{ x, y, width, height }] : []
      })
      if (boxes.length === 0) throw new Error('The exported map has no measurable feature groups.')
      const left = Math.min(...boxes.map(box => box.x))
      const top = Math.min(...boxes.map(box => box.y))
      const right = Math.max(...boxes.map(box => box.x + box.width))
      const bottom = Math.max(...boxes.map(box => box.y + box.height))
      return { viewBox, left, top, right, bottom }
    } finally {
      host.remove()
    }
  }, { content: svgText, mapKind: kind })

  const [viewLeft, viewTop, viewWidth, viewHeight] = geometry.viewBox
  if (viewLeft === undefined || viewTop === undefined || viewWidth === undefined || viewHeight === undefined) {
    throw new Error('The exported map has an incomplete view box.')
  }
  const titleBand = kind === 'system' ? 48 : 0
  // Remeasuring serialized ink must preserve the outward-rounded padding,
  // including an integer boundary; badge independence is checked exactly below.
  for (const padding of [geometry.left - viewLeft, geometry.top - viewTop - titleBand, viewTop + viewHeight - geometry.bottom]) {
    expect(padding).toBeGreaterThanOrEqual(24)
    expect(padding).toBeLessThanOrEqual(25)
  }
  expect(viewLeft + viewWidth - geometry.right).toBeGreaterThanOrEqual(24)
  expect(viewWidth).toBeGreaterThanOrEqual(geometry.right - geometry.left + 48)
}

async function exportedFeatureGeometry(page: import('@playwright/test').Page, svgText: string) {
  return page.evaluate(content => {
    const svg = new DOMParser().parseFromString(content, 'image/svg+xml').documentElement
    return {
      viewBox: svg.getAttribute('viewBox'),
      transforms: Array.from(svg.querySelectorAll('.cluster-map-items [transform], .system-map-items [transform], .system-orbits [transform]'))
        .map(element => [element.tagName, element.getAttribute('class'), element.getAttribute('transform')]),
    }
  }, svgText)
}

async function downloadWithoutPublicationDecorations(page: import('@playwright/test').Page, buttonName: string) {
  const detached = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('.gm-publication-decorations, .gm-publication-description')).map(element => {
      const saved = { element, parent: element.parentNode, next: element.nextSibling }
      element.remove()
      return saved
    }),
  )
  try {
    return await downloadImage(page, buttonName, 'image/svg+xml')
  } finally {
    await detached.evaluate(records => {
      for (const { element, parent, next } of records) {
        parent?.insertBefore(element, next?.parentNode === parent ? next : null)
      }
    })
    await detached.dispose()
  }
}

test('GM visibility badges stay outside map geometry and are omitted from both image exports', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { clusterName, systemName } = await createSingleSystemWorkspace(page)
  const systemSourceBefore = await downloadJson(page, 'Export star system JSON')
  await page.evaluate(async () => { await document.fonts.ready })
  const systemMap = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  const object = systemMap.locator('.system-object[data-object-id]').first()
  const originalObjectName = await object.getAttribute('aria-label')
  expect(originalObjectName).toBeTruthy()
  await expect(object).toHaveAttribute('aria-describedby', /^gm-publication-description-/)
  await expect(systemMap.locator('.gm-publication-decorations')).toHaveAttribute('aria-hidden', 'true')
  await expect(systemMap.locator('.gm-publication-decorations')).toHaveAttribute('pointer-events', 'none')
  await expect(systemMap.locator('.system-map-items .gm-publication-badge')).toHaveCount(0)
  await expect(systemMap.locator('.gm-publication-decorations .gm-publication-badge')).toHaveCount(1)
  await expect(systemMap.locator('.gm-publication-lock-icon')).toHaveCount(1)
  await expect(systemMap.locator('desc.gm-publication-description'))
    .toContainText('Configured visibility: Known type')
  await expect(systemMap.locator('desc.gm-publication-description'))
    .toContainText('System map unavailable to players until this system is Revealed.')
  await expect(object).toHaveAttribute('aria-label', originalObjectName!)

  const systemFeaturesBefore = await systemMap.locator('.system-map-items').evaluate(group => {
    if (!(group instanceof SVGGraphicsElement)) throw new Error('The system feature group is not an SVG graphics element.')
    const { x, y, width, height } = group.getBBox()
    return [x, y, width, height]
  })
  const systemImage = await downloadImage(page, 'Export star system SVG', 'image/svg+xml')
  expectNoAdministrativePublicationMarkup(systemImage.text!)
  await expectSvgViewBoxContainsFeatureGroups(page, systemImage.text!, 'system')
  const systemWithoutDecorations = await downloadWithoutPublicationDecorations(page, 'Export star system SVG')
  expectNoAdministrativePublicationMarkup(systemWithoutDecorations.text!)
  expect(await exportedFeatureGeometry(page, systemWithoutDecorations.text!))
    .toEqual(await exportedFeatureGeometry(page, systemImage.text!))
  const systemFeaturesAfter = await systemMap.locator('.system-map-items').evaluate(group => {
    if (!(group instanceof SVGGraphicsElement)) throw new Error('The system feature group is not an SVG graphics element.')
    const { x, y, width, height } = group.getBBox()
    return [x, y, width, height]
  })
  expect(systemFeaturesAfter).toEqual(systemFeaturesBefore)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(systemSourceBefore)

  await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
  const clusterSourceBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  const system = clusterMap.locator('.cluster-system-node[data-system-id]').first()
  await expect(clusterMap.locator('.gm-publication-decorations')).toHaveAttribute('aria-hidden', 'true')
  await expect(clusterMap.locator('.gm-publication-decorations')).toHaveAttribute('pointer-events', 'none')
  await expect(clusterMap.locator('.cluster-map-items .gm-publication-badge')).toHaveCount(0)
  await expect(clusterMap.locator('.gm-publication-decorations .gm-publication-badge')).toHaveCount(1)
  await expect(system).toHaveAttribute('aria-describedby', /^gm-publication-description-/)
  await expect(clusterMap.locator('desc.gm-publication-description'))
    .toContainText('Configured visibility: Known type')

  const clusterImage = await downloadImage(page, 'Export Jump Cluster SVG', 'image/svg+xml')
  expectNoAdministrativePublicationMarkup(clusterImage.text!)
  await expectSvgViewBoxContainsFeatureGroups(page, clusterImage.text!, 'cluster')
  const clusterWithoutDecorations = await downloadWithoutPublicationDecorations(page, 'Export Jump Cluster SVG')
  expectNoAdministrativePublicationMarkup(clusterWithoutDecorations.text!)
  expect(await exportedFeatureGeometry(page, clusterWithoutDecorations.text!))
    .toEqual(await exportedFeatureGeometry(page, clusterImage.text!))
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(clusterSourceBefore)
})

test('map visibility badges follow live Move previews and roll back without changing map geometry', async ({ page }) => {
  await captureMapExportBlobs(page)
  const { clusterName, systemName } = await createSingleSystemWorkspace(page)
  const map = page.getByRole('group', { name: `${systemName} star system map`, exact: true })
  const object = map.locator('.system-object[data-object-id]').first()
  const badge = map.locator('.system-object-publication[data-object-id]').first()
  const before = await downloadJson(page, 'Export star system JSON')
  const originalTransform = await object.getAttribute('transform')
  await expect(badge).toHaveAttribute('transform', originalTransform!)
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move' }).click()

  const bounds = await object.boundingBox()
  expect(bounds).not.toBeNull()
  const startX = bounds!.x + bounds!.width / 2
  const startY = bounds!.y + bounds!.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 48, startY + 30, { steps: 4 })
  await expect(object).not.toHaveAttribute('transform', originalTransform!)
  const previewTransform = await object.getAttribute('transform')
  await expect(badge).toHaveAttribute('transform', previewTransform!)

  // Browser blur owns the same rollback path as a focus interruption; the pointer is still held.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  await expect(object).toHaveAttribute('transform', originalTransform!)
  await expect(badge).toHaveAttribute('transform', originalTransform!)
  expect(await downloadJson(page, 'Export star system JSON')).toEqual(before)

  await page.getByRole('button', { name: 'Back to Jump Cluster', exact: true }).click()
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  const system = clusterMap.locator('.cluster-system-node[data-system-id]').first()
  const systemBadge = clusterMap.locator('.cluster-system-publication[data-system-id]').first()
  const clusterBefore = await downloadJson(page, 'Export Jump Cluster JSON')
  await page.getByRole('group', { name: 'Map interaction mode' }).getByRole('button', { name: 'Move', exact: true }).click()
  const originalSystemTransform = await system.getAttribute('transform')
  await expect(systemBadge).toHaveAttribute('transform', originalSystemTransform!)

  const systemBounds = await system.boundingBox()
  expect(systemBounds).not.toBeNull()
  const systemStartX = systemBounds!.x + systemBounds!.width / 2
  const systemStartY = systemBounds!.y + systemBounds!.height / 2
  await page.mouse.move(systemStartX, systemStartY)
  await page.mouse.down()
  await page.mouse.move(systemStartX + 52, systemStartY + 28, { steps: 4 })
  await expect(system).not.toHaveAttribute('transform', originalSystemTransform!)
  const systemPreviewTransform = await system.getAttribute('transform')
  await expect(systemBadge).toHaveAttribute('transform', systemPreviewTransform!)

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  await expect(system).toHaveAttribute('transform', originalSystemTransform!)
  await expect(systemBadge).toHaveAttribute('transform', originalSystemTransform!)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(clusterBefore)
})
