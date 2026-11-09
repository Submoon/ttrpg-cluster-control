import { expect, test } from '@playwright/test'
import { createLocalWorkspace } from '../domain/workspace'

import { searchWorkspace, type WorkspaceSearchCriteria } from '../utils/workspace-search'
import { mapObjectTypeKey } from '../utils/map-type-filters'

test('workspace search trims and normalizes a literal query, then ranks exact, prefix, and substring matches @pure', () => {
  const workspace = createLocalWorkspace('Café Nebula', 'Alpha Cafe')
  const firstSystem = workspace.cluster.systems[0]
  if (!firstSystem) throw new Error('The local workspace did not create its first system.')
  workspace.cluster.systems.push(
    { ...firstSystem, id: 'system-prefix', name: 'Cafe Station' },
    { ...firstSystem, id: 'system-exact', name: 'Cafe' },
  )

  const results = searchWorkspace(workspace, '  CAFÉ  ')

  expect(results.map(result => result.name)).toEqual([
    'Cafe',
    'Café Nebula',
    'Cafe Station',
    'Alpha Cafe',
  ])
  expect(results[0]?.target).toEqual({
    workspaceId: workspace.id,
    clusterId: workspace.cluster.id,
    kind: 'system',
    systemId: 'system-exact',
  })
})
test('workspace search treats punctuation literally and leaves blank or unmatched queries empty @pure', () => {
  const workspace = createLocalWorkspace('The . Cluster', 'A?B')
  const firstSystem = workspace.cluster.systems[0]
  if (!firstSystem) throw new Error('The local workspace did not create its first system.')
  workspace.cluster.systems.push({ ...firstSystem, id: 'punctuation', name: 'A.B' })

  expect(searchWorkspace(workspace, '.').map(result => result.name)).toEqual(['A.B', 'The . Cluster'])
  expect(searchWorkspace(workspace, '   ')).toEqual([])
  expect(searchWorkspace(workspace, 'missing')).toEqual([])
})

test('duplicate names remain distinct and receive deterministic result-only occurrence numbers @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const firstSystem = workspace.cluster.systems[0]
  if (!firstSystem) throw new Error('The local workspace did not create its first system.')
  firstSystem.id = 'system-c'
  workspace.cluster.systems.push(
    { ...firstSystem, id: 'system-b', name: 'Vesper' },
    { ...firstSystem, id: 'system-a', name: 'Vesper' },
  )

  const results = searchWorkspace(workspace, 'ves')

  expect(results.map(result => result.target.kind === 'system' ? result.target.systemId : '')).toEqual([
    'system-a',
    'system-b',
    firstSystem.id,
  ])
  expect(results.map(result => result.occurrence)).toEqual([1, 2, 3])
  expect(new Set(results.map(result => result.key)).size).toBe(3)
})

test('workspace search finds objects by name and Location key in unopened systems @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const firstSystem = workspace.cluster.systems[0]
  const template = firstSystem?.objects[0]
  if (!firstSystem || !template) throw new Error('The local workspace did not create its first system object.')
  const remoteObject = { ...template, id: 'remote-beacon', name: 'Distant Beacon', locationKey: 'FAR-09' }
  const remoteSystem = {
    ...firstSystem,
    id: 'unopened-harrow',
    name: 'Harrow',
    objects: [remoteObject],
  }
  workspace.cluster.systems.push(remoteSystem)

  const nameResult = searchWorkspace(workspace, 'distant')
  const keyResult = searchWorkspace(workspace, 'far-09')

  expect(nameResult.map(result => result.target)).toEqual([{
    workspaceId: workspace.id,
    clusterId: workspace.cluster.id,
    kind: 'object',
    systemId: remoteSystem.id,
    objectId: remoteObject.id,
  }])
  expect(keyResult.map(result => result.target)).toEqual(nameResult.map(result => result.target))
  expect(nameResult[0]).toMatchObject({ name: 'Distant Beacon', contextLabel: 'Star System: Harrow' })
})



