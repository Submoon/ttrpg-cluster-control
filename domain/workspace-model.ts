

/**
 * Domain contracts separate stable entity identity and placement from durable schematic layout.
 */
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

export type CustomFieldApplicabilityTarget =
  | { kind: 'category'; family: ObjectFamily }
  | { kind: 'subtype'; family: ObjectFamily; subtype: string }

export type CustomFieldDefinition = {
  id: string
  name: string
  /** Undefined applies to every object; an empty scope applies to none. */
  applicability?: CustomFieldApplicabilityTarget[]
} & (
  | { type: 'text' | 'number' | 'boolean' }
  | { type: 'single-select'; options: string[] }
)

/**
 * Builds a stable key for comparing category/subtype targets independent of object identity.
 * @param target Explicit applicability target.
 * @returns Canonical key unique to its target kind and family/subtype.
 */
export function customFieldApplicabilityTargetKey(target: CustomFieldApplicabilityTarget): string {
  if (target.kind === 'category') return `category:${target.family}`
  return `subtype:${target.family}:${target.subtype}`
}

export interface ObjectFieldSettings {
  atmosphereOptions: string[]
  portClassOptions: string[]
  customFields: CustomFieldDefinition[]
}

/**
 * Valid system placements use finite normalized coordinates mapped into the initial scene body.
 * Values may extend beyond [0, 1] as the schematic scene grows.
 */
export type ObjectPlacement =
  | { kind: 'system'; x: number; y: number }
  | { kind: 'orbit'; orbitId: string }

/**
 * Catalogue entity with stable ID/key, domain values, and either system-level or Orbit placement.
 * A Jump Point's optional physical Station link is separate from logical route endpoints.
 */
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

/** Horizontal and vertical Orbit extents, measured in SVG scene units. */
export interface OrbitRadii {
  horizontal: number
  vertical: number
}

/**
 * Hosted Orbits use a stable object ID; unoccupied centers store normalized map coordinates.
 */
export type Orbit = {
  id: string
  order: number
} & (
  | { hostId: string; center?: never }
  | { hostId: null; center: Point }
)

/**
 * Routes connect logical Jump Point IDs; a null destination records an unresolved external exit.
 */
export type JumpRoute = {
  id: string
  name?: string
  jumpLevel: number
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

/**
 * Durable local campaign map; temporary view/zoom state is intentionally kept outside this shape.
 */
export interface LocalWorkspace {
  id: string
  cluster: JumpCluster
  layout: {
    /** Normalized cluster positions; interactive system drags clamp each axis to [0, 1]. */
    systemPositions: Record<string, Point>
    /** Orbit radii in SVG scene units. */
    orbitRadii: Record<string, OrbitRadii>
    /** Orbit rotations in degrees. */
    orbitRotations: Record<string, number>
    /** Object positions around Orbits in radians; missing entries use sibling-order defaults. */
    objectAngles: Record<string, number>
  }
  objectFieldSettings: ObjectFieldSettings
}

/** Versioned portable layout; numeric radii and separate ellipse radii are accepted for legacy exports. */
export interface ExportedLayout {
  version: 1
  orbitRadii: Record<string, OrbitRadii | number>
  orbitEllipseRadii?: Record<string, OrbitRadii>
  orbitRotations?: Record<string, number>
  objectAngles: Record<string, number>
}

export type JumpClusterExport = {
  format: 'ttrpg-cluster-control-map'
  version: 1
  type: 'cluster'
  cluster: JumpCluster
  objectFieldSettings: ObjectFieldSettings
  layout: ExportedLayout & { systemPositions: Record<string, Point> }
}

export type StarSystemExport = {
  format: 'ttrpg-cluster-control-map'
  version: 1
  type: 'system'
  system: StarSystem
  objectFieldSettings: ObjectFieldSettings
  layout: ExportedLayout
}

/** Informational import preview; possible name/key matches do not merge map entities. */
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

/** Validated copy candidate returned before confirmation or persistence. */
export interface PreparedJsonImport {
  workspace: LocalWorkspace
  addedSystemIds: string[]
  summary: JsonImportSummary
}

/** Partial fields accepted by the object-edit command; omitted fields retain their current values. */
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

/** Creates the built-in field options with no custom definitions. */
export function defaultObjectFieldSettings(): ObjectFieldSettings {
  return {
    atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
    portClassOptions: ['Class I', 'Class II', 'Class III'],
    customFields: [],
  }
}
