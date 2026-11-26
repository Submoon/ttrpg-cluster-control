import type { MapImagePalette } from './map-image-export'
import { CLUSTER_ROUTE_PAINT_VARIABLES } from './cluster-route-presentation'

export interface PlayerMapPaint {
  mapBackground: string
  mapCard: string
  mapLabelBorder: string
  mapInstallation: string
  mapOrbit: string
  mapSelected: string
  panelBackground: string
  line: string
  lineSoft: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  mapRoute: string
  mapUnresolved: string
  mapLabelBackground: string
  mapText: string
}

const lightPrintPaint: PlayerMapPaint = {
  mapBackground: '#f5f4ee',
  mapCard: '#fffefa',
  mapLabelBorder: '#718077',
  mapInstallation: '#2e674b',
  mapOrbit: '#596a60',
  mapSelected: '#8f4a18',
  panelBackground: '#fffefa',
  line: '#796e5d',
  lineSoft: '#ded8ca',
  textPrimary: '#26302c',
  textSecondary: '#45504a',
  textMuted: '#59645d',
  accent: '#9c4a16',
  mapRoute: '#315e48',
  mapUnresolved: '#9a3d11',
  mapLabelBackground: '#fffefa',
  mapText: '#26302c',
}

const darkFallbackPaint: PlayerMapPaint = {
  mapBackground: '#0c1719',
  mapCard: '#142225',
  mapLabelBorder: '#607477',
  mapInstallation: '#81b19a',
  mapOrbit: '#7f9294',
  mapSelected: '#ffc087',
  panelBackground: '#121c1e',
  line: '#65787a',
  lineSoft: '#293a3d',
  textPrimary: '#e8eee7',
  textSecondary: '#c0cbc4',
  textMuted: '#9caaa2',
  accent: '#efa16f',
  mapRoute: '#86ad96',
  mapUnresolved: '#f09b73',
  mapLabelBackground: '#182629',
  mapText: '#e8eee7',
}

export function playerMapPaint(palette: MapImagePalette): PlayerMapPaint {
  if (palette === 'print-light') return lightPrintPaint
  if (typeof document === 'undefined') return lightPrintPaint

  const root = document.documentElement
  const computed = getComputedStyle(root)
  const fallback = root.classList.contains('dark') ? darkFallbackPaint : lightPrintPaint
  const read = (name: string, fallbackValue: string): string =>
    computed.getPropertyValue(name).trim() || fallbackValue

  return {
    mapBackground: read('--map-bg', fallback.mapBackground),
    mapCard: read(CLUSTER_ROUTE_PAINT_VARIABLES.endpointFill, fallback.mapCard),
    mapLabelBorder: read(CLUSTER_ROUTE_PAINT_VARIABLES.labelBorder, fallback.mapLabelBorder),
    mapInstallation: read('--map-installation', fallback.mapInstallation),
    mapOrbit: read('--map-orbit', fallback.mapOrbit),
    mapSelected: read('--map-selected', fallback.mapSelected),
    panelBackground: read('--panel-bg', fallback.panelBackground),
    line: read('--line', fallback.line),
    lineSoft: read('--line-soft', fallback.lineSoft),
    textPrimary: read('--text-primary', fallback.textPrimary),
    textSecondary: read('--text-secondary', fallback.textSecondary),
    textMuted: read('--text-muted', fallback.textMuted),
    accent: read('--accent', fallback.accent),
    mapRoute: read(CLUSTER_ROUTE_PAINT_VARIABLES.route, fallback.mapRoute),
    mapUnresolved: read(CLUSTER_ROUTE_PAINT_VARIABLES.unresolved, fallback.mapUnresolved),
    mapLabelBackground: read(CLUSTER_ROUTE_PAINT_VARIABLES.labelBackground, fallback.mapLabelBackground),
    mapText: read(CLUSTER_ROUTE_PAINT_VARIABLES.text, fallback.mapText),
  }
}
