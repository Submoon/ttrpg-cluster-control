import { inject, provide, type InjectionKey } from 'vue'
import type { JumpRoute } from '../../domain/workspace'
import type { MapInteractionMode } from './types'

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
  map: {
    changeMode(mode: MapInteractionMode): void
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
