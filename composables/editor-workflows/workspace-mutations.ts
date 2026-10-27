import type { LocalWorkspace } from '../../domain/workspace'
import { createWorkspaceSnapshot } from '../../utils/workspace-storage'
import {
  createEmptyWorkspaceHistory,
  historyActionAt,
  historySnapshotAt,
  moveWorkspaceHistoryPosition,
  planWorkspaceHistoryAppend,
  type WorkspaceHistoryLimits,
  type WorkspaceHistoryTimeline,
} from './workspace-history-timeline'

export type WorkspaceMutationKind =
  | 'create'
  | 'update'
  | 'move'
  | 'resize'
  | 'rotate'
  | 'place'
  | 'detach'
  | 'delete'
  | 'rename'
  | 'import'

export type WorkspaceMutationTarget =
  | { kind: 'cluster' | 'system' | 'route' | 'field'; id: string }
  | { kind: 'object' | 'orbit'; id: string; systemId: string }

export interface WorkspaceMutationAction {
  kind: WorkspaceMutationKind
  label: string
  target: WorkspaceMutationTarget
  parent?: WorkspaceMutationTarget
}

export interface WorkspaceMutationRequest {
  action: WorkspaceMutationAction
  prepare(current: LocalWorkspace): LocalWorkspace
  isCurrent?: () => boolean
}

export type WorkspaceMutationResult =
  | { status: 'applied'; durable: Promise<void> }
  | { status: 'unchanged' }
  | { status: 'rejected'; reason: 'stale' | 'invalid' | 'failed' | 'cancelled' | 'busy' | 'unavailable'; message: string }

export interface WorkspaceMutationExecutor {
  execute(request: WorkspaceMutationRequest): Promise<WorkspaceMutationResult>
  dispose(): void
}

export interface WorkspaceMutationExecutorOptions {
  getWorkspace(): LocalWorkspace | null
  getRevision(): number
  publishWorkspace(next: LocalWorkspace): { durable: Promise<void> }
}

const mutationKinds: readonly WorkspaceMutationKind[] = [
  'create', 'update', 'move', 'resize', 'rotate', 'place', 'detach', 'delete', 'rename', 'import',
]

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

type RejectedMutationResult = Extract<WorkspaceMutationResult, { status: 'rejected' }>

function rejected(
  reason: 'stale' | 'invalid' | 'failed' | 'cancelled' | 'busy' | 'unavailable',
  message: string,
): RejectedMutationResult {
  return { status: 'rejected', reason, message }
}

function normalizedTarget(target: WorkspaceMutationTarget): WorkspaceMutationTarget | null {
  if (!target || typeof target !== 'object' || typeof target.id !== 'string' || !target.id) return null
  if (target.kind === 'cluster' || target.kind === 'system' || target.kind === 'route' || target.kind === 'field') {
    return { kind: target.kind, id: target.id }
  }
  if ((target.kind === 'object' || target.kind === 'orbit')
    && typeof target.systemId === 'string' && target.systemId) {
    return { kind: target.kind, id: target.id, systemId: target.systemId }
  }
  return null
}

