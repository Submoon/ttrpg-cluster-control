import { expect, test } from './fixtures'
import { createLocalWorkspace, exportJumpCluster } from '../domain/workspace'
import {
  createSingleSystemWorkspace,
  jsonMapImportInput,
  resolveImportReview,
  setJsonFile,
} from './helpers'
import { expectPaletteOptionActive } from './scenarios/search-palette'

function repeatedSystemImportContent(clusterName: string, systemName: string, systemCount: number): string {
  const source = createLocalWorkspace(clusterName, systemName)
  const systems = [...source.cluster.systems]
  const systemPositions = { ...source.layout.systemPositions }

  for (let index = 1; index < systemCount; index += 1) {
    const importedSource = createLocalWorkspace(clusterName, systemName)
    const system = importedSource.cluster.systems[0]
    if (!system) throw new Error('The repeated-system import needs a star system.')
    systems.push(system)
    systemPositions[system.id] = { x: 0.2 + (index % 4) * 0.16, y: 0.2 + Math.floor(index / 4) * 0.18 }
  }

  const firstSystem = systems[0]
  const objectTemplate = firstSystem?.objects[0]
  if (!firstSystem || !objectTemplate) throw new Error('The repeated-system import needs a primary star.')
  systems[0] = {
    ...firstSystem,
    objects: [...firstSystem.objects, {
      ...objectTemplate,
      id: 'custom-search-other',
      family: 'Other' as const,
      subtype: 'Signal ghost',
      locationKey: 'GHOST-01',
      name: 'New Other Beacon',
    }],
  }

  return JSON.stringify(exportJumpCluster({
    ...source,
    cluster: { ...source.cluster, systems },
    layout: { ...source.layout, systemPositions },
  }))
}

test('Search result marks stay decorative and readable, then activate an existing result @preview-smoke', async ({ page }, testInfo) => {
  const clusterName = 'Kestrel Reach beyond the Beacon near the Outer Spiral'
  const systemName = 'Vesper in the Observatory of the Quiet Outer Lanterns'
  await createSingleSystemWorkspace(page, {
    clusterName,
    systemName,
    viewport: { width: 390, height: 844 },
  })

  await setJsonFile(jsonMapImportInput(page), 'matching-systems.json', repeatedSystemImportContent(clusterName, systemName, 2))
  const importReview = page.getByRole('dialog', { name: 'Review import', exact: true })
  await resolveImportReview(importReview, 'confirm')
  await expect(importReview).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await expect(searchDialog).toBeVisible()

  await query.fill(clusterName)
  const clusterResult = searchDialog.getByRole('option', { name: new RegExp(`${clusterName}.*Jump Cluster.*Current workspace`) })
  await expect(clusterResult).toBeVisible()
  const clusterMark = clusterResult.locator('.workspace-search-result-mark')
  await expect(clusterMark).toHaveAttribute('aria-hidden', 'true')
  await expectRenderedCommandIcon(clusterMark)

  await query.fill(systemName)
  const systemResults = searchDialog.getByRole('listbox').getByRole('option')
  await expect(systemResults).toHaveCount(3)
  await expect(systemResults.first()).toHaveAccessibleName(new RegExp(`${systemName}.*Star System.*Jump Cluster: ${clusterName}.*Occurrence 1`))
  await expect(systemResults.last()).toHaveAccessibleName(new RegExp(`${systemName}.*Star System.*Jump Cluster: ${clusterName}.*Occurrence 3`))

  const firstSystemResult = systemResults.first()
  const systemMark = firstSystemResult.locator('.workspace-search-result-mark')
  await expect(systemMark).toHaveAttribute('aria-hidden', 'true')
  await expectRenderedCommandIcon(systemMark)
  const desktopScreenshot = testInfo.outputPath('search-result-icons-desktop.png')
  await page.screenshot({ path: desktopScreenshot, animations: 'disabled' })
  await testInfo.attach('search-result-icons-desktop', { path: desktopScreenshot, contentType: 'image/png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(searchDialog).toBeVisible()
  const resultBounds = await firstSystemResult.boundingBox()
  const resultNameBounds = await firstSystemResult.locator('.workspace-search-result-name').boundingBox()
  const markBounds = await systemMark.boundingBox()
  if (!resultBounds || !resultNameBounds || !markBounds) throw new Error('The compact Search result has no visible layout bounds.')
  expect(resultBounds.width).toBeLessThanOrEqual(390)
  expect(resultBounds.height).toBeGreaterThanOrEqual(44)
  expect(resultNameBounds.height).toBeGreaterThan(20)
  expect(markBounds.x + markBounds.width).toBeLessThan(resultNameBounds.x)
  const compactScreenshot = testInfo.outputPath('search-result-icons-compact.png')
  await page.screenshot({ path: compactScreenshot, animations: 'disabled' })
  await testInfo.attach('search-result-icons-compact', { path: compactScreenshot, contentType: 'image/png' })

  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, firstSystemResult)
  const highlightedResult = searchDialog.locator('.workspace-search-result[data-highlighted]')
  await expect(highlightedResult).toHaveCount(1)
  expect(await highlightedResult.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')

  await query.fill('Primary Star')
  const starResult = searchDialog.getByRole('option', { name: /Primary Star.*Star.*Location key: A/i }).first()
  await expect(starResult).toBeVisible()
  await expect(starResult).toContainText('Star System')
  await expect(starResult).toContainText(`Star · Star System: ${systemName}`)
  const starMark = starResult.locator('.workspace-search-result-mark')
  await expect(starMark).toHaveAttribute('aria-hidden', 'true')
  await expect(starMark).toHaveText('✦')

  await query.fill('New Other Beacon')
  const otherResult = searchDialog.getByRole('option', { name: /New Other Beacon.*Signal ghost.*Location key:/i })
  await expect(otherResult).toBeVisible()
  await expect(otherResult).toContainText('Star System')
  const otherMark = otherResult.locator('.workspace-search-result-mark')
  await expect(otherMark).toHaveAttribute('aria-hidden', 'true')
  await expect(otherMark).toHaveText('◇')

  await query.fill(clusterName)
  await expect(clusterResult).toBeVisible()
  await clusterResult.click()
  const clusterMap = page.getByRole('group', { name: `${clusterName} Jump Cluster map`, exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(clusterMap).toBeFocused()
})

async function expectRenderedCommandIcon(mark: import('@playwright/test').Locator): Promise<void> {
  const icon = mark.locator('.workspace-search-result-icon')
  await expect(icon).toHaveCount(1)
  const readPresentation = () => icon.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      isCssIcon: element.localName === 'span' && element.classList.contains('iconify'),
      isSvg: element.localName === 'svg',
      hasSvgDrawing: element.localName === 'svg' && element.querySelector('path, circle, rect, polygon, line, polyline, ellipse, g') !== null,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      maskImage: style.maskImage,
      webkitMaskImage: style.webkitMaskImage,
    }
  })

  await expect.poll(async () => {
    const presentation = await readPresentation()
    return presentation.isCssIcon
      ? presentation.maskImage !== 'none' || presentation.webkitMaskImage !== 'none'
      : presentation.isSvg && presentation.hasSvgDrawing
  }).toBe(true)

  const presentation = await readPresentation()
  expect(presentation.width).toBeGreaterThan(0)
  expect(presentation.height).toBeGreaterThan(0)
  expect(presentation.isCssIcon || presentation.isSvg).toBe(true)
  if (presentation.isCssIcon) {
    expect(presentation.maskImage !== 'none' || presentation.webkitMaskImage !== 'none').toBe(true)
  }
}
