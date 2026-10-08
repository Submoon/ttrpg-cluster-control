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
