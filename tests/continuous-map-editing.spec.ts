import { expect, test } from '@playwright/test'
import {
  resolveContinuousObjectOwnerIds,
  resolveContinuousObjectOwnerResolution,
  selectContinuousObjectAddCandidate,
  continuousOrbitAddKeyboardPoint,
} from '../utils/continuous-map-editing'

const systems = [
  { id: 'vesper', envelope: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'altair', envelope: { x: 200, y: 0, width: 100, height: 100 } },
]

test('a definite map hit owns an Add click before envelope inference @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 250, y: 50 }, systems, 'vesper')).toEqual(['vesper'])
  expect(resolveContinuousObjectOwnerResolution({ x: 250, y: 50 }, systems, 'vesper')).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: false,
  })
})

test('a unique envelope owns an Add click, while overlap and outside require an owner choice @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 50, y: 50 }, systems)).toEqual(['vesper'])
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerIds({ x: 75, y: 50 }, overlap)).toEqual(['vesper', 'altair'])
  expect(resolveContinuousObjectOwnerIds({ x: 150, y: 150 }, systems)).toEqual(['vesper', 'altair'])
})

test('outside-space Add still asks for an owner when the workspace has one system @pure', () => {
  expect(resolveContinuousObjectOwnerResolution({ x: 500, y: 500 }, [systems[0]!])).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: true,
  })
})

test('a pinned Add owner remains selected even when the next point overlaps another envelope @pure', () => {
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerResolution({ x: 75, y: 50 }, overlap, 'vesper')).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: false,
  })
})

test('an occupied object hit can use its nearest legal Orbit candidate @pure', () => {
  const orbit = {
    key: 'orbit:outer',
    label: 'Outer Orbit',
    target: { kind: 'orbit' as const, orbitId: 'outer', angle: 0.4 },
    error: null,
  }
  const occupied = {
    key: 'occupied:planet',
    label: 'Object mark: Planet',
    target: { kind: 'host' as const, objectId: 'planet' },
    error: 'Planet already occupies this mark.',
  }
  expect(selectContinuousObjectAddCandidate([orbit, occupied], { kind: 'object', id: 'planet' }))
    .toEqual({ candidate: orbit, error: null })
  expect(selectContinuousObjectAddCandidate([occupied], { kind: 'object', id: 'planet' }))
    .toEqual({ error: 'This object mark is occupied. Choose an Orbit or clear map position.' })
  const innerOrbit = { ...orbit, target: { ...orbit.target, orbitId: 'inner' } }
  expect(selectContinuousObjectAddCandidate([orbit, innerOrbit], { kind: 'orbit', id: 'inner' }))
    .toEqual({ candidate: innerOrbit, error: null })
})

test('keyboard Add on an Orbit chooses a point on its rotated ring @pure', () => {
  expect(continuousOrbitAddKeyboardPoint({
    sceneCenter: { x: 200, y: 100 },
    sceneRadii: { horizontal: 40, vertical: 20 },
    rotation: 90,
  }, { x: 12, y: -5 })).toEqual({ x: 212, y: 135 })
})
