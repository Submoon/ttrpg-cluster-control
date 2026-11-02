import { catalogueTypes } from './workspace-model'
import type {
  CustomFieldType,
  ObjectFamily,
  OrbitRadii,
  Point,
} from './workspace-model'
import type {
  PlayerClusterDocument,
  PlayerFieldValue,
  PlayerObjectMarker,
  PlayerOrbit,
  PlayerRoute,
  PlayerSystemDocument,
  PlayerSystemMarker,
} from './player-projection'

export type PlayerDocumentErrorCode =
  | 'invalid-json'
  | 'unsupported-format'
  | 'unsupported-version'
  | 'invalid-document'
  | 'too-large'
  | 'empty-document'

const errorMessages: Record<PlayerDocumentErrorCode, string> = {
  'invalid-json': 'The player JSON file is not valid JSON.',
  'unsupported-format': 'This file is not a supported player document.',
  'unsupported-version': 'This player document version is not supported.',
  'invalid-document': 'The player document is invalid.',
  'too-large': 'The player document exceeds the supported size or work limit.',
  'empty-document': 'The player document contains no public systems.',
}

/** Safe, stable failure for parsing, validating, or serializing a player document. */
export class PlayerDocumentError extends Error {
  readonly code: PlayerDocumentErrorCode

  constructor(code: PlayerDocumentErrorCode) {
    super(errorMessages[code])
    this.name = 'PlayerDocumentError'
    this.code = code
  }
}

const PLAYER_FORMAT = 'ttrpg-cluster-control-player'
const PLAYER_VERSION = 1
const MAX_JSON_BYTES = 4 * 1024 * 1024
const MAX_JSON_DEPTH = 64
const MAX_TEXT_BYTES = 256 * 1024
const MAX_SYSTEMS = 256
const MAX_ROUTES = 512
const MAX_OBJECTS_PER_SYSTEM = 2_000
const MAX_ORBITS_PER_SYSTEM = 2_000
const MAX_OBJECTS_TOTAL = 10_000
const MAX_ORBITS_TOTAL = 10_000
const MAX_FIELDS_TOTAL = 20_000
const MAX_GEOMETRY_VALUE = 1_000_000_000
const encoder = new TextEncoder()

interface WorkCounts {
  objects: number
  orbits: number
  fields: number
}

function fail(code: PlayerDocumentErrorCode): never {
  throw new PlayerDocumentError(code)
}

function invalidDocument(): never {
  return fail('invalid-document')
}

function tooLarge(): never {
  return fail('too-large')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength
}

function isUtf8WithinLimit(value: string, maximumBytes: number): boolean {
  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    bytes += codePoint <= 0x7f ? 1
      : codePoint <= 0x7ff ? 2
        : codePoint >= 0xd800 && codePoint <= 0xdfff ? 3
          : codePoint <= 0xffff ? 3
            : 4
    if (bytes > maximumBytes) return false
  }
  return true
}

function readText(value: unknown, nonblank = false): string {
  if (
    typeof value !== 'string'
    || value.length > MAX_TEXT_BYTES
    || !isUtf8WithinLimit(value, MAX_TEXT_BYTES)
    || (nonblank && !value.trim())
  ) {
    return invalidDocument()
  }
  return value
}

function readFiniteGeometry(value: unknown, positive = false): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || Math.abs(value) > MAX_GEOMETRY_VALUE
    || (positive && value <= 0)
  ) {
    return invalidDocument()
  }
  return value
}

function readPoint(value: unknown, budget: SerializedJsonBudget): Point {
  if (!isRecord(value)) return invalidDocument()
  const point = {
    x: readFiniteGeometry(value.x),
    y: readFiniteGeometry(value.y),
  }
  budget.startObject()
  budget.addKey('x')
  budget.addNumber(point.x)
  budget.addKey('y')
  budget.addNumber(point.y)
  budget.endObject()
  return point
}

function readPublicId(value: unknown, kind: 'system' | 'route' | 'object' | 'orbit'): string {
  const limit = kind === 'system' ? MAX_SYSTEMS
    : kind === 'route' ? MAX_ROUTES
      : kind === 'object' ? MAX_OBJECTS_PER_SYSTEM
        : MAX_ORBITS_PER_SYSTEM
  if (typeof value !== 'string' || value.length > 20) return invalidDocument()
  const prefix = `${kind}-`
  if (!value.startsWith(prefix)) return invalidDocument()
  const suffix = value.slice(prefix.length)
  if (!/^\d+$/.test(suffix)) return invalidDocument()
  const index = Number(suffix)
  if (!Number.isSafeInteger(index) || index < 1 || index > limit || String(index) !== suffix) {
    return invalidDocument()
  }
  return value
}

