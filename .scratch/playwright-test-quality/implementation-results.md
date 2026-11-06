# Tickets 01 and 05 implementation evidence

## Delivery and baseline

Tickets 01 and 05 were authorized in parallel on 2026-10-30. Before implementation, origin was fetched; HEAD and origin/main both resolved to `971e91c0ad2fc78e4f92c1e625091a577960b41b`. The working branch is `codex/playwright-test-quality`. Unrelated local environment configuration was preserved.

The delivery adds shared contributor/agent testing guidance and a complete baseline coverage inventory, stabilizes the identified HTML/identity contracts, and consolidates isolated preparation and owned probes. It does not implement the remaining assertion corrections, runner changes or coverage reductions. The specification and the other ticket definitions remain planning artifacts.

The complete run used staged Git tree `edcb19249e667863b48b441e0420b9562e2da89b`. The final runtime correction and its focused checks used tree `936aa2f6fc84ba853be55c07ce6e4c215a6f4bfa`. Closing changes after those checks are documentation and ticket metadata only.

## Delivered contracts

- The [shared verification guide](../../docs/agents/testing.md) is reachable from contributor documentation and conditional agent instructions. It distinguishes framework recommendations, local policy and runner limitations still assigned to ticket 02.
- The [coverage inventory](coverage-inventory.md) reconciles all 277 baseline browser-backed cases: 276 browser plus one development-storage case. Each parameterized case has a title, source, family, owner and disposition. Proposed reductions identify retained assertion owners.
- Baseline discovery was 450 cases in 79 files: 173 pure, 276 browser, one development-storage. Two meaningful browser regressions were added in existing files; final discovery is 452 cases in 79 files: 173 pure, 278 browser, one development-storage. No case was removed or skipped. Helper extraction is not claimed as reduced browser execution.
- Statistics and map-context targeting use scoped explicit contracts; entity and creation targets use observed domain IDs. Ordinary controls retain role/name and label assertions. USelect customization preserves the framework item-text and selection-indicator wrappers.
- The [helper contracts](helper-contracts.md) describe explicit placement, returned identities, fresh contexts, cloned original snapshots, shared write aborts and export observation, and cleanup on passing and failing paths.
- Restored campaign preparation now waits for observable workspace context readiness before view commands. The dedicated 15-second readiness phase is justified by a trace showing initial Vue bootstrap about 5.1 seconds after page creation; the bootstrap message itself is not readiness. General assertion and test budgets remain unchanged. This does not resolve the separate historical F6 investigation.

## Verification protocol

The coordinator owned server ports, browser runs and generated files. Final runs used frozen runtime source, one worker, zero Playwright retries and fresh test contexts. Browser diagnostics explicitly requested `--trace=retain-on-failure`; default failure tracing remains ticket 02's scope.

One complete integrated suite ran once. After the discovered helper correction, checks were narrowed to the affected case and diagnostic failures. Existing dependency/generated caches were present for candidate runs. No performance improvement or statistical flake-rate guarantee is claimed.

### Static and discovery checks

- Final `npm run typecheck` passed: `test-results/tickets-01-05-typecheck-postfull.log`.
- Final `npm run lint` passed: `test-results/tickets-01-05-lint-postfull.log`.
- Earlier static errors in sentinel-option shapes, a missing helper import and obsolete imports were corrected before final checks.
- Discovery used `node node_modules/@playwright/test/cli.js test --list --reporter=json`; the final report has no discovery errors: `test-results/tickets-01-05-discovery.json`.
- The specialist reconciled every baseline inventory row against discovery and checked all 17 documentation links without broken targets. The raw baseline discovery remains an ignored artifact at `test-results/ticket01-implementation-baseline-discovery.json`.

### Browser execution record

All paths below are local ignored artifacts, not files required in a fresh checkout. The launcher commands selected the named files/cases with `--project=browser`; the full run selected all projects. The coordinator's validation scripts orchestrated the existing local-session API and Playwright CLI, rather than introducing another maintained runner.

