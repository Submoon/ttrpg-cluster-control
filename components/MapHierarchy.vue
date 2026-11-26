<template>
  <template v-if="store.activeView === 'cluster'">
    <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
      <div>
        <span class="section-kicker">LOCAL ARCHIVE</span>
        <h2 class="mt-[0.28rem] mb-0 text-2xl">Cluster</h2>
      </div>
      <span class="tree-count whitespace-nowrap">{{ props.workspace.cluster.systems.length }} {{ props.workspace.cluster.systems.length === 1 ? 'Zone' : 'Zones' }}</span>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UButton color="primary" variant="outline" @click="commands.navigation.showChartDetails()">
        Open Jump Cluster details
      </UButton>
      <span v-if="props.hasChartNameDraft" class="save-feedback text-sm" role="status">Jump Cluster details editing session</span>
    </div>

    <nav v-if="!props.continuousMap" class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Zones">
      <span class="subsection-label">ZONES</span>
      <p v-if="!props.workspace.cluster.systems.length" class="empty-copy my-[0.65rem]">No Zones yet.</p>
      <div
        v-for="system in props.workspace.cluster.systems"
        :key="system.id"
        class="flex min-w-0 items-center gap-[0.25rem]"
        @contextmenu="openSystemContextMenu($event, system)"
      >
        <button
          class="system-link flex min-h-[2.7rem] min-w-0 flex-1 cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
          type="button"
          :aria-label="props.continuousMap ? `Inspect ${system.name}` : `Open ${system.name} Zone map`"
          :aria-current="system.id === activeSystemId ? 'page' : undefined"
          :aria-description="publicationStatus(system.publication, undefined, 'system').description"
          :data-system-id="system.id"
          @keydown.capture="openSystemContextMenuFromKeyboard($event, system)"
          @click="commands.navigation.selectSystem(system.id)"
        >
          <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">ZN</span>
          <span class="min-w-0 [overflow-wrap:anywhere]">
            <span class="flex min-w-0 items-center gap-1">
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ system.name }}</span>
              <UTooltip :text="publicationStatus(system.publication, undefined, 'system').description">
                <UIcon :name="publicationPresentation(system.publication).icon" aria-hidden="true" class="shrink-0 text-[var(--text-muted)]" />
              </UTooltip>
            </span>
            <small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small>
          </span>
        </button>
        <UButton
          class="quiet-button min-h-[2.5rem] w-[2.5rem] shrink-0 justify-center px-0"
          color="neutral"
          variant="ghost"
          type="button"
          :aria-label="`Change visibility for ${system.name}`"
          :title="`Change visibility for ${system.name}`"
          @click.stop="openSystemMenuFromButton($event, system)"
        >
          <UIcon name="i-lucide-eye" aria-hidden="true" />
        </UButton>
      </div>
    </nav>

    <nav v-if="!props.continuousMap" class="object-tree grid gap-[0.1rem] border-t border-[var(--line-soft)] pt-[0.65rem]" aria-label="Jump Routes">
      <span class="subsection-label">JUMP ROUTES</span>
      <p v-if="props.workspace.cluster.routes.length === 0" class="empty-copy my-[0.65rem]">No Jump Routes on this chart.</p>
      <button
        v-for="route in props.workspace.cluster.routes"
        :key="route.id"
        class="tree-row object-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
        :class="{ active: route.id === store.selectedRouteId }"
        type="button"
        :aria-label="`Select Jump Level ${route.jumpLevel}: ${commands.navigation.routeSummary(route)}`"
        :aria-current="route.id === store.selectedRouteId ? 'true' : undefined"
        :data-route-id="route.id"
        @contextmenu="openRouteContextMenu($event, route.id)"
        @keydown.capture="openRouteContextMenuFromKeyboard($event, route.id)"
        @click="commands.navigation.selectRoute(route.id)"
      >
        <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">R</span>
        <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
          Jump Level {{ route.jumpLevel }}
          <small class="mt-[0.18rem] block">{{ commands.navigation.routeSummary(route) }}</small>
        </span>
      </button>
    </nav>

    <section
      v-if="props.continuousMap"
      ref="continuousHierarchyRoot"
      class="mt-5 border-t border-[var(--line-soft)] pt-[0.65rem]"
      @focusin="trackHierarchyFocus"
      @focusout="releaseHierarchyFocus"
    >
      <div class="tree-heading flex justify-between gap-[0.4rem] pb-[0.45rem]">
        <span class="subsection-label">OBJECTS / ORBITS</span>
        <span class="tree-count whitespace-nowrap">{{ continuousHierarchyRecordCount }} records</span>
      </div>
      <p v-if="props.workspace.cluster.systems.length === 0" class="empty-copy my-[0.65rem]">No Zones charted yet.</p>
      <!-- @vue-generic {HierarchyTreeItem[], true} -->
      <UTree
        v-else
        :items="renderedHierarchyItems"
        :model-value="selectedHierarchyItems"
        multiple
        :expanded="expandedHierarchyKeys"
        :get-key="getHierarchyItemKey"
        label-key="label"
        class="object-tree"
        :aria-label="`${props.workspace.cluster.name} object and Orbit hierarchy`"
        :ui="{
          itemWithChildren: 'ps-0 -ms-px',
          listWithChildren: 'ms-[var(--hierarchy-indent-step)] border-s border-[var(--line-soft)]',
        }"
        :style="{ '--hierarchy-indent-step': hierarchyIndentStep }"
        @update:expanded="updateExpandedHierarchyKeys"
        @select="selectHierarchyItem"
        @toggle="toggleHierarchyItem"
        @keydown.capture="stopComposingTreeKeys"
        @compositionstart="beginHierarchyComposition"
        @compositionend="endHierarchyComposition"
      >
        <template #item-wrapper="{ item, expanded, selected, handleToggle, ui }">
          <div
            :key="item.key"
            :class="ui.link({
              class: [
                'tree-row grid min-h-[2.55rem] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1 gap-y-0 rounded-[2px] border border-transparent bg-transparent px-0.5 py-1 text-left',
                item.kind === 'system' ? 'system-row' : item.kind === 'orbit' ? 'orbit-row' : 'object-row',
                { active: selected },
              ],
              selected,
            })"
            :data-hierarchy-key="item.key"
            :data-object-id="item.kind === 'object' ? item.row.object.id : undefined"
            :data-orbit-id="item.kind === 'orbit' ? item.row.orbit.id : undefined"
            :data-system-id="item.kind === 'system' ? item.system.id : item.kind === 'route' ? undefined : item.ownerSystemId"
            :data-route-id="item.kind === 'route' ? item.route.id : item.kind === 'system' ? undefined : item.ownerRouteId"
            :aria-label="item.kind === 'object' || item.kind === 'route' ? item.ariaLabel : item.label"
            :aria-description="item.ariaDescription"
            @contextmenu="openHierarchyMenu($event, item)"
            @keydown.capture="openHierarchyMenuFromKeyboard($event, item)"
          >
            <span class="tree-copy col-start-1 row-start-1 block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
              <span class="tree-object-title flex min-w-0 items-start gap-1">
                <span class="tree-leading shrink-0" aria-hidden="true">
                  <span v-if="item.kind === 'system'" class="system-seal grid size-[1.5rem] place-items-center rounded-full border border-[var(--line-strong)]">ZN</span>
                  <span v-else-if="item.kind === 'object'" class="object-mark">{{ objectMark(item.row.object) }}</span>
                  <span v-else class="orbit-mark">R</span>
                </span>
                <span class="tree-object-name flex min-w-0 flex-1 items-start gap-1">
                  <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.label }}</span>
                  <UTooltip v-if="item.kind === 'system'" :text="publicationStatus(item.system.publication, undefined, 'system').description">
                    <UIcon :name="publicationPresentation(item.system.publication).icon" aria-hidden="true" class="shrink-0 text-[var(--text-muted)]" />
                  </UTooltip>
                  <UTooltip v-if="item.kind === 'object'" :text="hierarchyObjectPublicationStatus(item).description">
                    <span class="inline-flex shrink-0 gap-1" aria-hidden="true">
                      <UIcon :name="publicationPresentation(item.row.object.publication).icon" aria-hidden="true" class="shrink-0 text-[var(--text-muted)]" />
                      <UIcon v-if="hierarchyObjectPublicationStatus(item).parentBlocked" name="i-lucide-lock-keyhole" class="shrink-0 text-[var(--text-muted)]" />
                    </span>
                  </UTooltip>
                </span>
              </span>
              <small v-if="item.kind === 'system'" class="mt-[0.18rem] block">
                {{ item.system.objects.length }} map objects
              </small>
              <small v-if="item.kind === 'route'" class="mt-[0.18rem] block">
                {{ commands.navigation.routeSummary(item.route) }}
              </small>
              <small v-if="item.kind === 'object'" class="tree-type-label mt-[0.18rem] block [overflow-wrap:anywhere]">
                {{ catalogueFamilyLabel(item.row.object.family) }} / {{ catalogueSubtypeLabel(item.row.object) }}
              </small>
              <small v-if="item.kind === 'object'" class="mt-[0.18rem] block">
                <span class="key-tag block min-w-0 [overflow-wrap:anywhere]">{{ item.row.object.locationKey }}</span>
                <span class="block">{{ item.parentContext }}</span>
              </small>
              <small v-if="item.kind === 'object' || item.kind === 'orbit'" class="mt-[0.12rem] block">{{ item.ownerName }}</small>
            </span>
            <div class="col-start-2 row-start-1 flex min-w-0 flex-col items-center gap-0.5 self-center">
              <UButton
                v-if="item.kind === 'system'"
                class="tree-publication-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Change visibility for ${item.system.name}`"
                :title="`Change visibility for ${item.system.name}`"
                @click.stop="openSystemMenuFromButton($event, item.system)"
              >
                <UIcon name="i-lucide-eye" aria-hidden="true" />
              </UButton>
              <UButton
                v-if="item.kind === 'object' && !item.ownerRouteId"
                class="tree-publication-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
                color="neutral"
                variant="ghost"
                size="xs"
                :tabindex="-1"
                :aria-label="`Change visibility for ${item.row.object.name}`"
                :title="`Change visibility for ${item.row.object.name}`"
                @click.stop="openObjectMenuFromButton($event, item.row.object.id, item.ownerSystemId)"
              >
                <UIcon name="i-lucide-eye" aria-hidden="true" />
              </UButton>
              <UButton
                v-if="hierarchyItemsByKey.get(item.key)?.children?.length"
                class="tree-expand-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
                color="neutral"
                variant="ghost"
                size="xs"
                :tabindex="-1"
                :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${item.label}`"
                :aria-expanded="expanded"
                :title="`${expanded ? 'Collapse' : 'Expand'} ${item.label}`"
                @click.stop="toggleHierarchyItemAndRestoreFocus($event, handleToggle)"
              >
                <UIcon :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" aria-hidden="true" />
              </UButton>
            </div>
            <UButton
              v-if="(item.kind === 'system' || item.kind === 'route') && expanded && !seededHierarchyOwners.has(item.key)"
              class="col-span-2 row-start-2 min-w-0 max-w-full justify-center whitespace-normal"
              color="neutral"
              variant="outline"
              size="xs"
              :aria-label="`Show all ${item.label} records`"
              @keydown.stop
              @click.stop="showAllHierarchyOwner($event, item.key)"
            >Show all records</UButton>
          </div>
        </template>
      </UTree>
    </section>
  </template>

  <template v-else-if="selectedSystem">
    <div class="panel-heading grid gap-2">
      <div>
        <span class="section-kicker">LOCAL ARCHIVE</span>
        <h2 class="mt-[0.28rem] mb-0 text-2xl">Hierarchy</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
          <button class="quiet-button cluster-map-nav-button" type="button" aria-label="Cluster map" @click="commands.navigation.showClusterMap()">
          Cluster map
        </button>
      </div>
    </div>

    <div class="my-4 flex flex-wrap items-center gap-2 border-y border-[var(--line-soft)] py-3">
      <UButton color="primary" variant="outline" @click="commands.navigation.showChartDetails()">
        Open Jump Cluster details
      </UButton>
      <span v-if="props.hasChartNameDraft" class="save-feedback text-sm" role="status">Jump Cluster details editing session</span>
    </div>

    <nav v-if="!props.continuousMap" class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Zones">
      <span class="subsection-label">ZONES</span>
      <button
        v-for="system in props.workspace.cluster.systems"
        :key="system.id"
        class="system-link flex min-h-[2.7rem] w-full cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
        :class="{ active: system.id === activeSystemId }"
        type="button"
        :aria-current="system.id === activeSystemId ? 'page' : undefined"
        :data-system-id="system.id"
        @contextmenu="openSystemContextMenu($event, system)"
        @keydown.capture="openSystemContextMenuFromKeyboard($event, system)"
        @click="commands.navigation.selectSystem(system.id)"
      >
        <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">ZN</span>
        <span>{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
      </button>
    </nav>

    <div class="tree-heading flex justify-between gap-[0.4rem] border-t border-[var(--line-soft)] pt-[0.65rem] pb-[0.45rem]">
      <span class="subsection-label">OBJECTS / ORBITS</span>
      <span class="tree-count whitespace-nowrap">{{ hierarchyRows.length }} records</span>
    </div>
    <p v-if="hierarchyRows.length === 0" class="empty-copy my-[0.65rem]">No objects charted yet.</p>
    <!-- @vue-generic {HierarchyTreeItem[], true} -->
    <UTree
      v-else
      :items="hierarchyItems"
      :model-value="selectedHierarchyItems"
      multiple
      :expanded="expandedHierarchyKeys"
      :get-key="getHierarchyItemKey"
      label-key="label"
      class="object-tree"
      aria-label="Map object and Orbit hierarchy"
      :ui="{
        itemWithChildren: 'ps-0 -ms-px',
        listWithChildren: 'ms-[var(--hierarchy-indent-step)] border-s border-[var(--line-soft)]',
      }"
      :style="{ '--hierarchy-indent-step': hierarchyIndentStep }"
      @update:expanded="updateExpandedHierarchyKeys"
      @select="selectHierarchyItem"
      @toggle="toggleHierarchyItem"
      @keydown.capture="stopComposingTreeKeys"
      @compositionstart="beginHierarchyComposition"
      @compositionend="endHierarchyComposition"
    >
      <template #item-wrapper="{ item, expanded, selected, handleToggle, level, ui }">
        <div
          :class="ui.link({
            class: [
              'tree-row grid min-h-[2.55rem] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1 gap-y-0 rounded-[2px] border border-transparent bg-transparent px-0.5 py-1 text-left',
              item.kind === 'system' ? 'system-row' : item.kind === 'object' ? 'object-row' : 'orbit-row',
              { active: selected },
            ],
            selected,
          })"
          :aria-label="item.ariaLabel"
          :aria-description="item.ariaDescription"
          :data-hierarchy-key="item.key"
          :data-hierarchy-level="level"
          :data-system-id="item.kind === 'system' ? item.system.id : item.kind === 'route' ? undefined : item.ownerSystemId"
          :data-object-id="item.kind === 'object' ? item.row.object.id : undefined"
          :data-orbit-id="item.kind === 'orbit' ? item.row.orbit.id : undefined"
          :data-host-object-id="item.kind === 'orbit' ? item.row.host?.id : undefined"
          @contextmenu="openHierarchyMenu($event, item)"
          @keydown.capture="openHierarchyMenuFromKeyboard($event, item)"
        >
          <template v-if="item.kind === 'object'">
            <span class="tree-copy col-start-1 row-start-1 block min-w-0 [overflow-wrap:anywhere]">
              <span class="tree-object-title flex min-w-0 items-start gap-1">
                <span class="object-mark shrink-0" aria-hidden="true">{{ objectMark(item.row.object) }}</span>
                <span class="tree-object-name flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]">
                  <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.row.object.name }}</span>
                  <UTooltip :text="publicationStatus(item.row.object.publication, selectedSystem?.publication).description">
                    <span class="inline-flex shrink-0 gap-1" aria-hidden="true">
                      <UIcon :name="publicationPresentation(item.row.object.publication).icon" class="shrink-0 text-[var(--text-muted)]" />
                      <UIcon v-if="publicationStatus(item.row.object.publication, selectedSystem?.publication).parentBlocked" name="i-lucide-lock-keyhole" class="shrink-0 text-[var(--text-muted)]" />
                    </span>
                  </UTooltip>
                </span>
              </span>
              <small class="tree-type-label mt-[0.18rem] block [overflow-wrap:anywhere]">
                {{ catalogueFamilyLabel(item.row.object.family) }} / {{ catalogueSubtypeLabel(item.row.object) }}
              </small>
              <small class="tree-parent-context mt-[0.12rem] block [overflow-wrap:anywhere]">
                {{ item.parentContext }}
              </small>
              <small v-if="item.isDimmed" class="tree-parent-context mt-[0.12rem] block [overflow-wrap:anywhere]">
                Dimmed on map
              </small>
            </span>
            <span class="key-tag col-start-1 row-start-2 block min-w-0 [overflow-wrap:anywhere]">{{ item.row.object.locationKey }}</span>
          </template>
          <template v-else-if="item.kind === 'orbit'">
            <span class="tree-copy col-start-1 row-span-2 block min-w-0 [overflow-wrap:anywhere]">
              <span class="tree-orbit-title flex min-w-0 items-start gap-1">
                <span class="orbit-mark shrink-0 text-[var(--map-muted)]" aria-hidden="true">○</span>
                <span class="min-w-0 [overflow-wrap:anywhere]">Orbit {{ item.row.orbit.order }}</span>
              </span>
              <small class="mt-[0.18rem] block [overflow-wrap:anywhere]">
                {{ item.row.host?.name ?? 'Unoccupied center' }} / {{ item.row.childCount }} object{{ item.row.childCount === 1 ? '' : 's' }}
              </small>
            </span>
          </template>
          <template v-else-if="item.kind === 'system'">
            <span class="tree-copy col-start-1 row-span-2 block min-w-0 [overflow-wrap:anywhere]">
              <span class="tree-object-title flex min-w-0 items-start gap-1">
                <span class="tree-object-name min-w-0 [overflow-wrap:anywhere]">{{ item.system.name }}</span>
                <UTooltip :text="publicationStatus(item.system.publication, undefined, 'system').description">
                  <UIcon :name="publicationPresentation(item.system.publication).icon" aria-hidden="true" class="shrink-0 text-[var(--text-muted)]" />
                </UTooltip>
              </span>
              <small class="mt-[0.18rem] block">{{ item.system.objects.length }} map objects</small>
            </span>
          </template>
          <div class="col-start-2 row-span-2 flex min-w-0 flex-col items-center gap-0.5 self-center">
            <UButton
              v-if="item.kind === 'system'"
              class="tree-publication-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Change visibility for ${item.system.name}`"
              :title="`Change visibility for ${item.system.name}`"
              @click.stop="openSystemMenuFromButton($event, item.system)"
            >
              <UIcon name="i-lucide-eye" aria-hidden="true" />
            </UButton>
            <UButton
              v-if="item.kind === 'object'"
              class="tree-publication-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
              color="neutral"
              variant="ghost"
              size="xs"
              :tabindex="-1"
              :aria-label="`Change visibility for ${item.row.object.name}`"
              :title="`Change visibility for ${item.row.object.name}`"
              @click.stop="openObjectMenuFromButton($event, item.row.object.id)"
            >
              <UIcon name="i-lucide-eye" aria-hidden="true" />
            </UButton>
            <UButton
              v-if="item.children?.length"
              class="tree-expand-control min-h-[2rem] min-w-[2rem] shrink-0 justify-center px-0"
              color="neutral"
              variant="ghost"
              size="xs"
              :tabindex="-1"
              :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${item.label}`"
              :aria-expanded="expanded"
              :title="`${expanded ? 'Collapse' : 'Expand'} ${item.label}`"
              @click.stop="toggleHierarchyItemAndRestoreFocus($event, handleToggle)"
            >
              <UIcon :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" aria-hidden="true" />
            </UButton>
          </div>
        </div>
      </template>
    </UTree>
  </template>
</template>

<script setup lang="ts">
/**
 * Owns cluster navigation and projects nested objects/Orbits into a selectable hierarchy.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  routeContentsFor,
  type CatalogueObject,
  type JumpRoute,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'
import { objectMark } from '../utils/catalogue-marks'
import { catalogueFamilyLabel, catalogueSubtypeLabel } from '../utils/catalogue-labels'
import {
  buildMapHierarchy,
  type MapHierarchyRow,
  type ObjectHierarchyRow,
  type OrbitHierarchyRow,
} from '../utils/map-hierarchy'
import { useEditorUiStore } from '../stores/editor-ui'
import { useEditorCommands } from '../composables/editor-workflows/editor-command-context'
import type { EntityContextTarget } from '../composables/editor-workflows/publication-types'
import { publicationPresentation, publicationStatus } from '../utils/publication-presentation'
import type { TreeItemSelectEvent, TreeItemToggleEvent } from 'reka-ui'

interface HierarchyTreeItemBase {
  key: string
  label: string
  textValue: string
  ariaLabel: string
  ariaDescription?: string
  isDimmed?: boolean
  parentContext?: string
  ancestorKeys: string[]
  children?: HierarchyTreeItem[]
  [key: string]: unknown
}

type HierarchyBranchOwner = { ownerSystemId?: string; ownerRouteId?: string; ownerName: string }

type HierarchyTreeItem = HierarchyTreeItemBase & (
  | { kind: 'system'; system: StarSystem }
  | { kind: 'route'; route: JumpRoute }
  | ({ kind: 'object'; row: ObjectHierarchyRow<CatalogueObject> } & HierarchyBranchOwner)
  | ({ kind: 'orbit'; row: OrbitHierarchyRow<CatalogueObject> } & HierarchyBranchOwner)
)

const props = defineProps<{
  workspace: LocalWorkspace
  continuousMap?: boolean
  inspectedTarget?: import('../stores/editor-ui').InspectedMapTarget | null
  hasChartNameDraft: boolean
  dimmedObjectIds?: readonly string[]
}>()

const store = useEditorUiStore()
const commands = useEditorCommands()
const activeSystemId = computed(() => {
  const target = props.inspectedTarget
  if (props.continuousMap && (target?.kind === 'system' || target?.kind === 'object' || target?.kind === 'orbit')) {
    return target.systemId
  }
  return store.activeView === 'cluster' ? store.clusterSelectedSystemId : store.selectedSystemId
})
const selectedSystem = computed(() =>
  props.workspace.cluster.systems.find(system => system.id === activeSystemId.value),
)

const hierarchyRows = computed(() => buildMapHierarchy(selectedSystem.value))
const hierarchyItems = computed(() => props.continuousMap
  ? [
      ...props.workspace.cluster.systems.flatMap(system => buildHierarchyTreeItems(buildMapHierarchy(system), system, true)),
      ...props.workspace.cluster.routes.flatMap(route => buildHierarchyTreeItems(
        buildMapHierarchy(routeContentsFor(props.workspace.cluster, route.id)), undefined, false, route,
      )),
    ]
  : buildHierarchyTreeItems(hierarchyRows.value, selectedSystem.value))
const flatHierarchyItems = computed(() => flattenHierarchyTreeItems(hierarchyItems.value))
const continuousHierarchyRecordCount = computed(() => flatHierarchyItems.value
  .filter(item => item.kind === 'object' || item.kind === 'orbit').length)
const hierarchyItemsByKey = computed(() => new Map(flatHierarchyItems.value.map(item => [item.key, item])))
const maximumHierarchyLevel = computed(() => props.continuousMap
  ? flatHierarchyItems.value.reduce((maximum, item) => Math.max(maximum, item.ancestorKeys.length + 1), 1)
  : hierarchyRows.value.reduce((maximum, row) => Math.max(maximum, row.depth + 1), 1))
const hierarchyIndentStep = computed(() => `${Math.min(5, 40 / Math.max(1, maximumHierarchyLevel.value - 1))}px`)
const selectedHierarchyKey = computed(() => {
  if (props.continuousMap) {
    const target = props.inspectedTarget
    if (target?.kind === 'object') return `object:${target.systemId}:${target.objectId}`
    if (target?.kind === 'orbit') return `orbit:${target.systemId}:${target.orbitId}`
    if (target?.kind === 'system') return `system:${target.systemId}`
    if (target?.kind === 'route') return `route:${target.routeId}`
    if (target?.kind === 'route-object') return `route-object:${target.routeId}:${target.objectId}`
    return ''
  }
  const lastSelectedObjectId = store.selectedObjectIds[store.selectedObjectIds.length - 1]
  if (lastSelectedObjectId) return objectHierarchyKey(lastSelectedObjectId)
  if (store.selectedObjectId) return objectHierarchyKey(store.selectedObjectId)
  if (store.selectedOrbitId) return `orbit:${store.selectedOrbitId}`
  return ''
})
const selectedHierarchyItem = computed(() => flatHierarchyItems.value.find(item => item.key === selectedHierarchyKey.value))
const selectedHierarchyItems = computed(() => {
  if (props.continuousMap) {
    const selectedKeys = new Set(store.selectedObjectIds.map(objectHierarchyKey))
    if (store.selectedObjectIds.length === 0 && selectedHierarchyKey.value) selectedKeys.add(selectedHierarchyKey.value)
    return flatHierarchyItems.value.filter(item => selectedKeys.has(item.key))
  }
  const selectedKeys = new Set(store.selectedObjectIds.length
    ? store.selectedObjectIds.map(id => `object:${id}`)
    : selectedHierarchyKey.value ? [selectedHierarchyKey.value] : [])
  return flatHierarchyItems.value.filter(item => selectedKeys.has(item.key))
})
const selectedHierarchyPath = computed(() => {
  const item = selectedHierarchyItem.value
  if (!item) return ''
  const path = item.kind === 'system' && item.children?.length ? [...item.ancestorKeys, item.key] : item.ancestorKeys
  return path.join('\u001f')
})
const hierarchyIdentity = computed(() => JSON.stringify([
  props.workspace.cluster.id,
  props.continuousMap ? 'all-systems' : selectedSystem.value?.id ?? null,
]))
const hierarchyBranches = computed(() => flatHierarchyItems.value.filter(item => item.children?.length))
const expandedHierarchyKeys = ref<string[]>([])
const seededHierarchyOwners = reactive(new Set<string>())
const browsedHierarchyBranches = reactive(new Set<string>())
const manuallyCollapsedHierarchyKeys = new Set<string>()
const continuousHierarchyRoot = ref<HTMLElement | null>(null)
const focusedHierarchyTarget = ref<{ key: string; objectId?: string; orbitId?: string } | null>(null)
const isHierarchyComposing = ref(false)
const focusedHierarchyItem = computed(() => {
  const target = focusedHierarchyTarget.value
  if (!target) return undefined
  return flatHierarchyItems.value.find(item => target.objectId
    ? item.kind === 'object' && item.row.object.id === target.objectId
    : target.orbitId ? item.kind === 'orbit' && item.row.orbit.id === target.orbitId : item.key === target.key)
})
const revealedHierarchyItems = computed(() => [
  ...selectedHierarchyItems.value,
  selectedHierarchyItem.value,
  focusedHierarchyItem.value,
  ...[...browsedHierarchyBranches].map(key => hierarchyItemsByKey.value.get(key)),
].filter((item): item is HierarchyTreeItem => item !== undefined))
const revealedHierarchyAncestors = computed(() => new Set(revealedHierarchyItems.value.flatMap(item => item.ancestorKeys)))

/** Keep the complete model for selection; only automatically opened paths limit mounted siblings. */
const renderedHierarchyItems = computed(() => {
  if (!props.continuousMap) return hierarchyItems.value
  const revealedKeys = new Set([...revealedHierarchyAncestors.value, ...revealedHierarchyItems.value.map(item => item.key)])
  const expanded = new Set(expandedHierarchyKeys.value)
  const project = (item: HierarchyTreeItem): HierarchyTreeItem => {
    if (!item.children?.length || !expanded.has(item.key) || browsedHierarchyBranches.has(item.key)) return item
    const ownerKey = item.ancestorKeys[0] ?? item.key
    if (seededHierarchyOwners.has(ownerKey)) return item
    // An empty children array retains Reka's disclosure semantics for a formerly revealed branch.
    return { ...item, children: item.children.filter(child => revealedKeys.has(child.key)).map(project) }
  }
  return hierarchyItems.value.map(project)
})

watch(revealedHierarchyAncestors, ancestors => {
  if (!props.continuousMap) return
  // Automatic paths expire with their target; deliberately browsed branches keep their own expansion.
  expandedHierarchyKeys.value = expandedHierarchyKeys.value.filter(key => {
    const item = hierarchyItemsByKey.value.get(key)
    const ownerKey = item?.ancestorKeys[0] ?? key
    return ancestors.has(key) || browsedHierarchyBranches.has(key) || seededHierarchyOwners.has(ownerKey)
  })
})

watch(renderedHierarchyItems, () => {
  const root = continuousHierarchyRoot.value
  const focused = root?.ownerDocument.activeElement
  if (!root || !(focused instanceof HTMLElement) || !root.contains(focused)) return
  const row = hierarchyRowData(focused)
  const key = row?.dataset.hierarchyKey
  const objectId = row?.dataset.objectId
  const orbitId = row?.dataset.orbitId
  const ownerKey = row?.dataset.routeId ? `route:${row.dataset.routeId}`
    : row?.dataset.systemId ? `system:${row.dataset.systemId}` : key
  if (!key) return
  void nextTick(() => {
    const active = root.ownerDocument.activeElement
    if (active !== focused && active !== root.ownerDocument.body) return
    if (focused.isConnected && hierarchyRowData(focused)?.dataset.hierarchyKey === key) return
    const currentKey = flatHierarchyItems.value.find(item => objectId
      ? item.kind === 'object' && item.row.object.id === objectId
      : orbitId ? item.kind === 'orbit' && item.row.orbit.id === orbitId : item.key === key)?.key
    const target = (currentKey ? findHierarchyRow(currentKey) : undefined)
      ?? (ownerKey ? findHierarchyRow(ownerKey) : undefined)
      ?? root.closest('[data-workspace-dashboard]')?.querySelector<SVGSVGElement>('svg.continuous-warden-map-svg')
    target?.focus({ preventScroll: true })
  })
})

watch(() => focusedHierarchyItem.value?.ancestorKeys.join('\u001f'), path => {
  if (props.continuousMap && path) expandHierarchyBranches(path.split('\u001f'))
})

watch(hierarchyIdentity, () => {
  seededHierarchyOwners.clear()
  browsedHierarchyBranches.clear()
  focusedHierarchyTarget.value = null
  manuallyCollapsedHierarchyKeys.clear()
  expandedHierarchyKeys.value = props.continuousMap ? [] : hierarchyBranches.value.map(item => item.key)
}, { immediate: true })

watch(hierarchyBranches, (branches, previousBranches) => {
  const expanded = new Set(expandedHierarchyKeys.value)
  const previouslyExpandable = new Set(previousBranches?.map(item => item.key))
  const currentKeys = new Set(branches.map(item => item.key))
  for (const key of manuallyCollapsedHierarchyKeys) {
    if (!currentKeys.has(key)) manuallyCollapsedHierarchyKeys.delete(key)
  }
  for (const key of seededHierarchyOwners) {
    if (!currentKeys.has(key)) seededHierarchyOwners.delete(key)
  }
  for (const key of browsedHierarchyBranches) {
    if (!currentKeys.has(key)) browsedHierarchyBranches.delete(key)
  }
  expandedHierarchyKeys.value = branches
    .filter(item => expanded.has(item.key) || (!previouslyExpandable.has(item.key)
      && (!props.continuousMap || seededHierarchyOwners.has(item.ancestorKeys[0] ?? item.key))))
    .map(item => item.key)
}, { immediate: true })

watch(
  [hierarchyIdentity, selectedHierarchyKey, selectedHierarchyPath],
  ([, selectedKey, selectedPath]) => {
    if (props.continuousMap && selectedHierarchyItem.value?.kind === 'system') {
      seedHierarchyOwner(selectedKey)
    }
    if (selectedKey && selectedPath) expandHierarchyBranches(selectedPath.split('\u001f'))
  },
  { immediate: true },
)

watch(
  [hierarchyIdentity, selectedHierarchyItems],
  ([identity, selectedItems], [previousIdentity, previousItems]) => {
    if (!props.continuousMap) return
    const previousPaths = new Map<string, readonly string[]>(identity === previousIdentity
      ? previousItems?.map(item => [item.key, item.ancestorKeys])
      : [])
    // Group members can be added or reparented while the Inspector retains its previous target.
    const newAncestors = selectedItems
      .filter(item => {
        if (item.kind !== 'object') return false
        const previousPath = previousPaths.get(item.key)
        return !previousPath || previousPath.length !== item.ancestorKeys.length
          || previousPath.some((key, index) => key !== item.ancestorKeys[index])
      })
      .flatMap(item => item.ancestorKeys)
    expandHierarchyBranches(newAncestors)
  },
  { immediate: true },
)

function expandHierarchyBranches(keys: readonly string[]): void {
  if (keys.length === 0) return
  const expanded = new Set([...expandedHierarchyKeys.value, ...keys])
  if (expanded.size > expandedHierarchyKeys.value.length) expandedHierarchyKeys.value = [...expanded]
}

/** Full default expansion belongs to explicit owner consultation, once per owner and identity. */
function seedHierarchyOwner(ownerKey: string, expanded = new Set(expandedHierarchyKeys.value)): Set<string> {
  if (seededHierarchyOwners.has(ownerKey)) return expanded
  seededHierarchyOwners.add(ownerKey)
  for (const item of hierarchyBranches.value) {
    if (item.ancestorKeys.includes(ownerKey) && !manuallyCollapsedHierarchyKeys.has(item.key)) expanded.add(item.key)
  }
  expandedHierarchyKeys.value = [...expanded]
  return expanded
}

function hierarchyRowData(element: Element): HTMLElement | undefined {
  const treeitem = element.closest<HTMLElement>('[role="treeitem"]')
  if (!treeitem) return undefined
  if (treeitem.matches('[data-hierarchy-key]')) return treeitem
  return [...treeitem.querySelectorAll<HTMLElement>('[data-hierarchy-key]')]
    .find(row => row.closest('[role="treeitem"]') === treeitem)
}

function trackHierarchyFocus(event: FocusEvent): void {
  if (!(event.target instanceof Element)) return
  // Inline actions must not prune the path they are about to browse, collapse, or publish.
  if (event.target.closest('[role="treeitem"]') !== event.target) return
  const row = hierarchyRowData(event.target)
  if (!row) return
  const key = row.dataset.hierarchyKey
  if (key) focusedHierarchyTarget.value = { key, objectId: row.dataset.objectId, orbitId: row.dataset.orbitId }
}

function releaseHierarchyFocus(event: FocusEvent): void {
  const root = continuousHierarchyRoot.value
  if (!root || (event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) return
  if (event.relatedTarget) {
    focusedHierarchyTarget.value = null
    return
  }
  // A model redraw can temporarily send focus to body; let the keyed-row restoration settle first.
  void nextTick(() => {
    const active = root.ownerDocument.activeElement
    if (active && active !== root.ownerDocument.body && !root.contains(active)) focusedHierarchyTarget.value = null
  })
}

function findHierarchyRow(key: string): HTMLElement | undefined {
  const row = [...(continuousHierarchyRoot.value?.querySelectorAll<HTMLElement>('[data-hierarchy-key]') ?? [])]
    .find(row => row.dataset.hierarchyKey === key)
  return row?.closest<HTMLElement>('[role="treeitem"]') ?? row
}

function showAllHierarchyOwner(event: MouseEvent, ownerKey: string): void {
  const opener = event.currentTarget
  const restoreFocus = opener instanceof HTMLElement && opener.ownerDocument.activeElement === opener
  seedHierarchyOwner(ownerKey)
  void nextTick(() => {
    if (!restoreFocus || !(opener instanceof HTMLElement) || opener.isConnected) return
    if (opener.ownerDocument.activeElement !== opener.ownerDocument.body) return
    findHierarchyRow(ownerKey)?.focus({ preventScroll: true })
  })
}

function objectHierarchyKey(objectId: string): string {
  if (!props.continuousMap) return `object:${objectId}`
  const owner = ownerSystemForObject(objectId)
  return owner ? `object:${owner.id}:${objectId}` : `object:${objectId}`
}

function ownerSystemForObject(objectId: string): StarSystem | undefined {
  return props.workspace.cluster.systems.find(system => system.objects.some(object => object.id === objectId))
}

function hierarchyObjectPublicationStatus(item: Extract<HierarchyTreeItem, { kind: 'object' }>) {
  const parentPublication = props.workspace.cluster.systems.find(system => system.id === item.ownerSystemId)?.publication
  return publicationStatus(item.row.object.publication, parentPublication)
}

function buildHierarchyTreeItems(
  rows: MapHierarchyRow<CatalogueObject>[],
  ownerSystem: StarSystem | undefined,
  includeSystemRoot = false,
  ownerRoute?: JumpRoute,
): HierarchyTreeItem[] {
  const root: HierarchyTreeItem | undefined = ownerRoute
    ? {
        kind: 'route',
        route: ownerRoute,
        key: `route:${ownerRoute.id}`,
        label: ownerRoute.name || `Jump Level ${ownerRoute.jumpLevel}`,
        textValue: ownerRoute.name || commands.navigation.routeSummary(ownerRoute),
        ariaLabel: `Select Jump Level ${ownerRoute.jumpLevel}: ${commands.navigation.routeSummary(ownerRoute)}`,
        ancestorKeys: [],
        children: [],
      }
    : includeSystemRoot && ownerSystem ? {
        kind: 'system',
        system: ownerSystem,
        key: `system:${ownerSystem.id}`,
        label: ownerSystem.name,
        textValue: ownerSystem.name,
        ariaLabel: `Inspect ${ownerSystem.name}`,
        ariaDescription: `${ownerSystem.objects.length} map objects`,
        ancestorKeys: [],
        children: [],
      }
    : undefined
  const roots: HierarchyTreeItem[] = root ? [root] : []
  const parentsAtDepth: HierarchyTreeItem[] = []
  const dimmedObjectIds = new Set(props.dimmedObjectIds ?? [])
  const ownerName = ownerRoute
    ? ownerRoute.name || commands.navigation.routeSummary(ownerRoute)
    : ownerSystem?.name ?? ''
  const owner: HierarchyBranchOwner = {
    ownerName,
    ownerRouteId: ownerRoute?.id,
    ownerSystemId: ownerSystem?.id,
  }
  const ownerSuffix = props.continuousMap && ownerName ? ` in ${ownerName}` : ''

  for (const row of rows) {
    const parent = row.depth > 0 ? parentsAtDepth[row.depth - 1] : root
    const ancestorKeys = parent ? [...parent.ancestorKeys, parent.key] : []
    const parentContext = row.kind === 'object'
      ? hierarchyParentContext(parent)
      : undefined
    const publicationDescription = row.kind === 'object'
      ? publicationStatus(row.object.publication, ownerSystem?.publication).description
      : undefined
    const isDimmed = row.kind === 'object'
      && dimmedObjectIds.has(row.object.id)
    const item: HierarchyTreeItem = row.kind === 'object'
      ? {
          kind: 'object',
          row,
          ...owner,
          key: ownerRoute ? `route-object:${ownerRoute.id}:${row.object.id}`
            : props.continuousMap && ownerSystem ? `object:${ownerSystem.id}:${row.object.id}` : `object:${row.object.id}`,
          label: row.object.name,
          textValue: props.continuousMap && ownerName ? `${row.object.name}, ${ownerName}` : row.object.name,
          ariaLabel: `Select ${row.object.locationKey}, ${row.object.name}${ownerSuffix}`,
          ariaDescription: `${catalogueFamilyLabel(row.object.family)} / ${catalogueSubtypeLabel(row.object)}. ${parentContext}. ${publicationDescription}${isDimmed ? ' Dimmed on map because it does not match the active filters.' : ''}`,
          isDimmed,
          parentContext,
          ancestorKeys,
        }
      : {
          kind: 'orbit',
          row,
          ...owner,
          key: ownerRoute ? `route-orbit:${ownerRoute.id}:${row.orbit.id}`
            : props.continuousMap && ownerSystem ? `orbit:${ownerSystem.id}:${row.orbit.id}` : `orbit:${row.orbit.id}`,
          label: `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
          textValue: props.continuousMap && ownerName
            ? `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}${ownerSuffix}`
            : `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
          ariaLabel: props.continuousMap && ownerName
            ? `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}${ownerSuffix}`
            : `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
          ariaDescription: ownerName,
          ancestorKeys,
        }

    if (parent) {
      parent.children ??= []
      parent.children.push(item)
    } else {
      roots.push(item)
    }

    parentsAtDepth[row.depth] = item
    parentsAtDepth.length = row.depth + 1
  }

  return roots
}

