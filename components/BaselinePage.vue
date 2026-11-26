<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <WorkspaceHeader v-if="!workspace" :workspace="workspace" show-privacy-link />
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      <span v-if="toastAnnouncement" :key="toastAnnouncement.id">{{ toastAnnouncement.text }}</span>
    </div>

    <main id="workspace-main" ref="workspaceMain" tabindex="-1" class="main-content mx-auto flex w-full max-w-[1720px] flex-1 flex-col self-center pb-8 pt-[clamp(1rem,2.1vw,1.75rem)]">
      <p v-if="cloudBackupMessage && !googleDriveBackupDialogOpen" class="feedback m-0 break-words" role="status">
        {{ cloudBackupMessage }}
      </p>
      <p v-if="dropboxBackupMessage" class="feedback m-0 break-words" role="status">
        {{ dropboxBackupMessage }}
      </p>
      <p v-if="dropboxRestore.message.value && !dropboxRestore.dialogOpen.value" class="feedback m-0 break-words" role="status">
        {{ dropboxRestore.message.value }}
      </p>
      <p
        v-if="(mapMode === 'select' || mapMode === 'move') && selectedObjectIds.length > 1 && moveSelectionError"
        class="feedback m-0 error-text"
        role="alert"
        aria-live="assertive"
      >{{ moveSelectionError }}</p>
      <p v-if="importError" class="feedback m-0 error-text" role="alert">{{ importError }}</p>
      <p v-if="workspaceRestoreError" class="feedback m-0 error-text" role="alert">{{ workspaceRestoreError }}</p>
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
        :restore-loading="localWorkspaceRestoreLoading"
        @retry="retryWorkspaceHydration"
        @restore-backup="restoreLastValidWorkspace"
        @restore-file="openLocalWorkspaceRestore"
        @submit="submitNames"
      >
        <template #restore-actions>
          <GoogleDriveRestoreButton
            :controller="googleDriveRestore"
            :sign-in="googleDriveSignIn"
            surface="welcome"
            :backup-in-progress="dropboxRestore.dialogOpen.value"
            :review-open="workspaceRestoreReview !== null"
            :fallback-focus-target="workspaceMain"
            @restore-review-open="workspaceRestoreReturnTarget = $event"
            @restore-canceled="workspaceRestoreReturnTarget = null"
          />
          <DropboxRestoreDialog
            :controller="dropboxRestore"
            :available="dropboxSignIn.ready.value"
            :blocked="dropboxRestoreBlocked"
            surface="welcome"
            :review-open="workspaceRestoreReview !== null"
            :fallback-focus-target="workspaceMain"
            @restore-review-open="workspaceRestoreReturnTarget = $event"
            @restore-canceled="workspaceRestoreReturnTarget = null"
          />
        </template>
      </WorkspaceWelcome>
      <section v-else-if="workspace" class="editor">
          <MapEditorLayout
          mode="cluster"
          :hierarchy-label="activeView === 'cluster' ? 'Jump Cluster contents' : 'Zone hierarchy'"
          :inspector-label="inspectorLabel"
          :hierarchy-visible="hierarchyPanelVisible"
          :inspector-visible="inspectorPanelVisible"
          :entity-inspector-active="!chartEditing && (inspectorMode === 'system' || Boolean(inspectorRouteObjectContext)) && Boolean(inspectorSelectedObject || inspectorSelectedOrbit)"
          :route-session-active="!chartEditing && activeView === 'cluster' && routeSession !== null"
          :compact-modal-open="compactPanelPresentationOpen"
          :compact-panel="compactPanel"
          :overlay-open="chartNamesDialogOpen || fieldDefinitionDialogOpen || headerFilesOpen || mobileMenuOpen || recoveryDetailsOpen || historyCapacityRequest !== null || historyOpen || playerPreviewOpen || searchOpen || mapTypeFiltersOpen || helpOpen || publicationMenuRequest !== null || creationChooserOpen || continuousObjectOwnerChooserOpen || continuousObjectOtherTypeOpen || routeTransferReview !== null || catalogueTransferForm !== null"
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
          <template #header>
            <WorkspaceHeader
              ref="workspaceHeader"
              :workspace="wardenDraftWorkspace ?? workspace"
              :active-view="activeView"
              :selected-system="selectedSystem"
              :compact-modal-open="compactPanelPresentationOpen"
              :is-compact-viewport="isCompactViewport"
              v-model:mobile-menu-open="mobileMenuOpen"
              :has-field-draft="hasModifiedFieldDefinitionsSession"
              show-privacy-link
              @open-fields="openFieldsFromMobileMenu"
              @open-help="openHelpFromMobileMenu"
            >
              <template #editor-actions>
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
                  :hide-trigger="isCompactViewport"
                  :focus-fallback="focusMobileWorkspaceMenu"
                  @intent="handleFieldDefinitionsIntent"
                />
                <WorkspaceMapHelp
                  v-model:open="helpOpen"
                  :external-opener="mobileHelpOpener"
                  :focus-fallback="focusMobileWorkspaceMenu"
                  @active-change="onHelpActiveChange"
                />
              </template>
            </WorkspaceHeader>
          </template>

          <template #map-chrome>
            <WorkspaceMapChrome
              ref="workspaceMapChrome"
              :workspace="workspace"
              :active-view="activeView"
              continuous-map
              :selected-image-system-id="continuousInspectorSystemId"
              :selected-system="selectedSystem"
              :cluster-map="clusterMapRef"
              :system-map="systemMapRef"
              :export-error="exportError"
              :restore-loading="localWorkspaceRestoreLoading"
              :player-export-error="playerExportError"
              :generated-player-url="generatedPlayerUrl"
              :player-link-busy="playerLinkBusy"
              :player-link-status="playerLinkStatus"
              :hierarchy-open="hierarchyPanelVisible"
              :inspector-open="inspectorPanelVisible"
              :compact-modal-open="compactPanelOpen"
              :creation-session="creationSession"
              :creation-type-label="creationTypeLabel"
              :cluster-add-presentation="clusterAddPresentation"
              :cluster-move-presentation="clusterMovePresentation"
              :can-open-search-shortcut="canOpenSearchShortcut"
              :filter-criteria="filterCriteria"
              :cloud-backup-items="cloudBackupItems"
              :cloud-restore-items="cloudRestoreItems"
              :is-compact-viewport="isCompactViewport"
              v-model:search-open="searchOpen"
              v-model:search-query="searchQuery"
              v-model:type-filters-open="mapTypeFiltersOpen"
              :search-results="searchOpen ? searchResults : noSearchResults"
              :reveal-search-target="revealSearchTarget"
              @export-cluster-json="downloadClusterJson"
              @export-system-json="downloadSystemJson"
              @export-map-image="downloadMapImage"
              @export-player-json="downloadPlayerJson"
              @export-player-image="downloadPlayerImage"
              @preview-player-view="openPlayerPreview"
              :generate-player-link="generatePlayerLink"
              @copy-player-link="copyPlayerLink"
              @import-file="handleWorkspaceJsonImport"
              @restore-file="openLocalWorkspaceRestore"
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
            <UModal
              v-model:open="googleDriveBackupDialogOpen"
              title="Back up Jump Cluster to Google Drive"
              description="Review the backup retention notice before saving this Jump Cluster to your private Google Drive storage."
              :content="{ onCloseAutoFocus: restoreBackupDialogFocus }"
            >
              <template #body>
                <p
                  v-if="cloudBackupMessage"
                  class="m-0 mb-3 break-words text-sm"
                  :class="googleDriveBackup.message.value ? 'error-text' : 'text-muted'"
                  role="status"
                >{{ cloudBackupMessage }}</p>
                <GoogleDriveBackupButton
                  :controller="googleDriveBackup"
                  :sign-in="googleDriveSignIn"
                  :restore-in-progress="googleDriveRestore.busy.value || googleDriveRestore.dialogOpen.value"
                />
              </template>
              <template #footer>
                <div class="flex w-full justify-end">
                  <UButton color="neutral" variant="ghost" @click="googleDriveBackupDialogOpen = false">Close</UButton>
                </div>
              </template>
            </UModal>
            <UModal
              v-model:open="continuousObjectOwnerChooserOpen"
              title="Choose the owning Zone"
              description="The Add target overlaps Zones or falls outside every Zone. Choose the owning Zone."
              @update:open="onContinuousObjectOwnerChooserOpenChange"
            >
              <template #body>
                <div class="grid gap-2">
                  <UButton
                    v-for="systemId in addOwnerChoiceIds"
                    :key="systemId"
                    color="neutral"
                    variant="outline"
                    class="justify-start"
                    :aria-label="`Add ${orbitAddArmed ? 'Orbit' : continuousObjectAddLabel} to ${continuousObjectOwnerName(systemId)}`"
                    @click="chooseAddOwner(systemId)"
                  >
                    {{ continuousObjectOwnerName(systemId) }}
                  </UButton>
                </div>
                <p v-if="editorError" class="m-0 mt-3 error-text" role="alert">{{ editorError }}</p>
              </template>
              <template #footer>
                <div class="flex w-full justify-end">
                  <UButton color="neutral" variant="ghost" @click="cancelContinuousObjectOwnerChoice">Cancel</UButton>
                </div>
              </template>
            </UModal>
            <UModal
              v-model:open="continuousObjectOtherTypeOpen"
              title="Name this object type"
              description="Enter the label to use for this Other object type."
              @update:open="onContinuousObjectOtherTypeOpenChange"
            >
              <template #body>
                <form class="grid gap-3" @submit.prevent="confirmContinuousObjectOtherType">
                  <UFormField label="Type name" :error="continuousObjectOtherTypeError">
                    <UInput
                      v-model="continuousObjectOtherTypeName"
                      aria-label="Type name"
                      autocomplete="off"
                    />
                  </UFormField>
                  <p v-if="continuousObjectOtherTypeError" class="m-0 error-text" role="alert">
                    {{ continuousObjectOtherTypeError }}
                  </p>
                </form>
              </template>
              <template #footer>
                <div class="flex w-full justify-end gap-2">
                  <UButton color="neutral" variant="ghost" @click="cancelContinuousObjectOtherType">Cancel</UButton>
                  <UButton color="primary" @click="confirmContinuousObjectOtherType">Start Add</UButton>
                </div>
              </template>
            </UModal>
            <GoogleDriveRestoreButton
              ref="googleDriveRestoreButton"
              :controller="googleDriveRestore"
              :sign-in="googleDriveSignIn"
              surface="menu"
              :backup-in-progress="cloudBackupInProgress || dropboxRestore.dialogOpen.value"
              :review-open="workspaceRestoreReview !== null"
              :fallback-focus-target="workspaceMain"
              @restore-review-open="workspaceRestoreReturnTarget = $event"
              @restore-canceled="workspaceRestoreReturnTarget = null"
            />
            <DropboxRestoreDialog
              ref="dropboxRestoreDialog"
              :controller="dropboxRestore"
              :available="dropboxSignIn.ready.value"
              :blocked="dropboxRestoreBlocked"
              surface="menu"
              :review-open="workspaceRestoreReview !== null"
              :fallback-focus-target="workspaceMain"
              @restore-review-open="workspaceRestoreReturnTarget = $event"
              @restore-canceled="workspaceRestoreReturnTarget = null"
            />
          </template>

          <template #dock>
            <WorkspaceDock
              ref="workspaceDockRef"
              v-model:add-open="creationChooserOpen"
              :creation-session="creationSession"
              :creation-type-label="creationTypeLabel"
              :cluster-add-label="standaloneImportPlacementEnabled ? null : clusterAddPresentation?.label ?? null"
              :cluster-move-targeting="!standaloneImportPlacementEnabled && clusterMoveTargeting && clusterAddType === null"
              :system-object-move-available="systemObjectMoveAvailable"
              :system-object-move-destination="systemObjectMoveDestination"
              :system-object-move-destination-options="systemObjectMoveDestinationOptions"
              :system-object-move-candidates="systemObjectMoveCandidates"
              :system-object-move-candidate-request="systemObjectMoveCandidateRequest"
              :system-object-move-preview="systemObjectMovePreview"
              :system-object-move-error="systemObjectMoveError"
              :unresolved-exit-available="!standaloneImportPlacementEnabled && unresolvedExitAvailable"
              :unresolved-exit-preview="standaloneImportPlacementEnabled ? null : unresolvedExitPreview"
              :unresolved-exit-error="standaloneImportPlacementEnabled ? '' : unresolvedExitError"
              :orbit-center-move-available="!standaloneImportPlacementEnabled && orbitCenterMoveAvailable"
              :orbit-center-map-move-targeting="!standaloneImportPlacementEnabled && orbitCenterMapMoveTargeting"
              :orbit-center-move-preview="standaloneImportPlacementEnabled ? null : orbitCenterMovePreview"
              :orbit-center-move-error="standaloneImportPlacementEnabled ? '' : orbitCenterMoveError"
              :selected-system="creationSystem"
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
                <ObjectPalette
                  v-model:active-family="objectPaletteActiveFamily"
                  :saving="saveState === 'saving'"
                  @add-object="chooseObjectCreationType"
                  @add-orbit="chooseOrbitCreationType"
                />
                <section class="object-palette" aria-label="Cluster creation">
                  <span class="section-kicker">ADD TO CLUSTER</span>
                  <div class="object-palette-controls">
                    <UButton
                      class="object-palette-button"
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-orbit"
                      @click="armSystemAddAndClose(close)"
                    >
                      Add Zone
                    </UButton>
                    <UButton
                      class="object-palette-button"
                      type="button"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-network"
                      @click="beginRouteAndClose(close)"
                    >
                      Add Jump Route
                    </UButton>
                  </div>
                </section>
              </template>
              <template #placement>
                <div
                  v-if="standaloneImportPlacementEnabled"
                  class="workspace-dock-placement-controls"
                  role="group"
                  aria-label="Standalone Zone placement controls"
                  @keydown.esc.stop.prevent="handleStandaloneImportPlacementEscape"
                >
                  <span class="workspace-dock-placement-instruction">
                    Click map or focus it and press Enter to place {{ standaloneImportPlacement?.system.name ?? 'the imported system' }}; arrows pan; Escape cancels.
                  </span>
                  <UButton size="xs" color="neutral" variant="soft" @click="frameStandaloneImportPlacement">Frame preview</UButton>
                  <UButton size="xs" color="primary" @click="reviewStandaloneImportPlacement">Review placement</UButton>
                  <UButton size="xs" color="neutral" variant="ghost" @click="cancelStandaloneImportPlacement">Cancel</UButton>
                </div>
              </template>
            </WorkspaceDock>
          </template>

          <template #zoom>
            <WorkspaceZoomControls
              :zoom-level="zoomLevel"
              :minimum-zoom-level="minimumZoomLevel"
              :system-relative="continuousMap && activeView === 'cluster'"
              :center-available="inspectedTarget !== null"
              :compact-modal-open="compactPanelOpen"
              @zoom-by="zoomActiveMap"
              @zoom-to="setViewportPercentage"
              @fit-map="fitActiveMap"
              @center-map="centerInspectedTarget"
              @pan-by="panActiveMap"
            />
          </template>

          <template #hierarchy>
            <MapHierarchy
              :workspace="wardenDraftWorkspace ?? workspace"
              continuous-map
              :inspected-target="inspectedTarget"
              :dimmed-object-ids="dimmedMapObjectIds"
              :has-chart-name-draft="hasChartNameDraft"
            />
          </template>

          <template #map>
            <section
              class="panel map-panel flex min-w-0 flex-col p-[0.7rem]"
              aria-label="Jump Cluster map workspace"
            >
              <div
                class="map-frame workspace-canvas flex min-h-0 min-w-0 overflow-hidden bg-[var(--map-bg)]"
              >
                <ClientOnly>
                  <WorkspaceMapCanvas
                    :key="`${workspace.id}:${activeMapKey ?? 'cluster-map'}`"
                    ref="clusterMapRef"
                    @editing-gesture-change="mapControls.setEditingGestureActive"
                    active-view="cluster"
                    continuous-map
                    :standalone-import-placement-enabled="standaloneImportPlacementEnabled"
                    :standalone-import-placement="standaloneImportPlacement"
                    :keyboard-owned-overlay-open="mapKeyboardOverlayOpen"
                    :inspected-target="inspectedTarget"
                    :dimmed-object-ids="dimmedMapObjectIds"
                    :applied-dimmed-object-ids="dimmedAppliedObjectIds"
                    :map-key="activeMapKey ?? ''"
                    :initial-viewport="initialViewport"
                    :workspace="workspace"
                    :draft-workspace="wardenDraftWorkspace"
                    :system="selectedSystem"
                    :selected-system-id="clusterSelectedSystemId"
                    :selected-object-id="selectedObjectId"
                    :selected-object-ids="selectedObjectIds"
                    :selected-orbit-id="selectedOrbitId"
                    :selected-route-id="selectedRouteId"
                    :mode="mapMode"
                    :route-object-editing-id="routeObjectSession?.targetId"
                    :creation-type="standaloneImportPlacementEnabled ? null : mapCreationType"
                    :orbit-creation-preview="orbitCreationPreview"
                    :creation-other-type="continuousObjectAddType === 'other' ? continuousObjectAddOtherType : null"
                    :object-add-pinned-owner-id="continuousObjectPinnedOwnerId"
                    :creation-preview="creationSession?.preview ?? null"
                    :creation-chooser-open="creationChooserOpen"
                    :cluster-add-type="standaloneImportPlacementEnabled ? null : clusterAddType"
                    :cluster-move-targeting="!standaloneImportPlacementEnabled && clusterSystemMapMoveTargeting && clusterAddType === null"
                    :move-targeting="!standaloneImportPlacementEnabled && mapMoveTargeting"
                    :cluster-chooser-open="creationChooserOpen || continuousObjectOwnerChooserOpen || continuousObjectOtherTypeOpen || routeTransferReview !== null || catalogueTransferForm !== null"
                    :is-entity-command-blocked="isEntityCommandBlocked"
                    :orbit-adjustment-preview="orbitAdjustmentPreview"
                    :system-object-transfer-preview="transferMapPreview"
                    :system-object-transfer-map-lease="transferMapPlacementLease"
                    :feedback-element="workspaceFeedbackRef"
                    @select-cluster-system="selectClusterSystem"
                    @move-select-cluster-system="selectClusterSystem($event, false)"
                    @select-continuous-object="(systemId: string, objectId: string, openInspector?: boolean) => inspectContinuousTarget({ kind: 'object', systemId, objectId }, openInspector)"
                    @select-continuous-orbit="(systemId: string, orbitId: string, openInspector?: boolean) => inspectContinuousTarget({ kind: 'orbit', systemId, orbitId }, openInspector)"
                    @select-route="selectRoute"
                    @select-route-object="inspectRouteObject"
                    @move-select-route="selectRoute($event, false)"
                    @select-object="selectObject"
                    @move-select-object="selectObject($event, false)"
                    @select-orbit="selectOrbit"
                    @move-select-orbit="selectOrbit($event, false)"
                    @move-system="handleClusterSystemMove"
                    @move-unresolved-exit="moveUnresolvedExit"
                    @move-target="handleMapMoveTarget"
                    @move-nudge="handleMapMoveNudge"
                    @standalone-import-placement-anchor="previewStandaloneImportAnchor"
                    @cancel-standalone-import-placement="cancelStandaloneImportPlacement"
                    @cancel-map-move="cancelMapMove"
                    @cluster-target="handleClusterTarget"
                    @continuous-object-add-target="handleContinuousObjectAddTarget"
                    @continuous-orbit-add-target="handleOrbitAddTarget"
                    @move-object-in-system="handleContinuousObjectMove"
                    @move-route-object="placeRouteObject"
                    @resize-system-frame="resizeSystemFrame"
                    @transfer-object-on-drop="transfer.dropObject"
                    @orbit-adjustment="updateOrbitAdjustment"
                    @entity-command-blocked="handleBlockedEntityCommand"
                    @cancel-cluster-preview="cancelClusterPlacement"
                    @move-object="moveMapObject"
                    @move-orbit-center="handleMapOrbitCenterMove"
                    @orbit-center-candidates="placement.interactions.handleOrbitCenterCandidates"
                    @rotate-object="rotateMapObject"
                    @resize-orbit="resizeMapOrbit"
                    @rotate-orbit="rotateMapOrbit"
                    @place-object-in-orbit="placeMapObjectInOrbit"
                    @viewport-change="recordViewport($event.key, $event.viewport)"
                    @system-transfer-placement-preview="transfer.previewMapPlacement($event.lease, $event.placement)"
                    @system-transfer-placement-complete="transfer.completeMapPlacement($event.lease, $event.placement)"
                    @system-transfer-placement-cancel="transfer.handleIntent({ kind: 'cancel-map-placement', sessionId: $event.sessionId, lease: $event })"
                  />
                  <template #fallback>
                    <div class="map-fallback grid min-h-[31rem] w-full place-items-center max-[760px]:min-h-96" role="status">
                      Preparing the Jump Cluster chart...
                    </div>
                  </template>
                </ClientOnly>
              </div>
              <p v-if="activeView === 'cluster' && (continuousObjectAddType || clusterAddType || clusterMoveTargeting)" class="map-note mb-[1em] flex justify-between gap-3 px-[0.2rem] pt-[0.55rem] pb-[0.1rem] max-[760px]:flex-col">
                <span>{{ continuousObjectAddType ? `ADD ${continuousObjectAddLabel.toUpperCase()} / CHOOSE A ZONE OR JUMP ROUTE` : clusterAddType === 'system' ? 'ADD ZONE / OPEN CLUSTER SPACE' : clusterAddType === 'route' ? 'ADD JUMP ROUTE / CHOOSE ZONES' : 'MOVE ZONE / CHOOSE A DESTINATION' }}</span>
                <span>{{ continuousObjectAddType ? 'Choose a Jump Route or a position within a Zone. Focus a route and press Enter to add at its midpoint.' : clusterAddType === 'system' ? 'Choose clear Cluster space, or pan with the arrow keys and press Enter.' : clusterAddType === 'route' ? 'Choose a Zone for each endpoint; local Jump Points are optional.' : 'Choose Move selected Zone on map, then click or use the arrow keys to preview.' }}</span>
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
              :mode="inspectorMode"
              :workspace="workspace"
              system-transfer-enabled
              :route-transfer-enabled="routeTransferAvailable"
              :publication-busy="publicationBusy"
              :selected-system="inspectorSelectedSystem"
              :draft-system="wardenSystem"
              :inspected-cluster-system="inspectorSelectedSystem"
              :selected-object="inspectorSelectedObject"
              :route-object-context="routeSession?.routeId === null ? undefined : inspectorRouteObjectContext"
              :route-object-session="routeObjectSession"
              :selected-object-count="selectedObjectIds.length"
              :object-focus-request="objectInspectorFocusRequest"
              :inspector-visible="inspectorPanelVisible"
              :selected-orbit="inspectorSelectedOrbit"
              :selected-route="selectedRoute"
              :route-session="routeSession"
              :selected-route-summary="selectedRoute ? wardenRouteSummary(selectedRoute) : ''"
              :has-chart-name-draft="hasChartNameDraft"
              :chart-editing="chartEditing"
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
              :system-transfer-session="systemTransferSession"
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
              @set-route-sharing="setRouteSharing"
              @update-route-input="updateRouteInput"
              @reverse-route-endpoints="reverseRouteEndpoints"
              @choose-route-system="chooseRouteSystem"
              @choose-route-point="chooseRoutePoint"
              @apply-route-session="applyRouteSession"
              @discard-route-session="discardRouteDraft"
              @delete-route="deleteSelectedRoute"
              @clear-error="editorError = ''"
              @resume-chart-draft="beginChartNamesEdit()"
              @retry-save="retryLatestSave"
              @export-current-json="downloadClusterJson"
              @open-field-definitions="openFieldDefinitions"
              @system-transfer-intent="inspector.handleSystemTransferIntent"
              @place-catalogue-object="openCatalogueTransfer"
            >
              <template #chart-editor>
                <ChartDetailsEditor
                  ref="chartDetailsEditor"
                  v-model:cluster-name="clusterName"
                  v-model:system-name="systemName"
                  v-model:player-title="playerTitle"
                  v-model:publication="publication"
                  :active="inspectorPanelVisible"
                  :form-error="formError"
                  :target-system-name="chartDraftSystemName"
                  @apply="applyChartNames"
                  @discard="discardChartNames"
                />
              </template>
            </MapInspector>
          </template>
        </MapEditorLayout>
        <PublicationContextMenu
          ref="publicationContextMenu"
          :request="publicationMenuRequest"
          :current-mode="publicationMenuMode"
          :route-shared="publicationMenuRouteShared"
          :empty-orbit="publicationMenuOrbitObjects?.length === 0"
          :last-system="publicationMenuRequest?.target.kind === 'system' && workspace.cluster.systems.length === 1"
          :saving="saveState === 'saving'"
          :busy="publicationBusy"
          :move-selection-available="publicationMenuMoveSelectionAvailable"
          @select="selectPublicationMenuMode"
          @share-route="shareRouteFromMenu"
          @edit="editEntityFromMenu"
          @move-selection="moveEntityFromMenu"
          @delete="deleteEntityFromMenu"
          @dismiss="publicationControls.closeMenu()"
        />
      </section>
    </main>

    <CatalogueTransferDialog
      v-if="workspace"
      :workspace="workspace"
      :review="routeTransferReview"
      :form="catalogueTransferForm"
      :suspended="chartNamesDialogOpen || historyCapacityRequest !== null"
      :applying="catalogueTransferApplying"
      :error="catalogueTransferError"
      :opener="catalogueTransferOpener"
      :fallback-focus-target="workspaceMain"
      :route-summary="routeEndpointSummary"
      @cancel="cancelCatalogueTransfer"
      @confirm="transfer.resolveRouteReview(true)"
      @submit="applyCatalogueTransfer"
      @focus-returned="catalogueTransferOpener = null"
    />

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

    <WorkspaceRestoreReview
      :review="workspaceRestoreReview"
      :return-focus-target="workspaceRestoreReturnTarget"
      :fallback-focus-target="workspaceMain"
      @cancel="workspaceRestore.cancel"
      @confirm="workspaceRestore.confirm"
      @download-current="workspaceRestore.downloadReviewedCurrent"
      @update:discard-drafts-confirmed="workspaceRestore.setDiscardDraftsConfirmed"
      @focus-returned="workspaceRestoreReturnTarget = null"
    />

    <ChartNamesDialog
      ref="chartNamesDialog"
      v-if="workspace"
      :open="chartNamesDialogOpen"
      :guard-mode="transitionGuard"
      :suppress-return-focus="catalogueTransferForm !== null"
      :has-modified-entity-session="hasModifiedEntitySession || hasModifiedRouteSession"
      @update:open="handleChartGuardOpenChange"
      @resolve-transition="resolveChartTransitionChoice"
    />

    <PlayerViewPreviewDialog
      v-if="workspace && playerClusterDocument"
      :open="playerPreviewOpen"
      :document="playerClusterDocument"
      @update:open="playerPreviewOpen = $event"
    />


    <WorkspaceHistoryCapacityDialog
      :request="historyCapacityRequest"
      :suppress-return-focus="catalogueTransferForm !== null"
      @resolve="resolveHistoryCapacity"
    />

  </div>
