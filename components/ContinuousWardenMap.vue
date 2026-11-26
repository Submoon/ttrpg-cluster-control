<template>
  <div class="map-view relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <svg
      ref="svgElement"
      class="cluster-map-svg continuous-warden-map-svg block h-full min-h-0 w-full flex-1"
      :class="{ 'map-touch-surface': touchNavigation }"
      viewBox="0 0 960 560"
      :style="{ '--warden-halo-fill': `url(#${haloGradientId}-fill)` }"
      role="group"
      :aria-label="`${sceneCluster.name} continuous map`"
      aria-describedby="workspace-map-tool-shortcut-help continuous-warden-map-keyboard-help"
      tabindex="0"
      @pointerdown.capture="onPointerDownCapture"
      @pointermove.capture="onPointerMoveCapture"
      @pointerup.capture="onPointerEndCapture"
      @pointercancel.capture="onPointerEndCapture"
      @lostpointercapture.capture="onLostPointerCapture"
      @click.capture="onClickCapture"
      @keydown.capture="onKeydownCapture"
      @wheel.capture="onWheelCapture"
      @touchstart.capture="startTouchNavigation"
    >
      <title>{{ sceneCluster.name }} continuous Warden map</title>
      <desc id="continuous-warden-map-keyboard-help">
        Zoom continuously to reveal each Zone independently. In Move, drag an object to move it within its owning Zone or drop it inside another Zone’s frame to transfer it. Select a Zone, then drag its name to move it. Select a Zone or Orbit to reveal its editing handles.
      </desc>
      <defs>
        <radialGradient :id="`${haloGradientId}-fill`" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="var(--map-text)" stop-opacity="0" />
          <stop offset="35%" stop-color="var(--map-text)" stop-opacity="0" />
          <stop offset="85%" stop-color="var(--map-text)" stop-opacity="0.09" />
          <stop offset="100%" stop-color="var(--map-text)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ContinuousMapRouteLayer
        ref="routeLayer"
        :routes="routeMarks"
        :geometries="routeGeometries"
        :detail-system-ids="ready ? detailSystemIds : undefined"
        :selected-route-id="selectedRouteId"
        :viewport="viewport"
        :viewport-rect="svgViewport"
        :svg-pixel-scale="svgPixelScale"
        :label-obstacles="routeLabelObstacles"
        :move-enabled="mode === 'move' && !moveTargeting && !clusterMoveTargeting && !creationType && clusterAddType === null"
        :move-selected-exit="mode === 'select' && !moveTargeting && !clusterMoveTargeting && !creationType && clusterAddType === null"
      />
      <!-- Keep the system-detail layer free of a camera-scale ancestor so live wheel zoom repaints its geometry at the final viewport scale. -->
      <g
        class="cluster-map-items continuous-warden-fixed-paint"
        :style="{ '--warden-orbit-screen-pixel': `${1 / svgPixelScale}px` }"
      >
          <g
            v-for="projection in renderedProjections"
            :key="projection.id"
            class="continuous-warden-system"
            :data-system-id="projection.id"
          >
            <g class="continuous-warden-system-overview" :transform="cameraTransform">
            <rect
              v-if="hasPositiveFrame(displayFrameFor(projection.id))"
              class="continuous-warden-system-envelope"
              :class="{
                'is-detailed': detailSystemIds.has(projection.id),
                'is-move-preview': previewPositions.has(projection.id),
                'is-elastic-replaced': elasticPlacementPreview?.systemId === projection.id,
                'is-frame-growth-arrival': frameGrowthAnimation?.systemId === projection.id,
              }"
              :x="displayFrameFor(projection.id).x"
              :y="displayFrameFor(projection.id).y"
              :width="displayFrameFor(projection.id).width"
              :height="displayFrameFor(projection.id).height"
              rx="18"
              aria-hidden="true"
              @animationend.self="finishElasticFrameGrowthAnimation"
            />
            <g
              v-if="frameGrowthAnimation?.systemId === projection.id"
              class="continuous-warden-frame-growth-animation"
              aria-hidden="true"
              pointer-events="none"
            >
              <path
                class="continuous-warden-frame-growth-stretch"
                :d="frameGrowthAnimation.stretchedPath"
              />
              <rect
                class="continuous-warden-frame-growth-tween"
                :x="frameGrowthAnimation.sourceFrame.x"
                :y="frameGrowthAnimation.sourceFrame.y"
                :width="frameGrowthAnimation.sourceFrame.width"
                :height="frameGrowthAnimation.sourceFrame.height"
                rx="18"
              >
                <animate attributeName="x" :from="frameGrowthAnimation.sourceFrame.x" :to="frameGrowthAnimation.targetFrame.x" dur="260ms" begin="indefinite" fill="freeze" />
                <animate attributeName="y" :from="frameGrowthAnimation.sourceFrame.y" :to="frameGrowthAnimation.targetFrame.y" dur="260ms" begin="indefinite" fill="freeze" />
                <animate attributeName="width" :from="frameGrowthAnimation.sourceFrame.width" :to="frameGrowthAnimation.targetFrame.width" dur="260ms" begin="indefinite" fill="freeze" />
                <animate attributeName="height" :from="frameGrowthAnimation.sourceFrame.height" :to="frameGrowthAnimation.targetFrame.height" dur="260ms" begin="indefinite" fill="freeze" />
              </rect>
            </g>
            <path
              v-if="elasticPlacementPreview?.systemId === projection.id"
              class="continuous-warden-elastic-envelope"
              :data-system-id="projection.id"
              :d="elasticPlacementPreview.path"
              aria-hidden="true"
              pointer-events="none"
            />

            <g
              class="continuous-warden-system-anchor"
              :data-system-id="projection.id"
              :transform="anchorTransform(projection)"
              aria-hidden="true"
            />
            </g>

            <g
              v-if="mountedDetailSystemIds.has(projection.id)"
              class="continuous-warden-system-detail"
              :class="{
                'is-entering': detailMotion.progressFor(projection.id) < 1,
                'is-exiting': !detailSystemIds.has(projection.id),
              }"
              :fill-opacity="detailMotion.progressFor(projection.id)"
              :stroke-opacity="detailMotion.progressFor(projection.id)"
              :aria-hidden="detailSystemIds.has(projection.id) && detailMotion.progressFor(projection.id) >= 1 ? undefined : 'true'"
              :inert="detailSystemIds.has(projection.id) && detailMotion.progressFor(projection.id) >= 1 ? undefined : ''"
            >
              <g class="system-orbits">
                <ellipse
                  v-if="orbitPlacementPreviewPaint(projection)"
                  class="orbit-ring is-placement-preview"
                  :cx="orbitPlacementPreviewPaint(projection)?.center.x"
                  :cy="orbitPlacementPreviewPaint(projection)?.center.y"
                  :rx="orbitPlacementPreviewPaint(projection)?.rx"
                  :ry="orbitPlacementPreviewPaint(projection)?.ry"
                  :transform="orbitPlacementPreviewPaint(projection)?.transform"
                  aria-hidden="true"
                />
                <ContinuousWardenOrbitLayer
                  :system-id="projection.id"
                  :marks="orbitPaintBySystem.get(projection.id) ?? EMPTY_ORBIT_PAINT_MARKS"
                  :selected-orbit-id="selectedOrbitIdForSystem(projection.id)"
                />
                <template v-for="orbit in projection.orbits" :key="`${orbit.id}-edit-controls`">
                  <circle
                    v-if="canEditOrbit(projection.id, orbit.id) && isSelectedOrbit(projection.id, orbit.id)"
                    class="continuous-warden-orbit-edit-handle continuous-warden-orbit-axis-handle"
                    :data-system-id="projection.id"
                    :data-orbit-id="orbit.id"
                    data-orbit-edit-kind="resize"
                    data-resize-axis="horizontal"
                    role="slider"
                    tabindex="0"
                    :aria-label="`Resize horizontal radius of ${orbitLabel(projection.id, orbit.id)}`"
                    v-bind="orbitRadiusSliderValues(projection.id, orbit, 'horizontal')"
                    :cx="detailPaintPoint(projection, orbitAxisHandlePoint(orbit, 'horizontal')).x"
                    :cy="detailPaintPoint(projection, orbitAxisHandlePoint(orbit, 'horizontal')).y"
                    :r="orbitEditHandleRadius(projection) * detailPaintScale(projection)"
                  />
                  <circle
                    v-if="canEditOrbit(projection.id, orbit.id) && isSelectedOrbit(projection.id, orbit.id)"
                    class="continuous-warden-orbit-edit-handle continuous-warden-orbit-axis-handle"
                    :data-system-id="projection.id"
                    :data-orbit-id="orbit.id"
                    data-orbit-edit-kind="resize"
                    data-resize-axis="vertical"
                    role="slider"
                    tabindex="0"
                    :aria-label="`Resize vertical radius of ${orbitLabel(projection.id, orbit.id)}`"
                    v-bind="orbitRadiusSliderValues(projection.id, orbit, 'vertical')"
                    aria-orientation="vertical"
                    :cx="detailPaintPoint(projection, orbitAxisHandlePoint(orbit, 'vertical')).x"
                    :cy="detailPaintPoint(projection, orbitAxisHandlePoint(orbit, 'vertical')).y"
                    :r="orbitEditHandleRadius(projection) * detailPaintScale(projection)"
                  />
                  <circle
                    v-if="canEditOrbit(projection.id, orbit.id) && isSelectedOrbit(projection.id, orbit.id)"
                    class="continuous-warden-orbit-edit-handle continuous-warden-orbit-rotation-handle"
                    :data-system-id="projection.id"
                    :data-orbit-id="orbit.id"
                    data-orbit-edit-kind="rotation"
                    role="slider"
                    tabindex="0"
                    :aria-label="`Rotate ${orbitLabel(projection.id, orbit.id)}`"
                    :aria-valuemin="0"
                    :aria-valuemax="360"
                    :aria-valuenow="orbit.rotation"
                    :aria-valuetext="`${Math.round(orbit.rotation)} degrees`"
                    :cx="detailPaintPoint(projection, orbitRotationHandlePoint(orbit.center, orbit.radii, orbit.rotation)).x"
                    :cy="detailPaintPoint(projection, orbitRotationHandlePoint(orbit.center, orbit.radii, orbit.rotation)).y"
                    :r="orbitEditHandleRadius(projection) * detailPaintScale(projection)"
                  />
                  <circle
                    v-if="canEditOrbit(projection.id, orbit.id) && localOrbit(projection.id, orbit.id)?.hostId === null"
                    class="continuous-warden-orbit-edit-handle continuous-warden-orbit-center-handle"
                    :data-system-id="projection.id"
                    :data-orbit-id="orbit.id"
                    data-orbit-edit-kind="center"
                    role="button"
                    tabindex="0"
                    :aria-label="`Move center of ${orbitLabel(projection.id, orbit.id)}`"
                    :cx="detailPaintPoint(projection, orbit.center).x"
                    :cy="detailPaintPoint(projection, orbit.center).y"
                    :r="orbitEditHandleRadius(projection) * detailPaintScale(projection)"
                  />
                </template>
              </g>
              <g class="system-map-items" :style="detailObjectPaintStyle(projection)">
                <g
                  v-for="object in projection.objects"
                  :key="object.id"
                  class="continuous-warden-object"
                  :class="{
                    'is-selected': isSelectedObject(projection.id, object.id),
                    'is-search-result': isSearchLocatorFor(projection.id, object.id),
                    'is-dimmed': dimmedObjectIds.has(object.id),
                    'is-move-preview': isObjectMovePreview(projection.id, object.id)
                      || isGroupObjectMovePreview(projection.id, object.id),
                    'is-group-move-preview': isGroupObjectMovePreview(projection.id, object.id),
                    'is-group-arriving': isGroupObjectArriving(object.id),
                    'is-group-departing': isGroupObjectDeparting(object.id),
                  }"
                  :transform="objectTransform(projection, object)"
                  :data-object-id="object.id"
                  :data-system-id="projection.id"
                  role="button"
                  tabindex="0"
                  :aria-label="`Select ${object.locationKey}, ${object.name}`"
                  :aria-pressed="isSelectedObject(projection.id, object.id)"
                >
                  <circle
                    class="continuous-warden-object-hit-target"
                    :r="objectHitRadius(projection) * detailPaintScale(projection)"
                  />
                  <circle
                    class="continuous-warden-object-marker-outline"
                    :r="18 * detailTextPaintScale(projection)"
                    aria-hidden="true"
                  />
                  <g
                    v-if="isSelectedObject(projection.id, object.id)"
                    class="system-object-selection-indicator"
                    :data-selection-object-id="object.id"
                    aria-hidden="true"
                    pointer-events="none"
                  >
                    <circle class="system-object-selection-outline" :r="15.5 * detailTextPaintScale(projection)" />
                    <circle class="system-object-selection-dashes" :r="19.5 * detailTextPaintScale(projection)" pathLength="100" stroke-dasharray="6 4" />
                  </g>
                  <circle
                    v-if="isSearchLocatorFor(projection.id, object.id)"
                    class="continuous-warden-search-locator"
                    data-map-search-locator
                    :r="searchLocatorRadius(projection) * detailPaintScale(projection)"
                    aria-hidden="true"
                  />
                  <circle
                    v-if="objectSubtype(projection.id, object.id) === 'star'"
                    class="continuous-warden-star-halo"
                    :r="starHaloRadius(projection) * detailPaintScale(projection)"
                  />
                  <g class="continuous-warden-object-text">
                    <text
                      class="continuous-warden-object-glyph"
                      :fill="localObject(projection.id, object.id)?.markerColor"
                      :y="8 * detailTextPaintScale(projection)"
                      text-anchor="middle"
                    >
                      {{ objectGlyph(projection.id, object.id) }}
                    </text>
                    <text class="continuous-warden-object-key" :y="31 * detailTextPaintScale(projection)" text-anchor="middle">
                      {{ object.locationKey }}
                    </text>
                    <text class="continuous-warden-object-name" :y="46 * detailTextPaintScale(projection)" text-anchor="middle">
                      {{ object.name }}
                    </text>
                  </g>
                </g>
              </g>
              <g aria-hidden="true" pointer-events="none">
                <WardenObjectPublicationBadge
                  v-for="object in projection.objects"
                  :key="object.id"
                  :identity="`object-${projection.id}-${object.id}`"
                  :mode="localObject(projection.id, object.id)?.publication"
                  :parent-publication="sceneSystems.get(projection.id)?.publication"
                  :transform="`${objectTransform(projection, object)} ${publicationBadgeTransform}`"
                  :opacity="dimmedObjectIds.has(object.id) ? .14 : undefined"
                />
              </g>
            </g>
            <g
              v-if="orbitAddPreview?.systemId === projection.id"
              class="continuous-warden-orbit-add-preview"
              :style="{
                '--warden-orbit-preview-stroke-width': `${2.5 * detailPaintScale(projection)}px`,
                '--warden-orbit-preview-dasharray': `${6 * detailPaintScale(projection)}px ${4 * detailPaintScale(projection)}px`,
              }"
            >
              <ellipse
                class="orbit-creation-preview-ring"
                :cx="detailPaintPoint(projection, orbitAddPreview.center).x"
                :cy="detailPaintPoint(projection, orbitAddPreview.center).y"
                :rx="orbitAddPreview.radii.horizontal * detailPaintScale(projection)"
                :ry="orbitAddPreview.radii.vertical * detailPaintScale(projection)"
                :transform="orbitPaintTransform(projection, orbitAddPreview.center, orbitAddPreview.rotation)"
                aria-hidden="true"
              />
            </g>
          </g>
      </g>
      <WardenRouteObjectLayer
        v-for="{ id, contents, geometry } in displayedRouteBranches"
        :key="id"
        :route-id="id"
        :contents="contents"
        :geometry="geometry"
        :layout="workspace.layout"
        :viewport="viewport"
        :svg-pixel-scale="svgPixelScale"
        :selected-object-id="inspectedTarget?.kind === 'route-object' ? inspectedTarget.objectId : undefined"
        :dimmed-object-ids="dimmedObjectIds"
        :search-locator-object-id="searchLocatorTarget?.ownerId === id ? searchLocatorTarget.objectId : undefined"
        :hidden-branch="routeMovePreview?.routeId === id ? routeMovePreview.branch : undefined"
      />
      <WardenRouteObjectLayer
        v-if="routeLandingPreview"
        :route-id="routeLandingPreview.routeId"
        :contents="routeLandingPreview.contents"
        :geometry="routeLandingPreview.geometry"
        :layout="routeLandingPreview.layout"
        :visible-branch="routeLandingPreview.branch"
        :viewport="viewport"
        :svg-pixel-scale="svgPixelScale"
        preview="landing"
      />
      <template v-if="routeMovePreview">
        <WardenRouteObjectLayer
          :route-id="routeMovePreview.routeId"
          :contents="routeMovePreview.pointer"
          :geometry="routeMovePreview.geometry"
          :layout="workspace.layout"
          :viewport="{ x: viewport.x + routeMovePreview.offset.x * viewport.k, y: viewport.y + routeMovePreview.offset.y * viewport.k, k: viewport.k }"
          :svg-pixel-scale="svgPixelScale"
          preview="pointer"
        />
      </template>
      <g class="cluster-map-content" :transform="cameraTransform">
        <g class="cluster-map-items">
          <g
            v-if="landingBranchPreview"
            class="continuous-warden-transfer-preview continuous-warden-branch-landing"
            :transform="systemTransform(landingBranchPreview.projection)"
            aria-hidden="true"
            pointer-events="none"
          >
            <title>Branch landing preview</title>
            <g class="system-orbits continuous-warden-transfer-orbits">
              <ellipse
                v-for="orbit in landingBranchPreview.orbits"
                :key="orbit.id"
                class="orbit-ring continuous-warden-transfer-orbit"
                :cx="orbit.center.x"
                :cy="orbit.center.y"
                :rx="orbit.radii.horizontal"
                :ry="orbit.radii.vertical"
                :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
              />
            </g>
            <g class="system-map-items continuous-warden-transfer-objects">
              <g
                v-for="object in landingBranchPreview.objects"
                :key="object.id"
                class="continuous-warden-transfer-object"
                :class="{ 'is-root': object.id === landingBranchPreview.rootObjectId }"
                :transform="`translate(${object.position.x} ${object.position.y}) scale(${detailTextScale(systemScreenScale(landingBranchPreview.projection))})`"
              >
                <circle class="continuous-warden-transfer-object-mark" r="17" />
                <text class="continuous-warden-object-glyph" y="8" text-anchor="middle">
                  {{ landingObjectGlyph(object) }}
                </text>
                <text class="continuous-warden-object-key" y="31" text-anchor="middle">
                  {{ object.locationKey }}
                </text>
                <text class="continuous-warden-object-name" y="46" text-anchor="middle">
                  {{ object.name }}
                </text>
              </g>
            </g>
          </g>
          <g
            v-if="standaloneImportProjection"
            class="continuous-warden-import-placement-preview"
            :data-anchor-x="props.standaloneImportPlacement?.anchor.x"
            :data-anchor-y="props.standaloneImportPlacement?.anchor.y"
            aria-hidden="true"
            pointer-events="none"
          >
            <title>Imported {{ standaloneImportProjection.name }} placement preview</title>
            <rect
              class="continuous-warden-import-envelope"
              :x="standaloneImportProjection.envelope.x"
              :y="standaloneImportProjection.envelope.y"
              :width="standaloneImportProjection.envelope.width"
              :height="standaloneImportProjection.envelope.height"
              rx="18"
            />
            <g
              class="continuous-warden-import-system-detail"
              :transform="systemTransform(standaloneImportProjection)"
            >
              <g class="continuous-warden-import-orbits">
                <ellipse
                  v-for="orbit in standaloneImportProjection.orbits"
                  :key="orbit.id"
                  class="continuous-warden-import-orbit"
                  :cx="orbit.center.x"
                  :cy="orbit.center.y"
                  :rx="orbit.radii.horizontal"
                  :ry="orbit.radii.vertical"
                  :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
                />
              </g>
              <g class="continuous-warden-import-objects">
                <g
                  v-for="object in standaloneImportProjection.objects"
                  :key="object.id"
                  class="continuous-warden-import-object"
                  :transform="`translate(${object.position.x} ${object.position.y})`"
                >
                  <circle r="5" />
                  <text y="12" text-anchor="middle">{{ object.locationKey }}</text>
                  <text y="24" text-anchor="middle">{{ object.name }}</text>
                </g>
              </g>
            </g>
            <g :transform="`translate(${standaloneImportProjection.anchor.x} ${standaloneImportProjection.anchor.y})`">
              <circle class="continuous-warden-import-anchor" r="13" />
              <circle class="continuous-warden-import-anchor-core" r="3" />
            </g>
          </g>
        </g>
      </g>
      <g class="continuous-warden-name-layer">
          <g v-for="label in nameLabels" :key="label.id">
            <line
              v-if="label.hasLeader"
              class="continuous-warden-name-leader"
              :x1="label.anchorX"
              :y1="label.anchorY"
              :x2="label.x"
              :y2="label.y + label.height / 2"
              aria-hidden="true"
            />
            <g
              class="cluster-system-node continuous-warden-name-target"
              :class="{ 'is-selected': selectedSystemId === label.id, 'is-draggable': isSelectedSystem(label.id), 'is-move-preview': previewPositions.has(label.id) }"
              :data-system-id="label.id"
              :transform="`translate(${label.x} ${label.y})`"
              role="button"
              tabindex="0"
              :aria-label="`Select ${label.name}`"
            >
              <rect
                class="continuous-warden-name-background"
                :x="-label.width / 2"
                y="0"
                :width="label.width"
                :height="label.height"
                rx="5"
              />
              <text
                class="continuous-warden-system-name"
                :style="{ fontSize: `${SYSTEM_NAME_FONT_PIXELS / svgPixelScale}px` }"
                :y="label.height * 0.68"
                text-anchor="middle"
              >
                {{ label.name }}
              </text>
            </g>
          </g>
          <template v-for="handle in systemFrameResizeHandles" :key="`${handle.systemId}:${handle.corner}`">
            <foreignObject
              :x="handle.x"
              :y="handle.y"
              :width="handle.size"
              :height="handle.size"
              class="continuous-warden-system-resize-target"
            >
              <button
                type="button"
                class="continuous-warden-system-resize-button"
                :data-system-id="handle.systemId"
                :data-system-resize-handle="handle.corner"
                :aria-label="`Resize ${handle.corner.replace('-', ' ')} corner of ${handle.systemName}`"
                :title="`Resize ${handle.corner.replace('-', ' ')} corner of ${handle.systemName}`"
              >
                <span aria-hidden="true" />
              </button>
            </foreignObject>
          </template>
        </g>
    </svg>
    <div
      v-if="selectedObjectDragPreview"
      class="continuous-warden-group-move-status pointer-events-none absolute left-3 top-3 z-10 max-w-[min(28rem,calc(100%-1.5rem))] rounded border border-[var(--line-strong)] bg-[var(--panel-bg)] px-2 py-1 text-xs shadow"
      role="status"
      aria-live="polite"
    >
      Moving {{ props.selectedObjectIds.length }} selected objects;
      {{ selectedObjectDragPreview.arrivingObjectIds.size }} attach,
      {{ selectedObjectDragPreview.departingObjectIds.size }} detach,
      {{ hiddenSelectedObjectCount }} selected hidden at this detail.
    </div>
  </div>
</template>

