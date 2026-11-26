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

/** Constrains one proposed frame against fixed neighbors without moving those neighbors. */
export function constrainContinuousSystemFrame(
  proposal: ContinuousSystemFrameInput,
  fixedFrames: readonly ContinuousSystemFrameInput[],
  /** Optional opposite corner to keep fixed during a resize. */
  fixedCorner?: Point,
): SvgViewportRect {
  if (fixedFrames.some(frame => frame.id === proposal.id)
    || new Set(fixedFrames.map(frame => frame.id)).size !== fixedFrames.length) {
    throw new Error('A proposed Zone frame needs unique Zone identities.')
  }

  const proposalBounds = boundsOf(proposal.envelope)
  let { left, top, right, bottom } = proposalBounds
  const anchorIsAuthored = proposal.anchor.x >= left && proposal.anchor.x <= right
    && proposal.anchor.y >= top && proposal.anchor.y <= bottom

  // Stable ordering makes the result independent of how callers enumerate fixed neighbors.
  const orderedFixedFrames = [...fixedFrames].sort((leftFrame, rightFrame) =>
    leftFrame.id < rightFrame.id ? -1 : leftFrame.id > rightFrame.id ? 1 : 0,
  )
  for (const fixed of orderedFixedFrames) {
    const fixedBounds = boundsOf(fixed.envelope)
    if (!(Math.min(right, fixedBounds.right) > Math.max(left, fixedBounds.left)
      && Math.min(bottom, fixedBounds.bottom) > Math.max(top, fixedBounds.top))) continue

    const deltaX = fixed.anchor.x - proposal.anchor.x
    const deltaY = fixed.anchor.y - proposal.anchor.y
    const horizontalComesFirst = deltaX === 0 ? proposal.id < fixed.id : deltaX > 0
    const verticalComesFirst = deltaY > 0
    const current = { left, top, right, bottom }
    const horizontal = clipToFixedNeighbor(current, fixedBounds, 'x', horizontalComesFirst)
    const vertical = clipToFixedNeighbor(current, fixedBounds, 'y', verticalComesFirst)
    const prefersHorizontal = Math.abs(deltaX) >= Math.abs(deltaY)
    const preferred = prefersHorizontal ? horizontal : vertical
    const alternate = prefersHorizontal ? vertical : horizontal
    const preservesResizeGeometry = (bounds: FrameCaps) => hasPositiveArea(bounds)
      && (!anchorIsAuthored || containsAnchor(bounds, proposal.anchor))
      && (!fixedCorner || containsAnchor(bounds, fixedCorner))
    const preferredPreservesGeometry = preservesResizeGeometry(preferred)
    const alternatePreservesGeometry = preservesResizeGeometry(alternate)
    const constrained = !preferredPreservesGeometry && alternatePreservesGeometry ? alternate : preferred
    left = constrained.left
    top = constrained.top
    right = constrained.right
    bottom = constrained.bottom

    if (anchorIsAuthored && (proposal.anchor.x < left || proposal.anchor.x > right)) {
      left = proposal.anchor.x
      right = proposal.anchor.x
    }
    if (right < left) {
      const corner = anchorIsAuthored
        ? proposal.anchor.x
        : clamp(proposal.anchor.x, proposalBounds.left, proposalBounds.right)
      left = corner
      right = corner
    }
    if (anchorIsAuthored && (proposal.anchor.y < top || proposal.anchor.y > bottom)) {
      top = proposal.anchor.y
      bottom = proposal.anchor.y
    }
    if (bottom < top) {
      const corner = anchorIsAuthored
        ? proposal.anchor.y
        : clamp(proposal.anchor.y, proposalBounds.top, proposalBounds.bottom)
      top = corner
      bottom = corner
    }
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

function boundsOf(rect: SvgViewportRect): FrameCaps {
  const farX = rect.x + rect.width
  const farY = rect.y + rect.height
  return {
    left: Math.min(rect.x, farX),
    top: Math.min(rect.y, farY),
    right: Math.max(rect.x, farX),
    bottom: Math.max(rect.y, farY),
  }
}

function clipToFixedNeighbor(
  bounds: FrameCaps,
  fixed: FrameCaps,
  axis: 'x' | 'y',
  proposalComesFirst: boolean,
): FrameCaps {
  if (axis === 'x') {
    return proposalComesFirst
      ? { ...bounds, right: Math.min(bounds.right, fixed.left) }
      : { ...bounds, left: Math.max(bounds.left, fixed.right) }
  }
  return proposalComesFirst
    ? { ...bounds, bottom: Math.min(bounds.bottom, fixed.top) }
    : { ...bounds, top: Math.max(bounds.top, fixed.bottom) }
}

function containsAnchor(bounds: FrameCaps, anchor: Point): boolean {
  return anchor.x >= bounds.left && anchor.x <= bounds.right
    && anchor.y >= bounds.top && anchor.y <= bounds.bottom
}

function hasPositiveArea(bounds: FrameCaps): boolean {
  return bounds.right > bounds.left && bounds.bottom > bounds.top
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
