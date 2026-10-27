---
title: 'Undo and redo saved changes through the shared coordinator'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Undo and redo saved changes through the shared coordinator

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 1, 6, 14, 20, 24-32 and 42-47; family-specific identity/recovery evidence is completed in 05/06.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

After a saved name change or map move, the Warden can use directly reachable Undo/Redo buttons to restore exact data, observe immediate results and recover from save failure. Every applied mutation participates in the same session history, even before later family-specific refinements.

## Blocked by

- [Prepare truthful mutation outcomes and action context](01-prepare-mutation-outcomes.md)

## Acceptance criteria

- [ ] A page-owned coordinator wraps the sole writer; a framework-independent timeline restores canonical complete snapshots with original identities. No Pinia workspace copy, replayed creation/import, extra persistence path or format change is introduced.
- [ ] Record every shared-contract publication, not only the demonstration actions. No-ops/canceled/rejected preparation preserve both sides; new accepted actions after Undo clear Redo; traversal/retry/export do not append actions.
- [ ] Enforce at most 100 edges and 33,554,432 retained encoded bytes, counting standalone UTF-8 snapshot/descriptor backing buffers and shared baseline nodes correctly. Virtual prefix eviction occurs only with successful memory publication, with visible reduced-depth feedback.
- [ ] Provide the common explicit oversized-consent UI. Cancel and pre-publication failure preserve data/history; continuation applies a non-undoable baseline and clears both sides without retaining an over-budget baseline. Recheck identity/revision after consent; reject stale continuation safely until its owner recomputes.
- [ ] Buttons and command entry require the latest saved applied revision and no modified draft anywhere, gesture/preview, review, pending confirmation or blocking modal. Show why unavailable; never implicitly resolve or queue work. Tear down obsolete clean sessions safely from this first exposed slice.
- [ ] Publish a traversal result and matching history position together under a busy guard; a later write failure retains both, blocks traversal and offers Retry/Export. Retry saves current memory without replay; older acknowledgements cannot enable traversal or replace newer feedback.
- [ ] Initial creation, editor exit/re-entry, reload/hydration, identity change and backup restore reset history. Navigation, panel hiding and reflow preserve it; initial creation cannot be undone into welcome.
- [ ] Demonstrate the complete public button journey and use the approved command test seam for branching, atomic failure, Unicode/exact count-byte boundaries, baseline accounting, cancellation and stale consent. Use real IndexedDB failure/delay evidence for saved-state gating and retry.
- [ ] Exercise representative larger valid workspaces for retention/latency evidence. Distinguish encoded capacity from heap observations; record results without claiming a RAM guarantee.

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
