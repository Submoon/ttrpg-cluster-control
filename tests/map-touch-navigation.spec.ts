import { expect, test } from '@playwright/test'
import {
  createMapTouchNavigation,
  isSingleTouchPanEligible,
  MAP_TOUCH_PAN_THRESHOLD_PX,
  type MapTouchCamera,
  type MapTouchEvent,
  type MapTouchPoint,
  type MapTouchSurface,
  type MapTouchViewport,
} from '../components/maps/map-touch-navigation'

interface CameraProbe {
  camera: MapTouchCamera
  viewport(): MapTouchViewport
  setPinchReady(ready: boolean): void
  setMinimumScale(scale: number): void
  interruptCount(): number
  appliedCount(): number
}

function cameraProbe(
  initial: MapTouchViewport = { x: 0, y: 0, k: 1 },
  pointScale = 1,
  minimumScale = 0.5,
): CameraProbe {
  let viewport = { ...initial }
  let pinchReady = true
  let liveMinimumScale = minimumScale
  let interrupts = 0
  const applied: MapTouchViewport[] = []
  return {
    camera: {
      isPinchReady: () => pinchReady,
      getViewport: () => ({ ...viewport }),
      pointFromClient: point => [point.clientX * pointScale, point.clientY * pointScale],
      minimumZoomScale: () => liveMinimumScale,
      applyViewport: next => {
        viewport = { ...next }
        applied.push(viewport)
      },
      interrupt: () => { interrupts += 1 },
    },
    viewport: () => ({ ...viewport }),
    setPinchReady: ready => { pinchReady = ready },
    setMinimumScale: scale => { liveMinimumScale = scale },
    interruptCount: () => interrupts,
    appliedCount: () => applied.length,
  }
}

function touchInput(
  touches: readonly MapTouchPoint[],
  options: { ctrlKey?: boolean } = {},
): { event: MapTouchEvent; consumed: { prevented: boolean; stopped: boolean; immediateStopped: boolean } } {
  const consumed = { prevented: false, stopped: false, immediateStopped: false }
  return {
    event: {
      touches,
      target: null,
      ctrlKey: options.ctrlKey ?? false,
      preventDefault: () => { consumed.prevented = true },
      stopPropagation: () => { consumed.stopped = true },
      stopImmediatePropagation: () => { consumed.immediateStopped = true },
    },
    consumed,
  }
}

function navigation(
  surface: MapTouchSurface,
  getCamera: () => MapTouchCamera | null,
  options: {
    isEnabled?: () => boolean
    moveEnabled?: () => boolean
    onPinchTakeover?: () => void
  } = {},
) {
  return createMapTouchNavigation({
    surface,
    isEnabled: options.isEnabled ?? (() => true),
    moveEnabled: options.moveEnabled ?? (() => true),
    getCamera,
    onPinchTakeover: options.onPinchTakeover ?? (() => {}),
  })
}

test('single-touch pan waits for more than the CSS threshold and applies SVG-space movement @pure', () => {
  const probe = cameraProbe({ x: 10, y: 20, k: 2 }, 2)
  const touch = navigation('cluster', () => probe.camera)
  const start = touchInput([{ clientX: 10, clientY: 20 }])
  touch.start(start.event)
  expect(probe.interruptCount()).toBe(1)

  const atThreshold = touchInput([{ clientX: 10 + MAP_TOUCH_PAN_THRESHOLD_PX, clientY: 20 }])
  touch.move(atThreshold.event)
  expect(atThreshold.consumed).toEqual({ prevented: false, stopped: false, immediateStopped: false })
  expect(probe.viewport()).toEqual({ x: 10, y: 20, k: 2 })

  const beyondThreshold = touchInput([{ clientX: 19.01, clientY: 20 }])
  touch.move(beyondThreshold.event)
  expect(beyondThreshold.consumed).toEqual({ prevented: true, stopped: false, immediateStopped: true })
  expect(probe.viewport().x).toBeCloseTo(28.02)
  expect(probe.viewport().y).toBe(20)
  expect(probe.viewport().k).toBe(2)
})

