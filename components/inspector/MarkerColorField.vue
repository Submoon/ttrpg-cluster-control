<template>
  <div class="grid min-w-0 gap-2">
    <UPopover
      :portal="'#workspace-inspector-panel'"
      :content="{
        side: 'bottom',
        align: 'start',
        sideOffset: 8,
        collisionPadding: 8,
      }"
      :ui="{ content: 'max-h-[var(--reka-popover-content-available-height,100dvh)] max-w-[calc(100vw-1rem)] overflow-y-auto p-3' }"
    >
      <UButton
        :id="props.triggerId"
        class="workspace-control w-full justify-between"
        color="neutral"
        variant="outline"
        size="sm"
        type="button"
        trailing-icon="i-lucide-chevron-down"
        :ui="{ trailingIcon: 'ml-auto' }"
        v-bind="triggerAriaAttrs"
        :disabled="props.disabled"
        :aria-label="`Marker color: ${caption}`"
      >
        <template #leading>
          <span
            class="size-3 shrink-0 rounded-full border border-[var(--line)]"
            :style="{ backgroundColor: swatchColor }"
            aria-hidden="true"
          />
        </template>
        <span class="font-mono">{{ caption }}</span>
      </UButton>

      <template #content="{ close }">
        <div class="marker-color-chooser grid min-w-0 gap-3" role="group" aria-label="Choose marker color">
          <UColorPicker
            :key="pickerRevision"
            :model-value="pickerColor"
            format="hex"
            size="sm"
            :disabled="props.disabled"
            @update:model-value="updateFromPicker"
          />
          <div class="grid min-w-0 gap-3">
            <UFormField label="Hex color" :error="props.error">
              <UInput
                :id="props.hexInputId"
                :model-value="hexInput"
                class="w-full"
                autocomplete="off"
                maxlength="32"
                spellcheck="false"
                :disabled="props.disabled"
                @update:model-value="updateFromHex"
              />
            </UFormField>
            <UButton
              v-if="props.modelValue !== null"
              class="workspace-control justify-self-start"
              color="neutral"
              variant="outline"
              size="sm"
              type="button"
              :disabled="props.disabled"
              @click="resetToDefault(close)"
            >
              Use default color
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isMarkerColor } from '../../domain/workspace'

const props = defineProps<{
  modelValue: string | null
  defaultColor: string
  triggerId: string
  hexInputId: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { ariaAttrs: triggerAriaAttrs } = useFormField({ id: props.triggerId })
const hexInput = ref(props.modelValue ?? props.defaultColor)
const pickerColor = ref(isMarkerColor(props.modelValue) ? props.modelValue : props.defaultColor)
const pickerRevision = ref(0)
const swatchColor = computed(() => isMarkerColor(props.modelValue) ? props.modelValue : props.defaultColor)
const caption = computed(() => {
  if (props.modelValue === null) return 'Default'
  return isMarkerColor(props.modelValue) ? props.modelValue : 'Invalid hex'
})

watch(() => [props.modelValue, props.defaultColor] as const, ([value, defaultColor]) => {
  const nextHexInput = value ?? defaultColor
  const nextPickerColor = isMarkerColor(value) ? value : defaultColor
  const pickerChanged = pickerColor.value !== nextPickerColor
  hexInput.value = nextHexInput
  pickerColor.value = nextPickerColor
  if (pickerChanged) pickerRevision.value += 1
})

function updateFromPicker(value: string | undefined): void {
  if (value === undefined || !isMarkerColor(value)) return
  hexInput.value = value
  pickerColor.value = value
  emit('update:modelValue', value)
}

function updateFromHex(value: string | number | undefined): void {
  const color = String(value ?? '')
  hexInput.value = color
  pickerColor.value = isMarkerColor(color) ? color : props.defaultColor
  pickerRevision.value += 1
  emit('update:modelValue', color)
}

function resetToDefault(close: () => void): void {
  hexInput.value = props.defaultColor
  pickerColor.value = props.defaultColor
  pickerRevision.value += 1
  emit('update:modelValue', null)
  close()
}
</script>

<style scoped>
@media (min-width: 600px) and (max-height: 500px) {
  .marker-color-chooser {
    grid-template-columns: auto 11rem;
    align-items: start;
  }
}
</style>
