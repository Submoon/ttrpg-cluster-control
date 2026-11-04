/** Scene bounds used by the independent public player map cameras. */
import type { ClientRectBounds } from './map-usable-area'

export interface PlayerMapSceneBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface PlayerMapViewportSize {
  width: number
  height: number
}

export interface PlayerMapSceneInsets {
  left: number
  top: number
  right: number
  bottom: number
}

export interface RevealPlayerMapPointOptions {
  point: { x: number; y: number }
  current: PlayerMapSceneBounds
  fitted: PlayerMapSceneBounds
  viewport: PlayerMapViewportSize
  /** Usable client pixels relative to the SVG viewport's 0,0 origin; null blocks navigation. */
  usable: ClientRectBounds | null
  margin?: number
}

/** Fits public content while capping magnification at one CSS pixel per scene unit. */
export function fitPlayerMapToViewport(
  contentBounds: PlayerMapSceneBounds,
  viewportSize: PlayerMapViewportSize,
): PlayerMapSceneBounds {
  const contentWidth = Number.isFinite(contentBounds.width) && contentBounds.width > 0 ? contentBounds.width : 1
  const contentHeight = Number.isFinite(contentBounds.height) && contentBounds.height > 0 ? contentBounds.height : 1
  const left = Number.isFinite(contentBounds.left) ? contentBounds.left : 0
  const top = Number.isFinite(contentBounds.top) ? contentBounds.top : 0
  const viewportWidth = Number.isFinite(viewportSize.width) && viewportSize.width > 0 ? viewportSize.width : 960
  const viewportHeight = Number.isFinite(viewportSize.height) && viewportSize.height > 0 ? viewportSize.height : 560
  const aspectRatio = viewportWidth / viewportHeight
  const width = Math.max(contentWidth, contentHeight * aspectRatio, viewportWidth)
  const height = width / aspectRatio

  return {
    left: left + (contentWidth - width) / 2,
    top: top + (contentHeight - height) / 2,
    width,
    height,
  }
}

/** Converts the unobstructed client rectangle into scene insets after SVG meet letterboxing. */
export function playerMapObstructionInsets(
  fitted: PlayerMapSceneBounds,
  viewport: PlayerMapViewportSize,
  usable: ClientRectBounds | null,
  camera: PlayerMapSceneBounds = fitted,
): PlayerMapSceneInsets | undefined {
  if (!isPositiveSceneBounds(fitted) || !isPositiveSceneBounds(camera)
    || camera.width > fitted.width || camera.height > fitted.height
    || !isPositiveViewport(viewport) || !isPositiveClientRect(usable)) {
    return undefined
  }

  const clipped = {
    left: Math.max(0, Math.min(viewport.width, usable.left)),
    top: Math.max(0, Math.min(viewport.height, usable.top)),
    right: Math.max(0, Math.min(viewport.width, usable.right)),
    bottom: Math.max(0, Math.min(viewport.height, usable.bottom)),
  }
  if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) return undefined

  const fit = meetTransform(camera, viewport)
  const visible = {
    left: Math.max(clipped.left, fit.offsetX),
    top: Math.max(clipped.top, fit.offsetY),
    right: Math.min(clipped.right, fit.offsetX + camera.width * fit.scale),
    bottom: Math.min(clipped.bottom, fit.offsetY + camera.height * fit.scale),
  }
  if (visible.right <= visible.left || visible.bottom <= visible.top) return undefined

  return {
    left: (visible.left - fit.offsetX) / fit.scale,
    top: (visible.top - fit.offsetY) / fit.scale,
    right: (fit.offsetX + camera.width * fit.scale - visible.right) / fit.scale,
    bottom: (fit.offsetY + camera.height * fit.scale - visible.bottom) / fit.scale,
  }
}

/** Pans only enough to place a public scene point within the current unobstructed SVG viewport. */
export function revealPlayerMapPoint(
  options: RevealPlayerMapPointOptions,
): PlayerMapSceneBounds | undefined {
  const { point, current, fitted, viewport, usable } = options
  const margin = options.margin ?? 20
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
    || !isPositiveSceneBounds(current) || !isPositiveSceneBounds(fitted)
    || current.width > fitted.width || current.height > fitted.height
    || !isPositiveViewport(viewport) || !Number.isFinite(margin) || margin < 0) {
    return undefined
  }

  const insets = playerMapObstructionInsets(fitted, viewport, usable, current)
  if (!insets) return undefined
  const usableRect = clipUsableRect(usable, viewport)
  if (!usableRect) return undefined
  const transform = meetTransform(current, viewport)
  const marginX = Math.min(margin, (usableRect.right - usableRect.left) / 2)
  const marginY = Math.min(margin, (usableRect.bottom - usableRect.top) / 2)
  const targetScreenX = transform.offsetX + (point.x - current.left) * transform.scale
  const targetScreenY = transform.offsetY + (point.y - current.top) * transform.scale
  let left = current.left
  let top = current.top

  if (targetScreenX < usableRect.left + marginX) {
    left += (targetScreenX - usableRect.left - marginX) / transform.scale
  } else if (targetScreenX > usableRect.right - marginX) {
    left += (targetScreenX - usableRect.right + marginX) / transform.scale
  }
  if (targetScreenY < usableRect.top + marginY) {
    top += (targetScreenY - usableRect.top - marginY) / transform.scale
  } else if (targetScreenY > usableRect.bottom - marginY) {
    top += (targetScreenY - usableRect.bottom + marginY) / transform.scale
  }

  const minLeft = fitted.left - insets.left
  const maxLeft = fitted.left + fitted.width - current.width + insets.right
  const minTop = fitted.top - insets.top
  const maxTop = fitted.top + fitted.height - current.height + insets.bottom
  return {
    left: clamp(left, minLeft, maxLeft),
    top: clamp(top, minTop, maxTop),
    width: current.width,
    height: current.height,
  }
}

function meetTransform(
  bounds: PlayerMapSceneBounds,
  viewport: PlayerMapViewportSize,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(viewport.width / bounds.width, viewport.height / bounds.height)
  return {
    scale,
    offsetX: (viewport.width - bounds.width * scale) / 2,
    offsetY: (viewport.height - bounds.height * scale) / 2,
  }
}

function clipUsableRect(rect: ClientRectBounds | null, viewport: PlayerMapViewportSize): ClientRectBounds | undefined {
  if (!isPositiveClientRect(rect)) return undefined
  const clipped = {
    left: Math.max(0, Math.min(viewport.width, rect.left)),
    top: Math.max(0, Math.min(viewport.height, rect.top)),
    right: Math.max(0, Math.min(viewport.width, rect.right)),
    bottom: Math.max(0, Math.min(viewport.height, rect.bottom)),
  }
  return clipped.right > clipped.left && clipped.bottom > clipped.top ? clipped : undefined
}

function isPositiveSceneBounds(bounds: PlayerMapSceneBounds): boolean {
  return [bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)
    && bounds.width > 0
    && bounds.height > 0
    && Number.isFinite(bounds.left + bounds.width)
    && Number.isFinite(bounds.top + bounds.height)
}

function isPositiveViewport(viewport: PlayerMapViewportSize): boolean {
  return [viewport.width, viewport.height].every(Number.isFinite)
    && viewport.width > 0
    && viewport.height > 0
}

function isPositiveClientRect(rect: ClientRectBounds | null): rect is ClientRectBounds {
  return rect !== null
    && [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
    && rect.right > rect.left
    && rect.bottom > rect.top
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
