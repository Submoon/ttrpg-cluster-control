export interface Point {
  x: number
  y: number
}

export const catalogueTypes = [
  { value: 'star', family: 'CelestialBody', label: 'Star', keyPrefix: 'STAR' },
  { value: 'planet', family: 'CelestialBody', label: 'Planet', keyPrefix: 'PL' },
  { value: 'moon', family: 'CelestialBody', label: 'Moon', keyPrefix: 'MO' },
  { value: 'asteroid', family: 'SmallBody/Field', label: 'Asteroid', keyPrefix: 'AST' },
  { value: 'belt', family: 'SmallBody/Field', label: 'Belt', keyPrefix: 'BELT' },
  { value: 'station', family: 'Installation', label: 'Station', keyPrefix: 'ST' },
  { value: 'base', family: 'Installation', label: 'Base', keyPrefix: 'BASE' },
  { value: 'colony', family: 'Installation', label: 'Colony', keyPrefix: 'COL' },
  { value: 'vessel', family: 'Vessel', label: 'Vessel', keyPrefix: 'VES' },
  { value: 'derelict', family: 'Vessel', label: 'Derelict', keyPrefix: 'DER' },
  { value: 'jump-point', family: 'JumpPoint', label: 'Jump Point', keyPrefix: 'JP' },
  { value: 'anomaly', family: 'Phenomenon', label: 'Anomaly', keyPrefix: 'AN' },
  { value: 'nebula', family: 'Phenomenon', label: 'Nebula', keyPrefix: 'NEB' },
  { value: 'hazard', family: 'Phenomenon', label: 'Hazard', keyPrefix: 'HZ' },
  { value: 'other', family: 'Other', label: 'Other', keyPrefix: 'OTH' },
] as const

export type CatalogueSubtype = typeof catalogueTypes[number]['value']
export type ObjectFamily = typeof catalogueTypes[number]['family']

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'single-select'
export type CustomFieldValue = string | number | boolean

export type CustomFieldDefinition =
  | { id: string; name: string; type: 'text' | 'number' | 'boolean' }
  | { id: string; name: string; type: 'single-select'; options: string[] }

export interface ObjectFieldSettings {
  atmosphereOptions: string[]
  portClassOptions: string[]
  customFields: CustomFieldDefinition[]
}

export type ObjectPlacement =
  | { kind: 'system'; x: number; y: number }
  | { kind: 'orbit'; orbitId: string }

export interface SystemObject {
  id: string
  family: ObjectFamily
  subtype: string
  locationKey: string
  name: string
  description: string
  placement: ObjectPlacement
  atmosphere?: string
  portClass?: string
  customFieldValues?: Record<string, CustomFieldValue>
  jumpStationId?: string | null
}

export interface OrbitRadii {
  horizontal: number
  vertical: number
}

export type Orbit = {
  id: string
  order: number
} & (
  | { hostId: string; center?: never }
  | { hostId: null; center: Point }
)

export type JumpRoute = {
  id: string
  name?: string
  jumpLevel: number
  fromPointId: string
} & (
  | { toPointId: string; unresolvedExit?: never }
  | { toPointId: null; unresolvedExit: string }
)

type JumpRouteDetails = Pick<JumpRoute, 'jumpLevel' | 'fromPointId'> & (
  | { toPointId: string; unresolvedExit?: never }
  | { toPointId: null; unresolvedExit: string }
)

export interface StarSystem {
  id: string
  name: string
  objects: SystemObject[]
  orbits: Orbit[]
}

export interface JumpCluster {
  id: string
  name: string
  systems: StarSystem[]
  routes: JumpRoute[]
}

export interface JumpPointReference {
  point: SystemObject
  system: StarSystem
}

export interface LocalWorkspace {
  id: string
  cluster: JumpCluster
  layout: {
    systemPositions: Record<string, Point>
    orbitRadii: Record<string, OrbitRadii>
    orbitRotations: Record<string, number>
    objectAngles: Record<string, number>
  }
  objectFieldSettings: ObjectFieldSettings
}

export interface ExportedLayout {
  version: 1
  orbitRadii: Record<string, OrbitRadii | number>
  orbitEllipseRadii?: Record<string, OrbitRadii>
  orbitRotations?: Record<string, number>
  objectAngles: Record<string, number>
}

export type JumpClusterExport = {
  format: 'mothership-campaign-map'
  version: 1
  type: 'cluster'
  cluster: JumpCluster
  objectFieldSettings: ObjectFieldSettings
  layout: ExportedLayout & { systemPositions: Record<string, Point> }
}

export type StarSystemExport = {
  format: 'mothership-campaign-map'
  version: 1
  type: 'system'
  system: StarSystem
  objectFieldSettings: ObjectFieldSettings
  layout: ExportedLayout
}

export interface JsonImportSummary {
  type: 'cluster' | 'system'
  systems: number
  objects: number
  orbits: number
  routes: number
  customFields: number
  idCollisions: Array<{ entity: string; name: string; id: string }>
  possibleMatches: Array<{ entity: string; name: string; existingSystem: string; reason: string }>
}

export interface PreparedJsonImport {
  workspace: LocalWorkspace
  addedSystemIds: string[]
  summary: JsonImportSummary
}

export interface SystemObjectChanges {
  locationKey?: string
  name?: string
  description?: string
  subtype?: string
  placement?: ObjectPlacement
  atmosphere?: string
  portClass?: string
  customFieldValues?: Record<string, CustomFieldValue>
  jumpStationId?: string | null
}

export type MapDeletionTarget =
  | { kind: 'system'; systemId: string }
  | { kind: 'object'; systemId: string; objectId: string }
  | { kind: 'orbit'; systemId: string; orbitId: string }
  | { kind: 'route'; routeId: string }

export interface MapDeletionPlan {
  workspace: LocalWorkspace
  entityLabel: string
  affectedEntities: string[]
}

const maxNameLength = 80

export function defaultObjectFieldSettings(): ObjectFieldSettings {
  return {
    atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
    portClassOptions: ['Class I', 'Class II', 'Class III'],
    customFields: [],
  }
}

