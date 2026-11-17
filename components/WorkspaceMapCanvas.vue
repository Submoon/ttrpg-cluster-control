<template>
  <div
    ref="canvasRoot"
    class="workspace-map-canvas"
    :data-workspace-id="props.workspace.id"
    :data-cluster-id="props.workspace.cluster.id"
    @pointerdown.capture="onPointerDownCapture"
    @mousedown.capture="onMouseDownCapture"
    @mouseup.capture="onMouseUpCapture"
    @lostpointercapture.capture="onLostPointerCapture"
    @wheel.capture="onWheelCapture"
    @contextmenu.capture="onContextMenuCapture"
    @click.capture="onClickCapture"
    @keydown.capture="onKeyDownCapture"
    @drop.capture="dismissSearchLocator"
    @touchstart.capture="onTouchStartCapture"
    @touchmove.capture="onTouchMoveCapture"
    @touchend.capture="onTouchEndCapture"
    @touchcancel.capture="onTouchEndCapture"
  >
    <div
      v-if="selectionRectangle"
      class="workspace-selection-rectangle"
      aria-hidden="true"
      :style="{
        left: `${selectionRectangle.left}px`,
        top: `${selectionRectangle.top}px`,
        width: `${selectionRectangle.width}px`,
        height: `${selectionRectangle.height}px`,
      }"
    />
    <ContinuousWardenMap
      v-if="props.activeView === 'cluster' && props.continuousMap"
      ref="continuousWardenMapRef"
      :cluster="props.workspace.cluster"
      :workspace="props.workspace"
      :system-positions="props.workspace.layout.systemPositions"
      :unresolved-exit-positions="props.workspace.layout.unresolvedExitPositions"
      :object-angles="props.workspace.layout.objectAngles"
      :orbit-radii="props.workspace.layout.orbitRadii"
      :orbit-rotations="props.workspace.layout.orbitRotations"
      :selected-system-id="props.inspectedTarget?.kind === 'system' || props.inspectedTarget?.kind === 'object' || props.inspectedTarget?.kind === 'orbit'
        ? props.inspectedTarget.systemId
        : props.selectedSystemId"
      :inspected-target="props.inspectedTarget ?? null"
      :selected-route-id="props.selectedRouteId"
      :mode="props.mode"
      :creation-type="props.creationType ?? null"
      :creation-other-type="props.creationOtherType ?? null"
      :object-add-pinned-owner-id="props.objectAddPinnedOwnerId ?? null"
      :is-entity-command-blocked="props.isEntityCommandBlocked"
      :orbit-adjustment-preview="matchingOrbitAdjustmentPreview"
      :cluster-add-type="props.clusterAddType ?? null"
      :cluster-chooser-open="props.clusterChooserOpen ?? false"
      :cluster-move-targeting="props.clusterMoveTargeting ?? false"
      :move-targeting="props.moveTargeting ?? false"
      :standalone-import-placement-enabled="props.standaloneImportPlacementEnabled ?? false"
      :standalone-import-placement="props.standaloneImportPlacement ?? null"
      :keyboard-owned-overlay-open="props.keyboardOwnedOverlayOpen ?? false"
      :get-usable-client-rect="measureUnobstructedClientRect"
      :initial-viewport="props.initialViewport"
      touch-navigation
      @activate-system="handleSystemActivation"
      @select-object="(systemId, objectId) => emit('select-continuous-object', systemId, objectId)"
      @select-orbit="(systemId, orbitId) => emit('select-continuous-orbit', systemId, orbitId)"
      @select-route="handleRouteSelection"
      @cluster-target="forwardClusterTarget"
      @continuous-object-add-target="emit('continuous-object-add-target', $event)"
      @orbit-adjustment="forwardOrbitAdjustment"
      @entity-command-blocked="emit('entity-command-blocked', $event)"
      @move-object-in-system="forwardMoveObjectInSystem"
      @move-orbit-center="forwardMoveOrbitCenter"
      @orbit-center-candidates="forwardOrbitCenterCandidates"
      @resize-orbit="forwardResizeOrbit"
      @rotate-orbit="forwardRotateOrbit"
      @standalone-import-placement-anchor="forwardStandaloneImportPlacementAnchor"
      @move-target="forwardMoveTarget"
      @move-system="forwardMoveSystem"
      @editing-gesture-change="orbitInput.setChildGestureActive"
      @viewport-change="emitViewport"
    />
    <ClusterMap
      v-else-if="props.activeView === 'cluster'"
      ref="clusterMapRef"
      :cluster="props.workspace.cluster"
      :system-positions="props.workspace.layout.systemPositions"
      :unresolved-exit-positions="props.workspace.layout.unresolvedExitPositions"
      :selected-system-id="props.selectedSystemId"
      :selected-route-id="props.selectedRouteId"
      :move-enabled="props.mode === 'move' && props.clusterAddType == null"
      :system-activation="props.mode === 'select' || props.mode === 'move' ? 'select' : 'open'"
      :cluster-add-type="props.clusterAddType ?? null"
      :cluster-chooser-open="props.clusterChooserOpen ?? false"
      :cluster-move-targeting="props.clusterMoveTargeting ?? false"
      :move-targeting="props.moveTargeting ?? false"
      touch-navigation
      :show-zoom-controls="false"
      @activate-system="handleSystemActivation"
      @select-route="handleRouteSelection"
      @move-system="forwardMoveSystem"
      @move-unresolved-exit="(id, point) => emit('move-unresolved-exit', id, point)"
      @move-target="forwardMoveTarget"
      @cluster-target="forwardClusterTarget"
      @cancel-cluster-preview="emit('cancel-cluster-preview')"
      @editing-gesture-change="orbitInput.setChildGestureActive"
      @viewport-change="emitViewport"
    />
    <SystemMap
      v-else-if="props.system"
      ref="systemMapRef"
      :system="props.system"
      :orbit-radii="props.workspace.layout.orbitRadii"
      :orbit-rotations="props.workspace.layout.orbitRotations"
      :object-angles="props.workspace.layout.objectAngles"
      :creation-type="props.creationType ?? null"
      :creation-preview="props.creationPreview ?? null"
      :creation-chooser-open="props.creationChooserOpen ?? false"
      :orbit-adjustment-preview="matchingOrbitAdjustmentPreview"
      :selected-object-id="props.selectedObjectId"
      :selected-object-ids="props.selectedObjectIds"
      :begin-selected-object-drag="commands.move.beginSelectedObjectDrag"
      :clear-object-selection-for-move="commands.navigation.clearObjectSelectionForMove"
      :selected-orbit-id="props.selectedOrbitId"
      :dimmed-object-ids="props.dimmedObjectIds"
      :is-object-move-blocked="props.isObjectMoveBlocked"
      :is-entity-command-blocked="props.isEntityCommandBlocked"
      :move-enabled="props.mode === 'move' && !props.creationType"
      :move-targeting="props.moveTargeting ?? false"
      touch-navigation
      :show-zoom-controls="false"
      @select-object="handleObjectSelection"
      @select-orbit="handleOrbitSelection"
      @orbit-adjustment="forwardOrbitAdjustment"
      @move-target="forwardMoveTarget"
      @object-move-blocked="forwardBlockedObjectMove"
      @object-move-candidates="forwardObjectMoveCandidates"
      @orbit-center-candidates="forwardOrbitCenterCandidates"
      @entity-command-blocked="emit('entity-command-blocked', $event)"
      @move-object="forwardMoveObject"
      @move-orbit-center="forwardMoveOrbitCenter"
      @rotate-object="forwardRotateObject"
      @resize-orbit="forwardResizeOrbit"
      @rotate-orbit="forwardRotateOrbit"
      @place-object-in-orbit="forwardPlaceObject"
      @creation-target="forwardCreationTarget"
      @creation-drop-target="forwardCreationDropTarget"
      @cancel-creation-preview="forwardCancelCreationPreview"
      @cancel-object-placement-preview="emit('cancel-object-placement-preview')"
      @cancel-orbit-placement-preview="emit('cancel-orbit-placement-preview')"
      @editing-gesture-change="orbitInput.setChildGestureActive"
      @viewport-change="handleSystemViewportChange"
    />
  </div>
</template>

