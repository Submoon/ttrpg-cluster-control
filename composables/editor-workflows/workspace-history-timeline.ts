/**
 * Framework-independent bounded linear history of exact canonical workspace bytes.
 * Adjacent actions share a workspace node, so N edges retain N+1 states.
 */
export interface WorkspaceHistoryTimeline {
  readonly snapshots: readonly Uint8Array[]
  readonly actions: readonly Uint8Array[]
  readonly position: number
  readonly retainedBytes: number
  readonly retentionReduced: boolean
  readonly notice: string | null
}

export interface WorkspaceHistoryLimits {
  maxActions: number
  maxBytes: number
}

export type WorkspaceHistoryAppendPlan =
  | { status: 'fits'; timeline: WorkspaceHistoryTimeline }
  | { status: 'requires-capacity-consent'; projectedBytes: number; timeline: WorkspaceHistoryTimeline }
  | { status: 'stale' }

export function createEmptyWorkspaceHistory(notice: string | null = null): WorkspaceHistoryTimeline {
  return {
    snapshots: [],
    actions: [],
    position: 0,
    retainedBytes: 0,
    retentionReduced: false,
    notice,
  }
}

export function historyActionAt(
  timeline: WorkspaceHistoryTimeline,
  direction: 'undo' | 'redo',
): Uint8Array | null {
  const index = direction === 'undo' ? timeline.position - 1 : timeline.position
  return timeline.actions[index] ?? null
}

export function historySnapshotAt(
  timeline: WorkspaceHistoryTimeline,
  direction: 'undo' | 'redo',
): Uint8Array | null {
  const index = direction === 'undo' ? timeline.position - 1 : timeline.position + 1
  return timeline.snapshots[index] ?? null
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function countRetainedBytes(snapshots: readonly Uint8Array[], actions: readonly Uint8Array[]): number {
  let total = 0
  for (const snapshot of snapshots) total += snapshot.byteLength
  for (const action of actions) total += action.byteLength
  return total
}

/**
 * Plans a new branch without changing the current timeline. Any eligible prefix eviction is
 * returned only in the candidate plan; callers install it after the workspace is published.
 */
export function planWorkspaceHistoryAppend(
  current: WorkspaceHistoryTimeline,
  before: Uint8Array,
  after: Uint8Array,
  action: Uint8Array,
  limits: WorkspaceHistoryLimits,
): WorkspaceHistoryAppendPlan {
  const visibleCurrent = current.snapshots[current.position]
  if (visibleCurrent && !equalBytes(visibleCurrent, before)) return { status: 'stale' }

  const snapshots = visibleCurrent
    ? current.snapshots.slice(0, current.position + 1)
    : [before]
  const actions = current.actions.slice(0, current.position)
  snapshots.push(after)
  actions.push(action)

  let position = actions.length
  let retainedBytes = countRetainedBytes(snapshots, actions)
  let evictedPrefix = false

  while ((actions.length > limits.maxActions || retainedBytes > limits.maxBytes) && position > 1) {
    const removedSnapshot = snapshots.shift()
    const removedAction = actions.shift()
    if (!removedSnapshot || !removedAction) break
    retainedBytes -= removedSnapshot.byteLength + removedAction.byteLength
    position -= 1
    evictedPrefix = true
  }

  if (actions.length > limits.maxActions || retainedBytes > limits.maxBytes) {
    return { status: 'requires-capacity-consent', projectedBytes: retainedBytes, timeline: current }
  }

  return {
    status: 'fits',
    timeline: {
      snapshots,
      actions,
      position,
      retainedBytes,
      retentionReduced: current.retentionReduced || evictedPrefix,
      notice: evictedPrefix
        ? 'Older Undo history was removed to stay within the history limit.'
        : current.notice,
    },
  }
}

export function moveWorkspaceHistoryPosition(
  timeline: WorkspaceHistoryTimeline,
  direction: 'undo' | 'redo',
): WorkspaceHistoryTimeline {
  return {
    ...timeline,
    position: direction === 'undo' ? timeline.position - 1 : timeline.position + 1,
  }
}
