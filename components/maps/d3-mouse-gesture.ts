/** Captures cancellation for one active D3 mouse drag without removing another drag's window listeners. */
import { select } from 'd3'

type D3MouseListener = (this: Window, event: MouseEvent) => void
const gestureOwners = new WeakMap<object, symbol>()

/** Claims the current mouse-gesture lifetime for a view; a later start immediately supersedes it. */
export function claimD3MouseGestureOwner(view: object): symbol {
  const owner = Symbol('d3-mouse-gesture')
  gestureOwners.set(view, owner)
  return owner
}

/** Returns whether a cancellation still belongs to the most recently started gesture on this view. */
export function isD3MouseGestureOwner(view: object, owner: symbol): boolean {
  return gestureOwners.get(view) === owner
}

/** Releases a view only when the caller still owns its active gesture lifetime. */
export function releaseD3MouseGestureOwner(view: object, owner: symbol): void {
  if (isD3MouseGestureOwner(view, owner)) gestureOwners.delete(view)
}

export interface D3MouseGestureDisposer {
  /** Cancels this drag through its current D3 mouseup handler when it still owns that handler. */
  cancel(): void
  /** Marks a normally completed drag as no longer active. */
  complete(): void
}

/**
 * Returns an owner-scoped disposer for the D3 drag started by this native mouse event.
 * Calling the captured mouseup runs D3's own listener and selection-suppression cleanup path.
 */
export function captureD3MouseGesture(sourceEvent: Event): D3MouseGestureDisposer {
  if (!(sourceEvent instanceof MouseEvent) || !sourceEvent.view) {
    return { cancel: () => undefined, complete: () => undefined }
  }
  const view = sourceEvent.view
  const windowSelection = select(view)
  const move = windowSelection.on('mousemove.drag') as D3MouseListener | undefined
  const up = windowSelection.on('mouseup.drag') as D3MouseListener | undefined
  if (!move || !up) return { cancel: () => undefined, complete: () => undefined }
  const owner = claimD3MouseGestureOwner(view)

  let disposed = false
  return {
    cancel() {
      if (disposed) return
      disposed = true
      if (!isD3MouseGestureOwner(view, owner)
        || windowSelection.on('mousemove.drag') !== move
        || windowSelection.on('mouseup.drag') !== up) return

      const cancellation = new MouseEvent('mouseup', {
        bubbles: true,
        button: sourceEvent.button,
        buttons: 0,
        clientX: sourceEvent.clientX,
        clientY: sourceEvent.clientY,
        view,
      })
      up.call(view, cancellation)
      releaseD3MouseGestureOwner(view, owner)
    },
    complete() {
      disposed = true
      releaseD3MouseGestureOwner(view, owner)
    },
  }
}
