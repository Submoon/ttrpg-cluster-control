import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:3100')
  await page.getByLabel('Jump Cluster').fill('Contrast Probe Reach')
  await page.getByLabel('First star system').fill('Probe Star')
  await page.getByRole('button', { name: 'Create local workspace' }).click()
  await page.getByRole('button', { name: 'Chart details' }).click()
  await page.getByRole('complementary', { name: 'Object inspector' })
    .getByRole('button', { name: 'Edit chart names' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit chart names' })
  await dialog.getByLabel('Jump Cluster').fill('')
  await dialog.getByRole('button', { name: 'Apply names' }).click()
  await dialog.getByText('Jump Cluster name is required.').waitFor()
  const measurement = await dialog.evaluate((root) => {
    const error = [...root.querySelectorAll('[role="alert"]')]
      .find(element => element.textContent?.includes('Jump Cluster name'))
    if (!error) throw new Error('Expected field error was not found.')
    const modal = root.matches('[data-slot="content"]')
      ? root
      : root.closest('[data-slot="content"]')
    const text = getComputedStyle(error)
    const ancestors = []
    let current = error
    while (current && current !== root.parentElement) {
      const style = getComputedStyle(current)
      ancestors.push({
        tag: current.tagName,
        slot: current.getAttribute('data-slot'),
        className: current.className,
        background: style.backgroundColor,
      })
      current = current.parentElement
    }
    const background = modal ? getComputedStyle(modal).backgroundColor : 'missing modal'
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create a color measurement context.')
    function rgb(color) {
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
    }
    function luminance(color) {
      return rgb(color).map(channel => channel / 255).map(value =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      ).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0)
    }
    const textLuminance = luminance(text.color)
    const backgroundLuminance = luminance(background)
    const contrast = (Math.max(textLuminance, backgroundLuminance) + 0.05)
      / (Math.min(textLuminance, backgroundLuminance) + 0.05)
    return {
      errorColor: text.color,
      errorBackground: getComputedStyle(error).backgroundColor,
      modalBackground: background,
      contrast: Number(contrast.toFixed(2)),
      ancestors,
      fontSize: text.fontSize,
      fontWeight: text.fontWeight,
    }
  })
  console.log(JSON.stringify(measurement))
} finally {
  await browser.close()
}
