import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, ref } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useWardenMapFilters } from '../composables/useWardenMapFilters'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

test.beforeEach(() => {
  setActivePinia(createPinia())
})

test('Field filter choices revalidate after real Apply, Undo, and Redo history traversal @pure', async () => {
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
  store.setSelectedMapFieldConditions([{
    fieldId: 'field-condition',
    type: 'single-select',
    operator: 'is',
    values: ['Known', 'Damaged'],
  }])
  const scope = effectScope()
  const filters = scope.run(() => useWardenMapFilters({
    workspace,
    selectedSystem: computed(() => workspace.value?.cluster.systems[0]),
  }))
  if (!filters) throw new Error('Warden filter session was not created.')

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
  await nextTick()
  expect(store.selectedMapFieldConditions).toEqual([
    { fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'] },
  ])
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')
  expect(filters.invalidationNotice.value).toContain('Fields or choices changed')

  const undo = await history.undo()
  expect(undo.status).toBe('applied')
  await nextTick()
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.options).toEqual(['Known', 'Damaged'])
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Condition (Custom)')
  expect(store.selectedMapFieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })

  const redo = await history.redo()
  expect(redo.status).toBe('applied')
  await nextTick()
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.options).toEqual(['Known'])
  expect(filters.fieldOptions.value.find(option => option.fieldId === 'field-condition')?.label).toBe('Object state (Custom)')
  expect(store.selectedMapFieldConditions[0]).toEqual({
    fieldId: 'field-condition', type: 'single-select', operator: 'is', values: ['Known'],
  })

  scope.stop()
  history.dispose()
})
