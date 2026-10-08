/**
 * Creates and validates catalogue objects, including field values, location keys, Station links, and Orbit placement.
 */
import { catalogueTypes } from './workspace-model'
import type {
  CatalogueSubtype,
  ObjectFieldSettings,
  ObjectPlacement,
  StarSystem,
  SystemObject,
  SystemObjectChanges,
} from './workspace-model'
import { canPlaceObjectInOrbit } from './workspace-orbits'
import { objectFieldValidationError, validName, validText } from './workspace-validation'

/**
 * Allocates the first unused prefixed numeric location key within one system.
 * @param system System whose current keys are reserved.
 * @param prefix Catalogue prefix, such as PL or JP.
 * @returns A key in the form PREFIX-NN, with at least two digits.
 */
function nextLocationKey(system: StarSystem, prefix: string): string {
  let index = 1
  let key = `${prefix}-${String(index).padStart(2, '0')}`
  while (system.objects.some(object => object.locationKey === key)) {
    index += 1
    key = `${prefix}-${String(index).padStart(2, '0')}`
  }
  return key
}

/**
 * Chooses the next slot on the 20-point initial placement grid for a system-level object.
 * The grid cycles; crowded maps rely on later manual placement rather than unbounded generation.
 * @param system System whose current system-level objects determine the next grid index.
 * @returns Normalized schematic coordinates, without clamping to the initial scene.
 */
export function initialSystemPlacement(system: StarSystem): Extract<ObjectPlacement, { kind: 'system' }> {
  const index = system.objects.filter(object => object.placement.kind === 'system').length
  // ponytail: initial positions cycle a 20-point grid; manual X/Y editing handles denser maps.
  return {
    kind: 'system',
    x: 0.1 + (index % 5) * 0.2,
    y: 0.1 + (Math.floor(index / 5) % 4) * 0.24,
  }
}

/**
 * Creates a catalogue object with a unique system-local location key and initial placement.
 * @param system System used for the name count, key allocation, and optional Orbit validation.
 * @param subtype Existing catalogue subtype to create.
 * @param orbitId Optional Orbit that must accept this object without creating a host cycle.
 * @returns New object data with generated identity and empty description.
 * @throws If the subtype is unsupported or a supplied Orbit does not exist or would create a host cycle.
 */
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

/**
 * Applies a partial object edit and validates identity-local keys, fields, station links, and placement.
 * Custom-field values are validated even when their definitions are currently inapplicable.
 * @param system System containing the object.
 * @param objectId ID of the object to edit.
 * @param changes Fields to replace; omitted properties retain their existing values.
 * @param objectFieldSettings Current definitions and allowed values used for validation.
 * @returns A new system with only the selected object replaced.
 * @throws If the object is missing or any proposed value or placement violates domain rules.
 */
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
