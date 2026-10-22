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
          :overlay-open="chartNamesDialogOpen || fieldDefinitionDialogOpen || headerFilesOpen || recoveryDetailsOpen"
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
            />
          </template>

          <template #dock>
            <WorkspaceDock
              :mode="mapMode"
              :close-signal="dockCloseSignal"
              v-model:add-open="creationChooserOpen"
              :creation-session="activeView === 'system' ? creationSession : null"
              :creation-type-label="creationTypeLabel"
              :cluster-add-label="clusterAddPresentation?.label ?? null"
              :cluster-system-position-inputs="clusterSystemPositionInputs"
              :cluster-system-position-input-errors="clusterSystemPositionInputErrors"
              :cluster-move-targeting="clusterMoveTargeting && clusterAddType === null"
              :system-object-move-available="systemObjectMoveAvailable"
              :system-object-move-destination="systemObjectMoveDestination"
              :system-object-move-destination-options="systemObjectMoveDestinationOptions"
              :system-object-move-candidates="systemObjectMoveCandidates"
              :system-object-move-candidate-request="systemObjectMoveCandidateRequest"
              :system-object-position-input="systemObjectPositionInput"
              :system-object-position-x-input="systemObjectPositionXInput"
              :system-object-position-y-input="systemObjectPositionYInput"
              :system-object-move-preview="systemObjectMovePreview"
              :system-object-move-error="systemObjectMoveError"
              :selected-system="selectedSystem"
              @mode-change="changeMapMode"
              @update-creation-input="updateCreationInput"
              @add-from-inputs="addCreationFromInputs"
              @choose-creation-candidate="chooseCreationCandidate"
              @update-cluster-system-input="updateClusterSystemPositionInput"
              @add-cluster-system-from-inputs="addSystemFromInputs"
              @preview-cluster-system-move-from-inputs="previewSystemMoveFromInputs"
              @update-system-object-move-destination="updateSystemObjectMoveDestination"
              @update-system-object-position-input="updateSystemObjectPositionInput"
              @update-system-object-position-x-input="updateSystemObjectPositionXInput"
              @update-system-object-position-y-input="updateSystemObjectPositionYInput"
              @choose-system-object-move-candidate="chooseObjectMoveCandidate"
              @preview-system-object-move="previewSystemObjectMoveFromInputs"
              @confirm-system-object-move="confirmSystemObjectMove"
              @cancel-system-object-move="cancelSystemObjectMovePreview"
            >
              <template #add="{ close }">
                <template v-if="activeView === 'cluster'">
                  <button class="workspace-control tool-button" type="button" aria-label="Add star system" @click="armSystemAdd(); close()">
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
              :compact-modal-open="compactPanelOpen"
              @zoom-by="zoomActiveMap"
              @zoom-to="setViewportPercentage"
              @fit-map="fitActiveMap"
              @pan-by="panActiveMap"
            />
          </template>

          <template #hierarchy>
            <MapHierarchy
              :mode="activeView"
              :workspace="workspace"
              :selected-system-id="activeView === 'cluster' ? clusterSelectedSystemId : selectedSystemId"
              :selected-object-id="selectedObjectId"
              :selected-orbit-id="selectedOrbitId"
              :selected-route-id="selectedRouteId"
              :has-chart-name-draft="hasChartNameDraft"
              :saving="saveState === 'saving'"
              :route-summary="routeEndpointSummary"
              @select-system="selectSystem"
              @delete-system="deleteSystem"
              @select-object="selectObject"
              @select-orbit="selectOrbit"
              @select-route="selectRoute"
              @edit-chart-names="beginChartNamesEdit"
              @show-cluster="showClusterMap"
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
                    :cluster-move-targeting="clusterMoveTargeting && clusterAddType === null"
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
                    @cluster-target="handleClusterTarget"
                    @cancel-cluster-preview="cancelSystemMovePreview"
                    @move-object="moveMapObject"
                    @move-orbit-center="moveMapOrbitCenter"
                    @orbit-center-candidates="handleOrbitCenterCandidates"
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
                    :is-entity-command-blocked="isEntityCommandBlocked"
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
                    @object-move-candidates="handleObjectMoveCandidates"
                    @object-move-blocked="handleBlockedObjectMove"
                    @entity-command-blocked="handleBlockedEntityCommand"
                    @move-orbit-center="moveMapOrbitCenter"
                    @orbit-center-candidates="handleOrbitCenterCandidates"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
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
                <span>{{ clusterAddType === 'system' ? 'Choose clear cluster space, or use Placement to enter coordinates.' : clusterAddType === 'route' ? 'Choose a system, then a logical Jump Point for each endpoint.' : clusterMoveTargeting ? 'Choose a clear map point or use Placement to preview coordinates.' : 'Select a system to open it, or a route to inspect its endpoints.' }}</span>
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
              ref="mapInspectorRef"
              :mode="activeView"
              :workspace="workspace"
              :selected-system="selectedSystem"
              :inspected-cluster-system="inspectedClusterSystem"
              :selected-object="selectedObject"
              :selected-orbit="selectedOrbit"
              :selected-route="selectedRoute"
              :route-session="routeSession"
              :selected-route-summary="selectedRoute ? routeEndpointSummary(selectedRoute) : ''"
              :has-chart-name-draft="hasChartNameDraft"
              :has-uncommitted-names="hasUncommittedNames"
              :entity-session="entitySession"
              :has-modified-entity-session="hasModifiedEntitySession"
              :has-orbit-placement-preview="Boolean(orbitPlacementPreview && entitySession?.kind === 'orbit' && orbitPlacementPreview.sessionId === entitySession.id && orbitPlacementPreview.orbitId === selectedOrbit?.id)"
              :is-entity-draft-target="isEntityDraftTarget"
              :saving="saveState === 'saving'"
              :editor-error="editorError"
              :save-state="saveState"
              :save-message="saveMessage"
              :save-error="saveError"
              :export-error="exportError"
              @edit-chart-names="beginChartNamesEdit"
              @show-chart-details="showChartDetails"
              @hide="closePanel('inspector')"
              @request-object-edit="beginObjectEdit"
              @resume-entity-session="resumeEntitySession"
              @apply-entity-session="applyEntitySession"
              @discard-entity-session="discardEntitySession"
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
      v-if="workspace"
      :open="chartNamesDialogOpen"
      :guard-mode="transitionGuard"
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

  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { catalogueTypes, type CatalogueSubtype, type ObjectFamily, type Point } from '../domain/workspace'
