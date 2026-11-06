---
title: Remove clear low-value tests and establish the permanent coverage policy
status: closed
assignee: ticket11_pruning
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 11: Remove clear low-value tests and establish the permanent coverage policy

## Specification

[Approved follow-up: behavior-first pruning and shorter feedback](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback); R1 pass 1 in the [retrospective execution plan](../retrospective-test-sessions.md#r1-extension-three-increasingly-selective-pruning-passes).

## What to deliver

A first reduced suite that removes clear incidental aesthetics, duplicates and disposable implementation checks, with one shared permanent-coverage policy understood by contributors and coding agents. Retain useful behavior; unnecessary tests may be deleted without replacement.

## Blocked by

- [09: Verify the integrated suite and publish the result record](09-integrated-verification-and-results.md) — closed.
- [10: Review recent repository sessions and prioritize testing improvements](10-retrospective-test-session-problems.md) — closed.

## Scope and coordination

Pass 1 uses a fresh test specialist under the ordinary repository profile. Start with the retrospective's footer/header/shortcut/Search/deep-Hierarchy candidates and inspect the rest of application coverage for equally clear removals. Own application tests, their unused helpers and the policy update. Tooling/runner tests are reserved to tickets 13/14 and receive value review in pass 3. The coordinator serializes shared documentation edits and owns Git and runtime checks; preserve others' changes.

Planning baseline is recorded in the specification. Fetch/reconcile and capture actual discovery before editing. Keep historical delivered inventories/results; append the current dispositions rather than rewriting old evidence. No product redesign or arbitrary deletion target is authorized.

## Acceptance criteria

- [x] Record the actual source baseline, discovery counts by project and inspected scope; claim the ticket before implementation.
- [x] Remove clearly unnecessary assertions/scenarios and unused support code. Every decision names a concrete user/verification failure or explicitly retires an aesthetic, duplicate or unnecessary obligation. Preserve distinct meaningful behavior.
- [x] Update the shared English testing guide: permanent behavior, temporary aesthetic validation, criteria for deletion/migration, and a justified exception for a lasting visual requirement. Verify contributor and agent entry points reach that guide.
- [x] Update the coverage inventory with actual keep/narrow/move/delete decisions, retained owners and initial count/preparation/download changes; update affected helper contracts.
- [x] Run focused affected checks and appropriate lint/types, retain initial diagnostics and obtain independent review under the repository workflow. Reserve full cumulative qualification for ticket 15 unless a concrete unresolved risk requires broader checks.
- [x] Hand pass 2 a stable integrated diff, concise decision register, evidence and explicit uncertainties. Do not retain temporary scripts as skipped permanent tests or claim speed gains from cosmetic assertion removal alone.

## Delivery evidence

The [11/13 result record](../implementation-11-13-results.md) and appended coverage inventory contain the first-pass dispositions: two complete aesthetic journeys retired, eight retained cases narrowed, and all nine affected/owner browser obligations passing through the initial eight passes plus the corrected tooltip rerun. The guide is shared by README and AGENTS. Documentation closure is approved; ticket 12 remains the unimplemented second pass.


## Resolution

Closed on 2026-11-04. Retired two complete aesthetic browser cases and narrowed eight retained cases while preserving named user-behavior owners. The shared policy, inventory and entry points agree; all nine affected/owner browser obligations passed through targeted reruns, with static checks, retained evidence and zero-finding independent review. Final reviewed tree: ac146749224d31579a8f1b274a8279ff55f6a265. The [delivery record](../implementation-11-13-results.md) records counts, corrections, commands, runtime conditions and limits. Ticket 12 remains the next pass; cumulative qualification remains ticket 15.
