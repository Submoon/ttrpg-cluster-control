<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <WorkspaceHeader v-if="!workspace" :workspace="workspace" />

    <main id="workspace-main" tabindex="-1" class="main-content mx-auto flex w-full max-w-[1720px] flex-1 flex-col self-center pb-8 pt-[clamp(1rem,2.1vw,1.75rem)]">
      <p v-if="orbitAdjustmentNotice" class="feedback m-0" role="status" aria-live="polite">{{ orbitAdjustmentNotice }}</p>
      <p v-if="importError" class="feedback m-0 error-text" role="alert">{{ importError }}</p>
      <WorkspaceWelcome
        v-if="!workspace"
        v-model:cluster-name="clusterName"
        v-model:system-name="systemName"
        :hydration-state="hydrationState"
        :load-error="loadError"
        :recovery-error="recoveryError"
        :save-state="saveState"
        :save-error="saveError"
        :form-error="formError"
        @retry="hydrate"
        @restore-backup="restoreBackup"
        @submit="submitNames"
      />
      <section v-else-if="workspace" class="editor">
          <MapEditorLayout
          :mode="activeView"
          :hierarchy-label="activeView === 'cluster' ? 'Jump Cluster contents' : 'System hierarchy'"
          :inspector-label="activeView === 'cluster' ? 'Jump Route inspector' : 'Object inspector'"
          :hierarchy-visible="hierarchyPanelVisible"
          :inspector-visible="inspectorPanelVisible"
          :entity-inspector-active="activeView === 'system' && Boolean(selectedObject || selectedOrbit)"
          :route-session-active="activeView === 'cluster' && routeSession !== null"
          :compact-modal-open="compactPanelOpen"
          :compact-panel="compactPanel"
          :overlay-open="chartNamesDialogOpen || fieldDefinitionDialogOpen || headerFilesOpen || recoveryDetailsOpen || historyCapacityRequest !== null || historyOpen || searchOpen"
          :is-compact-viewport="isCompactViewport"
          @close-panel="closePanel"
        >
          <template #compact-recovery>
            <section class="workspace-compact-recovery-content" aria-label="Workspace save and recovery">
              <div
                v-if="routeSession && activeView === 'cluster' && compactPanel === 'hierarchy'"
                class="route-draft-resume flex min-w-0 items-center justify-between gap-2 border-b border-[var(--line-soft)] px-3 py-2 text-xs"
                role="status"
                aria-live="polite"
              >
                <span class="min-w-0">Jump Route draft is still available.</span>
                <UButton color="primary" variant="soft" size="xs" @click="requestPanel('inspector')">Resume Jump Route</UButton>
              </div>
              <WorkspaceFeedback
                :active="true"
                :has-chart-name-draft="hasChartNameDraft"
                :has-uncommitted-names="hasUncommittedNames"
                :save-state="saveState"
                :save-message="saveMessage"
                :save-error="saveError"
                :export-error="exportError"
                @resume-chart-draft="beginChartNamesEdit()"
                @retry-save="retryLatestSave"
                @export-current-json="downloadClusterJson"
                @recovery-details-open-change="recoveryDetailsOpen = $event"
              />
            </section>
          </template>
          <template #inspector-header-actions>
            <UButton
              class="workspace-control chart-details-control"
              color="neutral"
              :variant="!selectedObject && !selectedOrbit ? 'soft' : 'outline'"
              size="sm"
              icon="i-lucide-info"
              aria-label="Chart details"
              :aria-pressed="!selectedObject && !selectedOrbit"
              @click="showChartDetails()"
            >
              Chart details
            </UButton>
          </template>
          <template #header>
            <WorkspaceHeader
              :workspace="workspace"
              :active-view="activeView"
              :selected-system="selectedSystem"
              :compact-modal-open="compactPanelOpen"
            >
              <template #field-definitions>
                <FieldDefinitionsDialog
                  ref="fieldDefinitionsDialog"
                  v-if="workspace"
                  :session="fieldDefinitionsSession"
                  :workspace="workspace"
                  :saving="saveState === 'saving'"
                  :save-error="fieldDefinitionError"
                  :inspector-conflict="fieldDefinitionInspectorConflict"
                  :inspector-conflict-error="'Resolve the Inspector draft before changing this field.'"
                  :has-modified-draft="hasModifiedFieldDefinitionsSession"
                  @intent="handleFieldDefinitionsIntent"
                />
              </template>
            </WorkspaceHeader>
          </template>

          <template #map-chrome>
            <WorkspaceMapChrome
              ref="workspaceMapChrome"
              :workspace="workspace"
              :active-view="activeView"
              :selected-system="selectedSystem"
              :cluster-map="clusterMapRef"
              :system-map="systemMapRef"
              :export-error="exportError"
              :hierarchy-open="hierarchyPanelVisible"
              :inspector-open="inspectorPanelVisible"
              :compact-modal-open="compactPanelOpen"
              :creation-session="activeView === 'system' ? creationSession : null"
              :creation-type-label="creationTypeLabel"
              :cluster-add-presentation="clusterAddPresentation"
              :cluster-move-presentation="clusterMovePresentation"
              :can-open-search-shortcut="canOpenSearchShortcut"
              v-model:search-open="searchOpen"
              v-model:search-query="searchQuery"
              :search-results="searchResults"
              :reveal-search-target="revealSearchTarget"
              @export-cluster-json="downloadClusterJson"
              @export-system-json="downloadSystemJson"
              @export-map-image="downloadMapImage"
              @import-file="importJsonFile"
              @show-cluster="showClusterMap"
              @toggle-hierarchy="togglePanel('hierarchy')"
              @toggle-inspector="togglePanel('inspector')"
              @files-open-change="headerFilesOpen = $event"
              @quit-add="quitSystemAdd"
              @confirm-system-move="confirmSystemMove"
              @cancel-system-move="cancelSystemMovePreview"
            >
              <template #history>
                <WorkspaceHistoryControls
                  v-model:open="historyOpen"
                  :status="historyStatus"
                  :entries="historyEntries"
                  :error="historyTraversalError"
                  @undo="undoWorkspace"
                  @redo="redoWorkspace"
                />
              </template>
            </WorkspaceMapChrome>
          </template>

          <template #dock>
            <WorkspaceDock
              ref="workspaceDockRef"
              v-model:add-open="creationChooserOpen"
              :creation-session="activeView === 'system' ? creationSession : null"
              :creation-type-label="creationTypeLabel"
              :cluster-add-label="clusterAddPresentation?.label ?? null"
              :cluster-move-targeting="clusterMoveTargeting && clusterAddType === null"
              :system-object-move-available="systemObjectMoveAvailable"
              :system-object-move-destination="systemObjectMoveDestination"
              :system-object-move-destination-options="systemObjectMoveDestinationOptions"
              :system-object-move-candidates="systemObjectMoveCandidates"
              :system-object-move-candidate-request="systemObjectMoveCandidateRequest"
              :system-object-move-preview="systemObjectMovePreview"
              :system-object-move-error="systemObjectMoveError"
              :unresolved-exit-available="unresolvedExitAvailable"
              :unresolved-exit-preview="unresolvedExitPreview"
              :unresolved-exit-error="unresolvedExitError"
              :orbit-center-move-available="orbitCenterMoveAvailable"
              :orbit-center-map-move-targeting="orbitCenterMapMoveTargeting"
              :orbit-center-move-preview="orbitCenterMovePreview"
              :orbit-center-move-error="orbitCenterMoveError"
              :selected-system="selectedSystem"
              @update-creation-input="updateCreationInput"
              @add-from-inputs="addCreationFromInputs"
              @choose-creation-candidate="chooseCreationCandidate"
              @begin-cluster-system-map-move="beginClusterSystemMapMove"
              @update-system-object-move-destination="updateSystemObjectMoveDestination"
              @choose-system-object-move-candidate="chooseObjectMoveCandidate"
              @confirm-system-object-move="confirmSystemObjectMove"
              @cancel-system-object-move="cancelSystemObjectMovePreview"
              @begin-system-object-map-move="beginSystemObjectMapMove"
              @begin-unresolved-exit-move="beginUnresolvedExitMove"
              @confirm-unresolved-exit-move="confirmUnresolvedExitMove"
              @cancel-unresolved-exit-move="cancelUnresolvedExitMove"
              @begin-orbit-center-move="beginOrbitCenterMapMove"
              @confirm-orbit-center-move="confirmOrbitCenterMove"
              @cancel-orbit-center-move="cancelOrbitCenterMove"
              @keyboard-add-escape="restoreMapFocusAfterKeyboardAdd"
            >
              <template #add="{ close }">
                <template v-if="activeView === 'cluster'">
                  <button class="workspace-control tool-button" type="button" aria-label="Add star system" @click="armSystemAddAndClose(close)">
                    Add star system
                  </button>
                  <button class="workspace-control tool-button" type="button" aria-label="Add Jump Route" @click="beginRoute(); close()">
                    Add Jump Route
                  </button>
                </template>
                <ObjectPalette
                  v-else
                  v-model:active-family="objectPaletteActiveFamily"
                  :selected-orbit="selectedOrbit"
                  :saving="saveState === 'saving'"
                  @add-object="chooseObjectCreationType"
                  @add-orbit="chooseOrbitCreationType"
                />
              </template>
            </WorkspaceDock>
          </template>

          <template #zoom>
            <WorkspaceZoomControls
              :zoom-level="zoomLevel"
              :minimum-zoom-level="minimumZoomLevel"
              :compact-modal-open="compactPanelOpen"
              @zoom-by="zoomActiveMap"
              @zoom-to="setViewportPercentage"
              @fit-map="fitActiveMap"
              @pan-by="panActiveMap"
            />
          </template>

          <template #hierarchy>
            <MapHierarchy
              :workspace="workspace"
              :has-chart-name-draft="hasChartNameDraft"
              :saving="saveState === 'saving'"
            />
          </template>

          <template #map>
            <section
              class="panel map-panel flex min-w-0 flex-col p-[0.7rem]"
              :aria-label="activeView === 'cluster' ? 'Jump Cluster map workspace' : 'System map workspace'"
            >
              <div
                class="map-frame workspace-canvas flex min-h-0 min-w-0 overflow-hidden bg-[var(--map-bg)]"
                :class="{ 'system-map-canvas': activeView === 'system' }"
              >
                <ClientOnly>
                  <WorkspaceMapCanvas
                    v-if="activeView === 'cluster'"
                    :key="activeMapKey ?? 'cluster-map'"
                    ref="clusterMapRef"
                    @editing-gesture-change="mapControls.setEditingGestureActive"
                    :active-view="activeView"
                    :map-key="activeMapKey ?? ''"
                    :initial-viewport="initialViewport"
                    :workspace="workspace"
                    :system="selectedSystem"
                    :selected-system-id="clusterSelectedSystemId"
                    :selected-object-id="selectedObjectId"
                    :selected-orbit-id="selectedOrbitId"
                    :selected-route-id="selectedRouteId"
                    :mode="mapMode"
                    :creation-type="null"
                    :creation-preview="null"
                    :creation-chooser-open="creationChooserOpen"
                    :cluster-add-type="clusterAddType"
                    :cluster-move-targeting="clusterSystemMapMoveTargeting && clusterAddType === null"
                    :move-targeting="mapMoveTargeting"
                    :cluster-chooser-open="creationChooserOpen"
                    :feedback-element="workspaceFeedbackRef"
                    @navigate-system="selectSystem"
                    @select-cluster-system="selectClusterSystem"
                    @move-select-cluster-system="selectClusterSystem($event, false)"
                    @select-route="selectRoute"
                    @move-select-route="selectRoute($event, false)"
                    @select-object="selectObject"
                    @move-select-object="selectObject($event, false)"
                    @select-orbit="selectOrbit"
                    @move-select-orbit="selectOrbit($event, false)"
                    @move-system="handleClusterSystemMove"
                    @move-unresolved-exit="moveUnresolvedExit"
                    @move-target="handleMapMoveTarget"
                    @move-nudge="handleMapMoveNudge"
                    @cancel-map-move="cancelMapMove"
                    @cluster-target="handleClusterTarget"
                    @cancel-cluster-preview="cancelClusterPlacement"
                    @move-object="moveMapObject"
                    @move-orbit-center="moveMapOrbitCenter"
                    @orbit-center-candidates="placement.interactions.handleOrbitCenterCandidates"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @viewport-change="recordViewport($event.key, $event.viewport)"
                  />
                  <WorkspaceMapCanvas
                    v-else-if="selectedSystem"
                    :key="activeMapKey ?? 'system-map'"
                    ref="systemMapRef"
                    @editing-gesture-change="mapControls.setEditingGestureActive"
                    :active-view="activeView"
                    :map-key="activeMapKey ?? ''"
                    :initial-viewport="initialViewport"
                    :workspace="workspace"
                    :system="selectedSystem"
                    :selected-system-id="clusterSelectedSystemId"
                    :selected-object-id="selectedObjectId"
                    :selected-orbit-id="selectedOrbitId"
                    :selected-route-id="selectedRouteId"
                    :mode="mapMode"
                    :creation-type="creationSession?.type ?? null"
                    :creation-preview="creationSession?.preview ?? null"
                    :creation-chooser-open="creationChooserOpen"
                    :feedback-element="workspaceFeedbackRef"
                    :is-object-move-blocked="isObjectMoveBlocked"
                    :move-targeting="mapMoveTargeting"
                    :is-entity-command-blocked="isEntityCommandBlocked"
                    :orbit-adjustment-preview="orbitAdjustmentPreview"
                    @navigate-system="selectSystem"
                    @select-cluster-system="selectClusterSystem"
                    @move-select-cluster-system="selectClusterSystem($event, false)"
                    @select-route="selectRoute"
                    @move-select-route="selectRoute($event, false)"
                    @select-object="selectObject"
                    @move-select-object="selectObject($event, false)"
                    @select-orbit="selectOrbit"
                    @move-select-orbit="selectOrbit($event, false)"
                    @move-object="moveMapObject"
                    @move-target="handleMapMoveTarget"
                    @move-nudge="handleMapMoveNudge"
                    @cancel-map-move="cancelMapMove"
                    @object-move-candidates="placement.interactions.handleObjectMoveCandidates"
                    @object-move-blocked="handleBlockedObjectMove"
                    @entity-command-blocked="handleBlockedEntityCommand"
                    @move-orbit-center="moveMapOrbitCenter"
                    @orbit-center-candidates="placement.interactions.handleOrbitCenterCandidates"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @orbit-adjustment="updateOrbitAdjustment"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @creation-target="offerCreationCandidates"
                    @creation-drop-target="handleCreationDrop"
                    @cancel-creation-preview="cancelCreationPreview"
                    @cancel-object-placement-preview="cancelSystemObjectMovePreview"
                    @cancel-orbit-placement-preview="cancelOrbitPlacementPreview"
                    @viewport-change="recordViewport($event.key, $event.viewport)"
                  />
                  <template #fallback>
                    <div class="map-fallback grid min-h-[31rem] w-full place-items-center max-[760px]:min-h-96" role="status">
                      {{ activeView === 'cluster' ? 'Preparing the Jump Cluster chart...' : 'Preparing the orbital chart...' }}
                    </div>
                  </template>
                </ClientOnly>
              </div>
              <p v-if="activeView === 'cluster'" class="map-note mb-[1em] flex justify-between gap-3 px-[0.2rem] pt-[0.55rem] pb-[0.1rem] max-[760px]:flex-col">
                <span>{{ clusterAddType === 'system' ? 'ADD SYSTEM / OPEN CLUSTER SPACE' : clusterAddType === 'route' ? 'ADD JUMP ROUTE / CHOOSE LOGICAL ENDPOINTS' : clusterMoveTargeting ? 'MOVE SYSTEM / CHOOSE A DESTINATION' : 'KNOWN SYSTEMS / ROUTES / EXTERNAL EXITS' }}</span>
                <span>{{ clusterAddType === 'system' ? 'Choose clear Cluster space, or pan with the arrow keys and press Enter.' : clusterAddType === 'route' ? 'Choose a system, then a logical Jump Point for each endpoint.' : clusterMoveTargeting ? 'Choose Move selected system on map, then click or use the arrow keys to preview.' : 'Select a system or route to inspect it; use Navigate to enter a system.' }}</span>
              </p>
              <p v-else class="map-note mb-[1em] px-[0.2rem] pt-[0.55rem] pb-[0.1rem]">
                Select a mark or Orbit to inspect it.
              </p>
            </section>
          </template>

          <template #feedback>
            <section
              v-if="workspace"
              ref="workspaceFeedbackRef"
              :inert="compactPanelOpen || undefined"
              class="workspace-feedback"
              role="region"
              aria-label="Workspace feedback and recovery"
              data-map-obstruction
            >
              <WorkspaceFeedback
                :active="!compactPanelOpen"
                :has-chart-name-draft="hasChartNameDraft"
                :has-uncommitted-names="hasUncommittedNames"
                :save-state="saveState"
                :save-message="saveMessage"
                :save-error="saveError"
                :export-error="exportError"
                @resume-chart-draft="beginChartNamesEdit()"
                @retry-save="retryLatestSave"
                @export-current-json="downloadClusterJson"
                @recovery-details-open-change="recoveryDetailsOpen = $event"
              />
              <div
                v-if="routeSession && activeView === 'cluster' && !inspectorPanelVisible && !compactPanelOpen"
                class="route-draft-resume flex min-w-0 items-center justify-between gap-2 border-b border-[var(--line-soft)] px-3 py-2 text-xs"
                role="status"
                aria-live="polite"
              >
                <span class="min-w-0">Jump Route draft is still available.</span>
                <UButton color="primary" variant="soft" size="xs" @click="requestPanel('inspector')">Resume Jump Route</UButton>
              </div>
            </section>
          </template>

          <template #inspector>
            <MapInspector
              :mode="activeView"
              :workspace="workspace"
              :selected-system="selectedSystem"
              :inspected-cluster-system="inspectedClusterSystem"
              :selected-object="selectedObject"
              :object-focus-request="objectInspectorFocusRequest"
              :inspector-visible="inspectorPanelVisible"
              :selected-orbit="selectedOrbit"
              :selected-route="selectedRoute"
              :route-session="routeSession"
              :selected-route-summary="selectedRoute ? routeEndpointSummary(selectedRoute) : ''"
              :has-chart-name-draft="hasChartNameDraft"
              :has-uncommitted-names="hasUncommittedNames"
              :entity-session="entitySession"
              :has-modified-entity-session="hasModifiedEntitySession"
              :has-orbit-placement-preview="Boolean(orbitPlacementPreview && entitySession?.kind === 'orbit' && orbitPlacementPreview.sessionId === entitySession.id && orbitPlacementPreview.orbitId === selectedOrbit?.id)"
              :saving="saveState === 'saving'"
              :editor-error="editorError"
              :save-state="saveState"
              :save-message="saveMessage"
              :save-error="saveError"
              :export-error="exportError"
              @edit-chart-names="beginChartNamesEdit"
              @open-system="selectSystem"
              @delete-system="deleteSystem"
              @show-chart-details="showChartDetails"
              @hide="closePanel('inspector')"
              @request-object-edit="beginObjectEdit"
              @object-focus-request-consumed="acknowledgeObjectInspectorFocusRequest"
              @resume-entity-session="resumeEntitySession"
              @apply-entity-session="applyEntitySession"
              @discard-entity-session="discardEntitySession"
              @update-object-placement="updateObjectPlacement"
              @delete-object="deleteSelectedObject"
              @request-orbit-edit="beginOrbitEdit"
              @update-orbit-host="updateOrbitHost"
              @preview-orbit-placement="previewOrbitPlacement"
              @detach-orbit="detachSelectedOrbit"
              @delete-orbit="deleteSelectedOrbit"
              @request-route-edit="beginRouteEdit"
              @update-route-input="updateRouteInput"
              @choose-route-point="chooseRoutePoint"
              @apply-route-session="applyRouteSession"
              @discard-route-session="discardRouteDraft"
              @delete-route="deleteSelectedRoute"
              @clear-error="editorError = ''"
              @resume-chart-draft="beginChartNamesEdit()"
              @retry-save="retryLatestSave"
              @export-current-json="downloadClusterJson"
              @open-field-definitions="openFieldDefinitions"
            />
          </template>
        </MapEditorLayout>
      </section>
    </main>

    <WorkspaceDeletionReview
      v-if="workspace"
      :review="deletionReview"
      @cancel="cancelDeletionReview"
      @confirm="confirmDeletionReview"
    />

    <WorkspaceImportReview
      v-if="workspace"
      :open="importReview.open"
      :suspended="importReview.suspended"
      :summary="importReview.summary"
      :confirming="importReview.confirming"
      :error="importReview.error"
      :field-conflict="importReview.fieldConflict"
      @cancel="cancelJsonImport"
      @confirm="confirmJsonImport"
      @review-fields="openImportFieldsDraft"
    />

    <ChartNamesDialog
      ref="chartNamesDialog"
      v-if="workspace"
      :open="chartNamesDialogOpen"
      :guard-mode="transitionGuard"
      :has-uncommitted-names="hasUncommittedNames"
      :has-modified-entity-session="hasModifiedEntitySession || hasModifiedRouteSession"
      v-model:cluster-name="clusterName"
      v-model:system-name="systemName"
      :form-error="formError"
      :target-system-name="chartDraftSystemName"
      @update:open="setChartNamesDialogOpen"
      @apply="submitNames"
      @discard="cancelChartNamesEdit"
      @resolve-transition="resolveTransitionChoice"
    />

    <WorkspaceHistoryCapacityDialog :request="historyCapacityRequest" @resolve="resolveHistoryCapacity" />

  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { catalogueTypes, type CatalogueSubtype, type ObjectFamily, type Point } from '../domain/workspace'