import type {
  EntityCommand,
  OrbitCenterMoveCandidate,
  SystemCreationCandidate,
  SystemCreationType,
  SystemObjectMoveCandidate,
} from '../composables/editor-workflows/types'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import ChartNamesDialog from './ChartNamesDialog.vue'
import WorkspaceDeletionReview from './WorkspaceDeletionReview.vue'
import WorkspaceImportReview from './WorkspaceImportReview.vue'
import WorkspaceFeedback from './WorkspaceFeedback.vue'

const {
  workspace,
  hydrationState,
  loadError,
  recoveryError,
  saveState,
  saveError,
  hydrate,
  applyWorkspace,
  commit,
  retrySaveLatest,
  restoreBackup,
} = useLocalWorkspace()

const {
  clusterName,
  systemName,
  chartDraftSystemName,
  activeView,
  mapMode,
  selectedSystemId,
  clusterSelectedSystemId,
  selectedObjectId,
  selectedOrbitId,
  selectedRouteId,
  chartNamesDialogOpen,
  transitionGuard,
  fieldDefinitionDialogOpen,
  fieldDefinitionError,
  fieldDefinitionsSession,
  hasModifiedFieldDefinitionsSession,
  fieldDefinitionsDialog,
  openFieldDefinitions,
  getFieldDefinitionImportConflict,
  formError,
  editorError,
  entitySession,
  hasModifiedEntitySession,
  orbitPlacementPreview,
  routeSession,
  hasModifiedRouteSession,
  offerRouteSystems,
  chooseRoutePoint,
  updateRouteInput,
  applyRouteSession,
  discardRouteSession,
  cancelRouteCreation,
  isEntityCommandBlocked,
  isEntityDraftTarget,
  applyEntitySession,
  discardEntitySession,
  orbitAdjustmentNotice,
  mapInspectorRef,
  clusterMapRef,
  systemMapRef,
  activeMapKey,
  initialViewport,
  clusterSelectedSystem,
  inspectedClusterSystem,
  hierarchyPanelVisible,
  inspectorPanelVisible,
  isCompactViewport,
  compactPanelOpen,
  compactPanel,
  zoomLevel,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  selectedRoute,
  routeEndpointSummary,
  hasUncommittedNames,
  hasChartNameDraft,
  saveMessage,
  handleFieldDefinitionsIntent,
  resolveTransition,
  resolveTransitionChoice,
  setChartNamesDialogOpen,
  setMapMode,
  togglePanel,
  requestPanel,
  closePanel,
  zoomActiveMap,
  panActiveMap,
  setViewportPercentage,
  fitActiveMap,
  recordViewport,
  selectClusterSystem,
  moveSystem,
  moveMapObject,
  placeMapObjectInOrbit,
  rotateMapObject,
  resizeMapOrbit,
  rotateMapOrbit,
  moveMapOrbitCenter,
  detachSelectedOrbit,
  submitNames,
  beginChartNamesEdit,
  cancelChartNamesEdit,
  clusterAddType,
  clusterAddError,
  clusterMoveTargeting,
  clusterSystemMovePreview,
  clusterSystemMoveError,
  clusterSystemPositionInputs,
  clusterSystemPositionInputErrors,
  systemObjectMoveAvailable,
  systemObjectMoveDestination,
  systemObjectMoveDestinationOptions,
  systemObjectPositionInput,
  systemObjectPositionXInput,
  systemObjectPositionYInput,
  systemObjectMoveCandidates,
  systemObjectMoveCandidateRequest,
  systemObjectMovePreview,
  systemObjectMoveError,
  updateSystemObjectMoveDestination,
  updateSystemObjectPositionInput,
  updateSystemObjectPositionXInput,
  updateSystemObjectPositionYInput,
  offerObjectMoveCandidates,
  chooseObjectMoveCandidate,
  previewSystemObjectMoveFromInputs,
  confirmSystemObjectMove,
  cancelSystemObjectMovePreview,
  armSystemAdd,
  updateClusterSystemPositionInput,
  addSystemAt,
  addSystemFromInputs,
  previewSystemMoveAt,
  previewSystemMoveFromInputs,
  cancelSystemMovePreview,
  confirmSystemMove,
  showClusterMap,
  selectSystem,
  selectObject,
  selectOrbit,
  selectRoute,
  beginRoute,
  beginRouteEdit,
  deleteSystem,
  deleteSelectedObject,
  deleteSelectedOrbit,
  deleteSelectedRoute,
  deletionReview,
  cancelDeletionReview,
  confirmDeletionReview,
  showChartDetails,
  beginObjectEdit,
  beginOrbitEdit,
  updateOrbitHost,
  previewOrbitPlacement,
  offerOrbitCenterCandidates,
  cancelOrbitPlacementPreview,
  creationSession,
  chooseCreationType,
  chooseCreationCandidate,
  updateCreationInput,
  offerCreationCandidates,
  addCreationFromInputs,
  cancelCreationPreview,
  quitAdd,
  handleCreationDrop: processCreationDrop,
} = useEditorWorkflows({ workspace, saveState, saveError, commit, applyWorkspace })

