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

Ordinary editing commands submit a bounded action descriptor, a proposal calculation and an operation-owned current-context check to the page's shared mutation coordinator. It validates a detached proposal, checks the captured applied-data revision and ownership before publication, and reports an applied, unchanged or rejected verdict. Mutation-facing callers await that verdict before closing a draft, consuming a preview or continuing a transition; an applied verdict still carries its separate durable acknowledgement. Initial creation, hydration and backup restoration establish baselines outside ordinary mutation execution.

The page-owned history adapter injects the same coordinator into editing and import commands. Its framework-independent timeline retains canonical UTF-8 snapshot/descriptor buffers, sharing adjacent baseline nodes and counting their exact encoded lengths against 100 action edges and 32 MiB. Prepared prefix eviction and branch removal become visible only with accepted memory publication. An oversized operation needs explicit consent to apply as a non-undoable baseline clearing both sides. Cancellation or failure before publication preserves the existing data and history. Encoded capacity is not a JavaScript heap limit.

Undo/Redo uses the sole writer and swaps the prepared history position with synchronous memory publication under a reentrancy guard. Further traversal requires the latest applied revision to be saved and no modified draft, preview, gesture, review or blocking dialog. Successful traversal ends obsolete clean sessions; failed durability keeps restored data and its history position. Retry saves current memory without another action. The adapter resets history on identity/hydration/recovery boundaries and disposes pending capacity consent with its editor owner; navigation, hidden panels and renderer reflow do not reset it.

`useLocalWorkspace` remains the single owner of hydrated workspace data and ordered IndexedDB writes. Its `applyWorkspace` operation validates and publishes a snapshot in memory, then enqueues that snapshot for durable saving. These are separate completion points: a command can report an applied in-memory change while the UI continues to display saving or save-error status. Keep its ordered queue, save recovery, and durable workspace outside Pinia; do not add a parallel persistence path.

Its read-only applied-data revision advances when memory is published or a hydrated/recovered baseline is installed. This is distinct from the queue revision used for save feedback: retrying durability does not create another applied-data revision. A separate saved-applied revision identifies the latest successful queue acknowledgement, preventing old saved feedback from enabling traversal of newly published data. The page creates and disposes one history coordinator and injects it into both editor workflows and separately composed import actions.

Nuxt renders with SSR enabled. Store creation and state must remain isolated to the Nuxt application/request and compatible with hydration. Use the Nuxt Pinia integration, expose setup-store state in the form Pinia expects, and preserve reactivity when extracting state. Do not access `window` or create browser subscriptions during server module evaluation. See [Pinia's Nuxt integration](https://pinia.vuejs.org/ssr/nuxt.html) and [setup-store concepts](https://pinia.vuejs.org/core-concepts/).

The Pinia SSR bundling rule in [Nuxt configuration](../../nuxt.config.ts) keeps the module plugin and application stores on one runtime identity. Removing it requires a compiled-server check: an embedded plugin copy alongside external store imports produces distinct injection symbols even with one npm package version.

The store does not enforce action-only mutation, session ownership, or domain invariants. Those contracts come from the editor interfaces and their callers. Start with shared selection, tool, panel, and map-visit state; move a session into shared state only when actual consumers need that lifetime. The selected boundary and trade-off are in [ADR 0001](../adr/0001-editor-state-with-pinia.md).

## Code navigation

| Responsibility | Entry point |
| --- | --- |
| Shared UI state and accepted-state actions | [editor-ui store](../../stores/editor-ui.ts) |
| Feature composition and single workspace writer injection | [useEditorWorkflows](../../composables/useEditorWorkflows.ts) |
| Validated mutation proposals and truthful memory-application verdicts | [workspace mutation executor](../../composables/editor-workflows/workspace-mutations.ts) |
| Page-owned history status, saved-state gates and capacity confirmation | [workspace history adapter](../../composables/useWorkspaceHistory.ts) |
| Canonical retained history nodes, branching and encoded capacity planning | [workspace history timeline](../../composables/editor-workflows/workspace-history-timeline.ts) |
| Guarded navigation and remembered visits | [useEditorNavigation](../../composables/editor-workflows/useEditorNavigation.ts) |
| Draft-resolution sequencing | [useEditorTransitions](../../composables/editor-workflows/useEditorTransitions.ts) |
| Chart-name draft lifetime | [useChartNamesSession](../../composables/editor-workflows/useChartNamesSession.ts) |
| Candidate-request coordination | [useMapInteractionCoordinator](../../composables/editor-workflows/useMapInteractionCoordinator.ts) |
| Mounted map handles and responsive effects | [useEditorMapControls](../../composables/editor-workflows/useEditorMapControls.ts), [useEditorViewport](../../composables/editor-workflows/useEditorViewport.ts) |
| Guarded commands for connected Dock/Hierarchy containers | [editor command context](../../composables/editor-workflows/editor-command-context.ts) |
| Object relationship changes and angle preservation | [workspace placement](../../domain/workspace-placement.ts) |
