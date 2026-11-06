# Tickets 04 and 06 implementation evidence

## Authorization and baseline

On 2026-11-02, the user authorized parallel implementation of ticket 04 (real controller lifecycle owners and Redo preconditions) and ticket 06 (focused UI/map browser coverage), using the implement workflow and subagents. The approved test boundaries remain domain functions, real controllers and browser integration. This batch does not implement tickets 07, 08, 09 or the session retrospective in ticket 10.

The starting branch is `codex/playwright-test-quality` at `8a8360805483426786c9245c8d72d0360192a14a`, retaining tickets 01/02/03/05. Origin was fetched. Its main is now `d40e5f515baf1afeb0e2135461287b243b2a1f6c`; the starting branch has two unique commits and main has four. Incoming changes include Nuxt UI keyboard hints, quiet routine save feedback and awaited workspace startup. These changes overlap the test helpers and browser families being consolidated, so main is integrated before ticket implementation rather than using the older application behavior. Local main is checked out in a separate worktree at `d4b97331b9821b7a4ad9022c50391ba14fc847c9` and is not changed from this worktree. Unrelated `.codex/environments/` configuration is preserved.

The merge had nine conflicting test/fixture files. Resolution preserves stable identities, scoped locators, shared failure/export probes and strengthened assertions together with incoming startup/durability waits and quiet routine-save feedback. Actionable pending/failure feedback remains covered.

The implementation and final-review baseline is merge commit **`a00451ee5d25ede93e214a1270e6bfee65fcfd91`**, with source tree `ea941633a1806cd1baa51a9aa91dd99ee8aab62b`. Independent review compared the nine conflicts and shared helper with both parents and closed with no blocker. Full lint passed. Initial typecheck caught missing `selectInspectorOption` and `readInspectorSelection` imports in the resolved data spec; restoring those existing imports was the only correction, followed by a successful typecheck.

Before ticket source edits, `npm run test:pure -- tests/workspace-history-coordinator.spec.ts tests/workspace-history-main-integration.spec.ts tests/workspace-editor-apply-preflight.spec.ts tests/workspace-mutation-transitions.spec.ts --reporter=list --output=test-results/tickets-04-06-baseline-pure` passed **46/46 in 1.3 minutes**, with the lifecycle warnings ticket 04 addresses. Complete discovery found **464 cases in 81 files: 181 pure, 282 browser and one storage**, with no duplicate selection. The two additions since the prior batch are upstream startup cases. Browser execution is grouped with the integrated ticket changes; no preliminary browser baseline execution is claimed.

### Baseline artifact loss

After the baseline checks completed, a ticket 04 RED invocation used Playwright's default `test-results` output directory. Playwright cleared that root before running, deleting prior local artifacts, including this batch's raw baseline logs/discovery and earlier batches' ignored evidence. The coordinator had not assigned isolated output directories in the original brief. Command outcomes, counts and selected outputs were already captured in this chat, but the deleted files are unavailable; do not describe their old paths as retained evidence or reconstruct synthetic logs as originals. Repository source, commits and planning documents were unaffected. Subsequent checks must use unique owned output directories and separate logs/harnesses from any directory that a run will clear. The session retrospective must record this evidence gap.

## Ownership and verification plan

The coordinator owns Git, planning artifacts, shared helper interfaces, generated files, servers, browser sessions and final integration. A bounded merge worker resolves only the conflicted test files. Ticket 04 receives a read-only lifecycle design assessment before its developer edits pure/controller specifications and a minimal mounted-owner helper. Ticket 06 plans and then edits browser specifications. At most two implementation writers are active; ownership of any additional shared file must be agreed first. Specialists do not restart the coordinator workflow or create more agents.

Before integrated browser checks, all maintained source and documentation are frozen and Nuxt generation, typecheck and build are idle. Focused checks exercise each changed owner and native browser obligation with zero retries. Negative controls are temporary and restored exactly. One complete integrated selection is planned after focused correction and review; results and remaining limitations will be reported without hiding first-run failures or treating fewer files as reduced execution. Application build evidence is selected according to actual source/configuration changes. Independent standards and specification reviews compare the integrated candidate with the completed merge baseline.

The prior 435/460 complete result and lost original full-run diagnostics belong to the earlier batch. They are historical evidence, not current validation or proof that any new failure is pre-existing. Incoming startup changes and newly retained artifact handling require current-candidate observations.

## Agreed implementation boundaries

Ticket 04 owns four pure/controller specs (`workspace-history-main-integration`, `workspace-editor-apply-preflight`, `workspace-mutation-transitions`, and `workspace-history-coordinator`) plus mounted-owner support. [Lifecycle dispositions](controller-lifecycle-inventory.md) distinguish component-owned teardown from valid reactive scopes and provide ticket 07's handoff. Cleanup observations must precede manual history disposal.

