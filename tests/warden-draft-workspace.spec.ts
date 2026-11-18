import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  type LocalWorkspace,
} from '../domain/workspace'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import type { SaveState } from '../composables/editor-workflows/types'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { mountController, withControlledBrowserEnvironment } from './support/mounted-controller'

function mountWorkflows(initialWorkspace: LocalWorkspace) {
  setActivePinia(createPinia())
  const workspace = ref<LocalWorkspace | null>(initialWorkspace)
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = next
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const owner = mountController(() => useEditorWorkflows({
    workspace,
    mutations: history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  return {
    workspace,
    workflows: owner.value,
    store: useEditorUiStore(),
    dispose() {
      owner.unmount()
      history.dispose()
    },
  }
}

test('Warden draft workspace previews valid object fields and keeps invalid values applied @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
    const system = initial.cluster.systems[0]!
    const object = system.objects[0]!
    const harness = mountWorkflows(initial)
    try {
      harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: object.id })
      await harness.workflows.inspector.beginObjectEdit()
      const session = harness.workflows.inspector.entitySession.value
      if (!session || session.kind !== 'object') throw new Error('The object edit session did not start.')

      session.draft.name = 'Vesper Prime'
      session.draft.description = 'Draft Warden notes'
      session.draft.publication = 'revealed'
      session.draft.placement = ''
      session.draft.markerColor = '#123ab'

      const projected = harness.workflows.wardenDraftWorkspace.value
      const projectedObject = projected?.cluster.systems[0]?.objects[0]
      expect(projectedObject?.name).toBe('Vesper Prime')
      expect(projectedObject?.description).toBe('Draft Warden notes')
      expect(projectedObject?.publication).toBe('revealed')
      expect(projectedObject?.placement).toEqual(object.placement)
      expect(projectedObject?.markerColor).toBe(object.markerColor)
      expect(harness.workspace.value?.cluster.systems[0]?.objects[0]).toEqual(object)

      session.draft.name = '  '
      session.draft.description = ''
      session.draft.publication = object.publication
      session.draft.placement = ''
      session.draft.markerColor = '#123ab'
      expect(harness.workflows.wardenDraftWorkspace.value).toBeNull()
    } finally {
      harness.dispose()
    }
  })
})

test('Warden chart draft preview uses its captured system and preserves invalid fields @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
    const { workspace: withSecond } = addStarSystem(initial, 'Harrow')
    const first = withSecond.cluster.systems[0]!
    const second = withSecond.cluster.systems[1]!
    const harness = mountWorkflows(withSecond)
    try {
      harness.store.setSelection({ activeView: 'system', selectedSystemId: first.id })
      await harness.workflows.charts.beginNamesEdit(first.id)
      harness.workflows.charts.clusterName.value = 'Kestrel Reach Draft'
      harness.workflows.charts.systemName.value = ''
      harness.workflows.charts.playerTitle.value = 'The Lantern Atlas'
      harness.workflows.charts.publication.value = 'revealed'
      harness.store.setSelection({ activeView: 'system', selectedSystemId: second.id })

      const projected = harness.workflows.wardenDraftWorkspace.value
      expect(projected?.cluster.name).toBe('Kestrel Reach Draft')
      expect(projected?.cluster.playerTitle).toBe('The Lantern Atlas')
      expect(projected?.cluster.systems.find(system => system.id === first.id)).toMatchObject({
        name: first.name,
        publication: 'revealed',
      })
      expect(projected?.cluster.systems.find(system => system.id === second.id)).toEqual(second)
      expect(harness.workspace.value).toEqual(withSecond)
    } finally {
      harness.dispose()
    }
  })
})