const fieldDefinitionInspectorConflict = computed(() => {
  const fieldId = fieldDefinitionsSession.selectedId
  return fieldId !== null && isEntityCommandBlocked({ kind: 'definition-mutation', fieldId })
})

function resumeEntitySession(sessionId: number): void {
  const session = entitySession.value
  if (!session || session.id !== sessionId) return
  if (session.kind === 'object') void selectObject(session.targetId)
  else void selectOrbit(session.targetId)
}

function isObjectMoveBlocked(objectId: string): boolean {
  return isEntityCommandBlocked({ kind: 'object-placement', objectId })
}

let objectMoveCandidateRequestId = 0
let orbitCenterCandidateRequestId = 0
let appliedOrbitPreview: { map: NonNullable<typeof systemMapRef.value>; orbitId: string } | null = null
watch(() => [systemMapRef.value, orbitPlacementPreview.value, activeView.value, selectedSystemId.value, entitySession.value] as const,
  ([map, preview, view, systemId, session]) => {
    const activePreview = preview !== null
      && view === 'system'
      && session?.kind === 'orbit'
      && session.id === preview.sessionId
      && session.systemId === systemId
      ? preview
      : null
    if (appliedOrbitPreview && (appliedOrbitPreview.map !== map
      || !activePreview || appliedOrbitPreview.orbitId !== activePreview.orbitId)) {
      appliedOrbitPreview.map.setOrbitPlacementPreview(appliedOrbitPreview.orbitId, null)
      appliedOrbitPreview = null
    }
    if (map && activePreview) {
      map.setOrbitPlacementPreview(activePreview.orbitId, activePreview.preview)
      appliedOrbitPreview = { map, orbitId: activePreview.orbitId }
    }
  }, { flush: 'post', immediate: true })