function validText(value: string, label: string, maxLength?: number): string {
  const text = value.trim()
  if (!text) throw new Error(`${label} is required.`)
  if (maxLength !== undefined && text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`)
  }
  return text
}

function validName(value: string, label: string): string {
  return validText(value, label, maxNameLength)
}

function validFieldOptions(options: string[], label: string): string[] {
  if (!Array.isArray(options) || options.some(option => typeof option !== 'string')) {
    throw new Error(`${label} must be a list of text values.`)
  }

  const normalized = options.map(option => validText(option, label, maxNameLength))
  if (new Set(normalized.map(option => option.toLowerCase())).size !== normalized.length) {
    throw new Error(`${label} must not contain duplicate options.`)
  }
  return normalized
}

function nextLocationKey(system: StarSystem, prefix: string): string {
  let index = 1
  let key = `${prefix}-${String(index).padStart(2, '0')}`
  while (system.objects.some(object => object.locationKey === key)) {
    index += 1
    key = `${prefix}-${String(index).padStart(2, '0')}`
  }
  return key
}

export function initialSystemPlacement(system: StarSystem): Extract<ObjectPlacement, { kind: 'system' }> {
  const index = system.objects.filter(object => object.placement.kind === 'system').length
  // ponytail: initial positions cycle a 20-point grid; manual X/Y editing handles denser maps.
  return {
    kind: 'system',
    x: 0.1 + (index % 5) * 0.2,
    y: 0.1 + (Math.floor(index / 5) % 4) * 0.24,
  }
}

function initialStarSystem(name: string): StarSystem {
  return {
    id: crypto.randomUUID(),
    name: validName(name, 'Star system name'),
    objects: [{
      id: crypto.randomUUID(),
      family: 'CelestialBody',
      subtype: 'star',
      locationKey: 'A',
      name: 'Primary Star',
      description: '',
      placement: { kind: 'system', x: 0.5, y: 0.5 },
    }],
    orbits: [],
  }
}

function initialClusterSystemPosition(index: number): Point {
  return {
    x: 0.18 + (index % 3) * 0.32,
    y: 0.35 + Math.floor(index / 3) * 0.3,
  }
}

export function createLocalWorkspace(clusterName: string, systemName: string): LocalWorkspace {
  const system = initialStarSystem(systemName)

  return {
    id: crypto.randomUUID(),
    cluster: {
      id: crypto.randomUUID(),
      name: validName(clusterName, 'Jump Cluster name'),
      systems: [system],
      routes: [],
    },
    layout: {
      systemPositions: { [system.id]: initialClusterSystemPosition(0) },
      orbitRadii: {},
      orbitRotations: {},
      objectAngles: {},
    },
    objectFieldSettings: defaultObjectFieldSettings(),
  }
}

export function updateNativeFieldOptions(
  workspace: LocalWorkspace,
  field: 'atmosphere' | 'portClass',
  options: string[],
  clearInvalidValues = false,
): LocalWorkspace {
  const normalized = validFieldOptions(options, `${field === 'atmosphere' ? 'Atmosphere' : 'Port class'} option`)
  const property = field === 'atmosphere' ? 'atmosphereOptions' : 'portClassOptions'
  let hasInvalidValues = false

  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object[field]
      if (value !== undefined && !normalized.includes(value)) {
        hasInvalidValues = true
        if (!clearInvalidValues) {
          throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
        }
      }
    }
  }

  const systems = hasInvalidValues
    ? workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          const value = object[field]
          if (value === undefined || normalized.includes(value)) return object
          const updatedObject = { ...object }
          delete updatedObject[field]
          return updatedObject
        }),
      }))
    : workspace.cluster.systems

  return {
    ...workspace,
    ...(hasInvalidValues ? { cluster: { ...workspace.cluster, systems } } : {}),
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      [property]: normalized,
    },
  }
}

export function addCustomFieldDefinition(
  workspace: LocalWorkspace,
  name: string,
  type: CustomFieldType,
  options: string[] = [],
): LocalWorkspace {
  const fieldName = validName(name, 'Custom field name')
  if (workspace.objectFieldSettings.customFields.some(field => field.name.toLowerCase() === fieldName.toLowerCase())) {
    throw new Error(`A custom field named "${fieldName}" already exists.`)
  }

  const definition: CustomFieldDefinition = type === 'single-select'
    ? {
        id: crypto.randomUUID(),
        name: fieldName,
        type,
        options: validFieldOptions(options, `${fieldName} option`),
      }
    : { id: crypto.randomUUID(), name: fieldName, type }

  return {
    ...workspace,
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [...workspace.objectFieldSettings.customFields, definition],
    },
  }
}

export function renameCustomFieldDefinition(
  workspace: LocalWorkspace,
  fieldId: string,
  name: string,
): LocalWorkspace {
  const definition = workspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) {
    throw new Error('The selected custom field no longer exists.')
  }

  const fieldName = validName(name, 'Custom field name')
  if (workspace.objectFieldSettings.customFields.some(field =>
    field.id !== fieldId && field.name.toLowerCase() === fieldName.toLowerCase(),
  )) {
    throw new Error(`A custom field named "${fieldName}" already exists.`)
  }

  return {
    ...workspace,
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.map(field =>
        field.id === fieldId ? { ...field, name: fieldName } : field,
      ),
    },
  }
}

export function updateCustomFieldOptions(
  workspace: LocalWorkspace,
  fieldId: string,
  options: string[],
  clearInvalidValues = false,
): LocalWorkspace {
  const definition = workspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) {
    throw new Error('The selected custom field no longer exists.')
  }
  if (definition.type !== 'single-select') {
    throw new Error('Only single-select custom fields have editable options.')
  }

  const normalized = validFieldOptions(options, `${definition.name} option`)
  let hasInvalidValues = false
  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object.customFieldValues?.[fieldId]
      if (typeof value === 'string' && !normalized.includes(value)) {
        hasInvalidValues = true
        if (!clearInvalidValues) {
          throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
        }
      }
    }
  }

  const systems = hasInvalidValues
    ? workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          const value = object.customFieldValues?.[fieldId]
          if (typeof value !== 'string' || normalized.includes(value)) return object
          const customFieldValues = { ...object.customFieldValues }
          delete customFieldValues[fieldId]
          return { ...object, customFieldValues }
        }),
      }))
    : workspace.cluster.systems

  return {
    ...workspace,
    ...(hasInvalidValues ? { cluster: { ...workspace.cluster, systems } } : {}),
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.map(field =>
        field.id === fieldId && field.type === 'single-select'
          ? { ...field, options: normalized }
          : field,
      ),
    },
  }
}

export function removeCustomFieldDefinition(workspace: LocalWorkspace, fieldId: string): LocalWorkspace {
  if (!workspace.objectFieldSettings.customFields.some(field => field.id === fieldId)) {
    throw new Error('The selected custom field no longer exists.')
  }

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          if (!object.customFieldValues || !(fieldId in object.customFieldValues)) return object
          const customFieldValues = { ...object.customFieldValues }
          delete customFieldValues[fieldId]
          return { ...object, customFieldValues }
        }),
      })),
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.filter(field => field.id !== fieldId),
    },
  }
}

export function addStarSystem(
  workspace: LocalWorkspace,
  name = `New System ${workspace.cluster.systems.length + 1}`,
): { workspace: LocalWorkspace; system: StarSystem } {
  const system = initialStarSystem(name)
  const index = workspace.cluster.systems.length
  return {
    system,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems: [...workspace.cluster.systems, system],
      },
      layout: {
        ...workspace.layout,
        systemPositions: {
          ...workspace.layout.systemPositions,
          [system.id]: initialClusterSystemPosition(index),
        },
      },
    },
  }
}

function mapObjectLabel(object: SystemObject): string {
  const label = catalogueTypes.find(type => type.value === object.subtype && type.family === object.family)?.label
    ?? object.subtype
  return `${object.name} (${label}, ${object.locationKey})`
}

function orbitLabel(system: StarSystem, orbit: Orbit): string {
  const hostName = orbit.hostId === null
    ? 'unoccupied center'
    : system.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Orbit ${orbit.order} around ${hostName}`
}

function normalizeOrbitOrders(orbits: Orbit[]): Orbit[] {
  const byHost = new Map<string | null, Orbit[]>()
  for (const orbit of orbits) {
    const hosted = byHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    byHost.set(orbit.hostId, hosted)
  }

  const orders = new Map<string, number>()
  for (const hosted of byHost.values()) {
    hosted.sort((left, right) => left.order - right.order)
    hosted.forEach((orbit, index) => orders.set(orbit.id, index + 1))
  }
  return orbits.map(orbit => {
    const order = orders.get(orbit.id)!
    return order === orbit.order ? orbit : { ...orbit, order }
  })
}

export function planMapEntityDeletion(
  workspace: LocalWorkspace,
  target: MapDeletionTarget,
): MapDeletionPlan {
  const system = target.kind === 'route'
    ? undefined
    : workspace.cluster.systems.find(candidate => candidate.id === target.systemId)
  if (target.kind !== 'route' && !system) {
    throw new Error('The selected star system no longer exists.')
  }

  const removedSystemIds = new Set<string>()
  const removedObjectIds = new Set<string>()
  const removedOrbitIds = new Set<string>()
  const removedRouteIds = new Set<string>()
  const affectedEntities: string[] = []
  const addedEffects = new Set<string>()
  const addEffect = (effect: string) => {
    if (!addedEffects.has(effect)) {
      addedEffects.add(effect)
      affectedEntities.push(effect)
    }
  }

  const requireSystem = (): StarSystem => {
    if (!system) throw new Error('The selected star system no longer exists.')
    return system
  }
  const objectsById = new Map<string, SystemObject>()
  const orbitsByHost = new Map<string, Orbit[]>()
  const objectsByOrbit = new Map<string, SystemObject[]>()
  for (const object of system?.objects ?? []) {
    objectsById.set(object.id, object)
    if (object.placement.kind !== 'orbit') continue
    const children = objectsByOrbit.get(object.placement.orbitId) ?? []
    children.push(object)
    objectsByOrbit.set(object.placement.orbitId, children)
  }
  for (const orbit of system?.orbits ?? []) {
    if (orbit.hostId === null) continue
    const hosted = orbitsByHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    orbitsByHost.set(orbit.hostId, hosted)
  }

  function collectObjectBranch(objectId: string, includeObject: boolean): void {
    if (removedObjectIds.has(objectId)) return
    const candidate = objectsById.get(objectId)
    if (!candidate) return
    removedObjectIds.add(objectId)
    if (includeObject) addEffect(mapObjectLabel(candidate))

    for (const orbit of orbitsByHost.get(objectId) ?? []) {
      collectOrbitBranch(orbit, true)
    }
  }

  function collectOrbitBranch(orbit: Orbit, includeOrbit: boolean): void {
    if (removedOrbitIds.has(orbit.id)) return
    removedOrbitIds.add(orbit.id)
    if (includeOrbit) addEffect(orbitLabel(requireSystem(), orbit))
    for (const child of objectsByOrbit.get(orbit.id) ?? []) {
      collectObjectBranch(child.id, true)
    }
  }

  let entityLabel: string
  if (target.kind === 'system') {
    if (workspace.cluster.systems.length === 1) {
      throw new Error('At least one star system must remain in the Jump Cluster.')
    }
    const selectedSystem = requireSystem()
    entityLabel = `${selectedSystem.name} star system`
    removedSystemIds.add(selectedSystem.id)
    for (const object of selectedSystem.objects) {
      removedObjectIds.add(object.id)
      addEffect(mapObjectLabel(object))
    }
    for (const orbit of selectedSystem.orbits) {
      removedOrbitIds.add(orbit.id)
      addEffect(orbitLabel(selectedSystem, orbit))
    }
  } else if (target.kind === 'route') {
    const route = workspace.cluster.routes.find(candidate => candidate.id === target.routeId)
    if (!route) throw new Error('The selected Jump Route no longer exists.')
    entityLabel = `Jump Route (Level ${route.jumpLevel})`
    removedRouteIds.add(route.id)
  } else if (target.kind === 'object') {
    const selectedSystem = requireSystem()
    const object = selectedSystem.objects.find(candidate => candidate.id === target.objectId)
    if (!object) throw new Error('The selected map object no longer exists.')
    entityLabel = mapObjectLabel(object)
    collectObjectBranch(object.id, false)
  } else {
    const selectedSystem = requireSystem()
    const orbit = selectedSystem.orbits.find(candidate => candidate.id === target.orbitId)
    if (!orbit) throw new Error('The selected Orbit no longer exists.')
    entityLabel = orbitLabel(selectedSystem, orbit)
    collectOrbitBranch(orbit, false)
  }

  if (target.kind !== 'route') {
    const selectedSystem = requireSystem()
    const removedStations = new Set(selectedSystem.objects
      .filter(object => removedObjectIds.has(object.id)
        && object.family === 'Installation'
        && object.subtype === 'station')
      .map(object => object.id))
    for (const object of selectedSystem.objects) {
      if (
        !removedObjectIds.has(object.id)
        && object.jumpStationId
        && removedStations.has(object.jumpStationId)
      ) {
        const station = selectedSystem.objects.find(candidate => candidate.id === object.jumpStationId)
        addEffect(`Clear physical Station link from ${mapObjectLabel(object)}${station ? ` to ${mapObjectLabel(station)}` : ''}`)
      }
    }
  }

  for (const route of workspace.cluster.routes) {
    if (removedRouteIds.has(route.id)) continue
    if (removedObjectIds.has(route.fromPointId) || (route.toPointId && removedObjectIds.has(route.toPointId))) {
      removedRouteIds.add(route.id)
      addEffect(`Jump Route (Level ${route.jumpLevel})`)
    }
  }

  const systems = workspace.cluster.systems
    .filter(candidate => !removedSystemIds.has(candidate.id))
    .map(candidate => {
      if (candidate.id !== system?.id) return candidate
      const objects = candidate.objects
        .filter(object => !removedObjectIds.has(object.id))
        .map(object => object.jumpStationId && removedObjectIds.has(object.jumpStationId)
          ? { ...object, jumpStationId: null }
          : object)
      const orbits = normalizeOrbitOrders(candidate.orbits
        .filter(orbit => !removedOrbitIds.has(orbit.id)))
      return { ...candidate, objects, orbits }
    })

  return {
    entityLabel,
    affectedEntities,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems,
        routes: workspace.cluster.routes.filter(route => !removedRouteIds.has(route.id)),
      },
      layout: {
        ...workspace.layout,
        systemPositions: Object.fromEntries(Object.entries(workspace.layout.systemPositions)
          .filter(([systemId]) => !removedSystemIds.has(systemId))),
        orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
          .filter(([orbitId]) => !removedOrbitIds.has(orbitId))),
        orbitRotations: Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
          .filter(([orbitId]) => !removedOrbitIds.has(orbitId))),
        objectAngles: Object.fromEntries(Object.entries(workspace.layout.objectAngles)
          .filter(([objectId]) => !removedObjectIds.has(objectId))),
      },
    },
  }
}