</template>

<script setup lang="ts">
/**
 * Sole page owner of workspace hydration and durable commits, composed with cluster/system workflows and children.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch, type Ref } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { catalogueTypes, projectPlayerCluster, routeContentsFor, type CatalogueObjectTransferReview, type CatalogueTransferSource, type CatalogueSubtype, type JumpRoute, type LocalWorkspace, type ObjectFamily, type Point, type SystemFrameInsets } from '../domain/workspace'
import { validName } from '../domain/workspace-validation'
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import type { EntityCommand, SearchPresentationSettlement, SelectMapObjectDragContext, SystemCreationCandidate, SystemCreationType } from '../composables/editor-workflows/types'
import {
  createContinuousObjectAddRequestLease,
  selectContinuousObjectAddCandidate,
  type ContinuousObjectAddTarget,
  type OwnedContinuousObjectAddRequest,
} from '../utils/continuous-map-editing'
import type { WorkspaceHistoryTraversalContext } from '../composables/editor-workflows/workspace-mutations'
import { provideEditorCommands } from '../composables/editor-workflows/editor-command-context'
import type { EntityContextTarget, PublicationMenuRequest } from '../composables/editor-workflows/publication-types'
import { orbitBranchObjects } from '../utils/map-hierarchy'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import { useWorkspaceRestore } from '../composables/useWorkspaceRestore'
import { useDropboxBackup } from '../composables/useDropboxBackup'
import { useDropboxRestore } from '../composables/useDropboxRestore'
import { useDropboxSignIn } from '../composables/useDropboxSignIn'
import { useGoogleDriveRestore } from '../composables/useGoogleDriveRestore'
import { useGoogleDriveSignIn } from '../composables/useGoogleDriveSignIn'
import { usePlayerFileExports } from '../composables/usePlayerFileExports'
import { useWorkspaceHistory } from '../composables/useWorkspaceHistory'
import { useWorkspaceHistoryShortcuts } from '../composables/useWorkspaceHistoryShortcuts'
import { useMapToolShortcuts } from '../composables/useMapToolShortcuts'
import { useEditorUiStore } from '../stores/editor-ui'
import { useWardenMapFilters } from '../composables/useWardenMapFilters'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'
import { DROPBOX_BACKUP_LIMIT } from '../utils/dropbox-backup-snapshot'
import ChartNamesDialog from './ChartNamesDialog.vue'
import ChartDetailsEditor from './inspector/ChartDetailsEditor.vue'
import WorkspaceDeletionReview from './WorkspaceDeletionReview.vue'
import CatalogueTransferDialog from './CatalogueTransferDialog.vue'
import WorkspaceImportReview from './WorkspaceImportReview.vue'
import WorkspaceRestoreReview from './WorkspaceRestoreReview.vue'
import WorkspaceFeedback from './WorkspaceFeedback.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'
import PlayerViewPreviewDialog from './PlayerViewPreviewDialog.vue'
import WorkspaceMapChrome from './WorkspaceMapChrome.vue'
import DropboxRestoreDialog from './DropboxRestoreDialog.vue'
import GoogleDriveBackupButton from './GoogleDriveBackupButton.vue'
import GoogleDriveRestoreButton from './GoogleDriveRestoreButton.vue'
import WorkspaceMapHelp from './WorkspaceMapHelp.vue'

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
  replaceFromBackup,
  durableVersion,
} = useLocalWorkspace()
const googleDriveSignIn = useGoogleDriveSignIn()
const toast = useToast()
const toastAnnouncement = shallowRef<{ id: string | number; text: string }>()
watch(toast.toasts, (current, previous) => {
  const added = current.filter(notification => !previous.some(prior => prior.id === notification.id))
  const latest = added.at(-1)
  if (!latest) return
  const text = added.flatMap(({ title, description }) => [title, description])
    .filter(part => typeof part === 'string').join('. ')
  if (text) toastAnnouncement.value = { id: latest.id, text }
})
const googleDriveBackup = useGoogleDriveBackup(() => workspace.value, googleDriveSignIn, {
  onCanceled: () => toast.add({ title: 'Google Drive backup canceled', color: 'neutral', icon: 'i-lucide-info' }),
})
const googleDriveBackupDialogOpen = ref(false)
const cloudBackupMessage = computed(() => googleDriveBackup.message.value
  || (googleDriveBackup.busy.value ? 'Google Drive backup is in progress.' : ''))
watch(googleDriveBackup.lastSaved, () => {
  toast.add({ title: 'Backed up to Google Drive', color: 'success', icon: 'i-lucide-check' })
  googleDriveBackupDialogOpen.value = false
})
const dropboxSignIn = useDropboxSignIn()
const dropboxBackup = useDropboxBackup(() => workspace.value, dropboxSignIn)
const dropboxBackupMessage = computed(() => dropboxBackup.message.value
  || (dropboxBackup.busy.value ? 'Dropbox backup is in progress.' : ''))
watch(dropboxBackup.lastSaved, receipt => {
  if (!receipt) return
  toast.add({
    title: 'Backed up to Dropbox',
    description: `${receipt.name} in this app’s Dropbox App Folder`,
    color: 'success',
    icon: 'i-lucide-check',
  })
})
const runtimeConfig = useRuntimeConfig()
const editorUi = useEditorUiStore()
const continuousMap = computed(() => true)

let readEditorHistoryBlockReason: () => string | null = () => 'The editor is opening.'
let endCleanHistorySessions: () => void = () => undefined
let revealHistoryContext: (context: WorkspaceHistoryTraversalContext) => void = () => undefined
let publicationFocusRestoreAllowed: (request: PublicationMenuRequest) => boolean = () => false
const historyOpen = ref(false)
const helpOpen = ref(false)
const mobileMenuOpen = ref(false)
const workspaceHeader = ref<InstanceType<typeof WorkspaceHeader> | null>(null)
const mobileHelpOpener = shallowRef<HTMLElement | null>(null)
const helpOwnsFocus = ref(false)

function focusMobileWorkspaceMenu(): HTMLElement | null {
  return workspaceHeader.value?.focusMobileMenuToggle() ?? null
}

async function closeMobileMenuForAction(): Promise<HTMLElement | null> {
  mobileMenuOpen.value = false
  await nextTick()
  return focusMobileWorkspaceMenu()
}

async function openFieldsFromMobileMenu(): Promise<void> {
  await closeMobileMenuForAction()
  await openFieldDefinitions()
}

async function openHelpFromMobileMenu(): Promise<void> {
  mobileHelpOpener.value = await closeMobileMenuForAction()
  helpOpen.value = true
}
function onHelpActiveChange(active: boolean): void {
  helpOwnsFocus.value = active
  if (!active) mobileHelpOpener.value = null
}
const playerPreviewOpen = ref(false)
const playerClusterDocument = computed(() => workspace.value ? projectPlayerCluster(workspace.value) : null)
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
const chartDetailsEditor = ref<InstanceType<typeof ChartDetailsEditor> | null>(null)
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
  continuousMap,
  saveState,
  saveError,
  appliedRevision,
  mutations,
  initializeWorkspace: commit,
  waitForSearchPresentation,
  canRestorePublicationFocus: request => publicationFocusRestoreAllowed(request),
  onSearchFiltersInvalidated: () => toast.add({
    title: 'Search filters updated',
    description: 'Some filters were removed because a Field or choice is no longer available.',
    color: 'info',
    icon: 'i-lucide-info',
  }),
  onMapFiltersInvalidated: () => toast.add({
    title: 'Map filters updated',
    description: 'Some filters were removed because Fields or choices changed.',
    color: 'info',
    icon: 'i-lucide-info',
  }),
  onOrbitRadiiIncreased: minimum => toast.add({
    title: 'Orbit radii adjusted',
    description: `Orbit radii increased to the new host minimum of ${minimum}.`,
    color: 'info',
    icon: 'i-lucide-info',
  }),
})
const { navigation, inspector, charts, fields, cluster, placement, mapControls, feedback, adjustments, search, filterCriteria, transfer } = workflows
const routeTransferReview = transfer.routeReview
const catalogueTransferForm = shallowRef<{
  source: CatalogueTransferSource
  rootObjectId: string
  destination: 'system' | 'route'
} | null>(null)
const catalogueTransferOpener = shallowRef<HTMLElement | null>(null)
const catalogueTransferApplying = ref(false)
const catalogueTransferError = ref('')
const routeTransferAvailable = computed(() => {
  const target = inspectedTarget.value
  if (!workspace.value || (target?.kind !== 'object' && target?.kind !== 'route-object')) return false
  if (target.kind === 'object') return workspace.value.cluster.routes.length > 0
  const routeObject = routeContentsFor(workspace.value.cluster, target.routeId)?.objects.find(object => object.id === target.objectId)
  return workspace.value.cluster.routes.some(route => route.id !== target.routeId || routeObject?.placement.kind === 'orbit')
})

function openCatalogueTransfer(destination: 'system' | 'route', opener: EventTarget | null): void {
  const target = inspectedTarget.value
  if (!workspace.value || catalogueTransferForm.value || catalogueTransferApplying.value
    || (target?.kind !== 'route-object' && target?.kind !== 'object')) return
  if (destination === 'system' && target.kind !== 'route-object') return
  if (destination === 'route' && !routeTransferAvailable.value) return
  catalogueTransferOpener.value = opener instanceof HTMLElement ? opener : null
  catalogueTransferError.value = ''
  catalogueTransferForm.value = {
    source: target.kind === 'route-object'
      ? { kind: 'route', routeId: target.routeId }
      : { kind: 'system', systemId: target.systemId },
    rootObjectId: target.objectId,
    destination,
  }
}

function cancelCatalogueTransfer(): void {
  if (routeTransferReview.value) transfer.resolveRouteReview(false)
  else if (!catalogueTransferApplying.value) catalogueTransferForm.value = null
}

async function applyCatalogueTransfer(proposal: CatalogueObjectTransferReview): Promise<void> {
  const form = catalogueTransferForm.value
  if (!form || catalogueTransferApplying.value) return
  const ownsForm = () => {
    const target = inspectedTarget.value
    if (catalogueTransferForm.value !== form || (target?.kind !== 'route-object' && target?.kind !== 'object')
      || target.objectId !== form.rootObjectId) return false
    return form.source.kind === 'route'
      ? target.kind === 'route-object' && target.routeId === form.source.routeId
      : target.kind === 'object' && target.systemId === form.source.systemId
  }
  catalogueTransferApplying.value = true
  catalogueTransferError.value = ''
  const errorAtStart = editorError.value
  try {
    const accepted = await placeRouteObject({ kind: 'transfer', proposal }, ownsForm)
    if (catalogueTransferForm.value !== form) return
    if (accepted) catalogueTransferForm.value = null
    else if (editorError.value !== errorAtStart) catalogueTransferError.value = editorError.value
  } catch (error) {
    if (catalogueTransferForm.value === form) {
      catalogueTransferError.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    catalogueTransferApplying.value = false
  }
}

watch([() => workspace.value?.id, () => workspace.value?.cluster.id], () => {
  catalogueTransferForm.value = null
}, { flush: 'sync' })

const transferMapPreview = transfer.mapPreview
const transferMapPlacementLease = transfer.pendingMapPlacement
const systemTransferSession = inspector.systemTransferSession
watch(
  [() => workspace.value?.id, () => workspace.value?.cluster.id, hydrationState],
  ([workspaceId, clusterId]) => {
    if (workspaceId && clusterId) editorUi.setSelection({ activeView: 'cluster' })
  },
  { flush: 'sync', immediate: true },
)
const publicationControls = workflows.publication
const publicationMenuRequest = publicationControls.menuRequest
const publicationContextMenu = ref<{ whenClosingFocusSettled: () => Promise<void> } | null>(null)
let publicationMenuRevision = 0
watch(publicationMenuRequest, () => { publicationMenuRevision += 1 }, { flush: 'sync' })
const publicationBusy = publicationControls.busy
const setRouteSharing = publicationControls.setRouteSharing
const publicationMenuRouteShared = computed(() => {
  const target = publicationMenuRequest.value?.target
  if (target?.kind !== 'route') return undefined
  return workspace.value?.cluster.routes.find(route => route.id === target.id)?.playerShared
})
const publicationMenuOrbitObjects = computed(() => {
  const target = publicationMenuRequest.value?.target
  if (target?.kind !== 'orbit') return null
  return orbitBranchObjects(workspace.value?.cluster.systems.find(system => system.id === target.systemId), target.id)
})
const publicationMenuMode = computed(() => {
  const target = publicationMenuRequest.value?.target
  if (!target || target.kind === 'route') return null
  if (target.kind === 'orbit') {
    const objects = publicationMenuOrbitObjects.value
    const mode = objects?.[0]?.publication
    return mode && objects?.every(object => object.publication === mode) ? mode : null
  }
  const system = workspace.value?.cluster.systems.find(system => system.id === target.systemId)
  return (target.kind === 'system' ? system : system?.objects.find(object => object.id === target.id))?.publication ?? null
})
function currentSelectedObjectIds(): string[] {
  return selectedObjectIds.value.length
    ? [...selectedObjectIds.value]
    : selectedObjectId.value ? [selectedObjectId.value] : []
}
function canMoveSelectedObjectsFromMenu(request: typeof publicationMenuRequest.value): boolean {
  const target = request?.target
  const selectedIds = currentSelectedObjectIds()
  return !!request
    && (request.source === 'map' || request.source === 'hierarchy')
    && target?.kind === 'object'
    && selectedIds.length > 0
    && !!workspace.value?.cluster.systems.find(system => system.id === target.systemId)
      ?.objects.some(object => object.id === target.id)
}
const publicationMenuMoveSelectionAvailable = computed(() =>
  publicationMenuRequest.value?.target.kind === 'system'
  || publicationMenuRequest.value?.target.kind === 'orbit'
  || canMoveSelectedObjectsFromMenu(publicationMenuRequest.value))

async function moveEntityFromMenu(): Promise<void> {
  const request = publicationMenuRequest.value
  if (!request || !publicationMenuMoveSelectionAvailable.value || request.target.kind === 'route') return
  publicationControls.closeMenu()
  if (request.target.kind !== 'object') {
    if (!await selectContextEntity(request.target, false)) return
    const { id, systemId, kind } = request.target
    const isCurrent = () => kind === 'system'
      ? clusterSelectedSystemId.value === id
      : selectedSystemId.value === systemId && selectedOrbitId.value === id
    if (mapMode.value !== 'move') await changeMapMode('move', isCurrent)
    return
  }
  const systemId = request.target.systemId
  const objectId = request.target.id
  const entryMode = mapMode.value
  const mapKey = activeMapKey.value
  const selectedIds = currentSelectedObjectIds()
  const isCurrent = (): boolean => {
    const currentSelectedIds = currentSelectedObjectIds()
    return mapMode.value === entryMode
      && activeMapKey.value === mapKey
      && currentSelectedIds.length === selectedIds.length
      && selectedIds.every((id, index) => currentSelectedIds[index] === id)
      && !!workspace.value?.cluster.systems.find(system => system.id === systemId)
        ?.objects.some(object => object.id === objectId)
  }
  if (entryMode === 'move') return
  await changeMapMode('move', isCurrent)
}

async function selectContextEntity(target: EntityContextTarget, openInspector: boolean): Promise<boolean> {
  const workspaceId = workspace.value?.id
  const clusterId = workspace.value?.cluster.id
  const sameWorkspace = () => workspace.value?.id === workspaceId && workspace.value?.cluster.id === clusterId

  if (target.kind === 'route') {
    await selectRoute(target.id, openInspector)
    return sameWorkspace() && selectedRouteId.value === target.id
  }
  if (continuousMap.value) {
    const entity = target.kind === 'object'
      ? { kind: 'object' as const, systemId: target.systemId, objectId: target.id }
      : target.kind === 'orbit'
        ? { kind: 'orbit' as const, systemId: target.systemId, orbitId: target.id }
        : { kind: 'system' as const, systemId: target.systemId }
    return await inspectContinuousTarget(entity, openInspector) && sameWorkspace()
  }
  if (target.kind === 'system') {
    if (activeView.value !== 'cluster') await showClusterMap()
    if (!sameWorkspace() || activeView.value !== 'cluster') return false
    await selectClusterSystem(target.id, openInspector)
    return sameWorkspace() && clusterSelectedSystemId.value === target.id
  }
  if (target.kind === 'object') await selectObject(target.id, openInspector)
  else await selectOrbit(target.id, openInspector)
  return sameWorkspace() && selectedSystemId.value === target.systemId
    && (target.kind === 'object' ? selectedObjectId.value : selectedOrbitId.value) === target.id
}

async function editEntityFromMenu(): Promise<void> {
  const target = publicationMenuRequest.value?.target
  publicationControls.closeMenu()
  if (!target || !await selectContextEntity(target, true)) return
  if (target.kind === 'system') await beginChartNamesEdit(target.id)
  else if (target.kind === 'route') {
    if (routeSession.value?.routeId !== target.id) await beginRouteEdit(target.id)
  } else if (entitySession.value?.kind !== target.kind || entitySession.value.systemId !== target.systemId
    || entitySession.value.targetId !== target.id) {
    if (target.kind === 'object') await beginObjectEdit()
    else await beginOrbitEdit()
  }
}

async function deleteEntityFromMenu(): Promise<void> {
  const request = publicationMenuRequest.value
  const current = workspace.value
  if (!request || !current || deletionReview.value) {
    publicationControls.closeMenu()
    return
  }

  const target = { ...request.target }
  const workspaceId = current.id
  const clusterId = current.cluster.id
  const menuRevision = publicationMenuRevision
  publicationControls.closeMenu()

  await nextTick()
  await publicationContextMenu.value?.whenClosingFocusSettled()
  await nextTick()

  if (publicationMenuRevision !== menuRevision + 1 || publicationMenuRequest.value !== null
    || workspace.value !== current || workspace.value?.id !== workspaceId
    || workspace.value.cluster.id !== clusterId || deletionReview.value !== null) return

  switch (target.kind) {
    case 'system':
      await openDeletionReview({ kind: 'system', systemId: target.id })
      break
    case 'object':
      await openDeletionReview({ kind: 'object', systemId: target.systemId, objectId: target.id })
      break
    case 'orbit':
      await openDeletionReview({ kind: 'orbit', systemId: target.systemId, orbitId: target.id })
      break
    case 'route':
      await openDeletionReview({ kind: 'route', routeId: target.id })
      break
  }
}

function selectPublicationMenuMode(mode: import('../domain/workspace').PublicationMode): void {
  const request = publicationMenuRequest.value
  publicationControls.closeMenu()
  if (!request || request.target.kind === 'route') return
  void publicationControls.set({ targets: [request.target], mode })
}

function shareRouteFromMenu(shared: boolean): void {
  const target = publicationMenuRequest.value?.target
  publicationControls.closeMenu()
  if (target?.kind === 'route') void setRouteSharing(target.id, shared, 'context-menu')
}
const searchOpen = search.open
const searchQuery = search.query
const searchResults = search.results
const noSearchResults: readonly never[] = []
async function revealSearchTarget(target: Parameters<typeof search.reveal>[0]): Promise<Awaited<ReturnType<typeof search.reveal>>> {
  const orbitAddChoice = orbitAddArmed.value ? continuousObjectAddChoiceId : null
  const outcome = await search.reveal(target)
  if (outcome.status === 'revealed' && orbitAddChoice === continuousObjectAddChoiceId) clearOrbitAdd()
  if (outcome.status === 'rejected') await chartNamesDialog.value?.whenClosingFocusSettled()
  return outcome
}
revealHistoryContext = navigation.revealHistoryContext

const {
  activeView, mapMode, selectedSystemId, clusterSelectedSystemId, selectedObjectId, selectedObjectIds, selectedOrbitId,
  selectedRouteId, selectedSystem, selectedObject, selectedOrbit, selectedRoute, clusterSelectedSystem,
  inspectedTarget, routeEndpointSummary, showClusterMap, selectSystem,
  selectClusterSystem, inspectContinuousTarget, inspectRouteObject, selectObject, replaceObjectSelection, toggleObjectSelection, selectOrbit, selectRoute, showChartDetails,
} = navigation
const continuousInspectorSystemId = computed(() => {
  const target = inspectedTarget.value
  return target?.kind === 'system' || target?.kind === 'object' || target?.kind === 'orbit'
    ? target.systemId
    : null
})
const inspectorSelectedSystem = computed(() => workspace.value?.cluster.systems
  .find(system => system.id === continuousInspectorSystemId.value))
const inspectorRouteObjectContext = computed(() => {
  const target = inspectedTarget.value
  const current = workspace.value
  if (target?.kind !== 'route-object' || !current) return undefined
  const route = current.cluster.routes.find(candidate => candidate.id === target.routeId)
  const contents = routeContentsFor(current.cluster, target.routeId)
  return route && contents ? { summary: wardenRouteSummary(route), contents } : undefined
})
const inspectorSelectedObject = computed(() => {
  const target = inspectedTarget.value
  if (target?.kind === 'route-object') {
    return inspectorRouteObjectContext.value?.contents.objects.find(object => object.id === target.objectId)
  }
  if (target?.kind !== 'object') return selectedObject.value
  return workspace.value?.cluster.systems.find(system => system.id === target.systemId)?.objects
    .find(object => object.id === target.objectId)
})
const inspectorSelectedOrbit = computed(() => {
  const target = inspectedTarget.value
  if (target?.kind !== 'orbit') return selectedOrbit.value
  return workspace.value?.cluster.systems.find(system => system.id === target.systemId)?.orbits
    .find(orbit => orbit.id === target.orbitId)
})
const { wardenDraftWorkspace } = workflows
const wardenWorkspace = computed(() => wardenDraftWorkspace.value ?? workspace.value)
const wardenSystem = computed(() => wardenDraftWorkspace.value?.cluster.systems.find(system => system.id === inspectorSelectedSystem.value?.id))
const wardenFilterSystem = computed(() => wardenSystem.value ?? selectedSystem.value)
function wardenRouteSummary(route: JumpRoute): string {
  const cluster = wardenWorkspace.value?.cluster
  const displayedRoute = cluster?.routes.find(candidate => candidate.id === route.id) ?? route
  return routeEndpointSummary(displayedRoute, cluster)
}
const mapTypeFiltersOpen = computed({
  get: () => editorUi.mapTypeFiltersOpen,
  set: open => editorUi.setMapTypeFiltersOpen(open),
})
const wardenFilters = useWardenMapFilters({
  workspace: wardenWorkspace,
  selectedSystem: wardenFilterSystem,
  activeView,
  continuousMap,
  criteria: filterCriteria.map.criteria,
  fieldOptions: filterCriteria.fieldOptions,
})
const { dimmedObjectIds: dimmedMapObjectIds } = wardenFilters
const { dimmedObjectIds: dimmedAppliedObjectIds } = useWardenMapFilters({
  workspace,
  selectedSystem,
  activeView,
  continuousMap,
  criteria: filterCriteria.map.criteria,
  fieldOptions: filterCriteria.fieldOptions,
})
watch(activeView, view => {
  if (view === 'cluster') mapTypeFiltersOpen.value = false
})
const {
  clusterName, systemName, playerTitle, publication, draftSystemName: chartDraftSystemName, dialogOpen: chartNamesDialogOpen,
  editing: chartEditing,
  transitionGuard, formError, hasUncommittedNames, hasChartNameDraft, saveMessage, submitNames,
  cancelNamesEdit: cancelChartNamesEdit,
  resolveTransition, resolveTransitionChoice: resolveChartTransitionChoiceFromWorkflow,
  beginNamesEdit: beginChartNamesEdit,
} = charts
const {
  fieldDefinitionsSession, fieldDefinitionDialogOpen, fieldDefinitionError, hasModifiedFieldDefinitionsSession,
  fieldDefinitionsDialog, openFieldDefinitions, getFieldDefinitionImportConflict, handleFieldDefinitionsIntent,
} = fields
const {
  objectInspectorFocusRequest, acknowledgeObjectInspectorFocusRequest,
  entitySession, routeObjectSession, hasModifiedEntitySession, orbitPlacementPreview, applyEntitySession, discardEntitySession,
  updateObjectPlacement, updateOrbitHost, previewOrbitPlacement, isEntityCommandBlocked, resumeEntitySession,
  beginObjectEdit, beginOrbitEdit,
  routeSession, hasModifiedRouteSession, offerRouteSystems, chooseRouteSystem, chooseRoutePoint, updateRouteInput, reverseRouteEndpoints,
  applyRouteSession, discardRouteSession, cancelRouteCreation,
} = inspector
const inspectorMode = computed(() => {
  // An admitted route creation session owns the form while retaining the previous inspected target.
  if (activeView.value === 'cluster' && routeSession.value?.routeId === null) return 'cluster'
  return inspectedTarget.value?.kind === 'object' || inspectedTarget.value?.kind === 'orbit' ? 'system' : 'cluster'
})
const inspectorLabel = computed(() => {
  if (chartEditing.value) return 'Jump Cluster details editor'
  if (inspectorRouteObjectContext.value && routeSession.value?.routeId !== null) return 'Object inspector'
  if (inspectorMode.value === 'system') {
    if (selectedObjectIds.value.length > 1) return 'Object selection'
    if (inspectorSelectedObject.value) return 'Object inspector'
    if (inspectorSelectedOrbit.value) return 'Orbit inspector'
  } else if (routeSession.value || selectedRoute.value) {
    return 'Jump Route inspector'
  }
  return inspectorSelectedSystem.value ? 'Zone details' : 'Jump Cluster details'
})
const { editorError } = feedback
const moveSelectionError = workflows.move.error
const { orbitAdjustmentPreview, updateOrbitAdjustment, beforeWorkspaceOperation, resetOrbitAdjustments } = adjustments
watch(hydrationState, (state, previous) => {
  if (state !== 'loading' && previous !== 'loading') return
  resetOrbitAdjustments()
  search.reset()
  filterCriteria.map.clearAll()
  mapTypeFiltersOpen.value = false
}, { flush: 'sync' })
const {
  clusterMapRef, systemMapRef, activeMapKey, initialViewport, hierarchyPanelVisible, inspectorPanelVisible,
  isCompactViewport, compactPanelOpen, compactPanel, editingGestureActive, zoomLevel, minimumZoomLevel,
  requestPanel, closePanel, togglePanel,
  zoomActiveMap, panActiveMap, setViewportPercentage, fitActiveMap, centerInspectedTarget, recordViewport, setMapMode,
} = mapControls

watch(inspectorPanelVisible, visible => {
  if (!visible) charts.hideEditing()
}, { flush: 'sync' })

watch(() => [
  selectedObjectId.value,
  selectedObjectIds.value.join('\u0000'),
  selectedOrbitId.value,
  selectedRouteId.value,
  entitySession.value?.id ?? null,
  routeSession.value?.id ?? null,
], (current, previous) => {
  const selectionChanged = current.some((value, index) => value !== previous[index])
  if (selectionChanged) charts.hideEditing()
}, { flush: 'sync' })

function focusInspectorChartEditAction(): void {
  const inspector = document.getElementById('workspace-inspector-panel')
  const editAction = inspector?.querySelector<HTMLElement>('button[aria-label="Edit Jump Cluster details"]')
  const closeAction = inspector?.querySelector<HTMLElement>(
    'button[aria-label="Close inspector panel"], button[aria-label="Hide inspector"]',
  )
  const target = editAction?.getClientRects().length ? editAction : closeAction
  if (target && !target.closest('[inert]')) target.focus()
}

async function applyChartNames(): Promise<void> {
  await submitNames()
  if (!chartEditing.value) {
    await nextTick()
    focusInspectorChartEditAction()
  }
}

function discardChartNames(): void {
  cancelChartNamesEdit()
  void nextTick(focusInspectorChartEditAction)
}

async function resolveChartTransitionChoice(decision: Parameters<typeof resolveChartTransitionChoiceFromWorkflow>[0]): Promise<void> {
  const guard = transitionGuard.value
  await resolveChartTransitionChoiceFromWorkflow(decision)
  if (guard !== 'chart' || transitionGuard.value !== null || !hasChartNameDraft.value) return
  if (decision === 'stay' || decision === 'apply') charts.showEditing()
  else return
  requestPanel('inspector')
  await chartNamesDialog.value?.whenClosingFocusSettled()
  await nextTick()
  await chartDetailsEditor.value?.focusField()
}

function handleChartGuardOpenChange(open: boolean): void {
  if (!open && transitionGuard.value) void resolveChartTransitionChoice('stay')
}
const compactPanelPresentationOpen = computed(() => compactPanelOpen.value && !helpOwnsFocus.value)
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
  moveSystem, moveMapObject, moveMapObjectInSystem, resizeSystemFrame, addMapObjectInSystem, placeRouteObject,
  placeMapObjectInOrbit, rotateMapObject, resizeMapOrbit, rotateMapOrbit,
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
    || systemObjectMapMoveTargeting.value || orbitCenterMapMoveTargeting.value
  : systemObjectMapMoveTargeting.value || orbitCenterMapMoveTargeting.value)
const {
  creationSession, orbitDragPreview, chooseCreationType, chooseCreationCandidate, updateCreationInput,
  offerCreationCandidates, addCreationFromInputs,
} = creation
const orbitCreationPreview = computed(() => {
  if (orbitDragPreview.value) return orbitDragPreview.value
  const session = creationSession.value
  return session?.type.kind === 'orbit' && session.preview
    ? { systemId: session.systemId, preview: session.preview }
    : null
})
const {
  beginRoute, beginRouteEdit, openDeletionReview, deleteSelectedObject, deleteSelectedOrbit, deleteSelectedRoute,
  deletionReview, cancelDeletionReview, confirmDeletionReview,
} = cluster

provideEditorCommands({
  navigation: {
    selectSystem,
    inspectContinuousTarget,
    inspectRouteObject,
    selectObject,
    replaceObjectSelection,
    toggleObjectSelection,
    clearObjectSelectionForMove: navigation.clearObjectSelectionForMove,
    selectOrbit,
    selectRoute,
    showClusterMap,
    showChartDetails,
    routeSummary: wardenRouteSummary,
  },
  charts: { beginNamesEdit: beginChartNamesEdit },
  creation: {
    beginOrbitDrag: creation.beginOrbitDrag,
    updateOrbitDrag: creation.updateOrbitDrag,
    completeOrbitDrag: creation.completeOrbitDrag,
    cancelOrbitDrag: creation.cancelOrbitDrag,
  },
  map: { changeMode: changeMapMode },
  move: workflows.move,
  publication: {
    set: publicationControls.set,
    openMenu: publicationControls.openMenu,
  },
})

const fieldDefinitionInspectorConflict = computed(() => {
  const fieldId = fieldDefinitionsSession.selectedId
  return fieldId !== null && isEntityCommandBlocked({ kind: 'definition-mutation', fieldId })
})

function handleMapMoveTarget(point: Point): void {
  if (activeView.value === 'cluster' && unresolvedExitTargeting.value) previewUnresolvedExitAt(point)
  else if (activeView.value === 'cluster' && clusterSystemMapMoveTargeting.value) previewSystemMoveAt(point)
  else if (activeView.value === 'cluster' && systemObjectMapMoveTargeting.value) previewSystemObjectMoveAt(point)
  else if (activeView.value === 'cluster' && orbitCenterMapMoveTargeting.value) previewOrbitCenterMoveAt(point)
  else if (activeView.value === 'system' && systemObjectMapMoveTargeting.value) previewSystemObjectMoveAt(point)
  else if (activeView.value === 'system' && orbitCenterMapMoveTargeting.value) previewOrbitCenterMoveAt(point)
}

function handleMapMoveNudge(delta: Point): void {
  if (activeView.value === 'cluster' && unresolvedExitTargeting.value) nudgeUnresolvedExit(delta)
  else if (activeView.value === 'cluster' && clusterSystemMapMoveTargeting.value) nudgeClusterSystemMove(delta)
  else if (activeView.value === 'cluster' && systemObjectMapMoveTargeting.value) nudgeSystemObjectMove(delta)
  else if (activeView.value === 'cluster' && orbitCenterMapMoveTargeting.value) nudgeOrbitCenterMove(delta)
  else if (activeView.value === 'system' && systemObjectMapMoveTargeting.value) nudgeSystemObjectMove(delta)
  else if (activeView.value === 'system' && orbitCenterMapMoveTargeting.value) nudgeOrbitCenterMove(delta)
}

function handleMapOrbitCenterMove(
  orbitId: string,
  center: Point,
  hostId: string | null,
  systemId?: string,
  sourceGeometry?: string,
): void {
  void moveMapOrbitCenter(orbitId, center, hostId, undefined, systemId, sourceGeometry)
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
const orbitAddArmed = ref(false)
interface OrbitAddOwner {
  systemId: string
  candidates: SystemCreationCandidate[]
}
interface OrbitAddRequest {
  owners: readonly OrbitAddOwner[]
  workspace: LocalWorkspace
}
const pendingOrbitAdd = shallowRef<OrbitAddRequest | null>(null)
const creationSystem = computed(() => workspace.value?.cluster.systems
  .find(system => system.id === creationSession.value?.systemId))
watch(creationSession, (current, previous) => {
  if (!current && previous?.type.kind === 'orbit') clearOrbitAdd()
})
const continuousObjectAddType = ref<CatalogueSubtype | null>(null)
const continuousObjectOwnerChooserOpen = ref(false)
const continuousObjectOtherTypeOpen = ref(false)
const continuousObjectOtherTypeName = ref('')
const continuousObjectOtherTypeError = ref('')
const continuousObjectAddOtherType = ref('')
const continuousObjectPinnedOwnerId = ref<string | null>(null)
const continuousObjectAddRequestLease = createContinuousObjectAddRequestLease<ContinuousObjectAddTarget>()
const pendingContinuousObjectAdd = ref<OwnedContinuousObjectAddRequest<ContinuousObjectAddTarget> | null>(null)
const addOwnerChoiceIds = computed(() => (
  pendingOrbitAdd.value?.owners ?? pendingContinuousObjectAdd.value?.request.owners ?? []
).map(owner => owner.systemId))
let continuousObjectAddChoiceId = 0
const workspaceDockRef = ref<{ openAddChooserFromKeyboard(): void } | null>(null)
const keyboardAddOriginMapKey = ref<string | null>(null)
const continuousObjectCreationType = computed<SystemCreationType | null>(() => activeView.value === 'cluster' && continuousObjectAddType.value
  ? { kind: 'object', subtype: continuousObjectAddType.value }
  : null)
const ORBIT_CREATION_TYPE = { kind: 'orbit' } as const
const mapCreationType = computed(() => orbitAddArmed.value ? ORBIT_CREATION_TYPE : continuousObjectCreationType.value)
const continuousObjectAddLabel = computed(() => {
  const subtype = continuousObjectAddType.value
  if (subtype === 'other' && continuousObjectAddOtherType.value) return continuousObjectAddOtherType.value
  return subtype
    ? catalogueTypes.find(candidate => candidate.value === subtype)?.label ?? subtype
    : 'object'
})
const creationTypeLabel = computed(() => {
  const type = creationSession.value?.type ?? continuousObjectCreationType.value
  if (!type) return ''
  if (type.kind === 'orbit') return 'Orbit'
  return catalogueTypes.find(candidate => candidate.value === type.subtype)?.label ?? type.subtype
})
const clusterAddPresentation = computed(() => orbitAddArmed.value
  ? {
      label: 'Orbit',
      status: creationSession.value?.type.kind === 'orbit' && creationSession.value.notice
        ? `ADD Orbit · ${creationSession.value.notice}`
        : 'ADD Orbit · Choose a host or clear map position.',
      error: editorError.value || undefined,
    }
  : continuousObjectAddType.value !== null
  ? {
      label: continuousObjectAddLabel.value,
      status: continuousObjectPinnedOwnerId.value
        ? `ADD ${continuousObjectAddLabel.value} · ${continuousObjectOwnerName(continuousObjectPinnedOwnerId.value)} owns this placement. Click an Orbit or clear position in that Zone.`
        : `ADD ${continuousObjectAddLabel.value} · Choose a Jump Route or a position within a Zone.`,
      error: editorError.value || undefined,
    }
  : clusterAddType.value === 'system'
  ? {
      label: 'Zone',
      status: 'ADD Zone · Choose a clear map point, or pan with the arrow keys and press Enter.',
      error: clusterAddError.value,
    }
  : clusterAddType.value === 'route'
    ? {
        label: 'Jump Route',
        status: `ADD Jump Route · Choose the ${routeSession.value?.endpointToChoose === 'to' ? 'destination' : 'origin'} system.`,
        error: routeSession.value?.error || undefined,
      }
    : null)
const clusterMovePresentation = computed(() => {
  if (!clusterMoveTargeting.value || clusterAddType.value !== null) return null
  const preview = clusterSystemMovePreview.value
  const systemName = clusterSelectedSystem.value?.name ?? 'selected Zone'
  return {
    status: preview
      ? `MOVE preview · ${systemName} · Confirm or cancel the move.`
      : clusterSystemMapMoveTargeting.value
        ? `MOVE ${systemName} · Choose a destination or adjust it with the arrow keys.`
        : `MOVE ${systemName} · Choose Move selected Zone on map, or drag the Zone.`,
    error: clusterSystemMoveError.value || undefined,
    previewing: preview !== null,
  }
})
watch(
  [activeView, selectedSystemId, clusterSelectedSystemId, mapMode, hierarchyPanelVisible, inspectorPanelVisible, isCompactViewport],
  () => {
    creationChooserOpen.value = false
    if (activeView.value !== 'cluster') clearContinuousObjectAdd()
  },
)
watch([creationSession, clusterAddType, continuousObjectAddType, orbitAddArmed], ([creationIntent, clusterIntent, objectIntent, orbitIntent]) => {
  if (creationIntent || clusterIntent || objectIntent || orbitIntent) cancelMapMove()
}, { flush: 'sync' })
watch(() => workspace.value, current => {
  if (continuousObjectPinnedOwnerId.value) continuousObjectPinnedOwnerId.value = null
  if (pendingOrbitAdd.value && pendingOrbitAdd.value.workspace !== current) clearOrbitOwnerChoice()
  const pending = pendingContinuousObjectAdd.value
  if (pending && pending.request.workspaceSnapshot !== current) {
    clearContinuousObjectAddRequest(pending)
    continuousObjectOwnerChooserOpen.value = false
  }
}, { flush: 'sync' })
watch([() => workspace.value?.id, () => workspace.value?.cluster.id], ([workspaceId, clusterId], [previousWorkspaceId, previousClusterId]) => {
  if (workspaceId !== previousWorkspaceId || clusterId !== previousClusterId) {
    clearContinuousObjectAdd()
    clearOrbitAdd()
  }
}, { flush: 'sync' })

async function chooseObjectCreationType(subtype: CatalogueSubtype): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return
  const choiceId = ++continuousObjectAddChoiceId
  const workspaceId = currentWorkspace.id
  const clusterId = currentWorkspace.cluster.id
  const mapKey = activeMapKey.value
  const startingActiveView = activeView.value
  const startingRouteSessionId = routeSession.value?.id ?? null
  const leavingArmedAdd = Boolean(creationSession.value || clusterAddType.value || orbitAddArmed.value)
  const resolvingRouteCreation = activeView.value === 'cluster'
    && leavingArmedAdd
    && routeSession.value?.routeId === null
    && hasModifiedRouteSession.value
  let routeMayBeClosed = false
  const isCurrent = (): boolean => {
    const latest = workspace.value
    const currentRoute = routeSession.value
    const routeContextIsCurrent = currentRoute === null
      ? startingRouteSessionId === null || resolvingRouteCreation || routeMayBeClosed
      : currentRoute.id === startingRouteSessionId
      || (resolvingRouteCreation && currentRoute.routeId === null
        && currentRoute.clusterId === clusterId && !hasModifiedRouteSession.value)
    return choiceId === continuousObjectAddChoiceId
      && latest !== null && latest.id === workspaceId && latest.cluster.id === clusterId
      && activeView.value === startingActiveView
      && activeMapKey.value === mapKey
      && routeContextIsCurrent
  }

  if (resolvingRouteCreation) {
    if (!await resolveTransition({ leaveChart: false, leaveEntitySession: false }, isCurrent)) return
    routeMayBeClosed = true
  } else if (!await beforeWorkspaceOperation() || !isCurrent()) {
    return
  }
  if (!isCurrent()) return
  if (activeView.value === 'cluster') {
    cancelMapMove()
    if (creationSession.value || clusterAddType.value || orbitAddArmed.value) {
      routeMayBeClosed = true
      if (!await quitSystemAdd(isCurrent)) return
    }
    if (!isCurrent()) return
    clearContinuousObjectAdd()
    continuousObjectAddType.value = subtype
    editorError.value = ''
    creationChooserOpen.value = false
    if (subtype === 'other') {
      continuousObjectOtherTypeName.value = ''
      continuousObjectOtherTypeError.value = ''
      continuousObjectOtherTypeOpen.value = true
    }
    return
  }
  if (!await chooseCreationType({ kind: 'object', subtype })) return
  creationChooserOpen.value = false
}

function clearContinuousObjectAdd(): void {
  continuousObjectAddRequestLease.clearAll()
  continuousObjectAddType.value = null
  pendingContinuousObjectAdd.value = null
  continuousObjectOwnerChooserOpen.value = false
  continuousObjectOtherTypeOpen.value = false
  continuousObjectOtherTypeName.value = ''
  continuousObjectOtherTypeError.value = ''
  continuousObjectAddOtherType.value = ''
  continuousObjectPinnedOwnerId.value = null
}

function confirmContinuousObjectOtherType(): void {
  try {
    continuousObjectAddOtherType.value = validName(continuousObjectOtherTypeName.value, 'Object type')
    continuousObjectOtherTypeError.value = ''
    continuousObjectOtherTypeOpen.value = false
  } catch (error) {
    continuousObjectOtherTypeError.value = error instanceof Error ? error.message : 'Enter a valid object type.'
  }
}

function cancelContinuousObjectOtherType(): void {
  clearContinuousObjectAdd()
}

function onContinuousObjectOtherTypeOpenChange(open: boolean): void {
  continuousObjectOtherTypeOpen.value = open
  if (!open && continuousObjectAddType.value === 'other' && !continuousObjectAddOtherType.value) {
    clearContinuousObjectAdd()
  }
}

function continuousObjectOwnerName(systemId: string): string {
  return workspace.value?.cluster.systems.find(system => system.id === systemId)?.name ?? 'Unknown Zone'
}

function continuousAddRequestIsCurrent(owned: OwnedContinuousObjectAddRequest<ContinuousObjectAddTarget>): boolean {
  const request = owned.request
  if (!continuousObjectAddRequestLease.isCurrent(owned)) return false
  return activeView.value === 'cluster'
    && continuousObjectAddType.value === request.subtype
    && (request.subtype !== 'other' || request.otherType === continuousObjectAddOtherType.value)
    && toRaw(workspace.value) === toRaw(request.workspaceSnapshot)
}

function handleContinuousObjectAddTarget(request: ContinuousObjectAddTarget): void {
  if (activeView.value !== 'cluster'
    || continuousObjectAddType.value !== request.subtype
    || (request.subtype === 'other' && request.otherType !== continuousObjectAddOtherType.value)
    || toRaw(workspace.value) !== toRaw(request.workspaceSnapshot)) return
  const owned = continuousObjectAddRequestLease.capture(request)
  pendingContinuousObjectAdd.value = null
  continuousObjectOwnerChooserOpen.value = false
  if (request.routeLanding) {
    void placeRouteObject({
      ...request.routeLanding,
      kind: 'create',
      subtype: request.subtype,
      workspaceSnapshot: request.workspaceSnapshot,
      ...(request.otherType ? { otherType: request.otherType } : {}),
    }, () => continuousAddRequestIsCurrent(owned)).then(applied => {
      if (applied && continuousObjectAddRequestLease.isCurrent(owned)) editorError.value = ''
    }).finally(() => clearContinuousObjectAddRequest(owned))
    return
  }
  if (request.owners.length === 1 && !request.requiresOwnerChoice) {
    void addContinuousObjectToOwner(owned, request.owners[0]!.systemId)
    return
  }
  if (request.owners.length === 0) {
    editorError.value = 'Choose an available Zone or Jump Route before adding an object.'
    clearContinuousObjectAddRequest(owned)
    return
  }
  pendingContinuousObjectAdd.value = owned
  continuousObjectOwnerChooserOpen.value = true
  editorError.value = ''
}

function continuousAddCandidate(
  request: ContinuousObjectAddTarget,
  systemId: string,
): ReturnType<typeof selectContinuousObjectAddCandidate> {
  const candidates = request.owners.find(owner => owner.systemId === systemId)?.candidates ?? []
  return selectContinuousObjectAddCandidate(candidates, request.directTarget)
}

async function addContinuousObjectToOwner(
  owned: OwnedContinuousObjectAddRequest<ContinuousObjectAddTarget>,
  systemId: string,
): Promise<boolean> {
  const request = owned.request
  const requestIsCurrent = () => continuousAddRequestIsCurrent(owned)
  if (!requestIsCurrent()) {
    clearContinuousObjectAddRequest(owned)
    return false
  }
  const choice = continuousAddCandidate(request, systemId)
  if (choice.error) {
    if (request.directTarget?.kind === 'object' && !choice.candidate) {
      continuousObjectPinnedOwnerId.value = systemId
      const systemName = continuousObjectOwnerName(systemId)
      editorError.value = `${systemName} is selected. Choose an Orbit or clear position in this Zone.`
    } else {
      editorError.value = choice.error
    }
    return false
  }
  const candidate = choice.candidate
  if (!candidate) return false
  if (candidate.target.kind !== 'free' && candidate.target.kind !== 'orbit') {
    editorError.value = 'Choose a clear map position or eligible Orbit for this object.'
    return false
  }
  const applied = await addMapObjectInSystem(
    systemId,
    request.subtype,
    candidate.target,
    request.otherType,
    request.workspaceSnapshot,
    requestIsCurrent,
  )
  if (!applied) return false
  if (!continuousObjectAddRequestLease.isCurrent(owned)) return true
  continuousObjectPinnedOwnerId.value = null
  editorError.value = ''
  clearContinuousObjectAddRequest(owned)
  return true
}

function chooseContinuousObjectOwner(systemId: string): void {
  const request = pendingContinuousObjectAdd.value
  if (request) void addContinuousObjectToOwner(request, systemId)
}

function clearContinuousObjectAddRequest(owned: OwnedContinuousObjectAddRequest<ContinuousObjectAddTarget>): void {
  if (!continuousObjectAddRequestLease.clear(owned)) return
  if (pendingContinuousObjectAdd.value?.id === owned.id) pendingContinuousObjectAdd.value = null
  continuousObjectOwnerChooserOpen.value = false
}

function onContinuousObjectOwnerChooserOpenChange(open: boolean): void {
  if (open) return
  if (pendingOrbitAdd.value) clearOrbitOwnerChoice()
  const pending = pendingContinuousObjectAdd.value
  if (pending) clearContinuousObjectAddRequest(pending)
  else continuousObjectOwnerChooserOpen.value = false
}

function cancelContinuousObjectOwnerChoice(): void {
  if (pendingOrbitAdd.value) clearOrbitOwnerChoice()
  const pending = pendingContinuousObjectAdd.value
  if (pending) clearContinuousObjectAddRequest(pending)
  else continuousObjectOwnerChooserOpen.value = false
}

function handleContinuousObjectMove(
  systemId: string,
  objectId: string,
  position: Point,
  workspaceSnapshot: LocalWorkspace,
  frameInsets?: SystemFrameInsets,
  selectDrag?: SelectMapObjectDragContext,
): void {
  void moveMapObjectInSystem(systemId, objectId, position, workspaceSnapshot, frameInsets, selectDrag)
}

function clearOrbitOwnerChoice(): void {
  pendingOrbitAdd.value = null
  continuousObjectOwnerChooserOpen.value = false
}

function clearOrbitAdd(): void {
  orbitAddArmed.value = false
  if (pendingOrbitAdd.value) clearOrbitOwnerChoice()
}

async function chooseOrbitCreationType(): Promise<void> {
  const current = workspace.value
  if (!current) return
  if (orbitAddArmed.value) {
    creationChooserOpen.value = false
    return
  }
  const choice = ++continuousObjectAddChoiceId
  const isCurrent = () => choice === continuousObjectAddChoiceId && workspace.value?.id === current.id
    && workspace.value.cluster.id === current.cluster.id
  if (routeSession.value?.routeId === null && hasModifiedRouteSession.value
    && !await resolveTransition({ leaveChart: false, leaveEntitySession: false }, isCurrent)) return
  if (!await quitSystemAdd(isCurrent)) return
  if (!isCurrent()) return
  const systems = workspace.value?.cluster.systems ?? []
  const owner = inspectorSelectedSystem.value ?? (systems.length === 1 ? systems[0] : undefined)
  if (owner && !await chooseCreationType(ORBIT_CREATION_TYPE, owner.id, isCurrent)) return
  if (!isCurrent()) return
  orbitAddArmed.value = true
  editorError.value = ''
  creationChooserOpen.value = false
}

function handleOrbitAddTarget(
  owners: readonly OrbitAddOwner[],
  requiresOwnerChoice: boolean,
  source: LocalWorkspace,
): void {
  if (!orbitAddArmed.value || source !== workspace.value) return
  const request = { owners, workspace: source }
  if (!owners.length) {
    editorError.value = 'Add a Zone before creating an Orbit.'
    return
  }
  if (requiresOwnerChoice) {
    pendingOrbitAdd.value = request
    continuousObjectOwnerChooserOpen.value = true
    return
  }
  const owner = owners[0]
  if (owner) void addOrbitForOwner(request, owner)
}

async function addOrbitForOwner(request: OrbitAddRequest, owner: OrbitAddOwner): Promise<void> {
  const choice = ++continuousObjectAddChoiceId
  const fromOwnerChoice = pendingOrbitAdd.value === request
  let ownerChoiceAccepted = false
  const isCurrent = () => choice === continuousObjectAddChoiceId && orbitAddArmed.value
    && workspace.value === request.workspace
    && (!fromOwnerChoice || ownerChoiceAccepted || pendingOrbitAdd.value === request)
  if (!isCurrent()) return
  if (creationSession.value?.systemId !== owner.systemId
    && !await chooseCreationType(ORBIT_CREATION_TYPE, owner.systemId, isCurrent)) return
  if (!isCurrent()) return
  if (fromOwnerChoice) {
    ownerChoiceAccepted = true
    clearOrbitOwnerChoice()
  }
  await offerCreationCandidates(owner.candidates, isCurrent)
}

function chooseAddOwner(systemId: string): void {
  const orbit = pendingOrbitAdd.value
  if (!orbit) {
    chooseContinuousObjectOwner(systemId)
    return
  }
  const owner = orbit.owners.find(candidate => candidate.systemId === systemId)
  if (owner) void addOrbitForOwner(orbit, owner)
}

async function armSystemAddAndClose(close: () => void): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  clearContinuousObjectAdd()
  if (orbitAddArmed.value && !await quitSystemAdd()) return
  armSystemAdd()
  close()
}

async function beginRouteAndClose(close: () => void): Promise<void> {
  clearContinuousObjectAdd()
  if (orbitAddArmed.value && !await quitSystemAdd()) return
  beginRoute()
  close()
}

async function quitSystemAdd(isCurrent: () => boolean = () => true): Promise<boolean> {
  if (!isCurrent() || !await beforeWorkspaceOperation() || !isCurrent()) return false
  if (!await quitAdd(isCurrent) || !isCurrent()) return false
  clearContinuousObjectAdd()
  clearOrbitAdd()
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
  const capturedMap = clusterMapRef.value
  const previewVersion = capturedMap?.getClusterSystemPositionPreviewVersion?.(systemId)
  const startingWorkspace = workspace.value
  const startingSystem = startingWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
  const startingAnchor = startingWorkspace?.layout.systemPositions[systemId]
  const startingMode = mapMode.value
  const canMove = () => activeView.value === 'cluster' && mapMode.value === startingMode
    && (startingMode === 'move' || (startingMode === 'select'
      && inspectedTarget.value?.kind === 'system' && inspectedTarget.value.systemId === systemId))
  if (!startingWorkspace || !startingSystem || !startingAnchor
    || !canMove()) {
    if (clusterMapRef.value === capturedMap) {
      capturedMap?.setClusterSystemPositionPreview?.(systemId, null, previewVersion)
    }
    return
  }
  const captured = {
    workspaceId: startingWorkspace.id,
    clusterId: startingWorkspace.cluster.id,
    systemId,
    originPosition: { ...startingAnchor },
  }
  const isCurrent = (): boolean => {
    const latest = workspace.value
    const latestSystem = latest?.cluster.systems.find(candidate => candidate.id === captured.systemId)
    const latestAnchor = latest?.layout.systemPositions[captured.systemId]
    return latest !== null && latest !== undefined
      && latest.id === captured.workspaceId
      && latest.cluster.id === captured.clusterId
      && latestSystem !== undefined
      && latestAnchor?.x === captured.originPosition.x
      && latestAnchor.y === captured.originPosition.y
      && canMove()
  }
  try {
    if (!await beforeWorkspaceOperation() || !isCurrent()) return
    cancelSystemMovePreview()
    await moveSystem(systemId, position, captured)
  } finally {
    if (clusterMapRef.value === capturedMap) {
      capturedMap?.setClusterSystemPositionPreview?.(systemId, null, previewVersion)
    }
  }
}

async function changeMapMode(mode: 'select' | 'move', isCurrent: () => boolean = () => true): Promise<void> {
  if (!await beforeWorkspaceOperation()) return
  if (!isCurrent()) return
  if ((creationSession.value || clusterAddType.value || continuousObjectAddType.value || orbitAddArmed.value)
    && !await quitSystemAdd()) return
  if (!isCurrent()) return
  await setMapMode(mode, isCurrent)
}

async function handleAddEscape(event: KeyboardEvent): Promise<void> {
  const hasMovePreview = clusterSystemMovePreview.value !== null
  if (helpOpen.value || event.key !== 'Escape' || event.defaultPrevented
    || (!creationSession.value && !clusterAddType.value && !continuousObjectAddType.value && !orbitAddArmed.value
      && !hasMovePreview && !systemObjectMovePreview.value && !mapMoveTargeting.value)
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

async function preparePlayerExport() {
  const initialWorkspace = workspace.value
  const requestedView = activeView.value
  const requestedSystemId = requestedView === 'system' ? selectedSystemId.value : null
  const requestedRenderer = requestedView === 'cluster' ? clusterMapRef.value : systemMapRef.value
  const workspaceId = initialWorkspace?.id
  const clusterId = initialWorkspace?.cluster.id
  if (!initialWorkspace || !requestedRenderer || (requestedView === 'system' && !requestedSystemId)) return null

  const contextIsCurrent = (): boolean => {
    const currentWorkspace = workspace.value
    return currentWorkspace !== null
      && currentWorkspace.id === workspaceId
      && currentWorkspace.cluster.id === clusterId
      && activeView.value === requestedView
      && (requestedView !== 'system' || selectedSystemId.value === requestedSystemId)
      && (requestedView === 'cluster' ? clusterMapRef.value : systemMapRef.value) === requestedRenderer
  }

  try {
    if (!await beforeWorkspaceOperation()) return null
  } catch (error) {
    // A preflight rejection belongs to its captured request only; never publish it for a newer map.
    if (!contextIsCurrent()) return null
    throw error
  }
  if (!contextIsCurrent()) return null

  const capturedAppliedRevision = appliedRevision.value
  const appliedWorkspace = workspace.value
  if (!appliedWorkspace) return null
  const document = projectPlayerCluster(appliedWorkspace)
  let scene: CurrentPlayerMapScene | null = null

  if (requestedView === 'cluster') {
    scene = { kind: 'jump-cluster', document }
  } else {
    const publicSystemIndex = appliedWorkspace.cluster.systems
      .filter(system => system.publication !== 'hidden')
      .findIndex(system => system.id === requestedSystemId)
    const marker = publicSystemIndex >= 0 ? document.systems[publicSystemIndex] : undefined
    if (marker?.disclosure === 'revealed' && marker.map) {
      scene = { kind: 'star-system', document: marker.map, label: marker.label }
    }
  }

  const isCurrent = (): boolean => contextIsCurrent()
    && appliedRevision.value === capturedAppliedRevision

  return { document, scene, isCurrent }
}

const playerFileExports = usePlayerFileExports({
  prepare: preparePlayerExport,
  onPlayerLinkReady: () => toast.add({ title: 'Player link ready', color: 'success', icon: 'i-lucide-check' }),
  onPlayerLinkCopied: () => toast.add({ title: 'Player link copied', color: 'success', icon: 'i-lucide-check' }),
})
const {
  playerExportError,
  generatedPlayerUrl,
  playerLinkBusy,
  playerLinkStatus,
  downloadPlayerJson,
  downloadPlayerImage,
} = playerFileExports

function generatePlayerLink(): ReturnType<typeof playerFileExports.generatePlayerLink> {
  const baseUrl = new URL(runtimeConfig.app.baseURL, window.location.origin)
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
  baseUrl.search = ''
  baseUrl.hash = ''
  const readerUrl = new URL('player', baseUrl).toString()
  return playerFileExports.generatePlayerLink(readerUrl)
}

function copyPlayerLink(): void {
  void playerFileExports.copyPlayerLink()
}

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
  selectedSystem: inspectorSelectedSystem,
  mutations,
  getCurrentMapImage: (kind, scope, systemId, systemImageTarget) => {
    if (scope) {
      if (activeView.value !== 'cluster') return null
      if (scope === 'system') {
        if (!systemId || (systemImageTarget === 'inspected' && systemId !== continuousInspectorSystemId.value)) return null
        const system = workspace.value?.cluster.systems.find(candidate => candidate.id === systemId)
        if (!system) return null
        return {
          map: clusterMapRef.value,
          name: system.name,
          kind: 'star-system',
          scope,
          selectedSystemId: systemId,
        }
      }
      return {
        map: clusterMapRef.value,
        name: workspace.value?.cluster.name,
        kind: 'jump-cluster',
        scope,
        selectedSystemId: null,
      }
    }
    if (scope !== null) return null
    if (kind === 'jump-cluster') {
      if (activeView.value !== 'cluster') return null
      return {
        map: clusterMapRef.value,
        name: workspace.value?.cluster.name,
        kind,
        scope,
        selectedSystemId: null,
      }
    }
    if (activeView.value !== 'system') return null
    return {
      map: systemMapRef.value,
      name: selectedSystem.value?.name,
      kind,
      scope,
      selectedSystemId: null,
    }
  },
  getAppliedRevision: () => appliedRevision.value,
  getFieldDefinitionImportConflict,
  resolveImportDefinitionChanges,
  beforeWorkspaceOperation,
})
importReviewActions = workspaceFiles

function draftConsentState(): { signature: string; hasDrafts: boolean } {
  const snapshot = {
    chart: {
      sessionId: charts.session.value?.id ?? null,
      editing: chartEditing.value,
      clusterName: clusterName.value,
      systemName: systemName.value,
      playerTitle: playerTitle.value,
      publication: publication.value,
    },
    entity: routeObjectSession.value ?? entitySession.value,
    route: routeSession.value,
    fields: fieldDefinitionsSession,
    creation: creationSession.value,
    clusterAdd: clusterAddType.value,
    clusterMove: clusterSystemMovePreview.value,
    objectMove: systemObjectMovePreview.value,
    unresolvedExit: unresolvedExitPreview.value,
    orbitCenter: orbitCenterMovePreview.value,
    orbitAdjustment: orbitAdjustmentPreview.value,
    editingGesture: editingGestureActive.value,
  }
  return {
    signature: JSON.stringify(snapshot),
    hasDrafts: hasUncommittedNames.value
      || hasModifiedEntitySession.value
      || hasModifiedRouteSession.value
      || hasModifiedFieldDefinitionsSession.value
      || workflows.historyGuards.blockReason.value !== null,
  }
}

function resetAfterWorkspaceReplacement(): void {
  workflows.historyGuards.resetForWorkspaceReplacement()
  clearOrbitAdd()
  editorUi.setSelection({ activeView: 'cluster' })
  cancelJsonImport()
  history.resolveCapacity(false)
  historyOpen.value = false
  helpOpen.value = false
  mobileMenuOpen.value = false
  mobileHelpOpener.value = null
  helpOwnsFocus.value = false
  playerPreviewOpen.value = false
  headerFilesOpen.value = false
  recoveryDetailsOpen.value = false
  mapTypeFiltersOpen.value = false
  search.reset()
  filterCriteria.map.clearAll()
  publicationControls.closeMenu()
}

const workspaceRestore = useWorkspaceRestore({
  workspace,
  appliedRevision,
  durableVersion,
  getDraftConsentState: draftConsentState,
  replaceFromBackup,
  downloadCurrent: workspaceFiles.downloadWorkspaceSnapshot,
  afterReplacement: sourceKind => {
    resetAfterWorkspaceReplacement()
    if (sourceKind === 'google-drive') {
      toast.add({ title: 'Restored from Google Drive', color: 'success', icon: 'i-lucide-check' })
    }
    if (sourceKind === 'dropbox') {
      toast.add({ title: 'Restored from Dropbox', color: 'success', icon: 'i-lucide-check' })
    }
  },
})
const googleDriveRestore = useGoogleDriveRestore(workspaceRestore, googleDriveSignIn, undefined, {
  onCanceled: () => toast.add({ title: 'Google Drive restore canceled', color: 'neutral', icon: 'i-lucide-info' }),
})
const googleDriveRestoreButton = ref<InstanceType<typeof GoogleDriveRestoreButton> | null>(null)
const dropboxRestore = useDropboxRestore(workspaceRestore, dropboxSignIn)
const dropboxRestoreDialog = ref<InstanceType<typeof DropboxRestoreDialog> | null>(null)
const cloudBackupInProgress = computed(() => googleDriveBackup.busy.value || dropboxBackup.busy.value)
const googleDriveRestoreInProgress = computed(() => googleDriveRestore.busy.value || googleDriveRestore.dialogOpen.value)
const cloudRestoreInProgress = computed(() => googleDriveRestoreInProgress.value || dropboxRestore.dialogOpen.value)
const dropboxRestoreBlocked = computed(() => cloudBackupInProgress.value || googleDriveRestoreInProgress.value
  || workspaceRestoreReview.value !== null
  || (workspaceRestoreLoading.value && !dropboxRestore.dialogOpen.value))
const dropboxBackupCleanupRetryPending = computed(() => dropboxBackup.state.value === 'cleanup-retry')
const dropboxBackupCanStartNew = computed(() => dropboxBackup.state.value === 'retry'
  || dropboxBackupCleanupRetryPending.value)
const dropboxBackupActionLabel = computed(() => {
  if (dropboxBackupCleanupRetryPending.value) return 'Retry Dropbox retention cleanup'
  if (dropboxBackup.state.value === 'retry') return 'Retry Dropbox backup'
  return 'Back up Jump Cluster to Dropbox'
})
const dropboxBackupRetentionNotice = `Saves complete JSON with GM notes in the Dropbox App Folder. Cleanup keeps the ${DROPBOX_BACKUP_LIMIT} newest dated backups per account.`
const cloudBackupItems = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = [{
    label: 'Back up Jump Cluster to Google Drive',
    description: googleDriveBackup.message.value
      || googleDriveSignIn.message.value
      || (googleDriveSignIn.status.value === 'warming' ? 'Loading Google Drive…' : undefined),
    icon: 'i-lucide-cloud-upload',
    googleDrive: true,
    disabled: cloudBackupInProgress.value || cloudRestoreInProgress.value || !googleDriveSignIn.ready.value,
    onSelect: (event) => {
      event.preventDefault()
      void openBackupDialog(googleDriveBackupDialogOpen)
    },
  }, {
    label: dropboxBackupActionLabel.value,
    hint: !dropboxSignIn.ready.value
      ? dropboxSignIn.message.value || dropboxBackupRetentionNotice
      : dropboxBackupRetentionNotice,
    icon: 'i-lucide-cloud-upload',
    disabled: cloudBackupInProgress.value || workspaceRestoreLoading.value || !dropboxSignIn.ready.value,
    onSelect: () => dropboxBackup.activate(),
  }]

  if (dropboxBackupCanStartNew.value) {
    items.push({
      label: 'Start a new Dropbox backup',
      hint: dropboxBackupRetentionNotice,
      icon: 'i-lucide-cloud-upload',
      disabled: cloudBackupInProgress.value || workspaceRestoreLoading.value || !dropboxSignIn.ready.value,
      onSelect: () => dropboxBackup.startNewBackup(),
    })
  }

  if (googleDriveBackup.canCancel.value) {
    items.push({
      label: 'Cancel Google Drive backup',
      icon: 'i-lucide-circle-x',
      googleDrive: true,
      onSelect: () => googleDriveBackup.cancelBeforeUpload(),
    })
  }
  if (dropboxBackup.canCancel.value) {
    items.push({
      label: 'Cancel Dropbox backup',
      icon: 'i-lucide-circle-x',
      onSelect: () => dropboxBackup.cancelBeforeUpload(),
    })
  }

  return items
})
const cloudRestoreItems = computed<DropdownMenuItem[]>(() => {
  const restoreStatus = googleDriveSignIn.message.value
    || googleDriveRestore.message.value
    || (googleDriveSignIn.status.value === 'warming' ? 'Loading Google Drive…' : '')
    || (googleDriveRestore.state.value === 'authorizing' ? 'Signing in to Google Drive…' : '')
    || (googleDriveRestore.busy.value ? 'Loading Google Drive backups…' : '')
  const items: DropdownMenuItem[] = [{
    label: 'Restore Jump Cluster from Google Drive',
    description: restoreStatus || undefined,
    icon: 'i-lucide-cloud-download',
    googleDrive: true,
    disabled: cloudBackupInProgress.value || cloudRestoreInProgress.value || !googleDriveSignIn.ready.value,
    onSelect: () => googleDriveRestoreButton.value?.activateFrom(
      workspaceMapChrome.value?.mapFilesTriggerElement() ?? null,
    ),
  }, {
    label: 'Restore Jump Cluster from Dropbox',
    description: dropboxRestore.message.value || dropboxSignIn.message.value || undefined,
    icon: 'i-lucide-cloud-download',
    disabled: dropboxRestoreBlocked.value || dropboxRestore.busy.value
      || dropboxRestore.dialogOpen.value || !dropboxSignIn.ready.value,
    onSelect: () => dropboxRestoreDialog.value?.activateFrom(
      workspaceMapChrome.value?.mapFilesTriggerElement() ?? null,
    ),
  }]

  if (googleDriveRestore.canCancel.value) {
    items.push({
      label: 'Cancel Google Drive restore',
      icon: 'i-lucide-circle-x',
      googleDrive: true,
      onSelect: () => googleDriveRestore.cancel(),
    })
  }
  if (googleDriveSignIn.status.value === 'error') {
    items.push({
      label: 'Retry loading Google Drive',
      icon: 'i-lucide-refresh-cw',
      googleDrive: true,
      onSelect: () => { void googleDriveSignIn.retryLoading() },
    })
  }
  if (googleDriveSignIn.hasAccessToken.value) {
    items.push({
      label: 'Forget Google Drive account',
      icon: 'i-lucide-user-round-x',
      googleDrive: true,
      disabled: googleDriveRestore.dialogOpen.value || googleDriveBackup.busy.value,
      onSelect: () => googleDriveSignIn.forgetAccessToken(),
    })
  }

  return items
})

async function openBackupDialog(
  dialog: Ref<boolean>,
): Promise<void> {
  const chrome = workspaceMapChrome.value
  const startingWorkspace = workspace.value
  const startingView = activeView.value
  const startingSystemId = selectedSystemId.value
  const trigger = chrome?.mapFilesTriggerElement() ?? null
  if (!chrome || !startingWorkspace || !trigger) return

  const closed = await chrome.closeMapFilesForDialog()
  if (!closed || workspaceMapChrome.value !== chrome
    || workspace.value !== startingWorkspace
    || activeView.value !== startingView
    || selectedSystemId.value !== startingSystemId
    || chrome.mapFilesTriggerElement() !== trigger) {
    return
  }

  dialog.value = true
}

function restoreBackupDialogFocus(event: Event): void {
  event.preventDefault()
  void nextTick(() => restoreDialogFocus(
    createDialogFocusTarget(workspaceMapChrome.value?.mapFilesTriggerElement() ?? null),
    createDialogFocusTarget(workspaceMain.value),
  ))
}

const workspaceRestoreReview = workspaceRestore.review
const workspaceRestoreLoading = workspaceRestore.loading
const workspaceRestoreError = workspaceRestore.error
const workspaceMain = ref<HTMLElement | null>(null)
const workspaceRestoreReturnTarget = ref<HTMLElement | null>(null)
const localWorkspaceRestoreLoading = computed(() => workspaceRestoreLoading.value
  && !googleDriveRestore.canCancel.value && !dropboxRestore.dialogOpen.value)

watch(workspaceRestoreError, error => {
  if (error) workspaceRestoreReturnTarget.value = null
})

function openLocalWorkspaceRestore(event: Event, returnFocusTarget: HTMLElement | null): void {
  cancelCloudRestore()
  workspaceRestoreReturnTarget.value = returnFocusTarget
  cancelJsonImport()
  void workspaceRestore.openLocalFile(event)
}

function restoreLastValidWorkspace(): void {
  cancelCloudRestore()
  workspaceRestoreReturnTarget.value = null
  void restoreBackup()
}

function retryWorkspaceHydration(): void {
  cancelCloudRestore()
  void hydrate()
}

function cancelCloudRestore(): void {
  if (googleDriveRestore.canCancel.value) googleDriveRestore.cancel(false)
  if (dropboxRestore.canCancel.value) dropboxRestore.cancel(false)
}

const {
  exportError,
  importError,
  downloadClusterJson,
  downloadSystemJson,
  downloadMapImage,
  importJsonFile,
  importReview,
  standaloneImportPlacement,
  standaloneImportPlacementEnabled,
  previewStandaloneImportAnchor,
  reviewStandaloneImportPlacement,
  cancelStandaloneImportPlacement,
  confirmJsonImport,
  cancelJsonImport,
  reviewImportFields,
  resumeImportReview,
} = workspaceFiles

async function handleWorkspaceJsonImport(event: Event): Promise<void> {
  await importJsonFile(event)
  if (!standaloneImportPlacementEnabled.value) return

  if (compactPanelOpen.value && compactPanel.value) closePanel(compactPanel.value)
}

function frameStandaloneImportPlacement(): void {
  if (!standaloneImportPlacementEnabled.value) return
  clusterMapRef.value?.frameStandaloneImportPlacement?.()
}

function handleStandaloneImportPlacementEscape(): void {
  if (!mapKeyboardOverlayOpen.value) cancelStandaloneImportPlacement()
}

watch(activeView, view => {
  if (view !== 'cluster' && standaloneImportPlacement.value) cancelStandaloneImportPlacement()
}, { flush: 'sync' })

watch(
  [() => workspace.value?.id, () => workspace.value?.cluster.id],
  () => {
    if (standaloneImportPlacement.value) cancelStandaloneImportPlacement()
  },
  { flush: 'sync' },
)

publicationFocusRestoreAllowed = request => !(
  historyOpen.value
  || helpOpen.value
  || mobileMenuOpen.value
  || chartNamesDialogOpen.value
  || playerPreviewOpen.value
  || fieldDefinitionDialogOpen.value
  || headerFilesOpen.value
  || recoveryDetailsOpen.value
  || historyCapacityRequest.value !== null
  || searchOpen.value
  || mapTypeFiltersOpen.value
  || deletionReview.value !== null
  || routeTransferReview.value !== null
  || catalogueTransferForm.value !== null
  || creationChooserOpen.value
  || continuousObjectOwnerChooserOpen.value
  || continuousObjectOtherTypeOpen.value
  || (compactPanelOpen.value && request.source === 'map')
  || editingGestureActive.value
  || importReview.value.open
  || importReview.value.suspended
  || importReview.value.confirming
)

const workspaceOverlayAvailable = computed(() => workspace.value !== null
  && !historyOpen.value
  && !helpOpen.value
  && !mobileMenuOpen.value
  && !chartNamesDialogOpen.value
  && !playerPreviewOpen.value
  && !fieldDefinitionDialogOpen.value
  && !headerFilesOpen.value
  && !recoveryDetailsOpen.value
  && historyCapacityRequest.value === null
  && !mapTypeFiltersOpen.value
  && !creationChooserOpen.value
  && !continuousObjectOwnerChooserOpen.value
  && !continuousObjectOtherTypeOpen.value
  && deletionReview.value === null
  && routeTransferReview.value === null
  && catalogueTransferForm.value === null
  && !importReview.value.open
  && !importReview.value.suspended
  && !importReview.value.confirming
  && !compactPanelOpen.value
  && !editingGestureActive.value)

const mapKeyboardOverlayOpen = computed(() => !workspaceOverlayAvailable.value
  || searchOpen.value
  || publicationMenuRequest.value !== null
  || googleDriveBackupDialogOpen.value)

function openPlayerPreview(focusMapFiles: () => void): void {
  if (!workspaceOverlayAvailable.value || searchOpen.value || publicationMenuRequest.value) return
  focusMapFiles()
  playerPreviewOpen.value = true
}

readEditorHistoryBlockReason = () => {
  if (standaloneImportPlacement.value) return 'Finish or cancel standalone system placement before using Undo or Redo.'
  if (historyOpen.value) return 'Close History before using Undo or Redo.'
  if (catalogueTransferForm.value) return 'Finish or cancel the current transfer before using Undo or Redo.'
  if (helpOpen.value) return 'Close Help before using Undo or Redo.'
  if (searchOpen.value) return 'Close Search before using Undo or Redo.'
  if (mapTypeFiltersOpen.value) return 'Close Filters before using Undo or Redo.'
  if (chartNamesDialogOpen.value || playerPreviewOpen.value || fieldDefinitionDialogOpen.value || headerFilesOpen.value
    || recoveryDetailsOpen.value || creationChooserOpen.value || continuousObjectOwnerChooserOpen.value || continuousObjectOtherTypeOpen.value || compactPanelOpen.value) {
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
  pageOverlayOpen: () => mapKeyboardOverlayOpen.value || standaloneImportPlacement.value !== null,
  undo: undoWorkspace,
  redo: redoWorkspace,
})

const mapToolShortcuts = useMapToolShortcuts({
  workspaceEnabled: () => workspace.value !== null,
  pageOverlayOpen: () => mapKeyboardOverlayOpen.value || standaloneImportPlacement.value !== null,
  editingGestureActive: () => editingGestureActive.value,
  activeMapKey: () => activeMapKey.value,
  mapMode: () => mapMode.value,
  addIntentActive: () => mapCreationType.value !== null || clusterAddType.value !== null,
  changeMapMode,
  openAddChooser: openMapAddChooserFromKeyboard,
  focusActiveMap: mapControls.focusActiveMap,
})

function canOpenSearchShortcut(): boolean {
  return workspaceOverlayAvailable.value && !mapToolShortcuts.isMapInputActive()
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