import type { EntityCommand, SearchPresentationSettlement, SystemCreationCandidate, SystemCreationType } from '../composables/editor-workflows/types'
import type { WorkspaceHistoryTraversalContext } from '../composables/editor-workflows/workspace-mutations'
import { provideEditorCommands } from '../composables/editor-workflows/editor-command-context'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import { useWorkspaceHistory } from '../composables/useWorkspaceHistory'
import { useWorkspaceHistoryShortcuts } from '../composables/useWorkspaceHistoryShortcuts'
import { useMapToolShortcuts } from '../composables/useMapToolShortcuts'
import ChartNamesDialog from './ChartNamesDialog.vue'
import WorkspaceDeletionReview from './WorkspaceDeletionReview.vue'
import WorkspaceImportReview from './WorkspaceImportReview.vue'
import WorkspaceFeedback from './WorkspaceFeedback.vue'
import WorkspaceMapChrome from './WorkspaceMapChrome.vue'

const {
  workspace,
  hydrationState,
  loadError,
  recoveryError,
  saveState,
  saveError,
  appliedRevision,
  savedAppliedRevision,
  hydrate,
  applyWorkspace,
  commit,
  retrySaveLatest,
  restoreBackup,
} = useLocalWorkspace()

let readEditorHistoryBlockReason: () => string | null = () => 'The editor is opening.'
let endCleanHistorySessions: () => void = () => undefined
let revealHistoryContext: (context: WorkspaceHistoryTraversalContext) => void = () => undefined
const historyOpen = ref(false)
const history = useWorkspaceHistory({
  workspace,
  appliedRevision,
  savedAppliedRevision,
  saveState,
  hydrationState,
  publishWorkspace: applyWorkspace,
  getEditorBlockReason: () => readEditorHistoryBlockReason(),
  endCleanSessions: () => endCleanHistorySessions(),
  revealHistoryContext: context => { void revealHistoryContext(context) },
})
const {
  mutations, status: historyStatus, entries: historyEntries, capacityRequest: historyCapacityRequest, traversalError: historyTraversalError,
  resolveCapacity: resolveHistoryCapacity, undo: undoWorkspace, redo: redoWorkspace,
} = history
const chartNamesDialog = ref<InstanceType<typeof ChartNamesDialog> | null>(null)
const workspaceMapChrome = ref<InstanceType<typeof WorkspaceMapChrome> | null>(null)
interface SearchPresentationGeometry {
  values: number[]
}

