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
  contextLabel: string
}

export interface WorkspaceHistoryStatus {
  undoDepth: number
  redoDepth: number
  totalActions: number
  retainedBytes: number
  maxActions: number
  maxBytes: number
  isBusy: boolean
  hasPendingGroup: boolean
  isConfirmingCapacity: boolean
  retentionReduced: boolean
  notice: string | null
  undoAction: WorkspaceHistoryActionDescriptor | null
  redoAction: WorkspaceHistoryActionDescriptor | null
  undoUnavailableReason: string | null
  redoUnavailableReason: string | null
}

/** A continuous adjustment has an in-memory preview but has not applied a workspace mutation yet. */
export type WorkspaceGroupStageResult = WorkspaceMutationResult | { status: 'preview' }

/** A detached read-only action summary and whether it lies before the current history position. */
export interface WorkspaceHistoryEntry {
  action: WorkspaceHistoryActionDescriptor
  applied: boolean
}

export interface WorkspaceHistoryTraversalContext {
  direction: 'undo' | 'redo'
  action: WorkspaceHistoryActionDescriptor
}

export interface WorkspaceHistoryCoordinatorOptions extends WorkspaceMutationExecutorOptions {
  /** Returns a live reason traversal cannot start; called on every status read and command. */
  getTraversalBlockReason(): string | null
  /** Confirms a single oversized action. The signal aborts the confirmation after reset/disposal. */
  confirmCapacity(details: WorkspaceHistoryCapacityDetails, signal: AbortSignal): Promise<boolean>
  /** Ends obsolete clean editing sessions after an accepted restore. */
  onTraversalApplied?(context: WorkspaceHistoryTraversalContext): void
  /** Limits are configurable for deterministic capacity boundary checks. */
  limits?: Partial<WorkspaceHistoryLimits>
}

export interface WorkspaceHistoryCoordinator extends WorkspaceMutationExecutor {
  /** Updates a continuous adjustment's proposal without publishing or serializing it. */
  stageGroup(key: string, request: WorkspaceMutationRequest): Promise<WorkspaceGroupStageResult>
  /** Publishes the pending adjustment once through the ordinary validated history path. */
  completeGroup(): Promise<WorkspaceMutationResult>
  undo(): Promise<WorkspaceMutationResult>
  redo(): Promise<WorkspaceMutationResult>
  reset(reason?: string): void
  getStatus(): WorkspaceHistoryStatus
  /** Returns detached action descriptors in chronological order; it never exposes snapshots. */
  getEntries(): readonly WorkspaceHistoryEntry[]
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

function boundedContextLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 200).trim() || 'Workspace'
}

function contextName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length <= 32 ? normalized : `${normalized.slice(0, 31).trimEnd()}…`
}

function routePointContext(workspace: LocalWorkspace, pointId: string): string {
  for (const system of workspace.cluster.systems) {
    const point = system.objects.find(object => object.id === pointId && object.family === 'JumpPoint')
    if (point) return `${contextName(point.name)} (${contextName(system.name)})`
  }
  return 'Missing Jump Point'
}

function targetContextLabel(target: WorkspaceMutationTarget | undefined, workspace: LocalWorkspace): string | null {
  if (!target) return null
  const { cluster } = workspace
  if (target.kind === 'cluster') return target.id === cluster.id ? cluster.name : null
  if (target.kind === 'system') {
    const system = cluster.systems.find(candidate => candidate.id === target.id)
    return system ? `${system.name} · ${cluster.name}` : null
  }
  if (target.kind === 'object') {
    const system = cluster.systems.find(candidate => candidate.id === target.systemId)
    const object = system?.objects.find(candidate => candidate.id === target.id)
    return system && object ? `${object.name} · ${system.name}` : null
  }
  if (target.kind === 'orbit') {
    const system = cluster.systems.find(candidate => candidate.id === target.systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === target.id)
    if (!system || !orbit) return null
    const host = orbit.hostId === null
      ? 'unoccupied center'
      : system.objects.find(object => object.id === orbit.hostId)?.name ?? 'missing host'
    return `Orbit ${orbit.order} around ${host} · ${system.name}`
  }
  if (target.kind === 'route') {
    const route = cluster.routes.find(candidate => candidate.id === target.id)
    if (!route) return null
    const from = routePointContext(workspace, route.fromPointId)
    const to = route.toPointId === null ? route.unresolvedExit : routePointContext(workspace, route.toPointId)
    return `${from} → ${to} · Level ${route.jumpLevel} · ${contextName(cluster.name)}`
  }
  const field = workspace.objectFieldSettings.customFields.find(candidate => candidate.id === target.id)
  return field ? `${field.name} · Global Fields` : null
}

