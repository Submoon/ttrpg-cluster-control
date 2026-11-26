import { readFile } from 'node:fs/promises'
import { exportJumpCluster, restoreJumpClusterBackup } from '../domain/workspace'
import { expect, test } from './fixtures'
import { openMapFilesSection } from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'
import campaignBaselineFixture from './fixtures/workspace-data-campaign-baseline.json' with { type: 'json' }
import { workspaceWithRouteObjects } from './support/route-objects-fixture'

test('a Warden downloads the Cluster overview and the named Zone interior', async ({ page }, testInfo) => {
  const campaign = restoreJumpClusterBackup(campaignBaselineFixture)
  const { branch, root } = workspaceWithRouteObjects()
  const routeId = campaign.cluster.routes[0]!.id
  root.locationKey = 'VES-99'
  campaign.cluster.routeContents[routeId] = branch
  await importCampaignWorkspace(page, exportJumpCluster(campaign), { width: 390, height: 844 })

  const overview = await openMapFilesSection(page, 'Export an image')
  const clusterDownload = page.waitForEvent('download')
  await overview.getByRole('menuitem', { name: 'Warden SVG', exact: true }).click()
  const clusterSvg = await clusterDownload
  expect(clusterSvg.suggestedFilename()).toBe('Kestrel Reach Prime-jump-cluster.svg')
  const clusterText = await readFile(await clusterSvg.path(), 'utf8')
  const routePaint = await page.evaluate((source) => {
    const image = new DOMParser().parseFromString(source, 'image/svg+xml')
    const marks = [...image.querySelectorAll('[data-route-object-id]')]
    return {
      marks: marks.map(mark => ({
        owner: mark.getAttribute('data-owner-route-id'),
        name: mark.querySelector('title')?.textContent,
        visibleName: mark.querySelector('.warden-route-object-name')?.textContent,
        color: (mark.querySelector('.warden-route-object-glyph') as SVGElement | null)?.style.fill,
        radius: mark.querySelector('.warden-route-object-marker')?.getAttribute('r'),
      })),
      interactiveContent: image.querySelectorAll('foreignObject, [tabindex], [role="button"]').length,
    }
  }, clusterText)
  expect(routePaint).toEqual({
    marks: [{
      owner: routeId,
      name: 'VES-99, Survey vessel (Vessel)',
      visibleName: 'Survey vessel',
      color: 'rgb(34, 153, 255)',
      radius: '14',
    }],
    interactiveContent: 0,
  })
  expect(clusterText).not.toContain(root.description)

  const clusterPngMenu = await openMapFilesSection(page, 'Export an image')
  const clusterPngDownload = page.waitForEvent('download')
  await clusterPngMenu.getByRole('menuitem', { name: 'Warden PNG', exact: true }).click()
  const clusterPng = await clusterPngDownload
  expect(clusterPng.suggestedFilename()).toBe('Kestrel Reach Prime-jump-cluster.png')
  const clusterBytes = await readFile(await clusterPng.path())
  expect(Math.max(clusterBytes.readUInt32BE(16), clusterBytes.readUInt32BE(20))).toBeGreaterThanOrEqual(2000)
  await testInfo.attach('cluster-overview', { body: clusterBytes, contentType: 'image/png' })

  const images = await openMapFilesSection(page, 'Export an image', 'keyboard')
  await images.getByRole('menuitem', { name: 'Export a Zone…', exact: true }).press('ArrowRight')
  const systems = page.getByRole('menu', { name: 'Export a Zone…', exact: true })
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
      routeObjects: image.querySelectorAll('[data-route-object-id]').length,
    }
  }, text)
  expect(scene.names).toEqual(['Vesper Prime'])
  expect(scene.objects).toContain('Iria')
  expect(scene.frames).toBe(0)
  expect(scene.captions).toEqual(expect.arrayContaining(['Jump-1', 'Harrow']))
  expect(scene.routeObjects).toBe(0)

  const pngMenu = await openMapFilesSection(page, 'Export an image')
  const pngDownload = page.waitForEvent('download')
  await pngMenu.getByRole('menuitem', { name: 'Warden PNG', exact: true }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toBe('Vesper Prime-star-system.png')
  const bytes = await readFile(await png.path())
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  expect(Math.max(width, height)).toBeGreaterThan(1400)
  expect(Math.max(width, height)).toBeLessThanOrEqual(4096)
  expect(width * height).toBeLessThanOrEqual(4_194_304)
})
