import { computed, onBeforeUnmount, onMounted, readonly, shallowRef, type ShallowRef } from 'vue'
import type { OrbitRadii, Point } from '../../domain/workspace'
import { normalizeOrbitRotation } from '../../domain/workspace-orbits'
import type { WorkspaceHistoryCoordinator, WorkspaceMutationRequest, WorkspaceMutationResult } from './workspace-mutations'

export type OrbitAdjustmentInputKind = 'keyboard' | 'wheel'
export type OrbitAdjustmentProperty = 'radii.horizontal' | 'radii.vertical' | 'radii.both' | 'rotation' | 'center'

export interface OrbitAdjustmentIdentity {
  workspaceId: string
  systemId: string
  orbitId: string
  property: OrbitAdjustmentProperty
  inputKind: OrbitAdjustmentInputKind
}

export type OrbitAdjustmentChange =
  | {
    kind: 'radii'
    axis: 'horizontal' | 'vertical' | 'both'
    operation: 'delta' | 'minimum'
    delta?: number
    minimum: number
  }
  | { kind: 'rotation'; delta: number }
  | { kind: 'center'; delta: Point }

/** Relative geometry input captured from one keyboard or wheel event. */
export interface OrbitAdjustmentIntent {
  workspaceId: string
  systemId: string
  orbitId: string
  inputKind: OrbitAdjustmentInputKind
  keyCode?: string
  change: OrbitAdjustmentChange
}

/** Relative map event before the page adds its current workspace identity. */
export type OrbitAdjustmentInput = Omit<OrbitAdjustmentIntent, 'workspaceId'>

/** Complete effective Orbit geometry; center is normalized system-map data. */
export interface OrbitAdjustmentGeometry {
  center: Point
  radii: OrbitRadii
  rotation: number
}

export interface OrbitAdjustmentPreview {
  identity: OrbitAdjustmentIdentity
  keyCode: string | null
  geometry: OrbitAdjustmentGeometry
}

export interface ContinuousAdjustmentClock {
  setTimeout(callback: () => void, milliseconds: number): unknown
  clearTimeout(handle: unknown): void
}

interface PendingOrbitAdjustment extends OrbitAdjustmentPreview {
  key: string
  groupId: number
  pressedKeys: Set<string>
}

type HistoryCommands = Pick<WorkspaceHistoryCoordinator, 'stageGroup' | 'completeGroup' | 'getStatus' | 'subscribe'>

interface ContinuousOrbitAdjustmentOptions {
  history: HistoryCommands
  setPreview?(preview: OrbitAdjustmentPreview | null): void
  onAutomaticCompletion?(result: WorkspaceMutationResult): void
  clock?: ContinuousAdjustmentClock
}

export type OrbitAdjustmentPreflightResult = WorkspaceMutationResult | { status: 'ready' }

const wheelQuietPeriodMs = 300
const browserClock: ContinuousAdjustmentClock = {
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}

function identityOf(intent: OrbitAdjustmentIntent): OrbitAdjustmentIdentity | null {
  const property = intent.change.kind === 'radii'
    ? intent.change.axis === 'both' ? 'radii.both' as const : `radii.${intent.change.axis}` as const
    : intent.change.kind
  if (!intent.workspaceId || !intent.systemId || !intent.orbitId
    || (intent.inputKind !== 'keyboard' && intent.inputKind !== 'wheel')
    || (intent.inputKind === 'keyboard' && !intent.keyCode)) return null
  return {
    workspaceId: intent.workspaceId,
    systemId: intent.systemId,
    orbitId: intent.orbitId,
    property,
    inputKind: intent.inputKind,
  }
}

function identityKey(identity: OrbitAdjustmentIdentity): string {
  return JSON.stringify([
    identity.workspaceId,
    identity.systemId,
    identity.orbitId,
    identity.property,
    identity.inputKind,
  ])
}

function sameIdentity(left: OrbitAdjustmentIdentity, right: OrbitAdjustmentIdentity): boolean {
  return identityKey(left) === identityKey(right)
}

function validGeometry(geometry: OrbitAdjustmentGeometry): boolean {
  return Number.isFinite(geometry.center.x)
    && Number.isFinite(geometry.center.y)
    && Number.isFinite(geometry.radii.horizontal)
    && Number.isFinite(geometry.radii.vertical)
    && Number.isFinite(geometry.rotation)
}

