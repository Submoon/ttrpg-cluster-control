---
title: Publish and read route objects without private-route leaks
status: open
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 09: Publish and read route objects without private-route leaks

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 54-55, 57-64, 71-72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Publish permitted route objects and hosted detail in preview, player files/links and the detached reader while withholding private routes and Warden preparation.

## Blocked by

- [Restore and preserve route objects](04-restore-route-objects.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

This ticket is planned and unclaimed. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Apply the four publication modes, required-host minimum disclosure, player text and Field masks to route contexts. Sharing a route does not promote a Hidden route object.
- [ ] A published route object on a private or omitted route carries only allowed detached geometry/content, with no private association, percentage, path, name, destination or source identifier.
- [ ] An allowed shared-route association uses only public identities/progression and authorized endpoints. Public geometry, hierarchy, bounds and counts do not depend on hidden inventory.
- [ ] Consult a route object even when no Zone marker or route is published; reject a completely empty public document. Do not add a synthetic Zone or private parent placeholder.
- [ ] Resolve effective branch geometry before filtering and preserve semantic selection. Preview and detached reader consume the same allowlisted document.
- [ ] Version/admit public files and immutable links explicitly, preserve older supported documents and reject malformed current ones. New public content must not be silently dropped by an unfinished consumer.

## Verification

Use paired private-variance projection/codec tests and real reader/export-operation controllers for the main privacy matrix. Extend the maintained publication and reader journeys with one representative route object case.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