<script setup lang="ts">
/** Warden continuous scene with one D3 camera and independent system-envelope reveal. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, useId, watch } from 'vue'
import type { DeepReadonly } from 'vue'
import { pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import { prepareSystemObjectTransfer, jumpPointsInCluster, routeContentsFor, minimumOrbitRadius, workspaceSystemFrame, type CatalogueSubtype, type JumpCluster, type JumpRoute, type LocalWorkspace, type Orbit, type OrbitRadii, type Point, type StarSystem, type SystemFrameInsets, type SystemObjectTransferPlacement } from '../domain/workspace'
import { normalizeOrbitRotation } from '../domain/workspace-orbits'
import { getDetachedOrbitCenter, objectPositions, objectsMovedWithOrbit, orbitCenter, orbitPlacementHitsAtPoint, orbitPointAtAngle, orbitRadii as readOrbitRadii, orbitRotation, orbitRotationHandlePoint, rotatePoint, requiredPosition } from '../utils/system-map-geometry'
import { orbitGeometrySource } from '../utils/orbit-geometry-source'
import { measureSystemObjectBranchBounds, resolveSystemObjectBranch } from '../utils/system-object-branch'
import { continuousOrbitKeyboardChange } from '../utils/continuous-orbit-interaction'
import type { EntityCommand, MapHistoryTarget, MapInteractionMode, OrbitCenterMoveCandidate, OrbitCreationMapPreview, SelectMapObjectDragContext, SystemCreationCandidate, SystemCreationType, SystemObjectMoveTarget } from '../composables/editor-workflows/types'
import type { OrbitAdjustmentInput, OrbitAdjustmentPreview } from '../composables/editor-workflows/continuous-orbit-adjustments'
import type { StandaloneImportPlacementView } from '../composables/useWorkspaceFiles'
import type { InspectedMapTarget } from '../stores/editor-ui'
import type { SystemObjectTransferDrop, SystemObjectTransferMapPreview } from '../composables/editor-workflows/system-object-transfer-types'
import { initialClusterSystemPosition } from '../domain/workspace-cluster'
import type { MapViewport, SvgViewportRect } from '../utils/map-zoom'
import {
  clampMapViewport,
  clientRectToSvgViewportRect,
  fitMapViewport,
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  normalizeSvgViewportRect,
  svgViewportExtent,
} from '../utils/map-zoom'
import {
  clampWardenClusterAnchor,
  continuousMapDetailScale,
  continuousMapTextScale,
  CONTINUOUS_MAP_LOCAL_ORIGIN,
  moveWardenClusterAnchorBySceneDelta,
  previewWardenSystemObjects,
  projectWardenSystem,
  unprojectWardenClusterAnchor,
  wardenStarHaloRadius,
  type ContinuousWardenSystemProjection,
} from '../utils/continuous-map-projection'
import { systemFrameInsetsFromRect } from '../utils/continuous-map-projection'
import { applySelectedObjectTranslation, planSelectedObjectTranslation } from '../utils/selected-object-placement'
import { continuousObjectDragTarget, hasMapDragThreshold } from '../utils/continuous-object-drag'
import { updateWorkspaceObject } from '../domain/workspace-placement'
import { creationCandidatesAtPoint, fromNormalizedMapPoint, toNormalizedMapPoint, type SystemMapGeometry } from '../utils/system-map-geometry'
import {
  continuousOrbitAddKeyboardPoint,
  resolveContinuousObjectOwnerResolution,
  type ContinuousObjectAddOwner,
  type ContinuousObjectAddTarget,
} from '../utils/continuous-map-editing'
import { clusterRouteLabel, clusterSystemPosition, hasSafeClusterSceneBounds, isSafeClusterScenePoint } from '../utils/cluster-map-geometry'
import { buildContinuousWardenRouteGeometries } from '../utils/continuous-warden-routes'
import { clipWardenOrbitStroke } from '../utils/continuous-warden-orbit-clip'
import { CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS, type ContinuousMapRouteGeometry } from '../utils/continuous-map-route-geometry'
import { centerContinuousMapRouteViewport, revealContinuousMapRouteViewport } from '../utils/continuous-map-route-viewport'
import {
  centerMapTargetViewport,
  minimumHistoryRevealViewport,
  revealNearestAnchorViewport,
  rotatedEllipseBounds,
} from '../utils/continuous-map-history-reveal'
import type { ClientRectBounds } from '../utils/map-usable-area'
import { createMapTouchNavigation } from './maps/map-touch-navigation'
import { useWardenMapDom } from './maps/useWardenMapDom'
import type { MapImageExportOptions, MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import { mapImageContextKey, type MapImageScope } from '../utils/map-image-scope'
import { exportContinuousWardenMapImage } from '../utils/continuous-warden-image-export'
import { prepareFittedCatalogueObjectTransfer, projectZoneObjectBranch } from '../utils/zone-object-branch'
import { resolveSystemObjectTransferMapPlacement } from '../utils/system-object-transfer-map-placement'
import {
  CONTINUOUS_SYSTEM_NAME_FONT_PIXELS as SYSTEM_NAME_FONT_PIXELS,
  CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS as SYSTEM_RESIZE_HANDLE_PIXELS,
  continuousMapNameLabelFramePosition,
  continuousMapNameLabels,
} from '../utils/continuous-map-name-labels'
import type { ContinuousMapNameLabel } from '../utils/continuous-map-name-labels'
import { continuousSystemFrames } from '../utils/continuous-system-frames'
import { constrainContinuousSystemFrame, type ContinuousSystemFrameInput } from '../utils/continuous-system-frames'
import {
  continuousMapRoundedFrameContains,
  continuousMapRoundedFramePath,
  planBoundedZoneLanding,
  type ContinuousMapElasticPlacementPreview,
} from '../utils/continuous-map-elastic-placement'
import { nextContinuousMapPreviewVersion } from '../utils/continuous-map-preview-version'
import { continuousMapKeyboardIntent } from '../utils/continuous-map-keyboard-intent'
import { canStartSelectedObjectDrag } from './maps/select-object-drag-input'
import type { SelectedObjectDrag, SelectedObjectDragPreview } from '../composables/editor-workflows/selected-object-drag'
import { useContinuousMapDetailMotion } from '../composables/useContinuousMapDetailMotion'
import ContinuousMapRouteLayer from './maps/ContinuousMapRouteLayer.vue'
import WardenRouteObjectLayer from './maps/WardenRouteObjectLayer.vue'
import { pointOnRoute, projectRouteObjects, routeObjectMarkerRadiusPixels } from '../utils/route-object-geometry'
import { routeObjectTargetAt } from './maps/route-object-target'
import { projectPointOntoRoute } from '../utils/continuous-map-route-hit'
import type { SystemObjectBranch } from '../domain/workspace-object-branch'
import type { CatalogueObjectTransferRequest, CatalogueObjectTransferReview, RouteContents, RouteLanding, RouteObject } from '../domain/workspace'
import type { RouteObjectPlacementRequest } from '../composables/editor-workflows/useRouteObjectPlacement'
import ContinuousWardenOrbitLayer from './maps/ContinuousWardenOrbitLayer.vue'
import WardenObjectPublicationBadge from './maps/WardenObjectPublicationBadge.vue'

const EMPTY_ORBIT_PAINT_MARKS = [] as const
const SEARCH_LOCATOR_LOCAL_RADIUS = 25
const SEARCH_LOCATOR_MIN_SCREEN_RADIUS = 10
const MINIMUM_FIT_PADDING = 48
const ROUTE_REVEAL_PADDING_PIXELS = 14
const ROUTE_FAN_OUT_LIMIT_PIXELS = 96
const ORBIT_STROKE_CLIP_RADIUS_PIXELS = 256
const ORBIT_STROKE_CLIP_OVERSCAN_PIXELS = 16
const VIEWPORT_FEEDBACK_INTERVAL_MS = 120
const WHEEL_ZOOM_DURATION_MS = 160
const WHEEL_ZOOM_SETTLE_SCALE_EPSILON = 0.0005
const WHEEL_ZOOM_SETTLE_TRANSLATION_EPSILON = 0.05
const PRECISE_WHEEL_DELTA_THRESHOLD = 32
const WHEEL_ANCHOR_BURST_TIMEOUT_MS = 150
const DETAIL_RENDER_OVERSCAN_PIXELS = 36
const OVERVIEW_DETAIL_SYSTEM_IDS: ReadonlySet<string> = new Set()

const props = defineProps<{
  cluster: JumpCluster
  workspace: LocalWorkspace
  systemPositions: Readonly<Record<string, Point>>
  unresolvedExitPositions?: Readonly<Record<string, Point>>
  dimmedObjectIds?: readonly string[]
  appliedDimmedObjectIds?: readonly string[]
  /** Validated Warden draft paint over the applied, command-owned workspace. */
  presentation?: Pick<LocalWorkspace, 'cluster' | 'layout'> | null
  objectAngles: Readonly<Record<string, number>>
  orbitRadii: Readonly<Record<string, { horizontal: number; vertical: number }>>
  orbitRotations: Readonly<Record<string, number>>
  selectedSystemId: string | null
  selectedObjectIds: readonly string[]
  selectedRouteId: string | null
  routeObjectEditingId?: string
  inspectedTarget: InspectedMapTarget | null
  mode: MapInteractionMode
  creationType: SystemCreationType | null
  orbitCreationPreview?: OrbitCreationMapPreview | null
  creationOtherType: string | null
  objectAddPinnedOwnerId: string | null
  isEntityCommandBlocked?: (command: EntityCommand) => boolean
  clusterAddType: 'system' | 'route' | null
  clusterChooserOpen: boolean
  clusterMoveTargeting: boolean
  moveTargeting: boolean
  standaloneImportPlacementEnabled?: boolean
  standaloneImportPlacement?: StandaloneImportPlacementView | null
  keyboardOwnedOverlayOpen?: boolean
  systemObjectTransferPreview?: SystemObjectTransferMapPreview | null
  touchNavigation?: boolean
  initialViewport: MapViewport | null
  getUsableClientRect?: () => ClientRectBounds | undefined
  orbitAdjustmentPreview?: OrbitAdjustmentPreview | null
  beginSelectedObjectDrag?: (
    anchorId: string,
    continuousSystemScales: ReadonlyMap<string, number>,
    expectedMode?: Extract<MapInteractionMode, 'select' | 'move'>,
    pixelsPerSceneUnit?: number,
  ) => SelectedObjectDrag | null
}>()

const emit = defineEmits<{
  'activate-system': [id: string]
  'select-object': [systemId: string, objectId: string]
  'select-orbit': [systemId: string, orbitId: string]
  'select-route': [routeId: string]
  'select-route-object': [routeId: string, objectId: string]
  'move-route-object': [request: RouteObjectPlacementRequest, ownsRequest: () => boolean]
  'cluster-target': [point: Point, systemIds: string[]]
  'continuous-object-add-target': [request: ContinuousObjectAddTarget]
  'continuous-orbit-add-target': [owners: readonly OrbitAddOwner[], requiresOwnerChoice: boolean, workspace: LocalWorkspace]
  'move-object-in-system': [systemId: string, objectId: string, position: Point, workspaceSnapshot: LocalWorkspace, frameInsets?: SystemFrameInsets, selectDrag?: SelectMapObjectDragContext]
  'resize-system-frame': [systemId: string, insets: SystemFrameInsets, workspaceSnapshot: LocalWorkspace]
  'transfer-object-on-drop': [drop: SystemObjectTransferDrop, selectDrag?: SelectMapObjectDragContext]
  'orbit-adjustment': [input: OrbitAdjustmentInput]
  'entity-command-blocked': [command: EntityCommand]
  'move-orbit-center': [orbitId: string, center: Point, hostId: string | null, systemId: string, sourceGeometry: string]
  'orbit-center-candidates': [orbitId: string, candidates: OrbitCenterMoveCandidate[], systemId: string]
  'resize-orbit': [orbitId: string, radii: OrbitRadii, systemId: string, sourceGeometry: string]
  'rotate-orbit': [orbitId: string, rotation: number, systemId: string, sourceGeometry: string]
  'move-system': [id: string, position: Point]
  'move-unresolved-exit': [routeId: string, position: Point]
  'move-target': [point: Point]
  'standalone-import-placement-anchor': [anchor: Point]
  'editing-gesture-change': [active: boolean]
  'viewport-change': [viewport: MapViewport]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const mapDom = useWardenMapDom({
  getRoot: () => svgElement.value,
  getUsableClientRect: () => props.getUsableClientRect?.(),
})
const {
  systemIdAtTarget,
  objectTargetAtTarget,
  orbitTargetAtTarget,
  orbitEditTargetAtTarget,
  routeIdAtTarget,
  systemFrameResizeTarget,
  isExitMarkerTarget,
  focusMap,
  focusedDetailSystemId,
  preserveFocusBeforeDetailCollapse,
} = mapDom
const haloGradientId = `continuous-warden-halo-${useId()}`
const routeLayer = ref<InstanceType<typeof ContinuousMapRouteLayer> | null>(null)
const viewport = ref<MapViewport>({ x: 0, y: 0, k: 1 })
const previewPositions = ref(new Map<string, Point>())
const frameResizePreview = shallowRef<{ systemId: string; frame: SvgViewportRect } | null>(null)
const elasticPlacementPreview = shallowRef<(ContinuousMapElasticPlacementPreview & { systemId: string }) | null>(null)
const frameGrowthAnimation = shallowRef<ElasticFrameGrowthAnimation | null>(null)
let pendingElasticFrameGrowth: PendingElasticFrameGrowth | null = null
const selectedObjectDragPreview = shallowRef<SelectedObjectDragPreview | null>(null)
const transferPreviewOverride = shallowRef<SystemObjectTransferMapPreview | null | undefined>(undefined)
const draggedBranchPreview = shallowRef<ReturnType<typeof projectZoneObjectBranch>>(null)
const objectMovePreview = shallowRef<{ systemId: string; objectId: string; projection: ContinuousWardenSystemProjection } | null>(null)
const preciseObjectPlacementPreview = shallowRef<{ systemId: string; objectId: string; projection: ContinuousWardenSystemProjection } | null>(null)
const preciseOrbitCenterMovePreview = shallowRef<{ systemId: string; orbitId: string; projection: ContinuousWardenSystemProjection } | null>(null)
const directOrbitPreview = shallowRef<{ systemId: string; orbitId: string; projection: ContinuousWardenSystemProjection } | null>(null)
const orbitPlacementPreview = shallowRef<{ systemId: string; orbitId: string; preview: { center: Point; radii: { horizontal: number; vertical: number }; rotation?: number } } | null>(null)
const exitPositionOverrides = ref(new Map<string, Point>())
const previewVersions = ref(new Map<string, number>())
const detailSystemIds = shallowRef<ReadonlySet<string>>(new Set())
const detailMotion = useContinuousMapDetailMotion(detailSystemIds)
const minimumZoomScale = ref(MAP_ZOOM_MIN_SCALE)
const svgPixelScale = ref(1)
const svgViewport = ref<SvgViewportRect>({ x: 0, y: 0, width: 960, height: 560 })
const ready = ref(false)
const searchLocatorTarget = shallowRef<{ clusterId: string; ownerId: string; objectId: string } | null>(null)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
let resizeObserver: ResizeObserver | undefined
let viewportFeedbackTimer: ReturnType<typeof setTimeout> | undefined
let wheelZoomFrame: number | undefined
type SvgPointTransform = Pick<DOMMatrixReadOnly, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>
let wheelAnchorTransform: { element: SVGSVGElement; inverse: SvgPointTransform | null } | null = null
let wheelAnchorLastInputAt = Number.NEGATIVE_INFINITY
let observedVisualViewport: VisualViewport | undefined
let pendingWheelZoom: {
  start: MapViewport
  target: MapViewport
  expectedCurrent: MapViewport
  startedAt: number
} | null = null
let cameraInitialized = false
let searchInteractionGeneration = 0
let viewPan: { transform: MapViewport; start: [number, number] } | null = null
interface ActiveObjectDrag {
  systemId: string
  objectId: string
  pointerId: number
  startClient: Point
  lastClient?: Point
  startScene: Point
  originLocal: Point
  anchorDelta: Point
  camera: MapViewport
  legacyAnchor: Point
  projection: ContinuousWardenSystemProjection
  workspaceSnapshot: LocalWorkspace
  anchor: Point
  startDisplayedFrame: SvgViewportRect | null
  preferredFrame: SvgViewportRect
  fixedFrames: readonly ContinuousSystemFrameInput[]
  startFrames: readonly ContinuousSystemFrameInput[]
  authoredFrames: readonly ContinuousSystemFrameInput[]
  selectDrag?: SelectMapObjectDragContext
  moved: boolean
  landing: {
    position: Point
    frameInsets?: SystemFrameInsets
  } | null
  transfer: SystemObjectTransferDrop | null
  crossContext: CatalogueObjectTransferReview | null
  targetScenePoint: Point
}

interface ElasticFrameGrowthAnimation {
  systemId: string
  stretchedPath: string
  sourceFrame: SvgViewportRect
  targetFrame: SvgViewportRect
}

interface PendingElasticFrameGrowth extends ElasticFrameGrowthAnimation {
  objectId: string
  workspaceSnapshot: LocalWorkspace
  expectedInsets: SystemFrameInsets
}

let activeObjectDrag: ActiveObjectDrag | null = null

type RouteDragSource = NonNullable<ReturnType<typeof routeObjectTargetAt>>
interface ActiveRouteObjectDrag extends RouteDragSource {
  pointerId: number
  startClient: Point
  lastClient?: Point
  pointerStart: Point
  origin: Point
  camera: MapViewport
  mode: 'move' | 'select'
  workspaceSnapshot: LocalWorkspace
  geometry: ContinuousMapRouteGeometry
  branch: SystemObjectBranch
  contents: RouteContents
  root: RouteObject
  moved: boolean
  landing: RouteLanding | null
  crossContext: CatalogueObjectTransferReview | null
}
let activeRouteObjectDrag: ActiveRouteObjectDrag | null = null
let routeDragGeneration = 0
const routeMovePreview = shallowRef<{
  routeId: string
  geometry: ContinuousMapRouteGeometry
  branch: SystemObjectBranch
  pointer: RouteContents
  offset: Point
} | null>(null)
const routeLandingPreview = shallowRef<{
  routeId: string
  contents: RouteContents
  geometry: ContinuousMapRouteGeometry
  layout: LocalWorkspace['layout']
  branch: SystemObjectBranch
} | null>(null)
let selectObjectDragGeneration = 0
let activeSelectedObjectDrag: {
  drag: SelectedObjectDrag | null
  systemId: string
  objectId: string
  pointerId: number
  startClient: Point
  startScene: Point
  camera: MapViewport
  workspaceSnapshot: LocalWorkspace
  delta: Point
  moved: boolean
} | null = null
type PendingMapClickTarget =
  | { kind: 'object'; systemId: string; objectId: string }
  | { kind: 'orbit'; systemId: string; orbitId: string }
  | { kind: 'system'; systemId: string }
  | { kind: 'route'; routeId: string }
  | { kind: 'route-object'; routeId: string; objectId: string }
let pendingMapClickTarget: PendingMapClickTarget | null = null
let pendingMapClickTimer: ReturnType<typeof setTimeout> | undefined
let activeAnchorDrag: {
  systemId: string
  pointerId: number
  startClient: Point
  startScene: Point
  origin: Point
  preview: Point
  moved: boolean
} | null = null
interface ActiveSystemFrameResize {
  systemId: string
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  pointerId: number
  startClient: Point
  startScene: Point
  camera: MapViewport
  workspaceSnapshot: LocalWorkspace
  anchor: Point
  startFrame: SvgViewportRect
  fixedFrames: readonly ContinuousSystemFrameInput[]
  previewFrame: SvgViewportRect
  moved: boolean
}

let activeSystemFrameResize: ActiveSystemFrameResize | null = null
interface ActiveExitDrag {
  routeId: string
  pointerId: number
  startClient: Point
  startScene: Point
  origin: Point
  camera: MapViewport
  workspaceSnapshot: LocalWorkspace
  position: Point | null
}

let activeExitDrag: ActiveExitDrag | null = null
type OrbitGestureBase = {
  systemId: string
  orbitId: string
  pointerId: number
  startClient: Point
  camera: MapViewport
  anchorDelta: Point
  projection: ContinuousWardenSystemProjection
  legacyAnchor: Point
  workspaceSnapshot: LocalWorkspace
  systemSnapshot: StarSystem
  orbitSnapshot: Orbit
  sourceGeometry: string
  center: Point
  startRadii: OrbitRadii
  startRotation: number
  moved: boolean
}
type ActiveOrbitGesture =
  | (OrbitGestureBase & { kind: 'resize'; axis: 'global' | 'horizontal' | 'vertical'; startDistance: number; previewRadii: OrbitRadii })
  | (OrbitGestureBase & { kind: 'rotation'; lastPointerAngle: number; previewRotation: number })
  | (OrbitGestureBase & {
      kind: 'center'
      previewCenter: Point
      previewHostId: string | null
      previewRadii: OrbitRadii
      candidates: OrbitCenterMoveCandidate[]
      hasResolvedCandidate: boolean
    })
let activeOrbitGesture: ActiveOrbitGesture | null = null
type OrbitEditTarget = NonNullable<ReturnType<typeof orbitEditTargetAtTarget>>
type WardenMovePointerTarget =
  | { kind: 'object'; systemId: string; objectId: string }
  | { kind: 'anchor'; systemId: string }
  | { kind: 'exit'; routeId: string }
  | { kind: 'orbit'; target: OrbitEditTarget }
type WardenMoveHit = { target: WardenMovePointerTarget | null; blockedCommand: EntityCommand | null }
let suppressNextMapClick = false
let suppressNextMapClickTimer: ReturnType<typeof setTimeout> | undefined
let resolveReady: (value: boolean) => void = () => undefined
const readiness = new Promise<boolean>(resolve => { resolveReady = resolve })

const systemGeometry = computed(() => ({
  objectAngles: props.objectAngles,
  orbitRadii: props.orbitRadii,
  orbitRotations: props.orbitRotations,
}))
interface OrbitAddOwner {
  systemId: string
  candidates: SystemCreationCandidate[]
}

const dimmedObjectIds = computed(() => new Set(props.dimmedObjectIds ?? []))

const projections = computed(() => props.cluster.systems.map((system, index) => projectWardenSystem(
  system,
  props.systemPositions[system.id] ?? initialClusterSystemPosition(index),
  systemGeometry.value,
  undefined,
  workspaceSystemFrame(props.workspace, system.id),
)))
const transferBranchPreview = computed(() => {
  const preview = transferPreviewOverride.value === undefined
    ? props.systemObjectTransferPreview
    : transferPreviewOverride.value
  if (!preview
    || preview.previewWorkspace.id !== props.workspace.id
    || preview.previewWorkspace.cluster.id !== props.cluster.id
    || !props.cluster.systems.some(system => system.id === preview.destinationSystemId)) return null
  const system = preview.previewWorkspace.cluster.systems.find(candidate => candidate.id === preview.destinationSystemId)
  const anchor = props.systemPositions[preview.destinationSystemId]
  if (!system || !anchor) return null
  try {
    const projection = projectWardenSystem(
      system,
      anchor,
      systemMapGeometry(preview.previewWorkspace),
      undefined,
      workspaceSystemFrame(preview.previewWorkspace, system.id),
    )
    const movedObjectIds = new Set(preview.movedObjectIds)
    const movedOrbitIds = new Set(preview.movedOrbitIds)
    return {
      rootObjectId: preview.rootObjectId,
      projection,
      objects: projection.objects.filter(object => movedObjectIds.has(object.id)),
      orbits: projection.orbits.filter(orbit => movedOrbitIds.has(orbit.id)),
      objectSubtypes: new Map(system.objects.map(object => [object.id, object.subtype] as const)),
    }
  } catch {
    return null
  }
})
const landingBranchPreview = computed(() => draggedBranchPreview.value ?? transferBranchPreview.value)
const sceneCluster = computed(() => props.presentation?.cluster ?? props.cluster)
const displayedRouteBranches = computed(() => (routeLayer.value?.displayedMarks ?? []).flatMap(({ id, geometry }) => {
  const contents = routeContentsFor(sceneCluster.value, id)
  return contents?.objects.length ? [{ id, contents, geometry }] : []
}))
const presentationProjections = computed(() => {
  const draft = props.presentation
  if (!draft) return projections.value
  return draft.cluster.systems.map((system, index) => projectWardenSystem(
    system,
    draft.layout.systemPositions[system.id] ?? initialClusterSystemPosition(index),
    draft.layout,
    undefined,
    workspaceSystemFrame({ ...props.workspace, layout: draft.layout }, system.id),
  ))
})
const systemFrameInputs = computed(() => presentationProjections.value.map(projection => {
  const anchor = anchorFor(projection)
  const delta = { x: anchor.x - projection.anchor.x, y: anchor.y - projection.anchor.y }
  const preferred = projection.preferredFrame ?? projection.envelope
  return {
    id: projection.id,
    anchor,
    envelope: {
      ...preferred,
      x: preferred.x + delta.x,
      y: preferred.y + delta.y,
    },
  }
}))
const displayFrames = computed(() => {
  const resize = frameResizePreview.value
  const baseline = baselineDisplayedFrameInputs()
  const preview = new Map(baseline.map(frame => [frame.id, frame.envelope] as const))
  if (resize) preview.set(resize.systemId, resize.frame)
  for (const [id, frame] of selectedObjectDragPreview.value?.frames ?? []) preview.set(id, frame)
  return preview
})

function baselineDisplayedFrameInputs(): ContinuousSystemFrameInput[] {
  const inputs = systemFrameInputs.value
  const displayed = continuousSystemFrames(inputs)
  return inputs.map(frame => ({ ...frame, envelope: displayed.get(frame.id) ?? frame.envelope }))
}
const systemFrameResizeHandles = computed(() => {
  if (props.presentation) return []
  const size = SYSTEM_RESIZE_HANDLE_PIXELS / svgPixelScale.value
  return presentationProjections.value.flatMap(projection => {
    if (!canResizeSystemFrame(projection.id)) return []
    const frame = displayFrames.value.get(projection.id)
    if (!hasPositiveFrame(frame)) return []
    const left = viewport.value.x + viewport.value.k * frame.x
    const top = viewport.value.y + viewport.value.k * frame.y
    const right = viewport.value.x + viewport.value.k * (frame.x + frame.width)
    const bottom = viewport.value.y + viewport.value.k * (frame.y + frame.height)
    const cornerInset = Math.min(CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS, frame.width / 2, frame.height / 2)
      * (1 - Math.SQRT1_2)
    return [
      { corner: 'top-left' as const, x: left + viewport.value.k * cornerInset, y: top + viewport.value.k * cornerInset },
      { corner: 'top-right' as const, x: right - viewport.value.k * cornerInset, y: top + viewport.value.k * cornerInset },
      { corner: 'bottom-left' as const, x: left + viewport.value.k * cornerInset, y: bottom - viewport.value.k * cornerInset },
      { corner: 'bottom-right' as const, x: right - viewport.value.k * cornerInset, y: bottom - viewport.value.k * cornerInset },
    ].map(handle => ({
      ...handle,
      systemId: projection.id,
      systemName: projection.name,
      x: handle.x - size / 2,
      y: handle.y - size / 2,
      size,
    }))
  })
})
const presentationProjectionById = computed(() => new Map(presentationProjections.value.map(projection => [projection.id, projection] as const)))
const appliedObjectOwners = computed(() => new Map(props.cluster.systems.flatMap(system =>
  system.objects.map(object => [object.id, system.id] as const),
)))
const selectedObjectIdSet = computed(() => new Set(props.selectedObjectIds))
const hiddenSelectedObjectCount = computed(() => {
  return props.selectedObjectIds.filter(objectId => {
    const ownerId = appliedObjectOwners.value.get(objectId)
    return ownerId !== undefined && !detailSystemIds.value.has(ownerId)
  }).length
})
const individualGestureProjections = computed(() => presentationProjections.value.map(projection => {
  const preview = objectMovePreview.value?.systemId === projection.id
    ? objectMovePreview.value
    : preciseObjectPlacementPreview.value?.systemId === projection.id
      ? preciseObjectPlacementPreview.value
      : preciseOrbitCenterMovePreview.value?.systemId === projection.id
        ? preciseOrbitCenterMovePreview.value
        : null
  const directOrbit = directOrbitPreview.value?.systemId === projection.id
    ? directOrbitPreview.value.projection
    : null
  const adjustment = props.orbitAdjustmentPreview
  if (!preview && !directOrbit && adjustment?.identity.systemId !== projection.id) return projection
  const applied = projections.value.find(candidate => candidate.id === projection.id)
  if (!applied) return projection
  const adjustedOrbit = adjustment?.identity.systemId === projection.id
    ? projectionWithOrbitAdjustment(applied, adjustment)
    : null
  const gestureProjection = adjustedOrbit ?? directOrbit ?? preview?.projection
  if (!gestureProjection) return projection
  return projection === applied
    ? { ...projection, objects: gestureProjection.objects, orbits: gestureProjection.orbits }
    : overlayHeldGeometry(projection, applied, gestureProjection)
}))
const renderedProjections = computed(() => {
  const groupPreview = selectedObjectDragPreview.value
  if (!groupPreview) return individualGestureProjections.value
  return individualGestureProjections.value.map(projection => {
    const positions = new Map([...groupPreview.positions].filter(([objectId]) => groupPreview.objectSystemIds.get(objectId) === projection.id))
    if (positions.size === 0) return projection
    const sourceSystem = props.cluster.systems.find(system => system.id === projection.id)
    const orbitHostIds = new Map(sourceSystem?.orbits.map(orbit => [orbit.id, orbit.hostId] as const) ?? [])
    return previewWardenSystemObjects(projection, positions, orbitHostIds)
  })
})

/** Keep detail membership intact while avoiding SVG work for fully offscreen systems. */
const mountedDetailSystemIds = computed(() => {
  const mounted = new Set<string>()
  const focusedSystemId = focusedDetailSystemId()
  const activeSystemIds = new Set<string>()
  if (activeObjectDrag) activeSystemIds.add(activeObjectDrag.systemId)
  if (activeSelectedObjectDrag) activeSystemIds.add(activeSelectedObjectDrag.systemId)
  if (activeAnchorDrag) activeSystemIds.add(activeAnchorDrag.systemId)
  if (activeSystemFrameResize) activeSystemIds.add(activeSystemFrameResize.systemId)
  if (activeOrbitGesture) activeSystemIds.add(activeOrbitGesture.systemId)
  if (objectMovePreview.value) activeSystemIds.add(objectMovePreview.value.systemId)
  if (preciseObjectPlacementPreview.value) activeSystemIds.add(preciseObjectPlacementPreview.value.systemId)
  if (preciseOrbitCenterMovePreview.value) activeSystemIds.add(preciseOrbitCenterMovePreview.value.systemId)
  if (directOrbitPreview.value) activeSystemIds.add(directOrbitPreview.value.systemId)
  for (const systemId of selectedObjectDragPreview.value?.objectSystemIds.values() ?? []) {
    activeSystemIds.add(systemId)
  }

  for (const projection of renderedProjections.value) {
    if (!detailSystemIds.value.has(projection.id) && !detailMotion.isLeaving(projection.id)) continue
    if (projection.id === focusedSystemId || activeSystemIds.has(projection.id)
      || detailSystemIntersectsViewport(projection)) mounted.add(projection.id)
  }
  return mounted
})

/** A held gesture owns changed geometry, while unrelated draft labels, positions and Orbits stay painted. */
function overlayHeldGeometry(
  presentation: ContinuousWardenSystemProjection,
  applied: ContinuousWardenSystemProjection,
  held: ContinuousWardenSystemProjection,
): ContinuousWardenSystemProjection {
  const samePoint = (left: Point, right: Point) => left.x === right.x && left.y === right.y
  const appliedObjects = new Map(applied.objects.map(object => [object.id, object]))
  const heldObjects = new Map(held.objects.map(object => [object.id, object]))
  const appliedOrbits = new Map(applied.orbits.map(orbit => [orbit.id, orbit]))
  const heldOrbits = new Map(held.orbits.map(orbit => [orbit.id, orbit]))
  return {
    ...presentation,
    objects: presentation.objects.map(object => {
      const original = appliedObjects.get(object.id)
      const next = heldObjects.get(object.id)
      if (!original || !next || samePoint(original.position, next.position)) return object
      return { ...object, position: next.position, scenePosition: presentation.projectLocalPoint(next.position) }
    }),
    orbits: presentation.orbits.map(orbit => {
      const original = appliedOrbits.get(orbit.id)
      const next = heldOrbits.get(orbit.id)
      if (!original || !next) return orbit
      const centerChanged = !samePoint(original.center, next.center)
      const radiiChanged = original.radii.horizontal !== next.radii.horizontal || original.radii.vertical !== next.radii.vertical
      return {
        ...orbit,
        center: centerChanged ? next.center : orbit.center,
        sceneCenter: centerChanged ? presentation.projectLocalPoint(next.center) : orbit.sceneCenter,
        radii: radiiChanged ? next.radii : orbit.radii,
        sceneRadii: radiiChanged ? next.sceneRadii : orbit.sceneRadii,
        rotation: original.rotation !== next.rotation ? next.rotation : orbit.rotation,
      }
    }),
  }
}

function isObjectMovePreview(systemId: string, objectId: string): boolean {
  return (objectMovePreview.value?.systemId === systemId && objectMovePreview.value.objectId === objectId)
    || (preciseObjectPlacementPreview.value?.systemId === systemId
      && preciseObjectPlacementPreview.value.objectId === objectId)
}

function groupObjectPreview(systemId: string, objectId: string): SelectedObjectDragPreview | null {
  const preview = selectedObjectDragPreview.value
  return preview?.objectSystemIds.get(objectId) === systemId && preview.positions.has(objectId) ? preview : null
}

function isGroupObjectMovePreview(systemId: string, objectId: string): boolean {
  return groupObjectPreview(systemId, objectId) !== null
}

function isGroupObjectArriving(objectId: string): boolean {
  return selectedObjectDragPreview.value?.arrivingObjectIds.has(objectId) ?? false
}

function isGroupObjectDeparting(objectId: string): boolean {
  return selectedObjectDragPreview.value?.departingObjectIds.has(objectId) ?? false
}

function objectTransform(
  projection: ContinuousWardenSystemProjection,
  object: ContinuousWardenSystemProjection['objects'][number],
): string {
  const position = groupObjectPreview(projection.id, object.id)?.positions.get(object.id) ?? object.position
  const point = detailPaintPoint(projection, position)
  return `translate(${point.x} ${point.y})`
}

const routeMarks = computed(() => {
  const cluster = sceneCluster.value
  const jumpPoints = new Map(jumpPointsInCluster(cluster).map(reference => [reference.point.id, reference]))
  return cluster.routes.map(route => {
    const endpointLabel = clusterRouteLabel(route, cluster, jumpPoints)
    return {
      id: route.id,
      jumpLevel: route.jumpLevel,
      accessibleLabel: route.name ? `${endpointLabel}, ${route.name}` : endpointLabel,
      unresolved: route.toSystemId === null,
      ...(route.toSystemId === null ? { destinationCaption: route.unresolvedExit } : {}),
    }
  })
})

const routeAnchorOverrides = computed(() => new Map(projections.value.flatMap(projection =>
  previewPositions.value.has(projection.id) ? [[projection.id, anchorFor(projection)] as const] : [],
)))

const routePixelScale = computed(() => viewport.value.k * svgPixelScale.value)
const routeFanOutLimitPixels = computed(() => Math.min(
  ROUTE_FAN_OUT_LIMIT_PIXELS,
  Math.min(svgViewport.value.width, svgViewport.value.height) * svgPixelScale.value / 4,
))

function routesAtDetail(detail: ReadonlySet<string>, pixelsPerSceneUnit?: number) {
  return buildContinuousWardenRouteGeometries({
    routes: sceneCluster.value.routes,
    projections: getRenderedSystemProjections(),
    detailSystemIds: detail,
    frames: displayFrames.value,
    anchorOverrides: routeAnchorOverrides.value,
    unresolvedExitPositions: props.presentation?.layout.unresolvedExitPositions ?? props.unresolvedExitPositions,
    exitPositionOverrides: exitPositionOverrides.value,
    display: pixelsPerSceneUnit === undefined
      ? undefined
      : { pixelsPerSceneUnit, fanOutLimitPixels: routeFanOutLimitPixels.value },
  })
}

const routeGeometries = computed(() => routesAtDetail(detailSystemIds.value, routePixelScale.value))
const overviewRoutes = computed(() => buildContinuousWardenRouteGeometries({
  routes: props.cluster.routes,
  projections: projections.value,
  detailSystemIds: OVERVIEW_DETAIL_SYSTEM_IDS,
  unresolvedExitPositions: props.unresolvedExitPositions,
}))
const hasOverlappingOverviewRoutes = computed(() =>
  [...overviewRoutes.value.values()].some(route => route.sharesDisplayedEndpoints),
)

const standaloneImportProjection = computed(() => {
  const placement = props.standaloneImportPlacement
  if (!props.standaloneImportPlacementEnabled || !placement) return null
  const system: StarSystem = {
    ...placement.system,
    objects: placement.system.objects.map(object => ({
      ...object,
      placement: { ...object.placement },
      playerFieldMasks: [...object.playerFieldMasks],
      ...(object.customFieldValues ? { customFieldValues: { ...object.customFieldValues } } : {}),
    })),
    orbits: placement.system.orbits.map(orbit => orbit.hostId === null
      ? { ...orbit, center: { ...orbit.center } }
      : { ...orbit, hostId: orbit.hostId }),
  }
  return projectWardenSystem(system, { ...placement.anchor }, {
    objectAngles: { ...placement.geometry.objectAngles },
    orbitRadii: { ...placement.geometry.orbitRadii },
    orbitRotations: { ...placement.geometry.orbitRotations },
  })
})

const sceneBounds = computed<SvgViewportRect | null>(() => {
  if (projections.value.length === 0) return null
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const projection of projections.value) {
    const delta = anchorDelta(projection)
    left = Math.min(left, projection.envelope.x + delta.x)
    top = Math.min(top, projection.envelope.y + delta.y)
    right = Math.max(right, projection.envelope.x + delta.x + projection.envelope.width)
    bottom = Math.max(bottom, projection.envelope.y + delta.y + projection.envelope.height)
    const displayed = displayFrames.value.get(projection.id)
    if (displayed) {
      left = Math.min(left, displayed.x + delta.x)
      top = Math.min(top, displayed.y + delta.y)
      right = Math.max(right, displayed.x + delta.x + displayed.width)
      bottom = Math.max(bottom, displayed.y + delta.y + displayed.height)
    }
  }
  for (const { bounds } of overviewRoutes.value.values()) {
    left = Math.min(left, bounds.x)
    top = Math.min(top, bounds.y)
    right = Math.max(right, bounds.x + bounds.width)
    bottom = Math.max(bottom, bounds.y + bounds.height)
  }
  return [left, top, right, bottom].every(Number.isFinite)
    ? { x: left - MINIMUM_FIT_PADDING, y: top - MINIMUM_FIT_PADDING, width: right - left + MINIMUM_FIT_PADDING * 2, height: bottom - top + MINIMUM_FIT_PADDING * 2 }
    : null
})