<script setup lang="ts">
/** Owns pointer arbitration around one stable map surface and forwards validated renderer commands. */
import { computed, onBeforeUnmount, onMounted, nextTick, shallowRef, watch } from 'vue'
import type {
  LocalWorkspace,
  OrbitRadii,
  Point,
  StarSystem,
} from '../domain/workspace'
import type { StandaloneImportPlacementView } from '../composables/useWorkspaceFiles'
import type {
  MapInteractionMode,
  MapHistoryTarget,
  OrbitCenterMoveCandidate,
  OrbitPlacementPreview,
  SystemCreationCandidate,
  SystemCreationPreview,
  SystemCreationType,
  SystemObjectMoveCandidate,
  SystemObjectMoveTarget,
} from '../composables/editor-workflows/types'
import type { EntityCommand } from '../composables/editor-workflows/types'
import type {
  OrbitAdjustmentInput,
  OrbitAdjustmentIntent,
  OrbitAdjustmentPreview,
} from '../composables/editor-workflows/continuous-orbit-adjustments'
import type { MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import { useEditorCommands } from '../composables/editor-workflows/editor-command-context'
import type { PublicationMenuLease, PublicationTarget } from '../composables/editor-workflows/publication-types'
import type { MapViewport } from '../utils/map-zoom'
import type { SearchTarget } from '../utils/workspace-search'
import type { InspectedMapTarget } from '../stores/editor-ui'
import type { ContinuousObjectAddTarget } from '../utils/continuous-map-editing'
import { clientRectToSvgViewportRect, MAP_ZOOM_MIN_SCALE, type SvgViewportRect } from '../utils/map-zoom'
import { MAP_TOUCH_PAN_THRESHOLD_PX } from './maps/map-touch-navigation'
import { largestUnobstructedClientRect, type ClientRectBounds } from '../utils/map-usable-area'
import { createOwnedTouchReleaseGuard } from './maps/owned-touch-release'
import { useOrbitPlacementInput } from './maps/useOrbitPlacementInput'
import ClusterMap from './ClusterMap.vue'
import ContinuousWardenMap from './ContinuousWardenMap.vue'
import SystemMap from './SystemMap.vue'

const props = defineProps<{
  activeView: 'cluster' | 'system'
  continuousMap?: boolean
  inspectedTarget?: InspectedMapTarget | null
  mapKey: string
  initialViewport: MapViewport | null
  workspace: LocalWorkspace
  system: StarSystem | undefined
  selectedSystemId: string | null
  selectedObjectId: string | null
  selectedObjectIds: readonly string[]
  selectedOrbitId: string | null
  dimmedObjectIds?: readonly string[]
  selectedRouteId: string | null
  mode: MapInteractionMode
  isObjectMoveBlocked?: (objectId: string) => boolean
  isEntityCommandBlocked?: (command: EntityCommand) => boolean
  feedbackElement?: HTMLElement | null
  creationType?: SystemCreationType | null
  creationOtherType?: string | null
  objectAddPinnedOwnerId?: string | null
  creationPreview?: SystemCreationPreview | null
  creationChooserOpen?: boolean
  clusterAddType?: 'system' | 'route' | null
  clusterChooserOpen?: boolean
  clusterMoveTargeting?: boolean
  orbitAdjustmentPreview?: OrbitAdjustmentPreview | null
  /** A focused placement controller currently owns scene clicks and arrow keys. */
  moveTargeting?: boolean
  standaloneImportPlacementEnabled?: boolean
  standaloneImportPlacement?: StandaloneImportPlacementView | null
  keyboardOwnedOverlayOpen?: boolean
}>()
const commands = useEditorCommands()

const emit = defineEmits<{
  'navigate-system': [id: string]
  'select-continuous-object': [systemId: string, objectId: string]
  'select-continuous-orbit': [systemId: string, orbitId: string]
  'select-cluster-system': [id: string]
  'move-select-cluster-system': [id: string]
  'select-route': [id: string]
  'move-select-route': [id: string]
  'select-object': [id: string]
  'move-select-object': [id: string]
  'select-orbit': [id: string]
  'move-select-orbit': [id: string]
  'orbit-adjustment': [intent: OrbitAdjustmentIntent]
  'object-move-blocked': [id: string]
  'object-move-candidates': [id: string, candidates: SystemObjectMoveCandidate[]]
  'orbit-center-candidates': [id: string, candidates: OrbitCenterMoveCandidate[], systemId?: string]
  'entity-command-blocked': [command: EntityCommand]
  'move-system': [id: string, position: Point]
  'move-unresolved-exit': [id: string, position: Point]
  'move-target': [point: Point]
  'move-nudge': [delta: Point]
  'cancel-map-move': []
  'cluster-target': [point: Point, systemIds: string[]]
  'continuous-object-add-target': [request: ContinuousObjectAddTarget]
  'move-object-in-system': [systemId: string, objectId: string, position: Point, workspaceSnapshot: LocalWorkspace]
  'standalone-import-placement-anchor': [anchor: Point]
  'cancel-standalone-import-placement': []
  'cancel-cluster-preview': []
  'cancel-object-placement-preview': []
  'cancel-orbit-placement-preview': []
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null, systemId?: string, sourceGeometry?: string]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: OrbitRadii, systemId?: string, sourceGeometry?: string]
  'rotate-orbit': [id: string, rotation: number, systemId?: string, sourceGeometry?: string]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'creation-target': [candidates: SystemCreationCandidate[]]
  'creation-drop-target': [type: SystemCreationType, candidates: SystemCreationCandidate[]]
  'cancel-creation-preview': []
  'editing-gesture-change': [active: boolean]
  'viewport-change': [change: { key: string; viewport: MapViewport }]
}>()

type ClusterMapHandle = InstanceType<typeof ClusterMap>
type ContinuousWardenMapHandle = InstanceType<typeof ContinuousWardenMap>
type SystemMapInstance = InstanceType<typeof SystemMap>
const clusterMapRef = shallowRef<ClusterMapHandle | null>(null)
const continuousWardenMapRef = shallowRef<ContinuousWardenMapHandle | null>(null)
const systemMapRef = shallowRef<SystemMapInstance | null>(null)
const canvasRoot = shallowRef<HTMLElement | null>(null)
const currentClusterMap = () => props.continuousMap ? continuousWardenMapRef.value : clusterMapRef.value
const currentMap = () => props.activeView === 'cluster' ? currentClusterMap() : systemMapRef.value

function dismissSearchLocator(): void {
  if (props.continuousMap) continuousWardenMapRef.value?.dismissSearchLocator()
  else systemMapRef.value?.dismissSearchLocator()
}

function noteManualCameraInteraction(): void {
  cameraInteractionVersion += 1
}

const matchingOrbitAdjustmentPreview = computed(() => {
  const preview = props.orbitAdjustmentPreview
  if (!preview || preview.identity.workspaceId !== props.workspace.id) return null
  if (props.activeView === 'system') {
    return props.system?.id === preview.identity.systemId ? preview : null
  }
  return props.continuousMap && props.workspace.cluster.systems.some(system => system.id === preview.identity.systemId
    && system.orbits.some(orbit => orbit.id === preview.identity.orbitId))
    ? preview
    : null
})
let activePointerPan: { id: number; button: number; x: number; y: number; moved: boolean } | null = null
let activeMousePointerId: number | null = null
let editingGestureActive = false
let orbitOrChildGestureActive = false
type LivePointerSequence = {
  pointerId: number
  pointerType: string
  cancelledRelease: boolean
}
const livePointerSequences = new Map<number, LivePointerSequence>()
let pointerLongPress: {
  id: number
  x: number
  y: number
  target: EventTarget | null
  addHold: boolean
  timer: ReturnType<typeof setTimeout>
} | null = null
let consumedAddPointerId: number | null = null
let consumedAddTouchId: number | null = null
const sourceMapKey = props.mapKey
let mapReady = false
let mapDisposed = false
let mapReadinessResult: boolean | undefined
let resolveMapReadiness: (ready: boolean) => void = () => undefined
const mapReadiness = new Promise<boolean>(resolve => { resolveMapReadiness = resolve })
let suppressNextClick = false
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
let suppressNextContextMenu = false
let suppressContextMenuTimer: ReturnType<typeof setTimeout> | undefined
let cameraInteractionVersion = 0
let pendingRightClickContextMenu: {
  pointerId: number
  target: EventTarget | null
  clientPoint: { x: number; y: number }
} | null = null
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let publicationMenuLease: PublicationMenuLease | null = null
let touchStart: { id: number; x: number; y: number; target: EventTarget | null } | null = null
let touchPanStarted = false
let touchReleaseGuard: ReturnType<typeof createOwnedTouchReleaseGuard> | null = null
let selectionRectangleGesture: {
  pointerId: number
  svg: SVGSVGElement
  mapKey: string
  systemId: string | undefined
  start: Point
  current: Point
  moved: boolean
} | null = null
const selectionRectangle = shallowRef<{ left: number; top: number; width: number; height: number } | null>(null)

