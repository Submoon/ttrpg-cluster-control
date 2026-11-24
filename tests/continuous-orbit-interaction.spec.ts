import { expect, test } from '@playwright/test'
import {
  continuousOrbitKeyboardChange,
  isExpectedContinuousOrbitHandoff,
  type ExpectedContinuousOrbitHandoff,
} from '../utils/continuous-orbit-interaction'

test('a guarded Orbit inspection tolerates only its expected synchronous owner and target steps @pure', () => {
  const expected: ExpectedContinuousOrbitHandoff = {
    workspaceId: 'workspace',
    clusterId: 'cluster',
    systemId: 'system-b',
    orbitId: 'orbit-b',
    startingSelectedSystemId: 'system-a',
    startingInspectedTarget: { kind: 'object', systemId: 'system-a', objectId: 'object-a' },
  }
  const context = {
    continuousMap: true,
    activeView: 'cluster',
    mapMode: 'move',
    workspaceId: 'workspace',
    clusterId: 'cluster',
    selectedSystemId: 'system-a',
    inspectedTarget: expected.startingInspectedTarget,
  }

  expect(isExpectedContinuousOrbitHandoff(expected, {
    ...context,
    inspectedTarget: { kind: 'orbit', systemId: 'system-b', orbitId: 'orbit-b' },
  })).toBe(true)
  expect(isExpectedContinuousOrbitHandoff(expected, {
    ...context,
    selectedSystemId: 'system-b',
  })).toBe(true)
  expect(isExpectedContinuousOrbitHandoff(expected, {
    ...context,
    selectedSystemId: 'system-b',
    inspectedTarget: { kind: 'orbit', systemId: 'system-b', orbitId: 'orbit-b' },
  })).toBe(true)
  expect(isExpectedContinuousOrbitHandoff(expected, {
    ...context,
    inspectedTarget: { kind: 'object', systemId: 'system-b', objectId: 'other-object' },
  })).toBe(false)
  expect(isExpectedContinuousOrbitHandoff(expected, { ...context, mapMode: 'select' })).toBe(false)
  expect(isExpectedContinuousOrbitHandoff(expected, { ...context, clusterId: 'other-cluster' })).toBe(false)
  expect(isExpectedContinuousOrbitHandoff(expected, { ...context, workspaceId: 'other-workspace' })).toBe(false)
})

test('focused Orbit controls retain the ring, axis, rotation, and center keyboard behavior @pure', () => {
  const minimum = 88
  expect(continuousOrbitKeyboardChange({ kind: 'ring' }, 'ArrowUp', 1, minimum))
    .toEqual({ kind: 'radii', axis: 'vertical', operation: 'delta', delta: 1, minimum })
  expect(continuousOrbitKeyboardChange({ kind: 'resize', axis: 'horizontal' }, 'ArrowUp', 10, minimum))
    .toEqual({ kind: 'radii', axis: 'horizontal', operation: 'delta', delta: 10, minimum })
  expect(continuousOrbitKeyboardChange({ kind: 'resize', axis: 'vertical' }, 'ArrowLeft', 1, minimum))
    .toEqual({ kind: 'radii', axis: 'vertical', operation: 'delta', delta: -1, minimum })
  expect(continuousOrbitKeyboardChange({ kind: 'rotation' }, 'ArrowLeft', 10, minimum))
    .toEqual({ kind: 'rotation', delta: -10 })
  expect(continuousOrbitKeyboardChange({ kind: 'center' }, 'ArrowRight', 1, minimum)).toBeNull()
})
