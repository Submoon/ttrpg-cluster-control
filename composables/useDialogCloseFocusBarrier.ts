import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** Resolves close waiters after focus restoration, or when a pending modal exit is cancelled. */
export function useDialogCloseFocusBarrier(open: Readonly<Ref<boolean>>): {
  whenClosingFocusSettled: () => Promise<void>
  settleClosingFocus: () => void
} {
  const closing = ref(false)
  const waiters = new Set<() => void>()

  function settleClosingFocus(): void {
    closing.value = false
    for (const resolve of waiters) resolve()
    waiters.clear()
  }

  function whenClosingFocusSettled(): Promise<void> {
    if (!closing.value) return Promise.resolve()
    return new Promise(resolve => waiters.add(resolve))
  }

  watch(open, (isOpen, wasOpen) => {
    if (wasOpen && !isOpen) closing.value = true
    else if (!wasOpen && isOpen && closing.value) settleClosingFocus()
  }, { flush: 'sync' })

  onBeforeUnmount(settleClosingFocus)

  return { whenClosingFocusSettled, settleClosingFocus }
}
