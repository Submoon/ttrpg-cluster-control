import { expect, test } from '@playwright/test'
import { ref } from 'vue'
import { createLocalWorkspace, type LocalWorkspace, type SystemObject } from '../domain/workspace'
import { useSystemObjectTransferDraft } from '../composables/useSystemObjectTransferDraft'

function transferWorkspace(): { workspace: LocalWorkspace; sourceId: string; destinationId: string; rootId: string } {
  const base = createLocalWorkspace('Kestrel Reach', 'Source')
  const sourceBase = base.cluster.systems[0]!
  const root = sourceBase.objects[0]!
  const source = { ...sourceBase, objects: [{ ...root, locationKey: 'STAR-01', legacyLocationKey: { objectId: root.id, key: 'STAR-01' } }] }
  const destination = {
    ...source,
    id: 'destination',
    name: 'Destination',
    objects: [{
      ...root,
      id: 'destination-host',
      locationKey: 'STAR-01',
      legacyLocationKey: { objectId: 'destination-host', key: 'STAR-01' },
      name: 'Destination Star',
    }, {
      ...root,
      id: 'destination-occupant',
      family: 'CelestialBody',
      subtype: 'planet',
      locationKey: 'PL-01',
      name: 'Destination Planet',
      placement: { kind: 'orbit' as const, orbitId: 'destination-ring' },
    } satisfies SystemObject],
    orbits: [{ id: 'destination-ring', hostId: 'destination-host', order: 1 }],
  }
  return {
    workspace: {
      ...base,
      cluster: { ...base.cluster, systems: [source, destination] },
      layout: {
        ...base.layout,
        systemPositions: { [source.id]: { x: 0.3, y: 0.4 }, [destination.id]: { x: 0.7, y: 0.6 } },
        orbitRadii: { 'destination-ring': { horizontal: 90, vertical: 60 } },
        objectAngles: {},
      },
    },
    sourceId: source.id,
    destinationId: destination.id,
    rootId: root.id,
  }
}

test('transfer draft preserves a retained key in preview and acceptance @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const currentWorkspace = ref(workspace)
  const draft = useSystemObjectTransferDraft(() => currentWorkspace.value, sourceId, rootId)

  expect(draft.canAccept.value).toBe(false)
  draft.selectDestination(destinationId)
  expect(draft.review.value).toBeNull()
  expect(draft.status.value).toBe('choose-placement')
  draft.chooseOrbitPlacement('destination-ring', 1.3)

  expect(draft.review.value?.previewWorkspace.cluster.systems[0]!.objects.map(object => object.id))
    .not.toContain(rootId)
  expect(draft.canAccept.value).toBe(true)

  const accepted = draft.accept()
  expect(accepted.cluster.systems[1]!.objects.find(object => object.id === rootId)?.locationKey)
    .toBe('STAR-01')
  expect(currentWorkspace.value).toEqual(workspace)
})

test('changing destination clears old placement and cancellation leaves the source workspace untouched @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const destinationTwo = { ...workspace.cluster.systems[1]!, id: 'destination-two', name: 'Second Destination' }
  const currentWorkspace = ref({
    ...workspace,
    cluster: { ...workspace.cluster, systems: [...workspace.cluster.systems, destinationTwo] },
    layout: {
      ...workspace.layout,
      systemPositions: { ...workspace.layout.systemPositions, [destinationTwo.id]: { x: 0.9, y: 0.8 } },
    },
  })
  const draft = useSystemObjectTransferDraft(() => currentWorkspace.value, sourceId, rootId)

  draft.selectDestination(destinationId)
  draft.chooseOrbitPlacement('destination-ring', 0.5)
  expect(draft.review.value).not.toBeNull()
  draft.selectDestination(destinationTwo.id)
  expect(draft.placement.value).toBeNull()
  expect(draft.review.value).toBeNull()
  draft.chooseFreePlacement({ x: 0.6, y: 0.2 })
  expect(draft.review.value?.request.destinationSystemId).toBe(destinationTwo.id)

  draft.cancel()
  expect(draft.status.value).toBe('cancelled')
  expect(draft.review.value).toBeNull()
  expect(() => draft.accept()).toThrow()
  expect(currentWorkspace.value.cluster.systems[0]!.objects.map(object => object.id)).toContain(rootId)
})

test('a changed source object invalidates the draft without publishing its stale preview @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const currentWorkspace = ref(workspace)
  const draft = useSystemObjectTransferDraft(() => currentWorkspace.value, sourceId, rootId)
  draft.selectDestination(destinationId)
  draft.chooseFreePlacement({ x: 0.4, y: 0.3 })
  expect(draft.review.value).not.toBeNull()

  currentWorkspace.value = {
    ...currentWorkspace.value,
    cluster: {
      ...currentWorkspace.value.cluster,
      systems: currentWorkspace.value.cluster.systems.map(system => system.id === sourceId
        ? { ...system, objects: system.objects.filter(object => object.id !== rootId) }
        : system),
    },
  }
  expect(draft.review.value).toBeNull()
  expect(draft.error.value).toContain('no longer exists')
  expect(() => draft.accept()).toThrow()
  expect(currentWorkspace.value.cluster.systems[0]!.objects.map(object => object.id)).not.toContain(rootId)
})

test('a transfer review cannot detach a route attachment added after the displayed preview @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const source = workspace.cluster.systems[0]!
  source.objects = source.objects.map(object => object.id === rootId
    ? { ...object, family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-01' }
    : object)
  const currentWorkspace = ref(workspace)
  const draft = useSystemObjectTransferDraft(() => currentWorkspace.value, sourceId, rootId)
  draft.selectDestination(destinationId)
  draft.chooseFreePlacement({ x: 0.4, y: 0.3 })
  expect(draft.review.value?.detachedRouteAttachments).toEqual([])

  const attached = {
    id: 'late-route',
    jumpLevel: 2,
    fromSystemId: sourceId,
    fromPointId: rootId,
    toSystemId: destinationId,
    toPointId: null,
    playerShared: false,
  }
  currentWorkspace.value = {
    ...currentWorkspace.value,
    cluster: { ...currentWorkspace.value.cluster, routes: [attached] },
  }

  expect(draft.isStale.value).toBe(true)
  expect(draft.review.value?.detachedRouteAttachments).toEqual([
    { routeId: 'late-route', end: 'from', pointId: rootId },
  ])
  expect(() => draft.accept()).toThrow()
  expect(currentWorkspace.value.cluster.routes).toEqual([attached])
})

test('free transfer placement rejects a normalized coordinate that cannot project to the local map @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const draft = useSystemObjectTransferDraft(() => workspace, sourceId, rootId)
  draft.selectDestination(destinationId)
  draft.chooseFreePlacement({ x: Number.MAX_VALUE, y: 0.3 })

  expect(draft.canAccept.value).toBe(false)
  expect(() => draft.accept()).toThrow()
})

test('a caller cannot mutate the accepted placement through a returned request @pure', () => {
  const { workspace, sourceId, destinationId, rootId } = transferWorkspace()
  const draft = useSystemObjectTransferDraft(() => workspace, sourceId, rootId)
  draft.selectDestination(destinationId)
  draft.chooseFreePlacement({ x: 0.42, y: 0.3 })
  const exposedRequest = draft.request.value
  expect(exposedRequest).not.toBeNull()
  Reflect.set(exposedRequest!.placement, 'x', Number.MAX_VALUE)

  const accepted = draft.accept()
  expect(accepted.cluster.systems[1]!.objects.find(object => object.id === rootId)?.placement)
    .toEqual({ kind: 'system', x: 0.42, y: 0.3 })
})