const SEARCH_PRESENTATION_GRACE_MS = 250
const SEARCH_PRESENTATION_QUIET_MS = 100
const SEARCH_PRESENTATION_TIMEOUT_MS = 800

function searchPresentationGeometry(container: HTMLElement): SearchPresentationGeometry | null {
  if (!container.isConnected || container.getClientRects().length === 0 || document.visibilityState === 'hidden') return null
  const style = window.getComputedStyle(container)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null
  const rect = container.getBoundingClientRect()
  const visual = window.visualViewport
  const values = [
    rect.left, rect.top, rect.width, rect.height, rect.right, rect.bottom,
    window.innerWidth, window.innerHeight,
    visual?.offsetLeft ?? 0, visual?.offsetTop ?? 0,
    visual?.width ?? window.innerWidth, visual?.height ?? window.innerHeight, visual?.scale ?? 1,
  ]
  return rect.width > 0 && rect.height > 0 && values.every(Number.isFinite) ? { values } : null
}

function searchPresentationGeometryMatches(left: SearchPresentationGeometry, right: SearchPresentationGeometry): boolean {
  return left.values.length === right.values.length
    && left.values.every((value, index) => Math.abs(value - (right.values[index] ?? Number.NaN)) <= 1)
}

/** Waits for the destination's captured map area and software-keyboard viewport to stop changing. */
function waitForStableSearchPresentationLayout(
  container: HTMLElement,
  signal: AbortSignal,
): Promise<SearchPresentationSettlement> {
  return new Promise(resolve => {
    const startedAt = Date.now()
    let lastChangeAt = startedAt
    let previousGeometry = searchPresentationGeometry(container)
    let finished = false
    let quietTimer: ReturnType<typeof setTimeout> | null = null
    let graceTimer: ReturnType<typeof setTimeout> | null = null
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null
    let frameIds: number[] = []
    let resizeObserver: ResizeObserver | null = null
    let checkingFrames = false

    const cleanup = (): void => {
      if (quietTimer !== null) clearTimeout(quietTimer)
      if (graceTimer !== null) clearTimeout(graceTimer)
      if (deadlineTimer !== null) clearTimeout(deadlineTimer)
      for (const frameId of frameIds) cancelAnimationFrame(frameId)
      frameIds = []
      resizeObserver?.disconnect()
      resizeObserver = null
      window.removeEventListener('resize', observeGeometry)
      window.removeEventListener('scroll', observeGeometry, true)
      window.visualViewport?.removeEventListener('resize', observeGeometry)
      window.visualViewport?.removeEventListener('scroll', observeGeometry)
      signal.removeEventListener('abort', onAbort)
    }

    const finish = (result: SearchPresentationSettlement): void => {
      if (finished) return
      finished = true
      cleanup()
      resolve(result)
    }

    const onAbort = (): void => finish('cancelled')

    const restartQuietPeriod = (): void => {
      if (quietTimer !== null) clearTimeout(quietTimer)
      const remaining = Math.max(0, SEARCH_PRESENTATION_QUIET_MS - (Date.now() - lastChangeAt))
      quietTimer = setTimeout(attemptSettlement, remaining)
    }

    const changedGeometry = (geometry: SearchPresentationGeometry): void => {
      previousGeometry = geometry
      lastChangeAt = Date.now()
      checkingFrames = false
      for (const frameId of frameIds) cancelAnimationFrame(frameId)
      frameIds = []
      restartQuietPeriod()
    }

    const confirmWithFrames = (geometry: SearchPresentationGeometry): void => {
      if (checkingFrames || finished) return
      checkingFrames = true
      frameIds.push(requestAnimationFrame(() => {
        if (finished || signal.aborted) return onAbort()
        const firstFrameGeometry = searchPresentationGeometry(container)
        if (!firstFrameGeometry) return finish('unavailable')
        if (!searchPresentationGeometryMatches(geometry, firstFrameGeometry)) {
          checkingFrames = false
          changedGeometry(firstFrameGeometry)
          return
        }
        frameIds.push(requestAnimationFrame(() => {
          if (finished || signal.aborted) return onAbort()
          const secondFrameGeometry = searchPresentationGeometry(container)
          if (!secondFrameGeometry) return finish('unavailable')
          if (!searchPresentationGeometryMatches(firstFrameGeometry, secondFrameGeometry)) {
            checkingFrames = false
            changedGeometry(secondFrameGeometry)
            return
          }
          finish('settled')
        }))
      }))
    }

    function attemptSettlement(): void {
      if (finished) return
      if (signal.aborted) return onAbort()
      const currentGeometry = searchPresentationGeometry(container)
      if (!currentGeometry) return finish('unavailable')
      if (!previousGeometry || !searchPresentationGeometryMatches(previousGeometry, currentGeometry)) {
        changedGeometry(currentGeometry)
        return
      }
      const now = Date.now()
      if (now - startedAt < SEARCH_PRESENTATION_GRACE_MS
        || now - lastChangeAt < SEARCH_PRESENTATION_QUIET_MS) return
      confirmWithFrames(currentGeometry)
    }

    function observeGeometry(): void {
      if (finished) return
      if (signal.aborted) return onAbort()
      const currentGeometry = searchPresentationGeometry(container)
      if (!currentGeometry) return finish('unavailable')
      if (!previousGeometry || !searchPresentationGeometryMatches(previousGeometry, currentGeometry)) {
        changedGeometry(currentGeometry)
      }
    }

    if (signal.aborted) return onAbort()
    if (!previousGeometry) return finish('unavailable')
    signal.addEventListener('abort', onAbort, { once: true })
    window.addEventListener('resize', observeGeometry)
    window.addEventListener('scroll', observeGeometry, true)
    window.visualViewport?.addEventListener('resize', observeGeometry)
    window.visualViewport?.addEventListener('scroll', observeGeometry)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(observeGeometry)
      resizeObserver.observe(container)
    }
    graceTimer = setTimeout(attemptSettlement, SEARCH_PRESENTATION_GRACE_MS)
    deadlineTimer = setTimeout(() => finish('unavailable'), SEARCH_PRESENTATION_TIMEOUT_MS)
    restartQuietPeriod()
  })
}

