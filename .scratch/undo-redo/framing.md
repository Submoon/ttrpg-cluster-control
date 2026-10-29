---
title: Undo/redo product framing
status: closed
---

# Undo/redo product framing

This product framing was validated by the user on 2026-10-27 through final Codex question Q21, after three interview rounds. Its consolidated contract is below. The framing activity is complete; the product is not implemented, technical design is still required, and implementation is not authorized.

## Source issue

- [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), fetched with `gh issue view` on 2026-10-27, including body, comments, labels, state and URL.
- State: open. Labels: `enhancement`, `priority:P1`. No comments were present at fetch time.
- Requested scope: undo/redo for all map modifications, including moving, resizing, creating and deleting objects; previous/next state navigation; UI buttons; Ctrl+Z and Ctrl+Shift+Z or Ctrl+Y. The description makes survival across imports/exports conditional, while an acceptance checkbox explicitly requires undo/redo past exports and imports.
- Source acceptance criteria: all mutations enter the action stack; undo and redo are available through UI buttons/shortcuts; history can cross exports/imports.
- Interpretation resolved by the user in round 1: preserve the current session's history across file operations; do not serialize history into portable files.
- Source-scope refinements confirmed locally: initial workspace creation is a fresh baseline; retention is bounded; an oversized operation may become an explicitly accepted, non-undoable new baseline after warning that all undo/redo history will be erased (Q20). This last exception narrows the source's literal “all mutations” criterion. No GitHub text or labels were changed.
- The source was re-fetched before final framing review on 2026-10-27: body, state, labels and empty comments were unchanged.
- The issue links its origin to interface revamp #3. The existing [interface revamp specification](../interface-revamp/spec.md) explicitly excluded undo/redo; its draft, save and recovery contracts remain relevant.

## Repository baseline and scope

