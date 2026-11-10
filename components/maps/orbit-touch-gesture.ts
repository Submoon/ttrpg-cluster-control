export type OrbitTouchContact = {
  id: number
  x: number
  y: number
}

export type OrbitTouchPhase = 'pending' | 'dragging' | 'pinching' | 'awaiting-movement' | 'cancelled'

export type OrbitTouchAction =
  | 'ignore'
  | 'start-drag'
  | 'update-drag'
  | 'start-pinch'
  | 'update-pinch'
  | 'resume'
  | 'tap'
  | 'commit'
  | 'cancel'
  | 'cancel-pending'

/** Owns the touch-specific threshold and contact transitions for Add Orbit. */
export function createOrbitTouchGesture(
  initialContact: OrbitTouchContact,
  movementThreshold = 9,
) {
  const contacts = new Map<number, OrbitTouchContact>([
    [initialContact.id, { ...initialContact }],
  ])
  let phase: OrbitTouchPhase = 'pending'
  let activePointerId = initialContact.id
  const startPoint = { x: initialContact.x, y: initialContact.y }
  let resumedPointerId: number | null = null
  let resumedAt: { x: number; y: number } | null = null

  function currentContacts(): OrbitTouchContact[] {
    return Array.from(contacts.values(), contact => ({ ...contact }))
  }

  function addContact(contact: OrbitTouchContact): OrbitTouchAction {
    contacts.set(contact.id, { ...contact })
    if (phase === 'pending') {
      phase = 'cancelled'
      return 'cancel-pending'
    }
    if (phase === 'cancelled') return 'ignore'
    if (phase === 'dragging' || phase === 'awaiting-movement' || phase === 'pinching') {
      phase = 'pinching'
      resumedPointerId = null
      resumedAt = null
      return 'start-pinch'
    }
    return 'ignore'
  }

  function moveContact(contact: OrbitTouchContact): OrbitTouchAction {
    if (!contacts.has(contact.id)) return 'ignore'
    contacts.set(contact.id, { ...contact })
    if (phase === 'pending' && contact.id === activePointerId) {
      if (Math.hypot(contact.x - startPoint.x, contact.y - startPoint.y) <= movementThreshold) return 'ignore'
      phase = 'dragging'
      return 'start-drag'
    }
    if (phase === 'dragging' && contact.id === activePointerId) return 'update-drag'
    if (phase === 'pinching') return 'update-pinch'
    if (phase === 'awaiting-movement'
      && contact.id === resumedPointerId
      && resumedAt
      && Math.hypot(contact.x - resumedAt.x, contact.y - resumedAt.y) > 0) {
      phase = 'dragging'
      activePointerId = contact.id
      resumedPointerId = null
      resumedAt = null
      return 'start-drag'
    }
    return 'ignore'
  }

  function removeContact(id: number): OrbitTouchAction {
    if (!contacts.has(id)) return 'ignore'
    const wasPending = phase === 'pending'
    contacts.delete(id)
    if (phase === 'cancelled') return contacts.size === 0 ? 'cancel' : 'ignore'
    if (wasPending) {
      phase = 'cancelled'
      return 'tap'
    }
    if (phase === 'pinching') {
      if (contacts.size >= 2) return 'update-pinch'
      if (contacts.size === 1) {
        const [remaining] = contacts.values()
        if (!remaining) return 'cancel'
        phase = 'awaiting-movement'
        resumedPointerId = remaining.id
        resumedAt = { x: remaining.x, y: remaining.y }
        return 'resume'
      }
      phase = 'cancelled'
      return 'cancel'
    }
    if (phase === 'awaiting-movement') {
      phase = 'cancelled'
      return 'cancel'
    }
    if (phase === 'dragging' && id === activePointerId) {
      phase = 'cancelled'
      return contacts.size === 0 ? 'commit' : 'cancel'
    }
    return 'ignore'
  }

  function cancel(): void {
    phase = 'cancelled'
  }

  return {
    get phase(): OrbitTouchPhase { return phase },
    get contacts(): OrbitTouchContact[] { return currentContacts() },
    addContact,
    moveContact,
    removeContact,
    cancel,
  }
}