function normalizedAction(action: WorkspaceMutationAction): WorkspaceMutationAction | null {
  if (!action || typeof action !== 'object' || !mutationKinds.includes(action.kind)) return null
  if (typeof action.label !== 'string') return null
  const label = action.label.trim().replace(/\s+/g, ' ').slice(0, 160)
  const target = normalizedTarget(action.target)
  const parent = action.parent === undefined ? undefined : normalizedTarget(action.parent)
  if (!label || !target || (action.parent !== undefined && !parent)) return null
  return parent ? { kind: action.kind, label, target, parent } : { kind: action.kind, label, target }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function encodeCanonical(value: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(canonicalJson(value))
  return Uint8Array.from(encoded)
}

interface PreparedMutation {
  request: WorkspaceMutationRequest
  action: WorkspaceMutationAction
  currentReference: LocalWorkspace
  revision: number
  before: LocalWorkspace
  after: LocalWorkspace
}

type Preparation = PreparedMutation | Exclude<WorkspaceMutationResult, { status: 'applied' }>

interface WorkspaceMutationPipeline {
  prepare(request: WorkspaceMutationRequest): Preparation
  publish(prepared: PreparedMutation): WorkspaceMutationResult
  dispose(): void
}

/** Shared synchronous prepare/publish boundary for legacy commands and history-aware commands. */
function createWorkspaceMutationPipeline({
  getWorkspace,
  getRevision,
  publishWorkspace,
}: WorkspaceMutationExecutorOptions): WorkspaceMutationPipeline {
  let disposed = false

  return {
    prepare(request) {
      if (disposed) return rejected('stale', 'The workspace mutation executor is no longer active.')

      let current: LocalWorkspace | null
      let revision: number
      try {
        current = getWorkspace()
        revision = getRevision()
      } catch (error) {
        return rejected('failed', errorText(error))
      }
      if (!current) return rejected('invalid', 'There is no applied workspace to change.')

      const stillCurrent = (): boolean => {
        try {
          if (disposed || getWorkspace() !== current || getRevision() !== revision) return false
          if (request.isCurrent && !request.isCurrent()) return false
          return !disposed && getWorkspace() === current && getRevision() === revision
        } catch {
          return false
        }
      }

      try {
        const action = normalizedAction(request.action)
        if (!action) return rejected('invalid', 'The workspace mutation action is invalid.')
        if (!stillCurrent()) return rejected('stale', 'The workspace changed before this action could be applied.')

        let before: LocalWorkspace
        let after: LocalWorkspace
        try {
          before = createWorkspaceSnapshot(current)
          after = createWorkspaceSnapshot(request.prepare(before))
        } catch (error) {
          return rejected('invalid', errorText(error))
        }
        if (!stillCurrent()) return rejected('stale', 'The workspace changed before this action could be applied.')
        if (canonicalJson(before) === canonicalJson(after)) return { status: 'unchanged' }

        return { request, action, currentReference: current, revision, before, after }
      } catch (error) {
        return rejected('failed', errorText(error))
      }
    },
    publish(prepared) {
      const currentAtStart = prepared.currentReference
      const revisionAtStart = prepared.revision
      const isCurrent = (): boolean => {
        try {
          if (disposed || getWorkspace() !== currentAtStart || getRevision() !== revisionAtStart) return false
          if (prepared.request.isCurrent && !prepared.request.isCurrent()) return false
          return !disposed && getWorkspace() === currentAtStart && getRevision() === revisionAtStart
        } catch {
          return false
        }
      }
      if (!isCurrent()) return rejected('stale', 'The workspace changed before this action could be applied.')

      try {
        const publication = publishWorkspace(prepared.after)
        return { status: 'applied', durable: publication.durable }
      } catch (error) {
        // Preserve truthful memory semantics if a writer reports a synchronous post-publication failure.
        try {
          if (getRevision() !== revisionAtStart) {
            return { status: 'applied', durable: Promise.reject(error) }
          }
        } catch {
          // The ordinary failure below remains authoritative when the owner is unavailable.
        }
        return rejected('failed', errorText(error))
      }
    },
    dispose() {
      disposed = true
    },
  }
}

/** Runs a validated proposal through the page owner's synchronous memory publication boundary. */
export function createWorkspaceMutationExecutor(options: WorkspaceMutationExecutorOptions): WorkspaceMutationExecutor {
  const pipeline = createWorkspaceMutationPipeline(options)
  return {
    execute(request) {
      const preparation = pipeline.prepare(request)
      return Promise.resolve('action' in preparation
        ? pipeline.publish(preparation)
        : preparation)
    },
    dispose: () => pipeline.dispose(),
  }
}

export interface WorkspaceHistoryCapacityDetails {
  action: WorkspaceMutationAction
  currentBytes: number
  projectedBytes: number
  maxBytes: number
  maxActions: number
}

export interface WorkspaceHistoryActionDescriptor extends WorkspaceMutationAction {
  workspaceId: string
  clusterId: string
}

export interface WorkspaceHistoryStatus {
  undoDepth: number
  redoDepth: number
  totalActions: number
  retainedBytes: number
  maxActions: number
  maxBytes: number
  isBusy: boolean
  isConfirmingCapacity: boolean
  retentionReduced: boolean
  notice: string | null
  undoAction: WorkspaceHistoryActionDescriptor | null
  redoAction: WorkspaceHistoryActionDescriptor | null
  undoUnavailableReason: string | null
  redoUnavailableReason: string | null
}

export interface WorkspaceHistoryCoordinatorOptions extends WorkspaceMutationExecutorOptions {
  /** Returns a live reason traversal cannot start; called on every status read and command. */
  getTraversalBlockReason(): string | null
  /** Confirms a single oversized action. The signal aborts the confirmation after reset/disposal. */
  confirmCapacity(details: WorkspaceHistoryCapacityDetails, signal: AbortSignal): Promise<boolean>
  /** Ends obsolete clean editing sessions after an accepted restore. */
  onTraversalApplied?(): void
  /** Limits are configurable for deterministic capacity boundary checks. */
  limits?: Partial<WorkspaceHistoryLimits>
}

export interface WorkspaceHistoryCoordinator extends WorkspaceMutationExecutor {
  undo(): Promise<WorkspaceMutationResult>
  redo(): Promise<WorkspaceMutationResult>
  reset(reason?: string): void
  getStatus(): WorkspaceHistoryStatus
  subscribe(listener: () => void): () => void
}

interface WorkspaceIdentity {
  workspaceId: string
  clusterId: string
}

function identityOf(workspace: LocalWorkspace | null): WorkspaceIdentity | null {
  return workspace ? { workspaceId: workspace.id, clusterId: workspace.cluster.id } : null
}

function sameIdentity(left: WorkspaceIdentity | null, right: WorkspaceIdentity | null): boolean {
  return left?.workspaceId === right?.workspaceId && left?.clusterId === right?.clusterId
}

function readHistoryAction(bytes: Uint8Array | null): WorkspaceHistoryActionDescriptor | null {
  if (!bytes) return null
  return JSON.parse(new TextDecoder().decode(bytes)) as WorkspaceHistoryActionDescriptor
}

function abortedPromise(signal: AbortSignal): Promise<'aborted'> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve('aborted')
      return
    }
    signal.addEventListener('abort', () => resolve('aborted'), { once: true })
  })
}

