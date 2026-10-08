/**
 * Exports the full SVG scene rather than its viewport, inlining styles before serialization or rasterization.
 */
export type MapImageFormat = 'png' | 'svg'

export interface MapImageExporter {
  exportImage(format: MapImageFormat): Promise<Blob>
}

const svgNamespace = 'http://www.w3.org/2000/svg'
const viewBoxPadding = 24
const exportTitleBandHeight = 48
const exportTitleFontSize = 20
const styleProperties = [
  'alignment-baseline',
  'color',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'opacity',
  'paint-order',
  'pointer-events',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'visibility',
] as const

/**
 * Clones and serializes the complete scene with computed styles and export-only bounds.
 * The clone drops the viewport transform and edit handles; an optional system title gets a band above the scene.
 * @param source Mounted map SVG containing a recognized map-content group.
 * @param title Optional system name to include; omitted for Cluster exports.
 * @returns SVG blob and pixel dimensions used by PNG rasterization.
 * @throws If scene bounds, clone styling, title measurement, or exportable content are unavailable.
 */
function createExportSvg(source: SVGSVGElement, title?: string): { blob: Blob; width: number; height: number } {
  const sourceContent = source.querySelector<SVGGElement>('.cluster-map-content, .system-map-content')
  if (!sourceContent) throw new Error('The map scene is not ready to export.')

  const bounds = sourceContent.getBBox()
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    || bounds.width <= 0
    || bounds.height <= 0
  ) {
    throw new Error('The map scene has no exportable content.')
  }

  const exportTitle = title?.trim()
  const titleBandHeight = exportTitle ? exportTitleBandHeight : 0
  const titleStyleSource = exportTitle
    ? source.querySelector<SVGTextElement>('.object-name, .map-empty')
    : null
  const titleStyle = titleStyleSource ? getComputedStyle(titleStyleSource) : null
  const titleFill = titleStyle?.fill ?? getComputedStyle(source).color
  const titleFontFamily = titleStyle?.fontFamily || 'Georgia, serif'
  let titleWidth = 0
  if (exportTitle) {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('Could not create a Canvas context to measure the system title.')
    context.font = `600 ${exportTitleFontSize}px ${titleFontFamily}`
    titleWidth = context.measureText(exportTitle).width
  }

  const left = Math.floor(bounds.x - viewBoxPadding)
  const top = Math.floor(bounds.y - viewBoxPadding - titleBandHeight)
  const right = Math.ceil(Math.max(
    bounds.x + bounds.width + viewBoxPadding,
    exportTitle ? left + viewBoxPadding + titleWidth + viewBoxPadding : 0,
  ))
  const bottom = Math.ceil(bounds.y + bounds.height + viewBoxPadding)
  const width = right - left
  const height = bottom - top
  const copy = source.cloneNode(true) as SVGSVGElement
  const content = copy.querySelector<SVGGElement>('.cluster-map-content, .system-map-content')
  if (!content) throw new Error('The map scene could not be copied for export.')
  content.removeAttribute('transform')

  const sourceElements: SVGElement[] = [source, ...Array.from(source.querySelectorAll<SVGElement>('*'))]
  const copyElements: SVGElement[] = [copy, ...Array.from(copy.querySelectorAll<SVGElement>('*'))]
  for (const [index, element] of copyElements.entries()) {
    const original = sourceElements[index]
    if (!original) throw new Error('The map scene could not be styled for export.')

    const computedStyle = getComputedStyle(original)
    for (const property of styleProperties) {
      const value = computedStyle.getPropertyValue(property)
      if (value) element.style.setProperty(property, value)
    }
  }
  content.querySelectorAll('.orbit-edit-control').forEach(control => control.remove())

  if (exportTitle) {
    const titleElement = copy.ownerDocument.createElementNS(svgNamespace, 'text')
    titleElement.setAttribute('class', 'system-map-export-title')
    titleElement.setAttribute('x', String(left + viewBoxPadding))
    titleElement.setAttribute('y', String(top + viewBoxPadding + exportTitleFontSize))
    titleElement.textContent = exportTitle
    titleElement.style.setProperty('fill', titleFill)
    titleElement.style.setProperty('font-family', titleFontFamily)
    titleElement.style.setProperty('font-size', `${exportTitleFontSize}px`)
    titleElement.style.setProperty('font-weight', '600')
    titleElement.style.setProperty('pointer-events', 'none')
    copy.append(titleElement)
  }

  for (const surface of content.querySelectorAll<SVGRectElement>(
    '.cluster-map-background, .cluster-map-grid, .map-background, .map-grid',
  )) {
    surface.setAttribute('x', String(left))
    const surfaceTop = exportTitle && surface.classList.contains('map-grid')
      ? top + titleBandHeight
      : top
    surface.setAttribute('y', String(surfaceTop))
    surface.setAttribute('width', String(width))
    surface.setAttribute('height', String(bottom - surfaceTop))
  }

  copy.setAttribute('xmlns', svgNamespace)
  copy.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  const serialized = new XMLSerializer().serializeToString(copy)
  return {
    blob: new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }),
    width,
    height,
  }
}

/**
 * Decodes an SVG blob and encodes its full dimensions as a PNG canvas.
 * @param svg Serialized SVG scene.
 * @param width Raster output width in pixels.
 * @param height Raster output height in pixels.
 * @returns Encoded PNG blob.
 * @throws If image decoding, Canvas creation, drawing, or PNG encoding fails.
 */
async function rasterizeSvg(svg: Blob, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(svg)
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create a Canvas context for PNG export.')
    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode the map as PNG.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Exports a mounted full map scene as SVG or as a rasterized PNG.
 * @param source Mounted SVG renderer element.
 * @param format Requested image format.
 * @param title Optional system title band; Cluster callers omit it.
 * @returns Downloadable image blob.
 * @throws If scene serialization or requested rasterization fails.
 */
export async function exportMapImage(
  source: SVGSVGElement,
  format: MapImageFormat,
  title?: string,
): Promise<Blob> {
  const { blob, width, height } = createExportSvg(source, title)
  return format === 'svg' ? blob : rasterizeSvg(blob, width, height)
}
