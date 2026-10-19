// Sampling only: temporarily suppress foreground paint, capture its actual
// composited background, and restore the exact original inline style in finally.
// No acceptance styles, forced focus or threshold adjustments are introduced.
export async function sampleContrast(page, locator, kind = 'text') {
  const row = await locator.evaluate((el, kind) => {
    const css = getComputedStyle(el), pseudo = kind === 'handle' ? getComputedStyle(el, '::after') : null
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const color = kind === 'focus' ? css.outlineColor : pseudo ? pseudo.backgroundColor : css.color
    ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
    const rgba = [...ctx.getImageData(0, 0, 1, 1).data]; rgba[3] /= 255
    for (let node = el; node; node = node.parentElement) rgba[3] *= Number(getComputedStyle(node).opacity)
    return { kind, css: color, rgba, bounds: el.getBoundingClientRect().toJSON(), extent: kind === 'focus' ? Math.max(0, parseFloat(css.outlineWidth) + parseFloat(css.outlineOffset)) + .75 : 0, text: el.getAttribute('aria-label') || el.textContent?.trim(), pseudo: pseudo ? { width: pseudo.width, height: pseudo.height } : null }
  }, kind)
  if (kind === 'handle') {
    // The production cue can include a deliberate adjacent halo. Sample its
    // real painted foreground and immediate neighbors without hiding either.
    const pixels = (await page.screenshot()).toString('base64')
    return await page.evaluate(async ({ row, pixels }) => {
      const image = new Image(); image.src = `data:image/png;base64,${pixels}`; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0)
      const at = (x, y) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3)
      const lum = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
      const x = row.bounds.left + row.bounds.width / 2
      const samples = [.25, .5, .75].flatMap(part => {
        const y = row.bounds.top + row.bounds.height / 2 + (part - .5) * parseFloat(row.pseudo.height)
        const actual = at(x, y)
        return [-2, 2].map(dx => {
          const background = at(x + dx, y), a = lum(actual), b = lum(background)
          return { x, y, neighborX: x + dx, actual, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
        })
      })
      return { ...row, samples, minimum: Math.min(...samples.map(sample => sample.ratio)), threshold: 3, method: 'Unmodified screenshot: actual 2px cue pixels versus both immediately adjacent pixels, preserving any production halo. Three straight-stroke positions; rounded ends excluded.' }
    }, { row, pixels })
  }
  const original = await locator.getAttribute('style')
  try {
    if (kind === 'text') await locator.evaluate(el => { el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important') })
    if (kind === 'handle') await locator.evaluate(el => el.style.setProperty('opacity', '0', 'important'))
    const pixels = (await page.screenshot()).toString('base64')
    return await page.evaluate(async ({ row, pixels }) => {
      const image = new Image(); image.src = `data:image/png;base64,${pixels}`; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0)
      const at = (x, y) => [...ctx.getImageData(Math.max(0, Math.min(image.width - 1, Math.floor(x))), Math.max(0, Math.min(image.height - 1, Math.floor(y))), 1, 1).data].slice(0, 3)
      const r = row.bounds, d = row.extent
      const background = row.kind === 'focus'
        ? [at(r.left - d, r.top + r.height / 2), at(r.right + d, r.top + r.height / 2), at(r.left + r.width / 2, r.top - d), at(r.left + r.width / 2, r.bottom + d)]
        : row.kind === 'handle'
          ? [.25, .5, .75].map(part => at(r.left + r.width / 2, r.top + r.height / 2 + (part - .5) * parseFloat(row.pseudo.height)))
          : [.25, .5, .75].map(part => at(r.left + r.width * part, r.top + r.height / 2))
      const lum = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
      const ratios = background.map(bg => {
        const foreground = row.rgba.slice(0, 3).map((v, i) => v * row.rgba[3] + bg[i] * (1 - row.rgba[3])), a = lum(foreground), b = lum(bg)
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      })
      return { ...row, background, ratios, minimum: Math.min(...ratios), threshold: row.kind === 'text' ? 4.5 : 3, method: 'Browser-parsed foreground with effective ancestor opacity against actual rendered background pixels; full style restored after foreground-only sampling.' }
    }, { row, pixels })
  } finally {
    if (kind !== 'focus') await locator.evaluate((el, original) => original === null ? el.removeAttribute('style') : el.setAttribute('style', original), original)
  }
}

