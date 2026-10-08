import {
  catalogueTypes,
  customFieldApplicabilityTargetKey,
  type CustomFieldApplicabilityTarget,
  type CustomFieldDefinition,
  type CustomFieldValue,
  type JumpRoute,
  type ObjectFamily,
  type ObjectFieldSettings,
  type Orbit,
  type Point,
  type SystemObject,
} from './workspace-model'

export const maxNameLength = 80

export function validText(value: string, label: string, maxLength?: number): string {
  const text = value.trim()
  if (!text) throw new Error(`${label} is required.`)
  if (maxLength !== undefined && text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`)
  }
  return text
}

export function validName(value: string, label: string): string {
  return validText(value, label, maxNameLength)
}

export function validFieldOptions(options: string[], label: string): string[] {
  if (!Array.isArray(options) || options.some(option => typeof option !== 'string')) {
    throw new Error(`${label} must be a list of text values.`)
  }

  const normalized = options.map(option => validText(option, label, maxNameLength))
  if (new Set(normalized.map(option => option.toLowerCase())).size !== normalized.length) {
    throw new Error(`${label} must not contain duplicate options.`)
  }
  return normalized
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
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

  if (value.applicability !== undefined && !isCustomFieldApplicability(value.applicability)) {
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

function isCustomFieldApplicabilityTarget(value: unknown): value is CustomFieldApplicabilityTarget {
  if (!isRecord(value)) return false
  if (value.kind === 'category') {
    return isObjectFamily(value.family)
  }
  return value.kind === 'subtype'
    && isObjectFamily(value.family)
    && typeof value.subtype === 'string'
    && value.subtype.trim() !== ''
    && (value.family === 'Other'
      || catalogueTypes.some(type => type.family === value.family && type.value === value.subtype))
}

export function isCustomFieldApplicability(value: unknown): value is CustomFieldApplicabilityTarget[] {
  return isArrayOf(value, isCustomFieldApplicabilityTarget)
    && new Set(value.map(customFieldApplicabilityTargetKey)).size === value.length
}

export function isObjectFieldSettings(value: unknown): value is ObjectFieldSettings {
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

export function isPoint(value: unknown): value is Point {
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

export function isSystemObject(value: unknown): value is SystemObject {
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

export function isOrbit(value: unknown): value is Orbit {
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

export function isJumpRoute(value: unknown): value is JumpRoute {
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

export function isJumpLevel(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
}

export function objectFieldValidationError(object: SystemObject, settings: ObjectFieldSettings): string | null {
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
