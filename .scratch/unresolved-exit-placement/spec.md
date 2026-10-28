---
title: Map-based positioning and movable unresolved-exit targets
status: closed
closed_on: 2026-10-28
scope_status: approved
scope_approved_on: 2026-10-27
testing_seams_status: approved
testing_seams_approved_on: 2026-10-27
ticketing_status: published
ticketing_approved_on: 2026-10-27
triage_labels:
  - enhancement
  - ready-for-agent
---

# Map-based positioning and movable unresolved-exit targets

## Source issue

[Allow repositioning unresolved-exit target markers on the Cluster map (#27)](https://github.com/Submoon/ttrpg-cluster-control/issues/27) is the source request. Its body, comments, state and labels were refreshed through GitHub CLI on 2026-10-27 before this specification: open, enhancement, no comments, unchanged from the scoping session.

The issue requires moving an existing unresolved-exit target without recreating its Jump Route; live path and label updates; pan/zoom correctness; durable positions; independent targets; unchanged logical route properties; and compatible placement for older workspaces.

The user explicitly expanded the scope in this chat to remove editable numeric positions for all map elements, across Inspector and Dock, and approved the consolidated scope on 2026-10-27. This extension is authoritative local scope; it is not part of the currently published issue body.

[Undo/redo functionality (#5)](https://github.com/Submoon/ttrpg-cluster-control/issues/5) was also refreshed on 2026-10-27: open, no comments. A separate chat is scoping that effort. No message was sent to it.

## Repository baseline

- Analysis and specification baseline: 9edfa66c4f505d56f106fc4af8245f200abfba78.
- Origin was fetched again for this specification. This worktree HEAD and origin/main are identical, with zero divergence.
- The original scoping worktree started at c84988be4f7ee2b83c509f5323791d3b7a9532ee and was fast-forwarded by three commits.
- Primary main was initially left untouched because it contained local work. During specification preparation, verification showed only an unrelated untracked environment directory and no tracked modifications; main was safely fast-forwarded to the same baseline, preserving that directory.
- No intentionally different implementation base is selected. Refresh the baseline before future implementation and preserve these product decisions if code has advanced.
- The source issue's technical context uses the older 629d2a98715c3a16b954e0f77c639b1f0c31212c baseline. Its technical pointers must not override the current architecture.
- Other issue worktrees, branches and processes, including #15 and #16, remain outside this effort.

## Problem Statement

The Warden cannot arrange unresolved external exits on the Jump Cluster map. Their target markers are placed automatically, can overlap routes or labels, and cannot be moved without recreating a route or changing the layout of its origin system.

Position editing is also inconsistent across the editor. Some positions are entered in the Inspector, others in Dock Placement tools, and map-only keyboard or click placement is incomplete. Numeric coordinates expose schematic placement details and entangle some position edits with unrelated Inspector drafts. An object's angle along an Orbit is another position field, even though it is expressed in degrees.

The Warden needs one recognizable way to position elements on the map, with equivalent keyboard and single-pointer operation, reliable preview and cancellation, and durable results. Unresolved exits must support that interaction without becoming new domain entities or changing the meaning of their Jump Routes.

## Solution

Make map interaction the place where positions are edited. Keep direct dragging in Move, and provide a common alternative: select an element, invoke Move, choose its destination by click or keyboard arrows, inspect the preview, and confirm or cancel. Direct dragging retains the existing valid-release commit convention; the non-drag workflow uses explicit confirmation.

Remove editable X/Y positions and the positional angle of an object along its Orbit from all panels, including creation and placement controls. Keep Orbit size and rotation, logical attachment choices, Orbit order and other non-position properties available.

Add independent durable positions for unresolved-exit targets. Once positioned manually, a target stays fixed in map coordinates when its origin system moves. It remains associated with its existing Jump Route, can be placed beyond the initial canvas, and stays reachable through pan and Fit. Routes without a saved target position retain automatic placement.

Confirmed movement is independent of other Inspector drafts. Applying or discarding an unrelated draft cannot revert the move. Whole-map JSON, SVG and PNG behavior preserves applied positions; PNG output scales down when necessary to keep raster dimensions manageable.

## User Stories

1. As a Warden, I want to move an existing unresolved-exit marker, so that I can arrange the Cluster without recreating its Jump Route.
2. As a Warden, I want the route path to follow its target during movement, so that I can judge the resulting connection before committing.
3. As a Warden, I want the Jump-level label to follow the route preview, so that its classification stays associated with the correct path.
4. As a Warden, I want the unresolved-exit name to follow its marker, so that the destination label stays readable after movement.
5. As a Warden, I want placement to work while zoomed, so that precise arrangement does not depend on the default scale.
6. As a Warden, I want placement to work after panning, so that the displayed destination matches the saved destination.
7. As a Warden, I want placement to remain accurate across viewport sizes, so that responsive layout does not change the result.
8. As a Warden, I want each unresolved target to move independently, so that arranging one route does not rearrange another.
9. As a Warden, I want targets sharing an origin to remain independent, so that I can separate their paths and labels.
10. As a Warden, I want targets sharing the same exit name to remain independent, so that names do not determine layout identity.
11. As a Warden, I want moving a target to leave its origin system fixed, so that I control both endpoints separately.
12. As a Warden, I want target movement to preserve the origin Jump Point, so that a visual adjustment does not change the route's logical source.
13. As a Warden, I want target movement to preserve the Jump level, so that arranging the map does not alter route classification.
14. As a Warden, I want target movement to preserve the unresolved-exit name and unresolved destination, so that it never resolves or renames the route.
15. As a Warden, I want a manually placed target to stay fixed when its origin system moves, so that my chosen destination layout remains stable.
16. As a Warden, I want the connecting path to adapt when the origin moves, so that it still joins the system to the fixed target.
17. As a Warden, I want route name and Jump-level edits to preserve target position, so that ordinary data editing does not undo map arrangement.
18. As a Warden, I want changing the origin Jump Point to preserve a manual target position, so that source editing does not reset the destination layout.
19. As a Warden, I want resolving a destination to remove its obsolete target position, so that hidden unresolved-layout state does not linger.
20. As a Warden, I want a route made unresolved again to start automatically, so that a previous resolved transition does not resurrect an old manual position.
21. As a Warden, I want deleting a route to remove its target layout, so that obsolete placement does not affect other routes.
22. As a Warden, I want dependent route deletion to clean target layout too, so that removing a Jump Point or system leaves no orphan positions.
23. As a Warden, I want older workspaces without target positions to retain sensible automatic placement, so that existing maps remain usable.
24. As a Warden, I want a newly unresolved route without a manual position to use automatic placement, so that I need not position every route immediately.
25. As a Warden, I want no additional return-to-automatic editing action, so that this feature remains focused on manual positioning.
26. As a Warden, I want selecting a target to select its Jump Route, so that it uses the same identity and details as the connection.
27. As a Warden using Select, I want selecting a target to open the route Inspector, so that I can consult or edit its logical properties.
28. As a Warden using Move, I want target selection to stay quiet, so that rearranging the map does not force the Inspector open.
29. As a Warden, I want selecting or moving a target to avoid entering its source system, so that I remain on the Cluster map.
30. As a Warden, I want direct geometry dragging to require Move, so that selection and navigation do not accidentally reposition data.
31. As a Warden, I want a valid drag release to commit one movement, so that a gesture has one clear result.
32. As a Warden, I want an interrupted drag to restore its last applied position, so that an unfinished action is never saved.
33. As a Warden, I want navigation takeover to cancel the active gesture and consume its later release, so that panning cannot cause a delayed move.
34. As a Warden, I want canceling an unfinished action to preserve earlier committed moves, so that cancellation affects only current work.
35. As a Warden, I want to select an element and invoke Move without dragging, so that placement is available with a single pointer.
36. As a Warden, I want clicking a destination to show a preview, so that I can review a non-drag move before applying it.
37. As a Warden, I want arrow keys to adjust the active move preview, so that I can position elements without a pointer or numeric fields.
38. As a Warden, I want explicit confirm and cancel actions for non-drag placement, so that choosing a destination alone does not save it.
39. As a Warden, I want canceling the preview to preserve the previous position, so that experimentation has no committed side effect.
40. As a Warden, I want previewing to leave saved and exported data unchanged, so that temporary feedback is distinct from applied state.
41. As a Warden, I want visible focus and named movement controls, so that I can understand and complete keyboard placement.
42. As a Warden, I want reachable focus after confirmation or cancellation, so that I can continue editing without losing my place.
43. As a Warden, I want manipulation to have alternatives without drag, pinch, right-click or modifiers, so that specialized input is not required.
44. As a Warden, I want ambiguous destination choices to be explicit and named, so that overlapping Orbits or hosts are not selected silently.
45. As a Warden, I want invalid destinations to explain the problem without mutation, so that map feedback does not corrupt placement.
46. As a Warden, I want Cluster systems to support the common non-drag workflow, so that removing their numeric controls does not remove a placement method.
47. As a Warden, I want free objects to support the common non-drag workflow, so that I can position them directly on a system map.
48. As a Warden, I want objects on Orbits to support keyboard and click placement, so that removing angular fields does not make dragging mandatory.
49. As a Warden, I want explicit free and attached placement choices to remain available, so that I can express the same valid relationship outcomes as before.
50. As a Warden, I want unoccupied Orbit centers to support the common movement workflow, so that their positions remain editable without coordinate fields.
51. As a Warden, I want moving a host to carry its hosted Orbits and descendants consistently, so that position editing preserves established relationships.
52. As a Warden, I want hosted Orbits to move through their hosts, so that the new workflow does not invent an independent center for an attached Orbit.
53. As a Warden, I want Orbit attachment, detachment and host-relative order controls to remain available, so that removing positions does not remove relationship editing.
54. As a Warden, I want Cluster-system X/Y inputs removed from panels, so that system positioning happens on the map.
55. As a Warden, I want free-object X/Y inputs removed from Inspector and Dock, so that there is no competing numeric position editor.
56. As a Warden, I want unoccupied Orbit-center X/Y inputs removed, so that center movement follows the same map-based approach.
57. As a Warden, I want the angle locating an object along its Orbit removed from panels, so that all position inputs follow the same rule.
58. As a Warden, I want numeric creation and placement position fields removed too, so that the rule does not depend on whether an element already exists.
59. As a Warden, I want map-based creation to remain operable without dragging, so that removing creation coordinates does not block keyboard or single-pointer use.
60. As a Warden, I want removed position fields kept out of other panels, so that the interaction is simplified rather than relocated.
61. As a Warden, I want Orbit radii and rotation to remain editable, so that removing positions does not remove size or orientation controls.
62. As a Warden, I want Jump Point Station associations and logical placement relationships preserved, so that visual arrangement does not erase domain editing.
63. As a Warden, I want names, descriptions, native properties and custom fields to remain editable, so that the change stays focused on position.
64. As a Warden, I want a confirmed position change saved independently of other Inspector drafts, so that movement does not apply unrelated edits.
65. As a Warden, I want applying another draft to preserve my current committed position, so that stale draft geometry cannot move an element back.
66. As a Warden, I want discarding another draft to preserve committed movement, so that Discard does not become an implicit movement undo.
67. As a Warden, I want hidden panels and responsive reflow to preserve unrelated drafts, so that presentation changes do not discard my work.
68. As a Warden, I want a stale move request to stop if its element or context is gone, so that delayed actions cannot change a different map.
69. As a Warden, I want target positions restored after navigation and reload, so that arranging the map produces durable results.
70. As a Warden, I want applied movement retained when saving fails, so that a storage error does not silently revert the map.
71. As a Warden, I want existing save feedback and Retry to remain available, so that recovery persists the applied state without replaying the move.
72. As a Warden, I want workspace and Cluster JSON round trips to preserve target positions, so that exchanging a map retains its arrangement.
73. As a Warden, I want append-imported routes to receive their own remapped positions, so that an imported copy is independent of the original.
74. As a Warden, I want repeated names and imports to avoid cross-linking targets, so that route identity determines position ownership.
75. As a Warden, I want standalone-system export to keep its existing scope, so that Cluster routes are not added to a format that excludes them.
76. As a Warden, I want malformed or numerically unsafe target positions rejected without a partial update, so that invalid imports or moves cannot break the map.
77. As a Warden, I want unresolved targets beyond the initial canvas, so that available arrangement space is not restricted to the starting rectangle.
78. As a Warden, I want pan to reach off-canvas targets, so that a saved exit remains accessible.
79. As a Warden, I want Fit to include every applied target and label, even below the current minimum scale, so that distant exits can always be recovered.
80. As a Warden, I want pan and zoom to leave saved positions unchanged, so that navigation never edits map data.
81. As a Warden, I want SVG to export the full applied map as vector content, so that off-canvas geometry is not clipped to my current view.
82. As a Warden, I want PNG to include the whole map at manageable dimensions, so that distant exits do not force a huge raster allocation.
83. As a Warden, I want export during an unfinished move to use applied geometry, so that a preview cannot leak into the shared result.
84. As a Warden, I want exported labels included and interaction handles excluded, so that the result is a readable map rather than an editing screenshot.
85. As a Warden, I want comfortable target interaction at supported zoom and compact sizes, so that selecting a small visible marker remains practical.
86. As a Warden, I want each completed movement to remain a single semantic edit, so that future undo/redo can treat the action coherently.

## Implementation Decisions

- Preserve the existing domain language and relationships. An unresolved-exit marker is a visual endpoint of its Jump Route; it is not a new Jump Point, catalogue object or resolved destination.
- Add optional per-route target layout to the durable workspace. Position identity follows route identity, not list index, exit name, Jump Point name or source-system position. Keep layout distinct from the route's logical properties.
- Define positions in map space independently of viewport translation and scale. The storage encoding must preserve that contract, accept valid off-canvas points and avoid inheriting system-only normalized bounds.
- Missing saved target positions use the existing automatic calculation. Do not eagerly rewrite older files or change automatic target behavior as a side effect of this feature.
- Extend the existing pure route-geometry responsibility to consume both committed target positions and temporary target overrides. Keep the path, Jump-level label, marker and exit-name geometry coherent. Do not add a separate route calculator for export.
- Keep transient gesture and placement previews with their renderer or focused interaction controller. Shared UI state may retain selection, mode and panel visibility; it is not the durable workspace or a second persistence layer.
- Use focused commands and the single ordered workspace writer for committed movement. A valid drag release or an explicit non-drag confirmation publishes one complete change; pointer updates and canceled previews publish none.
- Apply the common non-drag flow to movable Cluster systems, free objects, Orbit occupants, unoccupied Orbit centers and unresolved targets. Reuse established placement validation, carried geometry, named candidate resolution and logical relationship rules rather than replacing them with visual guesses.
- Keep Move as the deliberate direct-manipulation mode. Resolve keyboard movement in the active preview without accidentally triggering map pan; ordinary navigation retains its existing keyboard controls.
- Preserve existing navigation takeover, gesture cancellation and suppression of later releases. Accepted context changes, interruption and disposal cannot publish stale previews. Validation must recheck entity and workspace identity after asynchronous waits.
- Preserve the same route selection identity in Select and Move. Select opens its Inspector; Move selects without forcing it open. Target movement does not enter the origin system or implicitly change the active system.
- Remove editable X/Y and occupant-position angle fields from Inspector and Dock, including creation and placement surfaces. Keep required logical destination/attachment choices and supported size/orientation controls; do not move position values into a new numeric panel.
- Separate committed positional state from unrelated Inspector draft fields. Applying or discarding such a draft must not replay an earlier position. When a draft explicitly changes a placement relationship, retain its intentional relationship operation and existing validation/guard rules; do not silently apply unrelated draft edits during a move.
- Retain a target's map position across route name, Jump-level and origin Jump Point changes. Resolving the destination clears its manual target layout; a later unresolved destination uses automatic placement. Route deletion and dependent deletion prune obsolete entries.
- Extend restoration, snapshot validation and relevant JSON interchange together. Default absent target layout compatibly; validate stored points and ownership; copy and remap route identities during independent append import. Standalone-system export continues to exclude Cluster routes.
- Reach applied off-canvas exits through pan and scene-aware Fit, including a lower effective scale than the historical 25 percent floor when required. This does not implicitly expand other entity-placement bounds.
- Derive live and exported scene bounds from applied geometry, including labels. Keep off-canvas presentation consistent with navigation and exclude invisible interaction targets from content bounds when their geometry would distort Fit or export.
- Export committed geometry even during an active preview. SVG contains the whole vector scene; PNG scales that scene within bounded output dimensions instead of cropping to the viewport or allocating an unbounded canvas.
- Validate both input coordinates and derived calculations. A finite input can still overflow geometry or output calculations; reject unsafe candidates before publication and retain the previous applied state.
- Preserve in-memory application versus durable-save completion and existing save-error recovery. Retry persists the queued applied snapshot rather than re-executing movement.
- Keep each completed movement compatible with a future single history entry, without implementing history, history persistence or undo/redo shortcuts in this effort.
- Treat future implementation as Sensitive because it crosses durable layout, restoration and interchange. Architecture must resolve encoding and command/session interfaces before writers start; independent review must cover behavior and persistence/domain risk.
- Exact coordinate field names, keyboard increments, hit-target dimensions, scene-dependent Fit limits and PNG output caps are engineering decisions to resolve within these contracts. Do not reopen approved product choices unless new evidence reveals a genuine conflict.

## Testing Decisions

The user confirmed these test entry points through the Codex question form on 2026-10-27: public editor journeys are the primary contract, supplemented by existing geometry and validation/import functions for edge cases. No new test runner, public API or test-only internal interface is required.

A good test verifies externally observable behavior: the displayed preview and committed geometry, focus and control state, the applied snapshot exposed through export, reload results, and downloaded artifacts. It must not mirror a helper's internal branch structure, depend on a specific composable arrangement, or merely assert that a mocked action was called.

Prefer the highest useful existing boundary. Most criteria should be exercised through the public editor; targeted deterministic checks support numerical and format guarantees that are expensive or ambiguous to prove through pointer journeys.

| Existing boundary | Required evidence | Prior art to reuse |
| --- | --- | --- |
| Public Cluster editor | Drag and click/keyboard movement, transformed coordinates, independent exits, route selection, fixed target after source movement, ordinary route edits and resolution cleanup | Maintained Cluster rendering, route inspection, precise-system-movement and navigation journeys |
| Public system editor | Common non-drag positioning for each affected element, retained host/Orbit choices, carried descendants, removed position inputs, preserved size/orientation controls | Maintained system-manipulation, Orbit and Inspector journeys |
| Public interaction lifecycle | Preview versus commit, cancel, blur, tool/context changes, touch/right-button takeover, suppressed late releases, focus recovery and compact layouts | Existing gesture-takeover, keyboard focus and responsive-editor regressions |
| Public draft and command behavior | Movement does not apply other fields; Apply/Discard preserves the latest committed position; explicit relationship edits retain guarded semantics; stale targets cannot commit | Existing entity-session, draft-value and editor-transition regressions |
| Workspace persistence and public interchange | Reload and navigation, legacy defaults, workspace/Cluster round trips, append-import ID remapping, deletion cleanup, save failure and non-replaying Retry | Existing workspace-data, reviewed-import and recovery checks |
| Existing pure geometry and format operations | Automatic fallback versus override, coincident points, off-canvas/negative coordinates, finite derived geometry, invalid ownership/data and remapping edge cases | Existing pure-check project and domain validation/codec test style |
| Public image export | Applied rather than preview geometry, full off-canvas labels, clean handles, whole-scene SVG, bounded PNG dimensions with preserved aspect ratio | Existing image-export journeys, including export during held movement and after failed saving |

Additional decisions:

- Keep a compact set of representative public journeys per entity family, with deterministic edge-case coverage below them. Do not multiply identical end-to-end tests for implementation details.
- Verify that preview and cancellation leave the committed/exported snapshot unchanged, while a completed action remains applied after reload. Test operation outcomes rather than counting internal writer calls.
- For coordinate correctness, compare expected map-space results under different pan/zoom transforms and verify path/label association; use the repository's established visual tolerances where appropriate.
- Exercise both existing and legacy/imported workspaces. Include two routes with repeated names, independent append imports, destination resolution and dependent deletion.
- Assert presence of retained logical/size/orientation controls and absence of editable positional fields across Inspector, Dock and creation surfaces.
- Verify meaningful keyboard operation and visible focus through public roles/actions. Browser emulation is useful evidence for compact and touch flows, not certification of a physical keyboard, screen reader or Android device.
- Run lint, typecheck and affected behavior checks during implementation. Follow repository guidance for the integrated full suite and build when integration, SSR or bundling is affected.
- No runtime tests were executed during specification preparation. Its documentation verification covered template sections, continuous story numbering, local references and the absence of source paths or code snippets in Implementation Decisions. Later implementation evidence is linked in Resolution.

## Out of Scope

- Product implementation, commits, push, PR creation, merge, release or issue closure during this planning effort. Local implementation tickets were separately requested and approved after specification preparation; their publication does not start product work.
- Publishing this local specification or labels to GitHub. Repository planning rules map specification publication and readiness to the local effort.
- Resolving destinations, introducing Jump Points or changing Jump Route semantics through marker movement. Existing logical editing remains available.
- Manual control-point editing, route rerouting tools, label-only dragging or automatic collision avoidance.
- Moving other targets or systems automatically when a target is positioned.
- A user-facing return-to-automatic position action.
- Removing Orbit radii, Orbit rotation, host/order choices, object attachment choices, Station associations or other non-position fields.
- Making dragging the only placement method, or replacing removed position fields with equivalent numeric forms elsewhere.
- Expanding every other entity's existing placement bounds because unresolved targets can be off canvas.
- A general navigation redesign beyond supporting the approved positioning and off-canvas recovery behavior.
- Implementing undo/redo, history serialization or keyboard shortcuts from issue #5.
- Replacing the shared editor-state architecture, adding a parallel persistence writer or introducing another test framework.
- Running setup again, introducing a competing domain glossary or modifying unrelated issue worktrees.

## Further Notes

- The product scope was approved through the Codex question form on 2026-10-27. The user separately confirmed the proposed test entry points when invoking to-spec. This document synthesizes those decisions; it does not start implementation.
- The user subsequently invoked to-tickets and approved six slices and their blocking edges on 2026-10-27. The [approved ticket index](ticket-plan.md) links every published ticket and maps their collective coverage to all 86 stories. Only 02 blocks 03 and 04 blocks 05; the initial frontier is 01, 02, 04 and 06.
- An early suggestion that moved positions should live in an Inspector draft was superseded after the user removed position fields. The authoritative behavior is independent movement commits with unrelated drafts preserved.
- This specification deliberately supersedes the earlier numeric-position-in-Inspector contract for positions. It preserves that contract's keyboard, single-pointer, draft-preservation, selection and cancellation guarantees, and retains numeric size/orientation controls.
- The repository has one domain context, [CONTEXT.md](../../CONTEXT.md), and an accepted [shared editor-state ADR](../../docs/adr/0001-editor-state-with-pinia.md). No new domain term or ADR is needed to describe a visual unresolved endpoint.
- Follow the [editor architecture](../../docs/architecture/editor.md), [UI guidance](../../docs/agents/ui.md), [source conventions](../../docs/agents/conventions.md) and [verification guidance](../../docs/agents/testing.md) during later implementation.
- The existing [interface specification](../interface-revamp/spec.md) is prior art; where its numeric-position requirement conflicts with this later approved scope, this specification is authoritative for the affected positioning behavior.
- Current automatic target placement depends on origin height and route-list order. Missing overrides retain that legacy behavior; manually placed targets must not inherit its route-order instability.
- Existing system bounds differ from automatic exit bounds. Reusing system normalization or clamping without an explicit map-space contract can make a target jump on first movement.
- The current Fit minimum scale and scene-sized raster allocation are concrete integration risks for distant exits. Satisfy the approved full-scene recovery and bounded-output contracts rather than silently retaining those limits.
- Coordinate encoding, schema reconstruction, route-edit preservation, dependent deletion and import remapping must be designed together. A renderer-only change cannot deliver the durability contract.
- The common interaction must replace missing map-only keyboard/click capabilities before deleting the old numeric alternatives. Keep relationship selection explicit for overlapping or ambiguous destinations.
- Movement and Inspector sessions must be integrated without restoring stale coordinates or silently applying unrelated relationship drafts. This is an architecture and behavioral-review focus.
- Issue #5 is a related contract dependency, not an established blocker. If its design lands first, reconcile semantic operation boundaries and position snapshots before implementing either integration; this specification does not decide its history design.
- GitHub remains authoritative for incoming requests and global completion; this local effort is authoritative for the approved expanded scope and specification. Local readiness does not change the state or labels of issue #27.
- The user subsequently authorized the initial frontier and then tickets 03 and 05. The effort and all six local implementation tickets are now closed; the two delivery records below retain their actual baselines and verification results.

## Resolution

The approved 86-story scope is implemented across the [first delivery](implementation.md) and [second delivery](implementation-second-frontier.md), with independent [first-delivery review](review.md) and [second-delivery review](review-second-frontier.md). All six tickets in the [approved index](ticket-plan.md) are locally closed on 2026-10-28.

The second delivery ran the complete suite once: 263/264 passed, then the one creation regression was corrected and four affected journeys passed. Final lint, typecheck and production build passed; review has no blocking findings. The records distinguish those affected reruns from a clean complete-suite rerun and retain browser/device verification limits.

This local completion covers the approved expanded specification. GitHub issue #27 remains open; no push, PR, merge or remote state/label change was performed.
