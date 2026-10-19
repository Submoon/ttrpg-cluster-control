# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cluster-map.spec.ts >> the Warden can navigate and arrange both maps
- Location: tests\cluster-map.spec.ts:27:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('group', { name: 'Kestrel Reach Jump Cluster map' }).getByRole('button', { name: 'Open Vesper system map' })
Expected: "translate(254.5177960205078 229.81890563964842)"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" getByRole('group', { name: 'Kestrel Reach Jump Cluster map' }).getByRole('button', { name: 'Open Vesper system map' }) with timeout 5000ms
  - waiting for getByRole('group', { name: 'Kestrel Reach Jump Cluster map' }).getByRole('button', { name: 'Open Vesper system map' })

```

```yaml
- main:
  - text: TTRPG Cluster Control LOCAL ONLY
  - region "Active Jump Cluster summary":
    - text: ACTIVE JUMP CLUSTER
    - heading "Kestrel Reach" [level=1]
    - strong: "1"
    - text: SYSTEMS
    - strong: "0"
    - text: ROUTES
    - strong: "0"
    - text: JUMP POINTS
  - region "Active Star System summary":
    - text: ACTIVE STAR SYSTEM
    - heading "Vesper" [level=2]
    - strong: "1"
    - text: STARS
    - strong: "1"
    - text: OBJECTS
    - strong: "0"
    - text: ORBITS
  - navigation "Workspace controls":
    - button "Back to Jump Cluster": Back
    - button "Hierarchy" [expanded]
    - button "Inspect" [expanded]
    - button "Open map file actions for star system Vesper": Map files
  - status: Saved on this device
  - text: THEME Light
  - button "Switch to dark mode"
  - button "Open field definitions": FIELD DEFINITIONS MAP DATA
  - toolbar "Workspace navigation":
    - group "Map interaction mode":
      - button "Navigate" [pressed]
      - button "Select"
      - button "Move"
    - button "Add to map": Add
    - group "Map zoom":
      - button "Zoom out": −
      - text: Zoom level
      - slider "Map zoom level"
      - status: 653%
      - button "Zoom in": +
      - button "Fit map": Fit
    - group "Pan map":
      - button "Pan map left": ←
      - button "Pan map up": ↑
      - button "Pan map down": ↓
      - button "Pan map right": →
    - status: Saved on this device
  - complementary "System hierarchy":
    - button "Close hierarchy panel": ×
    - text: LOCAL ARCHIVE
    - heading "Hierarchy" [level=2]
    - button "Cluster map"
    - button "Edit chart names"
    - navigation "Star systems":
      - text: STAR SYSTEMS
      - button "SY Vesper 1 map objects"
    - text: OBJECTS / ORBITS 1 records
    - navigation "Map object and Orbit hierarchy":
      - button "Select A, Primary Star": A Primary Star CelestialBody / star
    - paragraph: Drag Orbit from Add Object onto a map object to host it, or elsewhere on the map to place an unoccupied center. Empty Orbits stay on the chart.
  - region "System map workspace":
    - group "Vesper star system map":
      - button "Select A, Primary Star (CelestialBody / star)": ✦ A Primary Star ✦
  - complementary "Object inspector":
    - button "Close inspector panel": ×
    - button "Chart details" [pressed]
    - text: CHART DETAILS
    - heading "Vesper" [level=2]
    - paragraph: Choose a map object or Orbit to inspect it, or edit the chart names.
    - button "Edit chart names"
    - text: Map objects
    - strong: "1"
    - text: Nested Orbits
    - strong: "0"
- contentinfo "Workspace feedback and recovery":
  - status: Saved on this device
