import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { WorkspaceHistoryStatus } from './useWorkspaceHistory'

type HistoryDirection = 'undo' | 'redo'
type ShortcutStatus = Pick<WorkspaceHistoryStatus, 'undoUnavailableReason' | 'redoUnavailableReason'>

interface WorkspaceHistoryShortcutOptions {
  status: Readonly<Ref<ShortcutStatus>>
  workspaceEnabled(): boolean
  pageOverlayOpen(): boolean
  undo(): Promise<void>
  redo(): Promise<void>
}

const popupRoles = new Set(['alertdialog', 'dialog', 'listbox', 'menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio'])

/** Owns one editor session's browser shortcut lifetime; traversal still uses the page's guarded commands. */
export function useWorkspaceHistoryShortcuts(options: WorkspaceHistoryShortcutOptions): void {
  let compositionActive = false
  let listening = false

  function keydown(event: KeyboardEvent): void {
    if (event.repeat) return
    const direction = historyDirection(event)
    if (!direction || event.defaultPrevented || compositionActive || event.isComposing || event.keyCode === 229) return
    if (eventPathContainsNativeEditor(event) || options.pageOverlayOpen() || eventOwnedByPopup(event)) return
    if (!options.workspaceEnabled()) return

    const unavailableReason = options.status.value[`${direction}UnavailableReason`]
    // The workspace owns this non-editor chord now. Drop it immediately if history is blocked;
    // never preserve a request for a later save, draft decision, or preview completion.
    event.preventDefault()
    if (unavailableReason !== null) return

    void options[direction]()
  }

  function compositionstart(): void {
    compositionActive = true
  }

  function compositionend(): void {
    compositionActive = false
  }

  function blur(): void {
    compositionActive = false
  }

  onMounted(() => {
    window.addEventListener('keydown', keydown)
    window.addEventListener('compositionstart', compositionstart)
    window.addEventListener('compositionend', compositionend)
    window.addEventListener('blur', blur)
    listening = true
  })

  onBeforeUnmount(() => {
    if (!listening) return
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('compositionstart', compositionstart)
    window.removeEventListener('compositionend', compositionend)
    window.removeEventListener('blur', blur)
    blur()
    listening = false
  })
}

function historyDirection(event: KeyboardEvent): HistoryDirection | null {
  const key = event.key.toLowerCase()
  const hasControl = event.ctrlKey
  const hasMeta = event.metaKey
  if (event.altKey || hasControl === hasMeta) return null
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && hasControl && !hasMeta && !event.shiftKey) return 'redo'
  return null
}

function eventPathElements(event: Event): Element[] {
  const path = event.composedPath()
  const elements = path.filter(isElement)
  if (elements.length) return elements

  const fallback: Element[] = []
  let current = event.target instanceof Node ? event.target : null
  while (current) {
    if (isElement(current)) fallback.push(current)
    if (current.parentNode) {
      current = current.parentNode
    } else if (current instanceof ShadowRoot) {
      current = current.host
    } else {
      break
    }
  }
  return fallback
}

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === 1
}

function eventPathContainsNativeEditor(event: KeyboardEvent): boolean {
  for (const element of eventPathElements(event)) {
    const tagName = element.tagName.toLowerCase()
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true

    if (element.hasAttribute('contenteditable')) {
      const value = element.getAttribute('contenteditable')?.trim().toLowerCase()
      if (value === '' || value === 'true' || value === 'plaintext-only') return true
    }
    if ('isContentEditable' in element && (element as HTMLElement).isContentEditable) return true
  }
  return false
}

function eventOwnedByPopup(event: KeyboardEvent): boolean {
  return eventPathElements(event).some((element) => {
    const role = element.getAttribute('role')
    if (role && popupRoles.has(role) && isVisibleAndOpen(element)) return true
    if (element.classList.contains('workspace-zoom-navigation') && isVisibleAndOpen(element)) return true
    if (role === 'combobox' && element.getAttribute('aria-expanded') === 'true' && isVisibleAndOpen(element)) return true

    // Popover triggers expose their owner with aria-controls. Resolve only the popup named by
    // the event path; this avoids treating unrelated hidden portals as workspace state.
    if (element.getAttribute('aria-expanded') !== 'true' || !element.hasAttribute('aria-haspopup')) return false
    const controlledIds = element.getAttribute('aria-controls')?.split(/\s+/).filter(Boolean) ?? []
    if (!controlledIds.length) return true
    return controlledIds.some((id) => {
      const controlled = element.ownerDocument.getElementById(id)
      return controlled !== null && isVisibleAndOpen(controlled)
    })
  })
}

function isVisibleAndOpen(element: Element): boolean {
  if (!element.isConnected || element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  const state = element.getAttribute('data-state')
  if (state !== null && state !== 'open') return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
}
