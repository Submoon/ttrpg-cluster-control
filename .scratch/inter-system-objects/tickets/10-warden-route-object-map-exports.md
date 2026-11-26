---
title: Export Warden maps with route objects
status: closed
assignee: codex
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 10: Export Warden maps with route objects

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 65, 67-71. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Download a Cluster, selected-Zone or viewport image containing exactly the applicable Warden scene, while keeping complete backup and standalone Zone file scopes distinct.

## Blocked by

- [Find and inspect route objects across semantic zoom](07-route-object-navigation-and-filters.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation starts at `14e13d7bee9f0b3704066e90bb568f32bc48fd29`, the issue integration branch with the completed route navigation and filtering prerequisite. The original comparison baseline stays at `c649b576f1636c8ffec57da6b6112b6316bee882`.

## Acceptance criteria

- [ ] Entire-Cluster images include route object roots at overview detail. Viewport images preserve camera, detail and applicable filters.
- [ ] Selected-Zone detail contains its own objects/Orbits and bounded incident-route stubs; remote route objects do not enlarge its extent.
- [ ] Keep complete backup coverage for all route object data and reviewed standalone Zone copy/import scope. Newly copied assignments follow global key rules.
- [ ] Exclude pointer previews, full-branch ghosts, drafts, menus and panels. Preserve bounded PNG rasterization and complete in-scope SVG geometry.
- [ ] Use applied source data and operation-owned preflight/context checks so cancellation or a stale asynchronous result cannot download an unrelated scene.

## Verification

70f5e84b was integrated in a5fa7ecf. It passed 31 focused checks, lint and typecheck. The maintained Warden download journey passed on integrated revision a22b4077, including the complete Cluster SVG and the named Zone SVG/PNG. The exact browser evidence is retained under the qualification worktree's `test-results/local-test-1795692251299-14188-c87d49e0/playwright-run-1`.

Cover scope/bounds/serialization and async ownership with existing pure/controller seams. Extend the maintained private-file/download journey with targeted SVG/PNG content assertions, not a new export journey for every scope.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

## Implementation evidence

- The Warden image scene projects applied route branches on the exported route curve. Overview keeps roots, viewport uses the shared branch detail threshold and applied filters, and a selected-Zone image uses bounded incident stubs.
- SVG rebuilds the visible layers from the applied scene and carries only static paint definitions from the live SVG. PNG uses the same scene and existing raster limits. A selected route object participates in the viewport export context check when it can affect the scene.
- The 31 targeted pure tests for Warden image scenes, image scopes, export preflight, and the workspace codec passed on the ticket candidate. Playwright evidence is under the ticket worktree at `test-results/playwright-1795691714976-9276-7532c3b6/`. The maintained SVG and PNG download journey is ready for the frozen integration candidate.
