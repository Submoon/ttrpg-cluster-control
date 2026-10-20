/** Owns persistent Add intent and one transient, single-use system creation preview. */
import { ref, type ComputedRef, type Ref } from 'vue'
import {
  createOrbit,
  createSystemObject,
  defaultOrbitRadius,
  minimumOrbitRadius,
  normalizeOrbitRotation,
  replaceWorkspaceSystem,
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

type CreationInputKey = keyof SystemCreationSession['inputs']
type ApplyWorkspace = (workspace: LocalWorkspace) => { durable: Promise<void> }

interface SystemCreationWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  selectedSystem: Readonly<ComputedRef<StarSystem | undefined>>
  systemMapRef: Readonly<Ref<SystemMapHandle | null>>
  applyWorkspace: ApplyWorkspace
  isEntityCommandBlocked: (command: EntityCommand) => boolean
}

function emptyInputs(): SystemCreationSession['inputs'] {
  return {
    x: '',
    y: '',
    orbitId: '',
    angleDegrees: '',
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
 * @returns Persistent type/input state and commands for candidate, preview, and Confirm actions.
 */
export function useSystemCreationWorkflows({
  workspace,
  selectedSystem,
  systemMapRef,
  applyWorkspace,
  isEntityCommandBlocked,
}: SystemCreationWorkflowOptions) {
  const creationSession = ref<SystemCreationSession | null>(null)
  let sessionSequence = 0
  let previewSequence = 0

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
      && !!system
      && system.id === session.systemId
      && currentWorkspace.cluster.systems.some(candidate => candidate.id === session.systemId)
  }

  function chooseCreationType(type: SystemCreationType): void {
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
    if (session.type.kind === 'object' && key === 'orbitId' && previous !== value && !value) {
      session.inputs.angleDegrees = ''
      clearError('angleDegrees')
    } else if (session.type.kind === 'object' && key === 'orbitId' && previous !== value && !session.inputs.angleDegrees) {
      session.inputs.angleDegrees = '0'
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
          return 'This Orbit placement changed. Choose the Orbit again before confirming.'
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
        return 'Enter finite X and Y coordinates for the unoccupied center.'
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

    // Object-on-Orbit previews read the current renderer geometry directly, so a concurrent
    // radius or rotation edit cannot leave a stale ellipse on screen.
    return undefined
  }

  function previewCreation(target: SystemCreationTarget, fromMap = false): boolean {
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
      session.inputs.x = String(target.point.x)
      session.inputs.y = String(target.point.y)
      session.inputs.orbitId = ''
      session.inputs.hostId = ''
    } else if (target.kind === 'orbit') {
      session.inputs.orbitId = target.orbitId
      session.inputs.angleDegrees = String(target.angle * 180 / Math.PI)
    } else if (session.type.kind === 'orbit') {
      session.inputs.hostId = target.objectId
    }
    session.candidates = []
    session.preview = {
      id: ++previewSequence,
      target,
      ...(geometry ? { radii: geometry.radii, rotation: geometry.rotation } : {}),
    }
    const correction = session.notice
    session.notice = session.type.kind === 'orbit'
      ? `${correction ? `${correction} ` : ''}Preview only. Confirm to add this Orbit.`
      : 'Preview only. Confirm to add this map object.'
    return true
  }

  function previewCreationFromInputs(): boolean {
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
        const angleDegrees = parseFinite(session.inputs.angleDegrees)
        if (angleDegrees === undefined) {
          setError('angleDegrees', 'Angle (degrees) must be a finite number.')
          return false
        }
        target = { kind: 'orbit', orbitId: session.inputs.orbitId, angle: angleDegrees * Math.PI / 180 }
      } else {
        const x = parseFinite(session.inputs.x)
        const y = parseFinite(session.inputs.y)
        if (x === undefined) setError('x', 'X must be a finite number.')
        if (y === undefined) setError('y', 'Y must be a finite number.')
        if (x === undefined || y === undefined) return false
        target = { kind: 'free', point: { x, y } }
      }
      return previewCreation(target)
    }

    const hostId = session.inputs.hostId && session.inputs.hostId !== '__center__'
      ? session.inputs.hostId
      : ''
    let target: SystemCreationTarget
    if (hostId) {
      target = { kind: 'host', objectId: hostId }
    } else {
      const x = parseFinite(session.inputs.x)
      const y = parseFinite(session.inputs.y)
      if (x === undefined) setError('x', 'X must be a finite number.')
      if (y === undefined) setError('y', 'Y must be a finite number.')
      if (x === undefined || y === undefined) return false
      target = { kind: 'free', point: { x, y } }
    }
    return previewCreation(target)
  }

  function offerCreationCandidates(candidates: SystemCreationCandidate[]): boolean {
    const session = creationSession.value
    if (!session) return false
    invalidatePreview(session)
    clearErrors()
    if (!sessionMatchesCurrentContext(session)) {
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }
    session.candidates = candidates
    if (candidates.length !== 1) {
      session.preview = null
      session.notice = candidates.length > 1 ? 'Choose a named placement target.' : 'No placement target is available here.'
      return false
    }
    const candidate = candidates[0]
    if (!candidate) return false
    if (candidate.error) {
      setError('target', candidate.error)
      return false
    }
    return previewCreation(candidate.target, true)
  }

  function handleCreationDrop(type: SystemCreationType, candidates: SystemCreationCandidate[]): boolean {
    let session = creationSession.value
    if (!session || !sameCreationType(session.type, type) || !sessionMatchesCurrentContext(session)) {
      chooseCreationType(type)
      session = creationSession.value
    }
    if (!session) return false
    const previewed = offerCreationCandidates(candidates)
    if (!previewed || !session.preview) return false
    return confirmCreation(session.preview.id)
  }

  function cancelCreationPreview(): void {
    const session = creationSession.value
    if (!session) return
    session.preview = null
    session.candidates = []
    session.notice = 'Choose another location or use Placement to enter coordinates.'
  }

  function materializeEffectiveAngles(system: StarSystem, orbitId: string, objectAngles: Record<string, number>): void {
    const siblings = system.objects.filter(object => object.placement.kind === 'orbit' && object.placement.orbitId === orbitId)
    siblings.forEach((object, index) => {
      if (objectAngles[object.id] !== undefined) return
      objectAngles[object.id] = -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
    })
  }

  function confirmCreation(previewId: number): boolean {
    const session = creationSession.value
    if (!session?.preview || session.preview.id !== previewId) return false
    const currentWorkspace = workspace.value
    const system = currentSystemForSession(session)
    if (!currentWorkspace || !system) {
      invalidatePreview(session)
      setError('target', 'The star system for this Add session is no longer available.')
      return false
    }

    const preview = session.preview
    const target = preview.target
    const correctionNotice = session.notice
      .replace(/\s*Preview only\. Confirm to add (?:this Orbit|this map object)\.$/, '')
      .trim()
    const error = validateTarget(session, system, target)
    if (error) {
      invalidatePreview(session)
      setTargetError(target, error)
      return false
    }

    try {
      let nextWorkspace: LocalWorkspace
      if (session.type.kind === 'object') {
        if (session.type.subtype === 'other' && !session.inputs.otherType.trim()) {
          invalidatePreview(session)
          setError('otherType', 'Type label is required.')
          return false
        }
        const baseObject = createSystemObject(system, session.type.subtype)
        const object = session.type.subtype === 'other'
          ? { ...baseObject, subtype: validName(session.inputs.otherType, 'Object type') }
          : baseObject
        let objectAngles = { ...currentWorkspace.layout.objectAngles }
        let placement: typeof object.placement
        if (target.kind === 'free') {
          placement = { kind: 'system', x: target.point.x, y: target.point.y }
        } else if (target.kind === 'orbit') {
          materializeEffectiveAngles(system, target.orbitId, objectAngles)
          placement = { kind: 'orbit', orbitId: target.orbitId }
          objectAngles[object.id] = target.angle
        } else {
          throw new Error('Choose a clear map position or an existing Orbit for this object.')
        }
        const positionedObject = { ...object, placement }
        nextWorkspace = replaceWorkspaceSystem(currentWorkspace, {
          ...system,
          objects: [...system.objects, positionedObject],
        })
        if (target.kind === 'orbit') {
          nextWorkspace = {
            ...nextWorkspace,
            layout: { ...nextWorkspace.layout, objectAngles },
          }
        }
        session.notice = `${correctionNotice ? `${correctionNotice} ` : ''}${positionedObject.name} added. Choose another location or Quit Add.`
      } else {
        const rotation = preview.rotation
        if (!preview.radii || typeof rotation !== 'number' || !Number.isFinite(rotation)) {
          throw new Error('Enter valid Orbit radii and rotation before confirming.')
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
        session.notice = `${correctionNotice ? `${correctionNotice} ` : ''}Orbit ${placedOrbit.order} added. Choose another target or Quit Add.`
      }

      const { durable } = applyWorkspace(nextWorkspace)
      session.preview = null
      session.candidates = []
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      invalidatePreview(session)
      setError('form', error instanceof Error ? error.message : String(error))
      return false
    }
  }

  function chooseCreationCandidate(key: string): boolean {
    const session = creationSession.value
    const candidate = session?.candidates.find(item => item.key === key)
    if (!session || !candidate) return false
    if (candidate.error) {
      invalidatePreview(session)
      setError('target', candidate.error)
      return false
    }
    return previewCreation(candidate.target, true)
  }

  function quitAdd(): void {
    creationSession.value = null
  }

  return {
    creationSession,
    chooseCreationType,
    updateCreationInput,
    offerCreationCandidates,
    chooseCreationCandidate,
    handleCreationDrop,
    previewCreation,
    previewCreationFromInputs,
    confirmCreation,
    cancelCreationPreview,
    quitAdd,
  }
}
