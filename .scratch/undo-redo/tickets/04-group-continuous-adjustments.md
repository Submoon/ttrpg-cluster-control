---
title: 'Group continuous keyboard and wheel adjustments'
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Group continuous keyboard and wheel adjustments

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 15-18.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

A held Orbit adjustment key or continuous wheel sequence shows live geometry and produces one history step, including when interrupted by focus or context changes.

## Blocked by

- [Undo and redo saved changes through the shared coordinator](02-shared-history-coordinator.md)

## Acceptance criteria

- [x] Use a live preview followed by one complete publication on key release, 300 ms wheel inactivity, target/property/map change, focus loss or another operation. Preserve existing pointer-drag cancellation behavior.
- [x] A net-zero group publishes nothing and preserves Redo. Key/wheel repetition inside a group does not create per-event steps, writes or consent dialogs.
- [x] Finalize before another command/navigation/export consumes applied data. If consent is needed, retain the proposal and suspend the following operation; Cancel discards only that unapplied group and leaves previous data/history intact.
- [x] Revalidate after consent or any asynchronous wait and refuse stale publication. Keep current save-gate/pending-preview blockers active until finalization/save completes.
- [x] Timers/listeners and group ownership survive responsive child-map remounts appropriately and clean up on true session exit; no orphan callback finalizes into a newer session.
- [x] Test key release, 299/300 ms wheel boundary, target/property/focus/map interruption, command/export sequencing, capacity cancel/continue and net-zero Redo preservation through the approved command seam and representative public gestures.

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

### Continuous-adjustment integration contract

The pending adjustment belongs to the editor-session coordinator, above responsive map mounts. Stage one latest proposal keyed by system, Orbit, property and input kind without publishing or encoding a snapshot per input. Complete it through the ordinary validated history application path on key release, 300 ms wheel inactivity, focus/context change or a subsequent operation. Keep one completion promise, captured workspace/revision/epoch ownership and an observable pending-preview blocker. Reset/disposal discard pending work; capacity cancellation rejects the suspended following operation and restores the applied geometry.

Finalize at supported public operation entry before capturing absolute geometry, draft or consequence baselines. A core execute-time fallback may finalize a group, but must reject a request prepared against the prior revision rather than guess how to rebase its closure. Navigation, tool and same-target selection paths must await completion before state changes. File actions await completion before reading export data or preparing import review. Renderer input emits typed adjustment intent; pointer-drag semantics remain separate. Page-owned preview state is reapplied after responsive child remounts, with timers/listeners cleaned up on true session exit.


## Resolution

Resolved on 2026-10-28 after implementation, integrated validation and independent review closure.

Keyboard and wheel input now uses page-owned relative previews and one validated publication per group. Key release, the 300 ms wheel boundary, focus/context changes and following commands finalize through the shared coordinator. Session epochs, stable automatic-boundary tokens and queued failure propagation cover reset/cancellation races. Net-zero geometry preserves implicit/fractional data and Redo; public Apply and exports preflight before their baseline. Controlled writer acknowledgements remain handled without replay. Mounted tests verify both Ctrl-wheel orders, no zoom leak and a held preview surviving compact reflow.

See [Undo/redo implementation tickets — batch verification](index.md#batch-verification) for the fixed baseline, source candidate, independent review closure, integrated checks and their limits. Ticket 07 and global source-issue completion remain outside this batch.
