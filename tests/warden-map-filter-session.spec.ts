import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { createLocalWorkspace, createSystemObject, type LocalWorkspace } from '../domain/workspace'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useWardenFilterCriteria } from '../composables/useWardenFilterCriteria'
import { useEditorUiStore } from '../stores/editor-ui'
import type { FieldCondition } from '../utils/field-filter-matching'
import { mapObjectTypeKey } from '../utils/map-type-filters'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

test.beforeEach(() => {
  setActivePinia(createPinia())
})

test('map and Search Field choices revalidate across real Apply, Undo, and Redo without resurrection @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  initial.objectFieldSettings.customFields.push({
    id: 'field-condition',
    name: 'Condition',
    playerShared: false,
    type: 'single-select',
    options: ['Known', 'Damaged'],
  })
  const workspace = ref<LocalWorkspace | null>(createWorkspaceSnapshot(initial))
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => true,
  })
  const store = useEditorUiStore()
  const initialCondition: FieldCondition = {
    fieldId: 'field-condition',
    type: 'single-select',
    operator: 'is',
    values: ['Known', 'Damaged'],
  }
  const scope = effectScope()
  const filters = scope.run(() => useWardenFilterCriteria({
    workspace,
    store,
  }))
  if (!filters) throw new Error('Warden Field filter criteria were not created.')
  const map = filters.map
  const search = filters.search
  map.setFieldConditions([initialCondition])
  search.setFieldConditions([initialCondition])
  expect(map.criteria.value.fieldConditions).toEqual([initialCondition])
  expect(search.criteria.value.fieldConditions).toEqual([initialCondition])

  const apply = await history.execute({
    action: { kind: 'update', label: 'Rename Condition and change choices', target: { kind: 'field', id: 'field-condition' } },
    prepare: current => ({
      ...current,
      objectFieldSettings: {
        ...current.objectFieldSettings,
        customFields: current.objectFieldSettings.customFields.map(field => field.id === 'field-condition'
          ? { ...field, name: 'Object state', options: ['Known'] }
          : field),
      },
    }),
  })
  expect(apply.status).toBe('applied')
  expect(search.criteria.value.fieldConditions).toEqual([{
    ...initialCondition,
    values: ['Known'],
  }])
  expect(search.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

  await nextTick()
  expect(map.criteria.value.fieldConditions).toEqual([
    { fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'] },
  ])
  expect(search.criteria.value.fieldConditions).toEqual(map.criteria.value.fieldConditions)
  expect(map.invalidationNotice.value).toContain('Fields or choices changed')
  expect(search.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')

  // Map rejects an invalid Field edit and retains its notice. Search normalizes the edit and reports it again.
  map.setFieldConditions([initialCondition])
  expect(map.criteria.value.fieldConditions).toEqual([{
    ...initialCondition,
    values: ['Known'],
  }])
  expect(map.invalidationNotice.value).toContain('Fields or choices changed')
  search.setFieldConditions([initialCondition])
  expect(search.criteria.value.fieldConditions).toEqual([{
    ...initialCondition,
    values: ['Known'],
  }])
  expect(search.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

  // A valid explicit Search edit clears its notice; an ordinary map Field edit keeps the map notice.
  search.setFieldConditions(map.criteria.value.fieldConditions)
  map.setFieldConditions(map.criteria.value.fieldConditions)
  expect(search.invalidationNotice.value).toBeNull()
  expect(map.invalidationNotice.value).toContain('Fields or choices changed')

  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')

  const undo = await history.undo()
  expect(undo.status).toBe('applied')
  await nextTick()
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.options).toEqual(['Known', 'Damaged'])
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Condition (Custom)')
  expect(map.criteria.value.fieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })
  expect(search.criteria.value.fieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })

  const redo = await history.redo()
  expect(redo.status).toBe('applied')
  await nextTick()
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.options).toEqual(['Known'])
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')
  expect(map.criteria.value.fieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })
  expect(search.criteria.value.fieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })

  map.clearAll()
  expect(map.criteria.value.fieldConditions).toEqual([])
  expect(map.invalidationNotice.value).toBeNull()
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')

  scope.stop()
  history.dispose()
})

test('custom Other type choices stay removable independently in map filters and Search @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]
  if (!system) throw new Error('The local workspace did not create its first system.')
  system.objects.push({
    ...createSystemObject(system, 'other'),
    subtype: 'Relay',
    name: 'Relay station',
  })
  const workspace = ref<LocalWorkspace | null>(createWorkspaceSnapshot(initial))
  const store = useEditorUiStore()
  const scope = effectScope()
  const filters = scope.run(() => useWardenFilterCriteria({ workspace, store }))
  if (!filters) throw new Error('Warden Field filter criteria were not created.')

  const relayType = mapObjectTypeKey({ family: 'Other', subtype: 'Relay' })
  const staleLabel = [{ value: relayType, label: 'Cached relay label' }]
  store.setSelectedMapObjectTypes([relayType], staleLabel)
  store.setSelectedSearchObjectTypes([relayType], staleLabel)
  expect(filters.map.typeOptions.value.find(option => option.value === relayType)?.label).toBe('Relay (Other)')
  expect(filters.search.typeOptions.value.find(option => option.value === relayType)?.label).toBe('Relay (Other)')
  filters.map.setTypes([relayType])
  filters.search.setTypes([relayType])

  const withoutRelay = createWorkspaceSnapshot(workspace.value!)
  const currentSystem = withoutRelay.cluster.systems[0]
  if (!currentSystem) throw new Error('The local workspace lost its first system.')
  const relay = currentSystem.objects.find(object => object.family === 'Other' && object.subtype === 'Relay')
  if (!relay) throw new Error('The workspace lost its custom Relay object.')
  currentSystem.objects = currentSystem.objects.filter(object => object.id !== relay.id)
  workspace.value = withoutRelay
  await nextTick()

  expect(filters.map.typeOptions.value.find(option => option.value === relayType)?.label).toBe('Relay (Other)')
  expect(filters.search.typeOptions.value.find(option => option.value === relayType)?.label).toBe('Relay (Other)')
  filters.map.clearAll()
  expect(filters.map.criteria.value.types).toEqual([])
  expect(filters.search.criteria.value.types).toEqual([relayType])
  expect(filters.search.typeOptions.value.find(option => option.value === relayType)?.label).toBe('Relay (Other)')
  expect(store.mapTypeFilterOptionLabels[relayType]).toBe('Relay (Other)')

  filters.search.clearAll()
  expect(filters.search.criteria.value.types).toEqual([])
  expect(filters.map.activeCriterionCount.value).toBe(0)
  expect(filters.search.activeCriterionCount.value).toBe(0)

  scope.stop()
})
