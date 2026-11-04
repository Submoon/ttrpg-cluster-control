import { expect, test, type Locator, type Page } from './fixtures'
import { addCatalogueObject, createSingleSystemWorkspace, editMapObject, openChartDetails } from './helpers'

const publicationLabels = ['Hidden', 'Unknown presence', 'Known type', 'Revealed']

async function expectReadablePublicationOptions(page: Page, control: Locator): Promise<void> {
  await control.click()
  for (const name of publicationLabels) {
    const option = page.getByRole('option', { name, exact: true })
    await expect(option).toBeVisible()
    const measurement = await option.evaluate(element => {
      const label = element.querySelector('[data-slot="itemLabel"]')
      if (!label) throw new Error('The publication option has no text label.')
      const range = document.createRange()
      range.selectNodeContents(label)
      const labelBounds = label.getBoundingClientRect()
      const optionBounds = element.getBoundingClientRect()
      const left = Math.max(labelBounds.left, optionBounds.left)
      const right = Math.min(labelBounds.right, optionBounds.right)
      const top = Math.max(labelBounds.top, optionBounds.top)
      const bottom = Math.min(labelBounds.bottom, optionBounds.bottom)
      return {
        label: label.textContent,
        clipped: Array.from(range.getClientRects()).some(rect => rect.left < left - 1
          || rect.right > right + 1 || rect.top < top - 1 || rect.bottom > bottom + 1),
      }
    })
    expect(measurement.clipped, `${name} must be completely readable`).toBe(false)
  }
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`system and object publication options remain readable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await createSingleSystemWorkspace(page, { viewport })
    const details = await openChartDetails(page)
    await details.getByRole('button', { name: 'Edit chart details', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit chart details', exact: true })
    await expectReadablePublicationOptions(page, dialog.getByLabel('How players see this system', { exact: true }))
    const systemShot = testInfo.outputPath('system-publication-options.png')
    await page.screenshot({ path: systemShot, fullPage: true })
    await testInfo.attach('system-publication-options', { path: systemShot, contentType: 'image/png' })
    await page.getByRole('option', { name: 'Known type', exact: true }).click()
    await dialog.getByRole('button', { name: 'Apply details', exact: true }).click()
    await expect(dialog).toBeHidden()

    const compactInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true })
    if (await compactInspector.isVisible()) {
      await compactInspector.getByRole('button', { name: 'Close inspector panel', exact: true }).click()
    }

    await addCatalogueObject(page, 'star')
    await editMapObject(page)
    await expectReadablePublicationOptions(page, page.getByLabel('How players see this object', { exact: true }))
    const objectShot = testInfo.outputPath('object-publication-options.png')
    await page.screenshot({ path: objectShot, fullPage: true })
    await testInfo.attach('object-publication-options', { path: objectShot, contentType: 'image/png' })
    await page.getByRole('option', { name: 'Known type', exact: true }).click()
  })
}
