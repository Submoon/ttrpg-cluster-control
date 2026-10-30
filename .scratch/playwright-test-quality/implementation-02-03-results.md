# Tickets 02 and 03 implementation evidence

## Baseline and scope

The user authorized parallel implementation of tickets 02 and 03 with the implement workflow and subagents on 2026-10-30. Origin was fetched before this batch. Its main branch remained at `971e91c0ad2fc78e4f92c1e625091a577960b41b`. Implementation intentionally started from `956ead47f931bb9f77b0949746757fcafe491822` on `codex/playwright-test-quality`, preserving the previously delivered tickets 01 and 05. Unrelated local environment configuration was preserved.

The coordinator owns Git operations, dependency installation, generated files, servers, browsers and integration. Two implementation agents own disjoint runner/diagnostic and assertion scopes. The diagnostic artifact work follows an architect review because native Playwright traces and nested HTML report steps can retain Preview credentials. Source is frozen for integrated browser checks; even documentation or script edits can trigger CSS HMR through repository scanning.

This batch does not implement the later browser consolidation, controller-lifecycle migration or measured startup-reliability tickets. The earlier [01/05 report](implementation-results.md) remains a historical record, including its four reproduced baseline timeout failures.

## Assertion contracts

- F1 starts a native held entity press in Navigate, changes to Select while the press remains held, and verifies inspection cancellation before and after release. The native button activation exception is documented in the test. The existing positive held-press inspection companion remains.
- F2 establishes and asserts the requested mode separately before Object and Orbit creation. The original three rows are now independent fresh-workspace cases. The first aggregate run completed Navigate and Select before exceeding 30 seconds during Move; splitting retains the same three obligations without raising a timeout.
- F3 seeds distinguishable damaged current and backup records and checks exact preservation of both after restoration is rejected.
- F4 captures the observer's published name and asserts it outside the deliberately throwing best-effort callback. Applied verdict, original durability acknowledgement and observer-error behavior remain covered.
- F5 checks an exact 80-unit camera displacement from the immediate pre-action transform. The related system-camera journey uses the same baseline rule. A shared parser avoids duplicating transform parsing in the two spec files.

## Development evidence

The new pure-selection regression was authored before implementation, but its first executed negative control temporarily used the committed baseline configuration after green code existed. That control rejected `PLAYWRIGHT_SUITE=pure`, as expected. This is a baseline negative control, not a claim that an original red test was executed before implementation. The candidate configuration was restored exactly. An initial version of the permanent selection test performed five complete repository discovery scans and exceeded its harness budget. Narrowing discovery to three tiny generated fixtures still left subprocess-startup timing in every pure run. The first public pure-only run had 176 passes and one new harness failure (`spawnSync ETIMEDOUT` at 10 seconds), with zero connections to the deliberately occupied application port and an empty browser installation directory. The final design tests the actual runner-selection function deterministically; the configuration imports that same function. Complete CLI discovery and the public launcher remain separate integration checks rather than nested subprocess obligations in each pure run.

The F4 ordinary mutation negative probe moved the observer before `pipeline.publish`. The external observation assertion failed with the old cluster name while the verdict and hook-count checks passed. The ordinary source was restored byte-for-byte and its whole verdict spec passed. An earlier history-coordinator mutation exercised a different path and passed; it is not counted as sensitivity evidence for the ordinary-command test.

Runtime reports and traces are ignored local artifacts under `test-results`; they are evidence for this checkout rather than requirements for a fresh clone. Final integrated results and review closure are recorded below before delivery.

## Integrated verification

The frozen runtime source tree was `5bfb2cc0010d257e4adefa4c645b7921aed6fd97`. The complete staged tree, including the requested retrospective ticket, was `fd1928a71e0a39ab31521f5c5fb00ec9669db295`; its runtime source was identical. These are Git tree identities, not commits. Subsequent sanitizer corrections require their own focused evidence and do not retroactively change the full-run candidate.

Commands executed for this evidence:

- `npm run lint`, `npm run typecheck`, and `npm run build` on the final application candidate.
- `node test-results/tickets-02-discovery.mjs` for the selection/disjointness matrix.
- `node test-results/tickets-02-pure-proof.mjs`, whose public child command was `npm run test:pure -- tests/playwright-runner.spec.ts tests/playwright-artifacts.spec.ts tests/workspace-mutation-command-verdicts.spec.ts`.
- `node test-results/tickets-02-privacy-proof.mjs` for the deliberate authenticated diagnostic failures.
- `node test-results/tickets-03-probes.mjs` for the targeted/adjacent passes and temporary-fault checks; final run ID `1793376354283`.
- `node test-results/tickets-03-final-pan-and-full.mjs` for the warmed Pan negative and complete run; run ID `1793377264050`. Its complete invocation used `createLocalTestSession().runTest([])` with `PLAYWRIGHT_SUITE=all`, no project filter, no Preview URL and no bypass secret. The launcher supplied its owned local base URL and separate per-run output directory.

