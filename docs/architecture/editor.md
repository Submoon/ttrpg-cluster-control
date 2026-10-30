# Editor architecture

This page describes technical ownership and dependency direction in the editor. Follow [the UI guide](../agents/ui.md) for interaction, panel, and review rules. The focused Pinia decision is recorded in [ADR 0001](../adr/0001-editor-state-with-pinia.md).

## State and lifetimes

The Pinia editor store owns shared, transient interface state: selected entity IDs, the active map and tool, panel visibility, and remembered map visits. Dock, Hierarchy, Inspector, and map surfaces can consume the same named state without routing every value through the page. Reset on editor entry/exit and changes to workspace or cluster identity. An ordinary immutable workspace update, hidden panel, or responsive reflow keeps that lifetime. The store is not a second copy of the committed workspace and it does not persist data.

Editing sessions remain with focused editor controllers. A controller owns its draft, validation, session identity, and begin, update, apply, or discard operations. Keep object, Orbit, route, and chart sessions specialized where their rules differ. This lets a hidden panel retain its parent-owned draft while the UI store only records whether that panel is shown.

Browser resources have a shorter, different lifetime. Map component handles, D3 selections and gestures, focus targets, media-query listeners, and previews belong to the mounted page, renderer, or interaction that creates them. Register browser effects at the appropriate client lifecycle point and release them with that owner. Pending confirmation promises and in-flight command bookkeeping stay with the navigation or editing operation that must resolve them; they are not store state.

Disabled native buttons can swallow the compatibility `mouseup` that D3 expects. The canvas's existing pointer-release bridge cancels only the matching owned mouse gesture when it ends over disabled obstruction chrome outside the canvas, excluding view pans. Renderer cancellation rolls back the gesture without publishing data or clearing parent-owned placement previews; a later command cannot complete the abandoned drag.

Domain calculations accept data and return results. Placement, relationship, and validation rules must not depend on Vue components, Pinia, browser APIs, or IndexedDB. Keep each complete operation together when it has to coordinate a draft guard, asynchronous confirmation, context checks, and a final state change.

## Dependencies and operation flow

Screens and map interactions read shared UI state and call focused editor commands. Commands use the relevant session controller, pure domain operations, and the existing workspace writer. The page composes those pieces and connects map components; it should not become a transport layer for every state value. Domain operations remain below UI and persistence concerns, while the Pinia store contains shared editor state rather than workflow implementations.

A guarded navigation illustrates the order: capture the starting context, ask the relevant draft sessions to resolve, then verify that the context and target still exist after the asynchronous wait. Only an accepted transition updates selection or map state. An editing command computes and validates a complete workspace change before asking the writer to apply it. This keeps stale requests from changing a newer selection and keeps related placement rules consistent across entry points.

Ordinary editing commands submit a bounded action descriptor, a proposal calculation and an operation-owned current-context check to the page's shared mutation coordinator. It validates a detached proposal, checks the captured applied-data revision and ownership before publication, and reports an applied, unchanged or rejected verdict. Mutation-facing callers await that verdict before closing a draft, consuming a preview or continuing a transition; an applied verdict still carries its separate durable acknowledgement. Initial creation, hydration and backup restoration establish baselines outside ordinary mutation execution.

A request-owned `onApplied` notification can synchronize an originating Inspector session after accepted memory and history publication, before the executor releases its publication guard or resolves the verdict Promise. Position-acceptance callbacks capture the Inspector session identity before execution and rebase only that same session through its existing relationship and dependency checks. This prevents a queued stale-session watcher from discarding a clean session before its accepted position is rebased. Rejection, unchanged actions, declined capacity and history traversal do not notify; reset or disposal suppresses an obsolete notification. Observer failures do not alter an already-applied verdict or its durable acknowledgement.

The page-owned history adapter injects the same coordinator into editing and import commands. Its framework-independent timeline retains canonical UTF-8 snapshot/descriptor buffers, sharing adjacent baseline nodes and counting their exact encoded lengths against 100 action edges and 32 MiB. Prepared prefix eviction and branch removal become visible only with accepted memory publication. An oversized operation needs explicit consent to apply as a non-undoable baseline clearing both sides. Cancellation or failure before publication preserves the existing data and history. Encoded capacity is not a JavaScript heap limit.

