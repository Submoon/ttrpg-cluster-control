import { expect, test } from '@playwright/test'
import { createLocalWorkspace, updateWorkspaceObject } from '../domain/workspace'
import { objectDraftValuesFor } from '../composables/editor-workflows/entity-draft-values'
import { validateObjectDraft } from '../composables/editor-workflows/entity-draft-validation'

test('draft projection includes current custom definitions and retained orphan values @pure', () => {
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
    customFieldValues: {
      'known-field': '4',
      'empty-field': '',
      'retained-field': 'legacy value',
    },
  })
  expect(values).not.toHaveProperty('x')
  expect(values).not.toHaveProperty('y')
})

test('applying an object draft keeps a separately committed free-map position @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const initial = objectDraftValuesFor(object, workspace.objectFieldSettings)
  const movedWorkspace = updateWorkspaceObject(workspace, system.id, object.id, {
    placement: { kind: 'system', x: 0.83, y: 0.71 },
  })
  const movedSystem = movedWorkspace.cluster.systems[0]!
  const movedObject = movedSystem.objects[0]!
  const draft = { ...initial, name: 'Vesper Prime' }

  const valid = validateObjectDraft(movedWorkspace, movedSystem, movedObject, initial, draft)
  const updatedObject = valid.workspace?.cluster.systems[0]?.objects[0]
  expect(valid.errors).toEqual({})
  expect(updatedObject?.name).toBe('Vesper Prime')
  expect(updatedObject?.placement).toEqual({ kind: 'system', x: 0.83, y: 0.71 })
  expect(workspace.cluster.systems[0]?.objects[0]?.name).toBe(object.name)

  const invalidDraft = { ...initial, placement: '' }
  const invalid = validateObjectDraft(workspace, system, object, initial, invalidDraft)
  expect(invalid.workspace).toBeNull()
  expect(invalid.errors.placement).toBe('Choose a valid map placement.')
})