function hierarchyParentContext(parent: HierarchyTreeItem | undefined): string {
  if (parent?.kind === 'route') return 'Jump Route'
  if (parent?.kind !== 'orbit') return 'Zone map'
  return `Orbit ${parent.row.orbit.order} around ${parent.row.host?.name ?? 'unoccupied center'}`
}

function flattenHierarchyTreeItems(items: HierarchyTreeItem[], flattened: HierarchyTreeItem[] = []): HierarchyTreeItem[] {
  for (const item of items) {
    flattened.push(item)
    if (item.children) flattenHierarchyTreeItems(item.children, flattened)
  }
  return flattened
}

function getHierarchyItemKey(item: HierarchyTreeItem): string {
  return item.key
}

function updateExpandedHierarchyKeys(keys: string[]): void {
  if (!props.continuousMap) {
    expandedHierarchyKeys.value = keys
    return
  }
  const previous = new Set(expandedHierarchyKeys.value)
  let expanded = new Set(keys)
  for (const key of previous) {
    if (!expanded.has(key)) manuallyCollapsedHierarchyKeys.add(key)
  }
  for (const key of keys) {
    if (previous.has(key)) continue
    manuallyCollapsedHierarchyKeys.delete(key)
    if (key.startsWith('system:') || key.startsWith('route:')) expanded = seedHierarchyOwner(key, expanded)
    else browsedHierarchyBranches.add(key)
  }
  expandedHierarchyKeys.value = [...expanded]
}

