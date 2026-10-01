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
  }
}

export interface SystemObjectChanges {
  locationKey?: string
  name?: string
  description?: string
  subtype?: string
  placement?: ObjectPlacement
  jumpStationId?: string | null
}

const maxNameLength = 80

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

export function updateSystemObject(
  system: StarSystem,
  objectId: string,
  changes: SystemObjectChanges,
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

export function isLocalWorkspace(value: unknown): value is LocalWorkspace {
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
  ) {
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
  return Object.values(positions).every(isPoint)
    && systems.every(system => isPoint(positions[system.id]))
}
