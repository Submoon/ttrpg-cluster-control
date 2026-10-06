<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
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
  renameCustomFieldDefinition,
  removeCustomFieldDefinition,
  updateJumpRoute,
  updateCustomFieldOptions,
  updateNativeFieldOptions,
  type CustomFieldValue,
  type JsonImportSummary,
  type JumpRoute,
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
import { catalogueMarks, objectMark } from '../utils/catalogue-marks'

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
  jumpLevel: string
  fromPointId: string
  destination: 'point' | 'external'
  toPointId: string
  unresolvedExit: string
}
type NativeFieldId = 'native:atmosphere' | 'native:port-class'
type FieldDefinitionSummary =
  | {
      id: NativeFieldId
      name: 'Atmosphere' | 'Port class'
      kind: 'native'
      nativeField: 'atmosphere' | 'portClass'
      type: 'single-select'
      options: string[]
    }
  | {
      id: string
      name: string
      kind: 'custom'
      type: CustomFieldType
      options: string[]
    }
interface FieldValueAssignment {
  objectId: string
  objectName: string
  systemName: string
  value: CustomFieldValue
}
type PendingFieldDefinitionChange =
  | {
      kind: 'save'
      fieldId: string
      fieldName: string
      name: string
      options: string[]
      affectedAssignments: FieldValueAssignment[]
    }
  | {
      kind: 'remove'
      fieldId: string
      fieldName: string
      affectedAssignments: FieldValueAssignment[]
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
const activeView = ref<'cluster' | 'system'>('system')
const selectedSystemId = ref<string | null>(null)
const selectedObjectId = ref<string | null>(null)
const selectedOrbitId = ref<string | null>(null)
const selectedRouteId = ref<string | null>(null)
const objectEditSnapshot = shallowRef<SystemObject | null>(null)
const editingRouteId = ref<string | null>(null)
const orbitEditing = ref(false)
const orbitOrderDraft = ref('')
const chartNamesEditing = ref(false)
const routeFormOpen = ref(false)
const hierarchyPanelOpen = ref(true)
const inspectorPanelOpen = ref(true)
const isCompactViewport = ref(false)
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
const newCustomFieldName = ref('')
const newCustomFieldType = ref<CustomFieldType>('text')
const newCustomFieldOptions = ref('')
const newCustomFieldFormOpen = ref(false)
const fieldDefinitionDialogOpen = ref(false)
const fieldDefinitionsDialog = ref<HTMLDialogElement | null>(null)
const fieldDefinitionsTrigger = ref<HTMLButtonElement | null>(null)
const selectedFieldDefinitionId = ref<NativeFieldId | string>('native:atmosphere')
const fieldDefinitionNameDraft = ref('')
const fieldDefinitionOptionsDraft = ref('')
const fieldDefinitionError = ref('')
const pendingFieldDefinitionChange = ref<PendingFieldDefinitionChange | null>(null)
const fieldDefinitionEditing = ref(false)
const routeDraft = reactive<JumpRouteDraft>({
  jumpLevel: '1',
  fromPointId: '',
  destination: 'external',
  toPointId: '',
  unresolvedExit: 'Uncharted exit',
})
const formError = ref('')
const editorError = ref('')
const exportError = ref('')
const headerMapActionsOpen = ref(false)
const headerMapActionsToggle = ref<HTMLButtonElement | null>(null)
const clusterMapRef = shallowRef<MapImageExporter | null>(null)
const systemMapRef = shallowRef<MapImageExporter | null>(null)

function updateViewportMode(): void {
  isCompactViewport.value = window.matchMedia('(max-width: 760px)').matches
  if (isCompactViewport.value && hierarchyPanelOpen.value && inspectorPanelOpen.value) {
    inspectorPanelOpen.value = false
  }
}

function toggleHierarchyPanel(): void {
  if (!hierarchyPanelOpen.value && isCompactViewport.value) inspectorPanelOpen.value = false
  hierarchyPanelOpen.value = !hierarchyPanelOpen.value
}

function toggleInspectorPanel(): void {
  if (!inspectorPanelOpen.value && isCompactViewport.value) hierarchyPanelOpen.value = false
  inspectorPanelOpen.value = !inspectorPanelOpen.value
}
const importError = ref('')
const jsonImportInput = ref<HTMLInputElement | null>(null)
const objectPaletteGroups = [
  { family: 'CelestialBody', label: 'Celestial bodies' },
  { family: 'SmallBody/Field', label: 'Small bodies and fields' },
  { family: 'Installation', label: 'Installations' },
  { family: 'Vessel', label: 'Vessels' },
  { family: 'JumpPoint', label: 'Jump Points' },
  { family: 'Phenomenon', label: 'Phenomena' },
  { family: 'Other', label: 'Other' },
].map(group => ({
  ...group,
  types: catalogueTypes.filter(type => type.family === group.family),
}))
const activeObjectPaletteFamily = ref(objectPaletteGroups[0]!.family)
const activeObjectPaletteGroup = computed(() =>
  objectPaletteGroups.find(group => group.family === activeObjectPaletteFamily.value)!,
)
const selectedSystem = computed(() =>
  workspace.value?.cluster.systems.find(system => system.id === selectedSystemId.value),
)
const mapFileScope = computed(() => activeView.value === 'cluster'
  ? `Jump Cluster ${workspace.value?.cluster.name ?? ''}`
  : `star system ${selectedSystem.value?.name ?? ''}`,
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
const objectEditing = computed(() =>
  objectEditSnapshot.value?.id === selectedObject.value?.id && !!selectedObject.value,
)
const chartDetailsActive = computed(() =>
  !selectedObject.value && !selectedOrbit.value && !selectedRoute.value && !routeFormOpen.value,
)
const jumpPoints = computed(() =>
  workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [],
)
const routeDestinationPoints = computed(() =>
  jumpPoints.value.filter(({ point }) => point.id !== routeDraft.fromPointId),
)
const routeDraftDestination = computed(() =>
  routeDestinationPoints.value.find(({ point }) => point.id === routeDraft.toPointId),
)
function routeEndpointSummary(route: JumpRoute): string {
  const origin = jumpPoints.value.find(({ point }) => point.id === route.fromPointId)
  let destination: string
  if (route.toPointId === null) {
    destination = `Unknown destination: ${route.unresolvedExit}`
  } else {
    const reference = jumpPoints.value.find(({ point }) => point.id === route.toPointId)
    destination = reference
      ? `${reference.point.name} (${reference.system.name})`
      : 'Missing Jump Point'
  }

  const originName = origin ? `${origin.point.name} (${origin.system.name})` : 'Missing Jump Point'
  return `${originName} -> ${destination}`
}
const physicalStations = computed(() =>
  selectedSystem.value?.objects.filter(object => object.family === 'Installation' && object.subtype === 'station') ?? [],
)
const selectedOrbitDeleteLabel = computed(() => {
  const orbit = selectedOrbit.value
  if (!orbit) return 'Delete Orbit'
  const hostName = selectedSystem.value?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Delete Orbit ${orbit.order} around ${hostName}`
})
function fieldDefinitionsFor(currentWorkspace: LocalWorkspace): FieldDefinitionSummary[] {
  return [
    {
      id: 'native:atmosphere',
      name: 'Atmosphere',
      kind: 'native',
      nativeField: 'atmosphere',
      type: 'single-select',
      options: currentWorkspace.objectFieldSettings.atmosphereOptions,
    },
    {
      id: 'native:port-class',
      name: 'Port class',
      kind: 'native',
      nativeField: 'portClass',
      type: 'single-select',
      options: currentWorkspace.objectFieldSettings.portClassOptions,
    },
    ...currentWorkspace.objectFieldSettings.customFields.map((field): FieldDefinitionSummary => ({
      id: field.id,
      name: field.name,
      kind: 'custom',
      type: field.type,
      options: field.type === 'single-select' ? field.options : [],
    })),
  ]
}
const fieldDefinitions = computed(() =>
  workspace.value ? fieldDefinitionsFor(workspace.value) : [],
)
const nativeFieldDefinitions = computed(() =>
  fieldDefinitions.value.filter(field => field.kind === 'native'),
)
const customFieldDefinitions = computed(() =>
  fieldDefinitions.value.filter(field => field.kind === 'custom'),
)
const selectedFieldDefinition = computed(() =>
  fieldDefinitions.value.find(field => field.id === selectedFieldDefinitionId.value),
)
function fieldValueAssignments(
  currentWorkspace: LocalWorkspace,
  definition: FieldDefinitionSummary,
): FieldValueAssignment[] {
  const assignments: FieldValueAssignment[] = []
  for (const system of currentWorkspace.cluster.systems) {
    for (const object of system.objects) {
      const value = definition.kind === 'native'
        ? object[definition.nativeField]
        : object.customFieldValues?.[definition.id]
      if (value === undefined || value === '') continue
      assignments.push({
        objectId: object.id,
        objectName: object.name,
        systemName: system.name,
        value,
      })
    }
  }
  return assignments
}
const selectedFieldAssignments = computed(() => {
  const currentWorkspace = workspace.value
  const definition = selectedFieldDefinition.value
  return currentWorkspace && definition ? fieldValueAssignments(currentWorkspace, definition) : []
})
function fieldOptionsFromText(value: string): string[] {
  return value.split(/\r?\n/u).map(option => option.trim()).filter(Boolean)
}
const affectedFieldAssignments = computed(() => {
  const definition = selectedFieldDefinition.value
  if (!definition || definition.type !== 'single-select') return []
  const options = fieldOptionsFromText(fieldDefinitionOptionsDraft.value)
  return selectedFieldAssignments.value.filter(assignment =>
    typeof assignment.value === 'string' && !options.includes(assignment.value),
  )
})

function selectFieldDefinition(fieldId: string): void {
  const definition = fieldDefinitions.value.find(field => field.id === fieldId)
  if (!definition) return
  if (fieldDefinitionEditing.value) {
    if (fieldId === selectedFieldDefinitionId.value) return
    if (!window.confirm('Discard unsaved field definition edits?')) return
  }

  selectedFieldDefinitionId.value = fieldId
  fieldDefinitionEditing.value = false
  syncFieldDefinitionDraft(definition)
  fieldDefinitionError.value = ''
  pendingFieldDefinitionChange.value = null
}

function syncFieldDefinitionDraft(definition: FieldDefinitionSummary): void {
  fieldDefinitionNameDraft.value = definition.kind === 'custom' ? definition.name : ''
  fieldDefinitionOptionsDraft.value = definition.type === 'single-select'
    ? definition.options.join('\n')
    : ''
}

async function openFieldDefinitions(): Promise<void> {
  if (!workspace.value || fieldDefinitionDialogOpen.value || !confirmDiscardInspectorEdits()) return

  newCustomFieldFormOpen.value = false
  newCustomFieldName.value = ''
  newCustomFieldType.value = 'text'
  newCustomFieldOptions.value = ''
  selectFieldDefinition('native:atmosphere')
  fieldDefinitionDialogOpen.value = true
  await nextTick()

  const dialog = fieldDefinitionsDialog.value
  if (!dialog) throw new Error('The field definitions dialog did not render.')
  dialog.showModal()
}

function closeFieldDefinitions(): void {
  if (fieldDefinitionEditing.value && !window.confirm('Discard unsaved field definition edits?')) return
  const dialog = fieldDefinitionsDialog.value
  if (dialog?.open) dialog.close()
  fieldDefinitionDialogOpen.value = false
  pendingFieldDefinitionChange.value = null
  fieldDefinitionEditing.value = false
  newCustomFieldFormOpen.value = false
  nextTick(() => fieldDefinitionsTrigger.value?.focus())
}

function cancelFieldDefinitionDialog(event: Event): void {
  event.preventDefault()
  closeFieldDefinitions()
}

function openNewCustomFieldForm(): void {
  if (fieldDefinitionEditing.value) {
    if (!window.confirm('Discard unsaved field definition edits?')) return
    cancelFieldDefinitionEdit()
  }
  newCustomFieldName.value = ''
  newCustomFieldType.value = 'text'
  newCustomFieldOptions.value = ''
  newCustomFieldFormOpen.value = true
  fieldDefinitionError.value = ''
}

function beginFieldDefinitionEdit(): void {
  if (!selectedFieldDefinition.value) return
  fieldDefinitionEditing.value = true
  fieldDefinitionError.value = ''
}

function cancelFieldDefinitionEdit(): void {
  pendingFieldDefinitionChange.value = null
  fieldDefinitionEditing.value = false
  const definition = selectedFieldDefinition.value
  if (definition) syncFieldDefinitionDraft(definition)
  fieldDefinitionError.value = ''
}

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

function beginObjectEdit(): void {
  const object = selectedObject.value
  if (!object || !confirmDiscardInspectorEdits()) return

  syncObjectDraft(object)
  objectEditSnapshot.value = object
  editorError.value = ''
}

function cancelObjectEdit(): void {
  objectEditSnapshot.value = null
  syncObjectDraft(selectedObject.value)
  editorError.value = ''
}

watch(selectedObject, object => {
  if (objectEditSnapshot.value?.id !== object?.id) objectEditSnapshot.value = null
  if (!objectEditing.value) syncObjectDraft(object)
}, { immediate: true })
watch(() => workspace.value?.objectFieldSettings, settings => {
  if (!settings) return

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

onMounted(() => {
  updateViewportMode()
  window.addEventListener('resize', updateViewportMode, { passive: true })
  window.addEventListener('keydown', handleDeleteShortcut)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateViewportMode)
  window.removeEventListener('keydown', handleDeleteShortcut)
})
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

function closeHeaderMapActions(): void {
  headerMapActionsOpen.value = false
  headerMapActionsToggle.value?.focus()
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
  if (!file || !workspace.value || !confirmDiscardInspectorEdits()) return

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
  if (objectEditSnapshot.value?.id === objectId) return
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
        x: position.x,
        y: position.y,
      },
    }, objectFieldSettings)
    await saveSystem(updatedSystem)
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function placeMapObjectInOrbit(objectId: string, orbitId: string, angle: number): Promise<void> {
  if (objectEditSnapshot.value?.id === objectId) return
  const currentWorkspace = workspace.value
  const system = selectedSystem.value
  const object = system?.objects.find(candidate => candidate.id === objectId)
  const objectFieldSettings = currentWorkspace?.objectFieldSettings
  if (!currentWorkspace || !system || !object || !objectFieldSettings) return

  try {
    if (!Number.isFinite(angle)) throw new Error('An orbital angle must be finite.')
    if (!canPlaceObjectInOrbit(system, object.id, orbitId)) {
      throw new Error('Choose a valid Orbit for this object.')
    }
    const updatedSystem = updateSystemObject(system, object.id, {
      placement: { kind: 'orbit', orbitId },
    }, objectFieldSettings)
    const nextWorkspace = workspaceWithSystem(currentWorkspace, updatedSystem)
    await commit({
      ...nextWorkspace,
      layout: {
        ...nextWorkspace.layout,
        objectAngles: {
          ...nextWorkspace.layout.objectAngles,
          [objectId]: angle,
        },
      },
    })
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function rotateMapObject(objectId: string, angle: number): Promise<void> {
  if (objectEditSnapshot.value?.id === objectId) return
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
    chartNamesEditing.value = false
  } catch (error) {
    formError.value = errorText(error)
  }
}

function beginChartNamesEdit(): void {
  if (!workspace.value || !selectedSystem.value || !confirmDiscardInspectorEdits()) return
  clusterName.value = workspace.value.cluster.name
  systemName.value = selectedSystem.value.name
  chartNamesEditing.value = true
  formError.value = ''
}

function cancelChartNamesEdit(): void {
  const currentWorkspace = workspace.value
  const system = selectedSystem.value
  if (currentWorkspace && system) {
    clusterName.value = currentWorkspace.cluster.name
    systemName.value = system.name
  }
  chartNamesEditing.value = false
  formError.value = ''
}

function confirmDiscardInspectorEdits(): boolean {
  const hasOpenEdit = objectEditing.value
    || routeFormOpen.value
    || orbitEditing.value
    || chartNamesEditing.value
  if (!hasOpenEdit) return true
  if (!window.confirm('Discard unsaved edits?')) return false

  cancelObjectEdit()
  if (routeFormOpen.value) cancelRouteForm()
  cancelOrbitEdit()
  cancelChartNamesEdit()
  return true
}

async function createSystem(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace || !confirmDiscardInspectorEdits()) return

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
  if (!confirmDiscardInspectorEdits()) return
  activeView.value = 'cluster'
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  editingRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

function selectSystem(systemId: string): void {
  if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
  if (!confirmDiscardInspectorEdits()) return
  selectedSystemId.value = systemId
  activeView.value = 'system'
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  editingRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

function selectObject(objectId: string): void {
  if (!selectedSystem.value?.objects.some(object => object.id === objectId)) return
  if (selectedObjectId.value === objectId) return
  if (!confirmDiscardInspectorEdits()) return
  selectedObjectId.value = objectId
  selectedOrbitId.value = null
  selectedRouteId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  editorError.value = ''
}

function selectOrbit(orbitId: string): void {
  if (!selectedSystem.value?.orbits.some(orbit => orbit.id === orbitId)) return
  if (selectedOrbitId.value === orbitId) return
  if (!confirmDiscardInspectorEdits()) return
  selectedOrbitId.value = orbitId
  selectedObjectId.value = null
  selectedRouteId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  orbitOrderDraft.value = String(selectedSystem.value.orbits.find(orbit => orbit.id === orbitId)?.order ?? '')
  editorError.value = ''
}

function selectRoute(routeId: string): void {
  const route = workspace.value?.cluster.routes.find(candidate => candidate.id === routeId)
  if (!route) return
  if (selectedRouteId.value === routeId) return
  if (!confirmDiscardInspectorEdits()) return

  selectedRouteId.value = route.id
  editingRouteId.value = null
  routeDraft.jumpLevel = String(route.jumpLevel)
  routeDraft.fromPointId = route.fromPointId
  routeDraft.toPointId = route.toPointId ?? ''
  routeDraft.destination = route.toPointId === null ? 'external' : 'point'
  routeDraft.unresolvedExit = route.toPointId === null ? route.unresolvedExit : 'Uncharted exit'
  selectedObjectId.value = null
  selectedOrbitId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  routeFormOpen.value = false
  editorError.value = ''
}

function beginRoute(): void {
  if (!confirmDiscardInspectorEdits()) return
  routeDraft.jumpLevel = '1'
  routeDraft.fromPointId = jumpPoints.value[0]?.point.id ?? ''
  routeDraft.toPointId = routeDestinationPoints.value[0]?.point.id ?? ''
  routeDraft.destination = routeDestinationPoints.value.length ? 'point' : 'external'
  routeDraft.unresolvedExit = 'Uncharted exit'
  selectedRouteId.value = null
  editingRouteId.value = null
  routeFormOpen.value = true
  editorError.value = ''
}

function beginRouteEdit(): void {
  const route = selectedRoute.value
  if (!route) return

  routeDraft.jumpLevel = String(route.jumpLevel)
  routeDraft.fromPointId = route.fromPointId
  routeDraft.toPointId = route.toPointId ?? ''
  routeDraft.destination = route.toPointId === null ? 'external' : 'point'
  routeDraft.unresolvedExit = route.toPointId === null ? route.unresolvedExit : 'Uncharted exit'
  editingRouteId.value = route.id
  selectedRouteId.value = null
  routeFormOpen.value = true
  editorError.value = ''
}

function cancelRouteForm(): void {
  if (editingRouteId.value) selectedRouteId.value = editingRouteId.value
  editingRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

async function submitRoute(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    const route = editingRouteId.value
      ? updateJumpRoute(
          currentWorkspace.cluster,
          editingRouteId.value,
          Number(routeDraft.jumpLevel),
          routeDraft.fromPointId,
          routeDraft.destination === 'external' ? null : routeDraft.toPointId,
          routeDraft.unresolvedExit,
        )
      : createJumpRoute(
          currentWorkspace.cluster,
          Number(routeDraft.jumpLevel),
          routeDraft.fromPointId,
          routeDraft.destination === 'external' ? null : routeDraft.toPointId,
          routeDraft.unresolvedExit,
        )
    const routes = currentWorkspace.cluster.routes.some(existing => existing.id === route.id)
      ? currentWorkspace.cluster.routes.map(existing => existing.id === route.id ? route : existing)
      : [...currentWorkspace.cluster.routes, route]
    await commit({
      ...currentWorkspace,
      cluster: {
        ...currentWorkspace.cluster,
        routes,
      },
    })
    selectedRouteId.value = route.id
    editingRouteId.value = null
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
    const confirmation = plan.affectedEntities.length
      ? `Delete ${plan.entityLabel}?\n\nThis also removes or updates:\n${plan.affectedEntities.map(entity => `- ${entity}`).join('\n')}`
      : `Delete ${plan.entityLabel}?`
    if (!window.confirm(confirmation)) {
      return
    }
    editorError.value = ''
    await commit(plan.workspace)
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function deleteSystem(systemId: string): Promise<void> {
  return confirmDiscardInspectorEdits()
    ? deleteMapEntity({ kind: 'system', systemId })
    : Promise.resolve()
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

function handleDeleteShortcut(event: KeyboardEvent): void {
  const target = event.target
  if (
    event.key !== 'Delete'
    || event.repeat
    || event.defaultPrevented
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || (target instanceof HTMLElement && (
      target.isContentEditable
      || target.closest('input, textarea, select, [contenteditable="true"]')
    ))
    || saveState.value === 'saving'
    || objectEditing.value
    || orbitEditing.value
    || chartNamesEditing.value
    || routeFormOpen.value
    || fieldDefinitionDialogOpen.value
  ) return

  const removeSelected = activeView.value === 'cluster'
    ? selectedRoute.value ? deleteSelectedRoute : undefined
    : selectedObject.value
      ? deleteSelectedObject
      : selectedOrbit.value
        ? deleteSelectedOrbit
        : undefined
  if (!removeSelected) return

  event.preventDefault()
  void removeSelected()
}

function showChartDetails(): void {
  if (!confirmDiscardInspectorEdits()) return
  selectedObjectId.value = null
  selectedOrbitId.value = null
  selectedRouteId.value = null
  objectEditSnapshot.value = null
  orbitEditing.value = false
  editingRouteId.value = null
  routeFormOpen.value = false
  editorError.value = ''
}

async function addObject(
  subtype: CatalogueSubtype,
  dropPoint?: Point,
  dropOrbitId?: string | null,
  dropAngle?: number | null,
): Promise<void> {
  const system = selectedSystem.value
  const currentWorkspace = workspace.value
  if (!system || !currentWorkspace || !confirmDiscardInspectorEdits()) return

  try {
    const orbitId = dropPoint
      ? dropOrbitId ?? undefined
      : selectedOrbitId.value ?? undefined
    let object = createSystemObject(system, subtype, orbitId)
    if (dropPoint && !orbitId) {
      if (!Number.isFinite(dropPoint.x) || !Number.isFinite(dropPoint.y)) {
        throw new Error('The dropped map position must contain finite coordinates.')
      }
      object = {
        ...object,
        placement: {
          kind: 'system',
          x: (dropPoint.x - 64) / 832,
          y: (dropPoint.y - 72) / 416,
        },
      }
    }

    let nextWorkspace = workspaceWithSystem(currentWorkspace, {
      ...system,
      objects: [...system.objects, object],
    })
    if (dropPoint && orbitId && dropAngle !== null && dropAngle !== undefined) {
      if (!Number.isFinite(dropAngle)) {
        throw new Error('An orbital angle must be finite.')
      }
      nextWorkspace = {
        ...nextWorkspace,
        layout: {
          ...nextWorkspace.layout,
          objectAngles: {
            ...nextWorkspace.layout.objectAngles,
            [object.id]: dropAngle,
          },
        },
      }
    }

    selectedObjectId.value = object.id
    selectedOrbitId.value = null
    editorError.value = ''
    await commit(nextWorkspace)
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function startObjectDrag(event: DragEvent, subtype: CatalogueSubtype): void {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return

  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData('application/x-mothership-map-object', subtype)
  dataTransfer.setData('text/plain', subtype)
}

async function addOrbit(): Promise<void> {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || !object || !confirmDiscardInspectorEdits()) return

  try {
    const orbit = createOrbit(system, object.id)
    selectedOrbitId.value = orbit.id
    selectedObjectId.value = null
    objectEditSnapshot.value = null
    orbitEditing.value = false
    editorError.value = ''
    await saveSystem({ ...system, orbits: [...system.orbits, orbit] })
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function beginOrbitEdit(): void {
  const orbit = selectedOrbit.value
  if (!orbit || !confirmDiscardInspectorEdits()) return

  orbitOrderDraft.value = String(orbit.order)
  orbitEditing.value = true
  editorError.value = ''
}

function cancelOrbitEdit(): void {
  orbitOrderDraft.value = String(selectedOrbit.value?.order ?? '')
  orbitEditing.value = false
  editorError.value = ''
}

function reorderSelectedOrbit(direction: -1 | 1): void {
  if (!orbitEditing.value || !canMoveSelectedOrbit(direction)) return
  orbitOrderDraft.value = String(Number(orbitOrderDraft.value) + direction)
}

async function saveOrbitEdit(): Promise<void> {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  const targetOrder = Number(orbitOrderDraft.value)
  if (!system || !orbit) return
  const siblingCount = system.orbits.filter(candidate => candidate.hostId === orbit.hostId).length
  if (!Number.isSafeInteger(targetOrder) || targetOrder < 1 || targetOrder > siblingCount) {
    editorError.value = 'Choose a valid Orbit order.'
    return
  }

  try {
    let updatedSystem = system
    let currentOrder = orbit.order
    while (currentOrder !== targetOrder) {
      const direction = currentOrder < targetOrder ? 1 : -1
      updatedSystem = moveOrbit(updatedSystem, orbit.id, direction)
      currentOrder += direction
    }
    if (updatedSystem !== system) await saveSystem(updatedSystem)
    orbitEditing.value = false
    orbitOrderDraft.value = String(targetOrder)
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

async function saveObjectEdit(): Promise<void> {
  const currentWorkspace = workspace.value
  const system = selectedSystem.value
  const snapshot = objectEditSnapshot.value
  const object = system?.objects.find(candidate => candidate.id === snapshot?.id)
  if (!currentWorkspace || !system || !snapshot || !object) return

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
      editorError.value = 'Choose a valid map placement.'
      return
    }
  }

  const customFieldValues = { ...(object.customFieldValues ?? {}) }
  let customFieldValuesChanged = false
  for (const definition of currentWorkspace.objectFieldSettings.customFields) {
    const draftValue = objectDraft.customFieldValues[definition.id] ?? ''
    const savedValue = snapshot.customFieldValues?.[definition.id]
    if (draftValue === (savedValue === undefined ? '' : String(savedValue))) continue

    customFieldValuesChanged = true
    if (!draftValue) {
      delete customFieldValues[definition.id]
    } else if (definition.type === 'number') {
      const numberValue = Number(draftValue)
      if (!Number.isFinite(numberValue)) {
        editorError.value = `"${definition.name}" must be a finite number.`
        return
      }
      customFieldValues[definition.id] = numberValue
    } else if (definition.type === 'boolean') {
      if (draftValue !== 'true' && draftValue !== 'false') {
        editorError.value = `Choose a true or false value for "${definition.name}".`
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

  try {
    await saveSystem(updateSystemObject(system, object.id, changes, currentWorkspace.objectFieldSettings))
    objectEditSnapshot.value = null
    syncObjectDraft(selectedObject.value)
    editorError.value = ''
  } catch (error) {
    editorError.value = errorText(error)
  }
}

function updateObjectPlacementDraft(): void {
  const system = selectedSystem.value
  const object = selectedObject.value
  if (!system || object?.placement.kind !== 'orbit' || objectDraft.placement !== 'system') return

  const placement = initialSystemPlacement(system)
  objectDraft.x = String(placement.x)
  objectDraft.y = String(placement.y)
}

async function createCustomField(): Promise<void> {
  const currentWorkspace = workspace.value
  if (!currentWorkspace) return

  try {
    const updatedWorkspace = addCustomFieldDefinition(
      currentWorkspace,
      newCustomFieldName.value,
      newCustomFieldType.value,
      fieldOptionsFromText(newCustomFieldOptions.value),
    )
    const addedField = updatedWorkspace.objectFieldSettings.customFields[
      updatedWorkspace.objectFieldSettings.customFields.length - 1
    ]
    if (!addedField) throw new Error('The custom field was not added.')
    await commit(updatedWorkspace)
    newCustomFieldName.value = ''
    newCustomFieldType.value = 'text'
    newCustomFieldOptions.value = ''
    newCustomFieldFormOpen.value = false
    selectFieldDefinition(addedField.id)
  } catch (error) {
    fieldDefinitionError.value = errorText(error)
  }
}

function sameFieldOptions(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((option, index) => option === second[index])
}

function applyFieldDefinitionUpdate(
  currentWorkspace: LocalWorkspace,
  fieldId: string,
  name: string,
  options: string[],
  clearInvalidValues: boolean,
): LocalWorkspace {
  const definition = fieldDefinitionsFor(currentWorkspace).find(field => field.id === fieldId)
  if (!definition) throw new Error('The selected field definition no longer exists.')

  let updatedWorkspace = currentWorkspace
  if (definition.kind === 'custom' && name !== definition.name) {
    updatedWorkspace = renameCustomFieldDefinition(updatedWorkspace, definition.id, name)
  }
  if (definition.type === 'single-select' && !sameFieldOptions(definition.options, options)) {
    updatedWorkspace = definition.kind === 'native'
      ? updateNativeFieldOptions(updatedWorkspace, definition.nativeField, options, clearInvalidValues)
      : updateCustomFieldOptions(updatedWorkspace, definition.id, options, clearInvalidValues)
  }
  return updatedWorkspace
}

async function saveFieldDefinitionChanges(): Promise<void> {
  const currentWorkspace = workspace.value
  const definition = selectedFieldDefinition.value
  if (!currentWorkspace || !definition) return

  const name = definition.kind === 'custom' ? fieldDefinitionNameDraft.value.trim() : definition.name
  const options = definition.type === 'single-select'
    ? fieldOptionsFromText(fieldDefinitionOptionsDraft.value)
    : definition.options
  const nameChanged = definition.kind === 'custom' && name !== definition.name
  const optionsChanged = definition.type === 'single-select' && !sameFieldOptions(definition.options, options)
  if (!nameChanged && !optionsChanged) {
    fieldDefinitionEditing.value = false
    syncFieldDefinitionDraft(definition)
    return
  }

  try {
    const updatedWorkspace = applyFieldDefinitionUpdate(
      currentWorkspace,
      definition.id,
      name,
      options,
      true,
    )
    const affectedAssignments = definition.type === 'single-select'
      ? fieldValueAssignments(currentWorkspace, definition).filter(assignment =>
          typeof assignment.value === 'string' && !options.includes(assignment.value),
        )
      : []
    if (affectedAssignments.length) {
      pendingFieldDefinitionChange.value = {
        kind: 'save',
        fieldId: definition.id,
        fieldName: definition.name,
        name,
        options,
        affectedAssignments,
      }
      fieldDefinitionError.value = ''
      return
    }

    await commit(updatedWorkspace)
    fieldDefinitionEditing.value = false
    selectFieldDefinition(definition.id)
  } catch (error) {
    fieldDefinitionError.value = errorText(error)
  }
}

function requestFieldDefinitionRemoval(): void {
  const currentWorkspace = workspace.value
  const definition = selectedFieldDefinition.value
  if (!currentWorkspace || !definition || definition.kind !== 'custom') return

  pendingFieldDefinitionChange.value = {
    kind: 'remove',
    fieldId: definition.id,
    fieldName: definition.name,
    affectedAssignments: fieldValueAssignments(currentWorkspace, definition),
  }
  fieldDefinitionError.value = ''
}

function cancelFieldDefinitionChange(): void {
  pendingFieldDefinitionChange.value = null
  fieldDefinitionError.value = ''
}

async function confirmFieldDefinitionChange(): Promise<void> {
  const currentWorkspace = workspace.value
  const pendingChange = pendingFieldDefinitionChange.value
  if (!currentWorkspace || !pendingChange) return

  try {
    const updatedWorkspace = pendingChange.kind === 'remove'
      ? removeCustomFieldDefinition(currentWorkspace, pendingChange.fieldId)
      : applyFieldDefinitionUpdate(
          currentWorkspace,
          pendingChange.fieldId,
          pendingChange.name,
          pendingChange.options,
          true,
        )
    await commit(updatedWorkspace)
    pendingFieldDefinitionChange.value = null
    fieldDefinitionEditing.value = false
    selectFieldDefinition(pendingChange.kind === 'remove' ? 'native:atmosphere' : pendingChange.fieldId)
  } catch (error) {
    fieldDefinitionError.value = errorText(error)
  }
}

function canMoveSelectedOrbit(direction: -1 | 1): boolean {
  const system = selectedSystem.value
  const orbit = selectedOrbit.value
  if (!system || !orbit) return false

  const siblingCount = system.orbits.filter(candidate => candidate.hostId === orbit.hostId).length
  const currentOrder = orbitEditing.value ? Number(orbitOrderDraft.value) : orbit.order
  return Number.isSafeInteger(currentOrder) && currentOrder + direction >= 1 && currentOrder + direction <= siblingCount
}
</script>

<template>
  <div
    class="app-shell flex min-h-screen flex-col px-[clamp(1rem,3.5vw,3.5rem)] max-[760px]:px-3"
    :class="{ 'map-workspace-shell': workspace && (activeView === 'cluster' || selectedSystem) }"
  >
    <header class="topbar flex min-h-20 items-center justify-between gap-4 border-b border-[var(--line-soft)] max-[760px]:min-h-[4.5rem]">
      <a class="wordmark inline-flex items-center gap-3 text-inherit no-underline" href="/" aria-label="Mothership Campaign Cartography home">
        <span class="wordmark-symbol grid size-[2.15rem] place-items-center rounded-full border border-[var(--accent)]" aria-hidden="true">M</span>
        <span>
          <strong class="block">MOTHERSHIP</strong>
          <small class="mt-[0.22rem] block">CAMPAIGN CARTOGRAPHY</small>
        </span>
      </a>
      <div v-if="workspace" class="workspace-header-summary">
        <div class="cluster-stamp" role="group" aria-label="Active Jump Cluster summary">
          <small>ACTIVE JUMP CLUSTER</small>
          <h1
            v-if="activeView === 'cluster' || !selectedSystem"
            class="workspace-summary-name"
          >
            {{ workspace.cluster.name }}
          </h1>
          <strong v-else class="workspace-summary-name">{{ workspace.cluster.name }}</strong>
          <div class="chart-stats header-summary-stats" role="group" aria-label="Current Jump Cluster contents">
            <span><strong>{{ workspace.cluster.systems.length }}</strong> SYSTEMS</span>
            <span><strong>{{ workspace.cluster.routes.length }}</strong> ROUTES</span>
            <span><strong>{{ jumpPoints.length }}</strong> JUMP POINTS</span>
          </div>
        </div>
        <div
          v-if="selectedSystem"
          class="system-stamp"
          role="group"
          aria-label="Active Star System summary"
        >
          <small>ACTIVE STAR SYSTEM</small>
          <h1 v-if="activeView === 'system'" class="workspace-summary-name">
            {{ selectedSystem.name }}
          </h1>
          <strong v-else class="workspace-summary-name">{{ selectedSystem.name }}</strong>
          <div class="chart-stats header-summary-stats" role="group" aria-label="Current system contents">
            <span><strong>{{ selectedSystem.objects.filter(object => object.subtype === 'star').length }}</strong> STARS</span>
            <span><strong>{{ selectedSystem.objects.length }}</strong> OBJECTS</span>
            <span><strong>{{ selectedSystem.orbits.length }}</strong> ORBITS</span>
          </div>
        </div>
      </div>
      <div v-if="workspace" class="topbar-actions flex shrink-0 items-center gap-2">
        <button
          ref="fieldDefinitionsTrigger"
          class="field-definitions-trigger"
          type="button"
          aria-haspopup="dialog"
          aria-controls="field-definitions-dialog"
          :aria-expanded="fieldDefinitionDialogOpen"
          aria-label="Open field definitions"
          title="Manage native and custom field definitions"
          @click="openFieldDefinitions"
        >
          <span>FIELD DEFINITIONS</span>
          <small>MAP DATA</small>
        </button>
        <div class="header-map-actions" @keydown.esc.stop.prevent="closeHeaderMapActions">
          <button
            ref="headerMapActionsToggle"
            class="header-map-actions-toggle"
            type="button"
            aria-controls="header-map-actions-panel"
            :aria-expanded="headerMapActionsOpen"
            :aria-label="`${headerMapActionsOpen ? 'Close' : 'Open'} map file actions for ${mapFileScope}`"
            :title="`Map file actions for ${mapFileScope}`"
            @click="headerMapActionsOpen = !headerMapActionsOpen"
          >
            <span>MAP FILES</span>
            <small>{{ activeView === 'cluster' ? 'CLUSTER' : 'SYSTEM' }}</small>
            <span class="header-map-actions-indicator" aria-hidden="true">
              {{ headerMapActionsOpen ? '-' : '+' }}
            </span>
          </button>
          <div
            v-show="headerMapActionsOpen"
            id="header-map-actions-panel"
            class="header-map-actions-panel"
            role="group"
            :aria-label="`Map file actions for ${mapFileScope}`"
          >
            <p class="header-map-actions-heading">EXPORT / {{ mapFileScope }}</p>
            <div class="header-map-actions-exports">
              <template v-if="activeView === 'cluster'">
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export Jump Cluster JSON"
                  title="Export Jump Cluster JSON"
                  @click="downloadClusterJson"
                >
                  JSON
                </button>
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export Jump Cluster PNG"
                  title="Export Jump Cluster PNG"
                  :disabled="!clusterMapRef"
                  @click="downloadMapImage(clusterMapRef, workspace.cluster.name, 'jump-cluster', 'png')"
                >
                  PNG
                </button>
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export Jump Cluster SVG"
                  title="Export Jump Cluster SVG"
                  :disabled="!clusterMapRef"
                  @click="downloadMapImage(clusterMapRef, workspace.cluster.name, 'jump-cluster', 'svg')"
                >
                  SVG
                </button>
              </template>
              <template v-else-if="selectedSystem">
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export star system JSON"
                  title="Export star system JSON"
                  @click="downloadSystemJson"
                >
                  JSON
                </button>
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export star system PNG"
                  title="Export star system PNG"
                  :disabled="!systemMapRef"
                  @click="downloadMapImage(systemMapRef, selectedSystem.name, 'star-system', 'png')"
                >
                  PNG
                </button>
                <button
                  class="tool-button"
                  type="button"
                  aria-label="Export star system SVG"
                  title="Export star system SVG"
                  :disabled="!systemMapRef"
                  @click="downloadMapImage(systemMapRef, selectedSystem.name, 'star-system', 'svg')"
                >
                  SVG
                </button>
              </template>
            </div>
            <p class="header-map-actions-note">
              Import JSON creates a separate copy in the current Jump Cluster: {{ workspace.cluster.name }}.
            </p>
            <button
              class="tool-button header-map-actions-import"
              type="button"
              aria-label="Import JSON copy"
              title="Import JSON copy"
              :disabled="saveState === 'saving'"
              @click="openJsonImportPicker"
            >
              Import JSON
            </button>
            <p v-if="exportError" class="feedback m-0 error-text" role="alert">{{ exportError }}</p>
          </div>
        </div>
        <div class="local-badge inline-flex items-center gap-[0.45rem] whitespace-nowrap text-[var(--status-good)]">
          <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
          LOCAL ONLY
        </div>
      </div>
      <div v-else class="local-badge inline-flex items-center gap-[0.45rem] whitespace-nowrap text-[var(--status-good)]">
        <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
        LOCAL ONLY
      </div>
    </header>

    <main class="main-content mx-auto flex w-full max-w-[1720px] flex-1 flex-col self-center pb-8 pt-[clamp(1rem,2.1vw,1.75rem)]">
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
            <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
            {{ saveState === 'error' ? `Not saved. ${saveError ?? ''}` : 'Your archive remains on this device.' }}
          </p>
        </form>
      </section>

      <section v-else-if="workspace && activeView === 'cluster'" class="editor">
        <div class="cluster-map-header">
          <div class="map-tools cluster-map-tools">
            <section class="object-palette cluster-edit-palette" role="region" aria-label="Cluster editing palette">
              <div class="object-palette-heading">
                <span class="section-kicker">ADD TO CLUSTER</span>
              </div>
              <div class="object-palette-controls">
                <button class="object-palette-button" type="button" aria-label="Add star system" @click="createSystem">
                  <span aria-hidden="true">+</span> Add system
                </button>
                <button class="object-palette-button" type="button" aria-label="Add Jump Route" @click="beginRoute">
                  <span aria-hidden="true">+</span> Add Jump Route
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="editor-grid grid min-h-[min(78vh,56rem)] grid-cols-[minmax(13rem,0.72fr)_minmax(0,3fr)_minmax(15rem,0.85fr)] items-stretch gap-[0.7rem] max-[1200px]:grid-cols-[minmax(12rem,0.72fr)_minmax(0,3fr)] max-[760px]:flex max-[760px]:flex-col">
          <button
            v-if="!hierarchyPanelOpen"
            class="panel-reopen panel-reopen-left"
            type="button"
            aria-label="Show hierarchy panel"
            aria-controls="workspace-hierarchy-panel"
            aria-expanded="false"
            @click="toggleHierarchyPanel"
          >
            <span class="panel-reopen-icon" aria-hidden="true">›</span>
            <span class="panel-reopen-label">Hierarchy</span>
          </button>
          <Transition name="hierarchy-panel">
            <aside
              v-show="hierarchyPanelOpen"
              id="workspace-hierarchy-panel"
              class="panel workspace-side-panel hierarchy-panel min-w-0 overflow-auto p-4"
              aria-label="Jump Cluster contents"
            >
            <div class="panel-heading flex items-center justify-between gap-[0.8rem]">
              <div>
                <span class="section-kicker">LOCAL ARCHIVE</span>
                <h2 class="mt-[0.28rem] mb-0 text-2xl">Cluster</h2>
              </div>
              <span class="tree-count whitespace-nowrap">{{ workspace.cluster.systems.length }} systems</span>
              <button
                class="quiet-button panel-toggle-button"
                type="button"
                aria-label="Collapse hierarchy panel"
                aria-controls="workspace-hierarchy-panel"
                aria-expanded="true"
                @click="toggleHierarchyPanel"
              >
                <span aria-hidden="true">‹</span>
              </button>
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
                  <span class="system-seal grid size-[1.65rem] shrink-0 place-items-center rounded-full border border-[var(--line-strong)]">SY</span>
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

            <nav class="object-tree grid gap-[0.1rem] border-t border-[var(--line-soft)] pt-[0.65rem]" aria-label="Jump Routes">
              <span class="subsection-label">JUMP ROUTES</span>
              <p v-if="workspace.cluster.routes.length === 0" class="empty-copy my-[0.65rem]">No Jump Routes on this chart.</p>
              <button
                v-for="route in workspace.cluster.routes"
                :key="route.id"
                class="tree-row object-row flex min-h-[2.55rem] w-full cursor-pointer items-center gap-[0.45rem] rounded-[2px] border border-transparent bg-transparent px-2 py-[0.42rem] text-left"
                :class="{ active: route.id === selectedRouteId }"
                type="button"
                :aria-label="`Select Jump Level ${route.jumpLevel}: ${routeEndpointSummary(route)}`"
                :aria-current="route.id === selectedRouteId ? 'true' : undefined"
                @click="selectRoute(route.id)"
              >
                <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">R</span>
                <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
                  Jump Level {{ route.jumpLevel }}
                  <small class="mt-[0.18rem] block">{{ routeEndpointSummary(route) }}</small>
                </span>
              </button>
            </nav>
            </aside>
          </Transition>

          <section class="panel map-panel flex min-w-0 flex-col p-[0.7rem]" aria-label="Jump Cluster map workspace">
            <div class="map-frame workspace-canvas flex min-h-0 min-w-0 overflow-hidden bg-[var(--map-bg)]">
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

          <button
            v-if="!inspectorPanelOpen"
            class="panel-reopen panel-reopen-right"
            type="button"
            aria-label="Show inspector panel"
            aria-controls="workspace-inspector-panel"
            aria-expanded="false"
            @click="toggleInspectorPanel"
          >
            <span class="panel-reopen-icon" aria-hidden="true">‹</span>
            <span class="panel-reopen-label">Inspector</span>
          </button>
          <Transition name="inspector-panel">
            <aside
              v-show="inspectorPanelOpen"
              id="workspace-inspector-panel"
              class="panel workspace-side-panel inspector-panel min-w-0 overflow-auto p-4"
              aria-label="Jump Route inspector"
            >
            <button
              class="quiet-button panel-close-button"
              type="button"
              aria-label="Collapse inspector panel"
              aria-controls="workspace-inspector-panel"
              aria-expanded="true"
              @click="toggleInspectorPanel"
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              v-if="!routeFormOpen"
              class="quiet-button chart-details-control mb-4"
              type="button"
              :aria-pressed="chartDetailsActive"
              @click="showChartDetails"
            >
              Chart details
            </button>
            <template v-if="selectedRoute">
              <span class="section-kicker">JUMP ROUTE / SELECTED</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Jump Level {{ selectedRoute.jumpLevel }}</h2>
              <p class="inspector-intro mb-[1em]">
                Routes reference logical Jump Points. A Station is a separate physical location.
              </p>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
                <span>Endpoints</span>
                <strong class="text-right">{{ routeEndpointSummary(selectedRoute) }}</strong>
              </div>
              <p v-if="selectedRoute.toPointId === null" class="inspector-intro">
                <strong>Unknown destination: {{ selectedRoute.unresolvedExit }}</strong> is beyond the known Jump Cluster.
              </p>
              <div class="flex flex-wrap gap-2">
                <button class="primary-button" type="button" aria-label="Edit Jump Route" :disabled="saveState === 'saving'" @click="beginRouteEdit">
                  Edit
                </button>
                <button
                  class="quiet-button"
                  type="button"
                  :aria-label="`Delete Jump Route (Level ${selectedRoute.jumpLevel})`"
                  :disabled="saveState === 'saving'"
                  @click="deleteSelectedRoute"
                >
                  Delete route
                </button>
              </div>
            </template>

            <template v-else-if="routeFormOpen">
              <span class="section-kicker">{{ editingRouteId ? 'JUMP ROUTE / EDIT' : 'JUMP ROUTE / NEW' }}</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">LOGICAL ENDPOINTS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">
                {{ editingRouteId ? 'Edit Jump Route' : 'Connect Jump Points' }}
              </h2>
              <p class="inspector-intro mb-[1em]">
                Routes reference logical Jump Points. A Station is a separate physical location.
              </p>
              <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitRoute">
                <template v-if="jumpPoints.length">
                  <label for="route-level">
                    Jump level
                    <input
                      id="route-level"
                      v-model="routeDraft.jumpLevel"
                      type="number"
                      min="1"
                      step="1"
                      required
                    >
                  </label>
                  <p class="inspector-intro m-0">Standard levels are 1-9; custom positive integer levels are supported.</p>
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
                  <p v-if="routeDraft.destination === 'point'" class="inspector-intro m-0">
                    Destination system: {{ routeDraftDestination?.system.name ?? 'Select a Jump Point' }}
                  </p>
                  <p v-if="routeDraft.destination === 'point'" class="inspector-intro m-0">
                    This route connects Jump Points by stable identity, independently of any physical Station.
                  </p>
                  <label v-else for="route-exit">
                    Unknown destination label
                    <input
                      id="route-exit"
                      v-model="routeDraft.unresolvedExit"
                      maxlength="80"
                      required
                    >
                  </label>
                  <p v-if="routeDraft.destination === 'external'" class="inspector-intro m-0" role="status">
                    <strong>Unknown destination: {{ routeDraft.unresolvedExit }}</strong> is beyond the known Jump Cluster.
                  </p>
                  <p v-if="editorError" class="feedback m-0 error-text" role="alert">{{ editorError }}</p>
                  <div class="flex flex-wrap gap-2">
                    <button class="primary-button" type="submit" :disabled="saveState === 'saving'">
                      {{ editingRouteId ? 'Save Jump Route' : 'Create Jump Route' }}
                    </button>
                    <button class="quiet-button" type="button" @click="cancelRouteForm">
                      Cancel
                    </button>
                  </div>
                </template>
                <template v-else>
                  <p class="empty-copy m-0" role="status">Open a star system and add a Jump Point before creating a route.</p>
                  <button class="quiet-button justify-self-start" type="button" @click="cancelRouteForm">
                    Cancel
                  </button>
                </template>
              </form>
            </template>

            <template v-else>
              <span class="section-kicker">CLUSTER DETAILS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ workspace.cluster.name }}</h2>
              <p class="inspector-intro mb-[1em]">
                Choose a route to inspect its logical Jump Point endpoints, or edit the chart names.
              </p>
              <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitNames">
                <fieldset class="m-0 grid gap-3 border-0 p-0" :disabled="!chartNamesEditing || saveState === 'saving'">
                  <label for="cluster-detail-name">Jump Cluster</label>
                  <input id="cluster-detail-name" v-model="clusterName" maxlength="80" required>
                  <label for="system-detail-name">Star system</label>
                  <input id="system-detail-name" v-model="systemName" maxlength="80" required>
                </fieldset>
                <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="!chartNamesEditing"
                    class="primary-button"
                    type="button"
                    aria-label="Edit chart names"
                    @click="beginChartNamesEdit"
                  >
                    Edit
                  </button>
                  <button v-else class="primary-button" type="submit" aria-label="Save chart names" :disabled="saveState === 'saving'">
                    Save
                  </button>
                  <button v-if="chartNamesEditing" class="quiet-button" type="button" @click="cancelChartNamesEdit">
                    Cancel
                  </button>
                </div>
              </form>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
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
          </Transition>
        </div>
      </section>

      <section v-else-if="selectedSystem" class="editor">
        <div class="system-map-header">
          <div class="map-tools system-map-tools">
            <section class="object-palette" role="region" aria-label="Object palette">
              <div class="object-palette-heading flex items-center justify-between gap-2">
                <span class="section-kicker">ADD OBJECT</span>
                <span class="object-palette-hint">Choose a category, then add or drag an object.</span>
              </div>
              <div class="object-palette-categories" role="group" aria-label="Object categories">
                <button
                  v-for="group in objectPaletteGroups"
                  :key="group.family"
                  class="object-palette-category-button"
                  type="button"
                  :aria-pressed="activeObjectPaletteFamily === group.family"
                  :title="`Show ${group.label} objects`"
                  @click="activeObjectPaletteFamily = group.family"
                >
                  {{ group.label }}
                </button>
              </div>
              <div class="object-palette-controls">
                <div class="object-palette-items" role="group" :aria-label="activeObjectPaletteGroup.label">
                  <button
                    v-for="type in activeObjectPaletteGroup.types"
                    :key="type.value"
                    class="object-palette-button"
                    type="button"
                    draggable="true"
                    :disabled="saveState === 'saving'"
                    :aria-label="`Add ${type.label}`"
                    :title="`Drag ${type.label} onto the map, or activate to add it`"
                    @dragstart="startObjectDrag($event, type.value)"
                    @click="addObject(type.value)"
                  >
                    <span class="object-mark" aria-hidden="true">{{ catalogueMarks[type.value] }}</span>
                    <span>{{ type.label }}</span>
                  </button>
                </div>
                <button
                  class="object-palette-button object-palette-orbit"
                  type="button"
                  aria-label="Add orbit"
                  :disabled="!selectedObject || saveState === 'saving'"
                  @click="addOrbit"
                >
                  <span aria-hidden="true">+</span> Add Orbit
                </button>
              </div>
              <span v-if="selectedOrbit" class="placement-hint">
                New objects go in Orbit {{ selectedOrbit.order }}
              </span>
            </section>
          </div>
        </div>

        <div class="editor-grid system-map-editor-grid grid min-h-[min(78vh,56rem)] grid-cols-[minmax(13rem,0.72fr)_minmax(0,3fr)_minmax(15rem,0.85fr)] items-stretch gap-[0.7rem] max-[1200px]:grid-cols-[minmax(12rem,0.72fr)_minmax(0,3fr)] max-[760px]:flex max-[760px]:flex-col">
          <button
            v-if="!hierarchyPanelOpen"
            class="panel-reopen panel-reopen-left"
            type="button"
            aria-label="Show hierarchy panel"
            aria-controls="workspace-hierarchy-panel"
            aria-expanded="false"
            @click="toggleHierarchyPanel"
          >
            <span class="panel-reopen-icon" aria-hidden="true">›</span>
            <span class="panel-reopen-label">Hierarchy</span>
          </button>
          <Transition name="hierarchy-panel">
            <aside
              v-show="hierarchyPanelOpen"
              id="workspace-hierarchy-panel"
              class="panel workspace-side-panel hierarchy-panel min-w-0 overflow-auto p-4"
              aria-label="System hierarchy"
            >
            <div class="panel-heading grid grid-cols-[1fr_auto] items-center gap-2">
              <div>
                <span class="section-kicker">LOCAL ARCHIVE</span>
                <h2 class="mt-[0.28rem] mb-0 text-2xl">Hierarchy</h2>
              </div>
              <button
                class="quiet-button panel-toggle-button"
                type="button"
                aria-label="Collapse hierarchy panel"
                aria-controls="workspace-hierarchy-panel"
                aria-expanded="true"
                @click="toggleHierarchyPanel"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <div class="col-span-2 flex flex-wrap items-center gap-2">
                <button class="quiet-button cluster-map-nav-button" type="button" aria-label="Cluster map" @click="showClusterMap">
                  Cluster map
                </button>
              </div>
            </div>

            <details class="chart-names my-4 border-y border-[var(--line-soft)]">
              <summary class="cursor-pointer py-[0.7rem]">Chart names</summary>
              <form class="name-form grid gap-2 pb-[0.9rem]" @submit.prevent="submitNames">
                <fieldset class="m-0 grid gap-2 border-0 p-0" :disabled="!chartNamesEditing || saveState === 'saving'">
                  <label for="edit-cluster-name">Jump Cluster</label>
                  <input id="edit-cluster-name" v-model="clusterName" maxlength="80" required>
                  <label for="edit-system-name">Star system</label>
                  <input id="edit-system-name" v-model="systemName" maxlength="80" required>
                </fieldset>
                <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="!chartNamesEditing"
                    class="secondary-button mt-[0.3rem] min-h-[2.25rem] justify-center"
                    type="button"
                    aria-label="Edit chart names"
                    @click="beginChartNamesEdit"
                  >
                    Edit
                  </button>
                  <button v-else class="primary-button mt-[0.3rem]" type="submit" aria-label="Save chart names" :disabled="saveState === 'saving'">
                    Save
                  </button>
                  <button v-if="chartNamesEditing" class="quiet-button mt-[0.3rem]" type="button" @click="cancelChartNamesEdit">
                    Cancel
                  </button>
                </div>
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
                  :class="{ active: row.object.id === selectedObjectId }"
                  type="button"
                  :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
                  :aria-label="`Select ${row.object.locationKey}, ${row.object.name}`"
                  :aria-current="row.object.id === selectedObjectId ? 'true' : undefined"
                  @click="selectObject(row.object.id)"
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
                  :class="{ active: row.orbit.id === selectedOrbitId }"
                  type="button"
                  :style="{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }"
                  :aria-label="`Orbit ${row.orbit.order} around ${row.host.name}, ${row.childCount} object${row.childCount === 1 ? '' : 's'}`"
                  :aria-current="row.orbit.id === selectedOrbitId ? 'true' : undefined"
                  @click="selectOrbit(row.orbit.id)"
                >
                  <span class="orbit-mark w-[2.2rem] shrink-0 text-center text-[var(--map-muted)]" aria-hidden="true">○</span>
                  <span class="tree-copy min-w-0 [overflow-wrap:anywhere]">
                    Orbit {{ row.orbit.order }}
                    <small class="mt-[0.18rem] block">{{ row.host.name }} / {{ row.childCount }} object{{ row.childCount === 1 ? '' : 's' }}</small>
                  </span>
                </button>
              </template>
            </nav>
            <p class="hierarchy-note mt-4 mb-0 border-t border-[var(--line-soft)] pt-[0.8rem]">Select an object, then add an Orbit from the map toolbar. Empty Orbits stay on the chart.</p>
              </aside>
            </Transition>

            <section class="panel map-panel flex min-w-0 flex-col p-[0.7rem]" aria-label="System map workspace">
              <div class="map-frame workspace-canvas system-map-canvas flex min-h-0 min-w-0 overflow-hidden bg-[var(--map-bg)]">
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
                  @place-object-in-orbit="placeMapObjectInOrbit"
                  @drop-object="addObject"
                />
                <template #fallback>
                  <div class="map-fallback grid min-h-[31rem] w-full place-items-center max-[760px]:min-h-96" role="status">Preparing the orbital chart...</div>
                </template>
              </ClientOnly>
            </div>
            <p class="map-note mb-[1em] px-[0.2rem] pt-[0.55rem] pb-[0.1rem]">
              Select a mark or Orbit to inspect it.
            </p>
          </section>

          <button
            v-if="!inspectorPanelOpen"
            class="panel-reopen panel-reopen-right"
            type="button"
            aria-label="Show inspector panel"
            aria-controls="workspace-inspector-panel"
            aria-expanded="false"
            @click="toggleInspectorPanel"
          >
            <span class="panel-reopen-icon" aria-hidden="true">‹</span>
            <span class="panel-reopen-label">Inspector</span>
          </button>
          <Transition name="inspector-panel">
            <aside
              v-show="inspectorPanelOpen"
              id="workspace-inspector-panel"
              class="panel workspace-side-panel inspector-panel min-w-0 overflow-auto p-4"
              aria-label="Object inspector"
            >
            <button
              class="quiet-button panel-close-button"
              type="button"
              aria-label="Collapse inspector panel"
              aria-controls="workspace-inspector-panel"
              aria-expanded="true"
              @click="toggleInspectorPanel"
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              class="quiet-button chart-details-control mb-4"
              type="button"
              :aria-pressed="chartDetailsActive"
              @click="showChartDetails"
            >
              Chart details
            </button>
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
                <fieldset class="field-stack m-0 grid gap-3 border-0 p-0" :disabled="!objectEditing || saveState === 'saving'">
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
                <p v-if="editorError" class="feedback mt-3 mb-0 error-text" role="alert">{{ editorError }}</p>
                <div class="flex flex-wrap gap-2 mt-4">
                  <button
                    v-if="!objectEditing"
                    class="primary-button"
                    type="button"
                    aria-label="Edit map object"
                    :disabled="saveState === 'saving'"
                    @click="beginObjectEdit"
                  >
                    Edit
                  </button>
                  <button v-else class="primary-button" type="submit" aria-label="Save map object" :disabled="saveState === 'saving'">
                    Save
                  </button>
                  <button v-if="objectEditing" class="quiet-button" type="button" aria-label="Cancel map object edits" @click="cancelObjectEdit">
                    Cancel
                  </button>
                </div>
              </form>
              <button
                v-if="!objectEditing"
                class="quiet-button mt-4"
                type="button"
                :aria-label="`Delete ${selectedObject.name}`"
                :disabled="saveState === 'saving'"
                @click="deleteSelectedObject"
              >
                Delete object
              </button>
              <p class="inspector-footnote mt-4 mb-0 border-t border-[var(--line-soft)] pt-3">Location keys are required and unique within this star system.</p>
            </template>

            <template v-else-if="selectedOrbit">
              <span class="section-kicker">SYSTEM STRUCTURE / SELECTED</span>
              <span class="type-chip mt-[0.65rem] inline-block border border-[var(--line)] px-[0.4rem] py-[0.27rem]">UNKEYED PLACEMENT</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">Orbit {{ orbitEditing ? orbitOrderDraft : selectedOrbit.order }}</h2>
              <p class="inspector-intro mb-[1em]">
                Hosted by {{ selectedSystem.objects.find(object => object.id === selectedOrbit?.hostId)?.name }}.
                Orbit rings show structure, not measured distance.
              </p>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
                <span>Objects placed</span>
                <strong>{{ selectedSystem.objects.filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === selectedOrbit?.id).length }}</strong>
              </div>
              <div v-if="orbitEditing" class="orbit-actions flex gap-2" aria-label="Reorder Orbit">
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
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="!orbitEditing"
                  class="primary-button"
                  type="button"
                  aria-label="Edit Orbit"
                  :disabled="saveState === 'saving'"
                  @click="beginOrbitEdit"
                >
                  Edit
                </button>
                <button v-else class="primary-button" type="button" aria-label="Save Orbit" :disabled="saveState === 'saving'" @click="saveOrbitEdit">
                  Save
                </button>
                <button v-if="orbitEditing" class="quiet-button" type="button" aria-label="Cancel Orbit edits" @click="cancelOrbitEdit">
                  Cancel
                </button>
              </div>
              <button
                v-if="!orbitEditing"
                class="quiet-button mt-4"
                type="button"
                :aria-label="selectedOrbitDeleteLabel"
                :disabled="saveState === 'saving'"
                @click="deleteSelectedOrbit"
              >
                Delete Orbit and contents
              </button>
              <p class="inspector-footnote mt-4 mb-0 border-t border-[var(--line-soft)] pt-3">Orbits are unkeyed, may remain empty, and can be nested below any map object.</p>
            </template>

            <template v-else>
              <span class="section-kicker">CHART DETAILS</span>
              <h2 class="mt-[0.65rem] mb-[0.35rem] [overflow-wrap:anywhere] text-[1.65rem]">{{ selectedSystem.name }}</h2>
              <p class="inspector-intro mb-[1em]">
                Choose a map object or Orbit to inspect it, or edit the chart names.
              </p>
              <form class="field-stack mt-4 grid gap-3" @submit.prevent="submitNames">
                <fieldset class="m-0 grid gap-3 border-0 p-0" :disabled="!chartNamesEditing || saveState === 'saving'">
                  <label for="detail-cluster-name">Jump Cluster</label>
                  <input id="detail-cluster-name" v-model="clusterName" maxlength="80" required>
                  <label for="detail-system-name">Star system</label>
                  <input id="detail-system-name" v-model="systemName" maxlength="80" required>
                </fieldset>
                <p v-if="formError" class="feedback m-0 error-text" role="alert">{{ formError }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="!chartNamesEditing"
                    class="primary-button"
                    type="button"
                    aria-label="Edit chart names"
                    @click="beginChartNamesEdit"
                  >
                    Edit
                  </button>
                  <button v-else class="primary-button" type="submit" aria-label="Save chart names" :disabled="saveState === 'saving'">
                    Save
                  </button>
                  <button v-if="chartNamesEditing" class="quiet-button" type="button" @click="cancelChartNamesEdit">
                    Cancel
                  </button>
                </div>
              </form>
              <div class="orbit-facts my-4 grid grid-cols-[1fr_auto] gap-[0.55rem] border-y border-[var(--line-soft)] py-[0.8rem]">
                <span>Map objects</span>
                <strong>{{ selectedSystem.objects.length }}</strong>
                <span>Nested Orbits</span>
                <strong>{{ selectedSystem.orbits.length }}</strong>
              </div>
            </template>
            </aside>
          </Transition>
        </div>
      </section>
    </main>

    <Teleport to="body">
      <dialog
        v-if="fieldDefinitionDialogOpen"
        id="field-definitions-dialog"
        ref="fieldDefinitionsDialog"
        class="field-definitions-dialog"
        aria-labelledby="field-definitions-title"
        aria-modal="true"
        @cancel="cancelFieldDefinitionDialog"
        @click.self="closeFieldDefinitions"
      >
        <div class="field-definitions-content">
          <header class="field-definitions-header">
            <div>
              <span class="section-kicker">MAP DATA / REUSABLE DEFINITIONS</span>
              <h2 id="field-definitions-title">Field definitions</h2>
              <p>Manage values available across this map without changing the active system or selection.</p>
            </div>
            <button
              class="quiet-button field-definitions-close"
              type="button"
              aria-label="Close field definitions"
              autofocus
              @click="closeFieldDefinitions"
            >
              Close
            </button>
          </header>

          <div class="field-definitions-layout">
            <nav class="field-definition-list" aria-label="Field definitions">
              <section>
                <h3>Native fields</h3>
                <button
                  v-for="field in nativeFieldDefinitions"
                  :key="field.id"
                  class="field-definition-choice"
                  type="button"
                  :aria-pressed="selectedFieldDefinitionId === field.id"
                  :class="{ active: selectedFieldDefinitionId === field.id }"
                  @click="selectFieldDefinition(field.id)"
                >
                  <span>{{ field.name }}</span>
                  <small>Native / {{ field.type }}</small>
                </button>
              </section>
              <section>
                <div class="field-definition-list-heading">
                  <h3>Custom fields</h3>
                  <button
                    class="quiet-button field-definition-add"
                    type="button"
                    @click="openNewCustomFieldForm"
                  >
                    New custom field
                  </button>
                </div>
                <button
                  v-for="field in customFieldDefinitions"
                  :key="field.id"
                  class="field-definition-choice"
                  type="button"
                  :aria-pressed="selectedFieldDefinitionId === field.id"
                  :class="{ active: selectedFieldDefinitionId === field.id }"
                  @click="selectFieldDefinition(field.id)"
                >
                  <span>{{ field.name }}</span>
                  <small>Custom / {{ field.type }}</small>
                </button>
                <p v-if="!customFieldDefinitions.length" class="empty-copy">
                  No custom fields are defined yet.
                </p>
              </section>
            </nav>

            <section
              v-if="selectedFieldDefinition"
              class="field-definition-editor"
              aria-label="Field definition editor"
            >
              <header class="field-definition-editor-heading">
                <div>
                  <span class="section-kicker">{{ selectedFieldDefinition.kind }} field / {{ selectedFieldDefinition.type }}</span>
                  <h3>{{ selectedFieldDefinition.name }}</h3>
                </div>
                <span class="field-definition-value-count">{{ selectedFieldAssignments.length }} saved values</span>
              </header>

              <label v-if="selectedFieldDefinition.kind === 'custom'" for="field-definition-name">
                Custom field name
                <input
                  id="field-definition-name"
                  v-model="fieldDefinitionNameDraft"
                  aria-label="Custom field name"
                  maxlength="80"
                  :disabled="!fieldDefinitionEditing || saveState === 'saving' || pendingFieldDefinitionChange !== null"
                >
              </label>

              <label
                v-if="selectedFieldDefinition.type === 'single-select'"
                for="field-definition-options"
              >
                {{ selectedFieldDefinition.name }} choices
                <textarea
                  id="field-definition-options"
                  v-model="fieldDefinitionOptionsDraft"
                  :aria-label="`${selectedFieldDefinition.name} choices`"
                  rows="4"
                  :disabled="!fieldDefinitionEditing || saveState === 'saving' || pendingFieldDefinitionChange !== null"
                />
              </label>

              <section class="field-definition-values" role="region" aria-label="Existing field values">
                <div class="field-definition-section-heading">
                  <h4>Existing field values</h4>
                  <span>{{ selectedFieldAssignments.length }}</span>
                </div>
                <p v-if="!selectedFieldAssignments.length" class="empty-copy">
                  No values are assigned to this field.
                </p>
                <ul v-else>
                  <li v-for="assignment in selectedFieldAssignments" :key="assignment.objectId">
                    <span>{{ assignment.objectName }}</span>
                    <small>{{ assignment.systemName }}</small>
                    <strong>{{ assignment.value }}</strong>
                  </li>
                </ul>
              </section>

              <section
                v-if="affectedFieldAssignments.length"
                class="field-definition-values field-definition-affected"
                role="region"
                aria-label="Affected values preview"
              >
                <div class="field-definition-section-heading">
                  <h4>Values that will be cleared</h4>
                  <span>{{ affectedFieldAssignments.length }}</span>
                </div>
                <ul>
                  <li v-for="assignment in affectedFieldAssignments" :key="assignment.objectId">
                    <span>{{ assignment.objectName }}</span>
                    <small>{{ assignment.systemName }}</small>
                    <strong>{{ assignment.value }}</strong>
                  </li>
                </ul>
              </section>

              <div class="field-definition-actions">
                <button
                  v-if="!fieldDefinitionEditing"
                  class="primary-button"
                  type="button"
                  :disabled="saveState === 'saving' || pendingFieldDefinitionChange !== null"
                  aria-label="Edit field definition"
                  @click="beginFieldDefinitionEdit"
                >
                  Edit
                </button>
                <button
                  v-else
                  class="primary-button"
                  type="button"
                  :disabled="saveState === 'saving' || pendingFieldDefinitionChange !== null"
                  @click="saveFieldDefinitionChanges"
                >
                  Save changes
                </button>
                <button
                  v-if="fieldDefinitionEditing"
                  class="quiet-button"
                  type="button"
                  :disabled="pendingFieldDefinitionChange !== null"
                  @click="cancelFieldDefinitionEdit"
                >
                  Cancel
                </button>
                <button
                  v-if="selectedFieldDefinition.kind === 'custom' && fieldDefinitionEditing"
                  class="quiet-button"
                  type="button"
                  :disabled="saveState === 'saving' || pendingFieldDefinitionChange !== null"
                  @click="requestFieldDefinitionRemoval"
                >
                  Delete field definition
                </button>
              </div>
            </section>
          </div>

          <p v-if="fieldDefinitionError" class="feedback field-definition-error" role="alert">
            {{ fieldDefinitionError }}
          </p>

          <form
            v-if="newCustomFieldFormOpen"
            class="field-definition-create-form"
            @submit.prevent="createCustomField"
          >
            <div class="field-definition-section-heading">
              <div>
                <span class="section-kicker">NEW REUSABLE FIELD</span>
                <h3>Add custom field</h3>
              </div>
              <button
                class="quiet-button"
                type="button"
                @click="newCustomFieldFormOpen = false"
              >
                Cancel
              </button>
            </div>
            <label for="new-custom-field-name">
              Custom field label
              <input
                id="new-custom-field-name"
                v-model="newCustomFieldName"
                maxlength="80"
                required
                autofocus
              >
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
              New field choices
              <textarea id="new-custom-field-options" v-model="newCustomFieldOptions" rows="3" />
            </label>
            <div class="field-definition-actions">
              <button class="primary-button" type="submit" :disabled="saveState === 'saving'">
                Add custom field
              </button>
            </div>
          </form>

          <section
            v-if="pendingFieldDefinitionChange"
            class="field-definition-confirmation"
            role="region"
            aria-label="Field change confirmation"
          >
            <span class="section-kicker">CONFIRM DATA CHANGE</span>
            <h3>
              {{ pendingFieldDefinitionChange.kind === 'remove'
                ? `Delete ${pendingFieldDefinitionChange.fieldName}?`
                : `Remove saved values from ${pendingFieldDefinitionChange.fieldName}?` }}
            </h3>
            <p>
              The following saved values will be cleared. The change will not be applied unless you confirm.
            </p>
            <ul v-if="pendingFieldDefinitionChange.affectedAssignments.length">
              <li
                v-for="assignment in pendingFieldDefinitionChange.affectedAssignments"
                :key="assignment.objectId"
              >
                <span>{{ assignment.objectName }} / {{ assignment.systemName }}</span>
                <strong>{{ assignment.value }}</strong>
              </li>
            </ul>
            <p v-else class="empty-copy">This definition has no saved object values.</p>
            <div class="field-definition-actions">
              <button class="quiet-button" type="button" @click="cancelFieldDefinitionChange">
                Cancel field changes
              </button>
              <button class="primary-button" type="button" @click="confirmFieldDefinitionChange">
                {{ pendingFieldDefinitionChange.kind === 'remove'
                  ? 'Delete field and clear values'
                  : 'Remove options and clear affected values' }}
              </button>
            </div>
          </section>
        </div>
      </dialog>
    </Teleport>

    <footer class="footer flex min-h-14 items-center justify-between gap-4 border-t border-[var(--line-soft)] border-b-0 text-[var(--text-quiet)] text-[0.52rem] tracking-[0.12em] uppercase max-[760px]:gap-2 max-[760px]:text-[0.43rem]">
      <span>WARDEN'S FIELD DESK</span>
      <span
        class="save-feedback p-0 text-[0.65rem] normal-case"
        :class="{ 'error-text': saveState === 'error', 'saved-text': saveState === 'saved' && !hasUncommittedNames }"
        :role="saveState === 'error' ? 'alert' : 'status'"
        :aria-live="saveState === 'error' ? 'assertive' : 'polite'"
      >
        <span class="inline-block size-[0.4rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
        {{ saveMessage }}
      </span>
      <span>LOCAL STORAGE / NO ACCOUNT</span>
    </footer>
  </div>
</template>

<style>
body {
  color: var(--text-primary);
  background:
    radial-gradient(ellipse at 74% 15%, rgba(78, 129, 115, 0.18), transparent 38rem),
    radial-gradient(circle at 1px 1px, rgba(186, 208, 199, 0.07) 0.65px, transparent 0.9px),
    var(--app-bg);
  background-size: auto, 40px 40px, auto;
}

.field-definitions-trigger {
  display: grid;
  min-height: 2.45rem;
  gap: 0.12rem;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.34rem 0.55rem;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.field-definitions-trigger:hover {
  border-color: var(--accent);
  background: var(--control-hover);
  color: var(--accent-hover);
}

.field-definitions-trigger span {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

.field-definitions-trigger small {
  color: var(--accent);
  font-size: 0.5rem;
  letter-spacing: 0.12em;
}

.field-definitions-dialog {
  width: min(60rem, calc(100vw - 2rem));
  max-width: none;
  max-height: calc(100dvh - 2rem);
  margin: auto;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: 0 1.8rem 5rem rgba(0, 0, 0, 0.55);
}

.field-definitions-dialog::backdrop {
  background: rgba(4, 9, 11, 0.76);
  backdrop-filter: blur(4px);
}

.field-definitions-content {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
}

.field-definitions-header,
.field-definition-editor-heading,
.field-definition-section-heading,
.field-definition-list-heading,
.field-definition-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.field-definitions-header {
  align-items: flex-start;
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 1rem;
}

.field-definitions-header h2,
.field-definition-editor-heading h3,
.field-definition-section-heading h4,
.field-definition-create-form h3,
.field-definition-confirmation h3 {
  margin: 0.4rem 0 0;
  font-family: Georgia, serif;
  font-weight: 500;
}

.field-definitions-header h2 {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
}

.field-definitions-header p,
.field-definition-confirmation > p {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.field-definitions-close {
  flex: 0 0 auto;
}

.field-definitions-layout {
  display: grid;
  grid-template-columns: minmax(13rem, 0.75fr) minmax(0, 1.5fr);
  min-height: 19rem;
  border: 1px solid var(--line-soft);
  background: var(--panel-raised);
}

.field-definition-list {
  display: grid;
  align-content: start;
  gap: 1rem;
  border-right: 1px solid var(--line-soft);
  padding: 0.9rem;
}

.field-definition-list h3 {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.field-definition-list-heading {
  margin-bottom: 0.45rem;
}

.field-definition-list-heading h3 {
  margin: 0;
}

.field-definition-add {
  min-height: 1.8rem;
  padding: 0.25rem 0.45rem;
  font-size: 0.62rem;
}

.field-definition-choice {
  display: grid;
  width: 100%;
  gap: 0.2rem;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: 0.5rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.field-definition-choice:hover,
.field-definition-choice.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-primary);
}

.field-definition-choice small {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-list .empty-copy {
  margin: 0;
}

.field-definition-editor {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-width: 0;
  padding: 1rem;
}

.field-definition-editor-heading {
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 0.75rem;
}

.field-definition-editor-heading h3 {
  overflow-wrap: anywhere;
  font-size: 1.35rem;
}

.field-definition-value-count {
  flex: 0 0 auto;
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
  text-align: right;
}

.field-definition-editor > label,
.field-definition-create-form > label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.68rem;
}

.field-definition-editor input,
.field-definition-editor textarea,
.field-definition-create-form input,
.field-definition-create-form select,
.field-definition-create-form textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.55rem 0.65rem;
  background: var(--control-bg);
  color: var(--text-primary);
  font: inherit;
}

.field-definition-editor input:focus,
.field-definition-editor textarea:focus,
.field-definition-create-form input:focus,
.field-definition-create-form select:focus,
.field-definition-create-form textarea:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent-soft);
  outline-offset: 1px;
}

.field-definition-values,
.field-definition-create-form,
.field-definition-confirmation {
  border: 1px solid var(--line-soft);
  padding: 0.8rem;
  background: var(--panel-bg);
}

.field-definition-section-heading h4 {
  margin: 0;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-definition-section-heading > span {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-values ul,
.field-definition-confirmation ul {
  display: grid;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
}

.field-definition-values li,
.field-definition-confirmation li {
  display: grid;
  grid-template-columns: minmax(5rem, 1fr) minmax(5rem, 1fr) minmax(4rem, auto);
  gap: 0.6rem;
  align-items: center;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.4rem;
  font-size: 0.68rem;
}

.field-definition-values li small {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-values li strong,
.field-definition-confirmation li strong {
  color: var(--accent-hover);
  overflow-wrap: anywhere;
  text-align: right;
}

.field-definition-values .empty-copy {
  margin: 0.55rem 0 0;
}

.field-definition-affected,
.field-definition-confirmation {
  border-color: var(--error-border);
  background: linear-gradient(135deg, rgba(166, 93, 93, 0.12), var(--panel-bg) 58%);
}

.field-definition-actions {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.field-definition-error {
  margin: 0;
}

.field-definition-create-form {
  display: grid;
  gap: 0.8rem;
}

.field-definition-create-form .section-kicker {
  display: block;
}

.field-definition-confirmation {
  display: grid;
  gap: 0.5rem;
}

.field-definition-confirmation h3 {
  margin-top: 0;
  font-size: 1.1rem;
}

.field-definition-confirmation .empty-copy {
  margin: 0.5rem 0 0;
}

@media (max-width: 760px) {
  .field-definitions-dialog {
    width: calc(100vw - 1rem);
    max-height: calc(100dvh - 1rem);
  }

  .field-definitions-content {
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .field-definitions-layout {
    grid-template-columns: 1fr;
  }

  .field-definition-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: 0;
    border-bottom: 1px solid var(--line-soft);
  }

  .field-definition-list > section:nth-child(2) {
    grid-column: 1 / -1;
  }

  .field-definition-editor {
    padding: 0.75rem;
  }

  .field-definition-values li,
  .field-definition-confirmation li {
    grid-template-columns: minmax(4rem, 0.8fr) minmax(4rem, 1fr) minmax(3rem, auto);
    gap: 0.35rem;
  }
}

button,
a,
input,
select,
textarea {
  -webkit-tap-highlight-color: transparent;
}

.wordmark-symbol {
  color: var(--accent);
  font-family: Georgia, serif;
  font-size: 1.1rem;
}

.wordmark strong {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
}

.wordmark small {
  color: var(--text-muted);
  font-size: 0.55rem;
  letter-spacing: 0.13em;
}

.cluster-stamp small,
.system-stamp small,
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

.cluster-stamp small,
.system-stamp small {
  color: var(--text-muted);
}

.cluster-stamp strong,
.system-stamp strong {
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
}

.section-kicker {
  color: var(--accent);
}

h1,
h2 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 400;
}

.intro p,
.message-panel > p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.75;
}

.panel,
.setup-panel,
.message-panel {
  border: 1px solid var(--line);
  background: var(--panel-bg);
  box-shadow: 0 1.2rem 3.6rem rgba(0, 0, 0, 0.24);
}

.step-marker,
.tree-count {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

label {
  color: var(--text-secondary);
  font-size: 0.67rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

input:hover,
select:hover,
textarea:hover {
  border-color: var(--line-strong);
}

input[aria-invalid="true"],
select[aria-invalid="true"],
textarea[aria-invalid="true"] {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.primary-button,
.secondary-button,
.quiet-button,
.tool-button {
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.primary-button {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.primary-button:hover:not(:disabled) {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
}

.secondary-button,
.quiet-button {
  background: transparent;
  color: var(--text-secondary);
}

.secondary-button:hover:not(:disabled),
.quiet-button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.chart-details-control[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.save-feedback {
  color: var(--text-muted);
  line-height: 1.5;
}

.saved-text {
  color: var(--status-good);
}

.error-text {
  color: var(--error);
}

.feedback {
  font-size: 0.75rem;
  line-height: 1.5;
}

.error-panel {
  border-color: var(--error-border);
  background: linear-gradient(135deg, rgba(166, 93, 93, 0.14), var(--panel-bg) 52%);
}

.chart-stats {
  color: var(--text-muted);
}

.chart-stats strong {
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1.15rem;
  font-weight: 400;
}

.chart-names summary {
  color: var(--text-secondary);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.subsection-label {
  color: var(--text-muted);
  font-size: 0.56rem;
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
  font-size: 0.52rem;
}

.tree-row {
  font-size: 0.7rem;
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

.empty-copy,
.hierarchy-note {
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.55;
}

.tool-button {
  background: var(--control-bg);
  color: var(--text-secondary);
  font-size: 0.67rem;
}

.tool-button span {
  color: var(--accent);
  font-size: 1.05rem;
}

.tool-button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--control-hover);
  color: var(--accent-hover);
}

.add-button {
  border-color: var(--status-good);
  background: var(--add-bg);
  color: var(--text-primary);
}

.add-button span {
  color: var(--accent-hover);
}

.add-button:hover:not(:disabled) {
  border-color: var(--status-good);
  background: var(--add-bg-hover);
  color: var(--text-primary);
}

.object-mark {
  display: inline-grid;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  font: 0.9rem/1 "Segoe UI Symbol", Georgia, serif;
}

.object-mark-large {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 1.2rem;
}

.object-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.object-title > span:last-child {
  min-width: 0;
}

.object-palette {
  display: grid;
  gap: 0.35rem;
  margin-block: 0.8rem;
  border: 1px solid var(--line-soft);
  border-radius: 3px;
  padding: 0.45rem;
  background: rgba(10, 17, 19, 0.42);
}

.object-palette-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.8rem;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: grab;
  font-size: 0.62rem;
  padding: 0.25rem 0.42rem;
}

.object-palette-category-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.65rem;
  border: 1px solid var(--line-soft);
  border-radius: 2px;
  background: rgba(10, 17, 19, 0.42);
  color: var(--text-muted);
  cursor: pointer;
  font: 0.55rem Consolas, monospace;
  padding: 0.22rem 0.4rem;
}

.object-palette-category-button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-hover);
}

.object-palette-button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--control-hover);
  color: var(--accent-hover);
}

.object-palette-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.object-palette-category-button:focus-visible {
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
  color: var(--text-muted);
  font: 0.55rem Consolas, monospace;
}

.placement-hint {
  font-size: 0.58rem;
}

.map-fallback {
  color: var(--map-muted);
  font: 0.8rem Georgia, serif;
}

.map-note {
  color: var(--text-muted);
  font: 0.56rem Consolas, monospace;
}

.type-chip {
  color: var(--status-good);
  font: 0.55rem Consolas, monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.inspector-intro {
  color: var(--text-secondary);
  font-size: 0.7rem;
  line-height: 1.55;
}

.orbit-facts {
  font-size: 0.7rem;
}

.orbit-facts span {
  color: var(--text-muted);
}

.orbit-facts strong {
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 400;
}

.inspector-footnote {
  color: var(--text-muted);
  font-size: 0.66rem;
  line-height: 1.55;
}

.map-workspace-shell {
  min-height: 100vh;
  min-height: 100dvh;
  padding-inline: 0;
}

.map-workspace-shell .topbar,
.map-workspace-shell > .footer {
  padding-inline: clamp(1rem, 3.5vw, 3.5rem);
}

.map-workspace-shell .topbar {
  position: relative;
  z-index: 6;
  flex-wrap: wrap;
}

.map-workspace-shell .workspace-header-summary {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(0.75rem, 2vw, 1.75rem);
}

.map-workspace-shell .cluster-stamp,
.map-workspace-shell .system-stamp {
  display: grid;
  min-width: 0;
  flex: 1 1 12rem;
  justify-items: center;
  gap: 0.2rem;
  text-align: center;
}

.map-workspace-shell .workspace-summary-name {
  display: block;
  max-width: 100%;
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.map-workspace-shell .header-summary-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.7rem;
  padding: 0;
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  line-height: 1.2;
}

.map-workspace-shell .header-summary-stats > span {
  white-space: nowrap;
}

.map-workspace-shell .header-summary-stats strong {
  display: inline;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1;
  vertical-align: baseline;
}

.map-workspace-shell .header-map-actions {
  position: relative;
  flex: 0 0 auto;
}

.map-workspace-shell .header-map-actions-toggle {
  display: inline-flex;
  min-height: 2.35rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 0.4rem 0.5rem;
  background: rgba(18, 28, 30, 0.96);
  color: var(--text-secondary);
  cursor: pointer;
  font: 0.55rem Consolas, monospace;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.map-workspace-shell .header-map-actions-indicator {
  color: var(--accent);
  font-size: 0.8rem;
}

.map-workspace-shell .header-map-actions-toggle:hover {
  border-color: var(--accent);
  color: var(--accent-hover);
}

.map-workspace-shell .header-map-actions-panel {
  position: absolute;
  z-index: 12;
  top: calc(100% + 0.45rem);
  right: 0;
  display: grid;
  width: min(22rem, calc(100vw - 2rem));
  gap: 0.55rem;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 0.7rem;
  background: rgba(18, 28, 30, 0.98);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
}

.map-workspace-shell .header-map-actions-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.56rem Consolas, monospace;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.map-workspace-shell .header-map-actions-exports {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

.map-workspace-shell .header-map-actions-exports .tool-button {
  width: 100%;
  min-width: 0;
  justify-content: center;
  overflow-wrap: anywhere;
  padding-inline: 0.35rem;
  white-space: normal;
}

.map-workspace-shell .header-map-actions-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.62rem;
  line-height: 1.45;
}

.map-workspace-shell .header-map-actions-import {
  width: 100%;
  justify-content: space-between;
}

.map-workspace-shell .header-map-actions-panel .feedback {
  margin: 0;
  border: 1px solid var(--error-border);
  padding: 0.45rem 0.6rem;
  background: var(--error-bg);
}

.map-workspace-shell .main-content {
  width: 100%;
  max-width: none;
  min-height: 0;
  margin-inline: 0;
  padding: 0;
}

.map-workspace-shell .editor {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.map-workspace-shell .system-map-header {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  right: clamp(0.75rem, 2vw, 1.5rem);
  left: clamp(0.75rem, 2vw, 1.5rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  gap: 0.6rem;
  pointer-events: none;
}

.map-workspace-shell .cluster-map-header {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  right: clamp(0.75rem, 2vw, 1.5rem);
  left: clamp(0.75rem, 2vw, 1.5rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  gap: 0.6rem;
  pointer-events: none;
}

.map-workspace-shell .editor-grid {
  position: relative;
  display: block;
  width: 100%;
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
}

.map-workspace-shell .map-panel {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.map-workspace-shell .workspace-canvas {
  position: absolute;
  inset: 0;
  display: block;
  min-height: 0;
  border: 0;
}

.map-workspace-shell .map-tools {
  position: absolute;
  z-index: 4;
  top: 0.55rem;
  right: 0.75rem;
  display: grid;
  width: min(56rem, 54%);
  justify-items: end;
  gap: 0.35rem;
  pointer-events: none;
}

.map-workspace-shell .map-tools > * {
  max-width: 100%;
  pointer-events: auto;
}

.map-workspace-shell .system-map-header .system-map-tools {
  position: relative;
  top: auto;
  right: auto;
  left: auto;
  grid-column: 2;
  grid-row: 1;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  justify-self: center;
  flex: none;
  transform: none;
  justify-items: center;
  gap: 0.35rem;
}

.map-workspace-shell .cluster-map-header .cluster-map-tools {
  position: relative;
  top: auto;
  right: auto;
  left: auto;
  grid-column: 2;
  grid-row: 1;
  display: flex;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  justify-self: center;
  justify-content: center;
  flex: none;
  transform: none;
  gap: 0.35rem;
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
  background: rgba(18, 28, 30, 0.96);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
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
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.map-workspace-shell .object-palette-heading {
  min-width: 0;
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

.map-workspace-shell .cluster-edit-palette {
  width: fit-content;
  max-width: min(28rem, calc(100vw - 2rem));
  flex: 0 1 auto;
  gap: 0.35rem;
  margin: 0;
  border-color: var(--line);
  padding: 0.4rem;
  background: rgba(18, 28, 30, 0.96);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
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

.map-workspace-shell .workspace-side-panel {
  position: absolute;
  z-index: 5;
  top: 10rem;
  bottom: 0.75rem;
  width: clamp(15rem, 22vw, 21rem);
  border: 1px solid rgba(86, 105, 107, 0.82);
  border-radius: 3px;
  background: rgba(18, 28, 30, 0.96);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
}

.map-workspace-shell .system-map-editor-grid .workspace-side-panel {
  top: 18.25rem;
}

.hierarchy-panel-enter-active,
.hierarchy-panel-leave-active,
.inspector-panel-enter-active,
.inspector-panel-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.hierarchy-panel-enter-from,
.hierarchy-panel-leave-to {
  opacity: 0;
  transform: translateX(-0.75rem);
}

.inspector-panel-enter-from,
.inspector-panel-leave-to {
  opacity: 0;
  transform: translateX(0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .hierarchy-panel-enter-active,
  .hierarchy-panel-leave-active,
  .inspector-panel-enter-active,
  .inspector-panel-leave-active {
    transition-duration: 0.01ms;
  }
}

.map-workspace-shell .hierarchy-panel {
  left: 0.75rem;
}

.map-workspace-shell .inspector-panel {
  right: 0.75rem;
}

.map-workspace-shell .panel-toggle-button {
  display: grid;
  min-width: 2rem;
  min-height: 2rem;
  place-items: center;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
}

.map-workspace-shell .cluster-map-nav-button {
  background: var(--control-bg);
}

.map-workspace-shell .panel-close-button {
  position: absolute;
  z-index: 1;
  top: 0.55rem;
  right: 0.55rem;
  display: grid;
  min-width: 2rem;
  min-height: 2rem;
  place-items: center;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
}

.map-workspace-shell .panel-reopen {
  position: absolute;
  z-index: 6;
  top: 50%;
  display: flex;
  width: 2.35rem;
  min-height: 7rem;
  transform: translateY(-50%);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 1px solid var(--line-strong);
  background: rgba(18, 28, 30, 0.96);
  color: var(--text-secondary);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 0.7rem 1.8rem rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
}

.map-workspace-shell .panel-reopen-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.map-workspace-shell .panel-reopen-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 0.56rem;
  line-height: 1;
}

.map-workspace-shell .panel-reopen:hover {
  border-color: var(--accent);
  background: var(--panel-raised);
  color: var(--accent-hover);
}

.map-workspace-shell .panel-reopen-left {
  left: 0;
  border-left: 0;
  border-radius: 0 3px 3px 0;
}

.map-workspace-shell .panel-reopen-right {
  right: 0;
  border-right: 0;
  border-radius: 3px 0 0 3px;
}

.map-workspace-shell .map-note {
  display: none;
}

@media (max-width: 1100px) {
  .map-workspace-shell .workspace-header-summary {
    order: 3;
    flex: 1 0 100%;
    border-top: 1px solid var(--line-soft);
    padding-top: 0.4rem;
  }
}

@media (max-width: 1200px) {
  .map-workspace-shell .system-map-header,
  .map-workspace-shell .cluster-map-header {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .map-workspace-shell .system-map-header .system-map-tools {
    position: relative;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    flex: 0 1 auto;
    justify-items: center;
  }

  .map-workspace-shell .cluster-map-header .cluster-map-tools {
    position: relative;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    flex: 0 1 auto;
  }
}

@media (max-width: 760px) {
  .map-workspace-shell .topbar,
  .map-workspace-shell > .footer {
    padding-inline: 0.75rem;
  }

  .map-workspace-shell .topbar-actions {
    margin-left: auto;
  }

  .map-workspace-shell .workspace-header-summary {
    gap: 0.4rem 0.7rem;
  }

  .map-workspace-shell .system-map-header {
    top: 0.45rem;
    right: 0.5rem;
    left: 0.5rem;
    gap: 0.45rem;
  }

  .map-workspace-shell .cluster-map-header {
    top: 0.45rem;
    right: 0.5rem;
    left: 0.5rem;
    gap: 0.45rem;
  }

  .map-workspace-shell .workspace-summary-name {
    font-size: 0.88rem;
  }

  .map-workspace-shell .map-tools {
    top: 4.15rem;
    right: 0.5rem;
    left: 0.5rem;
    width: auto;
    justify-items: stretch;
  }

  .map-workspace-shell .system-map-header .system-map-tools {
    width: 100%;
    min-width: 0;
    flex: 1 1 100%;
    gap: 0.35rem;
  }

  .map-workspace-shell .system-map-tools .object-palette {
    width: fit-content;
    max-width: 100%;
  }

  .map-workspace-shell .object-palette-hint {
    display: none;
  }

  .map-workspace-shell .cluster-edit-palette {
    max-width: calc(100vw - 1rem);
  }

  .map-workspace-shell .workspace-side-panel {
    top: 14rem;
    right: 0.5rem;
    bottom: 0.5rem;
    left: 0.5rem;
    width: auto;
  }

  .map-workspace-shell .system-map-editor-grid .workspace-side-panel {
    top: 25rem;
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen {
    top: auto;
    bottom: 2rem;
    transform: none;
  }

  .map-workspace-shell .map-navigation {
    bottom: 0.5rem;
  }
}

@media (max-width: 360px) {
  .map-workspace-shell .topbar {
    gap: 0.5rem;
  }

  .map-workspace-shell .wordmark {
    gap: 0.45rem;
  }

  .map-workspace-shell .wordmark-symbol {
    width: 1.75rem;
    height: 1.75rem;
  }

  .map-workspace-shell .wordmark small,
  .map-workspace-shell .local-badge {
    display: none;
  }
}

@media (max-width: 760px) and (max-height: 320px) {
  .map-workspace-shell .topbar {
    min-height: 3.25rem;
  }

  .map-workspace-shell .wordmark {
    gap: 0.45rem;
  }

  .map-workspace-shell .wordmark-symbol {
    width: 1.75rem;
    height: 1.75rem;
  }

  .map-workspace-shell .local-badge {
    display: none;
  }

  .map-workspace-shell .wordmark small,
  .map-workspace-shell .system-map-tools .object-palette-heading {
    display: none;
  }

  .map-workspace-shell .system-map-header,
  .map-workspace-shell .cluster-map-header {
    top: 0.25rem;
    gap: 0.5rem;
  }

  .map-workspace-shell .workspace-header-summary {
    gap: 0.15rem 0.5rem;
  }

  .map-workspace-shell .cluster-stamp,
  .map-workspace-shell .system-stamp {
    gap: 0.05rem;
  }

  .map-workspace-shell .cluster-stamp small,
  .map-workspace-shell .system-stamp small {
    font-size: 0.42rem;
    letter-spacing: 0.03em;
  }

  .map-workspace-shell .workspace-summary-name {
    font-size: 0.75rem;
  }

  .map-workspace-shell .header-summary-stats {
    gap: 0.1rem 0.3rem;
    font-size: 0.4rem;
  }

  .map-workspace-shell .header-summary-stats strong {
    font-size: 0.62rem;
  }

  .map-workspace-shell .system-map-header .system-map-tools {
    min-width: 0;
    flex-basis: 100%;
    gap: 0.2rem;
  }

  .map-workspace-shell .cluster-map-header .cluster-map-tools {
    min-width: 0;
    flex-basis: 100%;
    gap: 0.2rem;
  }

  .map-workspace-shell .system-map-tools .object-palette {
    gap: 0.15rem;
    padding: 0.15rem;
  }

  .map-workspace-shell .object-palette-categories {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    gap: 0.15rem;
    scrollbar-width: thin;
  }

  .map-workspace-shell .object-palette-category-button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .map-workspace-shell .system-map-tools .object-palette-button,
  .map-workspace-shell .system-map-tools .object-palette-category-button {
    min-height: 1.25rem;
    gap: 0.15rem;
    padding: 0.12rem 0.25rem;
    font-size: 0.55rem;
  }

  .map-workspace-shell .system-map-editor-grid .object-palette-orbit {
    margin-bottom: 0;
  }

  .map-workspace-shell .map-navigation {
    top: auto;
    right: auto;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen {
    position: fixed;
    top: 0.5rem;
    bottom: auto;
    width: auto;
    min-height: 1.6rem;
    transform: none;
    flex-direction: row;
    gap: 0.25rem;
    padding: 0.2rem 0.35rem;
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen-icon {
    font-size: 0.8rem;
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen-label {
    writing-mode: horizontal-tb;
    font-size: 0.45rem;
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen-left {
    right: 5.5rem;
    left: auto;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
  }

  .map-workspace-shell .system-map-editor-grid .panel-reopen-right {
    right: 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
  }
}
</style>