/** Adds a bounded session history around the existing single writer, without changing its save path. */
export function createWorkspaceHistoryCoordinator(
  options: WorkspaceHistoryCoordinatorOptions,
): WorkspaceHistoryCoordinator {
  const pipeline = createWorkspaceMutationPipeline(options)
  const requestedActionLimit = options.limits?.maxActions
  const requestedByteLimit = options.limits?.maxBytes
  const limits: WorkspaceHistoryLimits = {
    maxActions: typeof requestedActionLimit === 'number' && Number.isSafeInteger(requestedActionLimit)
      ? Math.min(100, Math.max(0, requestedActionLimit))
      : 100,
    maxBytes: typeof requestedByteLimit === 'number' && Number.isSafeInteger(requestedByteLimit)
      ? Math.min(33_554_432, Math.max(0, requestedByteLimit))
      : 33_554_432,
  }
  let timeline = createEmptyWorkspaceHistory()
  let identity: WorkspaceIdentity | null = null
  let identityReadError: string | null = null
  try {
    identity = identityOf(options.getWorkspace())
  } catch (error) {
    identityReadError = errorText(error)
  }
  let busy = false
  let confirmingCapacity = false
  let operationEpoch = 0
  let capacityController: AbortController | null = null
  const listeners = new Set<() => void>()
  let disposed = false
  let pendingSynchronousReset: { notice: string | null } | null = null

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // UI invalidation observers cannot change the outcome of an already-published workspace.
      }
    }
  }

  const clearTimeline = (notice: string | null): void => {
    timeline = createEmptyWorkspaceHistory(notice)
  }

  const applyPendingReset = (): void => {
    if (!pendingSynchronousReset) return
    clearTimeline(pendingSynchronousReset.notice)
    pendingSynchronousReset = null
  }

  const syncIdentity = (): boolean => {
    let nextIdentity: WorkspaceIdentity | null
    try {
      nextIdentity = identityOf(options.getWorkspace())
      identityReadError = null
    } catch (error) {
      identityReadError = errorText(error)
      return false
    }
    if (sameIdentity(identity, nextIdentity)) return true
    operationEpoch += 1
    capacityController?.abort()
    capacityController = null
    if (confirmingCapacity) busy = false
    confirmingCapacity = false
    identity = nextIdentity
    clearTimeline(null)
    notify()
    return true
  }

  const liveBlockReason = (): string | null => {
    try {
      return options.getTraversalBlockReason()?.trim() || null
    } catch (error) {
      return `Undo and Redo are unavailable: ${errorText(error)}`
    }
  }

  const status = (): WorkspaceHistoryStatus => {
    syncIdentity()
    const undoAction = readHistoryAction(historyActionAt(timeline, 'undo'))
    const redoAction = readHistoryAction(historyActionAt(timeline, 'redo'))
    const blockedReason = busy
      ? 'Finish the current workspace operation before using Undo or Redo.'
      : identityReadError
        ? `Workspace history is unavailable: ${identityReadError}`
        : liveBlockReason()
    return {
      undoDepth: timeline.position,
      redoDepth: timeline.actions.length - timeline.position,
      totalActions: timeline.actions.length,
      retainedBytes: timeline.retainedBytes,
      maxActions: limits.maxActions,
      maxBytes: limits.maxBytes,
      isBusy: busy,
      isConfirmingCapacity: confirmingCapacity,
      retentionReduced: timeline.retentionReduced,
      notice: timeline.notice,
      undoAction,
      redoAction,
      undoUnavailableReason: blockedReason ?? (undoAction ? null : 'There is nothing to undo.'),
      redoUnavailableReason: blockedReason ?? (redoAction ? null : 'There is nothing to redo.'),
    }
  }

  const publishAction = (
    prepared: PreparedMutation,
    nextTimeline: WorkspaceHistoryTimeline,
  ): WorkspaceMutationResult => {
    if (busy || disposed) return rejected('busy', 'Another workspace history operation is already in progress.')
    const epoch = operationEpoch
    busy = true
    notify()
    try {
      if (disposed || epoch !== operationEpoch) {
        return rejected('stale', 'The workspace history changed before this action could be applied.')
      }
      if (!syncIdentity()) {
        return rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`)
      }
      if (disposed || epoch !== operationEpoch) {
        return rejected('stale', 'The workspace history changed before this action could be applied.')
      }
      const result = pipeline.publish(prepared)
      if (result.status === 'applied') {
        if (!disposed) {
          timeline = nextTimeline
          identity = identityOf(prepared.after)
        }
      }
      return result
    } catch (error) {
      return rejected('failed', errorText(error))
    } finally {
      applyPendingReset()
      busy = false
      notify()
    }
  }

  const publishOversizedBaseline = (
    prepared: PreparedMutation,
    baseline: WorkspaceHistoryTimeline,
  ): WorkspaceMutationResult => {
    const result = pipeline.publish(prepared)
    if (result.status === 'applied') {
      if (!disposed) {
        timeline = baseline
        identity = identityOf(prepared.after)
      }
    }
    return result
  }

  const execute = (request: WorkspaceMutationRequest): Promise<WorkspaceMutationResult> => {
    if (!syncIdentity()) {
      return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
    }
    if (disposed) return Promise.resolve(rejected('stale', 'The workspace history is no longer active.'))
    if (busy) return Promise.resolve(rejected('busy', 'Finish the current workspace operation before editing again.'))

    const preparation = pipeline.prepare(request)
    if (!('action' in preparation)) return Promise.resolve(preparation)

    try {
      const beforeBytes = encodeCanonical(preparation.before)
      const afterBytes = encodeCanonical(preparation.after)
      const actionBytes = encodeCanonical({
        workspaceId: preparation.before.id,
        clusterId: preparation.before.cluster.id,
        ...preparation.action,
      })
      const plan = planWorkspaceHistoryAppend(timeline, beforeBytes, afterBytes, actionBytes, limits)
      if (plan.status === 'stale') {
        return Promise.resolve(rejected('stale', 'The workspace changed outside the shared history. Start a fresh editing session before applying this action.'))
      }
      if (plan.status === 'fits') return Promise.resolve(publishAction(preparation, plan.timeline))

      const oversizedBaseline: WorkspaceHistoryTimeline = {
        ...createEmptyWorkspaceHistory('This action cannot be undone. It cleared the retained history.'),
        retentionReduced: true,
      }

      const controller = new AbortController()
      const epoch = ++operationEpoch
      capacityController = controller
      confirmingCapacity = true
      busy = true
      notify()
      const details: WorkspaceHistoryCapacityDetails = {
        action: preparation.action,
        currentBytes: timeline.retainedBytes,
        projectedBytes: plan.projectedBytes,
        maxBytes: limits.maxBytes,
        maxActions: limits.maxActions,
      }
      const finishConfirmation = (): void => {
        if (capacityController === controller) capacityController = null
        if (epoch === operationEpoch) {
          confirmingCapacity = false
          busy = false
        }
        notify()
      }
      if (disposed || epoch !== operationEpoch || controller.signal.aborted) {
        finishConfirmation()
        return Promise.resolve(rejected('stale', 'The workspace changed before the history capacity question could be shown.'))
      }
      let confirmation: Promise<boolean>
      try {
        confirmation = Promise.resolve(options.confirmCapacity(details, controller.signal))
      } catch (error) {
        confirmation = Promise.reject(error)
      }

      return Promise.race([confirmation, abortedPromise(controller.signal)]).then((accepted) => {
        if (accepted === 'aborted' || disposed || epoch !== operationEpoch) {
          return rejected('stale', 'The workspace changed while the history capacity question was open.')
        }
        if (!accepted) return rejected('cancelled', 'The action was canceled; the workspace and retained history were left unchanged.')

        const epochBeforeRecheck = operationEpoch
        if (!syncIdentity()) {
          return rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`)
        }
        if (disposed || epoch !== operationEpoch || epochBeforeRecheck !== operationEpoch
          || controller.signal.aborted
          || options.getWorkspace() !== preparation.currentReference
          || options.getRevision() !== preparation.revision
          || (preparation.request.isCurrent && !preparation.request.isCurrent())
          || disposed || epoch !== operationEpoch) {
          return rejected('stale', 'The workspace changed while the history capacity question was open.')
        }

        const applied = publishOversizedBaseline(preparation, oversizedBaseline)
        return applied
      }).catch(error => rejected('failed', errorText(error))).finally(finishConfirmation)
    } catch (error) {
      return Promise.resolve(rejected('invalid', errorText(error)))
    }
  }

  const traverse = (direction: 'undo' | 'redo'): Promise<WorkspaceMutationResult> => {
    if (!syncIdentity()) {
      return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
    }
    if (disposed) return Promise.resolve(rejected('stale', 'The workspace history is no longer active.'))
    if (busy) return Promise.resolve(rejected('busy', 'Finish the current workspace operation before using Undo or Redo.'))
    const blocked = liveBlockReason()
    if (blocked) return Promise.resolve(rejected('unavailable', blocked))

    const encodedSnapshot = historySnapshotAt(timeline, direction)
    if (!encodedSnapshot) {
      return Promise.resolve(rejected('unavailable', direction === 'undo' ? 'There is nothing to undo.' : 'There is nothing to redo.'))
    }

    let workspace: LocalWorkspace
    try {
      workspace = createWorkspaceSnapshot(JSON.parse(new TextDecoder().decode(encodedSnapshot)) as LocalWorkspace)
    } catch (error) {
      return Promise.resolve(rejected('invalid', `The retained workspace state could not be restored: ${errorText(error)}`))
    }
    let live: LocalWorkspace | null
    let revision: number
    try {
      live = options.getWorkspace()
      revision = options.getRevision()
    } catch (error) {
      identityReadError = errorText(error)
      return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
    }
    const currentIdentity = identityOf(live)
    if (!sameIdentity(identity, currentIdentity)
      || workspace.id !== currentIdentity?.workspaceId || workspace.cluster.id !== currentIdentity?.clusterId) {
      return Promise.resolve(rejected('stale', 'This history belongs to a different workspace.'))
    }

    const nextTimeline = moveWorkspaceHistoryPosition(timeline, direction)
    const restoredIdentity = identityOf(workspace)

    const epoch = operationEpoch
    busy = true
    notify()
    try {
      if (disposed || epoch !== operationEpoch) {
        return Promise.resolve(rejected('stale', 'The workspace history changed before this restore could be applied.'))
      }
      if (!syncIdentity()) {
        return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
      }
      if (disposed || epoch !== operationEpoch) {
        return Promise.resolve(rejected('stale', 'The workspace history changed before this restore could be applied.'))
      }
      let currentAfterNotification: LocalWorkspace | null
      let revisionAfterNotification: number
      try {
        currentAfterNotification = options.getWorkspace()
        revisionAfterNotification = options.getRevision()
      } catch (error) {
        identityReadError = errorText(error)
        return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
      }
      if (currentAfterNotification !== live || revisionAfterNotification !== revision) {
        return Promise.resolve(rejected('stale', 'The workspace changed before this restore could be applied.'))
      }
      const blockerAfterNotification = liveBlockReason()
      if (blockerAfterNotification) {
        return Promise.resolve(rejected('unavailable', blockerAfterNotification))
      }

      let publication: { durable: Promise<void> }
      try {
        publication = options.publishWorkspace(workspace)
      } catch (error) {
        if (options.getRevision() !== revision) {
          if (!disposed) {
            timeline = nextTimeline
            identity = restoredIdentity
          }
          try {
            options.onTraversalApplied?.()
          } catch {
            // Session cleanup cannot turn a workspace already restored in memory into a rejection.
          }
          return Promise.resolve({ status: 'applied', durable: Promise.reject(error) })
        }
        return Promise.resolve(rejected('failed', errorText(error)))
      }

      if (!disposed) {
        timeline = nextTimeline
        identity = restoredIdentity
      }
      try {
        options.onTraversalApplied?.()
      } catch {
        // Session cleanup cannot turn a workspace already restored in memory into a rejection.
      }
      return Promise.resolve({ status: 'applied', durable: publication.durable })
    } catch (error) {
      return Promise.resolve(rejected('failed', errorText(error)))
    } finally {
      applyPendingReset()
      busy = false
      notify()
    }
  }

  return {
    execute,
    undo: () => traverse('undo'),
    redo: () => traverse('redo'),
    reset(reason) {
      if (disposed) return
      operationEpoch += 1
      capacityController?.abort()
      capacityController = null
      const resetNotice = reason ?? null
      if (busy && !confirmingCapacity) {
        try {
          identity = identityOf(options.getWorkspace())
        } catch {
          // The synchronous workspace owner can be changing at the same boundary as this reset.
        }
        pendingSynchronousReset = { notice: resetNotice }
        return
      }
      busy = false
      confirmingCapacity = false
      try {
        identity = identityOf(options.getWorkspace())
      } catch {
        identity = null
      }
      clearTimeline(resetNotice)
      notify()
    },
    getStatus: status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      disposed = true
      operationEpoch += 1
      capacityController?.abort()
      capacityController = null
      busy = false
      confirmingCapacity = false
      clearTimeline(null)
      pendingSynchronousReset = null
      listeners.clear()
      pipeline.dispose()
    },
  }
}