function syncEditingGestureActive(): void {
  const active = !mapDisposed && (orbitOrChildGestureActive || selectionRectangleGesture !== null)
  if (editingGestureActive === active) return
  editingGestureActive = active
  emit('editing-gesture-change', active)
}

function setOrbitOrChildGestureActive(active: boolean): void {
  orbitOrChildGestureActive = active
  syncEditingGestureActive()
}

function canContinueSelectionRectangle(gesture: NonNullable<typeof selectionRectangleGesture>): boolean {
  return gesture.svg.isConnected
    && props.activeView === 'system'
    && props.mode === 'select'
    && !props.moveTargeting
    && !props.creationType
    && !props.creationChooserOpen
    && props.mapKey === gesture.mapKey
    && props.system?.id === gesture.systemId
}

function isSystemMapEmptySpace(target: EventTarget | null): { svg: SVGSVGElement; canvas: HTMLElement } | null {
  if (props.activeView !== 'system' || props.mode !== 'select' || props.moveTargeting
    || props.creationType || props.creationChooserOpen) return null
  if (!(target instanceof Element) || !canvasRoot.value
    || target.closest('.system-object, .orbit-mark, .orbit-hit-target, .orbit-edit-control')) return null
  const svg = target.closest<SVGSVGElement>('svg.system-map-svg')
  return svg && canvasRoot.value.contains(svg) ? { svg, canvas: canvasRoot.value } : null
}

function beginSelectionRectangle(event: PointerEvent): boolean {
  if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary
    || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = isSystemMapEmptySpace(event.target)
  if (!target) return false
  if (selectionRectangleGesture) finishSelectionRectangle(true)
  selectionRectangleGesture = {
    pointerId: event.pointerId,
    svg: target.svg,
    mapKey: props.mapKey,
    systemId: props.system?.id,
    start: { x: event.clientX, y: event.clientY },
    current: { x: event.clientX, y: event.clientY },
    moved: false,
  }
  activePointerPan = null
  selectionRectangle.value = null
  syncEditingGestureActive()
  return true
}

function updateSelectionRectangle(event: PointerEvent): void {
  const gesture = selectionRectangleGesture
  if (!gesture || gesture.pointerId !== event.pointerId) return
  if (!canContinueSelectionRectangle(gesture)) {
    finishSelectionRectangle(true)
    return
  }
  const left = Math.min(gesture.start.x, event.clientX)
  const top = Math.min(gesture.start.y, event.clientY)
  const width = Math.abs(event.clientX - gesture.start.x)
  const height = Math.abs(event.clientY - gesture.start.y)
  gesture.current = { x: event.clientX, y: event.clientY }
  if (!gesture.moved && Math.hypot(width, height) < 6) return
  gesture.moved = true
  const canvasBounds = canvasRoot.value?.getBoundingClientRect()
  if (!canvasBounds) return
  selectionRectangle.value = {
    left: left - canvasBounds.left,
    top: top - canvasBounds.top,
    width,
    height,
  }
}

function clearSelectionRectangle(): void {
  selectionRectangleGesture = null
  selectionRectangle.value = null
}

function finishSelectionRectangle(cancelled: boolean): void {
  const gesture = selectionRectangleGesture
  if (!gesture) return
  clearSelectionRectangle()
  syncEditingGestureActive()
  holdClickSuppression()
  if (cancelled) return
  gesture.svg.focus({ preventScroll: true })
  if (!gesture.moved) {
    void commands.navigation.replaceObjectSelection([])
    return
  }
  void commands.navigation.replaceObjectSelection(systemMapRef.value?.getObjectIdsWithinClientRect({
    left: Math.min(gesture.start.x, gesture.current.x),
    top: Math.min(gesture.start.y, gesture.current.y),
    right: Math.max(gesture.start.x, gesture.current.x),
    bottom: Math.max(gesture.start.y, gesture.current.y),
  }) ?? [])
}

const orbitInput = useOrbitPlacementInput({
  root: () => canvasRoot.value,
  map: () => systemMapRef.value,
  isSystemView: () => props.activeView === 'system',
  mapKey: () => props.mapKey,
  hasAddOrbitIntent: hasOrbitAddIntent,
  begin: scenePoint => commands.creation.beginOrbitDrag(scenePoint),
  update: (scenePoint, clearance) => commands.creation.updateOrbitDrag(scenePoint, clearance),
  complete: () => commands.creation.completeOrbitDrag(),
  cancel: () => commands.creation.cancelOrbitDrag(),
  clearPointerLongPress,
  clearLongPress,
  holdClickSuppression,
  releaseCanvasPointer(pointerId) {
    livePointerSequences.delete(pointerId)
    if (activeMousePointerId === pointerId) activeMousePointerId = null
    if (activePointerPan?.id === pointerId) {
      currentMap()?.endViewPan()
      activePointerPan = null
    }
  },
  canContinueCancelledPointerPan: pointerId => activePointerPan?.id === pointerId,
  editingGestureChange: setOrbitOrChildGestureActive,
})

function holdClickSuppression(): void {
  suppressNextClick = true
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  suppressClickTimer = setTimeout(() => { suppressNextClick = false }, 900)
}

function holdContextMenuSuppression(): void {
  suppressNextContextMenu = true
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
  suppressContextMenuTimer = setTimeout(() => { suppressNextContextMenu = false }, 900)
}

function clearStaleGestureSuppression(): void {
  suppressNextClick = false
  suppressNextContextMenu = false
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
}

function clearLongPress(): void {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function clearPointerLongPress(): void {
  if (pointerLongPress) clearTimeout(pointerLongPress.timer)
  pointerLongPress = null
}

function onWindowClickCapture(event: MouseEvent): void { orbitInput.onClickCapture(event) }

function onWindowPointerDownCapture(event: PointerEvent): void {
  orbitInput.onGlobalPointerDown(event)
}

function onDocumentKeyDownCapture(event: KeyboardEvent): void {
  orbitInput.onEscape(event)
}

function onLostPointerCapture(event: PointerEvent): void { orbitInput.onLostPointerCapture(event) }

function onWheelCapture(event: WheelEvent): void {
  noteManualCameraInteraction()
  pendingRightClickContextMenu = null
  dismissSearchLocator()
  orbitInput.onWheelCapture(event)
}

function cancelMapGesture(): void { currentMap()?.cancelActiveGesture() }

function cancelCanvasGesture(suppressRelease = false, cancelClusterPreview = true): void {
  const orbitPointerId = orbitInput.pointerId()
  pendingRightClickContextMenu = null
  orbitInput.cancel()
  if (suppressRelease) {
    for (const sequence of livePointerSequences.values()) {
      if (sequence.pointerId !== orbitPointerId) sequence.cancelledRelease = true
    }
  }
  finishSelectionRectangle(true)
  emit('cancel-map-move')
  if (cancelClusterPreview && props.activeView === 'cluster') emit('cancel-cluster-preview')
  clearLongPress()
  clearPointerLongPress()
  touchStart = null
  touchPanStarted = false
  activePointerPan = null
  if (props.activeView === 'system') {
    emit('cancel-object-placement-preview')
    emit('cancel-orbit-placement-preview')
    systemMapRef.value?.cancelCreationPreview()
  }
  currentMap()?.cancelActiveGesture()
  if (suppressRelease && orbitPointerId === undefined) holdClickSuppression()
}

function cancelForFocusInterruption(): void {
  // This parent-owned preview exists even when the map renderer has no active gesture to cancel.
  if (props.activeView === 'cluster') emit('cancel-cluster-preview')
  cancelCanvasGesture(true, false)
}

function onWindowBlur(): void { cancelForFocusInterruption() }

function onDocumentVisibilityChange(): void {
  if (document.visibilityState === 'hidden') cancelForFocusInterruption()
}

function onDocumentFreeze(): void { cancelForFocusInterruption() }

function hasClusterAddIntent(): boolean {
  return props.activeView === 'cluster' && props.clusterAddType != null
}

function hasMapAddIntent(): boolean {
  return props.standaloneImportPlacementEnabled === true
    || hasClusterAddIntent()
    || hasContinuousObjectAddIntent()
    || (props.activeView === 'system' && props.creationType != null)
}

function hasContinuousObjectAddIntent(): boolean {
  return props.activeView === 'cluster' && props.continuousMap && props.creationType?.kind === 'object'
}

function forwardMoveObjectInSystem(
  systemId: string,
  objectId: string,
  position: Point,
  workspaceSnapshot: LocalWorkspace,
): void {
  holdClickSuppression()
  emit('move-object-in-system', systemId, objectId, position, workspaceSnapshot)
}

function hasOrbitAddIntent(): boolean {
  return props.activeView === 'system'
    && props.creationType?.kind === 'orbit'
    && !props.creationChooserOpen
    && !props.moveTargeting
}

function isMapEntityTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && !!target.closest(
      '.cluster-system-node, .cluster-route, .system-object, .orbit-mark, .orbit-hit-target, .orbit-edit-control, '
      + '.continuous-warden-object, .continuous-warden-orbit-target, .continuous-warden-orbit-edit-handle',
    )
}

