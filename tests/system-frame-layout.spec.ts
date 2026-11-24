import { expect, test } from './fixtures'
import {
  addStarSystem,
  createLocalWorkspace,
  exportJumpCluster,
  exportStarSystem,
  isLocalWorkspace,
  planMapEntityDeletion,
  prepareJsonImport,
  restoreJumpClusterBackup,
  restoreLocalWorkspace,
  setWorkspaceSystemFrame,
  workspaceSystemFrame,
  type JumpRoute,
} from '../domain/workspace'
import {
  projectWardenSystem,
  projectContinuousSystemGeometry,
  systemFrameFromInsets,
  systemFrameInsetsFromRect,
} from '../utils/continuous-map-projection'
import { constrainContinuousSystemFrame } from '../utils/continuous-system-frames'
import { buildContinuousWardenRouteGeometries } from '../utils/continuous-warden-routes'
import type { StarSystem } from '../domain/workspace'

const system: StarSystem = {
  id: 'frame-system',
  name: 'Frame System',
  publication: 'revealed',
  objects: [],
  orbits: [],
}

test('preferred frame insets round-trip, stay anchor-relative, and remain separate from content bounds @pure', () => {
  const anchor = { x: 300, y: 240 }
  const insets = { left: 45, top: 28, right: 70, bottom: 52 }
  const frame = systemFrameFromInsets(anchor, insets)

  expect(frame).toEqual({ x: 255, y: 212, width: 115, height: 80 })
  expect(systemFrameInsetsFromRect(anchor, frame)).toEqual(insets)
  expect(systemFrameFromInsets(anchor, { left: 0, top: 12, right: 70, bottom: 52 }))
    .toEqual({ x: 300, y: 228, width: 70, height: 64 })

  const withPreference = projectWardenSystem(system, { x: 0.5, y: 0.5 }, {
    objectAngles: {},
    orbitRadii: {},
    orbitRotations: {},
  }, undefined, insets)
  const withoutPreference = projectWardenSystem(system, { x: 0.5, y: 0.5 }, {
    objectAngles: {},
    orbitRadii: {},
    orbitRotations: {},
  })

  expect(withPreference.preferredFrame).toEqual(systemFrameFromInsets(withPreference.anchor, insets))
  expect(withPreference.envelope).toEqual(withoutPreference.envelope)
  expect(withoutPreference).not.toHaveProperty('preferredFrame')
  expect(() => systemFrameInsetsFromRect(anchor, { x: 301, y: 212, width: 20, height: 80 }))
    .toThrow(/contain its anchor/i)
  expect(() => systemFrameFromInsets(anchor, { left: 0, top: 0, right: 0, bottom: 0 }))
    .toThrow(/finite, nonnegative insets/i)
  expect(() => systemFrameFromInsets(anchor, {
    left: Number.MAX_VALUE,
    top: 1,
    right: Number.MAX_VALUE,
    bottom: 1,
  })).toThrow(/finite, nonnegative insets/i)
})

test('frame proposals cap at fixed neighbors without moving neighbor geometry @pure', () => {
  const proposal = {
    id: 'a',
    anchor: { x: 0, y: 0 },
    envelope: { x: -60, y: -40, width: 120, height: 80 },
  }
  const fixed = {
    id: 'b',
    anchor: { x: 80, y: 0 },
    envelope: { x: 20, y: -50, width: 100, height: 100 },
  }

  expect(constrainContinuousSystemFrame(proposal, [fixed]))
    .toEqual({ x: -60, y: -40, width: 80, height: 80 })
  expect(fixed.envelope).toEqual({ x: 20, y: -50, width: 100, height: 100 })
})

test('Warden route ends attach to the preferred frame edge when no Jump Point is selected @pure', () => {
  const source = projectContinuousSystemGeometry({
    id: 'source',
    name: 'Source',
    anchor: { x: 0, y: 0 },
    objects: [],
    orbits: [],
  })
  const destination = projectContinuousSystemGeometry({
    id: 'destination',
    name: 'Destination',
    anchor: { x: 200, y: 0 },
    objects: [],
    orbits: [],
  })
  const route: JumpRoute = {
    id: 'route',
    jumpLevel: 1,
    fromSystemId: source.id,
    fromPointId: null,
    toSystemId: destination.id,
    toPointId: null,
    playerShared: false,
  }

  const geometries = buildContinuousWardenRouteGeometries({
    routes: [route],
    projections: [
      { ...source, preferredFrame: { x: -25, y: -15, width: 50, height: 30 } },
      { ...destination, preferredFrame: { x: 175, y: -15, width: 50, height: 30 } },
    ],
    detailSystemIds: new Set(),
  })

  expect(geometries.get(route.id)).toMatchObject({
    start: { x: 25, y: 0 },
    end: { x: 175, y: 0 },
  })
})

