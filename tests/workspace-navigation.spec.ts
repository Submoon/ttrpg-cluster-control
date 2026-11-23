import { expect, test } from './fixtures'
import {
  addClusterSystem,
  centerWorkspaceSelection,
  createSingleSystemWorkspace,
  editMapObject,
  fitWorkspaceMap,
  openWorkspaceHierarchy,
  setWorkspaceMapMode,
  wardenMap,
  wardenObjectMark,
  wardenSystemMark,
  workspaceNavigation,
  waitForWorkspaceSaved,
} from './helpers'
import { importCampaignWorkspace } from './scenarios/campaign-workspace'

test('map and hierarchy context actions edit, move, publish and review the expected entities', async ({ page }) => {
  test.setTimeout(60_000)
  await importCampaignWorkspace(page, undefined, { width: 1440, height: 960 })
  const map = wardenMap(page)
  const hierarchy = await openWorkspaceHierarchy(page)
  const inspector = page.locator('#workspace-inspector-panel')
  const menu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  const action = (name: string) => menu.getByRole('menuitem', { name, exact: true })
  const visibility = page.getByRole('menu', { name: 'Change Visibility', exact: true })
  const system = hierarchy.getByRole('treeitem', { name: 'Vesper Prime', exact: true })
  const route = hierarchy.getByRole('button', { name: /Select Jump Level 1:/ })

  await map.locator('.cluster-route[data-route-id="campaign-baseline-route"] > g').click({ button: 'right' })
  await expect(action('Move selection')).toHaveCount(0)
  await action('Edit').click()
  await expect(inspector.getByRole('heading', { name: 'Edit Jump Route' })).toBeVisible()
  await inspector.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await route.press('Shift+F10')
  await action('Change Visibility').press('ArrowRight')
  await visibility.getByRole('menuitemcheckbox', { name: 'Shared with players', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await route.press('Shift+F10')
  await action('Change Visibility').press('ArrowRight')
  await expect(visibility.getByRole('menuitemcheckbox', { name: 'Shared with players', exact: true }))
    .toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await system.click({ button: 'right' })
  await action('Edit').click()
  await expect(inspector.getByLabel('Star system', { exact: true })).toBeEditable()
  await inspector.getByRole('button', { name: /^Discard/ }).click()
  await centerWorkspaceSelection(page)

  const orbitMark = map.locator('.continuous-warden-orbit-target[data-orbit-id="campaign-baseline-primary-orbit"]')
  await orbitMark.press('Shift+F10')
  await action('Move selection').click()
  await expect(workspaceNavigation(page).getByRole('button', { name: 'Move', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await orbitMark.press('Shift+F10')
  await action('Edit').click()
  await expect(inspector.getByLabel('Horizontal radius', { exact: true })).toBeEditable()
  await inspector.getByRole('button', { name: /^Discard changes/ }).click()
  await setWorkspaceMapMode(page, 'Select')

  const orbit = hierarchy.getByRole('treeitem', { name: 'Orbit 1 around Primary Star, 1 object', exact: true })
  if (await orbit.count() === 0) {
    await hierarchy.getByRole('button', { name: 'Show all Vesper Prime records', exact: true }).click()
  }
  const orbitHost = hierarchy.getByRole('treeitem', { name: 'Select A, Primary Star in Vesper Prime', exact: true })
  await expect(orbitHost).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await orbit.press('Shift+F10')
  await action('Change Visibility').press('ArrowRight')
  await expect(visibility).toContainText('Objects on this Orbit and its branches')
  await visibility.getByRole('menuitemcheckbox', { name: 'Known type', exact: true }).click()
  await waitForWorkspaceSaved(page)
  await expect(orbitHost).toHaveAttribute('aria-description', /Configured visibility: Hidden/)
  await expect(hierarchy.getByRole('treeitem', { name: 'Select PL-01, Iria in Vesper Prime', exact: true }))
    .toHaveAttribute('aria-description', /Configured visibility: Known type/)
  await expect(hierarchy.getByRole('treeitem', { name: 'Select MO-01, Nix in Vesper Prime', exact: true }))
    .toHaveAttribute('aria-description', /Configured visibility: Known type/)
  await orbit.press('Shift+F10')
  await action('Change Visibility').press('ArrowRight')
  await expect(visibility.getByRole('menuitemcheckbox', { name: 'Known type', exact: true }))
    .toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await orbit.press('Shift+F10')
  await action('Delete').click()
  const review = page.getByRole('dialog', { name: 'Review deletion', exact: true })
  await expect(review).toContainText('Orbit 1 around Primary Star')
  await expect(review).toContainText('Iria')
  await expect(review).toContainText('Nix')
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(orbit).toBeVisible()
})

test('the unified Warden map pans on a right drag and opens the visibility menu on a right click', async ({ page }) => {
  const { systemId } = await createSingleSystemWorkspace(page, { viewport: { width: 1440, height: 900 } })
  await addClusterSystem(page)
  await fitWorkspaceMap(page)
  await setWorkspaceMapMode(page, 'Move')
  const map = wardenMap(page)
  const system = wardenSystemMark(page, systemId)
  const scene = map.locator('.cluster-map-content')
  const viewportBeforeDrag = await scene.getAttribute('transform')
  const anchorBeforeDrag = await system.getAttribute('transform')
  if (!viewportBeforeDrag || !anchorBeforeDrag) throw new Error('The system and camera must be ready for right-drag.')
  const contextMenu = page.getByRole('menu', { name: 'Map item actions', exact: true })

  // Exercise a browser that emits contextmenu on press before the drag crosses the threshold.
  const pressRightButtonOnSystem = async () => {
    const bounds = await system.boundingBox()
    if (!bounds) throw new Error('The right-button target has no visible bounds.')
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    await page.mouse.move(point.x, point.y)
    await page.mouse.down({ button: 'right' })
    await page.evaluate(({ x, y, systemId }) => {
      const target = document.elementFromPoint(x, y)
      const systemTarget = target?.closest<SVGGElement>('.continuous-warden-system-anchor, .continuous-warden-name-target')
      if (systemTarget?.getAttribute('data-system-id') !== systemId) {
        throw new Error('The right press did not hit the expected system mark.')
      }
      systemTarget.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: x, clientY: y,
      }))
    }, { ...point, systemId })
    return point
  }

  const start = await pressRightButtonOnSystem()
  await page.mouse.move(start.x + 75, start.y + 32, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await expect(contextMenu).toHaveCount(0)
  await expect(scene).not.toHaveAttribute('transform', viewportBeforeDrag)
  await expect(system).toHaveAttribute('transform', anchorBeforeDrag)

  await pressRightButtonOnSystem()
  await expect(contextMenu).toHaveCount(0)
  await page.mouse.up({ button: 'right' })
  await expect(contextMenu.getByRole('menuitem', { name: 'Change Visibility', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(contextMenu).toBeHidden()
})

test('one Warden camera keeps the inspected draft and keyboard focus through semantic detail changes', async ({ page }) => {
  const { systemId, primaryObjectId, systemName } = await createSingleSystemWorkspace(page, {
    viewport: { width: 1440, height: 900 },
  })
  await addClusterSystem(page, { position: { x: 0.86, y: 0.72 } })
  await fitWorkspaceMap(page)
  const map = wardenMap(page)
  await expect(map).toHaveCount(1)
  await expect(page.locator('svg.system-map-svg')).toHaveCount(0)
  const scene = map.locator('.cluster-map-content')
  const systemNameMark = map.locator('.continuous-warden-name-target')
    .and(map.getByRole('button', { name: `Select ${systemName}`, exact: true }))
  const initialCamera = await scene.getAttribute('transform')
  if (!initialCamera) throw new Error('The Warden camera must be initialized.')

  const modeGroup = workspaceNavigation(page).getByRole('group', { name: 'Map interaction mode' })
  await expect(modeGroup.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(modeGroup.getByRole('button', { name: 'Navigate', exact: true })).toHaveCount(0)
  await systemNameMark.click()
  await expect(systemNameMark).toHaveClass(/is-selected/)
  await expect(scene).toHaveAttribute('transform', initialCamera)
  await centerWorkspaceSelection(page)
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  await expect(star).toBeVisible()
  await expect(scene).not.toHaveAttribute('transform', initialCamera)

  await star.press('Enter')
  await editMapObject(page)
  const inspector = page.locator('#workspace-inspector-panel')
  const draftName = inspector.getByLabel('Name', { exact: true })
  await draftName.fill('Unapplied Primary')
  await expect(star).toHaveAccessibleName(/Unapplied Primary/)
  const hierarchy = await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const starRow = hierarchy.getByRole('treeitem', { name: /Select .*Unapplied Primary/ })
  await expect(starRow).toHaveAttribute('aria-selected', 'true')

  await star.focus()
  const bounds = await map.boundingBox()
  if (!bounds) throw new Error('The Warden canvas must be visible for wheel zoom.')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.wheel(0, 1800)
  await expect(star).toHaveCount(0)
  await expect(systemNameMark.or(map).and(page.locator(':focus'))).toHaveCount(1)
  await expect(draftName).toHaveValue('Unapplied Primary')
  await expect(starRow).toHaveAttribute('aria-selected', 'true')

  await centerWorkspaceSelection(page)
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await expect(star).toHaveAccessibleName(/Unapplied Primary/)
  await expect(draftName).toHaveValue('Unapplied Primary')
  await expect(map).toHaveCount(1)
})
