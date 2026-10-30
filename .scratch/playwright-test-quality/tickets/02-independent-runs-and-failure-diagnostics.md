---
title: Make pure runs independent and retain first-attempt browser diagnostics
status: closed
assignee: ticket-02-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Make pure runs independent and retain first-attempt browser diagnostics

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

F7-F8; user stories 25-26; completion criteria 5-6.

## What to build

A contributor can run pure tests without application infrastructure and investigate a browser failure from its first attempt, with useful artifacts and no automatic retries.

## Scope and handoff

Own runner selection, diagnostic configuration, associated supported-command documentation, and focused validation. Preserve the existing Playwright runner, local/storage modes, and immutable Preview workflow. Coordinate overlapping configuration edits with ticket 08 after this ticket completes.

## Blocked by

None (can start immediately).

## Acceptance criteria

- [x] Provide a supported pure-only command that starts no Nuxt server or browser, obtains no Preview credentials, and requires no artificial external base URL. Demonstrate this behavior with an actual pure run and process/runtime evidence (F7).
- [x] Verify test discovery for pure-only, browser, development-storage and complete local selections. Intended cases must neither disappear nor run twice because of project selection changes.
- [x] Preserve explicit external base URLs, immutable exact-commit Preview selection, scoped Preview authentication, and browser/package version agreement in CI.
- [x] Retain an inspectable trace on the first failed browser attempt and a failure screenshot when a live page is available. Keep the quality gate at zero retries (F8).
- [x] Demonstrate diagnostics with a controlled failing browser run; record the failure, retained artifact locations and trace inspection, then restore the normal candidate. Do not commit a deliberately failing scenario.
- [x] Keep artifacts separate per run/shard and owned-server logs actionable. Redact authentication material, and verify cleanup on success and failure without terminating unrelated processes.
- [x] Update the authoritative execution guidance to match the supported commands and diagnostic behavior, coordinating with ticket 01 if both touch the same reference.
- [x] Run focused runner checks, relevant lint/typecheck and a production build for configuration/integration changes. Supply reproducible evidence to the final integrated verification ticket.

## Planning baseline

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented the supported `npm run test:pure` launcher, deterministic selection seam, first-failure native diagnostics, protected-artifact sanitation and CI upload gate. Final discovery verifies 181 pure, 280 browser and one storage case without duplicates. Pure execution, occupied-port/no-browser independence, controlled authenticated and unauthenticated browser failures, relevant lint/typecheck and the application production build have recorded evidence. Both independent review axes closed.

The first complete run finished at 435/460 passes, then artifact cleanup failed and deleted its full native/JSON outputs. The precise missing-artifact cause remains unknown. Subsequent independently reproduced corrections preserve unauthenticated native output and report safe sanitation failure categories; authenticated failures remain fail closed. Final native proofs pass without claiming that another complete run was green. See [Tickets 02 and 03 implementation evidence](../implementation-02-03-results.md) for candidate identities, commands, restored faults, artifact locations and unresolved integration debt.
