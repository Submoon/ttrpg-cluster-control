import { computed, ref, type Ref } from 'vue'
import { routeContentsFor, type LocalWorkspace } from '../../domain/workspace'
import { objectDraftValuesFor } from './entity-draft-values'
import { validateRouteObjectDraft } from './entity-draft-validation'
import type { ObjectDraft } from './types'
import type { WorkspaceMutationExecutor } from './workspace-mutations'

export interface RouteObjectInspectorSession {
  id: number
  kind: 'object'
  targetId: string
  routeId: string
  draft: ObjectDraft
  error: string
  errors: Record<string, string>
  baseline: string
}

interface RouteObjectEditingOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  mutations: WorkspaceMutationExecutor
  isSelected(routeId: string, objectId: string): boolean
}

function baselineFor(workspace: LocalWorkspace, routeId: string, objectId: string): string {
  const branch = routeContentsFor(workspace.cluster, routeId)
  return JSON.stringify([
    workspace.id, workspace.cluster.id,
    workspace.cluster.routes.find(route => route.id === routeId),
    branch?.objects.find(object => object.id === objectId),
    branch?.objects.filter(object => object.family === 'Installation' && object.subtype === 'station')
      .map(object => object.id),
    workspace.objectFieldSettings,
  ])
}

/** Owns the catalogue draft for a route object, using the ordinary mutation and history writer. */
export function useRouteObjectInspectorSession({ workspace, mutations, isSelected }: RouteObjectEditingOptions) {
  const session = ref<RouteObjectInspectorSession | null>(null)
  const initial = ref<ObjectDraft | null>(null)
  let sequence = 0
  const hasModified = computed(() => session.value !== null
    && JSON.stringify(session.value.draft) !== JSON.stringify(initial.value))

  function begin(routeId: string, objectId: string): boolean {
    const current = workspace.value
    if (!current || !isSelected(routeId, objectId)) return false
    const object = routeContentsFor(current.cluster, routeId)?.objects.find(candidate => candidate.id === objectId)
    if (!object) return false
    if (session.value?.routeId === routeId && session.value.targetId === objectId) return true
    if (session.value) return false
    initial.value = objectDraftValuesFor(object, current.objectFieldSettings)
    session.value = {
      id: --sequence,
      kind: 'object',
      targetId: objectId,
      routeId,
      draft: objectDraftValuesFor(object, current.objectFieldSettings),
      error: '',
      errors: {},
      baseline: baselineFor(current, routeId, objectId),
    }
    return true
  }

  function discard(id?: number): void {
    if (!session.value || (id !== undefined && session.value.id !== id)) return
    session.value = null
    initial.value = null
  }

  async function apply(id: number): Promise<boolean> {
    const active = session.value
    const original = initial.value
    const current = workspace.value
    if (!active || active.id !== id || !original || !current) return false
    const { routeId, targetId } = active
    const signature = JSON.stringify(active.draft)
    const isCurrent = () => session.value === active
      && isSelected(routeId, targetId)
      && JSON.stringify(active.draft) === signature
    const prepare = (latest: LocalWorkspace) => {
      const branch = routeContentsFor(latest.cluster, routeId)
      const object = branch?.objects.find(candidate => candidate.id === targetId)
      if (!object || !branch || baselineFor(latest, routeId, targetId) !== active.baseline) {
        return { workspace: null, errors: { form: 'This route object or its Fields changed. Reopen the Inspector to edit it.' } }
      }
      return validateRouteObjectDraft(latest, routeId, branch, object, original, active.draft)
    }
    if (!isCurrent()) return false
    const preview = prepare(current)
    active.errors = preview.errors
    active.error = preview.errors.form ?? ''
    if (!preview.workspace) return false

    const result = await mutations.execute({
      action: {
        kind: 'update',
        label: 'Edit route object',
        target: { kind: 'route-object', id: targetId, routeId },
        parent: { kind: 'route', id: routeId },
      },
      prepare: latest => {
        const prepared = prepare(latest)
        if (!prepared.workspace) throw new Error(prepared.errors.form ?? 'The route object draft is no longer valid.')
        return prepared.workspace
      },
      isCurrent,
    })
    if (result.status === 'rejected') {
      if (session.value === active) active.error = result.message
      return false
    }
    if (result.status === 'applied') void result.durable.catch(() => undefined)
    discard(id)
    return true
  }

  return { session, hasModified, begin, apply, discard }
}
