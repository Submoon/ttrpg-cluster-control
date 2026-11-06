---
title: Stabilize HTML targets and shared isolated preparation
status: closed
assignee: ticket-05-agent
type: implementation
spec: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 05: Stabilize HTML targets and shared isolated preparation

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

User stories 11-18; selector and shared-setup portions of F10; completion criteria 6-7.

## What to build

Tests can locate the intended control or map entity across layout, wording and naming changes, and prepare independent state with reliable teardown.

## Scope and handoff

Own the identified locator/helper contracts and their representative consumers, including required HTML semantics. Expand helper interfaces compatibly where needed so remaining callers stay green; tickets 06 and 07 migrate their own families and remove obsolete helpers once no callers remain. Coordinate shared-file edits without inventing additional behavioral dependencies.

## Blocked by

None (can start immediately).

## Acceptance criteria

- [x] Replace the identified structural counter indexing, map-context child selector, concatenated Apply-button-name dependency and parsing of formatted accessible names to infer creation targets.
- [x] Prefer scoped roles/names and associated labels for ordinary controls; improve native semantics or meaningful ARIA where users benefit. Use stable test identifiers for incidental presentation and existing domain identity attributes for map entities.
- [x] Make active desktop/compact scope explicit when both representations exist. Keep identities stable after rename or mode changes, and obtain generated identities from legitimate fixture or observable-result data.
- [x] Pass explicit identity and placement preconditions to creation helpers instead of reconstructing them from display prose. Preserve assertions about names, roles, text and keyboard behavior when those are the contract.
- [x] Reuse fresh per-test contexts and cloned immutable IndexedDB snapshots for setup that is not the behavior under test. Keep origin compatibility and avoid live page/context sharing. Dedicated creation, import, hydration and recovery tests retain their public paths.
- [x] Consolidate identical one-shot workspace-write abort and export-observation responsibilities. Each helper owns and removes its listeners, probes and failpoints on failure as well as success.
- [x] Verify representative desktop and compact consumers, a rename/mode-change case, isolation between fresh contexts, and relevant helper teardown. Do not add tests that merely mirror helper implementation.
- [x] Document the supported helper/locator contracts and limits for tickets 06-08. Helper extraction is preparation, not evidence that redundant browser execution has been reduced.

## Planning baseline

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

This ticket was implemented by `ticket-05-agent` and validated by the coordinator. Its scoped resolution is recorded below.

## Current implementation notes

- The implementation baseline is `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching `origin/main` fetched on 2026-10-30. There is no intentionally different base.
- Contract notes for tickets 06-08 are in [helper-contracts.md](../helper-contracts.md). They describe current supported locators, ID-based creation targets, fixture isolation, probe cleanup, and compatibility limits.
- The implementation adds identity-based desktop/compact regression coverage and a fresh-context snapshot isolation scenario. It keeps dedicated create/import workflows on their public UI paths.
- Coordinator validation and independent review are complete for this scope. The initial statistics red checks were valid; the first green attempt overlapped HMR and is not final evidence. The complete run, subsequent correction and baseline comparisons are recorded in the linked implementation evidence.

## Resolution

Closed on 2026-10-30. Stable scoped statistics/context contracts, domain-ID creation/selection, original cloned campaign snapshots and owned shared probes are implemented. The added identity and isolation regressions pass in the complete run. The full run exposed an eager empty-ID capture in system creation; its readiness correction retained exact assertions and passed the existing dirty-chart case in three independent contexts. Final typecheck and lint pass. Independent Standards and Spec reviews have no remaining code blockers.

See [Tickets 01 and 05 implementation evidence](../implementation-results.md) for the retained 447/452 initial full-run result and subsequent checks. Four long-journey timeouts reproduce on the unchanged baseline; the global suite is not claimed green. Their remaining work belongs to the agreed coverage/runtime and final integration tickets. No browser-execution reduction is claimed for helper extraction.
