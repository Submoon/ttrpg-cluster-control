// Actual component styles/pixels, no injected acceptance CSS or forced clicks.
export const settle = page => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })

export async function focusGeometry(page, locator) {
  await locator.scrollIntoViewIfNeeded(); await locator.evaluate(el => el.blur()); await settle(page)
  const before = await locator.evaluate(el => { const s = getComputedStyle(el); return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow } })
  await locator.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
  const immediate = await locator.evaluate(el => { const s = getComputedStyle(el); return { outlineColor: s.outlineColor, outlineStyle: s.outlineStyle, transition: s.transitionProperty, focused: document.activeElement === el } })
  await settle(page)
  return locator.evaluate((el, { before, immediate }) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), extent = s.outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset)), clippedBy = []
    for (let p = el.parentElement; p; p = p.parentElement) { if (p === document.body || p === document.documentElement) continue; const ps = getComputedStyle(p), b = p.getBoundingClientRect(); if ((/(auto|scroll|hidden|clip)/.test(ps.overflowX) && (r.left - extent < b.left - .1 || r.right + extent > b.right + .1)) || (/(auto|scroll|hidden|clip)/.test(ps.overflowY) && (r.top - extent < b.top - .1 || r.bottom + extent > b.bottom + .1))) clippedBy.push({ tag: p.tagName, className: p.className }) }
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { before, immediate, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, outlineColor: s.outlineColor, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, shadow: s.boxShadow, extent, bounds: r.toJSON(), viewport: { width: innerWidth, height: innerHeight }, focused: document.activeElement === el, hit: hit === el || el.contains(hit), clippedBy, ringFits: r.top >= extent - .1 && r.bottom <= innerHeight - extent + .1 && r.left >= extent - .1 && r.right <= innerWidth - extent + .1 }
  }, { before, immediate })
}

export async function contrast(page, locator, kind = 'text', focus) {
  await locator.scrollIntoViewIfNeeded(); if (kind === 'control') await locator.evaluate(el => el.blur()); await settle(page)
  const row = await locator.evaluate((el, { kind, focus }) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true }), parse = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v) }
    let opacity = 1; for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity)
    const shadowColors = s.boxShadow.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)/g) ?? []
    const colors = kind === 'focus' ? [s.outlineStyle !== 'none' && focus?.outline !== focus?.before.outline ? s.outlineColor : null, ...(focus?.shadow !== focus?.before.shadow ? shadowColors : [])].filter(Boolean) : kind === 'control' ? [parseFloat(s.borderTopWidth) > 0 ? s.borderTopColor : null, ...shadowColors].filter(Boolean) : [s.color]
    return { kind, colors: colors.map(color => { const rgba = parse(color); rgba[3] *= opacity; return { css: color, rgba } }), bounds: r.toJSON(), offset: kind === 'focus' ? (focus?.extent ?? 0) + .75 : 2, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 120) }
  }, { kind, focus })
  const original = await locator.getAttribute('style')
  if (kind === 'text') await locator.evaluate(el => { el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important') })
  else if (kind === 'glyph') await locator.evaluate(el => el.style.setProperty('opacity', '0', 'important'))
  const pixels = (await page.screenshot()).toString('base64')
  if (kind === 'text' || kind === 'glyph') await locator.evaluate((el, original) => original === null ? el.removeAttribute('style') : el.setAttribute('style', original), original)
  return page.evaluate(async ({ row, pixels }) => {
    const img = new Image(); img.src = `data:image/png;base64,${pixels}`; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
    const at = (x, y) => Array.from(ctx.getImageData(Math.max(0, Math.min(img.width - 1, Math.floor(x))), Math.max(0, Math.min(img.height - 1, Math.floor(y))), 1, 1).data).slice(0, 3), r = row.bounds, d = row.offset
    const backgrounds = ['text', 'glyph'].includes(row.kind) ? [.25, .5, .75].map(x => at(r.x + r.width * x, r.y + r.height / 2)) : [at(r.left - d, r.top + r.height / 2), at(r.right + d, r.top + r.height / 2), at(r.left + r.width / 2, r.top - d), at(r.left + r.width / 2, r.bottom + d)]
    const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    const candidates = row.colors.filter(c => c.rgba[3] > 0).map(color => ({ ...color, minimum: Math.min(...backgrounds.map(bg => { const f = color.rgba.slice(0, 3).map((v, i) => v * color.rgba[3] + bg[i] * (1 - color.rgba[3])), a = lum(f), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) })) }))
    return { ...row, backgrounds, candidates, minimum: Math.max(...candidates.map(c => c.minimum)), threshold: row.kind === 'text' ? 4.5 : 3, method: row.kind === 'focus' ? 'changed actual outline/ring colors against adjacent rendered panel; strongest changed nontransparent cue, with each candidate retained' : 'computed alpha-composited foreground against actual screenshot background' }
  }, { row, pixels })
}
