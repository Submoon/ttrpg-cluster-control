import { expect, test } from '@playwright/test'
import { ref } from 'vue'
import {
  createLocalWorkspace,
  createOrbit,
  replaceWorkspaceSystem,
  type LocalWorkspace,
} from '../domain/workspace'
import { useEntityInspectorSession } from '../composables/editor-workflows/useEntityInspectorSession'
import { createWorkspaceMutationExecutor } from '../composables/editor-workflows/workspace-mutations'

test('applying a previewed free Orbit host change completes the same Inspector session @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]!
  const host = system.objects[0]!
  const orbit = createOrbit(system, null)
  const systemWithOrbit = { ...system, orbits: [...system.orbits, orbit] }
  const workspace = ref<LocalWorkspace | null>(replaceWorkspaceSystem(initial, systemWithOrbit))
  let revision = 0
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = next
      revision += 1
      return { durable: Promise.resolve() }
    },
  })
  const entity = useEntityInspectorSession({ workspace, mutations })

  entity.beginOrbitSession(initial.cluster.id, system.id, orbit.id)
  const sessionId = entity.entitySession.value?.id
  expect(sessionId).toBeDefined()
  expect(entity.updateOrbitHost(sessionId!, host.id)).toBe(true)
  expect(entity.previewOrbitPlacement(sessionId!)).toBe(true)
  expect(entity.orbitPlacementPreview.value?.hostId).toBe(host.id)

  const applied = await entity.applyEntitySession(sessionId)

  expect(workspace.value?.cluster.systems[0]?.orbits[0]?.hostId).toBe(host.id)
  expect(applied).toBe(true)
  expect(entity.entitySession.value).toBeNull()
})