async function waitForSearchPresentation(signal: AbortSignal): Promise<SearchPresentationSettlement> {
  await Promise.all([
    chartNamesDialog.value?.whenClosingFocusSettled() ?? Promise.resolve(),
    workspaceMapChrome.value?.whenSearchClosingFocusSettled() ?? Promise.resolve(),
  ])
  await nextTick()
  if (signal.aborted) return 'cancelled'
  const destinationCanvas = document.querySelector<HTMLElement>('.workspace-map-canvas-region .workspace-map-canvas')
  if (!destinationCanvas) return 'unavailable'
  return await waitForStableSearchPresentationLayout(destinationCanvas, signal)
}

const workflows = useEditorWorkflows({
  workspace,
  saveState,
  saveError,
  mutations,
  initializeWorkspace: commit,
  waitForSearchPresentation,
})
const { navigation, inspector, charts, fields, cluster, placement, mapControls, feedback, adjustments, search } = workflows
const searchOpen = search.open
const searchQuery = search.query
const searchResults = search.results
async function revealSearchTarget(target: Parameters<typeof search.reveal>[0]): Promise<Awaited<ReturnType<typeof search.reveal>>> {
  const outcome = await search.reveal(target)
  if (outcome.status === 'rejected') await chartNamesDialog.value?.whenClosingFocusSettled()
  return outcome
}
revealHistoryContext = navigation.revealHistoryContext

