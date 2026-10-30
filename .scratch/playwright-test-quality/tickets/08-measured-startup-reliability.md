---
title: Diagnose and verify cold and warm scenario preparation
status: closed
assignee: ticket-08-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 08: Diagnose and verify cold and warm scenario preparation

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

F6; user stories 24 and 27; completion criterion 4.

## What to build

The Move-with-unresolved-metadata scenario has bounded, observable preparation and repeatable evidence that separates startup cost from the behavior being tested.

## Scope and handoff

Own the current-baseline diagnosis and disposition of F6 using the diagnostics and helper contracts already delivered. The historical timeout was observed on an older revision and its cause was not established; reproduce or measure before attributing a current defect.

## Blocked by

- [02: Make pure runs independent and retain first-attempt browser diagnostics](02-independent-runs-and-failure-diagnostics.md)
- [05: Stabilize HTML targets and shared isolated preparation](05-stable-targets-and-isolated-fixtures.md)

Ticket 02 provides first-attempt diagnostics and supported runtime selection; ticket 05 establishes the preparation contracts whose timing and reliability are being verified.

## Acceptance criteria

- [x] Record the implementation revision and recheck the scenario. Historical evidence was one 30-second setup timeout followed by success, including about 23.3 seconds in the first Jump Cluster field interaction; do not treat that as proof of a placement or gesture defect.
- [x] Measure owned-server readiness, browser/client readiness, fixture preparation and scenario work separately. HTTP readiness alone must not be taken as client readiness.
- [x] Correct an evidenced readiness/preparation problem, or explicitly document why the historical failure is not reproduced and what current evidence supports the disposition. Keep all waits and preparation bounded and observable.
- [x] Use awaited state assertions or controlled dependencies for synchronization. A dedicated fixture budget or explicit scenario budget requires measured justification; a global timeout increase or retries alone does not resolve F6.
- [x] Run ten consecutive warm executions and the first execution after three independent owned-server starts, with fresh browser contexts and zero retries.
- [x] Record generated/dependency cache state for each server start, commands, timing breakdown, failures, reruns and artifacts. Do not describe these runs as fresh dependency installations or a statistical flake-rate guarantee.
- [x] Verify owned-resource cleanup, actionable logs and redacted credentials. Distinguish execution-environment access failures from application/test failures.
- [x] Keep the results attributable to the candidate. If later migrations materially change the affected scenario, preparation or runtime, hand the required focused revalidation to ticket 09.

## Planning baseline

Batch 07/08 starts from `2ad7389f7a1f2dc22f4ea5796926da747db822c6` on `codex/playwright-test-quality`. Origin was fetched on 2026-11-02; its main is `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, with 26 incoming commits covering Search and verification tooling. The batch intentionally retains the completed 01–06 branch baseline. Its timing evidence applies to that candidate, not the newer Search/runtime changes. Reconciliation and impacted revalidation remain required before final project acceptance. Local main is checked out elsewhere and is left untouched. See [Tickets 07 and 08 implementation evidence](../implementation-07-08-results.md).

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented and independently reviewed on the retained branch baseline. F6 now prepares its public workspace and unresolved draft in a bounded test-scoped fixture on the same fresh page, then runs the unchanged Move scenario with its separate 30-second budget. The provisional 180-second preparation ceiling is justified by measured cold-start evidence; it is not an underlying startup-performance fix. A transient-popover zoom observation now reads the persistent toolbar and verifies an increase.

The required ten warm executions and first execution after three independent owned-server starts all pass, with fresh contexts and zero retries. No browser preflight precedes the cold selections. Phase traces include preparation, body, cleanup and runner costs; existing dependency/generated caches are recorded. A controlled five-second preparation failure prevents Move, cleans resources and restores the test byte-for-byte. The whole four-case family and F6 within the full selection pass. Both earlier unsuccessful protocols remain recorded.

See [07/08 evidence](../implementation-07-08-results.md) for source `6622c50c351bf2e64863e2cca068f256e4b824d6`, measurements and limitations. This resolves F6's preparation-budget contract and observed locator defect, without proving the cause of slow client startup or a statistical flake-rate guarantee. The global 462/472 result remains red; ticket 09 retains final acceptance, newer-main reconciliation and affected protocol revalidation.
