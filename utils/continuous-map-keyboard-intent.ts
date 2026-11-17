export type ContinuousMapKeyboardTargetKind = 'map' | 'system' | 'object' | 'orbit' | 'other'
export type ContinuousMapKeyboardAction = 'add-target' | 'move-target' | 'inspect-object' | 'inspect-orbit' | 'activate-system'

interface ContinuousMapKeyboardIntentOptions {
  key: string
  targetKind: ContinuousMapKeyboardTargetKind
  addArmed: boolean
  chooserOpen: boolean
  moveTargeting: boolean
  clusterMoveTargeting: boolean
}

/** Keeps keyboard activation in the same placement and move-target precedence as map clicks. */
export function continuousMapKeyboardIntent(options: ContinuousMapKeyboardIntentOptions): ContinuousMapKeyboardAction | null {
  if (options.key !== 'Enter' && options.key !== ' ') return null
  if (options.chooserOpen) return null
  if (options.moveTargeting || options.clusterMoveTargeting) return 'move-target'
  if (options.addArmed) return 'add-target'
  if (options.targetKind === 'object') return 'inspect-object'
  if (options.targetKind === 'orbit') return 'inspect-orbit'
  if (options.targetKind === 'system') return 'activate-system'
  return null
}
