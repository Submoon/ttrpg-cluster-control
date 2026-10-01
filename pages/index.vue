<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import {
  addStarSystem,
  addCustomFieldDefinition,
  canPlaceObjectInOrbit,
  catalogueTypes,
  createLocalWorkspace,
  createJumpRoute,
  createOrbit,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  initialSystemPlacement,
  jumpPointsInCluster,
  minimumOrbitRadius,
  moveOrbit,
  planMapEntityDeletion,
  prepareJsonImport,
  renameLocalWorkspace,
  removeCustomFieldDefinition,
  updateCustomFieldOptions,
  updateNativeFieldOptions,
  type JsonImportSummary,
  updateSystemObject,
  type CatalogueSubtype,
  type CustomFieldType,
  type LocalWorkspace,
  type MapDeletionTarget,
  type ObjectPlacement,
  type Orbit,
  type Point,
  type StarSystem,
  type SystemObject,
  type SystemObjectChanges,
} from '../domain/workspace'
import { useLocalWorkspace } from '../composables/useLocalWorkspace'
import type { MapImageExporter, MapImageFormat } from '../utils/map-image-export'

type ObjectRow = { kind: 'object'; object: SystemObject; depth: number }
type OrbitRow = { kind: 'orbit'; orbit: Orbit; host: SystemObject; childCount: number; depth: number }
type HierarchyRow = ObjectRow | OrbitRow
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
interface JumpRouteDraft {
  name: string
  fromPointId: string
  destination: 'point' | 'external'
  toPointId: string
  unresolvedExit: string
}

const {
  workspace,
  hydrationState,
  loadError,
  saveState,
  saveError,
  hydrate,
  commit,
} = useLocalWorkspace()

const clusterName = ref('New Jump Cluster')
const systemName = ref('First System')
const newObjectType = ref<CatalogueSubtype>('planet')
const activeView = ref<'cluster' | 'system'>('system')
const selectedSystemId = ref<string | null>(null)
const selectedObjectId = ref<string | null>(null)
const selectedOrbitId = ref<string | null>(null)
const selectedRouteId = ref<string | null>(null)
const routeFormOpen = ref(false)
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
const nativeFieldDrafts = reactive({
  atmosphereOptions: '',
  portClassOptions: '',
})
const customFieldOptionDrafts = reactive<Record<string, string>>({})
const newCustomFieldName = ref('')
const newCustomFieldType = ref<CustomFieldType>('text')
const newCustomFieldOptions = ref('')
const routeDraft = reactive<JumpRouteDraft>({
  name: '',
  fromPointId: '',
  destination: 'external',
  toPointId: '',
  unresolvedExit: 'Uncharted exit',
})
const formError = ref('')
const editorError = ref('')
const exportError = ref('')
const clusterMapRef = shallowRef<MapImageExporter | null>(null)
const systemMapRef = shallowRef<MapImageExporter | null>(null)
const fieldSettingsError = ref('')
const importError = ref('')
const jsonImportInput = ref<HTMLInputElement | null>(null)

