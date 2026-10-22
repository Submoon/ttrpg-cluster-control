<template>
  <section class="object-palette" role="region" aria-label="Object palette">
    <div class="object-palette-heading flex items-center justify-between gap-2">
      <span class="section-kicker">ADD OBJECT</span>
      <span class="object-palette-hint">Choose a category, then add or drag an object.</span>
    </div>
    <div class="object-palette-categories" role="group" aria-label="Object categories">
      <UButton
        v-for="group in groups"
        :key="group.family"
        class="object-palette-category-button"
        as="button"
        type="button"
        size="sm"
        color="neutral"
        :variant="activeFamily === group.family ? 'soft' : 'outline'"
        :aria-pressed="activeFamily === group.family"
        :title="`Show ${group.label} objects`"
        @click="activeFamily = group.family"
      >
        <span v-if="activeFamily === group.family" aria-hidden="true">✓</span>
        {{ group.label }}
      </UButton>
    </div>
    <div class="object-palette-controls">
      <div class="object-palette-items" role="group" :aria-label="activeGroup.label">
        <UButton
          v-for="type in activeGroup.types"
          :key="type.value"
          class="object-palette-button"
          as="button"
          type="button"
          size="sm"
          color="neutral"
          variant="outline"
          draggable="true"
          :disabled="props.saving"
          :aria-label="`Add ${type.label}`"
          :title="`Drag ${type.label} onto the map, or activate to add it`"
          @dragstart="startObjectDrag($event, type.value)"
          @click="emit('add-object', type.value)"
        >
          <span class="object-mark" aria-hidden="true">{{ catalogueMarks[type.value] }}</span>
          <span>{{ type.label }}</span>
        </UButton>
      </div>
      <UButton
        class="object-palette-button object-palette-orbit"
        as="button"
        type="button"
        size="sm"
        color="primary"
        variant="outline"
        aria-label="Add orbit"
        draggable="true"
        :disabled="props.saving"
        title="Drag Orbit onto an object to host it, or onto the map for an unoccupied center"
        @dragstart="startOrbitDrag"
        @click="emit('add-orbit')"
      >
        <span aria-hidden="true">+</span> Add Orbit
      </UButton>
    </div>
    <span v-if="props.selectedOrbit" class="placement-hint">
      New objects go in Orbit {{ props.selectedOrbit.order }}
    </span>
  </section>
</template>

<script setup lang="ts">
// Emits catalogue add/drag intents; the editor resolves placement, while native buttons preserve click and keyboard paths.
import { computed, ref } from 'vue'
import {
  catalogueTypes,
  type CatalogueSubtype,
  type ObjectFamily,
  type Orbit,
} from '../domain/workspace'
import { catalogueMarks } from '../utils/catalogue-marks'

const props = defineProps<{
  activeFamily?: ObjectFamily
  selectedOrbit?: Orbit | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:activeFamily': [family: ObjectFamily]
  'add-object': [subtype: CatalogueSubtype]
  'add-orbit': []
}>()

const groups = ([
  { family: 'CelestialBody', label: 'Celestial bodies' },
  { family: 'SmallBody/Field', label: 'Small bodies and fields' },
  { family: 'Installation', label: 'Installations' },
  { family: 'Vessel', label: 'Vessels' },
  { family: 'JumpPoint', label: 'Jump Points' },
  { family: 'Phenomenon', label: 'Phenomena' },
  { family: 'Other', label: 'Other' },
] satisfies Array<{ family: ObjectFamily; label: string }>).map(group => ({
  ...group,
  types: catalogueTypes.filter(type => type.family === group.family),
}))

const localActiveFamily = ref(groups[0]!.family)
const activeFamily = computed({
  get: () => props.activeFamily ?? localActiveFamily.value,
  set: (family: ObjectFamily) => {
    if (props.activeFamily === undefined) localActiveFamily.value = family
    emit('update:activeFamily', family)
  },
})
const activeGroup = computed(() => groups.find(group => group.family === activeFamily.value)!)

/**
 * Publishes a catalogue key in the native drag payload and keeps the pointer beside the visible mark.
 * @param event Native dragstart event from the source palette button.
 * @param subtype Catalogue key resolved by the system-map renderer on drop.
 * @throws If the source is not a button with a rendered object mark.
 */
function startObjectDrag(event: DragEvent, subtype: CatalogueSubtype): void {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return

  dataTransfer.effectAllowed = 'copy'
  // SystemMap consumes this catalogue subtype token when resolving a dropped object.
  dataTransfer.setData('application/x-ttrpg-cluster-control-map-object', subtype)
  dataTransfer.setData('text/plain', subtype)
  const source = event.currentTarget
  if (!(source instanceof HTMLElement)) throw new Error('Object drag must start from a palette button.')
  const mark = source.querySelector<HTMLElement>('.object-mark')
  if (!mark) throw new Error('Object palette button is missing its map mark.')

  const bounds = mark.getBoundingClientRect()
  // Keep the pointer beside the mark so the drag preview does not hide the drop target.
  dataTransfer.setDragImage(mark, bounds.width + 8, bounds.height / 2)
}

/**
 * Marks a native drag as an Orbit intent; the renderer later resolves its map point and optional host.
 * @param event Native dragstart event from the Add Orbit button.
 */
function startOrbitDrag(event: DragEvent): void {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return

  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData('application/x-ttrpg-cluster-control-map-orbit', 'true')
  dataTransfer.setData('text/plain', 'Orbit')
}
</script>

<style>
.object-palette {
  display: grid;
  gap: 0.35rem;
  margin-block: 0.8rem;
  border: 1px solid var(--line-soft);
  border-radius: 3px;
  padding: 0.45rem;
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
}

.object-palette-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.8rem;
  cursor: grab;
}

.object-palette-category-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  cursor: pointer;
}

.object-palette-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.object-palette-button:active {
  cursor: grabbing;
}

.object-palette-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.object-palette-hint,
.placement-hint {
  color: var(--ui-text-toned);
  font-size: 0.75rem;
  line-height: 1.35;
}

.placement-hint {
  font-size: 0.75rem;
}

.map-workspace-shell .system-map-tools .object-palette {
  display: grid;
  min-width: 0;
  width: fit-content;
  max-width: 100%;
  justify-self: center;
  gap: 0.35rem;
  margin: 0;
  border-color: var(--line);
  padding: 0.4rem;
  background: var(--ui-bg-elevated);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.28);
}

.map-workspace-shell .system-map-tools .object-palette {
  pointer-events: none;
}

.map-workspace-shell .system-map-tools .object-palette-button {
  pointer-events: auto;
}

.map-workspace-shell .system-map-tools .object-palette-category-button {
  cursor: pointer;
  pointer-events: auto;
}

.map-workspace-shell .system-map-tools .object-palette-category-button[aria-pressed="true"] {
  font-weight: 700;
}

.map-workspace-shell .object-palette-heading {
  min-width: 0;
}

.map-workspace-shell .system-map-tools .object-palette-heading .section-kicker {
  font-size: 0.875rem;
}

.map-workspace-shell .object-palette-hint {
  white-space: nowrap;
}

.map-workspace-shell .object-palette-categories {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
}

.map-workspace-shell .object-palette-controls {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: center;
  gap: 0.35rem;
}

.map-workspace-shell .object-palette-items {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.map-workspace-shell .object-palette-orbit {
  flex: 0 0 auto;
  align-self: flex-end;
  margin-bottom: 0.22rem;
  white-space: nowrap;
}

.map-workspace-shell .map-tools .placement-hint {
  justify-self: end;
  padding: 0.15rem 0.3rem;
}
</style>
