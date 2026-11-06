import type { PlayerObjectMarker } from '../domain/player-projection'
import { catalogueTypes, type ObjectFamily } from '../domain/workspace'
import { catalogueSubtypeLabel } from './catalogue-labels'
import { objectMark } from './catalogue-marks'

export interface PlayerObjectPresentation {
  glyph: string | null
  label: string
  typeLabel: string | null
  disclosureLabel: 'Unknown presence' | 'Known type' | 'Revealed'
}

/** Resolves only classification already permitted by the public marker's disclosure arm. */
export function playerObjectPresentation(object: PlayerObjectMarker): PlayerObjectPresentation {
  if (object.disclosure === 'unknown') {
    return {
      glyph: null,
      label: object.label,
      typeLabel: null,
      disclosureLabel: 'Unknown presence',
    }
  }

  const typeLabel = catalogueSubtypeLabel(object)
  return {
    glyph: objectMark(object),
    label: object.disclosure === 'known-type'
      ? `Unknown ${genericTypeLabel(object.family, object.subtype, typeLabel)}`
      : object.label,
    typeLabel,
    disclosureLabel: object.disclosure === 'known-type' ? 'Known type' : 'Revealed',
  }
}

function genericTypeLabel(family: ObjectFamily, subtype: string, typeLabel: string): string {
  const isCatalogueType = catalogueTypes.some(type => type.family === family && type.value === subtype)
  // Unrecognized labels can carry authored casing, including acronyms and custom type names.
  return isCatalogueType ? typeLabel.toLowerCase() : typeLabel
}
