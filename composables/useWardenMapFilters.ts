import { computed, type ComputedRef, type Ref } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import { clusterObjects } from '../domain/workspace-location-keys'
import type { FieldFilterOption } from '../utils/field-filter-matching'
import type { WardenFilterCriteria } from '../utils/filter-criteria'
import { createWardenObjectFilterMatcher } from '../utils/warden-map-filters'

export interface UseWardenMapFiltersOptions {
  workspace: Ref<LocalWorkspace | null>
  selectedSystem: ComputedRef<StarSystem | null | undefined>
  activeView: ComputedRef<'cluster' | 'system'>
  continuousMap?: ComputedRef<boolean>
  criteria: ComputedRef<WardenFilterCriteria>
  fieldOptions: ComputedRef<FieldFilterOption[]>
}

/** Projects accepted map criteria onto current-system opacity; criteria ownership stays elsewhere. */
export function useWardenMapFilters({
  workspace,
  selectedSystem,
  activeView,
  continuousMap,
  criteria,
  fieldOptions,
}: UseWardenMapFiltersOptions) {
  const compiledMatcher = computed(() => {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || (activeView.value !== 'system' && !continuousMap?.value)) return null
    return createWardenObjectFilterMatcher(
      currentWorkspace,
      criteria.value.types,
      criteria.value.publicationModes,
      criteria.value.fieldConditions,
      undefined,
      fieldOptions.value,
    )
  })
  const dimmedObjectIds = computed<string[]>(() => {
    const matcher = compiledMatcher.value
    const currentWorkspace = workspace.value
    if (!matcher || !currentWorkspace) return []
    const objects = activeView.value === 'system'
      ? selectedSystem.value?.objects ?? []
      : clusterObjects(currentWorkspace.cluster)
    return objects.filter(object => !matcher(object)).map(object => object.id)
  })

  return { dimmedObjectIds }
}
