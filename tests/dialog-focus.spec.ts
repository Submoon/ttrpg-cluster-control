import { expect, test } from './fixtures'
import type { DialogFocusTarget } from '../utils/dialog-focus'
import { restoreDialogFocus } from '../utils/dialog-focus'

function focusTarget(available: boolean): { target: DialogFocusTarget; focused: number } {
  const state = { focused: 0 }
  return {
    target: {
      isAvailable: () => available,
      focus: () => { state.focused += 1 },
    },
    get focused() { return state.focused },
  }
}

test('a connected dialog opener receives focus on close @pure', () => {
  const opener = focusTarget(true)
  const fallback = focusTarget(true)

  expect(restoreDialogFocus(opener.target, fallback.target)).toBe('opener')
  expect(opener.focused).toBe(1)
  expect(fallback.focused).toBe(0)
})

test('a removed welcome opener falls back to the workspace main region @pure', () => {
  const opener = focusTarget(false)
  const fallback = focusTarget(true)

  expect(restoreDialogFocus(opener.target, fallback.target)).toBe('fallback')
  expect(opener.focused).toBe(0)
  expect(fallback.focused).toBe(1)
})

test('focus remains untouched when neither the opener nor fallback is available @pure', () => {
  const opener = focusTarget(false)
  const fallback = focusTarget(false)

  expect(restoreDialogFocus(opener.target, fallback.target)).toBe('none')
  expect(opener.focused).toBe(0)
  expect(fallback.focused).toBe(0)
})
