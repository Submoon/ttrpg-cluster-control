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

export interface Orbit {
  id: string
  hostId: string
  order: number
}

export type JumpRoute = {
  id: string
  name: string
  fromPointId: string
} & (
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
    orbitRadii: Record<string, number>
    objectAngles: Record<string, number>
  }
  objectFieldSettings: ObjectFieldSettings
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
      objectAngles: {},
    },
    objectFieldSettings: defaultObjectFieldSettings(),
  }
}

export function updateNativeFieldOptions(
  workspace: LocalWorkspace,
  field: 'atmosphere' | 'portClass',
  options: string[],
): LocalWorkspace {
  const normalized = validFieldOptions(options, `${field === 'atmosphere' ? 'Atmosphere' : 'Port class'} option`)
  const property = field === 'atmosphere' ? 'atmosphereOptions' : 'portClassOptions'

  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object[field]
      if (value !== undefined && !normalized.includes(value)) {
        throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
      }
    }
  }

  return {
    ...workspace,
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

export function updateCustomFieldOptions(
  workspace: LocalWorkspace,
  fieldId: string,
  options: string[],
): LocalWorkspace {
  const definition = workspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) {
    throw new Error('The selected custom field no longer exists.')
  }
  if (definition.type !== 'single-select') {
    throw new Error('Only single-select custom fields have editable options.')
  }

  const normalized = validFieldOptions(options, `${definition.name} option`)
  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object.customFieldValues?.[fieldId]
      if (typeof value === 'string' && !normalized.includes(value)) {
        throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
      }
    }
  }

  return {
    ...workspace,
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

export function jumpPointsInCluster(cluster: JumpCluster): JumpPointReference[] {
  return cluster.systems.flatMap(system =>
    system.objects
      .filter(object => object.family === 'JumpPoint')
      .map(point => ({ point, system })),
  )
}

export function createJumpRoute(
  cluster: JumpCluster,
  name: string,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit = 'Uncharted exit',
): JumpRoute {
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

  const route = {
    id: crypto.randomUUID(),
    name: validName(name, 'Jump Route name'),
    fromPointId,
  }
  if (toPointId === null) {
    return {
      ...route,
      toPointId,
      unresolvedExit: validText(unresolvedExit, 'Unresolved exit', maxNameLength),
    }
  }
  return { ...route, toPointId }
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

export function createOrbit(system: StarSystem, hostId: string): Orbit {
  if (!system.objects.some(object => object.id === hostId)) {
    throw new Error('Choose an existing map object to host an Orbit.')
  }

  const order = system.orbits
    .filter(orbit => orbit.hostId === hostId)
    .reduce((highest, orbit) => Math.max(highest, orbit.order), 0) + 1
  return { id: crypto.randomUUID(), hostId, order }
}

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject {
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

export function defaultOrbitRadius(system: StarSystem, orbit: Orbit): number {
  return orbitHost(system, orbit).subtype === 'star'
    ? 112 + (orbit.order - 1) * 58
    : 46 + (orbit.order - 1) * 28
}

export function minimumOrbitRadius(system: StarSystem, orbit: Orbit): number {
  return Math.ceil((orbitHost(system, orbit).subtype === 'star' ? 23 : 14) + 16)
}

export function canPlaceObjectInOrbit(system: StarSystem, objectId: string, orbitId: string): boolean {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    return false
  }

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
    if (!isUnitNumber(updated.placement.x) || !isUnitNumber(updated.placement.y)) {
      throw new Error('Schematic X and Y must be between 0 and 1.')
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

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
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
    ? isUnitNumber(value.placement.x) && isUnitNumber(value.placement.y)
    : value.placement.kind === 'orbit'
      && typeof value.placement.orbitId === 'string'
      && value.placement.orbitId.length > 0
}

function isOrbit(value: unknown): value is Orbit {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.hostId === 'string'
    && value.hostId.length > 0
    && typeof value.order === 'number'
    && Number.isSafeInteger(value.order)
    && value.order > 0
}

function isJumpRoute(value: unknown): value is JumpRoute {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !value.id
    || typeof value.name !== 'string'
    || !value.name.trim()
    || value.name !== value.name.trim()
    || value.name.length > maxNameLength
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

  const ordersByHost = new Map<string, number[]>()
  for (const orbit of system.orbits) {
    if (!objectIds.has(orbit.hostId) || ids.has(orbit.id)) {
      return false
    }
    ids.add(orbit.id)
    const orders = ordersByHost.get(orbit.hostId) ?? []
    orders.push(orbit.order)
    ordersByHost.set(orbit.hostId, orders)
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
  & Partial<Pick<LocalWorkspace['layout'], 'orbitRadii' | 'objectAngles'>>

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
  const orbitRadii = isRecord(layout.orbitRadii) ? layout.orbitRadii : {}
  const objectAngles = layout.objectAngles ?? {}
  const orbits = systems.flatMap(system =>
    system.orbits.map(orbit => ({ orbit, system })),
  )
  const orbitObjects = new Set(systems.flatMap(system =>
    system.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))
  return Object.values(positions).every(isPoint)
    && Object.entries(orbitRadii).every(([orbitId, radius]) => {
      const entry = orbits.find(candidate => candidate.orbit.id === orbitId)
      return typeof radius === 'number'
        && Number.isFinite(radius)
        && entry !== undefined
        && radius >= minimumOrbitRadius(entry.system, entry.orbit)
    })
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

export function restoreLocalWorkspace(value: unknown): LocalWorkspace | null {
  if (!isStoredLocalWorkspace(value)) {
    return null
  }

  return {
    ...value,
    layout: {
      ...value.layout,
      orbitRadii: value.layout.orbitRadii ?? {},
      objectAngles: value.layout.objectAngles ?? {},
    },
    objectFieldSettings: value.objectFieldSettings ?? defaultObjectFieldSettings(),
  }
}