const cameraTransform = computed(() => `translate(${viewport.value.x} ${viewport.value.y}) scale(${viewport.value.k})`)
function anchorFor(projection: ContinuousWardenSystemProjection): Point {
  const preview = previewPositions.value.get(projection.id)
  return preview
    ? clusterSystemPosition({ [projection.id]: preview }, projection.id)
    : projection.anchor
}

function anchorDelta(projection: ContinuousWardenSystemProjection): Point {
  const anchor = anchorFor(projection)
  return { x: anchor.x - projection.anchor.x, y: anchor.y - projection.anchor.y }
}

function translatedRawFrame(projection: ContinuousWardenSystemProjection): SvgViewportRect {
  const delta = anchorDelta(projection)
  return {
    ...projection.envelope,
    x: projection.envelope.x + delta.x,
    y: projection.envelope.y + delta.y,
  }
}

function displayFrameFor(systemId: string): SvgViewportRect {
  return displayFrames.value.get(systemId) ?? { x: 0, y: 0, width: 0, height: 0 }
}

function detailFrameFor(projection: ContinuousWardenSystemProjection): SvgViewportRect {
  const frame = displayFrames.value.get(projection.id)
  return hasPositiveFrame(frame) ? frame : translatedRawFrame(projection)
}

/** Semantic reveal follows projected contents; editable frame sizing only affects presentation. */
function semanticEnvelopeFor(projection: ContinuousWardenSystemProjection): Pick<SvgViewportRect, 'width' | 'height'> {
  return projection.envelope
}

function detailSystemIntersectsViewport(projection: ContinuousWardenSystemProjection): boolean {
  const envelope = translatedRawFrame(projection)
  const { x, y, k } = viewport.value
  const screenBounds = {
    left: x + envelope.x * k,
    top: y + envelope.y * k,
    right: x + (envelope.x + envelope.width) * k,
    bottom: y + (envelope.y + envelope.height) * k,
  }
  if (!Object.values(screenBounds).every(Number.isFinite)) return true
  const overscan = svgPixelScale.value > 0
    ? DETAIL_RENDER_OVERSCAN_PIXELS / svgPixelScale.value
    : DETAIL_RENDER_OVERSCAN_PIXELS
  const viewportRect = svgViewport.value
  return screenBounds.right >= viewportRect.x - overscan
    && screenBounds.left <= viewportRect.x + viewportRect.width + overscan
    && screenBounds.bottom >= viewportRect.y - overscan
    && screenBounds.top <= viewportRect.y + viewportRect.height + overscan
}

function hasPositiveFrame(frame: SvgViewportRect | undefined): frame is SvgViewportRect {
  return !!frame && Number.isFinite(frame.width) && Number.isFinite(frame.height)
    && frame.width > 0 && frame.height > 0
}

function startSystemFrameResize(
  event: PointerEvent,
  element: SVGSVGElement,
  target: NonNullable<ReturnType<typeof systemFrameResizeTarget>>,
): void {
  if (event.button !== 0 || !event.isPrimary || !canResizeSystemFrame(target.systemId) || props.presentation || props.creationType || props.clusterAddType || props.clusterChooserOpen
    || props.moveTargeting || props.clusterMoveTargeting || props.standaloneImportPlacementEnabled
    || props.systemObjectTransferPreview || props.keyboardOwnedOverlayOpen) return
  const projection = presentationProjections.value.find(candidate => candidate.id === target.systemId)
  const baselineFrames = baselineDisplayedFrameInputs()
  const frame = baselineFrames.find(candidate => candidate.id === target.systemId)?.envelope
  const startScene = cameraPoint(event)
  if (!projection || !hasPositiveFrame(frame) || !startScene) return
  const fixedFrames = baselineFrames.filter(candidate => candidate.id !== target.systemId)
  activeSystemFrameResize = {
    systemId: target.systemId,
    corner: target.corner,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene,
    camera: getViewport(),
    workspaceSnapshot: props.workspace,
    anchor: anchorFor(projection),
    startFrame: { ...frame },
    fixedFrames,
    previewFrame: { ...frame },
    moved: false,
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* Capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
}

function resizeFrameFromDrag(drag: ActiveSystemFrameResize, point: Point): SvgViewportRect {
  return resizeFrameByDelta(
    drag.systemId,
    drag.anchor,
    drag.startFrame,
    drag.corner,
    { x: point.x - drag.startScene.x, y: point.y - drag.startScene.y },
    drag.fixedFrames,
  )
}

function resizeFrameByDelta(
  systemId: string,
  anchor: Point,
  startFrame: SvgViewportRect,
  corner: ActiveSystemFrameResize['corner'],
  delta: Point,
  fixedFrames: readonly ContinuousSystemFrameInput[],
): SvgViewportRect {
  let left = startFrame.x
  let top = startFrame.y
  let right = startFrame.x + startFrame.width
  let bottom = startFrame.y + startFrame.height
  const minimumWidth = Math.min(CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS * 2, startFrame.width)
  const minimumHeight = Math.min(CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS * 2, startFrame.height)
  if (corner.endsWith('left')) left = Math.min(right - minimumWidth, anchor.x, left + delta.x)
  else right = Math.max(left + minimumWidth, anchor.x, right + delta.x)
  if (corner.startsWith('top')) top = Math.min(bottom - minimumHeight, anchor.y, top + delta.y)
  else bottom = Math.max(top + minimumHeight, anchor.y, bottom + delta.y)
  const fixedCorner = {
    x: corner.endsWith('left') ? startFrame.x + startFrame.width : startFrame.x,
    y: corner.startsWith('top') ? startFrame.y + startFrame.height : startFrame.y,
  }
  const constrained = constrainContinuousSystemFrame({
    id: systemId,
    anchor,
    envelope: { x: left, y: top, width: right - left, height: bottom - top },
  }, fixedFrames, fixedCorner)
  const contains = (frame: SvgViewportRect, point: Point) => point.x >= frame.x && point.x <= frame.x + frame.width
    && point.y >= frame.y && point.y <= frame.y + frame.height
  const anchorWasInside = contains(startFrame, anchor)
  return hasPositiveFrame(constrained) && contains(constrained, fixedCorner)
    && (!anchorWasInside || contains(constrained, anchor))
    ? constrained
    : startFrame
}

function updateSystemFrameResize(drag: ActiveSystemFrameResize, event: PointerEvent): void {
  if (!hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY }) && !drag.moved) return
  drag.moved = true
  const point = cameraPointAt(event, drag.camera)
  if (!point) return
  drag.previewFrame = resizeFrameFromDrag(drag, point)
  frameResizePreview.value = { systemId: drag.systemId, frame: drag.previewFrame }
  event.preventDefault()
}

function sameFrame(left: SvgViewportRect, right: SvgViewportRect): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

function finishSystemFrameResize(cancelled: boolean): void {
  const drag = activeSystemFrameResize
  if (!drag) return
  activeSystemFrameResize = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already be released. */ }
  }
  frameResizePreview.value = null
  emit('editing-gesture-change', false)
  if (cancelled || drag.moved) suppressClickAfterOwnedGesture()
  if (cancelled || !drag.moved || sameFrame(drag.startFrame, drag.previewFrame)) return
  try {
    const insets = systemFrameInsetsFromRect(drag.anchor, drag.previewFrame)
    emit('resize-system-frame', drag.systemId, insets, drag.workspaceSnapshot)
  } catch {
    // A frame that cannot contain its anchor is never published.
  }
}

function resizeFrameWithKeyboard(
  target: NonNullable<ReturnType<typeof systemFrameResizeTarget>>,
  event: KeyboardEvent,
): boolean {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    || !canResizeSystemFrame(target.systemId) || props.presentation || props.creationType || props.clusterAddType
    || props.clusterChooserOpen || props.moveTargeting || props.clusterMoveTargeting
    || props.standaloneImportPlacementEnabled || props.systemObjectTransferPreview
    || props.keyboardOwnedOverlayOpen) return false
  const projection = presentationProjections.value.find(candidate => candidate.id === target.systemId)
  const baselineFrames = baselineDisplayedFrameInputs()
  const frame = baselineFrames.find(candidate => candidate.id === target.systemId)?.envelope
  if (!projection || !hasPositiveFrame(frame)) return false
  const step = event.shiftKey ? 10 : 2
  let dx = 0
  let dy = 0
  if (target.corner.endsWith('left')) {
    if (event.key === 'ArrowLeft') dx = -step
    if (event.key === 'ArrowRight') dx = step
  } else {
    if (event.key === 'ArrowRight') dx = step
    if (event.key === 'ArrowLeft') dx = -step
  }
  if (target.corner.startsWith('top')) {
    if (event.key === 'ArrowUp') dy = -step
    if (event.key === 'ArrowDown') dy = step
  } else {
    if (event.key === 'ArrowDown') dy = step
    if (event.key === 'ArrowUp') dy = -step
  }
  const resized = resizeFrameByDelta(
    target.systemId,
    anchorFor(projection),
    frame,
    target.corner,
    { x: dx, y: dy },
    baselineFrames.filter(candidate => candidate.id !== target.systemId),
  )
  event.preventDefault()
  event.stopPropagation()
  if (sameFrame(frame, resized)) return true
  try {
    emit('resize-system-frame', target.systemId, systemFrameInsetsFromRect(anchorFor(projection), resized), props.workspace)
  } catch {
    // A frame that cannot contain its anchor is never published.
  }
  return true
}

function systemIdsAtDisplayPoint(point: Point, rounded = false): string[] {
  return presentationProjections.value.filter(projection => {
    const frame = displayFrameFor(projection.id)
    return hasPositiveFrame(frame) && (rounded
      ? continuousMapRoundedFrameContains(point, frame)
      : point.x >= frame.x && point.x <= frame.x + frame.width
        && point.y >= frame.y && point.y <= frame.y + frame.height)
  }).map(projection => projection.id)
}

function systemTransform(projection: ContinuousWardenSystemProjection): string {
  const anchor = anchorFor(projection)
  return `translate(${anchor.x - CONTINUOUS_MAP_LOCAL_ORIGIN.x * projection.scale} ${anchor.y - CONTINUOUS_MAP_LOCAL_ORIGIN.y * projection.scale}) scale(${projection.scale})`
}

/** Scene geometry is projected to SVG viewport coordinates before it reaches the detail paint layer. */
function detailPaintScale(projection: ContinuousWardenSystemProjection): number {
  return projection.scale * viewport.value.k
}

function detailPaintPoint(projection: ContinuousWardenSystemProjection, localPoint: Point): Point {
  const anchor = anchorFor(projection)
  const worldPoint = {
    x: anchor.x + (localPoint.x - projection.localOrigin.x) * projection.scale,
    y: anchor.y + (localPoint.y - projection.localOrigin.y) * projection.scale,
  }
  return {
    x: viewport.value.x + worldPoint.x * viewport.value.k,
    y: viewport.value.y + worldPoint.y * viewport.value.k,
  }
}

function detailObjectPaintStyle(projection: ContinuousWardenSystemProjection) {
  const scale = detailTextPaintScale(projection)
  return {
    '--warden-detail-selection-stroke-width': `${1.35 * scale}px`,
    '--map-object-text-scale': scale,
  }
}

/** Keep both the badge's size and its offset from the object fixed in screen pixels. */
const publicationBadgeTransform = computed(() => {
  const screenUnit = 1 / svgPixelScale.value
  return `translate(${24 * screenUnit} ${-13 * screenUnit}) scale(${1.5 * screenUnit})`
})

/** Cap Add's hit area around the visible glyph, independently of the selection hit area. */
function objectHitRadius(projection: ContinuousWardenSystemProjection): number {
  return props.creationType?.kind === 'object' ? Math.min(18, 22 / systemScreenScale(projection)) : 18
}

function orbitPaintTransform(
  projection: ContinuousWardenSystemProjection,
  localCenter: Point,
  rotation: number,
): string {
  const center = detailPaintPoint(projection, localCenter)
  return `rotate(${rotation} ${center.x} ${center.y})`
}

function orbitPaintGeometry(
  projection: ContinuousWardenSystemProjection,
  orbit: ContinuousWardenSystemProjection['orbits'][number],
) {
  const scale = detailPaintScale(projection)
  return {
    center: detailPaintPoint(projection, orbit.center),
    rx: orbit.radii.horizontal * scale,
    ry: orbit.radii.vertical * scale,
    transform: orbitPaintTransform(projection, orbit.center, orbit.rotation),
  }
}

const orbitPaintBySystem = computed(() => new Map(renderedProjections.value
  .filter(projection => mountedDetailSystemIds.value.has(projection.id))
  .map(projection => [projection.id, projection.orbits.map((orbit) => {
    const geometry = orbitPaintGeometry(projection, orbit)
    const screenRadius = Math.max(geometry.rx, geometry.ry) * svgPixelScale.value
    const clip = screenRadius >= ORBIT_STROKE_CLIP_RADIUS_PIXELS
      ? clipWardenOrbitStroke({
          center: geometry.center,
          rx: geometry.rx,
          ry: geometry.ry,
          rotation: orbit.rotation,
        }, svgViewport.value, ORBIT_STROKE_CLIP_OVERSCAN_PIXELS / svgPixelScale.value)
      : { kind: 'ellipse' as const }
    return { id: orbit.id, label: orbitLabel(projection.id, orbit.id), geometry, clip }
  })] as const)))

function orbitPlacementPreviewPaint(projection: ContinuousWardenSystemProjection) {
  const preview = orbitPlacementPreviewFor(projection.id)
  if (!preview) return null
  const scale = detailPaintScale(projection)
  return {
    center: detailPaintPoint(projection, preview.center),
    rx: preview.radii.horizontal * scale,
    ry: preview.radii.vertical * scale,
    transform: orbitPaintTransform(projection, preview.center, preview.rotation ?? 0),
  }
}

function anchorTransform(projection: ContinuousWardenSystemProjection): string {
  const anchor = anchorFor(projection)
  return `translate(${anchor.x} ${anchor.y}) scale(${1 / (viewport.value.k * svgPixelScale.value)})`
}

const nameLabelLayout = computed<ContinuousMapNameLabel[]>(() => continuousMapNameLabels({
  projections: presentationProjections.value.map(projection => ({
    ...projection,
    anchor: anchorFor(projection),
    envelope: detailFrameFor(projection),
  })),
  viewport: viewport.value,
  viewportRect: svgViewport.value,
  svgPixelScale: svgPixelScale.value,
}))
function positionNameLabel(label: ContinuousMapNameLabel, progress: number): ContinuousMapNameLabel {
  const projection = presentationProjectionById.value.get(label.id)
  if (!projection) return label
  const frame = detailFrameFor(projection)
  return {
    ...label,
    ...continuousMapNameLabelFramePosition(
      label,
      frame,
      viewport.value,
      svgPixelScale.value,
      progress,
      svgViewport.value,
      12,
      canResizeSystemFrame(label.id) && !props.presentation ? SYSTEM_RESIZE_HANDLE_PIXELS : 0,
    ),
    hasLeader: label.hasLeader && progress < .12,
  }
}

const nameLabels = computed(() => nameLabelLayout.value.map(label =>
  positionNameLabel(label, detailMotion.progressFor(label.id)),
))

const sceneSystems = computed(() => new Map(sceneCluster.value.systems.map(system => [system.id, system])))
const sceneObjects = computed(() => new Map(sceneCluster.value.systems.map(system =>
  [system.id, new Map(system.objects.map(object => [object.id, object]))],
)))

function localObject(projectionId: string, objectId: string): StarSystem['objects'][number] | undefined {
  return sceneObjects.value.get(projectionId)?.get(objectId)
}

const routeLabelObstacles = computed(() => nameLabelLayout.value.map(label => {
  const positioned = positionNameLabel(label, Number(detailSystemIds.value.has(label.id)))
  return {
    x: positioned.x - positioned.width / 2,
    y: positioned.y,
    width: positioned.width,
    height: positioned.height,
  }
}))

const objectGlyphs: Readonly<Record<string, string>> = {
  star: '✦', planet: '◉', moon: '☾', asteroid: '◆', belt: '⋯', station: '⌂', base: '▤', colony: '⚑',
  vessel: '△', derelict: '▽', 'jump-point': '⊕', anomaly: '✧', nebula: '◌', hazard: '⚠', other: '◇',
}

function objectGlyph(projectionId: string, objectId: string): string {
  return objectGlyphs[objectSubtype(projectionId, objectId)] ?? '◇'
}

function landingObjectGlyph(object: ContinuousWardenSystemProjection['objects'][number]): string {
  const subtype = landingBranchPreview.value?.objectSubtypes.get(object.id)
  return objectGlyphs[subtype ?? ''] ?? '◇'
}

function objectSubtype(projectionId: string, objectId: string): string {
  return localObject(projectionId, objectId)?.subtype ?? ''
}

function localOrbit(systemId: string, orbitId: string): Orbit | undefined {
  return props.cluster.systems.find(system => system.id === systemId)?.orbits.find(orbit => orbit.id === orbitId)
}

function orbitAxisHandlePoint(
  orbit: ContinuousWardenSystemProjection['orbits'][number],
  axis: 'horizontal' | 'vertical',
): Point {
  return orbitPointAtAngle(orbit.center, orbit.radii, axis === 'horizontal' ? 0 : -Math.PI / 2, orbit.rotation)
}

function orbitRadiusSliderValues(
  systemId: string,
  orbit: ContinuousWardenSystemProjection['orbits'][number],
  axis: 'horizontal' | 'vertical',
) {
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  const source = system?.orbits.find(candidate => candidate.id === orbit.id)
  const radius = orbit.radii[axis]
  const minimum = system && source ? minimumOrbitRadius(system, source) : 0
  return {
    'aria-valuemin': Math.min(minimum, radius),
    // End advances the current radius by 400 map units.
    'aria-valuemax': radius + 400,
    'aria-valuenow': radius,
    'aria-valuetext': `${Math.round(radius)} map units`,
  }
}

function systemScreenScale(projection: ContinuousWardenSystemProjection): number {
  return projection.scale * viewport.value.k * svgPixelScale.value
}

function detailTextScale(pixelsPerLocalUnit: number): number {
  return continuousMapTextScale(pixelsPerLocalUnit, 20, 28)
}

const detailTextPaintScales = computed(() => {
  const k = viewport.value.k
  const pixelScale = svgPixelScale.value
  return new Map(renderedProjections.value.map(projection => {
    const paintScale = projection.scale * k
    return [projection.id, paintScale * detailTextScale(paintScale * pixelScale)] as const
  }))
})

function detailTextPaintScale(projection: ContinuousWardenSystemProjection): number {
  return detailTextPaintScales.value.get(projection.id)!
}

function starHaloRadius(projection: ContinuousWardenSystemProjection): number {
  return wardenStarHaloRadius(systemScreenScale(projection))
}

function orbitEditHandleRadius(projection: ContinuousWardenSystemProjection): number {
  const screenScale = systemScreenScale(projection)
  return screenScale > 0 ? 7 / screenScale : 7
}

function searchLocatorRadius(projection: ContinuousWardenSystemProjection): number {
  const screenScale = systemScreenScale(projection)
  return screenScale > 0
    ? Math.max(SEARCH_LOCATOR_LOCAL_RADIUS, SEARCH_LOCATOR_MIN_SCREEN_RADIUS / screenScale)
    : SEARCH_LOCATOR_LOCAL_RADIUS
}

function isSelectedObject(systemId: string, objectId: string): boolean {
  return selectedObjectIdSet.value.has(objectId) && appliedObjectOwners.value.get(objectId) === systemId
}

function isSelectedOrbit(systemId: string, orbitId: string): boolean {
  return selectedOrbitIdForSystem(systemId) === orbitId
}

function isSelectedSystem(systemId: string): boolean {
  return props.inspectedTarget?.kind === 'system' && props.inspectedTarget.systemId === systemId
}

function canResizeSystemFrame(systemId: string): boolean {
  return props.mode === 'move' || (props.mode === 'select' && isSelectedSystem(systemId))
}

function canEditOrbit(systemId: string, orbitId: string): boolean {
  return props.mode === 'move' || (props.mode === 'select' && isSelectedOrbit(systemId, orbitId))
}

