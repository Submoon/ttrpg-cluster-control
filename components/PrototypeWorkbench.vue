<template>
  <div class="prototype-page">
    <div v-if="variant === 'A'" class="proto-shell proto-a" :class="theme" :data-theme="theme">
      <header class="a-topbar">
        <div class="brand-mark"><span class="brand-seal">✦</span><div><strong>TTRPG CLUSTER CONTROL</strong><small>CAMPAIGN MAP EDITOR</small></div></div>
        <div class="context-breadcrumb"><span>CHART ROOM</span><b>／</b><strong>{{ contextName }}</strong></div>
        <div class="topbar-actions">
          <UButton size="sm" color="neutral" variant="outline" @click="toggleTheme">{{ theme === 'dark' ? 'Daylight' : 'Lamplight' }}</UButton>
          <UButton size="sm" color="neutral" variant="ghost" @click="copyShareLink">Share view</UButton>
        </div>
      </header>

      <main class="a-workbench">
        <aside class="a-directory">
          <div class="directory-intro"><p class="proto-eyebrow">ACTIVE CHART</p><h1>{{ workspace.cluster.name }}</h1><p>{{ workspace.cluster.systems.length }} systems · {{ workspace.cluster.routes.length }} routes · local prototype</p></div>
          <div class="directory-actions">
            <UButton block color="primary" @click="activateTool('add-system')"><span aria-hidden="true">＋</span> Add system</UButton>
            <UButton block color="neutral" variant="outline" @click="activateTool('add-route')"><span aria-hidden="true">⤳</span> Draw Jump Route</UButton>
          </div>
          <div class="directory-section">
            <div class="section-heading"><span>KNOWN SYSTEMS</span><UBadge color="neutral" variant="subtle">{{ workspace.cluster.systems.length }}</UBadge></div>
            <button v-for="(system, index) in workspace.cluster.systems" :key="system.id" class="directory-row" :class="{ 'is-current': activeSystemId === system.id && activeView === 'system' }" @click="navigateToSystem(system.id)">
              <span class="row-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="row-copy"><strong>{{ system.name }}</strong><small>{{ system.objects.filter(object => object.subtype === 'star').length }} stellar body · {{ system.orbits.length }} orbits</small></span><span class="row-arrow">↗</span>
            </button>
          </div>
          <div class="directory-section route-index">
            <div class="section-heading"><span>ROUTE REGISTER</span><UBadge color="neutral" variant="subtle">{{ workspace.cluster.routes.length }}</UBadge></div>
            <button v-for="route in workspace.cluster.routes" :key="route.id" class="route-row" :class="{ 'is-current': selection.kind === 'route' && selection.id === route.id }" @click="requestSelection({ kind: 'route', id: route.id })">
              <span class="route-glyph">{{ route.toPointId ? '⌁' : '↗' }}</span><span><strong>Jump-{{ route.jumpLevel }}</strong><small>{{ routeLabel(route) }}</small></span><span class="route-level">{{ route.jumpLevel }}</span>
            </button>
          </div>
          <div class="directory-foot"><span class="online-dot"></span> LOCAL WORKSPACE · DEMO DATA</div>
        </aside>

        <section class="a-map-column">
          <div class="map-context-bar">
            <div class="map-title-block"><p class="proto-eyebrow">{{ activeView === 'cluster' ? 'JUMP CLUSTER / OVERVIEW' : 'STAR SYSTEM / DETAIL' }}</p><h2>{{ contextName }}</h2><p>{{ activeView === 'cluster' ? 'Known crossings and unresolved exits' : 'Schematic orbital survey · not to scale' }}</p></div>
            <div class="context-actions">
              <UButton v-if="activeView === 'system'" size="sm" color="neutral" variant="outline" @click="backToCluster">← Jump Cluster</UButton>
              <UButton size="sm" color="neutral" variant="outline" @click="chooseImport">Import JSON</UButton>
              <UButton size="sm" color="neutral" variant="outline" @click="openFieldManager">Field definitions</UButton>
            </div>
          </div>
          <div class="tool-shelf">
            <div class="tool-selector" role="toolbar" aria-label="Map tools">
              <UButton size="sm" :color="activeTool === 'navigation' ? 'primary' : 'neutral'" :variant="activeTool === 'navigation' ? 'solid' : 'ghost'" @click="setNavigation">Navigate</UButton>
              <UButton size="sm" :color="activeTool === 'move' ? 'primary' : 'neutral'" :variant="activeTool === 'move' ? 'solid' : 'ghost'" @click="activateTool('move')">Move / Modify</UButton>
              <UButton v-if="activeView === 'system'" size="sm" :color="activeTool === 'add-object' ? 'primary' : 'neutral'" :variant="activeTool === 'add-object' ? 'solid' : 'ghost'" @click="activateTool('add-object')">Add mark</UButton>
              <UButton v-if="activeView === 'system'" size="sm" :color="activeTool === 'add-orbit' ? 'primary' : 'neutral'" :variant="activeTool === 'add-orbit' ? 'solid' : 'ghost'" @click="activateTool('add-orbit')">Add Orbit</UButton>
            </div>
            <USelect v-if="activeView === 'system'" v-model="activeSubtype" class="subtype-select" size="sm" :items="catalogueItems" aria-label="Object type to add" />
            <div class="tool-help"><span class="tool-indicator" :class="`tool-${activeTool}`"></span><span>{{ toolPrompt }}</span><UButton v-if="activeTool !== 'navigation'" size="xs" color="neutral" variant="ghost" @click="setNavigation">Cancel&nbsp; · &nbsp;Esc</UButton></div>
          </div>
          <div class="map-frame workbench-map-frame">
            <PrototypeMapCanvas ref="mapCanvas" :workspace="workspace" :view="activeView" :system="activeSystem" :selected-system-id="selection.kind === 'system' ? selection.id : null" :selected-route-id="selection.kind === 'route' ? selection.id : null" :selected-object-id="selection.kind === 'object' ? selection.id : null" :selected-orbit-id="selection.kind === 'orbit' ? selection.id : null" :tool="activeTool" @open-system="navigateToSystem" @select-route="id => requestSelection({ kind: 'route', id })" @select-object="id => requestSelection({ kind: 'object', id })" @select-orbit="id => requestSelection({ kind: 'orbit', id })" @move-system="moveSystem" @move-object="moveObject" @move-orbit-center="moveOrbitCenter" @rotate-object="rotateObject" @resize-orbit="resizeOrbit" @rotate-orbit="rotateOrbit" @place-object-in-orbit="placeObjectInOrbit" @map-target="handleMapTarget" />
          </div>
          <footer class="map-meta"><div class="map-legend"><span><i class="legend-system"></i>Known system</span><span><i class="legend-route"></i>Jump Route</span><span><i class="legend-exit"></i>Unresolved exit</span></div><span class="map-instruction">{{ activeView === 'cluster' ? 'Select a system to open its map · drag background to pan' : 'Select a mark or Orbit to inspect · wheel to zoom' }}</span><StatePeek :state="visibleState" />
          </footer>
        </section>

        <aside class="a-inspector" :class="{ 'inspector-open': inspectorOpen }">
          <PrototypeInspector v-if="inspectorOpen" v-bind="inspectorBindings" v-model:name="draft.name" v-model:description="draft.description" v-model:jump-level="draft.jumpLevel" v-model:unresolved-exit="draft.unresolvedExit" v-model:field-values="draft.fieldValues" v-model:native-values="draft.nativeValues" @hide="inspectorOpen = false" @apply="applyDraft" @discard="discardDraft" @delete="requestDelete" @manage-fields="openFieldManager" @retry-save="retrySave" />
          <button v-else class="reopen-inspector" @click="inspectorOpen = true"><span>◷</span> Open inspector <small>{{ inspectorDescriptor.title }}</small></button>
        </aside>
      </main>
    </div>

    <div v-else-if="variant === 'B'" class="proto-shell proto-b" :class="[theme, { 'has-open-inspector': inspectorOpen, 'has-open-side-panel': hierarchyOpen || catalogueOpen }]" :data-theme="theme">
      <header class="b-commandbar">
        <div class="brand-mark"><span class="brand-seal">✦</span><div><strong>TTRPG CLUSTER CONTROL</strong><small>FIELD CONSOLE · CHART 07</small></div></div>
        <div class="b-breadcrumb"><button v-if="activeView === 'system'" @click="backToCluster">JUMP CLUSTER</button><span v-if="activeView === 'system'">/</span><strong>{{ contextName }}</strong></div>
        <div class="b-command-actions"><span class="command-save"><i :class="`state-${saveState}`"></i>{{ saveState === 'error' ? 'SIMULATED ERROR' : 'LOCAL · PROTOTYPE' }}</span><UButton size="sm" color="neutral" variant="outline" @click="toggleTheme">{{ theme === 'dark' ? '☼' : '☾' }} Theme</UButton><UButton size="sm" color="neutral" variant="outline" @click="openFieldManager">Fields</UButton></div>
      </header>
      <main class="b-map-board">
        <nav class="b-tool-rail" aria-label="Map tools">
          <div class="rail-cap">TOOLS</div>
          <button class="rail-button" :class="{ 'is-active': activeTool === 'navigation' }" title="Navigation" :aria-pressed="activeTool === 'navigation'" @click="setNavigation"><b>⌖</b><span>Navigate</span></button>
          <button class="rail-button" :class="{ 'is-active': activeTool === 'move' }" title="Move / Modify" :aria-pressed="activeTool === 'move'" @click="activateTool('move', false)"><b>↗</b><span>Move</span></button>
          <button v-if="activeView === 'system'" class="rail-button" :class="{ 'is-active': activeTool === 'add-object' || catalogueOpen }" title="Choose a catalogue mark to add" :aria-pressed="activeTool === 'add-object' || catalogueOpen" :aria-expanded="catalogueOpen" @click="toggleCatalogue"><b>＋</b><span>Add mark</span></button>
          <button v-if="activeView === 'system'" class="rail-button" :class="{ 'is-active': activeTool === 'add-orbit' }" title="Add an Orbit" :aria-pressed="activeTool === 'add-orbit'" @click="activateTool('add-orbit', false)"><b>◎</b><span>Orbit</span></button>
          <button v-if="activeView === 'cluster'" class="rail-button" :class="{ 'is-active': activeTool === 'add-system' }" title="Add a system" :aria-pressed="activeTool === 'add-system'" @click="activateTool('add-system', false)"><b>✦</b><span>System</span></button>
          <button v-if="activeView === 'cluster'" class="rail-button" :class="{ 'is-active': activeTool === 'add-route' }" title="Draw Jump Route" :aria-pressed="activeTool === 'add-route'" @click="activateTool('add-route', false)"><b>⤳</b><span>Route</span></button>
          <button class="rail-button" :class="{ 'is-active': hierarchyOpen }" title="Show map hierarchy" :aria-expanded="hierarchyOpen" @click="toggleHierarchy"><b>⌘</b><span>Hierarchy</span></button>
          <span class="rail-spacer"></span>
          <button class="rail-button" title="Import map file" @click="chooseImport"><b>⇧</b><span>Import</span></button>
          <button class="rail-button" title="Export map image" @click="exportMap('png')"><b>⇩</b><span>Export</span></button>
          <button class="rail-button" :class="{ 'is-active': inspectorOpen }" title="Toggle inspector" :aria-expanded="inspectorOpen" @click="toggleInspector"><b>▤</b><span>Details</span></button>
          <div class="rail-bottom"><span class="online-dot"></span><small>NO SYNC</small></div>
        </nav>
        <section class="b-map-area">
          <div class="b-map-hud"><div><small>{{ activeView === 'cluster' ? 'CHART / 01' : `SYSTEM / ${systemNumber}` }}</small><strong>{{ contextName }}</strong></div><div class="hud-actions"><UButton v-if="activeView === 'system'" size="sm" color="neutral" variant="outline" @click="backToCluster">← Back</UButton><UButton size="sm" color="neutral" variant="outline" @click="exportMap('svg')">SVG</UButton><UButton size="sm" color="neutral" variant="outline" @click="copyShareLink">Share</UButton></div></div>
          <PrototypeHierarchy v-if="hierarchyOpen" :workspace="workspace" :active-view="activeView" :active-system-id="activeSystemId" :selection="selection" @close="hierarchyOpen = false" @back-to-cluster="backToCluster" @open-system="navigateToSystem" @select-route="id => requestHierarchySelection({ kind: 'route', id })" @select-object="id => requestHierarchySelection({ kind: 'object', id })" @select-orbit="id => requestHierarchySelection({ kind: 'orbit', id })" />
          <PrototypeCataloguePicker v-if="catalogueOpen && activeView === 'system'" :selected="activeSubtype" @close="catalogueOpen = false" @select="selectCatalogueType" />
          <div class="map-frame b-map-frame"><PrototypeMapCanvas ref="mapCanvas" :workspace="workspace" :view="activeView" :system="activeSystem" :selected-system-id="selection.kind === 'system' ? selection.id : null" :selected-route-id="selection.kind === 'route' ? selection.id : null" :selected-object-id="selection.kind === 'object' ? selection.id : null" :selected-orbit-id="selection.kind === 'orbit' ? selection.id : null" :tool="activeTool" @open-system="navigateToSystem" @select-route="id => requestSelection({ kind: 'route', id })" @select-object="id => requestSelection({ kind: 'object', id })" @select-orbit="id => requestSelection({ kind: 'orbit', id })" @move-system="moveSystem" @move-object="moveObject" @move-orbit-center="moveOrbitCenter" @rotate-object="rotateObject" @resize-orbit="resizeOrbit" @rotate-orbit="rotateOrbit" @place-object-in-orbit="placeObjectInOrbit" @map-target="handleMapTarget" /></div>
          <div class="b-zoom-controls" role="toolbar" aria-label="Map zoom controls"><button aria-label="Zoom out" @click="mapCanvas?.zoomBy(1 / 1.2)">−</button><button aria-label="Fit map" @click="mapCanvas?.fitMap()">Fit</button><button aria-label="Zoom in" @click="mapCanvas?.zoomBy(1.2)">＋</button></div>
          <div class="b-map-footer"><span>{{ visibleState.selection }}</span><span>{{ zoomNote }}</span><span>DRAG BACKGROUND TO PAN · WHEEL TO ZOOM</span></div>
        </section>
        <aside class="b-inspector-float" :class="{ 'inspector-open': inspectorOpen }">
          <PrototypeInspector v-if="inspectorOpen" v-bind="inspectorBindings" v-model:name="draft.name" v-model:description="draft.description" v-model:jump-level="draft.jumpLevel" v-model:unresolved-exit="draft.unresolvedExit" v-model:field-values="draft.fieldValues" v-model:native-values="draft.nativeValues" @hide="inspectorOpen = false" @apply="applyDraft" @discard="discardDraft" @delete="requestDelete" @manage-fields="openFieldManager" @retry-save="retrySave" />
          <button v-else class="detail-tab" @click="openInspector"><span>≡</span><b>Inspect</b><small>{{ inspectorDescriptor.title }}</small></button>
        </aside>
      </main>
    </div>

    <div v-else class="proto-shell proto-c" :class="theme" :data-theme="theme">
      <header class="c-topline"><div class="brand-mark"><span class="brand-seal">✦</span><div><strong>TTRPG CLUSTER CONTROL</strong><small>CAMPAIGN ATLAS · VOL. I</small></div></div><div class="c-header-context"><span>FIELD NOTE 07</span><b>·</b><strong>{{ contextName }}</strong></div><div class="topbar-actions"><UButton size="sm" color="neutral" variant="outline" @click="toggleTheme">{{ theme === 'dark' ? 'Daylight' : 'Lamplight' }}</UButton><UButton size="sm" color="neutral" variant="outline" @click="exportMap('svg')">Export plate</UButton></div></header>
      <main class="c-atlas-grid">
        <aside class="c-index">
          <p class="proto-eyebrow">CHARTED REGIONS</p><h1>Atlas<br>of the<br><em>Known</em></h1><div class="c-index-rule"></div><p class="c-intro">A working folio of the routes, systems, and unanswered signals known to the game master.</p>
          <div class="c-index-label">JUMP CLUSTER <span>01—{{ workspace.cluster.systems.length }}</span></div>
          <button class="c-cluster-entry" :class="{ 'is-current': activeView === 'cluster' }" @click="backToCluster"><span class="c-entry-no">I</span><span><strong>{{ workspace.cluster.name }}</strong><small>THE OUTER REACH</small></span><b>↗</b></button>
          <div class="c-index-label">STAR SYSTEMS <span>{{ String(workspace.cluster.systems.length).padStart(2, '0') }}</span></div>
          <button v-for="(system, index) in workspace.cluster.systems" :key="system.id" class="c-system-entry" :class="{ 'is-current': activeView === 'system' && activeSystemId === system.id }" @click="navigateToSystem(system.id)"><span class="c-entry-no">{{ toRoman(index + 1) }}</span><span><strong>{{ system.name }}</strong><small>{{ system.objects.length }} surveyed marks</small></span><b>→</b></button>
          <div class="c-index-bottom"><span class="online-dot"></span> EDITION 01 · LOCAL COPY</div>
        </aside>
        <section class="c-map-column">
          <div class="c-map-heading"><div><p class="proto-eyebrow">{{ activeView === 'cluster' ? 'PLATE I · NAVIGATIONAL SURVEY' : `PLATE ${toRoman(systemNumber)} · ORBITAL SURVEY` }}</p><h2>{{ contextName }}</h2></div><div class="c-heading-actions"><UButton v-if="activeView === 'system'" size="sm" color="neutral" variant="outline" @click="backToCluster">← Cluster</UButton><UButton size="sm" color="neutral" variant="outline" @click="inspectorOpen = !inspectorOpen">{{ inspectorOpen ? 'Hide notes' : 'Inspect' }}</UButton><UButton size="sm" color="neutral" variant="outline" @click="openFieldManager">Field key</UButton></div></div>
          <div class="c-map-controls"><div class="c-tool-tabs"><UButton size="sm" :color="activeTool === 'navigation' ? 'primary' : 'neutral'" :variant="activeTool === 'navigation' ? 'solid' : 'ghost'" @click="setNavigation">Observe</UButton><UButton size="sm" :color="activeTool === 'move' ? 'primary' : 'neutral'" :variant="activeTool === 'move' ? 'solid' : 'ghost'" @click="activateTool('move')">Amend</UButton><UButton v-if="activeView === 'system'" size="sm" :color="activeTool === 'add-object' ? 'primary' : 'neutral'" :variant="activeTool === 'add-object' ? 'solid' : 'ghost'" @click="activateTool('add-object')">Chart mark</UButton><UButton v-if="activeView === 'system'" size="sm" :color="activeTool === 'add-orbit' ? 'primary' : 'neutral'" :variant="activeTool === 'add-orbit' ? 'solid' : 'ghost'" @click="activateTool('add-orbit')">Orbit</UButton></div><USelect v-if="activeView === 'system'" v-model="activeSubtype" size="sm" :items="catalogueItems" aria-label="Object type to add" /><span class="c-tool-caption">{{ toolPrompt }}</span></div>
          <div class="map-frame c-map-frame"><PrototypeMapCanvas ref="mapCanvas" :workspace="workspace" :view="activeView" :system="activeSystem" :selected-system-id="selection.kind === 'system' ? selection.id : null" :selected-route-id="selection.kind === 'route' ? selection.id : null" :selected-object-id="selection.kind === 'object' ? selection.id : null" :selected-orbit-id="selection.kind === 'orbit' ? selection.id : null" :tool="activeTool" @open-system="navigateToSystem" @select-route="id => requestSelection({ kind: 'route', id })" @select-object="id => requestSelection({ kind: 'object', id })" @select-orbit="id => requestSelection({ kind: 'orbit', id })" @move-system="moveSystem" @move-object="moveObject" @move-orbit-center="moveOrbitCenter" @rotate-object="rotateObject" @resize-orbit="resizeOrbit" @rotate-orbit="rotateOrbit" @place-object-in-orbit="placeObjectInOrbit" @map-target="handleMapTarget" /></div>
          <div class="c-map-caption"><span>FIG. {{ activeView === 'cluster' ? '01' : '02' }}</span><span>{{ activeView === 'cluster' ? 'Schematic relationships; distances are not to scale.' : 'Elliptical Orbits are diagrammatic and may contain nested paths.' }}</span><span>{{ activeView === 'cluster' ? workspace.cluster.routes.length : activeSystem?.orbits.length }} {{ activeView === 'cluster' ? 'CROSSINGS' : 'ORBITS' }}</span></div>
        </section>
        <aside class="c-notes-column" :class="{ 'inspector-open': inspectorOpen }">
          <div class="c-notes-head"><span>FIELD NOTES</span><UButton size="xs" color="neutral" variant="ghost" @click="inspectorOpen = !inspectorOpen">{{ inspectorOpen ? 'Close' : 'Open' }}</UButton></div>
          <PrototypeInspector v-if="inspectorOpen" v-bind="inspectorBindings" v-model:name="draft.name" v-model:description="draft.description" v-model:jump-level="draft.jumpLevel" v-model:unresolved-exit="draft.unresolvedExit" v-model:field-values="draft.fieldValues" v-model:native-values="draft.nativeValues" @hide="inspectorOpen = false" @apply="applyDraft" @discard="discardDraft" @delete="requestDelete" @manage-fields="openFieldManager" @retry-save="retrySave" />
          <div v-else class="c-note-empty"><p>Open the margin editor to inspect the selected mark without leaving the map.</p><UButton color="neutral" variant="outline" @click="inspectorOpen = true">Inspect selection</UButton></div>
          <div class="c-sidenote"><span>01 / NAVIGATION</span><p>Activate a system from the chart to open its local survey. Return restores the Jump Cluster context.</p></div>
          <div class="c-sidenote"><span>02 / EDITION MARK</span><p>Edits and file actions in this atlas are simulated. The seeded survey lives in memory only.</p></div>
          <div class="c-notes-utility"><UButton size="sm" color="neutral" variant="outline" @click="chooseImport">Preview import</UButton><UButton size="sm" color="neutral" variant="outline" @click="exportMap('png')">Print PNG</UButton></div>
          <StatePeek :state="visibleState" />
        </aside>
      </main>
    </div>

    <div v-if="variant && isDev" class="prototype-switcher" aria-label="Prototype variants">
      <button aria-label="Previous interface" title="Previous interface · ←" @click="cycleVariant(-1)">←</button>
      <div class="switcher-current"><span>{{ variant }}</span><div><strong>{{ variantNames[variant] }}</strong><small>DISPOSABLE UI PROTOTYPE</small></div></div>
      <button aria-label="Next interface" title="Next interface · →" @click="cycleVariant(1)">→</button>
      <UButton class="switcher-share" size="xs" color="neutral" variant="ghost" @click="copyShareLink">Copy link</UButton>
    </div>

    <UModal v-if="guardReason === 'navigation'" v-model:open="guardOpen" title="Unsaved inspector draft" description="This draft belongs to the current selection.">
      <template #content>
        <div class="proto-modal-body">
          <p class="proto-eyebrow">CONTEXT CHANGE PAUSED</p><h2>Keep this edit with its current mark?</h2>
          <p>Apply updates the in-memory chart. Discard restores the last applied values. Stay keeps this view and draft open.</p>
          <div class="proto-modal-actions"><UButton color="primary" @click="resolveGuard('apply')">Apply and continue</UButton><UButton color="neutral" variant="outline" @click="resolveGuard('discard')">Discard and continue</UButton><UButton color="neutral" variant="ghost" @click="resolveGuard('stay')">Stay here</UButton></div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Confirm map deletion" description="Deletion is simulated in this prototype.">
      <template #content>
        <div class="proto-modal-body"><p class="proto-eyebrow">DESTRUCTIVE ACTION</p><h2>Remove {{ deleteLabel }}?</h2><p>This changes only the in-memory sample map. You can reload the page to restore the seed.</p><div class="proto-modal-actions"><UButton color="error" @click="confirmDelete">Delete from sample</UButton><UButton color="neutral" variant="outline" @click="deleteOpen = false">Keep it</UButton></div></div>
      </template>
    </UModal>

    <FieldDefinitionsDialog ref="fieldDefinitionsDialog" hide-trigger :workspace="workspace" :saving="saveState === 'saving'" :save-error="fieldDefinitionError" :save-revision="fieldDefinitionSaveRevision" :inspector-conflict="guardOpen && guardReason === 'field'" :inspector-conflict-error="inspectorConflictError" @request-open="openFieldManager" @create-custom-field="createFieldDefinition" @save-field-definition="saveFieldDefinition" @remove-field-definition="removeFieldDefinition" @clear-error="clearFieldDefinitionError" @resolve-inspector-conflict="resolveGuard" />

    <UModal v-model:open="importOpen" title="Review imported map" description="The file is validated before replacing the in-memory sample.">
      <template #content>
        <div class="proto-modal-body"><p class="proto-eyebrow">IMPORT PREVIEW · NO FILE WRITTEN</p><h2>{{ importSummary?.type === 'cluster' ? 'Jump Cluster' : 'Star system' }} ready to add</h2><div class="import-counts"><span><strong>{{ importSummary?.systems ?? 0 }}</strong><small>systems</small></span><span><strong>{{ importSummary?.objects ?? 0 }}</strong><small>marks</small></span><span><strong>{{ importSummary?.orbits ?? 0 }}</strong><small>orbits</small></span><span><strong>{{ importSummary?.routes ?? 0 }}</strong><small>routes</small></span></div><p v-if="importError" class="import-error" role="alert">{{ importError }}</p><div class="proto-modal-actions"><UButton color="primary" :disabled="!importCandidate" @click="confirmImport">Use imported sample</UButton><UButton color="neutral" variant="outline" @click="importOpen = false">Cancel</UButton></div></div>
      </template>
    </UModal>
    <input ref="fileInput" class="visually-hidden" type="file" accept="application/json,.json" @change="previewImport" />
    <div v-if="toast" class="prototype-toast" role="status" aria-live="polite">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { catalogueTypes, isCustomFieldApplicableToObject, planMapEntityDeletion, updateSystemObject, type CatalogueSubtype, type CustomFieldValue, type JumpRoute, type LocalWorkspace, type MapDeletionTarget, type Orbit, type Point, type StarSystem, type SystemObject, prepareJsonImport } from '../domain/workspace'
