import { expect, test } from '@playwright/test'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { createHistoryMeasurementWorkspace } from './fixtures/history-workspace'

for (const scenario of [
  { systems: 12, objects: 20, edits: 32, oversized: false },
  { systems: 20, objects: 120, edits: 5, oversized: false },
  { systems: 32, objects: 120, edits: 1, oversized: true },
]) {
  test(`history capacity and latency with ${scenario.systems * scenario.objects} multibyte objects @pure`, async () => {
    const testInfo = test.info()
    test.setTimeout(120_000)
    let workspace = createHistoryMeasurementWorkspace(scenario.systems, scenario.objects)
    let revision = 0
    let capacityQuestions = 0
    const history = createWorkspaceHistoryCoordinator({
      getWorkspace: () => workspace,
      getRevision: () => revision,
      getTraversalBlockReason: () => null,
      publishWorkspace: next => {
        workspace = next
        revision += 1
        return { durable: Promise.resolve() }
      },
      confirmCapacity: async () => { capacityQuestions += 1; return true },
    })
    const applicationMs: number[] = []
    const traversalMs: number[] = []
    const heapBefore = process.memoryUsage().heapUsed
    for (let index = 0; index < scenario.edits; index += 1) {
      const start = performance.now()
      const result = await history.execute({
        action: { kind: 'rename', label: 'Rename measured Jump Cluster', target: { kind: 'cluster', id: workspace.cluster.id } },
        prepare: current => ({ ...current, cluster: { ...current.cluster, name: `Measured Reach ${index}` } }),
      })
      expect(result.status).toBe('applied')
      applicationMs.push(performance.now() - start)
    }
    const status = history.getStatus()
    expect(status.retainedBytes).toBeLessThanOrEqual(33_554_432)
    expect(status.totalActions).toBeLessThanOrEqual(100)
    if (scenario.oversized) {
      expect(capacityQuestions).toBe(1)
      expect(status.totalActions).toBe(0)
      expect(status.retainedBytes).toBe(0)
    } else {
      expect(capacityQuestions).toBe(0)
      expect(status.retentionReduced).toBe(true)
      for (const direction of ['undo', 'redo'] as const) {
        const start = performance.now()
        const result = await history[direction]()
        expect(result.status).toBe('applied')
        traversalMs.push(performance.now() - start)
      }
    }
    await testInfo.attach('history-measurements.json', {
      contentType: 'application/json',
      body: JSON.stringify({
        systems: scenario.systems, objects: scenario.systems * scenario.objects,
        actionCount: scenario.edits, retainedActions: status.totalActions, retainedBytes: status.retainedBytes,
        capacityQuestions, applicationMs, traversalMs,
        nodeHeapBefore: heapBefore, nodeHeapAfter: process.memoryUsage().heapUsed,
        heapNote: 'Node process observations without forced GC; not a browser or RAM guarantee. Encoded capacity excludes live/transient data and queued saves.',
      }, null, 2),
    })
    history.dispose()
  })
}
