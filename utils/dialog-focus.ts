export interface DialogFocusTarget {
  isAvailable(): boolean
  focus(): void
}

/** Wraps a DOM target with checks for removal, disabled state, and hidden modal backgrounds. */
export function createDialogFocusTarget(element: HTMLElement | null): DialogFocusTarget | null {
  if (!element) return null
  return {
    isAvailable: () => {
      if (!element.isConnected
        || element.matches(':disabled')
        || element.closest('[inert], [aria-hidden="true"], .sr-only')
        || element.getClientRects().length === 0) return false
      const style = window.getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    },
    focus: () => element.focus(),
  }
}

/** Returns focus to a usable opener or, when it was removed, to the supplied page fallback. */
export function restoreDialogFocus(
  opener: DialogFocusTarget | null,
  fallback: DialogFocusTarget | null,
): 'opener' | 'fallback' | 'none' {
  if (opener?.isAvailable()) {
    opener.focus()
    return 'opener'
  }
  if (fallback?.isAvailable()) {
    fallback.focus()
    return 'fallback'
  }
  return 'none'
}
