/** Owns the mounted mouse, pen, and touch lifecycle for Add Orbit placement. */
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { createOrbitTouchGesture, type OrbitTouchAction, type OrbitTouchContact } from './orbit-touch-gesture'
import type { Point } from '../../domain/workspace'

export interface OrbitPlacementMap {
  clientPointToScene(clientX: number, clientY: number): Point | null
  getOrbitDragSceneClearance(): number | null
  isOrbitDragPointOnMap(clientX: number, clientY: number): boolean
  startOrbitTouchPinch(points: readonly { clientX: number; clientY: number }[]): void
  moveOrbitTouchPinch(points: readonly { clientX: number; clientY: number }[]): void
  endOrbitTouchPinch(): void
}

export interface OrbitPlacementInputOptions {
  root(): HTMLElement | null
  map(): OrbitPlacementMap | null
  isSystemView(): boolean
  mapKey(): string
  hasAddOrbitIntent(): boolean
  begin(scenePoint: Point): boolean
  update(scenePoint: Point, sceneClearance: number): void
  complete(): Promise<boolean>
  cancel(): void
  clearPointerLongPress(): void
  clearLongPress(): void
  holdClickSuppression(): void
  releaseCanvasPointer(pointerId: number): void
  canContinueCancelledPointerPan(pointerId: number): boolean
  editingGestureChange(active: boolean): void
}

type OrbitDragPointer = {
  pointerId: number
  pointerType: 'mouse' | 'pen'
  startX: number
  startY: number
  mapKey: string
  phase: 'pending' | 'dragging' | 'cancelled'
}

type OrbitDragClickGuard = {
  pointerId: number
  pointerType: string
  releaseX?: number
  releaseY?: number
  timer: ReturnType<typeof setTimeout>
}

type ClientPoint = { clientX: number; clientY: number }
type LastOrbitSample = ClientPoint & { allowOutsideMap: boolean; clearance: number }

