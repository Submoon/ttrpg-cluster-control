import { expect, test } from '@playwright/test'
import { catalogueTypes, createLocalWorkspace } from '../domain/workspace'
import { searchWorkspace } from '../utils/workspace-search'

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

test('workspace search finds an active-system object by its Location key @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const object = system?.objects[0]
  if (!system || !object) throw new Error('The local workspace did not create its first system object.')
  object.name = 'Whispering World'
  object.locationKey = 'VEIL-03'

  const results = searchWorkspace(workspace, '  veil-03  ', system.id)

  expect(results).toHaveLength(1)
  expect(results[0]?.target).toEqual({
    workspaceId: workspace.id,
    clusterId: workspace.cluster.id,
    kind: 'object',
    systemId: system.id,
    objectId: object.id,
  })
  expect(results[0]).toMatchObject({
    name: 'Whispering World',
    contextLabel: `Star System: ${system.name}`,
    locationKey: 'VEIL-03',
  })
})

test('workspace search keeps case-distinct Location keys visible as separate labels @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const object = system?.objects[0]
  if (!system || !object) throw new Error('The local workspace did not create its first system object.')
  object.name = 'Echo'
  object.locationKey = 'A'
  system.objects.push({ ...object, id: 'object-lowercase-key', locationKey: 'a' })

  const results = searchWorkspace(workspace, 'echo', system.id)

  expect(results.filter(result => result.target.kind === 'object').map(result => [result.locationKey, result.occurrence])).toEqual([
    ['A', null],
    ['a', null],
  ])
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

  const results = searchWorkspace(workspace, 'echo', system.id)
  const objects = results.filter(result => result.target.kind === 'object')

  expect(objects.map(result => result.name)).toEqual(['Echo', 'Far Echo', 'The Echo'])
  expect(objects.filter(result => result.target.kind === 'object' && result.target.objectId === exactNameObject.id)).toHaveLength(1)
})

test('workspace search includes every catalogue subtype and a custom Other label @pure', () => {
  const workspace = createLocalWorkspace('Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const template = system?.objects[0]
  if (!system || !template) throw new Error('The local workspace did not create its first system object.')
  const searchableObjects = [
    ...catalogueTypes.map((type, index) => ({
      ...template,
      id: `catalogue-${type.value}`,
      family: type.family,
      subtype: type.value,
      locationKey: `CAT-${String(index).padStart(2, '0')}`,
      name: `Marker ${String(index).padStart(2, '0')}`,
    })),
    { ...template, id: 'custom-other', family: 'Other' as const, subtype: 'Signal ghost', locationKey: 'CUSTOM-OTHER', name: 'Marker Custom Other' },
  ]
  system.objects.splice(0, system.objects.length, ...searchableObjects)

  const results = searchWorkspace(workspace, 'marker', system.id).filter(result => result.target.kind === 'object')

  expect(results.map(result => result.target.kind === 'object' ? result.target.objectId : '')).toEqual(
    searchableObjects.map(object => object.id),
  )
  expect(results.find(result => result.target.kind === 'object' && result.target.objectId === 'custom-other')?.typeLabel)
    .toBe('Signal ghost')
})