function readFamily(value: unknown): ObjectFamily {
  if (
    value === 'CelestialBody'
    || value === 'SmallBody/Field'
    || value === 'Installation'
    || value === 'Vessel'
    || value === 'JumpPoint'
    || value === 'Phenomenon'
    || value === 'Other'
  ) {
    return value
  }
  return invalidDocument()
}

function readFamilyAndSubtype(value: Record<string, unknown>): { family: ObjectFamily; subtype: string } {
  const family = readFamily(value.family)
  const subtype = readText(value.subtype, true)
  if (family !== 'Other' && !catalogueTypes.some(type => type.family === family && type.value === subtype)) {
    return invalidDocument()
  }
  return { family, subtype }
}

function subtypeLabel(family: ObjectFamily, subtype: string): string {
  if (family === 'Other') return subtype.trim() || 'Other'
  const catalogueType = catalogueTypes.find(type => type.family === family && type.value === subtype)
  if (!catalogueType) return invalidDocument()
  return catalogueType.label
}

function checkJsonDepth(text: string): void {
  let depth = 0
  let inString = false
  let escaped = false

  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }

    if (character === '"') inString = true
    else if (character === '{' || character === '[') {
      depth += 1
      if (depth > MAX_JSON_DEPTH) tooLarge()
    } else if (character === '}' || character === ']') {
      depth -= 1
    }
  }
}

interface JsonContainerFrame {
  kind: 'array' | 'object'
  entries: number
  expectsValue: boolean
}

/** Counts canonical JSON bytes as the allowlisted document is reconstructed. */
class SerializedJsonBudget {
  private bytes = 0
  private readonly frames: JsonContainerFrame[] = []
  private rootStarted = false

  startRootObject(): void {
    if (this.rootStarted || this.frames.length !== 0) return invalidDocument()
    this.rootStarted = true
    this.addBytes(1)
    this.frames.push({ kind: 'object', entries: 0, expectsValue: false })
  }

  startObject(): void {
    this.beforeValue()
    this.addBytes(1)
    this.frames.push({ kind: 'object', entries: 0, expectsValue: false })
  }

  endObject(): void {
    const frame = this.frames.pop()
    if (!frame || frame.kind !== 'object' || frame.expectsValue) return invalidDocument()
    this.addBytes(1)
  }

  startArray(): void {
    this.beforeValue()
    this.addBytes(1)
    this.frames.push({ kind: 'array', entries: 0, expectsValue: false })
  }

  endArray(): void {
    const frame = this.frames.pop()
    if (!frame || frame.kind !== 'array') return invalidDocument()
    this.addBytes(1)
  }

  addKey(value: string): void {
    const frame = this.frames[this.frames.length - 1]
    if (!frame || frame.kind !== 'object' || frame.expectsValue) return invalidDocument()
    if (frame.entries > 0) this.addBytes(1)
    this.addEscapedString(value)
    this.addBytes(1)
    frame.expectsValue = true
  }

  addString(value: string): void {
    this.beforeValue()
    this.addEscapedString(value)
  }

  addNumber(value: number): void {
    this.beforeValue()
    if (!Number.isFinite(value)) return invalidDocument()
    this.addBytes(Object.is(value, -0) ? 1 : String(value).length)
  }

  addBoolean(value: boolean): void {
    this.beforeValue()
    this.addBytes(value ? 4 : 5)
  }

  addNull(): void {
    this.beforeValue()
    this.addBytes(4)
  }

  finish(): void {
    if (!this.rootStarted || this.frames.length !== 0) return invalidDocument()
  }

  private beforeValue(): void {
    const frame = this.frames[this.frames.length - 1]
    if (!frame) return invalidDocument()
    if (frame.kind === 'object') {
      if (!frame.expectsValue) return invalidDocument()
      frame.expectsValue = false
    } else {
      if (frame.entries > 0) this.addBytes(1)
    }
    frame.entries += 1
  }

