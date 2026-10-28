/** Owns persistent Add intent and one transient, single-use completion token. */
import { computed, ref, type Ref } from 'vue'
import {
  createOrbit,
  createSystemObject,
  captureEffectiveObjectAngles,
  defaultOrbitRadius,
  defaultObjectOrbitAngle,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
  type MapDeletionPlan,
  type LocalWorkspace,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
} from '../../domain/workspace'
import { validName } from '../../domain/workspace-validation'
import {
  objectPositions,
  orbitCenter,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from '../../utils/system-map-geometry'
import type {
  EntityCommand,
  SystemCreationCandidate,
  SystemCreationSession,
  SystemCreationTarget,
  SystemCreationType,
  SystemMapHandle,
} from './types'
import { useEditorUiStore } from '../../stores/editor-ui'

type CreationInputKey = keyof SystemCreationSession['inputs']
type ApplyWorkspace = (workspace: LocalWorkspace) => { durable: Promise<void> }

interface SystemCreationWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  systemMapRef: Readonly<Ref<SystemMapHandle | null>>
  applyWorkspace: ApplyWorkspace
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  resolveObjectCreationTransition: () => Promise<boolean>
  onObjectCreated: (objectId: string) => Promise<void>
}

function emptyInputs(): SystemCreationSession['inputs'] {
  return {
    x: '',
    y: '',
    orbitId: '',
    hostId: '',
    horizontalRadius: '',
    verticalRadius: '',
    rotation: '',
    otherType: '',
  }
}

function sameCreationType(left: SystemCreationType, right: SystemCreationType): boolean {
  return left.kind === right.kind && (left.kind !== 'object'
    || right.kind === 'object' && left.subtype === right.subtype)
}

