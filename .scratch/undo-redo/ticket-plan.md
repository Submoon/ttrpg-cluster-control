---
title: Undo/redo implementation ticket plan
status: closed
---

# Undo/redo implementation ticket plan

This eight-ticket breakdown was explicitly approved by the user through the Codex question form on 2026-10-27, including read-only history consultation. The separate [implementation tickets](tickets/index.md) are published locally. This planning activity is complete; product implementation is not authorized.

## Source and baseline

- Parent specification: [Undo and redo for applied workspace changes](spec.md). The original decisions/test seams remain in force except that the user explicitly added read-only history consultation, superseding the earlier no-history-list scope. The specification records this amendment and new stories 49–53; the original framing remains historical evidence.
- Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5). Body, comments, state and labels were re-fetched on 2026-10-27: unchanged, open, no comments, `enhancement` and `priority:P1`.
- Actual baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to freshly fetched `origin/main` on 2026-10-27, zero commits ahead/behind. No intentionally different base is used. Other checkouts, branches and processes remain outside this effort.
- Publication destination: one English Markdown ticket per implementation slice under this effort's `tickets/` directory, using the existing local lifecycle/frontmatter and separate triage roles. No GitHub sub-issues, comments or labels are created.

## Approved breakdown

1. **Prepare truthful mutation outcomes and action context** — blocked by none. A behavior-preserving prerequisite makes all editing commands report application accurately before history is exposed.
2. **Undo and redo saved changes through the shared coordinator** — blocked by 01. Direct buttons reverse a saved edit through complete recorded data, bounded capacity, explicit consent and the existing save/recovery flow.
3. **Restore useful context without stale drafts** — blocked by 02. Traversal reveals the correct map/target and keeps forms, blocker feedback and focus coherent.
4. **Group continuous keyboard and wheel adjustments** — blocked by 02. One held key or wheel sequence becomes one reversible adjustment, including interruption and net-zero behavior.
5. **Restore deletion cascades and shared Fields effects** — blocked by 02. Reviewed destructive changes restore their entire footprint and cannot publish stale reviewed effects.
6. **Traverse reviewed imports and exports with exact identity** — blocked by 02. Import copies and shared-setting effects restore together; exports and storage retry preserve the intended history.
7. **Complete keyboard and compact interaction** — blocked by 03. Shortcuts, native text history and accessible compact/desktop controls use the same guarded commands and context behavior.
8. **Inspect retained session history** — blocked by 02. A directly reachable desktop/compact view shows retained action labels/targets, the current position and the Redo portion without changing applied data or traversing history.

Only 01 is a prefactoring prerequisite rather than a new product feature. Tickets 02–08 each deliver a complete observable behavior through command/data ownership, relevant UI and behavior tests; they are not separate storage, UI and test layers.

## Safety and dependency rationale

The first working history must record every applied mutation, including the separately composed import path. Ticket 01 introduces required action descriptors and truthful applied/unchanged/rejected outcomes for every current entry. Ticket 02 then records all mutations centrally from day one. Tickets 05/06 complete family-specific review/consent behavior and restoration evidence; they do not enable previously missing recording. There is no temporary silent reset, unsupported-mutation barrier or unrecorded-edit hole.

Ticket 02 includes global pending/modified-draft blockers, minimal safe clean-session teardown, revision-checked capacity consent and reset semantics. These are a safety floor, not work deferred to 03. Ticket 03 supplies richer map/target/focus behavior and controller-specific preservation.

Ticket 02 is the largest slice but is limited to the generic history transaction plus a representative name-edit/map-move journey. Detailed family scenarios, richer context, continuous grouping and complete keyboard/compact composition remain independently verifiable later slices. Retain its whole safety floor if subdividing it is proposed; do not split away guards or capacity from exposed traversal.

The direct graph is `01 -> 02`, `02 -> 03/04/05/06/08`, `03 -> 07`. Imports do not depend on the new Fields ticket because compatible field import/domain operations already exist. Deletion/Fields do not depend on detailed context refinement because basic safe teardown and recording already exist in 02. Keyboard/compact completion depends on 03's context/focus contract, not on unrelated mutation families. Read-only history consultation needs 02's retained descriptors/status, not 03's target navigation or 07's shortcut work; 08 owns its own accessible desktop/compact presentation.

These are behavioral blocking edges, not permission for concurrent overlapping source edits. The coordinator must serialize shared composition, session and renderer work, or assign disjoint ownership according to repository rules. There is no new dependency merely because two tickets might touch the same module.

## Ticket detail

### 01 — Prepare truthful mutation outcomes and action context

