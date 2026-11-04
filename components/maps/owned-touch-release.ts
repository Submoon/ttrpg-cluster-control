/** Suppresses the compatibility events produced when one touch-owned map inspection releases. */
export type OwnedTouchPress = {
  touchId: number
  pointerId: number | null
  x: number
  y: number
}

type TouchPointerContact = {
  pointerId: number
  touchId: number | null
  x: number
  y: number
  startedAt: number
}

type ReleaseToken = OwnedTouchPress & {
  released: boolean
  fallbackTimer?: ReturnType<typeof setTimeout>
}

type EventWithSourceCapabilities = Event & {
  sourceCapabilities?: { firesTouchEvents?: boolean } | null
}

const RELEASE_FALLBACK_MS = 900
const ORIGIN_RADIUS_PX = 4
const POINTER_TOUCH_MATCH_WINDOW_MS = 1_500

/**
 * Owns the terminal transport for one long-press inspection on one mounted map canvas.
 * Pointer/touch release is allowed to bubble for gesture cleanup; only the following
 * compatibility mouse sequence is stopped before it can activate a reflowed control.
 */
export function createOwnedTouchReleaseGuard(ownerDocument: Document) {
  let token: ReleaseToken | null = null
  const touchPointers: TouchPointerContact[] = []

  function clearToken(): void {
    if (token?.fallbackTimer) clearTimeout(token.fallbackTimer)
    token = null
  }

  function expirePointerContact(pointerId: number): void {
    const index = touchPointers.findIndex(contact => contact.pointerId === pointerId)
    if (index !== -1) touchPointers.splice(index, 1)
  }

  function expireTouchContact(touchId: number): void {
    for (let index = touchPointers.length - 1; index >= 0; index--) {
      if (touchPointers[index]?.touchId === touchId) touchPointers.splice(index, 1)
    }
  }

  function noteRelease(point: { x: number; y: number }): void {
    if (!token) return
    if (!token.released && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      token.x = point.x
      token.y = point.y
    }
    token.released = true
    if (token.fallbackTimer) return
    token.fallbackTimer = setTimeout(clearToken, RELEASE_FALLBACK_MS)
  }

  function matchPointerToTouch(touchId: number, x: number, y: number): void {
    const now = Date.now()
    let match: TouchPointerContact | undefined
    let matchDistance = Number.POSITIVE_INFINITY
    for (const contact of touchPointers) {
      if (contact.touchId !== null || now - contact.startedAt > POINTER_TOUCH_MATCH_WINDOW_MS) continue
      const distance = Math.hypot(contact.x - x, contact.y - y)
      if (distance <= ORIGIN_RADIUS_PX && distance < matchDistance) {
        match = contact
        matchDistance = distance
      }
    }
    if (match) match.touchId = touchId
  }

  function pointerIdForTouch(touchId: number): number | null {
    return touchPointers.find(contact => contact.touchId === touchId)?.pointerId ?? null
  }

  function pointMatches(event: MouseEvent, owned: OwnedTouchPress): boolean {
    return Number.isFinite(event.clientX)
      && Number.isFinite(event.clientY)
      && Math.hypot(event.clientX - owned.x, event.clientY - owned.y) <= ORIGIN_RADIUS_PX
  }

  function eventPointerId(event: Event): number | null {
    if (!('pointerId' in event)) return null
    return typeof event.pointerId === 'number' ? event.pointerId : null
  }

  function eventPointerType(event: Event): string | null {
    if (!('pointerType' in event)) return null
    return typeof event.pointerType === 'string' ? event.pointerType : null
  }

  function isExplicitlyNonTouch(event: MouseEvent): boolean {
    return (event as EventWithSourceCapabilities).sourceCapabilities?.firesTouchEvents === false
  }

  function isTouchGenerated(event: Event): boolean {
    return (event as EventWithSourceCapabilities).sourceCapabilities?.firesTouchEvents === true
  }

  function hasOwnedTouchInput(event: Event, owned: OwnedTouchPress): boolean {
    const pointerId = eventPointerId(event)
    const pointerType = eventPointerType(event)
    if (pointerId !== null) {
      return pointerId === owned.pointerId && (pointerType === null || pointerType === 'touch')
    }
    return pointerType !== 'mouse' && isTouchGenerated(event)
  }

  function onPointerDown(event: PointerEvent): void {
    // The original touch pointerdown precedes touchstart and the hold timer. Any
    // pointerdown after arming is a new physical intent, including a reused ID.
    clearToken()
    if (event.pointerType === 'touch') {
      if (!touchPointers.some(contact => contact.pointerId === event.pointerId)) {
        touchPointers.push({
          pointerId: event.pointerId,
          touchId: null,
          x: event.clientX,
          y: event.clientY,
          startedAt: Date.now(),
        })
      }
    }
  }

  function onTouchStart(event: TouchEvent): void {
    // The inspected contact's touchstart predates the hold timer. Any touchstart
    // after arming is a fresh intent, even if a browser reuses its touch identifier.
    clearToken()
    for (const touch of Array.from(event.changedTouches)) {
      matchPointerToTouch(touch.identifier, touch.clientX, touch.clientY)
    }
  }

  function onPointerRelease(event: PointerEvent): void {
    if (event.pointerType === 'touch' && token?.pointerId === event.pointerId) {
      event.preventDefault()
      noteRelease({ x: event.clientX, y: event.clientY })
    }
    if (event.pointerType === 'touch') expirePointerContact(event.pointerId)
  }

  function onTouchRelease(event: TouchEvent): void {
    const changedTouches = Array.from(event.changedTouches)
    const owned = token
    const releasedTouch = owned && changedTouches.find(touch => touch.identifier === owned.touchId)
    if (releasedTouch) {
      event.preventDefault()
      noteRelease({ x: releasedTouch.clientX, y: releasedTouch.clientY })
    }
    for (const touch of changedTouches) expireTouchContact(touch.identifier)
  }

  function onCompatibilityMouseEvent(event: MouseEvent): void {
    const owned = token
    if (!owned) return

    if (event.type === 'click' && event.detail === 0) return
    if (event.type === 'mousedown'
      && (isExplicitlyNonTouch(event) || !hasOwnedTouchInput(event, owned))) {
      clearToken()
      return
    }
    if (event.type === 'contextmenu' && !owned.released) {
      if (!isExplicitlyNonTouch(event)
        && pointMatches(event, owned)
        && hasOwnedTouchInput(event, owned)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (!owned.released) return
    if (isExplicitlyNonTouch(event)
      || !pointMatches(event, owned)
      || !hasOwnedTouchInput(event, owned)) {
      if (event.type === 'mousedown') clearToken()
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.type === 'click') clearToken()
  }

  function onTouchCancel(event: TouchEvent): void { onTouchRelease(event) }
  function onPointerCancel(event: PointerEvent): void { onPointerRelease(event) }

  ownerDocument.addEventListener('pointerdown', onPointerDown, true)
  ownerDocument.addEventListener('pointerup', onPointerRelease, true)
  ownerDocument.addEventListener('pointercancel', onPointerCancel, true)
  ownerDocument.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  ownerDocument.addEventListener('touchend', onTouchRelease, { capture: true, passive: false })
  ownerDocument.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: false })
  ownerDocument.addEventListener('mousedown', onCompatibilityMouseEvent, true)
  ownerDocument.addEventListener('mouseup', onCompatibilityMouseEvent, true)
  ownerDocument.addEventListener('click', onCompatibilityMouseEvent, true)
  ownerDocument.addEventListener('contextmenu', onCompatibilityMouseEvent, true)

  return {
    pointerIdForTouch,
    arm(press: OwnedTouchPress): void {
      clearToken()
      token = { ...press, released: false }
    },
    dispose(): void {
      clearToken()
      touchPointers.length = 0
      ownerDocument.removeEventListener('pointerdown', onPointerDown, true)
      ownerDocument.removeEventListener('pointerup', onPointerRelease, true)
      ownerDocument.removeEventListener('pointercancel', onPointerCancel, true)
      ownerDocument.removeEventListener('touchstart', onTouchStart, true)
      ownerDocument.removeEventListener('touchend', onTouchRelease, true)
      ownerDocument.removeEventListener('touchcancel', onTouchCancel, true)
      ownerDocument.removeEventListener('mousedown', onCompatibilityMouseEvent, true)
      ownerDocument.removeEventListener('mouseup', onCompatibilityMouseEvent, true)
      ownerDocument.removeEventListener('click', onCompatibilityMouseEvent, true)
      ownerDocument.removeEventListener('contextmenu', onCompatibilityMouseEvent, true)
    },
  }
}