| Check | Result | Evidence |
| --- | --- | --- |
| Statistics red before HTML hooks | Two expected failures on absent statistic IDs, rather than preparation timeouts. | `test-results/ticket-05-red-stats.json` |
| First statistics green attempt | One passed; one timed out at the initial Jump Cluster field while concurrent component edits caused HMR. Not clean final evidence. The coordinator stopped overlapping runtime/source edits. | `test-results/ticket-05-green-stats.json` |
| Intermediate focused selections | The first ten-case selection had 7 passes and 3 failures. Subsequent five-case selections had 3/5, 3/5 and 4/5 passes while new test preconditions were corrected. Fixes established Navigate independently, preserved armed Add, avoided unrelated modal-retention assumptions, gated restored-client readiness and scoped the final compact assertion to the active dialog. | `test-results/tickets-01-05-focused.log`, `tickets-01-05-validation.log`, `tickets-01-05-validation-final.log`, `tickets-01-05-validation-release.log` |
| Final identity focus before complete run | Passed in 18.4 seconds after the compact assertion correction. | `test-results/tickets-01-05-1793361086375-focused.json` |
| Complete integrated suite | 447 passed, 5 failed, 0 skipped, 0 flaky/retried; 55.4 minutes. All 173 pure and the one storage case passed. Both added browser regressions passed: identity 16.8 seconds, snapshot isolation 20.2 seconds. | `test-results/tickets-01-05-1793361086375-complete.json`; log `test-results/tickets-01-05-validation-integrated.log` |
| Corrected helper regression | The dirty-chart system-creation case passed 3/3 independent contexts with `--repeat-each=3` and zero retries after the readiness correction. | `test-results/tickets-01-05-1793364728002-postfull-regression.json` |
| Remaining timeout diagnostics on corrected candidate | The four long journeys below still exceeded 30 seconds when selected separately. | `test-results/tickets-01-05-1793364728002-postfull-focused.json`; log `test-results/tickets-01-05-postfull.log` |
| Isolated unchanged-baseline comparison | All four same journeys also exceeded 30 seconds at `971e91c0`. The baseline canonical warm-up itself timed out too. | `test-results/tickets-01-05-1793365149768-baseline-focused.json`, `tickets-01-05-1793365149768-baseline-warmup.json`; log `test-results/tickets-01-05-baseline-check.log` |

### Complete-run defect and correction

The new `addClusterSystem` helper could eagerly capture an empty ID set while the cluster map was not yet accessible after a dialog transition or before its marks were ready. The existing dirty-chart regression then saw two systems while the helper incorrectly expected one. The final helper waits for the visible map and an attached existing mark, requires a nonempty baseline before arming Add, and retains the exact count increase, unique new-ID and opened-map identity assertions. The failing full-run evidence is retained; the three passing checks are subsequent evidence, not a clean first full run.

### Remaining baseline failures

These four unchanged behavioral journeys time out in both candidate and baseline checks:

- Connecting Jump Points across a cluster and recording an unresolved exit.
- Field-definition management and destructive-change previews in a map-bound dialog.
- Editing, saving, exporting and importing an elliptical Orbit around an unoccupied center.
- Dropping an unoccupied Orbit center onto an object and round-tripping the corrected geometry.

Read-only trace analysis of the first two candidate failures found aggregate budget exhaustion, with assertions continuing during teardown rather than a blocking identity/export operation. Added identity observations took approximately 292 ms and 78 ms respectively. Shutdown-related errors after the deadline were distinguished from the triggering timeout. The source baseline reproductions establish that these local traced failures are not unique to this delivery; they do not prove identical performance or general failure rates.

The baseline comparison used a detached isolated checkout, the same installed dependencies, one worker, zero retries, explicit tracing and a canonical create/resume warm-up attempt. Its generated directory was initially absent, unlike the candidate's existing generated cache. This was a failure-class comparison, not a matched performance benchmark. The failed baseline warm-up is retained and not treated as successful readiness evidence.

The global suite is therefore not reported green. These budget/readiness and long-journey issues remain for the agreed coverage/runtime work and final integration ticket; no timeout increase, skip, retry mitigation or weakened geometry assertion was used to hide them.

## Standards

Independent Standards review closed the USelect P2: `#item-label` retains item text registration, keyboard typeahead, accessible label association and the selection indicator. The keyboard regression establishes a different highlighted option before typing and verifies the resulting selection. The final helper-readiness delta was reviewed without remaining code blockers.

The review covered actual staged changes, relevant callers, source/UI/editor conventions and installed Nuxt UI/Reka code. Runtime execution remained coordinator-owned. No standards finding remains open for tickets 01/05.

## Spec

Independent Spec review reconciled the baseline inventory, policy/current-runner distinction, identity and fixture contracts, and correction deltas against tickets 01/05. It closed the compact foreground-scope assertion and final helper-readiness fix without remaining code blockers. The four reproduced baseline timeouts remain explicit validation limitations; this review is not a declaration that the whole specification or suite is complete.

## Artifacts and cleanup

- Complete candidate artifacts: `test-results/local-test-2026-10-30T11-51-26-375Z-14512/playwright-run-3`.
- Corrected-candidate regression/diagnostic artifacts: `test-results/local-test-2026-10-30T12-52-08-005Z-8312`, runs 2 and 3.
- Baseline artifacts were copied before removal of the temporary checkout: `test-results/tickets-01-05-baseline-artifacts/local-test-2026-10-30T12-59-09-772Z-21344`, runs 1 and 2. All five baseline traces were preserved. Raw JSON paths referring to the temporary checkout are historical; use this preserved location for the trace files.
- Each owned session closed its servers and contexts. A final port-availability check confirmed port 3100 was free. The temporary baseline worktree and its dependency junction were removed; original installed dependencies and unrelated local environment configuration remain intact.
- Tickets 01 and 05 are closed within this scoped delivery. The specification and tickets 02-04 and 06-09 remain open. No push, PR, deployment or remote issue change was performed.