function longPressInspection(target: EventTarget | null): (() => void) | null {
  if (!(target instanceof Element)) return null
  const objectTarget = target.closest<SVGGElement>('.continuous-warden-object[data-system-id][data-object-id]')
  const objectSystemId = objectTarget?.getAttribute('data-system-id')
  const continuousObjectId = objectTarget?.getAttribute('data-object-id')
  if (objectSystemId && continuousObjectId) return () => emit('select-continuous-object', objectSystemId, continuousObjectId)
  const orbitTarget = target.closest<SVGElement>(
    '.continuous-warden-orbit-target[data-system-id][data-orbit-id], .continuous-warden-orbit-edit-handle[data-system-id][data-orbit-id]',
  )
  const orbitSystemId = orbitTarget?.getAttribute('data-system-id')
  const continuousOrbitId = orbitTarget?.getAttribute('data-orbit-id')
  if (orbitSystemId && continuousOrbitId) return () => emit('select-continuous-orbit', orbitSystemId, continuousOrbitId)
  const systemId = target.closest<SVGGElement>('.cluster-system-node')?.getAttribute('data-system-id')
  if (systemId) {
    return () => emit('select-cluster-system', systemId)
  }
  const routeId = target.closest<SVGGElement>('.cluster-route')?.getAttribute('data-route-id')
  if (routeId) {
    return () => emit('select-route', routeId)
  }
  const objectId = target.closest<SVGGElement>('.system-object')?.getAttribute('data-object-id')
  if (objectId) {
    return () => emit('select-object', objectId)
  }
  const orbitId = target.closest<SVGGElement>('.orbit-mark, .orbit-hit-target, .orbit-edit-control')?.getAttribute('data-orbit-id')
  return orbitId ? () => emit('select-orbit', orbitId) : null
}

function inspectLongPress(target: EventTarget | null): void {
  longPressInspection(target)?.()
}

function beginLivePointerSequence(event: PointerEvent, isMouseButtonChord: boolean): void {
  if (isMouseButtonChord) return
  if (event.isPrimary) {
    for (const [pointerId, sequence] of livePointerSequences) {
      if (sequence.pointerType === event.pointerType) livePointerSequences.delete(pointerId)
    }
    // A new primary sequence owns any stale suppression left after its previous input ended.
    if (!activePointerPan) clearStaleGestureSuppression()
  }
  livePointerSequences.set(event.pointerId, {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    cancelledRelease: false,
  })
}

function onPointerDownCapture(event: PointerEvent): void {
  dismissSearchLocator()
  pendingRightClickContextMenu = null
  publicationMenuLease?.close()
  publicationMenuLease = null
  const isMouseButtonChord = event.pointerType === 'mouse'
    && event.button === 2
    && (event.buttons & 1) !== 0
  beginLivePointerSequence(event, isMouseButtonChord)
  if (!isMouseButtonChord) consumedAddPointerId = null
  if (event.pointerType === 'mouse') activeMousePointerId = event.pointerId
  if (event.pointerType === 'touch') {
    orbitInput.onPointerDown(event)
    return
  }
  if (orbitInput.onPointerDown(event)) return
  if (event.button !== 0 && event.button !== 2) return
  // A right-button chord takes ownership as a pan and cancels the pending rectangle.
  if (event.button === 2 && selectionRectangleGesture) finishSelectionRectangle(true)
  if (beginSelectionRectangle(event)) {
    event.stopImmediatePropagation()
    return
  }
  const entityPress = event.button === 0 && isMapEntityTarget(event.target)
  const addHold = hasMapAddIntent() && entityPress
  const inspectHold = !hasMapAddIntent()
    && !props.moveTargeting
    && (props.mode === 'navigate' || props.mode === 'move')
    && entityPress
  if (addHold || inspectHold) {
    clearPointerLongPress()
    const pointerId = event.pointerId
    const target = event.target
    const timer = setTimeout(() => {
      if (pointerLongPress?.id !== pointerId) return
      pointerLongPress = null
      if (addHold) {
        consumedAddPointerId = pointerId
        cancelMapGesture()
        return
      }
      if (props.activeView === 'cluster') emit('cancel-cluster-preview')
      if (props.activeView === 'system') {
        emit('cancel-object-placement-preview')
        emit('cancel-orbit-placement-preview')
      }
      cancelMapGesture()
      holdClickSuppression()
      inspectLongPress(target)
    }, 560)
    pointerLongPress = { id: pointerId, x: event.clientX, y: event.clientY, target, addHold, timer }
  }
  const isRightPan = event.button === 2
  const isBackgroundPan = props.mode === 'move' && !hasContinuousObjectAddIntent() && !props.moveTargeting
    && event.button === 0 && !isMapEntityTarget(event.target)
  const isNavigationPan = props.mode !== 'move' && !hasContinuousObjectAddIntent() && event.button === 0
  if (!isRightPan && !isBackgroundPan && !isNavigationPan) return

  if (isRightPan && props.moveTargeting) emit('cancel-map-move')
  currentMap()?.startViewPan(event)
  activePointerPan = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, moved: false }
  if (isRightPan) holdClickSuppression()
  // Prevent D3's map gesture from competing with this view-only pan. Click activation still runs on release.
  event.stopImmediatePropagation()
}

/** Takes over a held left-button gesture when the browser reports right-button chord only as mousedown. */
function onMouseDownCapture(event: MouseEvent): void {
  publicationMenuLease?.close()
  publicationMenuLease = null
  if (event.button === 0 && orbitInput.hasActivePointer()) {
    event.stopImmediatePropagation()
    return
  }
  const rectangleGesture = selectionRectangleGesture
  if (event.button === 0 && rectangleGesture && rectangleGesture.pointerId === activeMousePointerId
    && event.target instanceof Node && rectangleGesture.svg.contains(event.target)) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  if (event.button !== 2 || (event.buttons & 1) === 0 || activeMousePointerId === null) return
  // Browsers that emit a second pointerdown already entered the ordinary right-pan path.
  if (activePointerPan?.button === 2) return

  cancelCanvasGesture()
  currentMap()?.startViewPan(event)
  activePointerPan = {
    id: activeMousePointerId,
    button: 2,
    x: event.clientX,
    y: event.clientY,
    moved: false,
  }
  holdClickSuppression()
  event.stopImmediatePropagation()
}

function onMouseUpCapture(event: MouseEvent): void {
  orbitInput.onMouseUpCapture(event)
}

function onKeyDownCapture(event: KeyboardEvent): void {
  if (!event.defaultPrevented && isStandaloneImportMapKeyEvent(event)) {
    if (event.key === 'Escape') {
      dismissSearchLocator()
      event.preventDefault()
      event.stopPropagation()
      emit('cancel-standalone-import-placement')
      return
    }
    const panDeltas: Record<string, [number, number]> = {
      ArrowLeft: [-80, 0],
      ArrowRight: [80, 0],
      ArrowUp: [0, -80],
      ArrowDown: [0, 80],
    }
    const delta = panDeltas[event.key]
    if (delta) {
      dismissSearchLocator()
      event.preventDefault()
      event.stopPropagation()
      panBy(delta[0], delta[1])
      return
    }
  }

  if (event.target instanceof SVGElement && !event.isComposing
    && (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ContextMenu'].includes(event.key)
      || (event.key === 'F10' && event.shiftKey)
      || (event.target.closest('[role="slider"]') && ['Home', 'End'].includes(event.key)))) {
    dismissSearchLocator()
  }
  if ((event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
    && event.target instanceof SVGElement) {
    const bounds = event.target.getBoundingClientRect()
    if (showPublicationMenu(event, { x: bounds.left, y: bounds.bottom })) return
  }
  if ((props.moveTargeting || props.clusterMoveTargeting)
    && props.mode === 'move' && event.target instanceof SVGElement) {
    const step = event.shiftKey ? 10 : 1
    const nudges: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }
    const nudge = nudges[event.key]
    if (nudge) {
      event.preventDefault()
      event.stopPropagation()
      emit('move-nudge', nudge)
      return
    }
  }
  if (event.key === 'Escape' && props.activeView === 'system' && props.mode === 'select') {
    if (selectionRectangleGesture) {
      event.preventDefault()
      event.stopPropagation()
      cancelCanvasGesture(true)
      return
    }
  }
  if (event.key === 'Escape' && props.activeView === 'system') {
    const focusedSystemMap = event.target instanceof Element
      ? event.target.closest<SVGSVGElement>('svg.system-map-svg')
      : null
    const clearSelectionInSelect = props.mode === 'select'
      && (props.selectedObjectIds.length > 0 || props.selectedObjectId !== null)
    const clearGroupInMove = props.mode === 'move' && props.selectedObjectIds.length > 1
      && !props.moveTargeting && !props.creationType && !props.creationChooserOpen
    if ((clearSelectionInSelect || clearGroupInMove)
      && !activePointerPan && !touchStart && !touchPanStarted && livePointerSequences.size === 0
      && !editingGestureActive
      && focusedSystemMap && canvasRoot.value?.contains(focusedSystemMap)) {
      event.preventDefault()
      event.stopPropagation()
      void commands.navigation.replaceObjectSelection([])
      return
    }
  }
  if (!(event.target instanceof SVGSVGElement)) return
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-80, 0],
    ArrowRight: [80, 0],
    ArrowUp: [0, -80],
    ArrowDown: [0, 80],
  }
  const delta = deltas[event.key]
  if (!delta) return
  event.preventDefault()
  event.stopPropagation()
  panBy(delta[0], delta[1])
}

