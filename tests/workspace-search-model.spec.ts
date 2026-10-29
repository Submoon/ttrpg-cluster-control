import { expect, test } from '@playwright/test'
import { createLocalWorkspace } from '../domain/workspace'
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
