---
title: Undo and redo for applied workspace changes
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Undo and redo for applied workspace changes

## Source issue

- [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), fetched through `gh` on 2026-10-27, including body, comments, state and labels. It remains open with `enhancement` and `priority:P1`; there are no comments and no scope changes since framing.
- The source requests all map mutations in an action stack, Undo/Redo buttons and keyboard shortcuts, and traversal across imports/exports. User-confirmed refinements are session-only history, initial creation as a baseline, bounded retention, and explicit consent for an oversized non-undoable baseline.
- [Undo/redo product framing](framing.md) preserves the complete investigation and answers Q1–Q21. Q21 approved the product contract, including saved-state gating and explicit oversized-operation continuation. The stories and verification matrix below express the resulting acceptance requirements.
- GitHub remains authoritative for intake/global completion; this local specification is authoritative for this effort. No remote issue write is requested.
- A final source read before specification completion on 2026-10-27 confirmed the body, labels, open state and empty comments were unchanged.
- During ticket planning the user requested a history-consultation view and then explicitly approved read-only consultation plus publication of eight local tickets on 2026-10-27. This supersedes the original no-history-list scope; the original framing is preserved as historical evidence rather than rewritten.

## Problem Statement

The Warden can accidentally move, resize, rename or delete map content, change shared fields, or import data whose effects they later want to reverse. The editor currently has no action history. Recovery backups protect storage integrity but do not let the Warden step backward and forward through editing intentions.

Undo/Redo must restore complete valid data, including dependencies and shared settings, without confusing unapplied drafts with applied changes or in-memory success with successful local saving.

## Solution

Provide one chronological history for applied changes in the current workspace across Jump Cluster and system views. Each complete operation forms one step; continuous same-target adjustments are grouped. Show directly reachable Undo/Redo controls and shortcuts that preserve native text editing.

Traversal starts only from successfully saved data with no pending editing/review work. Its restored result appears immediately and is saved through the existing ordered writer. Save failure retains that result and offers recovery while further traversal is disabled.

Retain up to 100 steps within a defined encoded-history capacity. Explain reduced retention. An operation too large for one retained step requires explicit consent to continue as a non-undoable baseline clearing all history. History lasts only for the editing session and is not exported or recovered from JSON/backups.

Offer a read-only History view near Undo/Redo on desktop and compact screens. Show the retained action sequence, current position and Redo portion without changing applied data, drafts, selection or the history position. This is consultation of the bounded session history, not an audit log or direct traversal by clicking a row.

## User Stories