const {
  activeView, mapMode, selectedSystemId, clusterSelectedSystemId, selectedObjectId, selectedOrbitId,
  selectedRouteId, selectedSystem, selectedObject, selectedOrbit, selectedRoute, clusterSelectedSystem,
  inspectedClusterSystem, routeEndpointSummary, showClusterMap, selectSystem,
  selectClusterSystem, selectObject, selectOrbit, selectRoute, showChartDetails,
} = navigation
const {
  clusterName, systemName, draftSystemName: chartDraftSystemName, dialogOpen: chartNamesDialogOpen,
  transitionGuard, formError, hasUncommittedNames, hasChartNameDraft, saveMessage, submitNames,
  cancelNamesEdit: cancelChartNamesEdit, setDialogOpen: setChartNamesDialogOpen,
  resolveTransition, resolveTransitionChoice, beginNamesEdit: beginChartNamesEdit,
} = charts
const {
  fieldDefinitionsSession, fieldDefinitionDialogOpen, fieldDefinitionError, hasModifiedFieldDefinitionsSession,
  fieldDefinitionsDialog, openFieldDefinitions, getFieldDefinitionImportConflict, handleFieldDefinitionsIntent,
} = fields
const {
  objectInspectorFocusRequest, acknowledgeObjectInspectorFocusRequest,
  entitySession, hasModifiedEntitySession, orbitPlacementPreview, applyEntitySession, discardEntitySession,
  updateObjectPlacement, updateOrbitHost, previewOrbitPlacement, isEntityCommandBlocked, resumeEntitySession,
  cancelOrbitPlacementPreview, beginObjectEdit, beginOrbitEdit,
  routeSession, hasModifiedRouteSession, offerRouteSystems, chooseRoutePoint, updateRouteInput,
  applyRouteSession, discardRouteSession, cancelRouteCreation,
} = inspector
const { editorError, orbitAdjustmentNotice } = feedback
const { orbitAdjustmentPreview, updateOrbitAdjustment, beforeWorkspaceOperation, resetOrbitAdjustments } = adjustments
watch(hydrationState, (state, previous) => {
  if (state === 'loading' || previous === 'loading') resetOrbitAdjustments()
}, { flush: 'sync' })
const {
  clusterMapRef, systemMapRef, activeMapKey, initialViewport, hierarchyPanelVisible, inspectorPanelVisible,
  isCompactViewport, compactPanelOpen, compactPanel, editingGestureActive, zoomLevel, minimumZoomLevel, requestPanel, closePanel, togglePanel,
  zoomActiveMap, panActiveMap, setViewportPercentage, fitActiveMap, recordViewport, setMapMode,
} = mapControls
const {
  map: mapPlacement,
  creation,
  systemObject: objectPlacement,
  clusterSystem,
  unresolvedExit,
  orbitCenter,
  quitAdd,
} = placement
const {
  moveSystem, moveMapObject, placeMapObjectInOrbit, rotateMapObject, resizeMapOrbit, rotateMapOrbit,
  moveMapOrbitCenter, detachSelectedOrbit,
} = mapPlacement
const {
  clusterAddType, clusterAddError, clusterMoveTargeting, clusterSystemMovePreview, clusterSystemMoveError,
  clusterSystemMapMoveTargeting, beginClusterSystemMapMove, nudgeClusterSystemMove, armSystemAdd,
  addSystemAt, previewSystemMoveAt, cancelSystemMovePreview,
  confirmSystemMove,
} = clusterSystem
const {
  systemObjectMapMoveTargeting, beginSystemObjectMapMove, previewSystemObjectMoveAt, nudgeSystemObjectMove,
  systemObjectMoveAvailable, systemObjectMoveDestination, systemObjectMoveDestinationOptions,
  systemObjectMoveCandidates, systemObjectMoveCandidateRequest, systemObjectMovePreview,
  systemObjectMoveError, updateSystemObjectMoveDestination,
  chooseObjectMoveCandidate, confirmSystemObjectMove,
  cancelSystemObjectMovePreview,
} = objectPlacement
const {
  available: unresolvedExitAvailable,
  targeting: unresolvedExitTargeting,
  preview: unresolvedExitPreview,
  error: unresolvedExitError,
  begin: beginUnresolvedExitMove,
  previewAt: previewUnresolvedExitAt,
  nudge: nudgeUnresolvedExit,
  confirm: confirmUnresolvedExitMove,
  cancel: cancelUnresolvedExitMove,
  move: moveUnresolvedExit,
} = unresolvedExit
const {
  orbitCenterMoveAvailable, orbitCenterMapMoveTargeting, orbitCenterMovePreview, orbitCenterMoveError,
  beginOrbitCenterMapMove, previewOrbitCenterMoveAt, nudgeOrbitCenterMove,
  confirmOrbitCenterMove, cancelOrbitCenterMove,
} = orbitCenter
const mapMoveTargeting = computed(() => activeView.value === 'cluster'
  ? unresolvedExitTargeting.value || clusterSystemMapMoveTargeting.value
  : systemObjectMapMoveTargeting.value || orbitCenterMapMoveTargeting.value)
