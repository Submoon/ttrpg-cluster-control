<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  canPlaceObjectInOrbit,
  initialSystemPlacement,
  isCustomFieldApplicableToObject,
  type LocalWorkspace,
  type StarSystem,
  type SystemObject,
  type SystemObjectChanges,
} from '../../domain/workspace'
import { objectMark } from '../../utils/catalogue-marks'
import type { MapObjectInspectorHandle, MapObjectSaveRequest } from './contracts'

interface SystemObjectDraft {
  locationKey: string
  name: string
  description: string
  subtype: string
  placement: string
  x: string
  y: string
  atmosphere: string
  portClass: string
  customFieldValues: Record<string, string>
  jumpStationId: string
}

const props = defineProps<{
  workspace: LocalWorkspace
  selectedSystem?: StarSystem
  selectedObject?: SystemObject
  saving: boolean
  editorError: string
}>()

const emit = defineEmits<{
  'request-object-edit': []
  'save-object': [request: MapObjectSaveRequest]
  'delete-object': []
  'clear-error': []
}>()

const selectedSystem = computed(() => props.selectedSystem)
const selectedObject = computed(() => props.selectedObject)
const objectDraft = reactive<SystemObjectDraft>({
  locationKey: '',
  name: '',
  description: '',
  subtype: '',
  placement: 'system',
  x: '',
  y: '',
  atmosphere: '',
  portClass: '',
  customFieldValues: {},
  jumpStationId: '',
})
const objectEditSnapshot = ref<SystemObject | null>(null)
const objectEditing = computed(() =>
  objectEditSnapshot.value?.id === selectedObject.value?.id && !!selectedObject.value,
)
const objectError = ref('')
const applicableCustomFields = computed(() => {
  const object = selectedObject.value
  return object
    ? props.workspace.objectFieldSettings.customFields.filter(field =>
        isCustomFieldApplicableToObject(field, object),
      )
    : []
})
const physicalStations = computed(() =>
  selectedSystem.value?.objects.filter(object =>
    object.family === 'Installation' && object.subtype === 'station',
  ) ?? [],
)
const placeableOrbits = computed(() => {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object) return []

  return system.orbits
    .filter(orbit => canPlaceObjectInOrbit(system, object.id, orbit.id))
    .sort((left, right) => left.order - right.order)
})

function syncObjectDraft(object: SystemObject | undefined): void {
  objectDraft.locationKey = object?.locationKey ?? ''
  objectDraft.name = object?.name ?? ''
  objectDraft.description = object?.description ?? ''
  objectDraft.subtype = object?.subtype ?? ''
  objectDraft.placement = object?.placement.kind === 'orbit'
    ? `orbit:${object.placement.orbitId}`
    : 'system'
  objectDraft.x = object?.placement.kind === 'system' ? String(object.placement.x) : ''
  objectDraft.y = object?.placement.kind === 'system' ? String(object.placement.y) : ''
  objectDraft.atmosphere = object?.atmosphere ?? ''
  objectDraft.portClass = object?.portClass ?? ''
  objectDraft.customFieldValues = Object.fromEntries(
    Object.entries(object?.customFieldValues ?? {}).map(([fieldId, value]) => [fieldId, String(value)]),
  )
  for (const field of props.workspace.objectFieldSettings.customFields) {
    objectDraft.customFieldValues[field.id] ??= ''
  }
  objectDraft.jumpStationId = object?.jumpStationId ?? ''
}

function startObjectEdit(): void {
  if (!selectedObject.value) return
  syncObjectDraft(selectedObject.value)
  objectEditSnapshot.value = selectedObject.value
  objectError.value = ''
  emit('clear-error')
}

function cancelObjectEdit(clearError = true): void {
  objectEditSnapshot.value = null
  syncObjectDraft(selectedObject.value)
  objectError.value = ''
  if (clearError) emit('clear-error')
}