1. As a Warden, I want one history across Jump Cluster and system maps, so that Undo reverses my latest retained editing action.
2. As a Warden, I want to undo and redo system creation and movement, so that the same systems and map positions can return.
3. As a Warden, I want to undo and redo object creation, movement and placement, so that positions, Orbit membership and angles return together.
4. As a Warden, I want to undo and redo Orbit creation, resizing, rotation, ordering, host changes and detachment, so that dependent placements remain consistent.
5. As a Warden, I want to undo and redo Jump Route creation, edits and removal, so that endpoints, jump levels and unresolved destinations return together.
6. As a Warden, I want to undo and redo Cluster and system name changes, so that accidental renaming is recoverable.
7. As a Warden, I want native/custom field values restored exactly, including zero, false and empty text, so that Undo preserves my actual data.
8. As a Warden, I want to undo and redo field-definition changes, so that types, choices, applicability and affected values are restored together.
9. As a Warden, I want one completed drag to form one step, so that I do not undo every intermediate pointer position.
10. As a Warden, I want a confirmed numeric placement to form one step, so that previews do not create history noise.
11. As a Warden, I want one form Apply to form one step, so that related fields return together.
12. As a Warden, I want creation and a subsequent modified form Apply to remain separate steps, so that undoing edits can leave the created entity in place.
13. As a Warden, I want applying a draft before a later deletion/import to remain a separate step, so that each applied intention can be reversed independently.
14. As a Warden, I want canceled, invalid, clean and no-op operations to preserve history and Redo, so that unchanged work does not destroy my forward path.
15. As a Warden, I want one held adjustment key to form one step, so that a long adjustment can be reversed once.
16. As a Warden, I want continuous same-Orbit/property wheel adjustments to form one step until a 300 ms pause, so that wheel input does not flood history.
17. As a Warden, I want key release, focus loss, target/property/map changes and another operation to complete the current adjustment group, so that the final adjustment is retained before I move on.
18. As a Warden, I want a group returning exactly to its initial values to preserve Redo, so that net-zero experimentation does not erase it.
19. As a Warden, I want a deletion and its entire cascade to form one step, so that contents, routes, Station links, layout and surviving Orbit order return together.
20. As a Warden, I want restored entities to keep their identities and relationships, so that subsequent edits reference the same content.
21. As a Warden, I want one confirmed ordinary import to form one step, so that imported copies and changes to shared settings can return together.
22. As a Warden, I want prior retained actions reachable after imports/exports, so that exchanging files does not unexpectedly reset history.
23. As a Warden, I want exports to contain applied map data without drafts/history, so that existing interchange remains compatible.
24. As a Warden, I want a new applied edit after Undo to remove the old Redo branch, so that forward history remains unambiguous.
25. As a Warden, I want navigation, exports, save retries and unapplied typing to preserve Redo, so that activities without new applied data do not erase it.
26. As a Warden, I want traversal blocked by any modified draft, gesture, preview, review or confirmation, so that unfinished work is never silently overwritten.
27. As a Warden, I want an unavailable reason and a way to finish/apply/discard/cancel pending work, so that I can resolve the blocker deliberately.
28. As a Warden, I want traversal to wait until the latest applied state is saved, so that it starts from known durable data.
29. As a Warden, I want an authorized traversal result displayed immediately and then saved, so that the restored map appears promptly.
30. As a Warden, I want a failed traversal save to retain its visible result and history position, so that storage failure does not silently reverse what I saw.
31. As a Warden, I want Retry to save current applied memory without repeating an action or traversal, so that recovery cannot duplicate content.
32. As a Warden, I want stale write acknowledgements to leave the latest save state authoritative, so that traversal never becomes available prematurely.
33. As a Warden, I want traversal to show the affected map and target, so that changes on another map are understandable.
34. As a Warden, I want a surviving-parent or empty-selection fallback after removal, so that the editor never points at missing entities.
35. As a Warden, I want clean forms refreshed/closed after traversal and usable focus retained, so that I cannot apply stale values.
36. As a Warden, I want only enough camera adjustment to reveal a target, so that traversal does not replay old zooms/panel layouts.
37. As a Warden, I want next-action/target labels on directly reachable desktop/compact controls, so that I know what Undo/Redo will do.
38. As a Warden, I want Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and Cmd equivalents, so that I can use familiar shortcuts.
39. As a Warden typing in an editable field, I want native text history to retain ownership even when empty, so that a text shortcut never changes the map.
40. As a Warden, I want one traversal per physical press that respects IME, modals and handled events, so that held keys/composition cannot trigger unexpected traversal.
41. As a Warden, I want a blocked shortcut discarded rather than queued, so that no delayed Undo runs after another task ends.
42. As a Warden, I want up to 100 retained steps under bounded history capacity with visible depth reduction, so that long sessions do not grow retention without limit.
43. As a Warden facing an oversized action, I want Cancel or explicit continuation clearing all history, so that losing Undo/Redo is deliberate.
44. As a Warden, I want canceled consent and validation failure before application to preserve data/history, so that preparation cannot destroy my recovery path.
45. As a Warden, I want accepted oversized operations identified as non-undoable new baselines, so that the exception is understandable.
46. As a Warden, I want fresh history after initial creation, editor exit/re-entry, reload, identity changes and backup recovery, so that I never traverse another session's obsolete history.
47. As a Warden, I want navigation, panel hiding and responsive reflow to preserve history, so that presentation changes do not reset it.
48. As a Warden, I want Redo to restore the same confirmed destructive result without another consequence review, so that forward traversal is predictable on an unchanged branch.
49. As a Warden, I want to open a history view near Undo/Redo on desktop and compact screens, so that I can consult the actions retained in this editing session.
50. As a Warden, I want chronological action/target labels, the current position and a distinct Redo portion, so that I can understand what has been applied and what could be restored.
51. As a Warden, I want history consultation to leave data, drafts, selection, saving and history position unchanged, so that inspecting my work cannot accidentally edit or traverse it.
52. As a Warden, I want readable empty/reset/truncated-history feedback and usable focus when opening/dismissing the view, so that the bounded session history remains understandable and accessible.
53. As a Warden, I want the history view to reflect applied actions, Undo/Redo, branch removal, retention eviction and baseline resets, so that its read-only information stays current.

