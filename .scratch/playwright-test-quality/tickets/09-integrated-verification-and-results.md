---
title: Verify the integrated suite and publish the result record
status: closed
assignee: ticket-09-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 09: Verify the integrated suite and publish the result record

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

All completion criteria, especially 9-10; final consistency for all user stories.

## What to build

Maintainers receive one reviewable result showing that the suite is more focused, the reported defects are addressed, and humans and agents can follow the same verified guidance.

## Scope and handoff

Own final inventory reconciliation, documentation consistency, frozen-candidate verification, evidence and independent review. Reuse successful evidence for unchanged behavior; this ticket is not a second blanket implementation pass.

## Blocked by

- [06: Consolidate redundant UI and map browser journeys](06-focused-ui-and-map-coverage.md)
- [07: Move deterministic data permutations out of browser journeys](07-focused-data-and-persistence-coverage.md)
- [08: Diagnose and verify cold and warm scenario preparation](08-measured-startup-reliability.md)

Tickets 06 and 07 complete coverage migrations and transitively include tickets 01, 03, 04 and 05; ticket 08 completes runtime evidence and transitively includes ticket 02.

## Acceptance criteria

- [x] Record the exact integrated candidate revision and working-tree state; freeze source before integrated checks. Reconcile every browser case on the implementation baseline and every removed/migrated meaningful assertion with the final coverage inventory.
- [x] Confirm explicit dispositions for F1-F10: effective F1-F5 assertions, measured F6 preparation, independent F7 pure runs, first-attempt F8 artifacts, preserved upstream F9 geometry, and all F10 maintenance items.
- [x] Check that the shared English policy is discoverable from contributor and agent entry points and agrees with actual local/CI commands, locator/helper contracts and final boundary allocation. Remove stale or duplicate guidance.
- [x] Run lint, typecheck, the production build appropriate to the runner/integration changes and one complete integrated suite. Appropriate immutable exact-commit CI evidence may supply supported browser coverage; disclose any unavailable check.
- [x] Verify final discovery and counts by project, including development-storage and shortcut coverage, with no accidental omissions or duplicate project matches. Demonstrate actual reduction in redundant browser execution rather than just helper extraction, sharding or fewer files.
- [x] Reuse ticket 08's ten warm and three independent-server-start results only if the affected behavior and runtime remain unchanged. Otherwise repeat the impacted protocol on the final candidate with fresh contexts and no retries.
- [x] Confirm initial-attempt failure artifacts and relevant cleanup evidence remain valid. Keep logs/traces as artifacts, with credentials redacted and concise durable links or locations in the result record.
- [x] Obtain the repository-required independent review of behavior and standards using the actual diff, specification and evidence. Apply the risk-appropriate route, including complementary review if persistence/domain semantics changed. Resolve blocking findings and obtain reviewer closure.
- [x] After corrections, rerun affected checks; broaden only when changed scope or unresolved risk requires it. Record which earlier evidence still applies rather than repeatedly running the whole suite.
- [x] Publish the result record with baseline/candidate, commands, runtime conditions, failures and reruns, artifact locations, case counts, migrations/removals and remaining limitations. Use equivalent environments/scopes for performance claims and label unmatched timings as observations.
- [x] Resolve completed local tickets according to the local lifecycle, with concise outcomes. Do not infer authorization to publish GitHub issues, push, open a PR, merge or close a remote issue from this verification ticket.

## Handoff from tickets 07 and 08

The [07/08 result record](../implementation-07-08-results.md) retains the current 472-case inventory, successful focused replacements and strict F6 ten-warm/three-cold observations. Its one full selection on `6622c50c351bf2e64863e2cca068f256e4b824d6` is 462/472: nine 30-second budget failures and a separate pre-deadline Orbit Undo mismatch (0° expected, 5° received). None has a matched baseline control. Preserve their native diagnostics and reproduce the history mismatch with actual wheel-delivery/group-boundary measurements before assigning a product or test cause. Give each budget failure a measured preparation/scenario disposition while preserving its behavioral obligations.

Before final acceptance, reconcile the intentionally retained `2ad7389` base with fetched main `47c0418a` and any newer intervening work. That main changes Search, navigation and runtime qualification. Its launcher adds a browser preflight that warms the app before target tests; a repeated strict cold protocol must explicitly account for or avoid that preflight. Reuse the 07/08 timing evidence only where the affected scenario, preparation and runtime remain unchanged. A shorter native test duration after separating fixture time is not a performance improvement; include setup, body, cleanup and total runner costs.

## Planning baseline

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

Implementation and qualification criteria are complete; final independent review of the documentation-only closeout and coordinator-owned local ticket/commit lifecycle remain. No remote issue update, push, PR, merge or publication is authorized.


## Resolution

Closed on 2026-11-04 after main reconciliation, measured corrections and complete frozen-candidate qualification: 583/583 cases across development pure/storage and fresh compiled-browser partitions, strict F6 13/13, lint, typecheck, production build and Markdown link checks passed. Independent Standards and Spec reviews closed with zero findings on tree 38cc0215ed79ee94f25a0e2fbf1a2c59586dc230 and approved this documentation-only lifecycle closure. The [integrated result record](../implementation-09-results.md) retains exact source/build identity, commands, initial failures, reruns, coverage migrations and limitations. No remote action was performed; ticket 10 recommendations remain proposed follow-ups.
