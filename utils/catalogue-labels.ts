import { catalogueTypes, type ObjectFamily, type SystemObject } from '../domain/workspace'

const familyLabels: Record<ObjectFamily, string> = {
  CelestialBody: 'Celestial body',
  'SmallBody/Field': 'Small body or field',
  Installation: 'Installation',
  Vessel: 'Vessel',
  JumpPoint: 'Jump Point',
  Phenomenon: 'Phenomenon',
  Other: 'Other',
}

/** Returns the Warden-facing singular label for a catalogue family. */
export function catalogueFamilyLabel(family: ObjectFamily): string {
  return familyLabels[family]
}

/** Resolves catalogue subtype values to readable labels while preserving custom Other labels. */
export function catalogueSubtypeLabel(object: Pick<SystemObject, 'family' | 'subtype'>): string {
  if (object.family === 'Other') return object.subtype.trim() || 'Other'
  return catalogueTypes.find(type => type.family === object.family && type.value === object.subtype)?.label
    ?? object.subtype.replaceAll('-', ' ')
}

/** Builds the accessible, Warden-facing map label for an object. */
export function catalogueObjectLabel(object: Pick<SystemObject, 'family' | 'subtype' | 'locationKey' | 'name'>): string {
  return `${object.locationKey}, ${object.name} (${catalogueSubtypeLabel(object)})`
}
