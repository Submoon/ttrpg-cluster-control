/** Pure object-draft parsing and validation, separate from session identity and async guards. */
import {
  canPlaceObjectInOrbit,
  updateWorkspaceObject,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type StarSystem,
  type SystemObject,
  type SystemObjectChanges,
} from '../../domain/workspace'
import type { ObjectDraft } from './types'

function customValueForDraft(
  value: string,
  definition: CustomFieldDefinition,
): { value: string | number | boolean } | { error: string } | null {
  if (value === '') return null
  if (definition.type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? { value: parsed } : { error: `${definition.name} must be a finite number.` }
  }
  if (definition.type === 'boolean') {
    if (value === 'true') return { value: true }
    if (value === 'false') return { value: false }
    return { error: `Choose Yes, No, or Not recorded for ${definition.name}.` }
  }
  if (definition.type === 'single-select' && !definition.options.includes(value)) {
    return { error: `Choose an available ${definition.name} option.` }
  }
  return { value }
}

export function parseFiniteInput(value: string, label: string, errors: Record<string, string>, key: string): number | null {
  if (!value.trim()) {
    errors[key] = `${label} is required.`
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    errors[key] = `${label} must be a finite number.`
    return null
  }
  return parsed
}

function parseOrbitPlacement(placement: string): string | null {
  return placement.startsWith('orbit:') && placement.length > 'orbit:'.length
    ? placement.slice('orbit:'.length)
    : null
}

function isPhysicalStation(object: SystemObject): boolean {
  return object.family === 'Installation' && object.subtype === 'station'
}

/**
 * Parses a draft against the current workspace and applies a validated result through the shared placement operation.
 * Session ownership, dependency checks and stale-context handling remain with the editing controller.
 */
export function validateObjectDraft(
  workspace: LocalWorkspace,
  system: StarSystem,
  object: SystemObject,
  initial: ObjectDraft,
  draft: ObjectDraft,
): { workspace: LocalWorkspace | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const changes: SystemObjectChanges = {}
  const locationKey = draft.locationKey.trim()
  const name = draft.name.trim()
  const subtype = draft.subtype.trim()
  if (!locationKey) errors.locationKey = 'Location key is required.'
  if (system.objects.some(candidate => candidate.id !== object.id && candidate.locationKey === locationKey)) {
    errors.locationKey = `Location key "${locationKey}" is already used in this star system.`
  }
  if (!name) errors.name = 'Object name is required.'
  if (name.length > 80) errors.name = 'Object name must be 80 characters or fewer.'
  if (!subtype) errors.subtype = 'Object type is required.'
  if (object.family !== 'Other' && subtype !== object.subtype) {
    errors.subtype = 'This catalogue type cannot be changed.'
  }
  if (locationKey !== initial.locationKey) changes.locationKey = locationKey
  if (name !== initial.name) changes.name = name
  if (draft.description !== initial.description) changes.description = draft.description
  if (subtype !== initial.subtype) changes.subtype = subtype

  if (draft.placement === 'system') {
    const x = parseFiniteInput(draft.x, 'Schematic X', errors, 'x')
    const y = parseFiniteInput(draft.y, 'Schematic Y', errors, 'y')
    const wasSystemPlacement = object.placement.kind === 'system'
    const placementChanged = draft.placement !== initial.placement
      || (wasSystemPlacement && (draft.x !== initial.x || draft.y !== initial.y))
    if (placementChanged && x !== null && y !== null) changes.placement = { kind: 'system', x, y }
  } else {
    const orbitId = parseOrbitPlacement(draft.placement)
    if (!orbitId) {
      errors.placement = 'Choose a valid map placement.'
    } else if (!canPlaceObjectInOrbit(system, object.id, orbitId)) {
      errors.placement = 'Choose an Orbit that does not create a circular relationship.'
    } else if (draft.placement !== initial.placement) {
      changes.placement = { kind: 'orbit', orbitId }
    }
  }

  const jumpStationId = draft.jumpStationId
  if (jumpStationId && !system.objects.some(candidate => candidate.id === jumpStationId && isPhysicalStation(candidate))) {
    errors.jumpStationId = 'Choose an existing Physical Station.'
  }
  if (jumpStationId !== initial.jumpStationId) changes.jumpStationId = jumpStationId || null

  const settings = workspace.objectFieldSettings
  if (draft.atmosphere !== initial.atmosphere) {
    if (draft.atmosphere && !settings.atmosphereOptions.includes(draft.atmosphere)) {
      errors['native:atmosphere'] = 'Choose an available Atmosphere option.'
    } else if (draft.atmosphere && (object.family !== 'CelestialBody' || (subtype !== 'planet' && subtype !== 'moon'))) {
      errors['native:atmosphere'] = 'Atmosphere is only available for planets and moons.'
    } else {
      changes.atmosphere = draft.atmosphere || undefined
    }
  }
  if (draft.portClass !== initial.portClass) {
    if (draft.portClass && !settings.portClassOptions.includes(draft.portClass)) {
      errors['native:portClass'] = 'Choose an available Port class option.'
    } else if (draft.portClass && object.family !== 'Installation') {
      errors['native:portClass'] = 'Port class is only available for Physical Stations and other installations.'
    } else {
      changes.portClass = draft.portClass || undefined
    }
  }

  const customFieldValues = { ...(object.customFieldValues ?? {}) }
  let customFieldValuesChanged = false
  const definitionIds = new Set([
    ...Object.keys(initial.customFieldValues),
    ...Object.keys(draft.customFieldValues),
  ])
  for (const fieldId of definitionIds) {
    const currentValue = draft.customFieldValues[fieldId] ?? ''
    const originalValue = initial.customFieldValues[fieldId] ?? ''
    if (currentValue === originalValue) continue
    const definition = settings.customFields.find(field => field.id === fieldId)
    if (!definition) {
      errors[`custom:${fieldId}`] = 'This custom field definition is no longer available.'
      continue
    }
    const parsed = customValueForDraft(currentValue, definition)
    if (parsed && 'error' in parsed) {
      errors[`custom:${fieldId}`] = parsed.error
      continue
    }
    customFieldValuesChanged = true
    if (parsed === null) delete customFieldValues[fieldId]
    else customFieldValues[fieldId] = parsed.value
  }
  if (customFieldValuesChanged) changes.customFieldValues = customFieldValues

  if (Object.keys(errors).length) return { workspace: null, errors }
  try {
    return {
      workspace: updateWorkspaceObject(workspace, system.id, object.id, changes),
      errors,
    }
  } catch (error) {
    return {
      workspace: null,
      errors: { form: error instanceof Error ? error.message : String(error) },
    }
  }
}