export function jumpPointsInCluster(cluster: JumpCluster): JumpPointReference[] {
  return cluster.systems.flatMap(system =>
    system.objects
      .filter(object => object.family === 'JumpPoint')
      .map(point => ({ point, system })),
  )
}

export function createJumpRoute(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit = 'Uncharted exit',
): JumpRoute {
  return {
    id: crypto.randomUUID(),
    ...jumpRouteDetails(cluster, jumpLevel, fromPointId, toPointId, unresolvedExit),
  }
}

export function updateJumpRoute(
  cluster: JumpCluster,
  routeId: string,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit = 'Uncharted exit',
): JumpRoute {
  const route = cluster.routes.find(candidate => candidate.id === routeId)
  if (!route) {
    throw new Error('The selected Jump Route no longer exists.')
  }

  const details = jumpRouteDetails(cluster, jumpLevel, fromPointId, toPointId, unresolvedExit)
  return {
    id: route.id,
    ...(route.name !== undefined ? { name: route.name } : {}),
    ...details,
  }
}

function jumpRouteDetails(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit: string,
): JumpRouteDetails {
  if (!isJumpLevel(jumpLevel)) {
    throw new Error('Jump level must be a positive integer.')
  }

  const jumpPoints = jumpPointsInCluster(cluster)
  if (!jumpPoints.some(({ point }) => point.id === fromPointId)) {
    throw new Error('Choose an existing Jump Point as the route origin.')
  }
  if (toPointId !== null && (
    toPointId === fromPointId
    || !jumpPoints.some(({ point }) => point.id === toPointId)
  )) {
    throw new Error('Choose a different existing Jump Point as the route destination.')
  }

  if (toPointId === null) {
    return {
      jumpLevel,
      fromPointId,
      toPointId,
      unresolvedExit: validText(unresolvedExit, 'Unresolved exit', maxNameLength),
    }
  }
  return { jumpLevel, fromPointId, toPointId }
}

