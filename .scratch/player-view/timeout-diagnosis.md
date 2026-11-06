---
title: Diagnosis of the eight intermittent full-suite timeouts
outcome: not-reproduced
parent: spec.md
---

# Eight intermittent browser timeouts

Requested on 2026-11-04 alongside preparation of the [player-view PR proposal](pr.md). This investigation does not replace the original cumulative result with a clean pass or claim the failures are fixed.

## Baseline and ownership

- Runtime candidate: `6cb95fc1f7b554f965c5f4be1f322bf8fc22d9df`, branch `codex/player-view-ticket-01`.
- Refreshed origin/main: `47c0418a835da285e9edb88e8f8dffc19c3a2bba`; candidate 19 ahead, zero behind. The separate main checkout is already at that baseline; no further fast-forward is needed.
- Application code is unchanged from the successful production build on `d107a1e23e50cb3498da73fbd63738af360199d0`. No application, test, dependency or configuration edits were made for this diagnosis.
- Coordinator owns all Git, runtime and browser operations. A read-only architect independently extracted the original evidence and predecessor windows; a separate writer prepared only the PR document. Independent review checks the PR's evidence claims.
- Node 24.18.1 and the installed Chromium 156 browser; local development server on owned port 3167. One Playwright worker, zero retries, original per-test deadlines, no tracing or artificial stress in the baseline repetitions.

## Original evidence

The single cumulative run returned 654 passed / 16 failed. Six failures had confirmed obsolete accessible-role/label assumptions, and two image cases needed ordinary focus scrolling before strict hit testing. Those eight confirmed compatibility failures are separate from the eight investigated here. The initial affected replay passed 14 cases; the remaining two passed within the later 9/9 image/responsive matrix during ticket 06 qualification.

Sources: `test-results/player-view-06-full-report.json`, `player-view-06-full-original-last-run.json`, original `local-test-2026-11-02T15-12-54-966Z-39884/playwright-run-1`, and focused replay `local-test-2026-11-02T16-38-27-709Z-18808/playwright-run-1/results.json`.

| Scenario | Original elapsed / budget | Earlier replay | Observed terminal state |
| --- | --- | --- | --- |
| Nested star-system map, `object-fields.spec.ts:50` | 30.257 / 30 s | 17.499 s | Nix treeitem click resolved and began; Nix is already selected with populated Inspector. |
| Field-definition destructive review, `object-fields.spec.ts:473` | 30.338 / 30 s | 16.326 s | Final reload returned; waiting for Hierarchy while startup screen remains. |
| Unoccupied Orbit center drop, `system-orbits.spec.ts:1189` | 30.136 / 30 s | 15.873 s | Final Back to Jump Cluster click; populated map and restored-Orbit assertions already completed. |
| Scope union on independent system import, `workspace-data.spec.ts:257` | 30.957 / 30 s | 14.664 s | Late Fit map click after exported-data assertions; populated cluster with both systems. |
| Dependent deletion review, `workspace-data.spec.ts:375` | 60.083 / 60 s | 27.130 s | Initial navigation returned; startup screen before entering the cluster name. Deletion body not reached. |
| Versioned campaign interchange, `workspace-data.spec.ts:1182` | 30.087 / 30 s | 14.913 s | Final reload returned; startup screen while waiting for map navigation. |
| Narrow-screen catalogue, `workspace-ui.spec.ts:178` | 30.065 / 30 s | 3.201 s | Initial startup screen at helper's 1440x960 viewport, before narrow-screen/category interactions. |
| Failed route save and Retry, `workspace-cluster-routes.spec.ts:285` | 30.057 / 30 s | 9.908 s | `campaignWorkspacePage` fixture waits for startup to finish; route-test body not reached. |

Five terminal snapshots show startup; three show populated maps and a late action. **A terminal action is not evidence that this action consumed the whole deadline.** The original JSON has no step timings. Each original failing directory contains only `error-context.md`; no trace ZIP exists in that run. Individual navigation, hydration, IndexedDB and action durations, and the remaining budget when the final action began, cannot be reconstructed.

Original server startup took 62 seconds, versus 11.4 seconds for the earlier focused replay. Original Nitro builds took 31.481 and 34.308 seconds, versus 2.929 and 6.122 seconds. The original log contains four missing prototype-route warnings and six icon-load warnings, but no logged crash, restart or test-time timeout. Its lines lack wall timestamps, so those warnings cannot be assigned to the failing moments. No contemporaneous CPU, memory or event-loop timeline is retained. These observations do not establish an infrastructure cause.

The original scope-import failure was followed by a worker change 6 to 7 and a 37.260-second inter-test gap before dependent deletion. Other neighboring durations vary; there is no established monotonic slowdown or demonstrated orphan-browser leak.

## Unchanged repetition loop

Command: `node test-results/player-timeouts-repeat.mjs`, with `LOCAL_TEST_PORT=3167` and the installed `PLAYWRIGHT_BROWSERS_PATH`. The ignored diagnostic driver selects the exact eight unexplained timeout titles from the original report and invokes the maintained owned launcher with `--project=browser --repeat-each=3`. The first driver admission check rejected a broader 13-timeout selection before launching any test: five obsolete-locator failures were also reported as timedOut. Restricting to the five known scenario files admitted the intended eight. No feature assertion failed during that admission check.

