<template>
  <template v-if="store.activeView === 'cluster'">
    <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
      <div>
        <span class="section-kicker">LOCAL ARCHIVE</span>
        <h2 class="mt-[0.28rem] mb-0 text-2xl">Cluster</h2>
      </div>
      <span class="tree-count whitespace-nowrap">{{ props.workspace.cluster.systems.length }} systems</span>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UButton color="primary" variant="outline" @click="commands.charts.beginNamesEdit()">
        {{ props.hasChartNameDraft ? 'Resume chart name draft' : 'Edit chart names' }}
      </UButton>
      <span v-if="props.hasChartNameDraft" class="save-feedback text-sm" role="status">Chart-name editing session</span>
    </div>

    <nav class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Star systems">
      <span class="subsection-label">STAR SYSTEMS</span>
      <p v-if="!props.workspace.cluster.systems.length" class="empty-copy my-[0.65rem]">No star systems yet.</p>
      <div
        v-for="system in props.workspace.cluster.systems"
        :key="system.id"
        class="flex min-w-0 items-center gap-[0.25rem]"
      >
        <button
          class="system-link flex min-h-[2.7rem] min-w-0 flex-1 cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
          type="button"
          :aria-label="`Open ${system.name} system map`"
          :aria-current="system.id === activeSystemId ? 'page' : undefined"
          @click="commands.navigation.selectSystem(system.id)"
        >
          <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">SY</span>
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
        </button>
        <button
          class="quiet-button min-h-[2.5rem] w-[2.5rem] shrink-0 justify-center px-0"
          type="button"
          :aria-label="`Delete ${system.name} system`"
          :title="props.workspace.cluster.systems.length === 1 ? 'A Jump Cluster must contain at least one star system.' : undefined"
          :disabled="props.workspace.cluster.systems.length === 1 || props.saving"
          @click="commands.cluster.deleteSystem(system.id)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </nav>

    <nav class="object-tree grid gap-[0.1rem] border-t border-[var(--line-soft)] pt-[0.65rem]" aria-label="Jump Routes">
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
        @click="commands.navigation.selectRoute(route.id)"
      >
        <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">R</span>
        <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
          Jump Level {{ route.jumpLevel }}
          <small class="mt-[0.18rem] block">{{ commands.navigation.routeSummary(route) }}</small>
        </span>
      </button>
    </nav>
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
      <UButton color="primary" variant="outline" @click="commands.charts.beginNamesEdit()">
        {{ props.hasChartNameDraft ? 'Resume chart name draft' : 'Edit chart names' }}
      </UButton>
      <span v-if="props.hasChartNameDraft" class="save-feedback text-sm" role="status">Chart-name editing session</span>
    </div>

    <nav class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Star systems">
      <span class="subsection-label">STAR SYSTEMS</span>
      <button
        v-for="system in props.workspace.cluster.systems"
        :key="system.id"
        class="system-link flex min-h-[2.7rem] w-full cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
        :class="{ active: system.id === activeSystemId }"
        type="button"
        :aria-current="system.id === activeSystemId ? 'page' : undefined"
        @click="commands.navigation.selectSystem(system.id)"
      >
        <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">SY</span>
        <span>{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
      </button>
    </nav>

    <div class="tree-heading flex justify-between gap-[0.4rem] border-t border-[var(--line-soft)] pt-[0.65rem] pb-[0.45rem]">
      <span class="subsection-label">OBJECTS / ORBITS</span>
      <span class="tree-count whitespace-nowrap">{{ hierarchyRows.length }} records</span>
    </div>
    <p v-if="hierarchyRows.length === 0" class="empty-copy my-[0.65rem]">No objects charted yet.</p>
    <!-- @vue-generic {HierarchyTreeItem[]} -->
    <UTree
      v-else
      :items="hierarchyItems"
      :model-value="selectedHierarchyItem"
      :expanded="expandedHierarchyKeys"
      :get-key="getHierarchyItemKey"
      label-key="label"
      class="object-tree"
      aria-label="Map object and Orbit hierarchy"
      :ui="{ listWithChildren: 'border-s border-[var(--line-soft)]' }"
      @update:expanded="updateExpandedHierarchyKeys"
      @select="selectHierarchyItem"
      @toggle="toggleHierarchyItem"
      @keydown.capture="stopComposingTreeKeys"
      @compositionstart="beginHierarchyComposition"
      @compositionend="endHierarchyComposition"
    >
      <template #item-wrapper="{ item, expanded, selected, handleToggle, ui }">
        <div
          :class="ui.link({
            class: [
              'tree-row flex min-h-[2.55rem] w-full items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left',
              item.kind === 'object' ? 'object-row' : 'orbit-row',
              { active: selected },
            ],
            selected,
          })"
          :aria-label="item.ariaLabel"
          :aria-current="selected ? 'true' : undefined"
        >
          <template v-if="item.kind === 'object'">
            <span class="key-tag shrink-0 whitespace-nowrap">{{ item.row.object.locationKey }}</span>
            <span class="object-mark" aria-hidden="true">{{ objectMark(item.row.object) }}</span>
            <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
              {{ item.row.object.name }}
              <small class="mt-[0.18rem] block">
                {{ catalogueFamilyLabel(item.row.object.family) }} / {{ catalogueSubtypeLabel(item.row.object) }}
              </small>
            </span>
          </template>
          <template v-else>
            <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">○</span>
            <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
              Orbit {{ item.row.orbit.order }}
              <small class="mt-[0.18rem] block">
                {{ item.row.host?.name ?? 'Unoccupied center' }} / {{ item.row.childCount }} object{{ item.row.childCount === 1 ? '' : 's' }}
              </small>
            </span>
          </template>
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
      </template>
    </UTree>
    <p class="hierarchy-note mt-4 mb-0 border-t border-[var(--line-soft)] pt-[0.8rem]">Choose Add Orbit from Add, then click the map to place it, or drag Orbit onto a map object to host it. Empty Orbits stay on the chart.</p>
  </template>