The ignored harnesses and native logs remain local execution aids; their absence in another clone must be recorded as an evidence gap. For ordinary reproduction, use the supported commands in [testing guidance](../../docs/agents/testing.md), including `npm run test:local --` for a complete owned-server run.

The complete selection discovers 460 cases in 81 files: 179 pure, 280 browser and one development-storage case. The `checks` selection contains the 179 pure cases and the storage case. Discovery verified disjoint membership and an exact complete union. The two additional browser cases come from making the original F2 mode variants independent; six new pure cases cover runner selection and artifact handling.

The public pure launcher passed its focused ten-case integration check with the application port deliberately occupied and a browser installation directory containing no browsers. The occupied listener received no connections; inherited Preview/base-URL variables were removed by the launcher. Its final deterministic selection/artifact specifications passed six cases in 3.3 seconds. All 179 pure cases also passed in the complete run. Missing generated Nuxt configuration was assessed from the installed runner's resolution behavior and imports; an actual fresh-checkout run was not performed.

The final application candidate passed lint, typechecking and a production build. Logs are `test-results/tickets-02-03-lint-product.log`, `tickets-02-03-typecheck-product.log` and `tickets-02-03-build-product.log`. Nuxt excludes generated diagnostic/report bundles from project typechecking while retaining the maintained specifications and framework exclusions. The exclusion membership was checked explicitly.

The targeted F1–F5 browser selection passed all eight cases, and ten adjacent gesture cases passed without retries. Separate negative controls detected cancellation before release, activation after a cancelled release, omission of the second mode reset, replacement of current data with the damaged backup, observer execution before publication, and a Pan command that did not move the camera. Every temporary fault was restored byte-for-byte. The final Pan negative control was warmed before execution and failed on the exact missing 80-unit displacement without also exhausting the global budget. The F1 cancellation fix preserves activation by a fresh press, including after a cancelled long-held gesture.

The full frozen candidate then completed **435 passes and 25 failures in 1.4 hours**, with zero retries. All directly changed assertions and their adjacent gesture checks passed. This is a failed integration gate, not an all-green suite. Four failures reproduce the earlier baseline-proven timeout debt; the other 21 are not established as baseline failures. No unsupported claim about statistical flakiness or performance improvement follows from this run.

The retained stdout is `test-results/tickets-02-03-final-integration.log`. Global artifact teardown subsequently failed and the fail-closed sanitizer deleted the full run's native artifacts and JSON report. Its completion marker remained absent, preventing publication. The parent harness then encountered a secondary missing-JSON error. The totals and failure list below come from stdout; selected first-error diagnoses were obtained before teardown. They are not a substitute for the deleted traces.

| File | Failed cases (source lines at this candidate) |
| --- | --- |
| `cluster-map.spec.ts` | 36, 331 |
| `object-fields.spec.ts` | 49, 151, 464 |
| `system-orbits.spec.ts` | 246, 861, 968, 1163, 1319 |
| `workspace-add-route-targeting.spec.ts` | 88 |
| `workspace-chart-drafts.spec.ts` | 1063 |
| `workspace-cluster-construction.spec.ts` | 217 |
| `workspace-cluster-gesture-takeover.spec.ts` | 163 |
| `workspace-cluster-move-precision.spec.ts` | 29 |
| `workspace-data.spec.ts` | 253, 362 |
| `workspace-fields-lifecycle.spec.ts` | 339 |
| `workspace-history-consultation.spec.ts` | 202 |
| `workspace-history-keyboard.spec.ts` | 30, 77, 220 |
| `workspace-system-manipulation.spec.ts` | 370, 675 |
| `workspace-theme.spec.ts` | 291 |

Several inspected journeys first exhausted the 30-second test budget late in their scenario. Further export/download errors appeared after timeout cleanup had begun; those secondary errors must not be treated as the initial cause. The held-shortcut case instead failed waiting for the initial workspace heading. Post-deadline assertions do not make a timed-out case pass. Startup, hydration and cache causes remain unproven. Later consolidation/startup tickets and the requested [session retrospective](tickets/10-retrospective-test-session-problems.md) retain this debt rather than masking it with retries or larger timeouts.

## Diagnostic verification

A controlled local exact-host authentication exchange exercised native list/HTML/JSON and CI GitHub/HTML reporter combinations with generated long bypass and short cookie sentinels. Both deliberate failures retained traces and live-page screenshots. Inspection found zero credential leaks, parseable trace events, unchanged screenshot hashes and unchanged viewer assets. The native HTML container and embedded report archive remained inspectable. Pure cases cover reporter paths, credential lengths, relative request headers, source/static labels and fail-closed marker behavior. The stand-in validates the artifact path; immutable Preview URL selection is covered separately and no deployed protected Preview was contacted.

