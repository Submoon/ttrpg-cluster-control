<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <WorkspaceHeader
      v-if="!workspace"
      :workspace="workspace"
      :active-view="activeView"
      :selected-system="selectedSystem"
      :jump-point-count="jumpPoints.length"
      :save-state="saveState"
      :cluster-map="clusterMapRef"
      :system-map="systemMapRef"
      :export-error="exportError"
      @export-cluster-json="downloadClusterJson"
      @export-system-json="downloadSystemJson"
      @export-map-image="downloadMapImage"
      @import-file="importJsonFile"
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

    <ChartNamesDialog
      v-if="workspace"
      :open="chartNamesDialogOpen"
      :guard-mode="transitionGuard"
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
          :compact-modal-open="compactPanelOpen"
          :compact-panel="compactPanel"
          :overlay-open="chartNamesDialogOpen || fieldDefinitionDialogOpen || headerFilesOpen"
          @close-panel="closePanel"
        >
          <template #compact-recovery>
            <section class="workspace-compact-recovery-content" aria-label="Workspace save and recovery">
              <WorkspaceFeedback
                :has-chart-name-draft="hasChartNameDraft"
                :save-state="saveState"
                :save-message="saveMessage"
                :export-error="exportError"
                @resume-chart-draft="beginChartNamesEdit()"
                @retry-save="retryLatestSave"
                @export-current-json="downloadClusterJson"
              />
            </section>
          </template>
          <template #header>
            <WorkspaceHeader
              :workspace="workspace"
              :active-view="activeView"
              :selected-system="selectedSystem"
              :jump-point-count="jumpPoints.length"
              :save-state="saveState"
              :cluster-map="clusterMapRef"
              :system-map="systemMapRef"
              :export-error="exportError"
              :hierarchy-open="hierarchyPanelVisible"
              :inspector-open="inspectorPanelVisible"
              :compact-modal-open="compactPanelOpen"
              @export-cluster-json="downloadClusterJson"
              @export-system-json="downloadSystemJson"
              @export-map-image="downloadMapImage"
              @import-file="importJsonFile"
              @show-cluster="showClusterMap"
              @toggle-hierarchy="togglePanel('hierarchy')"
              @toggle-inspector="togglePanel('inspector')"
              @files-open-change="headerFilesOpen = $event"
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

          <template #dock>
            <WorkspaceDock
              :mode="mapMode"
              :zoom-level="zoomLevel"
              :status="saveMessage"
              @mode-change="setMapMode"
              @zoom-by="zoomActiveMap"
              @zoom-to="setViewportPercentage"
              @fit-map="fitActiveMap"
              @pan-by="panActiveMap"
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
                  :selected-orbit="selectedOrbit"
                  :saving="saveState === 'saving'"
                  @add-object="addObject"
                  @add-orbit="addOrbit"
                />
              </template>
            </WorkspaceDock>
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
                    @drop-orbit="handleOrbitDrop"
                    @drop-object="addObject"
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
                    :is-object-move-blocked="isObjectMoveBlocked"
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
                    @move-orbit-center="moveMapOrbitCenter"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @drop-orbit="handleOrbitDrop"
                    @drop-object="addObject"
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
              :saving="saveState === 'saving'"
              :editor-error="editorError"
              @edit-chart-names="beginChartNamesEdit"
              @show-chart-details="showChartDetails"
              @request-object-edit="beginObjectEdit"
              @save-object="saveObjectEdit"
              @delete-object="deleteSelectedObject"
              @request-orbit-edit="beginOrbitEdit"
              @save-orbit="saveOrbitEdit"
              @detach-orbit="detachSelectedOrbit"
              @delete-orbit="deleteSelectedOrbit"
              @request-route-edit="beginRouteEdit"
              @save-route="submitRoute"
              @cancel-route="restoreRouteSelection"
              @delete-route="deleteSelectedRoute"
              @clear-route-selection="selectedRouteId = null"
              @clear-error="editorError = ''"
            />
          </template>
        </MapEditorLayout>
      </section>
    </main>

    <footer v-if="workspace" :inert="compactPanelOpen || undefined" class="workspace-feedback flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] px-4 py-2.5" aria-label="Workspace feedback and recovery">
      <WorkspaceFeedback
        :has-chart-name-draft="hasChartNameDraft"
        :save-state="saveState"
        :save-message="saveMessage"
        :export-error="exportError"
        @resume-chart-draft="beginChartNamesEdit()"
        @retry-save="retryLatestSave"
        @export-current-json="downloadClusterJson"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
  compactPanelOpen,
  compactPanel,
  zoomLevel,
  selectedSystem,
  selectedObject,
  selectedOrbit,
  selectedRoute,
  jumpPoints,
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
  saveObjectEdit,
  addObject,
  addOrbit,
  handleOrbitDrop,
  saveOrbitEdit,
  createCustomField,
  saveFieldDefinitionChanges,
  removeFieldDefinition,
} = useEditorWorkflows({ workspace, saveState, saveError, commit, applyWorkspace })

function isObjectMoveBlocked(objectId: string): boolean {
  return mapInspectorRef.value?.isEditingObject(objectId) ?? false
}

function handleBlockedObjectMove(objectId: string): void {
  if (!isObjectMoveBlocked(objectId)) return
  editorError.value = 'Save or cancel this object draft before moving it.'
  requestPanel('inspector')
}

const headerFilesOpen = ref(false)

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
  void hydrate()
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeLeaving))

async function retryLatestSave(): Promise<void> {
  try {
    await retrySaveLatest()
  } catch {
    // The persistence owner already exposes the current failure through saveError/saveState.
  }
}
</script>

<style src="../assets/css/map-workspace.css"></style>
