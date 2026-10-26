import { watch, type Ref } from 'vue'
import type { OrbitCenterMoveCandidate, SystemObjectMoveCandidate } from './types'
import type { LocalWorkspace, StarSystem } from '../../domain/workspace'
import type { useEditorUiStore } from '../../stores/editor-ui'
import type { useEntityInspectorSession } from './useEntityInspectorSession'
import type { useSystemObjectPlacement } from './useSystemObjectPlacement'
import type { useEditorNavigation } from './useEditorNavigation'
import type { useSystemCreationWorkflows } from './useSystemCreationWorkflows'
import type { useEditorViewport } from './useEditorViewport'

/** Coordinates complete asynchronous map-candidate selection and session handoff sequences. */
export function useMapInteractionCoordinator(options: {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  store: ReturnType<typeof useEditorUiStore>
  selectedSystem: Readonly<Ref<StarSystem | undefined>>
  entity: ReturnType<typeof useEntityInspectorSession>
  navigation: ReturnType<typeof useEditorNavigation>
  placement: ReturnType<typeof useSystemObjectPlacement>
  creation: ReturnType<typeof useSystemCreationWorkflows>
  viewport: ReturnType<typeof useEditorViewport>
  beginOrbitEdit(): Promise<void>
}) {
  const { workspace, store, selectedSystem, entity, navigation, placement, creation, viewport, beginOrbitEdit } = options
  let objectMoveCandidateRequestId = 0
  let orbitCenterCandidateRequestId = 0

  watch([() => workspace.value?.cluster.id, () => store.activeView, () => store.selectedSystemId, () => store.mapMode], () => {
    objectMoveCandidateRequestId += 1
    orbitCenterCandidateRequestId += 1
  }, { flush: 'sync' })

  /** Selects and offers object-move candidates only if the original map and placement still own the request. */
  async function handleObjectMoveCandidates(objectId: string, candidates: SystemObjectMoveCandidate[]): Promise<void> {
    const requestId = ++objectMoveCandidateRequestId
    const clusterId = workspace.value?.cluster.id
    const systemId = store.selectedSystemId
    const view = store.activeView
    const mode = store.mapMode
    if (!clusterId || !systemId || view !== 'system' || mode !== 'move') return
    const sourceObject = selectedSystem.value?.objects.find(object => object.id === objectId)
    if (!sourceObject) return
    const sourcePlacement = JSON.stringify(sourceObject.placement)
    await navigation.selectObject(objectId, false)
    const latestSystem = selectedSystem.value
    const latestObject = latestSystem?.objects.find(object => object.id === objectId)
    if (requestId !== objectMoveCandidateRequestId
      || workspace.value?.cluster.id !== clusterId
      || store.activeView !== view
      || store.selectedSystemId !== systemId
      || store.mapMode !== mode
      || store.selectedObjectId !== objectId
      || !latestObject
      || JSON.stringify(latestObject.placement) !== sourcePlacement) return
    placement.offerObjectMoveCandidates(objectId, candidates)
  }

  /** Selects, starts, and populates an unoccupied Orbit session after rechecking its captured context. */
  async function handleOrbitCenterCandidates(orbitId: string, candidates: OrbitCenterMoveCandidate[]): Promise<void> {
    const requestId = ++orbitCenterCandidateRequestId
    const clusterId = workspace.value?.cluster.id
    const systemId = store.selectedSystemId
    const view = store.activeView
    const mode = store.mapMode
    if (!clusterId || !systemId || view !== 'system' || mode !== 'move' || creation.creationSession.value) return
    const sourceOrbit = selectedSystem.value?.orbits.find(orbit => orbit.id === orbitId)
    if (!sourceOrbit || sourceOrbit.hostId !== null) return
    const sourceSnapshot = JSON.stringify(sourceOrbit)
    const startingSession = entity.entitySession.value
    if (startingSession && !(startingSession.kind === 'orbit' && startingSession.targetId === orbitId)) return

    const matchesCurrentContext = (): boolean => requestId === orbitCenterCandidateRequestId
      && workspace.value?.cluster.id === clusterId
      && store.activeView === view
      && store.selectedSystemId === systemId
      && store.mapMode === mode
      && creation.creationSession.value === null
    const sourceIsUnchanged = (): boolean => {
      const current = selectedSystem.value?.orbits.find(orbit => orbit.id === orbitId)
      return current?.hostId === null && JSON.stringify(current) === sourceSnapshot
    }

    await navigation.selectOrbit(orbitId, false)
    if (!matchesCurrentContext() || store.selectedOrbitId !== orbitId || !sourceIsUnchanged()) return
    const selectedSession = entity.entitySession.value
    if (selectedSession && !(selectedSession.kind === 'orbit' && selectedSession.targetId === orbitId)) return

    const sessionIdBeforeBegin = entity.entitySession.value?.id ?? null
    await beginOrbitEdit()
    if (creation.creationSession.value) {
      const newlyStarted = entity.entitySession.value
      if (sessionIdBeforeBegin === null && newlyStarted?.kind === 'orbit'
        && newlyStarted.targetId === orbitId && !entity.hasModifiedEntitySession.value) {
        entity.discardEntitySession(newlyStarted.id)
      }
      return
    }
    if (!matchesCurrentContext() || store.selectedOrbitId !== orbitId || !sourceIsUnchanged()) return
    const session = entity.entitySession.value
    if (!session || session.kind !== 'orbit' || session.targetId !== orbitId || session.initial.orbit.hostId !== null) return
    if (startingSession?.kind === 'orbit' && startingSession.targetId === orbitId && session.id !== startingSession.id) return
    if (!entity.offerOrbitCenterCandidates(session.id, candidates)) return
    viewport.requestPanel('inspector')
  }

  return { handleObjectMoveCandidates, handleOrbitCenterCandidates }
}
