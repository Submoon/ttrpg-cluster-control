import { expect, test } from '@playwright/test'
import { fitPlayerMapToViewport, revealPlayerMapPoint } from '../utils/player-map-fit'

test('a sparse player map keeps at most one CSS pixel per scene unit when fitted', { tag: '@pure' }, () => {
  const content = { left: 430, top: 250, width: 36, height: 36 }
  const viewport = { width: 1440, height: 900 }
  const fitted = fitPlayerMapToViewport(content, viewport)

  expect(fitted.width).toBeGreaterThanOrEqual(viewport.width)
  expect(fitted.height).toBe(fitted.width / (viewport.width / viewport.height))
  expect(fitted.left + fitted.width / 2).toBe(content.left + content.width / 2)
  expect(fitted.top + fitted.height / 2).toBe(content.top + content.height / 2)

  const scale = Math.min(viewport.width / fitted.width, viewport.height / fitted.height)
  expect(scale).toBeLessThanOrEqual(1)
})

test('player map Fit expands wide or tall content without clipping and preserves the viewport aspect ratio', { tag: '@pure' }, () => {
  const cases = [
    {
      content: { left: -1800, top: 40, width: 2400, height: 300 },
      viewport: { width: 1000, height: 500 },
    },
    {
      content: { left: 470, top: -700, width: 80, height: 1600 },
      viewport: { width: 1200, height: 800 },
    },
  ]

  for (const { content, viewport } of cases) {
    const fitted = fitPlayerMapToViewport(content, viewport)
    const aspect = viewport.width / viewport.height
    expect(fitted.width).toBe(Math.max(content.width, content.height * aspect, viewport.width))
    expect(fitted.height).toBe(fitted.width / aspect)
    expect(fitted.left).toBe(content.left + content.width / 2 - fitted.width / 2)
    expect(fitted.top).toBe(content.top + content.height / 2 - fitted.height / 2)
    expect(fitted.left).toBeLessThanOrEqual(content.left)
    expect(fitted.left + fitted.width).toBeGreaterThanOrEqual(content.left + content.width)
    expect(fitted.top).toBeLessThanOrEqual(content.top)
    expect(fitted.top + fitted.height).toBeGreaterThanOrEqual(content.top + content.height)
  }
})

test('public inspection reveals edge targets through a bounded usable viewport without zooming', { tag: '@pure' }, () => {
  const current = { left: 0, top: 0, width: 1000, height: 600 }
  const usable = { left: 300, top: 0, right: 700, bottom: 600 }
  const viewport = { width: 1000, height: 600 }

  expect(revealPlayerMapPoint({
    point: { x: 20, y: 300 },
    current,
    fitted: current,
    viewport,
    usable,
  })).toEqual({ left: -300, top: 0, width: 1000, height: 600 })
  expect(revealPlayerMapPoint({
    point: { x: 980, y: 300 },
    current,
    fitted: current,
    viewport,
    usable,
  })).toEqual({ left: 300, top: 0, width: 1000, height: 600 })

  const zoomed = { left: 100, top: 0, width: 500, height: 300 }
  expect(revealPlayerMapPoint({
    point: { x: 150, y: 150 },
    current: zoomed,
    fitted: current,
    viewport,
    usable,
  })).toEqual({ left: -10, top: 0, width: 500, height: 300 })
})

test('public inspection keeps fitted views still and accounts for SVG meet letterboxing', { tag: '@pure' }, () => {
  const fitted = { left: -200, top: -100, width: 1000, height: 600 }
  const fullViewport = { width: 1000, height: 800 }
  expect(revealPlayerMapPoint({
    point: { x: 0, y: 0 },
    current: fitted,
    fitted,
    viewport: fullViewport,
    usable: { left: 0, top: 0, right: 1000, bottom: 800 },
  })).toEqual(fitted)

  expect(revealPlayerMapPoint({
    point: { x: 0, y: -90 },
    current: fitted,
    fitted,
    viewport: fullViewport,
    usable: { left: 0, top: 200, right: 1000, bottom: 800 },
  })).toEqual({ left: -200, top: -200, width: 1000, height: 600 })
})

test('public inspection rejects blocked or invalid usable rectangles and reduces margin for narrow areas', { tag: '@pure' }, () => {
  const current = { left: 0, top: 0, width: 1000, height: 600 }
  const viewport = { width: 1000, height: 600 }
  const target = { x: 20, y: 300 }
  expect(revealPlayerMapPoint({
    point: target,
    current,
    fitted: current,
    viewport,
    usable: null,
  })).toBeUndefined()
  expect(revealPlayerMapPoint({
    point: target,
    current,
    fitted: current,
    viewport,
    usable: { left: 800, top: 0, right: 800, bottom: 600 },
  })).toBeUndefined()
  expect(revealPlayerMapPoint({
    point: target,
    current,
    fitted: current,
    viewport,
    usable: { left: 0, top: 0, right: 30, bottom: 600 },
  })).toEqual({ left: 5, top: 0, width: 1000, height: 600 })
})