  private addEscapedString(value: string): void {
    this.addBytes(2)
    for (const character of value) {
      const codePoint = character.codePointAt(0)!
      const size = character === '"' || character === '\\'
        ? 2
        : codePoint <= 0x1f
          ? codePoint === 0x08 || codePoint === 0x09 || codePoint === 0x0a
            || codePoint === 0x0c || codePoint === 0x0d
            ? 2
            : 6
          : codePoint <= 0x7f
            ? 1
            : codePoint <= 0x7ff
              ? 2
              : codePoint >= 0xd800 && codePoint <= 0xdfff
                ? 6
                : codePoint <= 0xffff
                  ? 3
                  : 4
      this.addBytes(size)
    }
  }

  private addBytes(value: number): void {
    this.bytes += value
    if (this.bytes > MAX_JSON_BYTES) tooLarge()
  }
}

/** Parses bounded UTF-8 player JSON, returning only reconstructed public DTO fields. */
export function parsePlayerJson(text: string): PlayerClusterDocument {
  if (typeof text !== 'string') return invalidDocument()
  if (byteLength(text) > MAX_JSON_BYTES) return tooLarge()
  if (!text.trim()) return fail('empty-document')
  checkJsonDepth(text)

  let input: unknown
  try {
    input = JSON.parse(text) as unknown
  } catch {
    return fail('invalid-json')
  }
  return restorePlayerDocument(input)
}

/** Validates unknown player data and rebuilds a detached document without extension properties. */
export function restorePlayerDocument(input: unknown): PlayerClusterDocument {
  if (!isRecord(input)) return invalidDocument()
  if (input.format !== PLAYER_FORMAT) return fail('unsupported-format')
  if (input.version !== PLAYER_VERSION) return fail('unsupported-version')

  if (!Array.isArray(input.systems)) return invalidDocument()
  if (input.systems.length === 0) return fail('empty-document')
  if (input.systems.length > MAX_SYSTEMS) return tooLarge()
  if (!Array.isArray(input.routes)) return invalidDocument()
  if (input.routes.length > MAX_ROUTES) return tooLarge()

  const title = readText(input.title, true)
  const counts: WorkCounts = { objects: 0, orbits: 0, fields: 0 }
  const outputBudget = new SerializedJsonBudget()
  outputBudget.startRootObject()
  outputBudget.addKey('format')
  outputBudget.addString(PLAYER_FORMAT)
  outputBudget.addKey('version')
  outputBudget.addNumber(PLAYER_VERSION)
  outputBudget.addKey('title')
  outputBudget.addString(title)
  outputBudget.addKey('systems')
  outputBudget.startArray()
  const systems: PlayerSystemMarker[] = []
  for (const candidate of input.systems) {
    systems.push(restoreSystemMarker(candidate, counts, outputBudget))
  }
  outputBudget.endArray()
  outputBudget.addKey('routes')
  outputBudget.startArray()
  const routes: PlayerRoute[] = []
  for (const candidate of input.routes) {
    routes.push(restoreRoute(candidate, outputBudget))
  }
  outputBudget.endArray()
  outputBudget.endObject()
  outputBudget.finish()
  assertUniqueIds(systems, routes)
  assertClusterReferences(systems, routes)

  return {
    format: PLAYER_FORMAT,
    version: PLAYER_VERSION,
    title,
    systems,
    routes,
  }
}

/** Serializes a validated player document after rebuilding its allowlisted public shape. */
export function serializePlayerJson(document: PlayerClusterDocument): string {
  const safeDocument = restorePlayerDocument(document)
  const serialized = JSON.stringify(safeDocument)
  if (typeof serialized !== 'string') return invalidDocument()
  if (byteLength(serialized) > MAX_JSON_BYTES) return tooLarge()
  return serialized
}

