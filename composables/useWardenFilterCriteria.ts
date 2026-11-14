import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { LocalWorkspace, PublicationMode } from '../domain/workspace'
import { catalogueTypes } from '../domain/workspace'
import { useEditorUiStore } from '../stores/editor-ui'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import { countActiveFilterCriteria, type WardenFilterCriteria } from '../utils/filter-criteria'
import { mapObjectTypeOption, type MapObjectTypeOption } from '../utils/map-type-filters'
import { publicationModes, publicationPresentation } from '../utils/publication-presentation'
import { reconcileFieldConditions, wardenFieldFilterOptions } from '../utils/warden-map-filters'

export interface WardenFilterControl {
  /** Read-only view of this control's criteria; the editor store remains their sole owner. */
  criteria: ComputedRef<WardenFilterCriteria>
  typeOptions: ComputedRef<MapObjectTypeOption[]>
  activeCriterionCount: ComputedRef<number>
  invalidationNotice: ComputedRef<string | null>
  setTypes(types: readonly string[]): void
  setPublicationModes(modes: readonly PublicationMode[]): void
  setFieldConditions(conditions: readonly FieldCondition[]): void
  clearAll(): void
}

export interface WardenFilterCriteriaOwner {
  fieldOptions: ComputedRef<FieldFilterOption[]>
  publicationFilterOptions: ComputedRef<{ value: PublicationMode; label: string }[]>
  map: WardenFilterControl
  search: WardenFilterControl
  /** Clears the Search invalidation message when the full Search lifetime is reset. */
  clearSearchNotice(): void
}

interface UseWardenFilterCriteriaOptions {
  workspace: Ref<LocalWorkspace | null>
  store: ReturnType<typeof useEditorUiStore>
}

const validPublicationModes = new Set<PublicationMode>(publicationModes)

function typeOptionsWithRetainedSelection(
  currentOptions: readonly MapObjectTypeOption[],
  selectedTypes: readonly string[],
  retainedLabels: Readonly<Record<string, string>>,
): MapObjectTypeOption[] {
  const options = new Map(currentOptions.map(option => [option.value, option]))
  for (const value of selectedTypes) {
    const label = retainedLabels[value]
    if (!options.has(value) && label) options.set(value, { value, label, family: 'Other' })
  }
  return [...options.values()]
}

