---
title: Create empty generic Zones
status: in-progress
type: implementation
specification: ../spec.md
baseline: c649b576f1636c8ffec57da6b6112b6316bee882
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01: Create empty generic Zones

## Specification

[Zones and catalogue objects on routes](../spec.md), user stories 1-6. The [approved implementation plan](../ticket-plan.md) defines the graph. Source intake: [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).

## What to build

Create an empty named Zone, use it as a stellar or non-stellar local map, and reopen existing campaigns without renaming or losing their contents.

## Blocked by

None (can start immediately).

## Baseline and boundaries

Use origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26, as the original comparison baseline. Integrate completed prerequisite tickets before claiming this slice. Record the actual candidate revision and any deliberately different base when implementation begins; preserve existing local work.

Use the accepted specification's whole-Cluster key policy and explicit legacy exceptions. Route objects include stationary obstacles, anomalies, derelicts and ships; position is manual. Keep one guarded mutation/writer/history path and exclude unapplied previews from saved or public data.

Claimed on 2026-11-26 on codex/issue-60-ticket-01 from integration revision c925e1a1, which adds the approved planning artifacts to the original baseline. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [ ] Initial and subsequently added Zones are empty; stars are added through the ordinary catalogue. Generic commands, consultation, sharing and history use Zone language consistently.
- [ ] Existing names, stars, Orbits, publication and saved layout survive reading and restoring supported files. Retain at least one source Zone and the current route endpoint rules.
- [ ] Use the existing creation, writer and history flows. Treat old persisted terminology as a compatibility concern rather than requiring a sweeping internal-symbol rename.
- [ ] Existing test fixtures that require a star establish it explicitly; do not remove assertions or skip coverage to accommodate the new empty default.

## Verification

Extend the maintained launch/create-and-reopen journey only as needed; cover creation/admission and preserved old data with focused domain/controller checks.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.

### Candidate evidence

The ticket branch incorporated integration revision 1d31002dc15b4313345b55cbb80718c97df4035b to keep current Cluster-wide key and file admission rules. Implementation checks ran against dcb20c3889832a0d9fe0382d12e4d31e690771ff. The final follow-up restores a browser test's missing setup import and uses Zone in the player Hierarchy's accessible name.

- The empty-Zone domain test failed on the former seeded star, and the public JSON admission test failed on the former generic label. The implementation passes both cases.
- `npm run test:pure` passed 713 tests. Evidence: `test-results/ticket01-integrated-pure.log` in the ticket worktree.
- The local Chrome browser suite passed all four scoped cases across `workspace-launch.spec.ts`, `workspace-panels.spec.ts`, and `workspace-zoomed-add.spec.ts`, with a 60-second per-test allowance for local hydration. Launch verifies the Zone has zero Hierarchy records before and after reopening. Evidence: `test-results/local-test-1795686158919-33240-17271198/playwright-run-1` and `test-results/ticket01-integrated-browser.log`. The first browser run retains its launch-timeout trace in `test-results/local-test-1795685516496-26608-4a292302/playwright-run-1`.
- Lint passed on the combined candidate. The final Vue compile and targeted lint outputs are in `test-results/ticket01-final-typecheck.log` and `test-results/ticket01-final-lint.log`.
