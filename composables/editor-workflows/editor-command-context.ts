import { inject, provide, type InjectionKey } from 'vue'
import type { JumpRoute, Point } from '../../domain/workspace'
import type { MapInteractionMode } from './types'
import type { PublicationMenuLease, PublicationMenuRequest, PublicationRequest } from './publication-types'
import type { WorkspaceMutationResult } from './workspace-mutations'

export interface EditorCommandContext {
  navigation: {
    selectSystem(systemId: string): Promise<void>
    selectObject(objectId: string, openInspector?: boolean): Promise<void>
    selectOrbit(orbitId: string, openInspector?: boolean): Promise<void>
    selectRoute(routeId: string, openInspector?: boolean): Promise<void>
    showClusterMap(): Promise<void>
    routeSummary(route: JumpRoute): string
  }
  charts: {
    beginNamesEdit(systemId?: string): Promise<void>
  }
  cluster: {
    deleteSystem(systemId: string): void
  }
  creation: {
    beginOrbitDrag(scenePoint: Point): boolean
    updateOrbitDrag(scenePoint: Point, sceneClearance: number): void
    completeOrbitDrag(): Promise<boolean>
    cancelOrbitDrag(): void
  }
  map: {
    changeMode(mode: MapInteractionMode): void
  }
  publication: {
    set(request: PublicationRequest): Promise<WorkspaceMutationResult>
    openMenu(request: PublicationMenuRequest): PublicationMenuLease | null
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
