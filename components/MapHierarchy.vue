<template>
  <template v-if="props.mode === 'cluster'">
    <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
      <div>
        <span class="section-kicker">LOCAL ARCHIVE</span>
        <h2 class="mt-[0.28rem] mb-0 text-2xl">Cluster</h2>
      </div>
      <span class="tree-count whitespace-nowrap">{{ props.workspace.cluster.systems.length }} systems</span>
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
          :aria-current="system.id === props.selectedSystemId ? 'page' : undefined"
          @click="emit('select-system', system.id)"
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
          @click="emit('delete-system', system.id)"
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
        :class="{ active: route.id === props.selectedRouteId }"
        type="button"
        :aria-label="`Select Jump Level ${route.jumpLevel}: ${props.routeSummary(route)}`"
        :aria-current="route.id === props.selectedRouteId ? 'true' : undefined"
        @click="emit('select-route', route.id)"
      >
        <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">R</span>
        <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
          Jump Level {{ route.jumpLevel }}
          <small class="mt-[0.18rem] block">{{ props.routeSummary(route) }}</small>
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
        <button class="quiet-button cluster-map-nav-button" type="button" aria-label="Cluster map" @click="emit('show-cluster')">
          Cluster map
        </button>
      </div>
    </div>

    <details class="chart-names my-4 border-y border-[var(--line-soft)]">
      <summary class="cursor-pointer py-[0.7rem]">Chart names</summary>
      <form class="name-form grid gap-2 pb-[0.9rem]" @submit.prevent="emit('submit-names')">
        <fieldset class="m-0 grid gap-2 border-0 p-0" :disabled="!props.chartNamesEditing || props.saving">
          <label for="edit-cluster-name">Jump Cluster</label>
          <input
            id="edit-cluster-name"
            v-model="clusterName"
            maxlength="80"
            required
          >
          <label for="edit-system-name">Star system</label>
          <input
            id="edit-system-name"
            v-model="systemName"
            maxlength="80"
            required
          >
        </fieldset>
        <p v-if="props.formError" class="feedback m-0 error-text" role="alert">{{ props.formError }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="!props.chartNamesEditing"
            class="secondary-button mt-[0.3rem] min-h-[2.25rem] justify-center"
            type="button"
            aria-label="Edit chart names"
            @click="emit('edit-chart-names')"
          >
            Edit
          </button>
          <button v-else class="primary-button mt-[0.3rem]" type="submit" aria-label="Save chart names" :disabled="props.saving">
            Save
          </button>
          <button v-if="props.chartNamesEditing" class="quiet-button mt-[0.3rem]" type="button" @click="emit('cancel-chart-names')">
            Cancel
          </button>
        </div>
      </form>
    </details>

    <nav class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Star systems">
      <span class="subsection-label">STAR SYSTEMS</span>
      <button
        v-for="system in props.workspace.cluster.systems"
        :key="system.id"
        class="system-link flex min-h-[2.7rem] w-full cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
        :class="{ active: system.id === props.selectedSystemId }"
        type="button"
        :aria-current="system.id === props.selectedSystemId ? 'page' : undefined"
        @click="emit('select-system', system.id)"
      >
        <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">SY</span>
        <span>{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
      </button>
    </nav>

    <div class="tree-heading flex justify-between gap-[0.4rem] border-t border-[var(--line-soft)] pt-[0.65rem] pb-[0.45rem]">
      <span class="subsection-label">OBJECTS / ORBITS</span>
      <span class="tree-count whitespace-nowrap">{{ hierarchyRows.length }} records</span>
    </div>
    <nav class="object-tree grid gap-[0.1rem]" aria-label="Map object and Orbit hierarchy">
      <p v-if="hierarchyRows.length === 0" class="empty-copy my-[0.65rem]">No objects charted yet.</p>
      <template v-for="row in hierarchyRows" :key="row.kind === 'object' ? row.object.id : row.orbit.id">
        <button
          v-if="row.kind === 'object'"
          class="tree-row object-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
          :class="{ active: row.object.id === props.selectedObjectId }"
          type="button"
          :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
          :aria-label="`Select ${row.object.locationKey}, ${row.object.name}`"
          :aria-current="row.object.id === props.selectedObjectId ? 'true' : undefined"
          @click="emit('select-object', row.object.id)"
        >
          <span class="key-tag">{{ row.object.locationKey }}</span>
          <span class="object-mark" aria-hidden="true">{{ objectMark(row.object) }}</span>
          <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
            {{ row.object.name }}
            <small class="mt-[0.18rem] block">{{ row.object.family }} / {{ row.object.subtype }}</small>
          </span>
        </button>
        <button
          v-else
          class="tree-row orbit-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
          :class="{ active: row.orbit.id === props.selectedOrbitId }"
          type="button"
          :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
          :aria-label="`Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`"
          :aria-current="row.orbit.id === props.selectedOrbitId ? 'true' : undefined"
          @click="emit('select-orbit', row.orbit.id)"
        >
          <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">○</span>
          <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
            Orbit {{ row.orbit.order }}
            <small class="mt-[0.18rem] block">{{ row.host?.name ?? 'Unoccupied center' }} / {{ row.childCount }} object{{ row.childCount === 1 ? '' : 's' }}</small>
          </span>
        </button>
      </template>
    </nav>
    <p class="hierarchy-note mt-4 mb-0 border-t border-[var(--line-soft)] pt-[0.8rem]">Drag Orbit from Add Object onto a map object to host it, or elsewhere on the map to place an unoccupied center. Empty Orbits stay on the chart.</p>
  </template>
</template>

<script setup lang="ts">
/**
 * Owns cluster navigation and projects nested objects/Orbits into a selectable hierarchy.
 */
import { computed } from 'vue'
import {
  type JumpRoute,
  type LocalWorkspace,
  type Orbit,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { objectMark } from '../utils/catalogue-marks'

type ObjectRow = { kind: 'object'; object: SystemObject; depth: number }
type OrbitRow = { kind: 'orbit'; orbit: Orbit; host: SystemObject | null; childCount: number; depth: number }
type HierarchyRow = ObjectRow | OrbitRow

const props = defineProps<{
  mode: 'cluster' | 'system'
  workspace: LocalWorkspace
  selectedSystemId: string | null
  selectedObjectId: string | null
  selectedOrbitId: string | null
  selectedRouteId: string | null
  chartNamesEditing: boolean
  saving: boolean
  formError: string
  routeSummary: (route: JumpRoute) => string
}>()

const emit = defineEmits<{
  'select-system': [systemId: string]
  'delete-system': [systemId: string]
  'select-object': [objectId: string]
  'select-orbit': [orbitId: string]
  'select-route': [routeId: string]
  'submit-names': []
  'edit-chart-names': []
  'cancel-chart-names': []
  'show-cluster': []
}>()

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })

const selectedSystem = computed(() =>
  props.workspace.cluster.systems.find(system => system.id === props.selectedSystemId),
)

/**
 * Flattens unoccupied Orbits and system-level objects into depth-first rows of their nested children.
 * Orbit siblings are ordered by their stored order; root objects retain system.objects order.
 * Expects the acyclic host/placement relationships enforced by workspace validation.
 * @param system Current selected system, if any.
 * @returns Display rows with host, child-count, and indentation metadata; empty when no system is selected.
 */
function buildHierarchy(system: StarSystem | undefined): HierarchyRow[] {
  if (!system) return []

  const rows: HierarchyRow[] = []
  const orbitsByHost = new Map<string | null, Orbit[]>()
  const objectsByOrbit = new Map<string, SystemObject[]>()
  for (const orbit of system.orbits) {
    const hosted = orbitsByHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    orbitsByHost.set(orbit.hostId, hosted)
  }
  for (const object of system.objects) {
    if (object.placement.kind === 'orbit') {
      const children = objectsByOrbit.get(object.placement.orbitId) ?? []
      children.push(object)
      objectsByOrbit.set(object.placement.orbitId, children)
    }
  }

  function addOrbitBranch(orbit: Orbit, host: SystemObject | null, depth: number): void {
    const children = objectsByOrbit.get(orbit.id) ?? []
    rows.push({ kind: 'orbit', orbit, host, childCount: children.length, depth })
    for (const child of children) addObjectBranch(child, depth + 1)
  }

  function addObjectBranch(object: SystemObject, depth: number): void {
    rows.push({ kind: 'object', object, depth })
    const hostedOrbits = orbitsByHost.get(object.id) ?? []
    hostedOrbits.sort((left, right) => left.order - right.order)
    for (const orbit of hostedOrbits) addOrbitBranch(orbit, object, depth + 1)
  }

  const unhostedOrbits = orbitsByHost.get(null) ?? []
  unhostedOrbits.sort((left, right) => left.order - right.order)
  for (const orbit of unhostedOrbits) addOrbitBranch(orbit, null, 0)
  for (const object of system.objects) {
    if (object.placement.kind === 'system') addObjectBranch(object, 0)
  }
  return rows
}

const hierarchyRows = computed(() => buildHierarchy(selectedSystem.value))
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
