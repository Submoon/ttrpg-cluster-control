<template>
  <template v-if="selectedOrbit">
    <span class="section-kicker">SYSTEM STRUCTURE / SELECTED</span>
    <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">UNKEYED PLACEMENT</span>
    <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Orbit {{ orbitEditing ? orbitOrderDraft : selectedOrbit.order }}</h2>
    <p class="inspector-intro mb-[1em]">
      <template v-if="selectedOrbit.hostId === null">Centered on an unoccupied location.</template>
      <template v-else>Hosted by {{ selectedSystem?.objects.find(object => object.id === selectedOrbit?.hostId)?.name ?? 'unknown object' }}.</template>
      Orbit rings show structure, not measured distance.
    </p>
    <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
      <span>Objects placed</span>
      <strong>{{ selectedSystem?.objects.filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === selectedOrbit?.id).length ?? 0 }}</strong>
    </div>
    <div v-if="orbitEditing" class="orbit-edit-fields my-4 grid gap-3">
      <label>
        Horizontal radius
        <input
          v-model="orbitHorizontalRadiusDraft"
          type="number"
          :min="selectedOrbitMinimumRadius"
          step="1"
          required
        >
      </label>
      <label>
        Vertical radius
        <input
          v-model="orbitVerticalRadiusDraft"
          type="number"
          :min="selectedOrbitMinimumRadius"
          step="1"
          required
        >
      </label>
      <div v-if="selectedOrbit.hostId === null" class="grid grid-cols-2 gap-2">
        <label>
          Center X
          <input
            v-model="orbitCenterXDraft"
            type="number"
            step="0.01"
            required
          >
        </label>
        <label>
          Center Y
          <input
            v-model="orbitCenterYDraft"
            type="number"
            step="0.01"
            required
          >
        </label>
      </div>
    </div>
    <div v-if="orbitEditing" class="orbit-actions flex gap-2" aria-label="Reorder Orbit">
      <button
        class="secondary-button"
        type="button"
        aria-label="Move orbit up"
        :disabled="!canMoveSelectedOrbit(-1) || props.saving"
        @click="reorderSelectedOrbit(-1)"
      >
        Move up
      </button>
      <button
        class="secondary-button"
        type="button"
        aria-label="Move orbit down"
        :disabled="!canMoveSelectedOrbit(1) || props.saving"
        @click="reorderSelectedOrbit(1)"
      >
        Move down
      </button>
    </div>
    <p v-if="orbitDraftError || props.editorError" class="feedback m-0 error-text" role="alert">
      {{ orbitDraftError || props.editorError }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="!orbitEditing"
        class="primary-button"
        type="button"
        aria-label="Edit Orbit"
        :disabled="props.saving"
        @click="emit('request-orbit-edit')"
      >
        Edit
      </button>
      <button
        v-if="!orbitEditing && selectedOrbit.hostId !== null"
        class="secondary-button"
        type="button"
        aria-label="Detach Orbit"
        :disabled="props.saving"
        @click="emit('detach-orbit')"
      >
        Detach
      </button>
      <button v-if="orbitEditing" class="primary-button" type="button" aria-label="Save Orbit" :disabled="props.saving" @click="saveOrbitEdit">
        Save
      </button>
      <button v-if="orbitEditing" class="quiet-button" type="button" aria-label="Cancel Orbit edits" @click="cancelOrbitEdit()">
        Cancel
      </button>
    </div>
    <button
      v-if="!orbitEditing"
      class="quiet-button mt-4"
      type="button"
      :aria-label="selectedOrbitDeleteLabel"
      :disabled="props.saving"
      @click="emit('delete-orbit')"
    >
      Delete Orbit and contents
    </button>
    <p class="inspector-footnote mt-4 mb-0 border-t border-[var(--line-soft)] pt-3">Orbits are unkeyed and may be nested. Detach a hosted Orbit to move its center, then drag that center handle. Drag the axis handles to resize, the ring to resize uniformly, or the outer handle or Ctrl+wheel over the ring to rotate.</p>
  </template>
</template>

<script setup lang="ts">
/**
 * Owns local Orbit-edit drafts; pending or rejected saves stay open until success is acknowledged or cancelled.
 */
import { computed, ref, watch } from 'vue'
import {
  defaultOrbitRadius,
  minimumOrbitRadius,
  type LocalWorkspace,
  type Orbit,
  type Point,
  type StarSystem,
} from '../../domain/workspace'
import type { OrbitEditRequest, OrbitInspectorHandle } from './contracts'

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedOrbit?: Orbit
  saving: boolean
  editorError: string
}>()

const emit = defineEmits<{
  'request-orbit-edit': []
  'save-orbit': [request: OrbitEditRequest]
  'detach-orbit': []
  'delete-orbit': []
  'clear-error': []
}>()

