# Editor architecture

This page describes technical ownership and dependency direction in the editor. Follow [the UI guide](../agents/ui.md) for interaction, panel, and review rules. The focused Pinia decision is recorded in [ADR 0001](../adr/0001-editor-state-with-pinia.md).

## State and lifetimes

The Pinia editor store owns shared, transient interface state: selected entity IDs, the active map and tool, panel visibility, and remembered map visits. Dock, Hierarchy, Inspector, and map surfaces can consume the same named state without routing every value through the page. Reset on editor entry/exit and changes to workspace or cluster identity. An ordinary immutable workspace update, hidden panel, or responsive reflow keeps that lifetime. The store is not a second copy of the committed workspace and it does not persist data.

Editing sessions remain with focused editor controllers. A controller owns its draft, validation, session identity, and begin, update, apply, or discard operations. Keep object, Orbit, route, and chart sessions specialized where their rules differ. This lets a hidden panel retain its parent-owned draft while the UI store only records whether that panel is shown.

Browser resources have a shorter, different lifetime. Map component handles, D3 selections and gestures, focus targets, media-query listeners, and previews belong to the mounted page, renderer, or interaction that creates them. Register browser effects at the appropriate client lifecycle point and release them with that owner. Pending confirmation promises and in-flight command bookkeeping stay with the navigation or editing operation that must resolve them; they are not store state.

Domain calculations accept data and return results. Placement, relationship, and validation rules must not depend on Vue components, Pinia, browser APIs, or IndexedDB. Keep each complete operation together when it has to coordinate a draft guard, asynchronous confirmation, context checks, and a final state change.

## Dependencies and operation flow

Screens and map interactions read shared UI state and call focused editor commands. Commands use the relevant session controller, pure domain operations, and the existing workspace writer. The page composes those pieces and connects map components; it should not become a transport layer for every state value. Domain operations remain below UI and persistence concerns, while the Pinia store contains shared editor state rather than workflow implementations.

A guarded navigation illustrates the order: capture the starting context, ask the relevant draft sessions to resolve, then verify that the context and target still exist after the asynchronous wait. Only an accepted transition updates selection or map state. An editing command computes and validates a complete workspace change before asking the writer to apply it. This keeps stale requests from changing a newer selection and keeps related placement rules consistent across entry points.

`useLocalWorkspace` remains the single owner of hydrated workspace data and ordered IndexedDB writes. Its `applyWorkspace` operation validates and publishes a snapshot in memory, then enqueues that snapshot for durable saving. These are separate completion points: a command can report an applied in-memory change while the UI continues to display saving or save-error status. Keep its ordered queue, save recovery, and durable workspace outside Pinia; do not add a parallel persistence path.

Nuxt renders with SSR enabled. Store creation and state must remain isolated to the Nuxt application/request and compatible with hydration. Use the Nuxt Pinia integration, expose setup-store state in the form Pinia expects, and preserve reactivity when extracting state. Do not access `window` or create browser subscriptions during server module evaluation. See [Pinia's Nuxt integration](https://pinia.vuejs.org/ssr/nuxt.html) and [setup-store concepts](https://pinia.vuejs.org/core-concepts/).

The Pinia SSR bundling rule in [Nuxt configuration](../../nuxt.config.ts) keeps the module plugin and application stores on one runtime identity. Removing it requires a compiled-server check: an embedded plugin copy alongside external store imports produces distinct injection symbols even with one npm package version.

The store does not enforce action-only mutation, session ownership, or domain invariants. Those contracts come from the editor interfaces and their callers. Start with shared selection, tool, panel, and map-visit state; move a session into shared state only when actual consumers need that lifetime. The selected boundary and trade-off are in [ADR 0001](../adr/0001-editor-state-with-pinia.md).

## Code navigation

| Responsibility | Entry point |
| --- | --- |
| Shared UI state and accepted-state actions | [editor-ui store](../../stores/editor-ui.ts) |
| Feature composition and single workspace writer injection | [useEditorWorkflows](../../composables/useEditorWorkflows.ts) |
| Guarded navigation and remembered visits | [useEditorNavigation](../../composables/editor-workflows/useEditorNavigation.ts) |
| Draft-resolution sequencing | [useEditorTransitions](../../composables/editor-workflows/useEditorTransitions.ts) |
| Chart-name draft lifetime | [useChartNamesSession](../../composables/editor-workflows/useChartNamesSession.ts) |
| Candidate-request coordination | [useMapInteractionCoordinator](../../composables/editor-workflows/useMapInteractionCoordinator.ts) |
| Mounted map handles and responsive effects | [useEditorMapControls](../../composables/editor-workflows/useEditorMapControls.ts), [useEditorViewport](../../composables/editor-workflows/useEditorViewport.ts) |
| Guarded commands for connected Dock/Hierarchy containers | [editor command context](../../composables/editor-workflows/editor-command-context.ts) |
| Object relationship changes and angle preservation | [workspace placement](../../domain/workspace-placement.ts) |
