import { expect, type Locator, type Page } from '@playwright/test'

export interface PaintedBounds {
  x: number
  y: number
  width: number
  height: number
}

interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface VisibleObstruction {
  rect: ScreenRect
  element: {
    tagName: string
    className: string | null
    aria: Array<{ name: string; value: string }>
    dataMap: Array<{ name: string; value: string }>
  }
}

const ORBIT_SAMPLE_ERROR_CSS_PIXELS = 0.25

/** Measures visible paint bounds; Orbit curves use browser SVG geometry and a conservative stroke envelope. */
export async function measurePaintedBounds(element: Locator): Promise<PaintedBounds | null> {
  await expect(element).toBeVisible()
  return element.evaluate((node, sampleErrorCssPixels): PaintedBounds | null => {
    if (!node.isConnected || node.getClientRects().length === 0) return null
    if (!node.matches('.orbit-ring')) {
      const bounds = node.getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
    if (!(node instanceof SVGGeometryElement)) {
      throw new Error('An .orbit-ring paint measurement must target an SVGGeometryElement.')
    }

    const totalLength = node.getTotalLength()
    const transform = node.getScreenCTM()
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      throw new Error('The visible Orbit ring has no finite positive SVG path length.')
    }
    if (!transform) throw new Error('The visible Orbit ring has no screen transform.')
    const matrix = [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]
    if (!matrix.every(Number.isFinite)) throw new Error('The visible Orbit ring has a non-finite screen transform.')
    const maxStretch = Math.hypot(transform.a, transform.b, transform.c, transform.d)
    if (!Number.isFinite(maxStretch) || maxStretch <= 0) {
      throw new Error('The visible Orbit ring has no finite positive screen scale.')
    }

    const computed = getComputedStyle(node)
    const strokeWidth = Number.parseFloat(computed.strokeWidth)
    const strokeOpacity = Number.parseFloat(computed.strokeOpacity)
    const elementOpacity = Number.parseFloat(computed.opacity)
    const strokeColor = computed.stroke
    const vectorEffect = computed.getPropertyValue('vector-effect') || 'none'
    if (strokeColor === 'none' || !Number.isFinite(strokeWidth) || strokeWidth < 0
      || !Number.isFinite(strokeOpacity) || strokeOpacity <= 0
      || !Number.isFinite(elementOpacity) || elementOpacity <= 0) {
      throw new Error(`The visible Orbit ring has no measurable painted stroke: ${JSON.stringify({
        stroke: strokeColor,
        strokeWidth: computed.strokeWidth,
        strokeOpacity: computed.strokeOpacity,
        opacity: computed.opacity,
        vectorEffect,
      })}`)
    }

    const sampleCount = Math.ceil(totalLength * maxStretch / (2 * sampleErrorCssPixels))
    if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
      throw new Error(`The Orbit ring sample count is not a finite positive safe integer: ${sampleCount}.`)
    }

    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (let index = 0; index <= sampleCount; index += 1) {
      const point = node.getPointAtLength(index * totalLength / sampleCount)
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(transform)
      if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
        throw new Error(`The Orbit ring produced a non-finite SVG sample at index ${index}.`)
      }
      left = Math.min(left, screenPoint.x)
      top = Math.min(top, screenPoint.y)
      right = Math.max(right, screenPoint.x)
      bottom = Math.max(bottom, screenPoint.y)
    }

    const halfStroke = strokeWidth / 2
    const nonScalingStroke = vectorEffect === 'non-scaling-stroke'
    const horizontalExpansion = halfStroke * (nonScalingStroke ? 1 : Math.hypot(transform.a, transform.c))
    const verticalExpansion = halfStroke * (nonScalingStroke ? 1 : Math.hypot(transform.b, transform.d))
    if (![left, top, right, bottom, horizontalExpansion, verticalExpansion].every(Number.isFinite)) {
      throw new Error('The Orbit ring painted envelope contains a non-finite bound.')
    }

    const outwardPadding = sampleErrorCssPixels
    return {
      x: left - outwardPadding - horizontalExpansion,
      y: top - outwardPadding - verticalExpansion,
      width: right - left + 2 * (outwardPadding + horizontalExpansion),
      height: bottom - top + 2 * (outwardPadding + verticalExpansion),
    }
  }, ORBIT_SAMPLE_ERROR_CSS_PIXELS)
}

/** Checks rendered map labels and marks against the measured canvas and visible obstruction rectangles. */
export async function expectPaintedInsideUsableMap(page: Page, map: Locator, painted: readonly Locator[]): Promise<void> {
  const mapBounds = await map.boundingBox()
  if (!mapBounds) throw new Error('The revealed star system map has no measurable bounds.')
  const obstructions: VisibleObstruction[] = []
  const obstructionElements = page.locator('[data-map-obstruction]')

  for (let index = 0; index < await obstructionElements.count(); index += 1) {
    const obstruction = obstructionElements.nth(index)
    const visible = await obstruction.evaluate((element) => {
      if (!element.isConnected || element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false
      if (element.getClientRects().length === 0) return false
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })
    if (!visible) continue
    const bounds = await obstruction.boundingBox()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue
    const elementDetails = await obstruction.evaluate((element) => {
      const attributes = Array.from(element.attributes, attribute => ({ name: attribute.name, value: attribute.value }))
      return {
        tagName: element.tagName.toLowerCase(),
        className: element.getAttribute('class'),
        aria: attributes.filter(attribute => attribute.name.startsWith('aria-')),
        dataMap: attributes.filter(attribute => attribute.name.startsWith('data-map-')),
      }
    })
    obstructions.push({
      rect: {
        left: bounds.x,
        top: bounds.y,
        right: bounds.x + bounds.width,
        bottom: bounds.y + bounds.height,
      },
      element: elementDetails,
    })
  }

  for (const element of painted) {
    const bounds = await measurePaintedBounds(element)
    if (!bounds) throw new Error('A visible branch label or Orbit has no measurable bounds.')
    const elementDetails = await element.evaluate(element => ({
      tagName: element.tagName.toLowerCase(),
      className: element.getAttribute('class'),
      ariaLabel: element.getAttribute('aria-label'),
    }))
    const measured = {
      left: bounds.x,
      top: bounds.y,
      right: bounds.x + bounds.width,
      bottom: bounds.y + bounds.height,
    }
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x - 1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width + 1)
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y - 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height + 1)

    for (const obstruction of obstructions) {
      const overlaps = measured.left < obstruction.rect.right
        && measured.right > obstruction.rect.left
        && measured.top < obstruction.rect.bottom
        && measured.bottom > obstruction.rect.top
      const failureDetails = `Painted element ${JSON.stringify({ ...elementDetails, bounds })} overlaps visible obstruction ${JSON.stringify({ ...obstruction.element, rect: obstruction.rect })}.`
      expect(overlaps, failureDetails).toBe(false)
    }
  }
}