Ticket 06 owns `production-entry`, `workspace-panels`, `workspace-data`, `workspace-ui-smoke`, and `cluster-map`. Four legacy URLs start from prepared IndexedDB state and navigate directly to their exact query; the canonical create/resume path remains in `workspace-launch`. Desktop panel duplication gives way to its existing canonical owner while preserving the portaled menu/download check. Simple deletion assertions move into the compact smoke case. The broad two-map journey becomes two focused native-gesture owners. One removed case and one split balance in count; the reduction concerns repeated workflows/actions, not an arbitrary number of browser tests. Final mapping and validation follow after implementation.

## Development evidence

Ticket 04 first added the Orbit teardown observation against its old unmounted scope. It failed with the Vue missing-component warning and a remaining nonnull renderer preview; switching to the real mounted owner made that check pass. The developer then passed all 48 cases in the four affected pure specs with an isolated output directory (`test-results/ticket04-final-04pure`). An additional chronological-entry equality assertion in the Redo case passed in its targeted rerun (`test-results/ticket04-redo-check`). These are developer-reported runs; final integrated checks provide a separate retained record. No product change or blanket warning suppression was introduced.

Ticket 06's scoped ESLint passed. Coordinator inspection caught an invalid raw source-fixture host ID in the new Orbit case: real import remaps all entity IDs. The case now obtains the actual rendered Primary Star identity. Its known 112-unit starting radius is explicit before the 153-unit target; native delivered-input geometry is retained. The incremental wheel assertion now captures its baseline immediately before that wheel input, so the prior zoom-button action cannot satisfy it. The cluster case's title describes node-layout persistence rather than claiming camera persistence.

The final source allocation is mapped in the [coverage inventory](coverage-inventory.md); runtimes, counts, reviews and complete-run results remain to be recorded below before ticket closure.

## Initial integrated candidate

Frozen staged tree `7ab08e2f0e3a280d85f8b8bfc2a59f4d93140acc` passed full lint and typecheck. Complete discovery reports **466 cases in 81 files: 183 pure, 282 browser and one storage**, with no duplicate selection. The two additional pure cases protect actual owner teardown; browser count is unchanged. Retained logs are now under the coordinator-owned `test-results/tickets-04-06-control` directory, separate from all runner output directories.

The Standards review found no blocker. The Spec review identified one coverage regression in the initial reduction: C021/C022 used zoom buttons, so they did not own the plain SystemMap wheel input and 25%/1600% clamps removed from C001. Ticket 06 now extends the focused C021 case with those native inputs, including an immediate pre-wheel baseline. The menu smoke case also restores one Hierarchy-open precondition with Inspector visible, without bringing back the repeated independence matrix; coexistence was separately retained by image-export coverage, so this was a nonblocking clarification. No new browser case is added. The correction's validation and review closure follow below.

## Corrected candidate and sensitivity

Both review axes closed on the wheel correction. The final one-line Move precondition suggested by Spec preserves the original wheel context; Spec confirmed tree `6ee3251cd274beeffa0131ea2e84b9662693b80b` with no blocking finding. Final global typecheck and production build passed on that tree; the build completed in 3 minutes 21 seconds. Logs: `test-results/tickets-04-06-control/typecheck-final.log` and `build.log`. Scoped lint passed on the corrections.

`node test-results/tickets-04-06-control/probe-pure.mjs 6ee3251cd274beeffa0131ea2e84b9662693b80b` passed its normal three-case control, detected three separate temporary faults, and passed the restored three-case control. Omitting Orbit-owner overlay clearing failed its `scenePoint: null` observation; omitting the editor unmount store reset failed the workspace-identity null assertion; discarding the future branch on an unchanged command failed the existing-Redo assertion. Every production file was restored byte-for-byte and its hash recorded. No lifecycle warning appeared in these controls. Evidence prefix: `test-results/tickets-04-06-control/pure-probes-1793612055339`.

## First native integration attempt

The owned-server run `1793612516152` used the frozen `6ee3251` tree. The public root create/resume case passed in 9.4 seconds. Both new map cases passed; the four legacy URL cases failed on an incorrect fixture expectation. Their native error context shows the persisted `Kestrel Reach Prime` workspace open on `Campaign staging`, while the test expected `Vesper Prime`. The real public campaign import retains its staging system; initial active-system choice is not the compatibility contract. The correction verifies the expected Current Jump Cluster region, visible map-context navigation and absence of prototype controls, retaining direct first navigation to every exact query URL.