## Implementation Decisions

### Ownership and interface

- Introduce one page-owned editor-session history coordinator around the already injected workspace-application interface. Keep the timeline/cursor in a framework-independent module. The coordinator owns proposal execution, Undo/Redo, group completion, capacity consent and reset, exposing read-only availability, next-action labels and retained depth.
- Inject the same history-aware application interface into every focused editing command and file-import workflow. Initial creation, hydration and backup recovery establish baselines explicitly. Keep the raw writer private to composition/initialization/traversal so ordinary commands cannot bypass recording.
- The existing workspace owner retains hydrated/current data, validation, the ordered IndexedDB queue, retry and revision-based saving status. Historical encoded values are restoration material, not a second mutable workspace or Pinia persistence layer. No new save path, schema version, portable format or external history dependency is needed.
- Action descriptors contain bounded semantic kind/label, workspace/Cluster identity, target/system identifiers and surviving-parent context. They retain no domain-object references, browser handles or full descriptions. Use monotonic applied-data revisions and operation/session identities for stale-request checks.
- Keep low-level memory application synchronous with an independent durable acknowledgement. Evolve only mutation-command interfaces that can encounter capacity consent to an explicit asynchronous applied/unchanged/rejected result. In particular, session Apply and transition resolution must await that result rather than interpret pending consent as success, failure or Discard. Preserve legacy durable-await adapter semantics.
- Closing a draft/review, selecting a newly created target or continuing navigation occurs only after confirmed memory publication. Read-only operations and pure domain calculations do not become asynchronous merely because mutation consent exists.

### Restoration representation

- Use a linear timeline with a cursor, N action edges and N+1 complete normalized workspace snapshot nodes. Adjacent actions share their common node. Undo/Redo restores a selected node; it never reexecutes creation/import routines or allocates replacement identities.
- Canonical JSON encoding sorts object keys after normal domain normalization/validation, preserving array order and exact domain values. Equal canonical snapshots are no-ops. Store snapshots and descriptors as standalone exact-length UTF-8 byte buffers, not retained decoded timeline objects or subarray views of larger unaccounted buffers.
- When history is empty, retain no encoded baseline; current data already has an owner. Prepare current/candidate encodings transiently when the next action is proposed. Decode/validate only the snapshot needed for restoration.
- Complete snapshots are chosen because cascades, Fields changes and imports already compute complete validated proposals. This avoids separate inverse operations for each mutation family and makes restoration cover layout/shared settings consistently. Structural patches or inverse commands remain alternatives only if later evidence justifies their additional correctness obligations.

### Preparation, publication and failure

1. Capture identity, monotonic applied revision, originating operation/session and complete action intent; compute and validate the next workspace against current data.
2. Encode current/candidate data, detect a no-op and calculate a virtual timeline plan: drop Redo for an accepted edit, append its edge, then evict eligible oldest prefix edges/nodes until capacity fits. Do not mutate actual data/history during preparation.
3. If even one complete edge cannot fit, request explicit capacity consent before publishing data, clearing Redo, evicting entries or reporting application success.
4. After any await, recheck identity/revision, operation/session ownership and consequence signature. Recompute stale proposals through their owning command and renew ordinary consequence/capacity review when the authorized effects change.
5. During synchronous publication, use a reentrancy/busy guard, invoke the existing writer, install the prepared timeline/cursor and release the guard. History consumers cannot execute against an intermediate state. All fallible encoding/allocation work is completed before publication; installation is an already prepared state swap.
6. Preparation/validation or writer validation failure before memory publication preserves data/history. After publication, keep history consistent with visible memory. Durable write failure does not roll either back; it blocks traversal and leaves Retry/Export available.