export async function sampleFocusContour(page, locator) {
  const shape = await locator.evaluate(el => {
    const css = getComputedStyle(el), bounds = el.getBoundingClientRect()
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = css.outlineColor; ctx.fillRect(0, 0, 1, 1)
    const rgba = [...ctx.getImageData(0, 0, 1, 1).data]; rgba[3] /= 255
    for (let node = el; node; node = node.parentElement) rgba[3] *= Number(getComputedStyle(node).opacity)
    const width = parseFloat(css.outlineWidth), offset = parseFloat(css.outlineOffset), distance = offset + width / 2
    const points = [], add = (edge, x, y) => {
      const neighbor = document.elementsFromPoint(x, y).find(node => node !== el && !el.contains(node))
      points.push({ edge, x, y, neighbor: neighbor ? { tag: neighbor.tagName, name: neighbor.getAttribute('aria-label') || neighbor.textContent?.trim().slice(0, 100), border: getComputedStyle(neighbor).border, background: getComputedStyle(neighbor).backgroundColor } : null })
    }
    // Sample actual straight painted outline contours. Rounded corner arcs are
    // excluded explicitly; full viewport/clipping extent is checked separately.
    const xInset = Math.min(bounds.width / 3, Math.max(8, bounds.width * .12)), yInset = Math.min(bounds.height / 3, Math.max(8, bounds.height * .12))
    for (let x = bounds.left + xInset; x <= bounds.right - xInset; x += 2) {
      add('top', x, bounds.top - distance); add('bottom', x, bounds.bottom + distance)
    }
    for (let y = bounds.top + yInset; y <= bounds.bottom - yInset; y += 2) {
      add('left', bounds.left - distance, y); add('right', bounds.right + distance, y)
    }
    return { bounds: bounds.toJSON(), width, offset, rgba, css: css.outlineColor, focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'), points }
  })
  const focusedPixels = await page.screenshot(), original = await locator.getAttribute('style')
  let hiddenPixels
  try {
    // Preserve width/offset and all neighbor paint; remove only the focused
    // outline's color to reveal the actual border/background beneath its ring.
    await locator.evaluate(el => el.style.setProperty('outline-color', 'transparent', 'important'))
    hiddenPixels = await page.screenshot()
  } finally {
    await locator.evaluate((el, original) => original === null ? el.removeAttribute('style') : el.setAttribute('style', original), original)
  }
  const measured = await page.evaluate(async ({ shape, focusedPixels, hiddenPixels }) => {
    const load = async pixels => {
      const image = new Image(); image.src = `data:image/png;base64,${pixels}`; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0)
      return (x, y) => [...ctx.getImageData(Math.max(0, Math.min(image.width - 1, Math.floor(x))), Math.max(0, Math.min(image.height - 1, Math.floor(y))), 1, 1).data].slice(0, 3)
    }
    const [actualAt, backgroundAt] = await Promise.all([load(focusedPixels), load(hiddenPixels)])
    const lum = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0)
    const points = shape.points.map(point => {
      const background = backgroundAt(point.x, point.y), actual = actualAt(point.x, point.y)
      const expected = shape.rgba.slice(0, 3).map((value, index) => value * shape.rgba[3] + background[index] * (1 - shape.rgba[3]))
      const a = lum(expected), b = lum(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      return { ...point, background, actual, expected, ratio, paintMatches: actual.every((value, index) => Math.abs(value - expected[index]) <= 16) }
    })
    return { ...shape, points, minimum: Math.min(...points.map(point => point.ratio)), paintMatches: points.every(point => point.paintMatches), threshold: 3, method: 'Natural keyboard focus; actual painted straight contour versus same-location actual neighboring border/background after outline-color-only suppression. Rounded corner arcs excluded; full outline extent checked separately.' }
  }, { shape, focusedPixels: focusedPixels.toString('base64'), hiddenPixels: hiddenPixels.toString('base64') })
  return { measurement: measured, focusedPixels }
}