function restoreSystemMarker(
  value: unknown,
  counts: WorkCounts,
  budget: SerializedJsonBudget,
): PlayerSystemMarker {
  if (!isRecord(value)) return invalidDocument()
  const id = readPublicId(value.id, 'system')
  budget.startObject()
  budget.addKey('id')
  budget.addString(id)
  budget.addKey('position')
  const position = readPoint(value.position, budget)

  if (value.disclosure === 'unknown') {
    if (value.label !== 'Unknown presence') return invalidDocument()
    budget.addKey('disclosure')
    budget.addString('unknown')
    budget.addKey('label')
    budget.addString('Unknown presence')
    budget.endObject()
    return { id, position, disclosure: 'unknown', label: 'Unknown presence' }
  }
  if (value.disclosure === 'known-type') {
    if (value.type !== 'star-system' || value.label !== 'Star system') return invalidDocument()
    budget.addKey('disclosure')
    budget.addString('known-type')
    budget.addKey('type')
    budget.addString('star-system')
    budget.addKey('label')
    budget.addString('Star system')
    budget.endObject()
    return { id, position, disclosure: 'known-type', type: 'star-system', label: 'Star system' }
  }
  if (value.disclosure !== 'revealed' || value.type !== 'star-system') return invalidDocument()

  const label = readText(value.label, true)
  budget.addKey('disclosure')
  budget.addString('revealed')
  budget.addKey('type')
  budget.addString('star-system')
  budget.addKey('label')
  budget.addString(label)
  budget.addKey('map')
  const map = restoreSystemDocument(value.map, counts, budget)
  budget.endObject()
  return {
    id,
    position,
    disclosure: 'revealed',
    type: 'star-system',
    label,
    map,
  }
}

function restoreSystemDocument(
  value: unknown,
  counts: WorkCounts,
  budget: SerializedJsonBudget,
): PlayerSystemDocument {
  if (!isRecord(value) || !Array.isArray(value.objects) || !Array.isArray(value.orbits)) {
    return invalidDocument()
  }
  if (value.objects.length > MAX_OBJECTS_PER_SYSTEM || value.orbits.length > MAX_ORBITS_PER_SYSTEM) {
    return tooLarge()
  }
  counts.objects += value.objects.length
  counts.orbits += value.orbits.length
  if (counts.objects > MAX_OBJECTS_TOTAL || counts.orbits > MAX_ORBITS_TOTAL) return tooLarge()

  budget.startObject()
  budget.addKey('orbits')
  budget.startArray()
  const orbits: PlayerOrbit[] = []
  for (const candidate of value.orbits) orbits.push(restoreOrbit(candidate, budget))
  budget.endArray()
  const orbitById = uniqueById(orbits)
  budget.addKey('objects')
  budget.startArray()
  const objects: PlayerObjectMarker[] = []
  for (const candidate of value.objects) {
    objects.push(restoreObject(candidate, orbitById, counts, budget))
  }
  budget.endArray()
  budget.endObject()
  const objectById = uniqueById(objects)
  const usedOrbitIds = new Set<string>()

  for (const object of objects) {
    if (object.placement.kind === 'orbit') usedOrbitIds.add(object.placement.orbitId)
  }
  if (usedOrbitIds.size !== orbits.length) return invalidDocument()

  for (const orbit of orbits) {
    if (orbit.hostId !== null && !objectById.has(orbit.hostId)) return invalidDocument()
  }
  assertAcyclicObjectHosts(objects, orbitById)
  assertStationAssociations(objects, objectById)

  return { objects, orbits }
}

function restoreOrbit(value: unknown, budget: SerializedJsonBudget): PlayerOrbit {
  if (!isRecord(value) || !isRecord(value.radii)) return invalidDocument()
  const id = readPublicId(value.id, 'orbit')
  const hostId = value.hostId === null ? null : readPublicId(value.hostId, 'object')
  const radii: OrbitRadii = {
    horizontal: readFiniteGeometry(value.radii.horizontal, true),
    vertical: readFiniteGeometry(value.radii.vertical, true),
  }
  const rotation = readFiniteGeometry(value.rotation)

  budget.startObject()
  budget.addKey('id')
  budget.addString(id)
  budget.addKey('hostId')
  if (hostId === null) budget.addNull()
  else budget.addString(hostId)
  budget.addKey('center')
  const center = readPoint(value.center, budget)
  budget.addKey('radii')
  budget.startObject()
  budget.addKey('horizontal')
  budget.addNumber(radii.horizontal)
  budget.addKey('vertical')
  budget.addNumber(radii.vertical)
  budget.endObject()
  budget.addKey('rotation')
  budget.addNumber(rotation)
  budget.endObject()

  return {
    id,
    hostId,
    center,
    radii,
    rotation,
  }
}

