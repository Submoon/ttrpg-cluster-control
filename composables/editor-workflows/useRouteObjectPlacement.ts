import { toRaw, type Ref } from 'vue'
import { createWorkspaceRouteObject, updateWorkspaceRouteObject, type CatalogueObjectTransferReview, type CatalogueSubtype, type LocalWorkspace, type RouteLanding } from '../../domain/workspace'
import { prepareFittedCatalogueObjectTransfer } from '../../utils/zone-object-branch'
import type { WorkspaceMutationExecutor } from './workspace-mutations'

export type RouteObjectPlacementRequest = { kind: 'transfer'; proposal: CatalogueObjectTransferReview } | (RouteLanding & {
  workspaceSnapshot: LocalWorkspace
} & (
  | { kind: 'create'; subtype: CatalogueSubtype; otherType?: string }
  | { kind: 'move'; objectId: string }
))

interface RouteObjectPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  getRevision(): number
  mutations: WorkspaceMutationExecutor
  beforeWorkspaceOperation(): Promise<boolean>
  editorError: Ref<string>
  resolveBeforeTransfer?(
    proposal: CatalogueObjectTransferReview,
    ownsRequest: () => boolean,
    onDraftApplied: () => void,
  ): Promise<boolean>
  reviewTransfer?(proposal: CatalogueObjectTransferReview): Promise<boolean>
  onTransferred?(proposal: CatalogueObjectTransferReview): void
}

/** Applies the exact logical landing offered by the map through the page's guarded writer. */
export function useRouteObjectPlacement({
  workspace, getRevision, mutations, beforeWorkspaceOperation, editorError,
  resolveBeforeTransfer, reviewTransfer, onTransferred,
}: RouteObjectPlacementOptions) {
  return async function applyRouteLanding(
    request: RouteObjectPlacementRequest,
    ownsRequest: () => boolean,
  ): Promise<boolean> {
    const current = workspace.value
    let admittedWorkspace = current
    let admittedRevision = getRevision()
    const isCurrent = () => ownsRequest() && admittedWorkspace === workspace.value && getRevision() === admittedRevision
    const snapshot = request.kind === 'transfer' ? request.proposal.sourceWorkspace : request.workspaceSnapshot
    if (!current || toRaw(current) !== toRaw(snapshot) || !isCurrent()) return false
    if (!await beforeWorkspaceOperation() || !isCurrent()) return false

    try {
      if (request.kind === 'transfer') {
        const onDraftApplied = (): void => {
          const appliedWorkspace = workspace.value
          const revision = getRevision()
          if (!ownsRequest() || appliedWorkspace?.id !== current.id || appliedWorkspace.cluster.id !== current.cluster.id
            || appliedWorkspace === admittedWorkspace || revision !== admittedRevision + 1) return
          admittedWorkspace = appliedWorkspace
          admittedRevision = revision
        }
        if (resolveBeforeTransfer && !await resolveBeforeTransfer(request.proposal, isCurrent, onDraftApplied)) return false
        if (!isCurrent() || !admittedWorkspace) return false
        // Only the guard's own publication may change which landing and consequences are reviewed.
        const proposal = admittedWorkspace === current ? request.proposal
          : prepareFittedCatalogueObjectTransfer(admittedWorkspace, request.proposal.request)
        const needsReview = proposal.detachedRouteAttachments.length > 0 || proposal.clearedStationLinks.length > 0
        if (needsReview && (!reviewTransfer || !await reviewTransfer(proposal) || !isCurrent())) return false
        const { landing, rootObjectId } = proposal.request
        const target = landing.kind === 'route'
          ? { kind: 'route-object' as const, id: rootObjectId, routeId: landing.routeId }
          : { kind: 'object' as const, id: rootObjectId, systemId: landing.systemId }
        return finish(await mutations.execute({
          action: {
            kind: 'transfer',
            label: landing.kind === 'system' ? 'Detach object to Zone' : 'Transfer object to Jump Route',
            target,
            parent: landing.kind === 'system' ? { kind: 'system', id: landing.systemId } : { kind: 'route', id: landing.routeId },
          },
          isCurrent,
          prepare: () => proposal.previewWorkspace,
          onApplied: () => onTransferred?.(proposal),
        }), ownsRequest)
      }
      const { routeId, progression } = request
      const created = request.kind === 'create'
        ? createWorkspaceRouteObject(current, routeId, request.subtype, progression, request.otherType)
        : null
      const objectId = request.kind === 'move' ? request.objectId : created!.object.id
      const result = await mutations.execute({
        action: {
          kind: request.kind,
          label: created ? `Add ${created.object.name}` : 'Move route object',
          target: { kind: 'route-object', id: objectId, routeId },
          parent: { kind: 'route', id: routeId },
        },
        isCurrent,
        prepare: latest => created?.workspace ?? updateWorkspaceRouteObject(latest, routeId, objectId, { progression }),
      })
      return finish(result, ownsRequest)
    } catch (error) {
      if (ownsRequest()) editorError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function finish(result: Awaited<ReturnType<WorkspaceMutationExecutor['execute']>>, ownsRequest: () => boolean): boolean {
    if (result.status === 'rejected') {
      if (ownsRequest()) editorError.value = result.message
      return false
    }
    if (result.status === 'applied') void result.durable.catch(() => undefined)
    if (ownsRequest()) editorError.value = ''
    return true
  }
}