const selectedSystem = computed(() =>
  workspace.value?.cluster.systems.find(system => system.id === selectedSystemId.value),
)
const selectedObject = computed(() =>
  selectedSystem.value?.objects.find(object => object.id === selectedObjectId.value),
)
const selectedOrbit = computed(() =>
  selectedSystem.value?.orbits.find(orbit => orbit.id === selectedOrbitId.value),
)
const selectedRoute = computed(() =>
  workspace.value?.cluster.routes.find(route => route.id === selectedRouteId.value),
)
const jumpPoints = computed(() =>
  workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [],
)
const routeDestinationPoints = computed(() =>
  jumpPoints.value.filter(({ point }) => point.id !== routeDraft.fromPointId),
)
const selectedRouteFrom = computed(() =>
  jumpPoints.value.find(({ point }) => point.id === selectedRoute.value?.fromPointId),
)
const selectedRouteTo = computed(() =>
  selectedRoute.value?.toPointId
    ? jumpPoints.value.find(({ point }) => point.id === selectedRoute.value?.toPointId)
    : undefined,
)
const physicalStations = computed(() =>
  selectedSystem.value?.objects.filter(object => object.family === 'Installation' && object.subtype === 'station') ?? [],
)
const selectedOrbitDeleteLabel = computed(() => {
  const orbit = selectedOrbit.value
  if (!orbit) return 'Delete Orbit'
  const hostName = selectedSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Delete Orbit ${orbit.order} around ${hostName}`
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
  for (const field of workspace.value?.objectFieldSettings.customFields ?? []) {
    objectDraft.customFieldValues[field.id] ??= ''
  }
  objectDraft.jumpStationId = object?.jumpStationId ?? ''
}

watch(selectedObject, syncObjectDraft, { immediate: true })
watch(() => workspace.value?.objectFieldSettings, settings => {
  if (!settings) return

  nativeFieldDrafts.atmosphereOptions = settings.atmosphereOptions.join('\n')
  nativeFieldDrafts.portClassOptions = settings.portClassOptions.join('\n')
  const fieldIds = new Set(settings.customFields.map(field => field.id))
  for (const field of settings.customFields) {
    if (field.type === 'single-select') {
      customFieldOptionDrafts[field.id] = field.options.join('\n')
    }
    if (!(field.id in objectDraft.customFieldValues)) {
      const value = selectedObject.value?.customFieldValues?.[field.id]
      objectDraft.customFieldValues[field.id] = value === undefined ? '' : String(value)
    }
  }
  for (const fieldId of Object.keys(customFieldOptionDrafts)) {
    if (!fieldIds.has(fieldId)) delete customFieldOptionDrafts[fieldId]
  }
  for (const fieldId of Object.keys(objectDraft.customFieldValues)) {
    if (!fieldIds.has(fieldId)) delete objectDraft.customFieldValues[fieldId]
  }
}, { immediate: true })
watch(() => routeDraft.fromPointId, fromPointId => {
  const firstDestination = routeDestinationPoints.value[0]?.point.id ?? ''
  if (routeDraft.toPointId === fromPointId || !firstDestination) {
    routeDraft.toPointId = firstDestination
  }
  if (!firstDestination) routeDraft.destination = 'external'
})

function buildHierarchy(system: StarSystem | undefined): HierarchyRow[] {
  if (!system) return []

  const rows: HierarchyRow[] = []
  const orbitsByHost = new Map<string, Orbit[]>()
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

  function addObjectBranch(object: SystemObject, depth: number): void {
    rows.push({ kind: 'object', object, depth })
    const hostedOrbits = orbitsByHost.get(object.id) ?? []
    hostedOrbits.sort((left, right) => left.order - right.order)
    for (const orbit of hostedOrbits) {
      const children = objectsByOrbit.get(orbit.id) ?? []
      rows.push({ kind: 'orbit', orbit, host: object, childCount: children.length, depth: depth + 1 })
      for (const child of children) addObjectBranch(child, depth + 2)
    }
  }

  for (const object of system.objects) {
    if (object.placement.kind === 'system') addObjectBranch(object, 0)
  }
  return rows
}

const hierarchyRows = computed(() => buildHierarchy(selectedSystem.value))
const placeableOrbits = computed(() => {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object) return []

  return system.orbits
    .filter(orbit => canPlaceObjectInOrbit(system, object.id, orbit.id))
    .sort((left, right) => left.order - right.order)
})
const hasUncommittedNames = computed(() => {
  const currentWorkspace = workspace.value
  const currentSystem = selectedSystem.value
  return !!currentWorkspace && !!currentSystem && (
    clusterName.value.trim() !== currentWorkspace.cluster.name
    || systemName.value.trim() !== currentSystem.name
  )
})
const saveMessage = computed(() => {
  if (saveState.value === 'saving') return 'Saving to this browser...'
  if (saveState.value === 'error') return `Not saved. ${saveError.value ?? ''}`
  if (hasUncommittedNames.value) return 'Chart name edits are not committed.'
  if (saveState.value === 'saved') return 'Saved on this device'
  return 'No workspace is stored yet'
})

watch(workspace, currentWorkspace => {
  if (!currentWorkspace) {
    selectedSystemId.value = null
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    routeFormOpen.value = false
    return
  }
  if (!currentWorkspace.cluster.systems.some(system => system.id === selectedSystemId.value)) {
    selectedSystemId.value = currentWorkspace.cluster.systems[0]?.id ?? null
  }
  if (!currentWorkspace.cluster.routes.some(route => route.id === selectedRouteId.value)) {
    selectedRouteId.value = null
  }
}, { immediate: true })

watch(() => selectedSystem.value, currentSystem => {
  if (!currentSystem) {
    selectedObjectId.value = null
    selectedOrbitId.value = null
    return
  }
  if (!currentSystem.objects.some(object => object.id === selectedObjectId.value)) {
    selectedObjectId.value = null
  }
  if (!currentSystem.orbits.some(orbit => orbit.id === selectedOrbitId.value)) {
    selectedOrbitId.value = null
  }
})

watch(() => workspace.value?.cluster.name, value => {
  if (value !== undefined) clusterName.value = value
}, { immediate: true })
watch(() => selectedSystem.value?.name, value => {
  if (value !== undefined) systemName.value = value
}, { immediate: true })

onMounted(hydrate)

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function downloadJsonFile(filename: string, value: unknown): void {
  const json = JSON.stringify(value, null, 2)
  if (json === undefined) {
    throw new Error('Could not serialize the map as JSON.')
  }
  downloadFile(filename, new Blob([json], { type: 'application/json' }))
}

function exportFileName(
  name: string,
  kind: 'jump-cluster' | 'star-system',
  extension = 'json',
): string {
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim()
  return `${safeName || 'map'}-${kind}.${extension}`
}

function downloadClusterJson(): void {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    downloadJsonFile(
      exportFileName(currentWorkspace.cluster.name, 'jump-cluster'),
      exportJumpCluster(currentWorkspace),
    )
    exportError.value = ''
  } catch (error) {
    exportError.value = errorText(error)
  }
}

function downloadSystemJson(): void {
  const currentWorkspace = workspace.value
  const system = selectedSystem.value
  if (!currentWorkspace || !system) return

  try {
    downloadJsonFile(
      exportFileName(system.name, 'star-system'),
      exportStarSystem(currentWorkspace, system.id),
    )
    exportError.value = ''
  } catch (error) {
    exportError.value = errorText(error)
  }
}

async function downloadMapImage(
  map: MapImageExporter | null,
  name: string | undefined,
  kind: 'jump-cluster' | 'star-system',
  format: MapImageFormat,
): Promise<void> {
  if (!map || !name) return

  try {
    downloadFile(exportFileName(name, kind, format), await map.exportImage(format))
    exportError.value = ''
  } catch (error) {
    exportError.value = errorText(error)
  }
}

function openJsonImportPicker(): void {
  jsonImportInput.value?.click()
}

function importPreview(summary: JsonImportSummary): string {
  const collisionLines = summary.idCollisions.length
    ? summary.idCollisions.map(collision =>
        `- ${collision.entity} "${collision.name}" [${collision.id}]`,
      )
    : ['- None']
  const matchLines = summary.possibleMatches.length
    ? summary.possibleMatches.map(match =>
        `- ${match.entity} "${match.name}" in "${match.existingSystem}" (${match.reason})`,
      )
    : ['- None']
  return [
    `Import this ${summary.type === 'cluster' ? 'Jump Cluster' : 'star system'} as an independent copy?`,
    '',
    `Star systems: ${summary.systems}`,
    `Map objects: ${summary.objects}`,
    `Orbits: ${summary.orbits}`,
    `Jump Routes: ${summary.routes}`,
    `Custom fields: ${summary.customFields}`,
    '',
    `Original-ID collisions (${summary.idCollisions.length}):`,
    ...collisionLines,
    '',
    `Possible existing matches by name or location key (${summary.possibleMatches.length}):`,
    ...matchLines,
    '',
    'Nothing will be merged. Imported map entities will receive new IDs.',
  ].join('\n')
}

async function importJsonFile(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file || !workspace.value) return

  importError.value = ''
  try {
    let content: unknown
    try {
      content = JSON.parse(await file.text())
    } catch (error) {
      throw new Error(`The selected file is not valid JSON: ${errorText(error)}`)
    }
    const prepared = prepareJsonImport(workspace.value, content)
    if (!window.confirm(importPreview(prepared.summary))) return

    await commit(prepared.workspace)
    selectedSystemId.value = prepared.addedSystemIds[0] ?? selectedSystemId.value
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    activeView.value = 'cluster'
  } catch (error) {
    importError.value = errorText(error)
  }
}

function workspaceWithSystem(currentWorkspace: LocalWorkspace, system: StarSystem): LocalWorkspace {
  const systems = currentWorkspace.cluster.systems.map(candidate =>
    candidate.id === system.id ? system : candidate,
  )
  const orbitIds = new Set(systems.flatMap(candidate => candidate.orbits.map(orbit => orbit.id)))
  const orbitalObjectIds = new Set(systems.flatMap(candidate =>
    candidate.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))

  return {
    ...currentWorkspace,
    cluster: {
      ...currentWorkspace.cluster,
      systems,
    },
    layout: {
      ...currentWorkspace.layout,
      orbitRadii: Object.fromEntries(Object.entries(currentWorkspace.layout.orbitRadii)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      objectAngles: Object.fromEntries(Object.entries(currentWorkspace.layout.objectAngles)
        .filter(([objectId]) => orbitalObjectIds.has(objectId))),
    },
  }
}

async function saveSystem(system: StarSystem): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) {
    throw new Error('Create a local workspace before editing a star system.')
  }
  await commit(workspaceWithSystem(currentWorkspace, system))
}

async function moveSystem(systemId: string, position: Point): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace?.cluster.systems.some(system => system.id === systemId)) return

  try {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error('A map position must contain finite coordinates.')
    }
    await commit({
      ...currentWorkspace,
      layout: {
        ...currentWorkspace.layout,
        systemPositions: {
          ...currentWorkspace.layout.systemPositions,
          [systemId]: {
            x: Math.max(0, Math.min(1, position.x)),
            y: Math.max(0, Math.min(1, position.y)),
          },
        },
      },
    })
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function moveMapObject(objectId: string, position: Point): Promise<void> {
  const system = selectedSystem.value
  const object = system?.objects.find(candidate => candidate.id === objectId)
  const objectFieldSettings = workspace.value?.objectFieldSettings
  if (!system || !object || !objectFieldSettings) return

  try {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error('A map position must contain finite coordinates.')
    }
    const updatedSystem = updateSystemObject(system, object.id, {
      placement: {
        kind: 'system',
        x: Math.max(0, Math.min(1, position.x)),
        y: Math.max(0, Math.min(1, position.y)),
      },
    }, objectFieldSettings)
    await saveSystem(updatedSystem)
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function rotateMapObject(objectId: string, angle: number): Promise<void> {
  const currentWorkspace = workspace.value
  const object = selectedSystem.value?.objects.find(candidate => candidate.id === objectId)
  if (!currentWorkspace || object?.placement.kind !== 'orbit') return

  try {
    if (!Number.isFinite(angle)) throw new Error('An orbital angle must be finite.')
    await commit({
      ...currentWorkspace,
      layout: {
        ...currentWorkspace.layout,
        objectAngles: {
          ...currentWorkspace.layout.objectAngles,
          [objectId]: angle,
        },
      },
    })
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function resizeMapOrbit(orbitId: string, radius: number): Promise<void> {
  const currentWorkspace = workspace.value
  const system = selectedSystem.value
  const orbit = system?.orbits.find(candidate => candidate.id === orbitId)
  if (!currentWorkspace || !system || !orbit) return

  try {
    if (!Number.isFinite(radius)) throw new Error('An Orbit radius must be finite.')
    await commit({
      ...currentWorkspace,
      layout: {
        ...currentWorkspace.layout,
        orbitRadii: {
          ...currentWorkspace.layout.orbitRadii,
          [orbitId]: Math.max(minimumOrbitRadius(system, orbit), Math.round(radius)),
        },
      },
    })
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function submitNames(): Promise<void> {
  formError.value = ''
  try {
    const currentWorkspace = workspace.value
    const nextWorkspace = currentWorkspace
      ? renameLocalWorkspace(
          currentWorkspace,
          clusterName.value,
          systemName.value,
          selectedSystemId.value ?? undefined,
        )
      : createLocalWorkspace(clusterName.value, systemName.value)
    await commit(nextWorkspace)
  } catch (error) {
    formError.value = errorText(error)
  }
}

async function createSystem(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    const result = addStarSystem(currentWorkspace)
    selectedSystemId.value = result.system.id
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    routeFormOpen.value = false
    editorError.value = ''
    await commit(result.workspace)
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function showClusterMap(): void {
  activeView.value = 'cluster'
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

function selectSystem(systemId: string): void {
  if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
  selectedSystemId.value = systemId
  activeView.value = 'system'
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

function selectObject(objectId: string): void {
  if (!selectedSystem.value?.objects.some(object => object.id === objectId)) return
  selectedObjectId.value = objectId
  selectedOrbitId.value = null
  editorError.value = ''
}

function selectOrbit(orbitId: string): void {
  if (!selectedSystem.value?.orbits.some(orbit => orbit.id === orbitId)) return
  selectedOrbitId.value = orbitId
  selectedObjectId.value = null
  selectedRouteId.value = null
  editorError.value = ''
}

function selectRoute(routeId: string): void {
  if (!workspace.value?.cluster.routes.some(route => route.id === routeId)) return
  selectedRouteId.value = routeId
  selectedObjectId.value = null
  selectedOrbitId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

function beginRoute(): void {
  routeDraft.name = `Jump-${String((workspace.value?.cluster.routes.length ?? 0) + 1).padStart(2, '0')}`
  routeDraft.fromPointId = jumpPoints.value[0]?.point.id ?? ''
  routeDraft.toPointId = routeDestinationPoints.value[0]?.point.id ?? ''
  routeDraft.destination = routeDestinationPoints.value.length ? 'point' : 'external'
  routeDraft.unresolvedExit = 'Uncharted exit'
  selectedRouteId.value = null
  routeFormOpen.value = true
  editorError.value = ''
}

async function submitRoute(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    const route = createJumpRoute(
      currentWorkspace.cluster,
      routeDraft.name,
      routeDraft.fromPointId,
      routeDraft.destination === 'external' ? null : routeDraft.toPointId,
      routeDraft.unresolvedExit,
    )
    await commit({
      ...currentWorkspace,
      cluster: {
        ...currentWorkspace.cluster,
        routes: [...currentWorkspace.cluster.routes, route],
      },
    })
    selectedRouteId.value = route.id
    routeFormOpen.value = false
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function deleteMapEntity(target: MapDeletionTarget): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace || saveState.value === 'saving') return

  try {
    const plan = planMapEntityDeletion(currentWorkspace, target)
    if (plan.affectedEntities.length && !window.confirm(
      `Delete ${plan.entityLabel}?\n\nThis also removes or updates:\n${plan.affectedEntities.map(entity => `- ${entity}`).join('\n')}`,
    )) {
      return
    }
    editorError.value = ''
    await commit(plan.workspace)
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function deleteSystem(systemId: string): Promise<void> {
  return deleteMapEntity({ kind: 'system', systemId })
}

function deleteSelectedObject(): Promise<void> {
  const system = selectedSystem.value
  const object = selectedObject.value
  return system && object
    ? deleteMapEntity({ kind: 'object', systemId: system.id, objectId: object.id })
    : Promise.resolve()
}

function deleteSelectedOrbit(): Promise<void> {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  return system && orbit
    ? deleteMapEntity({ kind: 'orbit', systemId: system.id, orbitId: orbit.id })
    : Promise.resolve()
}

function deleteSelectedRoute(): Promise<void> {
  const route = selectedRoute.value
  return route
    ? deleteMapEntity({ kind: 'route', routeId: route.id })
    : Promise.resolve()
}

function showChartDetails(): void {
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  editorError.value = ''
}

async function addObject(): Promise<void> {
  const system = selectedSystem.value
  if (!system) return

  try {
    const object = createSystemObject(system, newObjectType.value, selectedOrbitId.value ?? undefined)
    selectedObjectId.value = object.id
    selectedOrbitId.value = null
    editorError.value = ''
    await saveSystem({ ...system, objects: [...system.objects, object] })
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function addOrbit(): Promise<void> {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object) return

  try {
    const orbit = createOrbit(system, object.id)
    selectedOrbitId.value = orbit.id
    selectedObjectId.value = null
    editorError.value = ''
    await saveSystem({ ...system, orbits: [...system.orbits, orbit] })
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function reorderSelectedOrbit(direction: -1 | 1): Promise<void> {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (!system || !orbit) return

  try {
    await saveSystem(moveOrbit(system, orbit.id, direction))
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function saveObjectChanges(changes: SystemObjectChanges): Promise<void> {
  const system = selectedSystem.value
  const object = selectedObject.value
  const objectFieldSettings = workspace.value?.objectFieldSettings
  if (!system || !object || !objectFieldSettings) return

  let updatedSystem: StarSystem
  try {
    updatedSystem = updateSystemObject(system, object.id, changes, objectFieldSettings)
  } catch (error) {
    editorError.value = errorText(error)
    return
  }

  editorError.value = ''
  try {
    await saveSystem(updatedSystem)
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function saveObjectField(field: 'locationKey' | 'name' | 'description' | 'subtype'): Promise<void> {
  const value = objectDraft[field]
  const changes: SystemObjectChanges = field === 'locationKey'
    ? { locationKey: value }
    : field === 'name'
      ? { name: value }
      : field === 'description'
        ? { description: value }
        : { subtype: value }
  return saveObjectChanges(changes)
}

function saveJumpStation(): Promise<void> {
  return saveObjectChanges({ jumpStationId: objectDraft.jumpStationId || null })
}

function fieldOptionsFromText(value: string): string[] {
  return value.split(/\r?\n/u).map(option => option.trim()).filter(Boolean)
}

async function saveNativeFieldOptions(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    const withAtmospheres = updateNativeFieldOptions(
      currentWorkspace,
      'atmosphere',
      fieldOptionsFromText(nativeFieldDrafts.atmosphereOptions),
    )
    await commit(updateNativeFieldOptions(
      withAtmospheres,
      'portClass',
      fieldOptionsFromText(nativeFieldDrafts.portClassOptions),
    ))
    fieldSettingsError.value = ''
  } catch (error) {
    fieldSettingsError.value = errorText(error)
  }
}

async function createCustomField(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    await commit(addCustomFieldDefinition(
      currentWorkspace,
      newCustomFieldName.value,
      newCustomFieldType.value,
      fieldOptionsFromText(newCustomFieldOptions.value),
    ))
    newCustomFieldName.value = ''
    newCustomFieldOptions.value = ''
    fieldSettingsError.value = ''
  } catch (error) {
    fieldSettingsError.value = errorText(error)
  }
}

async function saveCustomFieldOptions(fieldId: string): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    await commit(updateCustomFieldOptions(
      currentWorkspace,
      fieldId,
      fieldOptionsFromText(customFieldOptionDrafts[fieldId] ?? ''),
    ))
    fieldSettingsError.value = ''
  } catch (error) {
    fieldSettingsError.value = errorText(error)
  }
}

async function deleteCustomField(fieldId: string): Promise<void> {
  const currentWorkspace = workspace.value
  const field = currentWorkspace?.objectFieldSettings.customFields.find(item => item.id === fieldId)
  if (!currentWorkspace || !field || !window.confirm(
    `Remove "${field.name}" and clear its values from all map objects?`,
  )) {
    return
  }

  try {
    await commit(removeCustomFieldDefinition(currentWorkspace, fieldId))
    fieldSettingsError.value = ''
  } catch (error) {
    fieldSettingsError.value = errorText(error)
  }
}

function saveNativeObjectField(field: 'atmosphere' | 'portClass'): Promise<void> {
  return field === 'atmosphere'
    ? saveObjectChanges({ atmosphere: objectDraft.atmosphere || undefined })
    : saveObjectChanges({ portClass: objectDraft.portClass || undefined })
}

async function saveCustomFieldValue(fieldId: string): Promise<void> {
  const definition = workspace.value?.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) return

  const values = { ...(selectedObject.value?.customFieldValues ?? {}) }
  const draftValue = objectDraft.customFieldValues[fieldId]
  if (!draftValue) {
    delete values[fieldId]
  } else if (definition.type === 'number') {
    const numberValue = Number(draftValue)
    if (!Number.isFinite(numberValue)) {
      editorError.value = `"${definition.name}" must be a finite number.`
      return
    }
    values[fieldId] = numberValue
  } else if (definition.type === 'boolean') {
    if (draftValue !== 'true' && draftValue !== 'false') {
      editorError.value = `Choose a true or false value for "${definition.name}".`
      return
    }
    values[fieldId] = draftValue === 'true'
  } else if (definition.type === 'single-select') {
    values[fieldId] = draftValue
  } else {
    values[fieldId] = draftValue
  }

  await saveObjectChanges({ customFieldValues: Object.keys(values).length ? values : undefined })
}

function savePlacement(): Promise<void> {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object) return Promise.resolve()

  if (objectDraft.placement === 'system') {
    const placement = object.placement.kind === 'system'
      ? object.placement
      : initialSystemPlacement(system)
    return saveObjectChanges({ placement })
  }
  if (objectDraft.placement.startsWith('orbit:')) {
    return saveObjectChanges({
      placement: { kind: 'orbit', orbitId: objectDraft.placement.slice('orbit:'.length) },
    })
  }
  throw new Error('Choose a valid map placement.')
}

function savePosition(axis: 'x' | 'y'): Promise<void> {
  const object = selectedObject.value
  if (!object || object.placement.kind !== 'system') return Promise.resolve()

  const rawValue = String(objectDraft[axis])
  const value = rawValue.trim() ? Number(rawValue) : Number.NaN
  return saveObjectChanges({
    placement: { ...object.placement, [axis]: value },
  })
}

function canMoveSelectedOrbit(direction: -1 | 1): boolean {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (!system || !orbit) return false

  const siblings = system.orbits
    .filter(candidate => candidate.hostId === orbit.hostId)
    .sort((left, right) => left.order - right.order)
  const index = siblings.findIndex(candidate => candidate.id === orbit.id)
  return index + direction >= 0 && index + direction < siblings.length
}
</script>

<template>
  <div class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3">
    <header class="topbar flex min-h-20 items-center justify-between gap-4 border-b border-[#bdb3a0] max-[760px]:min-h-[4.5rem]">
      <a class="wordmark inline-flex items-center gap-3 text-inherit no-underline" href="/" aria-label="Mothership Campaign Cartography home">
        <span class="wordmark-symbol grid size-[2.15rem] place-items-center rounded-full border border-[#a45138]" aria-hidden="true">M</span>
        <span>
          <strong class="block">MOTHERSHIP</strong>
          <small class="mt-[0.22rem] block">CAMPAIGN CARTOGRAPHY</small>
        </span>
      </a>
      <div v-if="workspace" class="cluster-stamp grid gap-[0.2rem] text-center max-[760px]:hidden">
        <small>ACTIVE JUMP CLUSTER</small>
        <strong>{{ workspace.cluster.name }}</strong>
      </div>
      <div class="local-badge inline-flex items-center gap-[0.45rem] whitespace-nowrap text-[#54675b]">
        <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[#82956f]" aria-hidden="true"></span>
        LOCAL ONLY
      </div>
    </header>

    <main class="main-content mx-auto flex w-full max-w-[1500px] flex-1 flex-col self-center pb-10 pt-[clamp(2rem,4vw,3.5rem)]">
      <input
        v-if="workspace"
        ref="jsonImportInput"
        class="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="JSON map file"
        @change="importJsonFile"
      >
      <p v-if="importError" class="feedback m-0 error-text" role="alert">{{ importError }}</p>
      <section v-if="hydrationState === 'loading'" class="message-panel max-w-[44rem] p-[clamp(1.5rem,4vw,3rem)]" role="status" aria-live="polite">
        <span class="section-kicker">LOCAL ARCHIVE</span>
        <h1 class="my-4 text-[clamp(2.2rem,5vw,3.7rem)]">Opening this browser's workspace...</h1>
        <p class="max-w-[38rem] mb-[1em]">Your campaign data is read after the app loads.</p>
      </section>

      <section v-else-if="hydrationState === 'error'" class="message-panel error-panel max-w-[44rem] p-[clamp(1.5rem,4vw,3rem)]">
        <span class="section-kicker">LOCAL ARCHIVE UNAVAILABLE</span>
        <h1 class="my-4 text-[clamp(2.2rem,5vw,3.7rem)]">Your workspace could not be opened.</h1>
        <p class="max-w-[38rem] mb-[1em]" role="alert">{{ loadError }}</p>
        <button class="secondary-button" type="button" @click="hydrate">
          Try again
        </button>
      </section>

      <section v-else-if="!workspace" class="welcome mx-auto my-[5vh] grid max-w-[72rem] grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)] items-center gap-[clamp(2rem,7vw,7rem)] max-[760px]:my-4 max-[760px]:grid-cols-1">
        <div class="intro">
          <span class="section-kicker">A PRIVATE CHART FOR YOUR CAMPAIGN</span>
          <h1 class="my-4 max-w-[11ch] text-[clamp(2.8rem,6vw,5.4rem)] leading-[0.98] tracking-[-0.055em]">Give the unknown a name.</h1>
          <p class="max-w-[38rem] mb-[1em]">
            Start with a Jump Cluster and its first star system. This workspace stays in this browser;
            there is no account and no remote workspace.
          </p>
        </div>

        <form class="setup-panel flex min-h-[22rem] flex-col p-[clamp(1.25rem,3vw,2rem)]" @submit.prevent="submitNames">
          <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
            <span class="section-kicker">NEW LOCAL WORKSPACE</span>
            <span class="step-marker">01 / 01</span>
          </div>
          <fieldset class="mt-8 mb-0 grid gap-[0.7rem] border-0 p-0" :disabled="saveState === 'saving'">
            <label for="cluster-name">Jump Cluster</label>
            <input
              id="cluster-name"
              v-model="clusterName"
              name="clusterName"
              autocomplete="off"
              maxlength="80"
              required
            >
            <label for="system-name">First star system</label>
            <input
              id="system-name"
              v-model="systemName"
              name="systemName"
              autocomplete="off"
              maxlength="80"
              required
            >
            <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
            <button class="primary-button mt-[0.65rem]" type="submit">
              {{ saveState === 'saving' ? 'Saving...' : 'Create local workspace' }}
              <span aria-hidden="true">-&gt;</span>
            </button>
          </fieldset>
          <p class="save-feedback text-[0.72rem]" :class="{ 'error-text': saveState === 'error' }">
            <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[#82956f]" aria-hidden="true"></span>
            {{ saveState === 'error' ? `Not saved. ${saveError ?? ''}` : 'Your archive remains on this device.' }}
          </p>
        </form>
      </section>

      <section v-else-if="workspace && activeView === 'cluster'" class="editor">
        <header class="editor-heading mb-[1.2rem] flex items-end justify-between gap-4 max-[760px]:items-start max-[760px]:flex-col">
          <div>
            <span class="section-kicker">JUMP CLUSTER / KNOWN NETWORK</span>
            <h1 class="mt-[0.45rem] mb-[0.4rem] text-[clamp(2.1rem,4vw,3.2rem)] tracking-[-0.04em]">{{ workspace.cluster.name }}</h1>
            <p class="m-0">Connect logical Jump Points. Uncharted exits stay outside the known cluster.</p>
          </div>
          <div class="chart-stats flex flex-none gap-5 pb-[0.35rem] max-[760px]:gap-[0.9rem]" aria-label="Current Jump Cluster contents">
            <span><strong class="mb-[0.2rem] block text-center">{{ workspace.cluster.systems.length }}</strong> SYSTEMS</span>
            <span><strong class="mb-[0.2rem] block text-center">{{ workspace.cluster.routes.length }}</strong> ROUTES</span>
            <span><strong class="mb-[0.2rem] block text-center">{{ jumpPoints.length }}</strong> JUMP POINTS</span>
          </div>
        </header>

        <div class="editor-grid grid min-h-[690px] grid-cols-[minmax(14rem,0.75fr)_minmax(0,2.15fr)_minmax(17rem,0.95fr)] items-stretch gap-[0.7rem] max-[1200px]:grid-cols-[minmax(13rem,0.75fr)_minmax(0,2fr)] max-[760px]:flex max-[760px]:flex-col">
          <aside class="panel hierarchy-panel min-w-0 overflow-auto p-4 max-[760px]:order-1" aria-label="Jump Cluster contents">
            <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
              <div>
                <span class="section-kicker">LOCAL ARCHIVE</span>
                <h2 class="mt-[0.28rem] mb-0 text-2xl">Cluster</h2>
              </div>
              <span class="tree-count whitespace-nowrap">{{ workspace.cluster.systems.length }} systems</span>
            </div>

            <nav class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Star systems">
              <span class="subsection-label">STAR SYSTEMS</span>
              <p v-if="workspace.cluster.systems.length === 0" class="empty-copy my-[0.65rem]">No star systems yet.</p>
              <div
                v-for="system in workspace.cluster.systems"
                :key="system.id"
                class="flex min-w-0 items-center gap-[0.25rem]"
              >
                <button
                  class="system-link flex min-h-[2.7rem] min-w-0 flex-1 cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                  type="button"
                  :aria-label="`Open ${system.name} system map`"
                  :aria-current="system.id === selectedSystemId ? 'page' : undefined"
                  @click="selectSystem(system.id)"
                >
                  <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[#aab1a7]">SY</span>
                  <span class="min-w-0 [overflow-wrap:anywhere]">{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
                </button>
                <button
                  class="quiet-button min-h-[2.5rem] w-[2.5rem] shrink-0 justify-center px-0"
                  type="button"
                  :aria-label="`Delete ${system.name} system`"
                  :title="workspace.cluster.systems.length === 1 ? 'A Jump Cluster must contain at least one star system.' : undefined"
                  :disabled="workspace.cluster.systems.length === 1 || saveState === 'saving'"
                  @click="deleteSystem(system.id)"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </nav>

            <nav class="object-tree grid gap-[0.1rem] border-t border-[#ddd4c4] pt-[0.65rem]" aria-label="Jump Routes">
              <span class="subsection-label">JUMP ROUTES</span>
              <p v-if="workspace.cluster.routes.length === 0" class="empty-copy my-[0.65rem]">No Jump Routes on this chart.</p>
              <button
                v-for="route in workspace.cluster.routes"
                :key="route.id"
                class="tree-row object-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                :class="{ active: route.id === selectedRouteId }"
                type="button"
                :aria-label="`Select ${route.name}${route.toPointId ? ' route' : ', unresolved exit'}`"
                :aria-current="route.id === selectedRouteId ? 'true' : undefined"
                @click="selectRoute(route.id)"
              >
                <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[#8c977f]" aria-hidden="true">R</span>
                <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
                  {{ route.name }}
                  <small class="mt-[0.18rem] block">{{ route.toPointId ? 'Jump Points linked' : route.unresolvedExit }}</small>
                </span>
              </button>
            </nav>
          </aside>

          <section class="panel map-panel flex min-w-0 flex-col p-[0.7rem]" aria-label="Jump Cluster map workspace">
            <div class="map-toolbar flex flex-wrap items-center gap-[0.45rem] pt-[0.1rem] pb-[0.65rem]" role="toolbar" aria-label="Jump Cluster editing">
              <button class="tool-button add-button" type="button" @click="createSystem">
                <span aria-hidden="true">+</span> Add star system
              </button>
              <button class="tool-button" type="button" @click="beginRoute">
                <span aria-hidden="true">+</span> Add Jump Route
              </button>
              <button class="tool-button" type="button" @click="downloadClusterJson">
                Export Jump Cluster JSON
              </button>
              <button
                class="tool-button"
                type="button"
                :disabled="!clusterMapRef"
                @click="downloadMapImage(clusterMapRef, workspace.cluster.name, 'jump-cluster', 'png')"
              >
                Export Jump Cluster PNG
              </button>
              <button
                class="tool-button"
                type="button"
                :disabled="!clusterMapRef"
                @click="downloadMapImage(clusterMapRef, workspace.cluster.name, 'jump-cluster', 'svg')"
              >
                Export Jump Cluster SVG
              </button>
              <button class="tool-button" type="button" :disabled="saveState === 'saving'" @click="openJsonImportPicker">
                Import JSON copy
              </button>
            </div>
            <p v-if="exportError" class="feedback m-0 error-text" role="alert">{{ exportError }}</p>
            <div class="map-frame flex min-h-[31rem] min-w-0 flex-1 overflow-hidden border border-[#bdb3a0] bg-[#f4eee2] max-[760px]:min-h-96">
              <ClientOnly>
                <ClusterMap
                  ref="clusterMapRef"
                  :cluster="workspace.cluster"
                  :system-positions="workspace.layout.systemPositions"
                  :selected-system-id="selectedSystemId"
                  :selected-route-id="selectedRouteId"
                  @open-system="selectSystem"
                  @select-route="selectRoute"
                  @move-system="moveSystem"
                />
                <template #fallback>
                  <div class="map-fallback grid min-h-[31rem] w-full place-items-center max-[760px]:min-h-96" role="status">Preparing the Jump Cluster chart...</div>
                </template>
              </ClientOnly>
            </div>
            <p class="map-note mb-[1em] flex justify-between gap-3 px-[0.2rem] pt-[0.55rem] pb-[0.1rem] max-[760px]:flex-col">
              <span>KNOWN SYSTEMS / ROUTES / EXTERNAL EXITS</span>
              <span>Select a system to open it, or a route to inspect its endpoints.</span>
            </p>
          </section>

          <aside class="panel inspector-panel min-w-0 overflow-auto p-4 max-[1200px]:col-span-full max-[760px]:order-2" aria-label="Jump Route inspector">
            <template v-if="selectedRoute">
              <span class="section-kicker">JUMP ROUTE / SELECTED</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[#d2c8b7] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ selectedRoute.name }}</h2>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[#ddd4c4] py-[0.8rem]">
                <span>From Jump Point</span>
                <strong>{{ selectedRouteFrom?.point.name ?? 'Missing Jump Point' }}</strong>
                <span>Origin system</span>
                <strong>{{ selectedRouteFrom?.system.name ?? 'Unknown' }}</strong>
                <span>To</span>
                <strong>{{ selectedRouteTo?.point.name ?? selectedRoute.unresolvedExit ?? 'Unresolved' }}</strong>
                <span>Destination system</span>
                <strong>{{ selectedRouteTo?.system.name ?? 'Not mapped' }}</strong>
              </div>
              <p v-if="selectedRoute.toPointId === null" class="inspector-intro mb-[1em]" role="status">
                This route leaves the known Jump Cluster at {{ selectedRoute.unresolvedExit }}.
              </p>
              <p v-else class="inspector-intro mb-[1em]">
                This route connects Jump Points by stable identity, independently of any physical Station.
              </p>
              <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
              <button
                class="quiet-button mt-4"
                type="button"
                :aria-label="`Delete Jump Route ${selectedRoute.name}`"
                :disabled="saveState === 'saving'"
                @click="deleteSelectedRoute"
              >
                Delete route
              </button>
            </template>

            <template v-else-if="routeFormOpen">
              <span class="section-kicker">JUMP ROUTE / NEW</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] text-[1.65rem]">Connect Jump Points</h2>
              <p class="inspector-intro mb-[1em]">
                Routes reference logical Jump Points. A Station is a separate physical location.
              </p>
              <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitRoute">
                <template v-if="jumpPoints.length">
                  <label for="route-name">
                    Route name
                    <input id="route-name" v-model="routeDraft.name" maxlength="80" required>
                  </label>
                  <label for="route-from">
                    From Jump Point
                    <select id="route-from" v-model="routeDraft.fromPointId" required>
                      <option v-for="reference in jumpPoints" :key="reference.point.id" :value="reference.point.id">
                        {{ reference.point.name }} ({{ reference.system.name }})
                      </option>
                    </select>
                  </label>
                  <label for="route-destination">
                    Route destination
                    <select id="route-destination" v-model="routeDraft.destination">
                      <option value="point" :disabled="routeDestinationPoints.length === 0">Known Jump Point</option>
                      <option value="external">Unresolved external exit</option>
                    </select>
                  </label>
                  <label v-if="routeDraft.destination === 'point'" for="route-to">
                    To Jump Point
                    <select id="route-to" v-model="routeDraft.toPointId" required>
                      <option value="" disabled>Select a different Jump Point</option>
                      <option v-for="reference in routeDestinationPoints" :key="reference.point.id" :value="reference.point.id">
                        {{ reference.point.name }} ({{ reference.system.name }})
                      </option>
                    </select>
                  </label>
                  <label v-else for="route-exit">
                    Unresolved exit label
                    <input id="route-exit" v-model="routeDraft.unresolvedExit" maxlength="80" required>
                  </label>
                  <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
                  <div class="flex flex-wrap gap-2">
                    <button class="primary-button" type="submit" :disabled="saveState === 'saving'">
                      Create Jump Route
                    </button>
                    <button class="quiet-button" type="button" @click="routeFormOpen = false">
                      Cancel
                    </button>
                  </div>
                </template>
                <template v-else>
                  <p class="empty-copy m-0" role="status">Open a star system and add a Jump Point before creating a route.</p>
                  <button class="quiet-button justify-self-start" type="button" @click="routeFormOpen = false">
                    Cancel
                  </button>
                </template>
              </form>
            </template>

            <template v-else>
              <span class="section-kicker">CLUSTER DETAILS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ workspace.cluster.name }}</h2>
              <p class="inspector-intro mb-[1em]">
                Choose a route to inspect its logical Jump Point endpoints, or open a system to edit its local map.
              </p>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[#ddd4c4] py-[0.8rem]">
                <span>Star systems</span>
                <strong>{{ workspace.cluster.systems.length }}</strong>
                <span>Jump Routes</span>
                <strong>{{ workspace.cluster.routes.length }}</strong>
                <span>Logical Jump Points</span>
                <strong>{{ jumpPoints.length }}</strong>
              </div>
              <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
            </template>
          </aside>
        </div>
      </section>

      <section v-else-if="selectedSystem" class="editor">
        <header class="editor-heading mb-[1.2rem] flex items-end justify-between gap-4 max-[760px]:items-start max-[760px]:flex-col">
          <div>
            <span class="section-kicker">STAR SYSTEM / SCHEMATIC</span>
            <h1 class="mt-[0.45rem] mb-[0.4rem] text-[clamp(2.1rem,4vw,3.2rem)] tracking-[-0.04em]">{{ selectedSystem.name }}</h1>
            <p class="m-0">Plot known places by hand. Orbit rings describe hierarchy, never scale.</p>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <button class="secondary-button" type="button" @click="showClusterMap">Cluster map</button>
            <div class="chart-stats flex flex-none gap-5 pb-[0.35rem] max-[760px]:gap-[0.9rem]" aria-label="Current system contents">
              <span><strong class="mb-[0.2rem] block text-center">{{ selectedSystem.objects.filter(object => object.subtype === 'star').length }}</strong> STARS</span>
              <span><strong class="mb-[0.2rem] block text-center">{{ selectedSystem.objects.length }}</strong> OBJECTS</span>
              <span><strong class="mb-[0.2rem] block text-center">{{ selectedSystem.orbits.length }}</strong> ORBITS</span>
            </div>
          </div>
        </header>

        <div class="editor-grid grid min-h-[690px] grid-cols-[minmax(14rem,0.75fr)_minmax(0,2.15fr)_minmax(17rem,0.95fr)] items-stretch gap-[0.7rem] max-[1200px]:grid-cols-[minmax(13rem,0.75fr)_minmax(0,2fr)] max-[760px]:flex max-[760px]:flex-col">
          <aside class="panel hierarchy-panel min-w-0 overflow-auto p-4 max-[760px]:order-1" aria-label="System hierarchy">
            <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
              <div>
                <span class="section-kicker">LOCAL ARCHIVE</span>
                <h2 class="mt-[0.28rem] mb-0 text-2xl">Hierarchy</h2>
              </div>
              <button class="quiet-button" type="button" @click="showChartDetails">
                Chart details
              </button>
            </div>

            <details class="chart-names my-4 border-y border-[#ddd4c4]">
              <summary class="cursor-pointer py-[0.7rem]">Chart names</summary>
              <form class="name-form grid gap-2 pb-[0.9rem]" @submit.prevent="submitNames">
                <label for="edit-cluster-name">Jump Cluster</label>
                <input id="edit-cluster-name" v-model="clusterName" maxlength="80" required>
                <label for="edit-system-name">Star system</label>
                <input id="edit-system-name" v-model="systemName" maxlength="80" required>
                <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
                <button class="secondary-button mt-[0.3rem] min-h-[2.25rem] justify-center" type="submit" :disabled="saveState === 'saving'">
                  Save chart names
                </button>
              </form>
            </details>

            <nav class="system-list mt-[0.8rem] mb-5 grid gap-[0.35rem]" aria-label="Star systems">
              <span class="subsection-label">STAR SYSTEMS</span>
              <button
                v-for="system in workspace.cluster.systems"
                :key="system.id"
                class="system-link flex min-h-[2.7rem] w-full cursor-pointer items-center gap-[0.6rem] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                :class="{ active: system.id === selectedSystemId }"
                type="button"
                :aria-current="system.id === selectedSystemId ? 'page' : undefined"
                @click="selectSystem(system.id)"
              >
                <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[#aab1a7]">SY</span>
                <span>{{ system.name }}<small class="mt-[0.18rem] block">{{ system.objects.length }} map objects</small></span>
              </button>
            </nav>

            <div class="tree-heading flex justify-between gap-[0.4rem] border-t border-[#ddd4c4] pt-[0.65rem] pb-[0.45rem]">
              <span class="subsection-label">OBJECTS / ORBITS</span>
              <span class="tree-count whitespace-nowrap">{{ hierarchyRows.length }} records</span>
            </div>
            <nav class="object-tree grid gap-[0.1rem]" aria-label="Map object and Orbit hierarchy">
              <p v-if="hierarchyRows.length === 0" class="empty-copy my-[0.65rem]">No objects charted yet.</p>
              <template v-for="row in hierarchyRows" :key="row.kind === 'object' ? row.object.id : row.orbit.id">
                <button
                  v-if="row.kind === 'object'"
                  class="tree-row object-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                  :class="{ active: row.object.id === selectedObjectId }"
                  type="button"
                  :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
                  :aria-label="`Select ${row.object.locationKey}, ${row.object.name}`"
                  :aria-current="row.object.id === selectedObjectId ? 'true' : undefined"
                  @click="selectObject(row.object.id)"
                >
                  <span class="key-tag">{{ row.object.locationKey }}</span>
                  <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
                    {{ row.object.name }}
                    <small class="mt-[0.18rem] block">{{ row.object.family }} / {{ row.object.subtype }}</small>
                  </span>
                </button>
                <button
                  v-else
                  class="tree-row orbit-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                  :class="{ active: row.orbit.id === selectedOrbitId }"
                  type="button"
                  :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
                  :aria-label="`Orbit ${row.orbit.order} around ${row.host.name}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`"
                  :aria-current="row.orbit.id === selectedOrbitId ? 'true' : undefined"
                  @click="selectOrbit(row.orbit.id)"
                >
                  <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[#8c977f]" aria-hidden="true">○</span>
                  <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
                    Orbit {{ row.orbit.order }}
                    <small class="mt-[0.18rem] block">{{ row.host.name }} / {{ row.childCount }} object{{ row.childCount === 1 ? '' : 's' }}</small>
                  </span>
                </button>
              </template>
            </nav>
            <details class="my-4 border-t border-[#ddd4c4] pt-3">
              <summary class="cursor-pointer py-2 text-[0.68rem]">Field definitions</summary>
              <form class="field-stack mt-3 grid gap-3" @submit.prevent="saveNativeFieldOptions">
                <label for="atmosphere-choices">
                  Atmosphere choices, one per line
                  <textarea id="atmosphere-choices" v-model="nativeFieldDrafts.atmosphereOptions" rows="3" />
                </label>
                <label for="port-class-choices">
                  Port class choices, one per line
                  <textarea id="port-class-choices" v-model="nativeFieldDrafts.portClassOptions" rows="3" />
                </label>
                <button class="secondary-button min-h-[2.25rem] justify-center" type="submit" :disabled="saveState === 'saving'">
                  Save native field options
                </button>
              </form>

              <form class="field-stack mt-4 grid gap-3 border-t border-[#ddd4c4] pt-3" @submit.prevent="createCustomField">
                <span class="section-kicker">NEW CUSTOM FIELD</span>
                <label for="new-custom-field-name">
                  Custom field label
                  <input id="new-custom-field-name" v-model="newCustomFieldName" maxlength="80" required>
                </label>
                <label for="new-custom-field-type">
                  Value type
                  <select id="new-custom-field-type" v-model="newCustomFieldType">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="single-select">Single-select</option>
                  </select>
                </label>
                <label v-if="newCustomFieldType === 'single-select'" for="new-custom-field-options">
                  New field choices, one per line
                  <textarea id="new-custom-field-options" v-model="newCustomFieldOptions" rows="3" />
                </label>
                <button class="secondary-button min-h-[2.25rem] justify-center" type="submit" :disabled="saveState === 'saving'">
                  Add custom field
                </button>
              </form>

              <div v-if="workspace.objectFieldSettings.customFields.length" class="mt-4 grid gap-4 border-t border-[#ddd4c4] pt-3">
                <div v-for="field in workspace.objectFieldSettings.customFields" :key="field.id" class="grid gap-2">
                  <span class="tree-copy [overflow-wrap:anywhere]">
                    {{ field.name }}
                    <small class="mt-[0.18rem] block">{{ field.type }}</small>
                  </span>
                  <label v-if="field.type === 'single-select'" :for="`custom-field-options-${field.id}`">
                    {{ field.name }} choices, one per line
                    <textarea
                      :id="`custom-field-options-${field.id}`"
                      v-model="customFieldOptionDrafts[field.id]"
                      rows="3"
                    />
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-if="field.type === 'single-select'"
                      class="secondary-button min-h-[2.25rem] justify-center"
                      type="button"
                      :disabled="saveState === 'saving'"
                      @click="saveCustomFieldOptions(field.id)"
                    >
                      Save {{ field.name }} choices
                    </button>
                    <button
                      class="quiet-button min-h-[2.25rem] justify-center"
                      type="button"
                      :disabled="saveState === 'saving'"
                      @click="deleteCustomField(field.id)"
                    >
                      Delete {{ field.name }}
                    </button>
                  </div>
                </div>
              </div>
              <p v-if="fieldSettingsError" class="feedback m-0 error-text" role="alert">{{ fieldSettingsError }}</p>
            </details>
            <p class="hierarchy-note mt-4 mb-0 border-t border-[#ddd4c4] pt-[0.8rem]">Select an object, then add an Orbit to it. Empty Orbits are kept in the chart.</p>
          </aside>

          <section class="panel map-panel flex min-w-0 flex-col p-[0.7rem]" aria-label="System map workspace">
            <div class="map-toolbar flex flex-wrap items-center gap-[0.45rem] pt-[0.1rem] pb-[0.65rem]" role="toolbar" aria-label="System map editing">
              <label class="sr-only" for="catalogue-object-type">Catalogue object type</label>
              <select class="w-auto min-w-[8rem] min-h-[2.3rem] px-[0.6rem] pr-[1.8rem] py-[0.45rem] text-[0.68rem]" id="catalogue-object-type" v-model="newObjectType" aria-label="Catalogue object type">
                <option v-for="type in catalogueTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              <button class="tool-button add-button" type="button" @click="addObject">
                <span aria-hidden="true">+</span> Add object
              </button>
              <button class="tool-button" type="button" @click="downloadSystemJson">
                Export star system JSON
              </button>
              <button
                class="tool-button"
                type="button"
                :disabled="!systemMapRef"
                @click="downloadMapImage(systemMapRef, selectedSystem?.name, 'star-system', 'png')"
              >
                Export star system PNG
              </button>
              <button
                class="tool-button"
                type="button"
                :disabled="!systemMapRef"
                @click="downloadMapImage(systemMapRef, selectedSystem?.name, 'star-system', 'svg')"
              >
                Export star system SVG
              </button>
              <button class="tool-button" type="button" :disabled="saveState === 'saving'" @click="openJsonImportPicker">
                Import JSON copy
              </button>
              <button
                class="tool-button"
                type="button"
                :disabled="!selectedObject"
                @click="addOrbit"
              >
                <span aria-hidden="true">+</span> Add orbit
              </button>
              <span v-if="selectedOrbit" class="placement-hint ml-auto">
                New objects go in Orbit {{ selectedOrbit.order }}
              </span>
            </div>
            <p v-if="exportError" class="feedback m-0 error-text" role="alert">{{ exportError }}</p>
            <div class="map-frame flex min-h-[31rem] min-w-0 flex-1 overflow-hidden border border-[#bdb3a0] bg-[#f4eee2] max-[760px]:min-h-96">
              <ClientOnly>
                <SystemMap
                  ref="systemMapRef"
                  :system="selectedSystem"
                  :orbit-radii="workspace.layout.orbitRadii"
                  :object-angles="workspace.layout.objectAngles"
                  :selected-object-id="selectedObjectId"
                  :selected-orbit-id="selectedOrbitId"
                  @select-object="selectObject"
                  @select-orbit="selectOrbit"
                  @move-object="moveMapObject"
                  @rotate-object="rotateMapObject"
                  @resize-orbit="resizeMapOrbit"
                />
                <template #fallback>
                  <div class="map-fallback grid min-h-[31rem] w-full place-items-center max-[760px]:min-h-96" role="status">Preparing the orbital chart...</div>
                </template>
              </ClientOnly>
            </div>
            <p class="map-note mb-[1em] flex justify-between gap-3 px-[0.2rem] pt-[0.55rem] pb-[0.1rem] max-[760px]:flex-col">
              <span>SCHEMATIC / NOT TO SCALE</span>
              <span>Select a mark or Orbit to inspect it.</span>
            </p>
          </section>

          <aside class="panel inspector-panel min-w-0 overflow-auto p-4 max-[1200px]:col-span-full max-[760px]:order-2" aria-label="Object inspector">
            <template v-if="selectedObject">
              <span class="section-kicker">MAP OBJECT / SELECTED</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[#d2c8b7] px-[0.4rem] py-[0.27rem]">{{ selectedObject.family }} / {{ selectedObject.subtype }}</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ selectedObject.name }}</h2>
              <p class="inspector-intro mb-[1em]">
                A stable map record. Edit its keyed description without leaving the current chart.
              </p>

              <div class="field-stack mt-4 grid gap-3">
                <label v-if="selectedObject.family === 'Other'" :for="`object-type-${selectedObject.id}`">
                  Type label
                  <input
                    :id="`object-type-${selectedObject.id}`"
                    v-model="objectDraft.subtype"
                    autocomplete="off"
                    required
                    @change="saveObjectField('subtype')"
                  >
                </label>
                <label :for="`object-key-${selectedObject.id}`">
                  Location key
                  <input
                    :id="`object-key-${selectedObject.id}`"
                    v-model="objectDraft.locationKey"
                    autocomplete="off"
                    required
                    @change="saveObjectField('locationKey')"
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
                    @change="saveObjectField('name')"
                  >
                </label>
                <label :for="`object-placement-${selectedObject.id}`">
                  Placement
                  <select
                    :id="`object-placement-${selectedObject.id}`"
                    v-model="objectDraft.placement"
                    @change="savePlacement"
                  >
                    <option value="system">System-level position</option>
                    <optgroup v-if="placeableOrbits.length" label="Hosted Orbits">
                      <option
                        v-for="orbit in placeableOrbits"
                        :key="orbit.id"
                        :value="`orbit:${orbit.id}`"
                      >
                        Orbit {{ orbit.order }} around {{ selectedSystem?.objects.find(object => object.id === orbit.hostId)?.name }}
                      </option>
                    </optgroup>
                  </select>
                </label>
                <label v-if="selectedObject.family === 'JumpPoint'" :for="`jump-station-${selectedObject.id}`">
                  Physical Jump Station
                  <select
                    :id="`jump-station-${selectedObject.id}`"
                    v-model="objectDraft.jumpStationId"
                    @change="saveJumpStation"
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
                    @change="saveNativeObjectField('atmosphere')"
                  >
                    <option value="">Not set</option>
                    <option
                      v-for="option in workspace.objectFieldSettings.atmosphereOptions"
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
                    @change="saveNativeObjectField('portClass')"
                  >
                    <option value="">Not set</option>
                    <option
                      v-for="option in workspace.objectFieldSettings.portClassOptions"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>
                </label>
                <template v-for="field in workspace.objectFieldSettings.customFields" :key="field.id">
                  <label v-if="field.type === 'text'" :for="`custom-field-value-${field.id}`">
                    {{ field.name }}
                    <textarea
                      :id="`custom-field-value-${field.id}`"
                      :aria-label="field.name"
                      v-model="objectDraft.customFieldValues[field.id]"
                      rows="3"
                      @change="saveCustomFieldValue(field.id)"
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
                      @change="saveCustomFieldValue(field.id)"
                    >
                  </label>
                  <label v-else-if="field.type === 'boolean'" :for="`custom-field-value-${field.id}`">
                    {{ field.name }}
                    <select
                      :id="`custom-field-value-${field.id}`"
                      :aria-label="field.name"
                      v-model="objectDraft.customFieldValues[field.id]"
                      @change="saveCustomFieldValue(field.id)"
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
                      @change="saveCustomFieldValue(field.id)"
                    >
                      <option value="">Not set</option>
                      <option v-for="option in field.options" :key="option" :value="option">
                        {{ option }}
                      </option>
                    </select>
                  </label>
                </template>
                <div v-if="selectedObject.placement.kind === 'system'" class="coordinate-fields grid grid-cols-2 gap-[0.6rem]">
                  <label :for="`object-x-${selectedObject.id}`">
                    Schematic X
                    <input
                      :id="`object-x-${selectedObject.id}`"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      v-model="objectDraft.x"
                      required
                      @change="savePosition('x')"
                    >
                  </label>
                  <label :for="`object-y-${selectedObject.id}`">
                    Schematic Y
                    <input
                      :id="`object-y-${selectedObject.id}`"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      v-model="objectDraft.y"
                      required
                      @change="savePosition('y')"
                    >
                  </label>
                </div>
                <label :for="`object-description-${selectedObject.id}`">
                  Description
                  <textarea
                    :id="`object-description-${selectedObject.id}`"
                    rows="5"
                    v-model="objectDraft.description"
                    @change="saveObjectField('description')"
                  />
                </label>
              </div>
              <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
              <button
                class="quiet-button mt-4"
                type="button"
                :aria-label="`Delete ${selectedObject.name}`"
                :disabled="saveState === 'saving'"
                @click="deleteSelectedObject"
              >
                Delete object
              </button>
              <p class="inspector-footnote mt-4 mb-0 border-t border-[#ddd4c4] pt-3">Location keys are required and unique within this star system.</p>
            </template>

            <template v-else-if="selectedOrbit">
              <span class="section-kicker">SYSTEM STRUCTURE / SELECTED</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[#d2c8b7] px-[0.4rem] py-[0.27rem]">UNKEYED PLACEMENT</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Orbit {{ selectedOrbit?.order }}</h2>
              <p class="inspector-intro mb-[1em]">
                Hosted by {{ selectedSystem.objects.find(object => object.id === selectedOrbit?.hostId)?.name }}.
                Orbit rings show structure, not measured distance.
              </p>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[#ddd4c4] py-[0.8rem]">
                <span>Objects placed</span>
                <strong>{{ selectedSystem.objects.filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === selectedOrbit?.id).length }}</strong>
              </div>
              <div class="orbit-actions flex gap-2" aria-label="Reorder Orbit">
                <button
                  class="secondary-button"
                  type="button"
                  aria-label="Move orbit up"
                  :disabled="!canMoveSelectedOrbit(-1) || saveState === 'saving'"
                  @click="reorderSelectedOrbit(-1)"
                >
                  Move up
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  aria-label="Move orbit down"
                  :disabled="!canMoveSelectedOrbit(1) || saveState === 'saving'"
                  @click="reorderSelectedOrbit(1)"
                >
                  Move down
                </button>
              </div>
              <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
              <button
                class="quiet-button mt-4"
                type="button"
                :aria-label="selectedOrbitDeleteLabel"
                :disabled="saveState === 'saving'"
                @click="deleteSelectedOrbit"
              >
                Delete Orbit and contents
              </button>
              <p class="inspector-footnote mt-4 mb-0 border-t border-[#ddd4c4] pt-3">Orbits are unkeyed, may remain empty, and can be nested below any map object.</p>
            </template>

            <template v-else>
              <span class="section-kicker">CHART DETAILS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ selectedSystem.name }}</h2>
              <p class="inspector-intro mb-[1em]">
                Choose a map object or Orbit to inspect it. Chart names remain editable here.
              </p>
              <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitNames">
                <label for="detail-cluster-name">Jump Cluster</label>
                <input id="detail-cluster-name" v-model="clusterName" maxlength="80" required>
                <label for="detail-system-name">Star system</label>
                <input id="detail-system-name" v-model="systemName" maxlength="80" required>
                <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
                <button class="primary-button mt-[0.65rem]" type="submit" :disabled="saveState === 'saving'">
                  Save chart names
                </button>
              </form>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[#ddd4c4] py-[0.8rem]">
                <span>Map objects</span>
                <strong>{{ selectedSystem.objects.length }}</strong>
                <span>Nested Orbits</span>
                <strong>{{ selectedSystem.orbits.length }}</strong>
              </div>
            </template>
          </aside>
        </div>
      </section>
    </main>

    <footer class="footer flex min-h-14 items-center justify-between gap-4 border-t border-[#bdb3a0] border-b-0 text-[#70786e] text-[0.52rem] tracking-[0.12em] uppercase max-[760px]:gap-2 max-[760px]:text-[0.43rem]">
      <span>WARDEN'S FIELD DESK</span>
      <span
        class="save-feedback p-0 text-[0.65rem] normal-case"
        :class="{ 'error-text': saveState === 'error', 'saved-text': saveState === 'saved' && !hasUncommittedNames }"
        :role="saveState === 'error' ? 'alert' : 'status'"
        :aria-live="saveState === 'error' ? 'assertive' : 'polite'"
      >
        <span class="inline-block size-[0.4rem] shrink-0 rounded-full bg-[#82956f]" aria-hidden="true"></span>
        {{ saveMessage }}
      </span>
      <span>LOCAL STORAGE / NO ACCOUNT</span>
    </footer>
  </div>
</template>

<style>
:root {
  color-scheme: light;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  background: #e7dfd0;
  color: #29332d;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

body {
  background:
    radial-gradient(ellipse at 74% 15%, rgba(255, 255, 255, 0.45), transparent 36rem),
    repeating-linear-gradient(0deg, rgba(70, 57, 38, 0.025) 0 1px, transparent 1px 5px),
    #e7dfd0;
}

button,
a,
input,
select,
textarea {
  -webkit-tap-highlight-color: transparent;
}

.wordmark-symbol {
  color: #a45138;
  font-family: Georgia, serif;
  font-size: 1.1rem;
}

.wordmark strong {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
}

.wordmark small {
  color: #70786e;
  font-size: 0.55rem;
  letter-spacing: 0.13em;
}

.cluster-stamp small,
.local-badge,
.section-kicker,
.step-marker,
.subsection-label,
.tree-count,
.chart-stats {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cluster-stamp small {
  color: #7b8176;
}

.cluster-stamp strong {
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
}

.section-kicker {
  color: #a45138;
}

h1,
h2 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 400;
}

.intro p,
.message-panel > p {
  color: #657067;
  font-size: 0.95rem;
  line-height: 1.75;
}

.panel,
.setup-panel,
.message-panel {
  border: 1px solid #c9c0b0;
  background: rgba(249, 245, 236, 0.88);
  box-shadow: 0 1.2rem 3.6rem rgba(51, 48, 39, 0.08);
}

.step-marker,
.tree-count {
  color: #7b8176;
  font-variant-numeric: tabular-nums;
}

label {
  color: #697168;
  font-size: 0.67rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

input:hover,
select:hover,
textarea:hover {
  border-color: #8d968b;
}

input[aria-invalid="true"],
select[aria-invalid="true"],
textarea[aria-invalid="true"] {
  border-color: #a45138;
  background: #fff3eb;
}

.primary-button,
.secondary-button,
.quiet-button,
.tool-button {
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.primary-button {
  border-color: #29332d;
  background: #29332d;
  color: #faf5eb;
}

.primary-button:hover:not(:disabled) {
  border-color: #a45138;
  background: #a45138;
}

.secondary-button,
.quiet-button {
  background: transparent;
  color: #43584b;
}

.secondary-button:hover:not(:disabled),
.quiet-button:hover:not(:disabled) {
  border-color: #a45138;
  color: #a45138;
}

.save-feedback {
  color: #637064;
  line-height: 1.5;
}

.saved-text {
  color: #526b53;
}

.error-text {
  color: #9c4932;
}

.feedback {
  font-size: 0.75rem;
  line-height: 1.5;
}

.error-panel {
  border-color: #c78d78;
}

.editor-heading p {
  color: #657067;
  font-size: 0.8rem;
}

.chart-stats {
  color: #71786f;
}

.chart-stats strong {
  color: #29332d;
  font-family: Georgia, serif;
  font-size: 1.15rem;
  font-weight: 400;
}

.chart-names summary {
  color: #43584b;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.subsection-label {
  color: #797f75;
  font-size: 0.56rem;
}

.system-link,
.tree-row {
  color: #29332d;
}

.system-link {
  font-size: 0.75rem;
}

.system-link:hover,
.tree-row:hover {
  border-color: #d2c8b7;
  background: #fffaf0;
}

.system-link.active,
.tree-row.active {
  border-color: #c8bca9;
  background: #fffaf0;
}

.system-seal {
  color: #526c5d;
  font: 0.55rem Consolas, monospace;
}

.system-link small,
.tree-copy small {
  color: #778075;
  font: 0.58rem Consolas, monospace;
}

.tree-count {
  font-size: 0.52rem;
}

.tree-row {
  font-size: 0.7rem;
}

.key-tag {
  font: 0.58rem Consolas, monospace;
}

.orbit-row {
  color: #43584b;
}

.hierarchy-panel .orbit-mark {
  font-size: 1.2rem;
}

.empty-copy,
.hierarchy-note {
  color: #788075;
  font-size: 0.68rem;
  line-height: 1.55;
}

.tool-button {
  background: #fffaf0;
  color: #40594a;
  font-size: 0.67rem;
}

.tool-button span {
  color: #a45138;
  font-size: 1.05rem;
}

.tool-button:hover:not(:disabled) {
  border-color: #a45138;
  color: #a45138;
}

.add-button {
  border-color: #8c9a8a;
  background: #526a5a;
  color: #fffaf0;
}

.add-button span {
  color: #f0d69b;
}

.add-button:hover:not(:disabled) {
  border-color: #a45138;
  background: #a45138;
  color: #fffaf0;
}

.placement-hint {
  color: #70786f;
  font: 0.58rem Consolas, monospace;
}

.map-fallback {
  color: #69746a;
  font: 0.8rem Georgia, serif;
}

.map-note {
  color: #737a70;
  font: 0.56rem Consolas, monospace;
}

.map-note span:first-child {
  color: #a45138;
}

.type-chip {
  color: #526c5d;
  font: 0.55rem Consolas, monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.inspector-intro {
  color: #727a70;
  font-size: 0.7rem;
  line-height: 1.55;
}

.orbit-facts {
  font-size: 0.7rem;
}

.orbit-facts span {
  color: #6e786e;
}

.orbit-facts strong {
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 400;
}

.inspector-footnote {
  color: #788075;
  font-size: 0.66rem;
  line-height: 1.55;
}

</style>