function saveObjectEdit(): void {
  const snapshot = objectEditSnapshot.value
  const object = selectedObject.value
  if (!snapshot || !object) return

  const changes: SystemObjectChanges = {}
  if (objectDraft.locationKey !== snapshot.locationKey) changes.locationKey = objectDraft.locationKey
  if (objectDraft.name !== snapshot.name) changes.name = objectDraft.name
  if (objectDraft.description !== snapshot.description) changes.description = objectDraft.description
  if (objectDraft.subtype !== snapshot.subtype) changes.subtype = objectDraft.subtype
  if (objectDraft.atmosphere !== (snapshot.atmosphere ?? '')) {
    changes.atmosphere = objectDraft.atmosphere || undefined
  }
  if (objectDraft.portClass !== (snapshot.portClass ?? '')) {
    changes.portClass = objectDraft.portClass || undefined
  }
  if (objectDraft.jumpStationId !== (snapshot.jumpStationId ?? '')) {
    changes.jumpStationId = objectDraft.jumpStationId || null
  }

  const snapshotPlacement = snapshot.placement.kind === 'orbit'
    ? `orbit:${snapshot.placement.orbitId}`
    : 'system'
  const draftX = String(objectDraft.x)
  const draftY = String(objectDraft.y)
  const systemPositionChanged = snapshot.placement.kind === 'system'
    && (
      draftX !== String(snapshot.placement.x)
      || draftY !== String(snapshot.placement.y)
    )
  if (objectDraft.placement !== snapshotPlacement || systemPositionChanged) {
    if (objectDraft.placement === 'system') {
      changes.placement = {
        kind: 'system',
        x: draftX.trim() ? Number(draftX) : Number.NaN,
        y: draftY.trim() ? Number(draftY) : Number.NaN,
      }
    } else if (objectDraft.placement.startsWith('orbit:')) {
      changes.placement = {
        kind: 'orbit',
        orbitId: objectDraft.placement.slice('orbit:'.length),
      }
    } else {
      objectError.value = 'Choose a valid map placement.'
      return
    }
  }

  const customFieldValues = { ...(object.customFieldValues ?? {}) }
  let customFieldValuesChanged = false
  for (const definition of props.workspace.objectFieldSettings.customFields) {
    const draftValue = objectDraft.customFieldValues[definition.id] ?? ''
    const savedValue = snapshot.customFieldValues?.[definition.id]
    if (draftValue === (savedValue === undefined ? '' : String(savedValue))) continue

    customFieldValuesChanged = true
    if (!draftValue) {
      delete customFieldValues[definition.id]
    } else if (definition.type === 'number') {
      const numberValue = Number(draftValue)
      if (!Number.isFinite(numberValue)) {
        objectError.value = `"${definition.name}" must be a finite number.`
        return
      }
      customFieldValues[definition.id] = numberValue
    } else if (definition.type === 'boolean') {
      if (draftValue !== 'true' && draftValue !== 'false') {
        objectError.value = `Choose a true or false value for "${definition.name}".`
        return
      }
      customFieldValues[definition.id] = draftValue === 'true'
    } else {
      customFieldValues[definition.id] = draftValue
    }
  }
  if (customFieldValuesChanged) {
    changes.customFieldValues = Object.keys(customFieldValues).length ? customFieldValues : undefined
  }

  if (!Object.keys(changes).length) {
    cancelObjectEdit()
    return
  }
  objectError.value = ''
  emit('save-object', { objectId: snapshot.id, changes })
}

function updateObjectPlacementDraft(): void {
  const system = selectedSystem.value
  if (!system || selectedObject.value?.placement.kind !== 'orbit' || objectDraft.placement !== 'system') return
  const placement = initialSystemPlacement(system)
  objectDraft.x = String(placement.x)
  objectDraft.y = String(placement.y)
}