function eventOwnedByKeyboardPopup(event: KeyboardEvent): boolean {
  return event.composedPath().some(target => target instanceof Element && (
    ['alertdialog', 'dialog', 'listbox', 'menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio']
      .includes(target.getAttribute('role') ?? '')
    || target.getAttribute('role') === 'combobox' && target.getAttribute('aria-expanded') === 'true'
  ))
}

function isStandaloneImportMapKeyEvent(event: KeyboardEvent): boolean {
  return !event.isComposing
    && event.keyCode !== 229
    && props.standaloneImportPlacementEnabled === true
    && !props.keyboardOwnedOverlayOpen
    && !eventOwnedByKeyboardPopup(event)
    && event.target instanceof SVGElement
    && !!event.target.closest('svg.continuous-warden-map-svg')
}

function onWindowKeyDownCapture(event: KeyboardEvent): void {
  const ownsGesture = selectionRectangleGesture !== null
    || editingGestureActive
    || activePointerPan !== null
    || touchPanStarted
    || orbitInput.hasActivePointer()
  const cancelStandaloneImport = event.key === 'Escape'
    && !event.defaultPrevented && isStandaloneImportMapKeyEvent(event)
  if (event.key !== 'Escape' || (!ownsGesture && !cancelStandaloneImport)) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  if (cancelStandaloneImport) {
    dismissSearchLocator()
    emit('cancel-standalone-import-placement')
  }
  cancelCanvasGesture(true)
}

/** Forwards a scene-space destination only while the active Move controller owns targeting. */
function forwardMoveTarget(point: Point): void {
  if ((props.moveTargeting || props.clusterMoveTargeting)
    && props.mode === 'move' && !suppressNextClick) emit('move-target', point)
}

function onWindowPointerMove(event: PointerEvent): void {
  if (orbitInput.onPointerMove(event)) return

  if (pointerLongPress?.id === event.pointerId
    && Math.hypot(event.clientX - pointerLongPress.x, event.clientY - pointerLongPress.y) > 9) {
    const addHold = pointerLongPress.addHold
    clearPointerLongPress()
    if (addHold) holdClickSuppression()
  }
  if (selectionRectangleGesture?.pointerId === event.pointerId) {
    updateSelectionRectangle(event)
    if (selectionRectangleGesture?.moved) {
      event.preventDefault()
      holdClickSuppression()
    }
    return
  }
  const pan = activePointerPan
  if (!pan || event.pointerId !== pan.id) return
  const dx = event.clientX - pan.x
  const dy = event.clientY - pan.y
  if (!pan.moved && Math.hypot(dx, dy) < 4) return
  const firstPanMove = !pan.moved
  pan.moved = true
  if (firstPanMove) noteManualCameraInteraction()
  if (firstPanMove && props.activeView === 'cluster') emit('cancel-cluster-preview')
  if (pan.button === 2) {
    if (pendingRightClickContextMenu?.pointerId === pan.id) pendingRightClickContextMenu = null
    event.preventDefault()
    holdContextMenuSuppression()
  }
  currentMap()?.moveViewPan(event)
  holdClickSuppression()
}

function onWindowPointerUp(event: PointerEvent): void {
  if (orbitInput.onPointerUp(event)) return
  if (event.type === 'pointercancel') {
    if (pendingRightClickContextMenu?.pointerId === event.pointerId) pendingRightClickContextMenu = null
    if (consumedAddPointerId === event.pointerId) {
      holdClickSuppression()
      consumedAddPointerId = null
    }
    if (activeMousePointerId === event.pointerId) activeMousePointerId = null
    cancelCanvasGesture(true)
    livePointerSequences.delete(event.pointerId)
    return
  }

  const sequence = livePointerSequences.get(event.pointerId)
  if (sequence && event.buttons !== 0) return
  if (sequence) {
    // Keep pointerup available to D3 and the browser; only renew the click guard for its later click.
    if (sequence.cancelledRelease) holdClickSuppression()
    livePointerSequences.delete(event.pointerId)
  }
  if (pointerLongPress?.id === event.pointerId) clearPointerLongPress()
  const ownsActiveMousePointer = event.pointerType === 'mouse'
    && activeMousePointerId === event.pointerId
  if (selectionRectangleGesture?.pointerId === event.pointerId) {
    if (ownsActiveMousePointer) activeMousePointerId = null
    const gesture = selectionRectangleGesture
    updateSelectionRectangle(event)
    finishSelectionRectangle(!canContinueSelectionRectangle(gesture)
      || (!gesture.moved && !isSystemMapEmptySpace(event.target)))
    return
  }
  if (ownsActiveMousePointer && !activePointerPan && isDisabledObstructionRelease(event)) {
    activeMousePointerId = null
    cancelMapGesture()
    return
  }
  if (consumedAddPointerId === event.pointerId) {
    holdClickSuppression()
    consumedAddPointerId = null
  }
  if (ownsActiveMousePointer) activeMousePointerId = null
  if (!activePointerPan || event.pointerId !== activePointerPan.id) return
  const pan = activePointerPan
  currentMap()?.endViewPan()
  activePointerPan = null
  if (pan.button === 2 && !pan.moved && event.pointerType === 'mouse' && event.button === 2
    && event.buttons === 0 && pendingRightClickContextMenu?.pointerId === event.pointerId) {
    const pending = pendingRightClickContextMenu
    pendingRightClickContextMenu = null
    const canvas = canvasRoot.value
    if (canvas && event.target instanceof Node && canvas.contains(event.target)
      && pending.target instanceof Node && canvas.contains(pending.target)
      && openPublicationMenu(pending.target, pending.clientPoint)) {
      holdContextMenuSuppression()
    }
  }
}

function isDisabledObstructionRelease(event: PointerEvent): boolean {
  if (!(event.target instanceof Element)) return false
  const canvas = canvasRoot.value
  if (!canvas || canvas.contains(event.target)) return false
  const obstruction = event.target.closest<HTMLElement>('[data-map-obstruction]')
  if (!obstruction || canvas.contains(obstruction)) return false
  const disabledButton = event.target.closest<HTMLButtonElement>('button:disabled')
  return disabledButton !== null && obstruction.contains(disabledButton)
}

function onContextMenuCapture(event: MouseEvent): void {
  event.preventDefault()
  const pan = activePointerPan
  const isRightMouseContextMenu = event.button === 2
    && pan?.button === 2
    && livePointerSequences.get(pan.id)?.pointerType === 'mouse'
  if (event.button === 2
    && ((pan?.button === 2 && pan.moved) || suppressNextContextMenu)) {
    pendingRightClickContextMenu = null
    event.stopPropagation()
    event.stopImmediatePropagation()
    suppressNextContextMenu = false
    if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
    return
  }
  if (pan?.button === 2 && event.button === 2 && (event.buttons & 1) !== 0) {
    event.stopPropagation()
    event.stopImmediatePropagation()
    pendingRightClickContextMenu = null
    return
  }
  if (isRightMouseContextMenu && pan) {
    event.stopPropagation()
    event.stopImmediatePropagation()
    pendingRightClickContextMenu = {
      pointerId: pan.id,
      target: event.target,
      clientPoint: { x: event.clientX, y: event.clientY },
    }
    return
  }
  showPublicationMenu(event, { x: event.clientX, y: event.clientY })
}