import { addCustomFieldDefinition, removeCustomFieldDefinition, renameCustomFieldDefinition, updateCustomFieldApplicability, updateCustomFieldOptions, updateNativeFieldOptions } from '../domain/workspace-fields'
import { sameCustomFieldApplicability, type CustomFieldCreate, type FieldDefinitionUpdate } from './field-definitions/model'
import type { MapImageFormat } from '../utils/map-image-export'

type Variant = 'A' | 'B' | 'C'
type Tool = 'navigation' | 'move' | 'add-object' | 'add-orbit' | 'add-system' | 'add-route'
type Selection = { kind: 'system' | 'object' | 'orbit' | 'route'; id: string }
type PendingAction = { kind: 'view'; view: 'cluster' | 'system'; systemId?: string } | { kind: 'selection'; selection: Selection; fromHierarchy?: boolean } | { kind: 'field-conflict'; commit: () => void }
const bMobileQuery = '(max-width: 760px), (max-width: 1024px) and (max-height: 600px)'

const props = defineProps<{ initialVariant: Variant }>()
const route = useRoute()
const router = useRouter()
const variant = ref<Variant>(props.initialVariant)
watch(() => props.initialVariant, value => { variant.value = value })

const variantNames: Record<Variant, string> = { A: 'Cartographer’s workbench', B: 'Map-first field console', C: 'Atlas folio' }
const isDev = import.meta.dev
const theme = ref<'dark' | 'light'>('dark')
const workspace = ref<LocalWorkspace>(seedWorkspace())
const activeView = ref<'cluster' | 'system'>('cluster')
const activeSystemId = ref('sys-vela')
const selection = ref<Selection>({ kind: 'route', id: 'route-vela-kestrel' })
const clusterSelection = ref<Selection>({ kind: 'route', id: 'route-vela-kestrel' })
const systemSelections = reactive<Record<string, Selection>>({})
const activeTool = ref<Tool>('navigation')
const activeSubtype = ref<CatalogueSubtype>('planet')
const catalogueOpen = ref(false)
const hierarchyOpen = ref(false)
const inspectorOpen = ref(true)
const lastBPanel = ref<'inspector' | 'hierarchy'>('inspector')
const saveState = ref<'saved' | 'saving' | 'error'>('saved')
const saveMessage = ref('This is a memory-only design study; no workspace storage is connected.')
const guardOpen = ref(false)
const guardReason = ref<'navigation' | 'field'>('navigation')
const pendingAction = ref<PendingAction | null>(null)
const deleteOpen = ref(false)
const deleteTarget = ref<Selection | null>(null)
const importOpen = ref(false)
const importSummary = ref<ReturnType<typeof prepareJsonImport>['summary'] | null>(null)
const importCandidate = ref<LocalWorkspace | null>(null)
const importError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const mapCanvas = ref<{ exportImage(format: MapImageFormat): Promise<Blob>; zoomBy(factor: number): void; fitMap(): void } | null>(null)
const fieldDefinitionsDialog = ref<{ open(): void; cancelImpactReview(): void } | null>(null)
const toast = ref('')
const draft = reactive({ name: '', description: '', jumpLevel: 1, unresolvedExit: '', fieldValues: {} as Record<string, CustomFieldValue>, nativeValues: { atmosphere: '', portClass: '' } })
const draftBaseline = ref('')
const fieldDefinitionSaveRevision = ref(0)
const fieldDefinitionError = ref('')
const inspectorError = ref('')
const inspectorConflictError = ref('')
const routeOriginPoint = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let mobilePanelsQuery: MediaQueryList | null = null
let failFirstSave = true