const {
  creationSession, chooseCreationType, chooseCreationCandidate, updateCreationInput,
  offerCreationCandidates, addCreationFromInputs, cancelCreationPreview,
  handleCreationDrop: processCreationDrop,
} = creation
const {
  beginRoute, beginRouteEdit, deleteSystem, deleteSelectedObject, deleteSelectedOrbit, deleteSelectedRoute,
  deletionReview, cancelDeletionReview, confirmDeletionReview,
} = cluster

provideEditorCommands({
  navigation: {
    selectSystem,
    selectObject,
    selectOrbit,
    selectRoute,
    showClusterMap,
    routeSummary: routeEndpointSummary,
  },
  charts: { beginNamesEdit: beginChartNamesEdit },
  cluster: { deleteSystem },
  map: { changeMode: changeMapMode },
})

const fieldDefinitionInspectorConflict = computed(() => {
  const fieldId = fieldDefinitionsSession.selectedId
  return fieldId !== null && isEntityCommandBlocked({ kind: 'definition-mutation', fieldId })
})

function isObjectMoveBlocked(objectId: string): boolean {
  const object = selectedSystem.value?.objects.find(candidate => candidate.id === objectId)
  if (!object) return isEntityCommandBlocked({ kind: 'object-placement', objectId })
  const orbitId = object.placement.kind === 'orbit' ? object.placement.orbitId : null
  return isEntityCommandBlocked({ kind: 'object-placement', objectId, fromOrbitId: orbitId, toOrbitId: orbitId })
}

function handleMapMoveTarget(point: Point): void {
  if (activeView.value === 'cluster' && unresolvedExitTargeting.value) previewUnresolvedExitAt(point)
  else if (activeView.value === 'cluster' && clusterSystemMapMoveTargeting.value) previewSystemMoveAt(point)
  else if (activeView.value === 'system' && systemObjectMapMoveTargeting.value) previewSystemObjectMoveAt(point)
  else if (activeView.value === 'system' && orbitCenterMapMoveTargeting.value) previewOrbitCenterMoveAt(point)
}

function handleMapMoveNudge(delta: Point): void {
  if (activeView.value === 'cluster' && unresolvedExitTargeting.value) nudgeUnresolvedExit(delta)
  else if (activeView.value === 'cluster' && clusterSystemMapMoveTargeting.value) nudgeClusterSystemMove(delta)
  else if (activeView.value === 'system' && systemObjectMapMoveTargeting.value) nudgeSystemObjectMove(delta)
  else if (activeView.value === 'system' && orbitCenterMapMoveTargeting.value) nudgeOrbitCenterMove(delta)
}

function cancelClusterPlacement(): void {
  cancelSystemMovePreview()
  if (unresolvedExitTargeting.value || unresolvedExitPreview.value) cancelUnresolvedExitMove()
}

