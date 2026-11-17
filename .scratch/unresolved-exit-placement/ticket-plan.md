---
title: Approved tickets for map-based positioning
status: closed
closed_on: 2026-10-28
plan_status: approved
plan_approved_on: 2026-10-27
tickets_status: published
---

# Approved tickets for map-based positioning

This is the approval, dependency, and delivery index for [Map-based positioning and movable unresolved-exit targets](spec.md). The six tickets are locally closed; their acceptance criteria and per-slice evidence remain in the linked ticket files and delivery records.

## Source and baseline

- Source: [Allow repositioning unresolved-exit target markers on the Cluster map — GitHub #27](https://github.com/Submoon/ttrpg-cluster-control/issues/27).
- The approved breakdown was published on 2026-10-27 against 9edfa66c4f505d56f106fc4af8245f200abfba78, with HEAD, main, and origin/main aligned. This historical baseline is not an implementation starting instruction.
- The related Undo/Redo request is [GitHub #5](https://github.com/Submoon/ttrpg-cluster-control/issues/5). It was a contract to coordinate with, not a blocker.

## Slicing decisions

Deliver by user-visible element family and scenario. Each ticket owns its command behavior, preview/commit/cancel guarantees, durable-state effects, and affected tests. Reuse the placement controllers, pure geometry, guarded commands, and single workspace writer. No standalone horizontal prefactor was justified. Shared files require coordination, but do not create product dependencies by themselves.

## Published tickets

| Ticket | Status | Blocked by | Durable outcome |
| --- | --- | --- | --- |
| [01 — Position Cluster systems from the map](tickets/01-position-cluster-systems-from-map.md) | closed | None | Cluster systems use map placement and keyboard creation without coordinate fields. |
| [02 — Move and retain unresolved-exit targets](tickets/02-move-and-retain-unresolved-exit-targets.md) | closed | None | Unresolved exits use durable route-keyed placement with lifecycle and interchange cleanup. |
| [03 — Recover and export distant unresolved exits](tickets/03-recover-and-export-distant-unresolved-exits.md) | closed | 02 | Distant exits remain recoverable with whole-scene Fit, coherent viewports, and bounded PNG/SVG export. |
| [04 — Position free system-map objects without coordinates](tickets/04-position-free-system-map-objects.md) | closed | None | Free objects use map placement with independent drafts and preserved relationship guards. |
| [05 — Position Orbit occupants without angle fields](tickets/05-position-orbit-occupants-without-angle-fields.md) | closed | 04 | Orbit occupants and creation use map or keyboard placement without positional-angle forms. |
| [06 — Move unoccupied Orbit centers without coordinate fields](tickets/06-move-unoccupied-orbit-centers.md) | closed | None | Unoccupied Orbit centers use map previews while retaining size, orientation, and hosting controls. |

## Blocking graph and frontier

The approved graph is **02 → 03** and **04 → 05**. Tickets 01 and 06 have no ticket blockers. The initial frontier was 01, 02, 04, and 06; after the authorized second frontier completed, no ticket remained. Frontier availability did not authorize concurrent writers outside the repository's ownership and resource limits.

## Decisions so far

- Keep each family independently demonstrable; completing a slice does not complete the parent specification or GitHub request.
- Remove editable positional fields only as that family gains its verified map-based replacement.
- Preserve drafts, relationship guards, persistence, recovery, and export behavior in the affected slice rather than deferring their tests.
- Tickets 01–06 delivered the outcomes in the table. The [first-frontier record](implementation.md) and [second-frontier record](implementation-second-frontier.md) describe implementation ownership and integration. Independent findings and closure are in [first-frontier review](review.md) and [second-frontier review](review-second-frontier.md).

## Specification coverage

Numbers refer to the parent specification's user stories. The ticket links preserve the detailed acceptance and test criteria; this map retains the approved coverage index.

| Ticket | Story coverage |
| --- | --- |
| 01 | 30–43, 45–46, 54, 58–60, 64–71, 80, 86 |
| 02 | 1–45, 64–76, 80–86 for the ordinary scene; far-scene guarantees completed by 03 |
| 03 | 5–7, 40, 68–69, 76–85 |
| 04 | 30–45, 47, 49, 51, 55, 58–60, 62–71, 80, 86 |
| 05 | 30–45, 48–49, 51–53, 57–68, 70–71, 80, 86 |
| 06 | 30–45, 50–53, 56, 58–71, 80, 86 |

All 86 stories are covered collectively. The [first-frontier record](implementation.md), [second-frontier record](implementation-second-frontier.md), and both independent review records preserve prior test and review evidence, including corrected initial full-suite failures and the boundary of each rerun. They do not claim one wholly green full-suite attempt.

## Approval and publication

The user approved the six tickets on 2026-10-27. The first four selected tickets were authorized together; tickets 03 and 05 followed their blockers. Approval, publication, and local closure did not authorize GitHub issue changes or remote PR activity.

## Publication verification

The original publication check recorded six open, ready-for-agent tickets, 82 acceptance criteria, coverage of all 86 stories, and only the approved blocking edges 02→03 and 04→05. The later implementation records close all six tickets. GitHub #27 remains a separate source request; no local plan action changes its state.

## Resolution

All six implementation tickets and their collective scope closed locally on 2026-10-28. The two implementation records and two reviews preserve the baselines, test results, corrected integrated-suite failures, and independent review closure. Local completion does not close or modify GitHub issue #27.
