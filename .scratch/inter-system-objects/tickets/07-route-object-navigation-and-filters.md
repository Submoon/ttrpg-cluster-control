---
title: Find and inspect route objects across semantic zoom
status: closed
assignee: codex/issue-60-ticket-07
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 07: Find and inspect route objects across semantic zoom

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 41, 50-56. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Locate a route object under its route in Hierarchy or through object Search and filters, inspect it, and keep selection while its hosted detail appears or collapses.

## Blocked by

- [Restore and preserve route objects](04-restore-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started from integrated prerequisite revision `3470aa42c496c67d1f2d988e7a16f5109b110b25`, compared against `origin/main` at the baseline above.

## Acceptance criteria

- [x] Nest route branches under their route and local branches under their Zone. Expansion is consultation; selection and editing use the existing guarded commands and explicit context.
- [x] Search names and Location keys in both contexts with useful result context. Extend current Type/Field/publication inventories without adding route or Orbit search result kinds.
- [x] Preserve independent map/Search criteria lifetimes, dimming and Hierarchy reachability. Route objects retain normal applicable Fields and catalogue inspection.
- [x] Root markers remain visible at distant zoom, hosted detail appears progressively, and selection survives collapse and context changes without a synthetic owner Zone.
- [x] Maintain usable focus and depth in compact/deep Hierarchy and respect existing touch, keyboard and panel lifetimes.
- [x] Cover stationary obstacles, anomalies, derelicts and other non-vessel catalogue objects as well as ships. A route object need not be travelling; no automatic movement or vessel-only query/filter path is introduced.

## Candidate verification

The runtime at `387a7f45d71d7c3cb74ca039a4d6756a19a277cc` adds route-owned records to the existing Hierarchy and Search. Search reveals a route occupant in the same continuous map and preserves its actual owner. The map keeps a selected or keyboard-focused occupant visible when its branch detail collapses.

- Vue typechecking passed with `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json` after `nuxt prepare`. ESLint passed on the changed Vue and TypeScript files with `--max-warnings 0`.
- The 59 focused tests passed on `38694058` with `PLAYWRIGHT_SUITE=pure` and the files `workspace-search-model`, `workspace-search-command`, `warden-map-filters`, `warden-map-filter-session` and `workspace-hierarchy-tree`. The report is in the ticket worktree at `test-results/playwright-1795690676616-42476-e7365e58/results.json`. The first failing Search and Hierarchy cases are retained in `test-results/playwright-1795690022682-39308-2775fcaa/` and `test-results/playwright-1795690295274-15340-d88f5347/`.
- Browser qualification remains on the integration branch. The maintained Search journey in `tests/workspace-global-search.spec.ts` covers a seeded anomaly, its dimmed map marker and locator, routed Hierarchy depth and selection after zooming out. The existing publication journey in `tests/workspace-player-content.spec.ts` uses the Hierarchy's route treeitem.

## Verification

a3ac0ab2 was integrated in b4790623. The Warden Hierarchy, Search, criteria and semantic zoom include all route objects and hosted branches. The checked candidate passed 59 focused checks, lint and typecheck. The maintained Search and Hierarchy browser journeys are queued for cumulative qualification.

Use search/criteria and selection-controller checks for combinations. Extend the owning Search, continuous navigation and deep-Hierarchy journeys with route object data rather than creating parallel navigation scenarios.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