- Isolated worktree: `C:/Users/fbal-fontaine/.codex/worktrees/06a5/ttrpg-cluster-control`.
- Starting HEAD and last parent-chat reference: `c84988be4f7ee2b83c509f5323791d3b7a9532ee`.
- `origin` fetched successfully on 2026-10-27. Actual analysis baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`.
- A second fetch before final framing review confirmed HEAD still equals `origin/main` at that SHA (zero commits ahead/behind).
- This chat's detached HEAD was fast-forwarded by three commits to that baseline. No intentionally different analysis base is used.
- Local `main` was at `c84988be` when inspected and is checked out in the primary checkout. It was left untouched because that other checkout's work is outside this isolated effort. No other worktree or branch was modified.
- The fetched baseline already includes the merged #15 correction. Parallel #15/#16 chats and their branches/processes are outside this effort.
- Existing untracked `.codex/environments/` content was preserved.
- Changes made for this effort: this planning file only. No push, PR, commit or GitHub issue mutation was requested or performed.

## Clarification route

The explicitly requested `ask-matt` skill was read, followed by the selected `grill-with-docs`, `grilling` and `domain-modeling` SKILL.md files. The recommended route is documented clarification in rounds: research facts first, ask product decisions at the current decision frontier, then refine this artifact from actual answers.

Repository choices take precedence over generic layouts: GitHub remains authoritative for intake; local planning uses `.scratch/undo-redo/`; `CONTEXT.md` remains the domain context. No parallel glossary or tracker setup is needed. A mechanism, implementation tickets and an implementation start are not selected by this discussion.

## Confirmed user decisions

The requested activity is framing and discussion, not implementation. The user explicitly requested the Codex question mechanism; use its structured question forms for subsequent rounds.

Round 1, confirmed through the Codex question form on 2026-10-27:

| Question | Validated decision |
| --- | --- |
| Q1 / D1 — Data scope | Cover all applied workspace data: objects, Orbits, systems, routes, names, fields, cascading deletions and imports. Camera, panels, tools and unapplied drafts remain outside mutation history. |
| Q2 / D2 — Chronology | Use one chronological workspace history across Cluster and system views. An edit in A followed by one in B is undone in order B, then A. |
| Q3 / D3 — Lifetime | History lasts for the editing session and resets after reload or closure. Applied data continues using existing persistence. |
| Q4 / D3 — Interchange | Imports and exports preserve current session history. Each confirmed import is undoable as a whole. JSON files do not transport history. |
| Q5 / D4 — Access and text | Provide Undo/Redo buttons, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and usual Cmd equivalents. Editable text retains native undo; an empty text history never falls through to workspace undo. |

The user selected the recommended answer for each of Q1–Q5.

Round 2, confirmed through the Codex question form on 2026-10-27:

| Question | Validated decision |
| --- | --- |
| Q6 / D5 — Applied operation boundaries | One completed drag, confirmed placement, form Apply or entire deletion cascade is one step. Creation and subsequent modified Apply remain separate, as do draft Apply and subsequent deletion/import. Canceled, invalid and unchanged operations create no entry. |
| Q7 / D5 — Continuous adjustments | Group one held arrow-key adjustment and one continuous wheel sequence on the same Orbit/property into one step. Changing target/property or performing another operation ends the group. Wheel inactivity threshold was subsequently resolved by Q14. |
| Q8 / D6 — Pending work | Disable workspace undo/redo while any modified draft, editing gesture, unconfirmed preview or consequence review is pending, even when a draft concerns another object. Explain how to finish/apply/discard/cancel; no implicit resolution. Native text undo remains available. |
| Q9 / D7 — Save gate | **The user rejected the recommendation to allow traversal during saving/error.** Undo/redo must wait for a successful save. Do not enable while the latest applied workspace is still saving or in error. Failure after starting Undo/Redo was subsequently resolved by Q13. |
| Q10 — Branching | A new accepted applied modification after Undo clears redo. Navigation, exports, save retry, unapplied typing and canceled operations retain redo. |
| Q11 / D9 — Visible context | Open the affected map and select its target when present. A system deletion shows the Cluster; shared Fields changes have a global label. Do not replay historic zoom or panel layouts. |
| Q12 / D10 — Restoration and redo | Restore the same confirmed result, including contents, links and import/deletion effects. Redo does not repeat the destructive consequence confirmation. |

All round-2 recommended answers were accepted except Q9.

Round 3, confirmed through the Codex question form on 2026-10-27:

| Question | Validated decision |
| --- | --- |
| Q13 / D7 — Traversal write failure | Start only from a saved state; publish the Undo/Redo result immediately, then save it. On failure keep that visible result, block further traversal and offer Retry/Export. Retry saves that state without replaying traversal. |
| Q14 / D5 — Group completion | A 300 ms wheel inactivity period or key release ends the respective group. Target/property/map changes and focus loss also end grouping, retaining applied adjustments. A group returning to its initial state creates no entry and preserves redo. |
| Q15 / D11 — Baselines | Initial workspace creation starts with empty history and cannot be undone back to welcome. Editor exit/re-entry, reload, workspace change and backup restore start fresh history. Map navigation, panel hiding and viewport-size changes preserve it. |
| Q16 / D9 — Context and focus | Show system/route actions and imports in the Cluster, object/Orbit actions in their system, and global Fields changes in the current view with global feedback. Select surviving parent or clear selection when needed, retain focus on the initiating control, minimally reveal off-screen targets, and close/refresh stale clean forms. |
| Q17 / D12 — Controls | Two directly reachable commands near map commands on desktop/compact screens, with action/target labels and unavailable reasons. No separate history-list panel. |
| Q18 / D12 — Keyboard | One traversal per physical press; no auto-repeat and no deferred command while blocked. Respect editable text, IME, handled events and modal dialogs. Support Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z and Cmd+Shift+Z. |
| Q19 / D8 — Capacity | Retain up to 100 steps, evict oldest entries on action-count/memory limits and indicate reduced history. A numerical memory budget and accounting method are to be set during technical design before implementation. |
| Q20 / D8 — Oversized operation | **The user rejected refusing the operation.** Offer explicit continuation that applies the operation and clears history. This creates a non-undoable new baseline; explain that exception before consent. Cancellation preserves existing data/history. |

All round-3 recommended answers were accepted except Q20.

Final confirmation, Q21, through the Codex question form on 2026-10-27: **“Oui, cadrage validé (recommandé)”**. The confirmed synthesis explicitly included saved-state gating with immediate traversal results, session scope, grouping, up to 100 steps under a future measured memory budget, and explicit consent for oversized non-undoable baselines. It also explicitly excluded launching implementation. This closes the product-decision interview without authorizing code, push, PR or GitHub changes.

## Current behavior established from code

### Application, storage and lifetime

- [`useLocalWorkspace`](../../composables/useLocalWorkspace.ts), `applyWorkspace` at line 89: validate and detach a complete snapshot, publish it in memory, then enqueue a durable write. `commit` uses the same boundary and awaits durability. There is one page-owned writer and ordered IndexedDB queue.
- The queue at line 59 continues after failures; only the newest revision changes visible save feedback. Failed saving retains valid applied memory. Retry at line 106 saves current memory without republishing it.
- [`workspace-storage`](../../utils/workspace-storage.ts) keeps `current` and `last-valid` records. This recovery backup is not a user action history. Restoration is a separate load-recovery path and publishes only after its durable replacement succeeds.
- Reload hydrates the durable workspace; memory-only edits and drafts are not restored. [`BaselinePage`](../../components/BaselinePage.vue), line 785, warns before departure for dirty drafts or saving/error states.
- Additional sizing investigation found no explicit workspace/import byte limit or collection cardinality maximum. Import reads the whole file and parses JSON (`useWorkspaceFiles`, lines 253 and 269). Names are limited to 80 characters, but descriptions/custom text values are not capped by the validation rules. The three maintained fixture exports are only 2,386–2,408 compact UTF-8 JSON bytes each, with 1–2 systems and 4–6 objects. These test exports are not real-campaign samples or measurements of history memory. An action-count limit alone cannot bound memory.
- No undo/redo implementation was found in editor, domain, persistence or tests. Remembered map visits are UI navigation memory, not mutation history.
- [`useEditorWorkflows`](../../composables/useEditorWorkflows.ts), lines 24–32, resets shared UI state on workspace/cluster identity change or editor exit, while ordinary workspace snapshots retain that UI lifetime. The [Pinia ADR](../../docs/adr/0001-editor-state-with-pinia.md) keeps committed data and saving outside the UI store.

### Applied operations and transaction boundaries

| Family | Existing application boundary |
| --- | --- |
| Systems | Creation includes initial position; confirmed numeric movement and completed drag publish changes. |
| Objects | Creation includes initial placement and related occupant-angle preservation; movement can change position, Orbit membership or orbital angle. |
| Orbits | Creation, radii, rotation, center/host, detach and ordering can also affect dependent placement. |
| Inspector forms | Apply composes an object's name, fields and placement, or an Orbit's host/order/center/radii/rotation, before publishing. |
| Jump Routes | Apply creates or updates endpoints, jump level and unresolved destination together. |
| Chart names | Apply can update Cluster and targeted system names together. |
| Field definitions | Creation, rename, type/options/applicability changes and deletion can affect existing values across objects. |
| Deletion | Confirmation publishes the complete recalculated cascade once. Applying a conflicting draft before deletion is a separate publication today. |
| Import | Confirmation publishes the complete import once, after review/conflict handling. |

Entry points: [`useMapWorkflows`](../../composables/editor-workflows/useMapWorkflows.ts), [`useSystemCreationWorkflows`](../../composables/editor-workflows/useSystemCreationWorkflows.ts), [`useEntityInspectorSession`](../../composables/editor-workflows/useEntityInspectorSession.ts), [`useRouteInspectorSession`](../../composables/editor-workflows/useRouteInspectorSession.ts), [`useChartNamesSession`](../../composables/editor-workflows/useChartNamesSession.ts), [`useFieldDefinitionWorkflows`](../../composables/editor-workflows/useFieldDefinitionWorkflows.ts), [`useClusterWorkflows`](../../composables/editor-workflows/useClusterWorkflows.ts).

- Drag previews are renderer-local; completed drags usually emit one command. Canceled gestures publish nothing. Numeric placement has Preview/Confirm boundaries.
- [`system-map-renderer`](../../components/maps/system-map-renderer.ts), lines 742–862: each accepted Orbit arrow-key adjustment publishes separately, including repeated keydowns. Lines 1265–1297: Ctrl+wheel rotates an Orbit and publishes per consumed wheel event. Neither is currently a grouped history transaction.
- Object/system keyboard activation selects targets; it does not move them with arrows. Canvas-focused arrows pan the view in [`WorkspaceMapCanvas`](../../components/WorkspaceMapCanvas.vue), line 346.
- Inspector, chart and route clean Apply paths avoid another publication. Draft field typing, hidden/reopened panels, previews and discarded drafts are distinct from applied mutations.
- [`useEditorTransitions`](../../composables/editor-workflows/useEditorTransitions.ts) offers Apply/Discard/Stay for affected dirty sessions. Independent edits may coexist with a draft. A transition can publish more than one session before its final operation.
- Creation applies an entity before opening its editing session. Discarding that later session does not delete the already created entity, as required by the existing interface contract.

### Cascades, import/export and identity

- [`workspace-deletion`](../../domain/workspace-deletion.ts) removes recursive hosted Orbits/occupants, dependent routes and Station links, prunes layout, and reindexes surviving Orbits. Undoing only the root entity would be incomplete.
- [`workspace-json-import`](../../domain/workspace-json-import.ts), line 402: import appends an independent ID-remapped copy, rather than replacing the workspace. It can also extend existing compatible field applicability and native option lists. An inverse must cover all these effects.
- [`useWorkspaceFiles`](../../composables/useWorkspaceFiles.ts), lines 303–390: preparation changes no applied data; confirmation recomputes consequences against latest memory and may require renewed review. A confirmed import closes review after memory publication even if saving later fails.
- [`workspace-codec`](../../domain/workspace-codec.ts) exports applied data, layout and fields, excluding drafts and history. A standalone system export is a subset of the workspace. Image exports also leave workspace data unchanged.
- Creation/import allocate UUIDs. Replaying those allocation routines would create different identities; whether undo/redo restores exact IDs and references must be explicit.

### Keyboard and UI

- No global undo/redo shortcuts or buttons exist. The existing Delete handler in [`useClusterWorkflows`](../../composables/editor-workflows/useClusterWorkflows.ts), line 290, protects editable targets, handled events, repeats, dialogs and pending saving; it is a useful comparison, not an automatically applicable undo policy.
- Native text undo must be distinguished from workspace undo. Ctrl versus Cmd, editable descendants/contenteditable, IME composition, modal reviews, active gestures, repeats, empty history and focus return need explicit coverage.
- Existing [map command chrome](../../components/WorkspaceMapChrome.vue) is a potential UI entry surface. [`WorkspaceMapCanvas`](../../components/WorkspaceMapCanvas.vue), line 679, exposes gesture cancellation. Neither dictates final control placement or history ownership.

## Consolidated product contract

### History scope and identity

Use one chronological history for applied data across Cluster and system views: systems, objects, Orbits, Jump Routes, names, field definitions/values, placements, complete deletion cascades and confirmed imports. Restore exact contents, identifiers, relationships, ordering, layout and shared import effects. Redo restores the previously confirmed result without allocating fresh identities or repeating destructive reviews.

Camera movement, zoom, panels, theme, tools, selections, unapplied drafts, export and storage retries are not history actions. Traversal may update selection/view to reveal the result; it does not rewind old UI snapshots. Initial workspace creation and the explicitly approved oversized-operation exception below are fresh baselines.

### Granularity and branching

One completed drag, confirmed placement, complete form Apply, deletion cascade or confirmed import is one step. Creation then modified form Apply are two steps. Applying a draft before a later deletion/import is a separate step from that operation. Invalid, canceled, clean and no-op operations create no entry and preserve redo.

Group continuous same-Orbit/property adjustments: held-key grouping ends on key release; wheel grouping ends after 300 ms without an adjustment. A target/property/map change, another applied operation or focus loss closes the group, retaining applied adjustments. If the completed group has no net data change, it adds no entry and retains redo. Group closure and durable-save gating are distinct: traversal requires both completion and successful saving of current data.

A new accepted data action after Undo clears redo. Navigation, exports, save retry and unapplied typing do not. A rejected/canceled operation, including canceled oversized-operation consent, must not erase redo or evict history speculatively.

### Availability and save recovery

Undo/Redo is available only when its respective history side is nonempty, the latest applied state is successfully saved, and there is no modified draft, editing gesture, unconfirmed preview, consequence review, pending confirmation or modal interaction blocking access. A modified draft anywhere in the workspace blocks global traversal. Show the reason and how to finish/apply/discard/cancel existing work, without implicit resolution or queuing a deferred traversal. Native text undo remains independent.

Starting Undo/Redo from a saved state publishes its result immediately through the existing writer. Keep the history position consistent with that visible applied state, then save it. Disable further traversal during that save. If saving fails, retain visible data and the matching history position; show Not saved and offer Retry/Export. Retry saves current applied memory, without replaying an edit or adding/moving a history step. Successful saving of the latest state re-enables eligible traversal. Do not allow an older save acknowledgement to enable it or report a newer state saved.

The gate applies to history traversal; it does not broaden this feature into a redesign of ordinary editing permissions during storage errors. Existing ordered writing and departure warnings remain in force.

### Lifetime and interchange

History is session-only. Initial creation, editor exit/re-entry, reload/hydration, workspace identity change and backup recovery start empty history. Initial creation cannot be undone into the welcome screen. Map navigation, panel hiding, responsive child-map remounts and viewport-size changes preserve the session history.

Exports preserve history and do not add entries. Ordinary confirmed imports add one step and retain access to earlier steps, subject to retention limits. JSON carries applied map data, not history or drafts. The recovery backup remains distinct from undo history.

### Capacity and explicit oversized-operation exception

Retain up to 100 action steps across the history timeline, including its undo and redo sides, subject to a bounded memory policy. Evict the oldest retained steps when needed and indicate reduced available history. Do not promise 100 steps regardless of data size.

If one proposed action cannot fit the history budget even after eligible oldest steps are considered, offer Cancel or an explicit **continue and clear history** choice. Explain that continuation clears all Undo and Redo and makes the operation a non-undoable new baseline. Cancellation leaves both applied data and history unchanged. Do not clear history or apply data before the user consents; preserve both if validation or preparation fails before application. On accepted memory publication, apply the operation and reset history consistently. Its save follows the existing memory-then-durable contract; an eventual save failure retains that new baseline in memory with recovery actions.

This is a deliberate exception to complete undo coverage, chosen in Q20. There is no silent fallback to unrecorded mutation. The operation still requires its ordinary validation, draft guards and consequence review.

### Presentation, context and keyboard

Provide two directly reachable Undo/Redo controls near map commands on desktop and compact screens. Expose next-action/target labels and empty-history/blocked reasons accessibly. Do not add a history-list panel for this delivery.

Show system/route actions and imports in Cluster view; show object/Orbit actions in their system. Select the affected target when present, otherwise its surviving parent or no entity. Keep the current map for shared Fields changes and announce their global scope. Retain focus on the initiating control, using a stable map fallback if it no longer exists; reveal off-screen targets with minimal camera adjustment. End or refresh clean editing sessions made stale by traversal, rather than presenting outdated editable values.

Support Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y, with Cmd+Z and Cmd+Shift+Z on Mac. Dispatch one traversal per physical press, ignoring auto-repeat. Respect editable descendants/contenteditable, IME composition, handled events and modal dialogs. Inside editable text, retain native undo even when its own history is empty; never fall through to workspace traversal. Blocked shortcuts do not run later when the blocker disappears.

## Decision frontier and technical follow-up

Product decisions D1–D12 were settled by Q1–Q20 and the consolidated contract was confirmed by Q21. The product-framing frontier is empty; no user answer is being assumed or left pending.

The user explicitly deferred the numerical memory budget and its accounting method to technical design before implementation. That work must choose a measurable bounded-retention policy, define allocation failure handling and test representative larger campaigns. The tiny maintained fixtures are not evidence for a RAM guarantee. This is a recorded technical prerequisite, not an invented user decision or an implementation-ready capacity claim.

The eventual technical design must also specify action/context metadata at all mutation entry points, continuous-group finalization/redo bookkeeping, and safe coordination with clean sessions, mounted gestures and stale asynchronous guards. No snapshots, inverse commands, patches, library or history-store ownership mechanism is selected here. Preserve the existing architecture's single data writer and transient UI boundary.

## Risks and integration points

| Risk | Relevant integration point or validation |
| --- | --- |
| Missing a mutation entry path | Common `applyWorkspace`/`commit` boundary, including the separate file-action injection in `BaselinePage`; carry action intent and grouping from focused commands if needed. |
| Restoration corrupts references or omits shared field changes | Complete domain validation plus cascade/import round trips; retain IDs and layout. |
| Native text undo instead rewinds the map | Editable-target and composition handling at the client keyboard boundary. |
| Restored data clashes with retained drafts, reviews or stale async requests | Session controllers, transition guards, context stamps, review recomputation and gesture cancellation; revalidate after asynchronous waits. |
| Historical traversal recursively creates history or clears redo | Distinguish accepted new edits from traversal and storage retry without selecting a mechanism yet. |
| A late write resurrects an undone state or falsely reports Saved | Preserve single writer, ordered snapshots and newest-revision feedback; test delayed writes and failures. |
| Many wheel/key events or large imports exhaust memory | Explicit transaction boundaries and bounded history policy, informed by representative workspace sizes. |
| History retention discards unexpectedly large parts of a session | Bound count and memory, indicate reduced depth, and require explicit consent for an oversized non-undoable baseline. |
| A future implementation accidentally serializes session history | Keep JSON and backup formats unchanged; verify session reset and interchange contracts. |
| Undo appears ineffective because its target is on another map | Apply the confirmed view/selection policy and meaningful action/target feedback. |

## Acceptance scenarios for the agreed product decisions

1. Each retained, in-scope applied action can be undone and redone, restoring exact previous/next domain data, layout and identifiers. Validation remains satisfied throughout. Initial creation and explicitly accepted oversized-operation baselines are the documented exceptions.
2. One long drag undoes in one step. A held adjustment key and same-target/property wheel events less than 300 ms apart each form one step. Release, 300 ms inactivity and the agreed context interruptions end grouping. Net-zero groups, canceled previews, invalid Apply and clean Apply do not consume history or clear redo.
3. Undoing a deletion restores nested contents, routes, Station links, field values, layout and surviving Orbit ordering. Redo removes the same footprint without identity drift.
4. Undoing an ordinarily retained import restores both pre-import entities and shared settings; redo restores the same imported IDs without another destructive review. Prior retained actions remain reachable across that import and JSON/SVG/PNG exports; JSON has no history payload.
5. New applied edits after Undo clear redo. Merely switching maps, exporting, retrying save or typing an unapplied draft preserves it.
6. Dirty drafts, pending review/confirmation and active gestures disable global traversal without silent resolution or a late callback overwriting restored data.
7. Saving/error state disables global traversal until the latest applied state is successfully saved. A started traversal displays its result immediately; a failed write leaves it visible with the matching history position and recovery options. Retry saves that state without moving history. Late acknowledgements cannot report another state saved or enable traversal prematurely.
8. Buttons and shortcuts agree. Native input/textarea/contenteditable undo changes text only; modifier variants, handled events, IME and repeat policy behave as agreed. Controls remain reachable on compact screens.
9. Retained history never exceeds 100 action entries or the technical design's specified memory budget. Eviction updates available depth and feedback. Canceling oversized-operation consent preserves all current data/history; explicit continuation applies a new non-undoable baseline and clears both sides. Pre-application validation/preparation failure never resets history. A later save failure follows the ordinary recovery contract.
10. Traversal shows the agreed map/target, with surviving-parent/empty-selection fallback, minimal target reveal and stable focus. Clean sessions cannot expose stale values after restoration. Old zoom and panel layouts are not replayed.
11. A newly created workspace starts with no undo to welcome. Reload, editor exit/re-entry, identity change and backup restore reset history; navigation, panel hiding and responsive child-map remounts preserve it.
12. Undo/Redo controls remain directly reachable on compact and desktop layouts and communicate their next action/target and unavailability reason. Shortcuts process one physical press, respect IME/modals/handled events, never fall through from editable text and never queue blocked commands.

## Verification required for a later implementation

No runtime tests were run for this read-only code investigation and planning-only change.

- Focused deterministic tests for state transitions, the 300 ms grouping boundary, held-key interruption, net-zero groups preserving redo, branching, count/memory eviction and exact restoration; exercise the real action boundary rather than implementation-shaped stubs.
- Controller tests for draft/guard cancellation, stale asynchronous contexts, invalid/clean Apply and restored/deleted targets.
- Browser journeys for gesture granularity, cross-map chronology, cascade deletion, field changes, import/export, shortcuts in editable and noneditable contexts, and desktop/compact controls.
- IndexedDB failure/delay scenarios for disabled traversal during saving/error, failure after traversal publication, retry without replay, stale acknowledgements and reload. Check that exported files exclude history and that only applied durable data returns after reload.
- Test oversized-operation consent cancellation, explicit baseline reset, validation failure before publication and storage failure after publication. Measure representative larger workspaces against the numerical budget chosen before implementation; do not infer this from the small fixtures.
- Reuse existing scenarios in `workspace-system-gesture-arbitration`, `workspace-system-manipulation`, `workspace-reviewed-deletions`, `workspace-reviewed-imports`, `workspace-entity-sessions`, `workspace-fields-lifecycle`, `workspace-chart-drafts`, `workspace-clean-save`, `workspace-recovery` and `issue-15-stale-object-state` as regression coverage.
- Select lint/typecheck/build/integrated suites according to [verification guidance](../../docs/agents/testing.md). Validate relevant physical keyboard behavior separately from browser emulation if claimed.

## Resolution

Product framing is complete and validated by the user's Q21 answer on 2026-10-27. Local `status: closed` refers only to this framing activity: GitHub issue #5 remains open and the feature has not been implemented.

The delivered artifact records source/baseline, inspected behavior, confirmed scope and exceptions, integration points, risks, acceptance scenarios and required verification. Its 24 local documentation links were checked successfully. Runtime tests were not applicable to this documentation-only work.

A later authorized technical-design phase must select the history mechanism and ownership, specify the numerical memory budget/accounting and larger-workspace evidence, and detail mutation metadata/grouping/session coordination before implementation. No implementation tickets, source changes, commits, pushes, PRs or GitHub issue updates were created for this framing activity.