### Continuous adjustments

- Implement held-key/wheel groups as explicit live geometry previews followed by one final workspace publication. This engineering choice supplies the validated grouped behavior while naturally preserving Redo for net-zero groups and avoiding per-event consent or saving.
- Finalize on key release, 300 ms wheel inactivity, target/property/map change, focus loss or another operation. Finalize before the following command/navigation/export consumes applied data. Normal interruption retains the final adjustment through publication; a net-zero preview publishes nothing.
- If the finalized group needs capacity consent, retain its unapplied proposal and suspend the following operation. Cancel discards only that unapplied group and returns its preview to prior applied data. Continuing revalidates before publication. Do not show consent once per input event.
- Keep existing pointer-drag cancellation behavior distinct from normal key/wheel finalization. Browser effects/timers stay with their lifecycle owner; retain pending group ownership above responsive child-renderer remounts when needed so reflow cannot silently discard or split it.

### Encoded capacity and oversized consent

- Set the initial policy to **32 MiB (33,554,432 bytes)** of retained encoded history and **100 action edges across Undo and Redo together**. This is a deliberately chosen encoded-retention default, not a measured browser-heap or device-safety guarantee.
- Sum the exact backing-buffer lengths of every retained canonical snapshot and descriptor, counting each shared node once. Count the baseline required by the oldest retained edge. Standalone buffers must not hide larger retained backing allocations. Object/typed-array overhead, live applied data, transient preparation/decoding/import buffers and existing queued-save snapshots are outside this encoded-payload budget; their runtime behavior still needs measurement.
- Evict only a contiguous oldest undo prefix on an accepted new edit, preserving a complete before/after pair for its new edge. Do not remove a middle edge or skip an unrecorded mutation. Actual eviction and Redo clearing happen only with accepted memory publication.
- If before + after + descriptor exceeds the budget even alone, offer Cancel or explicit **continue and clear history**. Cancel preserves the entire prior timeline/data. Continuation applies the operation and clears both sides, retaining no over-budget encoded baseline. A subsequent small edit can still require consent when its complete before/after pair exceeds capacity.
- Consent is not permission to bypass ordinary validation, draft guards or changed consequence review. Failed preparation before application preserves history. A later save failure after accepted baseline publication retains that baseline in memory with ordinary recovery options.
- Serialization/allocation failure is an error, not automatic history-loss consent. This policy does not add a general file-size limit or guarantee that arbitrarily large imports can be parsed/rendered.

### Traversal and pending work

- Enforce availability at both UI and command entry: the requested history side exists, the latest applied revision is successfully saved, and no modified draft anywhere, editing gesture, preview, consequence review, pending confirmation or modal context blocks traversal. Show the reason without implicit Apply/Discard or delayed execution.
- Restore/validate the selected node, publish through the same writer and move the cursor with that immediate memory result. Disable further traversal during its saving/error state. Retry saves latest applied data without replaying a command, adding an entry or moving the cursor.
- Existing ordinary edit permissions during saving/error remain unchanged. A newer accepted edit creates the appropriate new branch; only its latest durable acknowledgement can reenable traversal. Older success/failure notifications cannot replace current saving status.
- Invalidate stale operation epochs on traversal/reset and recheck after awaits, even when selection identifiers still match. Explicitly end/refresh obsolete clean sessions; modified sessions are blockers, never silently discarded.

### UI, lifetime and compatibility