const activeSystem = computed(() => workspace.value.cluster.systems.find(system => system.id === activeSystemId.value) ?? null)
const activeSystemIndex = computed(() => Math.max(0, workspace.value.cluster.systems.findIndex(system => system.id === activeSystemId.value)))
const systemNumber = computed(() => activeSystemIndex.value + 1)
const contextName = computed(() => activeView.value === 'cluster' ? workspace.value.cluster.name : activeSystem.value?.name ?? 'Unknown system')
const currentRoute = computed(() => selection.value.kind === 'route' ? workspace.value.cluster.routes.find(routeItem => routeItem.id === selection.value.id) ?? null : null)
const currentObject = computed(() => selection.value.kind === 'object' ? activeSystem.value?.objects.find(object => object.id === selection.value.id) ?? null : null)
const currentOrbit = computed(() => selection.value.kind === 'orbit' ? activeSystem.value?.orbits.find(orbit => orbit.id === selection.value.id) ?? null : null)
const currentSystemSelection = computed(() => selection.value.kind === 'system' ? workspace.value.cluster.systems.find(system => system.id === selection.value.id) ?? null : null)
const hasDirtyDraft = computed(() => serializeDraft() !== draftBaseline.value)
const catalogueItems = computed(() => catalogueTypes.map(type => ({ label: type.label, value: type.value })))
const inspectorDescriptor = computed(() => {
  if (currentRoute.value) {
    return { kind: 'route' as const, eyebrow: 'JUMP ROUTE / INSPECTION', title: currentRoute.value.name ?? `Jump-${currentRoute.value.jumpLevel}`, subtitle: 'Logical passage between known Jump Points.', canDelete: true, routeIsUnresolved: currentRoute.value.toPointId === null, routeSummary: routeLabel(currentRoute.value) }
  }
  if (currentObject.value) {
    return { kind: 'object' as const, eyebrow: `${currentObject.value.family.toUpperCase()} / ${currentObject.value.subtype.toUpperCase()}`, title: currentObject.value.name, subtitle: `${currentObject.value.locationKey} · ${placementLabel(currentObject.value)}`, canDelete: true, routeIsUnresolved: false, routeSummary: '' }
  }
  if (currentOrbit.value) {
    return { kind: 'orbit' as const, eyebrow: 'ORBIT / GEOMETRY', title: `Orbit ${currentOrbit.value.order}`, subtitle: orbitLabel(activeSystem.value, currentOrbit.value), canDelete: true, routeIsUnresolved: false, routeSummary: '' }
  }
  if (currentSystemSelection.value) {
    return { kind: 'system' as const, eyebrow: 'STAR SYSTEM / DIRECTORY', title: currentSystemSelection.value.name, subtitle: `${currentSystemSelection.value.objects.length} map marks · ${currentSystemSelection.value.orbits.length} elliptical Orbits`, canDelete: workspace.value.cluster.systems.length > 1, routeIsUnresolved: false, routeSummary: '' }
  }
  return { kind: 'chart' as const, eyebrow: 'CHART / WORKSPACE', title: workspace.value.cluster.name, subtitle: 'A schematic Jump Cluster and its campaign notes.', canDelete: false, routeIsUnresolved: false, routeSummary: '' }
})

const inspectorBindings = computed(() => ({
  ...inspectorDescriptor.value,
  dirty: hasDirtyDraft.value,
  customFields: currentObject.value
    ? workspace.value.objectFieldSettings.customFields.filter(field => isCustomFieldApplicableToObject(field, currentObject.value!))
    : [],
  object: currentObject.value,
  atmosphereOptions: workspace.value.objectFieldSettings.atmosphereOptions,
  portClassOptions: workspace.value.objectFieldSettings.portClassOptions,
  saveState: saveState.value,
  saveMessage: saveMessage.value,
  validationError: inspectorError.value,
}))
const deleteLabel = computed(() => {
  if (deleteTarget.value?.kind === 'route') return 'this Jump Route'
  if (deleteTarget.value?.kind === 'system') return 'this star system'
  return 'this map mark'
})
const toolPrompt = computed(() => {
  const prompts: Record<Tool, string> = {
    navigation: activeView.value === 'cluster' ? 'Click or tap a system to open its chart; drag the background to pan.' : 'Click or tap a mark or Orbit to inspect. Dragging the background pans the chart.',
    move: 'Move / Modify is active. Select and drag a mark; the chart itself stays pannable.',
    'add-object': `Place a ${catalogueTypes.find(type => type.value === activeSubtype.value)?.label ?? 'map mark'} in open space or target an Orbit.`,
    'add-orbit': 'Choose an object to host this Orbit, or click open space for an unoccupied center.',
    'add-system': 'Click open space in the Jump Cluster to place a new star system.',
    'add-route': routeOriginPoint.value ? 'Choose the destination system to finish this Jump Route.' : 'Choose a system to set the first Jump Point, then choose a destination.',
  }
  return prompts[activeTool.value]
})
const zoomNote = computed(() => 'FIT · ZOOM · PAN')
const visibleState = computed(() => ({
  variant: `${variant.value} — ${variantNames[variant.value]}`,
  view: activeView.value === 'cluster' ? 'Jump Cluster' : activeSystem.value?.name,
  selection: selectionLabel(selection.value),
  tool: activeTool.value,
  draft: hasDirtyDraft.value ? 'unsaved inspector edits' : 'clean',
  save: saveState.value === 'error' ? 'simulated error; retry available' : saveState.value === 'saving' ? 'simulated save running' : 'memory only',
  theme: theme.value,
}))

function serializeDraft(): string {
  return JSON.stringify({ name: draft.name, description: draft.description, jumpLevel: draft.jumpLevel, unresolvedExit: draft.unresolvedExit, fieldValues: draft.fieldValues, nativeValues: draft.nativeValues })
}

function syncDraft(): void {
  draft.name = ''
  draft.description = ''
  draft.jumpLevel = 1
  draft.unresolvedExit = ''
  draft.fieldValues = {}
  draft.nativeValues = { atmosphere: '', portClass: '' }
  if (currentRoute.value) {
    draft.name = currentRoute.value.name ?? `Jump-${currentRoute.value.jumpLevel}`
    draft.jumpLevel = currentRoute.value.jumpLevel
    draft.unresolvedExit = currentRoute.value.toPointId === null ? currentRoute.value.unresolvedExit : ''
  } else if (currentObject.value) {
    draft.name = currentObject.value.name
    draft.description = currentObject.value.description
    draft.fieldValues = { ...(currentObject.value.customFieldValues ?? {}) }
    draft.nativeValues = { atmosphere: currentObject.value.atmosphere ?? '', portClass: currentObject.value.portClass ?? '' }
  } else if (currentOrbit.value) {
    draft.name = `Orbit ${currentOrbit.value.order}`
    draft.description = orbitLabel(activeSystem.value, currentOrbit.value)
  } else if (currentSystemSelection.value) {
    draft.name = currentSystemSelection.value.name
  } else {
    draft.name = workspace.value.cluster.name
    draft.description = 'Known crossings and unresolved exits across the outer reach.'
  }
  draftBaseline.value = serializeDraft()
}

watch(selection, syncDraft, { deep: true, immediate: true })
watch(() => workspace.value.cluster.name, () => { if (selection.value.kind === 'route') return; if (!hasDirtyDraft.value) syncDraft() })
watch(() => serializeDraft(), () => { inspectorError.value = '' })

function showToast(message: string): void {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3200)
}

function setNavigation(): void {
  activeTool.value = 'navigation'
  routeOriginPoint.value = null
  catalogueOpen.value = false
}

function isBMobileViewport(): boolean {
  return variant.value === 'B' && typeof window !== 'undefined' && window.matchMedia(bMobileQuery).matches
}

function openInspector(): void {
  inspectorOpen.value = true
  if (variant.value === 'B') {
    lastBPanel.value = 'inspector'
    catalogueOpen.value = false
    if (isBMobileViewport()) hierarchyOpen.value = false
  }
}

function openHierarchy(): void {
  hierarchyOpen.value = true
  if (variant.value === 'B') {
    lastBPanel.value = 'hierarchy'
    catalogueOpen.value = false
    if (isBMobileViewport()) inspectorOpen.value = false
  }
}

function reflowBPanelsForMobile(): void {
  if (isBMobileViewport() && inspectorOpen.value && hierarchyOpen.value) {
    if (lastBPanel.value === 'hierarchy') inspectorOpen.value = false
    else hierarchyOpen.value = false
  }
}

watch(variant, reflowBPanelsForMobile)

function activateTool(tool: Tool, revealInspector = true): void {
  activeTool.value = tool
  if (tool !== 'add-route') routeOriginPoint.value = null
  if (tool !== 'add-object') catalogueOpen.value = false
  if (revealInspector) openInspector()
  showToast(tool === 'move' ? 'Move / Modify active. Escape returns to Navigation.' : `${toolLabel(tool)} active. Escape returns to Navigation.`)
}

function toggleCatalogue(): void {
  if (activeView.value !== 'system') return
  if (activeTool.value !== 'add-object') activateTool('add-object', false)
  catalogueOpen.value = !catalogueOpen.value
  if (catalogueOpen.value) {
    hierarchyOpen.value = false
    if (isBMobileViewport()) inspectorOpen.value = false
  }
}

function selectCatalogueType(subtype: CatalogueSubtype): void {
  activeSubtype.value = subtype
  activeTool.value = 'add-object'
  catalogueOpen.value = false
  showToast(`${catalogueTypes.find(type => type.value === subtype)?.label ?? 'Map mark'} selected. Choose open space or an Orbit to place it.`)
}

function toggleHierarchy(): void {
  if (hierarchyOpen.value) hierarchyOpen.value = false
  else openHierarchy()
}

function toggleInspector(): void {
  if (inspectorOpen.value) inspectorOpen.value = false
  else openInspector()
}

function runPending(action: PendingAction): void {
  if (action.kind === 'field-conflict') return
  if (action.kind === 'selection') {
    selection.value = action.selection
    if (activeView.value === 'cluster') clusterSelection.value = action.selection
    else systemSelections[activeSystemId.value] = action.selection
    if (action.fromHierarchy) {
      hierarchyOpen.value = false
      catalogueOpen.value = false
      openInspector()
    }
    return
  }
  if (action.view === 'cluster') {
    hierarchyOpen.value = false
    catalogueOpen.value = false
    activeView.value = 'cluster'
    selection.value = clusterSelection.value
  } else if (action.systemId) {
    hierarchyOpen.value = false
    catalogueOpen.value = false
    activeView.value = 'system'
    activeSystemId.value = action.systemId
    selection.value = systemSelections[action.systemId] ?? { kind: 'object', id: firstObjectId(action.systemId) }
    systemSelections[action.systemId] = selection.value
  }
  setNavigation()
  openInspector()
}

function requestTransition(action: PendingAction): void {
  if (hasDirtyDraft.value) {
    guardReason.value = 'navigation'
    pendingAction.value = action
    guardOpen.value = true
    return
  }
  runPending(action)
}

function navigateToSystem(systemId: string): void {
  if (activeTool.value === 'add-route') {
    chooseRouteSystem(systemId)
    return
  }
  if (activeTool.value === 'add-system') {
    showToast('Add System is ready: click open space on the Jump Cluster chart.')
    return
  }
  requestTransition({ kind: 'view', view: 'system', systemId })
}

function backToCluster(): void {
  if (activeView.value === 'cluster') return
  requestTransition({ kind: 'view', view: 'cluster' })
}

function requestSelection(next: Selection): void {
  if (selection.value.kind === next.kind && selection.value.id === next.id) return
  requestTransition({ kind: 'selection', selection: next })
}

function requestHierarchySelection(next: Selection): void {
  if (selection.value.kind === next.kind && selection.value.id === next.id) {
    hierarchyOpen.value = false
    catalogueOpen.value = false
    openInspector()
    return
  }
  requestTransition({ kind: 'selection', selection: next, fromHierarchy: true })
}