const selectedSystem = computed(() => props.selectedSystem)
const selectedOrbit = computed(() => props.selectedOrbit)
const orbitEditing = ref(false)
const orbitOrderDraft = ref('')
const orbitHorizontalRadiusDraft = ref('')
const orbitVerticalRadiusDraft = ref('')
const orbitCenterXDraft = ref('')
const orbitCenterYDraft = ref('')
const orbitDraftError = ref('')
const selectedOrbitMinimumRadius = computed(() => {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  return system && orbit ? minimumOrbitRadius(system, orbit) : 16
})
const selectedOrbitDeleteLabel = computed(() => {
  const orbit = selectedOrbit.value
  if (!orbit) return 'Delete Orbit'
  const hostName = orbit.hostId === null
    ? 'unoccupied center'
    : selectedSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Delete Orbit ${orbit.order} around ${hostName}`
})

/**
 * Loads Orbit order, effective saved/default radii, and center strings for unoccupied Orbits.
 * @param orbit Selected Orbit, or undefined when no draft can be synchronized.
 */
function syncOrbitDraft(orbit: Orbit | undefined): void {
  if (!orbit) return
  const defaultRadius = selectedSystem.value ? defaultOrbitRadius(selectedSystem.value, orbit) : 0
  const radii = props.workspace.layout.orbitRadii[orbit.id]
    ?? { horizontal: defaultRadius, vertical: defaultRadius }
  orbitOrderDraft.value = String(orbit.order)
  orbitHorizontalRadiusDraft.value = String(radii.horizontal)
  orbitVerticalRadiusDraft.value = String(radii.vertical)
  orbitCenterXDraft.value = orbit.hostId === null ? String(orbit.center.x) : ''
  orbitCenterYDraft.value = orbit.hostId === null ? String(orbit.center.y) : ''
}

/** Starts a form draft from the selected Orbit's committed geometry. */
function startOrbitEdit(): void {
  if (!selectedOrbit.value) return
  syncOrbitDraft(selectedOrbit.value)
  orbitEditing.value = true
  orbitDraftError.value = ''
  emit('clear-error')
}

/**
 * Discards the form draft and reloads the current Orbit props.
 * @param clearError Whether to ask the parent to clear its shared editor error.
 */
function cancelOrbitEdit(clearError = true): void {
  syncOrbitDraft(selectedOrbit.value)
  orbitEditing.value = false
  orbitDraftError.value = ''
  if (clearError) emit('clear-error')
}

/**
 * Checks whether one sibling-order step remains within this host group's current range.
 * @param direction -1 for an earlier order or 1 for a later order.
 * @returns False when no Orbit is selected or the draft/current edge has no neighbor.
 */
function canMoveSelectedOrbit(direction: -1 | 1): boolean {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (!system || !orbit) return false
  const siblingCount = system.orbits.filter(candidate => candidate.hostId === orbit.hostId).length
  const currentOrder = orbitEditing.value ? Number(orbitOrderDraft.value) : orbit.order
  return Number.isSafeInteger(currentOrder)
    && currentOrder + direction >= 1
    && currentOrder + direction <= siblingCount
}

/** Moves the local order draft one available sibling slot without submitting it. */
function reorderSelectedOrbit(direction: -1 | 1): void {
  if (!orbitEditing.value || !canMoveSelectedOrbit(direction)) return
  orbitOrderDraft.value = String(Number(orbitOrderDraft.value) + direction)
}

/**
 * Validates sibling order, rounded scene-unit radii, and finite normalized center before emitting a save request.
 * Only unoccupied Orbits submit a center; the parent acknowledgement closes this draft after commit success.
 */
function saveOrbitEdit(): void {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  const targetOrder = Number(orbitOrderDraft.value)
  if (!system || !orbit) return
  const siblingCount = system.orbits.filter(candidate => candidate.hostId === orbit.hostId).length
  if (!Number.isSafeInteger(targetOrder) || targetOrder < 1 || targetOrder > siblingCount) {
    orbitDraftError.value = 'Choose a valid Orbit order.'
    return
  }

  const minimum = minimumOrbitRadius(system, orbit)
  const horizontal = Math.round(Number(orbitHorizontalRadiusDraft.value))
  const vertical = Math.round(Number(orbitVerticalRadiusDraft.value))
  if (
    !Number.isFinite(horizontal)
    || !Number.isFinite(vertical)
    || horizontal < minimum
    || vertical < minimum
  ) {
    orbitDraftError.value = `Both Orbit radii must be at least ${minimum} map units.`
    return
  }

  let center: Point | undefined
  if (orbit.hostId === null) {
    const x = Number(orbitCenterXDraft.value)
    const y = Number(orbitCenterYDraft.value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      orbitDraftError.value = 'Orbit center coordinates must be finite numbers.'
      return
    }
    center = { x, y }
  }

  orbitDraftError.value = ''
  emit('save-orbit', {
    orbitId: orbit.id,
    targetOrder,
    radii: { horizontal, vertical },
    center,
  })
}

watch(() => [selectedOrbit.value, props.workspace.layout.orbitRadii] as const, () => {
  if (!orbitEditing.value) syncOrbitDraft(selectedOrbit.value)
}, { immediate: true })

/** Parent invokes orbitSaveSucceeded only after the associated workspace commit succeeds. */
const inspectorHandle = {
  hasUnsavedEdits: () => orbitEditing.value,
  cancelEdits: cancelOrbitEdit,
  startOrbitEdit,
  orbitSaveSucceeded: () => {
    orbitEditing.value = false
    syncOrbitDraft(selectedOrbit.value)
    orbitDraftError.value = ''
  },
} satisfies OrbitInspectorHandle

defineExpose(inspectorHandle)
</script>