watch([() => workspace.value?.cluster.id, activeView, selectedSystemId, mapMode], () => {
  objectMoveCandidateRequestId += 1
  orbitCenterCandidateRequestId += 1
}, { flush: 'sync' })

async function handleObjectMoveCandidates(objectId: string, candidates: SystemObjectMoveCandidate[]): Promise<void> {
  const requestId = ++objectMoveCandidateRequestId
  const clusterId = workspace.value?.cluster.id
  const systemId = selectedSystemId.value
  const view = activeView.value
  const mode = mapMode.value
  if (!clusterId || !systemId || view !== 'system' || mode !== 'move') return
  const sourceObject = selectedSystem.value?.objects.find(object => object.id === objectId)
  if (!sourceObject) return
  const sourcePlacement = JSON.stringify(sourceObject.placement)

  await selectObject(objectId, false)
  const latestSystem = selectedSystem.value
  const latestObject = latestSystem?.objects.find(object => object.id === objectId)
  if (requestId !== objectMoveCandidateRequestId
    || workspace.value?.cluster.id !== clusterId
    || activeView.value !== view
    || selectedSystemId.value !== systemId
    || mapMode.value !== mode
    || selectedObjectId.value !== objectId
    || !latestObject
    || JSON.stringify(latestObject.placement) !== sourcePlacement) return

  offerObjectMoveCandidates(objectId, candidates)
}

