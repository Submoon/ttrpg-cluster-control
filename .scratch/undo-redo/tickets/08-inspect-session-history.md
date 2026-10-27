---
title: 'Inspect retained session history'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 08: Inspect retained session history

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 49-53, explicitly added and approved during ticket planning.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

The Warden can open a history view near the Undo/Redo controls on desktop and compact screens, inspect retained actions and their current/Redo position, then return to editing without changing map data.

## Blocked by

- [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md)

## Acceptance criteria

- [ ] Offer a clearly named History entry near the map's history controls, with a usable responsive view and focus return to its trigger on dismissal.
- [ ] Show retained actions in chronological order with meaningful action/target labels; distinguish already applied actions, the current history position and actions available through Redo. Include an understandable initial-baseline/empty state.
- [ ] Opening, scrolling, inspecting or closing the view does not change applied workspace data, the history cursor, selection/map context, the save queue, Redo or drafts. Rows do not jump to a historical state.
- [ ] Explain that the list is the bounded current session history, not an audit log. Reflect prefix eviction, Redo-branch removal, baseline resets, accepted oversized continuation and session reset promptly, with available-depth/empty/reset feedback.
- [ ] Read descriptors through an explicit read-only interface from the existing coordinator; retain no second history stack and decode no full workspace snapshots just to render the list. Count any retained descriptors under the established capacity rules.
- [ ] Consultation itself does not apply/discard a draft and does not require a successful save. Preserve existing modal ownership/focus rules; ordinary Undo/Redo availability remains guarded independently.
- [ ] Cover list ordering/current-position/Redo updates through the command/read-only interface, and real opening/dismissal, unchanged data/history/drafts, empty/truncated/reset states, focus and desktop/compact layout through public browser journeys.

## Shared constraints

- Keep one workspace owner and ordered save queue, with no Pinia data copy, new portable-history format or parallel persistence path. Historical restoration preserves identities and complete normalized data.
- When history is exposed, every applied mutation is recorded centrally. Traversal requires latest saved data and no modified/pending editing work; immediate traversal results survive a later save failure, and Retry saves current memory without replay.
- Retention is at most 100 action edges and 32 MiB (33,554,432 bytes) of correctly counted retained encoded snapshots/descriptors. Oversized continuation requires explicit consent and creates a non-undoable baseline; cancellation or failure before publication preserves data/history. This is not a heap-size guarantee.
- Respect the confirmed action/group boundaries, session lifetime, guarded context checks and native text history. Read-only consultation does not traverse or apply/discard a draft and follows modal ownership independently of the saved-state traversal gate.
- Apply these shared contracts to this ticket without absorbing other tickets. The coordinator owns shared Git/integration resources and serializes overlapping edits. Do not modify other worktrees or unrelated correction efforts.

## Verification and completion

- Use the approved command/read-only interface with real validation and controlled time/durable acknowledgements for affected deterministic scenarios. Test observable results and refusal/preservation behavior, not private timeline arrays or stubbed store actions.
- Add or extend the relevant public UI and real IndexedDB scenarios described by the acceptance criteria; include cancellation, stale asynchronous context and pre-publication versus post-publication failure paths where affected.
- Complete lint/typecheck and affected checks according to repository guidance. Reuse successful unchanged evidence; the coordinator runs the production build and one full integrated suite after all slices are integrated, with independent Sensitive-route restoration/persistence review.
- Record actual evidence and unavailable physical-input/performance checks honestly. Passing this ticket does not close the GitHub source, authorize a merge/release or claim other tickets complete.

## Planning authorization

The user approved this ticket in the eight-ticket local breakdown on 2026-10-27. It is ready for an agent once its blocking tickets are complete and implementation is separately authorized. It is unclaimed and has not been implemented.
