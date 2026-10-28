/**
 * Exports the full applied SVG scene with inlined styles before serialization or rasterization.
 */
export type MapImageFormat = 'png' | 'svg'
export type MapImagePalette = 'active' | 'print-light'

export interface MapImageExporter {
  exportImage(format: MapImageFormat, palette?: MapImagePalette): Promise<Blob>
}

export type PrepareMapExportClone = (clone: SVGSVGElement) => void

const svgNamespace = 'http://www.w3.org/2000/svg'
const viewBoxPadding = 24
const exportTitleBandHeight = 48
const exportTitleFontSize = 20
const fallbackSceneBounds = { x: 0, y: 0, width: 960, height: 560 }
const maximumPngEdge = 4096
const maximumPngPixels = 4_194_304
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

/** Removes visible interaction state and edit-only targets from the export copy. */
function cleanExportClone(clone: SVGSVGElement): void {
  clone.querySelectorAll(
    '.system-creation-preview, .orbit-edit-control, .object-hit-target, .orbit-hit-target, .cluster-exit-hit-target',
  ).forEach(node => node.remove())

  for (const className of [
    'is-selected',
    'is-dragging',
    'is-move-preview',
    'is-resizing',
    'is-moving',
    'is-rotating',
  ]) {
    clone.querySelectorAll(`.${className}`).forEach(node => node.classList.remove(className))
  }
}

function standalonePaintUrl(value: string): string {
  return value.replace(/url\((['"]?)(.*?)\1\)/g, (match, _quote: string, reference: string) => {
    const fragmentIndex = reference.lastIndexOf('#')
    return fragmentIndex < 0 ? match : `url(#${reference.slice(fragmentIndex + 1)})`
  })
}

function featureBounds(content: SVGGElement): DOMRect {
  const featureGroups = content.matches('.cluster-map-content')
    ? [content.querySelector<SVGGElement>('.cluster-map-items')]
    : [
        content.querySelector<SVGGElement>('.system-map-items'),
        content.querySelector<SVGGElement>('.system-orbits'),
      ]
  const boxes: DOMRect[] = []
  for (const group of featureGroups) {
    if (!group) continue
    const box = group.getBBox()
    if (box.x === 0 && box.y === 0 && box.width === 0 && box.height === 0) continue
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite)
      || box.width < 0 || box.height < 0
      || !Number.isFinite(box.x + box.width) || !Number.isFinite(box.y + box.height)) {
      throw new Error('The map scene has unsafe export bounds.')
    }
    boxes.push(box)
  }

  if (!boxes.length) {
    return new DOMRect(
      fallbackSceneBounds.x,
      fallbackSceneBounds.y,
      fallbackSceneBounds.width,
      fallbackSceneBounds.height,
    )
  }

  const left = Math.min(...boxes.map(box => box.x))
  const top = Math.min(...boxes.map(box => box.y))
  const right = Math.max(...boxes.map(box => box.x + box.width))
  const bottom = Math.max(...boxes.map(box => box.y + box.height))
  const width = right - left
  const height = bottom - top
  if (![left, top, right, bottom, width, height].every(Number.isFinite)
    || width < 0 || height < 0) {
    throw new Error('The map scene has unsafe export bounds.')
  }
  return new DOMRect(left, top, width, height)
}

/** Computes finite raster dimensions within the edge and total-pixel budget. */
function boundedPngDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The map scene has unsafe PNG dimensions.')
  }
  const areaScale = Math.exp((Math.log(maximumPngPixels) - Math.log(width) - Math.log(height)) / 2)
  const scale = Math.min(1, maximumPngEdge / width, maximumPngEdge / height, areaScale)
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('The map scene has unsafe PNG dimensions.')

  let rasterWidth = Math.max(1, Math.floor(width * scale))
  let rasterHeight = Math.max(1, Math.floor(height * scale))
  while (rasterWidth * rasterHeight > maximumPngPixels) {
    if (rasterWidth >= rasterHeight) rasterWidth -= 1
    else rasterHeight -= 1
  }
  return { width: rasterWidth, height: rasterHeight }
}

function createExportHost(palette: MapImagePalette): HTMLDivElement {
  const host = document.createElement('div')
  host.className = 'map-export-host'
  if (palette === 'print-light') host.dataset.mapExportPalette = 'print-light'
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: '960px',
    height: '560px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  })
  return host
}

