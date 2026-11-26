---
title: Export player images from permitted route object scenes
status: open
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 11: Export player images from permitted route object scenes

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 59-64, 69-72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Download public Cluster, viewport and eligible Zone images that match the permitted route object scene in preview and reader.

## Blocked by

- [Publish and read route objects without private-route leaks](09-publish-and-read-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Build source-free images from the allowed public document, including permitted route object roots and branch detail at the chosen scope.
- [ ] Private route metadata, hidden branches, GM notes, source identifiers and private extents are absent from SVG content, PNG bounds, titles and filenames.
- [ ] Support route object-only public scenes without requiring a published Zone marker; retain selected-Zone eligibility and refuse a wholly empty public artifact.
- [ ] Honor immutable snapshot, preflight, context cancellation and bounded rasterization rules. Export neither ghosts nor unpublished placement drafts.
- [ ] Use the same allowed geometry and disclosure in preview, detached reader and exported scene.

## Verification

Use public image/codec privacy and operation-controller checks with independent bounds/content assertions. Reuse the maintained player-reader/download journey for actual artifact wiring.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

