/** Owns the independent Cluster Add System intent and its single-use placement inputs. */
import { computed, nextTick, reactive, ref, shallowRef, watch, type Ref } from 'vue'
import { addStarSystem, type LocalWorkspace, type Point } from '../../domain/workspace'
import { clusterSystemPosition } from '../../utils/cluster-map-geometry'
import type { ClusterAddType, ClusterSystemMovePreview, ClusterSystemPositionInput, ClusterSystemPositionInputs, MapNavigationHandle } from './types'
import type { EditorWorkflowOptions } from './types'
import type { WorkspaceMutationResult } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'

interface ClusterSystemPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  clusterMapRef: Readonly<Ref<MapNavigationHandle | null>>
  mutations: EditorWorkflowOptions['mutations']
}

interface ClusterMoveInputTarget {
  key: string
  position: Point
}

interface ClusterMoveInputBaseline {
  key: string
  x: string
  y: string
}

const CLUSTER_SYSTEM_CARD_WIDTH = 156
const CLUSTER_SYSTEM_CARD_HEIGHT = 76
const CLUSTER_MAP_POSITION_ORIGIN = { x: 112, y: 96 }
const CLUSTER_MAP_POSITION_SIZE = { x: 736, y: 368 }

export function useClusterSystemPlacement({ workspace, clusterMapRef, mutations }: ClusterSystemPlacementOptions) {
  const store = useEditorUiStore()
  const clusterAddType = ref<ClusterAddType | null>(null)
  const inputs = reactive<ClusterSystemPositionInputs>({ x: '0.5', y: '0.5' })
  const inputErrors = reactive<Record<ClusterSystemPositionInput, string>>({ x: '', y: '' })
  const formError = ref('')
  const systemMoveError = ref('')
  const systemMovePreview = ref<ClusterSystemMovePreview | null>(null)
  const nextPreviewToken = ref(0)
  let pendingSystemMoveToken: number | null = null
  const moveInputBaseline = shallowRef<ClusterMoveInputBaseline | null>(null)
  const clusterAddError = computed(() => formError.value || inputErrors.x || inputErrors.y)
  const clusterSystemMoveError = computed(() => systemMoveError.value || inputErrors.x || inputErrors.y)
  const clusterMoveTargeting = computed(() => store.activeView === 'cluster'
    && store.mapMode === 'move'
    && store.clusterSelectedSystemId !== null)

  function currentMoveInputTarget(): ClusterMoveInputTarget | null {
    const currentWorkspace = workspace.value
    const systemId = store.clusterSelectedSystemId
    if (!clusterMoveTargeting.value || !currentWorkspace || !systemId
      || !currentWorkspace.cluster.systems.some(system => system.id === systemId)) return null
    const position = currentWorkspace.layout.systemPositions[systemId]
    if (!position) return null
    return { key: `${currentWorkspace.cluster.id}:${systemId}`, position }
  }

  function setMoveInputs(target: ClusterMoveInputTarget | null): void {
    if (!target) {
      moveInputBaseline.value = null
      return
    }
    inputs.x = String(target.position.x)
    inputs.y = String(target.position.y)
    moveInputBaseline.value = { key: target.key, x: inputs.x, y: inputs.y }
  }

  function moveInputsMatchBaseline(targetKey: string): boolean {
    const baseline = moveInputBaseline.value
    return baseline?.key === targetKey
      && inputs.x === baseline.x
      && inputs.y === baseline.y
  }

  const hasPendingHistoryInput = computed(() => {
    if (clusterAddType.value === 'system' || systemMovePreview.value) return true
    const target = currentMoveInputTarget()
    if (!target) return false
    return !moveInputsMatchBaseline(target.key)
  })

  function clearErrors(): void {
    inputErrors.x = ''
    inputErrors.y = ''
    formError.value = ''
    systemMoveError.value = ''
  }

  function clearSystemMovePreview(): void {
    const preview = systemMovePreview.value
    if (preview) clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, null)
    systemMovePreview.value = null
  }

  function throwIfRejected(result: WorkspaceMutationResult): void {
    if (result.status === 'rejected') throw new Error(result.message)
  }

  function cancelSystemMovePreview(): void {
    const preview = systemMovePreview.value
    clearSystemMovePreview()
    systemMoveError.value = ''
    if (!preview) return
    const currentWorkspace = workspace.value
    const currentPosition = currentWorkspace?.cluster.systems.some(system => system.id === preview.sourceSystemId)
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : null
    if (currentPosition) {
      setMoveInputs({ key: `${currentWorkspace!.cluster.id}:${preview.sourceSystemId}`, position: currentPosition })
    }
  }

  function armSystemAdd(): void {
    if (!workspace.value || store.activeView !== 'cluster') return
    cancelSystemMovePreview()
    clusterAddType.value = 'system'
    clearErrors()
  }

  function armRouteAdd(): void {
    if (!workspace.value || store.activeView !== 'cluster') return
    cancelSystemMovePreview()
    clusterAddType.value = 'route'
    clearErrors()
  }

  function quitClusterAdd(): void {
    cancelSystemMovePreview()
    clusterAddType.value = null
    clearErrors()
  }

  function updateInput(key: ClusterSystemPositionInput, value: string): void {
    inputs[key] = value
    inputErrors[key] = ''
    formError.value = ''
    systemMoveError.value = ''
  }

  function validateCoordinate(key: ClusterSystemPositionInput): number | null {
    const raw = inputs[key].trim()
    const label = key.toUpperCase()
    if (!raw) {
      inputErrors[key] = `${label} is required.`
      return null
    }

    const value = Number(raw)
    if (!Number.isFinite(value)) {
      inputErrors[key] = `${label} must be a finite number.`
      return null
    }
    if (value < 0 || value > 1) {
      inputErrors[key] = `${label} must be between 0 and 1.`
      return null
    }

    inputErrors[key] = ''
    return value
  }

  function pointOverlapsSystem(
    point: Point,
    currentWorkspace: LocalWorkspace,
    ignoredSystemId?: string,
  ): boolean {
    const target = {
      x: CLUSTER_MAP_POSITION_ORIGIN.x + point.x * CLUSTER_MAP_POSITION_SIZE.x,
      y: CLUSTER_MAP_POSITION_ORIGIN.y + point.y * CLUSTER_MAP_POSITION_SIZE.y,
    }

    return currentWorkspace.cluster.systems.some((system) => {
      if (system.id === ignoredSystemId) return false
      const existing = clusterSystemPosition(currentWorkspace.layout.systemPositions, system.id)
      return Math.abs(target.x - existing.x) < CLUSTER_SYSTEM_CARD_WIDTH
        && Math.abs(target.y - existing.y) < CLUSTER_SYSTEM_CARD_HEIGHT
    })
  }

  async function addSystemAt(point: Point, systemIds: string[] = []): Promise<boolean> {
    if (clusterAddType.value !== 'system' || store.activeView !== 'cluster') return false
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false
    clearErrors()

    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      formError.value = 'Choose a point inside the Cluster map.'
      return false
    }

    const liveSystemIds = new Set(currentWorkspace.cluster.systems.map(system => system.id))
    if (systemIds.some(id => liveSystemIds.has(id)) || pointOverlapsSystem(point, currentWorkspace)) {
      formError.value = 'Choose an open point clear of existing systems.'
      return false
    }

    try {
      const clusterId = currentWorkspace.cluster.id
      const { system: identityTemplate } = addStarSystem(currentWorkspace)
      const result = await mutations.execute({
        action: {
          kind: 'create',
          label: `Create ${identityTemplate.name}`,
          target: { kind: 'system', id: identityTemplate.id },
          parent: { kind: 'cluster', id: clusterId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest !== null && latest.cluster.id === clusterId
            && store.activeView === 'cluster'
            && clusterAddType.value === 'system'
        },
        prepare: (latest) => {
          if (latest.cluster.id !== clusterId) throw new Error('The Jump Cluster changed before this system could be added.')
          if (pointOverlapsSystem(point, latest)) throw new Error('Choose an open point clear of existing systems.')
          const created = addStarSystem(latest)
          const generatedId = created.system.id
          const createdSystem = { ...created.system, id: identityTemplate.id }
          return {
            ...created.workspace,
            cluster: {
              ...created.workspace.cluster,
              systems: created.workspace.cluster.systems.map(candidate =>
                candidate.id === generatedId ? createdSystem : candidate,
              ),
            },
            layout: {
              ...created.workspace.layout,
              systemPositions: {
                ...Object.fromEntries(Object.entries(created.workspace.layout.systemPositions)
                  .filter(([id]) => id !== generatedId)),
                [identityTemplate.id]: { x: point.x, y: point.y },
              },
            },
          }
        },
      })
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      throwIfRejected(result)
      inputs.x = String(point.x)
      inputs.y = String(point.y)
      return true
    } catch (error) {
      formError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  async function addSystemFromInputs(): Promise<boolean> {
    if (clusterAddType.value !== 'system' || store.activeView !== 'cluster') return false
    clearErrors()
    const x = validateCoordinate('x')
    const y = validateCoordinate('y')
    if (x === null || y === null) {
      formError.value = inputErrors.x || inputErrors.y
      return false
    }
    return await addSystemAt({ x, y })
  }

  function previewSystemMoveAt(point: Point, systemIds: string[] = []): boolean {
    const sourceSystemId = store.clusterSelectedSystemId
    if (!clusterMoveTargeting.value || !sourceSystemId) return false
    clearSystemMovePreview()
    systemMoveError.value = ''
    inputErrors.x = ''
    inputErrors.y = ''
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false
    const sourceSystem = currentWorkspace.cluster.systems.find(system => system.id === sourceSystemId)
    if (!sourceSystem) {
      systemMoveError.value = 'Choose a system that is still on this Cluster.'
      return false
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      systemMoveError.value = 'Choose a point inside the Cluster map.'
      return false
    }
    if (systemIds.some(id => id !== sourceSystemId)
      || pointOverlapsSystem(point, currentWorkspace, sourceSystemId)) {
      systemMoveError.value = 'Choose an open point clear of other systems.'
      return false
    }

    const originPosition = currentWorkspace.layout.systemPositions[sourceSystemId]
    if (!originPosition) {
      systemMoveError.value = 'The selected system has no saved Cluster position.'
      return false
    }
    if (point.x === originPosition.x && point.y === originPosition.y) {
      systemMoveError.value = 'Choose a different point from the current location.'
      return false
    }

    const preview: ClusterSystemMovePreview = {
      token: ++nextPreviewToken.value,
      clusterId: currentWorkspace.cluster.id,
      sourceSystemId,
      originPosition: { ...originPosition },
      targetPosition: { x: point.x, y: point.y },
    }
    systemMovePreview.value = preview
    inputs.x = String(point.x)
    inputs.y = String(point.y)
    clusterMapRef.value?.setClusterSystemPositionPreview?.(sourceSystemId, preview.targetPosition)
    return true
  }

  function previewSystemMoveFromInputs(): boolean {
    if (!clusterMoveTargeting.value) return false
    systemMoveError.value = ''
    const x = validateCoordinate('x')
    const y = validateCoordinate('y')
    if (x === null || y === null) {
      systemMoveError.value = inputErrors.x || inputErrors.y
      return false
    }
    return previewSystemMoveAt({ x, y })
  }

  async function confirmSystemMove(): Promise<boolean> {
    const preview = systemMovePreview.value
    const currentWorkspace = workspace.value
    if (!preview || !currentWorkspace) return false
    const currentSource = currentWorkspace.cluster.systems.find(system => system.id === preview.sourceSystemId)
    const currentOrigin = currentSource
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : undefined
    const isCurrent = systemMovePreview.value?.token === preview.token
      && currentWorkspace.cluster.id === preview.clusterId
      && currentSource !== undefined
      && currentOrigin?.x === preview.originPosition.x
      && currentOrigin?.y === preview.originPosition.y
      && store.activeView === 'cluster'
      && store.mapMode === 'move'
      && store.clusterSelectedSystemId === preview.sourceSystemId
    if (!isCurrent) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return false
    }
    if (pointOverlapsSystem(preview.targetPosition, currentWorkspace, preview.sourceSystemId)) {
      cancelSystemMovePreview()
      systemMoveError.value = 'That destination is no longer clear. Choose another point.'
      return false
    }

    try {
      pendingSystemMoveToken = preview.token
      const result = await mutations.execute({
        action: {
          kind: 'move',
          label: `Move ${currentSource.name} on Jump Cluster`,
          target: { kind: 'system', id: preview.sourceSystemId },
          parent: { kind: 'cluster', id: preview.clusterId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return systemMovePreview.value?.token === preview.token
            && latest !== null && latest.cluster.id === preview.clusterId
            && store.activeView === 'cluster'
            && store.mapMode === 'move'
            && store.clusterSelectedSystemId === preview.sourceSystemId
        },
        prepare: (latest) => {
          const latestSource = latest.cluster.systems.find(system => system.id === preview.sourceSystemId)
          const latestOrigin = latest.layout.systemPositions[preview.sourceSystemId]
          if (latest.cluster.id !== preview.clusterId || !latestSource
            || latestOrigin?.x !== preview.originPosition.x || latestOrigin?.y !== preview.originPosition.y) {
            throw new Error('The selected system changed. Choose a source and preview its destination again.')
          }
          if (pointOverlapsSystem(preview.targetPosition, latest, preview.sourceSystemId)) {
            throw new Error('That destination is no longer clear. Choose another point.')
          }
          return {
            ...latest,
            layout: {
              ...latest.layout,
              systemPositions: {
                ...latest.layout.systemPositions,
                [preview.sourceSystemId]: { ...preview.targetPosition },
              },
            },
          }
        },
      })
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      throwIfRejected(result)
      if (systemMovePreview.value?.token === preview.token) {
        clearSystemMovePreview()
        systemMoveError.value = ''
        setMoveInputs(currentMoveInputTarget())
      }
      return true
    } catch (error) {
      if (systemMovePreview.value?.token === preview.token) {
        systemMoveError.value = error instanceof Error ? error.message : String(error)
      }
      return false
    } finally {
      if (pendingSystemMoveToken === preview.token) pendingSystemMoveToken = null
    }
  }

  watch([() => store.activeView, () => store.mapMode, () => store.clusterSelectedSystemId], ([view, mode, systemId]) => {
    const preview = systemMovePreview.value
    if (preview && (view !== 'cluster' || mode !== 'move' || systemId !== preview.sourceSystemId)) {
      cancelSystemMovePreview()
    }
    if (view === 'cluster' && mode === 'move' && systemId) {
      const currentWorkspace = workspace.value
      if (currentWorkspace?.cluster.systems.some(system => system.id === systemId)) {
        const normalized = currentWorkspace.layout.systemPositions[systemId]
        if (!normalized) {
          systemMoveError.value = 'The selected system has no saved Cluster position.'
          return
        }
        setMoveInputs({ key: `${currentWorkspace.cluster.id}:${systemId}`, position: normalized })
      }
    }
  }, { flush: 'sync' })

  const selectedMoveInputTarget = computed(() => currentMoveInputTarget())
  watch(selectedMoveInputTarget, (current, previous) => {
    if (!current) {
      moveInputBaseline.value = null
      return
    }
    if (!previous || current.key !== previous.key) {
      setMoveInputs(current)
      return
    }
    if (current.position.x === previous.position.x && current.position.y === previous.position.y) return
    if (moveInputsMatchBaseline(previous.key)) setMoveInputs(current)
  }, { flush: 'sync', immediate: true })

  watch(workspace, (currentWorkspace) => {
    const preview = systemMovePreview.value
    if (!preview) return
    if (pendingSystemMoveToken === preview.token) return
    if (!currentWorkspace) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }
    const sourceExists = currentWorkspace.cluster.id === preview.clusterId
      && currentWorkspace.cluster.systems.some(system => system.id === preview.sourceSystemId)
    const currentOrigin = sourceExists
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : undefined
    if (currentOrigin?.x !== preview.originPosition.x || currentOrigin?.y !== preview.originPosition.y) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }

    // Workspace edits rebuild the SVG. Reapply the still-valid transient preview after that render.
    void nextTick(() => {
      if (systemMovePreview.value?.token !== preview.token) return
      const latestWorkspace = workspace.value
      const latestPosition = latestWorkspace?.cluster.id === preview.clusterId
        ? latestWorkspace.layout.systemPositions[preview.sourceSystemId]
        : undefined
      if (latestPosition?.x !== preview.originPosition.x || latestPosition?.y !== preview.originPosition.y) {
        cancelSystemMovePreview()
        systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
        return
      }
      clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, preview.targetPosition)
    })
  }, { flush: 'post' })

  return {
    clusterAddType,
    clusterAddError,
    clusterMoveTargeting,
    hasPendingHistoryInput,
    clusterSystemMovePreview: systemMovePreview,
    clusterSystemMoveError,
    clusterSystemPositionInputs: inputs,
    clusterSystemPositionInputErrors: inputErrors,
    armSystemAdd,
    armRouteAdd,
    quitClusterAdd,
    updateClusterSystemPositionInput: updateInput,
    addSystemAt,
    addSystemFromInputs,
    previewSystemMoveAt,
    previewSystemMoveFromInputs,
    cancelSystemMovePreview,
    confirmSystemMove,
  }
}
