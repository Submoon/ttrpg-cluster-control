import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import type { MapVisitMemory } from '../composables/editor-workflows/types'
import { useEditorUiStore } from '../stores/editor-ui'

test.beforeEach(() => {
  setActivePinia(createPinia())
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