function cancelMapMove(): void {
  cancelClusterPlacement()
  cancelSystemObjectMovePreview()
  cancelOrbitCenterMove()
}

function handleBlockedObjectMove(objectId: string): void {
  if (!isObjectMoveBlocked(objectId)) return
  editorError.value = 'Resolve the Inspector draft before moving an object or changing a related placement.'
  requestPanel('inspector')
}

function handleBlockedEntityCommand(command: EntityCommand): void {
  if (!isEntityCommandBlocked(command)) return
  editorError.value = blockedEntityCommandMessage(command)
  requestPanel('inspector')
}

function blockedEntityCommandMessage(command: EntityCommand): string {
  switch (command.kind) {
    case 'object-placement':
      return 'Resolve the Inspector draft before moving this object or changing a related placement.'
    case 'object-create':
      return 'Resolve the Inspector draft before creating an object in this Orbit.'
    case 'orbit-geometry':
    case 'orbit-host':
      return 'Resolve the Inspector draft before changing this Orbit or one of its hosts.'
    case 'orbit-center-position':
      return 'Resolve the Inspector relationship draft before moving this Orbit center.'
    case 'orbit-create':
      return 'Resolve the Inspector draft before adding another Orbit to this host.'
    case 'definition-mutation':
      return 'Resolve the Inspector draft before changing a custom field used by this object.'
    case 'deletion':
      return 'Resolve the Inspector draft before deleting this object or one of its dependencies.'
  }
}

const headerFilesOpen = ref(false)
const recoveryDetailsOpen = ref(false)
const workspaceFeedbackRef = ref<HTMLElement | null>(null)
const objectPaletteActiveFamily = ref<ObjectFamily>('CelestialBody')
const creationChooserOpen = ref(false)
const workspaceDockRef = ref<{ openAddChooserFromKeyboard(): void } | null>(null)
const keyboardAddOriginMapKey = ref<string | null>(null)
const creationTypeLabel = computed(() => {
  const type = creationSession.value?.type
  if (!type) return ''
  if (type.kind === 'orbit') return 'Orbit'
  return catalogueTypes.find(candidate => candidate.value === type.subtype)?.label ?? type.subtype
})
const clusterAddPresentation = computed(() => clusterAddType.value === 'system'
  ? {
      label: 'System',
      status: 'ADD System · Choose a clear map point, or pan with the arrow keys and press Enter.',
      error: clusterAddError.value,
    }
  : clusterAddType.value === 'route'
    ? {
        label: 'Jump Route',
        status: `ADD Jump Route · Choose a system to select the ${routeSession.value?.endpointToChoose === 'to' ? 'destination' : 'origin'} Jump Point.`,
        error: routeSession.value?.error || undefined,
      }
    : null)
const clusterMovePresentation = computed(() => {
  if (!clusterMoveTargeting.value || clusterAddType.value !== null) return null
  const preview = clusterSystemMovePreview.value
  const systemName = clusterSelectedSystem.value?.name ?? 'selected system'
  return {
    status: preview
      ? `MOVE preview · ${systemName} · Confirm or cancel the move.`
      : clusterSystemMapMoveTargeting.value
        ? `MOVE ${systemName} · Choose a destination or adjust it with the arrow keys.`
        : `MOVE ${systemName} · Choose Move selected system on map, or drag the system.`,
    error: clusterSystemMoveError.value || undefined,
    previewing: preview !== null,
  }
})
watch(
  [activeView, selectedSystemId, clusterSelectedSystemId, mapMode, hierarchyPanelVisible, inspectorPanelVisible, isCompactViewport],
  () => { creationChooserOpen.value = false },
)
watch([creationSession, clusterAddType], ([creationIntent, clusterIntent]) => {
  if (creationIntent || clusterIntent) cancelMapMove()
}, { flush: 'sync' })

async function chooseObjectCreationType(subtype: CatalogueSubtype): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  if (!await chooseCreationType({ kind: 'object', subtype })) return
  creationChooserOpen.value = false
}

async function chooseOrbitCreationType(): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  if (!await chooseCreationType({ kind: 'orbit' })) return
  creationChooserOpen.value = false
}

async function handleCreationDrop(type: SystemCreationType, candidates: SystemCreationCandidate[]): Promise<boolean> {
  // Keep the palette mounted through the browser's drop dispatch; close it only after the shared
  // owner has accepted the exact candidate set or exposed an ambiguity for correction.
  if (!await beforeWorkspaceOperation()) return false
  const completed = await processCreationDrop(type, candidates)
  if (completed) creationChooserOpen.value = false
  return completed
}

async function armSystemAddAndClose(close: () => void): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  armSystemAdd()
  close()
}

async function quitSystemAdd(): Promise<boolean> {
  if (!await beforeWorkspaceOperation()) return false
  quitAdd()
  creationChooserOpen.value = false
  return true
}

function handleClusterTarget(point: Point, systemIds: string[]): void {
  if (clusterAddType.value === 'system') {
    addSystemAt(point, systemIds)
    return
  }
  if (clusterAddType.value === 'route') {
    const session = routeSession.value
    if (session) offerRouteSystems(session.id, systemIds)
    return
  }
}

function discardRouteDraft(sessionId: number): void {
  const session = routeSession.value
  if (!session || session.id !== sessionId) return
  if (session.routeId === null) {
    cancelRouteCreation()
    quitSystemAdd()
    return
  }
  discardRouteSession(sessionId)
  editorError.value = ''
}

async function handleClusterSystemMove(systemId: string, position: Point): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  cancelSystemMovePreview()
  await moveSystem(systemId, position)
}

async function changeMapMode(mode: 'navigate' | 'select' | 'move'): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  if ((creationSession.value || clusterAddType.value) && !await quitSystemAdd()) return
  await setMapMode(mode)
}

async function handleAddEscape(event: KeyboardEvent): Promise<void> {
  const hasMovePreview = clusterSystemMovePreview.value !== null
  if (event.key !== 'Escape' || event.defaultPrevented
    || (!creationSession.value && !clusterAddType.value && !hasMovePreview && !systemObjectMovePreview.value && !mapMoveTargeting.value)
    || creationChooserOpen.value) return
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
  if (document.querySelector('[role="listbox"][data-state="open"]')) return
  if (mapMoveTargeting.value) {
    event.preventDefault()
    cancelMapMove()
    return
  }
  if (systemObjectMovePreview.value) {
    event.preventDefault()
    cancelSystemObjectMovePreview()
    return
  }
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
  event.preventDefault()
  if (!await beforeWorkspaceOperation()) return
  if (hasMovePreview) {
    cancelSystemMovePreview()
    return
  }
  quitSystemAdd()
}

