import { expect, test } from '@playwright/test'
import { createOrbitTouchGesture } from '../components/maps/orbit-touch-gesture'

test('@pure Add Orbit touch preserves a tap and hands a second pending contact to navigation', () => {
  const gesture = createOrbitTouchGesture({ id: 1, x: 20, y: 30 })

  expect(gesture.moveContact({ id: 1, x: 26, y: 36 })).toBe('ignore')
  expect(gesture.phase).toBe('pending')
  expect(gesture.removeContact(1)).toBe('tap')

  const interrupted = createOrbitTouchGesture({ id: 2, x: 20, y: 30 })
  expect(interrupted.addContact({ id: 3, x: 80, y: 30 })).toBe('cancel-pending')
  expect(interrupted.phase).toBe('cancelled')
})

test('@pure Add Orbit touch resumes after pinch and requires renewed movement before commit', () => {
  const gesture = createOrbitTouchGesture({ id: 1, x: 100, y: 120 })

  expect(gesture.moveContact({ id: 1, x: 111, y: 120 })).toBe('start-drag')
  expect(gesture.addContact({ id: 2, x: 160, y: 120 })).toBe('start-pinch')
  expect(gesture.moveContact({ id: 2, x: 170, y: 125 })).toBe('update-pinch')
  expect(gesture.removeContact(1)).toBe('resume')
  expect(gesture.phase).toBe('awaiting-movement')
  expect(gesture.moveContact({ id: 2, x: 170, y: 125 })).toBe('ignore')
  expect(gesture.removeContact(2)).toBe('cancel')

  const resumed = createOrbitTouchGesture({ id: 4, x: 100, y: 120 })
  expect(resumed.moveContact({ id: 4, x: 111, y: 120 })).toBe('start-drag')
  expect(resumed.addContact({ id: 5, x: 160, y: 120 })).toBe('start-pinch')
  expect(resumed.moveContact({ id: 5, x: 170, y: 125 })).toBe('update-pinch')
  expect(resumed.removeContact(4)).toBe('resume')
  expect(resumed.moveContact({ id: 5, x: 170, y: 125 })).toBe('ignore')
  expect(resumed.moveContact({ id: 5, x: 171, y: 125 })).toBe('start-drag')
  expect(resumed.removeContact(5)).toBe('commit')
})

test('@pure Add Orbit touch cancellation makes all later contact moves inert', () => {
  const gesture = createOrbitTouchGesture({ id: 7, x: 10, y: 10 })
  expect(gesture.moveContact({ id: 7, x: 20, y: 10 })).toBe('start-drag')
  gesture.cancel()
  expect(gesture.phase).toBe('cancelled')
  expect(gesture.moveContact({ id: 7, x: 30, y: 10 })).toBe('ignore')
  expect(gesture.removeContact(7)).toBe('cancel')
})