The failed cases have screenshots and traces under `test-results/local-test-2026-11-02T09-41-56-153Z-69808/playwright-run-2`; JSON and the manifest are under the control prefix `browser-1793612516152`. There were no global runner errors. The harness stopped and closed its server before UI/retained/full phases; the complete suite has not yet run. Later results must keep these first-attempt failures separate from corrected passes. Only variant assertions changed, so prior map positives, pure sensitivity, typecheck and application build remain applicable; no product/fixture/configuration change was made.

## Complete integrated execution

The corrected frozen tree `16075ddeaaec1fdc7fc4a8d5dc03054cffac8b7f` passed its launch case (1), corrected variants (4), UI families (13) and retained canonical owners (3), all without retries. Both map replacements also passed in the earlier focused run and again in the complete run. The same owned server then executed all **466 cases** once: **461 passed, five failed, zero skipped, zero flaky and zero retries**, in **59.8 minutes**. All 183 pure cases and the storage case passed; browser results were 277/282. There were no global runner errors. These are observations on a development server with a warmed module graph, not a cold-start protocol or a statistical stability claim.

The complete report is `test-results/tickets-04-06-control/browser-1793613084917-complete.json`, with its `.summary.json`, phase manifest and `browser-corrected.log`. Failure traces/screenshots remain in `test-results/local-test-2026-11-02T09-51-24-918Z-35240/playwright-run-5`. The diagnostic completion gate passed; unlike the earlier batch, full-run artifacts and JSON were retained. The owned server closed and the coordinator stopped its separate log reader before further source edits.

| Failed case | First reported error | Disposition |
| --- | --- | --- |
| `workspace-add-route-targeting`: prepared campaign snapshots stay isolated between contexts | Missing visible `Saved on this device` after 5 seconds | Baseline integration drift: this ticket-05 assertion was not present on main when its quiet-save change was authored. Replace it with the existing durable writer-state wait; retain both-context exact export equality and cleanup. |
| `system-orbits`: unoccupied-center host attachment and round trip | Test timeout at 30 seconds | Retain failure for data/workflow allocation and integrated follow-up. Its body is unchanged by 04/06. |
| `workspace-chart-drafts`: delayed import acknowledgement with pending Orbit guard | Test timeout at 30 seconds | Retain failure and native evidence; no cause beyond the budget expiration is established. |
| `workspace-data`: category/subtype scope union on independent import | Test timeout at 30 seconds while opening the final Hierarchy | The file loses only the separate duplicate deletion case in 06; this workflow body is unchanged. Retain for 07/09. |
| `workspace-system-creation`: Orbit Add host, axis correction and one-write retry | Test timeout at 30 seconds | Retain failure and native evidence; the workflow body is unchanged by 04/06. |

Three timeout cases also report a JSON-download read error. Their first reported failure is the test deadline; the later download message is not evidence of an independent serialization defect. No domain/persistence invariant failure was established. No matched standalone run of current baseline `a00451e` was performed for these four workflows, so they are not labelled baseline-proven failures. Historical earlier failures do not supply that proof. No retries, skips, wider equality tolerances or timeout increases were added to obtain green results.

## Bounded post-run integration correction

Only the obsolete visible-success wait in the pre-existing snapshot-isolation test is changed after the complete run. `waitForWorkspaceSaved(page)` observes the same writer acknowledgement used by main without requiring an intentionally hidden routine notice. The exact original-versus-second-context system comparison, sentinel-object creation, cloned state, and resource cleanup remain. This corrects the combined baseline's test contract; it changes no product, fixture or persistence behavior. Scoped review, lint and the targeted native result are recorded below. The complete run is not relabelled green after this correction.

## Cold preparation diagnosis and correction

The first corrected-wait run still failed at the 30-second test deadline. Its retained report is `test-results/tickets-04-06-control/isolation-1793617342516.json`; native diagnostics are under `test-results/local-test-2026-11-02T11-02-22-517Z-32340/playwright-run-1`. Read-only trace analysis found that worker setup only yielded a lazy provider (0.265 ms), while test-scoped `storageState` performed the public import (20.007 s), followed by prepared-page opening (8.041 s). The deadline occurred during the first context's Open Vesper action, before sentinel creation or the second context. Export cleanup then preceded the later blob read; that JSON error was a teardown consequence in this trace, not the primary failure.

Architect review selected a shared opt-in `preparedCampaignTest`: resolve the existing public snapshot provider during worker setup, then retain fresh contexts and `structuredClone` per test. Ordinary `campaignTest` stays lazy. The four variant cases, two new map cases and two already-prepared route-targeting cases use the shared export. The two older prepared cases in `workspace-cluster-routes` are unchanged; their preparation timing remains a follow-up for tickets 07/08. No runner configuration, retry, timeout or equality tolerance changes were made. The worker and scenario each retain Playwright's default budget. Initial typecheck rejected redeclaring inherited option metadata; a direct inherited-option value override fixed that typing error. Corrected global typecheck passed (`typecheck-prepared-fixture-corrected.log`).