function selectedOrbitIdForSystem(systemId: string): string | null {
  const target = props.inspectedTarget
  return target?.kind === 'orbit' && target.systemId === systemId ? target.orbitId : null
}

function orbitLabel(systemId: string, orbitId: string): string {
  const orbit = props.cluster.systems.find(system => system.id === systemId)?.orbits.find(value => value.id === orbitId)
  return orbit ? `Select Orbit ${orbit.order}` : 'Select Orbit'
}

function detailSystemIdsAtScale(cameraScale: number): Set<string> {
  const current = detailSystemIds.value
  const next = new Set<string>()
  for (const projection of presentationProjections.value) {
    const minimumScale = Math.min(
      MAP_ZOOM_MAX_SCALE,
      continuousMapDetailScale(semanticEnvelopeFor(projection), svgPixelScale.value, current.has(projection.id)),
    )
    if (cameraScale >= minimumScale) {
      next.add(projection.id)
    }
  }
  return next
}

function updateDetailReveal(cameraScale: number): void {
  if (!cameraInitialized) return
  const current = detailSystemIds.value
  const next = detailSystemIdsAtScale(cameraScale)
  if (next.size !== current.size || [...next].some(id => !current.has(id))) {
    preserveFocusBeforeDetailCollapse(next)
    detailSystemIds.value = next
  }
}

function updateSvgPixelScale(): void {
  const matrix = svgElement.value?.getScreenCTM()
  if (!matrix) return
  const horizontal = Math.hypot(matrix.a, matrix.b)
  const vertical = Math.hypot(matrix.c, matrix.d)
  const measured = Math.min(horizontal, vertical)
  if (Number.isFinite(measured) && measured > 0 && Math.abs(svgPixelScale.value - measured) > 0.0001) {
    svgPixelScale.value = measured
  }
}

function updateSvgViewport(): void {
  if (!svgElement.value) return
  const measured = getSvgViewportRect(svgElement.value)
  const current = svgViewport.value
  if (measured.x !== current.x || measured.y !== current.y
    || measured.width !== current.width || measured.height !== current.height) {
    svgViewport.value = measured
  }
}

function getViewport(): MapViewport {
  const element = svgElement.value
  const transform = element ? zoomTransform(element) : zoomIdentity
  return { x: transform.x, y: transform.y, k: transform.k }
}

function getRenderedSystemProjections(): readonly ContinuousWardenSystemProjection[] {
  return renderedProjections.value
}

/** Resolves the continuous scene's rendered object anchors against a client-space marquee. */
function getObjectIdsWithinClientRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>): string[] {
  const element = svgElement.value
  if (!element) return []
  return [...element.querySelectorAll<SVGGElement>('.continuous-warden-object[data-object-id]')]
    .filter(mark => {
      const matrix = mark.getScreenCTM()
      if (!matrix) return false
      const anchor = new DOMPoint(0, 0).matrixTransform(matrix)
      return anchor.x >= rect.left && anchor.x <= rect.right
        && anchor.y >= rect.top && anchor.y <= rect.bottom
    })
    .map(mark => mark.getAttribute('data-object-id'))
    .filter((id): id is string => id !== null)
}

function getFitBounds(): SvgViewportRect | undefined {
  return sceneBounds.value ?? undefined
}

/** Reserves the maximum display-only expansion without using camera-dependent curve bounds. */
function routeFitRect(rect: SvgViewportRect): SvgViewportRect {
  if (!hasOverlappingOverviewRoutes.value) return rect
  const inset = Math.min(routeFanOutLimitPixels.value / svgPixelScale.value, rect.width / 4, rect.height / 4)
  return { x: rect.x + inset, y: rect.y + inset, width: rect.width - 2 * inset, height: rect.height - 2 * inset }
}

function updateMinimumZoomScale(rect: SvgViewportRect, allowIncrease = false): void {
  const bounds = getFitBounds()
  const fit = bounds ? fitMapViewport(bounds, routeFitRect(rect), Number.MIN_VALUE) : undefined
  const fittedMinimum = fit ? Math.min(MAP_ZOOM_MIN_SCALE, fit.k) : MAP_ZOOM_MIN_SCALE
  minimumZoomScale.value = allowIncrease ? fittedMinimum : Math.min(minimumZoomScale.value, fittedMinimum)
  zoomBehavior?.scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
}

function applyViewport(nextViewport: MapViewport, feedback: 'immediate' | 'coalesced' = 'immediate'): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return
  if (Number.isFinite(nextViewport.k) && nextViewport.k > 0) {
    minimumZoomScale.value = Math.min(minimumZoomScale.value, nextViewport.k)
    zoomBehavior.scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
  }
  const next = clampMapViewport(nextViewport, minimumZoomScale.value)
  if (!next) return
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(next.x, next.y).scale(next.k))
  if (feedback === 'immediate') publishViewportFeedback()
}

/** Stops an eased wheel camera request before another camera owner takes control. */
function cancelWheelZoom(): void {
  pendingWheelZoom = null
  if (wheelZoomFrame !== undefined) {
    if (typeof window !== 'undefined') window.cancelAnimationFrame(wheelZoomFrame)
    wheelZoomFrame = undefined
  }
}

function sameViewport(left: MapViewport, right: MapViewport): boolean {
  return Math.abs(left.x - right.x) < WHEEL_ZOOM_SETTLE_TRANSLATION_EPSILON
    && Math.abs(left.y - right.y) < WHEEL_ZOOM_SETTLE_TRANSLATION_EPSILON
    && Math.abs(left.k - right.k) < WHEEL_ZOOM_SETTLE_SCALE_EPSILON
}

function animateWheelZoom(frameTime: number): void {
  wheelZoomFrame = undefined
  const pending = pendingWheelZoom
  if (!pending) return

  const current = getViewport()
  // A camera update that bypasses setViewport still wins over an older wheel animation.
  if (!sameViewport(current, pending.expectedCurrent)) {
    cancelWheelZoom()
    return
  }

  const elapsed = Math.max(0, frameTime - pending.startedAt)
  const progress = Math.min(1, elapsed / WHEEL_ZOOM_DURATION_MS)
  const easedProgress = 1 - (1 - progress) ** 3
  const target = pending.target
  const next = progress >= 1
    ? target
    : {
        x: pending.start.x + (target.x - pending.start.x) * easedProgress,
        y: pending.start.y + (target.y - pending.start.y) * easedProgress,
        k: pending.start.k + (target.k - pending.start.k) * easedProgress,
      }

  if (progress >= 1) pendingWheelZoom = null
  applyViewport(next, 'coalesced')
  if (pendingWheelZoom) {
    pendingWheelZoom.expectedCurrent = getViewport()
    wheelZoomFrame = window.requestAnimationFrame(animateWheelZoom)
  }
}

function scheduleWheelZoom(target: MapViewport, current: MapViewport): void {
  const startedAt = window.performance.now()
  if (pendingWheelZoom) {
    pendingWheelZoom.start = current
    pendingWheelZoom.target = target
    pendingWheelZoom.expectedCurrent = current
    pendingWheelZoom.startedAt = startedAt
  } else {
    pendingWheelZoom = {
      start: current,
      target,
      expectedCurrent: current,
      startedAt,
    }
  }
  if (wheelZoomFrame === undefined) {
    wheelZoomFrame = window.requestAnimationFrame(animateWheelZoom)
  }
}

function setViewport(nextViewport: MapViewport, feedback: 'immediate' | 'coalesced' = 'immediate'): void {
  cancelWheelZoom()
  applyViewport(nextViewport, feedback)
}

function fitMap(usableRect?: SvgViewportRect): void {
  const element = svgElement.value
  const bounds = getFitBounds()
  if (!element || !zoomBehavior || !bounds) return
  const requestedRect = usableRect ? normalizeSvgViewportRect(usableRect) : undefined
  const rect = requestedRect ?? getSvgViewportRect(element)
  zoomBehavior.extent(() => svgViewportExtent(rect))
  updateMinimumZoomScale(rect, true)
  const fitted = fitMapViewport(bounds, routeFitRect(rect), minimumZoomScale.value)
  if (fitted) setViewport(fitted)
}

/** Frames only the detached imported projection inside the current unobstructed camera area. */
function frameStandaloneImportPlacement(usableRect?: SvgViewportRect): boolean {
  const projection = standaloneImportProjection.value
  const element = svgElement.value
  if (!projection || !element || !zoomBehavior) return false
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false

  zoomBehavior.extent(() => svgViewportExtent(rect))
  updateMinimumZoomScale(rect, true)
  const delta = anchorDelta(projection)
  const bounds = {
    ...projection.envelope,
    x: projection.envelope.x + delta.x,
    y: projection.envelope.y + delta.y,
  }
  const completeFit = fitMapViewport(bounds, rect, Number.MIN_VALUE)
  if (!completeFit) return false

  // A distant imported envelope can need a lower zoom floor than committed Cluster bounds.
  minimumZoomScale.value = Math.min(minimumZoomScale.value, completeFit.k)
  zoomBehavior.scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
  const fitted = fitMapViewport(bounds, rect, minimumZoomScale.value)
  if (!fitted) return false
  setViewport(fitted)
  return true
}

function frameSystem(systemId: string, usableRect?: SvgViewportRect, centerTarget = false): boolean {
  const systems = centerTarget ? renderedProjections.value : projections.value
  const projection = systems.find(candidate => candidate.id === systemId)
  const element = svgElement.value
  if (!projection || !element || !zoomBehavior) return false
  const delta = anchorDelta(projection)
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const current = getViewport()
  const targetBounds = {
    ...projection.envelope,
    x: projection.envelope.x + delta.x,
    y: projection.envelope.y + delta.y,
  }
  const detailScaleFloor = continuousMapDetailScale(
    semanticEnvelopeFor(projection),
    svgPixelScale.value,
    detailSystemIds.value.has(projection.id),
  )
  const next = centerMapTargetViewport({
    current,
    targetBounds,
    usableRect: rect,
    minimumScale: Math.min(MAP_ZOOM_MAX_SCALE, detailScaleFloor),
    maximumScale: MAP_ZOOM_MAX_SCALE,
    prioritizeMinimumScale: true,
    oversizedTargetAnchor: { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y },
  })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function isSystemTransferDestination(systemId: string): boolean {
  return props.workspace.cluster.id === props.cluster.id
    && props.cluster.systems.some(system => system.id === systemId)
}

function systemTransferPointAtClient(systemId: string, clientX: number, clientY: number): Point | null {
  const element = svgElement.value
  if (!isSystemTransferDestination(systemId) || !ready.value || !element
    || ![clientX, clientY].every(Number.isFinite)) return null
  const bounds = element.getBoundingClientRect()
  if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null
  const projection = projections.value.find(candidate => candidate.id === systemId)
  if (!projection) return null
  const screenMatrix = element.getScreenCTM()
  if (!screenMatrix) return null
  let surfacePoint: DOMPoint
  try {
    surfacePoint = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse())
  } catch {
    return null
  }
  const camera = zoomTransform(element)
  const localScenePoint = projection.unprojectLocalPoint({
    x: (surfacePoint.x - camera.x) / camera.k - anchorDelta(projection).x,
    y: (surfacePoint.y - camera.y) / camera.k - anchorDelta(projection).y,
  })
  if (![localScenePoint.x, localScenePoint.y].every(Number.isFinite)) return null
  return toNormalizedMapPoint(localScenePoint)
}

function systemTransferPlacementAtClient(
  systemId: string,
  rootObjectId: string,
  selectedPlacement: Readonly<SystemObjectTransferPlacement>,
  clientX: number,
  clientY: number,
): SystemObjectTransferPlacement | null {
  const normalizedPoint = systemTransferPointAtClient(systemId, clientX, clientY)
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  if (!normalizedPoint || !system) return null
  return resolveSystemObjectTransferMapPlacement(
    system,
    systemMapGeometry(props.workspace),
    rootObjectId,
    selectedPlacement,
    normalizedPoint,
  )
}

function frameSystemTransferDestination(systemId: string, usableRect?: SvgViewportRect): boolean {
  const element = svgElement.value
  if (!isSystemTransferDestination(systemId) || !element) return false
  const usableClientRect = usableRect ? undefined : props.getUsableClientRect?.()
  const measuredUsableRect = usableRect ?? (usableClientRect
    ? clientRectToSvgViewportRect(element, usableClientRect)
    : undefined)
  return frameSystem(systemId, measuredUsableRect)
}

function setSystemObjectTransferPreview(preview: SystemObjectTransferMapPreview | null): void {
  transferPreviewOverride.value = preview
}

function frameEntityTarget(
  systemId: string,
  kind: 'object' | 'orbit',
  entityId: string,
  usableRect?: SvgViewportRect,
  centerTarget = false,
): boolean {
  const systems = centerTarget ? renderedProjections.value : projections.value
  const projection = systems.find(candidate => candidate.id === systemId)
  const element = svgElement.value
  if (!projection || !element || !zoomBehavior) return false
  const targetPoint = kind === 'object'
    ? projection.objects.find(object => object.id === entityId)?.scenePosition
    : projection.orbits.find(orbit => orbit.id === entityId)?.sceneCenter
  if (!targetPoint) return false
  const delta = anchorDelta(projection)
  const center = { x: targetPoint.x + delta.x, y: targetPoint.y + delta.y }
  const object = kind === 'object' ? projection.objects.find(candidate => candidate.id === entityId) : undefined
  const orbit = kind === 'orbit' ? projection.orbits.find(candidate => candidate.id === entityId) : undefined
  const orbitBounds = orbit
    ? rotatedEllipseBounds(center, orbit.sceneRadii, orbit.rotation, 2)
    : null
  const halfWidth = object ? Math.max(18, object.name.length * 3.6, object.locationKey.length * 2.8) : 18
  const halfHeight = object ? 27 : 18
  const bounds = orbitBounds ?? {
    x: center.x - halfWidth,
    y: center.y - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  }
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const current = getViewport()
  const minimumScale = detailSystemIds.value.has(projection.id)
    ? undefined
    : Math.min(MAP_ZOOM_MAX_SCALE, continuousMapDetailScale(semanticEnvelopeFor(projection), svgPixelScale.value, false))
  const next = centerTarget
    ? centerMapTargetViewport({
        current,
        targetBounds: bounds,
        usableRect: rect,
        minimumScale,
        maximumScale: MAP_ZOOM_MAX_SCALE,
      })
    : minimumHistoryRevealViewport({
        current,
        targetBounds: bounds,
        usableRect: rect,
        minimumScale,
        maximumScale: MAP_ZOOM_MAX_SCALE,
      })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

/** Measures applied labels even when the owning system has no mounted interior marks yet. */
function measureSearchBranchGlyphs(
  document: Document,
  system: StarSystem,
  objectIds: readonly string[],
): ReadonlyMap<string, SvgViewportRect> {
  const text = document.createElement('canvas').getContext('2d')
  if (text) text.textAlign = 'center'

  function textHalfWidth(label: string, size: number, family: string): number {
    if (!text) return Array.from(label).length * size / 2
    text.font = `${size}px ${family}`
    const measure = text.measureText(label)
    return Math.max(measure.width / 2, measure.actualBoundingBoxLeft ?? 0, measure.actualBoundingBoxRight ?? 0)
  }

  const objects = new Map(system.objects.map(object => [object.id, object]))
  const glyphs = new Map<string, SvgViewportRect>()
  for (const id of objectIds) {
    const object = objects.get(id)
    if (!object) continue
    const halfWidth = Math.max(
      SEARCH_LOCATOR_LOCAL_RADIUS,
      textHalfWidth(object.name, 12, 'Georgia, serif') + 2,
      textHalfWidth(object.locationKey, 9, 'Consolas, monospace') + 2,
    )
    // The glyph is centered on the mark. The name baseline is 46 local units below it.
    glyphs.set(id, {
      x: -halfWidth,
      y: -SEARCH_LOCATOR_LOCAL_RADIUS,
      width: halfWidth * 2,
      height: SEARCH_LOCATOR_LOCAL_RADIUS + 52,
    })
  }
  return glyphs
}

function frameSearchObjectBranch(systemId: string, objectId: string, usableRect?: SvgViewportRect): boolean {
  const element = svgElement.value
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  const projection = projections.value.find(candidate => candidate.id === systemId)
  if (!element || !zoomBehavior || !system || !projection) return false
  const branch = resolveSystemObjectBranch(system, objectId)
  if (!branch) return false
  if (!branch.orbitIds.length) return frameEntityTarget(systemId, 'object', objectId, usableRect)

  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const glyphs = measureSearchBranchGlyphs(element.ownerDocument, system, branch.objectIds)
  const measured = measureSystemObjectBranchBounds(system, objectId, systemGeometry.value, glyphs)
  if (!measured) return false
  const origin = projection.projectLocalPoint(measured.bounds)
  const targetBounds = {
    ...origin,
    width: measured.bounds.width * projection.scale,
    height: measured.bounds.height * projection.scale,
  }
  const fitted = fitMapViewport(targetBounds, rect, Number.MIN_VALUE)
  if (!fitted) return false

  const current = getViewport()
  const minimumScale = Math.min(MAP_ZOOM_MAX_SCALE, continuousMapDetailScale(
    semanticEnvelopeFor(projection),
    svgPixelScale.value,
    detailSystemIds.value.has(systemId),
  ))
  const branchFrame = centerMapTargetViewport({
    current,
    targetBounds,
    usableRect: rect,
    minimumScale,
    // Preserve current zoom when the branch fits without Fit padding.
    maximumScale: Math.max(current.k, fitted.k, minimumScale),
  })
  if (!branchFrame) return false
  let next: MapViewport | null = branchFrame
  if (branchFrame.k < minimumScale) {
    const root = projection.objects.find(object => object.id === objectId)?.scenePosition
    if (!root) return false
    next = centerMapTargetViewport({
      current,
      targetBounds: { ...root, width: 0, height: 0 },
      usableRect: rect,
      minimumScale,
      maximumScale: minimumScale,
    })
  }
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function frameSearchTarget(target: import('../utils/workspace-search').SearchTarget, usableRect?: SvgViewportRect): boolean {
  if (target.kind === 'cluster') {
    fitMap(usableRect)
    return true
  }
  if (target.kind === 'system') return frameSystem(target.systemId, usableRect)
  if (target.routeId !== undefined) return frameRouteObject(target.routeId, target.objectId, usableRect)
  return frameSearchObjectBranch(target.systemId, target.objectId, usableRect)
}

function centerInspectedTarget(target: InspectedMapTarget, usableRect?: SvgViewportRect): boolean {
  if (target.kind === 'cluster') {
    fitMap(usableRect)
    return true
  }
  if (target.kind === 'system') return frameSystem(target.systemId, usableRect, true)
  if (target.kind === 'route') return frameRoute(target.routeId, usableRect, true)
  if (target.kind === 'route-object') return frameRouteObject(target.routeId, target.objectId, usableRect)
  if (target.kind === 'object' || target.kind === 'orbit') {
    return frameEntityTarget(
      target.systemId,
      target.kind,
      target.kind === 'object' ? target.objectId : target.orbitId,
      usableRect,
      true,
    )
  }
  return false
}

function frameRouteObject(routeId: string, objectId: string, usableRect?: SvgViewportRect, center = true): boolean {
  const branch = displayedRouteBranches.value.find(candidate => candidate.id === routeId)
  const element = svgElement.value
  if (!branch || !element || !zoomBehavior) return false
  const point = projectRouteObjects(branch.contents, branch.geometry, props.workspace.layout).positions.get(objectId)
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!point || !rect) return false
  const current = getViewport()
  const radius = center ? 0 : (routeObjectMarkerRadiusPixels + 1.5) / (current.k * svgPixelScale.value)
  const options = {
    current,
    usableRect: rect,
    targetBounds: { x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 },
    maximumScale: MAP_ZOOM_MAX_SCALE,
  }
  const next = center ? centerMapTargetViewport(options) : minimumHistoryRevealViewport(options)
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function frameRoute(routeId: string, usableRect: SvgViewportRect | undefined, center: boolean): boolean {
  const element = svgElement.value
  const route = props.cluster.routes.find(candidate => candidate.id === routeId)
  const geometry = routeGeometries.value.get(routeId)
  if (!element || !zoomBehavior || !route || !geometry) return false
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const current = getViewport()
  const options = { current, usableRect: rect, padding: ROUTE_REVEAL_PADDING_PIXELS / svgPixelScale.value }
  const next = center
    ? centerContinuousMapRouteViewport({
        ...options,
        svgPixelScale: svgPixelScale.value,
        geometryAt: scale => scale === current.k
          ? geometry
          : routesAtDetail(detailSystemIdsAtScale(scale), scale * svgPixelScale.value).get(routeId),
      })
    : revealContinuousMapRouteViewport({ ...options, geometry, unresolved: route.toSystemId === null })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function prepareSearchLocator(objectId: string): () => void {
  const generation = searchInteractionGeneration
  const clusterId = props.cluster.id
  const target = props.inspectedTarget
  const ownerId = searchLocatorOwner(target, objectId)
  return () => {
    if (ownerId === undefined || generation !== searchInteractionGeneration
      || props.cluster.id !== clusterId
      || searchLocatorOwner(props.inspectedTarget, objectId) !== ownerId
      || !dimmedObjectIds.value.has(objectId)) return
    searchLocatorTarget.value = { clusterId, ownerId, objectId }
  }
}

function searchLocatorOwner(target: InspectedMapTarget | null | undefined, objectId: string): string | undefined {
  if (target?.kind === 'object' && target.objectId === objectId) return target.systemId
  if (target?.kind === 'route-object' && target.objectId === objectId) return target.routeId
}

function isSearchLocatorFor(ownerId: string, objectId: string): boolean {
  const locator = searchLocatorTarget.value
  return locator?.ownerId === ownerId && locator.objectId === objectId
}

function dismissSearchLocator(): void {
  searchInteractionGeneration += 1
  searchLocatorTarget.value = null
}

watch([() => props.cluster.id, () => props.inspectedTarget, dimmedObjectIds], ([clusterId, target, dimmed]) => {
  const locator = searchLocatorTarget.value
  if (locator && (locator.clusterId !== clusterId
    || searchLocatorOwner(target, locator.objectId) !== locator.ownerId
    || !dimmed.has(locator.objectId))) dismissSearchLocator()
}, { flush: 'sync' })

function revealHistoryTarget(target: MapHistoryTarget, usableRect?: SvgViewportRect): boolean {
  if (!usableRect) return false
  if (target.kind === 'route') return frameRoute(target.id, usableRect, false)
  if (target.kind === 'route-object') return frameRouteObject(target.routeId, target.id, usableRect, false)
  const systemId = target.kind === 'system' ? target.id : target.systemId
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const element = svgElement.value
  const rect = normalizeSvgViewportRect(usableRect)
  if (!projection || !element || !zoomBehavior || !rect) return false

  const delta = anchorDelta(projection)
  const current = getViewport()
  let bounds: SvgViewportRect
  let minimumScale: number | undefined
  if (target.kind === 'system') {
    const anchor = { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y }
    bounds = { x: anchor.x - 16, y: anchor.y - 16, width: 32, height: 32 }
  } else if (target.kind === 'object') {
    const object = projection.objects.find(candidate => candidate.id === target.id)
    if (!object) return false
    const center = { x: object.scenePosition.x + delta.x, y: object.scenePosition.y + delta.y }
    const halfWidth = Math.max(18, object.name.length * 3.6, object.locationKey.length * 2.8)
    bounds = { x: center.x - halfWidth, y: center.y - 27, width: halfWidth * 2, height: 54 }
    if (!detailSystemIds.value.has(projection.id)) {
      minimumScale = Math.min(MAP_ZOOM_MAX_SCALE, continuousMapDetailScale(semanticEnvelopeFor(projection), svgPixelScale.value, false))
    }
  } else if (target.kind === 'orbit') {
    const orbit = projection.orbits.find(candidate => candidate.id === target.id)
    if (!orbit) return false
    const center = { x: orbit.sceneCenter.x + delta.x, y: orbit.sceneCenter.y + delta.y }
    const orbitBounds = rotatedEllipseBounds(center, orbit.sceneRadii, orbit.rotation, 2)
    if (!orbitBounds) return false
    bounds = orbitBounds
    if (!detailSystemIds.value.has(projection.id)) {
      minimumScale = Math.min(MAP_ZOOM_MAX_SCALE, continuousMapDetailScale(semanticEnvelopeFor(projection), svgPixelScale.value, false))
    }
  } else {
    return false
  }

  const next = minimumHistoryRevealViewport({
    current,
    targetBounds: bounds,
    usableRect: rect,
    minimumScale,
    maximumScale: MAP_ZOOM_MAX_SCALE,
  })
  if (!next) return false
  if (Math.abs(next.x - current.x) < 0.01 && Math.abs(next.y - current.y) < 0.01
    && next.k === current.k) return true
  setViewport(next)
  return true
}

function revealHistoryCluster(usableRect?: SvgViewportRect): boolean {
  const element = svgElement.value
  if (projections.value.length === 0 || !element || !zoomBehavior) return false
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const anchorBounds = projections.value.map((projection) => {
    const delta = anchorDelta(projection)
    const anchor = { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y }
    return { x: anchor.x - 16, y: anchor.y - 16, width: 32, height: 32 }
  })
  const current = getViewport()
  const next = revealNearestAnchorViewport({ current, anchorBounds, usableRect: rect })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || Math.abs(next.k - current.k) >= 0.0001) setViewport(next)
  return true
}

function zoomBy(factor: number): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || !Number.isFinite(factor) || factor <= 0) return
  cancelWheelZoom()
  select(element).call(zoomBehavior.scaleBy, factor)
  publishViewportFeedback()
}

function panBy(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
  const current = getViewport()
  setViewport({ ...current, x: current.x + dx, y: current.y + dy })
}

function startViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return
  cancelActiveGesture()
  // The canvas consumed this new press before it could reach the renderer's pointer handler.
  selectObjectDragGeneration += 1
  clearOwnedGestureClickSuppression()
  takePendingMapClickTarget()
  viewPan = { transform: getViewport(), start: pointer(event, element) as [number, number] }
}

function moveViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || !viewPan) return
  const point = pointer(event, element)
  setViewport({
    x: viewPan.transform.x + point[0] - viewPan.start[0],
    y: viewPan.transform.y + point[1] - viewPan.start[1],
    k: viewPan.transform.k,
  }, 'coalesced')
}

function endViewPan(): void { viewPan = null }

function cameraPoint(event: { clientX: number; clientY: number }): Point | null {
  const element = svgElement.value
  if (!element) return null
  const [x, y] = pointer(event, element)
  const transform = zoomTransform(element)
  return { x: (x - transform.x) / transform.k, y: (y - transform.y) / transform.k }
}

function cameraPointAt(event: { clientX: number; clientY: number }, camera: MapViewport): Point | null {
  const element = svgElement.value
  if (!element || camera.k <= 0) return null
  const [x, y] = pointer(event, element)
  return { x: (x - camera.x) / camera.k, y: (y - camera.y) / camera.k }
}

function canMoveObjectInSystem(target: { systemId: string; objectId: string }): boolean {
  const system = props.cluster.systems.find(candidate => candidate.id === target.systemId)
  const object = system?.objects.find(candidate => candidate.id === target.objectId)
  if (!object) return false
  const fromOrbitId = object.placement.kind === 'orbit' ? object.placement.orbitId : null
  return !props.isEntityCommandBlocked?.({
    kind: 'object-placement',
    objectId: object.id,
    fromOrbitId,
    toOrbitId: null,
  })
}

