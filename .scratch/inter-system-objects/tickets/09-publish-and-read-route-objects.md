---
title: Publish and read route objects without private-route leaks
status: in-progress
assignee: codex/issue-60-ticket-09
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

Claimed on 2026-11-26 from integrated prerequisite revision `199145211568c9d9ff9236ee57efd5c8fe82ef92`, with the comparison baseline above. Intermediate consumers must preserve admitted data or explicitly reject an unsupported operation, never silently drop records.

## Acceptance criteria

- [x] Apply the four publication modes, required-host minimum disclosure, player text and Field masks to route contexts. Sharing a route does not promote a Hidden route object.
- [x] A published route object on a private or omitted route carries only allowed detached geometry/content, with no private association, percentage, path, name, destination or source identifier.
- [x] An allowed shared-route association uses only public identities/progression and authorized endpoints. Public geometry, hierarchy, bounds and counts do not depend on hidden inventory.
- [x] Consult a route object even when no Zone marker or route is published; reject a completely empty public document. Do not add a synthetic Zone or private parent placeholder.
- [x] Resolve effective branch geometry before filtering and preserve semantic selection. Preview and detached reader consume the same allowlisted document.
- [x] Version/admit public files and immutable links explicitly, preserve older supported documents and reject malformed current ones. New public content must not be silently dropped by an unfinished consumer.

## Candidate verification

The checked candidate `94b0fef69f4335bb0a347b6c88ca04c75c0906f7` includes the integration tip `3470aa42c496c67d1f2d988e7a16f5109b110b25`. Player documents now use version 3. Versions 1 and 2 remain readable. An attached branch follows the public route curve and a detached branch carries only its allowed geometry and content. Cluster and viewport images with route branches report that they are unavailable until ticket 11. Zone images retain their local scope.

- `PLAYWRIGHT_SUITE=pure` with `node ../../../node_modules/@playwright/test/cli.js test --grep 'player|route object' --reporter=list,json` passed 124 tests. The report is in `test-results/playwright-1795690924457-26172-4d4dd863/results.json` in the ticket worktree.
- Vue typechecking passed with `node ../../../node_modules/vue-tsc/bin/vue-tsc.js --build --pretty false`. ESLint passed with `--max-warnings 0` over the changed Vue and TypeScript files compared with the integration tip.
- The maintained publication journey passed at `94b0fef6` using `LOCAL_TEST_PORT=3199` and `node scripts/local-test.mjs --project=browser --workers=1 --max-failures=1 --trace on tests/workspace-player-content.spec.ts`. It verified the branch in preview and JSON and reopened the link in an isolated reader. The trace and visual proof are in `test-results/local-test-1795690549742-25484-d91720b7/`.
- The maintained detached reader journey passed at `fee7f59e12ff4de3a2eaca87cf3d22a0e88cb715`, which has the same runtime files as `94b0fef6`. The local launcher ran both maintained journeys with `--project=browser --workers=1 --trace on` and the files `tests/workspace-player-content.spec.ts` and `tests/player-reader.spec.ts`. The reader verified an object-only JSON file, the permitted player text, and absence of a route and route association. The trace and visual proof are in `test-results/local-test-1795690274937-13288-ce5006e3/`.
- The first reader trace reached the existing Center route assertion as its 60-second journey budget expired. The first publication attempt reached isolated link hydration as its 30-second journey budget expired, and its teardown screenshot shows the hydrated document. Only the two expanded test cases received longer budgets. Their first failure traces remain in `test-results/local-test-1795689970316-14724-f0d935f9/playwright-run-1/` and `test-results/local-test-1795690274937-13288-ce5006e3/playwright-run-1/`, respectively.

## Verification

Use paired private-variance projection/codec tests and real reader/export-operation controllers for the main privacy matrix. Extend the maintained publication and reader journeys with one representative route object case.

Prefer existing domain, geometry, codec/projection and real controller seams. A ticket does not imply a new browser journey. Extend the maintained owning journey with the smallest useful assertion; a new browser scenario requires a distinct important native-input, data-loss or disclosure failure that cheaper checks cannot observe. Follow repository artifact ownership, source-freeze and first-failure evidence rules.

Record the checked candidate, command/scope, result and evidence location. This brief does not authorize merge, release or modification/closure of the GitHub source.