let importReviewActions: ReturnType<typeof useWorkspaceFiles> | null = null

async function resolveImportDefinitionChanges(existingFieldIds: string[]): Promise<boolean> {
  const hasConflictingEntityDraft = existingFieldIds.some(fieldId =>
    isEntityCommandBlocked({ kind: 'definition-mutation', fieldId }),
  )
  if (!hasConflictingEntityDraft) return true

  importReviewActions?.suspendImportReview()
  try {
    return await resolveTransition({
      leaveChart: false,
      leaveEntitySession: true,
      leaveRouteSession: false,
    })
  } finally {
    importReviewActions?.resumeImportReview()
  }
}

const workspaceFiles = useWorkspaceFiles({
  workspace,
  selectedSystem,
  mutations,
  getCurrentMapImage: (kind) => {
    if (kind === 'jump-cluster') {
      if (activeView.value !== 'cluster') return null
      return { map: clusterMapRef.value, name: workspace.value?.cluster.name }
    }
    if (activeView.value !== 'system') return null
    return { map: systemMapRef.value, name: selectedSystem.value?.name }
  },
  getFieldDefinitionImportConflict,
  resolveImportDefinitionChanges,
  beforeWorkspaceOperation,
})
importReviewActions = workspaceFiles

const {
  exportError,
  importError,
  downloadClusterJson,
  downloadSystemJson,
  downloadMapImage,
  importJsonFile,
  importReview,
  confirmJsonImport,
  cancelJsonImport,
  reviewImportFields,
  resumeImportReview,
} = workspaceFiles

const searchShortcutAvailable = computed(() => workspace.value !== null
  && !historyOpen.value
  && !chartNamesDialogOpen.value
  && !fieldDefinitionDialogOpen.value
  && !headerFilesOpen.value
  && !recoveryDetailsOpen.value
  && historyCapacityRequest.value === null
  && !creationChooserOpen.value
  && deletionReview.value === null
  && !importReview.value.open
  && !importReview.value.suspended
  && !importReview.value.confirming
  && !compactPanelOpen.value
  && !editingGestureActive.value)

readEditorHistoryBlockReason = () => {
  if (historyOpen.value) return 'Close History before using Undo or Redo.'
  if (searchOpen.value) return 'Close Search before using Undo or Redo.'
  if (chartNamesDialogOpen.value || fieldDefinitionDialogOpen.value || headerFilesOpen.value
    || recoveryDetailsOpen.value || creationChooserOpen.value || compactPanelOpen.value) {
    return 'Close the open panel or dialog before using Undo or Redo.'
  }
  if (importReview.value.open || importReview.value.suspended || importReview.value.confirming) {
    return 'Finish or cancel the import review before using Undo or Redo.'
  }
  return workflows.historyGuards.blockReason.value
}
endCleanHistorySessions = workflows.historyGuards.endCleanSessions

useWorkspaceHistoryShortcuts({
  status: historyStatus,
  workspaceEnabled: () => workspace.value !== null,
  pageOverlayOpen: () => historyOpen.value || chartNamesDialogOpen.value || fieldDefinitionDialogOpen.value
    || headerFilesOpen.value || recoveryDetailsOpen.value || historyCapacityRequest.value !== null
    || searchOpen.value
    || creationChooserOpen.value || compactPanelOpen.value || cluster.deletionReview.value !== null
    || importReview.value.open || importReview.value.suspended || importReview.value.confirming,
  undo: undoWorkspace,
  redo: redoWorkspace,
})

const mapToolShortcuts = useMapToolShortcuts({
  workspaceEnabled: () => workspace.value !== null,
  pageOverlayOpen: () => historyOpen.value || chartNamesDialogOpen.value || fieldDefinitionDialogOpen.value
    || headerFilesOpen.value || recoveryDetailsOpen.value || historyCapacityRequest.value !== null
    || searchOpen.value
    || creationChooserOpen.value || compactPanelOpen.value || cluster.deletionReview.value !== null
    || importReview.value.open || importReview.value.suspended || importReview.value.confirming,
  editingGestureActive: () => editingGestureActive.value,
  activeMapKey: () => activeMapKey.value,
  mapMode: () => mapMode.value,
  addIntentActive: () => creationSession.value !== null || clusterAddType.value !== null,
  changeMapMode,
  openAddChooser: openMapAddChooserFromKeyboard,
  focusActiveMap: mapControls.focusActiveMap,
})

function canOpenSearchShortcut(): boolean {
  return searchShortcutAvailable.value && !mapToolShortcuts.isMapInputActive()
}

function openMapAddChooserFromKeyboard(): void {
  keyboardAddOriginMapKey.value = activeMapKey.value
  workspaceDockRef.value?.openAddChooserFromKeyboard()
}

function restoreMapFocusAfterKeyboardAdd(): void {
  const originMapKey = keyboardAddOriginMapKey.value
  keyboardAddOriginMapKey.value = null
  if (!originMapKey || originMapKey !== activeMapKey.value || !document.hasFocus()) return
  mapControls.focusActiveMap()
}

async function openImportFieldsDraft(): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  reviewImportFields()
  fieldDefinitionsDialog.value?.open()
}

watch(fieldDefinitionDialogOpen, (open, wasOpen) => {
  if (wasOpen && !open && importReview.value.open && importReview.value.suspended) {
    resumeImportReview()
  }
}, { flush: 'sync' })

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  const changedWelcomeDraft = !workspace.value
    && (clusterName.value.trim() !== 'New Jump Cluster' || systemName.value.trim() !== 'First System')
  const changedInspectorDraft = hasModifiedEntitySession.value || hasModifiedRouteSession.value
  const changedFieldDefinitionsDraft = hasModifiedFieldDefinitionsSession.value
  const appliedWorkspaceIsNotDurable = !!workspace.value && (saveState.value === 'saving' || saveState.value === 'error')
  if (!changedWelcomeDraft && !hasUncommittedNames.value && !changedInspectorDraft && !changedFieldDefinitionsDraft && !appliedWorkspaceIsNotDurable) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', warnBeforeLeaving)
  window.addEventListener('keydown', handleAddEscape)
  void hydrate()
})

onBeforeUnmount(() => {
  mutations.dispose()
  window.removeEventListener('beforeunload', warnBeforeLeaving)
  window.removeEventListener('keydown', handleAddEscape)
})

async function retryLatestSave(): Promise<void> {
  try {
    await retrySaveLatest()
  } catch {
    // The persistence owner already exposes the current failure through saveError/saveState.
  }
}
</script>

<style src="../assets/css/map-workspace.css"></style>
