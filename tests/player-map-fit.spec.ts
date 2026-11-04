import { expect, test } from '@playwright/test'
import { fitPlayerMapToViewport } from '../utils/player-map-fit'

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