- Expose one guarded command pair to buttons and shortcuts, reusing existing map command composition and Nuxt UI controls. Keep commands directly reachable on desktop/compact screens with next-action/target labels and accessible empty/blocked reasons.
- Add a named History entry near those controls, exposing a responsive read-only view of retained action/target summaries, current position and Redo portion. Publish these summaries through the coordinator's read-only interface; do not expose mutable timeline internals, decode all snapshots to render rows, or keep a second history stack.
- Opening/reading/closing History does not mutate data, history position, selection, save queue or drafts, and rows do not initiate traversal. Consultation does not require a successful save or resolve a draft; preserve existing modal ownership/focus rules. Explain empty/baseline, truncated and reset states, update the list when retention/branching changes, and return focus to its trigger on dismissal.
- Show system/route actions and imports in Cluster view; object/Orbit actions in their system; shared Fields actions globally in the current view. Select an existing target, surviving parent or nothing as appropriate. Reveal off-screen targets minimally without historical camera/panel replay; retain initiating-control focus or a stable map fallback.
- Support Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z and Cmd+Shift+Z. Ignore auto-repeat, composition and handled events; respect modal ownership. Editable descendants/contenteditable retain native Undo/Redo even when their text history is empty.
- Reset after initial creation, editor exit/re-entry, hydration/reload, workspace/Cluster identity change and backup recovery. Initial creation cannot be undone to welcome. Navigation, panel hiding, resizing and child-map remounts preserve history.
- Exports and save retry do not record actions. Keep JSON/IndexedDB formats and existing ID-remapped import, reviewed deletion, final-system protection, save recovery and departure-warning contracts.

## Testing Decisions

### Confirmed main behavioral seam

Use the history-aware command/read-only status interface as the main test seam: propose an action, Undo/Redo, complete a group, resolve capacity consent and observe applied data, availability, labels and depth. Use real history planning, normalization and domain validation, with controllable time and writer durable acknowledgements through the already injected application interface. Do not add another persistence abstraction merely for testing.

Supplement that seam with existing real IndexedDB regressions and public browser journeys for actual adapters. Test externally observable restoration, refusal, preservation and recovery, rather than private arrays/cursors, helper call counts, implementation-shaped mocks or stubbed store actions.

The user explicitly approved these testing seams through the Codex question form on 2026-10-27: the main command/read-only interface with real validation and controllable saving, supplemented by real IndexedDB tests and public browser journeys in the existing Playwright runner.

The approved consultation extension uses the same read-only interface for list summaries/current-position/Redo updates and public browser journeys for opening/dismissal, unchanged data/drafts/history, reset/truncation feedback and desktop/compact focus/layout. It adds no test-only history installation or separate runner.

| Behavior | Required observable evidence |
| --- | --- |
| Coverage and exact restoration | Round-trip every mutation family, cascading deletion and import, comparing normalized data, identifiers, links, order, layout and shared settings. |
| Failure atomicity | Invalid preparation, rejected consent and synchronous writer rejection preserve applied data and both history sides; post-publication failure retains new visible data with matching history eligibility. |
| Granularity and branching | One drag/form/cascade/import per step; creation plus modified Apply remain separate; no-ops/cancellations preserve Redo; new accepted edits clear it. |
| Continuous groups | Held-key release, 299 ms versus 300 ms wheel timing, focus/context interruption and reflow; live preview becomes one application; net-zero groups preserve Redo. |
| Save gate | Latest saving/error blocks command, button and shortcut traversal; Retry/current-success reenables only eligible history; stale acknowledgements do not. |
| Capacity | Exactly-at/over 100 edges, exact encoded-byte boundary, Unicode and descriptor bytes, counted shared nodes/baselines, oldest-prefix eviction and contiguous restoration. |
| Oversized exception | Cancel without eviction, explicit baseline reset, no retained oversized baseline, stale/changed consent revalidation and save failure after accepted publication. |
| Pending work | Hidden/unrelated modified drafts and pending previews/reviews/modals block traversal; clean sessions cannot later apply stale values; no deferred shortcut. |
| Context and keyboard | Cross-map target/fallback, global Fields feedback, focus and minimal reveal; Ctrl/Cmd variants, editable descendants, empty text history, contenteditable, IME, repeats and handled events. |
| Lifetime and interchange | Preservation through navigation/panels/reflow/exports; reset at approved baselines; JSON without history/drafts; retained ordinary imports redo with identical IDs. |
| Read-only history consultation | Chronological action/target summaries and current/Redo markers update after actions/traversal/eviction/reset; open/read/dismiss leaves data, drafts, selection, saving and cursor unchanged; no row-triggered traversal. |

### Prior art and completion evidence

