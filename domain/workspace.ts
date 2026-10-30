/**
 * Stable public domain facade; implementation modules import focused peers directly to avoid facade cycles.
 */
export {
  catalogueTypes,
  customFieldApplicabilityTargetKey,
  defaultObjectFieldSettings,
} from './workspace-model'
export type {
  Point,
  CatalogueSubtype,
  ObjectFamily,
  CustomFieldType,
  CustomFieldValue,
  CustomFieldApplicabilityTarget,
  CustomFieldDefinition,
  ObjectFieldSettings,
  ObjectPlacement,
  SystemObject,
  OrbitRadii,
  Orbit,
  JumpRoute,
  StarSystem,
  PublicationMode,
  ChartDetailsChanges,
  JumpCluster,
  JumpPointReference,
  LocalWorkspace,
  ExportedLayout,
  JumpClusterExport,
  StarSystemExport,
  JsonImportSummary,
  PreparedJsonImport,
  SystemObjectChanges,
  MapDeletionTarget,
  MapDeletionPlan,
} from './workspace-model'

export {
  updateNativeFieldOptions,
  addCustomFieldDefinition,
  isCustomFieldApplicableToObject,
  updateCustomFieldApplicability,
  renameCustomFieldDefinition,
  updateCustomFieldOptions,
  isCustomFieldValueCompatible,
  updateCustomFieldType,
  removeCustomFieldDefinition,
} from './workspace-fields'
export {
  initialSystemPlacement,
  createSystemObject,
  updateSystemObject,
} from './workspace-system-objects'
export {
  createLocalWorkspace,
  addStarSystem,
  replaceWorkspaceSystem,
  jumpPointsInCluster,
  createJumpRoute,
  updateJumpRoute,
  renameLocalWorkspace,
  updateChartDetails,
} from './workspace-cluster'
export { planMapEntityDeletion } from './workspace-deletion'
export { moveUnresolvedExitTarget } from './workspace-exit-placement'
export {
  createOrbit,
  defaultOrbitRadius,
  minimumOrbitRadius,
  canPlaceObjectInOrbit,
  moveOrbit,
  moveOrbitCenter,
  detachOrbit,
  normalizeOrbitRotation,
} from './workspace-orbits'
export { captureEffectiveObjectAngles, defaultObjectOrbitAngle, updateWorkspaceObject } from './workspace-placement'
export { isLocalWorkspace, restoreLocalWorkspace } from './workspace-schema'
export { isPublicationMode } from './workspace-validation'
export { exportJumpCluster, exportStarSystem } from './workspace-codec'
export { prepareJsonImport } from './workspace-json-import'
export { projectPlayerCluster } from './player-projection'
export type {
  PlayerSystemMarker,
  PlayerClusterDocument,
  PlayerSystemDocument,
  PlayerObjectMarker,
  PlayerOrbit,
} from './player-projection'
