import { createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import { expect, test } from '@playwright/test'
import { createLocalWorkspace, createSystemObject, updateWorkspaceObject } from '../domain/workspace'
import { objectDraftValuesFor } from '../composables/editor-workflows/entity-draft-values'
import { projectObjectDraft, validateObjectDraft } from '../composables/editor-workflows/entity-draft-validation'

test('draft projection includes current custom definitions and retained orphan values @pure', () => {
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
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
      { id: 'known-field', name: 'Known value', type: 'number' as const, playerShared: false },
      { id: 'empty-field', name: 'Empty value', type: 'text' as const, playerShared: false },
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
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
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

test('object draft applies a marker color and reset removes the override @pure', () => {
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const initial = objectDraftValuesFor(object, workspace.objectFieldSettings)
  const markerColor = '#aBcD09'

  const colored = validateObjectDraft(workspace, system, object, initial, { ...initial, markerColor })
  const coloredWorkspace = colored.workspace
  const coloredSystem = coloredWorkspace?.cluster.systems[0]
  const coloredObject = coloredSystem?.objects[0]
  expect(colored.errors).toEqual({})
  expect(coloredObject?.markerColor).toBe(markerColor)

  const coloredInitial = objectDraftValuesFor(coloredObject, workspace.objectFieldSettings)
  const reset = validateObjectDraft(
    coloredWorkspace!,
    coloredSystem!,
    coloredObject!,
    coloredInitial,
    { ...coloredInitial, markerColor: null },
  )
  expect(reset.errors).toEqual({})
  expect(reset.workspace?.cluster.systems[0]?.objects[0]).not.toHaveProperty('markerColor')

  const invalid = validateObjectDraft(workspace, system, object, initial, { ...initial, markerColor: '#123ab' })
  expect(invalid.workspace).toBeNull()
  expect(invalid.errors.markerColor).toBe('Choose a six-digit hexadecimal marker color.')
})

test('object draft preview clears an assigned native Field while other invalid fields fall back @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const baseSystem = base.cluster.systems[0]!
  const planet = createSystemObject(baseSystem, 'planet')
  const system = { ...baseSystem, objects: [...baseSystem.objects, planet] }
  const withPlanet = {
    ...base,
    cluster: { ...base.cluster, systems: [system] },
  }
  const assigned = updateWorkspaceObject(withPlanet, system.id, planet.id, { atmosphere: 'Breathable' })
  const assignedSystem = assigned.cluster.systems[0]!
  const assignedPlanet = assignedSystem.objects.find(object => object.id === planet.id)!
  const initial = objectDraftValuesFor(assignedPlanet, assigned.objectFieldSettings)
  const projected = projectObjectDraft(assigned, assignedSystem, assignedPlanet, initial, {
    ...initial,
    atmosphere: '',
    name: '  ',
    markerColor: '#123ab',
  })

  expect(projected?.cluster.systems[0]?.objects.find(object => object.id === planet.id)?.atmosphere).toBeUndefined()
  expect(projected?.cluster.systems[0]?.objects.find(object => object.id === planet.id)?.name).toBe(assignedPlanet.name)
  expect(projected?.cluster.systems[0]?.objects.find(object => object.id === planet.id)?.markerColor).toBe(assignedPlanet.markerColor)
  expect(assignedPlanet.atmosphere).toBe('Breathable')
})