**Blocked by:** None (can start after a separate implementation instruction).

**What it delivers:** Existing creation, form Apply, placement, deletion, Fields and import behavior remains intact while every mutation uses one descriptor-bearing application contract. Sessions and transitions distinguish pending/rejected/unchanged work from actual memory publication.

**Acceptance criteria:**

- All current applied-data entry points, including separately composed file actions, use the shared contract with bounded semantic action/target/context metadata; initialization/hydration/backup restore remain explicit baseline operations.
- Keep synchronous low-level memory publication and separate durable acknowledgement. Evolve only mutation-facing contracts that may await consent, including session Apply and transition resolution; preserve existing durable-await semantics where used.
- Draft/review closure, created-target selection and navigation continuation happen only after actual memory application. Rejection or a pre-application failure retains the initiating work and its context.
- Preserve operation/session identities and preparation/revalidation hooks for future consent; no hidden asynchronous success is reported by a synchronous boolean.
- No history controls or behavior are exposed yet. Existing Apply/Discard/Stay, clean Apply, failed-save memory retention, Retry, reviewed import/deletion and draft-preservation journeys remain valid.
- Run relevant behavior checks and static checks; this prerequisite is green and verifiable on its own, not a wide refactor awaiting a later repair ticket.

### 02 — Undo and redo saved changes through the shared coordinator

**Blocked by:** 01.

**What it delivers:** After a saved name change or map move, the Warden can use directly reachable Undo/Redo buttons to restore exact data, observe immediate results and recover from save failure. Every applied mutation participates in the same session history, even before later family-specific refinements.

**Acceptance criteria:**

- A page-owned coordinator wraps the sole writer; a framework-independent timeline restores canonical complete snapshots with original identities. No Pinia workspace copy, replayed creation/import, extra persistence path or format change is introduced.
- Record every shared-contract publication, not only the demonstration actions. No-ops/canceled/rejected preparation preserve both sides; new accepted actions after Undo clear Redo; traversal/retry/export do not append actions.
- Enforce at most 100 edges and 33,554,432 retained encoded bytes, counting standalone UTF-8 snapshot/descriptor backing buffers and shared baseline nodes correctly. Virtual prefix eviction occurs only with successful memory publication, with visible reduced-depth feedback.
- Provide the common explicit oversized-consent UI. Cancel and pre-publication failure preserve data/history; continuation applies a non-undoable baseline and clears both sides without retaining an over-budget baseline. Recheck identity/revision after consent; reject stale continuation safely until its owner recomputes.
- Buttons and command entry require the latest saved applied revision and no modified draft anywhere, gesture/preview, review, pending confirmation or blocking modal. Show why unavailable; never implicitly resolve or queue work. Tear down obsolete clean sessions safely from this first exposed slice.
- Publish a traversal result and matching history position together under a busy guard; a later write failure retains both, blocks traversal and offers Retry/Export. Retry saves current memory without replay; older acknowledgements cannot enable traversal or replace newer feedback.
- Initial creation, editor exit/re-entry, reload/hydration, identity change and backup restore reset history. Navigation, panel hiding and reflow preserve it; initial creation cannot be undone into welcome.
- Demonstrate the complete public button journey and use the approved command test seam for branching, atomic failure, Unicode/exact count-byte boundaries, baseline accounting, cancellation and stale consent. Use real IndexedDB failure/delay evidence for saved-state gating and retry.
- Exercise representative larger valid workspaces for retention/latency evidence. Distinguish encoded capacity from heap observations; record results without claiming a RAM guarantee.

### 03 — Restore useful context without stale drafts

**Blocked by:** 02.

**What it delivers:** Undo/Redo across ordinary system/route/object/Orbit edits reveals the affected map and target, handles removed targets sensibly, and keeps forms/focus coherent rather than restoring data into a stale interface.

**Acceptance criteria:**

- Systems/routes reveal Cluster context, objects/Orbits their system, with original or surviving-parent/empty selection as appropriate. Shared Fields changes use global feedback in the current view.
- Reveal an off-screen target only as needed, without restoring old camera/panel snapshots. Retain initiating-control focus or a stable map fallback.
- Refresh or end stale clean chart/entity/route/Fields sessions explicitly; no retained clean form can later overwrite restored data using an obsolete baseline. Modified hidden or unrelated drafts continue to block traversal.
- Preserve complete form-Apply and confirmed numeric/drag placement boundaries. Creation followed by modified Apply, and draft Apply before a following operation, remain separate entries. Preserve exact field values, placement relationships and layout.
- Make detailed blocker reasons/action labels understandable across map contexts, panel hiding/reopening and responsive reflow; do not weaken 02's safety floor.
- Cover public cross-map system/route/object/Orbit form and placement journeys, missing-target fallback, hidden-session blockers, clean-form refresh and focus, with command-level failure preservation and relevant UI checks.

