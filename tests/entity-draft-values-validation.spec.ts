import { expect, test } from '@playwright/test'
import { createLocalWorkspace } from '../domain/workspace'
import { objectDraftValuesFor } from '../composables/editor-workflows/entity-draft-values'
import { validateObjectDraft } from '../composables/editor-workflows/entity-draft-validation'

test('draft projection includes current custom definitions and retained orphan values', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const star = system.objects[0]!
  const object = {
    ...star,
    customFieldValues: {
      'known-field': 4,
      'retained-field': 'legacy value',
    },
  }
  const settings = {
    ...workspace.objectFieldSettings,
    customFields: [
      { id: 'known-field', name: 'Known value', type: 'number' as const },
      { id: 'empty-field', name: 'Empty value', type: 'text' as const },
    ],
  }

  const values = objectDraftValuesFor(object, settings)

  expect(values).toMatchObject({
    name: star.name,
    placement: 'system',
    x: '0.5',
    y: '0.5',
    customFieldValues: {
      'known-field': '4',
      'empty-field': '',
      'retained-field': 'legacy value',
    },
  })
})

test('draft validation applies valid values and rejects non-finite system coordinates without mutation', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const initial = objectDraftValuesFor(object, workspace.objectFieldSettings)
  const draft = { ...initial, name: 'Vesper Prime' }

  const valid = validateObjectDraft(workspace, system, object, initial, draft)
  const updatedObject = valid.workspace?.cluster.systems[0]?.objects[0]
  expect(valid.errors).toEqual({})
  expect(updatedObject?.name).toBe('Vesper Prime')
  expect(workspace.cluster.systems[0]?.objects[0]?.name).toBe(object.name)

  const invalidDraft = { ...initial, x: 'not finite' }
  const invalid = validateObjectDraft(workspace, system, object, initial, invalidDraft)
  expect(invalid.workspace).toBeNull()
  expect(invalid.errors.x).toBe('Schematic X must be a finite number.')
})