/** Composes local Orbit input ownership with the renderer's existing editing gesture signal. */
export function useOrbitPlacementInput(options: OrbitPlacementInputOptions) {
  let orbitPointer: OrbitDragPointer | null = null
  let orbitTouch: ReturnType<typeof createOrbitTouchGesture> | null = null
  let orbitTouchMapKey: string | null = null
  let clickGuard: OrbitDragClickGuard | null = null
  let lastSample: LastOrbitSample | null = null
  let childGestureActive = false
  let publishedGestureActive = false
  let publicationSequence = 0
  const pendingPublications = new Set<number>()
  let resizeObserver: ResizeObserver | null = null

  function hasLocalGesture(): boolean {
    return (!!orbitPointer && orbitPointer.phase !== 'cancelled')
      || (!!orbitTouch && orbitTouch.phase !== 'cancelled')
  }

  /** Includes canceled gestures whose physical transport still needs its terminal release. */
  function hasPhysicalTransportOwnership(): boolean {
    return orbitPointer !== null
      || (!!orbitTouch && orbitTouch.contacts.length > 0)
      || (clickGuard !== null && clickGuard.releaseX === undefined)
  }

  function syncEditingGesture(): void {
    const active = childGestureActive || hasLocalGesture() || pendingPublications.size > 0
    if (active === publishedGestureActive) return
    publishedGestureActive = active
    options.editingGestureChange(active)
  }

  function setChildGestureActive(active: boolean): void {
    childGestureActive = active
    syncEditingGesture()
  }

  function clearClickGuard(): void {
    if (clickGuard) clearTimeout(clickGuard.timer)
    clickGuard = null
  }

  function holdClickGuard(
    gesture: Pick<OrbitDragClickGuard, 'pointerId' | 'pointerType'>,
    release?: Pick<PointerEvent, 'clientX' | 'clientY'>,
  ): void {
    clearClickGuard()
    const guard: OrbitDragClickGuard = {
      pointerId: gesture.pointerId,
      pointerType: gesture.pointerType,
      ...(release ? { releaseX: release.clientX, releaseY: release.clientY } : {}),
      timer: setTimeout(() => {
        if (clickGuard === guard) clickGuard = null
      }, 1200),
    }
    clickGuard = guard
  }

  function cancelPointerGesture(): void {
    if (!orbitPointer || orbitPointer.phase === 'cancelled') return
    orbitPointer.phase = 'cancelled'
    options.cancel()
    lastSample = null
    syncEditingGesture()
  }

  function cancelTouchGesture(): void {
    if (!orbitTouch || orbitTouch.phase === 'cancelled') return
    orbitTouch.cancel()
    options.cancel()
    lastSample = null
    options.map()?.endOrbitTouchPinch()
    options.holdClickSuppression()
    syncEditingGesture()
  }

  function clearTouchGesture(): void {
    orbitTouch = null
    orbitTouchMapKey = null
    lastSample = null
    syncEditingGesture()
  }

  function touchIsStale(): boolean {
    return !!orbitTouch && orbitTouch.phase !== 'cancelled'
      && (orbitTouchMapKey !== options.mapKey() || !options.hasAddOrbitIntent())
  }

  function touchContact(event: PointerEvent): OrbitTouchContact {
    return { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function touchPoints(): ClientPoint[] {
    return orbitTouch?.contacts.map(contact => ({ clientX: contact.x, clientY: contact.y })) ?? []
  }

  function captureTouchPointers(): void {
    const root = options.root()
    if (!root || !orbitTouch) return
    for (const contact of orbitTouch.contacts) {
      try {
        root.setPointerCapture(contact.id)
      } catch {
        // Window-level pointer listeners still own contacts when capture is unavailable.
      }
    }
  }

  function updatePreviewAt(contact: ClientPoint, allowOutsideMap = false): boolean {
    if (!options.hasAddOrbitIntent() || !options.isSystemView()) return false
    const map = options.map()
    if (!map || (!allowOutsideMap && !map.isOrbitDragPointOnMap(contact.clientX, contact.clientY))) return false
    const scenePoint = map.clientPointToScene(contact.clientX, contact.clientY)
    const clearance = map.getOrbitDragSceneClearance()
    if (!scenePoint || clearance === null) return false
    options.update(scenePoint, clearance)
    lastSample = {
      clientX: contact.clientX,
      clientY: contact.clientY,
      allowOutsideMap,
      clearance,
    }
    return true
  }

  /** Reprojects the last accepted screen sample after a live camera or map-size change. */
  function refreshForViewportChange(): void {
    const touchPhase = orbitTouch?.phase
    if (touchPhase === 'pinching' || touchPhase === 'awaiting-movement') return
    if (orbitPointer?.phase !== 'dragging' && touchPhase !== 'dragging') return
    if (!lastSample) return
    updatePreviewAt(lastSample, lastSample.allowOutsideMap)
  }

  function hasUsableReleasePreview(): boolean {
    if (!lastSample) return false
    const map = options.map()
    const currentClearance = map?.getOrbitDragSceneClearance()
    if (currentClearance === null || currentClearance === undefined) return false
    if (Math.abs(currentClearance - lastSample.clearance) <= 1e-7) return true
    // The release coordinate is deliberately ignored. A viewport refresh must have displayed
    // the current spacing before release; otherwise the stale preview is discarded.
    return false
  }

  function completeWithIdentity(): void {
    const identity = ++publicationSequence
    pendingPublications.add(identity)
    syncEditingGesture()
    void options.complete()
      .catch(() => options.cancel())
      .finally(() => {
        if (!pendingPublications.delete(identity)) return
        syncEditingGesture()
      })
  }

  function handleTouchAction(action: OrbitTouchAction, event: PointerEvent): boolean {
    const gesture = orbitTouch
    if (!gesture) return false
    if (action === 'tap') {
      options.cancel()
      clearTouchGesture()
      return false
    }

    if (action === 'start-drag' || action === 'update-drag') {
      if (action === 'start-drag') {
        captureTouchPointers()
        options.map()?.endOrbitTouchPinch()
      }
      const contact = gesture.contacts.find(candidate => candidate.id === event.pointerId)
      if (contact) updatePreviewAt({ clientX: contact.x, clientY: contact.y })
    } else if (action === 'update-pinch') {
      if (event.type === 'pointerup') options.map()?.startOrbitTouchPinch(touchPoints())
      else options.map()?.moveOrbitTouchPinch(touchPoints())
    } else if (action === 'resume') {
      holdClickGuard({ pointerId: event.pointerId, pointerType: 'touch' }, event)
      options.map()?.endOrbitTouchPinch()
      const [remaining] = gesture.contacts
      if (remaining) updatePreviewAt({ clientX: remaining.x, clientY: remaining.y }, true)
    } else if (action === 'commit') {
      const shouldComplete = gesture.contacts.length === 0
        && orbitTouchMapKey === options.mapKey()
        && options.hasAddOrbitIntent()
        && hasUsableReleasePreview()
      if (!shouldComplete) options.cancel()
      else completeWithIdentity()
      holdClickGuard({ pointerId: event.pointerId, pointerType: 'touch' }, event)
      options.map()?.endOrbitTouchPinch()
      orbitTouch = null
      orbitTouchMapKey = null
      lastSample = null
    } else if (action === 'cancel') {
      options.cancel()
      holdClickGuard({ pointerId: event.pointerId, pointerType: 'touch' }, event)
      options.map()?.endOrbitTouchPinch()
      if (gesture.contacts.length === 0) clearTouchGesture()
      else syncEditingGesture()
    }

    event.preventDefault()
    event.stopImmediatePropagation()
    syncEditingGesture()
    return true
  }

  function onTouchPointerDown(event: PointerEvent): boolean {
    const gesture = orbitTouch
    if (gesture) {
      if (gesture.phase === 'cancelled' && event.isPrimary) {
        clearTouchGesture()
        options.map()?.endOrbitTouchPinch()
        return onTouchPointerDown(event)
      }
      const action = gesture.addContact(touchContact(event))
      if (action === 'cancel-pending') {
        options.cancel()
        clearTouchGesture()
        return false
      }
      if (action === 'start-pinch') {
        captureTouchPointers()
        options.map()?.startOrbitTouchPinch(touchPoints())
        options.holdClickSuppression()
      }
      event.stopImmediatePropagation()
      syncEditingGesture()
      return true
    }

    if (!event.isPrimary || event.button !== 0 || !options.hasAddOrbitIntent()
      || !options.isSystemView()
      || !options.map()?.isOrbitDragPointOnMap(event.clientX, event.clientY)) return false
    const scenePoint = options.map()?.clientPointToScene(event.clientX, event.clientY)
    if (!scenePoint || !options.begin(scenePoint)) return false

    orbitTouch = createOrbitTouchGesture(touchContact(event))
    orbitTouchMapKey = options.mapKey()
    lastSample = null
    options.clearPointerLongPress()
    options.clearLongPress()
    event.stopImmediatePropagation()
    syncEditingGesture()
    return true
  }

  function onPointerDown(event: PointerEvent): boolean {
    if (event.pointerType === 'touch') return onTouchPointerDown(event)
    if (event.button !== 0 && event.button !== 2) return false

    if (orbitPointer && orbitPointer.pointerId !== event.pointerId) {
      if (orbitPointer.phase === 'cancelled') releaseCancelledPointer(orbitPointer)
      else {
        cancelPointerGesture()
        event.stopImmediatePropagation()
        return true
      }
    }

    if (event.isPrimary && event.button === 0
      && (event.pointerType === 'mouse' || event.pointerType === 'pen')
      && options.hasAddOrbitIntent() && options.isSystemView()
      && options.map()?.isOrbitDragPointOnMap(event.clientX, event.clientY)) {
      const scenePoint = options.map()?.clientPointToScene(event.clientX, event.clientY)
      if (scenePoint && options.begin(scenePoint)) {
        orbitPointer = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          startX: event.clientX,
          startY: event.clientY,
          mapKey: options.mapKey(),
          phase: 'pending',
        }
        lastSample = null
        options.clearPointerLongPress()
        options.clearLongPress()
        event.stopImmediatePropagation()
        syncEditingGesture()
        return true
      }
    }
    if (event.button === 2) cancelPointerGesture()
    return false
  }

  function onPointerMove(event: PointerEvent): boolean {
    if (event.pointerType === 'touch' && orbitTouch?.contacts.some(contact => contact.id === event.pointerId)) {
      if (touchIsStale()) cancelTouchGesture()
      return handleTouchAction(orbitTouch!.moveContact(touchContact(event)), event)
    }

    const gesture = orbitPointer
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.pointerType !== event.pointerType) return false
    if (gesture.mapKey !== options.mapKey() || !options.hasAddOrbitIntent()) cancelPointerGesture()
    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
    if (gesture.phase === 'pending' && distance >= 4) {
      gesture.phase = 'dragging'
      options.clearPointerLongPress()
      options.clearLongPress()
      try {
        options.root()?.setPointerCapture(event.pointerId)
      } catch {
        // Document-level pointer listeners still own release if capture is unavailable.
      }
      syncEditingGesture()
    }
    if (gesture.phase === 'cancelled') {
      if (options.canContinueCancelledPointerPan(event.pointerId)) return false
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }
    if (gesture.phase === 'dragging') {
      event.preventDefault()
      event.stopImmediatePropagation()
      updatePreviewAt(event)
      return true
    }
    return false
  }

  function releaseCancelledPointer(gesture: OrbitDragPointer): void {
    holdClickGuard(gesture)
    orbitPointer = null
    lastSample = null
    options.releaseCanvasPointer(gesture.pointerId)
    syncEditingGesture()
  }

  function onPointerUp(event: PointerEvent): boolean {
    if (event.pointerType === 'touch' && orbitTouch?.contacts.some(contact => contact.id === event.pointerId)) {
      const gesture = orbitTouch
      const wasCancelled = gesture.phase === 'cancelled' || event.type === 'pointercancel'
      if (event.type === 'pointercancel') {
        cancelTouchGesture()
        const action = gesture.removeContact(event.pointerId)
        if (action === 'ignore') holdClickGuard({ pointerId: event.pointerId, pointerType: 'touch' }, event)
        handleTouchAction(action, event)
        return true
      }
      const action = gesture.removeContact(event.pointerId)
      if (wasCancelled && action === 'ignore') holdClickGuard({ pointerId: event.pointerId, pointerType: 'touch' }, event)
      return handleTouchAction(action, event)
    }

    const gesture = orbitPointer
    if (event.type === 'pointercancel') {
      if (gesture?.pointerId !== event.pointerId) {
        if (clickGuard?.pointerId !== event.pointerId) return false
        holdClickGuard(clickGuard, event)
        options.releaseCanvasPointer(event.pointerId)
        event.preventDefault()
        event.stopImmediatePropagation()
        return true
      }
      cancelPointerGesture()
      holdClickGuard(gesture, event)
      orbitPointer = null
      lastSample = null
      options.releaseCanvasPointer(event.pointerId)
      event.preventDefault()
      event.stopImmediatePropagation()
      syncEditingGesture()
      return true
    }

    const lostCaptureGuard = clickGuard
    if (gesture?.pointerId !== event.pointerId
      && lostCaptureGuard?.pointerId === event.pointerId
      && lostCaptureGuard.pointerType === event.pointerType
      && event.buttons === 0) {
      // Lost capture canceled the preview but retained ownership of this physical release.
      // Its coordinates then protect only the matching compatibility mouseup and click.
      holdClickGuard(lostCaptureGuard, event)
      options.releaseCanvasPointer(event.pointerId)
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }

    if (gesture?.pointerId !== event.pointerId || gesture.pointerType !== event.pointerType) return false
    if (event.buttons !== 0) return false
    if (gesture.phase === 'pending') {
      options.cancel()
      orbitPointer = null
      lastSample = null
      syncEditingGesture()
      return false
    }

    const shouldComplete = gesture.phase === 'dragging'
      && gesture.mapKey === options.mapKey()
      && options.hasAddOrbitIntent()
      && hasUsableReleasePreview()
    if (!shouldComplete) cancelPointerGesture()
    else completeWithIdentity()
    holdClickGuard(gesture, event)
    orbitPointer = null
    lastSample = null
    options.releaseCanvasPointer(event.pointerId)
    event.preventDefault()
    event.stopImmediatePropagation()
    syncEditingGesture()
    return true
  }

  function onGlobalPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch' && orbitTouch
      && (!options.root() || !event.composedPath().includes(options.root()!))) {
      const priorGesture = orbitTouch
      const priorPhase = priorGesture.phase
      const priorContacts = priorGesture.contacts
      const handled = onTouchPointerDown(event)
      if (!handled && priorPhase === 'pending' && !orbitTouch) {
        options.map()?.startOrbitTouchPinch([
          ...priorContacts.map(contact => ({ clientX: contact.x, clientY: contact.y })),
          { clientX: event.clientX, clientY: event.clientY },
        ])
      }
    }
    if (orbitPointer?.phase === 'cancelled' && orbitPointer.pointerId === event.pointerId
      && event.isPrimary && event.button === 0) releaseCancelledPointer(orbitPointer)
    const guard = clickGuard
    if (guard?.releaseX !== undefined || guard?.pointerId === event.pointerId) clearClickGuard()
  }

  function onLostPointerCapture(event: PointerEvent): void {
    if (event.pointerType === 'touch' && event.target === options.root()
      && orbitTouch?.contacts.some(contact => contact.id === event.pointerId)) {
      cancelTouchGesture()
      return
    }
    const gesture = orbitPointer
    if (!gesture || gesture.pointerId !== event.pointerId || event.target !== options.root()) return
    if (gesture.phase !== 'cancelled') cancelPointerGesture()
    releaseCancelledPointer(gesture)
  }

  function onWheelCapture(event: WheelEvent): boolean {
    const mouseOrPenDragging = orbitPointer?.phase === 'dragging'
    const touchActive = orbitTouch?.phase === 'dragging'
      || orbitTouch?.phase === 'pinching'
      || orbitTouch?.phase === 'awaiting-movement'
    if ((!mouseOrPenDragging && !touchActive) || !options.isSystemView()
      || !options.map()?.isOrbitDragPointOnMap(event.clientX, event.clientY)) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }

  function onEscape(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || !hasPhysicalTransportOwnership()) return false
    cancelPointerGesture()
    cancelTouchGesture()
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return true
  }

  function onClickCapture(event: MouseEvent): boolean {
    const guard = clickGuard
    if (!guard || event.detail === 0) return false
    const pointerEvent = event as PointerEvent
    const hasPointerIdentity = 'pointerId' in event
    const identityMatches = hasPointerIdentity
      && pointerEvent.pointerId === guard.pointerId
      && (!pointerEvent.pointerType || pointerEvent.pointerType === guard.pointerType)
    const pointMatches = guard.releaseX !== undefined && guard.releaseY !== undefined
      && Math.hypot(event.clientX - guard.releaseX, event.clientY - guard.releaseY) <= 2
    const legacyTargetMatches = !hasPointerIdentity && pointMatches
      && (guard.pointerType === 'touch'
        || (!!options.root() && event.composedPath().includes(options.root()!)))
    if (!identityMatches && !legacyTargetMatches) return false
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    clearClickGuard()
    return true
  }

  function onMouseUpCapture(event: MouseEvent): boolean {
    const guard = clickGuard
    if (!guard || event.detail === 0 || guard.releaseX === undefined || guard.releaseY === undefined
      || Math.hypot(event.clientX - guard.releaseX, event.clientY - guard.releaseY) > 2) return false
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return true
  }

  function onTouchStartCapture(event: TouchEvent): boolean {
    if (orbitTouch?.phase === 'pending' && event.touches.length === 1) return false
    if (!orbitTouch) return false
    event.stopImmediatePropagation()
    return true
  }

  function onTouchMoveCapture(event: TouchEvent): boolean {
    if (!orbitTouch) return false
    if (orbitTouch.phase !== 'pending') event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }

  function onTouchEndCapture(event: TouchEvent): boolean {
    if (!orbitTouch) return false
    if (event.type === 'touchcancel') cancelTouchGesture()
    event.stopImmediatePropagation()
    return true
  }

  function cancel(): void {
    cancelPointerGesture()
    cancelTouchGesture()
    syncEditingGesture()
  }

  function dispose(): void {
    cancel()
    orbitPointer = null
    orbitTouch = null
    orbitTouchMapKey = null
    childGestureActive = false
    lastSample = null
    pendingPublications.clear()
    clearClickGuard()
    resizeObserver?.disconnect()
    resizeObserver = null
    syncEditingGesture()
  }

  function observeCurrentMap(): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (!options.isSystemView() || typeof ResizeObserver === 'undefined') return
    const svg = options.root()?.querySelector<SVGSVGElement>('.system-map-svg')
    if (!svg) return
    resizeObserver = new ResizeObserver(refreshForViewportChange)
    resizeObserver.observe(svg)
  }

  onMounted(observeCurrentMap)
  watch(() => options.isSystemView(), async () => {
    await nextTick()
    observeCurrentMap()
  }, { flush: 'post' })
  onBeforeUnmount(dispose)

  return {
    setChildGestureActive,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onGlobalPointerDown,
    onLostPointerCapture,
    onWheelCapture,
    onEscape,
    onClickCapture,
    onMouseUpCapture,
    onTouchStartCapture,
    onTouchMoveCapture,
    onTouchEndCapture,
    cancel,
    refreshForViewportChange,
    hasActivePointer: () => !!orbitPointer && orbitPointer.phase !== 'cancelled',
    pointerId: () => orbitPointer?.pointerId,
    isTouchPending: () => orbitTouch?.phase === 'pending',
  }
}
