import { expect, test } from '@playwright/test'
import {
  claimD3MouseGestureOwner,
  isD3MouseGestureOwner,
  releaseD3MouseGestureOwner,
} from '../components/maps/d3-mouse-gesture'

test('releasing an inactive mouse-gesture owner leaves the newer gesture intact', () => {
  const view = {}
  const oldGesture = claimD3MouseGestureOwner(view)
  const activeGesture = claimD3MouseGestureOwner(view)

  releaseD3MouseGestureOwner(view, oldGesture)

  expect(isD3MouseGestureOwner(view, oldGesture)).toBe(false)
  expect(isD3MouseGestureOwner(view, activeGesture)).toBe(true)
  releaseD3MouseGestureOwner(view, activeGesture)
  expect(isD3MouseGestureOwner(view, activeGesture)).toBe(false)
})
