---
title: Create and position catalogue objects on routes
status: in-progress
assignee: Codex
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 05: Create and position catalogue objects on routes

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 7-9, 17-18, 23-25, 30-32, 34-36, 39-44, 53, 56. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Create any catalogue object directly on a route, edit its information and manual percentage, and move it along the route using the same landing-preview contract.

## Blocked by

- [Restore and preserve route objects](04-restore-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started at 199145211568c9d9ff9236ee57efd5c8fe82ef92, the integration revision containing the completed prerequisites. The comparison baseline remains origin/main. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Creation targets a valid route directly and does not require a previous Zone object or an incident-origin restriction. Invalid new drops create nothing and cannot allocate orphan records.
- [ ] Use globally available new keys and the same catalogue data/publication fields as local objects. Route ownership is explicit; no arbitrary Cluster-coordinate arm is introduced.
- [ ] Expose finite 0%-100% progression in Inspect and pointer/keyboard placement. No clock, speed or automatic endpoint detachment is added.
- [ ] With no different valid target, an existing route object's ghost projects onto its current route and release applies that proposal. Reaching an endpoint or unresolved exit leaves it attached.
- [ ] Recheck captured context and revision before publication, exclude previews from persistence, and use one accepted mutation/history action with current durability feedback.
- [ ] A stationary obstacle can be created at a chosen route percentage and remain there until an explicit position edit; relative placement and route-reshape rules apply without a separate automatic travel mode.

## Verification

Use deterministic catalogue/progression/drop matrices and guarded command checks. Extend the existing route/object editing journey for a representative created route object; do not add a browser case per type or percentage.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

## Verification evidence

Candidate `da86c2e2057b6a99ff916b445b5f3e7794fa7401` includes prerequisite integration `3470aa42c496c67d1f2d988e7a16f5109b110b25`.

- Set `PLAYWRIGHT_SUITE=pure` and ran `node ../../../node_modules/@playwright/test/cli.js test workspace-route-object-placement workspace-history-main-integration workspace-codec continuous-map-route-hit continuous-map-route-geometry workspace-history-families workspace-transfer` on `2e2509b7bdd9fffa486c26bbfa90cb3a89e3f760`. All 79 tests passed in 43.8 seconds. Test output belongs to `test-results/playwright-1795690106497-21212-93927a85/` in the ticket worktree. The following candidate changes only the browser assertion and the total scenario timeout.
- `node ../../../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` passed on `2e2509b7` and `d8cbddea`. ESLint passed on the changed TypeScript and Vue sources and on the final browser assertion.
- Set `PLAYWRIGHT_SUITE=browser`, `LOCAL_TEST_PORT=3147` and the installed Chromium path. Ran `node scripts/local-test.mjs tests/workspace-continuous-routes.spec.ts --project=browser --grep 'authored exits'`. Desktop Chromium covered keyboard creation of a hazard at 50% on an unresolved route, precise editing to 25.125%, and release over empty map space at the center shown by the ghost. The scenario passed in 30.6 seconds (36.3 seconds for the Playwright runner). Report and landing screenshot are under `test-results/local-test-1795690779883-15720-e6c40f55/playwright-run-1/`.
- The first browser execution exposed a release guard that treated its own drag as a keyboard overlay. The trace is retained under `test-results/local-test-1795689409581-41876-9bf59a78/playwright-run-1/artifacts/`. The next execution recorded matching ghost and applied scene transforms and exposed a stroke-width difference in the bounding-box oracle. That trace is retained under `test-results/local-test-1795690078608-17720-042bdcfc/playwright-run-1/artifacts/`. The next run timed out while setting up the unresolved route after the cold fixture import took about 40 seconds. Its trace is under `test-results/local-test-1795690353461-36420-85bd3bc6/playwright-run-1/artifacts/`. The final retry used 90 seconds for the complete scenario and retained the individual assertion budgets.
- The focused browser case uses a desktop viewport. Compact and touch qualification remain in the integrated verification ticket.