function publicationTargetAt(target: EventTarget | null): { target: PublicationTarget; mark: SVGElement } | null {
  if (props.moveTargeting || props.clusterChooserOpen
    || props.clusterMoveTargeting
    || (props.activeView === 'cluster' && props.clusterAddType != null)
    || (props.activeView === 'cluster' && props.continuousMap && props.creationType?.kind === 'object')
    || (props.activeView === 'system' && (props.creationType != null || props.creationChooserOpen))) {
    return null
  }
  if (!(target instanceof Element)) return null

  if (props.activeView === 'cluster') {
    if (props.continuousMap) {
      const objectMark = target.closest<SVGGElement>('.continuous-warden-object[data-system-id][data-object-id]')
      const objectId = objectMark?.getAttribute('data-object-id')
      const systemId = objectMark?.getAttribute('data-system-id')
      if (objectId && systemId && objectMark) {
        return { target: { kind: 'object', id: objectId, systemId }, mark: objectMark }
      }
    }
    const mark = target.closest<SVGGElement>('.cluster-system-node[data-system-id]')
    const systemId = mark?.getAttribute('data-system-id')
    return systemId && mark
      ? { target: { kind: 'system', id: systemId, systemId }, mark }
      : null
  }

  const mark = target.closest<SVGGElement>('.system-object[data-object-id]')
  const objectId = mark?.getAttribute('data-object-id')
  const systemId = props.system?.id
  return objectId && systemId && mark
    ? { target: { kind: 'object', id: objectId, systemId }, mark }
    : null
}

function showPublicationMenu(
  event: MouseEvent | KeyboardEvent,
  point: { x: number; y: number },
): boolean {
  if (!openPublicationMenu(event.target, point)) return false
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  return true
}

function openPublicationMenu(target: EventTarget | null, point: { x: number; y: number }): boolean {
  const candidate = publicationTargetAt(target)
  if (!candidate) return false
  const lease = commands.publication.openMenu({
    target: candidate.target,
    clientPoint: point,
    opener: candidate.mark,
    source: 'map',
  }, { selectObjectForContext: true })
  if (!lease) return false
  publicationMenuLease = lease
  return true
}

function onClickCapture(event: MouseEvent): void {
  dismissSearchLocator()
  if (suppressNextClick && event.detail !== 0) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    suppressNextClick = false
    if (suppressClickTimer) clearTimeout(suppressClickTimer)
    return
  }
  if (event.detail > 0 && isSystemMapEmptySpace(event.target)) {
    void commands.navigation.replaceObjectSelection([])
  }
}

function onTouchStartCapture(event: TouchEvent): void {
  dismissSearchLocator()
  publicationMenuLease?.close()
  publicationMenuLease = null
  if (orbitInput.isTouchPending() && event.touches.length === 1) return
  if (orbitInput.onTouchStartCapture(event)) return
  if (event.touches.length !== 1) {
    if (event.touches.length > 1) noteManualCameraInteraction()
    clearLongPress()
    touchStart = null
    touchPanStarted = false
    if (event.touches.length > 1) {
      cancelCanvasGesture()
      holdClickSuppression()
    }
    return
  }
  const touch = event.touches[0]!
  consumedAddTouchId = null
  touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY, target: event.target }
  touchPanStarted = false
  clearLongPress()
  if (hasMapAddIntent()) {
    if (!isMapEntityTarget(event.target)) return
    const touchId = touch.identifier
    longPressTimer = setTimeout(() => {
      if (touchStart?.id !== touchId) return
      longPressTimer = undefined
      // Consume placement on release while leaving this contact available to pan.
      consumedAddTouchId = touchId
    }, 560)
    return
  }
  if (props.mode !== 'navigate' && props.mode !== 'move') return
  const touchId = touch.identifier
  longPressTimer = setTimeout(() => {
    const contact = touchStart
    if (!contact || contact.id !== touchId) return
    const inspection = longPressInspection(contact.target)
    if (props.activeView === 'cluster') emit('cancel-cluster-preview')
    if (props.activeView === 'system') {
      emit('cancel-object-placement-preview')
      emit('cancel-orbit-placement-preview')
    }
    if (inspection) {
      const touchPointerId = touchReleaseGuard?.pointerIdForTouch(touchId) ?? null
      cancelMapGesture()
      touchReleaseGuard?.arm({
        touchId,
        pointerId: touchPointerId,
        x: contact.x,
        y: contact.y,
      })
    }
    holdClickSuppression()
    inspection?.()
    touchStart = null
  }, 560)
}

function onTouchMoveCapture(event: TouchEvent): void {
  if (orbitInput.onTouchMoveCapture(event)) return
  if (event.touches.length > 1) {
    clearLongPress()
    touchStart = null
    holdClickSuppression()
  } else {
    const touch = event.touches[0]
    if (touchStart && touch && !touchPanStarted
      && Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > MAP_TOUCH_PAN_THRESHOLD_PX) {
      touchPanStarted = true
      noteManualCameraInteraction()
      clearLongPress()
      if (props.activeView === 'cluster') emit('cancel-cluster-preview')
      if (props.activeView === 'system') {
        emit('cancel-object-placement-preview')
        emit('cancel-orbit-placement-preview')
      }
      holdClickSuppression()
    }
  }
  currentMap()?.moveTouchNavigation(event)
}

function onTouchEndCapture(event: TouchEvent): void {
  if (orbitInput.onTouchEndCapture(event)) return
  if (consumedAddTouchId !== null
    && Array.from(event.changedTouches).some(touch => touch.identifier === consumedAddTouchId)) {
    holdClickSuppression()
    consumedAddTouchId = null
  }
  clearLongPress()
  touchStart = null
  touchPanStarted = false
  if (event.type === 'touchcancel') {
    cancelCanvasGesture(true)
    return
  }
  currentMap()?.endTouchNavigation(event)
}

function handleSystemActivation(systemId: string): void {
  if (hasClusterAddIntent()) return
  if (props.mode === 'navigate' && props.continuousMap) emit('select-cluster-system', systemId)
  else if (props.mode === 'navigate') emit('navigate-system', systemId)
  else if (props.mode === 'select') emit('select-cluster-system', systemId)
  else if (props.mode === 'move') emit('move-select-cluster-system', systemId)
}

function handleRouteSelection(routeId: string): void {
  if (hasClusterAddIntent()) return
  if (props.mode === 'select') emit('select-route', routeId)
  else if (props.mode === 'move') emit('move-select-route', routeId)
}

function handleObjectSelection(objectId: string, shiftKey = false): void {
  if (props.mode === 'select') {
    if (shiftKey) void commands.navigation.toggleObjectSelection(objectId)
    else emit('select-object', objectId)
  } else if (props.mode === 'move') emit('move-select-object', objectId)
}

function handleOrbitSelection(orbitId: string): void {
  if (props.mode === 'select') emit('select-orbit', orbitId)
  else if (props.mode === 'move') emit('move-select-orbit', orbitId)
}

/** Enriches one active-system Orbit input with the workspace identity owned by this map surface. */
function forwardOrbitAdjustment(input: OrbitAdjustmentInput): void {
  const continuousOwnerMatches = props.activeView === 'cluster' && props.continuousMap
    && props.workspace.cluster.systems.some(candidate => candidate.id === input.systemId
      && candidate.orbits.some(orbit => orbit.id === input.orbitId))
  const system = props.system
  const activeOwnerMatches = props.activeView === 'system' && system?.id === input.systemId
    || continuousOwnerMatches
  if (props.mode !== 'move' || !activeOwnerMatches
    || props.creationType != null || props.creationChooserOpen || props.clusterAddType != null || props.clusterChooserOpen
    || props.moveTargeting || props.clusterMoveTargeting) return
  emit('orbit-adjustment', { ...input, workspaceId: props.workspace.id })
}

