<template>
  <aside class="b-hierarchy-panel" aria-label="Map hierarchy">
    <header class="b-hierarchy-heading">
      <div>
        <small>WORKSPACE TREE</small>
        <h2>{{ workspace.cluster.name }}</h2>
      </div>
      <button type="button" aria-label="Close map hierarchy" @click="emit('close')">×</button>
    </header>

    <button
      class="hierarchy-cluster-row"
      :class="{ current: activeView === 'cluster' }"
      type="button"
      :aria-current="activeView === 'cluster' ? 'page' : undefined"
      @click="emit('back-to-cluster')"
    >
      <span class="hierarchy-icon" aria-hidden="true">⌘</span>
      <span><strong>{{ workspace.cluster.name }}</strong><small>Jump Cluster</small></span>
    </button>

    <section class="hierarchy-section">
      <h3>STAR SYSTEMS <span>{{ workspace.cluster.systems.length }}</span></h3>
      <button
        v-for="system in workspace.cluster.systems"
        :key="system.id"
        class="hierarchy-system-row"
        :class="{ current: activeView === 'system' && system.id === activeSystemId }"
        type="button"
        :aria-current="activeView === 'system' && system.id === activeSystemId ? 'page' : undefined"
        @click="emit('open-system', system.id)"
      >
        <span class="hierarchy-icon" aria-hidden="true">✦</span>
        <span><strong>{{ system.name }}</strong><small>{{ system.objects.length }} objects · {{ system.orbits.length }} Orbits</small></span>
      </button>
    </section>

    <section v-if="activeView === 'system' && selectedSystem" class="hierarchy-section hierarchy-entities">
      <h3>OBJECTS &amp; ORBITS <span>{{ rows.length }}</span></h3>
      <p v-if="rows.length === 0" class="hierarchy-empty">This system has no map objects or Orbits.</p>
      <button
        v-for="row in rows"
        :key="row.kind === 'object' ? row.object.id : row.orbit.id"
        class="hierarchy-entity-row"
        :class="{ current: isCurrent(row) }"
        :style="{ '--tree-depth': row.depth }"
        type="button"
        :aria-current="isCurrent(row) ? 'true' : undefined"
        :aria-label="row.kind === 'object' ? `Select ${row.object.locationKey}, ${row.object.name}` : `Select Orbit ${row.orbit.order} around ${row.host?.name ?? 'unoccupied center'}`"
        @click="selectRow(row)"
      >
        <span class="hierarchy-tree-branch" aria-hidden="true"></span>
        <span v-if="row.kind === 'object'" class="hierarchy-key">{{ row.object.locationKey }}</span>
        <span v-else class="hierarchy-orbit-mark" aria-hidden="true">◌</span>
        <span class="hierarchy-object-mark" aria-hidden="true">{{ row.kind === 'object' ? objectMark(row.object) : '' }}</span>
        <span class="hierarchy-entity-copy">
          <strong>{{ row.kind === 'object' ? row.object.name : `Orbit ${row.orbit.order}` }}</strong>
          <small>{{ row.kind === 'object' ? `${row.object.family} / ${row.object.subtype}` : `${row.host?.name ?? 'Unoccupied center'} · ${row.childCount} objects` }}</small>
        </span>
      </button>
    </section>

    <section v-else-if="activeView === 'cluster'" class="hierarchy-section hierarchy-entities">
      <h3>JUMP ROUTES <span>{{ workspace.cluster.routes.length }}</span></h3>
      <button
        v-for="route in workspace.cluster.routes"
        :key="route.id"
        class="hierarchy-entity-row route-tree-row"
        :class="{ current: selection.kind === 'route' && selection.id === route.id }"
        type="button"
        :aria-current="selection.kind === 'route' && selection.id === route.id ? 'true' : undefined"
        :aria-label="`Select Jump Level ${route.jumpLevel}, ${routeLabel(route)}`"
        @click="emit('select-route', route.id)"
      >
        <span class="hierarchy-route-mark" aria-hidden="true">↗</span>
        <span class="hierarchy-entity-copy"><strong>Jump Level {{ route.jumpLevel }}</strong><small>{{ routeLabel(route) }}</small></span>
      </button>
      <p v-if="workspace.cluster.routes.length === 0" class="hierarchy-empty">No Jump Routes on this cluster.</p>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JumpRoute, LocalWorkspace, StarSystem } from '../domain/workspace'
import { buildMapHierarchy, type MapHierarchyRow } from '../utils/map-hierarchy'
import { objectMark } from '../utils/catalogue-marks'

const props = defineProps<{
  workspace: LocalWorkspace
  activeView: 'cluster' | 'system'
  activeSystemId: string
  selection: { kind: string; id: string }
}>()
const emit = defineEmits<{
  close: []
  'back-to-cluster': []
  'open-system': [id: string]
  'select-route': [id: string]
  'select-object': [id: string]
  'select-orbit': [id: string]
}>()

const selectedSystem = computed<StarSystem | undefined>(() =>
  props.workspace.cluster.systems.find(system => system.id === props.activeSystemId),
)
const rows = computed(() => buildMapHierarchy(selectedSystem.value))

function isCurrent(row: MapHierarchyRow): boolean {
  return row.kind === 'object'
    ? props.selection.kind === 'object' && props.selection.id === row.object.id
    : props.selection.kind === 'orbit' && props.selection.id === row.orbit.id
}