Frozen tree **`300241dd2f21956c4c6db13e2548fe055ed787ed`** then passed the targeted native protocol. Each cold selection was the first browser selection against its separately started, owned Nuxt server. The warm selection reused the second server with unchanged source. The harness closed both servers and exited successfully.

| Selection | Result | Runner duration | Key observation |
| --- | --- | --- | --- |
| Snapshot isolation, cold server | 1/1 | 26.931 s | Test 14.618 s; sentinel is durably saved, then exact second-context export equality passes. |
| Six new prepared cases, separate cold server | 6/6 | 54.682 s | Both map scenarios and all four exact legacy URLs pass. |
| Same six, warm server | 6/6 | 43.273 s | Same candidate and assertions; no retries. |

All three selections have zero skipped, flaky, retry or global-error results. Reports, summaries and the manifest use prefix `test-results/tickets-04-06-control/prepared-1793618398125`; the harness log is `prepared-validation.log`. Success traces were explicitly retained with `--trace=on`. Native roots are `test-results/local-test-2026-11-02T11-19-58-261Z-58140` (isolation) and `test-results/local-test-2026-11-02T11-20-54-113Z-58140` (six cold/warm).

Successful trace inspection confirms the corrected lifetime: isolation's worker public import takes 9.391 s outside the test budget, snapshot cloning takes 0.413 ms, prepared-page opening 3.853 s, and the body including second-context cleanup 9.886 s. The sentinel save-state assertion passes before creating the second context; its JSON read and exact equality both complete. The first cold cluster scenario similarly spends 10.159 s in worker preparation, 0.575 ms cloning, 3.983 s opening and 4.517 s in the scenario body. Its durable save precedes reload and the exact persisted transform assertion passes afterward.

These runs establish the affected preparation boundary and observed cold/warm success. They do not establish ticket 08's ten-warm/three-cold protocol, a statistical flakiness rate or a comparable performance improvement over baseline.

## Review and closure

Independent Standards and Spec reviews closed the full batch and each subsequent correction with no remaining blocker. The initial Spec wheel finding was corrected and verified rather than removing the input obligation. Final fixture review confirmed inherited worker-fixture resolution, separate timeout slots, preparation-context cleanup and per-test snapshot cloning. Source tree `300241d` passed typecheck and the native protocol above; later edits only record evidence and ticket outcomes.

Ticket 04's lifecycle and Redo acceptance criteria are complete: 48 focused cases, all 183 pure cases in the complete selection, and three successful negative controls with byte-exact restoration. Ticket 06's affected browser families, canonical retained owners and replacement cases pass; four duplicate legacy create/save/reload workflows and one duplicate deletion journey are removed. Splitting one broad map case adds one case, balancing deletion: final discovery remains **466 cases / 81 files: 183 pure, 282 browser, one storage**, compared with the merged baseline's 464 / 81. The two added cases are pure lifecycle regressions. No browser-count reduction or cross-environment speedup is claimed.

The complete selection remains recorded as **461/466**, followed by the successful bounded isolation and preparation corrections. It was not rerun after those corrections. Four long browser workflows remain uncorrected, with their native evidence listed above; their unchanged bodies do not prove baseline failures. Tickets 07/08/09 retain allocation, measured timing and final integration work. Ticket 10 remains open and its retrospective has not been executed. Closing 04/06 records their scoped implementation and verification, not complete-suite stability.

Final global lint passed (`test-results/tickets-04-06-control/lint-final.log`). Final discovery `discovery-1793618620996` confirms 466 cases in 81 files, the project counts above and zero duplicate selections. Source and staged whitespace checks pass. The product build from tree `6ee3251` remains applicable: subsequent changes only affect test assertions, test fixtures and documentation, with current test source covered by the corrected typecheck and native checks.

## Standards

No remaining findings. Independent review covered the integrated batch and the final fixture correction, including real lifecycle owners, resource cleanup, exact persistence comparisons and inherited fixture semantics. Missing historical artifacts remain explicitly disclosed; current complete-run and correction evidence is retained.

## Spec

No remaining scoped code blocker. The initial plain-wheel coverage gap was corrected; cold/warm and isolation observations now verify the final preparation contract. Ticket 04/06 implementation closure does not satisfy the separate complete-suite acceptance or ticket 08's repeated-run protocol. Four unresolved long-workflow deadlines remain for the agreed follow-up work.