function orbitEditCommand(target: OrbitEditTarget): EntityCommand {
  return target.kind === 'center'
    ? { kind: 'orbit-center-position', orbitId: target.orbitId }
    : { kind: 'orbit-geometry', orbitId: target.orbitId }
}

function moveTargetAtPoint(event: PointerEvent, element: SVGSVGElement | null): WardenMoveHit {
  if (!element) return { target: null, blockedCommand: null }
  const systemId = systemIdAtTarget(event.target)
  if (systemId) return { target: isSelectedSystem(systemId) ? { kind: 'anchor', systemId } : null, blockedCommand: null }
  const hits = element.ownerDocument.elementsFromPoint(event.clientX, event.clientY)
    .filter(hit => hit === element || element.contains(hit))
  const orderedHits = hits.length ? hits : [event.target]
  if (isExitMarkerTarget(event.target)) {
    const routeId = routeIdAtTarget(event.target)
    const isUnresolved = (routes: readonly JumpRoute[]) =>
      routes.some(route => route.id === routeId && route.toSystemId === null)
    if (routeId && isUnresolved(props.cluster.routes) && isUnresolved(sceneCluster.value.routes)) {
      return { target: { kind: 'exit', routeId }, blockedCommand: null }
    }
  }
  let blockedCommand: EntityCommand | null = null
  for (const hit of orderedHits) {
    const editTarget = orbitEditTargetAtTarget(hit)
    if (editTarget) {
      const command = orbitEditCommand(editTarget)
      if (props.isEntityCommandBlocked?.(command)) {
        blockedCommand ??= command
        continue
      }
      return { target: { kind: 'orbit', target: editTarget }, blockedCommand }
    }
    const objectTarget = objectTargetAtTarget(hit)
    if (objectTarget) {
      if (canMoveObjectInSystem(objectTarget)) return { target: { kind: 'object', ...objectTarget }, blockedCommand }
      continue
    }
    const orbitTarget = orbitTargetAtTarget(hit)
    if (orbitTarget) {
      return { target: { kind: 'orbit', target: { ...orbitTarget, kind: 'resize', axis: 'global' } }, blockedCommand }
    }
  }
  return { target: null, blockedCommand }
}

function selectedOrbitOrExitMoveTarget(event: PointerEvent): Extract<WardenMovePointerTarget, { kind: 'orbit' | 'exit' }> | null {
  if (props.inspectedTarget?.kind !== 'orbit' && props.selectedRouteId === null) return null
  const target = moveTargetAtPoint(event, svgElement.value).target
  if (target?.kind === 'orbit' && isSelectedOrbit(target.target.systemId, target.target.orbitId)) return target
  if (target?.kind === 'exit' && target.routeId === props.selectedRouteId) return target
  return null
}

function systemMapGeometry(workspace: LocalWorkspace | DeepReadonly<LocalWorkspace>): SystemMapGeometry {
  return {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
      .map(([id, radii]) => [id, { horizontal: radii.horizontal, vertical: radii.vertical }])),
    orbitRotations: workspace.layout.orbitRotations,
  }
}

function orbitAddAtPoint(point: Point, target: EventTarget | null): { owners: OrbitAddOwner[]; requiresOwnerChoice: boolean } {
  const object = objectTargetAtTarget(target)
  const orbit = orbitTargetAtTarget(target)
  const definiteOwnerId = object?.systemId ?? orbit?.systemId ?? systemIdAtTarget(target)
  const systems = projections.value.map(projection => ({ id: projection.id, envelope: displayFrameFor(projection.id) }))
  const resolution = resolveContinuousObjectOwnerResolution(point, systems, definiteOwnerId)
  const geometry = systemMapGeometry(props.workspace)
  const owners = resolution.systemIds.flatMap((systemId) => {
    const projection = projections.value.find(candidate => candidate.id === systemId)
    const system = props.cluster.systems.find(candidate => candidate.id === systemId)
    if (!projection || !system) return []
    const localPoint = projection.unprojectLocalPoint(point)
    const detailTargetsVisible = detailSystemIds.value.has(systemId)
    const candidates = detailTargetsVisible && object?.systemId === systemId
      ? [{ key: `host:${object.objectId}`, label: 'Orbit around selected object', target: { kind: 'host' as const, objectId: object.objectId }, error: null }]
      : creationCandidatesAtPoint(system, localPoint, { kind: 'orbit' }, geometry, detailTargetsVisible)
    return [{ systemId, candidates }]
  })
  return { owners, requiresOwnerChoice: resolution.requiresOwnerChoice }
}

function offerOrbitAdd(point: Point, target: EventTarget | null): void {
  const { owners, requiresOwnerChoice } = orbitAddAtPoint(point, target)
  emit('continuous-orbit-add-target', owners, requiresOwnerChoice, props.workspace)
}

function getOrbitDragStart(event: PointerEvent): (OrbitAddOwner & { point: Point; workspace: LocalWorkspace }) | null {
  const point = cameraPoint(event)
  if (!point) return null
  const { owners, requiresOwnerChoice } = orbitAddAtPoint(point, event.target)
  const owner = owners[0]
  if (requiresOwnerChoice || !owner) return null
  const localPoint = orbitDragPointFromClient(owner.systemId, event.clientX, event.clientY)
  return localPoint ? { ...owner, point: localPoint, workspace: props.workspace } : null
}

function orbitDragPointFromClient(systemId: string, clientX: number, clientY: number): Point | null {
  const point = cameraPoint({ clientX, clientY })
  const owner = projections.value.find(candidate => candidate.id === systemId)
  return point && owner ? owner.unprojectLocalPoint(point) : null
}

function getOrbitDragSceneClearance(systemId: string): number | null {
  const owner = projections.value.find(candidate => candidate.id === systemId)
  if (!owner) return null
  const scale = getViewport().k * svgPixelScale.value * owner.scale
  // The widest existing stroke is 3 CSS pixels. The preview stroke scales with the local scene.
  return Number.isFinite(scale) && scale > 0 ? (4 + 3 / 2) / scale + 2.5 / 2 : null
}

function isClientPointOnMap(clientX: number, clientY: number): boolean {
  const element = svgElement.value
  const hit = element?.ownerDocument.elementFromPoint(clientX, clientY)
  return !!hit && !!element?.contains(hit)
}

const orbitAddPreview = computed(() => {
  const placement = props.orbitCreationPreview
  const radii = placement?.preview.radii
  if (!placement || !radii) return null
  const projection = projections.value.find(candidate => candidate.id === placement.systemId)
  if (!projection) return null
  const preview = placement.preview
  const target = preview.target
  const center = target.kind === 'free'
    ? fromNormalizedMapPoint(target.point)
    : target.kind === 'host'
      ? projection.objects.find(object => object.id === target.objectId)?.position
      : undefined
  return center ? { systemId: projection.id, center, radii, rotation: preview.rotation ?? 0 } : null
})

function addOwnersAtPoint(
  point: Point,
  subtype: CatalogueSubtype,
  definiteOwnerId: string | null,
): { owners: ContinuousObjectAddOwner[]; requiresOwnerChoice: boolean } {
  const systems = projections.value.map(projection => ({
    id: projection.id,
    envelope: displayFrameFor(projection.id),
  }))
  const ownerResolution = resolveContinuousObjectOwnerResolution(point, systems, definiteOwnerId)
  const geometry = systemMapGeometry(props.workspace)
  const owners = ownerResolution.systemIds.flatMap(systemId => {
    const frame = systems.find(candidate => candidate.id === systemId)?.envelope
    if (!definiteOwnerId && (!frame || !continuousMapRoundedFrameContains(point, frame))) return []
    const projection = projections.value.find(candidate => candidate.id === systemId)
    const system = props.cluster.systems.find(candidate => candidate.id === systemId)
    if (!projection || !system) return []
    const delta = anchorDelta(projection)
    const localPoint = projection.unprojectLocalPoint({ x: point.x - delta.x, y: point.y - delta.y })
    const detailTargetsVisible = detailSystemIds.value.has(systemId)
    const candidates = creationCandidatesAtPoint(
      system,
      localPoint,
      { kind: 'object', subtype },
      geometry,
      detailTargetsVisible,
      detailTargetsVisible ? objectHitRadius(projection) : undefined,
    )
      .map(candidate => candidate.target.kind === 'orbit'
        && props.isEntityCommandBlocked?.({ kind: 'object-create', orbitId: candidate.target.orbitId })
        ? { ...candidate, error: 'Resolve the Inspector draft before adding an object to this Orbit.' }
        : candidate)
    return [{ systemId, candidates }]
  })
  return { owners, requiresOwnerChoice: ownerResolution.requiresOwnerChoice }
}

function displayedRouteGeometry(routeId: string): ContinuousMapRouteGeometry | undefined {
  return routeLayer.value?.displayedMarks.find(mark => mark.id === routeId)?.geometry
}

function routeLandingAtPoint(point: Point, routeId: string | undefined, keyboard: boolean): RouteLanding | null {
  const geometry = routeId ? displayedRouteGeometry(routeId) : undefined
  const progression = geometry ? keyboard ? 0.5 : projectPointOntoRoute(point, geometry) : null
  return routeId && progression !== null ? { routeId, progression } : null
}

function offerObjectAdd(point: Point, event: MouseEvent | KeyboardEvent): void {
  const type = props.creationType
  if (type?.kind !== 'object') return
  const { target } = event
  const routeId = (event instanceof MouseEvent ? routeLayer.value?.routeIdAtStroke(event) : undefined)
    ?? routeIdAtTarget(target) ?? routeObjectTargetAt(target)?.routeId
  const routeLanding = routeLandingAtPoint(point, routeId, event instanceof KeyboardEvent)
  const otherType = type.subtype === 'other' && props.creationOtherType ? { otherType: props.creationOtherType } : {}
  if (routeLanding) {
    emit('continuous-object-add-target', {
      subtype: type.subtype,
      workspaceSnapshot: props.workspace,
      routeLanding,
      directTarget: null,
      requiresOwnerChoice: false,
      owners: [],
      ...otherType,
    })
    return
  }
  const object = objectTargetAtTarget(target)
  const orbit = orbitTargetAtTarget(target)
  const hitOwnerId = object?.systemId ?? orbit?.systemId ?? null
  const pinnedOwnerId = props.objectAddPinnedOwnerId
  const foreignHit = pinnedOwnerId && hitOwnerId && pinnedOwnerId !== hitOwnerId
  const directTarget = foreignHit
    ? null
    : object
      ? { kind: 'object' as const, id: object.objectId }
      : orbit
        ? { kind: 'orbit' as const, id: orbit.orbitId }
        : null
  const ownerResolution = foreignHit && pinnedOwnerId
    ? { owners: [{ systemId: pinnedOwnerId, candidates: [] }], requiresOwnerChoice: false }
    : addOwnersAtPoint(point, type.subtype, pinnedOwnerId ?? hitOwnerId)
  emit('continuous-object-add-target', {
    subtype: type.subtype,
    workspaceSnapshot: props.workspace,
    directTarget,
    ...otherType,
    requiresOwnerChoice: ownerResolution.requiresOwnerChoice,
    owners: ownerResolution.owners,
  })
}

function emitOrbitAdjustment(event: KeyboardEvent | WheelEvent, input: OrbitAdjustmentInput): boolean {
  const command: EntityCommand = { kind: 'orbit-geometry', orbitId: input.orbitId }
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  if (props.isEntityCommandBlocked?.(command)) {
    emit('entity-command-blocked', command)
    return true
  }
  emit('orbit-adjustment', input)
  return true
}

function onOrbitAdjustmentKeydown(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || props.standaloneImportPlacementEnabled
    || props.creationType != null || props.clusterAddType != null || props.clusterChooserOpen
    || props.moveTargeting || props.clusterMoveTargeting
    || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false
  const target = orbitTargetAtTarget(event.target)
  if (!target || !canEditOrbit(target.systemId, target.orbitId)) return false
  const editTarget = orbitEditTargetAtTarget(event.target)
  if (!editTarget || editTarget.kind === 'center') return false
  const system = props.cluster.systems.find(candidate => candidate.id === target.systemId)
  const orbit = system?.orbits.find(candidate => candidate.id === target.orbitId)
  if (!system || !orbit) return false
  const step = event.shiftKey ? 10 : 1
  const minimum = minimumOrbitRadius(system, orbit)
  const change = continuousOrbitKeyboardChange(
    editTarget.kind === 'rotation'
      ? { kind: 'rotation' }
      : { kind: 'resize', axis: editTarget.axis },
    event.key,
    step,
    minimum,
  )
  if (!change) return false
  return emitOrbitAdjustment(event, {
    systemId: system.id,
    orbitId: orbit.id,
    inputKind: 'keyboard',
    keyCode: event.code,
    change,
  })
}

function onWheelCapture(event: WheelEvent): void {
  touchCameraNavigation.clearDoubleTap()
  if (!props.standaloneImportPlacementEnabled && event.ctrlKey && event.deltaY !== 0
    && props.creationType == null && props.clusterAddType == null && !props.clusterChooserOpen
    && !props.moveTargeting && !props.clusterMoveTargeting) {
    const hit = orbitTargetAtTarget(event.target)
    if (hit && canEditOrbit(hit.systemId, hit.orbitId)) {
      cancelWheelZoom()
      emitOrbitAdjustment(event, {
        systemId: hit.systemId,
        orbitId: hit.orbitId,
        inputKind: 'wheel',
        change: { kind: 'rotation', delta: event.deltaY * 0.05 },
      })
      return
    }
  }

  const element = svgElement.value
  if (!element || event.deltaY === 0 || !Number.isFinite(event.deltaY)) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  // Small pixel deltas are already continuous trackpad input, so keep them immediate.
  const preciseInput = event.deltaMode === 0 && Math.abs(event.deltaY) < PRECISE_WHEEL_DELTA_THRESHOLD
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const direct = preciseInput || reducedMotion
  if (direct) cancelWheelZoom()

  const current = getViewport()
  const base = direct ? current : (pendingWheelZoom?.target ?? current)
  const [anchorX, anchorY] = wheelAnchorPoint(event, element)
  const deltaUnit = event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002
  const scaleDelta = event.deltaY * deltaUnit * (event.ctrlKey ? 10 : 1)
  const minimumExponent = Math.log2(minimumZoomScale.value)
  const maximumExponent = Math.log2(MAP_ZOOM_MAX_SCALE)
  const nextExponent = Math.max(minimumExponent, Math.min(maximumExponent, Math.log2(base.k) - scaleDelta))
  const nextScale = 2 ** nextExponent
  const sceneAnchorX = (anchorX - current.x) / current.k
  const sceneAnchorY = (anchorY - current.y) / current.k
  const target = clampMapViewport({
    x: anchorX - sceneAnchorX * nextScale,
    y: anchorY - sceneAnchorY * nextScale,
    k: nextScale,
  }, minimumZoomScale.value)
  if (!target) return
  if (target.k === current.k) {
    cancelWheelZoom()
    return
  }

  if (direct) applyViewport(target, 'coalesced')
  else scheduleWheelZoom(target, current)
}

function invalidateWheelAnchorTransform(): void {
  wheelAnchorTransform = null
}

function wheelAnchorPoint(event: WheelEvent, element: SVGSVGElement): [number, number] {
  const inputTime = window.performance.now()
  if (inputTime - wheelAnchorLastInputAt >= WHEEL_ANCHOR_BURST_TIMEOUT_MS) invalidateWheelAnchorTransform()
  wheelAnchorLastInputAt = inputTime

  if (wheelAnchorTransform?.element !== element) {
    let inverse: SvgPointTransform | null = null
    try {
      const matrix = element.getScreenCTM()
      if (matrix) {
        const candidate = matrix.inverse()
        if ([candidate.a, candidate.b, candidate.c, candidate.d, candidate.e, candidate.f].every(Number.isFinite)) {
          inverse = candidate
        }
      }
    } catch {
      // A missing or singular SVG matrix falls back to D3's established pointer conversion below.
    }
    wheelAnchorTransform = { element, inverse }
  }

  const inverse = wheelAnchorTransform.inverse
  if (inverse) {
    const x = inverse.a * event.clientX + inverse.c * event.clientY + inverse.e
    const y = inverse.b * event.clientX + inverse.d * event.clientY + inverse.f
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y]
  }

  return pointer(event, element) as [number, number]
}

function updateObjectMovePreview(drag: ActiveObjectDrag, scenePoint: Point, event: PointerEvent): void {
  if (drag.lastClient?.x === event.clientX && drag.lastClient.y === event.clientY) return
  drag.lastClient = { x: event.clientX, y: event.clientY }
  const targetLocal = continuousObjectDragTarget(
    drag.projection,
    drag.anchorDelta,
    drag.originLocal,
    drag.startScene,
    scenePoint,
  )
  const source = drag.workspaceSnapshot.cluster.systems.find(system => system.id === drag.systemId)
  if (!source) return
  const sourceBranch = projectZoneObjectBranch(source, drag.projection, drag.objectId)
  if (!sourceBranch) return
  const projectPoint = (point: Point) => {
    const projected = drag.projection.projectLocalPoint(point)
    return { x: projected.x + drag.anchorDelta.x, y: projected.y + drag.anchorDelta.y }
  }
  drag.targetScenePoint = projectPoint(targetLocal)
  drag.landing = null
  drag.transfer = null
  drag.crossContext = null
  routeLandingPreview.value = null
  draggedBranchPreview.value = null
  elasticPlacementPreview.value = null

  const moveBranch = (point: Point) => {
    const delta = { x: point.x - drag.originLocal.x, y: point.y - drag.originLocal.y }
    const plan = planSelectedObjectTranslation(drag.workspaceSnapshot, drag.systemId, [drag.objectId], delta)
    if (!plan) return null
    const workspace = applySelectedObjectTranslation(drag.workspaceSnapshot, drag.systemId, plan)
    const system = workspace.cluster.systems.find(candidate => candidate.id === drag.systemId)
    if (!system) return null
    const projection = projectWardenSystem(system, drag.legacyAnchor, systemMapGeometry(workspace), drag.projection.scale)
    return projectZoneObjectBranch(system, projection, drag.objectId)
  }
  const pointerDelta = { x: targetLocal.x - drag.originLocal.x, y: targetLocal.y - drag.originLocal.y }
  const pointerPositions = new Map(sourceBranch.objects.map(object => [object.id, {
    x: object.position.x + pointerDelta.x,
    y: object.position.y + pointerDelta.y,
  }]))
  const projection = previewWardenSystemObjects(
    drag.projection,
    pointerPositions,
    new Map(source.orbits.map(orbit => [orbit.id, orbit.hostId])),
  )
  objectMovePreview.value = { systemId: drag.systemId, objectId: drag.objectId, projection }
  const routeTarget = routeDropTarget(drag.targetScenePoint, event)
  if (routeTarget) {
    const proposal = previewCrossContextTransfer(drag.workspaceSnapshot, {
      source: { kind: 'system', systemId: drag.systemId },
      rootObjectId: drag.objectId,
      landing: { kind: 'route', ...routeTarget },
    })
    if (proposal) {
      drag.crossContext = proposal
      return
    }
  }
  const pointer = moveBranch(targetLocal)

  let transfer: ReturnType<typeof transferDropForObjectDrag> = null
  try {
    transfer = transferDropForObjectDrag(drag)
  } catch {
    // A candidate whose relationships or geometry cannot be resolved leaves the source in control.
  }
  if (transfer) {
    drag.transfer = transfer.drop
    draggedBranchPreview.value = transfer.branch
    return
  }

  const displayedFrame = drag.startDisplayedFrame
  if (!displayedFrame || !pointer) return
  const geometry = {
    systemId: drag.systemId,
    anchor: drag.anchor,
    displayedFrame,
    fixedFrames: drag.fixedFrames,
    authoredFrames: drag.authoredFrames,
    pixelsPerSceneUnit: drag.camera.k * svgPixelScale.value,
  }
  const scenePosition = (point: Point) => ({ x: point.x + drag.anchorDelta.x, y: point.y + drag.anchorDelta.y })
  const origin = scenePosition(sourceBranch.root)
  const requestedRoot = scenePosition(pointer.root)
  const proposal = planBoundedZoneLanding({
    ...geometry, target: requestedRoot, origin, relativeBounds: sourceBranch.relativeBounds,
  })
  if (!proposal) return
  const exact = proposal.root.x === requestedRoot.x && proposal.root.y === requestedRoot.y
  const position = exact ? targetLocal : drag.projection.unprojectLocalPoint({
    x: proposal.root.x - drag.anchorDelta.x,
    y: proposal.root.y - drag.anchorDelta.y,
  })
  const landing = exact ? pointer : moveBranch(position)
  if (!landing) return

  // Orbit snapping can change the root after a bounded pointer proposal. Check the
  // translated branch at its actual position before presenting or accepting it.
  const finalLanding = planBoundedZoneLanding({
    ...geometry, target: scenePosition(landing.root), relativeBounds: landing.relativeBounds,
  })
  if (!finalLanding) return
  const frameInsets = finalLanding.grew
    ? frameInsetsFor(drag.anchor, finalLanding.authoredFrame)
    : legacyFrameInsets(drag.workspaceSnapshot, drag.systemId, drag.anchor, drag.preferredFrame)
  if (finalLanding.grew && !frameInsets) return
  drag.landing = { position: toNormalizedMapPoint(position), ...(frameInsets ? { frameInsets } : {}) }
  draggedBranchPreview.value = landing
  if (finalLanding.grew) {
    elasticPlacementPreview.value = {
      systemId: drag.systemId,
      path: continuousMapRoundedFramePath(finalLanding.frame),
      displayedFrame: finalLanding.frame,
      preferredFrame: finalLanding.authoredFrame,
      acceptsDrop: true,
    }
  }
}

function orbitGestureLocalPoint(gesture: OrbitGestureBase, event: PointerEvent): Point | null {
  const scenePoint = cameraPointAt(event, gesture.camera)
  if (!scenePoint) return null
  return gesture.projection.unprojectLocalPoint({
    x: scenePoint.x - gesture.anchorDelta.x,
    y: scenePoint.y - gesture.anchorDelta.y,
  })
}

function orbitGestureSourceIsCurrent(gesture: OrbitGestureBase): boolean {
  if (!canEditOrbit(gesture.systemId, gesture.orbitId) || toRaw(props.workspace) !== gesture.workspaceSnapshot
    || props.workspace.id !== gesture.workspaceSnapshot.id
    || props.cluster.id !== gesture.workspaceSnapshot.cluster.id) return false
  const system = props.cluster.systems.find(candidate => candidate.id === gesture.systemId)
  const orbit = system?.orbits.find(candidate => candidate.id === gesture.orbitId)
  return !!orbit && JSON.stringify(toRaw(orbit)) === JSON.stringify(gesture.orbitSnapshot)
}

function directCenterMoveCandidates(
  gesture: OrbitGestureBase,
  point: Point,
): { candidate: OrbitCenterMoveCandidate | null; candidates: OrbitCenterMoveCandidate[] } {
  const geometry = systemMapGeometry(gesture.workspaceSnapshot)
  const positions = objectPositions(gesture.systemSnapshot, geometry)
  const movingObjectIds = objectsMovedWithOrbit(gesture.systemSnapshot, gesture.orbitId)
  const geometryBlocked = props.isEntityCommandBlocked?.({ kind: 'orbit-center-position', orbitId: gesture.orbitId }) ?? false
  const nearbyObjects = gesture.systemSnapshot.objects
    .map((object, index) => ({
      object,
      index,
      distance: Math.hypot(point.x - requiredPosition(positions, object.id).x, point.y - requiredPosition(positions, object.id).y),
    }))
    .filter(candidate => candidate.distance <= 28)
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
  const candidates: OrbitCenterMoveCandidate[] = nearbyObjects.map(({ object }) => {
    const hostBlocked = props.isEntityCommandBlocked?.({ kind: 'orbit-host', orbitId: gesture.orbitId, hostId: object.id }) ?? false
    return {
      key: `host:${object.id}`,
      label: `Center on ${object.name}`,
      target: { kind: 'host', objectId: object.id },
      error: movingObjectIds.has(object.id)
        ? 'This Orbit cannot be hosted by an object in its own hierarchy.'
        : geometryBlocked
          ? 'Resolve the Inspector draft before moving this Orbit.'
          : hostBlocked
            ? 'Resolve the Inspector draft before changing this Orbit host.'
            : null,
    }
  })
  if (nearbyObjects.length === 0) {
    candidates.push({
      key: `free:${point.x}:${point.y}`,
      label: 'Free Orbit center',
      target: { kind: 'free', point: toNormalizedMapPoint(point) },
      error: geometryBlocked ? 'Resolve the Inspector draft before moving this Orbit.' : null,
    })
  }
  const eligible = candidates.filter(candidate => candidate.error === null)
  return { candidate: eligible.length === 1 ? eligible[0]! : null, candidates }
}

function publishDirectOrbitPreview(gesture: ActiveOrbitGesture): void {
  const geometry = systemMapGeometry(gesture.workspaceSnapshot)
  const system = gesture.systemSnapshot
  let previewSystem = system
  if (gesture.kind === 'resize') {
    geometry.orbitRadii = { ...geometry.orbitRadii, [gesture.orbitId]: { ...gesture.previewRadii } }
  } else if (gesture.kind === 'rotation') {
    geometry.orbitRotations = { ...geometry.orbitRotations, [gesture.orbitId]: gesture.previewRotation }
  } else {
    const currentOrbit = gesture.orbitSnapshot
    const previewOrbit: Orbit = gesture.previewHostId === null
      ? { id: currentOrbit.id, order: currentOrbit.order, hostId: null, center: toNormalizedMapPoint(gesture.previewCenter) }
      : { id: currentOrbit.id, order: currentOrbit.order, hostId: gesture.previewHostId }
    previewSystem = {
      ...system,
      orbits: system.orbits.map(orbit => orbit.id === gesture.orbitId ? previewOrbit : orbit),
    }
    geometry.orbitRadii = { ...geometry.orbitRadii, [gesture.orbitId]: { ...gesture.previewRadii } }
  }
  const projection = projectWardenSystem(
    previewSystem,
    gesture.legacyAnchor,
    geometry,
    gesture.projection.scale,
  )
  directOrbitPreview.value = { systemId: gesture.systemId, orbitId: gesture.orbitId, projection }
}