function selectHierarchyItem(event: TreeItemSelectEvent<HierarchyTreeItem>, item: HierarchyTreeItem): void {
  event.preventDefault()
  if (props.continuousMap) {
    if (item.kind === 'system') {
      void commands.navigation.inspectContinuousTarget({ kind: 'system', systemId: item.system.id })
    } else if (item.kind === 'route') {
      void commands.navigation.selectRoute(item.route.id)
    } else if (item.kind === 'object' && item.ownerRouteId !== undefined) {
      void commands.navigation.inspectRouteObject(item.ownerRouteId, item.row.object.id)
    } else if (item.kind === 'object' && item.ownerSystemId !== undefined) {
      const sourceEvent = event.detail.originalEvent
      const modified = sourceEvent instanceof MouseEvent
        && (sourceEvent.shiftKey || sourceEvent.ctrlKey || sourceEvent.metaKey)
      if (modified && store.mapMode === 'select') {
        void commands.navigation.toggleObjectSelection(item.row.object.id)
        return
      }
      void commands.navigation.inspectContinuousTarget({
        kind: 'object',
        systemId: item.ownerSystemId,
        objectId: item.row.object.id,
      })
    } else if (item.kind === 'orbit' && item.ownerSystemId !== undefined) {
      void commands.navigation.inspectContinuousTarget({
        kind: 'orbit',
        systemId: item.ownerSystemId,
        orbitId: item.row.orbit.id,
      })
    }
    return
  }
  if (item.kind === 'object') {
    const sourceEvent = event.detail.originalEvent
    if (sourceEvent instanceof MouseEvent
      && (sourceEvent.shiftKey || sourceEvent.ctrlKey || sourceEvent.metaKey)
      && store.mapMode === 'select') {
      void commands.navigation.toggleObjectSelection(item.row.object.id)
    } else {
      void commands.navigation.selectObject(item.row.object.id)
    }
  }
  else if (item.kind === 'orbit') void commands.navigation.selectOrbit(item.row.orbit.id)
  else if (item.kind === 'system') void commands.navigation.selectSystem(item.system.id)
}