function resolveGuard(choice: 'apply' | 'discard' | 'stay'): void {
  const action = pendingAction.value
  guardOpen.value = false
  pendingAction.value = null
  if (choice === 'stay' || !action) return
  if (action.kind === 'field-conflict') {
    if (choice === 'discard') {
      discardDraft(false)
      action.commit()
    } else {
      if (!applyDraft()) {
        inspectorConflictError.value = inspectorError.value
        guardOpen.value = true
        pendingAction.value = action
        return
      }
      fieldDefinitionsDialog.value?.cancelImpactReview()
      inspectorConflictError.value = ''
      showToast('Object draft applied. Save the field change again to refresh its affected-values review.')
    }
    guardReason.value = 'navigation'
    return
  }
  if (choice === 'apply') {
    if (!applyDraft()) return
  } else discardDraft(false)
  runPending(action)
}

function applyDraft(): boolean {
  if (currentRoute.value) {
    const next: JumpRoute = currentRoute.value.toPointId === null
      ? { ...currentRoute.value, name: draft.name, jumpLevel: Math.max(1, draft.jumpLevel), unresolvedExit: draft.unresolvedExit || 'Uncharted exit' }
      : { ...currentRoute.value, name: draft.name, jumpLevel: Math.max(1, draft.jumpLevel) }
    replaceRoute(next)
  } else if (currentObject.value && activeSystem.value) {
    const validFieldIds = new Set(workspace.value.objectFieldSettings.customFields.map(field => field.id))
    const customFieldValues = Object.fromEntries(Object.entries(draft.fieldValues).filter(([fieldId]) => validFieldIds.has(fieldId)))
    try {
      replaceSystem(updateSystemObject(activeSystem.value, currentObject.value.id, {
        name: draft.name,
        description: draft.description,
        customFieldValues,
        atmosphere: draft.nativeValues.atmosphere || undefined,
        portClass: draft.nativeValues.portClass || undefined,
      }, workspace.value.objectFieldSettings))
    } catch (error) {
      inspectorError.value = error instanceof Error ? error.message : 'The object changes could not be applied.'
      return false
    }
  } else if (currentSystemSelection.value) {
    renameSystem(currentSystemSelection.value.id, draft.name)
  } else if (selection.value.kind === 'route' || selection.value.kind === 'system') {
    workspace.value.cluster.name = draft.name
  }
  syncDraft()
  inspectorError.value = ''
  beginSimulatedSave()
  showToast('Applied to the in-memory map; simulated save started.')
  return true
}

function discardDraft(announce = true): void {
  syncDraft()
  if (announce) showToast('Inspector draft discarded.')
}

function beginSimulatedSave(retry = false): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveState.value = 'saving'
  saveMessage.value = 'Simulating a durable write. The prototype bypasses IndexedDB.'
  saveTimer = setTimeout(() => {
    if (failFirstSave && !retry) {
      failFirstSave = false
      saveState.value = 'error'
      saveMessage.value = 'Simulated IndexedDB failure. The applied chart remains in memory.'
      return
    }
    saveState.value = 'saved'
    saveMessage.value = 'Simulated retry succeeded. No data was written to browser storage.'
  }, 460)
}

function retrySave(): void { beginSimulatedSave(true) }

function moveSystem(id: string, point: Point): void {
  if (activeTool.value !== 'move') return
  workspace.value.layout.systemPositions[id] = point
  showToast('System moved in the current sample chart.')
}

function moveObject(id: string, point: Point): void {
  if (activeTool.value !== 'move' || !activeSystem.value) return
  replaceSystem({ ...activeSystem.value, objects: activeSystem.value.objects.map(object => object.id === id ? { ...object, placement: { kind: 'system', ...point } } : object) })
  showToast('Map mark moved in the current sample chart.')
}

function moveOrbitCenter(id: string, center: Point, hostId: string | null): void {
  if (activeTool.value !== 'move' || !activeSystem.value) return
  replaceSystem({ ...activeSystem.value, orbits: activeSystem.value.orbits.map(orbit => orbit.id === id ? { ...orbit, hostId, ...(hostId ? {} : { center }) } as Orbit : orbit) })
}

function rotateObject(id: string, angle: number): void {
  if (activeTool.value !== 'move') return
  workspace.value.layout.objectAngles[id] = angle
}

function resizeOrbit(id: string, radii: { horizontal: number; vertical: number }): void {
  if (activeTool.value !== 'move') return
  workspace.value.layout.orbitRadii[id] = radii
}

function rotateOrbit(id: string, rotation: number): void {
  if (activeTool.value !== 'move') return
  workspace.value.layout.orbitRotations[id] = rotation
}

function placeObjectInOrbit(id: string, orbitId: string, angle: number): void {
  if (activeTool.value !== 'move' || !activeSystem.value) return
  replaceSystem({ ...activeSystem.value, objects: activeSystem.value.objects.map(object => object.id === id ? { ...object, placement: { kind: 'orbit', orbitId } } : object) })
  workspace.value.layout.objectAngles[id] = angle
}

function handleMapTarget(target: { kind: 'empty'; point: Point } | { kind: 'orbit'; id: string } | { kind: 'object'; id: string } | { kind: 'system'; id: string }): void {
  if (activeTool.value === 'add-object') {
    if (target.kind !== 'empty' && target.kind !== 'orbit') return
    addObjectAtTarget(target)
  } else if (activeTool.value === 'add-orbit') {
    if (target.kind !== 'empty' && target.kind !== 'object') return
    addOrbitAtTarget(target)
  } else if (activeTool.value === 'add-system' && target.kind === 'empty') {
    addSystemAtTarget(target.point)
  } else if (activeTool.value === 'add-route' && target.kind === 'system') {
    chooseRouteSystem(target.id)
  }
}

function addObjectAtTarget(target: { kind: 'empty'; point: Point } | { kind: 'orbit'; id: string }): void {
  if (!activeSystem.value) return
  const subtype = catalogueTypes.find(type => type.value === activeSubtype.value) ?? catalogueTypes[1]
  const index = activeSystem.value.objects.filter(object => object.subtype === subtype.value).length + 1
  const id = `obj-demo-${Date.now().toString(36)}`
  const object: SystemObject = {
    id, family: subtype.family, subtype: subtype.value, locationKey: `${subtype.keyPrefix}-${index}`,
    name: `${subtype.label} ${index}`, description: '',
    placement: target.kind === 'orbit' ? { kind: 'orbit', orbitId: target.id } : { kind: 'system', ...target.point },
  }
  if (target.kind === 'orbit') workspace.value.layout.objectAngles[id] = Math.PI / 5
  replaceSystem({ ...activeSystem.value, objects: [...activeSystem.value.objects, object] })
  selection.value = { kind: 'object', id }
  systemSelections[activeSystemId.value] = selection.value
  setNavigation()
  openInspector()
  syncDraft()
  beginSimulatedSave()
  showToast(`${subtype.label} placed. One-shot Add returned to Navigation.`)
}

function addOrbitAtTarget(target: { kind: 'empty'; point: Point } | { kind: 'object'; id: string }): void {
  if (!activeSystem.value) return
  const order = Math.max(0, ...activeSystem.value.orbits.map(orbit => orbit.order)) + 1
  const id = `orbit-demo-${Date.now().toString(36)}`
  const orbit: Orbit = target.kind === 'object' ? { id, order, hostId: target.id } : { id, order, hostId: null, center: target.point }
  replaceSystem({ ...activeSystem.value, orbits: [...activeSystem.value.orbits, orbit] })
  workspace.value.layout.orbitRadii[id] = { horizontal: 120, vertical: 82 }
  workspace.value.layout.orbitRotations[id] = 0
  selection.value = { kind: 'orbit', id }
  systemSelections[activeSystemId.value] = selection.value
  setNavigation()
  syncDraft()
  beginSimulatedSave()
  showToast(`Orbit ${order} created. One-shot Add returned to Navigation.`)
}

function addSystemAtTarget(point: Point): void {
  const index = workspace.value.cluster.systems.length + 1
  const id = `sys-demo-${Date.now().toString(36)}`
  const system: StarSystem = { id, name: `Uncharted System ${index}`, objects: [], orbits: [] }
  workspace.value.cluster.systems.push(system)
  workspace.value.layout.systemPositions[id] = point
  setNavigation()
  navigateToSystem(id)
  showToast('System added to the in-memory Jump Cluster.')
}

function chooseRouteSystem(systemId: string): void {
  const system = workspace.value.cluster.systems.find(candidate => candidate.id === systemId)
  const point = system?.objects.find(object => object.subtype === 'jump-point')
  if (!point) {
    showToast('This system has no Jump Point to use as a route endpoint.')
    return
  }
  if (!routeOriginPoint.value) {
    routeOriginPoint.value = point.id
    showToast(`Origin set to ${system?.name} · choose a destination system.`)
    return
  }
  if (routeOriginPoint.value === point.id) {
    showToast('Choose a different destination Jump Point.')
    return
  }
  const id = `route-demo-${Date.now().toString(36)}`
  const routeItem: JumpRoute = { id, jumpLevel: Math.min(9, workspace.value.cluster.routes.length + 1), fromPointId: routeOriginPoint.value, toPointId: point.id }
  workspace.value.cluster.routes.push(routeItem)
  selection.value = { kind: 'route', id }
  clusterSelection.value = selection.value
  routeOriginPoint.value = null
  setNavigation()
  syncDraft()
  beginSimulatedSave()
  showToast(`Jump-${routeItem.jumpLevel} added to the sample cluster.`)
}

function requestDelete(): void {
  if (!inspectorDescriptor.value.canDelete) return
  deleteTarget.value = { ...selection.value }
  deleteOpen.value = true
}

function confirmDelete(): void {
  const target = deleteTarget.value
  deleteOpen.value = false
  if (!target) return
  const deletionTarget: MapDeletionTarget = target.kind === 'route'
    ? { kind: 'route', routeId: target.id }
    : target.kind === 'system'
      ? { kind: 'system', systemId: target.id }
      : target.kind === 'object'
        ? { kind: 'object', systemId: activeSystemId.value, objectId: target.id }
        : { kind: 'orbit', systemId: activeSystemId.value, orbitId: target.id }
  try {
    const plan = planMapEntityDeletion(workspace.value, deletionTarget)
    workspace.value = plan.workspace
    clusterSelection.value = { kind: 'route', id: workspace.value.cluster.routes[0]?.id ?? '' }
    if (target.kind === 'system') {
      if (!workspace.value.cluster.systems.some(system => system.id === activeSystemId.value)) {
        activeSystemId.value = workspace.value.cluster.systems[0]?.id ?? ''
        activeView.value = 'cluster'
      }
      selection.value = clusterSelection.value
    } else if (target.kind === 'route') {
      selection.value = clusterSelection.value
    } else {
      const selectedSystem = workspace.value.cluster.systems.find(system => system.id === activeSystemId.value)
      selection.value = { kind: 'object', id: selectedSystem?.objects[0]?.id ?? '' }
      systemSelections[activeSystemId.value] = selection.value
    }
    syncDraft()
    beginSimulatedSave()
    showToast(`Removed ${plan.entityLabel} and updated its dependent map marks in memory.`)
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'This sample map item could not be removed.')
  }
}

function openFieldManager(): void { fieldDefinitionsDialog.value?.open() }

function clearFieldDefinitionError(): void { fieldDefinitionError.value = '' }

function acceptFieldWorkspace(next: LocalWorkspace, message: string): void {
  const refreshInspector = !hasDirtyDraft.value
  workspace.value = next
  if (refreshInspector) syncDraft()
  fieldDefinitionSaveRevision.value += 1
  fieldDefinitionError.value = ''
  beginSimulatedSave()
  showToast(message)
}

function reportFieldError(error: unknown): void {
  fieldDefinitionError.value = error instanceof Error ? error.message : 'The field definition could not be changed.'
}

function createFieldDefinition(request: CustomFieldCreate): void {
  try {
    acceptFieldWorkspace(
      addCustomFieldDefinition(workspace.value, request.name, request.type, request.options),
      `Custom field “${request.name.trim()}” added to the in-memory chart.`,
    )
  } catch (error) { reportFieldError(error) }
}

function saveFieldDefinition(request: FieldDefinitionUpdate): void {
  try {
    const next = updatedWorkspaceWithFieldDefinition(workspace.value, request)
    const message = `Field definition “${request.name}” updated in memory.`
    if (hasConflictingInspectorFieldDraft(next)) {
      guardReason.value = 'field'
      inspectorConflictError.value = ''
      pendingAction.value = { kind: 'field-conflict', commit: () => saveFieldDefinition(request) }
      guardOpen.value = true
      return
    }
    acceptFieldWorkspace(next, message)
  } catch (error) { reportFieldError(error) }
}

function removeFieldDefinition(fieldId: string): void {
  const name = workspace.value.objectFieldSettings.customFields.find(field => field.id === fieldId)?.name ?? 'Custom field'
  try {
    const next = removeCustomFieldDefinition(workspace.value, fieldId)
    const message = `Field definition “${name}” and its saved values were removed from the in-memory chart.`
    if (hasConflictingInspectorFieldDraft(next)) {
      guardReason.value = 'field'
      inspectorConflictError.value = ''
      pendingAction.value = { kind: 'field-conflict', commit: () => removeFieldDefinition(fieldId) }
      guardOpen.value = true
      return
    }
    acceptFieldWorkspace(next, message)
  } catch (error) { reportFieldError(error) }
}

function updatedWorkspaceWithFieldDefinition(base: LocalWorkspace, request: FieldDefinitionUpdate): LocalWorkspace {
  let next = base
  if (request.fieldId === 'native:atmosphere') return updateNativeFieldOptions(next, 'atmosphere', request.options, true)
  if (request.fieldId === 'native:port-class') return updateNativeFieldOptions(next, 'portClass', request.options, true)
  const current = next.objectFieldSettings.customFields.find(field => field.id === request.fieldId)
  if (!current) throw new Error('The selected custom field no longer exists.')
  if (request.name !== current.name) next = renameCustomFieldDefinition(next, current.id, request.name)
  if (current.type === 'single-select' && (current.options.length !== request.options.length || current.options.some((option, index) => option !== request.options[index]))) {
    next = updateCustomFieldOptions(next, current.id, request.options, true)
  }
  if (!sameCustomFieldApplicability(current.applicability, request.applicability)) {
    next = updateCustomFieldApplicability(next, current.id, request.applicability)
  }
  return next
}