test('object matches are ranked once by their strongest name or Location key match @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const firstObject = system?.objects[0]
  if (!system || !firstObject) throw new Error('The local workspace did not create its first system object.')
  firstObject.name = 'Far Echo'
  firstObject.locationKey = 'ECHO'
  const exactNameObject = { ...firstObject, id: 'object-exact-name', name: 'Echo', locationKey: 'ECH-02' }
  const substringObject = { ...firstObject, id: 'object-substring-name', name: 'The Echo', locationKey: 'OTHER' }
  system.objects.push(exactNameObject, substringObject)

  const results = searchWorkspace(workspace, 'echo')
  const objects = results.filter(result => result.target.kind === 'object')

  expect(objects.map(result => result.name)).toEqual(['Echo', 'Far Echo', 'The Echo'])
  expect(objects.filter(result => result.target.kind === 'object' && result.target.objectId === exactNameObject.id)).toHaveLength(1)
})

test('criteria-only workspace search returns matching objects grouped by system and sorted by name with stable duplicate ties @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const firstSystem = workspace.cluster.systems[0]
  const template = firstSystem?.objects[0]
  if (!firstSystem || !template) throw new Error('The local workspace did not create its first system object.')
  const relayType = { family: 'Other' as const, subtype: 'relay' }
  const relay = (id: string, name: string) => ({
    ...template,
    id,
    name,
    family: relayType.family,
    subtype: relayType.subtype,
  })
  firstSystem.objects = [relay('vesper-relay', 'Beacon')]
  workspace.cluster.systems.push({
    ...firstSystem,
    id: 'system-altair',
    name: 'Altair',
    objects: [relay('relay-z', 'Beacon'), relay('relay-a', 'Beacon'), relay('relay-signal', 'Signal')],
  })

  const results = searchWorkspace(workspace, '   ', {
    types: [mapObjectTypeKey(relayType)],
    publicationModes: [],
    fieldConditions: [],
  })

  expect(results.map(result => [result.contextLabel, result.name, result.target.kind === 'object' ? result.target.objectId : null])).toEqual([
    ['Star System: Altair', 'Beacon', 'relay-a'],
    ['Star System: Altair', 'Beacon', 'relay-z'],
    ['Star System: Altair', 'Signal', 'relay-signal'],
    ['Star System: Vesper', 'Beacon', 'vesper-relay'],
  ])
})

test('text and criteria combine with AND while text ranking and duplicate occurrences are assigned before criteria filtering @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const template = system?.objects[0]
  if (!system || !template) throw new Error('The local workspace did not create its first system object.')
  workspace.objectFieldSettings.customFields = [{
    id: 'field-alert',
    name: 'Signal',
    playerShared: false,
    type: 'text',
  }]
  const beacon = (id: string, family: 'Other' | 'CelestialBody', subtype: string, value: string) => ({
    ...template,
    id,
    name: 'Beacon',
    family,
    subtype,
    publication: 'revealed' as const,
    locationKey: 'B-01',
    customFieldValues: { 'field-alert': value },
  })
  system.objects = [
    beacon('object-a', 'Other', 'relay', 'quiet'),
    beacon('object-z', 'Other', 'relay', 'alert'),
    beacon('object-planet', 'CelestialBody', 'planet', 'alert'),
  ]

  const criteria = {
    types: [mapObjectTypeKey({ family: 'Other', subtype: 'relay' })],
    publicationModes: ['revealed'],
    fieldConditions: [{ fieldId: 'field-alert', type: 'text', operator: 'contains', value: 'alert' }],
  } satisfies WorkspaceSearchCriteria
  const results = searchWorkspace(workspace, 'beacon', criteria)
  const criteriaOnlyResults = searchWorkspace(workspace, '', criteria)

  expect(results.map(result => result.target.kind === 'object' ? result.target.objectId : null)).toEqual(['object-z'])
  expect(results[0]?.occurrence).toBe(2)
  expect(criteriaOnlyResults.map(result => result.target.kind === 'object' ? result.target.objectId : null)).toEqual(['object-z'])
  expect(criteriaOnlyResults[0]?.occurrence).toBe(2)
})
