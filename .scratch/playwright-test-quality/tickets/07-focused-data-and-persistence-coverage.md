---
title: Move deterministic data permutations out of browser journeys
status: closed
assignee: ticket-07-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 07: Move deterministic data permutations out of browser journeys

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

Data/controller portions of F10; user stories 5-10, 18 and 29; completion criteria 2 and 8.

## What to build

Import/export, history and persistence tests protect their distinct failure modes at the smallest sufficient existing boundary, with representative browser integration retained.

## Scope and handoff

Own data/import/export and controller-related coverage dispositions from the inventory. Preserve the sole ordered workspace writer, session ownership, domain rules and save formats. This ticket changes test allocation rather than persistence architecture.

## Blocked by

- [01: Publish shared testing guidance and inventory browser coverage](01-shared-policy-and-coverage-inventory.md)
- [03: Correct ineffective gesture, recovery and observer assertions](03-effective-regression-assertions.md)
- [04: Exercise real controller lifecycles and establish Redo preconditions](04-controller-lifecycle-and-history.md)
- [05: Stabilize HTML targets and shared isolated preparation](05-stable-targets-and-isolated-fixtures.md)

Ticket 01 supplies dispositions; ticket 03 fixes recovery/observer assertions; ticket 04 provides accurate controller lifecycle/history coverage; ticket 05 supplies isolated setup and shared probes.

## Acceptance criteria

- [x] Inventory overlaps in campaign import/export journeys, image-export coverage and detailed import-remapping cases; retain distinct download and browser wiring obligations rather than treating all similar assertions as duplicates.
- [x] Move deterministic validation, transformations and identity-relationship permutations to domain tests, and transitions/history/deferred-save permutations to real controllers with controlled dependencies and lifecycle owners where required.
- [x] Retain representative public creation/import/hydration/recovery paths, genuine IndexedDB transaction/failure behavior, downloads and end-to-end save/reload integration.
- [x] Use the stable isolated preparation and failpoint/export helpers from ticket 05. Preserve distinguishable recovery records, externally asserted observer observations, verified lifecycle handling and meaningful Redo preconditions from tickets 03-04.
- [x] Exercise the real subject under test; do not stub away ordering, acknowledgement, mutation or durability behavior being asserted.
- [x] Map every removed or migrated meaningful assertion to a retained test or explicit obsolete requirement in the inventory. Explain any deliberate overlap between boundaries by its distinct failure mode.
- [x] Show an actual reduction in redundant browser execution while keeping meaningful coverage. Reuse canonical smoke selection and avoid replacing removed scenarios with another giant multi-purpose journey.
- [x] Run focused replacement domain/controller tests and retained browser/storage journeys, including relevant failure paths. Record counts, migrations and results for final verification.
- [x] Keep migration batches green, remove unused compatibility helper forms once no callers remain, and report any discovered product defect for explicit scoping.

## Planning baseline

Batch 07/08 starts from `2ad7389f7a1f2dc22f4ea5796926da747db822c6` on `codex/playwright-test-quality`. Origin was fetched on 2026-11-02; its main is `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, with 26 incoming commits covering Search and verification tooling. This batch intentionally retains the completed 01–06 branch baseline instead of combining those product/tooling changes with test allocation. Local main is checked out in another worktree and is left untouched to preserve its work. Reconciliation with the newer main and any impacted revalidation must precede final project acceptance. See [Tickets 07 and 08 implementation evidence](../implementation-07-08-results.md).

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented and independently reviewed against the intentionally retained `2ad7389f7a1f2dc22f4ea5796926da747db822c6` baseline. The [coverage inventory](../coverage-inventory.md) maps every moved assertion: seven new pure cases own deterministic import/export permutations, one browser case is removed, and native execution loses nine net image downloads and two upload rounds. Real download/upload, review, focus, storage, history and selective-deletion obligations remain. The two final legacy prepared-route consumers now use the established shared snapshot fixture without changing their four scenario bodies.

Nine focused pure cases, all 190 pure cases in the complete selection, 17 targeted data/image cases and four final route-family cases pass. Five temporary faults independently expose broken scope, linked identity, projection and original-layout preservation, with product files restored byte-for-byte. Lint and typecheck pass. The scoped migration is green; final project acceptance remains open: the complete selection is 462/472, with nine test-budget failures and a separate Orbit Undo mismatch outside these changed behaviors. These failures are not baseline-proven. See [07/08 evidence](../implementation-07-08-results.md) for candidate identities, retained diagnostics, review closure and required main reconciliation under ticket 09.
