import { onBeforeUnmount, onMounted } from 'vue'
import type { MapInteractionMode } from './editor-workflows/types'

type MapToolMode = Extract<MapInteractionMode, 'navigate' | 'select' | 'move'>

interface MapToolShortcutOptions {
  workspaceEnabled(): boolean
  pageOverlayOpen(): boolean
  editingGestureActive(): boolean
  activeMapKey(): string | null
  mapMode(): MapInteractionMode
  addIntentActive(): boolean
  changeMapMode(mode: MapToolMode): Promise<void>
  openAddChooser(): void
  focusActiveMap(): void
}

const mapRootSelector = 'svg.cluster-map-svg, svg.system-map-svg'
const mapMarkSelector = '.cluster-system-node, .cluster-route, .system-object, .orbit-hit-target'

/** Owns map-scoped, single-letter tool shortcuts and their temporary browser input state. */
export function useMapToolShortcuts(options: MapToolShortcutOptions): { isMapInputActive(): boolean } {
  let compositionActive = false
  let listening = false
  const activePointers = new Set<number>()
  const activeTouches = new Set<number>()

  function keydown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase()
    const mode = mapModeForShortcut(key)
    if ((!mode && key !== 'a') || event.defaultPrevented || event.repeat
      || event.isComposing || event.keyCode === 229 || compositionActive
      || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      || event.getModifierState('AltGraph') || !options.workspaceEnabled()
      || options.editingGestureActive() || activePointers.size > 0 || activeTouches.size > 0
      || options.pageOverlayOpen() || hasOpenKeyboardPopup()) return
    if (!isMapShortcutTarget(event.target)) return

    event.preventDefault()
    if (key === 'a') {
      options.openAddChooser()
      return
    }
    if (mode) void changeModeAndPreserveMapFocus(mode)
  }

  async function changeModeAndPreserveMapFocus(mode: MapToolMode): Promise<void> {
    const contextKey = options.activeMapKey()
    const modeBefore = options.mapMode()
    const addWasActive = options.addIntentActive()
    await options.changeMapMode(mode)

    const modeWasAccepted = options.mapMode() === mode && !options.addIntentActive()
    if (!modeWasAccepted || (modeBefore === mode && !addWasActive)
      || document.activeElement !== document.body || !document.hasFocus()
      || options.activeMapKey() !== contextKey) return
    options.focusActiveMap()
  }

  function mapModeForShortcut(key: string): MapToolMode | null {
    switch (key) {
      case 'n': return 'navigate'
      case 's': return 'select'
      case 'm': return 'move'
      default: return null
    }
  }

  function isMapShortcutTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    const map = target.closest(mapRootSelector)
    if (!map) return false
    if (target === map) return true
    if (target.closest('.orbit-edit-control, [role="slider"], input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
      return false
    }
    const mark = target.closest(mapMarkSelector)
    return mark !== null && map.contains(mark)
  }

  function hasOpenKeyboardPopup(): boolean {
    const popups = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="alertdialog"], [role="dialog"], [role="listbox"], [role="menu"], '
        + '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], '
        + '[role="combobox"][aria-expanded="true"], .workspace-zoom-navigation',
    ))
    if (popups.some(isVisibleAndOpen)) return true

    return Array.from(document.querySelectorAll<HTMLElement>('[aria-haspopup][aria-expanded="true"]'))
      .some((trigger) => {
        if (!isVisibleAndOpen(trigger)) return false
        const controlledIds = trigger.getAttribute('aria-controls')?.split(/\s+/).filter(Boolean) ?? []
        if (!controlledIds.length) return true
        return controlledIds.some((id) => {
          const controlled = trigger.ownerDocument.getElementById(id)
          return controlled !== null && isVisibleAndOpen(controlled)
        })
      })
  }

  function pointerDown(event: PointerEvent): void {
    if (mapRootForTarget(event.target)) activePointers.add(event.pointerId)
  }

  function pointerEnd(event: PointerEvent): void { activePointers.delete(event.pointerId) }

  function touchStart(event: TouchEvent): void {
    if (!mapRootForTarget(event.target)) return
    for (const touch of Array.from(event.changedTouches)) activeTouches.add(touch.identifier)
  }

  function touchEnd(event: TouchEvent): void {
    for (const touch of Array.from(event.changedTouches)) activeTouches.delete(touch.identifier)
  }

  function clearActiveInput(): void {
    activePointers.clear()
    activeTouches.clear()
    compositionActive = false
  }

  function compositionStart(): void { compositionActive = true }
  function compositionEnd(): void { compositionActive = false }

  onMounted(() => {
    window.addEventListener('keydown', keydown)
    window.addEventListener('compositionstart', compositionStart)
    window.addEventListener('compositionend', compositionEnd)
    window.addEventListener('blur', clearActiveInput)
    window.addEventListener('pointerdown', pointerDown, true)
    window.addEventListener('pointerup', pointerEnd, true)
    window.addEventListener('pointercancel', pointerEnd, true)
    window.addEventListener('touchstart', touchStart, true)
    window.addEventListener('touchend', touchEnd, true)
    window.addEventListener('touchcancel', touchEnd, true)
    listening = true
  })

  onBeforeUnmount(() => {
    if (!listening) return
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('compositionstart', compositionStart)
    window.removeEventListener('compositionend', compositionEnd)
    window.removeEventListener('blur', clearActiveInput)
    window.removeEventListener('pointerdown', pointerDown, true)
    window.removeEventListener('pointerup', pointerEnd, true)
    window.removeEventListener('pointercancel', pointerEnd, true)
    window.removeEventListener('touchstart', touchStart, true)
    window.removeEventListener('touchend', touchEnd, true)
    window.removeEventListener('touchcancel', touchEnd, true)
    clearActiveInput()
    listening = false
  })

  return { isMapInputActive: () => activePointers.size > 0 || activeTouches.size > 0 }
}

function mapRootForTarget(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(mapRootSelector) : null
}

function isVisibleAndOpen(element: Element): boolean {
  if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  const state = element.getAttribute('data-state')
  if (state !== null && state !== 'open') return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
}
