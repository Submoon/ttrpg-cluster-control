import type { Point } from '../domain/workspace'
import type { SvgViewportRect } from './map-zoom'

/** Indexes occupied screen space using bounded cells so each candidate checks nearby rectangles. */
export function continuousMapLabelSpace(viewport: SvgViewportRect, pixelScale: number) {
  const cellSize = 64 / pixelScale
  const stride = Math.floor(viewport.width / cellSize) + 1
  const cells = new Map<number, SvgViewportRect[]>()
  function visit(rect: SvgViewportRect, callback: (key: number) => boolean): boolean {
    const left = Math.max(rect.x - viewport.x, 0)
    const top = Math.max(rect.y - viewport.y, 0)
    const right = Math.min(rect.x - viewport.x + rect.width, viewport.width)
    const bottom = Math.min(rect.y - viewport.y + rect.height, viewport.height)
    if (left > right || top > bottom) return false
    const firstColumn = Math.floor(left / cellSize)
    const lastColumn = Math.floor(right / cellSize)
    for (let row = Math.floor(top / cellSize); row <= Math.floor(bottom / cellSize); row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (callback(row * stride + column)) return true
      }
    }
    return false
  }

  return {
    reserve(rect: SvgViewportRect) {
      visit(rect, (key) => {
        const cell = cells.get(key)
        if (cell) cell.push(rect)
        else cells.set(key, [rect])
        return false
      })
    },
    fits(rect: SvgViewportRect) {
      return rect.x >= viewport.x && rect.y >= viewport.y
        && rect.x + rect.width <= viewport.x + viewport.width
        && rect.y + rect.height <= viewport.y + viewport.height
        && !visit(rect, key => cells.get(key)?.some(obstacle => rect.x < obstacle.x + obstacle.width
          && rect.x + rect.width > obstacle.x && rect.y < obstacle.y + obstacle.height
          && rect.y + rect.height > obstacle.y) ?? false)
    },
  }
}

export interface ContinuousMapObjectCaption {
  id: string
  point: Point
  radius: number
  unit: number
  name?: string
  key?: string
  selected?: boolean
  preferRight?: boolean
}

export function continuousMapDestinationCaptionId(routeId: string): string {
  return `destination:${routeId}`
}

export function continuousMapObjectCaptionId(ownerId: string, objectId: string): string {
  return `object:${ownerId.length}:${ownerId}${objectId}`
}

const measuredWidths = new Map<string, number>()
let measureContext: CanvasRenderingContext2D | null | undefined

function captionWidth(text: string, monospace: boolean): number {
  const cacheKey = `${monospace}:${text}`
  const cached = measuredWidths.get(cacheKey)
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') return text.length * 7
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (measureContext) measureContext.font = monospace ? '9px Consolas, monospace' : '12px Georgia, serif'
  const width = measureContext?.measureText(text).width ?? text.length * 7
  if (measuredWidths.size >= 2048) measuredWidths.clear()
  measuredWidths.set(cacheKey, width)
  return width
}

/** Places visible captions in stable priority order, with a fixed number of candidates per object. */
export function layoutContinuousMapObjectCaptions(
  objects: readonly ContinuousMapObjectCaption[],
  obstacles: readonly SvgViewportRect[],
  viewport: SvgViewportRect,
  pixelScale: number,
): { offsets: ReadonlyMap<string, Point>; obstacles: readonly SvgViewportRect[] } {
  const space = continuousMapLabelSpace(viewport, pixelScale)
  const occupied = [...obstacles]
  const offsets = new Map<string, Point>()
  const gap = 3 / pixelScale
  for (const rect of obstacles) space.reserve(rect)
  for (const { point, radius } of objects) {
    const rect = { x: point.x - radius, y: point.y - radius, width: 2 * radius, height: 2 * radius }
    occupied.push(rect)
    space.reserve(rect)
  }
  for (const selected of [true, false]) {
    for (const { id, point, radius, unit, name, key, preferRight, selected: isSelected } of objects) {
      if (Boolean(isSelected) !== selected || !name || point.x < viewport.x || point.y < viewport.y
        || point.x > viewport.x + viewport.width || point.y > viewport.y + viewport.height) continue
      const width = Math.max(captionWidth(name, false), key ? captionWidth(key, true) : 0) * unit + 2 * gap
      const height = (key ? 27 : 14) * unit + 2 * gap
      const x = point.x - width / 2
      const y = point.y - height / 2
      const down = { x, y: point.y + radius + gap, width, height }
      const up = { x, y: point.y - radius - gap - height, width, height }
      const right = { x: point.x + radius + gap, y, width, height }
      const left = { x: point.x - radius - gap - width, y, width, height }
      const rect = (preferRight ? [right, left, down, up] : [down, up, right, left]).find(space.fits)
        ?? [
          { ...right, y: up.y }, { ...left, y: up.y },
          { ...right, y: down.y }, { ...left, y: down.y },
        ].find(space.fits)
      if (!rect) continue
      offsets.set(id, {
        x: rect.x + width / 2 - point.x,
        y: rect.y + height - gap - 3 * unit - point.y,
      })
      space.reserve(rect)
      occupied.push(rect)
    }
  }
  return { offsets, obstacles: occupied }
}
