---
title: 'Undo and redo saved changes through the shared coordinator'
status: closed
assignee: coordinator
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

- [x] A page-owned coordinator wraps the sole writer; a framework-independent timeline restores canonical complete snapshots with original identities. No Pinia workspace copy, replayed creation/import, extra persistence path or format change is introduced.
- [x] Record every shared-contract publication, not only the demonstration actions. No-ops/canceled/rejected preparation preserve both sides; new accepted actions after Undo clear Redo; traversal/retry/export do not append actions.
- [x] Enforce at most 100 edges and 33,554,432 retained encoded bytes, counting standalone UTF-8 snapshot/descriptor backing buffers and shared baseline nodes correctly. Virtual prefix eviction occurs only with successful memory publication, with visible reduced-depth feedback.
- [x] Provide the common explicit oversized-consent UI. Cancel and pre-publication failure preserve data/history; continuation applies a non-undoable baseline and clears both sides without retaining an over-budget baseline. Recheck identity/revision after consent; reject stale continuation safely until its owner recomputes.
- [x] Buttons and command entry require the latest saved applied revision and no modified draft anywhere, gesture/preview, review, pending confirmation or blocking modal. Show why unavailable; never implicitly resolve or queue work. Tear down obsolete clean sessions safely from this first exposed slice.
- [x] Publish a traversal result and matching history position together under a busy guard; a later write failure retains both, blocks traversal and offers Retry/Export. Retry saves current memory without replay; older acknowledgements cannot enable traversal or replace newer feedback.
- [x] Initial creation, editor exit/re-entry, reload/hydration, identity change and backup restore reset history. Navigation, panel hiding and reflow preserve it; initial creation cannot be undone into welcome.
- [x] Demonstrate the complete public button journey and use the approved command test seam for branching, atomic failure, Unicode/exact count-byte boundaries, baseline accounting, cancellation and stale consent. Use real IndexedDB failure/delay evidence for saved-state gating and retry.
- [x] Exercise representative larger valid workspaces for retention/latency evidence. Distinguish encoded capacity from heap observations; record results without claiming a RAM guarantee.

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

The user explicitly authorized coordination through `implement` on 2026-10-27 after ticket 01 completed. The coordinator claims ticket 02 on the current branch `codex/undo-redo-ticket-01`; no other ticket is claimed. Actual implementation/review baseline: `bf8317c617903d9333a219a495bf739d1bad4b3b`, intentionally including the required ticket 01 prerequisite above fetched `origin/main` (`9edfa66c4f505d56f106fc4af8245f200abfba78`). The source issue was re-read and remains open and unchanged, with no comments. Unrelated environment configuration and other worktrees remain outside this effort.

## Execution contract

Use the previously approved public command/read-only seam with real validation and controlled durable acknowledgements, complemented by real IndexedDB and public browser journeys. Apply TDD in vertical slices. The Sensitive route requires architecture before implementation, at most two disjoint writers and independent Standards/Spec plus complementary persistence reviews. The coordinator owns Git, ports, root integration and final checks. Commit only ticket 02 work to the current branch; no push, PR, merge, GitHub write or later-ticket implementation is authorized.

## Comments

> *This was generated by AI during triage.*

The architect settled one framework-independent encoded timeline behind the existing shared mutation interface. Writer A owned timeline/coordinator and command-seam checks. Writer B owned saved-applied revision, editing blockers, clean-session cleanup and explicit renderer gesture status. The coordinator owned the Vue adapter, page/chrome controls, capacity prompt, public browser evidence, measurements and shared Git/runtime resources. Detailed target navigation, continuous groups, shortcuts and history consultation remain with later tickets.

The first independent review identified stale clean placement inputs becoming false traversal blockers, temporary workspace-read errors clearing history, and traversal continuing after synchronous reset/disposal. These were reproduced before correction. Placement controllers now distinguish a reactive clean input baseline from genuinely edited values; the coordinator preserves history on read errors and revalidates lifecycle/context after observer notification. New public command regressions cover these paths. A real-browser selected-system drag regression and an additional real IndexedDB older-acknowledgement journey supplement the original name/move/retry/capacity evidence. Reviewers closed these findings after correction.

