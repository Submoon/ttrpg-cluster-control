---
title: 'Restore useful context without stale drafts'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03: Restore useful context without stale drafts

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 2-5, 7, 9-13 and 33-36.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

Undo/Redo across ordinary system/route/object/Orbit edits reveals the affected map and target, handles removed targets sensibly, and keeps forms/focus coherent rather than restoring data into a stale interface.

## Blocked by

- [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md)

## Acceptance criteria

- [ ] Systems/routes reveal Cluster context, objects/Orbits their system, with original or surviving-parent/empty selection as appropriate. Shared Fields changes use global feedback in the current view.
- [ ] Reveal an off-screen target only as needed, without restoring old camera/panel snapshots. Retain initiating-control focus or a stable map fallback.
- [ ] Refresh or end stale clean chart/entity/route/Fields sessions explicitly; no retained clean form can later overwrite restored data using an obsolete baseline. Modified hidden or unrelated drafts continue to block traversal.
- [ ] Preserve complete form-Apply and confirmed numeric/drag placement boundaries. Creation followed by modified Apply, and draft Apply before a following operation, remain separate entries. Preserve exact field values, placement relationships and layout.
- [ ] Make detailed blocker reasons/action labels understandable across map contexts, panel hiding/reopening and responsive reflow; do not weaken 02's safety floor.
- [ ] Cover public cross-map system/route/object/Orbit form and placement journeys, missing-target fallback, hidden-session blockers, clean-form refresh and focus, with command-level failure preservation and relevant UI checks.

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
