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

export function objectMark(object: Pick<SystemObject, 'family' | 'subtype'>): string {
  const type = catalogueTypes.find(candidate =>
    candidate.value === object.subtype && candidate.family === object.family,
  )
  return type ? catalogueMarks[type.value] : catalogueMarks.other
}