function focusMatchesAdjustment(active: Element | null, preview: OrbitAdjustmentPreview): boolean {
  if (!active) return false
  const { identity } = preview
  let mapRoot: Element | null = active
  while (mapRoot && mapRoot.getAttribute('data-system-id') !== identity.systemId) {
    mapRoot = mapRoot.parentElement
  }
  if (!mapRoot) return false
  let orbitControl: Element | null = active
  while (orbitControl && orbitControl.getAttribute('data-orbit-id') !== identity.orbitId) {
    if (orbitControl === mapRoot) {
      orbitControl = null
      break
    }
    orbitControl = orbitControl.parentElement
  }

  if (identity.inputKind === 'wheel') {
    return active === mapRoot || (orbitControl !== null && orbitControl !== mapRoot)
  }
  if (!orbitControl || orbitControl === mapRoot) return false
  if (identity.property.startsWith('radii.')) {
    if (orbitControl.classList.contains('orbit-hit-target')) return true
    if (!orbitControl.classList.contains('orbit-axis-handle')) return false
    return identity.property === 'radii.both'
      ? false
      : orbitControl.getAttribute('data-resize-axis') === identity.property.slice('radii.'.length)
  }
  if (identity.property === 'rotation') return orbitControl.classList.contains('orbit-rotation-handle')
  return orbitControl.classList.contains('orbit-center-handle')
}

/** Applies one relative input to the previous preview, preserving all other Orbit geometry. */
export function applyOrbitAdjustmentChange(
  current: OrbitAdjustmentGeometry,
  change: OrbitAdjustmentChange,
): OrbitAdjustmentGeometry {
  if (!validGeometry(current)) throw new Error('The current Orbit geometry is invalid.')
  if (change.kind === 'radii') {
    if (!Number.isFinite(change.minimum) || change.minimum <= 0
      || (change.operation === 'delta' && !Number.isFinite(change.delta))) {
      throw new Error('The Orbit radius adjustment is invalid.')
    }
    const axes = change.axis === 'both' ? ['horizontal', 'vertical'] as const : [change.axis] as const
    const radii = { ...current.radii }
    for (const axis of axes) {
      radii[axis] = change.operation === 'minimum'
        ? change.minimum
        : Math.max(change.minimum, current.radii[axis] + change.delta!)
    }
    return {
      ...current,
      radii,
    }
  }
  if (change.kind === 'rotation') {
    if (!Number.isFinite(change.delta)) throw new Error('The Orbit rotation adjustment is invalid.')
    return { ...current, rotation: normalizeOrbitRotation(current.rotation + change.delta) }
  }
  if (!Number.isFinite(change.delta.x) || !Number.isFinite(change.delta.y)) {
    throw new Error('The Orbit center adjustment is invalid.')
  }
  return {
    ...current,
    center: { x: current.center.x + change.delta.x, y: current.center.y + change.delta.y },
  }
}

