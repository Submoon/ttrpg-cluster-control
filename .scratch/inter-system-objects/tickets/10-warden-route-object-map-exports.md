---
title: Export Warden maps with route objects
status: open
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

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Entire-Cluster images include route object roots at overview detail. Viewport images preserve camera, detail and applicable filters.
- [ ] Selected-Zone detail contains its own objects/Orbits and bounded incident-route stubs; remote route objects do not enlarge its extent.
- [ ] Keep complete backup coverage for all route object data and reviewed standalone Zone copy/import scope. Newly copied assignments follow global key rules.
- [ ] Exclude pointer previews, full-branch ghosts, drafts, menus and panels. Preserve bounded PNG rasterization and complete in-scope SVG geometry.
- [ ] Use applied source data and operation-owned preflight/context checks so cancellation or a stale asynchronous result cannot download an unrelated scene.

## Verification

Cover scope/bounds/serialization and async ownership with existing pure/controller seams. Extend the maintained private-file/download journey with targeted SVG/PNG content assertions, not a new export journey for every scope.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

