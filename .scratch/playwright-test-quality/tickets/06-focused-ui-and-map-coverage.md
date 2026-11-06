---
title: Consolidate redundant UI and map browser journeys
status: closed
assignee: ticket-06-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 06: Consolidate redundant UI and map browser journeys

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

UI/map portions of F10; user stories 6-10 and 29; completion criteria 2 and 8.

## What to build

The browser suite retains focused protection of editing and UI integration while avoiding repeated full journeys for the same obligation.

## Scope and handoff

Own UI/map coverage dispositions from the inventory, especially creation/reload, legacy variant URLs, panel independence, deletion confirmation and long Orbit/map journeys. Data/import permutations belong to ticket 07.

## Blocked by

- [01: Publish shared testing guidance and inventory browser coverage](01-shared-policy-and-coverage-inventory.md)
- [03: Correct ineffective gesture, recovery and observer assertions](03-effective-regression-assertions.md)
- [05: Stabilize HTML targets and shared isolated preparation](05-stable-targets-and-isolated-fixtures.md)

Ticket 01 identifies obligations and owners; ticket 03 establishes trustworthy assertions before consolidation; ticket 05 supplies stable targeting and isolated preparation.

## Acceptance criteria

- [x] Use the completed inventory, corrected preconditions/assertions, and stable helper contracts to preserve each meaningful behavioral obligation before deleting repeated execution.
- [x] Keep a representative creation/save/reload journey and narrow legacy variant URL checks to their distinct compatibility obligation instead of repeating full persistence flows for every URL.
- [x] Consolidate duplicated desktop panel independence and simple deletion confirmation/cancellation coverage, while retaining distinct compact focus ownership, portaled hit targets and meaningful presentation contracts.
- [x] Reduce long multi-purpose map/Orbit journeys to coherent independently diagnosable obligations. Do not obtain smaller counts by concatenating independent scenarios into giant tests.
- [x] Select canonical smoke-capable scenarios through the existing tagging approach instead of duplicating their behavior in a separate smoke implementation.
- [x] Preserve distinct keyboard shortcuts, input mechanisms, gesture cancellation, responsive states, failure paths and real integration wiring. Preserve F1/F2/F5 corrections and the upstream F9 geometry approach.
- [x] Update every changed inventory entry with the final retained test or boundary for each removed meaningful assertion, or a justified obsolete requirement. Record actual removed/migrated cases and counts by project.
- [x] Run focused affected browser families and relevant lower-level coverage. Demonstrate reduced redundant execution; report comparable measurements only under equivalent conditions.
- [x] Keep each landed batch green and remove obsolete helper forms only after verifying no callers remain. Leave the complete frozen-source run to ticket 09.

## Planning baseline

Implementation batch 04/06 started on 2026-11-02 from `8a8360805483426786c9245c8d72d0360192a14a`. Origin was fetched; `origin/main` is `d40e5f515baf1afeb0e2135461287b243b2a1f6c`. The branch preserves the prior 01/02/03/05 deliveries and integrates that newer main before ticket edits. Local `main` is checked out in another worktree and is left untouched. The actual merge baseline, scoped ownership, validation and review are recorded in [Tickets 04 and 06 implementation evidence](../implementation-04-06-results.md).

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented and independently reviewed against merge baseline `a00451ee5d25ede93e214a1270e6bfee65fcfd91`. The [updated inventory](../coverage-inventory.md) identifies every retained obligation. Four duplicate legacy create/save/reload workflows, a repeated panel independence matrix and one duplicate deletion journey are removed. Splitting one broad map case into two balances the deleted case: browser count remains 282; fewer browser cases or a baseline-relative speedup are not claimed.

Affected UI families, canonical retained owners and replacement cases pass. The six new prepared cases pass both as the first selection on a cold server and against the warmed server, without retries. Preparation now completes under a shared worker fixture before the scenario budget; each test retains its fresh cloned context. A baseline quiet-save assertion mismatch exposed by the complete run was corrected and its full two-context isolation case passes cold. The initial review's missing plain-wheel obligation was restored and verified.

The implement workflow required one complete frozen-source selection: 461/466 passed, including all changed 04/06 cases, before bounded post-run corrections. The four remaining uncorrected workflow timeouts are retained in [batch evidence](../implementation-04-06-results.md), without claiming they are baseline-proven. The green-batch criterion is satisfied for this ticket's affected behavior; complete-suite stability and final integrated acceptance remain open under tickets 07/08/09. No timeout, retry, skip or data-equality relaxation was added.
