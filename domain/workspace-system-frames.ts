/** Immutable operations for the Warden-authored preferred frame of a Cluster system. */
import type { LocalWorkspace, SystemFrameInsets } from './workspace-model'
import { isRecord } from './workspace-validation'

/** Saves one system's preferred frame distances without changing its anchor or other layout. */
export function setWorkspaceSystemFrame(
  workspace: LocalWorkspace,
  systemId: string,
  insets: SystemFrameInsets,
): LocalWorkspace {
  if (!workspace.cluster.systems.some(system => system.id === systemId)) {
    throw new Error('The selected star system no longer exists.')
  }
  if (!isSystemFrameInsets(insets)) {
    throw new Error('A system frame needs finite, nonnegative insets.')
  }

  return {
    ...workspace,
    layout: {
      ...workspace.layout,
      systemFrames: {
        ...workspace.layout.systemFrames,
        [systemId]: { ...insets },
      },
    },
  }
}

/** Reads only an authored own entry; arbitrary system IDs can match Object prototype properties. */
export function workspaceSystemFrame(
  workspace: { readonly layout: { readonly systemFrames?: Readonly<Record<string, SystemFrameInsets>> } },
  systemId: string,
): SystemFrameInsets | undefined {
  const frames = workspace.layout.systemFrames
  return frames && Object.hasOwn(frames, systemId) ? frames[systemId] : undefined
}

/** Checks the finite, nonnegative dimensions shared by persisted and projected frames. */
export function isSystemFrameInsets(value: unknown): value is SystemFrameInsets {
  if (!isRecord(value)) return false
  const insets = value
  const left = insets.left
  const top = insets.top
  const right = insets.right
  const bottom = insets.bottom
  if (typeof left !== 'number' || !Number.isFinite(left) || left < 0
    || typeof top !== 'number' || !Number.isFinite(top) || top < 0
    || typeof right !== 'number' || !Number.isFinite(right) || right < 0
    || typeof bottom !== 'number' || !Number.isFinite(bottom) || bottom < 0) return false

  const width = left + right
  const height = top + bottom
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
}

/** Type guard for optional frame records keyed by system identity. */
export function isSystemFrameInsetsRecord(value: unknown): value is Record<string, SystemFrameInsets> {
  if (!isRecord(value)) return false
  return Object.values(value).every(isSystemFrameInsets)
}
