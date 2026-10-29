import { expect, test } from '@playwright/test'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import {
  createWorkspaceMutationExecutor,
  type WorkspaceMutationRequest,
} from '../composables/editor-workflows/workspace-mutations'

function renameClusterRequest(current: LocalWorkspace): WorkspaceMutationRequest {
  return {
    action: {
      kind: 'rename',
      label: 'Rename Jump Cluster',
      target: { kind: 'cluster', id: current.cluster.id },
    },
    prepare: workspace => ({
      ...workspace,
      cluster: { ...workspace.cluster, name: 'Kestrel Reach Prime' },
    }),
  }
}

test('a validated mutation publishes before its separately controlled durable acknowledgement @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  let current: LocalWorkspace | null = initial
  let revision = 0
  let rejectDurable: ((error: Error) => void) | undefined
  const durable = new Promise<void>((_resolve, reject) => { rejectDurable = reject })
  const executor = createWorkspaceMutationExecutor({
    getWorkspace: () => current,
    getRevision: () => revision,
    publishWorkspace: next => {
      current = next
      revision += 1
      return { durable }
    },
  })

  const pending = executor.execute(renameClusterRequest(initial))

  expect(current?.cluster.name).toBe('Kestrel Reach Prime')
  const result = await pending
  expect(result.status).toBe('applied')
  if (result.status !== 'applied') throw new Error('The validated rename was not applied.')
  expect(current?.cluster.name).toBe('Kestrel Reach Prime')

  rejectDurable?.(new Error('IndexedDB is unavailable.'))
  await expect(result.durable).rejects.toThrow('IndexedDB is unavailable.')
  expect(current?.cluster.name).toBe('Kestrel Reach Prime')
})

test('a structurally unchanged proposal leaves workspace and durability untouched @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  let current: LocalWorkspace | null = initial
  let revision = 0
  const executor = createWorkspaceMutationExecutor({
    getWorkspace: () => current,
    getRevision: () => revision,
    publishWorkspace: next => {
      current = next
      revision += 1
      return { durable: Promise.resolve() }
    },
  })
  const request = renameClusterRequest(initial)
  request.prepare = workspace => ({
    objectFieldSettings: workspace.objectFieldSettings,
    layout: workspace.layout,
    cluster: workspace.cluster,
    id: workspace.id,
  })

  const result = await executor.execute(request)

  expect(result).toEqual({ status: 'unchanged' })
  expect(current).toBe(initial)
  expect(revision).toBe(0)
})

test('invalid proposals and stale sessions preserve the applied workspace @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  let current: LocalWorkspace | null = initial
  let revision = 0
  const executor = createWorkspaceMutationExecutor({
    getWorkspace: () => current,
    getRevision: () => revision,
    publishWorkspace: next => {
      current = next
      revision += 1
      return { durable: Promise.resolve() }
    },
  })
  const invalid = renameClusterRequest(initial)
  invalid.prepare = workspace => ({ ...workspace, cluster: { ...workspace.cluster, name: ' ' } })

  const invalidResult = await executor.execute(invalid)
  expect(invalidResult).toMatchObject({ status: 'rejected', reason: 'invalid' })
  expect(current).toBe(initial)

  const stale = renameClusterRequest(initial)
  stale.isCurrent = () => false
  const staleResult = await executor.execute(stale)
  expect(staleResult).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(current).toBe(initial)
  expect(revision).toBe(0)
})