function systemTarget(systemId: string): EntityContextTarget {
  return { kind: 'system', id: systemId, systemId }
}

function objectTarget(objectId: string, ownerSystemId?: string): EntityContextTarget | null {
  const system = ownerSystemId
    ? props.workspace.cluster.systems.find(candidate => candidate.id === ownerSystemId)
    : selectedSystem.value
  return system ? { kind: 'object', id: objectId, systemId: system.id } : null
}

function openEntityMenu(
  event: Event,
  target: EntityContextTarget,
  opener: HTMLElement,
  point: { x: number; y: number },
  selectObjectForContext = false,
): void {
  event.preventDefault()
  event.stopPropagation()
  commands.publication.openMenu(
    { target, clientPoint: point, opener, source: 'hierarchy' },
    selectObjectForContext && target.kind === 'object' ? { selectObjectForContext: true } : undefined,
  )
}

function openSystemMenu(event: Event, systemId: string, opener: HTMLElement, point: { x: number; y: number }): void {
  openEntityMenu(event, systemTarget(systemId), opener, point)
}

function openSystemContextMenu(event: MouseEvent, system: { id: string }): void {
  if (!(event.target instanceof Element)) return
  const opener = event.target.closest<HTMLElement>('.system-link')
  if (opener) openSystemMenu(event, system.id, opener, { x: event.clientX, y: event.clientY })
}