function restoreObject(
  value: unknown,
  orbitById: Map<string, PlayerOrbit>,
  counts: WorkCounts,
  budget: SerializedJsonBudget,
): PlayerObjectMarker {
  if (!isRecord(value)) return invalidDocument()
  const id = readPublicId(value.id, 'object')
  budget.startObject()
  budget.addKey('id')
  budget.addString(id)
  budget.addKey('position')
  const position = readPoint(value.position, budget)
  budget.addKey('placement')
  const placement = restorePlacement(value.placement, orbitById, budget)

  if (value.disclosure === 'unknown') {
    if (value.label !== 'Unknown presence') return invalidDocument()
    budget.addKey('disclosure')
    budget.addString('unknown')
    budget.addKey('label')
    budget.addString('Unknown presence')
    budget.endObject()
    return { id, position, placement, disclosure: 'unknown', label: 'Unknown presence' }
  }
  if (value.disclosure !== 'known-type' && value.disclosure !== 'revealed') return invalidDocument()

  const { family, subtype } = readFamilyAndSubtype(value)
  if (value.disclosure === 'known-type') {
    const label = subtypeLabel(family, subtype)
    if (value.label !== label) return invalidDocument()
    budget.addKey('disclosure')
    budget.addString('known-type')
    budget.addKey('family')
    budget.addString(family)
    budget.addKey('subtype')
    budget.addString(subtype)
    budget.addKey('label')
    budget.addString(label)
    budget.endObject()
    return { id, position, placement, disclosure: 'known-type', family, subtype, label }
  }

  const label = readText(value.label, true)
  const playerText = readText(value.playerText)
  if (!Array.isArray(value.fields)) return invalidDocument()
  counts.fields += value.fields.length
  if (counts.fields > MAX_FIELDS_TOTAL) return tooLarge()
  const fields: PlayerFieldValue[] = []
  let stationId: string | undefined
  if (value.stationId !== undefined) stationId = readPublicId(value.stationId, 'object')

  budget.addKey('disclosure')
  budget.addString('revealed')
  budget.addKey('family')
  budget.addString(family)
  budget.addKey('subtype')
  budget.addString(subtype)
  budget.addKey('label')
  budget.addString(label)
  budget.addKey('playerText')
  budget.addString(playerText)
  budget.addKey('fields')
  budget.startArray()
  for (const candidate of value.fields) fields.push(restoreField(candidate, budget))
  budget.endArray()
  if (stationId !== undefined) {
    budget.addKey('stationId')
    budget.addString(stationId)
  }
  budget.endObject()

  return {
    id,
    position,
    placement,
    disclosure: 'revealed',
    family,
    subtype,
    label,
    playerText,
    fields,
    ...(stationId === undefined ? {} : { stationId }),
  }
}

function restorePlacement(
  value: unknown,
  orbitById: Map<string, PlayerOrbit>,
  budget: SerializedJsonBudget,
): PlayerObjectMarker['placement'] {
  if (!isRecord(value)) return invalidDocument()
  if (value.kind === 'system') {
    budget.startObject()
    budget.addKey('kind')
    budget.addString('system')
    budget.endObject()
    return { kind: 'system' }
  }
  if (value.kind !== 'orbit') return invalidDocument()
  const orbitId = readPublicId(value.orbitId, 'orbit')
  if (!orbitById.has(orbitId)) return invalidDocument()
  const angle = readFiniteGeometry(value.angle)
  budget.startObject()
  budget.addKey('kind')
  budget.addString('orbit')
  budget.addKey('orbitId')
  budget.addString(orbitId)
  budget.addKey('angle')
  budget.addNumber(angle)
  budget.endObject()
  return { kind: 'orbit', orbitId, angle }
}

function restoreField(value: unknown, budget: SerializedJsonBudget): PlayerFieldValue {
  if (!isRecord(value)) return invalidDocument()
  const name = readText(value.name, true)
  const type = readFieldType(value.type)
  budget.startObject()
  budget.addKey('name')
  budget.addString(name)
  budget.addKey('type')
  budget.addString(type)
  budget.addKey('value')
  if (type === 'text') {
    const fieldValue = readText(value.value)
    budget.addString(fieldValue)
    budget.endObject()
    return { name, type, value: fieldValue }
  }
  if (type === 'number') {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return invalidDocument()
    budget.addNumber(value.value)
    budget.endObject()
    return { name, type, value: value.value }
  }
  if (type === 'boolean') {
    if (typeof value.value !== 'boolean') return invalidDocument()
    budget.addBoolean(value.value)
    budget.endObject()
    return { name, type, value: value.value }
  }
  const fieldValue = readText(value.value, true)
  budget.addString(fieldValue)
  budget.endObject()
  return { name, type, value: fieldValue }
}