### 04 — Group continuous keyboard and wheel adjustments

**Blocked by:** 02.

**What it delivers:** A held Orbit adjustment key or continuous wheel sequence shows live geometry and produces one history step, including when interrupted by focus or context changes.

**Acceptance criteria:**

- Use a live preview followed by one complete publication on key release, 300 ms wheel inactivity, target/property/map change, focus loss or another operation. Preserve existing pointer-drag cancellation behavior.
- A net-zero group publishes nothing and preserves Redo. Key/wheel repetition inside a group does not create per-event steps, writes or consent dialogs.
- Finalize before another command/navigation/export consumes applied data. If consent is needed, retain the proposal and suspend the following operation; Cancel discards only that unapplied group and leaves previous data/history intact.
- Revalidate after consent or any asynchronous wait and refuse stale publication. Keep current save-gate/pending-preview blockers active until finalization/save completes.
- Timers/listeners and group ownership survive responsive child-map remounts appropriately and clean up on true session exit; no orphan callback finalizes into a newer session.
- Test key release, 299/300 ms wheel boundary, target/property/focus/map interruption, command/export sequencing, capacity cancel/continue and net-zero Redo preservation through the approved command seam and representative public gestures.

### 05 — Restore deletion cascades and shared Fields effects

**Blocked by:** 02.

**What it delivers:** Reviewed deletion and Fields mutations undo/redo as complete intentions, including their dependent references, values and layout, with safe consequence review after asynchronous consent.

**Acceptance criteria:**

- One confirmed deletion restores/removes its complete recursive footprint: nested Orbits/occupants, routes, Station links, layout entries and surviving Orbit order, with original identities.
- Fields creation/rename/type/options/applicability changes and deletion restore definitions plus every affected value, including zero/false/empty text and assignments that were cleared by destructive changes.
- A draft Apply required before deletion/Fields consequences is its own recorded action; recompute and renew review if those applied changes alter the authorized footprint.
- Recheck operation ownership, revision and consequence signature after capacity consent; stale reviews/continuations cannot overwrite current or restored data. Cancellation and pre-application validation failure preserve the current state/history.
- Redo restores the same confirmed footprint without another destructive review; preserve final-system protection, pending-target cleanup and dirty-draft guards.
- Verify real reviewed deletion/Fields journeys and exact normalized round trips, consent cancellation/changed review, pre-publication failure versus save failure, and Retry without replay, using the common recording/capacity mechanisms rather than new per-family stacks.

### 06 — Traverse reviewed imports and exports with exact identity

**Blocked by:** 02.

**What it delivers:** A confirmed Cluster/system import is one reversible independent copy including shared-setting effects; exports preserve the current timeline, and recovery cannot duplicate imports.

**Acceptance criteria:**

- Preserve existing import validation, preview and independent ID remapping. Ordinary confirmation records one complete action including reused-field applicability and native option-list changes, not just newly added entities.
- Undo restores the pre-import state; Redo restores the same imported IDs/references/layout/settings without rerunning allocation or asking the same destructive confirmation.
- Older retained steps remain reachable across ordinary imports and JSON/SVG/PNG exports. Exports create no history step and include applied map data without drafts/history; formats remain unchanged.
- Capacity consent composes with ordinary import review and draft resolution. Recompute changed plans after asynchronous waits and renew review/consent when effects differ; Cancel/pre-application failure retains data/history and any unrelated draft.
- An explicitly accepted oversized import clears both history sides and creates the documented non-undoable baseline. A later save failure retains it with Retry/Export; Retry never repeats import or creates an entry.
- Cover Cluster and standalone-system imports, matching shared Fields, prior-step traversal, exact-ID redo, canceled/stale consent, unrelated draft preservation, delayed/failed writing and export/reload compatibility through real public import flows and the approved command seam.

### 07 — Complete keyboard and compact interaction

**Blocked by:** 03.

**What it delivers:** Familiar history shortcuts and directly reachable desktop/compact controls consistently use the existing guarded history commands, reveal the correct context and preserve text-editing ownership and usable focus.

**Acceptance criteria:**

