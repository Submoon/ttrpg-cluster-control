---
title: 'Restore deletion cascades and shared Fields effects'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 05: Restore deletion cascades and shared Fields effects

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 8, 19, 20 and 48.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

Reviewed deletion and Fields mutations undo/redo as complete intentions, including their dependent references, values and layout, with safe consequence review after asynchronous consent.

## Blocked by

- [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md)

## Acceptance criteria

- [x] One confirmed deletion restores/removes its complete recursive footprint: nested Orbits/occupants, routes, Station links, layout entries and surviving Orbit order, with original identities.
- [x] Fields creation/rename/type/options/applicability changes and deletion restore definitions plus every affected value, including zero/false/empty text and assignments that were cleared by destructive changes.
- [x] A draft Apply required before deletion/Fields consequences is its own recorded action; recompute and renew review if those applied changes alter the authorized footprint.
- [x] Recheck operation ownership, revision and consequence signature after capacity consent; stale reviews/continuations cannot overwrite current or restored data. Cancellation and pre-application validation failure preserve the current state/history.
- [x] Redo restores the same confirmed footprint without another destructive review; preserve final-system protection, pending-target cleanup and dirty-draft guards.
- [x] Verify real reviewed deletion/Fields journeys and exact normalized round trips, consent cancellation/changed review, pre-publication failure versus save failure, and Retry without replay, using the common recording/capacity mechanisms rather than new per-family stacks.

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

The user approved this ticket in the eight-ticket local breakdown on 2026-10-27. It is ready for an agent once its blocking tickets are complete and implementation is separately authorized. The user separately authorized implementation on 2026-10-28; the execution and resolution below record the outcome.

## Implementation execution

The user authorized this ticket together with 03/04/05/06/08 on 2026-10-28. Actual implementation baseline: `4ad6976aaf0953bcaac90c26eb4e289c3ef75487` on current branch `codex/undo-redo-ticket-01`. Freshly fetched `origin/main` and local `main` remain `9edfa66c4f505d56f106fc4af8245f200abfba78`; the two completed prerequisite commits intentionally form the base. The source issue was re-fetched unchanged (open, same labels, no comments). Preserve unrelated environment configuration and other worktrees. Ticket 07 is outside this instruction. The coordinator owns Git, integration resources and final independent reviews; use the previously approved command/read-only, public UI and real IndexedDB test seams.

### Focused implementation evidence

The 2026-10-28 family slice adds `tests/workspace-history-families.spec.ts` without changing the existing production family controllers. Seven public command/controller checks passed with real normalization and validation, plus three public browser journeys for import, reviewed system deletion and destructive Fields type change. The command checks cover recursive Orbit cascade, Station links/routes/order/layout, exact falsy Fields values, independent Cluster/standalone imports with exact Redo identities/shared settings, changed import effects after awaited draft resolution, capacity cancellation and stale accepted capacity after workspace replacement. Existing reviewed mutation and save-recovery scenarios remain part of integrated validation. Initial browser attempts exposed test-context setup mistakes that were corrected, not ignored. Scoped lint passed. The final integrated checks and independent review closure are recorded in the Resolution below.


## Resolution

Resolved on 2026-10-28 after implementation, integrated validation and independent review closure.

The shared normalized snapshots restore complete recursive deletion footprints, original identities, Station links, routes, order and layout, plus shared Fields definitions and exact values including empty text, zero and false. Reviewed controllers already used the required common transaction/revalidation path; focused family and public browser round trips verified it without adding another history stack. Their new operation preflight composes with pending adjustment completion.

See [Undo/redo implementation tickets — batch verification](index.md#batch-verification) for the fixed baseline, source candidate, independent review closure, integrated checks and their limits. Ticket 07 and global source-issue completion remain outside this batch.