function parseFinite(value: string): number | undefined {
  if (!value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/**
 * Builds the page-owned Add lifecycle around the synchronous memory-application boundary.
 * @param options Latest workspace, current system, map resolver, durable owner, and Inspector authority.
 * @returns Persistent type/input state and direct Add commands for map and form targets.
 */
export function useSystemCreationWorkflows({
  workspace,
  systemMapRef,
  applyWorkspace,
  isEntityCommandBlocked,
  resolveObjectCreationTransition,
  onObjectCreated,
}: SystemCreationWorkflowOptions) {
  const store = useEditorUiStore()
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const creationSession = ref<SystemCreationSession | null>(null)
  let sessionSequence = 0
  let previewSequence = 0
  let confirmingPreviewId: number | null = null

  function setError(key: string, message: string): void {
    if (!creationSession.value) return
    creationSession.value.errors = { ...creationSession.value.errors, [key]: message }
  }

  function setTargetError(target: SystemCreationTarget, message: string): void {
    setError('target', message)
    if (target.kind === 'host') setError('hostId', message)
    else if (target.kind === 'orbit') setError('orbitId', message)
  }

  function clearError(key: string): void {
    if (!creationSession.value?.errors[key]) return
    const errors = { ...creationSession.value.errors }
    delete errors[key]
    creationSession.value.errors = errors
  }

  function clearErrors(): void {
    if (creationSession.value) creationSession.value.errors = {}
  }

  function invalidatePreview(session: SystemCreationSession): void {
    session.preview = null
    session.candidates = []
    session.notice = ''
  }

  function sessionMatchesCurrentContext(session: SystemCreationSession): boolean {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    return !!currentWorkspace
      && currentWorkspace.cluster.id === session.clusterId
      && store.activeView === 'system'
      && !!system
      && system.id === session.systemId
      && currentWorkspace.cluster.systems.some(candidate => candidate.id === session.systemId)
  }

  function chooseCreationType(type: SystemCreationType): void {
    if (confirmingPreviewId !== null) return
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system
      || !currentWorkspace.cluster.systems.some(candidate => candidate.id === system.id)) return

    if (creationSession.value && sameCreationType(creationSession.value.type, type)
      && sessionMatchesCurrentContext(creationSession.value)) {
      invalidatePreview(creationSession.value)
      creationSession.value.errors = {}
      return
    }

    sessionSequence += 1
    const session: SystemCreationSession = {
      id: sessionSequence,
      clusterId: currentWorkspace.cluster.id,
      systemId: system.id,
      type,
      candidates: [],
      preview: null,
      inputs: emptyInputs(),
      errors: {},
      notice: '',
    }
    creationSession.value = session
    if (type.kind === 'orbit') fillDefaultOrbitGeometry(session, system, null)
  }

  function nextOrbitOrder(system: StarSystem, hostId: string | null): number {
    return system.orbits
      .filter(orbit => orbit.hostId === hostId)
      .reduce((highest, orbit) => Math.max(highest, orbit.order), 0) + 1
  }

  function prospectiveOrbit(system: StarSystem, hostId: string | null): Orbit {
    const order = nextOrbitOrder(system, hostId)
    // Radius helpers read only hostId/order; this is a non-persisted geometry probe, not an entity ID.
    return (hostId === null
      ? { hostId: null, center: { x: 0, y: 0 }, order }
      : { hostId, order }) as Orbit
  }

  function fillDefaultOrbitGeometry(session: SystemCreationSession, system: StarSystem, hostId: string | null): void {
    const radius = defaultOrbitRadius(system, prospectiveOrbit(system, hostId))
    if (!session.inputs.horizontalRadius.trim()) session.inputs.horizontalRadius = String(radius)
    if (!session.inputs.verticalRadius.trim()) session.inputs.verticalRadius = String(radius)
    if (!session.inputs.rotation.trim()) session.inputs.rotation = '0'
  }

  function updateCreationInput(key: CreationInputKey, value: string): void {
    const session = creationSession.value
    if (!session) return
    const previous = session.inputs[key]
    session.inputs[key] = String(value ?? '')
    invalidatePreview(session)
    clearError(key)
    clearError('target')

    if (session.type.kind === 'orbit' && key === 'hostId' && previous !== value) {
      const system = currentSystemForSession(session)
      if (system) {
        const previousHostId = previous || null
        const nextHostId = value || null
        const previousDefault = defaultOrbitRadius(system, prospectiveOrbit(system, previousHostId))
        const nextDefault = defaultOrbitRadius(system, prospectiveOrbit(system, nextHostId))
        if (Number(session.inputs.horizontalRadius) === previousDefault) {
          session.inputs.horizontalRadius = String(nextDefault)
        }
        if (Number(session.inputs.verticalRadius) === previousDefault) {
          session.inputs.verticalRadius = String(nextDefault)
        }
        fillDefaultOrbitGeometry(session, system, nextHostId)
      }
    }
  }

  function currentSystemForSession(session: SystemCreationSession): StarSystem | undefined {
    const currentWorkspace = workspace.value
    if (!sessionMatchesCurrentContext(session) || !currentWorkspace) return undefined
    return currentWorkspace.cluster.systems.find(system => system.id === session.systemId)
  }

  function geometryForCurrentWorkspace(): SystemMapGeometry {
    const layout = workspace.value?.layout
    return {
      objectAngles: layout?.objectAngles ?? {},
      orbitRadii: layout?.orbitRadii ?? {},
      orbitRotations: layout?.orbitRotations ?? {},
    }
  }

  function scenePointForTarget(system: StarSystem, target: SystemCreationTarget): Point | undefined {
    const geometry = geometryForCurrentWorkspace()
    if (target.kind === 'free') {
      return { x: 64 + target.point.x * 832, y: 72 + target.point.y * 416 }
    }
    if (target.kind !== 'orbit') return undefined
    const orbit = system.orbits.find(candidate => candidate.id === target.orbitId)
    if (!orbit) return undefined
    const positions = objectPositions(system, geometry)
    return orbitPointAtAngle(
      orbitCenter(orbit, positions),
      orbitRadii(system, orbit, geometry),
      target.angle,
      orbitRotation(orbit, geometry),
    )
  }

  function validateFreeGeometry(
    session: SystemCreationSession,
    system: StarSystem,
    target: Extract<SystemCreationTarget, { kind: 'free' }>,
  ): string | null {
    const map = systemMapRef.value
    if (!map) return null
    const scenePoint = scenePointForTarget(system, target)
    if (!scenePoint) return 'The selected map position is no longer available.'
    const candidate = map.getCreationCandidates(scenePoint, session.type)
      .find(item => item.target.kind === 'free')
    if (!candidate) return 'Choose a clear map position or select one of the named targets.'
    return candidate.error
  }

  function validateTarget(
    session: SystemCreationSession,
    system: StarSystem,
    target: SystemCreationTarget,
  ): string | null {
    try {
      // Resolve current geometry before accepting a relationship; malformed nested host chains remain invalid.
      objectPositions(system, geometryForCurrentWorkspace())
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }

    if (session.type.kind === 'object') {
      if (target.kind === 'free') {
        if (!Number.isFinite(target.point.x) || !Number.isFinite(target.point.y)) {
          return 'Enter finite X and Y coordinates.'
        }
        const geometryError = validateFreeGeometry(session, system, target)
        if (geometryError) return geometryError
        if (isEntityCommandBlocked({ kind: 'object-create', orbitId: null })) {
          return 'Resolve the Inspector draft before creating an object at this location.'
        }
        return null
      }
      if (target.kind === 'orbit') {
        if (!system.orbits.some(orbit => orbit.id === target.orbitId)) return 'Choose an existing Orbit.'
        if (!Number.isFinite(target.angle)) return 'Enter a finite Orbit position.'
        const map = systemMapRef.value
        const scenePoint = scenePointForTarget(system, target)
        if (map && scenePoint && !map.getCreationCandidates(scenePoint, session.type).some(candidate =>
          candidate.target.kind === 'orbit' && candidate.target.orbitId === target.orbitId,
        )) {
          return 'This Orbit placement changed. Choose the Orbit again before adding.'
        }
        if (isEntityCommandBlocked({ kind: 'object-create', orbitId: target.orbitId })) {
          return 'Resolve the Inspector draft before creating an object in this Orbit.'
        }
        return null
      }
      return 'Choose a free location or an existing Orbit for this object.'
    }

    if (target.kind === 'free') {
      if (!Number.isFinite(target.point.x) || !Number.isFinite(target.point.y)) {
        return 'Click a free map location to place the Orbit center.'
      }
      const geometryError = validateFreeGeometry(session, system, target)
      if (geometryError) return geometryError
      if (isEntityCommandBlocked({ kind: 'orbit-create', hostId: null })) {
        return 'Resolve the Inspector draft before creating an Orbit at this center.'
      }
      return null
    }
    if (target.kind !== 'host') return 'Choose an object host or unoccupied center for this Orbit.'
    if (!system.objects.some(object => object.id === target.objectId)) return 'Choose an existing object host.'
    if (isEntityCommandBlocked({ kind: 'orbit-create', hostId: target.objectId })) {
      return 'Resolve the Inspector draft before adding another Orbit to this host.'
    }
    return null
  }

  function orbitGeometryForPreview(
    session: SystemCreationSession,
    system: StarSystem,
    target: SystemCreationTarget,
    fillDefaults: boolean,
  ): { radii: OrbitRadii; rotation: number } | undefined {
    if (session.type.kind === 'orbit') {
      const hostId = target.kind === 'host' ? target.objectId : null
      if (fillDefaults) fillDefaultOrbitGeometry(session, system, hostId)
      const horizontal = parseFinite(session.inputs.horizontalRadius)
      const vertical = parseFinite(session.inputs.verticalRadius)
      const rotationValue = parseFinite(session.inputs.rotation)
      if (horizontal === undefined) setError('horizontalRadius', 'Horizontal radius must be a finite number.')
      if (vertical === undefined) setError('verticalRadius', 'Vertical radius must be a finite number.')
      if (rotationValue === undefined) setError('rotation', 'Rotation must be a finite number.')
      if (horizontal === undefined || vertical === undefined || rotationValue === undefined) return undefined

      const minimum = minimumOrbitRadius(system, prospectiveOrbit(system, hostId))
      const radii = {
        horizontal: Math.max(minimum, Math.round(horizontal)),
        vertical: Math.max(minimum, Math.round(vertical)),
      }
      const rotation = normalizeOrbitRotation(rotationValue)
      const corrections: string[] = []
      if (radii.horizontal !== horizontal) {
        session.inputs.horizontalRadius = String(radii.horizontal)
        corrections.push(`Horizontal radius set to ${radii.horizontal}`)
      }
      if (radii.vertical !== vertical) {
        session.inputs.verticalRadius = String(radii.vertical)
        corrections.push(`Vertical radius set to ${radii.vertical}`)
      }
      if (rotation !== rotationValue) session.inputs.rotation = String(rotation)
      if (corrections.length) {
        session.notice = `${corrections.join(' and ')} scene units to meet the ${minimum}-unit host minimum.`
      }
      return { radii, rotation }
    }

    // Object-on-Orbit targets read the current renderer geometry directly, so a concurrent
    // radius or rotation edit cannot leave a stale ellipse on screen.
    return undefined
  }

  function prepareCreation(target: SystemCreationTarget, fromMap = false): boolean {
    const session = creationSession.value
    if (!session) return false
    invalidatePreview(session)
    clearErrors()
    const system = currentSystemForSession(session)
    if (!system) {
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }

    const error = validateTarget(session, system, target)
    if (error) {
      setTargetError(target, error)
      return false
    }

    const geometry = orbitGeometryForPreview(session, system, target, fromMap)
    if (session.type.kind === 'orbit' && !geometry) return false

    if (target.kind === 'free') {
      if (session.type.kind === 'object') {
        session.inputs.x = String(target.point.x)
        session.inputs.y = String(target.point.y)
        session.inputs.orbitId = ''
        session.inputs.hostId = ''
      }
    } else if (target.kind === 'orbit') {
      session.inputs.orbitId = target.orbitId
    } else if (session.type.kind === 'orbit') {
      session.inputs.hostId = target.objectId
    }
    session.candidates = []
    session.preview = {
      id: ++previewSequence,
      target,
      ...(geometry ? { radii: geometry.radii, rotation: geometry.rotation } : {}),
    }
    return true
  }

  async function completeCreation(target: SystemCreationTarget, fromMap = false): Promise<boolean> {
    if (!prepareCreation(target, fromMap)) return false
    const previewId = creationSession.value?.preview?.id
    return previewId !== undefined && await confirmCreation(previewId)
  }

  async function addCreationFromInputs(): Promise<boolean> {
    if (confirmingPreviewId !== null) return false
    const session = creationSession.value
    if (!session) return false
    invalidatePreview(session)
    clearErrors()
    if (session.type.kind === 'object') {
      if (session.type.subtype === 'other') {
        try {
          validName(session.inputs.otherType, 'Object type')
        } catch (error) {
          setError('otherType', error instanceof Error ? error.message : String(error))
          return false
        }
      }
      let target: SystemCreationTarget
      if (session.inputs.orbitId && session.inputs.orbitId !== '__free__') {
        const system = currentSystemForSession(session)
        const orbit = system?.orbits.find(candidate => candidate.id === session.inputs.orbitId)
        if (!system || !orbit) {
          setError('orbitId', 'Choose an available Orbit for this object.')
          return false
        }
        const siblingCount = system.objects.filter(object =>
          object.placement.kind === 'orbit' && object.placement.orbitId === orbit.id,
        ).length
        target = {
          kind: 'orbit',
          orbitId: orbit.id,
          angle: defaultObjectOrbitAngle(siblingCount, siblingCount + 1),
        }
      } else {
        setError('target', 'Click a free location on the map to add this object.')
        return false
      }
      return completeCreation(target)
    }

    const hostId = session.inputs.hostId && session.inputs.hostId !== '__center__'
      ? session.inputs.hostId
      : ''
    let target: SystemCreationTarget
    if (hostId) {
      target = { kind: 'host', objectId: hostId }
    } else {
      setError('target', 'Click a free map location to place this Orbit center.')
      return false
    }
    return completeCreation(target)
  }

  async function offerCreationCandidates(candidates: SystemCreationCandidate[]): Promise<boolean> {
    if (confirmingPreviewId !== null) return false
    const session = creationSession.value
    if (!session) return false
    invalidatePreview(session)
    clearErrors()
    if (!sessionMatchesCurrentContext(session)) {
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }
    const system = currentSystemForSession(session)
    if (!system) {
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }

    const currentCandidates = candidates.map((candidate) => {
      const validationError = validateTarget(session, system, candidate.target)
      return { ...candidate, error: candidate.error ?? validationError }
    })
    const selectedOrbitId = session.type.kind === 'object'
      && session.inputs.orbitId !== '__free__'
      ? session.inputs.orbitId
      : ''
    const selectedOrbitCandidates = selectedOrbitId
      ? currentCandidates.filter(candidate => candidate.target.kind === 'orbit'
        && candidate.target.orbitId === selectedOrbitId)
      : []
    const candidatesToResolve = selectedOrbitId
      ? selectedOrbitCandidates.length
        ? selectedOrbitCandidates
        : currentCandidates.filter(candidate => candidate.target.kind === 'free')
      : currentCandidates
    if (selectedOrbitId && !candidatesToResolve.length) {
      setTargetError({ kind: 'orbit', orbitId: selectedOrbitId, angle: 0 },
        'Click the selected Orbit to add this object at that position.')
      session.notice = 'The selected Orbit is not at this map position.'
      return false
    }
    const validCandidates = candidatesToResolve.filter(candidate => !candidate.error)
    if (validCandidates.length === 1) {
      const candidate = validCandidates[0]
      return candidate ? await completeCreation(candidate.target, true) : false
    }

    session.candidates = candidatesToResolve
    if (validCandidates.length > 1) {
      session.notice = 'Choose a named placement target.'
      return false
    }

    session.notice = candidates.length
      ? 'No valid placement target is available here.'
      : 'No placement target is available here.'
    const invalidCandidate = candidatesToResolve.find(candidate => candidate.error)
    if (invalidCandidate?.error) setTargetError(invalidCandidate.target, invalidCandidate.error)
    return false
  }

  async function handleCreationDrop(type: SystemCreationType, candidates: SystemCreationCandidate[]): Promise<boolean> {
    let session = creationSession.value
    if (!session || !sameCreationType(session.type, type) || !sessionMatchesCurrentContext(session)) {
      chooseCreationType(type)
      session = creationSession.value
    }
    if (!session) return false
    return await offerCreationCandidates(candidates)
  }

  function cancelCreationPreview(): void {
    const session = creationSession.value
    if (!session) return
    session.preview = null
    session.candidates = []
    session.notice = session.type.kind === 'object'
      ? 'Choose another free map location, or use Placement to add this object to an Orbit.'
      : 'Choose another map target or adjust the Orbit geometry in Placement.'
  }

  async function confirmCreation(previewId: number): Promise<boolean> {
    if (confirmingPreviewId !== null) return false
    const session = creationSession.value
    if (!session?.preview || session.preview.id !== previewId) return false
    let currentWorkspace = workspace.value
    let system = currentSystemForSession(session)
    if (!currentWorkspace || !system) {
      invalidatePreview(session)
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }

    let preview = session.preview
    let target = preview.target
    const error = validateTarget(session, system, target)
    if (error) {
      invalidatePreview(session)
      setTargetError(target, error)
      return false
    }

    let otherTypeLabel: string | null = null
    if (session.type.kind === 'object' && session.type.subtype === 'other') {
      try {
        otherTypeLabel = validName(session.inputs.otherType, 'Object type')
      } catch (error) {
        invalidatePreview(session)
        setError('otherType', error instanceof Error ? error.message : String(error))
        return false
      }
    }

    confirmingPreviewId = previewId
    try {
      if (session.type.kind === 'object') {
        // Replacing the selected object's edit session is a guarded navigation. Resolve it
        // before publishing the new object so Stay leaves Add, selection, and focus untouched.
        if (!await resolveObjectCreationTransition()) return false
        if (creationSession.value !== session || session.preview?.id !== previewId
          || !sessionMatchesCurrentContext(session)) return false

        currentWorkspace = workspace.value
        system = currentSystemForSession(session)
        if (!currentWorkspace || !system) {
          invalidatePreview(session)
          setError('target', 'The star system for this Add session is no longer available.')
          return false
        }
        const latestPreview = session.preview
        if (!latestPreview || latestPreview.id !== previewId) return false
        preview = latestPreview
        target = preview.target
        const latestError = validateTarget(session, system, target)
        if (latestError) {
          invalidatePreview(session)
          setTargetError(target, latestError)
          return false
        }
      }

      const correctionNotice = session.notice.trim()
      let nextWorkspace: LocalWorkspace
      let successNotice: string
      let createdObjectId: string | null = null
      if (session.type.kind === 'object') {
        const baseObject = createSystemObject(system, session.type.subtype)
        const object = session.type.subtype === 'other'
          ? { ...baseObject, subtype: otherTypeLabel! }
          : baseObject
        let objectAngles: Record<string, number> | undefined
        let placement: typeof object.placement
        if (target.kind === 'free') {
          placement = { kind: 'system', x: target.point.x, y: target.point.y }
        } else if (target.kind === 'orbit') {
          objectAngles = {
            ...currentWorkspace.layout.objectAngles,
            ...captureEffectiveObjectAngles(currentWorkspace, system, [target.orbitId]),
          }
          placement = { kind: 'orbit', orbitId: target.orbitId }
          objectAngles[object.id] = target.angle
        } else {
          throw new Error('Choose a clear map position or an existing Orbit for this object.')
        }
        const positionedObject = { ...object, placement }
        createdObjectId = positionedObject.id
        nextWorkspace = replaceWorkspaceSystem(currentWorkspace, {
          ...system,
          objects: [...system.objects, positionedObject],
        })
        if (objectAngles) {
          nextWorkspace = {
            ...nextWorkspace,
            layout: { ...nextWorkspace.layout, objectAngles },
          }
        }
        successNotice = `${correctionNotice ? `${correctionNotice} ` : ''}${positionedObject.name} added. Choose another location or Quit Add.`
      } else {
        const rotation = preview.rotation
        if (!preview.radii || typeof rotation !== 'number' || !Number.isFinite(rotation)) {
          throw new Error('Enter valid Orbit radii and rotation before adding.')
        }
        const hostId = target.kind === 'host' ? target.objectId : null
        const orbit = createOrbit(system, hostId)
        const placedOrbit: Orbit = hostId === null && target.kind === 'free'
          ? { ...orbit, hostId: null, center: target.point }
          : orbit
        const withOrbit = replaceWorkspaceSystem(currentWorkspace, {
          ...system,
          orbits: [...system.orbits, placedOrbit],
        })
        nextWorkspace = {
          ...withOrbit,
          layout: {
            ...withOrbit.layout,
            orbitRadii: { ...withOrbit.layout.orbitRadii, [placedOrbit.id]: preview.radii },
            orbitRotations: { ...withOrbit.layout.orbitRotations, [placedOrbit.id]: rotation },
          },
        }
        successNotice = `${correctionNotice ? `${correctionNotice} ` : ''}Orbit ${placedOrbit.order} added. Choose another target or Quit Add.`
      }

      // Consume this preparation before synchronous memory publication or any durable work begins.
      session.preview = null
      session.candidates = []
      const { durable } = applyWorkspace(nextWorkspace)
      session.notice = successNotice
      void durable.catch(() => undefined)
      if (createdObjectId) {
        try {
          await onObjectCreated(createdObjectId)
        } catch (error) {
          // Workspace publication already succeeded; keep the Add result truthful if UI handoff fails.
          setError('form', `Object was added, but Inspect could not be opened: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      return true
    } catch (error) {
      invalidatePreview(session)
      setError('form', error instanceof Error ? error.message : String(error))
      return false
    } finally {
      if (confirmingPreviewId === previewId) confirmingPreviewId = null
    }
  }

  async function chooseCreationCandidate(key: string): Promise<boolean> {
    if (confirmingPreviewId !== null) return false
    const session = creationSession.value
    const candidate = session?.candidates.find(item => item.key === key)
    if (!session || !candidate) return false
    const system = currentSystemForSession(session)
    const error = candidate.error ?? (system
      ? validateTarget(session, system, candidate.target)
      : 'The star system for this Add session is no longer available.')
    if (error) {
      invalidatePreview(session)
      setTargetError(candidate.target, error)
      return false
    }
    return await completeCreation(candidate.target, true)
  }

  function quitAdd(): void {
    creationSession.value = null
  }

  /** Clears only pending Add targets invalidated by a published deletion cascade. */
  function pruneTargetsAfterDeletion(plan: MapDeletionPlan): void {
    const session = creationSession.value
    if (!session) return

    if (plan.removedSystemIds.includes(session.systemId)) {
      creationSession.value = null
      return
    }

    const removedObjects = new Set(plan.removedObjectIds)
    const removedOrbits = new Set(plan.removedOrbitIds)
    const targetWasRemoved = (target: SystemCreationTarget): boolean =>
      target.kind === 'host'
        ? removedObjects.has(target.objectId)
        : target.kind === 'orbit' && removedOrbits.has(target.orbitId)

    let pruned = false
    if (session.type.kind === 'orbit' && session.inputs.hostId && removedObjects.has(session.inputs.hostId)) {
      session.inputs.hostId = ''
      pruned = true
      const errors = { ...session.errors }
      delete errors.hostId
      session.errors = errors
    }
    if (session.type.kind === 'object' && session.inputs.orbitId && removedOrbits.has(session.inputs.orbitId)) {
      session.inputs.orbitId = ''
      pruned = true
      const errors = { ...session.errors }
      delete errors.orbitId
      session.errors = errors
    }

    const retainedCandidates = session.candidates.filter(candidate => !targetWasRemoved(candidate.target))
    if (retainedCandidates.length !== session.candidates.length) {
      session.candidates = retainedCandidates
      pruned = true
    }
    if (session.preview && targetWasRemoved(session.preview.target)) {
      session.preview = null
      pruned = true
    }
    if (pruned) {
      const errors = { ...session.errors }
      delete errors.target
      session.errors = errors
      session.notice = ''
    }
  }

  return {
    creationSession,
    chooseCreationType,
    updateCreationInput,
    offerCreationCandidates,
    chooseCreationCandidate,
    handleCreationDrop,
    addCreationFromInputs,
    cancelCreationPreview,
    quitAdd,
    pruneTargetsAfterDeletion,
  }
}
