import type { PlayerObjectMarker } from '../domain/player-projection'
import { catalogueSubtypeLabel } from './catalogue-labels'
import { objectMark } from './catalogue-marks'

export interface PlayerObjectPresentation {
  glyph: string | null
  label: string
  typeLabel: string | null
}

/** Resolves only classification already permitted by the public marker's disclosure arm. */
export function playerObjectPresentation(object: PlayerObjectMarker): PlayerObjectPresentation {
  if (object.disclosure === 'unknown') {
    return { glyph: null, label: object.label, typeLabel: null }
  }

  return {
    glyph: objectMark(object),
    label: object.label,
    typeLabel: catalogueSubtypeLabel(object),
  }
}