- Support Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z and Cmd+Shift+Z through the same command pair; one traversal per physical press, no auto-repeat or queued blocked shortcut.
- Editable descendants/contenteditable keep native text Undo/Redo even with an empty text history; respect IME composition, handled events and modal ownership.
- Desktop/compact controls remain directly reachable near map commands, announce next action/target and empty/blocked reasons, and show reduced history depth or oversized warning accessibly. Keep history consultation in its separate ticket 08.
- Preserve 03's target reveal/fallback and initiating-control focus during keyboard traversal, viewport changes, panel hiding and nested dialogs. Shared Fields changes remain globally understandable.
- Validate supported shortcut variants and editable/noneditable targets with browser journeys, plus compact/desktop action states, layout and hit targets through maintained UI checks. Report any actual physical keyboard or assistive-technology evidence separately from emulation.
- Reuse prior storage/command evidence; do not introduce a second history command, store or test runner for keyboard/compact behavior.

### 08 — Inspect retained session history

**Blocked by:** 02.

**What it delivers:** The Warden can open a history view near the Undo/Redo controls on desktop and compact screens, inspect retained actions and their current/Redo position, then return to editing without changing map data.

**Acceptance criteria:**

- Offer a clearly named History entry near the map's history controls, with a usable responsive view and focus return to its trigger on dismissal.
- Show retained actions in chronological order with meaningful action/target labels; distinguish already applied actions, the current history position and actions available through Redo. Include an understandable initial-baseline/empty state.
- Opening, scrolling, inspecting or closing the view does not change applied workspace data, the history cursor, selection/map context, the save queue, Redo or drafts. Rows do not jump to a historical state.
- Explain that the list is the bounded current session history, not an audit log. Reflect prefix eviction, Redo-branch removal, baseline resets, accepted oversized continuation and session reset promptly, with available-depth/empty/reset feedback.
- Read descriptors through an explicit read-only interface from the existing coordinator; retain no second history stack and decode no full workspace snapshots just to render the list. Count any retained descriptors under the established capacity rules.
- Consultation itself does not apply/discard a draft and does not require a successful save. Preserve existing modal ownership/focus rules; ordinary Undo/Redo availability remains guarded independently.
- Cover list ordering/current-position/Redo updates through the command/read-only interface, and real opening/dismissal, unchanged data/history/drafts, empty/truncated/reset states, focus and desktop/compact layout through public browser journeys.

**Confirmed scope:** The user approved read-only consultation and publication of the resulting eight-ticket plan. Direct traversal by clicking a row is out of scope; this does not change the existing guarded Undo/Redo commands.

## Coverage and completion

| Specification stories | Primary delivery ticket |
| --- | --- |
| 1, 6, 14, 20, 24–32, 42–47 | 02, with family-specific identity/recovery evidence in 05/06 |
| 2–5, 7, 9–13, 33–36 | 03 |
| 15–18 | 04 |
| 8, 19, 48 | 05, with import Redo also covered by 06 |
| 21–23 | 06 |
| 37–41 | 07 |
| 49–53 | 08 |

Ticket 01 preserves the existing behavior needed by all later stories; it does not replace their acceptance evidence. Storage failure, cancellation and stale-context tests belong to each affected slice rather than being deferred wholesale.

After all eight tickets are integrated, complete the specification's lint/typecheck/build and one full integrated suite, including real storage and desktop/compact scenarios. Collect independent Sensitive-route restoration/persistence reviews and close confirmed findings. Reuse successful unchanged evidence, and record unavailable physical-input/performance checks honestly. This completion condition is not an artificial test-only product ticket or an extra dependency edge.

## Resolution

The user first requested a history-consultation ticket in response to the seven-ticket proposal. After that revision, the actual approval was **“Oui, lecture seule et publier les 8 tickets (recommandé)”**, received through the Codex question form on 2026-10-27. This approves all eight tickets and the direct graph, with no other requested merge or split.

The specification was amended explicitly with consultation user stories, implementation/testing decisions and the replacement of the old history-list exclusion. The original framing was preserved; the earlier no-list answer was not rewritten as if it had always allowed consultation.

Eight separate local tickets are published in blocker-first numbering with title, `status: open`, `type: implementation`, `label: wayfinder:implementation`, parent-specification link, and triage roles `enhancement`/`ready-for-agent`. Each includes complete behavior/criteria and titled relative blocking links. Lifecycle status stays separate from readiness; unsatisfied blocking edges determine the executable frontier. No ticket is claimed and no implementation has started. Closing this plan marks planning complete, not GitHub issue #5 or the product feature complete.

Approval permits publication of these planning files only. It does not authorize product implementation, a GitHub issue change, commit, push, PR, merge or changes to another worktree. Fresh source/baseline checks before publication confirmed the issue was unchanged and the worktree still matched `origin/main` at the recorded SHA.
