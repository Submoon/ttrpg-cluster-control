import { computed, watch, type ComputedRef, type Ref } from 'vue'
import type { LocalWorkspace, PublicationMode, StarSystem } from '../domain/workspace'
import { useEditorUiStore } from '../stores/editor-ui'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import { publicationModes, publicationPresentation } from '../utils/publication-presentation'
import { createWardenObjectFilterMatcher, reconcileFieldConditions, wardenFieldFilterOptions } from '../utils/warden-map-filters'

export interface UseWardenMapFiltersOptions {
  workspace: Ref<LocalWorkspace | null>
  selectedSystem: ComputedRef<StarSystem | null | undefined>
  /** Announces that Fields or choices invalidated an active map filter. */
  onFiltersInvalidated?: () => void
}

const publicationFilterOptions = publicationModes.map(mode => ({
  value: mode,
  label: publicationPresentation(mode).label,
}))

/** Owns transient Warden filter criteria, their current-system projection, and Field reconciliation. */
export function useWardenMapFilters({ workspace, selectedSystem, onFiltersInvalidated }: UseWardenMapFiltersOptions) {
  const store = useEditorUiStore()

  const fieldOptions = computed<FieldFilterOption[]>(() =>
    workspace.value ? wardenFieldFilterOptions(workspace.value) : [],
  )
  const fieldOptionSignature = computed(() => JSON.stringify(fieldOptions.value))
  const selectedPublicationModes = computed<PublicationMode[]>({
    get: () => store.selectedMapPublicationModes,
    set: values => setPublicationModes(values),
  })
  const fieldConditions = computed<FieldCondition[]>({
    get: () => store.selectedMapFieldConditions,
    set: values => setFieldConditions(values),
  })
  const activeCriterionCount = computed(() => Number(store.selectedMapObjectTypes.length > 0)
    + Number(store.selectedMapPublicationModes.length > 0)
    + store.selectedMapFieldConditions.length)
  const compiledMatcher = computed(() => {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || store.activeView !== 'system') return null
    return createWardenObjectFilterMatcher(
      currentWorkspace,
      store.selectedMapObjectTypes,
      store.selectedMapPublicationModes,
      store.selectedMapFieldConditions,
      undefined,
      fieldOptions.value,
    )
  })
  const dimmedObjectIds = computed<string[]>(() => {
    const matcher = compiledMatcher.value
    const system = selectedSystem.value
    if (!matcher || !system) return []
    return system.objects.filter(object => !matcher(object)).map(object => object.id)
  })
  watch(fieldOptionSignature, () => {
    if (!workspace.value) return
    const result = reconcileFieldConditions(store.selectedMapFieldConditions, fieldOptions.value)
    if (!result.changed) return
    store.setSelectedMapFieldConditions(result.conditions)
    onFiltersInvalidated?.()
  }, { immediate: true })

  function setPublicationModes(values: readonly PublicationMode[]): void {
    const validModes = new Set<PublicationMode>(publicationModes)
    store.setSelectedMapPublicationModes(values.filter((value): value is PublicationMode => validModes.has(value)))
  }

  function setFieldConditions(values: readonly FieldCondition[]): void {
    const reconciled = reconcileFieldConditions(values, fieldOptions.value)
    if (reconciled.changed) return
    store.setSelectedMapFieldConditions(values)
  }

  function clearAll(): void {
    store.setSelectedMapObjectTypes([], [])
    setPublicationModes([])
    setFieldConditions([])
  }

  return {
    fieldOptions,
    publicationFilterOptions,
    selectedPublicationModes,
    fieldConditions,
    dimmedObjectIds,
    activeCriterionCount,
    clearAll,
  }
}
