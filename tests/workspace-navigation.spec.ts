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
} from './helpers'

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
  const contextMenu = page.getByRole('menu', { name: 'Player visibility', exact: true })

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
