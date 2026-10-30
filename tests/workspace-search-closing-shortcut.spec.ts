import { expect, test } from './fixtures'
import { createSingleSystemWorkspace, openFieldDefinitionDialog } from './helpers'

test('Ctrl+K waits for the Fields close animation before opening Search', async ({ page }) => {
  await createSingleSystemWorkspace(page)

  const opener = page.getByRole('button', { name: 'Open field definitions', exact: true })
  const fields = await openFieldDefinitionDialog(page)
  const search = page.getByRole('dialog', { name: 'Search workspace', exact: true })

  await expect(fields).toBeVisible()
  await fields.evaluate((dialog) => {
    dialog.style.animationPlayState = 'paused'
  })

  try {
    await page.keyboard.press('Escape')

    await expect(fields).toHaveAttribute('data-state', 'closed')
    await expect(fields).toBeVisible()
    const closingBounds = await fields.boundingBox()
    if (!closingBounds) throw new Error('The closing Fields dialog lost its rendered bounds.')
    expect(closingBounds.width).toBeGreaterThan(0)
    expect(closingBounds.height).toBeGreaterThan(0)

    await page.keyboard.press('Control+k')
    await expect(search).toHaveCount(0)
  } finally {
    await fields.evaluate((dialog) => {
      dialog.style.animationPlayState = 'running'
    })
  }

  await expect(fields).toBeHidden()
  await expect(opener).toBeFocused()

  await page.keyboard.press('Control+k')
  await expect(search).toBeVisible()
  await expect(search.getByRole('combobox', { name: 'Search workspace', exact: true })).toBeFocused()
})
