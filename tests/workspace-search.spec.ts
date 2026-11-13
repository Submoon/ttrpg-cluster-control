import { expect, test } from './fixtures'
import { expectPaletteOptionActive } from './scenarios/search-palette'
import { createSingleSystemWorkspace } from './helpers'






test('a real Inspector draft survives search Stay and compact Discard reveals without covering the map', async ({ page }, testInfo) => {
  await createSingleSystemWorkspace(page)

  const systemMap = page.getByRole('group', { name: 'Vesper star system map', exact: true, includeHidden: true })
  const systemContent = systemMap.locator('.system-map-content')
  const initialViewport = await systemContent.getAttribute('transform')
  if (!initialViewport) throw new Error('The active system map has no rendered viewport transform.')
  const primaryStar = systemMap.getByRole('button', { name: 'Select A, Primary Star (Star)', exact: true })
  await primaryStar.click()

  const inspector = page.locator('#workspace-inspector-panel')
  await expect(inspector).toBeVisible()
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(1)
  await inspector.getByRole('button', { name: 'Edit map object', exact: true }).click()
  const objectName = inspector.getByLabel('Name', { exact: true })
  await objectName.fill('Primary Star draft')

  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()
  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Kestrel')
  const clusterResult = searchDialog.getByRole('option', { name: /Kestrel Reach.*Jump Cluster.*Current workspace/i })
  await clusterResult.click()

  let guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await expect(guard.getByRole('button', { name: 'Stay here', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(guard).toHaveCount(0)
  await expect(query).toHaveValue('Kestrel')
  await expect(query).toBeFocused()
  await expect(page.locator('.workspace-map-heading > span')).toHaveText('Star System')
  await expect(systemContent).toHaveAttribute('transform', initialViewport)
  await expect(systemMap.locator('.system-object.is-selected')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()
  await expect(objectName).toHaveValue('Primary Star draft')

  await searchButton.click()
  await expect(query).toHaveValue('Kestrel')
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(inspector).toBeVisible()
  await expect(inspector).toHaveAttribute('role', 'dialog')
  await expect(inspector).toHaveAttribute('aria-modal', 'true')
  await expect(searchDialog).toBeVisible()

  const compactSearchScreenshot = testInfo.outputPath('search-inspector-draft-compact.png')
  await page.screenshot({ path: compactSearchScreenshot, animations: 'disabled' })
  await testInfo.attach('search-inspector-draft-compact', {
    path: compactSearchScreenshot,
    contentType: 'image/png',
  })

  await clusterResult.click()
  guard = page.getByRole('dialog', { name: 'Edit Jump Cluster details', exact: true })
  await expect(guard.getByRole('button', { name: 'Discard edits and continue', exact: true })).toBeVisible()
  await guard.getByRole('button', { name: 'Discard edits and continue', exact: true }).click()

  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await expect(clusterMap).toBeVisible()
  await expect(searchDialog).toHaveCount(0)
  await expect(inspector).toBeHidden()
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(clusterMap).toBeFocused()

  const compactRevealScreenshot = testInfo.outputPath('search-inspector-draft-reveal-compact.png')
  await page.screenshot({ path: compactRevealScreenshot, animations: 'disabled' })
  await testInfo.attach('search-inspector-draft-reveal-compact', {
    path: compactRevealScreenshot,
    contentType: 'image/png',
  })

  await searchButton.click()
  await expect(query).toHaveValue('Kestrel')
})



test('Palette editing retains native caret and IME behavior while shielding map shortcuts', async ({ page }) => {
  await createSingleSystemWorkspace(page)
  const selectMode = page.locator('.workspace-dock-mode button[aria-label="Select"]')
  const addButton = page.locator('.workspace-dock-add')
  const searchButton = page.getByRole('button', { name: 'Search', exact: true })
  await searchButton.click()

  const searchDialog = page.getByRole('dialog', { name: 'Search workspace', exact: true })
  const query = searchDialog.getByRole('combobox', { name: 'Search workspace', exact: true })
  await query.fill('Vesper')
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.setSelectionRange(3, 3)
  })
  await query.press('Home')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe(0)
  await query.press('End')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe('Vesper'.length)

  const resultOptions = searchDialog.getByRole('listbox').getByRole('option')
  await expect(resultOptions.first()).toBeVisible()
  await query.press('ArrowDown')
  await expectPaletteOptionActive(query, resultOptions.first())
  await query.press('End')
  await expectPaletteOptionActive(query, resultOptions.last())
  await query.press('Home')
  await expectPaletteOptionActive(query, resultOptions.first())
  await query.press('ArrowUp')
  await expect(query).toBeFocused()
  await query.press('End')
  expect(await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    return input.selectionStart
  })).toBe('Vesper'.length)

  const composingEnter = await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(event)
    return { defaultPrevented: event.defaultPrevented, value: input.value }
  })
  expect(composingEnter).toEqual({ defaultPrevented: false, value: 'Vesper' })
  await expect(searchDialog).toBeVisible()
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
  })

  await query.press('Control+A')
  for (const key of ['n', 's', 'm', 'a']) await query.press(key)
  await expect(query).toHaveValue('nsma')
  await expect(searchDialog.getByRole('status')).toHaveText('No matches for “nsma”.')
  await expect(selectMode).toHaveAttribute('aria-pressed', 'true')
  await expect(addButton).toHaveAttribute('aria-expanded', 'false')
  await expect(searchDialog).toBeVisible()

  const composingEscape = await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(event)
    return { defaultPrevented: event.defaultPrevented, value: input.value }
  })
  expect(composingEscape).toEqual({ defaultPrevented: false, value: 'nsma' })
  await expect(searchDialog).toBeVisible()
  await query.evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('The Palette combobox is not a native input.')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
  })

  await page.keyboard.press('Escape')
  await expect(searchDialog).toHaveCount(0)
  await expect(searchButton).toBeFocused()
})
