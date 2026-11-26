import { toRaw, type Ref } from 'vue'
import { createWorkspaceRouteObject, updateWorkspaceRouteObject, type CatalogueSubtype, type LocalWorkspace, type RouteLanding } from '../../domain/workspace'
import type { WorkspaceMutationExecutor } from './workspace-mutations'

export type RouteObjectPlacementRequest = RouteLanding & {
  workspaceSnapshot: LocalWorkspace
} & (
  | { kind: 'create'; subtype: CatalogueSubtype; otherType?: string }
  | { kind: 'move'; objectId: string }
)

interface RouteObjectPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  getRevision(): number
  mutations: WorkspaceMutationExecutor
  beforeWorkspaceOperation(): Promise<boolean>
  editorError: Ref<string>
}

/** Applies the exact logical landing offered by the map through the page's guarded writer. */
export function useRouteObjectPlacement({
  workspace, getRevision, mutations, beforeWorkspaceOperation, editorError,
}: RouteObjectPlacementOptions) {
  return async function applyRouteLanding(
    request: RouteObjectPlacementRequest,
    ownsRequest: () => boolean,
  ): Promise<boolean> {
    const revision = getRevision()
    const current = workspace.value
    const isCurrent = () => ownsRequest() && current === workspace.value && getRevision() === revision
    if (!current || toRaw(current) !== toRaw(request.workspaceSnapshot) || !isCurrent()) return false
    if (!await beforeWorkspaceOperation() || !isCurrent()) return false

    const { routeId, progression } = request
    try {
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
      if (result.status === 'rejected') {
        if (ownsRequest()) editorError.value = result.message
        return false
      }
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      if (ownsRequest()) editorError.value = ''
      return true
    } catch (error) {
      if (ownsRequest()) editorError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }
}
