import type { Point } from './workspace-model'

/** Converts normalized local map coordinates to the shared SVG scene coordinate system. */
export function fromNormalizedMapPoint(point: Readonly<Point>): Point {
  return {
    x: 64 + point.x * 832,
    y: 72 + point.y * 416,
  }
}

/** Converts an SVG scene point to normalized local map coordinates without clamping. */
export function toNormalizedMapPoint(point: Point): Point {
  return {
    x: (point.x - 64) / 832,
    y: (point.y - 72) / 416,
  }
}
