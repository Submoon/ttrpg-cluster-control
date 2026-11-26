---
title: Create and position catalogue objects on routes
status: open
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

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

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
