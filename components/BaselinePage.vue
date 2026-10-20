<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <WorkspaceHeader v-if="!workspace" :workspace="workspace" />

    <ChartNamesDialog
      v-if="workspace"
      :open="chartNamesDialogOpen"
      :guard-mode="transitionGuard"
      :has-modified-entity-session="hasModifiedEntitySession"
      v-model:cluster-name="clusterName"
      v-model:system-name="systemName"
      :form-error="formError"
      :target-system-name="chartDraftSystemName"
      @update:open="setChartNamesDialogOpen"
      @apply="submitNames"
      @discard="cancelChartNamesEdit"
      @resolve-transition="resolveTransitionChoice"
    />

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
          :compact-modal-open="compactPanelOpen"
          :compact-panel="compactPanel"
          :overlay-open="chartNamesDialogOpen || fieldDefinitionDialogOpen || headerFilesOpen || recoveryDetailsOpen"
          :is-compact-viewport="isCompactViewport"
          @close-panel="closePanel"
        >
          <template #compact-recovery>
            <section class="workspace-compact-recovery-content" aria-label="Workspace save and recovery">
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
                  :workspace="workspace"
                  :saving="saveState === 'saving'"
                  :save-error="fieldDefinitionError"
                  :save-revision="fieldDefinitionSaveRevision"
                  @request-open="openFieldDefinitions"
                  @open-change="fieldDefinitionDialogOpen = $event"
                  @clear-error="fieldDefinitionError = ''"
                  @create-custom-field="createCustomField"
                  @save-field-definition="saveFieldDefinitionChanges"
                  @remove-field-definition="removeFieldDefinition"
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
              @export-cluster-json="downloadClusterJson"
              @export-system-json="downloadSystemJson"
              @export-map-image="downloadMapImage"
              @import-file="importJsonFile"
              @show-cluster="showClusterMap"
              @toggle-hierarchy="togglePanel('hierarchy')"
              @toggle-inspector="togglePanel('inspector')"
              @files-open-change="headerFilesOpen = $event"
              @quit-add="quitSystemAdd"
            />
          </template>

          <template #dock>
            <WorkspaceDock
              :mode="mapMode"
              :close-signal="dockCloseSignal"
              v-model:add-open="creationChooserOpen"
              :creation-session="activeView === 'system' ? creationSession : null"
              :creation-type-label="creationTypeLabel"
              :selected-system="selectedSystem"
              @mode-change="changeMapMode"
              @update-creation-input="updateCreationInput"
              @preview-creation-from-inputs="previewCreationFromInputs"
              @confirm-creation="confirmCreation"
              @choose-creation-candidate="chooseCreationCandidate"
              @cancel-creation-preview="cancelCreationPreview"
            >
              <template #add="{ close }">
                <template v-if="activeView === 'cluster'">
                  <button class="workspace-control tool-button" type="button" aria-label="Add star system" @click="createSystem(); close()">
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
                    @move-system="moveSystem"
                    @move-object="moveMapObject"
                    @move-orbit-center="moveMapOrbitCenter"
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
                    @object-move-blocked="handleBlockedObjectMove"
                    @entity-command-blocked="handleBlockedEntityCommand"
                    @move-orbit-center="moveMapOrbitCenter"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @creation-target="offerCreationCandidates"
                    @creation-drop-target="handleCreationDrop"
                    @cancel-creation-preview="cancelCreationPreview"
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
                <span>KNOWN SYSTEMS / ROUTES / EXTERNAL EXITS</span>
                <span>Select a system to open it, or a route to inspect its endpoints.</span>
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
              :selected-route-summary="selectedRoute ? routeEndpointSummary(selectedRoute) : ''"
              :has-chart-name-draft="hasChartNameDraft"
              :has-uncommitted-names="hasUncommittedNames"
              :entity-session="entitySession"
              :has-modified-entity-session="hasModifiedEntitySession"
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
              @detach-orbit="detachSelectedOrbit"
              @delete-orbit="deleteSelectedOrbit"
              @request-route-edit="beginRouteEdit"
              @save-route="submitRoute"
              @cancel-route="restoreRouteSelection"
              @delete-route="deleteSelectedRoute"
              @clear-route-selection="selectedRouteId = null"
              @clear-error="editorError = ''"
              @resume-chart-draft="beginChartNamesEdit()"
              @retry-save="retryLatestSave"
              @export-current-json="downloadClusterJson"
            />
          </template>
        </MapEditorLayout>
      </section>
    </main>

  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { catalogueTypes, type CatalogueSubtype, type ObjectFamily } from '../domain/workspace'
