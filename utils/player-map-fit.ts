/** Scene bounds used by the independent public player map cameras. */
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