- Use the maintained Playwright runner and pure-check project for deterministic command/history behavior. Follow existing real-action testing patterns; introduce no second runner.
- Reuse the existing storage regression that aborts a real IndexedDB transaction and the delayed-acknowledgement journeys. Observe current data, backup preservation, save feedback and next available traversal.
- Extend entity-session, chart-draft, reviewed-import/deletion, Fields-lifecycle, clean-save, gesture-arbitration and stale-object-state scenarios. Drive real public UI preparation and JSON exports rather than adding a history-installation test endpoint.
- Generate valid larger workspaces with multiple systems, nested Orbits, routes, shared Fields and long multibyte text around capacity thresholds. Record exact retained encoded bytes/depth and application/traversal latency before implementation completion; observe heap separately. Tiny existing fixtures do not establish large-campaign performance or a heap guarantee.
- For eventual implementation complete lint, typecheck, production build and one integrated full suite, including affected deterministic, real-storage, browser and desktop/compact smoke checks. Obtain independent restoration/persistence review under the repository Sensitive route.
- Browser emulation verifies browser interaction and responsive layout; report physical keyboard, operating-system shortcut and screen-reader evidence separately when claimed.

## Out of Scope

- Product implementation, commits, pushes, PRs, merges or GitHub issue/label changes during planning. Local implementation-ticket publication was separately authorized through the approved ticket breakdown.
- Durable/portable history, restored drafts, new data-format versions/migrations, remote storage or a parallel save queue.
- History for camera, panels, selections, tools, theme or exports; multiple Redo branches; direct traversal by clicking a history row; sharing history across sessions/workspaces or an unbounded audit log.
- Replay of creation/import code during traversal, silent history loss, automatic modified-draft resolution or silent unrecorded oversized application.
- Redesigning ordinary edit permissions during save errors, changing existing pointer-drag cancellation, multi-selection or unrelated #15/#16 work.

## Further Notes

### Baseline and evidence

- Starting framing reference: `c84988be4f7ee2b83c509f5323791d3b7a9532ee`. Actual analysis/specification baseline: **`9edfa66c4f505d56f106fc4af8245f200abfba78`**, equal to freshly fetched `origin/main` on 2026-10-27. The isolated worktree remains zero commits ahead/behind; no intentionally different base is used.
- Local `main` is checked out in the separate primary checkout and was left untouched. Other worktrees/branches, existing untracked environment configuration and parallel correction processes remain outside this effort.
- The original closed framing was preserved byte-for-byte before replacing its former location with this specification. Technical choices here, including snapshot representation, explicit group previews and 32 MiB accounting, are engineering decisions made during `to-spec`, not invented answers to the product interview.

### Trade-offs and readiness

Complete encoded snapshots trade serialization/retention cost for one exact restoration representation covering cascade/import/Fields effects. Inverse commands or structural patches might retain more steps for large workspaces, but add per-family inverse or diff/identity correctness obligations without current evidence that this complexity is required. Keep the public interface and validated product contract stable if later measurements justify changing representation.

The 32 MiB policy bounds retained encoded payload, not the JavaScript heap, active workspace, import parser, transient proposals or queued writes. Larger-workspace validation is required evidence, not a benchmark already performed. Some sessions retain fewer than 100 steps, and very large workspaces may need repeated explicit baseline consent.

A read-only architect consistency check found no material gap between the original specification, the validated product decisions and the proposed publication/grouping/capacity contracts. The later user-approved consultation extension adds stories 49–53 without changing that transaction architecture. Documentation checks cover required sections, local links, sequential stories and absence of implementation-file paths/code snippets in Implementation Decisions. The validated framing remains preserved as a separate artifact.

### Specification completion

The specification is complete and published locally after the user's explicit testing-seam approval on 2026-10-27. Local triage roles are `enhancement` and `ready-for-agent`; lifecycle `status: open` means the specified effort is available for subsequent planning/implementation, not that this specification is still being drafted or that the feature is implemented.

The user subsequently invoked `to-tickets` and approved the revised eight-ticket breakdown, including read-only History consultation. The [approved ticket plan](ticket-plan.md) and [implementation tickets](tickets/index.md) preserve the contract and genuine blocking dependencies. No GitHub labels/state were changed. Implementation, commits, pushes and PRs remain outside this planning authorization. No runtime tests or performance experiments were run for this documentation/design activity.
