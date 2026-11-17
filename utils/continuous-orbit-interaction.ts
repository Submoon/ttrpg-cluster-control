import type { OrbitAdjustmentInput } from '../composables/editor-workflows/continuous-orbit-adjustments'
import type { InspectedMapTarget } from '../stores/editor-ui'

export type ContinuousOrbitControl =
  | { kind: 'ring' }
  | { kind: 'resize'; axis: 'global' | 'horizontal' | 'vertical' }
  | { kind: 'rotation' }
  | { kind: 'center' }

export function continuousOrbitKeyboardChange(
  control: ContinuousOrbitControl,
  key: string,
  step: number,
  minimum: number,
): OrbitAdjustmentInput['change'] | null {
  if (control.kind === 'center') return null
  if (control.kind === 'rotation') {
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
    return { kind: 'rotation', delta: key === 'ArrowRight' ? step : -step }
  }

  const axis = control.kind === 'resize' ? control.axis : 'global'
  if (axis !== 'global') {
    if (key === 'Home') return { kind: 'radii', axis, operation: 'minimum', minimum }
    if (key === 'End') return { kind: 'radii', axis, operation: 'delta', delta: 400, minimum }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return null
    const delta = key === 'ArrowLeft' || key === 'ArrowDown' ? -step : step
    return { kind: 'radii', axis, operation: 'delta', delta, minimum }
  }

  if (key === 'ArrowLeft') return { kind: 'radii', axis: 'horizontal', operation: 'delta', delta: -step, minimum }
  if (key === 'ArrowRight') return { kind: 'radii', axis: 'horizontal', operation: 'delta', delta: step, minimum }
  if (key === 'ArrowDown') return { kind: 'radii', axis: 'vertical', operation: 'delta', delta: -step, minimum }
  if (key === 'ArrowUp') return { kind: 'radii', axis: 'vertical', operation: 'delta', delta: step, minimum }
  if (key === 'Home') return { kind: 'radii', axis: 'both', operation: 'minimum', minimum }
  if (key === 'End') return { kind: 'radii', axis: 'both', operation: 'delta', delta: 400, minimum }
  return null
}

export interface ExpectedContinuousOrbitHandoff {
  workspaceId: string
  clusterId: string
  systemId: string
  orbitId: string
  startingSelectedSystemId: string | null
  startingInspectedTarget: InspectedMapTarget | null
}

export interface ContinuousOrbitHandoffContext {
  continuousMap: boolean
  activeView: string
  mapMode: string
  workspaceId: string | undefined
  clusterId: string | undefined
  selectedSystemId: string | null
  inspectedTarget: InspectedMapTarget | null
}

function sameInspectedTarget(left: InspectedMapTarget | null, right: InspectedMapTarget | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Recognizes only the target/owner intermediate states emitted by one guarded retarget. */
export function isExpectedContinuousOrbitHandoff(
  expected: ExpectedContinuousOrbitHandoff,
  context: ContinuousOrbitHandoffContext,
): boolean {
  if (!context.continuousMap || context.activeView !== 'cluster' || context.mapMode !== 'move'
    || context.workspaceId !== expected.workspaceId || context.clusterId !== expected.clusterId) return false

  const expectedTarget = context.inspectedTarget?.kind === 'orbit'
    && context.inspectedTarget.systemId === expected.systemId
    && context.inspectedTarget.orbitId === expected.orbitId
  if (expectedTarget && (context.selectedSystemId === expected.startingSelectedSystemId
    || context.selectedSystemId === expected.systemId)) return true

  return sameInspectedTarget(context.inspectedTarget, expected.startingInspectedTarget)
    && context.selectedSystemId === expected.systemId
}
