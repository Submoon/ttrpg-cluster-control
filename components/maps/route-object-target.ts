/** Reads the separate route-object mark identity without treating it as a Zone object or a route stroke. */
export function routeObjectTargetAt(target: EventTarget | null): { routeId: string; objectId: string } | null {
  const mark = target instanceof Element
    ? target.closest('[data-owner-route-id][data-route-object-id]')
    : null
  const routeId = mark?.getAttribute('data-owner-route-id')
  const objectId = mark?.getAttribute('data-route-object-id')
  return routeId && objectId ? { routeId, objectId } : null
}