function forwardMoveSystem(id: string, position: Point): void { if (props.mode === 'move') emit('move-system', id, position) }
function forwardClusterTarget(point: Point, systemIds: string[]): void {
  if (props.activeView !== 'cluster'
    || (!hasClusterAddIntent() && !props.clusterMoveTargeting)
    || props.clusterChooserOpen) return
  emit('cluster-target', point, systemIds)
}
function forwardStandaloneImportPlacementAnchor(anchor: Point): void {
  if (props.activeView !== 'cluster' || !props.continuousMap || !props.standaloneImportPlacementEnabled) return
  emit('standalone-import-placement-anchor', anchor)
}
function frameStandaloneImportPlacement(): boolean {
  if (!props.continuousMap || props.activeView !== 'cluster' || !props.standaloneImportPlacementEnabled) return false
  const map = continuousWardenMapRef.value
  const usableRect = measureUnobstructedViewport()
  if (!map || !usableRect) return false
  noteManualCameraInteraction()
  return map.frameStandaloneImportPlacement(usableRect)
}
function forwardMoveObject(id: string, position: Point): void { if (props.mode === 'move') emit('move-object', id, position) }
function forwardBlockedObjectMove(id: string): void { emit('object-move-blocked', id) }
function forwardObjectMoveCandidates(id: string, candidates: SystemObjectMoveCandidate[]): void {
  if (props.activeView === 'system' && props.mode === 'move') emit('object-move-candidates', id, candidates)
}
function forwardOrbitCenterCandidates(id: string, candidates: OrbitCenterMoveCandidate[], systemId?: string): void {
  if (props.activeView === 'system' && props.mode === 'move') {
    emit('orbit-center-candidates', id, candidates, systemId ?? props.system?.id)
  } else if (props.activeView === 'cluster' && props.continuousMap && props.mode === 'move' && systemId) {
    emit('orbit-center-candidates', id, candidates, systemId)
  }
}
function forwardMoveOrbitCenter(id: string, center: Point, hostId: string | null, systemId?: string, sourceGeometry?: string): void {
  if (props.mode === 'move') emit('move-orbit-center', id, center, hostId, systemId ?? props.system?.id, sourceGeometry)
}
function forwardRotateObject(id: string, angle: number): void { if (props.mode === 'move') emit('rotate-object', id, angle) }
function forwardResizeOrbit(id: string, radii: OrbitRadii, systemId?: string, sourceGeometry?: string): void {
  if (props.mode === 'move') emit('resize-orbit', id, radii, systemId ?? props.system?.id, sourceGeometry)
}
function forwardRotateOrbit(id: string, rotation: number, systemId?: string, sourceGeometry?: string): void {
  if (props.mode === 'move') emit('rotate-orbit', id, rotation, systemId ?? props.system?.id, sourceGeometry)
}
function forwardPlaceObject(id: string, orbitId: string, angle: number): void {
  if (props.mode === 'move') emit('place-object-in-orbit', id, orbitId, angle)
}
function forwardCreationTarget(candidates: SystemCreationCandidate[]): void {
  if (!props.creationType || props.creationChooserOpen) return
  emit('creation-target', candidates)
}

function forwardCreationDropTarget(type: SystemCreationType, candidates: SystemCreationCandidate[]): void {
  if (props.activeView !== 'system') return
  emit('creation-drop-target', type, candidates)
}

function forwardCancelCreationPreview(): void {
  if (!props.creationType || !props.creationPreview) return
  emit('cancel-creation-preview')
}

function emitViewport(viewport: MapViewport): void {
  if (mapReady) emit('viewport-change', { key: sourceMapKey, viewport })
}

function handleSystemViewportChange(viewport: MapViewport): void {
  orbitInput.refreshForViewportChange()
  emitViewport(viewport)
}

function measureUnobstructedClientRect(): ClientRectBounds | undefined {
  const svg = canvasRoot.value?.querySelector<SVGSVGElement>('svg')
  if (!svg) return undefined
  const svgBounds = svg.getBoundingClientRect()
  const board = svg.closest<HTMLElement>('[data-map-board]')
  const dashboard = svg.closest<HTMLElement>('[data-workspace-dashboard]')
  if (!board || !dashboard || !isUsableClientRect(svgBounds)) return undefined

  const svgRect: ClientRectBounds = {
    left: svgBounds.left,
    top: svgBounds.top,
    right: svgBounds.right,
    bottom: svgBounds.bottom,
  }
  const markerNodes = new Set<Element>(dashboard.querySelectorAll('[data-map-obstruction]'))
  for (const element of document.querySelectorAll('[data-map-obstruction]')) {
    // These named popovers are teleported to body, outside the stable DashboardGroup subtree.
    if (!dashboard.contains(element)
      && element.matches('.workspace-map-files-content, .workspace-add-menu, .workspace-zoom-navigation')) {
      markerNodes.add(element)
    }
  }
  const feedback = props.feedbackElement
  if (feedback && dashboard.contains(feedback) && !feedback.hasAttribute('data-map-obstruction')) markerNodes.add(feedback)

  const obstructions = [...markerNodes]
    .filter(isVisibleObstruction)
    .map(element => element.getBoundingClientRect())
    .filter(isUsableClientRect)
    .map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }))
  const usableClientRect = largestUnobstructedClientRect(svgRect, obstructions)
  return usableClientRect
}

function measureUnobstructedViewport(): SvgViewportRect | undefined {
  const svg = canvasRoot.value?.querySelector<SVGSVGElement>('svg')
  const usableClientRect = measureUnobstructedClientRect()
  return svg && usableClientRect ? clientRectToSvgViewportRect(svg, usableClientRect) : undefined
}

function fitMap(usableRect?: SvgViewportRect): void {
  const map = currentMap()
  if (!map) return
  const rect = usableRect ?? measureUnobstructedViewport()
  if (rect) map.fitMap(rect)
}

/** Frames a Search destination inside the measured post-overlay usable map area. */
function frameSearchTarget(target: SearchTarget): boolean {
  const usableRect = measureUnobstructedViewport()
  if (!usableRect) return false
  if (target.kind === 'cluster') {
    currentMap()?.fitMap(usableRect)
    return true
  }
  if (props.continuousMap && props.activeView === 'cluster') {
    return continuousWardenMapRef.value?.frameSearchTarget(target, usableRect) ?? false
  }
  if (target.kind === 'object') {
    return props.activeView === 'system'
      && props.workspace.id === target.workspaceId
      && props.workspace.cluster.id === target.clusterId
      && props.system?.id === target.systemId
      ? systemMapRef.value?.frameObjectBranch(target.objectId, usableRect) ?? false
      : false
  }
  return props.activeView === 'cluster'
    ? clusterMapRef.value?.frameSystem(target.systemId, usableRect) ?? false
    : false
}

function centerInspectedTarget(target: InspectedMapTarget): boolean {
  if (!props.continuousMap || props.activeView !== 'cluster') return false
  const map = continuousWardenMapRef.value
  const usableRect = measureUnobstructedViewport()
  if (!map || !usableRect) return false
  noteManualCameraInteraction()
  return map.centerInspectedTarget(target, usableRect)
}

function panBy(dx: number, dy: number): void {
  noteManualCameraInteraction()
  currentMap()?.panBy(dx, dy)
}

function revealHistoryCluster(): boolean {
  if (!props.continuousMap || props.activeView !== 'cluster') return false
  const usableRect = measureUnobstructedViewport()
  if (!usableRect) return false
  return continuousWardenMapRef.value?.revealHistoryCluster(usableRect) ?? false
}

function whenReady(): Promise<boolean> {
  return mapReadinessResult === undefined ? mapReadiness : Promise.resolve(mapReadinessResult)
}

function settleMapReadiness(ready: boolean): void {
  if (mapReadinessResult !== undefined) return
  mapReadinessResult = ready
  mapReady = ready
  resolveMapReadiness(ready)
}

function isUsableClientRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): boolean {
  return [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0
}

function isVisibleObstruction(element: Element): boolean {
  if (!element.isConnected || element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false
  if (element.matches('.workspace-map-files-content') && element.closest('[data-state="closed"]')) return false
  if (element.getClientRects().length === 0) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

onMounted(async () => {
  touchReleaseGuard = createOwnedTouchReleaseGuard(document)
  window.addEventListener('keydown', onWindowKeyDownCapture, true)
  window.addEventListener('pointermove', onWindowPointerMove, true)
  window.addEventListener('pointerup', onWindowPointerUp, true)
  window.addEventListener('pointercancel', onWindowPointerUp, true)
  window.addEventListener('pointerdown', onWindowPointerDownCapture, true)
  window.addEventListener('click', onWindowClickCapture, true)
  window.addEventListener('blur', onWindowBlur)
  document.addEventListener('keydown', onDocumentKeyDownCapture, true)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  document.addEventListener('freeze', onDocumentFreeze)
  await nextTick()
  if (mapDisposed) return
  const map = currentMap()
  if (!map) return
  if (props.initialViewport) map.setViewport(props.initialViewport)
  else {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (mapDisposed) return
    await nextTick()
    fitMap()
  }
  await nextTick()
  if (mapDisposed) return
  settleMapReadiness(true)
  emitViewport(map.getViewport())
})

onBeforeUnmount(() => {
  publicationMenuLease?.close()
  publicationMenuLease = null
  touchReleaseGuard?.dispose()
  touchReleaseGuard = null
  mapDisposed = true
  syncEditingGestureActive()
  settleMapReadiness(false)
  cancelCanvasGesture()
  livePointerSequences.clear()
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
  window.removeEventListener('pointermove', onWindowPointerMove, true)
  window.removeEventListener('pointerup', onWindowPointerUp, true)
  window.removeEventListener('pointercancel', onWindowPointerUp, true)
  window.removeEventListener('pointerdown', onWindowPointerDownCapture, true)
  window.removeEventListener('click', onWindowClickCapture, true)
  window.removeEventListener('keydown', onWindowKeyDownCapture, true)
  window.removeEventListener('blur', onWindowBlur)
  document.removeEventListener('keydown', onDocumentKeyDownCapture, true)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  document.removeEventListener('freeze', onDocumentFreeze)
})

watch(() => props.mode, () => {
  publicationMenuLease?.close()
  publicationMenuLease = null
  cancelCanvasGesture(true)
}, { flush: 'sync' })
watch(() => props.standaloneImportPlacementEnabled, (enabled, wasEnabled) => {
  if (!wasEnabled || enabled) return
  clearLongPress()
  clearPointerLongPress()
  for (const sequence of livePointerSequences.values()) sequence.cancelledRelease = true
}, { flush: 'sync' })
watch(() => props.creationType, () => {
  pendingRightClickContextMenu = null
  orbitInput.cancel()
  if (selectionRectangleGesture) finishSelectionRectangle(true)
  emit('cancel-object-placement-preview')
  emit('cancel-orbit-placement-preview')
}, { deep: true, flush: 'sync' })
watch(
  [
    () => props.creationChooserOpen,
    () => props.moveTargeting,
  ],
  () => {
    pendingRightClickContextMenu = null
    if (selectionRectangleGesture) finishSelectionRectangle(true)
  },
  { flush: 'sync' },
)
watch(
  [
    () => props.activeView,
    () => props.mapKey,
    () => props.system?.id,
    () => props.selectedSystemId,
    () => props.selectedObjectId,
    () => props.selectedOrbitId,
  ],
  ([activeView, mapKey, systemId, selectedSystemId, selectedObjectId], previous) => {
    if (activeView !== previous[0] || mapKey !== previous[1] || systemId !== previous[2]) {
      pendingRightClickContextMenu = null
    }
    const expectedContextSelection = publicationMenuLease?.isPreparingSelectionFor(selectedObjectId)
      && activeView === previous[0]
      && mapKey === previous[1]
      && systemId === previous[2]
      && selectedSystemId === previous[3]
    orbitInput.cancel()
    if (selectionRectangleGesture) finishSelectionRectangle(true)
    if (!expectedContextSelection) {
      publicationMenuLease?.close()
      publicationMenuLease = null
    }
    emit('cancel-object-placement-preview')
    emit('cancel-orbit-placement-preview')
  },
  { flush: 'sync' },
)

defineExpose({
  exportImage: async (format: MapImageFormat, palette: MapImagePalette = 'active') => currentMap()?.exportImage(format, palette)
    ?? Promise.reject(new Error('The map is not ready to export.')),
  getViewport: () => currentMap()?.getViewport() ?? { x: 0, y: 0, k: 1 },
  getMinimumZoomScale: () => props.activeView === 'cluster'
    ? currentClusterMap()?.getMinimumZoomScale?.() ?? MAP_ZOOM_MIN_SCALE
    : systemMapRef.value?.getMinimumZoomScale() ?? MAP_ZOOM_MIN_SCALE,
  getCameraInteractionVersion: () => cameraInteractionVersion,
  noteManualCameraInteraction,
  setViewport: (viewport: MapViewport) => currentMap()?.setViewport(viewport),
  zoomBy: (factor: number) => {
    noteManualCameraInteraction()
    currentMap()?.zoomBy(factor)
  },
  panBy,
  revealHistoryTarget: (target: MapHistoryTarget) => {
    const usableRect = props.continuousMap ? measureUnobstructedViewport() : undefined
    return currentMap()?.revealHistoryTarget?.(target, usableRect) ?? false
  },
  revealHistoryCluster,
  whenReady,
  frameSearchTarget,
  centerInspectedTarget,
  frameStandaloneImportPlacement,
  prepareSearchLocator: (objectId: string) => props.continuousMap
    ? continuousWardenMapRef.value?.prepareSearchLocator(objectId)
    : systemMapRef.value?.prepareSearchLocator(objectId),
  dismissSearchLocator,
  focusMap: () => currentMap()?.focusMap?.(),
  fitMap: () => {
    noteManualCameraInteraction()
    fitMap()
  },
  cancelActiveGesture: () => cancelCanvasGesture(true),
  startViewPan: (event: MouseEvent) => currentMap()?.startViewPan(event),
  moveViewPan: (event: MouseEvent) => currentMap()?.moveViewPan(event),
  endViewPan: () => currentMap()?.endViewPan(),
  setClusterSystemPositionPreview: (systemId: string, position: Point | null, expectedVersion?: number) => {
    if (props.activeView !== 'cluster') return
    if (props.continuousMap) {
      return continuousWardenMapRef.value?.setClusterSystemPositionPreview(systemId, position, expectedVersion)
    }
    clusterMapRef.value?.setClusterSystemPositionPreview?.(systemId, position)
  },
  getClusterSystemPositionPreviewVersion: (systemId: string) => {
    if (props.activeView !== 'cluster' || !props.continuousMap) return undefined
    return continuousWardenMapRef.value?.getClusterSystemPositionPreviewVersion(systemId)
  },
  setUnresolvedExitPositionPreview: (routeId: string, position: Point | null) => {
    if (props.activeView === 'cluster') currentClusterMap()?.setUnresolvedExitPositionPreview(routeId, position)
  },
  setObjectPlacementPreview: (objectId: string, scenePoint: Point | null, systemId?: string) => {
    if (props.activeView === 'cluster' && props.continuousMap && systemId) {
      continuousWardenMapRef.value?.setObjectPlacementPreview(systemId, objectId, scenePoint)
    } else if (props.activeView === 'system') systemMapRef.value?.setObjectPlacementPreview(objectId, scenePoint)
  },
  setObjectMoveTargetPreview: (objectId: string, target: SystemObjectMoveTarget | null, systemId?: string) => {
    if (props.activeView === 'cluster' && props.continuousMap && systemId) {
      continuousWardenMapRef.value?.setObjectMoveTargetPreview(systemId, objectId, target)
    }
  },
  setOrbitPlacementPreview: (orbitId: string, preview: OrbitPlacementPreview | null, systemId?: string) => {
    if (props.activeView === 'cluster' && props.continuousMap && systemId) {
      continuousWardenMapRef.value?.setOrbitPlacementPreview(systemId, orbitId, preview)
    } else if (props.activeView === 'system') systemMapRef.value?.setOrbitPlacementPreview(orbitId, preview)
  },
  setOrbitCenterMovePreview: (orbitId: string, scenePoint: Point | null, systemId?: string) => {
    if (props.activeView === 'cluster' && props.continuousMap && systemId) {
      continuousWardenMapRef.value?.setOrbitCenterMovePreview(systemId, orbitId, scenePoint)
    } else if (props.activeView === 'system') systemMapRef.value?.setOrbitCenterMovePreview(orbitId, scenePoint)
  },
  startTouchNavigation: (event: TouchEvent) => currentMap()?.startTouchNavigation(event),
  moveTouchNavigation: (event: TouchEvent) => currentMap()?.moveTouchNavigation(event),
  endTouchNavigation: (event: TouchEvent) => currentMap()?.endTouchNavigation(event),
  toSystemScenePoint: (systemId: string, clusterPoint: Point) => props.activeView === 'cluster' && props.continuousMap
    ? continuousWardenMapRef.value?.toSystemScenePoint(systemId, clusterPoint) ?? null
    : props.activeView === 'system' && props.system?.id === systemId ? clusterPoint : null,
  getDetachedOrbitCenter: (orbitId: string, systemId?: string) => {
    if (props.activeView === 'cluster' && props.continuousMap && systemId) {
      return continuousWardenMapRef.value?.getDetachedCenter(orbitId, systemId)
    }
    return systemMapRef.value?.getDetachedOrbitCenter(orbitId)
  },
  getCreationCandidates: (point: Point, type: SystemCreationType) =>
    systemMapRef.value?.getCreationCandidates(point, type) ?? [],
})
</script>

<style scoped>
.workspace-map-canvas {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  touch-action: none;
  overscroll-behavior: contain;
}

.workspace-map-canvas > :deep(.map-view) {
  min-height: 0;
  flex: 1 1 auto;
}

.workspace-selection-rectangle {
  position: absolute;
  z-index: 1;
  border: 1px solid var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 14%, transparent);
  pointer-events: none;
}

</style>