function historyContextLabel(
  action: WorkspaceMutationAction,
  before: LocalWorkspace,
  after: LocalWorkspace,
): string {
  const primary = action.kind === 'create' || action.kind === 'import'
    ? after
    : action.kind === 'delete' ? before : after
  const fallback = primary === after ? before : after
  const context = action.kind === 'import'
    ? primary.cluster.name
    : targetContextLabel(action.target, primary)
      ?? targetContextLabel(action.parent, primary)
      ?? targetContextLabel(action.target, fallback)
      ?? targetContextLabel(action.parent, fallback)
      ?? primary.cluster.name
  return boundedContextLabel(context)
}

function historyDescriptor(prepared: PreparedMutation): WorkspaceHistoryActionDescriptor {
  return {
    workspaceId: prepared.before.id,
    clusterId: prepared.before.cluster.id,
    ...prepared.action,
    contextLabel: historyContextLabel(prepared.action, prepared.before, prepared.after),
  }
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
  let pendingGroup: {
    key: string
    request: WorkspaceMutationRequest
    currentReference: LocalWorkspace
    revision: number
    epoch: number
  } | null = null
  let groupCompletion: Promise<WorkspaceMutationResult> | null = null
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
    pendingGroup = null
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
      : pendingGroup
        ? 'Finish the active adjustment before using Undo or Redo.'
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
      hasPendingGroup: pendingGroup !== null,
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

  const executeNow = (request: WorkspaceMutationRequest): Promise<WorkspaceMutationResult> => {
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
      const actionBytes = encodeCanonical(historyDescriptor(preparation))
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

  const completeGroup = (): Promise<WorkspaceMutationResult> => {
    if (groupCompletion) return groupCompletion
    const group = pendingGroup
    if (!group) return Promise.resolve({ status: 'unchanged' })
    if (disposed) return Promise.resolve(rejected('stale', 'The workspace history is no longer active.'))
    if (busy) return Promise.resolve(rejected('busy', 'Finish the current workspace operation before completing this adjustment.'))

    let current: LocalWorkspace | null
    let revision: number
    try {
      current = options.getWorkspace()
      revision = options.getRevision()
    } catch (error) {
      pendingGroup = null
      notify()
      return Promise.resolve(rejected('unavailable', errorText(error)))
    }
    if (group.epoch !== operationEpoch || current !== group.currentReference || revision !== group.revision
      || (group.request.isCurrent && !isRequestCurrent(group.request))) {
      if (pendingGroup === group) pendingGroup = null
      notify()
      return Promise.resolve(rejected('stale', 'The adjustment preview changed before it could be applied.'))
    }

    const completion = executeNow(group.request).then(
      result => result,
      error => rejected('failed', errorText(error)),
    ).then((result) => {
      if (pendingGroup === group) pendingGroup = null
      if (groupCompletion === completion) groupCompletion = null
      notify()
      return result
    })
    groupCompletion = completion
    notify()
    return completion
  }

  function observeDiscardedDurability(result: WorkspaceMutationResult): void {
    // The sole save-status owner reports persistence failures. Callers that discard a finalized
    // action's acknowledgement must still mark its promise handled to avoid an unhandled rejection.
    if (result.status === 'applied') void result.durable.catch(() => undefined)
  }

  function isRequestCurrent(request: WorkspaceMutationRequest): boolean {
    try {
      return !request.isCurrent || request.isCurrent()
    } catch {
      return false
    }
  }

  const stageGroup = async (
    key: string,
    request: WorkspaceMutationRequest,
  ): Promise<WorkspaceGroupStageResult> => {
    if (!key.trim()) return rejected('invalid', 'The adjustment group key is empty.')
    if (!syncIdentity()) return rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`)
    if (disposed) return rejected('stale', 'The workspace history is no longer active.')
    if (busy || groupCompletion) return rejected('busy', 'Finish the current workspace operation before adjusting again.')

    const action = normalizedAction(request.action)
    if (!action) return rejected('invalid', 'The workspace adjustment action is invalid.')

    let current: LocalWorkspace | null
    let revision: number
    try {
      current = options.getWorkspace()
      revision = options.getRevision()
    } catch (error) {
      return rejected('unavailable', errorText(error))
    }
    if (!current) return rejected('invalid', 'There is no applied workspace to adjust.')
    if (!isRequestCurrent(request)) return rejected('stale', 'The workspace changed before this adjustment preview could be shown.')

    const existing = pendingGroup
    if (existing && existing.key !== key) {
      const completed = await completeGroup()
      if (completed.status === 'rejected') return completed
      if (completed.status === 'applied') observeDiscardedDurability(completed)
      let currentAfterCompletion: LocalWorkspace | null
      let revisionAfterCompletion: number
      try {
        currentAfterCompletion = options.getWorkspace()
        revisionAfterCompletion = options.getRevision()
      } catch (error) {
        return rejected('unavailable', errorText(error))
      }
      if (completed.status === 'applied' || currentAfterCompletion !== current || revisionAfterCompletion !== revision) {
        return rejected('stale', 'The previous adjustment changed the workspace. Recalculate this adjustment before continuing.')
      }
    }

    const currentGroup = pendingGroup
    if (currentGroup && currentGroup.key === key) {
      if (currentGroup.currentReference !== current || currentGroup.revision !== revision || currentGroup.epoch !== operationEpoch) {
        pendingGroup = null
        notify()
        return rejected('stale', 'The workspace changed while this adjustment preview was active.')
      }
      const previousAction = normalizedAction(currentGroup.request.action)
      if (!previousAction || previousAction.kind !== action.kind
        || canonicalJson(previousAction.target) !== canonicalJson(action.target)
        || canonicalJson(previousAction.parent ?? null) !== canonicalJson(action.parent ?? null)) {
        return rejected('invalid', 'One adjustment group cannot change its action target.')
      }
      currentGroup.request = request
      notify()
      return { status: 'preview' }
    }

    pendingGroup = { key, request, currentReference: current, revision, epoch: operationEpoch }
    notify()
    return { status: 'preview' }
  }

  const execute = async (request: WorkspaceMutationRequest): Promise<WorkspaceMutationResult> => {
    if (!pendingGroup) return executeNow(request)
    let before: LocalWorkspace | null
    let revision: number
    try {
      before = options.getWorkspace()
      revision = options.getRevision()
    } catch (error) {
      return rejected('unavailable', errorText(error))
    }
    const completed = await completeGroup()
    if (completed.status === 'rejected') return completed
    if (completed.status === 'applied') {
      observeDiscardedDurability(completed)
      return rejected('stale', 'The active adjustment was saved first. Recalculate this action using the updated workspace.')
    }
    try {
      if (options.getWorkspace() !== before || options.getRevision() !== revision) {
        return rejected('stale', 'The workspace changed while the active adjustment was being completed.')
      }
    } catch (error) {
      return rejected('unavailable', errorText(error))
    }
    return executeNow(request)
  }

  const traverse = (direction: 'undo' | 'redo'): Promise<WorkspaceMutationResult> => {
    if (!syncIdentity()) {
      return Promise.resolve(rejected('unavailable', `Workspace history is unavailable: ${identityReadError}`))
    }
    if (disposed) return Promise.resolve(rejected('stale', 'The workspace history is no longer active.'))
    if (busy) return Promise.resolve(rejected('busy', 'Finish the current workspace operation before using Undo or Redo.'))
    if (pendingGroup) return Promise.resolve(rejected('unavailable', 'Finish the active adjustment before using Undo or Redo.'))
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
    const traversalAction = readHistoryAction(historyActionAt(timeline, direction))
    if (!traversalAction) return Promise.resolve(rejected('invalid', 'The retained action summary could not be restored.'))
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
            options.onTraversalApplied?.({ direction, action: traversalAction })
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
        options.onTraversalApplied?.({ direction, action: traversalAction })
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
    stageGroup,
    completeGroup,
    undo: () => traverse('undo'),
    redo: () => traverse('redo'),
    reset(reason) {
      if (disposed) return
      operationEpoch += 1
      pendingGroup = null
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
    getEntries() {
      syncIdentity()
      return timeline.actions.map((bytes, index) => {
        const action = readHistoryAction(bytes)
        if (!action) throw new Error('A retained action summary could not be read.')
        return { action, applied: index < timeline.position }
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      disposed = true
      operationEpoch += 1
      pendingGroup = null
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
