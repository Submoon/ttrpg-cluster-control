---
title: Bound Zone placement with full-branch ghosts
status: closed
assignee: codex/issue-60-ticket-03
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 03: Bound Zone placement with full-branch ghosts

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 20-29, 31-33, 42-45, 56. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Move an object within or between local Zones with a pointer preview, a complete landing ghost, bounded numeric edits and predictable frame growth.

## Blocked by

None (can start immediately).

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started from c925e1a10e63969f1b2184121fdf3a8d8365dde5, which adds the approved planning artifacts on the verified origin/main baseline. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [x] A shared pure landing proposal drives the full-branch ghost and final applied geometry. The pointer preview may leave a frame; accepted new or changed local placement obeys the permitted elastic limit.
- [x] Fit descendants by frame growth while retaining dimensions, orientation and internal relationships. Do not clamp descendants independently, move neighbors, overlap their frames or move the camera automatically.
- [x] If required growth is blocked, show the last feasible landing or reject the change. Numeric coordinates reject impossible proposals instead of silently changing context.
- [x] An existing object released over empty space applies its bounded ghost position; new creation with no valid support creates nothing. Valid Zone targets retain current guarded transfer behavior.
- [x] Retain old out-of-frame positions on opening, unrelated edits and round trips. Persist the specific compatibility information without making new outliers valid.
- [x] Cancellation, touch/pinch takeover and stale input preserve source data. One accepted move includes frame growth and relationship consequences in one history action.

## Resolution

8c063cdc was integrated in 7c971b05. The bounded landing preview shows the complete hosted branch, shares geometry with the applied operation, preserves legacy outliers and rejects invalid new placements. The candidate passed 48 focused checks, changed-file lint and Vue typecheck. The two maintained browser journeys covered hosted-branch landing and compact pinch takeover. The wider pure run passed 714 checks and the two environment-blocked checks passed on targeted rerun.

## Verification

Keep geometry, compatibility and cancellation matrices in pure/controller tests. Extend the maintained movement/hosted-transfer and native-gesture coverage for the real ghost/release contract; review detail/compact screenshots as temporary visual evidence.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