export function renameLocalWorkspace(
  workspace: LocalWorkspace,
  clusterName: string,
  systemName: string,
  systemId = workspace.cluster.systems[0]?.id,
): LocalWorkspace {
  if (!systemId || !workspace.cluster.systems.some(system => system.id === systemId)) {
    throw new Error('The local workspace has no matching star system.')
  }

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      name: validName(clusterName, 'Jump Cluster name'),
      systems: workspace.cluster.systems.map(system =>
        system.id === systemId
          ? { ...system, name: validName(systemName, 'Star system name') }
          : system,
      ),
    },
  }
}

export function createSystemObject(
  system: StarSystem,
  subtype: CatalogueSubtype,
  orbitId?: string,
): SystemObject {
  const catalogueType = catalogueTypes.find(type => type.value === subtype)
  if (!catalogueType) {
    throw new Error(`Unsupported catalogue type "${subtype}".`)
  }

  const count = system.objects.filter(object => object.subtype === subtype).length + 1
  const objectId = crypto.randomUUID()
  const placement: ObjectPlacement = orbitId === undefined
    ? initialSystemPlacement(system)
    : { kind: 'orbit', orbitId }

  if (placement.kind === 'orbit' && !canPlaceObjectInOrbit(system, objectId, placement.orbitId)) {
    throw new Error('Choose a valid Orbit for this object.')
  }

  return {
    id: objectId,
    family: catalogueType.family,
    subtype,
    locationKey: nextLocationKey(system, catalogueType.keyPrefix),
    name: `New ${catalogueType.label.toLowerCase()} ${count}`,
    description: '',
    placement,
  }
}

export function createOrbit(system: StarSystem, hostId: string | null): Orbit {
  if (hostId !== null && !system.objects.some(object => object.id === hostId)) {
    throw new Error('Choose an existing map object to host an Orbit.')
  }

  const order = system.orbits
    .filter(orbit => orbit.hostId === hostId)
    .reduce((highest, orbit) => Math.max(highest, orbit.order), 0) + 1
  if (hostId !== null) return { id: crypto.randomUUID(), hostId, order }

  let centerIndex = 0
  let center: Point
  do {
    center = {
      x: 0.18 + (centerIndex % 3) * 0.32,
      y: 0.22 + Math.floor(centerIndex / 3) * 0.3,
    }
    centerIndex += 1
  } while (system.orbits.some(orbit =>
    orbit.hostId === null
      && orbit.center.x === center.x
      && orbit.center.y === center.y,
  ))

  return {
    id: crypto.randomUUID(),
    hostId: null,
    center,
    order,
  }
}

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject | null {
  if (orbit.hostId === null) return null
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

export function defaultOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return host === null || host.subtype === 'star'
    ? 112 + (orbit.order - 1) * 58
    : 46 + (orbit.order - 1) * 28
}

export function minimumOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return Math.ceil((host === null ? 0 : host.subtype === 'star' ? 23 : 14) + 16)
}

export function canPlaceObjectInOrbit(system: StarSystem, objectId: string, orbitId: string): boolean {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    return false
  }
  if (orbit.hostId === null) return true

  const visited = new Set<string>()
  let host = system.objects.find(object => object.id === orbit.hostId)
  while (host && !visited.has(host.id)) {
    if (host.id === objectId) {
      return false
    }
    visited.add(host.id)
    if (host.placement.kind === 'system') {
      return true
    }

    const placement = host.placement
    const parentOrbit = system.orbits.find(candidate => candidate.id === placement.orbitId)
    if (!parentOrbit) return false
    if (parentOrbit.hostId === null) return true
    host = system.objects.find(object => object.id === parentOrbit?.hostId)
  }
  return false
}

function objectFieldValidationError(object: SystemObject, settings: ObjectFieldSettings): string | null {
  if (object.atmosphere !== undefined) {
    if (
      object.family !== 'CelestialBody'
      || (object.subtype !== 'planet' && object.subtype !== 'moon')
    ) {
      return 'Atmosphere is only available for planets and moons.'
    }
    if (!settings.atmosphereOptions.includes(object.atmosphere)) {
      return 'Choose an available Atmosphere option.'
    }
  }

  if (object.portClass !== undefined) {
    if (object.family !== 'Installation') {
      return 'Port class is only available for Installation objects.'
    }
    if (!settings.portClassOptions.includes(object.portClass)) {
      return 'Choose an available Port class option.'
    }
  }

  for (const [fieldId, value] of Object.entries(object.customFieldValues ?? {})) {
    const definition = settings.customFields.find(field => field.id === fieldId)
    if (!definition) {
      return 'A custom field value refers to a field that no longer exists.'
    }
    if (
      (definition.type === 'text' && typeof value !== 'string')
      || (definition.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      || (definition.type === 'boolean' && typeof value !== 'boolean')
      || (definition.type === 'single-select'
        && (typeof value !== 'string' || !definition.options.includes(value)))
    ) {
      return `"${definition.name}" has an invalid value.`
    }
  }

  return null
}

export function updateSystemObject(
  system: StarSystem,
  objectId: string,
  changes: SystemObjectChanges,
  objectFieldSettings: ObjectFieldSettings,
): StarSystem {
  const object = system.objects.find(candidate => candidate.id === objectId)
  if (!object) {
    throw new Error('The selected map object no longer exists.')
  }

  const updated: SystemObject = {
    ...object,
    ...changes,
    locationKey: validText(changes.locationKey ?? object.locationKey, 'Location key'),
    name: validName(changes.name ?? object.name, 'Object name'),
    description: changes.description ?? object.description,
    subtype: validText(changes.subtype ?? object.subtype, 'Object type'),
  }
  if (typeof updated.description !== 'string') {
    throw new Error('Object description must be text.')
  }

  const matchesFamily = updated.family === 'Other'
    || catalogueTypes.some(type => type.value === updated.subtype && type.family === updated.family)
  if (!matchesFamily) {
    throw new Error('Choose a valid subtype for this object family.')
  }

  if (updated.family !== 'JumpPoint' && updated.jumpStationId !== undefined) {
    throw new Error('Only a Jump Point can reference a physical Jump Station.')
  }
  const fieldError = objectFieldValidationError(updated, objectFieldSettings)
  if (fieldError) {
    throw new Error(fieldError)
  }
  if (updated.jumpStationId !== undefined && updated.jumpStationId !== null) {
    const station = system.objects.find(candidate => candidate.id === updated.jumpStationId)
    if (
      updated.family !== 'JumpPoint'
      || !station
      || station.family !== 'Installation'
      || station.subtype !== 'station'
    ) {
      throw new Error('Choose an existing Station installation for this Jump Point.')
    }
  }
  if (
    object.subtype === 'station'
    && updated.subtype !== 'station'
    && system.objects.some(candidate => candidate.jumpStationId === objectId)
  ) {
    throw new Error('A Station linked to a Jump Point cannot change type.')
  }

  if (system.objects.some(candidate => candidate.id !== objectId && candidate.locationKey === updated.locationKey)) {
    throw new Error(`Location key "${updated.locationKey}" is already used in this star system.`)
  }

  if (updated.placement.kind === 'system') {
    if (!Number.isFinite(updated.placement.x) || !Number.isFinite(updated.placement.y)) {
      throw new Error('Schematic X and Y must be finite numbers.')
    }
  } else if (!canPlaceObjectInOrbit(system, objectId, updated.placement.orbitId)) {
    throw new Error('That placement would create a circular Orbit relationship.')
  }

  return {
    ...system,
    objects: system.objects.map(candidate => candidate.id === objectId ? updated : candidate),
  }
}

export function moveOrbit(system: StarSystem, orbitId: string, direction: -1 | 1): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }

  const siblings = system.orbits
    .filter(candidate => candidate.hostId === orbit.hostId)
    .sort((left, right) => left.order - right.order)
  const index = siblings.findIndex(candidate => candidate.id === orbitId)
  const adjacent = siblings[index + direction]
  if (!adjacent) {
    return system
  }

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbit.id) return { ...candidate, order: adjacent.order }
      if (candidate.id === adjacent.id) return { ...candidate, order: orbit.order }
      return candidate
    }),
  }
}