function openSystemContextMenuFromKeyboard(event: KeyboardEvent, system: { id: string }): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  const opener = event.currentTarget
  if (!(opener instanceof HTMLElement)) return
  const bounds = opener.getBoundingClientRect()
  openSystemMenu(event, system.id, opener, { x: bounds.left, y: bounds.bottom })
}

function openSystemMenuFromButton(event: MouseEvent, system: { id: string }): void {
  const opener = event.currentTarget
  if (!(opener instanceof HTMLElement)) return
  const bounds = opener.getBoundingClientRect()
  const point = event.detail === 0
    ? { x: bounds.left, y: bounds.bottom }
    : { x: event.clientX, y: event.clientY }
  openSystemMenu(event, system.id, opener, point)
}

function hierarchyItemTarget(item: HierarchyTreeItem): EntityContextTarget | null {
  if (item.kind === 'system') return systemTarget(item.system.id)
  if (item.kind === 'route') return routeTarget(item.route.id)
  if (item.ownerRouteId !== undefined) return null
  if (item.kind === 'object') return objectTarget(item.row.object.id, item.ownerSystemId)
  return item.ownerSystemId
    ? { kind: 'orbit', id: item.row.orbit.id, systemId: item.ownerSystemId }
    : null
}

function openHierarchyMenu(event: MouseEvent, item: HierarchyTreeItem): void {
  if (!(event.currentTarget instanceof HTMLElement)) return
  const target = hierarchyItemTarget(item)
  if (!target) return
  const opener = event.currentTarget.closest<HTMLElement>('[role="treeitem"]') ?? event.currentTarget
  openEntityMenu(event, target, opener, { x: event.clientX, y: event.clientY }, target.kind === 'object')
}