test('pinch keeps its map anchor while clamping against the live zoom range @pure', () => {
  const probe = cameraProbe({ x: 40, y: 80, k: 10 })
  const touch = navigation('cluster', () => probe.camera)
  touch.startPinch([{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }])

  const oneContact = touchInput([{ clientX: 3, clientY: 4 }])
  touch.move(oneContact.event)
  expect(oneContact.consumed.prevented).toBe(true)
  expect(oneContact.consumed.immediateStopped).toBe(true)
  expect(probe.viewport()).toEqual({ x: 40, y: 80, k: 10 })

  touch.movePinch([{ clientX: 0, clientY: 0 }, { clientX: 30, clientY: 0 }])
  expect(probe.viewport()).toEqual({ x: 71, y: 128, k: 16 })

  touch.startPinch([{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }])
  probe.setMinimumScale(3)
  touch.movePinch([{ clientX: 0, clientY: 0 }, { clientX: 1, clientY: 0 }])
  expect(probe.viewport()).toEqual({ x: 12.875, y: 24, k: 3 })
})

test('three-to-two and two-to-one transitions rebase without a camera jump @pure', () => {
  const probe = cameraProbe({ x: 10, y: 20, k: 2 })
  const touch = navigation('system', () => probe.camera)
  const start = touchInput([
    { clientX: 0, clientY: 0 },
    { clientX: 10, clientY: 0 },
    { clientX: 20, clientY: 20 },
  ])
  touch.start(start.event)
  expect(start.consumed).toEqual({ prevented: true, stopped: true, immediateStopped: false })

  touch.move(touchInput([
    { clientX: 0, clientY: 0 },
    { clientX: 20, clientY: 0 },
    { clientX: 20, clientY: 20 },
  ]).event)
  const afterPinch = probe.viewport()

  touch.end(touchInput([
    { clientX: 5, clientY: 5 },
    { clientX: 25, clientY: 5 },
  ]).event)
  const afterThreeToTwoRebase = probe.viewport()
  touch.move(touchInput([
    { clientX: 5, clientY: 5 },
    { clientX: 25, clientY: 5 },
  ]).event)
  expect(probe.viewport()).toEqual(afterThreeToTwoRebase)

  touch.end(touchInput([{ clientX: 25, clientY: 5 }]).event)
  touch.move(touchInput([{ clientX: 25, clientY: 5 }]).event)
  expect(probe.viewport()).toEqual(afterThreeToTwoRebase)
  touch.move(touchInput([{ clientX: 27, clientY: 8 }]).event)
  expect(probe.viewport()).toEqual({
    x: afterThreeToTwoRebase.x + 2,
    y: afterThreeToTwoRebase.y + 3,
    k: afterThreeToTwoRebase.k,
  })
  expect(afterPinch).not.toEqual(probe.viewport())
})

test('cancel clears pending input so a late move cannot claim the camera @pure', () => {
  const probe = cameraProbe({ x: 15, y: 25, k: 1.5 })
  const touch = navigation('cluster', () => probe.camera)
  touch.start(touchInput([{ clientX: 10, clientY: 20 }]).event)
  touch.cancel()

  const lateMove = touchInput([{ clientX: 30, clientY: 20 }])
  touch.move(lateMove.event)
  touch.end(touchInput([]).event)
  expect(lateMove.consumed).toEqual({ prevented: false, stopped: false, immediateStopped: false })
  expect(probe.viewport()).toEqual({ x: 15, y: 25, k: 1.5 })
})