function hasConflictingInspectorFieldDraft(candidate: LocalWorkspace): boolean {
  if (!hasDirtyDraft.value || !currentObject.value || !activeSystem.value) return false
  const objectId = currentObject.value.id
  const updated = candidate.cluster.systems.find(system => system.id === activeSystemId.value)?.objects.find(object => object.id === objectId)
  if (!updated) return false
  const existing = currentObject.value
  const storedValuesChanged = existing.atmosphere !== updated.atmosphere
    || existing.portClass !== updated.portClass
    || JSON.stringify(existing.customFieldValues ?? {}) !== JSON.stringify(updated.customFieldValues ?? {})
  if (storedValuesChanged) return true

  const definitions = candidate.objectFieldSettings.customFields
  for (const [fieldId, value] of Object.entries(draft.fieldValues)) {
    if (value === '' || value === undefined) continue
    const definition = definitions.find(field => field.id === fieldId)
    if (!definition) return true
    if (definition.type === 'single-select' && typeof value === 'string' && !definition.options.includes(value)) return true
  }
  if (draft.nativeValues.atmosphere && !candidate.objectFieldSettings.atmosphereOptions.includes(draft.nativeValues.atmosphere)) return true
  if (draft.nativeValues.portClass && !candidate.objectFieldSettings.portClassOptions.includes(draft.nativeValues.portClass)) return true
  return false
}

function chooseImport(): void { fileInput.value?.click() }

async function previewImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importCandidate.value = null
  importSummary.value = null
  importError.value = ''
  try {
    const prepared = prepareJsonImport(workspace.value, JSON.parse(await file.text()))
    importCandidate.value = prepared.workspace
    importSummary.value = prepared.summary
    importOpen.value = true
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'The selected JSON file could not be validated.'
    importOpen.value = true
  } finally {
    input.value = ''
  }
}

function confirmImport(): void {
  if (!importCandidate.value) return
  workspace.value = importCandidate.value
  activeView.value = 'cluster'
  activeSystemId.value = workspace.value.cluster.systems[0]?.id ?? ''
  selection.value = { kind: 'route', id: workspace.value.cluster.routes[0]?.id ?? '' }
  clusterSelection.value = selection.value
  setNavigation()
  importOpen.value = false
  syncDraft()
  beginSimulatedSave()
  showToast('Import preview accepted into memory. No browser storage was changed.')
}

