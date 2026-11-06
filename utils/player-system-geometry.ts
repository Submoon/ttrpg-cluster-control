/** Conservative public Star System bounds shared by the preview and image renderer. */
import type { PlayerSystemDocument } from '../domain/player-projection'
import { playerObjectPresentation } from './player-object-presentation'

const UNKNOWN_MARKER_RADIUS = 10
const OBJECT_GLYPH_HALF_WIDTH = 12
const OBJECT_GLYPH_TOP = 16
const OBJECT_GLYPH_BOTTOM = 10
const UNOCCUPIED_CENTER_RADIUS = 3
const OBJECT_LABEL_OFFSET = 16
const OBJECT_LABEL_CHARACTER_ADVANCE = 18

interface MutableBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PlayerSystemGeometry {
  bounds: { left: number; top: number; width: number; height: number }
}

function includeRect(bounds: MutableBounds, left: number, top: number, right: number, bottom: number): void {
  bounds.left = Math.min(bounds.left, left)
  bounds.top = Math.min(bounds.top, top)
  bounds.right = Math.max(bounds.right, right)
  bounds.bottom = Math.max(bounds.bottom, bottom)
}

/**
 * Computes a padded scene envelope using only projected objects and Orbits.
 * Label extents deliberately overestimate the rendered text so SVG and preview retain all content.
 */
export function playerSystemGeometry(document: PlayerSystemDocument): PlayerSystemGeometry {
  const bounds: MutableBounds = {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  }

  for (const object of document.objects) {
    const { x, y } = object.position
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('A public Star System has invalid rendered geometry.')
    }
    const label = playerObjectPresentation(object).label
    if (object.disclosure === 'unknown') {
      includeRect(
        bounds,
        x - UNKNOWN_MARKER_RADIUS,
        y - UNKNOWN_MARKER_RADIUS,
        x + UNKNOWN_MARKER_RADIUS,
        y + UNKNOWN_MARKER_RADIUS,
      )
    } else {
      includeRect(
        bounds,
        x - OBJECT_GLYPH_HALF_WIDTH,
        y - OBJECT_GLYPH_TOP,
        x + OBJECT_GLYPH_HALF_WIDTH,
        y + OBJECT_GLYPH_BOTTOM,
      )
    }
    includeRect(
      bounds,
      x + OBJECT_LABEL_OFFSET,
      y - UNKNOWN_MARKER_RADIUS,
      x + OBJECT_LABEL_OFFSET + label.length * OBJECT_LABEL_CHARACTER_ADVANCE,
      y + 12,
    )
  }

  for (const orbit of document.orbits) {
    const { x, y } = orbit.center
    const { horizontal, vertical } = orbit.radii
    if (![x, y, horizontal, vertical, orbit.rotation].every(Number.isFinite)
      || horizontal <= 0 || vertical <= 0) {
      throw new Error('A public Star System has invalid rendered geometry.')
    }
    const radians = orbit.rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    const horizontalExtent = Math.sqrt(horizontal ** 2 * cosine ** 2 + vertical ** 2 * sine ** 2)
    const verticalExtent = Math.sqrt(horizontal ** 2 * sine ** 2 + vertical ** 2 * cosine ** 2)
    includeRect(
      bounds,
      x - horizontalExtent,
      y - verticalExtent,
      x + horizontalExtent,
      y + verticalExtent,
    )
    if (orbit.hostId === null) {
      includeRect(
        bounds,
        x - UNOCCUPIED_CENTER_RADIUS,
        y - UNOCCUPIED_CENTER_RADIUS,
        x + UNOCCUPIED_CENTER_RADIUS,
        y + UNOCCUPIED_CENTER_RADIUS,
      )
    }
  }

  if (!document.objects.length && !document.orbits.length) {
    return { bounds: { left: -48, top: -67, width: 1056, height: 694 } }
  }

  const width = bounds.right - bounds.left
  const height = bounds.bottom - bounds.top
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom, width, height].every(Number.isFinite)
    || width < 0 || height < 0) {
    throw new Error('A public Star System has invalid rendered geometry.')
  }

  const padding = Math.max(width * 0.08, height * 0.12, 48)
  const left = bounds.left - padding
  const top = bounds.top - padding
  const paddedWidth = Math.max(width, 1) + padding * 2
  const paddedHeight = Math.max(height, 1) + padding * 2
  if (![left, top, paddedWidth, paddedHeight].every(Number.isFinite)
    || paddedWidth <= 0 || paddedHeight <= 0) {
    throw new Error('A public Star System has invalid rendered geometry.')
  }
  return { bounds: { left, top, width: paddedWidth, height: paddedHeight } }
}