</template>

<script setup lang="ts">
/**
 * Owns cluster navigation and projects nested objects/Orbits into a selectable hierarchy.
 */
import { computed, ref, watch } from 'vue'
import {
  type LocalWorkspace,
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
import type { TreeItemSelectEvent, TreeItemToggleEvent } from 'reka-ui'

interface HierarchyTreeItemBase {
  key: string
  label: string
  textValue: string
  ariaLabel: string
  ancestorKeys: string[]
  children?: HierarchyTreeItem[]
  [key: string]: unknown
}

type HierarchyTreeItem = HierarchyTreeItemBase & (
  | { kind: 'object'; row: ObjectHierarchyRow }
  | { kind: 'orbit'; row: OrbitHierarchyRow }
)

const props = defineProps<{
  workspace: LocalWorkspace
  hasChartNameDraft: boolean
  saving: boolean
}>()

const store = useEditorUiStore()
const commands = useEditorCommands()
const activeSystemId = computed(() => store.activeView === 'cluster'
  ? store.clusterSelectedSystemId
  : store.selectedSystemId)

const selectedSystem = computed(() =>
  props.workspace.cluster.systems.find(system => system.id === activeSystemId.value),
)

const hierarchyRows = computed(() => buildMapHierarchy(selectedSystem.value))
const hierarchyItems = computed(() => buildHierarchyTreeItems(hierarchyRows.value))
const flatHierarchyItems = computed(() => flattenHierarchyTreeItems(hierarchyItems.value))
const selectedHierarchyKey = computed(() => {
  if (store.selectedObjectId) return `object:${store.selectedObjectId}`
  if (store.selectedOrbitId) return `orbit:${store.selectedOrbitId}`
  return ''
})
const selectedHierarchyItem = computed(() => flatHierarchyItems.value.find(item => item.key === selectedHierarchyKey.value))
const selectedHierarchyPath = computed(() => selectedHierarchyItem.value?.ancestorKeys.join('\u001f') ?? '')
const hierarchyIdentity = computed(() => JSON.stringify([
  props.workspace.cluster.id,
  selectedSystem.value?.id ?? null,
]))
const hierarchyBranchKeys = computed(() => flatHierarchyItems.value
  .filter(item => item.children?.length)
  .map(item => item.key))
const expandedHierarchyKeys = ref<string[]>([])
const isHierarchyComposing = ref(false)

watch(hierarchyIdentity, () => {
  expandedHierarchyKeys.value = hierarchyBranchKeys.value
}, { immediate: true })

watch(hierarchyBranchKeys, (keys, previousKeys) => {
  const expanded = new Set(expandedHierarchyKeys.value)
  const previouslyExpandable = new Set(previousKeys ?? [])
  expandedHierarchyKeys.value = keys.filter(key => !previouslyExpandable.has(key) || expanded.has(key))
}, { immediate: true })

watch(
  [hierarchyIdentity, selectedHierarchyKey, selectedHierarchyPath],
  ([, selectedKey, selectedPath]) => {
    if (!selectedKey || !selectedPath) return
    const expanded = new Set(expandedHierarchyKeys.value)
    for (const ancestorKey of selectedPath.split('\u001f')) expanded.add(ancestorKey)
    expandedHierarchyKeys.value = [...expanded]
  },
  { immediate: true },
)

function buildHierarchyTreeItems(rows: MapHierarchyRow[]): HierarchyTreeItem[] {
  const roots: HierarchyTreeItem[] = []
  const parentsAtDepth: HierarchyTreeItem[] = []

  for (const row of rows) {
    const parent = row.depth > 0 ? parentsAtDepth[row.depth - 1] : undefined
    const ancestorKeys = parent ? [...parent.ancestorKeys, parent.key] : []
    const item: HierarchyTreeItem = row.kind === 'object'
      ? {
          kind: 'object',
          row,
          key: `object:${row.object.id}`,
          label: row.object.name,
          textValue: row.object.name,
          ariaLabel: `Select ${row.object.locationKey}, ${row.object.name}`,
          ancestorKeys,
        }
      : {
          kind: 'orbit',
          row,
          key: `orbit:${row.orbit.id}`,
          label: `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
          textValue: `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
          ariaLabel: `Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`,
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
  expandedHierarchyKeys.value = keys
}

function selectHierarchyItem(event: TreeItemSelectEvent<HierarchyTreeItem>, item: HierarchyTreeItem): void {
  event.preventDefault()
  if (item.kind === 'object') void commands.navigation.selectObject(item.row.object.id)
  else void commands.navigation.selectOrbit(item.row.orbit.id)
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

.tree-row {
  color: var(--text-secondary);
}

.key-tag {
  color: var(--map-muted);
  font: 0.58rem Consolas, monospace;
}

.orbit-row {
  color: var(--text-secondary);
}

.hierarchy-panel .orbit-mark {
  font-size: 1.2rem;
}

.map-workspace-shell .cluster-map-nav-button {
  background: var(--control-bg);
}
</style>