import type {
  EntityCommand,
  SystemCreationCandidate,
  SystemCreationType,
} from '../composables/editor-workflows/types'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import ChartNamesDialog from './ChartNamesDialog.vue'
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
  fieldDefinitionSaveRevision,
  fieldDefinitionsDialog,
  formError,
  editorError,
  entitySession,
  hasModifiedEntitySession,
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
  openFieldDefinitions,
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
  captureImportOrigin,
  selectImportedWorkspace,
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
  createSystem,
  showClusterMap,
  selectSystem,
  selectObject,
  selectOrbit,
  selectRoute,
  beginRoute,
  beginRouteEdit,
  restoreRouteSelection,
  submitRoute,
  deleteSystem,
  deleteSelectedObject,
  deleteSelectedOrbit,
  deleteSelectedRoute,
  showChartDetails,
  beginObjectEdit,
  beginOrbitEdit,
  creationSession,
  chooseCreationType,
  chooseCreationCandidate,
  updateCreationInput,
  offerCreationCandidates,
  previewCreationFromInputs,
  confirmCreation,
  cancelCreationPreview,
  quitAdd,
  handleCreationDrop: processCreationDrop,
  createCustomField,
  saveFieldDefinitionChanges,
  removeFieldDefinition,
} = useEditorWorkflows({ workspace, saveState, saveError, commit, applyWorkspace })

function resumeEntitySession(sessionId: number): void {
  const session = entitySession.value
  if (!session || session.id !== sessionId) return
  if (session.kind === 'object') void selectObject(session.targetId)
  else void selectOrbit(session.targetId)
}

function isObjectMoveBlocked(objectId: string): boolean {
  return isEntityCommandBlocked({ kind: 'object-placement', objectId })
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
const dockCloseSignal = computed(() => `${activeView.value}:${selectedSystemId.value ?? ''}:${hierarchyPanelVisible.value}:${inspectorPanelVisible.value}:${isCompactViewport.value}`)
watch(dockCloseSignal, () => { creationChooserOpen.value = false })
watch([activeView, selectedSystemId], () => {
  if (creationSession.value) quitSystemAdd()
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

function changeMapMode(mode: 'navigate' | 'select' | 'move'): void {
  if (creationSession.value && mode !== mapMode.value) cancelCreationPreview()
  setMapMode(mode)
}

function handleAddEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || !creationSession.value || creationChooserOpen.value) return
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
  const target = event.target
  if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
  event.preventDefault()
  quitSystemAdd()
}

const {
  exportError,
  importError,
  downloadClusterJson,
  downloadSystemJson,
  downloadMapImage,
  importJsonFile,
} = useWorkspaceFiles({
  workspace,
  selectedSystem,
  commit,
  resolveTransition,
  captureImportOrigin,
  onImported: selectImportedWorkspace,
})

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  const changedWelcomeDraft = !workspace.value
    && (clusterName.value.trim() !== 'New Jump Cluster' || systemName.value.trim() !== 'First System')
  const appliedWorkspaceIsNotDurable = !!workspace.value && (saveState.value === 'saving' || saveState.value === 'error')
  if (!changedWelcomeDraft && !hasUncommittedNames.value && !appliedWorkspaceIsNotDurable) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', warnBeforeLeaving)
  window.addEventListener('keydown', handleAddEscape)
  void hydrate()
})

onBeforeUnmount(() => {
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
