<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <WorkspaceHeader
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
        <div v-if="activeView === 'cluster'" class="cluster-map-header">
          <div class="map-tools cluster-map-tools">
            <section class="object-palette cluster-edit-palette" role="region" aria-label="Cluster editing palette">
              <div class="object-palette-heading">
                <span class="section-kicker">ADD TO CLUSTER</span>
              </div>
              <div class="object-palette-controls">
                <button class="object-palette-button" type="button" aria-label="Add star system" @click="createSystem">
                  <span aria-hidden="true">+</span> Add system
                </button>
                <button class="object-palette-button" type="button" aria-label="Add Jump Route" @click="beginRoute">
                  <span aria-hidden="true">+</span> Add Jump Route
                </button>
              </div>
            </section>
          </div>
        </div>
        <div v-else class="system-map-header">
          <div class="map-tools system-map-tools">
            <ObjectPalette
              :selected-orbit="selectedOrbit"
              :saving="saveState === 'saving'"
              @add-object="addObject"
              @add-orbit="addOrbit"
            />
          </div>
        </div>

        <MapEditorLayout
          :mode="activeView"
          :hierarchy-label="activeView === 'cluster' ? 'Jump Cluster contents' : 'System hierarchy'"
          :inspector-label="activeView === 'cluster' ? 'Jump Route inspector' : 'Object inspector'"
        >
          <template #hierarchy>
            <MapHierarchy
              :mode="activeView"
              :workspace="workspace"
              :selected-system-id="selectedSystemId"
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
                  <ClusterMap
                    v-if="activeView === 'cluster'"
                    ref="clusterMapRef"
                    :cluster="workspace.cluster"
                    :system-positions="workspace.layout.systemPositions"
                    :selected-system-id="selectedSystemId"
                    :selected-route-id="selectedRouteId"
                    @open-system="selectSystem"
                    @select-route="selectRoute"
                    @move-system="moveSystem"
                  />
                  <SystemMap
                    v-else-if="selectedSystem"
                    ref="systemMapRef"
                    :system="selectedSystem"
                    :orbit-radii="workspace.layout.orbitRadii"
                    :orbit-rotations="workspace.layout.orbitRotations"
                    :object-angles="workspace.layout.objectAngles"
                    :selected-object-id="selectedObjectId"
                    :selected-orbit-id="selectedOrbitId"
                    @select-object="selectObject"
                    @select-orbit="selectOrbit"
                    @move-object="moveMapObject"
                    @move-orbit-center="moveMapOrbitCenter"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @drop-orbit="handleOrbitDrop"
                    @drop-object="addObject"
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

    <footer v-if="workspace" class="workspace-feedback flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] px-4 py-2.5" aria-label="Workspace feedback and recovery">
      <div v-if="hasChartNameDraft" class="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span class="feedback">Unapplied chart-name changes</span>
        <UButton class="resume-chart-draft" color="neutral" variant="outline" size="sm" @click="beginChartNamesEdit">
          Resume chart name draft
        </UButton>
      </div>
      <span
        class="save-feedback p-0 text-sm"
        :class="{ 'error-text': saveState === 'error', 'saved-text': saveState === 'saved' }"
        :role="saveState === 'error' ? 'alert' : 'status'"
        :aria-live="saveState === 'error' ? 'assertive' : 'polite'"
      >
        <span class="inline-block size-[0.4rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
        {{ saveMessage }}
      </span>
      <div v-if="saveState === 'error'" class="flex flex-wrap items-center gap-2">
        <UButton color="primary" variant="outline" size="sm" @click="retryLatestSave">Retry save</UButton>
        <UButton color="neutral" variant="outline" size="sm" @click="downloadClusterJson">Export current Jump Cluster JSON</UButton>
      </div>
      <p v-if="exportError" class="feedback m-0 error-text" role="alert" aria-live="assertive">
        Export failed: {{ exportError }}
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import ChartNamesDialog from './ChartNamesDialog.vue'

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
  activeView,
  selectedSystemId,
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
