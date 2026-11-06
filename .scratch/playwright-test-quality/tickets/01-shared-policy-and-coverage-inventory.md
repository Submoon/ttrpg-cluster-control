---
title: Publish shared testing guidance and inventory browser coverage
status: closed
assignee: ticket-01-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Publish shared testing guidance and inventory browser coverage

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

User stories 1-10 and 30; completion criteria 1-2. Establishes the reduction plan for F10.

## What to build

Contributors and coding agents can choose the appropriate existing test boundary and identify the distinct obligation of every browser case before changing coverage.

## Scope and handoff

Own the permanent shared policy and the initial coverage inventory. The migration tickets update their inventory entries as they land; the final verification ticket reconciles the whole result. This ticket does not need the runner changes to start: distinguish currently supported commands from planned changes until their owning ticket lands.

## Blocked by

None (can start immediately).

## Acceptance criteria

- [x] Extend the existing verification reference in English, with concise contributor and conditional agent entry points. Keep each policy authoritative in one place and distinguish official Playwright recommendations from repository choices.
- [x] Document the approved boundaries: domain functions for rules and validation; real controllers/stores for transitions and deferred saving; browsers for gestures, focus, rendering, IndexedDB and representative complete journeys.
- [x] Cover locator selection, meaningful native semantics and ARIA, explicit test identities, fixture isolation/ownership, awaited assertions, timing and geometry, failure diagnosis, and review exceptions. Link official documentation and check compatibility with the installed Playwright version.
- [x] Inventory every browser case on the implementation baseline, including parameterized variants and new map-tool shortcuts. Record its behavioral obligation, preconditions, overlap, and retain/narrow/merge/migrate/retire disposition. Family rationales are acceptable only when every case is accounted for.
- [x] For proposed removals or migrations, identify the meaningful assertions and planned retained owner or obsolete requirement. Assign UI/map families to ticket 06 and data/controller families to ticket 07 without leaving unowned cases.
- [x] Record baseline discovery counts by project and the exact revision. Planning discovery was 450 cases in 79 files; reconcile changes rather than treating that count as a fixed target.
- [x] Assess precise mechanical enforcement through existing lint/check tooling; implement useful narrow checks with an appropriate positive/negative example, or record why proposed checks are unsuitable. Do not turn behavioral judgment into blanket syntax prohibitions.
- [x] Verify documentation links and navigation from both contributor and agent entry points. Reconcile the inventory with test discovery and record evidence; do not run the complete browser suite solely for this documentation/inventory work.

## Planning baseline

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Implementation handoff

The assigned documentation and inventory work was handed off for coordinator validation. Final review and the scoped outcome are recorded in Resolution below.

- Shared policy: `docs/agents/testing.md`, linked from the README contributor path and conditionally from `AGENTS.md`. It distinguishes official Playwright guidance from repository choices and documents current runner limits.
- Inventory: `.scratch/playwright-test-quality/coverage-inventory.md` records all 276 `browser` cases and the one `development-storage` case discovered at the baseline, with exact titles (each parameterized value is a separate case), source lines, family preconditions/overlaps, owners and proposed dispositions. Raw JSON is ignored at `test-results/ticket01-implementation-baseline-discovery.json`.
- Baseline reconciliation: the discovered 450 cases in 79 files equal the planning total: 173 pure, 276 browser, and 1 development-storage. The original audit had 432 cases/77 files; the 18-case increase is in browser coverage, including map-tool shortcuts.
- Runner limits remain unimplemented: `--project=pure` and `PLAYWRIGHT_SUITE=checks` still start the global app server; the current config has zero retries but no automatic first-attempt trace or failure screenshot. These remain visible as current limits for ticket 02.
- Mechanical enforcement assessment: no new blanket lint rule was added. Existing ESLint does not encode behavior boundaries or assertion effectiveness; broad bans on delays, CSS, positional locators, or actionability options would reject justified timing, geometry and native-input cases. The policy records review criteria instead.
- Discovery used `npm exec playwright test -- --list --reporter=json`; the report contains 450 listed cases, no discovery errors, and its 277 non-pure entries match all 277 inventory rows exactly (zero title/source/project mismatches). The raw report is ignored by Git. No browser suite, server, Nuxt generation, typecheck or build was run for this documentation/inventory task.
- Documentation validation found 17 local Markdown links and zero broken targets across the README, AGENTS, policy, inventory and ticket. The README contributor link and conditional AGENTS test pointer both resolve. Official Playwright guidance pages were checked against the installed package and CI pin `1.64.0`.
- Ticket 05 is adding two focused identity regressions after this baseline: rename/mode/responsive map UI behavior and Add-route targeting a renamed duplicate system identity. They are intentionally outside the 450-case baseline inventory; ticket 09 will reconcile their exact titles and the candidate project totals.
- Coordinator review and integrated validation are still outstanding.

## Resolution

Closed on 2026-10-30. The shared English policy is reachable by humans and agents. The inventory reconciles every baseline browser-backed case and assigns concrete retained owners for proposed reductions. Independent Standards and Spec reviews are closed with no remaining code blockers for this ticket.

See [Tickets 01 and 05 implementation evidence](../implementation-results.md) for discovery, validation, failure history and the four reproduced baseline timeout limitations. Coverage reductions and runner corrections remain assigned to their own open tickets.