export function moveOrbitCenter(
  system: StarSystem,
  orbitId: string,
  center: Point,
  hostId: string | null,
): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }
  if (orbit.hostId !== null) {
    throw new Error('Only an Orbit with an unoccupied center can be moved.')
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new Error('Orbit center coordinates must be finite numbers.')
  }
  if (hostId !== null && !system.objects.some(object => object.id === hostId)) {
    throw new Error('Choose an existing map object to host an Orbit.')
  }

  const order = hostId === null
    ? orbit.order
    : system.orbits
      .filter(candidate => candidate.hostId === hostId)
      .reduce((highest, candidate) => Math.max(highest, candidate.order), 0) + 1

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbitId) {
        return hostId === null
          ? { id: orbit.id, hostId: null, center, order }
          : { id: orbit.id, hostId, order }
      }
      if (hostId !== null && candidate.hostId === null && candidate.order > orbit.order) {
        return { ...candidate, order: candidate.order - 1 }
      }
      return candidate
    }),
  }
}

export function detachOrbit(system: StarSystem, orbitId: string, center: Point): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }
  if (orbit.hostId === null) {
    throw new Error('The selected Orbit already has an unoccupied center.')
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new Error('Orbit center coordinates must be finite numbers.')
  }

  const hostId = orbit.hostId
  const nextUnhostedOrder = system.orbits
    .filter(candidate => candidate.hostId === null)
    .reduce((highest, candidate) => Math.max(highest, candidate.order), 0) + 1

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbit.id) {
        return { id: orbit.id, hostId: null, center, order: nextUnhostedOrder }
      }
      if (candidate.hostId === hostId && candidate.order > orbit.order) {
        return { ...candidate, order: candidate.order - 1 }
      }
      return candidate
    }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard)
}

function isCustomFieldValue(value: unknown): value is CustomFieldValue {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}

function isFieldOption(value: unknown): value is string {
  return typeof value === 'string'
    && !!value.trim()
    && value === value.trim()
    && value.length <= maxNameLength
}

function isFieldOptionList(value: unknown): value is string[] {
  return isArrayOf(value, isFieldOption)
    && new Set(value.map(option => option.toLowerCase())).size === value.length
}

function isCustomFieldDefinition(value: unknown): value is CustomFieldDefinition {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !value.id
    || typeof value.name !== 'string'
    || !value.name.trim()
    || value.name !== value.name.trim()
    || value.name.length > maxNameLength
  ) {
    return false
  }

  if (value.type === 'single-select') {
    return isFieldOptionList(value.options)
  }
  return (
    (value.type === 'text' || value.type === 'number' || value.type === 'boolean')
    && value.options === undefined
  )
}

function isObjectFieldSettings(value: unknown): value is ObjectFieldSettings {
  if (
    !isRecord(value)
    || !isFieldOptionList(value.atmosphereOptions)
    || !isFieldOptionList(value.portClassOptions)
    || !isArrayOf(value.customFields, isCustomFieldDefinition)
  ) {
    return false
  }

  const ids = new Set(value.customFields.map(field => field.id))
  const names = new Set(value.customFields.map(field => field.name.toLowerCase()))
  return ids.size === value.customFields.length && names.size === value.customFields.length
}

function isPoint(value: unknown): value is Point {
  return isRecord(value)
    && typeof value.x === 'number'
    && Number.isFinite(value.x)
    && typeof value.y === 'number'
    && Number.isFinite(value.y)
}

function isObjectFamily(value: unknown): value is ObjectFamily {
  return value === 'CelestialBody'
    || value === 'SmallBody/Field'
    || value === 'Installation'
    || value === 'Vessel'
    || value === 'JumpPoint'
    || value === 'Phenomenon'
    || value === 'Other'
}

function isSystemObject(value: unknown): value is SystemObject {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !value.id
    || !isObjectFamily(value.family)
    || typeof value.subtype !== 'string'
    || !value.subtype.trim()
    || typeof value.locationKey !== 'string'
    || !value.locationKey.trim()
    || value.locationKey !== value.locationKey.trim()
    || typeof value.name !== 'string'
    || !value.name.trim()
    || value.name !== value.name.trim()
    || value.name.length > maxNameLength
    || typeof value.description !== 'string'
    || !isRecord(value.placement)
  ) {
    return false
  }

  if (
    value.family !== 'JumpPoint'
    && value.jumpStationId !== undefined
  ) {
    return false
  }
  if (
    (value.atmosphere !== undefined
      && (typeof value.atmosphere !== 'string' || !value.atmosphere.trim()))
    || (value.portClass !== undefined
      && (typeof value.portClass !== 'string' || !value.portClass.trim()))
    || (value.customFieldValues !== undefined
      && (!isRecord(value.customFieldValues)
        || !Object.values(value.customFieldValues).every(isCustomFieldValue)))
  ) {
    return false
  }
  if (
    value.jumpStationId !== undefined
    && value.jumpStationId !== null
    && (typeof value.jumpStationId !== 'string' || !value.jumpStationId)
  ) {
    return false
  }

  if (
    value.family !== 'Other'
    && !catalogueTypes.some(type => type.value === value.subtype && type.family === value.family)
  ) {
    return false
  }

  return value.placement.kind === 'system'
    ? isPoint(value.placement)
    : value.placement.kind === 'orbit'
      && typeof value.placement.orbitId === 'string'
      && value.placement.orbitId.length > 0
}

function isOrbit(value: unknown): value is Orbit {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.order !== 'number'
    || !Number.isSafeInteger(value.order)
    || value.order <= 0
  ) {
    return false
  }

  return value.hostId === null
    ? isPoint(value.center)
    : typeof value.hostId === 'string'
      && value.hostId.length > 0
      && value.center === undefined
}

function isOrbitRadii(value: unknown): value is OrbitRadii {
  return isRecord(value)
    && typeof value.horizontal === 'number'
    && Number.isFinite(value.horizontal)
    && typeof value.vertical === 'number'
    && Number.isFinite(value.vertical)
}

function normalizeOrbitRadii(
  orbitRadii: unknown,
  legacyEllipseRadii: unknown = {},
): Record<string, OrbitRadii> | null {
  if (!isRecord(orbitRadii) || !isRecord(legacyEllipseRadii)) return null

  const normalized = new Map<string, OrbitRadii>()
  for (const [orbitId, radii] of Object.entries(orbitRadii)) {
    if (typeof radii === 'number' && Number.isFinite(radii)) {
      normalized.set(orbitId, { horizontal: radii, vertical: radii })
    } else if (isOrbitRadii(radii)) {
      normalized.set(orbitId, radii)
    } else {
      return null
    }
  }
  for (const [orbitId, radii] of Object.entries(legacyEllipseRadii)) {
    if (normalized.has(orbitId) || !isOrbitRadii(radii)) {
      return null
    }
    normalized.set(orbitId, radii)
  }
  return Object.fromEntries(normalized)
}

function orbitRadiiMeetMinimum(radii: OrbitRadii, minimum: number): boolean {
  return radii.horizontal >= minimum && radii.vertical >= minimum
}

export function normalizeOrbitRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new Error('Orbit rotation must be finite.')
  }
  const normalized = ((degrees % 360) + 360) % 360
  return normalized === 0 ? 0 : normalized
}

