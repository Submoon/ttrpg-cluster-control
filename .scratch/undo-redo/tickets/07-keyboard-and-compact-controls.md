---
title: 'Complete keyboard and compact interaction'
status: closed
assignee: coordinator
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

- [x] Support Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z and Cmd+Shift+Z through the same command pair; one traversal per physical press, no auto-repeat or queued blocked shortcut.
- [x] Editable descendants/contenteditable keep native text Undo/Redo even with an empty text history; respect IME composition, handled events and modal ownership.
- [x] Desktop/compact controls remain directly reachable near map commands, announce next action/target and empty/blocked reasons, and show reduced history depth or oversized warning accessibly. Keep history consultation in its separate ticket 08.
- [x] Preserve 03's target reveal/fallback and initiating-control focus during keyboard traversal, viewport changes, panel hiding and nested dialogs. Shared Fields changes remain globally understandable.
- [x] Validate supported shortcut variants and editable/noneditable targets with browser journeys, plus compact/desktop action states, layout and hit targets through maintained UI checks. Report any actual physical keyboard or assistive-technology evidence separately from emulation.
- [x] Reuse prior storage/command evidence; do not introduce a second history command, store or test runner for keyboard/compact behavior.

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

The user approved this ticket in the eight-ticket local breakdown on 2026-10-27 and separately authorized implementation on 2026-10-28. Its dependencies were complete before execution; the resolution below records the outcome.


## Implementation execution

The user authorized ticket 07 on 2026-10-28. Actual implementation baseline: `bee7f13f2150d71097ea097d5fbb155b66f4c3ff` on current branch `codex/undo-redo-ticket-01`. Freshly fetched `origin/main` and local `main` remain `9edfa66c4f505d56f106fc4af8245f200abfba78`; the three completed prerequisite commits intentionally form the base. GitHub issue #5 was re-fetched unchanged (open, same labels, no comments). The scope exposes existing guarded history commands and preserves mutation/persistence contracts. Use the previously approved public command/read-only and browser seams with real validation/storage; the coordinator owns Git, runtime ports, integration and independent reviews. No remote write/push/PR/merge or other-worktree change is authorized.

## Resolution

Resolved on 2026-10-28 after implementation, integrated validation and independent review closure.

The page-owned shortcut bridge dispatches the five approved Ctrl/Cmd variants through the existing guarded Undo/Redo commands. It ignores repeats, editable ancestors and composed paths, composition, handled events and keyboard-owned overlays. A blocked shortcut is dropped synchronously rather than deferred until saving or pending work completes. Listener lifetime follows the editor owner. Controls expose shortcut metadata and existing action/target/reason feedback without adding a compact toolbar row or changing read-only History consultation. Shared Fields traversal keeps its current map and restores usable control or map focus when the initiating control becomes disabled.

The real Ctrl+Z journey first reproduced the missing shortcut. Nine new browser scenarios then passed, covering all variants, native text history including empty history, contenteditable descendants, an open shadow input, nested listboxes/popovers, IME/handled events, repeats, delayed real IndexedDB acknowledgement, the welcome screen and Fields focus. Ten existing history-button/consultation scenarios also passed. Desktop, 390×844 and 844×390 control geometry/hit targets were checked; the compact screenshot was inspected.

Global lint, typecheck and the production build passed. One complete integrated suite on frozen source candidate `66541d3a414f6cd04b1cadef3e751d13c72c3738` passed all 346 scenarios: checks/real IndexedDB 114/114 in 38.1s and production browser journeys 232/232 in 15.3m, with no skips, failures or retries. Reports are `test-results/ticket07-full-checks-results.json` and `test-results/ticket07-full-browser-results.json`; focused reports are `test-results/ticket07-final-keyboard-results.json` and `test-results/ticket07-integrated-history-ui-results.json`. These are ignored execution artifacts. Independent Standards and Spec reviews each have zero findings; the complementary guard/persistence review also has zero findings. Final completion changes after the verified candidate are documentation only. All owned servers are stopped.

Browser automation verifies browser interaction and responsive layout, not physical-device, operating-system keyboard or screen-reader certification. Existing storage/history evidence is reused for unchanged contracts; no second store, command, writer or runner was introduced. The source issue was re-fetched unchanged before completion and remains open; this local resolution does not publish, merge or close it.
