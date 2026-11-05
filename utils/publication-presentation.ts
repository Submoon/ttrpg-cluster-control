import type { PublicationMode } from '../domain/workspace'

export interface PublicationPresentation {
  mode: PublicationMode
  label: string
  icon: string
  /** Static Lucide SVG nodes used by administrative map decorations. */
  svgBody: string
}

const presentations: Record<PublicationMode, PublicationPresentation> = {
  hidden: {
    mode: 'hidden',
    label: 'Hidden',
    icon: 'i-lucide-eye-off',
    svgBody: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20"/></g>',
  },
  unknown: {
    mode: 'unknown',
    label: 'Unknown presence',
    icon: 'i-lucide-circle-help',
    svgBody: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></g>',
  },
  'known-type': {
    mode: 'known-type',
    label: 'Known type',
    icon: 'i-lucide-shapes',
    svgBody: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect width="7" height="7" x="3" y="14" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/></g>',
  },
  revealed: {
    mode: 'revealed',
    label: 'Revealed',
    icon: 'i-lucide-eye',
    svgBody: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></g>',
  },
}

export const publicationModes: readonly PublicationMode[] = [
  'hidden', 'unknown', 'known-type', 'revealed',
]

export function publicationPresentation(mode: PublicationMode): PublicationPresentation {
  return presentations[mode]
}

export function publicationStatus(
  mode: PublicationMode,
  parentPublication?: PublicationMode,
  visibilityContext: 'configured' | 'draft' = 'configured',
  presentationContext: 'object' | 'system' = 'object',
): { description: string; parentBlocked: boolean } {
  const detail: Record<PublicationMode, string> = {
    hidden: presentationContext === 'system'
      ? 'Players do not see this system.'
      : 'Players do not see this location. Required orbital hosts may appear as Unknown in the player view.',
    unknown: 'Players see an unknown presence without its name or type.',
    'known-type': 'Players see its type without its name.',
    revealed: 'Players see its name and type.',
  }
  const parentBlocked = mode !== 'hidden' && parentPublication !== undefined && parentPublication !== 'revealed'
  const prefix = visibilityContext === 'draft' ? 'Draft visibility' : 'Configured visibility'
  return {
    description: `${prefix}: ${publicationPresentation(mode).label}. ${detail[mode]}${parentBlocked
      ? ' System map unavailable to players until this system is Revealed.'
      : ''}`,
    parentBlocked,
  }
}