function normalizeOrbitRotations(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const rotations = new Map<string, number>()
  for (const [orbitId, rotation] of Object.entries(value)) {
    if (typeof rotation !== 'number' || !Number.isFinite(rotation)) return null
    rotations.set(orbitId, normalizeOrbitRotation(rotation))
  }
  return Object.fromEntries(rotations)
}

function isJumpRoute(value: unknown): value is JumpRoute {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !value.id
    || (value.name !== undefined && (
      typeof value.name !== 'string'
      || !value.name.trim()
      || value.name !== value.name.trim()
      || value.name.length > maxNameLength
    ))
    || !isJumpLevel(value.jumpLevel)
    || typeof value.fromPointId !== 'string'
    || !value.fromPointId
  ) {
    return false
  }

  if (typeof value.toPointId === 'string') {
    return value.toPointId.length > 0
      && value.toPointId !== value.fromPointId
      && value.unresolvedExit === undefined
  }

  return value.toPointId === null
    && typeof value.unresolvedExit === 'string'
    && !!value.unresolvedExit.trim()
    && value.unresolvedExit === value.unresolvedExit.trim()
    && value.unresolvedExit.length <= maxNameLength
}

function isJumpLevel(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
}

function isSystemStructureValid(system: StarSystem): boolean {
  const objectIds = new Set(system.objects.map(object => object.id))
  if (objectIds.size !== system.objects.length) {
    return false
  }

  const ids = new Set(objectIds)
  const locationKeys = new Set(system.objects.map(object => object.locationKey))
  if (locationKeys.size !== system.objects.length) {
    return false
  }

  const ordersByHost = new Map<string | null, number[]>()
  for (const orbit of system.orbits) {
    if (
      (orbit.hostId !== null && !objectIds.has(orbit.hostId))
      || ids.has(orbit.id)
    ) {
      return false
    }
    ids.add(orbit.id)
    const orders = ordersByHost.get(orbit.hostId) ?? []
    orders.push(orbit.order)
    ordersByHost.set(orbit.hostId, orders)
    if (orbit.hostId === null && !isPoint(orbit.center)) {
      return false
    }
  }

  for (const orders of ordersByHost.values()) {
    if (orders.sort((left, right) => left - right).some((order, index) => order !== index + 1)) {
      return false
    }
  }

  return system.objects.every(object => {
    if (object.jumpStationId !== undefined && object.jumpStationId !== null) {
      const station = system.objects.find(candidate => candidate.id === object.jumpStationId)
      if (
        object.family !== 'JumpPoint'
        || !station
        || station.family !== 'Installation'
        || station.subtype !== 'station'
      ) {
        return false
      }
    }

    const placement = object.placement
    return placement.kind === 'system'
      || (system.orbits.some(orbit => orbit.id === placement.orbitId)
        && canPlaceObjectInOrbit(system, object.id, placement.orbitId))
  })
}

function isStarSystem(value: unknown): value is StarSystem {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
    return false
  }

  const name = value.name
  const objects = value.objects
  const orbits = value.orbits
  if (
    typeof name !== 'string'
    || !name.trim()
    || name !== name.trim()
    || name.length > maxNameLength
    || !isArrayOf(objects, isSystemObject)
    || !isArrayOf(orbits, isOrbit)
  ) {
    return false
  }

  return isSystemStructureValid({ id: value.id, name, objects, orbits })
}

type StoredWorkspaceLayout = Pick<LocalWorkspace['layout'], 'systemPositions'>
  & {
    orbitRadii?: Record<string, unknown>
    orbitEllipseRadii?: Record<string, unknown>
    orbitRotations?: Record<string, number>
    objectAngles?: Record<string, number>
  }

type StoredLocalWorkspace = Omit<LocalWorkspace, 'objectFieldSettings' | 'layout'> & {
  objectFieldSettings?: ObjectFieldSettings
  layout: StoredWorkspaceLayout
}

function isStoredLocalWorkspace(value: unknown): value is StoredLocalWorkspace {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !isRecord(value.cluster)) {
    return false
  }

  const cluster = value.cluster
  const systems = cluster.systems
  const layout = value.layout
  if (
    typeof cluster.id !== 'string'
    || !cluster.id
    || typeof cluster.name !== 'string'
    || !cluster.name.trim()
    || cluster.name !== cluster.name.trim()
    || cluster.name.length > maxNameLength
    || !isArrayOf(systems, isStarSystem)
    || systems.length === 0
    || !isArrayOf(cluster.routes, isJumpRoute)
    || !isRecord(layout)
    || !isRecord(layout.systemPositions)
    || (layout.orbitRadii !== undefined && !isRecord(layout.orbitRadii))
    || (layout.orbitEllipseRadii !== undefined && !isRecord(layout.orbitEllipseRadii))
    || (layout.orbitRotations !== undefined && !isRecord(layout.orbitRotations))
    || (layout.objectAngles !== undefined && !isRecord(layout.objectAngles))
  ) {
    return false
  }

  const objectFieldSettings = value.objectFieldSettings === undefined
    ? defaultObjectFieldSettings()
    : value.objectFieldSettings
  if (!isObjectFieldSettings(objectFieldSettings)) {
    return false
  }

  const entityIds = new Set<string>([value.id, cluster.id])
  const systemIds = new Set<string>()
  const jumpPointIds = new Set<string>()
  for (const system of systems) {
    if (entityIds.has(system.id) || systemIds.has(system.id)) {
      return false
    }
    entityIds.add(system.id)
    systemIds.add(system.id)

    for (const object of system.objects) {
      if (entityIds.has(object.id)) {
        return false
      }
      entityIds.add(object.id)
      if (object.family === 'JumpPoint') jumpPointIds.add(object.id)
    }
    for (const orbit of system.orbits) {
      if (entityIds.has(orbit.id)) {
        return false
      }
      entityIds.add(orbit.id)
    }
  }

  for (const field of objectFieldSettings.customFields) {
    if (entityIds.has(field.id)) {
      return false
    }
    entityIds.add(field.id)
  }

  const routeIds = new Set<string>()
  for (const route of cluster.routes) {
    if (
      entityIds.has(route.id)
      || routeIds.has(route.id)
      || !jumpPointIds.has(route.fromPointId)
      || (route.toPointId !== null && !jumpPointIds.has(route.toPointId))
    ) {
      return false
    }
    entityIds.add(route.id)
    routeIds.add(route.id)
  }

  const positions = layout.systemPositions
  const orbitRadii = normalizeOrbitRadii(
    layout.orbitRadii ?? {},
    layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return false
  const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
  if (!orbitRotations) return false
  const objectAngles = layout.objectAngles ?? {}
  const orbits = systems.flatMap(system =>
    system.orbits.map(orbit => ({ orbit, system })),
  )
  const orbitIds = new Set(orbits.map(({ orbit }) => orbit.id))
  const orbitObjects = new Set(systems.flatMap(system =>
    system.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))
  return Object.values(positions).every(isPoint)
    && Object.entries(orbitRadii).every(([orbitId, radii]) => {
      const entry = orbits.find(candidate => candidate.orbit.id === orbitId)
      return entry !== undefined
        && orbitRadiiMeetMinimum(radii, minimumOrbitRadius(entry.system, entry.orbit))
    })
    && Object.keys(orbitRotations).every(orbitId => orbitIds.has(orbitId))
    && Object.values(objectAngles).every(value => typeof value === 'number' && Number.isFinite(value))
    && Object.keys(objectAngles).every(objectId => orbitObjects.has(objectId))
    && systems.every(system =>
      isPoint(positions[system.id])
      && system.objects.every(object => objectFieldValidationError(object, objectFieldSettings) === null),
    )
}

