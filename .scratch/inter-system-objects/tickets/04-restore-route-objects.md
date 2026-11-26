---
title: Restore and preserve route objects
status: in-progress
assignee: codex/issue-60-ticket-04
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 04: Restore and preserve route objects

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 10-11, 13, 15, 17, 19-20, 41, 53, 65-67, 71-72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Open a complete campaign containing catalogue objects and hosted branches on routes, inspect their authored data on the map, and save, reload or back it up without a synthetic Zone or data loss.

## Blocked by

- [Assign Cluster-wide Location keys](02-cluster-wide-location-keys.md)
- [Bound Zone placement with full-branch ghosts](03-bounded-zone-branch-ghosts.md)

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Claimed on 2026-11-26 from integrated prerequisite revision `642f64eb`, based on the original comparison baseline above. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [x] Admit an exclusive Zone/route context with route-root progression and inherited hosted-branch context. Preserve stable identities, authored values and effective Orbit geometry for every catalogue type.
- [x] Version affected source formats coherently; restore supported older maps with no route objects and the accepted legacy exceptions. Reject malformed current data and invalid graph references.
- [x] Show restored route object roots at their route positions, support guarded consultation/authored-data editing, and preserve full branch data even before later navigation/placement slices are complete.
- [x] Extend context-aware catalogue access and global key inventory. Orbit occupancy and required relationship graphs remain acyclic and valid.
- [x] Complete local/cloud backup, ordered saving, reload, recovery and history snapshots retain the new graph; standalone Zone files retain their local scope.
- [x] Existing editing, deletion and export surfaces must handle the new context safely or explicitly reject an unsupported consequence. Never orphan branches, silently drop source records or expose a new private context.

## Candidate verification

The implementation at `d6b4c877b0044ec573f9f560764fb6adc923aa71` includes the integrated prerequisites through `2f8c1502`. Complete workspace and Cluster backups use version 7. Route branches share the existing Orbit layout, Field inventory, workspace writer and history. In this slice, occupied-route deletion and endpoint changes, Cluster copy import and Cluster image export reject unsupported operations. Player projection keeps its existing allowlist.

- Changed source and test files passed ESLint with zero warnings. Vue typecheck passed.
- The pure selection passed 723 tests. The remaining Markdown verification case could not create a Windows junction inside the sandbox and passed on an authorized focused rerun. The first run and rerun are retained in `test-results/playwright-1795688077469-16924-c9d7ceb5/` and `test-results/playwright-1795688200821-17216-f3e50641/` in the ticket worktree.
- The single maintained browser journey in `tests/workspace-data.spec.ts` passed. It restored a complete backup, verified the rendered route anchor against the SVG path, edited the route object, reloaded the saved workspace and checked the downloaded branch. The launcher session is retained in `test-results/local-test-1795688312498-40748-d350901b/` in the ticket worktree.

## Verification

Prove restore/edit/save/export/restore through codecs and real editor/writer seams. Extend the maintained complete-backup/reopen journey with one route object campaign; retain independent oracles for branch identity and geometry.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
