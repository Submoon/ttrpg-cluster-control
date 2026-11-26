---
title: Qualify the complete Zone and route-placement workflow
status: in-progress
assignee: codex/issue-60-ticket-12
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 12: Qualify the complete Zone and route-placement workflow

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 1-72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Deliver the integrated Zone/route-object feature through normal entry points with coherent formats, complete acceptance evidence and no unfinished context consumers.

## Blocked by

- [Create empty generic Zones](01-empty-generic-zones.md)
- [Transfer hosted branches between Zones and routes](06-transfer-hosted-route-branches.md)
- [Review route edits and destructive consequences](08-route-lifecycle-consequences.md)
- [Export Warden maps with route objects](10-warden-route-object-map-exports.md)
- [Export player images from permitted route object scenes](11-player-route-object-image-exports.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

All prerequisite tickets are closed. Qualification began on 1c0cf5b2f90ecf185e8c40e3821251d7a8f468c0 on the integrated feature branch. The final qualified runtime and browser fixture candidate are recorded below. The original comparison baseline remains origin/main at c649b576f1636c8ffec57da6b6112b6316bee882.

## Acceptance criteria

- [x] Verify all predecessor acceptance criteria on one integrated candidate, including empty Zones, global keys, deep branch ghosts, route placement, destructive review, publication and scoped files.
- [x] Remove transitional restrictions only when the owning capability is complete; route context cannot be lost or silently omitted through ordinary commands, persistence or sharing.
- [x] Confirm full current/legacy round trips, one-action history, stale-operation rejection and preserved previous campaign data without speculative automatic repairs.
- [x] Reuse relevant successful evidence for unchanged code; run cumulative qualification on the frozen candidate according to repository guidance.
- [x] Keep most coverage in domain/controller tests. Reuse maintained browser journeys; a new browser scenario requires a distinct documented native-input, data-loss or disclosure risk.
- [x] Record candidate revision, checks, first-run failures and artifact locations. Do not merge, release or close the GitHub parent as part of this ticket.

## Verification

Collect exact-candidate integrated evidence, inspect representative detail/compact ghost states, and run the required full qualification once; retest broader areas only when a correction adds risk.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

## Qualification evidence

### Initial integrated candidate

Candidate `1c0cf5b2f90ecf185e8c40e3821251d7a8f468c0` was compared with `origin/main` at `c649b576f1636c8ffec57da6b6112b6316bee882`.

- Markdown local links and heading references, `git diff --check origin/main`, ESLint with zero warnings, and Nuxt typecheck passed.
- `npm run test:pure` passed all 747 cases with the Windows junction tests enabled. The retained log and report are `test-results/ticket12-frozen-pure.log` and `test-results/ticket12-frozen-pure.json` in this ticket worktree.
- The first production build failed in Rolldown after the client transform with an invalid UTF-8 error in `components/inspector/MapObjectInspector.vue` at line 161. Byte validation also found invalid UTF-8 in `tests/workspace-halo-orbital.spec.ts` at line 290. The first error and blob diagnostics are recorded in `test-results/ticket12-frozen-build-first-error.log`. The cumulative browser run awaits the corrected candidate.
- Representative visual evidence from earlier slices includes the desktop Zone-to-route branch landing from ticket 06 and the compact Move preview and pinch takeover from ticket 03 at an emulated 390 × 844 viewport. Reviewed copies are `test-results/ticket12-desktop-branch-landing.png`, `test-results/ticket12-compact-before-pinch.jpeg`, and `test-results/ticket12-compact-touch-takeover.jpeg` in this ticket worktree.

### First corrective candidate

Candidate `f8653841a70257aa25853eb743a1e9c0984c27c1` corrected the UTF-8 failures and incorporated the first review fixes. Its 752 pure checks passed in 1.3 minutes, including the added transfer, navigation, and projection regressions. Evidence is in `test-results/ticket12-f8653841-pure.log` and `test-results/ticket12-f8653841-pure.json`. Nuxt typecheck passed. ESLint flagged duplicate prop and local binding names in two Vue dialogs. The first lint errors are retained in `test-results/ticket12-f8653841-lint.log`.

The first corrective build passed client and server transforms. Nitro bundling was stopped before completion when the replacement candidate became available. Its log is `test-results/ticket12-f8653841-build.log`.

### Runtime qualification

Candidate `fd4affc377cddfc81980cf3ba71075000b610161` passed the Markdown and diff checks, full ESLint, Nuxt typecheck and the production build. The build completed in 2 minutes 44 seconds with a large-chunk warning, dependency export deprecations and a generated Rollup annotation warning. All 754 pure cases passed in 54.8 seconds. These logs and the pure JSON report share the `test-results/ticket12-fd4affc3-` prefix.

- The development-storage case passed on local Chrome, including preservation of the current and backup records after a failed IndexedDB save. Report `test-results/local-test-1795694582590-10380-daf9faae/playwright-run-1/results.json`.
- All four Preview smoke cases passed on local Chrome in 1.2 minutes. Report `test-results/local-test-1795694657376-23444-9df363ea/playwright-run-1/results.json`.
- The first full browser attempt recorded 18 passing cases and two failures before the Windows file watcher reported an unidentified event and invalidated the run. The group Orbit fixture proposed a move with insufficient room for its hosted branch. The map-navigation scenario exceeded 30 seconds while restoring its fresh browser state, after passing in 16.5 seconds in the earlier smoke run. The local launcher retained the failure traces, screenshots and invalidation under `test-results/local-test-1795694782902-41188-fec85bbc/playwright-run-1/`. The log is `test-results/ticket12-fd4affc3-browser.log`.

### Final browser qualification

- Candidate `cf8b65553ee735d1297643178e192d0b61457a9f` changed only the cross-Zone group-movement fixture. The original anchors left Iria's hosted Orbit crossing a fixed neighbor by 3.72 scene units during the intended Orbit landing. The revised anchors leave 14.68 scene units of clearance. The existing scenario still verifies cancellation, a two-owner move and Orbit placement, Undo, Redo and reload.
- The default Playwright web-server probe timed out after 300 seconds before any cases started. The retained log and matching Git snapshots are `test-results/ticket12-cf8b6555-browser.log` and `test-results/ticket12-cf8b6555-browser-source-freeze.log`. The retry started its own Nuxt server on `127.0.0.1:3100`, checked HTTP and hydrated welcome readiness through the repository helpers, then supplied that base URL to Playwright. Both runs used one Chrome worker, zero retries and a 90-second scenario budget to account for the earlier hydration timeout. Individual assertion timeouts remained as defined in the tests.
- The owned-server run exercised all 23 maintained browser cases in 7.5 minutes and recorded 22 passes. It passed the adjusted group scenario in 36.8 seconds, the earlier timed-out navigation scenario in 14.9 seconds and the compact touch scenario in 18.4 seconds. The Warden image scenario failed before UI setup because the earlier Search case modified the shared legacy fixture's object-angle map. The report and matching source snapshots are `test-results/ticket12-cf8b6555-owned-browser.json` and `test-results/ticket12-cf8b6555-owned-source-freeze.log`. The first failure trace, screenshot and error context are retained in `test-results/playwright-1795695842123-43140-e30abc18/artifacts/workspace-image-exports-a--31329-and-the-named-Zone-interior-browser/`.
- Final candidate `b1c87b2db4bf469b54b6d042eeb3e1a71d8dc209` isolates the Search fixture by restoring a copy. Global Search followed by Warden image export passed in the same Chrome worker in 39 seconds. Exact Markdown, diff and changed-test lint checks passed. The scoped report and matching source snapshots are `test-results/ticket12-b1c87b2d-owned-browser.json` and `test-results/ticket12-b1c87b2d-owned-source-freeze.log`.
- All 23 maintained browser obligations have passing evidence across the full run and the final scoped correction. The two final changes are isolated to browser fixture inputs, so the production build, 754 pure checks, development storage and four smoke results on `fd4affc377cddfc81980cf3ba71075000b610161` cover the delivered runtime. No browser scenario was added.
- The cumulative desktop route-placement and branch-landing screenshots are `test-results/ticket12-cf8b6555-route-object-landing.png` and `test-results/ticket12-cf8b6555-zone-to-route-branch-landing.png`. The compact screenshots are from the earlier ticket 03 trace, with the compact interaction also exercised in the cumulative run. The viewport and touch input were emulated.

The predecessor evidence and the cumulative qualification cover empty Zones, compatibility for existing keys and placements, hosted branches, guarded route editing and cascades, history, complete backups, standalone Zone scope, and public publication and image scopes.