- region "Notifications (F8)":
  - list
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | import { activeWorkspaceFeedback } from './helpers'
  3   | import { returnToClusterMap, workspaceNavigation, workspaceZoomOutput, clickDockAction, setWorkspaceMapMode } from './helpers'
  4   | import { dragToWorldPoint, dragOrbitToWorldPoint, panMap, dragBy, editMapObject, saveMapObject, addCatalogueObject } from './helpers'
  5   | 
  6   | async function orbitalAngle(map: import('@playwright/test').Locator): Promise<number> {
  7   |   return map.evaluate((element) => {
  8   |     const objects = [...element.querySelectorAll<SVGGElement>('.system-object')]
  9   |     const host = objects.find(object => object.getAttribute('aria-label')?.includes('Primary Star'))
  10  |     const planet = objects.find(object => object.getAttribute('aria-label')?.includes('Iria'))
  11  |     if (!host || !planet) throw new Error('Could not locate the star and orbiting object.')
  12  | 
  13  |     const center = (object: SVGGElement) => {
  14  |       const transform = object.getScreenCTM()
  15  |       if (!transform) throw new Error('An orbital object is not attached to the map.')
  16  |       return new DOMPoint(0, 0).matrixTransform(transform)
  17  |     }
  18  |     const hostCenter = center(host)
  19  |     const planetCenter = center(planet)
  20  |     return Math.atan2(
  21  |       planetCenter.y - hostCenter.y,
  22  |       planetCenter.x - hostCenter.x,
  23  |     )
  24  |   })
  25  | }
  26  | 
  27  | test('the Warden can navigate and arrange both maps', async ({ page }) => {
  28  |   await page.goto('/')
  29  |   await page.getByLabel('Jump Cluster').fill('Kestrel Reach')
  30  |   await page.getByLabel('First star system').fill('Vesper')
  31  |   await page.getByRole('button', { name: 'Create local workspace' }).click()
  32  | 
  33  |   await returnToClusterMap(page)
  34  |   const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  35  |   const clusterNavigation = workspaceNavigation(page)
  36  |   const clusterZoom = clusterNavigation.locator('output')
  37  |   await expect(clusterZoom).toHaveText(/^\d+%$/)
  38  |   const initialClusterZoom = Number((await clusterZoom.textContent())?.replace('%', ''))
  39  |   await clusterNavigation.getByRole('button', { name: 'Zoom in' }).click()
  40  |   await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
  41  |     .toBeGreaterThan(initialClusterZoom)
  42  | 
  43  |   const clusterBounds = await clusterMap.boundingBox()
  44  |   if (!clusterBounds) throw new Error('The Jump Cluster map is not visible.')
  45  |   await page.mouse.move(
  46  |     clusterBounds.x + clusterBounds.width / 2,
  47  |     clusterBounds.y + clusterBounds.height / 2,
  48  |   )
  49  |   await page.mouse.wheel(0, -150)
  50  |   await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
  51  |     .toBeGreaterThan(initialClusterZoom)
  52  |   await page.mouse.wheel(0, -5000)
  53  |   await expect(clusterZoom).toHaveText('1600%')
  54  |   await page.mouse.wheel(0, 5000)
  55  |   await expect(clusterZoom).toHaveText('25%')
  56  |   await clusterNavigation.getByRole('button', { name: 'Fit map' }).click()
  57  |   await expect.poll(async () => Number((await clusterZoom.textContent())?.replace('%', '')))
  58  |     .toBeGreaterThan(25)
  59  | 
  60  |   const clusterContent = clusterMap.locator('.cluster-map-content')
  61  |   const beforePan = await clusterContent.getAttribute('transform')
  62  |   await panMap(page, clusterMap, { x: 36, y: 24 })
  63  |   await expect(clusterContent).not.toHaveAttribute('transform', beforePan!)
  64  | 
  65  |   const systemNode = clusterMap.getByRole('button', { name: 'Open Vesper system map' })
  66  |   const nodeBeforeDrag = await systemNode.getAttribute('transform')
  67  |   await dragBy(page, systemNode.locator('.cluster-system-card'), { x: 48, y: 24 })
  68  |   const movedSystemNode = clusterMap.getByRole('button', { name: 'Select Vesper system' })
  69  |   await expect(movedSystemNode).not.toHaveAttribute('transform', nodeBeforeDrag!)
  70  |   const nodeAfterDrag = await movedSystemNode.getAttribute('transform')
  71  |   await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  72  | 
  73  |   await page.reload()
  74  |   await returnToClusterMap(page)
  75  |   await setWorkspaceMapMode(page, 'Navigate')
  76  |   const restoredClusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map' })
  77  |   const restoredNode = restoredClusterMap.getByRole('button', { name: 'Open Vesper system map' })
> 78  |   await expect(restoredNode).toHaveAttribute('transform', nodeAfterDrag!)
      |                              ^ Error: expect(locator).toHaveAttribute(expected) failed
  79  |   await expect(workspaceZoomOutput(page)).toHaveText(/^\d+%$/)
  80  |   await restoredNode.click()
  81  | 
  82  |   const map = page.getByRole('group', { name: 'Vesper star system map' })
  83  |   const hierarchy = page.getByRole('complementary', { name: 'System hierarchy' })
  84  |   await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  85  |   await clickDockAction(page, 'Add orbit')
  86  |   await addCatalogueObject(page, 'planet')
  87  |   await editMapObject(page)
  88  |   await page.getByLabel('Name', { exact: true }).fill('Iria')
  89  |   await saveMapObject(page)
  90  | 
  91  |   const planet = map.getByRole('button', { name: /Select PL-01, Iria/ })
  92  |   await dragToWorldPoint(page, map, planet.locator('.object-hit-target'), {
  93  |     x: 480 + 112 * Math.SQRT1_2,
  94  |     y: 280 - 112 * Math.SQRT1_2,
  95  |   })
  96  |   const angleBeforeResize = await orbitalAngle(map)
  97  |   const orbitRadius = map.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' })
  98  |   const radiusBeforeResize = Number(await orbitRadius.getAttribute('rx'))
  99  |   const uniformResizeStartAngle = 0.5
  100 |   await dragOrbitToWorldPoint(page, orbitRadius, {
  101 |     x: 480 + 153 * Math.cos(uniformResizeStartAngle),
  102 |     y: 280 + 153 * Math.sin(uniformResizeStartAngle),
  103 |   }, uniformResizeStartAngle)
  104 |   await expect.poll(async () => {
  105 |     const horizontalRadius = Number(await orbitRadius.getAttribute('rx'))
  106 |     const verticalRadius = Number(await orbitRadius.getAttribute('ry'))
  107 |     return horizontalRadius > radiusBeforeResize && horizontalRadius === verticalRadius
  108 |   }).toBe(true)
  109 |   const resizedOrbitRadius = Number(await orbitRadius.getAttribute('aria-valuenow'))
  110 |   expect(Math.abs(await orbitalAngle(map) - angleBeforeResize)).toBeLessThan(0.02)
  111 | 
  112 |   await hierarchy.getByRole('button', { name: 'Select A, Primary Star' }).click()
  113 |   await clickDockAction(page, 'Add orbit')
  114 |   const largeOrbitRadius = map.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' })
  115 |   await largeOrbitRadius.press('End')
  116 |   await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '570')
  117 |   await page.keyboard.press('ArrowRight')
  118 |   await expect(largeOrbitRadius).toHaveAttribute('aria-valuenow', '571')
  119 | 
  120 |   await addCatalogueObject(page, 'hazard')
  121 |   await editMapObject(page)
  122 |   await page.getByLabel('Name', { exact: true }).fill('Glass Wake')
  123 |   await saveMapObject(page)
  124 |   const hazard = map.getByRole('button', { name: /Glass Wake/ })
  125 |   await dragToWorldPoint(page, map, hazard.locator('.object-hit-target'), { x: 230, y: 180 })
  126 |   const hazardTransform = await hazard.getAttribute('transform')
  127 |   await expect(activeWorkspaceFeedback(page).getByText('Saved on this device')).toBeVisible()
  128 | 
  129 |   const systemNavigation = workspaceNavigation(page)
  130 |   const systemZoom = systemNavigation.locator('output')
  131 |   await expect(systemZoom).toHaveText(/^\d+%$/)
  132 |   const initialSystemZoom = Number((await systemZoom.textContent())?.replace('%', ''))
  133 |   await systemNavigation.getByRole('button', { name: 'Zoom in' }).click()
  134 |   await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
  135 |     .toBeGreaterThan(initialSystemZoom)
  136 |   const systemBounds = await map.boundingBox()
  137 |   if (!systemBounds) throw new Error('The star system map is not visible.')
  138 |   await page.mouse.move(
  139 |     systemBounds.x + systemBounds.width / 2,
  140 |     systemBounds.y + systemBounds.height / 2,
  141 |   )
  142 |   await page.mouse.wheel(0, -150)
  143 |   await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
  144 |     .toBeGreaterThan(initialSystemZoom)
  145 |   await page.mouse.wheel(0, -5000)
  146 |   await expect(systemZoom).toHaveText('1600%')
  147 |   await page.mouse.wheel(0, 5000)
  148 |   await expect(systemZoom).toHaveText('25%')
  149 |   await systemNavigation.getByRole('button', { name: 'Fit map' }).click()
  150 |   await expect.poll(async () => Number((await systemZoom.textContent())?.replace('%', '')))
  151 |     .toBeGreaterThan(25)
  152 |   await expect(systemZoom).toHaveText(/^\d+%$/)
  153 |   const fittedMapBounds = await map.boundingBox()
  154 |   const fittedOrbitBounds = await map.getByRole('group', { name: 'Orbit 2 around Primary Star' })
  155 |     .locator('.orbit-ring').boundingBox()
  156 |   if (!fittedMapBounds || !fittedOrbitBounds) throw new Error('The fitted Orbit is not visible.')
  157 |   expect(fittedOrbitBounds.x).toBeGreaterThanOrEqual(fittedMapBounds.x)
  158 |   expect(fittedOrbitBounds.x + fittedOrbitBounds.width)
  159 |     .toBeLessThanOrEqual(fittedMapBounds.x + fittedMapBounds.width)
  160 |   expect(fittedOrbitBounds.y).toBeGreaterThanOrEqual(fittedMapBounds.y)
  161 |   expect(fittedOrbitBounds.y + fittedOrbitBounds.height)
  162 |     .toBeLessThanOrEqual(fittedMapBounds.y + fittedMapBounds.height)
  163 |   const systemContent = map.locator('.system-map-content')
  164 |   const systemBeforePan = await systemContent.getAttribute('transform')
  165 |   await panMap(page, map, { x: 24, y: 18 })
  166 |   await expect(systemContent).not.toHaveAttribute('transform', systemBeforePan!)
  167 | 
  168 |   await page.reload()
  169 |   const restoredMap = page.getByRole('group', { name: 'Vesper star system map' })
  170 |   await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 1 around Primary Star' }))
  171 |     .toHaveAttribute('aria-valuenow', String(resizedOrbitRadius))
  172 |   await expect(restoredMap.getByRole('slider', { name: 'Resize Orbit 2 around Primary Star' }))
  173 |     .toHaveAttribute('aria-valuenow', '571')
  174 |   await expect(workspaceZoomOutput(page)).toHaveText(/^\d+%$/)
  175 |   await expect(restoredMap.getByRole('button', { name: /Glass Wake/ }))
  176 |     .toHaveAttribute('transform', hazardTransform!)
  177 |   expect(Math.abs(await orbitalAngle(restoredMap) - angleBeforeResize)).toBeLessThan(0.02)
  178 | })
```