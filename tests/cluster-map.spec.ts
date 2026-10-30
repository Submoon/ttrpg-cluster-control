import { expect, preparedCampaignTest as campaignTest } from './fixtures'
import { waitForWorkspaceSaved, waitForWorkspaceStartup } from './helpers'
import { returnToClusterMap, openWorkspaceHierarchy, workspaceZoomControls, workspaceZoomOutput, clickDockAction, setWorkspaceMapMode } from './helpers'
import { dragOrbitToWorldPoint, panMap, dragBy } from './helpers'



async function orbitalAngle(map: import('@playwright/test').Locator): Promise<number> {
  return map.evaluate((element) => {
    const objects = [...element.querySelectorAll<SVGGElement>('.system-object')]
    const host = objects.find(object => object.getAttribute('aria-label')?.includes('Primary Star'))
    const planet = objects.find(object => object.getAttribute('aria-label')?.includes('Iria'))
    if (!host || !planet) throw new Error('Could not locate the star and orbiting object.')

    const center = (object: SVGGElement) => {
      const transform = object.getScreenCTM()
      if (!transform) throw new Error('An orbital object is not attached to the map.')
      return new DOMPoint(0, 0).matrixTransform(transform)
    }
    const hostCenter = center(host)
    const planetCenter = center(planet)
    return Math.atan2(
      planetCenter.y - hostCenter.y,
      planetCenter.x - hostCenter.x,
    )
  })
}

campaignTest.describe('prepared campaign map layout', () => {
  campaignTest('cluster zoom and pan support a system arrangement that survives reload', async ({ campaignWorkspacePage: page }) => {
    const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
    const clusterZoomControls = workspaceZoomControls(page)
    const clusterZoom = clusterZoomControls.locator('output').first()
    await expect(clusterZoom).toHaveText(/^\d+%$/)
    const initialClusterZoom = Number((await clusterZoom.textContent())?.replace('%', ''))
    await clusterZoomControls.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
      .toBeGreaterThan(initialClusterZoom)

    const clusterZoomBeforeWheel = Number((await clusterZoom.textContent())?.replace('%', ''))
    const clusterBounds = await clusterMap.boundingBox()
    if (!clusterBounds) throw new Error('The Jump Cluster map is not visible.')
    await page.mouse.move(
      clusterBounds.x + clusterBounds.width / 2,
      clusterBounds.y + clusterBounds.height / 2,
    )
    await page.mouse.wheel(0, -150)
    await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
      .toBeGreaterThan(clusterZoomBeforeWheel)
    await page.mouse.wheel(0, -5000)
    await expect(clusterZoom).toHaveText('1600%')
    await page.mouse.wheel(0, 5000)
    await expect(clusterZoom).toHaveText('25%')
    await clusterZoomControls.getByRole('button', { name: 'Fit map' }).click()
    await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
      .toBeGreaterThan(25)

    const clusterContent = clusterMap.locator('.cluster-map-content')
    const beforePan = await clusterContent.getAttribute('transform')
    await panMap(page, clusterMap, { x: 36, y: 24 })
    await expect(clusterContent).not.toHaveAttribute('transform', beforePan!)

    await setWorkspaceMapMode(page, 'Navigate')
    const systemNode = clusterMap.getByRole('button', { name: 'Open Vesper Prime system map' })
    const nodeBeforeDrag = await systemNode.getAttribute('transform')
    await dragBy(page, systemNode.locator('.cluster-system-card'), { x: 48, y: 24 })
    const movedSystemNode = clusterMap.getByRole('button', { name: 'Select Vesper Prime system' })
    await expect(movedSystemNode).not.toHaveAttribute('transform', nodeBeforeDrag!)
    const nodeAfterDrag = await movedSystemNode.getAttribute('transform')
    await waitForWorkspaceSaved(page)

    await page.reload()
    await waitForWorkspaceStartup(page)
    await returnToClusterMap(page)
    await setWorkspaceMapMode(page, 'Navigate')
    const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
    const restoredNode = restoredClusterMap.getByRole('button', { name: 'Open Vesper Prime system map' })
    await expect(restoredNode).toHaveAttribute('transform', nodeAfterDrag!)
    await expect(workspaceZoomOutput(page)).toHaveText(/^\d+%$/)
  })

  campaignTest('resizing an occupied Orbit preserves its angle through pointer and keyboard changes', async ({ campaignWorkspacePage: page }) => {
    const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
    await setWorkspaceMapMode(page, 'Navigate')
    await clusterMap.getByRole('button', { name: 'Open Vesper Prime system map' }).click()

    const map = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
    const hierarchy = await openWorkspaceHierarchy(page)
    const primaryStar = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star', exact: true })
    const primaryStarId = await primaryStar.getAttribute('data-object-id')
    if (!primaryStarId) throw new Error('The Primary Star hierarchy entry has no domain identity.')
    await primaryStar.click()
    await setWorkspaceMapMode(page, 'Move')
    await workspaceZoomControls(page).getByRole('button', { name: 'Fit map', exact: true }).click()

    const orbit = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
    const angleBeforeResize = await orbitalAngle(map)
    const radiusBeforeResize = Number(await orbit.getAttribute('rx'))
    expect(radiusBeforeResize).toBe(112)
    const uniformResizeStartAngle = 0.5
    await dragOrbitToWorldPoint(page, orbit, {
      x: 480 + 153 * Math.cos(uniformResizeStartAngle),
      y: 280 + 153 * Math.sin(uniformResizeStartAngle),
    }, uniformResizeStartAngle)
    await expect.poll(async () => {
      const horizontalRadius = Number(await orbit.getAttribute('rx'))
      const verticalRadius = Number(await orbit.getAttribute('ry'))
      return horizontalRadius > radiusBeforeResize && horizontalRadius === verticalRadius
    }).toBe(true)
    const resizedOrbitRadius = Number(await orbit.getAttribute('aria-valuenow'))
    expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)

    await primaryStar.click()
    await clickDockAction(page, 'Add orbit', { target: { kind: 'host', objectId: primaryStarId } })
    await setWorkspaceMapMode(page, 'Move')
    const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
    await largeOrbitRadius.press('End')
    await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
    await page.keyboard.press('ArrowRight')
    await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')

    const systemContent = map.locator('.system-map-content')
    const systemBeforePan = await systemContent.getAttribute('transform')
    await panMap(page, map, { x: 24, y: 18 })
    await expect(systemContent).not.toHaveAttribute('transform', systemBeforePan!)
    await waitForWorkspaceSaved(page)

    await page.reload()
    await waitForWorkspaceStartup(page)
    await returnToClusterMap(page)
    await setWorkspaceMapMode(page, 'Navigate')
    await page.getByRole('group', { name: 'Kestrel Reach Prime Jump Cluster map', exact: true })
      .getByRole('button', { name: 'Open Vesper Prime system map' }).click()
    await setWorkspaceMapMode(page, 'Move')
    const restoredMap = page.getByRole('group', { name: 'Vesper Prime star system map', exact: true })
    await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' }))
      .toHaveAttribute('aria-valuenow', String(resizedOrbitRadius))
    await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' }))
      .toHaveAttribute('aria-valuenow', '571')
    expect(Math.abs(await orbitalAngle(restoredMap) - angleBeforeResize)).toBeLessThan(0.02)
  })
})
