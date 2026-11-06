---
title: Minimize retained behavior journeys and permutations
status: closed
assignee: Codex
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 12: Minimize retained behavior journeys and permutations

## Specification

[Approved follow-up](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback); R1 pass 2 in the [retrospective execution plan](../retrospective-test-sessions.md#r1-extension-three-increasingly-selective-pruning-passes).

## What to deliver

A smaller set of behavior journeys in which each retained scenario or permutation detects a distinct meaningful failure that cheaper existing coverage cannot adequately detect. Reduce repeated setup, downloads and matrices, including cases retained by pass 1.

## Blocked by

- [11: Remove clear low-value tests and establish the permanent coverage policy](11-remove-low-value-tests-and-document-policy.md).

## Scope and coordination

Use a different fresh sub-agent from pass 1. Review application browser, domain and controller coverage against pass 1's register and current source, not only its deletion list. Own application coverage and related helpers; reserve tooling changes to tickets 13/14. The coordinator serializes inventory/policy edits, assigns one writer per shared file and owns runtime resources. Preserve other contributors' changes.

Use existing boundaries and real actions; retain representative browser wiring, native interaction and IndexedDB behavior when composition is the risk. A test's historical existence is not a retention argument. A needed behavior's timeout calls for diagnosis/narrowing, not automatic deletion.

## Acceptance criteria

- [x] Revisit pass-1 survivors and remaining application coverage. Document why retained families/variants need separate scenarios or boundaries; case-level exceptions remain identifiable.
- [x] Remove unnecessary whole journeys/permutations, consolidate true overlaps and migrate useful deterministic obligations only where an existing lower boundary is needed. Avoid giant concatenated scenarios or replacement tests for explicitly retired obligations.
- [x] Preserve meaningful cancellation, guards, focus, save/reload/recovery, geometry and input differences; name the retained tested owner when moving a meaningful obligation.
- [x] Update the same coverage inventory, affected helper contracts and shared guide where decisions change. Record actual counts, repeated setup/downloads removed and comparison conditions without unsupported performance claims.
- [x] Run affected focused checks and appropriate lint/types; retain first failures and obtain the repository-required independent review. Reuse valid prior evidence and leave one cumulative final qualification to ticket 15.
- [x] Hand the final reviewer the cumulative source diff, a complete current disposition register for application coverage, necessary representative journeys and unresolved tradeoffs. Do not launch pass 3 before its other tooling dependency completes.

## Resolution

Pass 2 removes 41 browser journeys or variants and 14 pure application cases from `7f5ed98575e4158b965284f0375a627f2947adc7`. The [disposition ledger](../coverage-inventory.md#ticket-12-pass-2-disposition) records representative owners and deliberately retired coverage. The focused 70 pure and 15 browser cases passed. Lint, typecheck and independent application review closed. [Delivery evidence](../implementation-12-14-results.md) identifies the isolated application candidate and the integrated handoff to ticket 15.
