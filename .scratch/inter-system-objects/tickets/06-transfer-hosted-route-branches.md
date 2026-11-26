---
title: Transfer hosted branches between Zones and routes
status: open
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

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Use the same target model for new and existing objects and allow a chosen valid Zone or route without an artificial origin restriction.
- [ ] The root leaves its old parent Orbit and carries recursive hosted Orbits/occupants without rescaling, rotating or changing their internal geometry. The ghost shows this entire branch.
- [ ] Apply the bounded Zone proposal and descendant growth policy for local landings and normalized route progression for route landings. Preserve the existing key rather than assigning a new one.
- [ ] Review incompatible external relationships before acceptance. A departing Jump Point loses its local route attachment while the route retains the same endpoint Zones.
- [ ] Explicit Detach or a deliberate Zone drop requires a valid local landing; there is no free-space fallback and no automatic detachment at 0% or 100%.
- [ ] Apply context, branch, frame and link changes atomically in one Undo/Redo action. Cancelled or stale review cannot consume a preview or partially publish data.

## Verification

Extend existing hosted-transfer and main-history integration checks with route context and deep branches. Reuse the maintained transfer/gesture journey for pointer-to-ghost agreement and save/reopen evidence already owned by the workspace journey.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