export function isLocalWorkspace(value: unknown): value is LocalWorkspace {
  return isStoredLocalWorkspace(value) && value.objectFieldSettings !== undefined
}

function withDefaultJumpLevels(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.cluster) || !Array.isArray(value.cluster.routes)) {
    return value
  }

  return {
    ...value,
    cluster: {
      ...value.cluster,
      routes: value.cluster.routes.map(route =>
        isRecord(route) && route.jumpLevel === undefined ? { ...route, jumpLevel: 1 } : route,
      ),
    },
  }
}

export function restoreLocalWorkspace(value: unknown): LocalWorkspace | null {
  const restored = withDefaultJumpLevels(value)
  if (!isStoredLocalWorkspace(restored)) {
    return null
  }

  const orbitRadii = normalizeOrbitRadii(
    restored.layout.orbitRadii ?? {},
    restored.layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return null
  const orbitRotations = normalizeOrbitRotations(restored.layout.orbitRotations ?? {})
  if (!orbitRotations) return null

  return {
    ...restored,
    layout: {
      systemPositions: restored.layout.systemPositions,
      orbitRadii,
      orbitRotations,
      objectAngles: restored.layout.objectAngles ?? {},
    },
    objectFieldSettings: restored.objectFieldSettings ?? defaultObjectFieldSettings(),
  }
}

export function exportJumpCluster(workspace: LocalWorkspace): JumpClusterExport {
  return {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    cluster: workspace.cluster,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      ...workspace.layout,
    },
  }
}

export function exportStarSystem(workspace: LocalWorkspace, systemId: string): StarSystemExport {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) {
    throw new Error('The selected star system no longer exists.')
  }

  const orbitIds = new Set(system.orbits.map(orbit => orbit.id))
  const orbitalObjectIds = new Set(system.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id))
  return {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'system',
    system,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      orbitRotations: Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      objectAngles: Object.fromEntries(Object.entries(workspace.layout.objectAngles)
        .filter(([objectId]) => orbitalObjectIds.has(objectId))),
    },
  }
}

function isImportedMap(value: unknown): value is JumpClusterExport | StarSystemExport {
  if (!isRecord(value)) return false
  const settings = value.objectFieldSettings
  const layout = value.layout
  if (
    value.format !== 'mothership-campaign-map'
    || value.version !== 1
    || !isObjectFieldSettings(settings)
    || !isRecord(layout)
    || layout.version !== 1
  ) {
    return false
  }

  if (value.type === 'cluster') {
    const cluster = value.cluster
    if (!isRecord(cluster)) return false
    const orbitRadii = normalizeOrbitRadii(
      layout.orbitRadii ?? {},
      layout.orbitEllipseRadii ?? {},
    )
    if (!orbitRadii) return false
    const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
    if (!orbitRotations) return false
    const validationIds = new Set<string>([cluster.id as string])
    for (const system of Array.isArray(cluster.systems) ? cluster.systems : []) {
      if (isRecord(system) && typeof system.id === 'string') validationIds.add(system.id)
      if (isRecord(system) && Array.isArray(system.objects)) {
        for (const object of system.objects) {
          if (isRecord(object) && typeof object.id === 'string') validationIds.add(object.id)
        }
      }
      if (isRecord(system) && Array.isArray(system.orbits)) {
        for (const orbit of system.orbits) {
          if (isRecord(orbit) && typeof orbit.id === 'string') validationIds.add(orbit.id)
        }
      }
    }
    for (const route of Array.isArray(cluster.routes) ? cluster.routes : []) {
      if (isRecord(route) && typeof route.id === 'string') validationIds.add(route.id)
    }
    for (const field of settings.customFields) validationIds.add(field.id)
    let validationId = crypto.randomUUID()
    while (validationIds.has(validationId)) validationId = crypto.randomUUID()

    const candidate = {
      id: validationId,
      cluster,
      objectFieldSettings: settings,
      layout: {
        systemPositions: layout.systemPositions,
        orbitRadii,
        orbitRotations,
        objectAngles: layout.objectAngles,
      },
    }
    if (!isLocalWorkspace(candidate)) return false

    const systemIds = new Set(candidate.cluster.systems.map(system => system.id))
    return Object.keys(candidate.layout.systemPositions).every(systemId => systemIds.has(systemId))
  }

  const system = value.system
  if (value.type !== 'system' || !isStarSystem(system)) return false
  if (!isRecord(layout.orbitRadii) || !isRecord(layout.objectAngles)) return false

  const orbitIds = new Set(system.orbits.map(orbit => orbit.id))
  const orbitRadii = normalizeOrbitRadii(layout.orbitRadii, layout.orbitEllipseRadii ?? {})
  if (!orbitRadii) return false
  const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
  if (!orbitRotations) return false
  const orbitalObjectIds = new Set(system.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id))
  return Object.entries(orbitRadii).every(([orbitId, radii]) => {
    const orbit = system.orbits.find(candidate => candidate.id === orbitId)
    return orbitIds.has(orbitId)
      && orbit !== undefined
      && orbitRadiiMeetMinimum(radii, minimumOrbitRadius(system, orbit))
  })
    && Object.keys(orbitRotations).every(orbitId => orbitIds.has(orbitId))
    && Object.values(layout.objectAngles).every(angle => typeof angle === 'number' && Number.isFinite(angle))
    && Object.keys(layout.objectAngles).every(objectId => orbitalObjectIds.has(objectId))
    && system.objects.every(object =>
      objectFieldValidationError(object, settings) === null,
    )
}

function workspaceEntityNames(workspace: LocalWorkspace): Map<string, string> {
  const entities = new Map<string, string>([
    [workspace.id, 'Local workspace'],
    [workspace.cluster.id, `Jump Cluster "${workspace.cluster.name}"`],
  ])
  for (const system of workspace.cluster.systems) {
    entities.set(system.id, `Star system "${system.name}"`)
    for (const object of system.objects) {
      entities.set(object.id, `${object.subtype} "${object.name}" in "${system.name}"`)
    }
    for (const orbit of system.orbits) {
      entities.set(orbit.id, `Orbit ${orbit.order} in "${system.name}"`)
    }
  }
  for (const route of workspace.cluster.routes) {
    entities.set(route.id, `Jump Route (Level ${route.jumpLevel})`)
  }
  for (const field of workspace.objectFieldSettings.customFields) {
    entities.set(field.id, `Custom field "${field.name}"`)
  }
  return entities
}

function sameFieldDefinition(
  left: CustomFieldDefinition,
  right: CustomFieldDefinition,
): boolean {
  return left.type === right.type
    && (left.type !== 'single-select'
      || (right.type === 'single-select'
        && left.options.length === right.options.length
        && left.options.every((option, index) => option === right.options[index])))
}

function remapImportedSystem(
  system: StarSystem,
  ids: Map<string, string>,
  fieldIds: Map<string, string>,
): StarSystem {
  return {
    ...system,
    id: ids.get(system.id)!,
    objects: system.objects.map(object => ({
      ...object,
      id: ids.get(object.id)!,
      placement: object.placement.kind === 'orbit'
        ? { kind: 'orbit', orbitId: ids.get(object.placement.orbitId)! }
        : object.placement,
      ...(object.jumpStationId
        ? { jumpStationId: ids.get(object.jumpStationId)! }
        : {}),
      ...(object.customFieldValues
        ? {
            customFieldValues: Object.fromEntries(
              Object.entries(object.customFieldValues)
                .map(([fieldId, value]) => [fieldIds.get(fieldId)!, value]),
            ),
          }
        : {}),
    })),
    orbits: system.orbits.map((orbit): Orbit => orbit.hostId === null
      ? { ...orbit, id: ids.get(orbit.id)! }
      : { ...orbit, id: ids.get(orbit.id)!, hostId: ids.get(orbit.hostId)! }),
  }
}

