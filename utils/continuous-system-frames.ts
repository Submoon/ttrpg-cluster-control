import type { Point } from '../domain/workspace-model'
import type { SvgViewportRect } from './map-zoom'

export interface ContinuousSystemFrameInput {
  id: string
  anchor: Point
  /** The system's original chosen rectangular frame, before clipping against neighbors. */
  envelope: SvgViewportRect
}

interface FrameCaps {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Separates originally overlapping rectangular system frames without moving their anchors.
 * Every pair is compared using its original rectangles; all resulting caps are combined only
 * after pair processing, so output does not depend on the input order. Equal anchors split on
 * x, with IDs ordering the systems and the shared anchor as the clamped split point. Interior
 * systems among three or more coincident anchors can have zero-width frames; renderers omit them.
 */
export function continuousSystemFrames(
  systems: readonly ContinuousSystemFrameInput[],
): ReadonlyMap<string, SvgViewportRect> {
  const caps = new Map(systems.map(({ id, envelope }) => [id, {
    left: envelope.x,
    top: envelope.y,
    right: envelope.x + envelope.width,
    bottom: envelope.y + envelope.height,
  } satisfies FrameCaps]))

  for (let firstIndex = 0; firstIndex < systems.length; firstIndex += 1) {
    const first = systems[firstIndex]!
    for (let secondIndex = firstIndex + 1; secondIndex < systems.length; secondIndex += 1) {
      const second = systems[secondIndex]!
      const overlapLeft = Math.max(first.envelope.x, second.envelope.x)
      const overlapTop = Math.max(first.envelope.y, second.envelope.y)
      const overlapRight = Math.min(
        first.envelope.x + first.envelope.width,
        second.envelope.x + second.envelope.width,
      )
      const overlapBottom = Math.min(
        first.envelope.y + first.envelope.height,
        second.envelope.y + second.envelope.height,
      )
      if (!(overlapRight > overlapLeft && overlapBottom > overlapTop)) continue

      const deltaX = second.anchor.x - first.anchor.x
      const deltaY = second.anchor.y - first.anchor.y
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        const firstComesFirst = deltaX === 0 ? first.id < second.id : deltaX > 0
        applyPairCap(
          caps,
          firstComesFirst ? first.id : second.id,
          firstComesFirst ? second.id : first.id,
          'x',
          clamp((first.anchor.x + second.anchor.x) / 2, overlapLeft, overlapRight),
        )
      } else {
        const firstComesFirst = deltaY > 0
        applyPairCap(
          caps,
          firstComesFirst ? first.id : second.id,
          firstComesFirst ? second.id : first.id,
          'y',
          clamp((first.anchor.y + second.anchor.y) / 2, overlapTop, overlapBottom),
        )
      }
    }
  }

  return new Map(systems.map(({ id, envelope }) => {
    const cap = caps.get(id)!
    // Pair caps are between the involved anchors. Preserve that invariant if future callers
    // supply an unusual frame whose anchor lies outside its bounds.
    const left = Math.min(cap.right, Math.max(cap.left, envelope.x))
    const top = Math.min(cap.bottom, Math.max(cap.top, envelope.y))
    const right = Math.max(left, Math.min(cap.right, envelope.x + envelope.width))
    const bottom = Math.max(top, Math.min(cap.bottom, envelope.y + envelope.height))
    return [id, { x: left, y: top, width: right - left, height: bottom - top }]
  }))
}

function applyPairCap(
  caps: Map<string, FrameCaps>,
  firstId: string,
  secondId: string,
  axis: 'x' | 'y',
  split: number,
): void {
  const first = caps.get(firstId)!
  const second = caps.get(secondId)!
  if (axis === 'x') {
    first.right = Math.min(first.right, split)
    second.left = Math.max(second.left, split)
  } else {
    first.bottom = Math.min(first.bottom, split)
    second.top = Math.max(second.top, split)
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