**24 passed / zero failed, skipped, retried or flaky; 617.560 seconds (10.3 minutes).** Source remained frozen and the owned launcher exited successfully. Each case had three executions, each in a fresh browser context, sharing the development server. Campaign fixture repetitions receive fresh contexts and cloned storage, not shared live state.

| Scenario | Three new elapsed times | Budget |
| --- | --- | --- |
| Nested map | 25.912 / 26.320 / 25.316 s | 30 s |
| Field-definition review | 24.179 / 26.066 / 25.149 s | 30 s |
| Orbit-center drop | 23.050 / 21.123 / 28.487 s | 30 s |
| Scope union import | 19.401 / 18.390 / 23.247 s | 30 s |
| Dependent deletion | 37.613 / 36.946 / 41.301 s | 60 s |
| Campaign interchange | 21.274 / 19.725 / 23.483 s | 30 s |
| Narrow catalogue | 4.856 / 5.758 / 4.591 s | 30 s |
| Route Retry | 19.735 / 22.132 / 18.795 s | 30 s |

Evidence: `test-results/player-timeouts-repeat.log`, `player-timeouts-selection.json`, and `local-test-2026-11-04T09-26-27-501Z-35340/playwright-run-1/results.json`. The 28.487-second Orbit pass leaves about 1.5 seconds nominal margin; that shows observed proximity to the configured budget, not the original cause.

## Bounded predecessor replay

The next loop selects each of the five startup failures plus its two immediately preceding browser journeys from the original report. Deduplication gives 15 cases, including scope import as a predecessor of dependent deletion. The original selected durations total 346.975 seconds, excluding gaps.

Command: `node test-results/player-timeouts-predecessors.mjs`, same local environment and unchanged test settings. The driver preserves recorded windows in a JSON selection and the maintained launcher runs them with ordinary fixture ordering. There is no second complete suite. This tests preceding activity; it does not reconstruct omitted long-running activity, original host conditions, or the timeout-triggered worker restart and gap if scope import passes.

**15 passed / zero failed, skipped, retried or flaky; 209.097 seconds (3.5 minutes).** Actual execution order exactly matches the 15-case selection. The first 12 cases use worker 0 and the final campaign pool uses worker 1; there is one concurrent worker. Investigated cases took: Field review 23.524 s; scope import 18.632 s; dependent deletion 35.990 s; campaign interchange 18.953 s; narrow catalogue 4.453 s; route Retry 9.127 s.

Evidence: `test-results/player-timeouts-predecessors.log`, `player-timeouts-predecessors-selection.json`, and `local-test-2026-11-04T09-38-20-490Z-15840/playwright-run-1/results.json`. The owned launcher exited successfully.

Both diagnostic server logs contain generated server-side HMR activity: one line between scope import and dependent deletion in the repetition run, and plugin regeneration/HMR between cases 2 and 3 in the predecessor run. Documentation-only draft/report edits occurred during this investigation; checked application/test inputs remained unchanged and no qualification invalidation was reported. Do not infer that the server was entirely undisturbed. A server-side HMR line alone does not prove a test page received browser HMR. Neither run reconstructs the exact original runtime history.

## Assessment

**Outcome: not reproduced; original root cause remains undetermined.** The bounded investigation collected 39 successful executions, without changing the original test deadlines, enabling retries, adding stress, or modifying application/test logic. This rules out a consistently failing journey in these executions; it does not establish overall reliability or disprove an intermittent application or infrastructure problem.

Established observations are five startup-screen failures, three late-action failures, and some successful journeys close to their deadline. The artifacts do not establish whether the original failures were caused by browser scheduling, server/module work, storage, a lifecycle problem, or cumulative per-test time consumption. None is presented as a confirmed hypothesis. No speculative fix, deadline increase, or test weakening was applied.

The diagnosis remains at the reproduction phase of `diagnosing-bugs`. A newly reproduced failure with step/network timings is needed before minimization and causal experiments. A further broad uninstrumented green run would not fill that evidence gap; the original 670-case suite was not repeated.

## Capture the next occurrence

For a bounded timing capture of the route setup symptom, use the existing launcher with retained failure tracing. This is a **different measurement condition**, so any failure must be compared with an untraced run before attributing a cause:

```powershell
$env:LOCAL_TEST_PORT = '3167'
npm run test:local -- tests/workspace-cluster-routes.spec.ts --project=browser --grep 'a failed route save keeps the applied route and Retry persists it once' --repeat-each=3 --trace=retain-on-failure
```

Use the original failure's scenario/preceding window when it next appears. Keep the original report, error context and trace together. Check the terminal action's remaining test budget, main-document/module responses, startup/hydration completion and storage operations at the failure timestamp. Redact authentication headers/cookies before sharing captured traces. This capture command is supplied for future reproduction; it was not run or claimed as passing in this investigation.

## Review and handoff

The read-only architect verified all 24 repetition results, budgets, context ownership, predecessor order and the completed 15-case report. Its wording corrections distinguish fresh contexts from independent server conditions and deadline proximity from measured sensitivity. A separate independent reviewer found no accuracy findings in the PR draft; the coordinator reconciles its final diagnostic paragraph with these reports.

Final independent review found no accuracy findings in either updated document. Only the two English planning documents changed. No source, tests, dependencies or configuration changed; existing feature lint/types/build evidence remains applicable. Markdown local links and heading references passed, and Git whitespace checks passed. Both owned launchers exited and ports 3167/3168 have no listeners. The pre-existing untracked `.codex/environments/` is preserved. No push, remote PR creation, merge, deployment or issue mutation occurred.
