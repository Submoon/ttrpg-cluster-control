/** Pointer intent shared by the canvas pan owner and the continuous map renderer. */
export function canStartSelectedObjectDrag(
  event: Pick<PointerEvent, 'button' | 'isPrimary' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  objectId: string | null,
  selectedObjectIds: readonly string[],
  enabled: boolean,
): objectId is string {
  return enabled
    && event.button === 0
    && event.isPrimary
    && !event.shiftKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && objectId !== null
    && selectedObjectIds.includes(objectId)
}
