import { onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'
import { CONTINUOUS_MAP_DETAIL_MOTION_MS, continuousMapDetailMotionEase } from '../utils/continuous-map-projection'

/** Drives the name and vector paints from the same reveal, independently of camera updates. */
export function useContinuousMapDetailMotion(detailSystemIds: Readonly<ShallowRef<ReadonlySet<string>>>) {
  const progress = shallowRef<ReadonlyMap<string, number>>(new Map())
  const transitions = new Map<string, { from: number; to: number; startedAt: number }>()
  let frame: number | null = null
  let motionPreference: MediaQueryList | undefined

  function stopMotion(): void {
    if (frame !== null) window.cancelAnimationFrame(frame)
    frame = null
    transitions.clear()
    progress.value = new Map()
  }

  function tick(time: number): void {
    frame = null
    if (motionPreference?.matches) {
      stopMotion()
      return
    }
    const next = new Map<string, number>()
    for (const [id, { from, to, startedAt }] of transitions) {
      const duration = CONTINUOUS_MAP_DETAIL_MOTION_MS * Math.abs(to - from)
      const elapsed = Math.max(0, time - startedAt)
      if (elapsed >= duration) {
        transitions.delete(id)
        continue
      }
      const eased = continuousMapDetailMotionEase(elapsed / duration)
      next.set(id, from + (to - from) * eased)
    }
    progress.value = next
    if (transitions.size) frame = window.requestAnimationFrame(tick)
  }

  watch(detailSystemIds, (next, previous) => {
    if (typeof window === 'undefined') return
    motionPreference ??= window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches) {
      stopMotion()
      return
    }
    const values = new Map(progress.value)
    const startedAt = performance.now()
    for (const id of new Set([...next, ...previous])) {
      const to = Number(next.has(id))
      const start = Number(previous.has(id))
      if (to === start) continue
      const from = values.get(id) ?? start
      if (from === to) {
        transitions.delete(id)
        values.delete(id)
      } else {
        transitions.set(id, { from, to, startedAt })
        values.set(id, from)
      }
    }
    progress.value = values
    if (transitions.size && frame === null) frame = window.requestAnimationFrame(tick)
  }, { flush: 'sync' })

  onBeforeUnmount(stopMotion)

  function progressFor(id: string): number {
    return progress.value.get(id) ?? Number(detailSystemIds.value.has(id))
  }

  function isLeaving(id: string): boolean {
    return !detailSystemIds.value.has(id) && progressFor(id) > 0
  }

  return { progressFor, isLeaving }
}