/** Owns a responsive-session Orbit preview, timing, and its single history publication. */
export function createContinuousOrbitAdjustmentController({
  history,
  setPreview,
  onAutomaticCompletion,
  clock = browserClock,
}: ContinuousOrbitAdjustmentOptions) {
  const currentPreview = shallowRef<OrbitAdjustmentPreview | null>(null)
  const preview = readonly(currentPreview)
  let pending: PendingOrbitAdjustment | null = null
  let wheelTimer: unknown = null
  let wheelTimerEpoch = 0
  let completion: Promise<WorkspaceMutationResult> | null = null
  let completionGroup: PendingOrbitAdjustment | null = null
  let operationQueue: Promise<void> = Promise.resolve()
  let disposed = false
  let controllerEpoch = 0
  let completionFailureGeneration = 0
  let lastCompletionFailure: WorkspaceMutationResult | null = null
  let nextGroupId = 0

  const publishPreview = (value: OrbitAdjustmentPreview | null): void => {
    currentPreview.value = value
    setPreview?.(value)
  }

  const clearWheelTimer = (): void => {
    wheelTimerEpoch += 1
    if (wheelTimer !== null) {
      clock.clearTimeout(wheelTimer)
      wheelTimer = null
    }
  }

  const enqueue = <T>(operation: () => Promise<T> | T): Promise<T> => {
    const next = operationQueue.then(operation, operation)
    operationQueue = next.then(() => undefined, () => undefined)
    return next
  }

  const staleResult = (): WorkspaceMutationResult => ({
    status: 'rejected',
    reason: 'stale',
    message: 'The Orbit adjustment session changed before this input could be applied.',
  })

  const supersededByCompletionFailure = (submittedGeneration: number): WorkspaceMutationResult | null =>
    submittedGeneration === completionFailureGeneration ? null : lastCompletionFailure ?? staleResult()

  const completeGroupNow = (
    group: PendingOrbitAdjustment | null = pending,
    epoch = controllerEpoch,
  ): Promise<WorkspaceMutationResult> => {
    if (epoch !== controllerEpoch || disposed) return Promise.resolve(staleResult())
    if (!group) return Promise.resolve({ status: 'unchanged' })
    if (pending !== group) return Promise.resolve({ status: 'unchanged' })
    if (completion) return completionGroup === group ? completion : Promise.resolve({ status: 'unchanged' })
    clearWheelTimer()
    const request = history.completeGroup()
    const tracked = request.then(
      result => result,
      error => ({ status: 'rejected', reason: 'failed', message: error instanceof Error ? error.message : String(error) } as const),
    ).then((result) => {
      if (epoch === controllerEpoch && pending === group) {
        if (result.status === 'rejected') {
          completionFailureGeneration += 1
          lastCompletionFailure = result
        }
        if (!history.getStatus().hasPendingGroup) {
          pending = null
          publishPreview(null)
        }
      }
      if (completion === tracked) {
        completion = null
        completionGroup = null
      }
      return result
    })
    completion = tracked
    completionGroup = group
    return tracked
  }

  function observeDiscardedDurability(result: WorkspaceMutationResult): void {
    // Workspace save feedback is owned by the page's persistence layer. A completed group may be
    // replaced by the next staged property, so its acknowledgement is deliberately not returned.
    if (result.status === 'applied') void result.durable.catch(() => undefined)
  }

  function observeAutomaticDurability(result: WorkspaceMutationResult): WorkspaceMutationResult {
    // Automatic gesture completion has no awaiting caller to attach a rejection handler.
    observeDiscardedDurability(result)
    return result
  }

  function completeAutomatically(
    group: PendingOrbitAdjustment | null,
    epoch: number,
  ): Promise<WorkspaceMutationResult> {
    if (epoch !== controllerEpoch || pending !== group || !group) return Promise.resolve({ status: 'unchanged' })
    return completeGroupNow(group, epoch).then((result) => {
      observeAutomaticDurability(result)
      if (controllerEpoch === epoch) onAutomaticCompletion?.(result)
      return result
    })
  }

  function completeFromAutomaticBoundary(
    group: PendingOrbitAdjustment,
    epoch: number,
    submittedGeneration: number,
  ): void {
    void enqueue(() => supersededByCompletionFailure(submittedGeneration)
      ?? completeAutomatically(group, epoch))
  }

  const prepareForIntent = async (
    identity: OrbitAdjustmentIdentity,
    epoch: number,
    submittedGeneration: number,
  ): Promise<OrbitAdjustmentPreflightResult> => {
    const superseded = supersededByCompletionFailure(submittedGeneration)
    if (superseded) return superseded
    if (epoch !== controllerEpoch || disposed) return staleResult()
    if (completion) {
      if (pending && sameIdentity(pending.identity, identity)) {
        return { status: 'rejected', reason: 'busy', message: 'Wait for the current Orbit adjustment to finish.' }
      }
      const finishing = await completion
      observeDiscardedDurability(finishing)
      const supersededWhileWaiting = supersededByCompletionFailure(submittedGeneration)
      if (supersededWhileWaiting) return supersededWhileWaiting
      if (epoch !== controllerEpoch || disposed) return staleResult()
      if (finishing.status === 'rejected') return finishing
    }
    if (epoch !== controllerEpoch || disposed) return staleResult()
    if (!pending || sameIdentity(pending.identity, identity)) {
      return history.getStatus().isBusy
        ? { status: 'rejected', reason: 'busy', message: 'Wait for the current workspace operation to finish.' }
        : { status: 'ready' }
    }
    const completed = await completeGroupNow(pending, epoch)
    observeDiscardedDurability(completed)
    return completed
  }

  const updateNow = async (
    intent: OrbitAdjustmentIntent,
    readAppliedGeometry: () => OrbitAdjustmentGeometry,
    buildRequest: (geometry: OrbitAdjustmentGeometry) => WorkspaceMutationRequest,
    epoch: number,
    submittedGeneration: number,
  ): Promise<{ status: 'preview' } | WorkspaceMutationResult> => {
    const superseded = supersededByCompletionFailure(submittedGeneration)
    if (superseded) return superseded
    if (epoch !== controllerEpoch || disposed) return staleResult()
    const identity = identityOf(intent)
    if (!identity) return { status: 'rejected', reason: 'invalid', message: 'The Orbit adjustment intent is invalid.' }
    const prepared = await prepareForIntent(identity, epoch, submittedGeneration)
    const supersededAfterPreflight = supersededByCompletionFailure(submittedGeneration)
    if (supersededAfterPreflight) return supersededAfterPreflight
    if (epoch !== controllerEpoch || disposed) return staleResult()
    if (prepared.status === 'rejected') return prepared

    let base: OrbitAdjustmentGeometry
    try {
      base = pending && sameIdentity(pending.identity, identity) ? pending.geometry : readAppliedGeometry()
      if (!validGeometry(base)) throw new Error('The Orbit geometry is invalid.')
    } catch (error) {
      return { status: 'rejected', reason: 'invalid', message: error instanceof Error ? error.message : String(error) }
    }

    let geometry: OrbitAdjustmentGeometry
    let request: WorkspaceMutationRequest
    try {
      geometry = applyOrbitAdjustmentChange(base, intent.change)
      request = buildRequest(geometry)
    } catch (error) {
      return { status: 'rejected', reason: 'invalid', message: error instanceof Error ? error.message : String(error) }
    }

    const key = identityKey(identity)
    if (epoch !== controllerEpoch || disposed) return staleResult()
    const staged = await history.stageGroup(key, request)
    const supersededAfterStage = supersededByCompletionFailure(submittedGeneration)
    if (supersededAfterStage) return supersededAfterStage
    if (epoch !== controllerEpoch || disposed) return staleResult()
    if (staged.status !== 'preview') return staged
    const previous = pending && pending.key === key ? pending : null
    const pressedKeys = previous?.pressedKeys ?? new Set<string>()
    if (intent.inputKind === 'keyboard' && intent.keyCode) pressedKeys.add(intent.keyCode)
    const next: PendingOrbitAdjustment = {
      key,
      groupId: previous?.groupId ?? ++nextGroupId,
      identity,
      keyCode: intent.keyCode ?? null,
      pressedKeys,
      geometry,
    }
    pending = next
    publishPreview(next)

    if (intent.inputKind === 'wheel') {
      clearWheelTimer()
      const timerEpoch = wheelTimerEpoch
      const timerFailureGeneration = completionFailureGeneration
      wheelTimer = clock.setTimeout(() => {
        if (timerEpoch !== wheelTimerEpoch || epoch !== controllerEpoch || pending !== next) return
        wheelTimer = null
        completeFromAutomaticBoundary(next, epoch, timerFailureGeneration)
      }, wheelQuietPeriodMs)
    } else {
      clearWheelTimer()
    }
    return { status: 'preview' }
  }

  const update = (
    intent: OrbitAdjustmentIntent,
    readAppliedGeometry: () => OrbitAdjustmentGeometry,
    buildRequest: (geometry: OrbitAdjustmentGeometry) => WorkspaceMutationRequest,
  ): Promise<{ status: 'preview' } | WorkspaceMutationResult> => {
    const epoch = controllerEpoch
    const submittedGeneration = completionFailureGeneration
    return enqueue(() => updateNow(intent, readAppliedGeometry, buildRequest, epoch, submittedGeneration))
  }

  const beforeIntent = (identity: OrbitAdjustmentIdentity): Promise<OrbitAdjustmentPreflightResult> => {
    const epoch = controllerEpoch
    const submittedGeneration = completionFailureGeneration
    return enqueue(() => prepareForIntent(identity, epoch, submittedGeneration))
  }

  const completeGroup = (): Promise<WorkspaceMutationResult> => {
    const epoch = controllerEpoch
    const submittedGeneration = completionFailureGeneration
    return enqueue(() => {
      const superseded = supersededByCompletionFailure(submittedGeneration)
      if (superseded) return superseded
      if (epoch !== controllerEpoch || disposed) return staleResult()
      return completeGroupNow(pending, epoch)
    })
  }

  const releaseKey = (keyCode: string): Promise<WorkspaceMutationResult> => {
    const epoch = controllerEpoch
    const submittedGeneration = completionFailureGeneration
    return enqueue(() => {
      if (epoch !== controllerEpoch || disposed) return staleResult()
      const superseded = supersededByCompletionFailure(submittedGeneration)
      if (superseded) return superseded
      const group = pending
      if (!group) return { status: 'unchanged' }
      if (group.identity.inputKind !== 'keyboard' || !group.pressedKeys.has(keyCode)) {
        return { status: 'unchanged' }
      }
      group.pressedKeys.delete(keyCode)
      return group.pressedKeys.size === 0
        ? completeAutomatically(group, epoch)
        : { status: 'unchanged' }
    })
  }

  const focusLost = (expectedGroupId?: number): Promise<WorkspaceMutationResult> => {
    const epoch = controllerEpoch
    const group = pending
    const submittedGeneration = completionFailureGeneration
    if (expectedGroupId !== undefined && group?.groupId !== expectedGroupId) {
      return Promise.resolve({ status: 'unchanged' })
    }
    return enqueue(() => supersededByCompletionFailure(submittedGeneration)
      ?? completeAutomatically(group, epoch))
  }

  const reset = (): void => {
    controllerEpoch += 1
    clearWheelTimer()
    pending = null
    completion = null
    completionGroup = null
    completionFailureGeneration += 1
    lastCompletionFailure = null
    publishPreview(null)
  }

  const unsubscribe = history.subscribe(() => {
    if (pending && !completion && !history.getStatus().hasPendingGroup) reset()
  })

  const dispose = (): void => {
    disposed = true
    unsubscribe()
    reset()
  }

  return {
    preview,
    hasPendingPreview: computed(() => currentPreview.value !== null),
    update,
    beforeIntent,
    completeGroup,
    beforeOperation: completeGroup,
    getPendingGroupId: () => pending?.groupId ?? null,
    releaseKey,
    focusLost,
    reset,
    dispose,
  }
}