function readFieldType(value: unknown): CustomFieldType {
  if (value === 'text' || value === 'number' || value === 'boolean' || value === 'single-select') {
    return value
  }
  return invalidDocument()
}

function restoreRoute(value: unknown, budget: SerializedJsonBudget): PlayerRoute {
  if (!isRecord(value) || !isRecord(value.destination)) return invalidDocument()
  const id = readPublicId(value.id, 'route')
  if (typeof value.jumpLevel !== 'number' || !Number.isSafeInteger(value.jumpLevel) || value.jumpLevel < 1) {
    return invalidDocument()
  }
  const fromSystemId = readPublicId(value.fromSystemId, 'system')
  budget.startObject()
  budget.addKey('id')
  budget.addString(id)
  budget.addKey('jumpLevel')
  budget.addNumber(value.jumpLevel)
  budget.addKey('fromSystemId')
  budget.addString(fromSystemId)
  budget.addKey('destination')
  if (value.destination.kind === 'system') {
    const systemId = readPublicId(value.destination.systemId, 'system')
    budget.startObject()
    budget.addKey('kind')
    budget.addString('system')
    budget.addKey('systemId')
    budget.addString(systemId)
    budget.endObject()
    budget.endObject()
    return {
      id,
      jumpLevel: value.jumpLevel,
      fromSystemId,
      destination: { kind: 'system', systemId },
    }
  }
  if (value.destination.kind === 'unknown' && value.destination.label === 'Unknown destination') {
    budget.startObject()
    budget.addKey('kind')
    budget.addString('unknown')
    budget.addKey('position')
    const position = readPoint(value.destination.position, budget)
    budget.addKey('label')
    budget.addString('Unknown destination')
    budget.endObject()
    budget.endObject()
    return {
      id,
      jumpLevel: value.jumpLevel,
      fromSystemId,
      destination: {
        kind: 'unknown',
        position,
        label: 'Unknown destination',
      },
    }
  }
  return invalidDocument()
}

function uniqueById<T extends { id: string }>(values: readonly T[]): Map<string, T> {
  const result = new Map<string, T>()
  for (const value of values) {
    if (result.has(value.id)) return invalidDocument()
    result.set(value.id, value)
  }
  return result
}

function assertUniqueIds(systems: readonly PlayerSystemMarker[], routes: readonly PlayerRoute[]): void {
  uniqueById(systems)
  uniqueById(routes)
}

function assertClusterReferences(systems: readonly PlayerSystemMarker[], routes: readonly PlayerRoute[]): void {
  const systemsById = uniqueById(systems)
  for (const route of routes) {
    if (!systemsById.has(route.fromSystemId)) return invalidDocument()
    if (route.destination.kind === 'system' && !systemsById.has(route.destination.systemId)) {
      return invalidDocument()
    }
  }
}

function assertAcyclicObjectHosts(
  objects: readonly PlayerObjectMarker[],
  orbitById: Map<string, PlayerOrbit>,
): void {
  const objectsById = uniqueById(objects)
  const stateByObjectId = new Map<string, 1 | 2>()

  for (const object of objects) {
    if (stateByObjectId.get(object.id) === 2) continue
    const path: string[] = []
    let currentId: string | null = object.id

    while (currentId !== null) {
      const state = stateByObjectId.get(currentId)
      if (state === 1) return invalidDocument()
      if (state === 2) break

      const current = objectsById.get(currentId)
      if (!current) return invalidDocument()
      stateByObjectId.set(currentId, 1)
      path.push(currentId)
      if (current.placement.kind === 'system') {
        currentId = null
        continue
      }

      const orbit = orbitById.get(current.placement.orbitId)
      if (!orbit) return invalidDocument()
      currentId = orbit.hostId
    }

    for (const visitedId of path) stateByObjectId.set(visitedId, 2)
  }
}

function assertStationAssociations(
  objects: readonly PlayerObjectMarker[],
  objectsById: Map<string, PlayerObjectMarker>,
): void {
  for (const object of objects) {
    if (object.disclosure !== 'revealed' || object.stationId === undefined) continue
    if (object.family !== 'JumpPoint' || object.subtype !== 'jump-point' || object.stationId === object.id) {
      return invalidDocument()
    }
    const station = objectsById.get(object.stationId)
    if (
      !station
      || station.disclosure !== 'revealed'
      || station.family !== 'Installation'
      || station.subtype !== 'station'
    ) {
      return invalidDocument()
    }
  }
}