Undo/Redo uses the sole writer and swaps the prepared history position with synchronous memory publication under a reentrancy guard. Further traversal requires the latest applied revision to be saved and no modified draft, preview, gesture, review or blocking dialog. Successful traversal ends obsolete clean sessions; failed durability keeps restored data and its history position. Retry saves current memory without another action. The adapter resets history on identity/hydration/recovery boundaries and disposes pending capacity consent with its editor owner; navigation, hidden panels and renderer reflow do not reset it.

A clean armed Add tool alone does not block traversal. Creation controllers compare placement inputs with their armed or last applied baseline; modified inputs, pending target choices and actual previews remain blockers. Workspace changes repair only clean Add target references, retaining the tool when its context survives and ending its session when the system disappears. Undo/Redo counts live in their command buttons; routine session entry uses a concise empty History state rather than a toolbar notice.

Accepted history traversal supplies its original action descriptor to a dedicated context-reveal command after ending obsolete clean sessions. It selects the surviving target or parent, preserves current panels and zoom, and pans only enough to reveal a useful target anchor. A deferred reveal rechecks its workspace and navigation context before changing focus or camera. The read-only History view obtains detached chronological action summaries from the same coordinator, decoding descriptors rather than workspace nodes; consultation owns no second timeline and does not resolve drafts or require saved data.

The page-owned history shortcut bridge observes bubble-phase key events after native controls and child handlers. It ignores editable descendants, composition, repeats, handled events and keyboard-owned overlays. For an active workspace chord, it reads current history availability and either invokes the existing guarded command once or drops the unavailable input immediately; it never waits for saving, resolves a draft, completes a preview or queues a traversal. Mount/unmount owns its browser listeners. Shared Fields traversal keeps the current map context and restores usable control or map focus.

The page-owned map tool shortcut bridge admits N (Navigate), S (Select), M (Move) and A (open Add) only from a focused map root or ordinary map mark. It uses produced letters across keyboard layouts, rejects modifiers, repeats and composition, and leaves keyboard widgets, open overlays and active gestures in control. Mode shortcuts reuse the guarded command; ignored inputs never replay. The Dock shows the bindings and focus-scope help. Keyboard-opened Add uses the popover's focus lifecycle to focus its first type choice and return to the originating map on Escape, without overriding a newer focus owner or map context.

Continuous Orbit keyboard/wheel adjustment keeps one unapplied proposal with its initial workspace/revision/operation ownership in the coordinator. The editor-scoped adjustment controller owns relative geometry previews, key-release/focus listeners and the 300 ms wheel boundary above responsive map mounts. Completion uses the ordinary validated history/capacity/write path once. Commands, navigation and file actions complete pending adjustment before reading their own baselines; a late executor fallback refuses an already prepared request if completion changed its revision. Cancelled consent aborts the waiting operation and discards only the unapplied preview. Reset and editor disposal invalidate pending callbacks.

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
| Keyboard ownership and guarded shortcut dispatch | [workspace history shortcut bridge](../../composables/useWorkspaceHistoryShortcuts.ts) |
| Map-focused tool shortcuts and browser input ownership | [map tool shortcut bridge](../../composables/useMapToolShortcuts.ts) |
| Canonical retained history nodes, branching and encoded capacity planning | [workspace history timeline](../../composables/editor-workflows/workspace-history-timeline.ts) |
| Continuous Orbit previews, group boundaries and browser listener lifetime | [continuous Orbit adjustments](../../composables/editor-workflows/continuous-orbit-adjustments.ts) |
| Guarded navigation and remembered visits | [useEditorNavigation](../../composables/editor-workflows/useEditorNavigation.ts) |
| Draft-resolution sequencing | [useEditorTransitions](../../composables/editor-workflows/useEditorTransitions.ts) |
| Chart-name draft lifetime | [useChartNamesSession](../../composables/editor-workflows/useChartNamesSession.ts) |
| Candidate-request coordination | [useMapInteractionCoordinator](../../composables/editor-workflows/useMapInteractionCoordinator.ts) |
| Mounted map handles and responsive effects | [useEditorMapControls](../../composables/editor-workflows/useEditorMapControls.ts), [useEditorViewport](../../composables/editor-workflows/useEditorViewport.ts) |
| Guarded commands for connected Dock/Hierarchy containers | [editor command context](../../composables/editor-workflows/editor-command-context.ts) |
| Object relationship changes and angle preservation | [workspace placement](../../domain/workspace-placement.ts) |
