---
title: Review route edits and destructive consequences
status: in-progress
assignee: codex/issue-60-ticket-08
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 08: Review route edits and destructive consequences

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 14-15, 37-39, 41-49. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Edit or delete a route containing route objects, understand all indirect consequences, and undo or redo the complete accepted operation.

## Blocked by

- [Restore and preserve route objects](04-restore-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

The implementation started from integrated prerequisite revision `199145211568c9d9ff9236ee57efd5c8fe82ef92`, compared against `origin/main` at the baseline above.

## Acceptance criteria

- [ ] Route reshaping and retargeting retain each route object's relative progression; simple departure/arrival reversal complements it. Preserve branch proportions and logical identity.
- [ ] Camera changes do not mutate progression or ownership. Route endpoints remain different Zones or an unresolved exit, with optional valid local Jump Points.
- [ ] Review route deletion with all affected route objects, hosted Orbits and occupants. A Zone deletion review includes incident routes and their route object cascades.
- [ ] Confirmed deletion removes the entire affected graph and obsolete layout references; cancelling preserves data and history. No detached route object survives without support.
- [ ] Undo/Redo restores route, route objects, branches, placement and useful selection context together, with current capacity, save-state and stale-context guards.

## Verification

Own reversal, retarget and cascade matrices in domain/controller tests. Extend maintained route editing and destructive-history journeys only for the visible review/Undo obligation.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