export function prepareJsonImport(workspace: LocalWorkspace, value: unknown): PreparedJsonImport {
  const map = withDefaultJumpLevels(value)
  if (!isImportedMap(map)) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }

  const sourceSystems = map.type === 'cluster' ? map.cluster.systems : [map.system]
  const sourceRoutes = map.type === 'cluster' ? map.cluster.routes : []
  const sourceSettings = map.objectFieldSettings
  const existingNames = workspaceEntityNames(workspace)
  const sourceEntities = [
    ...sourceSystems.flatMap(system => [
      { id: system.id, entity: 'Star system', name: system.name },
      ...system.objects.map(object => ({ id: object.id, entity: object.subtype, name: object.name })),
      ...system.orbits.map(orbit => ({ id: orbit.id, entity: 'Orbit', name: `Orbit ${orbit.order}` })),
    ]),
    ...sourceRoutes.map(route => ({ id: route.id, entity: 'Jump Route', name: `Jump Level ${route.jumpLevel}` })),
    ...sourceSettings.customFields.map(field => ({ id: field.id, entity: 'Custom field', name: field.name })),
  ]
  const idCollisions = sourceEntities.flatMap(entity => {
    const existingEntity = existingNames.get(entity.id)
    return existingEntity
      ? [{ entity: entity.entity, name: `${entity.name} (matches ${existingEntity})`, id: entity.id }]
      : []
  })
  const possibleMatches: JsonImportSummary['possibleMatches'] = []
  for (const sourceSystem of sourceSystems) {
    const existingSystems = workspace.cluster.systems.filter(system =>
      system.name.toLowerCase() === sourceSystem.name.toLowerCase(),
    )
    for (const existingSystem of existingSystems) {
      possibleMatches.push({
        entity: 'Star system',
        name: sourceSystem.name,
        existingSystem: existingSystem.name,
        reason: 'same name',
      })
      for (const sourceObject of sourceSystem.objects) {
        const matchingObjects = existingSystem.objects.filter(object =>
          object.name.toLowerCase() === sourceObject.name.toLowerCase()
          || object.locationKey.toLowerCase() === sourceObject.locationKey.toLowerCase(),
        )
        for (const existingObject of matchingObjects) {
          const sameName = existingObject.name.toLowerCase() === sourceObject.name.toLowerCase()
          const sameKey = existingObject.locationKey.toLowerCase() === sourceObject.locationKey.toLowerCase()
          possibleMatches.push({
            entity: `${sourceObject.subtype} "${sourceObject.name}"`,
            name: existingObject.name,
            existingSystem: existingSystem.name,
            reason: sameName && sameKey
              ? `same name and location key (${existingObject.locationKey})`
              : sameName
                ? 'same name'
                : `same location key (${existingObject.locationKey})`,
          })
        }
      }
    }
  }

  const summary: JsonImportSummary = {
    type: map.type,
    systems: sourceSystems.length,
    objects: sourceSystems.reduce((count, system) => count + system.objects.length, 0),
    orbits: sourceSystems.reduce((count, system) => count + system.orbits.length, 0),
    routes: sourceRoutes.length,
    customFields: sourceSettings.customFields.length,
    idCollisions,
    possibleMatches,
  }

  const usedIds = new Set(existingNames.keys())
  const allocateId = (): string => {
    let id = crypto.randomUUID()
    while (usedIds.has(id)) id = crypto.randomUUID()
    usedIds.add(id)
    return id
  }
  const ids = new Map<string, string>()
  for (const system of sourceSystems) {
    ids.set(system.id, allocateId())
    for (const object of system.objects) ids.set(object.id, allocateId())
    for (const orbit of system.orbits) ids.set(orbit.id, allocateId())
  }
  for (const route of sourceRoutes) ids.set(route.id, allocateId())

  const customFields = [...workspace.objectFieldSettings.customFields]
  const fieldIds = new Map<string, string>()
  for (const sourceField of sourceSettings.customFields) {
    const sameName = customFields.find(field =>
      field.name.toLowerCase() === sourceField.name.toLowerCase(),
    )
    if (sameName) {
      if (!sameFieldDefinition(sameName, sourceField)) {
        throw new Error(`Custom field "${sourceField.name}" conflicts with an existing field definition.`)
      }
      fieldIds.set(sourceField.id, sameName.id)
      continue
    }

    const id = allocateId()
    fieldIds.set(sourceField.id, id)
    customFields.push({ ...sourceField, id })
  }

  const importedSystems = sourceSystems.map(system => remapImportedSystem(system, ids, fieldIds))
  const importedRoutes: JumpRoute[] = sourceRoutes.map((route): JumpRoute =>
    route.toPointId === null
      ? {
          id: ids.get(route.id)!,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromPointId: ids.get(route.fromPointId)!,
          toPointId: null,
          unresolvedExit: route.unresolvedExit,
        }
      : {
          id: ids.get(route.id)!,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromPointId: ids.get(route.fromPointId)!,
          toPointId: ids.get(route.toPointId)!,
        },
  )
  const layout = {
    systemPositions: { ...workspace.layout.systemPositions },
    orbitRadii: { ...workspace.layout.orbitRadii },
    orbitRotations: { ...workspace.layout.orbitRotations },
    objectAngles: { ...workspace.layout.objectAngles },
  }
  const addedSystemIds = importedSystems.map(system => system.id)
  if (map.type === 'cluster') {
    for (const [sourceId, position] of Object.entries(map.layout.systemPositions)) {
      layout.systemPositions[ids.get(sourceId)!] = position
    }
  } else {
    layout.systemPositions[addedSystemIds[0]] = initialClusterSystemPosition(
      workspace.cluster.systems.length,
    )
  }
  const importedOrbitRadii = normalizeOrbitRadii(
    map.layout.orbitRadii,
    map.layout.orbitEllipseRadii ?? {},
  )
  if (!importedOrbitRadii) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }
  for (const [sourceId, radii] of Object.entries(importedOrbitRadii)) {
    layout.orbitRadii[ids.get(sourceId)!] = radii
  }
  const importedOrbitRotations = normalizeOrbitRotations(map.layout.orbitRotations ?? {})
  if (!importedOrbitRotations) {
    throw new Error('Choose a valid version 1 Jump Cluster or star system JSON export.')
  }
  for (const [sourceId, rotation] of Object.entries(importedOrbitRotations)) {
    layout.orbitRotations[ids.get(sourceId)!] = rotation
  }
  for (const [sourceId, angle] of Object.entries(map.layout.objectAngles)) {
    layout.objectAngles[ids.get(sourceId)!] = angle
  }

  const nextWorkspace: LocalWorkspace = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [...workspace.cluster.systems, ...importedSystems],
      routes: [...workspace.cluster.routes, ...importedRoutes],
    },
    layout,
    objectFieldSettings: {
      atmosphereOptions: mergeFieldOptions(
        workspace.objectFieldSettings.atmosphereOptions,
        sourceSettings.atmosphereOptions,
      ),
      portClassOptions: mergeFieldOptions(
        workspace.objectFieldSettings.portClassOptions,
        sourceSettings.portClassOptions,
      ),
      customFields,
    },
  }
  if (!isLocalWorkspace(nextWorkspace)) {
    throw new Error('The imported map could not be safely added to this workspace.')
  }

  return { workspace: nextWorkspace, addedSystemIds, summary }
}

function mergeFieldOptions(existing: string[], incoming: string[]): string[] {
  const merged = [...existing]
  const existingOptions = new Set(existing.map(option => option.toLowerCase()))
  for (const option of incoming) {
    if (!existingOptions.has(option.toLowerCase())) {
      merged.push(option)
      existingOptions.add(option.toLowerCase())
    }
  }
  return merged
}
