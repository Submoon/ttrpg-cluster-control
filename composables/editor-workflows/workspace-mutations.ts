import type { LocalWorkspace } from '../../domain/workspace'
import { createWorkspaceSnapshot } from '../../utils/workspace-storage'

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
  | { status: 'rejected'; reason: 'stale' | 'invalid' | 'failed'; message: string }

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

function rejected(reason: 'stale' | 'invalid' | 'failed', message: string): WorkspaceMutationResult {
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
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Runs a validated proposal through the page owner's synchronous memory publication boundary. */
export function createWorkspaceMutationExecutor({
  getWorkspace,
  getRevision,
  publishWorkspace,
}: WorkspaceMutationExecutorOptions): WorkspaceMutationExecutor {
  let disposed = false

  return {
    execute(request) {
      if (disposed) return Promise.resolve(rejected('stale', 'The workspace mutation executor is no longer active.'))

      let current: LocalWorkspace | null
      let revision: number
      try {
        current = getWorkspace()
        revision = getRevision()
      } catch (error) {
        return Promise.resolve(rejected('failed', errorText(error)))
      }
      if (!current) return Promise.resolve(rejected('invalid', 'There is no applied workspace to change.'))

      const stillCurrent = (): boolean => {
        if (disposed || getWorkspace() !== current || getRevision() !== revision) return false
        if (request.isCurrent && !request.isCurrent()) return false
        return !disposed && getWorkspace() === current && getRevision() === revision
      }

      try {
        if (!normalizedAction(request.action)) {
          return Promise.resolve(rejected('invalid', 'The workspace mutation action is invalid.'))
        }
        if (!stillCurrent()) return Promise.resolve(rejected('stale', 'The workspace changed before this action could be applied.'))

        let currentSnapshot: LocalWorkspace
        let nextSnapshot: LocalWorkspace
        try {
          currentSnapshot = createWorkspaceSnapshot(current)
          nextSnapshot = createWorkspaceSnapshot(request.prepare(currentSnapshot))
        } catch (error) {
          return Promise.resolve(rejected('invalid', errorText(error)))
        }
        if (!stillCurrent()) return Promise.resolve(rejected('stale', 'The workspace changed before this action could be applied.'))
        if (canonicalJson(currentSnapshot) === canonicalJson(nextSnapshot)) {
          return Promise.resolve({ status: 'unchanged' })
        }

        try {
          const publication = publishWorkspace(nextSnapshot)
          return Promise.resolve({ status: 'applied', durable: publication.durable })
        } catch (error) {
          return Promise.resolve(rejected('failed', errorText(error)))
        }
      } catch (error) {
        return Promise.resolve(rejected('failed', errorText(error)))
      }
    },
    dispose() {
      disposed = true
    },
  }
}
