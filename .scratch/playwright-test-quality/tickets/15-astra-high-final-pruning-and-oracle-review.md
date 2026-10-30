---
title: Complete Astra High pruning and test-oracle review
status: closed
assignee: Codex
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 15: Complete Astra High pruning and test-oracle review

## Specification

[Approved follow-up](../spec.md#approved-follow-up-behavior-first-pruning-and-shorter-feedback); R1 pass 3 and R4 from the [retrospective](../retrospective-test-sessions.md). Combining them avoids another audit of the same retained assertions.

## What to deliver

A final reduced and qualified suite whose remaining cases justify their user/verification value, whose important assertions detect the intended failures, and whose shared documentation accurately explains the delivered policy and commands.

## Blocked by

- [12: Minimize retained behavior journeys and permutations](12-minimize-behavior-journeys-and-permutations.md).
- [14: Shorten focused feedback with safe idle requalification](14-shorten-feedback-with-idle-requalification.md).

Ticket 12 includes pass 1; ticket 14 includes evidence-ownership work. Both must be integrated so Astra reviews the complete candidate, including new tooling tests, before final qualification.

## Delegation and scope

Implementation started on 2026-11-05 from `5dfc19e64ff5fea701c53314c54fffa20c17ca3c`, the delivered quality branch. Fetched `origin/main` and local `main` both point to `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, twelve commits behind this intentional base. The starting inventory selects 542 cases. The final pass retains only critical and important coverage at the cheapest effective boundary.

The user supplied a per-change browser budget for the permanent guide. Start from existing coverage. When a new important browser contract needs a scenario, use one representative happy path when appropriate and up to two distinct important failure or edge cases. Keep deterministic combinations at a lower boundary. The [browser coverage policy](../../../docs/agents/testing.md#browser-coverage-for-a-feature-or-fix) distinguishes this project decision from the published Playwright guidance.

The user then set a maximum of 100 cases that actually run in a browser and allowed more unit tests. Include the single development-storage case in that maximum. The 214 browser scenarios found after the first Astra cut are an intermediate candidate. Select at most 99 ordinary browser scenarios from the important native and public workflow owners before full qualification.

Use a fresh independent read-only sub-agent with the user's explicit settings: Astra (`gpt-6-astra`), reasoning effort `high`. Honor this over an ordinary fixed reviewer model; report unavailable settings rather than silently substituting. Supply actual baseline/candidate revisions, the cumulative diff, requirements, disposition register and evidence. The reviewer does not edit or run shared runtime resources.

Challenge every retained family/variant, including previous keep decisions, and review cumulative removals for meaningful lost coverage. For important oracles inspect immediate baselines, actual delivered input, surviving observation owners, representative real creation and asserted postconditions. Historical corrections already delivered need no second implementation. Propose an automated rule only for a demonstrated repeatable defect the existing tooling can recognize reliably.

The coordinator assigns accepted corrections to an implementation owner, preserving other work, then obtains Astra closure. The coordinator alone owns Git, source freeze, runtime resources and final qualification. This ticket launches no new product features or unrelated lint framework.

## Acceptance criteria

- [x] Record that all three passes used separate handoffs and that the final independent pass used Astra/High on the complete integrated candidate. Revisit prior survivors and removals. Select at most 100 browser-backed cases including development-storage.
- [x] Document the important failure, distinct detection value, boundary and cost for retained coverage families. Reconcile exact discovery with the inventory. Preserve tested owners for meaningful migrated obligations.
- [x] Apply accepted removals and corrections through assigned owners. Preserve positive controls and useful native interaction, accessibility, durability and geometry coverage. Check uncertain rewritten assertions with a focused sensitivity check where needed.
- [x] Resolve blocking findings and obtain Astra closure on cumulative value and assertions. Apply the repository's independent behavior and standards review requirements.
- [x] Reconcile the English guide, contributor and agent navigation, helper and runner contracts, inventory and CI smoke selection. Preserve historical evidence and keep temporary verification controls in ignored outputs.
- [x] Run affected lint, type and build checks and one cumulative native qualification. Preserve first attempts, runtime identity and cleanup. Reuse unchanged valid evidence and verify the narrowed case separately.
- [x] Publish the project counts, removed coverage and preparation, measured timings, runtime, retained risks, failures, rerun and review closure.

## Resolution

Closed on 2026-11-05 after Astra High approved the 330-case suite. The limit applies to the 98 browser-backed cases, including IndexedDB. The initial run passed all 233 pure and storage cases and 96 of 97 compiled Chromium cases. The only changed case passed its focused run after removal of the redundant second wheel cycle. [Qualification record](../implementation-15-results.md) · [Coverage ledger](../coverage-inventory.md#ticket-15-browser-cap).