watch(selectedObject, object => {
  if (objectEditSnapshot.value?.id !== object?.id) objectEditSnapshot.value = null
  if (!objectEditing.value) syncObjectDraft(object)
}, { immediate: true })
watch(() => props.workspace.objectFieldSettings, (settings) => {
  const fieldIds = new Set(settings.customFields.map(field => field.id))
  for (const field of settings.customFields) {
    if (!(field.id in objectDraft.customFieldValues)) {
      const value = selectedObject.value?.customFieldValues?.[field.id]
      objectDraft.customFieldValues[field.id] = value === undefined ? '' : String(value)
    }
  }
  for (const fieldId of Object.keys(objectDraft.customFieldValues)) {
    if (!fieldIds.has(fieldId)) delete objectDraft.customFieldValues[fieldId]
  }
}, { immediate: true })

const inspectorHandle = {
  hasUnsavedEdits: () => objectEditing.value,
  isEditingObject: (objectId: string) => objectEditSnapshot.value?.id === objectId,
  cancelEdits: cancelObjectEdit,
  startObjectEdit,
  objectSaveSucceeded: () => {
    objectEditSnapshot.value = null
    syncObjectDraft(selectedObject.value)
    objectError.value = ''
  },
} satisfies MapObjectInspectorHandle

defineExpose(inspectorHandle)
</script>

