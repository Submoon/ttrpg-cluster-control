/**
 * One glyph catalogue shared by the Add Object palette, hierarchy, and SVG renderer.
 */
import {
  catalogueTypes,
  type CatalogueSubtype,
  type SystemObject,
} from '../domain/workspace'

export const catalogueMarks: Record<CatalogueSubtype, string> = {
  star: '✦',
  planet: '◉',
  moon: '☾',
  asteroid: '◆',
  belt: '⋯',
  station: '⌂',
  base: '▤',
  colony: '⚑',
  vessel: '△',
  derelict: '▽',
  'jump-point': '⊕',
  anomaly: '✧',
  nebula: '◌',
  hazard: '⚠',
  other: '◇',
}

/**
 * Resolves the shared catalogue glyph, falling back to the generic mark for unrecognized type pairs.
 * @param object Object family/subtype pair.
 * @returns Palette and map glyph for the catalogue type.
 */
export function objectMark(object: Pick<SystemObject, 'family' | 'subtype'>): string {
  const type = catalogueTypes.find(candidate =>
    candidate.value === object.subtype && candidate.family === object.family,
  )
  return type ? catalogueMarks[type.value] : catalogueMarks.other
}