The deleted full-run artifact cannot be reconstructed. Sanitizing isolated copies of the retained rich trace and five earlier full-run traces (98,563,423 bytes in that group) succeeded. The exact original failure remains unknown; this is not evidence that every supported authenticated artifact can be sanitized.

Architect review approved a narrower global-run boundary: only a configured Preview URL or nonempty bypass secret requires credential sanitation. Existing fixtures obtain Preview credentials only on the configured Preview path. Local/checks diagnostics without either input should retain native bytes rather than fail because an arbitrary attachment cannot be interpreted as a diagnostic archive. The explicit sanitation helper remains unconditional. A paired global-setup regression reproduced the local false rejection before the correction: the child exited 1 with `collect-credentials/invalid-report-archive` and deleted its no-auth output. Authenticated malformed archives must continue to fail closed. This correction addresses the independently reproduced local boundary; it does not identify the missing full-run artifact's cause.

Final focused post-correction evidence and review closure follow.

## Post-full-run correction evidence

Tree `340759ef193d7af65e5eb72f84700d524c70540f` adds the bounded sanitation error fields and the no-auth activation boundary. `npm run test:pure -- --reporter=list --output=test-results/tickets-02-final-pure` passed **180/180** in 2.5 minutes; the log is `test-results/tickets-02-final-pure.log`. Full lint passed (`tickets-02-03-lint-final.log`). Typecheck found an environment-object inference error in the new test at line 349; explicit `NodeJS.ProcessEnv` annotations correct it in the final candidate below.

The standards review of that delta had no blockers. The complementary privacy review found one additional data-loss path: no-auth marker-write failure or missing teardown still removed native outputs in the exit catch. The final correction retains no-auth artifacts while leaving the marker invalid and reporting failure. Authenticated failures retain destructive fail-closed cleanup. This is a separate observed control-flow defect, not an explanation of the deleted full-run artifact.

The corrected frozen tree is `e837fce2318e2ffe331f21f4ad43af14f19d11b7`. Its application/runtime changes after the complete run are confined to artifact handling and its tests. Both independent standards and specification/privacy reviews closed with no remaining confirmed blockers. The no-auth marker-rename regression first failed on the previous code because output was deleted; the corrected six-case artifact file passed in 3.8 seconds. Targeted ESLint passed. `npm run typecheck` passed on the corrected tree (`test-results/tickets-02-03-typecheck-corrected.log`). The successful production build of the unchanged application candidate is reused; no second production build or complete browser suite was run for this artifact-only correction.

Final discovery, using `node test-results/tickets-02-discovery.mjs`, verified **462 cases in 81 files**: **181 pure, 280 browser, one storage**; `checks` has 182. The selections form an exact disjoint union (`test-results/discovery-02-03-1793384800292/proof.json`). The two post-full-run additions are pure regressions for no-auth opaque attachments and marker-write failure. The whole pure suite passed at 180 cases before the final marker-path correction, followed by all six affected artifact cases on the final tree; this is not a claim that a new 462-case complete run passed.

Final native proofs on the corrected tree:

- `node test-results/tickets-02-noauth-native-proof.mjs`: one deliberate browser assertion failure, zero global errors, one retained trace with 61 parseable trace records, one screenshot, and byte-identical original/copied opaque ZIP attachments. The marker records `not-required-no-preview-auth`. Evidence: `test-results/noauth-native-proof-1793384996423/proof.json` and `tickets-02-noauth-native-final.log`.
- `node test-results/tickets-02-privacy-proof.mjs --short-cookie`: two deliberate failures, zero retries, zero sentinel leaks, two traces, four screenshot copies, two embedded HTML archives, 140 action records and 12 network records. Screenshot hashes, 34 static viewer assets and two manifest structures were preserved. The authenticated marker records `completed`. Evidence: `test-results/privacy-proof-1793385007600/proof.json` and `tickets-02-privacy-final.log`.

The initial no-auth proof harness used an unsupported module URL for Playwright's `globalSetup` option; it was corrected to a filesystem path. A sandbox-profile browser attempt had no installed browser and is not counted as browser evidence. The successful proofs used the installed user-profile Chromium. Both controlled scenarios remain ignored local harnesses, not committed failing tests. Owned stand-in servers and browser children exited. Final diff whitespace checks passed.

Tickets 02 and 03 are closed for their bounded criteria. Tickets 04 and 06–09 remain pending; the requested retrospective ticket 10 remains open and was not executed. Complete-suite stability, the 21 failures not baseline-proven, and the unrecoverable original full-run diagnostic cause remain explicit limitations.