function selectRow(row: MapHierarchyRow): void {
  if (row.kind === 'object') emit('select-object', row.object.id)
  else emit('select-orbit', row.orbit.id)
}

function routeLabel(route: JumpRoute): string {
  const pointName = (pointId: string | null) => {
    if (!pointId) return route.unresolvedExit
    for (const system of props.workspace.cluster.systems) {
      const point = system.objects.find(object => object.id === pointId)
      if (point) return `${system.name} · ${point.locationKey}`
    }
    return 'Unknown Jump Point'
  }
  return `${pointName(route.fromPointId)} → ${pointName(route.toPointId)}`
}
</script>

<style scoped>
.b-hierarchy-panel { position: absolute; z-index: 7; top: 5.3rem; bottom: 3.4rem; left: 5.5rem; display: flex; width: min(22rem, calc(100% - 6.5rem)); min-width: 17rem; flex-direction: column; overflow: auto; border: 1px solid var(--proto-line); background: color-mix(in srgb, var(--proto-surface) 96%, transparent); color: var(--proto-ink); box-shadow: 0 1rem 3rem rgba(0,0,0,.34); backdrop-filter: blur(20px); }
.b-hierarchy-heading { position: sticky; z-index: 1; top: 0; display: flex; justify-content: space-between; gap: .6rem; padding: .9rem; border-bottom: 1px solid var(--proto-line); background: var(--proto-surface); }
.b-hierarchy-heading small, .hierarchy-section h3 { color: var(--proto-muted); font-size: .48rem; font-weight: 700; letter-spacing: .13em; }
.b-hierarchy-heading h2 { margin: .25rem 0 0; font: 500 1.1rem var(--proto-display-font); }
.b-hierarchy-heading button { width: 2.2rem; min-height: 2.2rem; border: 1px solid var(--proto-line); background: var(--proto-soft); color: var(--proto-ink); font-size: 1.15rem; cursor: pointer; }
.hierarchy-cluster-row, .hierarchy-system-row, .hierarchy-entity-row { display: flex; width: 100%; align-items: center; gap: .55rem; min-height: 2.9rem; border: 1px solid transparent; padding: .4rem .65rem; background: transparent; color: var(--proto-ink); text-align: left; cursor: pointer; }
.hierarchy-cluster-row { border-bottom-color: var(--proto-line); }
.hierarchy-cluster-row:hover, .hierarchy-system-row:hover, .hierarchy-entity-row:hover { border-color: var(--proto-line); background: var(--proto-soft); }
.hierarchy-cluster-row.current, .hierarchy-system-row.current, .hierarchy-entity-row.current { border-color: color-mix(in srgb, var(--proto-accent) 50%, var(--proto-line)); background: var(--proto-soft); }
.hierarchy-icon { display: grid; width: 1.65rem; flex: 0 0 auto; place-items: center; color: var(--proto-accent); font-size: .9rem; }
.hierarchy-cluster-row > span:last-child, .hierarchy-system-row > span:last-child { display: grid; min-width: 0; gap: .16rem; }
.hierarchy-cluster-row strong, .hierarchy-system-row strong, .hierarchy-entity-row strong { overflow: hidden; font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }
.hierarchy-cluster-row small, .hierarchy-system-row small, .hierarchy-entity-row small { overflow: hidden; color: var(--proto-muted); font-size: .52rem; text-overflow: ellipsis; white-space: nowrap; }
.hierarchy-section { display: grid; gap: .15rem; padding: .75rem .5rem .35rem; }
.hierarchy-section h3 { display: flex; justify-content: space-between; margin: 0 0 .2rem; padding: 0 .2rem; }
.hierarchy-section h3 span { color: var(--proto-accent); }
.hierarchy-entities { border-top: 1px solid var(--proto-line); margin-top: .45rem; padding-top: .8rem; }
.hierarchy-entity-row { min-width: 0; padding-left: calc(.3rem + var(--tree-depth, 0) * .9rem); }
.hierarchy-tree-branch { align-self: stretch; width: 1px; flex: 0 0 1px; background: color-mix(in srgb, var(--proto-accent) 38%, transparent); }
.hierarchy-key { flex: 0 0 auto; color: var(--proto-accent); font: .49rem ui-monospace, Consolas, monospace; }
.hierarchy-orbit-mark, .hierarchy-route-mark { width: 1.25rem; flex: 0 0 auto; color: var(--proto-accent); font-size: .9rem; text-align: center; }
.hierarchy-object-mark { width: 1rem; flex: 0 0 auto; color: var(--proto-ink); font-size: .8rem; text-align: center; }
.hierarchy-entity-copy { display: grid; min-width: 0; gap: .12rem; }
.hierarchy-empty { margin: .3rem; color: var(--proto-muted); font-size: .64rem; line-height: 1.5; }
.route-tree-row { padding-left: .65rem; }
.b-hierarchy-panel :focus-visible { outline: 2px solid var(--proto-accent); outline-offset: -2px; }
@media (max-width: 760px) {
  .b-hierarchy-panel { top: 3.3rem; right: .4rem; bottom: 8rem; left: .4rem; width: auto; min-width: 0; max-width: none; }
}
@media (max-height: 600px) and (min-width: 761px) {
  .b-hierarchy-panel { top: 5.2rem; bottom: 7.6rem; }
}
</style>