test('ordinary pinch takeover runs before camera reacquisition and pinch seeding @pure', () => {
  const probe = cameraProbe()
  const order: string[] = []
  const touch = navigation('system', () => {
    order.push('camera')
    return probe.camera
  }, {
    onPinchTakeover: () => {
      order.push('takeover')
      touch.cancel()
    },
  })

  const start = touchInput([{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }])
  touch.start(start.event)
  expect(start.consumed.prevented).toBe(true)
  expect(start.consumed.stopped).toBe(true)
  expect(order[0]).toBe('takeover')
  expect(order.indexOf('takeover')).toBeLessThan(order.indexOf('camera'))
  expect(probe.interruptCount()).toBe(1)

  touch.move(touchInput([{ clientX: 0, clientY: 0 }, { clientX: 20, clientY: 0 }]).event)
  expect(probe.viewport().k).toBe(2)
})

test('Orbit-owned camera pinch skips ordinary edit takeover @pure', () => {
  const probe = cameraProbe({ x: 0, y: 0, k: 2 })
  let takeovers = 0
  const touch = navigation('system', () => probe.camera, {
    onPinchTakeover: () => { takeovers += 1 },
  })

  touch.startPinch([{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }])
  touch.movePinch([{ clientX: 0, clientY: 0 }, { clientX: 20, clientY: 0 }])
  expect(probe.viewport().k).toBe(4)
  expect(takeovers).toBe(0)
  expect(probe.interruptCount()).toBe(1)

  touch.endPinch()
  const applied = probe.appliedCount()
  touch.movePinch([{ clientX: 0, clientY: 0 }, { clientX: 40, clientY: 0 }])
  expect(probe.appliedCount()).toBe(applied)
})

test('native moves preserve zoom-readiness guards and map-specific end readiness @pure', () => {
  const probe = cameraProbe()
  const touch = navigation('cluster', () => probe.camera)
  touch.start(touchInput([{ clientX: 0, clientY: 0 }]).event)
  probe.setPinchReady(false)
  const unavailableMove = touchInput([{ clientX: 20, clientY: 0 }])
  touch.move(unavailableMove.event)
  expect(unavailableMove.consumed.prevented).toBe(false)
  expect(probe.viewport()).toEqual({ x: 0, y: 0, k: 1 })
  probe.setPinchReady(true)
  touch.move(touchInput([{ clientX: 20, clientY: 0 }]).event)
  expect(probe.viewport().x).toBe(20)

  for (const surface of ['cluster', 'system'] satisfies MapTouchSurface[]) {
    const endProbe = cameraProbe({ x: 0, y: 0, k: 2 })
    const endTouch = navigation(surface, () => endProbe.camera)
    endTouch.startPinch([{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }])
    endProbe.setPinchReady(false)
    endTouch.end(touchInput([{ clientX: 10, clientY: 10 }]).event)
    endProbe.setPinchReady(true)
    endTouch.move(touchInput([{ clientX: 10, clientY: 10 }]).event)
    const afterStationaryMove = endProbe.viewport()
    endTouch.move(touchInput([{ clientX: 12, clientY: 10 }]).event)
    if (surface === 'cluster') {
      expect(endProbe.viewport().x).toBe(afterStationaryMove.x + 2)
    } else {
      expect(endProbe.viewport()).toEqual(afterStationaryMove)
    }
  }
})

test('Move eligibility and disabled touch navigation leave rejected contacts unowned @pure', () => {
  expect(isSingleTouchPanEligible(null, true, 'cluster')).toBe(true)
  let enabled = true
  const probe = cameraProbe()
  const touch = navigation('cluster', () => probe.camera, {
    isEnabled: () => enabled,
    moveEnabled: () => true,
  })

  touch.start(touchInput([{ clientX: 0, clientY: 0 }], { ctrlKey: true }).event)
  const rejectedMove = touchInput([{ clientX: 20, clientY: 0 }])
  touch.move(rejectedMove.event)
  expect(rejectedMove.consumed.prevented).toBe(false)

  enabled = false
  touch.start(touchInput([{ clientX: 0, clientY: 0 }]).event)
  const disabledMove = touchInput([{ clientX: 20, clientY: 0 }])
  touch.move(disabledMove.event)
  expect(disabledMove.consumed.prevented).toBe(false)
  expect(probe.viewport()).toEqual({ x: 0, y: 0, k: 1 })
})
