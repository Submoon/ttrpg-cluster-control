export type MapImageFormat = 'png' | 'svg'

export interface MapImageExporter {
  exportImage(format: MapImageFormat): Promise<Blob>
}

const svgNamespace = 'http://www.w3.org/2000/svg'
const viewBoxPadding = 24
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

function createExportSvg(source: SVGSVGElement): { blob: Blob; width: number; height: number } {
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

  const left = Math.floor(bounds.x - viewBoxPadding)
  const top = Math.floor(bounds.y - viewBoxPadding)
  const right = Math.ceil(bounds.x + bounds.width + viewBoxPadding)
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

  for (const surface of content.querySelectorAll<SVGRectElement>(
    '.cluster-map-background, .cluster-map-grid, .map-background, .map-grid',
  )) {
    surface.setAttribute('x', String(left))
    surface.setAttribute('y', String(top))
    surface.setAttribute('width', String(width))
    surface.setAttribute('height', String(height))
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

export async function exportMapImage(source: SVGSVGElement, format: MapImageFormat): Promise<Blob> {
  const { blob, width, height } = createExportSvg(source)
  return format === 'svg' ? blob : rasterizeSvg(blob, width, height)
}