function openHierarchyMenuFromKeyboard(event: KeyboardEvent, item: HierarchyTreeItem): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  const target = hierarchyItemTarget(item)
  if (!target) return
  const opener = event.currentTarget.closest<HTMLElement>('[role="treeitem"]') ?? event.currentTarget
  const bounds = opener.getBoundingClientRect()
  openEntityMenu(event, target, opener, { x: bounds.left, y: bounds.bottom }, target.kind === 'object')
}

function routeTarget(routeId: string): EntityContextTarget {
  return { kind: 'route', id: routeId }
}

function openRouteContextMenu(event: MouseEvent, routeId: string): void {
  const opener = event.currentTarget
  if (!(opener instanceof HTMLElement)) return
  openEntityMenu(event, routeTarget(routeId), opener, { x: event.clientX, y: event.clientY })
}

function openRouteContextMenuFromKeyboard(event: KeyboardEvent, routeId: string): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  const opener = event.currentTarget
  if (!(opener instanceof HTMLElement)) return
  const bounds = opener.getBoundingClientRect()
  openEntityMenu(event, routeTarget(routeId), opener, { x: bounds.left, y: bounds.bottom })
}

function openObjectMenuFromButton(event: MouseEvent, objectId: string, ownerSystemId?: string): void {
  const opener = event.currentTarget
  if (!(opener instanceof HTMLElement)) return
  const bounds = opener.getBoundingClientRect()
  const point = event.detail === 0
    ? { x: bounds.left, y: bounds.bottom }
    : { x: event.clientX, y: event.clientY }
  const target = objectTarget(objectId, ownerSystemId ?? (props.continuousMap ? ownerSystemForObject(objectId)?.id : undefined))
  if (target) openEntityMenu(event, target, opener, point)
}

