---
title: 'Complete keyboard and compact interaction'
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 07: Complete keyboard and compact interaction

## Source and scope

[Undo and redo for applied workspace changes](../spec.md) is the parent specification; its validated product and testing contracts remain authoritative.

Stories 37-41.

Source: [Undo/redo functionality — GitHub issue #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5), re-fetched on 2026-10-27 with unchanged body, open state, labels and no comments. Actual planning baseline: `9edfa66c4f505d56f106fc4af8245f200abfba78`, equal to fetched `origin/main`. Refresh the source/baseline before implementation and preserve local work.

## What to build

Familiar history shortcuts and directly reachable desktop/compact controls consistently use the existing guarded history commands, reveal the correct context and preserve text-editing ownership and usable focus.

## Blocked by

- [Restore useful context without stale drafts](03-restore-context-and-drafts.md)

## Acceptance criteria

- [ ] Support Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z and Cmd+Shift+Z through the same command pair; one traversal per physical press, no auto-repeat or queued blocked shortcut.
- [ ] Editable descendants/contenteditable keep native text Undo/Redo even with an empty text history; respect IME composition, handled events and modal ownership.
- [ ] Desktop/compact controls remain directly reachable near map commands, announce next action/target and empty/blocked reasons, and show reduced history depth or oversized warning accessibly. Keep history consultation in its separate ticket 08.
- [ ] Preserve 03's target reveal/fallback and initiating-control focus during keyboard traversal, viewport changes, panel hiding and nested dialogs. Shared Fields changes remain globally understandable.
- [ ] Validate supported shortcut variants and editable/noneditable targets with browser journeys, plus compact/desktop action states, layout and hit targets through maintained UI checks. Report any actual physical keyboard or assistive-technology evidence separately from emulation.
- [ ] Reuse prior storage/command evidence; do not introduce a second history command, store or test runner for keyboard/compact behavior.

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