function previewOrbitGestureAt(gesture: ActiveOrbitGesture, point: Point): void {
  if (!orbitGestureSourceIsCurrent(gesture)) {
    finishOrbitGesture(true)
    return
  }
  if (gesture.kind === 'resize') {
    if (props.isEntityCommandBlocked?.({ kind: 'orbit-geometry', orbitId: gesture.orbitId })) {
      emit('entity-command-blocked', { kind: 'orbit-geometry', orbitId: gesture.orbitId })
      finishOrbitGesture(true)
      return
    }
    const minimum = minimumOrbitRadius(gesture.systemSnapshot, gesture.orbitSnapshot)
    if (gesture.axis === 'global') {
      const startDistance = Math.max(gesture.startDistance, Number.EPSILON)
      const minimumScale = Math.max(
        minimum / gesture.startRadii.horizontal,
        minimum / gesture.startRadii.vertical,
      )
      const scale = Math.max(minimumScale, Math.hypot(point.x - gesture.center.x, point.y - gesture.center.y) / startDistance)
      gesture.previewRadii = {
        horizontal: Math.round(gesture.startRadii.horizontal * scale),
        vertical: Math.round(gesture.startRadii.vertical * scale),
      }
    } else {
      const localPoint = rotatePoint(point, gesture.center, -gesture.startRotation)
      gesture.previewRadii = {
        horizontal: gesture.axis === 'horizontal'
          ? Math.max(minimum, Math.round(Math.abs(localPoint.x - gesture.center.x)))
          : gesture.startRadii.horizontal,
        vertical: gesture.axis === 'vertical'
          ? Math.max(minimum, Math.round(Math.abs(localPoint.y - gesture.center.y)))
          : gesture.startRadii.vertical,
      }
    }
    publishDirectOrbitPreview(gesture)
    return
  }
  if (gesture.kind === 'rotation') {
    if (props.isEntityCommandBlocked?.({ kind: 'orbit-geometry', orbitId: gesture.orbitId })) {
      emit('entity-command-blocked', { kind: 'orbit-geometry', orbitId: gesture.orbitId })
      finishOrbitGesture(true)
      return
    }
    const pointerAngle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x)
    let delta = pointerAngle - gesture.lastPointerAngle
    if (delta > Math.PI) delta -= Math.PI * 2
    else if (delta < -Math.PI) delta += Math.PI * 2
    gesture.previewRotation = normalizeOrbitRotation(gesture.previewRotation + delta * 180 / Math.PI)
    gesture.lastPointerAngle = pointerAngle
    publishDirectOrbitPreview(gesture)
    return
  }
  const resolution = directCenterMoveCandidates(gesture, point)
  gesture.candidates = resolution.candidates
  gesture.hasResolvedCandidate = resolution.candidate !== null
  if (!resolution.candidate) {
    directOrbitPreview.value = null
    return
  }
  if (resolution.candidate.target.kind === 'host') {
    gesture.previewHostId = resolution.candidate.target.objectId
    gesture.previewCenter = requiredPosition(objectPositions(gesture.systemSnapshot, systemMapGeometry(gesture.workspaceSnapshot)), gesture.previewHostId)
    const hostedOrbit: Orbit = { id: gesture.orbitId, order: gesture.orbitSnapshot.order, hostId: gesture.previewHostId }
    const minimum = minimumOrbitRadius(gesture.systemSnapshot, hostedOrbit)
    gesture.previewRadii = {
      horizontal: Math.max(gesture.startRadii.horizontal, minimum),
      vertical: Math.max(gesture.startRadii.vertical, minimum),
    }
  } else {
    gesture.previewHostId = null
    gesture.previewCenter = point
    gesture.previewRadii = gesture.startRadii
  }
  publishDirectOrbitPreview(gesture)
}

function startOrbitGesture(
  event: PointerEvent,
  element: SVGSVGElement | null,
  explicitTarget?: OrbitEditTarget,
): boolean {
  if (!element || event.button !== 0 || props.moveTargeting
    || props.clusterMoveTargeting || props.clusterAddType != null || props.creationType != null) return false
  const target = explicitTarget ?? orbitEditTargetAtTarget(event.target)
  if (!target || !canEditOrbit(target.systemId, target.orbitId)) return false
  const sourceSystem = props.workspace.cluster.systems.find(system => system.id === target.systemId)
  const orbit = sourceSystem?.orbits.find(candidate => candidate.id === target.orbitId)
  const projection = projections.value.find(candidate => candidate.id === target.systemId)
  const legacyAnchor = props.systemPositions[target.systemId]
  if (!sourceSystem || !orbit || !projection || !legacyAnchor) return false
  if (target.kind === 'center' && orbit.hostId !== null) return false
  const command: EntityCommand = target.kind === 'center'
    ? { kind: 'orbit-center-position', orbitId: orbit.id }
    : { kind: 'orbit-geometry', orbitId: orbit.id }
  if (props.isEntityCommandBlocked?.(command)) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    emit('entity-command-blocked', command)
    return true
  }
  const workspaceSnapshot = toRaw(props.workspace)
  const systemSnapshot = workspaceSnapshot.cluster.systems.find(system => system.id === target.systemId)
  const orbitSnapshot = systemSnapshot?.orbits.find(candidate => candidate.id === target.orbitId)
  const scenePoint = cameraPoint(event)
  if (!systemSnapshot || !orbitSnapshot || !scenePoint) return false
  const positions = objectPositions(systemSnapshot, systemMapGeometry(workspaceSnapshot))
  const center = orbitCenter(orbitSnapshot, positions)
  const startRadii = readOrbitRadii(systemSnapshot, orbitSnapshot, systemMapGeometry(workspaceSnapshot))
  const startRotation = orbitRotation(orbitSnapshot, systemMapGeometry(workspaceSnapshot))
  const localPointer = projection.unprojectLocalPoint({
    x: scenePoint.x - anchorDelta(projection).x,
    y: scenePoint.y - anchorDelta(projection).y,
  })
  const common: OrbitGestureBase = {
    systemId: target.systemId,
    orbitId: target.orbitId,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    camera: { ...viewport.value },
    anchorDelta: { ...anchorDelta(projection) },
    projection,
    legacyAnchor,
    workspaceSnapshot,
    systemSnapshot,
    orbitSnapshot,
    sourceGeometry: orbitGeometrySource(workspaceSnapshot, systemSnapshot, orbitSnapshot),
    center,
    startRadii,
    startRotation,
    moved: false,
  }
  if (target.kind === 'resize') {
    activeOrbitGesture = {
      ...common,
      kind: 'resize',
      axis: target.axis,
      startDistance: Math.hypot(localPointer.x - center.x, localPointer.y - center.y),
      previewRadii: startRadii,
    }
  } else if (target.kind === 'rotation') {
    activeOrbitGesture = {
      ...common,
      kind: 'rotation',
      lastPointerAngle: Math.atan2(localPointer.y - center.y, localPointer.x - center.x),
      previewRotation: startRotation,
    }
  } else {
    activeOrbitGesture = {
      ...common,
      kind: 'center',
      previewCenter: center,
      previewHostId: null,
      previewRadii: startRadii,
      candidates: [],
      hasResolvedCandidate: false,
    }
  }
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* The event may already be outside the active SVG. */ }
  emit('editing-gesture-change', true)
  return true
}

function finishOrbitGesture(cancelled: boolean): void {
  const gesture = activeOrbitGesture
  if (!gesture) return
  activeOrbitGesture = null
  const element = svgElement.value
  if (element?.hasPointerCapture(gesture.pointerId)) {
    try { element.releasePointerCapture(gesture.pointerId) } catch { /* Capture may already be released. */ }
  }
  emit('editing-gesture-change', false)
  directOrbitPreview.value = null
  if (cancelled || gesture.moved) suppressClickAfterOwnedGesture()
  if (cancelled || !gesture.moved || !orbitGestureSourceIsCurrent(gesture)) return
  if (gesture.kind === 'resize') emit('resize-orbit', gesture.orbitId, gesture.previewRadii, gesture.systemId, gesture.sourceGeometry)
  else if (gesture.kind === 'rotation') emit('rotate-orbit', gesture.orbitId, gesture.previewRotation, gesture.systemId, gesture.sourceGeometry)
  else if (gesture.hasResolvedCandidate) {
    emit('move-orbit-center', gesture.orbitId, toNormalizedMapPoint(gesture.previewCenter), gesture.previewHostId, gesture.systemId, gesture.sourceGeometry)
  } else if (gesture.candidates.length > 0) {
    emit('orbit-center-candidates', gesture.orbitId, gesture.candidates, gesture.systemId)
  }
}

function deferMapClickTarget(target: PendingMapClickTarget): void {
  pendingMapClickTarget = target
  if (pendingMapClickTimer) clearTimeout(pendingMapClickTimer)
  pendingMapClickTimer = setTimeout(() => {
    pendingMapClickTarget = null
    pendingMapClickTimer = undefined
  }, 900)
}

function takePendingMapClickTarget(): PendingMapClickTarget | null {
  const target = pendingMapClickTarget
  pendingMapClickTarget = null
  if (pendingMapClickTimer) clearTimeout(pendingMapClickTimer)
  pendingMapClickTimer = undefined
  return target
}

function suppressClickAfterOwnedGesture(): void {
  suppressNextMapClick = true
  if (suppressNextMapClickTimer) clearTimeout(suppressNextMapClickTimer)
  suppressNextMapClickTimer = setTimeout(() => {
    suppressNextMapClick = false
    suppressNextMapClickTimer = undefined
  }, 900)
}

function clearOwnedGestureClickSuppression(): void {
  suppressNextMapClick = false
  if (suppressNextMapClickTimer) clearTimeout(suppressNextMapClickTimer)
  suppressNextMapClickTimer = undefined
}

function clearObjectMovePreview(): void {
  routeLandingPreview.value = null
  draggedBranchPreview.value = null
  objectMovePreview.value = null
}

function updateSelectedObjectMovePreview(
  drag: NonNullable<typeof activeSelectedObjectDrag>,
  point: Point,
): void {
  drag.delta = { x: point.x - drag.startScene.x, y: point.y - drag.startScene.y }
  selectedObjectDragPreview.value = drag.drag?.preview(drag.delta) ?? null
}

function finishSelectedObjectDrag(cancelled: boolean): void {
  const drag = activeSelectedObjectDrag
  if (!drag) return
  activeSelectedObjectDrag = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  emit('editing-gesture-change', false)
  if (cancelled || drag.moved) suppressClickAfterOwnedGesture()
  selectedObjectDragPreview.value = null
  if (cancelled || !drag.moved) {
    drag.drag?.cancel()
    return
  }
  if (drag.drag) void drag.drag.complete(drag.delta)
}

function clearElasticFrameGrowthAnimation(): void {
  pendingElasticFrameGrowth = null
  frameGrowthAnimation.value = null
}

function finishElasticFrameGrowthAnimation(): void {
  frameGrowthAnimation.value = null
}

function showAcceptedElasticFrameGrowth(workspace: LocalWorkspace): void {
  const pending = pendingElasticFrameGrowth
  if (!pending || toRaw(workspace) === pending.workspaceSnapshot) return
  pendingElasticFrameGrowth = null
  if (workspace.id !== pending.workspaceSnapshot.id
    || workspace.cluster.id !== pending.workspaceSnapshot.cluster.id) return

  const insets = workspaceSystemFrame(workspace, pending.systemId)
  if (!insets
    || insets.left !== pending.expectedInsets.left
    || insets.top !== pending.expectedInsets.top
    || insets.right !== pending.expectedInsets.right
    || insets.bottom !== pending.expectedInsets.bottom) return

  const previousSystem = pending.workspaceSnapshot.cluster.systems.find(system => system.id === pending.systemId)
  const currentSystem = workspace.cluster.systems.find(system => system.id === pending.systemId)
  if (!previousSystem || !currentSystem) return
  const previousPosition = objectPositions(previousSystem, systemMapGeometry(pending.workspaceSnapshot)).get(pending.objectId)
  const currentPosition = objectPositions(currentSystem, systemMapGeometry(workspace)).get(pending.objectId)
  if (!previousPosition || !currentPosition
    || Math.hypot(currentPosition.x - previousPosition.x, currentPosition.y - previousPosition.y) < 1e-5) return

  const animation: ElasticFrameGrowthAnimation = {
    systemId: pending.systemId,
    stretchedPath: pending.stretchedPath,
    sourceFrame: pending.sourceFrame,
    targetFrame: pending.targetFrame,
  }
  frameGrowthAnimation.value = animation
  void nextTick(() => {
    if (frameGrowthAnimation.value !== animation) return
    const elements = svgElement.value?.querySelectorAll<SVGAnimationElement>(
      '.continuous-warden-frame-growth-animation animate',
    )
    if (!elements?.length || [...elements].some(element => typeof element.beginElement !== 'function')) {
      frameGrowthAnimation.value = null
      return
    }
    elements.forEach(element => element.beginElement())
  })
}

function finishObjectDrag(cancelled: boolean): void {
  const drag = activeObjectDrag
  if (!drag) return
  activeObjectDrag = null
  if (cancelled && drag.selectDrag) selectObjectDragGeneration += 1
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  emit('editing-gesture-change', false)
  if (cancelled || drag.moved) suppressClickAfterOwnedGesture()
  const elastic = elasticPlacementPreview.value?.systemId === drag.systemId
    ? elasticPlacementPreview.value
    : null
  elasticPlacementPreview.value = null
  if (!cancelled && drag.moved) {
    if (drag.crossContext) {
      clearObjectMovePreview()
      const generation = selectObjectDragGeneration
      const mode = props.mode
      emit('move-route-object', { kind: 'transfer', proposal: drag.crossContext },
        () => generation === selectObjectDragGeneration && mode === props.mode && drag.selectDrag?.isCurrent() !== false)
      return
    }
    if (drag.transfer) {
      clearObjectMovePreview()
      emit('transfer-object-on-drop', drag.transfer, drag.selectDrag)
      return
    }
    const landing = drag.landing
    if (!landing) {
      clearObjectMovePreview()
      return
    }
    const acceptedFrameInsets = landing.frameInsets
    if (elastic?.acceptsDrop && acceptedFrameInsets && drag.startDisplayedFrame) {
      pendingElasticFrameGrowth = {
        systemId: drag.systemId,
        objectId: drag.objectId,
        workspaceSnapshot: drag.workspaceSnapshot,
        expectedInsets: acceptedFrameInsets,
        stretchedPath: elastic.path,
        sourceFrame: { ...drag.startDisplayedFrame },
        targetFrame: { ...elastic.displayedFrame },
      }
      frameGrowthAnimation.value = null
    }
    clearObjectMovePreview()
    emit('move-object-in-system', drag.systemId, drag.objectId, landing.position, drag.workspaceSnapshot, acceptedFrameInsets, drag.selectDrag)
    return
  }
  clearObjectMovePreview()
}

function frameInsetsFor(anchor: Point, frame: SvgViewportRect): SystemFrameInsets | undefined {
  try {
    return systemFrameInsetsFromRect(anchor, frame)
  } catch {
    return undefined
  }
}

function legacyFrameInsets(
  workspace: LocalWorkspace,
  systemId: string,
  anchor: Point,
  frame: SvgViewportRect,
): SystemFrameInsets | undefined {
  if (workspaceSystemFrame(workspace, systemId)) return undefined
  return frameInsetsFor(anchor, frame)
}

function transferDropForObjectDrag(drag: ActiveObjectDrag): {
  drop: SystemObjectTransferDrop
  branch: NonNullable<ReturnType<typeof projectZoneObjectBranch>>
} | null {
  const containingFrames = drag.startFrames.filter(frame =>
    continuousMapRoundedFrameContains(drag.targetScenePoint, frame.envelope))
  // Source and destination both count at their shared edge, so only a unique other frame transfers.
  if (containingFrames.length !== 1 || containingFrames[0]?.id === drag.systemId) return null

  const destinationSystemId = containingFrames[0]!.id
  const destination = drag.workspaceSnapshot.cluster.systems.find(system => system.id === destinationSystemId)
  const destinationProjection = projections.value.find(projection => projection.id === destinationSystemId)
  const destinationFrame = containingFrames[0]!
  if (!destination || !destinationProjection) return null

  const destinationDelta = anchorDelta(destinationProjection)
  const destinationLocalPoint = destinationProjection.unprojectLocalPoint({
    x: drag.targetScenePoint.x - destinationDelta.x,
    y: drag.targetScenePoint.y - destinationDelta.y,
  })
  const normalizedPoint = toNormalizedMapPoint(destinationLocalPoint)
  if (![normalizedPoint.x, normalizedPoint.y].every(Number.isFinite)) return null

  const geometry = systemMapGeometry(drag.workspaceSnapshot)
  const orbitHit = orbitPlacementHitsAtPoint(
    destination,
    fromNormalizedMapPoint(normalizedPoint),
    objectPositions(destination, geometry),
    geometry,
    drag.objectId,
  ).find(candidate => candidate.valid)
  const orbitCandidate = orbitHit
    ? { kind: 'orbit' as const, orbitId: orbitHit.orbit.id, angle: orbitHit.angle }
    : null
  const placement = resolveSystemObjectTransferMapPlacement(
    destination,
    geometry,
    drag.objectId,
    orbitCandidate,
    normalizedPoint,
  )
  if (!placement) return null

  const destinationAnchor = {
    x: destinationProjection.anchor.x + destinationDelta.x,
    y: destinationProjection.anchor.y + destinationDelta.y,
  }
  const authoredDestination = destinationProjection.preferredFrame ?? destinationProjection.envelope
  const destinationPreferredFrame = {
    ...authoredDestination,
    x: authoredDestination.x + destinationDelta.x,
    y: authoredDestination.y + destinationDelta.y,
  }
  const request = { sourceSystemId: drag.systemId, rootObjectId: drag.objectId, destinationSystemId, placement }
  const review = prepareSystemObjectTransfer(drag.workspaceSnapshot, request)
  const previewSystem = review.previewWorkspace.cluster.systems.find(system => system.id === destinationSystemId)
  const legacyAnchor = props.systemPositions[destinationSystemId]
  if (!previewSystem || !legacyAnchor) return null
  const projected = projectWardenSystem(previewSystem, legacyAnchor, systemMapGeometry(review.previewWorkspace))
  const branch = projectZoneObjectBranch(previewSystem, projected, drag.objectId)
  if (!branch) return null
  const landing = planBoundedZoneLanding({
    systemId: destinationSystemId,
    anchor: destinationAnchor,
    displayedFrame: destinationFrame.envelope,
    target: { x: branch.root.x + destinationDelta.x, y: branch.root.y + destinationDelta.y },
    fixedFrames: drag.startFrames.filter(frame => frame.id !== destinationSystemId),
    authoredFrames: drag.authoredFrames,
    pixelsPerSceneUnit: drag.camera.k * svgPixelScale.value,
    relativeBounds: branch.relativeBounds,
  })
  if (!landing) return null

  const sourceFrameInsets = legacyFrameInsets(drag.workspaceSnapshot, drag.systemId, drag.anchor, drag.preferredFrame)
  const destinationFrameInsets = landing.grew
    ? frameInsetsFor(destinationAnchor, landing.authoredFrame)
    : legacyFrameInsets(drag.workspaceSnapshot, destinationSystemId, destinationAnchor, destinationPreferredFrame)
  if (landing.grew && !destinationFrameInsets) return null

  return {
    branch,
    drop: {
      ...request,
      workspaceSnapshot: drag.workspaceSnapshot,
      ...(sourceFrameInsets ? { sourceFrameInsets } : {}),
      ...(destinationFrameInsets ? { destinationFrameInsets } : {}),
    },
  }
}

function startExitDrag(event: PointerEvent, element: SVGSVGElement, routeId: string): void {
  const origin = routeLayer.value?.getRenderedRouteEnd(routeId)
  const camera = getViewport()
  const startScene = cameraPointAt(event, camera)
  if (!origin || !startScene) return
  activeExitDrag = {
    routeId,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene,
    origin,
    camera,
    workspaceSnapshot: props.workspace,
    position: null,
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
}

function updateExitDrag(drag: ActiveExitDrag, event: PointerEvent): void {
  if (drag.position === null && !hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY })) return
  const scene = cameraPointAt(event, drag.camera)
  if (!scene) return
  const position = {
    x: drag.origin.x + scene.x - drag.startScene.x,
    y: drag.origin.y + scene.y - drag.startScene.y,
  }
  drag.position = position
  const safe = isSafeClusterScenePoint(position) && hasSafeClusterSceneBounds(props.cluster, props.systemPositions, {
    ...props.unresolvedExitPositions,
    [drag.routeId]: position,
  })
  setUnresolvedExitPositionPreview(drag.routeId, safe ? position : null)
  event.preventDefault()
}

function finishExitDrag(cancelled: boolean): void {
  const drag = activeExitDrag
  if (!drag) return
  activeExitDrag = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  setUnresolvedExitPositionPreview(drag.routeId, null)
  emit('editing-gesture-change', false)
  if (cancelled || drag.position !== null) suppressClickAfterOwnedGesture()
  if (!cancelled && drag.position !== null) emit('move-unresolved-exit', drag.routeId, drag.position)
}

function editingPointerId(): number | undefined {
  return activeOrbitGesture?.pointerId
    ?? activeSystemFrameResize?.pointerId
    ?? activeRouteObjectDrag?.pointerId
    ?? activeSelectedObjectDrag?.pointerId
    ?? activeObjectDrag?.pointerId
    ?? activeAnchorDrag?.pointerId
    ?? activeExitDrag?.pointerId
}

function createSelectObjectDragContext(): SelectMapObjectDragContext {
  const generation = ++selectObjectDragGeneration
  const selectedObjectIds = [...props.selectedObjectIds]
  return {
    selectedObjectIds,
    isCurrent: () => generation === selectObjectDragGeneration
      && props.mode === 'select'
      && props.selectedObjectIds.length === selectedObjectIds.length
      && props.selectedObjectIds.every((objectId, index) => objectId === selectedObjectIds[index]),
  }
}

function beginSelectedGroupDrag(
  event: PointerEvent,
  element: SVGSVGElement,
  objectTarget: Extract<WardenMovePointerTarget, { kind: 'object' }>,
  expectedMode: Extract<MapInteractionMode, 'select' | 'move'>,
): boolean {
  const scene = cameraPoint(event)
  if (!scene) return false
  const camera = getViewport()
  const systemScales = new Map(projections.value.map(projection => [projection.id, projection.scale] as const))
  const drag = props.beginSelectedObjectDrag?.(
    objectTarget.objectId, systemScales, expectedMode, camera.k * svgPixelScale.value,
  ) ?? null
  if (expectedMode === 'select' && !drag) return false
  activeSelectedObjectDrag = {
    drag,
    systemId: objectTarget.systemId,
    objectId: objectTarget.objectId,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene: scene,
    camera,
    workspaceSnapshot: props.workspace,
    delta: { x: 0, y: 0 },
    moved: false,
  }
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
  return true
}

function beginSingleObjectDrag(
  event: PointerEvent,
  element: SVGSVGElement,
  objectTarget: Extract<WardenMovePointerTarget, { kind: 'object' }>,
  selectDrag?: SelectMapObjectDragContext,
): boolean {
  const projection = projections.value.find(candidate => candidate.id === objectTarget.systemId)
  const localObject = projection?.objects.find(candidate => candidate.id === objectTarget.objectId)
  const system = props.cluster.systems.find(candidate => candidate.id === objectTarget.systemId)
  const legacyAnchor = props.systemPositions[objectTarget.systemId]
  const scene = cameraPoint(event)
  if (!projection || !localObject || !system || !legacyAnchor || !scene) return false
  const camera = getViewport()
  const delta = anchorDelta(projection)
  const baselineFrames = baselineDisplayedFrameInputs()
  const displayedFrame = baselineFrames.find(candidate => candidate.id === objectTarget.systemId)?.envelope
  const authored = projection.preferredFrame ?? projection.envelope
  const preferredFrame = { ...authored, x: authored.x + delta.x, y: authored.y + delta.y }
  activeObjectDrag = {
    systemId: objectTarget.systemId,
    objectId: objectTarget.objectId,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene: scene,
    originLocal: localObject.position,
    anchorDelta: delta,
    camera,
    legacyAnchor: { ...legacyAnchor },
    projection,
    workspaceSnapshot: props.workspace,
    anchor: { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y },
    startDisplayedFrame: hasPositiveFrame(displayedFrame) ? { ...displayedFrame } : null,
    preferredFrame,
    fixedFrames: baselineFrames.filter(candidate => candidate.id !== objectTarget.systemId),
    startFrames: baselineFrames.map(candidate => ({ ...candidate, envelope: { ...candidate.envelope } })),
    authoredFrames: systemFrameInputs.value,
    ...(selectDrag ? { selectDrag } : {}),
    moved: false,
    landing: null,
    transfer: null,
    crossContext: null,
    targetScenePoint: { x: localObject.scenePosition.x + delta.x, y: localObject.scenePosition.y + delta.y },
  }
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
  return true
}

function canDragRouteObject(target: RouteDragSource): boolean {
  return !props.keyboardOwnedOverlayOpen && hasRouteObjectDragContext(target)
}

function hasRouteObjectDragContext(target: RouteDragSource): boolean {
  if (props.presentation || props.standaloneImportPlacementEnabled || props.moveTargeting || props.clusterMoveTargeting
    || props.clusterAddType || props.creationType || props.clusterChooserOpen
    || props.routeObjectEditingId === target.objectId) return false
  const inspected = props.inspectedTarget
  const ownsSelection = props.mode === 'move' || (props.mode === 'select' && inspected?.kind === 'route-object'
    && inspected.routeId === target.routeId && inspected.objectId === target.objectId)
  return ownsSelection && routeContentsFor(props.workspace.cluster, target.routeId)?.objects
    .some(object => object.id === target.objectId) === true
}

