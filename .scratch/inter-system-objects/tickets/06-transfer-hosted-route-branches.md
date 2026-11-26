---
title: Transfer hosted branches between Zones and routes
status: closed
assignee: Codex
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 06: Transfer hosted branches between Zones and routes

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 8-15, 23-32, 40, 42-45, 56, 66. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Relocate an existing object and its complete hosted branch between a Zone and a route or between valid supports while retaining identity and showing its actual final landing.

## Blocked by

- [Create and position catalogue objects on routes](05-create-position-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started at 14e13d7bee9f0b3704066e90bb568f32bc48fd29, the integration revision containing the completed prerequisites. The original comparison baseline is origin/main. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [x] Use the same target model for new and existing objects and allow a chosen valid Zone or route without an artificial origin restriction.
- [x] The root leaves its old parent Orbit and carries recursive hosted Orbits/occupants without rescaling, rotating or changing their internal geometry. The ghost shows this entire branch.
- [x] Apply the bounded Zone proposal and descendant growth policy for local landings and normalized route progression for route landings. Preserve the existing key rather than assigning a new one.
- [x] Review incompatible external relationships before acceptance. A departing Jump Point loses its local route attachment while the route retains the same endpoint Zones.
- [x] Explicit Detach or a deliberate Zone drop requires a valid local landing; there is no free-space fallback and no automatic detachment at 0% or 100%.
- [x] Apply context, branch, frame and link changes atomically in one Undo/Redo action. Cancelled or stale review cannot consume a preview or partially publish data.

## Verification

361eeae8 was integrated in 9d28c8d0. The runtime candidate passed 64 focused checks, lint and typecheck. The maintained Chromium journey verified the full branch ghost, matching applied route landing, explicit Detach and the hosted Orbit in the saved export.

Extend existing hosted-transfer and main-history integration checks with route context and deep branches. Reuse the maintained transfer/gesture journey for pointer-to-ghost agreement and save/reopen evidence already owned by the workspace journey.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

## Verification evidence

Runtime candidate `869e966d91e9a147555ac0a6d5ff26c513426e09` includes integration revision `a22b4077`. The later integration merge of `c93b51a4` changes the Search browser assertion and the two image-export ticket records.

- `PLAYWRIGHT_SUITE=pure` with `node node_modules/@playwright/test/cli.js test` targeted the transfer, transfer-workflow, transfer-draft, main-history, route-placement, workspace-codec and elastic-placement specifications. All 64 cases passed in 31.6 seconds. The run is under `test-results/playwright-1795692422465-41508-8490a4b6/` in the ticket worktree.
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` and ESLint with `--max-warnings 0` on the changed source and test files passed.
- Desktop Chrome on port 3166 passed `node scripts/local-test.mjs tests/workspace-halo-orbital.spec.ts --project=browser --grep "transferring a hosted branch"` in 26.0 seconds, with a 33.0-second Playwright run. The case checks Zone-to-Zone relationship review, native Zone-to-route drag, the full branch ghost, a one-CSS-pixel landing tolerance, explicit Detach to a chosen Zone, and the retained hosted Orbit in the saved export. The report includes the landing screenshot under `test-results/local-test-1795692513035-20344-2126cd70/playwright-run-1/results.json`.
- The first browser execution reached the ghost/application comparison and stopped in the Detach setup because the test omitted a helper import. Its screenshot and trace are under `test-results/local-test-1795691975062-40340-0d9b49ac/playwright-run-1/artifacts/`.
