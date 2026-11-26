import { computed, onMounted, onUnmounted, ref } from 'vue'
import { WARDEN_DETAIL_ZOOM_DEFAULT, WARDEN_DETAIL_ZOOM_MAX, WARDEN_DETAIL_ZOOM_MIN } from '../utils/continuous-map-projection'
import { MAP_ZOOM_MAX_SCALE, type MapViewport } from '../utils/map-zoom'

export interface WardenDisplayPreferences {
  detailZoom: number
  labels: 'standard' | 'compact'
  animation: 'system' | 'reduced' | 'off'
  startup: 'fit' | 'resume'
}

export type WardenMapMotion = 'full' | 'reduced' | 'off'

const defaults: WardenDisplayPreferences = { detailZoom: WARDEN_DETAIL_ZOOM_DEFAULT, labels: 'standard', animation: 'system', startup: 'fit' }
const settingsKey = 'ttrpg-cluster-control:warden-display'
const legacyZoomKey = 'ttrpg-cluster-control:map-detail-zoom'
const viewportKey = (mapKey: string) => `ttrpg-cluster-control:warden-viewport:${mapKey}`

function parsePreferences(value: Partial<WardenDisplayPreferences>): WardenDisplayPreferences {
  const { detailZoom, labels, animation, startup } = value
  return {
    detailZoom: typeof detailZoom === 'number' && Number.isInteger(detailZoom)
      && detailZoom >= WARDEN_DETAIL_ZOOM_MIN && detailZoom <= WARDEN_DETAIL_ZOOM_MAX ? detailZoom : defaults.detailZoom,
    labels: labels === 'compact' ? labels : defaults.labels,
    animation: animation === 'reduced' || animation === 'off' ? animation : defaults.animation,
    startup: startup === 'resume' ? startup : defaults.startup,
  }
}

/** Owns local display preferences independently of workspace data and history. */
export function useWardenDisplayPreferences() {
  const display = ref<WardenDisplayPreferences>({ ...defaults })
  const systemReducesMotion = ref(false)
  let media: MediaQueryList | undefined
  const motion = computed<WardenMapMotion>(() => display.value.animation === 'system'
    ? systemReducesMotion.value ? 'off' : 'full'
    : display.value.animation)

  function onMotionChange(event: MediaQueryListEvent): void {
    systemReducesMotion.value = event.matches
  }

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    systemReducesMotion.value = media.matches
    media.addEventListener('change', onMotionChange)
    try {
      const stored = window.localStorage.getItem(settingsKey)
      display.value = parsePreferences(stored
        ? JSON.parse(stored) ?? {}
        : { detailZoom: Number(window.localStorage.getItem(legacyZoomKey)) })
    } catch {
      // The browser may block storage or contain an invalid saved value.
    }
  })

  onUnmounted(() => media?.removeEventListener('change', onMotionChange))

  function updateDisplay(patch: Partial<WardenDisplayPreferences>): void {
    display.value = parsePreferences({ ...display.value, ...patch })
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify(display.value))
    } catch {
      // Keep the applied settings in this tab.
    }
  }

  function lastViewport(mapKey: string): MapViewport | null {
    if (typeof window === 'undefined') return null
    try {
      const viewport: MapViewport | null = JSON.parse(window.localStorage.getItem(viewportKey(mapKey)) ?? 'null')
      if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y)
        && Number.isFinite(viewport.k) && viewport.k > 0 && viewport.k <= MAP_ZOOM_MAX_SCALE) return viewport
    } catch {
      // Fall back to fitting the map.
    }
    return null
  }

  function rememberViewport(mapKey: string, viewport: MapViewport): void {
    try {
      window.localStorage.setItem(viewportKey(mapKey), JSON.stringify(viewport))
    } catch {
      // In-session navigation continues to use its own visit memory.
    }
  }

  return { display, motion, updateDisplay, lastViewport, rememberViewport }
}
