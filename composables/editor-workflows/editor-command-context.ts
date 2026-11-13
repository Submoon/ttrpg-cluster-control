import { inject, provide, type InjectionKey } from 'vue'
import type { JumpRoute, Point } from '../../domain/workspace'
import type { MapInteractionMode } from './types'
import type { PublicationMenuLease, PublicationMenuOptions, PublicationMenuRequest, PublicationRequest } from './publication-types'
import type { WorkspaceMutationResult } from './workspace-mutations'
import type { SelectedObjectDrag } from './selected-object-drag'

export interface EditorCommandContext {
  navigation: {
    selectSystem(systemId: string): Promise<void>
    selectObject(objectId: string, openInspector?: boolean): Promise<void>
    replaceObjectSelection(objectIds: readonly string[], isCurrent?: () => boolean): Promise<boolean>
    toggleObjectSelection(objectId: string): Promise<void>
    clearObjectSelectionForMove(expectedObjectIds: readonly string[]): boolean
    selectOrbit(orbitId: string, openInspector?: boolean): Promise<void>
    selectRoute(routeId: string, openInspector?: boolean): Promise<void>
    showClusterMap(): Promise<void>
    showChartDetails(): Promise<void>
    routeSummary(route: JumpRoute): string
  }
  charts: {
    beginNamesEdit(systemId?: string): Promise<void>
  }
  cluster: {
    deleteSystem(systemId: string): void
  }
  creation: {
    /**
     * Reserves the current Add Orbit target and workspace context for one possible drag placement.
     * A successful reservation clears an older preview and placement errors, but keeps the armed Add
     * session and numeric Placement inputs; it does not change or persist workspace data.
     */
    beginOrbitDrag(scenePoint: Point): boolean
    /**
     * Replaces the transient drag preview using the pointer's scene point and current painted-ring clearance.
     * Invalid or stale reservation context is cancelled; this command never publishes workspace data.
     */
    updateOrbitDrag(scenePoint: Point, sceneClearance: number): void
    /**
     * Completes the reserved drag through the guarded creation and history path.
     * `true` means the creation was accepted and applied to in-memory workspace/history; it does not
     * acknowledge durable storage, whose save result is reported separately by the workspace owner.
     */
    completeOrbitDrag(): Promise<boolean>
    /**
     * Discards only the reservation and its transient preview, keeping Add armed and preserving its inputs.
     * Cancellation has no workspace or persistence side effects.
     */
    cancelOrbitDrag(): void
  }
  map: {
    changeMode(mode: MapInteractionMode, isCurrent?: () => boolean): void
  }
  move: {
    beginSelectedObjectDrag(anchorId: string): SelectedObjectDrag | null
  }
  publication: {
    set(request: PublicationRequest): Promise<WorkspaceMutationResult>
    openMenu(request: PublicationMenuRequest, options?: PublicationMenuOptions): PublicationMenuLease | null
  }
}

const editorCommandContextKey: InjectionKey<EditorCommandContext> = Symbol('editor-command-context')

/** Provides the small guarded command surface needed by connected editor containers. */
export function provideEditorCommands(commands: EditorCommandContext): void {
  provide(editorCommandContextKey, commands)
}

/** Reads editor commands from the nearest page owner. */
export function useEditorCommands(): EditorCommandContext {
  const commands = inject(editorCommandContextKey)
  if (!commands) throw new Error('Editor commands are only available inside the workspace page.')
  return commands
}