function startRouteObjectDrag(event: PointerEvent, element: SVGSVGElement, source: RouteDragSource): void {
  if (!event.isPrimary || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey
    || !canDragRouteObject(source) || (props.mode !== 'select' && props.mode !== 'move')) return
  const contents = routeContentsFor(props.workspace.cluster, source.routeId)
  const root = contents?.objects.find(object => object.id === source.objectId)
  const geometry = displayedRouteGeometry(source.routeId)
  const pointerStart = cameraPoint(event)
  if (!contents || !root || !geometry || !pointerStart) return
  const origin = projectRouteObjects(contents, geometry, props.workspace.layout).positions.get(root.id)
  if (!origin) return
  const branch = resolveSystemObjectBranch(contents, root.id)
  if (!branch) return
  activeRouteObjectDrag = {
    ...source,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    pointerStart,
    origin,
    camera: getViewport(),
    mode: props.mode,
    workspaceSnapshot: props.workspace,
    geometry,
    branch,
    contents,
    root,
    moved: false,
    landing: null,
    crossContext: null,
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
}

function routeDropTarget(aim: Point, event: PointerEvent): RouteLanding | null {
  const routeId = routeLayer.value?.routeIdAtClient(event)
  const mark = routeObjectTargetAt(svgElement.value?.ownerDocument.elementFromPoint(event.clientX, event.clientY) ?? null)
  return routeLandingAtPoint(aim, routeId ?? mark?.routeId, false)
}

function zoneDropTarget(aim: Point, snapshot: LocalWorkspace, rootObjectId: string): CatalogueObjectTransferRequest['landing'] | null {
  const containing = baselineDisplayedFrameInputs().filter(frame => continuousMapRoundedFrameContains(aim, frame.envelope))
  if (containing.length !== 1) return null
  const systemId = containing[0]!.id
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const destination = snapshot.cluster.systems.find(system => system.id === systemId)
  if (!projection || !destination) return null
  const delta = anchorDelta(projection)
  const point = projection.unprojectLocalPoint({ x: aim.x - delta.x, y: aim.y - delta.y })
  const geometry = systemMapGeometry(snapshot)
  const orbitHit = detailSystemIds.value.has(systemId)
    ? orbitPlacementHitsAtPoint(destination, point, objectPositions(destination, geometry), geometry, rootObjectId)
      .find(candidate => candidate.valid)
    : undefined
  const placement = resolveSystemObjectTransferMapPlacement(destination, geometry, rootObjectId,
    orbitHit ? { kind: 'orbit', orbitId: orbitHit.orbit.id, angle: orbitHit.angle } : null,
    toNormalizedMapPoint(point))
  return placement ? { kind: 'system', systemId, placement } : null
}

function previewCrossContextTransfer(
  snapshot: LocalWorkspace,
  request: CatalogueObjectTransferRequest,
): CatalogueObjectTransferReview | null {
  try {
    const proposal = prepareFittedCatalogueObjectTransfer(snapshot, request)
    const { previewWorkspace: candidate, branch } = proposal
    const { landing, rootObjectId } = request
    const candidateProjections = candidate.cluster.systems.map((system, index) => projectWardenSystem(
      system, candidate.layout.systemPositions[system.id] ?? initialClusterSystemPosition(index),
      candidate.layout, undefined, workspaceSystemFrame(candidate, system.id),
    ))
    if (landing.kind === 'system') {
      const system = candidate.cluster.systems.find(value => value.id === landing.systemId)
      const projection = candidateProjections.find(value => value.id === landing.systemId)
      if (!system || !projection) return null
      const projectedBranch = projectZoneObjectBranch(system, projection, rootObjectId)
      if (!projectedBranch) return null
      draggedBranchPreview.value = projectedBranch
    } else {
      const contents = routeContentsFor(candidate.cluster, landing.routeId)
      const geometry = buildContinuousWardenRouteGeometries({
        routes: candidate.cluster.routes,
        projections: candidateProjections,
        detailSystemIds: detailSystemIds.value,
        unresolvedExitPositions: candidate.layout.unresolvedExitPositions ?? {},
        display: { pixelsPerSceneUnit: routePixelScale.value, fanOutLimitPixels: routeFanOutLimitPixels.value },
      }).get(landing.routeId)
      if (!contents || !geometry) return null
      routeLandingPreview.value = {
        routeId: landing.routeId,
        contents,
        geometry,
        layout: candidate.layout,
        branch,
      }
    }
    return proposal
  } catch {
    // The gesture retains its original support when the proposed cross-context landing cannot fit.
    return null
  }
}

function updateRouteObjectDrag(drag: ActiveRouteObjectDrag, event: PointerEvent): void {
  if (!drag.moved && !hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY })) return
  if (drag.lastClient?.x === event.clientX && drag.lastClient.y === event.clientY) return
  const pointer = cameraPointAt(event, drag.camera)
  if (!pointer) return
  drag.lastClient = { x: event.clientX, y: event.clientY }
  const aim = {
    x: drag.origin.x + pointer.x - drag.pointerStart.x,
    y: drag.origin.y + pointer.y - drag.pointerStart.y,
  }
  const geometry = displayedRouteGeometry(drag.routeId) ?? drag.geometry
  routeLandingPreview.value = null
  draggedBranchPreview.value = null
  const routeTarget = routeDropTarget(aim, event)
  const crossTarget = routeTarget
    ? routeTarget.routeId === drag.routeId && drag.root.placement.kind === 'route'
      ? null
      : { kind: 'route' as const, ...routeTarget }
    : zoneDropTarget(aim, drag.workspaceSnapshot, drag.objectId)
  drag.crossContext = crossTarget ? previewCrossContextTransfer(drag.workspaceSnapshot, {
    source: { kind: 'route', routeId: drag.routeId },
    landing: crossTarget,
    rootObjectId: drag.objectId,
  }) : null
  const atOrigin = event.clientX === drag.startClient.x && event.clientY === drag.startClient.y
  const startingPlacement = drag.root.placement
  const progression = atOrigin && startingPlacement.kind === 'route'
    ? startingPlacement.progression
    : projectPointOntoRoute(aim, geometry)
  if (progression === null) return
  drag.moved = true
  const root = { ...drag.root, placement: { kind: 'route' as const, progression } }
  const anchor = pointOnRoute(geometry, progression)
  drag.landing = startingPlacement.kind === 'route' ? { routeId: drag.routeId, progression } : null
  if (!drag.crossContext) routeLandingPreview.value = {
    routeId: drag.routeId,
    geometry,
    contents: drag.landing
      ? { ...drag.contents, objects: drag.contents.objects.map(object => object.id === root.id ? root : object) }
      : drag.contents,
    layout: drag.workspaceSnapshot.layout,
    branch: drag.branch,
  }
  routeMovePreview.value = {
    routeId: drag.routeId,
    geometry,
    branch: drag.branch,
    pointer: { objects: [root], orbits: [] },
    offset: { x: aim.x - anchor.x, y: aim.y - anchor.y },
  }
  event.preventDefault()
}

function finishRouteObjectDrag(cancelled: boolean): void {
  const drag = activeRouteObjectDrag
  if (!drag) return
  activeRouteObjectDrag = null
  routeMovePreview.value = null
  routeLandingPreview.value = null
  draggedBranchPreview.value = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already be released. */ }
  }
  emit('editing-gesture-change', false)
  if (cancelled || drag.moved) suppressClickAfterOwnedGesture()
  if (cancelled) return
  const generation = routeDragGeneration
  const request: RouteObjectPlacementRequest | null = drag.crossContext
    ? { kind: 'transfer', proposal: drag.crossContext }
    : drag.landing && { ...drag.landing, kind: 'move', objectId: drag.objectId, workspaceSnapshot: drag.workspaceSnapshot }
  if (!request) return
  emit('move-route-object', request,
    () => generation === routeDragGeneration && props.mode === drag.mode && hasRouteObjectDragContext(drag))
}

function onPointerDownCapture(event: PointerEvent): void {
  selectObjectDragGeneration += 1
  clearElasticFrameGrowthAnimation()
  cancelWheelZoom()
  if (event.pointerType !== 'touch') touchCameraNavigation.clearDoubleTap()
  const ownedPointerId = editingPointerId()
  if (ownedPointerId !== undefined && ownedPointerId !== event.pointerId) {
    cancelActiveGesture()
    return
  }
  clearOwnedGestureClickSuppression()
  takePendingMapClickTarget()
  routeDragGeneration += 1
  const routeObject = routeObjectTargetAt(event.target)
  const element = svgElement.value
  if (routeObject) {
    if (element) startRouteObjectDrag(event, element, routeObject)
    return
  }
  const resizeTarget = systemFrameResizeTarget(event.target)
  if (resizeTarget && element) {
    startSystemFrameResize(event, element, resizeTarget)
    if (activeSystemFrameResize?.pointerId === event.pointerId) return
  }
  if (props.mode === 'select') {
    if (!event.isPrimary || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey
      || !element || props.presentation || props.standaloneImportPlacementEnabled || props.moveTargeting
      || props.clusterMoveTargeting || props.clusterAddType || props.creationType || props.clusterChooserOpen
      || props.keyboardOwnedOverlayOpen) return
    const systemId = systemIdAtTarget(event.target)
    if (systemId && isSelectedSystem(systemId)) {
      startSystemNameDrag(event, element, systemId)
      return
    }
    const moveTarget = selectedOrbitOrExitMoveTarget(event)
    if (moveTarget?.kind === 'orbit' && startOrbitGesture(event, element, moveTarget.target)) return
    if (moveTarget?.kind === 'exit') {
      startExitDrag(event, element, moveTarget.routeId)
      return
    }
    const objectTarget = objectTargetAtTarget(event.target)
    const canSelectDrag = canStartSelectedObjectDrag(
      event,
      objectTarget?.objectId ?? null,
      props.selectedObjectIds,
      true,
    )
    if (!canSelectDrag || !objectTarget || !canMoveObjectInSystem(objectTarget) || !element) return
    const target = { kind: 'object', ...objectTarget } as const
    if (props.selectedObjectIds.length > 1) {
      beginSelectedGroupDrag(event, element, target, 'select')
    } else {
      beginSingleObjectDrag(event, element, target, createSelectObjectDragContext())
    }
    return
  }
  if (props.standaloneImportPlacementEnabled || event.button !== 0 || props.mode !== 'move' || props.moveTargeting || props.clusterMoveTargeting
    || props.clusterAddType != null || props.creationType != null) return
  const moveHit = moveTargetAtPoint(event, element)
  const moveTarget = moveHit.target
  if (!moveTarget && moveHit.blockedCommand) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    emit('entity-command-blocked', moveHit.blockedCommand)
    return
  }
  if (moveTarget?.kind === 'exit' && element) {
    startExitDrag(event, element, moveTarget.routeId)
    return
  }
  if (moveTarget?.kind === 'orbit') {
    startOrbitGesture(event, element, moveTarget.target)
    return
  }
  const objectTarget = moveTarget?.kind === 'object' ? moveTarget : null
  if (objectTarget && element) {
    if (props.selectedObjectIds.length > 1 && props.selectedObjectIds.includes(objectTarget.objectId)) {
      beginSelectedGroupDrag(event, element, objectTarget, 'move')
      return
    }
    beginSingleObjectDrag(event, element, objectTarget)
    return
  }
  const systemId = moveTarget?.kind === 'anchor' ? moveTarget.systemId : null
  if (systemId && element) startSystemNameDrag(event, element, systemId)
}

function startSystemNameDrag(event: PointerEvent, element: SVGSVGElement, systemId: string): void {
  const origin = props.systemPositions[systemId]
  const scene = cameraPoint(event)
  if (!origin || !scene) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  activeAnchorDrag = {
    systemId,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene: scene,
    origin: { ...origin },
    preview: { ...origin },
    moved: false,
  }
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
}

function onPointerMoveCapture(event: PointerEvent): void {
  if (activeRouteObjectDrag?.pointerId === event.pointerId) {
    updateRouteObjectDrag(activeRouteObjectDrag, event)
    return
  }
  if (activeExitDrag?.pointerId === event.pointerId) {
    updateExitDrag(activeExitDrag, event)
    return
  }
  const orbitGesture = activeOrbitGesture
  if (orbitGesture?.pointerId === event.pointerId) {
    if (!hasMapDragThreshold(orbitGesture.startClient, { x: event.clientX, y: event.clientY }) && !orbitGesture.moved) return
    orbitGesture.moved = true
    const point = orbitGestureLocalPoint(orbitGesture, event)
    if (point) previewOrbitGestureAt(orbitGesture, point)
    event.preventDefault()
    return
  }
  if (activeSystemFrameResize?.pointerId === event.pointerId) {
    updateSystemFrameResize(activeSystemFrameResize, event)
    return
  }
  const selectedObjectDrag = activeSelectedObjectDrag
  if (selectedObjectDrag?.pointerId === event.pointerId) {
    if (!hasMapDragThreshold(selectedObjectDrag.startClient, { x: event.clientX, y: event.clientY })
      && !selectedObjectDrag.moved) return
    selectedObjectDrag.moved = true
    const point = cameraPointAt(event, selectedObjectDrag.camera)
    if (point) updateSelectedObjectMovePreview(selectedObjectDrag, point)
    event.preventDefault()
    return
  }
  const objectDrag = activeObjectDrag
  if (objectDrag?.pointerId === event.pointerId) {
    if (!hasMapDragThreshold(objectDrag.startClient, { x: event.clientX, y: event.clientY }) && !objectDrag.moved) return
    objectDrag.moved = true
    const point = cameraPointAt(event, objectDrag.camera)
    if (point) updateObjectMovePreview(objectDrag, point, event)
    event.preventDefault()
    return
  }
  const drag = activeAnchorDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  if (!hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY }) && !drag.moved) return
  drag.moved = true
  const point = cameraPoint(event)
  if (!point) return
  drag.preview = moveWardenClusterAnchorBySceneDelta(drag.origin, {
    x: point.x - drag.startScene.x,
    y: point.y - drag.startScene.y,
  })
  publishSystemPositionPreview(drag.systemId, drag.preview)
  event.preventDefault()
}

function finishAnchorDrag(cancelled: boolean): void {
  const drag = activeAnchorDrag
  if (!drag) return
  activeAnchorDrag = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  emit('editing-gesture-change', false)
  if (cancelled || drag.moved) suppressClickAfterOwnedGesture()
  if (!cancelled && drag.moved) {
    emit('move-system', drag.systemId, drag.preview)
    return
  }
  publishSystemPositionPreview(drag.systemId, null)
}

function onPointerEndCapture(event: PointerEvent): void {
  if (editingPointerId() !== event.pointerId) return
  // Pointer capture retargets the event to the SVG even when chrome covers the actual release.
  const cancelled = event.type === 'pointercancel' || !isClientPointOnMap(event.clientX, event.clientY)
  if (activeRouteObjectDrag?.pointerId === event.pointerId) {
    const drag = activeRouteObjectDrag
    if (!cancelled) {
      updateRouteObjectDrag(drag, event)
      if (!drag.moved) deferMapClickTarget({ kind: 'route-object', routeId: drag.routeId, objectId: drag.objectId })
    }
    finishRouteObjectDrag(cancelled)
    if (cancelled || drag.moved) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    return
  }
  if (activeSystemFrameResize?.pointerId === event.pointerId) {
    const resize = activeSystemFrameResize
    if (!cancelled && (resize.moved || hasMapDragThreshold(resize.startClient, { x: event.clientX, y: event.clientY }))) {
      updateSystemFrameResize(resize, event)
    }
    finishSystemFrameResize(cancelled)
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return
  }
  const exitDrag = activeExitDrag
  if (exitDrag?.pointerId === event.pointerId) {
    if (!cancelled) {
      updateExitDrag(exitDrag, event)
      if (exitDrag.position === null) deferMapClickTarget({ kind: 'route', routeId: exitDrag.routeId })
    }
    finishExitDrag(cancelled)
    if (cancelled || exitDrag.position !== null) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    return
  }
  if (activeOrbitGesture?.pointerId === event.pointerId) {
    const gesture = activeOrbitGesture
    if (!cancelled && (gesture.moved || hasMapDragThreshold(gesture.startClient, { x: event.clientX, y: event.clientY }))) {
      gesture.moved = true
      const point = orbitGestureLocalPoint(gesture, event)
      if (point) previewOrbitGestureAt(gesture, point)
    }
    const moved = gesture.moved
    if (!cancelled && !moved) {
      deferMapClickTarget({ kind: 'orbit', systemId: gesture.systemId, orbitId: gesture.orbitId })
    }
    finishOrbitGesture(cancelled)
    if (moved || cancelled) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    return
  }
  if (activeSelectedObjectDrag?.pointerId === event.pointerId) {
    const drag = activeSelectedObjectDrag
    if (!cancelled && (drag.moved || hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY }))) {
      drag.moved = true
      const point = cameraPointAt(event, drag.camera)
      if (point) updateSelectedObjectMovePreview(drag, point)
    }
    const moved = drag.moved
    if (!cancelled && !moved) {
      deferMapClickTarget({ kind: 'object', systemId: drag.systemId, objectId: drag.objectId })
    }
    finishSelectedObjectDrag(cancelled)
    if (moved || cancelled) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    return
  }
  if (activeObjectDrag?.pointerId === event.pointerId) {
    const drag = activeObjectDrag
    if (!cancelled && (drag.moved || hasMapDragThreshold(drag.startClient, { x: event.clientX, y: event.clientY }))) {
      drag.moved = true
      const point = cameraPointAt(event, drag.camera)
      if (point) updateObjectMovePreview(drag, point, event)
    }
    const moved = drag.moved
    if (!cancelled && !moved) {
      deferMapClickTarget({ kind: 'object', systemId: drag.systemId, objectId: drag.objectId })
    }
    finishObjectDrag(cancelled)
    if (moved || cancelled) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    return
  }
  if (activeAnchorDrag?.pointerId !== event.pointerId) return
  if (!cancelled && (activeAnchorDrag.moved
    || hasMapDragThreshold(activeAnchorDrag.startClient, { x: event.clientX, y: event.clientY }))) {
    activeAnchorDrag.moved = true
    const point = cameraPoint(event)
    if (point) {
      activeAnchorDrag.preview = moveWardenClusterAnchorBySceneDelta(activeAnchorDrag.origin, {
        x: point.x - activeAnchorDrag.startScene.x,
        y: point.y - activeAnchorDrag.startScene.y,
      })
      publishSystemPositionPreview(activeAnchorDrag.systemId, activeAnchorDrag.preview)
    }
  }
  if (!cancelled && !activeAnchorDrag.moved) {
    deferMapClickTarget({ kind: 'system', systemId: activeAnchorDrag.systemId })
  }
  const moved = activeAnchorDrag.moved
  finishAnchorDrag(cancelled)
  if (moved || cancelled) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
}

function onLostPointerCapture(event: PointerEvent): void {
  if (activeRouteObjectDrag?.pointerId === event.pointerId) finishRouteObjectDrag(true)
  if (activeSystemFrameResize?.pointerId === event.pointerId) finishSystemFrameResize(true)
  if (activeExitDrag?.pointerId === event.pointerId) finishExitDrag(true)
  if (activeOrbitGesture?.pointerId === event.pointerId) finishOrbitGesture(true)
  if (activeSelectedObjectDrag?.pointerId === event.pointerId) finishSelectedObjectDrag(true)
  if (activeObjectDrag?.pointerId === event.pointerId) finishObjectDrag(true)
  if (activeAnchorDrag?.pointerId === event.pointerId) finishAnchorDrag(true)
}

function onClickCapture(event: MouseEvent): void {
  if (event.detail === 0) return
  if (suppressNextMapClick) {
    clearOwnedGestureClickSuppression()
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return
  }
  if (props.standaloneImportPlacementEnabled) {
    const point = cameraPoint(event)
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      emit('standalone-import-placement-anchor', unprojectWardenClusterAnchor(point))
    }
    return
  }
  if (props.moveTargeting || props.clusterMoveTargeting) {
    const point = cameraPoint(event)
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      emit('move-target', point)
    }
    return
  }
  if (props.clusterAddType !== null && !props.clusterChooserOpen) {
    const point = cameraPoint(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const normalized = clampWardenClusterAnchor(unprojectWardenClusterAnchor(point))
    const directSystemId = systemIdAtTarget(event.target)
    const systemIds = directSystemId ? [directSystemId] : systemIdsAtDisplayPoint(point, props.clusterAddType === 'system')
    emit('cluster-target', normalized, systemIds)
    return
  }
  if (props.creationType && !props.clusterChooserOpen) {
    const point = cameraPoint(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (props.creationType.kind === 'orbit') offerOrbitAdd(point, event.target)
    else offerObjectAdd(point, event)
    return
  }
  const pendingTarget = takePendingMapClickTarget()
  const routeObjectTarget = routeObjectTargetAt(event.target)
    ?? (pendingTarget?.kind === 'route-object' ? pendingTarget : null)
  if (routeObjectTarget) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-route-object', routeObjectTarget.routeId, routeObjectTarget.objectId)
    return
  }
  const objectTarget = objectTargetAtTarget(event.target)
    ?? (pendingTarget?.kind === 'object' ? pendingTarget : null)
  if (objectTarget) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    emit('select-object', objectTarget.systemId, objectTarget.objectId)
    return
  }
  const routeId = routeIdAtTarget(event.target) ?? (pendingTarget?.kind === 'route' ? pendingTarget.routeId : null)
  if (routeId) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-route', routeLayer.value?.routeIdAtStroke(event) ?? routeId)
    return
  }
  const orbitTarget = orbitTargetAtTarget(event.target)
    ?? (pendingTarget?.kind === 'orbit' ? pendingTarget : null)
  if (orbitTarget) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    mapDom.focusOrbitFromPath(event.target, orbitTarget)
    emit('select-orbit', orbitTarget.systemId, orbitTarget.orbitId)
    return
  }
  const systemId = systemIdAtTarget(event.target)
    ?? (pendingTarget?.kind === 'system' ? pendingTarget.systemId : null)
  if (systemId) emit('activate-system', systemId)
}

function onKeydownCapture(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  if (event.key === 'Escape' && editingPointerId() !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    cancelActiveGesture()
    return
  }
  const resizeTarget = systemFrameResizeTarget(event.target)
  if (resizeTarget && resizeFrameWithKeyboard(resizeTarget, event)) return
  const objectTarget = objectTargetAtTarget(event.target)
  const orbitTarget = orbitTargetAtTarget(event.target)
  const systemId = systemIdAtTarget(event.target)
  const isActivation = event.key === 'Enter' || event.key === ' '
  if (props.standaloneImportPlacementEnabled) {
    if (props.keyboardOwnedOverlayOpen || !isActivation || !(event.target instanceof SVGElement)) return
    const element = svgElement.value
    const viewportRect = svgViewport.value
    const scenePoint = keyboardTargetScenePoint(event.target, systemId, objectTarget, orbitTarget)
      ?? (event.target === element && element
        ? (() => {
            const [x, y] = zoomTransform(element).invert([
              viewportRect.x + viewportRect.width / 2,
              viewportRect.y + viewportRect.height / 2,
            ])
            return { x, y }
          })()
        : null)
    if (scenePoint) {
      event.preventDefault()
      event.stopPropagation()
      emit('standalone-import-placement-anchor', unprojectWardenClusterAnchor(scenePoint))
    }
    return
  }
  if (onOrbitAdjustmentKeydown(event)) return
  const routeObject = routeObjectTargetAt(event.target)
  if (routeObject && isActivation && !event.repeat && !props.keyboardOwnedOverlayOpen
    && !props.creationType && props.clusterAddType === null && !props.moveTargeting && !props.clusterMoveTargeting) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-route-object', routeObject.routeId, routeObject.objectId)
    return
  }
  if (props.creationType && isActivation
    && !props.clusterChooserOpen && !props.moveTargeting && !props.clusterMoveTargeting) {
    if (event.repeat || props.keyboardOwnedOverlayOpen) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    const addRouteId = props.creationType.kind === 'object'
      ? routeIdAtTarget(event.target) ?? routeObject?.routeId : undefined
    const point = (addRouteId ? displayedRouteGeometry(addRouteId)?.midpoint : undefined)
      ?? keyboardTargetScenePoint(event.target, systemId, objectTarget, orbitTarget, true)
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      if (props.creationType.kind === 'orbit') offerOrbitAdd(point, event.target)
      else offerObjectAdd(point, event)
      return
    }
  }
  const routeId = routeIdAtTarget(event.target)
  const action = continuousMapKeyboardIntent({
    key: event.key,
    targetKind: routeId ? 'route' : objectTarget ? 'object' : orbitTarget ? 'orbit' : systemId ? 'system' : 'map',
    addArmed: props.clusterAddType !== null,
    chooserOpen: props.clusterChooserOpen,
    moveTargeting: props.moveTargeting,
    clusterMoveTargeting: props.clusterMoveTargeting,
  })
  if (!action) return

  if (action === 'add-target' || action === 'move-target') {
    const routeGeometry = routeId ? routeGeometries.value.get(routeId) : undefined
    const scenePoint = routeGeometry?.midpoint ?? keyboardTargetScenePoint(event.target, systemId, objectTarget, orbitTarget)
    if (!scenePoint) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'move-target') {
      emit('move-target', scenePoint)
      return
    }
    const normalized = clampWardenClusterAnchor(unprojectWardenClusterAnchor(scenePoint))
    const systemIds = systemId ? [systemId] : systemIdsAtDisplayPoint(scenePoint, props.clusterAddType === 'system')
    emit('cluster-target', normalized, systemIds)
    return
  }

  if (action === 'inspect-route' && routeId) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-route', routeId)
    return
  }
  if (action === 'inspect-object' && objectTarget) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-object', objectTarget.systemId, objectTarget.objectId)
    return
  }
  if (action === 'inspect-orbit' && orbitTarget) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-orbit', orbitTarget.systemId, orbitTarget.orbitId)
    return
  }
  if (action !== 'activate-system' || !systemId) return
  event.preventDefault()
  event.stopPropagation()
  emit('activate-system', systemId)
}

function keyboardTargetScenePoint(
  target: EventTarget | null,
  systemId: string | null,
  objectTarget: { systemId: string; objectId: string } | null,
  orbitTarget: { systemId: string; orbitId: string } | null,
  forAdd = false,
): Point | null {
  if (systemId) {
    const projection = projections.value.find(candidate => candidate.id === systemId)
    return projection ? anchorFor(projection) : null
  }
  const objectProjection = objectTarget
    ? projections.value.find(candidate => candidate.id === objectTarget.systemId)
    : undefined
  if (objectTarget && objectProjection) {
    const object = objectProjection.objects.find(candidate => candidate.id === objectTarget.objectId)
    const delta = anchorDelta(objectProjection)
    if (object) return { x: object.scenePosition.x + delta.x, y: object.scenePosition.y + delta.y }
  }
  const orbitProjection = orbitTarget
    ? projections.value.find(candidate => candidate.id === orbitTarget.systemId)
    : undefined
  if (orbitTarget && orbitProjection) {
    const orbit = orbitProjection.orbits.find(candidate => candidate.id === orbitTarget.orbitId)
    const delta = anchorDelta(orbitProjection)
    if (orbit) {
      if (forAdd) return continuousOrbitAddKeyboardPoint(orbit, delta)
      return { x: orbit.sceneCenter.x + delta.x, y: orbit.sceneCenter.y + delta.y }
    }
  }
  if (!(target instanceof SVGSVGElement) || target !== svgElement.value) return null
  const current = getViewport()
  return {
    x: (svgViewport.value.x + svgViewport.value.width / 2 - current.x) / current.k,
    y: (svgViewport.value.y + svgViewport.value.height / 2 - current.y) / current.k,
  }
}

function publishSystemPositionPreview(systemId: string, position: Point | null, expectedVersion?: number): number {
  const currentVersion = previewVersions.value.get(systemId) ?? 0
  if (position === null && expectedVersion !== undefined && expectedVersion !== currentVersion) return currentVersion
  const next = new Map(previewPositions.value)
  if (position) next.set(systemId, clampWardenClusterAnchor(position))
  else next.delete(systemId)
  previewPositions.value = next
  const nextVersion = nextContinuousMapPreviewVersion()
  previewVersions.value = new Map(previewVersions.value).set(systemId, nextVersion)
  return nextVersion
}

function setClusterSystemPositionPreview(systemId: string, position: Point | null, expectedVersion?: number): number {
  return publishSystemPositionPreview(systemId, position, expectedVersion)
}

function getClusterSystemPositionPreviewVersion(systemId: string): number {
  return previewVersions.value.get(systemId) ?? 0
}

function projectionWithObjectPlacement(
  systemId: string,
  objectId: string,
  targetPosition: Point,
): ContinuousWardenSystemProjection | null {
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  const object = projection?.objects.find(candidate => candidate.id === objectId)
  const legacyAnchor = props.systemPositions[systemId]
  if (!projection || !system || !object || !legacyAnchor) return null
  const delta = { x: targetPosition.x - object.position.x, y: targetPosition.y - object.position.y }
  const plan = planSelectedObjectTranslation(props.workspace, systemId, [objectId], delta)
  if (!plan) return null
  const previewWorkspace = applySelectedObjectTranslation(props.workspace, systemId, plan)
  const previewSystem = previewWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
  return previewSystem
    ? projectWardenSystem(previewSystem, legacyAnchor, systemMapGeometry(previewWorkspace), projection.scale)
    : null
}

function projectionWithObjectMoveTarget(
  systemId: string,
  objectId: string,
  target: SystemObjectMoveTarget,
): ContinuousWardenSystemProjection | null {
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const legacyAnchor = props.systemPositions[systemId]
  if (!projection || !legacyAnchor) return null
  const workspaceSnapshot = toRaw(props.workspace)
  const placement = target.kind === 'orbit'
    ? { kind: 'orbit' as const, orbitId: target.orbitId }
    : { kind: 'system' as const, x: target.point.x, y: target.point.y }
  const previewWorkspace = updateWorkspaceObject(
    workspaceSnapshot,
    systemId,
    objectId,
    { placement },
    target.kind === 'orbit' ? { angle: target.angle } : undefined,
  )
  const system = previewWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
  return system
    ? projectWardenSystem(system, legacyAnchor, systemMapGeometry(previewWorkspace), projection.scale)
    : null
}