function toggleHierarchyItem(event: TreeItemToggleEvent<HierarchyTreeItem>): void {
  if (event.detail.originalEvent.type === 'click') event.preventDefault()
}

function toggleHierarchyItemAndRestoreFocus(event: MouseEvent, handleToggle: () => void): void {
  handleToggle()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.closest<HTMLElement>('[role="treeitem"]')?.focus({ preventScroll: true })
  }
}

function stopComposingTreeKeys(event: KeyboardEvent): void {
  if (isHierarchyComposing.value || event.isComposing || event.keyCode === 229) event.stopPropagation()
}

function beginHierarchyComposition(): void {
  isHierarchyComposing.value = true
}

function endHierarchyComposition(): void {
  isHierarchyComposing.value = false
}
</script>

<style>
.panel-heading {
  padding-right: 2.5rem;
}

.chart-names summary {
  color: var(--text-secondary);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.system-link,
.tree-row {
  color: var(--text-secondary);
}

.system-link {
  font-size: 0.75rem;
}

.system-link:hover,
.tree-row:hover {
  border-color: var(--line);
  background: var(--panel-raised);
}

.system-link.active,
.tree-row.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-primary);
}

.system-seal {
  color: var(--status-good);
  font: 0.55rem Consolas, monospace;
}

.system-link small,
.tree-copy small {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.tree-count {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 0.52rem;
}

.hierarchy-panel .tree-row {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.key-tag {
  color: var(--map-muted);
  font: 0.62rem/1.35 Consolas, monospace;
}

.orbit-row {
  color: var(--text-secondary);
}

.hierarchy-panel .orbit-mark {
  font-size: 1rem;
  line-height: 1.1;
}

.hierarchy-panel .tree-copy small {
  font-size: 0.64rem;
  line-height: 1.35;
}

.hierarchy-panel .tree-object-title .object-mark {
  width: 1rem;
  height: 1rem;
  font-size: 0.78rem;
}

.map-workspace-shell .cluster-map-nav-button {
  background: var(--control-bg);
}
</style>