The complete integrated attempt passed all 69 pure/IndexedDB checks and 191 of 212 compiled-browser journeys. Seven failures exposed substring/status selectors that also matched the new history commands/feedback. Thirteen exposed a real control-layout regression: closing Map files changed the history feedback footprint and moved Back between pointer down and up, losing the click. An isolated public import/navigation reproduction recorded Back moving from x=532 to x=695; the maintained regression then failed without instrumentation. One additional geometry assertion caught the same varying feedback footprint. The correction gives history controls a stable width/status footprint and displays common blockers consistently even with empty history. Existing geometry and data assertions are retained; selectors target their intended exact controls/status surface. This is not a claim that the initial full attempt was green. All affected retests and re-review subsequently passed, as recorded below.

## Capacity and latency observations

The real command/read-only seam was exercised under the production 100-edge/33,554,432-byte policy using valid campaigns with multiple systems, nested Orbits, routes, shared text/number/boolean Fields, and long multibyte text. Node observations during the final integrated checks on corrected source candidate `83c65ccd7efd8dead6e3fecf96e8ae00c40221ef`, on 2026-10-27:

| Campaign | Applied edits | Retained edges / encoded bytes | Application latency | Undo / Redo latency |
| --- | --- | --- | --- | --- |
| 12 systems, 240 objects | 32 | 24 / 32,551,140 | 48–95 ms | 10 / 11 ms |
| 20 systems, 2,400 objects | 5 | 1 / 25,898,368 | 575–676 ms | 96 / 94 ms |
| 32 systems, 3,840 objects | 1, explicit oversized consent | 0 / 0 | 1,074 ms | Unavailable after accepted baseline |

These measurements expose the serialization cost of complete snapshots on larger campaigns; they are observations, not latency targets or browser/device guarantees. An earlier integrated run during development observed 1–2 seconds per application for the 2,400-object fixture, illustrating sensitivity to runtime load. Separate Node heap observations without forced GC varied from about 110–342 MB in the final checks and include live/transient data; they do not establish a RAM bound. Reproducible fixture/measurement tests and JSON attachments live in the maintained Playwright runner, with reports under ignored `test-results/ticket02-measurements*` and `test-results/ticket02-full-checks*` paths.

## Resolution

Completed ticket 02 on the current branch. One page-owned coordinator records all existing shared-contract publications and exposes guarded Undo/Redo buttons, exact complete-snapshot restoration, bounded retention, reduced-depth feedback and explicit oversized continuation. It preserves the sole ordered writer and formats, keeps memory/history aligned through save failure, and resets at the approved editing-session boundaries. Modified work blocks traversal; obsolete clean inputs/sessions refresh or end without discarding genuine drafts. Later tickets retain their context-navigation, grouping, family-specific evidence, shortcut and consultation scope.

Final reviewed source candidate: `279bcbf01362d0eee1a75bc6b571997d8909ff5c`. Global lint/typecheck passed the corrected UI source; the final four full-name test-selector corrections passed targeted ESLint. The rebuilt production application passed in 3m33s. Standards and Spec reviews have zero remaining findings on this candidate; complementary persistence review closed both findings on `83c65ccd` and its core code remained unchanged thereafter.

The full integrated suite was executed once across all configured projects: 69/69 pure/development-storage checks passed in 21.1s; the compiled-browser attempt passed 191/212 in 15.9m with no skips or automatic retries. After the narrowly scoped UI/selector corrections, two original/minimized layout reproductions passed in 14.5s and the remaining 29 affected cases passed in 3.2m. These runs cover all 21 original failures, the new one-click regression, history/save-recovery/capacity journeys and affected previously passing controls. The 191 unchanged browser successes and 69 core/storage successes were reused; no wholly green single full-suite attempt is claimed. Reports remain under ignored `test-results/ticket02-*` paths.

Compact screenshots at 390×844 and 844×390 were inspected after the final fix, and public geometry/hit-target checks passed. This is browser viewport evidence, not physical-device, operating-system shortcut or screen-reader certification. The maintained navigation regression contains no temporary event instrumentation.

Before completion on 2026-10-27, the source issue was re-fetched and remained open and unchanged with no comments; fetched `origin/main` remained `9edfa66c4f505d56f106fc4af8245f200abfba78`. The intentional implementation baseline remains ticket 01's `bf8317c6`. Only ticket 02 is closed here; tickets 03–08 remain unclaimed and GitHub issue #5 remains open. No push, PR, merge or remote issue update was performed.