function projectionWithOrbitAdjustment(
  projection: ContinuousWardenSystemProjection,
  adjustment: OrbitAdjustmentPreview,
): ContinuousWardenSystemProjection | null {
  const system = props.workspace.cluster.systems.find(candidate => candidate.id === adjustment.identity.systemId)
  const orbit = system?.orbits.find(candidate => candidate.id === adjustment.identity.orbitId)
  const legacyAnchor = props.systemPositions[adjustment.identity.systemId]
  if (!system || !orbit || !legacyAnchor) return null
  const previewOrbit: Orbit = orbit.hostId === null
    ? { ...orbit, center: { ...adjustment.geometry.center } }
    : { id: orbit.id, order: orbit.order, hostId: orbit.hostId }
  const previewSystem: StarSystem = {
    ...system,
    orbits: system.orbits.map(candidate => candidate.id === orbit.id ? previewOrbit : candidate),
  }
  const geometry = systemMapGeometry(props.workspace)
  geometry.orbitRadii = { ...geometry.orbitRadii, [orbit.id]: { ...adjustment.geometry.radii } }
  geometry.orbitRotations = { ...geometry.orbitRotations, [orbit.id]: adjustment.geometry.rotation }
  return projectWardenSystem(previewSystem, legacyAnchor, geometry, projection.scale)
}

function setObjectPlacementPreview(systemId: string, objectId: string, scenePoint: Point | null): void {
  if (!scenePoint) {
    if (preciseObjectPlacementPreview.value?.systemId === systemId
      && preciseObjectPlacementPreview.value.objectId === objectId) preciseObjectPlacementPreview.value = null
    return
  }
  const projection = projectionWithObjectPlacement(systemId, objectId, scenePoint)
  preciseObjectPlacementPreview.value = projection ? { systemId, objectId, projection } : null
  preciseOrbitCenterMovePreview.value = null
}

function setObjectMoveTargetPreview(systemId: string, objectId: string, target: SystemObjectMoveTarget | null): void {
  if (!target) {
    if (preciseObjectPlacementPreview.value?.systemId === systemId
      && preciseObjectPlacementPreview.value.objectId === objectId) preciseObjectPlacementPreview.value = null
    return
  }
  const projection = projectionWithObjectMoveTarget(systemId, objectId, target)
  preciseObjectPlacementPreview.value = projection ? { systemId, objectId, projection } : null
  preciseOrbitCenterMovePreview.value = null
}

function setOrbitCenterMovePreview(systemId: string, orbitId: string, scenePoint: Point | null): void {
  if (!scenePoint) {
    if (preciseOrbitCenterMovePreview.value?.systemId === systemId
      && preciseOrbitCenterMovePreview.value.orbitId === orbitId) preciseOrbitCenterMovePreview.value = null
    return
  }
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
  const legacyAnchor = props.systemPositions[systemId]
  if (!projection || !system || !orbit || orbit.hostId !== null || !legacyAnchor) return
  const center = toNormalizedMapPoint(scenePoint)
  const previewSystem = {
    ...system,
    orbits: system.orbits.map(candidate => candidate.id === orbitId && candidate.hostId === null
      ? { ...candidate, center }
      : candidate),
  }
  preciseOrbitCenterMovePreview.value = {
    systemId,
    orbitId,
    projection: projectWardenSystem(previewSystem, legacyAnchor, systemMapGeometry(props.workspace), projection.scale),
  }
  preciseObjectPlacementPreview.value = null
}

function setOrbitPlacementPreview(
  systemId: string,
  orbitId: string,
  preview: { center: Point; radii: { horizontal: number; vertical: number }; rotation?: number } | null,
): void {
  orbitPlacementPreview.value = preview ? { systemId, orbitId, preview } : null
}

function orbitPlacementPreviewFor(systemId: string) {
  return orbitPlacementPreview.value?.systemId === systemId ? orbitPlacementPreview.value.preview : null
}

function toSystemScenePoint(systemId: string, clusterPoint: Point): Point | null {
  const projection = projections.value.find(candidate => candidate.id === systemId)
  if (!projection || ![clusterPoint.x, clusterPoint.y].every(Number.isFinite)) return null
  const delta = anchorDelta(projection)
  return projection.unprojectLocalPoint({ x: clusterPoint.x - delta.x, y: clusterPoint.y - delta.y })
}

function getDetachedCenter(orbitId: string, systemId: string): Point | undefined {
  const system = props.cluster.systems.find(candidate => candidate.id === systemId)
  return system ? getDetachedOrbitCenter(system, orbitId, systemMapGeometry(props.workspace)) : undefined
}

function setUnresolvedExitPositionPreview(routeId: string, position: Point | null): void {
  const next = new Map(exitPositionOverrides.value)
  if (position) next.set(routeId, position)
  else next.delete(routeId)
  exitPositionOverrides.value = next
}

function exportImage(
  format: MapImageFormat,
  palette: MapImagePalette = 'active',
  options: MapImageExportOptions = {},
): Promise<Blob | null> {
  const element = svgElement.value
  if (!element) return Promise.reject(new Error('The continuous map is not ready to export.'))
  return exportContinuousWardenMapImage({
    source: element,
    cluster: props.cluster,
    layout: props.workspace.layout,
    projections: projections.value,
    unresolvedExitPositions: props.unresolvedExitPositions,
    dimmedObjectIds: props.appliedDimmedObjectIds ?? props.dimmedObjectIds,
    scope: options.scope ?? 'viewport',
    selectedSystemId: options.selectedSystemId,
    selectedRouteId: props.selectedRouteId,
    selectedRouteObjectId: props.inspectedTarget?.kind === 'route-object' ? props.inspectedTarget.objectId : undefined,
    format,
    palette,
    viewport: getViewport(),
    viewportRect: { ...svgViewport.value },
    svgPixelScale: svgPixelScale.value,
    detailSystemIds: new Set(detailSystemIds.value),
    isCurrent: options.isCurrent,
  })
}

function getImageContextKey(scope: MapImageScope | null = 'viewport'): string {
  return mapImageContextKey(scope, {
    clusterId: props.cluster.id,
    viewport: getViewport(),
    viewportRect: { ...svgViewport.value },
    svgPixelScale: svgPixelScale.value,
    detailSystemIds: [...detailSystemIds.value],
    dimmedObjectIds: [...(props.appliedDimmedObjectIds ?? dimmedObjectIds.value)],
    selectedRouteId: props.selectedRouteId,
    selectedRouteObjectId: props.inspectedTarget?.kind === 'route-object' ? props.inspectedTarget.objectId : undefined,
  })
}

function cancelActiveGesture(): void {
  routeDragGeneration += 1
  if (activeRouteObjectDrag) finishRouteObjectDrag(true)
  invalidateWheelAnchorTransform()
  cancelWheelZoom()
  viewPan = null
  if (activeOrbitGesture) finishOrbitGesture(true)
  if (activeSystemFrameResize) finishSystemFrameResize(true)
  if (activeSelectedObjectDrag) finishSelectedObjectDrag(true)
  if (activeObjectDrag) finishObjectDrag(true)
  if (activeAnchorDrag) finishAnchorDrag(true)
  if (activeExitDrag) finishExitDrag(true)
  touchCameraNavigation.cancel()
}

function onZoom(event: { transform: { x: number; y: number; k: number } }): void {
  viewport.value = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
  if (cameraInitialized) updateDetailReveal(event.transform.k)
  // Rendering and framing read the live camera. Bound parent updates during sustained input.
  viewportFeedbackTimer ??= setTimeout(publishViewportFeedback, VIEWPORT_FEEDBACK_INTERVAL_MS)
}

function publishViewportFeedback(): void {
  clearViewportFeedbackTimer()
  emit('viewport-change', getViewport())
}

function clearViewportFeedbackTimer(): void {
  if (viewportFeedbackTimer !== undefined) clearTimeout(viewportFeedbackTimer)
  viewportFeedbackTimer = undefined
}

function startTouchNavigation(event: TouchEvent): void {
  if (event.touches.length <= 1 && (activeExitDrag || activeOrbitGesture || activeSystemFrameResize
    || activeAnchorDrag || activeObjectDrag || activeSelectedObjectDrag || activeRouteObjectDrag)) {
    touchCameraNavigation.clearDoubleTap()
    return
  }
  if (activeExitDrag) finishExitDrag(true)
  if (activeOrbitGesture) finishOrbitGesture(true)
  if (activeSystemFrameResize) finishSystemFrameResize(true)
  if (activeAnchorDrag) finishAnchorDrag(true)
  if (activeObjectDrag) finishObjectDrag(true)
  if (activeSelectedObjectDrag) finishSelectedObjectDrag(true)
  if (activeRouteObjectDrag) finishRouteObjectDrag(true)
  touchCameraNavigation.start(event)
}

function moveTouchNavigation(event: TouchEvent): void {
  if (activeOrbitGesture || activeSystemFrameResize || activeAnchorDrag || activeExitDrag || activeObjectDrag || activeSelectedObjectDrag || activeRouteObjectDrag) return
  touchCameraNavigation.move(event)
}

function endTouchNavigation(event: TouchEvent): void {
  if (activeOrbitGesture || activeSystemFrameResize || activeAnchorDrag || activeExitDrag || activeObjectDrag || activeSelectedObjectDrag || activeRouteObjectDrag) return
  touchCameraNavigation.end(event)
}

const backgroundDoubleTapAvailable = computed(() => props.mode === 'move'
  && !props.creationType && !props.clusterAddType && !props.clusterChooserOpen
  && !props.moveTargeting && !props.clusterMoveTargeting && !props.standaloneImportPlacementEnabled
  && !props.systemObjectTransferPreview && !props.keyboardOwnedOverlayOpen)

const touchCameraNavigation = createMapTouchNavigation({
  surface: 'cluster',
  isEnabled: () => props.touchNavigation ?? true,
  moveEnabled: () => props.mode === 'move',
  canDoubleTap: target => backgroundDoubleTapAvailable.value && !suppressNextMapClick
    && target instanceof SVGElement && !target.closest('[role="button"], [role="slider"]'),
  getCamera: () => {
    const element = svgElement.value
    if (!element) return null
    return {
      isPinchReady: () => zoomBehavior !== undefined,
      getViewport,
      pointFromClient: touch => pointer(touch, element) as [number, number],
      minimumZoomScale: () => minimumZoomScale.value,
      applyViewport: next => setViewport(next, 'coalesced'),
      interrupt: () => select(element).interrupt(),
    }
  },
  onPinchTakeover: () => cancelActiveGesture(),
})

watch(backgroundDoubleTapAvailable, (available) => {
  if (!available) touchCameraNavigation.clearDoubleTap()
}, { flush: 'sync' })

onMounted(async () => {
  await nextTick()
  const element = svgElement.value
  if (!element) {
    resolveReady(false)
    return
  }
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => svgViewportExtent(svgViewport.value))
    .scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
    // The map owns wheel zoom and applies it through its pointer-anchored eased camera path.
    .filter(() => false)
    .on('zoom', onZoom)
  zoomBehavior.touchable(() => false)
  select(element).call(zoomBehavior)
  resizeObserver = new ResizeObserver(() => {
    const current = svgElement.value
    if (!current) return
    invalidateWheelAnchorTransform()
    const rect = getSvgViewportRect(current)
    zoomBehavior?.extent(() => svgViewportExtent(rect))
    updateMinimumZoomScale(rect)
    updateSvgPixelScale()
    updateSvgViewport()
    updateDetailReveal(viewport.value.k)
  })
  resizeObserver.observe(element)
  updateSvgPixelScale()
  updateSvgViewport()
  window.addEventListener('blur', cancelActiveGesture)
  window.addEventListener('scroll', invalidateWheelAnchorTransform, true)
  window.addEventListener('resize', invalidateWheelAnchorTransform)
  observedVisualViewport = window.visualViewport ?? undefined
  observedVisualViewport?.addEventListener('scroll', invalidateWheelAnchorTransform)
  observedVisualViewport?.addEventListener('resize', invalidateWheelAnchorTransform)
  if (props.initialViewport) setViewport(props.initialViewport)
  else fitMap()
  cameraInitialized = true
  updateDetailReveal(getViewport().k)
  ready.value = true
  resolveReady(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', cancelActiveGesture)
  window.removeEventListener('scroll', invalidateWheelAnchorTransform, true)
  window.removeEventListener('resize', invalidateWheelAnchorTransform)
  observedVisualViewport?.removeEventListener('scroll', invalidateWheelAnchorTransform)
  observedVisualViewport?.removeEventListener('resize', invalidateWheelAnchorTransform)
  observedVisualViewport = undefined
  wheelAnchorLastInputAt = Number.NEGATIVE_INFINITY
  invalidateWheelAnchorTransform()
  cancelWheelZoom()
  clearViewportFeedbackTimer()
  if (pendingMapClickTimer) clearTimeout(pendingMapClickTimer)
  pendingMapClickTimer = undefined
  pendingMapClickTarget = null
  clearOwnedGestureClickSuppression()
  resizeObserver?.disconnect()
  resizeObserver = undefined
  cancelActiveGesture()
  if (!ready.value) resolveReady(false)
})

watch(() => props.mode, () => {
  selectObjectDragGeneration += 1
  cancelActiveGesture()
}, { flush: 'sync' })
watch(() => props.workspace, workspace => {
  showAcceptedElasticFrameGrowth(workspace)
  transferPreviewOverride.value = undefined
  if (activeSystemFrameResize && toRaw(activeSystemFrameResize.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
  if (activeExitDrag && toRaw(activeExitDrag.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
  if (activeSelectedObjectDrag && toRaw(activeSelectedObjectDrag.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
  if (activeObjectDrag && toRaw(activeObjectDrag.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
  if (activeRouteObjectDrag && toRaw(activeRouteObjectDrag.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
  if (activeOrbitGesture && toRaw(activeOrbitGesture.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
}, { flush: 'sync' })
watch(() => props.systemObjectTransferPreview, () => {
  transferPreviewOverride.value = undefined
}, { flush: 'sync' })
watch(() => props.cluster.systems.map(system => system.id).join('\u0000'), ids => {
  if (activeSystemFrameResize && !ids.split('\u0000').includes(activeSystemFrameResize.systemId)) cancelActiveGesture()
  if (activeSelectedObjectDrag && !ids.split('\u0000').includes(activeSelectedObjectDrag.systemId)) cancelActiveGesture()
  if (activeObjectDrag && !ids.split('\u0000').includes(activeObjectDrag.systemId)) cancelActiveGesture()
  if (activeOrbitGesture && !ids.split('\u0000').includes(activeOrbitGesture.systemId)) cancelActiveGesture()
  if (activeAnchorDrag && !ids.split('\u0000').includes(activeAnchorDrag.systemId)) cancelActiveGesture()
})
watch(presentationProjections, () => updateDetailReveal(viewport.value.k))
watch(() => props.inspectedTarget, () => {
  if ((activeAnchorDrag && !isSelectedSystem(activeAnchorDrag.systemId))
    || (activeSystemFrameResize && !canResizeSystemFrame(activeSystemFrameResize.systemId))
    || (activeOrbitGesture && !canEditOrbit(activeOrbitGesture.systemId, activeOrbitGesture.orbitId))
    || (activeRouteObjectDrag && !hasRouteObjectDragContext(activeRouteObjectDrag))) {
    cancelActiveGesture()
  }
}, { flush: 'sync' })
watch(() => props.selectedRouteId, (routeId) => {
  if (props.mode === 'select' && activeExitDrag && activeExitDrag.routeId !== routeId) cancelActiveGesture()
}, { flush: 'sync' })
watch(() => props.selectedObjectIds.join('\u0000'), (ids, previousIds) => {
  if (ids === previousIds) return
  selectObjectDragGeneration += 1
  if (activeSelectedObjectDrag || activeObjectDrag?.selectDrag) cancelActiveGesture()
})
watch(projections, () => {
  const existingIds = new Set(projections.value.map(projection => projection.id))
  previewPositions.value = new Map([...previewPositions.value].filter(([id]) => existingIds.has(id)))
  if (preciseObjectPlacementPreview.value && !existingIds.has(preciseObjectPlacementPreview.value.systemId)) {
    preciseObjectPlacementPreview.value = null
  }
  if (preciseOrbitCenterMovePreview.value && !existingIds.has(preciseOrbitCenterMovePreview.value.systemId)) {
    preciseOrbitCenterMovePreview.value = null
  }
  if (directOrbitPreview.value && !existingIds.has(directOrbitPreview.value.systemId)) directOrbitPreview.value = null
  if (orbitPlacementPreview.value && !existingIds.has(orbitPlacementPreview.value.systemId)) {
    orbitPlacementPreview.value = null
  }
}, { flush: 'sync' })

defineExpose({
  exportImage,
  getImageContextKey,
  getRenderedSystemProjections,
  getObjectIdsWithinClientRect,
  getMinimumZoomScale: () => minimumZoomScale.value,
  getViewport,
  setViewport,
  zoomBy,
  panBy,
  fitMap,
  frameStandaloneImportPlacement,
  frameSystem,
  frameSearchTarget,
  centerInspectedTarget,
  prepareSearchLocator,
  dismissSearchLocator,
  revealHistoryTarget,
  revealHistoryCluster,
  focusMap,
  cancelActiveGesture,
  ownsPointerClick: () => suppressNextMapClick || pendingMapClickTarget !== null,
  canDragRouteObject,
  hasSelectedOrbitOrExitMoveTarget: (event: PointerEvent) => selectedOrbitOrExitMoveTarget(event) !== null,
  startViewPan,
  moveViewPan,
  endViewPan,
  startTouchNavigation,
  orbitDragPointFromClient,
  getOrbitDragStart,
  getOrbitDragSceneClearance,
  isClientPointOnMap,
  isOrbitDragPointOnMap: isClientPointOnMap,
  startOrbitTouchPinch: touchCameraNavigation.startPinch,
  moveOrbitTouchPinch: touchCameraNavigation.movePinch,
  endOrbitTouchPinch: touchCameraNavigation.endPinch,
  moveTouchNavigation,
  endTouchNavigation,
  setClusterSystemPositionPreview,
  getClusterSystemPositionPreviewVersion,
  setObjectPlacementPreview,
  setObjectMoveTargetPreview,
  setOrbitCenterMovePreview,
  setOrbitPlacementPreview,
  isSystemTransferDestination,
  systemTransferPointAtClient,
  systemTransferPlacementAtClient,
  frameSystemTransferDestination,
  setSystemObjectTransferPreview,
  toSystemScenePoint,
  getDetachedCenter,
  setUnresolvedExitPositionPreview,
  whenReady: () => readiness,
})
</script>

<style scoped>
.continuous-warden-map-svg {
  touch-action: none;
  overscroll-behavior: contain;
  background: var(--map-bg);
}

.continuous-warden-system-envelope {
  fill: var(--warden-halo-fill);
  stroke: color-mix(in srgb, var(--map-orbit) 58%, transparent);
  stroke-width: 1.25;
  stroke-dasharray: 2 5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-system-envelope.is-detailed {
  stroke: color-mix(in srgb, var(--map-orbit) 72%, transparent);
}

.continuous-warden-system-envelope.is-move-preview {
  stroke: color-mix(in srgb, var(--map-orbit) 78%, transparent);
  stroke-width: 1.75;
}

.continuous-warden-system-envelope.is-elastic-replaced {
  opacity: 0;
}

.continuous-warden-system-envelope.is-frame-growth-arrival {
  opacity: 0;
  animation: warden-frame-growth-arrival 260ms ease-out both;
}

.continuous-warden-elastic-envelope {
  fill: var(--warden-halo-fill);
  stroke: color-mix(in srgb, var(--map-orbit) 76%, transparent);
  stroke-width: 1.5;
  stroke-dasharray: 2 5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-frame-growth-animation,
.continuous-warden-frame-growth-stretch,
.continuous-warden-frame-growth-tween {
  pointer-events: none;
}

.continuous-warden-frame-growth-stretch {
  fill: var(--warden-halo-fill);
  stroke: color-mix(in srgb, var(--map-orbit) 76%, transparent);
  stroke-width: 1.5;
  stroke-dasharray: 2 5;
  vector-effect: non-scaling-stroke;
  opacity: 0.72;
  animation: warden-frame-growth-stretch-fade 180ms ease-out both;
}

.continuous-warden-frame-growth-tween {
  fill: none;
  stroke: color-mix(in srgb, var(--map-orbit) 76%, transparent);
  stroke-width: 1.5;
  stroke-dasharray: 2 5;
  vector-effect: non-scaling-stroke;
}

@keyframes warden-frame-growth-arrival {
  to { opacity: 1; }
}

@keyframes warden-frame-growth-stretch-fade {
  to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .continuous-warden-system-envelope.is-frame-growth-arrival {
    animation: none;
    opacity: 1;
  }

  .continuous-warden-frame-growth-animation {
    display: none;
  }
}

.continuous-warden-system-resize-target {
  overflow: visible;
  pointer-events: all;
}

.continuous-warden-system-resize-button {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--map-orbit);
  cursor: nwse-resize;
  touch-action: none;
}

.continuous-warden-system-resize-button span {
  width: 9px;
  height: 9px;
  border: 1px solid currentColor;
  border-radius: 1px;
  background: color-mix(in srgb, var(--map-bg) 86%, transparent);
  box-shadow: 0 0 3px color-mix(in srgb, var(--map-orbit) 36%, transparent);
  transform: rotate(45deg);
}

.continuous-warden-system-resize-button:focus-visible span {
  outline: 2px solid var(--map-orbit);
  outline-offset: 2px;
}

.continuous-warden-system-resize-button[data-system-resize-handle="top-right"],
.continuous-warden-system-resize-button[data-system-resize-handle="bottom-left"] {
  cursor: nesw-resize;
}

.continuous-warden-import-placement-preview {
  opacity: 0.72;
  pointer-events: none;
}

.continuous-warden-transfer-preview {
  opacity: 0.72;
  pointer-events: none;
}

.continuous-warden-transfer-orbit {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 4 5;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-transfer-object {
  fill: var(--focus);
  font-family: Georgia, serif;
  font-size: 11px;
  pointer-events: none;
}

.continuous-warden-transfer-object-mark {
  fill: color-mix(in srgb, var(--focus) 18%, var(--map-bg));
  stroke: var(--focus);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-transfer-object.is-root .continuous-warden-transfer-object-mark {
  stroke-width: 3;
}

.continuous-warden-import-envelope {
  fill: color-mix(in srgb, var(--focus) 7%, transparent);
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 9 6;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-import-orbit {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 4 5;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-import-object {
  fill: var(--focus);
  font-family: Georgia, serif;
  font-size: 11px;
  pointer-events: none;
}

.continuous-warden-import-object circle {
  fill: var(--map-bg);
  stroke: var(--focus);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-import-anchor {
  fill: color-mix(in srgb, var(--focus) 18%, var(--map-bg));
  stroke: var(--focus);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-import-anchor-core {
  fill: var(--focus);
}

.continuous-warden-system-detail {
  pointer-events: none;
}
.continuous-warden-system-detail.is-exiting,
.continuous-warden-system-detail.is-exiting :deep(*),
.continuous-warden-system-detail.is-entering,
.continuous-warden-system-detail.is-entering :deep(*) { pointer-events: none !important; }

.continuous-warden-orbit-edit-handle {
  pointer-events: all;
  vector-effect: non-scaling-stroke;
  stroke: var(--map-selected);
  stroke-width: 1.5;
  cursor: grab;
}

.continuous-warden-orbit-axis-handle,
.continuous-warden-orbit-rotation-handle {
  fill: var(--map-bg);
}

.continuous-warden-orbit-center-handle {
  fill: var(--map-selected);
  stroke: var(--map-bg);
  stroke-width: 2;
}

.continuous-warden-orbit-edit-handle:active {
  cursor: grabbing;
}

.continuous-warden-system-detail .orbit-ring {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: 2;
  stroke-dasharray: 3 6;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object {
  fill: var(--map-text);
  cursor: pointer;
  pointer-events: all;
}

.system-object-selection-indicator {
  display: inline;
  pointer-events: none;
}

.system-object-selection-outline,
.system-object-selection-dashes {
  fill: none;
  stroke: var(--map-selected);
  stroke-width: var(--warden-detail-selection-stroke-width, 1.35px);
}

.system-object-selection-outline {
  opacity: 0.92;
}

.system-object-selection-dashes {
  opacity: 0.68;
  stroke-linecap: round;
  animation:
    system-object-selection-breathe 2.8s ease-in-out infinite,
    system-object-selection-rotate 5.5s linear infinite;
}

@keyframes system-object-selection-breathe {
  0%,
  100% {
    opacity: 0.68;
  }

  50% {
    opacity: 0.95;
  }
}

@keyframes system-object-selection-rotate {
  to {
    stroke-dashoffset: -100;
  }
}

@media (prefers-reduced-motion: reduce) {
  .system-object-selection-dashes {
    animation: none;
  }
}

.orbit-creation-preview-ring {
  fill: none;
  stroke: var(--map-selected);
  stroke-width: var(--warden-orbit-preview-stroke-width, 2.5px);
  stroke-dasharray: var(--warden-orbit-preview-dasharray, 6 4);
  pointer-events: none;
}

.continuous-warden-object.is-dimmed .continuous-warden-star-halo,
.continuous-warden-object.is-dimmed .continuous-warden-object-glyph,
.continuous-warden-object.is-dimmed .continuous-warden-object-key,
.continuous-warden-object.is-dimmed .continuous-warden-object-name {
  opacity: 0.14;
}

.continuous-warden-object-hit-target {
  fill: transparent;
  pointer-events: all;
}

.continuous-warden-object-marker-outline {
  fill: none;
  stroke: transparent;
  pointer-events: none;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object.is-selected .continuous-warden-object-marker-outline,
.continuous-warden-object:focus .continuous-warden-object-marker-outline {
  stroke: var(--map-selected);
}

.continuous-warden-object.is-move-preview {
  cursor: grabbing;
}

.continuous-warden-object.is-move-preview .continuous-warden-object-marker-outline {
  stroke: var(--focus);
  stroke-dasharray: 3 3;
}

.continuous-warden-object.is-group-arriving .continuous-warden-object-marker-outline {
  stroke: var(--feedback-success, #16814a);
}

.continuous-warden-object.is-group-departing .continuous-warden-object-marker-outline {
  stroke: var(--map-unresolved);
}

.continuous-warden-search-locator {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 2 3;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-star-halo {
  fill: none;
  stroke: var(--map-star-halo);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object-glyph {
  font: calc(20px * var(--map-object-text-scale, 1)) Consolas, monospace;
}
.continuous-warden-object-glyph:not([fill]) { fill: var(--map-text); }

.continuous-warden-object-key {
  fill: var(--map-unresolved);
  font: calc(9px * var(--map-object-text-scale, 1)) Consolas, monospace;
}

.continuous-warden-object-name {
  fill: var(--map-text);
  font: calc(12px * var(--map-object-text-scale, 1)) Georgia, serif;
}
.continuous-warden-object-text { pointer-events: none; }

.continuous-warden-name-target {
  cursor: pointer;
}

.continuous-warden-name-target.is-draggable {
  cursor: grab;
}

.continuous-warden-name-target.is-move-preview .continuous-warden-name-background {
  stroke: var(--focus);
  stroke-width: 2;
}

.continuous-warden-name-leader {
  fill: none;
  stroke: color-mix(in srgb, var(--map-selected) 72%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-name-background {
  fill: color-mix(in srgb, var(--map-bg) 96%, transparent);
  stroke: color-mix(in srgb, var(--line-soft) 82%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-system-name {
  fill: var(--map-text);
  font-family: Georgia, serif;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--map-bg);
  stroke-width: 1;
  pointer-events: none;
}

.continuous-warden-name-target:hover .continuous-warden-name-background,
.continuous-warden-name-target:focus .continuous-warden-name-background,
.continuous-warden-name-target.is-selected .continuous-warden-name-background {
  stroke: var(--map-selected);
  stroke-width: 2;
}
</style>
