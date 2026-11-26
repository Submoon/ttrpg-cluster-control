---
title: Assign Cluster-wide Location keys
status: in-progress
assignee: Codex ticket 02
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02: Assign Cluster-wide Location keys

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 16-19, 68, 72. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Allocate and edit new keys against the whole Cluster while retaining duplicate assignments already present in older campaigns.

## Blocked by

None (can start immediately).

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Implementation started from integration candidate c925e1a1, which adds the approved specification to the recorded origin/main baseline. Its ready-for-agent role means the brief is specified; unresolved blockers still prevent execution. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] New automatic and manual key assignments scan all available object contexts. Creating a local map, editing an object and importing an independent Zone copy cannot introduce a new duplicate.
- [ ] Retain existing duplicate assignments on opening, unrelated edits, relocation, save/reload, history and complete backup/restore; keys remain separate from globally unique entity IDs.
- [ ] Compatibility information survives serialization and distinguishes retained assignments from new duplicates or malformed current data. A changed key must satisfy the global rule.
- [ ] Review necessary key replacements for newly copied objects without modifying destination objects or silently rewriting notes. Complete restore retains saved assignments.
- [ ] Expose useful validation through the actual object and copy-import workflows, not only a schema validator.

## Verification

Use key-allocation, validation, copy-import and codec matrices plus real mutation-controller checks. Reuse the current object-edit/import journey for UI wiring; no new browser matrix.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.


## Verification evidence

On the ticket branch based on c925e1a1, the focused Playwright pure suite passed 161 cases covering workspace admission, codec and import behavior, retained keys, editing controllers, transfer, and history. The subsequent typed current-version fixture correction was checked with the import and Location key suites, which passed 12 cases. The reports are under the ticket worktree's `test-results/ticket02-candidate-pure.json` and `test-results/ticket02-current-fixture-pure.json`. Scoped ESLint passed with zero warnings.

The initial full pure run identified fixtures that still used older version expectations or unmarked local duplicate keys. It also exposed worktree access limits for the Windows symlink and local Playwright runner tests. The initial evidence is `test-results/ticket02-first-full-pure.json`. The existing import and hosted-branch browser journeys now assert reviewed key replacement and key retention, respectively. They are pending verification on the integrated candidate.
