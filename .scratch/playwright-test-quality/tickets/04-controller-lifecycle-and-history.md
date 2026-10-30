---
title: Exercise real controller lifecycles and establish Redo preconditions
status: closed
assignee: ticket-04-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Exercise real controller lifecycles and establish Redo preconditions

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

Lifecycle and Redo portions of F10; user story 28; completion criterion 8.

## What to build

Controller tests accurately protect lifecycle cleanup and history preservation using real owners, actions and observable transitions.

## Scope and handoff

Own the lifecycle and coordinator-history portion of F10. Reuse existing mounted test harness patterns where suitable. Ticket 07 can subsequently move deterministic browser permutations onto these verified boundaries.

## Blocked by

None (can start immediately).

## Acceptance criteria

- [x] Identify controller/composable cases that claim mount, unmount, listener, watcher or owner cleanup behavior, and distinguish them from ordinary reactive-scope tests.
- [x] Mount and dispose actual lifecycle owners for lifecycle-sensitive checks, using real controller actions and controlled dependencies. Verify the promised observable cleanup rather than replacing the subject with mocks.
- [x] Account for the lifecycle warnings observed in the audit. Resolve invalid harness usage or narrow the claim where appropriate; do not infer a production leak from warnings alone or suppress warnings broadly.
- [x] Establish a non-empty Redo branch before asserting that a no-op command preserves it, then verify that Redo remains usable. If that is not the intended contract, narrow the title and explicitly identify the retained coverage for Redo preservation.
- [x] Preserve draft guards, stale-context handling, mutation verdicts, cancellation and deferred save ordering at their existing real-controller boundaries.
- [x] Record a retain/change/migrate disposition for every lifecycle/history item reviewed, and provide ticket 07 with the usable harness contracts and retained behavioral owners.
- [x] Run the affected pure/controller tests, including teardown and deferred outcomes relevant to each change. Record failure sensitivity where the old test lacked its claimed precondition.

## Planning baseline

Implementation batch 04/06 started on 2026-11-02 from `8a8360805483426786c9245c8d72d0360192a14a`. Origin was fetched; `origin/main` is `d40e5f515baf1afeb0e2135461287b243b2a1f6c`. The branch preserves the prior 01/02/03/05 deliveries and integrates that newer main before ticket edits. Local `main` is checked out in another worktree and is left untouched. The actual merge baseline, scoped ownership, validation and review are recorded in [Tickets 04 and 06 implementation evidence](../implementation-04-06-results.md).

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented and independently reviewed against merge baseline `a00451ee5d25ede93e214a1270e6bfee65fcfd91`. Lifecycle-sensitive controllers now have actual mounted owners and observable cleanup; ordinary reactive scopes are retained where appropriate. The no-op history case starts with a real Redo branch and proves subsequent Redo works. All 48 focused controller cases and all 183 pure cases in the complete selection pass. Three temporary faults independently fail the promised cleanup/Redo observations, with production files restored byte-for-byte.

The [lifecycle disposition and harness handoff](../controller-lifecycle-inventory.md) supplies ticket 07's verified seams. [Batch evidence](../implementation-04-06-results.md) records checks, independent review and the remaining browser integration failures. Closure does not claim complete-suite stability.
