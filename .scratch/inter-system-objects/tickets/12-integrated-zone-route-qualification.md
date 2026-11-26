---
title: Qualify the complete Zone and route-placement workflow
status: open
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

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Verify all predecessor acceptance criteria on one integrated candidate, including empty Zones, global keys, deep branch ghosts, route placement, destructive review, publication and scoped files.
- [ ] Remove transitional restrictions only when the owning capability is complete; route context cannot be lost or silently omitted through ordinary commands, persistence or sharing.
- [ ] Confirm full current/legacy round trips, one-action history, stale-operation rejection and preserved previous campaign data without speculative automatic repairs.
- [ ] Reuse relevant successful evidence for unchanged code; run cumulative qualification on the frozen candidate according to repository guidance.
- [ ] Keep most coverage in domain/controller tests. Reuse maintained browser journeys; a new browser scenario requires a distinct documented native-input, data-loss or disclosure risk.
- [ ] Record candidate revision, checks, first-run failures and artifact locations. Do not merge, release or close the GitHub parent as part of this ticket.

## Verification

Collect exact-candidate integrated evidence, inspect representative detail/compact ghost states, and run the required full qualification once; retest broader areas only when a correction adds risk.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