async function handleOrbitCenterCandidates(orbitId: string, candidates: OrbitCenterMoveCandidate[]): Promise<void> {
  const requestId = ++orbitCenterCandidateRequestId
  const clusterId = workspace.value?.cluster.id
  const systemId = selectedSystemId.value
  const view = activeView.value
  const mode = mapMode.value
  if (!clusterId || !systemId || view !== 'system' || mode !== 'move' || creationSession.value) return
  const sourceOrbit = selectedSystem.value?.orbits.find(orbit => orbit.id === orbitId)
  if (!sourceOrbit || sourceOrbit.hostId !== null) return
  const sourceSnapshot = JSON.stringify(sourceOrbit)
  const startingSession = entitySession.value
  if (startingSession && !(startingSession.kind === 'orbit' && startingSession.targetId === orbitId)) return

  const matchesCurrentContext = (): boolean => requestId === orbitCenterCandidateRequestId
    && workspace.value?.cluster.id === clusterId
    && activeView.value === view
    && selectedSystemId.value === systemId
    && mapMode.value === mode
    && creationSession.value === null
  const sourceIsUnchanged = (): boolean => {
    const current = selectedSystem.value?.orbits.find(orbit => orbit.id === orbitId)
    return current?.hostId === null && JSON.stringify(current) === sourceSnapshot
  }

  await selectOrbit(orbitId, false)
  if (!matchesCurrentContext() || selectedOrbitId.value !== orbitId || !sourceIsUnchanged()) return
  const selectedSession = entitySession.value
  if (selectedSession && !(selectedSession.kind === 'orbit' && selectedSession.targetId === orbitId)) return

  const sessionIdBeforeBegin = entitySession.value?.id ?? null
  await beginOrbitEdit()
  if (creationSession.value) {
    const newlyStarted = entitySession.value
    if (sessionIdBeforeBegin === null && newlyStarted?.kind === 'orbit'
      && newlyStarted.targetId === orbitId && !hasModifiedEntitySession.value) {
      discardEntitySession(newlyStarted.id)
    }
    return
  }
  if (!matchesCurrentContext() || selectedOrbitId.value !== orbitId || !sourceIsUnchanged()) return
  const session = entitySession.value
  if (!session || session.kind !== 'orbit' || session.targetId !== orbitId
    || session.initial.orbit.hostId !== null) return
  if (startingSession?.kind === 'orbit' && startingSession.targetId === orbitId
    && session.id !== startingSession.id) return
  if (!offerOrbitCenterCandidates(session.id, candidates)) return
  requestPanel('inspector')
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
const creationTypeLabel = computed(() => {
  const type = creationSession.value?.type
  if (!type) return ''
  if (type.kind === 'orbit') return 'Orbit'
  return catalogueTypes.find(candidate => candidate.value === type.subtype)?.label ?? type.subtype
})
const dockCloseSignal = computed(() => `${activeView.value}:${selectedSystemId.value ?? ''}:${clusterSelectedSystemId.value ?? ''}:${mapMode.value}:${hierarchyPanelVisible.value}:${inspectorPanelVisible.value}:${isCompactViewport.value}`)
const clusterAddPresentation = computed(() => clusterAddType.value === 'system'
  ? {
      label: 'System',
      status: 'ADD System · Choose a clear map point or use Placement for coordinates.',
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
      ? `MOVE preview · ${systemName} at ${preview.targetPosition.x}, ${preview.targetPosition.y}`
      : `MOVE ${systemName} · Choose a destination or use Placement.`,
    error: clusterSystemMoveError.value || undefined,
    previewing: preview !== null,
  }
})
watch(dockCloseSignal, () => { creationChooserOpen.value = false })
watch([activeView, selectedSystemId], () => {
  if (creationSession.value || clusterAddType.value) quitSystemAdd()
})

function chooseObjectCreationType(subtype: CatalogueSubtype): void {
  chooseCreationType({ kind: 'object', subtype })
  creationChooserOpen.value = false
}

function chooseOrbitCreationType(): void {
  chooseCreationType({ kind: 'orbit' })
  creationChooserOpen.value = false
}

function handleCreationDrop(type: SystemCreationType, candidates: SystemCreationCandidate[]): boolean {
  // Keep the palette mounted through the browser's drop dispatch; close it only after the shared
  // owner has accepted the exact candidate set or exposed an ambiguity for correction.
  const completed = processCreationDrop(type, candidates)
  creationChooserOpen.value = false
  return completed
}

function quitSystemAdd(): void {
  creationChooserOpen.value = false
  quitAdd()
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
  if (clusterMoveTargeting.value) previewSystemMoveAt(point, systemIds)
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

function handleClusterSystemMove(systemId: string, position: Point): void {
  cancelSystemMovePreview()
  moveSystem(systemId, position)
}

function changeMapMode(mode: 'navigate' | 'select' | 'move'): void {
  if (creationSession.value || clusterAddType.value) quitSystemAdd()
  setMapMode(mode)
}

function handleAddEscape(event: KeyboardEvent): void {
  const hasMovePreview = clusterSystemMovePreview.value !== null
  if (event.key !== 'Escape' || event.defaultPrevented
    || (!creationSession.value && !clusterAddType.value && !hasMovePreview && !systemObjectMovePreview.value)
    || creationChooserOpen.value) return
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
  if (document.querySelector('[role="listbox"][data-state="open"]')) return
  if (systemObjectMovePreview.value) {
    event.preventDefault()
    cancelSystemObjectMovePreview()
    return
  }
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
  event.preventDefault()
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
  applyWorkspace,
  getFieldDefinitionImportConflict,
  resolveImportDefinitionChanges,
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

function openImportFieldsDraft(): void {
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
  appliedOrbitPreview?.map.setOrbitPlacementPreview(appliedOrbitPreview.orbitId, null)
  appliedOrbitPreview = null
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
