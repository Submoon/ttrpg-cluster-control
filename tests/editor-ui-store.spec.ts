import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import type { MapVisitMemory } from '../composables/editor-workflows/types'
import { useEditorUiStore } from '../stores/editor-ui'

test.beforeEach(() => {
  setActivePinia(createPinia())
})

test('accepted selections and map mode retain their distinct navigation meanings @pure', () => {
  const store = useEditorUiStore()

  store.setSelection({
    activeView: 'cluster',
    selectedSystemId: 'active-system',
    clusterSelectedSystemId: 'inspected-system',
    inspectedClusterSystemId: 'inspected-system',
    selectedObjectId: 'object-a',
    selectedOrbitId: 'orbit-a',
    selectedRouteId: 'route-a',
  })
  store.setMode('move')

  expect({
    activeView: store.activeView,
    selectedSystemId: store.selectedSystemId,
    clusterSelectedSystemId: store.clusterSelectedSystemId,
    inspectedClusterSystemId: store.inspectedClusterSystemId,
    selectedObjectId: store.selectedObjectId,
    selectedOrbitId: store.selectedOrbitId,
    selectedRouteId: store.selectedRouteId,
    mapMode: store.mapMode,
  }).toEqual({
    activeView: 'cluster',
    selectedSystemId: 'active-system',
    clusterSelectedSystemId: 'inspected-system',
    inspectedClusterSystemId: 'inspected-system',
    selectedObjectId: 'object-a',
    selectedOrbitId: 'orbit-a',
    selectedRouteId: 'route-a',
    mapMode: 'move',
  })
})

test('panel actions preserve independent visibility and compact intent @pure', () => {
  const store = useEditorUiStore()

  store.requestPanel('hierarchy')
  store.requestPanel('inspector')
  store.setCompactPanel('hierarchy')

  expect(store.hierarchyPanelOpen).toBe(true)
  expect(store.inspectorPanelOpen).toBe(true)
  expect(store.lastRequestedPanel).toBe('inspector')
  expect(store.compactPanel).toBe('hierarchy')

  store.closePanel('hierarchy')
  expect(store.hierarchyPanelOpen).toBe(false)
  expect(store.inspectorPanelOpen).toBe(true)
  expect(store.compactPanel).toBeNull()
})

test('visit pruning normalizes saved selections and reset starts a fresh workspace lifetime @pure', () => {
  const store = useEditorUiStore()
  const clusterVisit: MapVisitMemory = {
    viewport: { x: 120, y: -35, k: 1.7 },
    selection: { kind: 'system', id: 'removed-system', inspect: true },
  }
  const systemVisit: MapVisitMemory = {
    viewport: { x: 0, y: 0, k: 1 },
    selection: { kind: 'object', id: 'object-a' },
  }

  store.rememberVisit('cluster:cluster-a', clusterVisit)
  store.rememberVisit('system:cluster-a:system-a', systemVisit)
  store.pruneVisits(['cluster:cluster-a'], (_key, selection) =>
    selection.kind === 'system' ? { kind: 'none' } : selection,
  )

  expect(store.visits).toEqual({
    'cluster:cluster-a': {
      ...clusterVisit,
      selection: { kind: 'none' },
    },
  })

  store.setSelection({ activeView: 'cluster', selectedSystemId: 'system-a' })
  store.setMode('move')
  store.requestPanel('hierarchy')
  store.reset('workspace-b:cluster-b')

  expect(store.workspaceId).toBe('workspace-b:cluster-b')
  expect(store.activeView).toBe('system')
  expect(store.selectedSystemId).toBeNull()
  expect(store.mapMode).toBe('select')
  expect(store.hierarchyPanelOpen).toBe(false)
  expect(store.inspectorPanelOpen).toBe(true)
  expect(store.visits).toEqual({})
})

test('map visits retain a bounded recent history while protecting the active key @pure', () => {
  const store = useEditorUiStore()
  const visit: MapVisitMemory = { viewport: { x: 0, y: 0, k: 1 }, selection: { kind: 'none' } }
  for (let index = 0; index < 25; index += 1) {
    store.rememberVisit(`system:cluster-a:system-${index}`, visit, 'system:cluster-a:system-0')
  }

  expect(Object.keys(store.visits)).toHaveLength(24)
  expect(store.visits['system:cluster-a:system-0']).toEqual(visit)
  expect(store.visits['system:cluster-a:system-1']).toBeUndefined()
})

test('separate Pinia instances keep workspace selections and visits isolated @pure', () => {
  const first = useEditorUiStore(createPinia())
  const second = useEditorUiStore(createPinia())
  const firstVisit: MapVisitMemory = { viewport: { x: 4, y: 8, k: 1.2 }, selection: { kind: 'object', id: 'object-a' } }
  const secondVisit: MapVisitMemory = { viewport: { x: -7, y: 3, k: 0.9 }, selection: { kind: 'orbit', id: 'orbit-b' } }

  first.setSelection({ selectedSystemId: 'system-a' })
  first.rememberVisit('system:cluster-a:system-a', firstVisit)
  second.setSelection({ selectedSystemId: 'system-b' })
  second.rememberVisit('system:cluster-b:system-b', secondVisit)

  first.reset('workspace-a:cluster-a')

  expect(first.selectedSystemId).toBeNull()
  expect(first.visits).toEqual({})
  expect(first.workspaceId).toBe('workspace-a:cluster-a')
  expect(second.selectedSystemId).toBe('system-b')
  expect(second.visits).toEqual({ 'system:cluster-b:system-b': secondVisit })
  expect(second.workspaceId).toBeNull()
})