<template>
  <template v-if="selectedObject">
    <span class="section-kicker">MAP OBJECT / SELECTED</span>
    <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">{{ selectedObject.family }} / {{ selectedObject.subtype }}</span>
    <h2 class="object-title mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">
      <span class="object-mark object-mark-large" aria-hidden="true">{{ objectMark(selectedObject) }}</span>
      <span>{{ selectedObject.name }}</span>
    </h2>
    <p class="inspector-intro mb-[1em]">
      A stable map record. Edit its keyed description without leaving the current chart.
    </p>

    <form class="mt-4" @submit.prevent="saveObjectEdit">
      <fieldset class="field-stack m-0 grid gap-3 border-0 p-0" :disabled="!objectEditing || props.saving">
        <label v-if="selectedObject.family === 'Other'" :for="`object-type-${selectedObject.id}`">
          Type label
          <input
            :id="`object-type-${selectedObject.id}`"
            v-model="objectDraft.subtype"
            autocomplete="off"
            required
          >
        </label>
        <label :for="`object-key-${selectedObject.id}`">
          Location key
          <input
            :id="`object-key-${selectedObject.id}`"
            v-model="objectDraft.locationKey"
            autocomplete="off"
            required
          >
        </label>
        <label :for="`object-name-${selectedObject.id}`">
          Name
          <input
            :id="`object-name-${selectedObject.id}`"
            v-model="objectDraft.name"
            autocomplete="off"
            maxlength="80"
            required
          >
        </label>
        <label :for="`object-placement-${selectedObject.id}`">
          Placement
          <select
            :id="`object-placement-${selectedObject.id}`"
            v-model="objectDraft.placement"
            @change="updateObjectPlacementDraft"
          >
            <option value="system">System-level position</option>
            <optgroup v-if="placeableOrbits.length" label="Orbits">
              <option
                v-for="orbit in placeableOrbits"
                :key="orbit.id"
                :value="`orbit:${orbit.id}`"
              >
                Orbit {{ orbit.order }} around {{ orbit.hostId === null
                  ? 'unoccupied center'
                  : selectedSystem?.objects.find(object => object.id === orbit.hostId)?.name }}
              </option>
            </optgroup>
          </select>
        </label>
        <label v-if="selectedObject.family === 'JumpPoint'" :for="`jump-station-${selectedObject.id}`">
          Physical Jump Station
          <select
            :id="`jump-station-${selectedObject.id}`"
            v-model="objectDraft.jumpStationId"
          >
            <option value="">No physical station</option>
            <option v-for="station in physicalStations" :key="station.id" :value="station.id">
              {{ station.name }} ({{ station.locationKey }})
            </option>
          </select>
        </label>
        <p v-if="selectedObject.family === 'JumpPoint' && physicalStations.length === 0" class="empty-copy m-0">
          Add a separate Station object from the catalogue to record its physical location.
        </p>
        <label v-if="selectedObject.family === 'CelestialBody' && (selectedObject.subtype === 'planet' || selectedObject.subtype === 'moon')" :for="`object-atmosphere-${selectedObject.id}`">
          Atmosphere
          <select
            :id="`object-atmosphere-${selectedObject.id}`"
            aria-label="Atmosphere"
            v-model="objectDraft.atmosphere"
          >
            <option value="">Not set</option>
            <option
              v-for="option in props.workspace.objectFieldSettings.atmosphereOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>
        <label v-if="selectedObject.family === 'Installation'" :for="`object-port-class-${selectedObject.id}`">
          Port class
          <select
            :id="`object-port-class-${selectedObject.id}`"
            aria-label="Port class"
            v-model="objectDraft.portClass"
          >
            <option value="">Not set</option>
            <option
              v-for="option in props.workspace.objectFieldSettings.portClassOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>
        <template v-for="field in applicableCustomFields" :key="field.id">
          <label v-if="field.type === 'text'" :for="`custom-field-value-${field.id}`">
            {{ field.name }}
            <textarea
              :id="`custom-field-value-${field.id}`"
              :aria-label="field.name"
              v-model="objectDraft.customFieldValues[field.id]"
              rows="3"
            />
          </label>
          <label v-else-if="field.type === 'number'" :for="`custom-field-value-${field.id}`">
            {{ field.name }}
            <input
              :id="`custom-field-value-${field.id}`"
              :aria-label="field.name"
              v-model="objectDraft.customFieldValues[field.id]"
              type="number"
              step="any"
            >
          </label>
          <label v-else-if="field.type === 'boolean'" :for="`custom-field-value-${field.id}`">
            {{ field.name }}
            <select
              :id="`custom-field-value-${field.id}`"
              :aria-label="field.name"
              v-model="objectDraft.customFieldValues[field.id]"
            >
              <option value="">Not set</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label v-else-if="field.type === 'single-select'" :for="`custom-field-value-${field.id}`">
            {{ field.name }}
            <select
              :id="`custom-field-value-${field.id}`"
              :aria-label="field.name"
              v-model="objectDraft.customFieldValues[field.id]"
            >
              <option value="">Not set</option>
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </label>
        </template>
        <div v-if="objectDraft.placement === 'system'" class="coordinate-fields grid grid-cols-2 gap-[0.6rem]">
          <label :for="`object-x-${selectedObject.id}`">
            Schematic X
            <input
              :id="`object-x-${selectedObject.id}`"
              type="number"
              step="any"
              v-model="objectDraft.x"
              required
            >
          </label>
          <label :for="`object-y-${selectedObject.id}`">
            Schematic Y
            <input
              :id="`object-y-${selectedObject.id}`"
              type="number"
              step="any"
              v-model="objectDraft.y"
              required
            >
          </label>
        </div>
        <label :for="`object-description-${selectedObject.id}`">
          Description
          <textarea
            :id="`object-description-${selectedObject.id}`"
            rows="5"
            v-model="objectDraft.description"
          />
        </label>
      </fieldset>
      <p v-if="objectError || props.editorError" class="feedback mt-3 mb-0 error-text" role="alert">
        {{ objectError || props.editorError }}
      </p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button
          v-if="!objectEditing"
          class="primary-button"
          type="button"
          aria-label="Edit map object"
          :disabled="props.saving"
          @click="emit('request-object-edit')"
        >
          Edit
        </button>
        <button v-else class="primary-button" type="submit" aria-label="Save map object" :disabled="props.saving">
          Save
        </button>
        <button v-if="objectEditing" class="quiet-button" type="button" aria-label="Cancel map object edits" @click="cancelObjectEdit()">
          Cancel
        </button>
      </div>
    </form>
    <button
      v-if="!objectEditing"
      class="quiet-button mt-4"
      type="button"
      :aria-label="`Delete ${selectedObject.name}`"
      :disabled="props.saving"
      @click="emit('delete-object')"
    >
      Delete object
    </button>
    <p class="inspector-footnote mt-4 mb-0 border-t border-[var(--line-soft)] pt-3">Location keys are required and unique within this star system.</p>
  </template>
</template>
