

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
  applicability?: CustomFieldApplicabilityTarget[]
} & (
  | { type: 'text' | 'number' | 'boolean' }
  | { type: 'single-select'; options: string[] }
)

export function customFieldApplicabilityTargetKey(target: CustomFieldApplicabilityTarget): string {
  if (target.kind === 'category') return `category:${target.family}`
  return `subtype:${target.family}:${target.subtype}`
}

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

export function defaultObjectFieldSettings(): ObjectFieldSettings {
  return {
    atmosphereOptions: ['Breathable', 'Unbreathable', 'Vacuum'],
    portClassOptions: ['Class I', 'Class II', 'Class III'],
    customFields: [],
  }
}
