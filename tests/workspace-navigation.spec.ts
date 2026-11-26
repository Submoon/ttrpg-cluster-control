import { expect, test } from './fixtures'
import {
  addClusterSystem,
  centerWorkspaceSelection,
  createSingleSystemWorkspaceWithPrimaryStar,
  editMapObject,
  fitWorkspaceMap,
  openWorkspaceHierarchy,
  setWorkspaceMapMode,
  wardenMap,
  wardenObjectMark,
  wardenSystemAnchor,
  workspaceNavigation,
} from './helpers'

test('one Warden camera retains selection and focus through semantic zoom, Fit, and right-button map navigation @preview-smoke', async ({ page }) => {
  const { systemId, primaryObjectId, systemName } = await createSingleSystemWorkspaceWithPrimaryStar(page, {
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
  const selectMode = modeGroup.getByRole('button', { name: 'Select', exact: true })
  const moveMode = modeGroup.getByRole('button', { name: 'Move', exact: true })
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await expect(modeGroup.getByRole('button', { name: 'Navigate', exact: true })).toHaveCount(0)
  await systemNameMark.click()
  await expect(systemNameMark).toHaveClass(/is-selected/)
  await expect(scene).toHaveAttribute('transform', initialCamera)
  await centerWorkspaceSelection(page)
  const star = wardenObjectMark(page, systemId, primaryObjectId)
  await expect(star).toBeVisible()
  await expect(scene).not.toHaveAttribute('transform', initialCamera)

  await moveMode.click()
  const system = wardenSystemAnchor(page, systemId)
  const anchorBeforeDrag = await system.getAttribute('transform')
  const viewportBeforeDrag = await scene.getAttribute('transform')
  if (!anchorBeforeDrag || !viewportBeforeDrag) throw new Error('The map target and camera must be ready for right-drag.')
  const contextMenu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  const systemNameBackground = systemNameMark.locator('.continuous-warden-name-background')
  const pressRightButtonOnSystem = async () => {
    const bounds = await systemNameBackground.boundingBox()
    if (!bounds) throw new Error('The right-button target has no visible bounds.')
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    await page.mouse.move(point.x, point.y)
    await page.mouse.down({ button: 'right' })
    await page.evaluate(({ x, y, expectedSystemId }) => {
      const target = document.elementFromPoint(x, y)
      const systemTarget = target?.closest<SVGGElement>('.continuous-warden-name-target')
      if (systemTarget?.getAttribute('data-system-id') !== expectedSystemId) {
        throw new Error('The right press did not hit the expected system mark.')
      }
      systemTarget.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: x, clientY: y,
      }))
    }, { ...point, expectedSystemId: systemId })
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

  const viewportBeforeFit = await scene.getAttribute('transform')
  if (!viewportBeforeFit) throw new Error('The Warden camera must remain initialized after the gesture.')
  await fitWorkspaceMap(page)
  await expect(scene).not.toHaveAttribute('transform', viewportBeforeFit)
  await map.focus()
  const addToggle = workspaceNavigation(page).getByRole('button', { name: 'Add to map', exact: true })
  await page.keyboard.press('a')
  await expect(addToggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(addToggle).toHaveAttribute('aria-expanded', 'false')
  await map.focus()
  await page.keyboard.press('m')
  await expect(moveMode).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('s')
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')

  await setWorkspaceMapMode(page, 'Select')
  await centerWorkspaceSelection(page)
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