/**
 * Clones and serializes the applied scene with palette-resolved styles and export-only bounds.
 * The renderer callback projects its authoritative applied geometry onto this clone before cleanup.
 * @param source Mounted map SVG containing a recognized map-content group.
 * @param title Optional system name to include; omitted for Cluster exports.
 * @param palette Active light/dark colors or an export-only light palette.
 * @param prepareClone Projects renderer-owned applied geometry onto the immediate SVG clone.
 * @returns SVG blob and pixel dimensions used by PNG rasterization.
 * @throws If scene bounds, clone styling, title measurement, or exportable content are unavailable.
 */
function createExportSvg(
  source: SVGSVGElement,
  title: string | undefined,
  palette: MapImagePalette,
  prepareClone?: PrepareMapExportClone,
): { blob: Blob; width: number; height: number } {
  const copy = source.cloneNode(true) as SVGSVGElement
  const host = createExportHost(palette)
  document.body.append(host)
  host.append(copy)

  try {
    prepareClone?.(copy)
    cleanExportClone(copy)

    const content = copy.querySelector<SVGGElement>('.cluster-map-content, .system-map-content')
    if (!content) throw new Error('The map scene is not ready to export.')
    const bounds = featureBounds(content)
    if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
      throw new Error('The map scene has no exportable content.')
    }

    const exportTitle = title?.trim()
    const titleBandHeight = exportTitle ? exportTitleBandHeight : 0
    const titleStyleSource = exportTitle
      ? copy.querySelector<SVGTextElement>('.object-name, .map-empty')
      : null
    const titleStyle = titleStyleSource ? getComputedStyle(titleStyleSource) : null
    const titleFill = titleStyle?.fill ?? getComputedStyle(copy).color
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
    if (![left, top, right, bottom, width, height].every(Number.isFinite)
      || width <= 0 || height <= 0) {
      throw new Error('The map scene has unsafe export bounds.')
    }

    content.removeAttribute('transform')
    const copyElements: SVGElement[] = [copy, ...Array.from(copy.querySelectorAll<SVGElement>('*'))]
    const styleSnapshots = copyElements.map(element => {
      const computedStyle = getComputedStyle(element)
      return styleProperties.map(property => {
        const value = computedStyle.getPropertyValue(property)
        return value ? [property, standalonePaintUrl(value)] as const : null
      }).filter((entry): entry is readonly [typeof styleProperties[number], string] => entry !== null)
    })
    for (const [index, element] of copyElements.entries()) {
      const snapshot = styleSnapshots[index]
      if (!snapshot) throw new Error('The map scene could not be styled for export.')
      for (const [property, value] of snapshot) element.style.setProperty(property, value)
    }

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

    copy.querySelector<SVGPatternElement>('#cluster-map-grid')?.removeAttribute('patternTransform')
    for (const surface of copy.querySelectorAll<SVGRectElement>(
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
  } finally {
    host.remove()
  }
}

/**
 * Caps the source SVG's intrinsic raster dimensions before decoding, then encodes a bounded PNG canvas.
 * @param svg Serialized SVG scene.
 * @param width Raster output width in pixels.
 * @param height Raster output height in pixels.
 * @returns Encoded PNG blob.
 * @throws If image decoding, Canvas creation, drawing, or PNG encoding fails.
 */
async function rasterizeSvg(svg: Blob, width: number, height: number): Promise<Blob> {
  const rasterDimensions = boundedPngDimensions(width, height)
  const source = new DOMParser().parseFromString(await svg.text(), 'image/svg+xml').documentElement
  if (source.localName !== 'svg' || source.querySelector('parsererror')) {
    throw new Error('Could not prepare the map scene for PNG export.')
  }
  source.setAttribute('width', String(rasterDimensions.width))
  source.setAttribute('height', String(rasterDimensions.height))
  const boundedSvg = new Blob([new XMLSerializer().serializeToString(source)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(boundedSvg)
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = rasterDimensions.width
    canvas.height = rasterDimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create a Canvas context for PNG export.')
    context.drawImage(image, 0, 0, rasterDimensions.width, rasterDimensions.height)

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
 * @param format Requested image encoding.
 * @param title Optional system title band; Cluster callers omit it.
 * @param palette Active light/dark colors or an export-only light palette.
 * @param prepareClone Projects renderer-owned applied geometry onto the immediate SVG clone.
 * @returns Downloadable image blob.
 * @throws If scene serialization or requested rasterization fails.
 */
export async function exportMapImage(
  source: SVGSVGElement,
  format: MapImageFormat,
  title?: string,
  palette: MapImagePalette = 'active',
  prepareClone?: PrepareMapExportClone,
): Promise<Blob> {
  const { blob, width, height } = createExportSvg(source, title, palette, prepareClone)
  return format === 'svg' ? blob : rasterizeSvg(blob, width, height)
}
