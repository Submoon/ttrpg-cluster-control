import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'
import { openMapFilesSection } from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

test('a Warden downloads the named system interior as SVG and PNG', async ({ page }) => {
  await importCampaignWorkspace(page, undefined, { width: 390, height: 844 })
  const images = await openMapFilesSection(page, 'Export an image', 'keyboard')
  await images.getByRole('menuitem', { name: 'Export a system…', exact: true }).press('ArrowRight')
  const systems = page.getByRole('menu', { name: 'Export a system…', exact: true })
  await systems.getByLabel('Filter systems', { exact: true }).fill('vesp')
  await expect(systems.getByRole('menuitem', { name: 'Harrow', exact: true })).toHaveCount(0)
  await systems.getByRole('menuitem', { name: 'Vesper Prime', exact: true }).press('Enter')

  const svgDownload = page.waitForEvent('download')
  await images.getByRole('menuitem', { name: 'Warden SVG', exact: true }).press('Enter')
  const svg = await svgDownload
  expect(svg.suggestedFilename()).toBe('Vesper Prime-star-system.svg')
  const text = await readFile(await svg.path(), 'utf8')
  const scene = await page.evaluate((source) => {
    const image = new DOMParser().parseFromString(source, 'image/svg+xml')
    return {
      names: [...image.querySelectorAll('.continuous-warden-system-name')].map(name => name.textContent),
      objects: [...image.querySelectorAll('.continuous-warden-object-name')].map(name => name.textContent),
      frames: image.querySelectorAll('.continuous-warden-system-envelope').length,
      captions: [...image.querySelectorAll('.continuous-warden-system-route-caption text')].map(label => label.textContent),
    }
  }, text)
  expect(scene.names).toEqual(['Vesper Prime'])
  expect(scene.objects).toContain('Iria')
  expect(scene.frames).toBe(0)
  expect(scene.captions).toEqual(expect.arrayContaining(['Jump-1', 'Harrow']))

  const pngMenu = await openMapFilesSection(page, 'Export an image')
  const pngDownload = page.waitForEvent('download')
  await pngMenu.getByRole('menuitem', { name: 'Warden PNG', exact: true }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toBe('Vesper Prime-star-system.png')
  const bytes = await readFile(await png.path())
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  expect(Math.max(bytes.readUInt32BE(16), bytes.readUInt32BE(20))).toBeGreaterThan(1400)
})