interface FocusBoundaryController {
  preview: Readonly<ShallowRef<OrbitAdjustmentPreview | null>>
  getPendingGroupId(): number | null
  focusLost(expectedGroupId?: number): Promise<WorkspaceMutationResult>
}

/** Defers focus-loss completion until renderer focus restoration has had a frame to run. */
export function createOrbitAdjustmentFocusBoundaryScheduler(
  controller: FocusBoundaryController,
  readActiveElement: () => Element | null,
  requestFrame: (callback: FrameRequestCallback) => number,
  cancelFrame: (frame: number) => void,
) {
  let focusCheckFrame: number | null = null
  const schedule = (): void => {
    const groupId = controller.getPendingGroupId()
    if (groupId === null) return
    if (focusCheckFrame !== null) cancelFrame(focusCheckFrame)
    focusCheckFrame = requestFrame(() => {
      focusCheckFrame = null
      const activePreview = controller.preview.value
      if (activePreview && controller.getPendingGroupId() === groupId
        && !focusMatchesAdjustment(readActiveElement(), activePreview)) {
        void controller.focusLost(groupId)
      }
    })
  }
  const dispose = (): void => {
    if (focusCheckFrame !== null) cancelFrame(focusCheckFrame)
    focusCheckFrame = null
  }
  return { schedule, dispose }
}

/** Adds browser focus/key-release ownership to an editor-page adjustment controller. */
export function useContinuousOrbitAdjustments(options: ContinuousOrbitAdjustmentOptions) {
  const controller = createContinuousOrbitAdjustmentController(options)
  const focusBoundary = createOrbitAdjustmentFocusBoundaryScheduler(
    controller,
    () => document.activeElement,
    callback => window.requestAnimationFrame(callback),
    frame => window.cancelAnimationFrame(frame),
  )
  const onKeyUp = (event: KeyboardEvent): void => { void controller.releaseKey(event.code) }
  const onWindowBlur = (): void => { void controller.focusLost() }
  const scheduleFocusBoundaryCheck = (): void => {
    if (typeof window.requestAnimationFrame === 'function') focusBoundary.schedule()
  }
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void controller.focusLost()
  }

  onMounted(() => {
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('focusin', scheduleFocusBoundaryCheck)
    document.addEventListener('focusout', scheduleFocusBoundaryCheck)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onWindowBlur)
    document.removeEventListener('focusin', scheduleFocusBoundaryCheck)
    document.removeEventListener('focusout', scheduleFocusBoundaryCheck)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    focusBoundary.dispose()
    controller.dispose()
  })

  return controller
}
