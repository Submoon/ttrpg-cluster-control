/** Durable map placement for the visual endpoint of an unresolved Jump Route. */
import type { LocalWorkspace, Point } from './workspace-model'
import { isPoint } from './workspace-validation'

/**
 * Saves one absolute scene-space endpoint without changing the route or its origin system.
 * @param workspace Current immutable workspace.
 * @param routeId Existing unresolved route whose visual endpoint is being moved.
 * @param position Finite SVG scene coordinate; it is deliberately not clamped to the initial canvas.
 * @returns Workspace with one route-keyed target layout entry.
 * @throws If the route no longer exists, is resolved, or the target is not finite.
 */
export function moveUnresolvedExitTarget(
  workspace: LocalWorkspace,
  routeId: string,
  position: Point,
): LocalWorkspace {
  if (!isPoint(position)) {
    throw new Error('Choose a finite position for the unresolved exit.')
  }
  if (!workspace.cluster.routes.some(route => route.id === routeId && route.toPointId === null)) {
    throw new Error('The unresolved Jump Route no longer exists.')
  }

  return {
    ...workspace,
    layout: {
      ...workspace.layout,
      unresolvedExitPositions: {
        ...(workspace.layout.unresolvedExitPositions ?? {}),
        [routeId]: { x: position.x, y: position.y },
      },
    },
  }
}
