<template>
  <div class="prototype-map-canvas" @click.capture="captureMapIntent">
    <ClientOnly>
      <KeepAlive>
        <ClusterMap
          v-if="view === 'cluster'"
          :key="'cluster'"
          ref="clusterMap"
          :cluster="workspace.cluster"
          :system-positions="workspace.layout.systemPositions"
          :selected-system-id="selectedSystemId"
          :selected-route-id="selectedRouteId"
          :move-enabled="tool === 'move'"
          @open-system="emit('open-system', $event)"
          @select-route="emit('select-route', $event)"
          @move-system="onMoveSystem"
        />
        <SystemMap
          v-else-if="system"
          :key="system.id"
          ref="systemMap"
          :system="system"
          :orbit-radii="workspace.layout.orbitRadii"
          :orbit-rotations="workspace.layout.orbitRotations"
          :object-angles="workspace.layout.objectAngles"
          :selected-object-id="selectedObjectId"
          :selected-orbit-id="selectedOrbitId"
          :move-enabled="tool === 'move'"
          @select-object="emit('select-object', $event)"
          @select-orbit="emit('select-orbit', $event)"
          @move-object="onMoveObject"
          @move-orbit-center="onMoveOrbitCenter"
          @rotate-object="onRotateObject"
          @resize-orbit="onResizeOrbit"
          @rotate-orbit="onRotateOrbit"
          @place-object-in-orbit="onPlaceObjectInOrbit"
        />
      </KeepAlive>
      <template #fallback>
        <div class="prototype-map-wait">Preparing the chart…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { CatalogueSubtype, LocalWorkspace, Point, StarSystem } from '../domain/workspace'
import type { MapImageFormat } from '../utils/map-image-export'

type View = 'cluster' | 'system'
type Tool = 'navigation' | 'move' | 'add-object' | 'add-orbit' | 'add-system' | 'add-route'

const props = defineProps<{
  workspace: LocalWorkspace
  view: View
  system: StarSystem | null
  selectedSystemId: string | null
  selectedRouteId: string | null
  selectedObjectId: string | null
  selectedOrbitId: string | null
  tool: Tool
}>()

const emit = defineEmits<{
  'open-system': [id: string]
  'select-route': [id: string]
  'select-object': [id: string]
  'select-orbit': [id: string]
  'move-system': [id: string, position: Point]
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: { horizontal: number; vertical: number }]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'map-target': [target: { kind: 'empty'; point: Point } | { kind: 'orbit'; id: string } | { kind: 'object'; id: string } | { kind: 'system'; id: string }]
}>()

type MapControls = {
  exportImage(format: MapImageFormat): Promise<Blob>
  zoomBy(factor: number): void
  fitMap(): void
}

const clusterMap = ref<MapControls | null>(null)
const systemMap = ref<MapControls | null>(null)

function captureMapIntent(event: MouseEvent): void {
  if (props.tool === 'navigation' || props.tool === 'move') return
  const target = event.target
  if (!(target instanceof Element)) return
  const svg = target.closest('svg.cluster-map-svg, svg.system-map-svg') as SVGSVGElement | null
  if (!svg) return

  const systemObject = target.closest('.system-object')
  const orbit = target.closest('.orbit-hit-target')
  const systemNode = target.closest('.cluster-system-node')

  event.preventDefault()
  event.stopImmediatePropagation()

  if (props.view === 'cluster') {
    if (systemNode && props.tool === 'add-route') {
      emit('map-target', { kind: 'system', id: systemNode.getAttribute('data-system-id') ?? '' })
      return
    }
    if (!systemNode && !target.closest('.cluster-route')) {
      emit('map-target', { kind: 'empty', point: clusterPoint(event, svg) })
    }
    return
  }

  if (props.tool === 'add-object') {
    if (orbit) {
      emit('map-target', { kind: 'orbit', id: orbit.getAttribute('data-orbit-id') ?? '' })
    } else if (!systemObject) {
      emit('map-target', { kind: 'empty', point: systemPoint(event, svg) })
    }
    return
  }

  if (props.tool === 'add-orbit') {
    emit('map-target', systemObject
      ? { kind: 'object', id: systemObject.getAttribute('data-object-id') ?? '' }
      : { kind: 'empty', point: systemPoint(event, svg) })
  }
}

function clusterPoint(event: MouseEvent, svg: SVGSVGElement): Point {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const content = svg.querySelector<SVGGElement>('.cluster-map-content')
  const matrix = content?.getScreenCTM()
  if (!matrix) return { x: 0.5, y: 0.5 }
  const local = point.matrixTransform(matrix.inverse())
  return {
    x: Math.max(0, Math.min(1, (local.x - 112) / 736)),
    y: Math.max(0, Math.min(1, (local.y - 96) / 368)),
  }
}

function systemPoint(event: MouseEvent, svg: SVGSVGElement): Point {
  const content = svg.querySelector<SVGGElement>('.system-map-content')
  const matrix = content?.getScreenCTM()
  if (!matrix) return { x: 0.5, y: 0.5 }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const local = point.matrixTransform(matrix.inverse())
  return {
    x: Math.max(-1, Math.min(2, (local.x - 64) / 832)),
    y: Math.max(-1, Math.min(2, (local.y - 72) / 416)),
  }
}

async function exportImage(format: MapImageFormat): Promise<Blob> {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  if (!map) throw new Error('The chart is not ready yet.')
  return map.exportImage(format)
}

function zoomBy(factor: number): void {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  map?.zoomBy(factor)
}

function fitMap(): void {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  map?.fitMap()
}

function onMoveSystem(id: string, point: Point): void { emit('move-system', id, point) }
function onMoveObject(id: string, point: Point): void { emit('move-object', id, point) }
function onMoveOrbitCenter(id: string, point: Point, hostId: string | null): void {
  emit('move-orbit-center', id, point, hostId)
}
function onRotateObject(id: string, angle: number): void { emit('rotate-object', id, angle) }
function onResizeOrbit(id: string, radii: { horizontal: number; vertical: number }): void {
  emit('resize-orbit', id, radii)
}
function onRotateOrbit(id: string, rotation: number): void { emit('rotate-orbit', id, rotation) }
function onPlaceObjectInOrbit(id: string, orbitId: string, angle: number): void {
  emit('place-object-in-orbit', id, orbitId, angle)
}

defineExpose({ exportImage, zoomBy, fitMap })
</script>

<style scoped>
.prototype-map-canvas,
.prototype-map-canvas :deep(.map-view) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.prototype-map-wait {
  display: grid;
  min-height: 100%;
  place-items: center;
  color: var(--proto-muted);
  font: 0.8rem var(--proto-ui-font);
}
</style>