async function exportMap(format: MapImageFormat): Promise<void> {
  try {
    const source = await mapCanvas.value?.exportImage('svg')
    if (!source) throw new Error('The chart is not ready yet.')
    const printSvg = await makePrintLight(source)
    const blob = format === 'svg' ? printSvg : await rasterizePrintSvg(printSvg)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slug(activeView.value === 'cluster' ? workspace.value.cluster.name : activeSystem.value?.name ?? 'map')}-prototype-print.${format}`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`${format.toUpperCase()} export captured the applied map in print-light colors; inspector draft excluded.`)
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'The map could not be exported.')
  }
}

async function rasterizePrintSvg(source: Blob): Promise<Blob> {
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, image.naturalWidth * 2)
    canvas.height = Math.max(1, image.naturalHeight * 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the print-light PNG canvas.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the print-light PNG.')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function makePrintLight(source: Blob): Promise<Blob> {
  const documentText = await source.text()
  const parsed = new DOMParser().parseFromString(documentText, 'image/svg+xml')
  const roles: Array<[string, string, string?]> = [
    ['.cluster-map-background, .map-background', '#fbf8ef'],
    ['.cluster-map-grid, .map-grid', '#f5f1e5'],
    ['.cluster-map-grid-line, .map-grid-line', '', '#e3ddcf'],
    ['.cluster-system-card', '#fffdf8', '#87998a'],
    ['.cluster-route-line', '', '#657f6b'],
    ['.cluster-route-label-bg', '#f8f4e9', '#9ba495'],
    ['.cluster-route-label, .cluster-system-name, .cluster-system-meta, .cluster-exit-label', '#26352d'],
    ['.cluster-exit-mark', '#e8ac76', '#8c6142'],
    ['.orbit-ring', 'none', '#87938a'],
    ['.orbit-center-handle, .orbit-axis-handle, .orbit-rotation-handle', '#fffdf8', '#627a68'],
    ['.system-object-glyph', '#405d4a'],
    ['.object-glyph-halo', '#dfc27a'],
    ['.object-key, .object-name, .object-type-mark, .map-empty', '#26352d'],
  ]
  for (const [selector, fill, stroke] of roles) {
    parsed.querySelectorAll<SVGElement>(selector).forEach(element => {
      if (fill) element.style.setProperty('fill', fill)
      if (stroke) element.style.setProperty('stroke', stroke)
    })
  }
  const serialized = new XMLSerializer().serializeToString(parsed.documentElement)
  return new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
}

async function copyShareLink(): Promise<void> {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', variant.value)
  try {
    await navigator.clipboard.writeText(url.toString())
    showToast(`Shareable ${variant.value} URL copied.`)
  } catch {
    showToast(`Share this URL: ${url.toString()}`)
  }
}

function toggleTheme(): void { theme.value = theme.value === 'dark' ? 'light' : 'dark' }

async function cycleVariant(direction: number): Promise<void> {
  const variants: Variant[] = ['A', 'B', 'C']
  const current = variants.indexOf(variant.value)
  const next = variants[(current + direction + variants.length) % variants.length]!
  await router.replace({ query: { ...route.query, variant: next } })
  variant.value = next
}

function onVariantKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, textarea, select, button, [contenteditable="true"], .map-view, [role="slider"], [role="button"]')) return
  event.preventDefault()
  void cycleVariant(event.key === 'ArrowRight' ? 1 : -1)
}

function applyPageTheme(): void {
  document.documentElement.dataset.prototypeTheme = theme.value
}

onMounted(() => {
  syncDraft()
  const compactViewport = variant.value === 'B' ? window.matchMedia(bMobileQuery).matches : window.matchMedia('(max-width: 760px), (max-height: 600px)').matches
  if (compactViewport) inspectorOpen.value = false
  mobilePanelsQuery = window.matchMedia(bMobileQuery)
  mobilePanelsQuery.addEventListener('change', reflowBPanelsForMobile)
  reflowBPanelsForMobile()
  applyPageTheme()
  window.addEventListener('keydown', onVariantKeydown)
})
watch(theme, applyPageTheme)
onUnmounted(() => {
  window.removeEventListener('keydown', onVariantKeydown)
  mobilePanelsQuery?.removeEventListener('change', reflowBPanelsForMobile)
  if (toastTimer) clearTimeout(toastTimer)
  if (saveTimer) clearTimeout(saveTimer)
  delete document.documentElement.dataset.prototypeTheme
})

function replaceSystem(system: StarSystem): void {
  workspace.value.cluster.systems = workspace.value.cluster.systems.map(candidate => candidate.id === system.id ? system : candidate)
}

function renameSystem(id: string, name: string): void {
  workspace.value.cluster.systems = workspace.value.cluster.systems.map(system => system.id === id ? { ...system, name } : system)
}

function replaceRoute(routeItem: JumpRoute): void {
  workspace.value.cluster.routes = workspace.value.cluster.routes.map(candidate => candidate.id === routeItem.id ? routeItem : candidate)
}

function firstObjectId(systemId: string): string {
  return workspace.value.cluster.systems.find(system => system.id === systemId)?.objects[0]?.id ?? ''
}

function routeLabel(routeItem: JumpRoute): string {
  const points = workspace.value.cluster.systems.flatMap(system => system.objects.filter(object => object.subtype === 'jump-point').map(object => ({ object, system })))
  const from = points.find(entry => entry.object.id === routeItem.fromPointId)
  const to = routeItem.toPointId ? points.find(entry => entry.object.id === routeItem.toPointId) : null
  return `${from?.system.name ?? 'Unknown'} ${to ? `→ ${to.system.name}` : `→ ${routeItem.unresolvedExit}`}`
}

function selectionLabel(item: Selection): string {
  if (item.kind === 'route') return workspace.value.cluster.routes.find(routeItem => routeItem.id === item.id)?.name ?? `Jump-${workspace.value.cluster.routes.find(routeItem => routeItem.id === item.id)?.jumpLevel ?? '—'}`
  if (item.kind === 'system') return workspace.value.cluster.systems.find(system => system.id === item.id)?.name ?? 'No system selected'
  const system = activeSystem.value
  if (item.kind === 'object') return system?.objects.find(object => object.id === item.id)?.name ?? 'No mark selected'
  return system?.orbits.find(orbit => orbit.id === item.id) ? `Orbit ${system.orbits.find(orbit => orbit.id === item.id)?.order}` : 'No Orbit selected'
}

function placementLabel(object: SystemObject): string {
  const placement = object.placement
  if (placement.kind === 'system') return `free placement · ${Math.round(placement.x * 100)} / ${Math.round(placement.y * 100)}`
  return orbitLabel(activeSystem.value, activeSystem.value?.orbits.find(orbit => orbit.id === placement.orbitId) ?? { id: placement.orbitId, order: 0, hostId: null, center: { x: 0, y: 0 } })
}

function orbitLabel(system: StarSystem | null, orbit: Orbit): string {
  const host = orbit.hostId ? system?.objects.find(object => object.id === orbit.hostId)?.name : null
  return host ? `Orbit ${orbit.order} around ${host}` : `Orbit ${orbit.order} · unoccupied center`
}

function toolLabel(tool: Tool): string {
  return ({ navigation: 'Navigation', move: 'Move / Modify', 'add-object': 'Add mark', 'add-orbit': 'Add Orbit', 'add-system': 'Add system', 'add-route': 'Draw Jump Route' })[tool]
}

function slug(value: string): string { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'chart' }
function toRoman(value: number): string { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][value] ?? String(value) }

function seedWorkspace(): LocalWorkspace {
  const star: SystemObject = { id: 'obj-vela-star', family: 'CelestialBody', subtype: 'star', locationKey: 'STAR-1', name: 'Vela Prime', description: 'A pale gold star with a restless corona.', placement: { kind: 'system', x: 0.5, y: 0.48 }, customFieldValues: { signal: 'Intermittent', threat: 2 } }
  const planet: SystemObject = { id: 'obj-vela-planet', family: 'CelestialBody', subtype: 'planet', locationKey: 'PL-1', name: 'Aster', description: 'Tidally locked; the night side is threaded with old beacons.', placement: { kind: 'orbit', orbitId: 'orbit-vela-one' }, atmosphere: 'Breathable', customFieldValues: { signal: 'Quiet', threat: 1 } }
  const moon: SystemObject = { id: 'obj-vela-moon', family: 'CelestialBody', subtype: 'moon', locationKey: 'MO-1', name: 'Morrow', description: 'A mining settlement went dark six months ago.', placement: { kind: 'orbit', orbitId: 'orbit-vela-two' }, atmosphere: 'Thin', customFieldValues: { signal: 'Strong', threat: 3 } }
  const station: SystemObject = { id: 'obj-vela-station', family: 'Installation', subtype: 'station', locationKey: 'ST-3', name: 'Pilgrim Anchorage', description: 'A small station at the edge of the charted lane.', placement: { kind: 'system', x: 0.79, y: 0.4 }, portClass: 'C' }
  const velaPoint: SystemObject = { id: 'jp-vela', family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-1', name: 'Vela Gate', description: 'Stable at Jump-4. The signal repeats every 31 hours.', placement: { kind: 'system', x: 0.2, y: 0.72 } }
  const anomaly: SystemObject = { id: 'obj-vela-anomaly', family: 'Phenomenon', subtype: 'anomaly', locationKey: 'AN-1', name: 'Blue Lenticular', description: 'A lens-shaped distortion beyond the third Orbit.', placement: { kind: 'system', x: 0.82, y: 0.76 }, customFieldValues: { signal: 'Strong', threat: 4 } }
  const vela: StarSystem = { id: 'sys-vela', name: 'Vela Reach', objects: [star, planet, moon, station, velaPoint, anomaly], orbits: [
    { id: 'orbit-vela-one', order: 1, hostId: star.id }, { id: 'orbit-vela-two', order: 2, hostId: planet.id },
    { id: 'orbit-vela-three', order: 3, hostId: null, center: { x: 772, y: 300 } },
  ] }
  const kestrel: StarSystem = { id: 'sys-kestrel', name: 'Kestrel Deep', objects: [
    { id: 'obj-kestrel-star', family: 'CelestialBody', subtype: 'star', locationKey: 'STAR-1', name: 'Kestrel A', description: 'A white dwarf, unexpectedly bright.', placement: { kind: 'system', x: 0.53, y: 0.5 } },
    { id: 'obj-kestrel-planet', family: 'CelestialBody', subtype: 'planet', locationKey: 'PL-1', name: 'Hearth', description: 'Thin atmosphere; abandoned weather array.', placement: { kind: 'orbit', orbitId: 'orbit-kestrel-one' } },
    { id: 'jp-kestrel', family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-2', name: 'The Sill', description: 'A narrow transit window.', placement: { kind: 'system', x: 0.19, y: 0.75 } },
    { id: 'obj-kestrel-belt', family: 'SmallBody/Field', subtype: 'belt', locationKey: 'BELT-1', name: 'Glass Belt', description: 'Fragments scatter radio signals.', placement: { kind: 'system', x: 0.83, y: 0.72 } },
  ], orbits: [{ id: 'orbit-kestrel-one', order: 1, hostId: 'obj-kestrel-star' }, { id: 'orbit-kestrel-two', order: 2, hostId: null, center: { x: 210, y: 395 } }] }
  const vesper: StarSystem = { id: 'sys-vesper', name: 'Vesper Station', objects: [
    { id: 'obj-vesper-star', family: 'CelestialBody', subtype: 'star', locationKey: 'STAR-1', name: 'Vesper', description: 'Amber flare star.', placement: { kind: 'system', x: 0.47, y: 0.5 } },
    { id: 'obj-vesper-colony', family: 'Installation', subtype: 'colony', locationKey: 'COL-1', name: 'New Alecto', description: 'Colony at the limit of its stores.', placement: { kind: 'system', x: 0.74, y: 0.35 } },
    { id: 'jp-vesper', family: 'JumpPoint', subtype: 'jump-point', locationKey: 'JP-3', name: 'Vesper Crossing', description: 'Quiet since first contact.', placement: { kind: 'system', x: 0.16, y: 0.76 } },
  ], orbits: [{ id: 'orbit-vesper-one', order: 1, hostId: 'obj-vesper-star' }] }
  return {
    id: 'sample-outer-reach',
    cluster: { id: 'cluster-outer-reach', name: 'The Outer Reach', systems: [vela, kestrel, vesper], routes: [
      { id: 'route-vela-kestrel', name: 'The Gannet Passage', jumpLevel: 4, fromPointId: 'jp-vela', toPointId: 'jp-kestrel' },
      { id: 'route-kestrel-vesper', jumpLevel: 6, fromPointId: 'jp-kestrel', toPointId: 'jp-vesper' },
      { id: 'route-vela-unknown', jumpLevel: 2, fromPointId: 'jp-vela', toPointId: null, unresolvedExit: 'Beyond the blue veil' },
      { id: 'route-vesper-vela', name: 'The Pale Return', jumpLevel: 8, fromPointId: 'jp-vesper', toPointId: 'jp-vela' },
    ] },
    layout: {
      systemPositions: { 'sys-vela': { x: 0.21, y: 0.5 }, 'sys-kestrel': { x: 0.52, y: 0.27 }, 'sys-vesper': { x: 0.79, y: 0.62 } },
      orbitRadii: { 'orbit-vela-one': { horizontal: 190, vertical: 138 }, 'orbit-vela-two': { horizontal: 66, vertical: 46 }, 'orbit-vela-three': { horizontal: 102, vertical: 146 }, 'orbit-kestrel-one': { horizontal: 166, vertical: 118 }, 'orbit-kestrel-two': { horizontal: 94, vertical: 74 }, 'orbit-vesper-one': { horizontal: 210, vertical: 138 } },
      orbitRotations: { 'orbit-vela-three': -21, 'orbit-kestrel-two': 18 },
      objectAngles: { 'obj-vela-planet': 0.25, 'obj-vela-moon': 4.3, 'obj-kestrel-planet': 2.3 },
    },
    objectFieldSettings: {
      atmosphereOptions: ['Breathable', 'Thin', 'Toxic', 'None'], portClassOptions: ['A', 'B', 'C', 'D'],
      customFields: [
        { id: 'signal', name: 'Signal strength', type: 'single-select', options: ['Quiet', 'Intermittent', 'Strong'] },
        { id: 'threat', name: 'Threat index', type: 'number' },
        { id: 'session-note', name: 'Session note', type: 'text' },
      ],
    },
  }
}
</script>

<style>
.prototype-page { min-height: 100vh; color: var(--proto-ink); font-family: var(--proto-ui-font); }
.proto-shell {
  --proto-ui-font: "Aptos", "Segoe UI", sans-serif;
  --proto-display-font: "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --proto-bg: #0d1715; --proto-surface: #14211e; --proto-raised: #1c2c27; --proto-soft: rgba(216, 225, 213, .045);
  --proto-ink: #e8ede4; --proto-muted: #a2b0a5; --proto-line: rgba(188, 202, 188, .17); --proto-accent: #e8b879;
  --proto-green: #94b49b; --proto-danger: #df897c; --proto-good: #9fc08d;
  --ui-text-dimmed: var(--proto-muted); --ui-text-muted: var(--proto-muted); --ui-text-toned: #c7d0c6; --ui-text: var(--proto-ink); --ui-text-highlighted: var(--proto-ink); --ui-text-inverted: #251c11;
  --ui-bg: var(--proto-surface); --ui-bg-muted: var(--proto-bg); --ui-bg-elevated: var(--proto-raised); --ui-bg-accented: #293a33; --ui-bg-inverted: var(--proto-ink);
  --ui-border: var(--proto-line); --ui-border-muted: var(--proto-line); --ui-border-accented: rgba(205, 218, 204, .39); --ui-border-inverted: var(--proto-ink);
  --app-bg: var(--proto-bg); --panel-bg: var(--proto-surface); --panel-raised: var(--proto-raised); --control-bg: #1a2823; --control-hover: #26382f;
  --line-soft: var(--proto-line); --line: rgba(188, 202, 188, .23); --line-strong: rgba(205, 218, 204, .39);
  --text-primary: var(--proto-ink); --text-secondary: #c7d0c6; --text-muted: var(--proto-muted); --text-quiet: #8d9c91;
  --accent: var(--proto-accent); --accent-hover: #f4c98d; --accent-ink: #251c11; --accent-soft: rgba(232, 184, 121, .13); --focus: #f5c98a;
  --status-good: var(--proto-good); --error: var(--proto-danger); --error-bg: #33201e; --error-border: #a96b5e; --add-bg: #52715a; --add-bg-hover: #64836a;
  --map-bg: #10201d; --map-card: #182925; --map-grid-line: #263d35; --map-text: #e8ede4; --map-muted: #a8b7ab; --map-route: #95b79d; --map-orbit: #83978d; --map-unresolved: #f0a176; --map-label-bg: #182b25; --map-label-border: #627d6d; --map-selected: #f5ca8c; --map-star-halo: #d9b86e; --map-installation: #88b99a;
  position: relative; display: flex; min-height: 100vh; flex-direction: column; overflow: hidden; color: var(--proto-ink); background: var(--proto-bg); isolation: isolate;
}
.proto-shell::before { position: absolute; z-index: -1; inset: 0; pointer-events: none; content: ""; opacity: .28; background: radial-gradient(ellipse at 52% -14%, rgba(139, 169, 135, .2), transparent 48rem), repeating-linear-gradient(0deg, transparent 0 39px, rgba(202, 218, 199, .025) 40px); }
.proto-shell[data-theme="light"] {
  --proto-bg: #ebe8dd; --proto-surface: #f6f3e9; --proto-raised: #fffdf7; --proto-soft: rgba(54, 69, 56, .05);
  --proto-ink: #28382f; --proto-muted: #69786b; --proto-line: rgba(47, 67, 53, .17); --proto-accent: #a26c35; --proto-green: #5f7c65; --proto-danger: #a24b3c; --proto-good: #61824e;
  --control-bg: #fbf8ef; --control-hover: #eee9dc; --line: rgba(47, 67, 53, .25); --line-strong: rgba(47, 67, 53, .42); --text-secondary: #4d5d50; --text-quiet: #718073;
  --accent-hover: #815126; --accent-ink: #fffaf0; --accent-soft: rgba(162, 108, 53, .12); --focus: #825a2e; --error-bg: #f4e7e2; --error-border: #b96d5c; --add-bg: #657e61; --add-bg-hover: #536b50;
  --map-bg: #f7f3e7; --map-card: #fffdf7; --map-grid-line: #ded8c9; --map-text: #28382f; --map-muted: #69786b; --map-route: #627f68; --map-orbit: #829086; --map-unresolved: #ac7047; --map-label-bg: #fffdf7; --map-label-border: #849588; --map-selected: #a26c35; --map-star-halo: #d4b663; --map-installation: #64816a;
  --ui-text-dimmed: #69786b; --ui-text-muted: #69786b; --ui-text-toned: #4d5d50; --ui-text: #35483a; --ui-text-highlighted: #28382f; --ui-text-inverted: #fffaf0;
  --ui-bg: #f6f3e9; --ui-bg-muted: #ebe8dd; --ui-bg-elevated: #fffdf7; --ui-bg-accented: #e4dfd1; --ui-bg-inverted: #28382f;
  --ui-border: rgba(47, 67, 53, .22); --ui-border-muted: rgba(47, 67, 53, .2); --ui-border-accented: rgba(47, 67, 53, .36); --ui-border-inverted: #28382f;
}
.proto-shell[data-theme="light"]::before { opacity: .45; background: radial-gradient(ellipse at 50% -10%, rgba(255, 255, 255, .85), transparent 48rem), repeating-linear-gradient(0deg, transparent 0 39px, rgba(62, 79, 63, .025) 40px); }
.proto-eyebrow { margin: 0; color: var(--proto-accent); font-size: .58rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.brand-mark { display: flex; align-items: center; gap: .7rem; min-width: max-content; }
.brand-mark > div { display: grid; gap: .12rem; }
.brand-mark strong { font: 600 .78rem/1 var(--proto-display-font); letter-spacing: .16em; }
.brand-mark small { color: var(--proto-muted); font-size: .48rem; letter-spacing: .18em; }
.brand-seal { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--proto-accent); border-radius: 50%; color: var(--proto-accent); font-size: 1rem; }
.topbar-actions { display: flex; align-items: center; gap: .4rem; }
.a-topbar, .c-topline { display: flex; min-height: 4.1rem; align-items: center; justify-content: space-between; gap: 1rem; padding: .65rem clamp(1rem, 2.2vw, 2.2rem); border-bottom: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 90%, transparent); }
.context-breadcrumb, .c-header-context { display: flex; align-items: center; gap: .7rem; color: var(--proto-muted); font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; }
.context-breadcrumb b, .c-header-context b { color: var(--proto-accent); }
.context-breadcrumb strong, .c-header-context strong { color: var(--proto-ink); font: 500 1rem var(--proto-display-font); letter-spacing: 0; text-transform: none; }
.a-workbench { display: grid; width: min(100%, 1800px); min-height: 0; flex: 1; grid-template-columns: minmax(220px, 265px) minmax(0, 1fr) minmax(270px, 340px); margin: 0 auto; }
.a-directory { display: flex; min-height: 0; flex-direction: column; gap: 1.1rem; padding: 1.3rem 1rem 1rem 1.4rem; border-right: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 76%, transparent); }
.directory-intro h1 { margin: .32rem 0 .4rem; font: 500 1.5rem/1.05 var(--proto-display-font); }
.directory-intro > p:last-child { margin: 0; color: var(--proto-muted); font-size: .68rem; line-height: 1.5; }
.directory-actions { display: grid; gap: .45rem; }
.directory-section { display: grid; gap: .35rem; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: .1rem; color: var(--proto-muted); font-size: .53rem; font-weight: 700; letter-spacing: .16em; }
.directory-row, .route-row, .c-system-entry, .c-cluster-entry { display: flex; width: 100%; align-items: center; gap: .65rem; border: 1px solid transparent; background: transparent; color: var(--proto-ink); text-align: left; cursor: pointer; transition: background .16s ease, border-color .16s ease, transform .16s ease; }
.directory-row { padding: .56rem .45rem; }
.directory-row:hover, .route-row:hover, .c-system-entry:hover, .c-cluster-entry:hover { border-color: var(--proto-line); background: var(--proto-soft); }
.directory-row.is-current, .route-row.is-current, .c-system-entry.is-current, .c-cluster-entry.is-current { border-color: color-mix(in srgb, var(--proto-accent) 42%, transparent); background: var(--proto-soft); }
.row-index, .c-entry-no { width: 1.5rem; color: var(--proto-accent); font: 500 .75rem var(--proto-display-font); }
.row-copy, .route-row > span:nth-child(2), .c-system-entry > span:nth-child(2), .c-cluster-entry > span:nth-child(2) { display: grid; min-width: 0; flex: 1; gap: .18rem; }
.row-copy strong, .route-row strong, .c-system-entry strong, .c-cluster-entry strong { overflow: hidden; font: 500 .8rem var(--proto-display-font); text-overflow: ellipsis; white-space: nowrap; }
.row-copy small, .route-row small, .c-system-entry small, .c-cluster-entry small { color: var(--proto-muted); font-size: .55rem; line-height: 1.3; }
.row-arrow, .route-level { color: var(--proto-accent); font-size: .72rem; }
.route-index { margin-top: .2rem; }
.route-row { gap: .55rem; padding: .45rem; }
.route-glyph { width: 1.35rem; color: var(--proto-green); font-size: 1rem; text-align: center; }
.directory-foot, .c-index-bottom { display: flex; align-items: center; gap: .45rem; margin-top: auto; padding-top: .9rem; border-top: 1px solid var(--proto-line); color: var(--proto-muted); font-size: .49rem; letter-spacing: .12em; }
.online-dot { width: .45rem; height: .45rem; border-radius: 50%; background: var(--proto-good); box-shadow: 0 0 .65rem color-mix(in srgb, var(--proto-good) 40%, transparent); }
.a-map-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 1.1rem 1.2rem .7rem; }
.map-context-bar { display: flex; min-height: 4.6rem; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: .7rem; }
.map-title-block h2, .c-map-heading h2 { margin: .12rem 0 .1rem; font: 500 1.5rem/1.06 var(--proto-display-font); }
.map-title-block > p:last-child { margin: 0; color: var(--proto-muted); font-size: .66rem; }
.context-actions, .hud-actions, .c-heading-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .35rem; }
.tool-shelf { display: flex; min-height: 3rem; flex-wrap: wrap; align-items: center; gap: .55rem; padding: .35rem 0 .65rem; }
.tool-selector { display: flex; align-items: center; gap: .12rem; padding: .22rem; border: 1px solid var(--proto-line); background: var(--proto-soft); }
.subtype-select { width: min(11rem, 42vw); }
.tool-help { display: flex; min-width: 0; flex: 1; align-items: center; gap: .42rem; color: var(--proto-muted); font-size: .62rem; }
.tool-help > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-indicator { width: .45rem; height: .45rem; flex: 0 0 auto; border-radius: 50%; background: var(--proto-green); }
.tool-add-object, .tool-add-orbit, .tool-add-system, .tool-add-route { background: var(--proto-accent); }
.tool-move { background: #e18667; }
.map-frame { position: relative; min-width: 0; min-height: 0; flex: 1; overflow: hidden; border: 1px solid var(--proto-line); background: var(--map-bg); box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, .16); }
.workbench-map-frame { min-height: 360px; }
.map-meta { display: flex; min-height: 2.2rem; align-items: center; justify-content: space-between; gap: .6rem; color: var(--proto-muted); font-size: .55rem; }
.map-legend { display: flex; flex-wrap: wrap; gap: .75rem; }
.map-legend span { display: inline-flex; align-items: center; gap: .3rem; }
.map-legend i { width: .48rem; height: .48rem; display: inline-block; border-radius: 50%; background: var(--proto-green); }
.map-legend .legend-route { width: .75rem; height: 2px; border-radius: 0; background: var(--proto-green); }
.map-legend .legend-exit { background: var(--proto-accent); }
.map-instruction { text-align: right; }
.a-inspector { min-height: 0; overflow: auto; padding: 1.35rem 1.1rem; border-left: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 80%, transparent); }
.reopen-inspector, .detail-tab { display: grid; width: 100%; min-height: 5rem; gap: .3rem; justify-items: start; padding: 1rem; border: 1px dashed var(--proto-line); background: var(--proto-soft); color: var(--proto-ink); text-align: left; cursor: pointer; }
.reopen-inspector > span, .detail-tab > span { color: var(--proto-accent); font-size: 1.1rem; }
.reopen-inspector small, .detail-tab small { color: var(--proto-muted); }
.proto-shell .map-navigation { bottom: .7rem; border-color: var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 96%, transparent); }
.proto-shell .map-navigation button { border-color: var(--proto-line); background: var(--control-bg); color: var(--proto-ink); font-family: var(--proto-ui-font); }
.proto-shell .map-navigation output { color: var(--proto-ink); font-family: var(--proto-ui-font); }

/* B changes the hierarchy: almost all area belongs to the map; commands and details float above it. */
.proto-b { min-height: 100dvh; overflow: hidden; }
.b-commandbar { position: absolute; z-index: 5; top: .8rem; right: 1rem; left: 1rem; display: flex; min-height: 3.5rem; align-items: center; justify-content: space-between; gap: 1rem; padding: .45rem .7rem; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 92%, transparent); box-shadow: 0 .5rem 2rem rgba(0, 0, 0, .16); backdrop-filter: blur(18px); }
.b-breadcrumb { display: flex; min-width: 0; align-items: center; gap: .55rem; color: var(--proto-muted); }
.b-breadcrumb button { padding: .35rem .45rem; border: 0; background: transparent; color: var(--proto-accent); font-size: .58rem; letter-spacing: .1em; cursor: pointer; }
.b-breadcrumb strong { overflow: hidden; color: var(--proto-ink); font: 500 1.1rem var(--proto-display-font); text-overflow: ellipsis; white-space: nowrap; }
.b-command-actions { display: flex; align-items: center; gap: .35rem; }
.command-save { display: flex; align-items: center; gap: .35rem; color: var(--proto-muted); font-size: .49rem; letter-spacing: .09em; }
.command-save i { width: .4rem; height: .4rem; border-radius: 50%; background: var(--proto-good); }
.command-save .state-error { background: var(--proto-danger); }
.command-save .state-saving { background: var(--proto-accent); }
.b-map-board { position: relative; min-height: 100dvh; flex: 1; padding: 0; }
.b-map-area { position: absolute; inset: 0; display: flex; flex-direction: column; padding: 0; }
.b-map-frame { min-height: 0; flex: 1; border: 0; box-shadow: none; }
.b-map-frame .map-navigation { bottom: 1.2rem; }
.b-zoom-controls { position: absolute; z-index: 5; right: 1rem; bottom: 1rem; display: flex; align-items: center; gap: .25rem; padding: .25rem; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 94%, transparent); box-shadow: 0 .45rem 1.4rem rgba(0, 0, 0, .2); backdrop-filter: blur(12px); }
.b-zoom-controls button { min-width: 2.2rem; min-height: 2rem; padding: .25rem .45rem; border: 1px solid var(--proto-line); background: var(--proto-raised); color: var(--proto-ink); font-size: .72rem; cursor: pointer; }
.b-zoom-controls button:hover { border-color: var(--proto-accent); color: var(--proto-accent); }
.b-map-hud { position: absolute; z-index: 3; top: 5.3rem; left: 5.2rem; display: flex; align-items: center; gap: 1rem; padding: .65rem .85rem; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 90%, transparent); box-shadow: 0 .4rem 1.6rem rgba(0, 0, 0, .13); backdrop-filter: blur(12px); }
.b-map-hud > div:first-child { display: grid; gap: .15rem; }
.b-map-hud small { color: var(--proto-accent); font-size: .49rem; letter-spacing: .13em; }
.b-map-hud strong { max-width: 14rem; overflow: hidden; font: 500 1.1rem var(--proto-display-font); text-overflow: ellipsis; white-space: nowrap; }
.b-tool-rail { position: absolute; z-index: 4; top: 50%; left: .9rem; display: flex; width: 4rem; max-height: calc(100dvh - 9rem); flex-direction: column; align-items: center; gap: .3rem; padding: .55rem .35rem; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 92%, transparent); box-shadow: 0 .5rem 1.8rem rgba(0, 0, 0, .18); transform: translateY(-43%); backdrop-filter: blur(16px); }
.rail-cap { padding: .25rem 0 .45rem; color: var(--proto-muted); font-size: .4rem; font-weight: 700; letter-spacing: .13em; }
.rail-button { display: grid; width: 3.15rem; min-height: 3.25rem; align-content: center; justify-items: center; gap: .23rem; border: 1px solid transparent; background: transparent; color: var(--proto-muted); cursor: pointer; }
.rail-button b { color: var(--proto-ink); font: 400 1.15rem var(--proto-display-font); }
.rail-button span { font-size: .43rem; }
.rail-button:hover, .rail-button.is-active { border-color: color-mix(in srgb, var(--proto-accent) 45%, transparent); background: var(--proto-soft); color: var(--proto-ink); }
.rail-button.is-active b { color: var(--proto-accent); }
.rail-spacer { min-height: .2rem; flex: 1; }
.rail-bottom { display: grid; justify-items: center; gap: .24rem; padding-top: .45rem; border-top: 1px solid var(--proto-line); color: var(--proto-muted); }
.rail-bottom small { font-size: .4rem; }
.b-inspector-float { position: absolute; z-index: 4; top: 9.4rem; right: 1rem; bottom: 4.1rem; width: min(20rem, calc(100vw - 7rem)); overflow: auto; padding: 1rem; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 95%, transparent); box-shadow: 0 .7rem 2.2rem rgba(0, 0, 0, .21); backdrop-filter: blur(18px); }
.b-inspector-float:not(.inspector-open) { width: auto; top: 50%; right: .9rem; bottom: auto; padding: .3rem; transform: translateY(-50%); }
.b-inspector-float:not(.inspector-open) .detail-tab { width: 3.7rem; min-height: 5rem; justify-items: center; padding: .5rem .25rem; text-align: center; }
.b-inspector-float:not(.inspector-open) .detail-tab small { display: none; }
.b-map-footer { position: absolute; z-index: 3; right: 1rem; bottom: .7rem; left: 5.2rem; display: flex; justify-content: space-between; gap: .8rem; color: var(--proto-muted); font-size: .48rem; letter-spacing: .11em; pointer-events: none; }

/* C uses a reading order: regional index, chart plate, then marginal notes. */
.proto-c { min-height: 100vh; }
.c-topline { min-height: 4.4rem; }
.c-header-context { letter-spacing: .08em; }
.c-atlas-grid { display: grid; width: min(100%, 1800px); min-height: 0; flex: 1; grid-template-columns: minmax(215px, 272px) minmax(0, 1fr) minmax(260px, 330px); margin: 0 auto; }
.c-index { display: flex; min-height: 0; flex-direction: column; padding: 1.55rem 1.25rem 1rem 1.55rem; border-right: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 75%, transparent); }
.c-index h1 { margin: .55rem 0 .65rem; font: 500 clamp(2rem, 3vw, 2.7rem)/.91 var(--proto-display-font); letter-spacing: -.045em; }
.c-index h1 em { color: var(--proto-accent); font-weight: 400; }
.c-index-rule { width: 2.4rem; height: 1px; margin: .6rem 0; background: var(--proto-accent); }
.c-intro { max-width: 13rem; margin: .5rem 0 1.3rem; color: var(--proto-muted); font: italic .85rem/1.55 var(--proto-display-font); }
.c-index-label { display: flex; justify-content: space-between; margin: .8rem 0 .35rem; color: var(--proto-muted); font-size: .5rem; font-weight: 700; letter-spacing: .14em; }
.c-index-label span { color: var(--proto-accent); }
.c-cluster-entry, .c-system-entry { gap: .55rem; min-height: 3.4rem; padding: .5rem .4rem; border-bottom: 1px solid var(--proto-line); }
.c-entry-no { width: 1.4rem; color: var(--proto-accent); font: italic .9rem var(--proto-display-font); }
.c-cluster-entry strong, .c-system-entry strong { font-size: .78rem; }
.c-cluster-entry small, .c-system-entry small { font-size: .48rem; letter-spacing: .04em; }
.c-cluster-entry > b, .c-system-entry > b { color: var(--proto-accent); font-size: .8rem; font-weight: 400; }
.c-map-column { display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 1.25rem 1.3rem .85rem; }
.c-map-heading { display: flex; min-height: 4rem; align-items: center; justify-content: space-between; gap: .8rem; padding-bottom: .55rem; }
.c-map-heading h2 { font-size: 1.8rem; }
.c-map-controls { display: flex; min-height: 3rem; align-items: center; gap: .55rem; padding: .3rem 0 .65rem; }
.c-tool-tabs { display: flex; align-items: center; gap: .12rem; }
.c-map-controls > .proto-select, .c-map-controls .w-full { width: 9rem; }
.c-tool-caption { overflow: hidden; margin-left: auto; color: var(--proto-muted); font: italic .68rem var(--proto-display-font); text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.c-map-frame { min-height: 330px; border-color: color-mix(in srgb, var(--proto-accent) 32%, var(--proto-line)); box-shadow: 0 .7rem 2.5rem rgba(0, 0, 0, .13); }
.c-map-caption { display: flex; min-height: 2.35rem; align-items: center; justify-content: space-between; gap: .5rem; color: var(--proto-muted); font-size: .49rem; letter-spacing: .08em; }
.c-map-caption span:first-child { color: var(--proto-accent); font: italic .76rem var(--proto-display-font); }
.c-notes-column { display: flex; min-height: 0; flex-direction: column; gap: .85rem; overflow: auto; padding: 1.3rem 1rem 1rem; border-left: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 75%, transparent); }
.c-notes-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: .55rem; border-bottom: 1px solid var(--proto-line); color: var(--proto-accent); font-size: .55rem; font-weight: 700; letter-spacing: .16em; }
.c-note-empty { display: grid; gap: .6rem; padding: .8rem; border: 1px dashed var(--proto-line); }
.c-note-empty p { margin: 0; color: var(--proto-muted); font: italic .82rem/1.5 var(--proto-display-font); }
.c-sidenote { padding: .6rem .65rem; border-left: 1px solid var(--proto-accent); background: var(--proto-soft); }
.c-sidenote span { color: var(--proto-accent); font-size: .47rem; font-weight: 700; letter-spacing: .12em; }
.c-sidenote p { margin: .35rem 0 0; color: var(--proto-muted); font-size: .64rem; line-height: 1.55; }
.c-notes-utility { display: flex; flex-wrap: wrap; gap: .3rem; }
.c-index-bottom { margin-top: auto; }

.prototype-switcher { position: fixed; z-index: 30; bottom: .85rem; left: 50%; display: flex; min-height: 3.25rem; align-items: center; gap: .5rem; padding: .3rem .45rem; border: 1px solid rgba(232, 184, 121, .54); border-radius: 999px; background: #13211e; color: #edf0e7; box-shadow: 0 .7rem 2.5rem rgba(0, 0, 0, .35); transform: translateX(-50%); }
.prototype-switcher > button:not(.switcher-share) { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .07); color: #f2c98d; font-size: 1.1rem; cursor: pointer; }
.prototype-switcher > button:hover { background: rgba(232, 184, 121, .17); }
.switcher-current { display: flex; min-width: 13.2rem; align-items: center; gap: .55rem; }
.switcher-current > span { display: grid; width: 1.8rem; height: 1.8rem; place-items: center; border: 1px solid #e8b879; border-radius: 50%; color: #f2c98d; font: 600 .75rem var(--proto-display-font); }
.switcher-current > div { display: grid; gap: .13rem; }
.switcher-current strong { font: 500 .75rem var(--proto-display-font); }
.switcher-current small { color: #a2b0a5; font-size: .4rem; letter-spacing: .12em; }
.switcher-share { color: #e1e8dd !important; }
.proto-modal-body { display: grid; gap: .8rem; padding: 1.35rem; color: var(--proto-ink); }
.proto-modal-body h2 { margin: 0; font: 500 1.6rem/1.1 var(--proto-display-font); }
.proto-modal-body > p:not(.proto-eyebrow) { margin: 0; color: var(--proto-muted); font-size: .78rem; line-height: 1.55; }
.proto-modal-actions { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: .35rem; }
.field-manager { max-height: min(85vh, 52rem); overflow: auto; }
.field-definition-list { display: grid; gap: .4rem; }
.field-definition-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .55rem .65rem; border: 1px solid var(--proto-line); background: var(--proto-soft); }
.field-definition-row > div { display: grid; gap: .18rem; }
.field-definition-row strong { font: 500 .82rem var(--proto-display-font); }
.field-definition-row small, .empty-fields { color: var(--proto-muted); font-size: .63rem; }
.empty-fields { margin: 0; }
.field-create-form { display: grid; gap: .65rem; padding: .8rem; border: 1px solid var(--proto-line); background: var(--proto-soft); }
.import-counts { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
.import-counts span { display: grid; justify-items: center; gap: .15rem; padding: .7rem .3rem; border: 1px solid var(--proto-line); background: var(--proto-soft); }
.import-counts strong { color: var(--proto-accent); font: 500 1.4rem var(--proto-display-font); }
.import-counts small { color: var(--proto-muted); font-size: .55rem; text-transform: uppercase; }
.import-error { padding: .6rem; border: 1px solid var(--proto-danger); color: var(--proto-danger); }
.prototype-toast { position: fixed; z-index: 35; right: 1rem; bottom: 5rem; max-width: min(26rem, calc(100vw - 2rem)); padding: .7rem .9rem; border: 1px solid var(--proto-accent); background: #15231f; color: #f2efe3; box-shadow: 0 .55rem 1.8rem rgba(0, 0, 0, .28); font-size: .7rem; line-height: 1.5; animation: toast-in .2s ease both; }
.prototype-state-peek { color: var(--proto-muted); font-size: .5rem; }
.prototype-state-peek summary { cursor: pointer; }
.prototype-state-peek pre { position: absolute; z-index: 8; right: 1rem; bottom: 3rem; max-width: min(29rem, 75vw); max-height: 45vh; overflow: auto; padding: .75rem; border: 1px solid var(--proto-line); background: var(--proto-surface); color: var(--proto-ink); font: .58rem/1.5 ui-monospace, Consolas, monospace; white-space: pre-wrap; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; clip-path: inset(50%); }
@keyframes toast-in { from { opacity: 0; transform: translateY(.35rem); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1120px) {
  .a-workbench, .c-atlas-grid { grid-template-columns: minmax(205px, 240px) minmax(0, 1fr); }
  .a-inspector, .c-notes-column { position: fixed; z-index: 8; top: 4.1rem; right: 0; bottom: 4.5rem; width: min(22rem, 85vw); border: 1px solid var(--proto-line); background: var(--proto-surface); box-shadow: 0 1rem 3rem rgba(0, 0, 0, .24); transform: translateX(102%); transition: transform .2s ease; }
  .a-inspector.inspector-open, .c-notes-column:has(.inspector-card) { transform: translateX(0); }
  .a-map-column, .c-map-column { grid-column: 2; }
  .c-notes-column { display: none; }
  .c-notes-column:has(.inspector-card) { display: flex; }
}
@media (max-width: 760px) {
  .proto-shell { min-height: 100dvh; overflow: auto; }
  .a-topbar, .c-topline { min-height: 3.6rem; padding: .45rem .65rem; }
  .context-breadcrumb, .c-header-context { display: none; }
  .brand-mark strong { font-size: .68rem; }
  .brand-mark small { font-size: .4rem; }
  .brand-seal { width: 1.7rem; height: 1.7rem; }
  .topbar-actions button { min-height: 2rem; padding: .35rem .5rem; font-size: .62rem; }
  .a-workbench, .c-atlas-grid { display: flex; min-height: 0; flex-direction: column; }
  .a-directory { order: 0; display: block; max-height: 9rem; overflow: auto; padding: .55rem .65rem; border-right: 0; border-bottom: 1px solid var(--proto-line); }
  .directory-intro { display: none; }
  .directory-actions { display: flex; margin-bottom: .45rem; }
  .directory-actions button { min-height: 2.05rem; justify-content: center; padding: .25rem .45rem; font-size: .58rem; }
  .directory-section { display: none; }
  .directory-foot { display: none; }
  .a-map-column { order: 1; min-height: 0; flex: 1; padding: .55rem .55rem 4rem; }
  .map-context-bar { min-height: 3rem; padding-bottom: .35rem; }
  .map-title-block h2 { font-size: 1.25rem; }
  .map-title-block > p:last-child { display: none; }
  .map-context-bar .proto-eyebrow { font-size: .48rem; }
  .context-actions button { min-height: 2rem; padding: .3rem .42rem; font-size: .55rem; }
  .context-actions button:nth-child(2), .context-actions button:nth-child(3) { display: none; }
  .tool-shelf { min-height: 2.6rem; gap: .3rem; padding: .2rem 0 .4rem; }
  .tool-selector { gap: 0; padding: .1rem; }
  .tool-selector button { min-height: 1.85rem; padding: .25rem .4rem; font-size: .53rem; }
  .tool-help { display: none; }
  .subtype-select { width: 7.8rem; }
  .workbench-map-frame, .c-map-frame { min-height: 48vh; }
  .map-meta { position: absolute; right: .55rem; bottom: 3.15rem; left: .55rem; z-index: 2; min-height: 1.7rem; padding: .3rem .45rem; background: color-mix(in srgb, var(--proto-surface) 88%, transparent); font-size: .46rem; }
  .map-legend { gap: .35rem; }
  .map-instruction { display: none; }
  .prototype-switcher { bottom: .45rem; min-height: 2.8rem; gap: .3rem; padding: .22rem .3rem; }
  .prototype-switcher > button:not(.switcher-share) { width: 1.95rem; height: 1.95rem; }
  .switcher-current { min-width: 10.3rem; gap: .4rem; }
  .switcher-current > span { width: 1.55rem; height: 1.55rem; }
  .switcher-current strong { font-size: .66rem; }
  .switcher-current small { font-size: .34rem; }
  .switcher-share { display: none !important; }
  .a-inspector { top: auto; bottom: 3.7rem; width: min(100vw, 29rem); max-height: 45dvh; padding: .8rem; border-right: 0; border-bottom: 0; transform: translateY(110%); }
  .a-inspector.inspector-open { transform: translateY(0); }
  .a-inspector:not(.inspector-open) { position: fixed; z-index: 26; right: .6rem; bottom: 4.1rem; left: auto; width: auto; max-height: none; padding: 0; border: 0; background: transparent; box-shadow: none; transform: none; }
  .reopen-inspector { min-height: 2.2rem; padding: .45rem; }
  .reopen-inspector > span { display: none; }
  .reopen-inspector small { display: none; }
  .a-inspector:not(.inspector-open) .reopen-inspector { min-height: 2.35rem; padding: .4rem .6rem; border: 1px solid var(--proto-line); background: var(--proto-surface); box-shadow: 0 .35rem 1rem rgba(0, 0, 0, .25); font-size: .62rem; }
  .c-index { order: 0; display: flex; min-height: 0; height: auto; flex-direction: row; align-items: center; gap: .35rem; overflow-x: auto; padding: .4rem .5rem; border-right: 0; border-bottom: 1px solid var(--proto-line); }
  .c-index > .proto-eyebrow, .c-index h1, .c-index-rule, .c-intro, .c-index-label, .c-index-bottom { display: none; }
  .c-cluster-entry, .c-system-entry { width: auto; min-width: max-content; min-height: 2.6rem; gap: .35rem; padding: .25rem .5rem; border: 1px solid var(--proto-line); }
  .c-cluster-entry > b, .c-system-entry > b { display: none; }
  .c-entry-no { width: auto; }
  .c-system-entry small { display: none; }
  .c-map-column { order: 1; min-height: 0; flex: 1; padding: .55rem .55rem 4rem; }
  .c-map-heading { min-height: 2.7rem; }
  .c-map-heading h2 { font-size: 1.35rem; }
  .c-heading-actions button { min-height: 2rem; padding: .25rem .4rem; font-size: .55rem; }
  .c-heading-actions button:nth-child(2) { display: none; }
  .c-map-controls { min-height: 2.6rem; gap: .3rem; padding: .1rem 0 .4rem; }
  .c-tool-tabs button { min-height: 1.9rem; padding: .25rem .4rem; font-size: .54rem; }
  .c-map-controls > .proto-select, .c-map-controls .w-full { width: 6.6rem; }
  .c-tool-caption { display: none; }
  .c-map-caption { position: absolute; right: .5rem; bottom: 3.05rem; left: .5rem; z-index: 2; min-height: 1.7rem; justify-content: space-between; padding: .3rem .4rem; background: color-mix(in srgb, var(--proto-surface) 88%, transparent); font-size: .43rem; }
  .c-notes-column { display: none !important; }
  .c-notes-column.inspector-open { position: fixed; z-index: 8; top: auto; right: .5rem; bottom: 3.7rem; left: .5rem; display: flex !important; max-height: 45dvh; overflow: auto; padding: .8rem; border: 1px solid var(--proto-line); background: var(--proto-surface); box-shadow: 0 -1rem 3rem rgba(0, 0, 0, .3); }
  .b-commandbar { top: .4rem; right: .4rem; left: .4rem; min-height: 3rem; gap: .4rem; padding: .28rem .4rem; }
  .b-commandbar .brand-mark small { display: none; }
  .b-breadcrumb { gap: .25rem; }
  .b-breadcrumb strong { max-width: 7rem; font-size: .82rem; }
  .b-command-actions { gap: .1rem; }
  .b-command-actions button { min-height: 1.9rem; padding: .25rem .4rem; font-size: .53rem; }
  .command-save { display: none; }
  .b-tool-rail { top: auto; right: .5rem; bottom: 3.5rem; left: .5rem; width: auto; max-width: calc(100% - 1rem); max-height: none; flex-direction: row; justify-content: flex-start; gap: .15rem; overflow-x: auto; overflow-y: hidden; padding: .22rem; transform: none; }
  .rail-cap, .rail-spacer, .rail-bottom { display: none; }
  .rail-button { width: auto; min-width: 3.15rem; min-height: 2.75rem; flex: 0 0 auto; gap: .08rem; }
  .rail-button b { font-size: .9rem; }
  .rail-button span { font-size: .68rem; }
  .b-map-hud { top: 3.75rem; left: .45rem; gap: .4rem; padding: .4rem .55rem; }
  .b-map-hud strong { max-width: 8rem; font-size: .9rem; }
  .b-map-hud small { font-size: .42rem; }
  .b-map-hud .hud-actions { display: none; }
  .b-map-frame .map-navigation { bottom: 7rem; }
  .b-map-footer { right: .55rem; bottom: 6.6rem; left: .55rem; font-size: .4rem; }
  .b-map-footer span:last-child { display: none; }
  .b-inspector-float.inspector-open { position: fixed; z-index: 12; inset: 0; width: auto; height: auto; max-height: none; overflow-y: auto; overscroll-behavior: contain; padding: calc(.7rem + env(safe-area-inset-top)) .8rem calc(8.5rem + env(safe-area-inset-bottom)); border: 0; border-radius: 0; background: var(--proto-surface); box-shadow: none; }
  .b-inspector-float.inspector-open .inspector-heading { position: sticky; top: env(safe-area-inset-top); z-index: 2; background: var(--proto-surface); }
  .b-inspector-float:not(.inspector-open) { top: 4.1rem; right: .4rem; bottom: auto; left: auto; width: auto; max-height: none; overflow: visible; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; transform: none; }
  .proto-b.has-open-side-panel .b-inspector-float:not(.inspector-open) { visibility: hidden; pointer-events: none; }
  .b-inspector-float:not(.inspector-open) .detail-tab { display: flex; width: auto; min-height: 2.4rem; align-items: center; gap: .35rem; padding: .35rem .5rem; }
  .b-inspector-float:not(.inspector-open) .detail-tab b { font-size: .6rem; }
  .b-inspector-float:not(.inspector-open) .detail-tab > span { font-size: .8rem; }
  .b-inspector-float:not(.inspector-open) .detail-tab small { display: none; }
  .b-tool-rail { position: fixed; z-index: 13; top: auto; right: .5rem; bottom: calc(4.3rem + env(safe-area-inset-bottom)); left: .5rem; }
  .proto-b.has-open-inspector .b-zoom-controls { top: 6.2rem; right: .5rem; bottom: auto; }
  .proto-b.has-open-inspector .b-map-footer { display: none; }
  .b-zoom-controls { right: .5rem; bottom: 6.6rem; gap: .12rem; padding: .18rem; }
  .b-zoom-controls button { min-width: 1.9rem; min-height: 1.85rem; padding: .2rem .35rem; }
  .proto-modal-body { padding: 1rem; }
}

@media (max-height: 600px) and (min-width: 761px) {
  .proto-shell { min-height: 100dvh; }
  .a-topbar, .c-topline { min-height: 3.2rem; }
  .a-map-column, .c-map-column { padding-top: .55rem; }
  .map-context-bar, .c-map-heading { min-height: 3.5rem; }
  .workbench-map-frame, .c-map-frame { min-height: 16rem; }
  .b-commandbar { top: .35rem; }
  .b-map-hud { top: 4.2rem; }
  .b-inspector-float { top: 7.6rem; bottom: 2.8rem; }
  .b-map-footer { bottom: 4.2rem; }
  .b-tool-rail { top: auto; left: 50%; bottom: 4.6rem; width: max-content; max-width: calc(100vw - 2rem); max-height: none; flex-direction: row; overflow-x: auto; transform: translateX(-50%); }
  .b-tool-rail .rail-spacer, .b-tool-rail .rail-bottom { display: none; }
  .rail-button { width: auto; min-width: 3.2rem; min-height: 2.7rem; }
  .b-inspector-float:not(.inspector-open) { top: 4.3rem; right: 1rem; }
  .b-zoom-controls { top: 6.2rem; right: 1rem; bottom: auto; }
}

@media (max-width: 1024px) and (max-height: 600px) and (min-width: 761px) {
  .proto-b .b-inspector-float.inspector-open { position: fixed; z-index: 12; inset: 0; width: auto; height: auto; max-height: none; overflow-y: auto; overscroll-behavior: contain; padding: calc(.7rem + env(safe-area-inset-top)) .8rem calc(8.5rem + env(safe-area-inset-bottom)); border: 0; border-radius: 0; background: var(--proto-surface); box-shadow: none; }
  .proto-b .b-inspector-float.inspector-open .inspector-heading { position: sticky; top: env(safe-area-inset-top); z-index: 2; background: var(--proto-surface); }
  .proto-b .b-tool-rail { position: fixed; z-index: 13; top: auto; right: .5rem; bottom: calc(4.3rem + env(safe-area-inset-bottom)); left: .5rem; width: auto; max-width: calc(100% - 1rem); transform: none; }
}
</style>