/** Owns the common Warden filter rules while keeping map and Search criteria in their Pinia lifetimes. */
export function useWardenFilterCriteria({ workspace, store }: UseWardenFilterCriteriaOptions): WardenFilterCriteriaOwner {
  const fieldOptions = computed<FieldFilterOption[]>(() =>
    workspace.value ? wardenFieldFilterOptions(workspace.value) : [],
  )
  const fieldOptionSignature = computed(() => JSON.stringify(fieldOptions.value))
  const publicationFilterOptions = computed(() => publicationModes.map(mode => ({
    value: mode,
    label: publicationPresentation(mode).label,
  })))
  const mapInvalidationNotice = ref<string | null>(null)
  const searchInvalidationNotice = ref<string | null>(null)
  const currentTypeOptions = computed(() => {
    const options = new Map<string, MapObjectTypeOption>()
    for (const type of catalogueTypes) {
      const option = mapObjectTypeOption({ family: type.family, subtype: type.value })
      options.set(option.value, option)
    }
    for (const system of workspace.value?.cluster.systems ?? []) {
      for (const object of system.objects) {
        if (object.family !== 'Other') continue
        const option = mapObjectTypeOption(object)
        if (!options.has(option.value)) options.set(option.value, option)
      }
    }
    return [...options.values()]
  })

  const mapCriteria = computed<WardenFilterCriteria>(() => ({
    types: store.selectedMapObjectTypes,
    publicationModes: store.selectedMapPublicationModes,
    fieldConditions: store.selectedMapFieldConditions,
  }))
  const searchCriteria = computed<WardenFilterCriteria>(() => ({
    types: store.selectedSearchObjectTypes,
    publicationModes: store.selectedSearchPublicationModes,
    fieldConditions: store.selectedSearchFieldConditions,
  }))
  const mapNotice = computed<string | null>(() => mapInvalidationNotice.value)
  const searchNotice = computed<string | null>(() => searchInvalidationNotice.value)
  const mapTypeOptions = computed(() => typeOptionsWithRetainedSelection(
    currentTypeOptions.value,
    mapCriteria.value.types,
    store.mapTypeFilterOptionLabels,
  ))
  const searchTypeOptions = computed(() => typeOptionsWithRetainedSelection(
    currentTypeOptions.value,
    searchCriteria.value.types,
    store.searchTypeFilterOptionLabels,
  ))

  watch(fieldOptionSignature, () => {
    if (!workspace.value) return
    const reconciliation = reconcileFieldConditions(store.selectedMapFieldConditions, fieldOptions.value)
    if (!reconciliation.changed) return
    store.setSelectedMapFieldConditions(reconciliation.conditions)
    mapInvalidationNotice.value = 'Some filters were removed because Fields or choices changed.'
  }, { immediate: true })

  watch(() => workspace.value?.id, (workspaceId, previousWorkspaceId) => {
    if (previousWorkspaceId !== undefined && workspaceId !== previousWorkspaceId) mapInvalidationNotice.value = null
  })

  watch([workspace, () => store.selectedSearchFieldConditions], ([currentWorkspace, conditions]) => {
    if (!currentWorkspace || conditions.length === 0) return
    const reconciliation = reconcileFieldConditions(conditions, fieldOptions.value)
    if (!reconciliation.changed) return
    store.setSearchFieldConditions(reconciliation.conditions)
    searchInvalidationNotice.value = 'Search filters updated because a Field or choice is no longer available.'
  }, { flush: 'sync' })

  watch(() => store.workspaceId, () => {
    searchInvalidationNotice.value = null
  }, { flush: 'sync' })

  function setMapTypes(types: readonly string[]): void {
    store.setSelectedMapObjectTypes(types, mapTypeOptions.value)
  }

  function setSearchTypes(types: readonly string[]): void {
    store.setSelectedSearchObjectTypes(types, searchTypeOptions.value)
  }

  function setMapPublicationModes(modes: readonly PublicationMode[]): void {
    store.setSelectedMapPublicationModes(modes.filter((mode): mode is PublicationMode => validPublicationModes.has(mode)))
  }

  function setSearchPublicationModes(modes: readonly PublicationMode[]): void {
    store.setSearchPublicationModes(modes)
  }

  function setMapFieldConditions(conditions: readonly FieldCondition[]): void {
    const reconciliation = reconcileFieldConditions(conditions, fieldOptions.value)
    if (reconciliation.changed) return
    store.setSelectedMapFieldConditions(conditions)
  }

  function setSearchFieldConditions(conditions: readonly FieldCondition[]): void {
    searchInvalidationNotice.value = null
    store.setSearchFieldConditions(conditions)
  }

  function clearMapAll(): void {
    store.setSelectedMapObjectTypes([], [])
    setMapPublicationModes([])
    store.setSelectedMapFieldConditions([])
    mapInvalidationNotice.value = null
  }

  function clearSearchAll(): void {
    setSearchTypes([])
    setSearchPublicationModes([])
    setSearchFieldConditions([])
  }

  const map: WardenFilterControl = {
    criteria: mapCriteria,
    typeOptions: mapTypeOptions,
    activeCriterionCount: computed(() => countActiveFilterCriteria(mapCriteria.value)),
    invalidationNotice: mapNotice,
    setTypes: setMapTypes,
    setPublicationModes: setMapPublicationModes,
    setFieldConditions: setMapFieldConditions,
    clearAll: clearMapAll,
  }
  const search: WardenFilterControl = {
    criteria: searchCriteria,
    typeOptions: searchTypeOptions,
    activeCriterionCount: computed(() => countActiveFilterCriteria(searchCriteria.value)),
    invalidationNotice: searchNotice,
    setTypes: setSearchTypes,
    setPublicationModes: setSearchPublicationModes,
    setFieldConditions: setSearchFieldConditions,
    clearAll: clearSearchAll,
  }

  return {
    fieldOptions,
    publicationFilterOptions,
    map,
    search,
    clearSearchNotice: () => { searchInvalidationNotice.value = null },
  }
}