test('frame preferences validate, survive backup, and remap only with portable Cluster copies @pure', () => {
  const initial = createLocalWorkspace('Frame Cluster', 'Inner System')
  const first = initial.cluster.systems[0]!
  const withNeighbor = addStarSystem(initial, 'Outer System')
  const source = setWorkspaceSystemFrame(withNeighbor.workspace, first.id, {
    left: 42,
    top: 35,
    right: 90,
    bottom: 64,
  })
  expect(workspaceSystemFrame(source, 'constructor')).toBeUndefined()
  expect(workspaceSystemFrame(source, first.id)).toEqual(source.layout.systemFrames?.[first.id])
  const secondPreference = setWorkspaceSystemFrame(source, withNeighbor.system.id, {
    left: 25,
    top: 20,
    right: 55,
    bottom: 40,
  })
  const backup = exportJumpCluster(secondPreference)

  expect(isLocalWorkspace(secondPreference)).toBe(true)
  expect(restoreLocalWorkspace(secondPreference)?.layout.systemFrames).toEqual(secondPreference.layout.systemFrames)
  expect(restoreJumpClusterBackup(backup).layout.systemFrames).toEqual(secondPreference.layout.systemFrames)

  const imported = prepareJsonImport(initial, backup)
  expect(imported.workspace.layout.systemFrames?.[imported.addedSystemIds[0]!])
    .toEqual(secondPreference.layout.systemFrames?.[first.id])
  expect(imported.workspace.layout.systemFrames?.[imported.addedSystemIds[1]!])
    .toEqual(secondPreference.layout.systemFrames?.[withNeighbor.system.id])

  const deletion = planMapEntityDeletion(secondPreference, { kind: 'system', systemId: withNeighbor.system.id })
  expect(deletion.workspace.layout.systemFrames).toEqual({
    [first.id]: secondPreference.layout.systemFrames?.[first.id],
  })

  const standalone = exportStarSystem(secondPreference, first.id)
  expect(standalone.layout).not.toHaveProperty('systemFrames')

  const malformed = {
    ...backup,
    layout: {
      ...backup.layout,
      systemFrames: { [first.id]: { left: -1, top: 35, right: 90, bottom: 64 } },
    },
  }
  const degenerate = {
    ...backup,
    layout: {
      ...backup.layout,
      systemFrames: { [first.id]: { left: 0, top: 0, right: 0, bottom: 0 } },
    },
  }
  const overflowing = {
    ...backup,
    layout: {
      ...backup.layout,
      systemFrames: {
        [first.id]: { left: Number.MAX_VALUE, top: 1, right: Number.MAX_VALUE, bottom: 1 },
      },
    },
  }
  const outOfBounds = {
    ...backup,
    layout: {
      ...backup.layout,
      systemFrames: { [first.id]: { left: 50_000_000, top: 1, right: 1, bottom: 1 } },
    },
  }
  const unknownSystem = {
    ...backup,
    layout: {
      ...backup.layout,
      systemFrames: { unknown: { left: 1, top: 1, right: 1, bottom: 1 } },
    },
  }
  for (const rejected of [malformed, degenerate, overflowing, outOfBounds, unknownSystem]) {
    expect(restoreLocalWorkspace({
      ...secondPreference,
      layout: { ...secondPreference.layout, systemFrames: rejected.layout.systemFrames },
    })).toBeNull()
    expect(() => restoreJumpClusterBackup(rejected)).toThrow(/valid version/i)
  }
  expect(() => setWorkspaceSystemFrame(source, 'missing', { left: 1, top: 1, right: 1, bottom: 1 }))
    .toThrow(/no longer exists/i)
  expect(() => setWorkspaceSystemFrame(source, first.id, { left: Number.NaN, top: 1, right: 1, bottom: 1 }))
    .toThrow(/finite/i)
})