test('Warden route draft keeps endpoints coherent when an incomplete destination falls back @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
    const { workspace: withSecond } = addStarSystem(initial, 'Harrow')
    const baseSystem = withSecond.cluster.systems[0]!
    const destination = withSecond.cluster.systems[1]!
    const originPoint = createSystemObject(baseSystem, 'jump-point')
    const systemWithOrigin = { ...baseSystem, objects: [...baseSystem.objects, originPoint] }
    const otherOrigin = createSystemObject(systemWithOrigin, 'jump-point')
    const destinationPoint = createSystemObject(destination, 'jump-point')
    const routeCluster = {
      ...withSecond.cluster,
      systems: [
        { ...systemWithOrigin, objects: [...systemWithOrigin.objects, otherOrigin] },
        { ...destination, objects: [...destination.objects, destinationPoint] },
      ],
    }
    const routeWorkspace: LocalWorkspace = {
      ...withSecond,
      cluster: {
        ...routeCluster,
        routes: [createJumpRoute(routeCluster, {
          jumpLevel: 1,
          fromSystemId: baseSystem.id,
          fromPointId: originPoint.id,
          toSystemId: destination.id,
          toPointId: destinationPoint.id,
        })],
      },
    }
    const route = routeWorkspace.cluster.routes[0]!
    const harness = mountWorkflows(routeWorkspace)
    try {
      harness.store.setSelection({ activeView: 'cluster', selectedRouteId: route.id })
      await harness.workflows.cluster.beginRouteEdit(route.id)
      const session = harness.workflows.inspector.routeSession.value
      if (!session || session.routeId !== route.id) throw new Error('The existing route edit session did not start.')

      session.draft.jumpLevel = '0'
      session.draft.fromPointId = otherOrigin.id
      session.draft.destination = 'system'
      session.draft.toSystemId = ''
      session.draft.toPointId = ''
      session.draft.playerShared = true

      const projectedRoute = harness.workflows.wardenDraftWorkspace.value?.cluster.routes.find(item => item.id === route.id)
      expect(projectedRoute).toMatchObject({
        jumpLevel: route.jumpLevel,
        fromSystemId: baseSystem.id,
        fromPointId: otherOrigin.id,
        toSystemId: destination.id,
        toPointId: destinationPoint.id,
        playerShared: true,
      })
      expect(harness.workspace.value?.cluster.routes[0]).toEqual(route)
    } finally {
      harness.dispose()
    }
  })
})

test('Warden Orbit preview moves a selected host immediately and protects its provisional geometry @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
    const baseSystem = initial.cluster.systems[0]!
    const host = baseSystem.objects[0]!
    const freeObject = createSystemObject(baseSystem, 'planet')
    const orbit = createOrbit(baseSystem, null)
    const system = { ...baseSystem, objects: [...baseSystem.objects, freeObject], orbits: [...baseSystem.orbits, orbit] }
    const orbitWorkspace: LocalWorkspace = {
      ...initial,
      cluster: { ...initial.cluster, systems: [system] },
      layout: {
        ...initial.layout,
        orbitRadii: { ...initial.layout.orbitRadii, [orbit.id]: { horizontal: 16, vertical: 38 } },
      },
    }
    const harness = mountWorkflows(orbitWorkspace)
    try {
      harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedOrbitId: orbit.id })
      await harness.workflows.inspector.beginOrbitEdit()
      const session = harness.workflows.inspector.entitySession.value
      if (!session || session.kind !== 'orbit') throw new Error('The Orbit edit session did not start.')
      expect(harness.workflows.inspector.updateOrbitHost(session.id, host.id)).toBe(true)
      session.draft.horizontalRadius = '16'
      session.draft.verticalRadius = '38'
      session.draft.rotation = '45'

      const projected = harness.workflows.wardenDraftWorkspace.value
      const projectedOrbit = projected?.cluster.systems[0]?.orbits.find(item => item.id === orbit.id)
      expect(projectedOrbit?.hostId).toBe(host.id)
      expect(projectedOrbit).not.toHaveProperty('center')
      expect(projected?.layout.orbitRadii[orbit.id]).toEqual({ horizontal: 39, vertical: 39 })
      expect(session.draft.horizontalRadius).toBe('16')
      expect(session.draft.verticalRadius).toBe('38')
      expect(projected?.layout.orbitRotations[orbit.id]).toBe(45)
      expect(harness.workspace.value?.cluster.systems[0]?.orbits.find(item => item.id === orbit.id)).toEqual(orbit)
      const wouldUseDraftRing = { kind: 'object-placement', objectId: freeObject.id, fromOrbitId: null, toOrbitId: orbit.id } as const
      expect(harness.workflows.inspector.isEntityCommandBlocked(wouldUseDraftRing)).toBe(true)
      expect(harness.workflows.inspector.isEntityCommandBlocked({ ...wouldUseDraftRing, toOrbitId: null })).toBe(false)
      expect(await harness.workflows.inspector.applyEntitySession(session.id)).toBe(false)
      expect(harness.workspace.value?.cluster.systems[0]?.orbits.find(item => item.id === orbit.id)).toEqual(orbit)
      harness.workflows.inspector.discardEntitySession(session.id)
      expect(harness.workflows.inspector.isEntityCommandBlocked(wouldUseDraftRing)).toBe(false)
    } finally {
      harness.dispose()
    }
  })
})
