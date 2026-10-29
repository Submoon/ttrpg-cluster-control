---
title: "Cluster and system search: implementation and verification"
status: in-progress
---

## Scope and baseline

The user authorized sub-agent coordination of [Find and reveal the cluster and its systems](tickets/01-cluster-system-search.md) on a separate branch on 2026-10-29. Only ticket 01 is claimed. Branch: `codex/global-search-ticket-01`. Pinned implementation/review baseline: `8d4b66504ca6723db5405ed7cb93d0a666264c9a`, equal to freshly fetched origin/main and local main, 0 ahead / 0 behind. The refreshed GitHub #7 body, comments, labels and OPEN state are unchanged.

The existing untracked environment configuration is unrelated and must remain outside the commit. This effort's framing, specification and approved ticket set are scoped planning artifacts to preserve with the implementation. No push, PR, merge or source-issue modification is requested.

## Architecture handoff

Complex route, with a completed read-only architect handoff before implementation. No persistence/format/domain-invariant change is planned. Keep existing mutation and draft guard semantics.

- Expose one complete guarded search-result reveal from the editor workflows, returning a truthful revealed/rejected verdict. Never coordinate void-returning navigation calls in UI.
- Search targets carry explicit workspace/cluster identity and either cluster or system identity. Results expose stable internal keys separately from readable name/type/context and deterministic collision occurrence numbers.
- Store only open/query in the existing transient editor UI lifetime; derive candidates from latest applied data. Query survives hide/reflow and resets on editor identity/exit. No object search in this slice.
- Preserve the separately active system when selecting another system's cluster node. Search activation does not open Inspect. Existing guards, continuous-adjustment completion and session ownership remain authoritative.
- Await mounted-map readiness after remembered-camera restoration and final layout, with ownership generation, identity, target and disposal checks before deferred camera/focus effects. Share existing obstruction measurement for full-cluster Fit and bounded card/label framing.
- Search modal/input/result keys own consultation events and nested guard focus. Success closes search and leaves map focus; simple dismissal returns opener focus. History availability and shortcut ownership recognize search as an overlay without turning consultation into a mutation.
- Actual dialog close-focus completion is a browser-owned barrier, shared by Search and the chart/transition dialog and injected into the editor operation. Accepted framing/focus waits until both dialogs and compact panel cleanup finish; rejected activation waits for the guard's completion before returning focus to Search. Reopen and unmount resolve obsolete waits. No timeout or global focus manager is introduced.
- System-node reveal uses an isolated-target cap of 200% and obstruction-aware containment; desktop/compact/portrait screenshots were inspected. A separate portrait assertion confirms the rendered name is at least 12 CSS pixels tall, so no additional responsive cap policy was needed.

## Ownership

The core developer owns the search calculation, store/workflow/navigation/map-control/readiness integration and pure/composed-command tests. The UI developer owns the page/chrome/search component, affected presentation and public browser journeys. Source ownership is disjoint; shared interface changes require coordinator agreement. The coordinator alone owns Git, ports, browser sessions, static/build scheduling and final integration.

Approved seams are unchanged: real composed editor result-activation command, public browser behavior, targeted pure matching/framing calculations. TDD proceeds one failing behavior and minimal implementation at a time. No guard stubbing, blanket test disabling or speculative object-search work is accepted.

## Check record

The coordinator's development runtime is on loopback port 3217; other chats' processes are not reused. Evidence and screenshots belong in ignored test artifacts. Static/preparation/build checks run while browser journeys are idle.

Preliminary checkpoints (candidate still changing):

| Scope | Command / evidence | Result |
| --- | --- | --- |
| Search entry tracer | Focused public browser scenario in workspace-search, browser project against loopback 3217; artifacts `test-results/search01-ui-red` | Behavioral red: named Search button absent after public workspace creation. Initial environment-only attempts required installed-browser path and host-loopback execution; those failures are not behavioral red evidence. |
| Search entry tracer | Same scenario after minimal chrome change; `test-results/search01-ui-tracer-green` | 1 passed; Search visible in system and cluster contexts. |
| Pure search model | Focused model suite, pure project; `test-results/search01-core-model-green` | 3 passed: normalized ranking, literal punctuation/empty/no-match, distinct homonyms/occurrences. The developer reported the first model run failed to import the absent module and grouped these three cases before implementation; remaining cycles use one behavior at a time. |

Final source-freeze checks (candidate commit still pending):

| Scope | Command / evidence | Result |
| --- | --- | --- |
| Search model + real composed commands | `npm exec -- playwright test tests/workspace-search-model.spec.ts tests/workspace-search-command.spec.ts --project=pure`, with loopback base URL and `test-results/search01-core-final` output | 14 passed, no lifecycle warnings. Covers real Stay/Apply/invalid Apply, preserved sessions, target/context changes, supersession, disposal, applied deletion during readiness and reopened Search during presentation completion. Navigation adds no history action; accepted guard Apply remains its separate action. |
| Public desktop + compact | Focused runs of `tests/workspace-search.spec.ts`; `test-results/search01-ui-compact`, `search01-ui-keyboard-fixed`, `search01-ui-final-focus` | All six scenarios passed across focused runs: visible access; deliberate system reveal and unchanged consultation; keyboard/composition/Escape/query; 13 homonym matches and scrolling in 844x390; real Inspector draft Stay/Discard with compact reflow; 390x844 emulated touch reveal. The full frozen-candidate suite will recheck them together. |
| Visual review | Saved populated-search, selected-node, short-landscape list, compact draft/reveal and portrait results/reveal PNGs in the focused artifact directories | Readable search content and contextual labels; bounded desktop framing with context; compact list scrollability; portrait control/target containment and rendered-label assertion. |
| Type checking | `node node_modules/nuxt/bin/nuxt.mjs typecheck` | Final frozen source passed. Earlier fixture and nullable-workspace diagnostics were corrected with explicit narrowing, then checked again. |
| Lint | `node node_modules/eslint/bin/eslint.js . --max-warnings 0` | Final source passed. An earlier run sampled a browser fixture mid-edit and reported helpers that were subsequently used. |

Development caught and corrected three material behaviors: system-ID equality incorrectly bypassed a dirty object session guard; native search Escape cleared the retained query; and late guard close focus could override the map. Each correction retained its observable regression coverage. Locator-only fixes for modal-hidden map geometry and the semantic searchbox role did not change product behavior.

The initial committed candidate is `2f24884c3edea1797949e7ab89ed1d6f4d936145`. Its production build passed (Nuxt client/SSR/Nitro), with bundler chunk-size/timing notices and third-party package deprecation notices; no warning policy was relaxed. An initial complete-suite attempt was interrupted to incorporate confirmed review corrections: terminal progress reached case 209, but no completed JSON report was produced. That partial run is not claimed as a full-suite pass.

Post-review regression evidence: 16 model/composed-command tests passed in `test-results/search01-review-final-pure`; all 8 public search journeys passed together in `test-results/search01-review-final-browser` (44.8s). This includes Delete while traversing results and same-cluster Add exit. A subsequent failure-path correction adds readiness/framing refusal coverage: 17 pure tests pass in `test-results/search01-final-review-pure`; the real Inspector guard and same-cluster Add journeys pass again in `test-results/search01-final-review-browser` (2 passed, 18.5s). The final source candidate is **31c01b4d6a57f3adc5a2b41ebd2c25421d595b9c**. Its typecheck and lint passed with logs at `test-results/search01-final-typecheck.log` and `test-results/search01-final-lint.log`. Final production build and complete-suite evidence remain pending. Browser viewport and CDP touch evidence do not certify an operating-system software keyboard, physical device or screen reader.

## Independent review

### Standards

The independent Standards reviewer found zero actionable violations or significant smell-baseline concerns in the pinned baseline-to-`2f24884c` diff. The review inspected module ownership, deterministic matching, Pinia lifetime, guarded navigation, renderer/focus boundaries, relevant callers, tests and desktop/compact/portrait screenshots. Bounded correction reviews at `5d9a1d45` and **31c01b4d** both closed with zero actionable findings and no blockers. No runtime or physical-input check was performed by that reviewer.

### Spec

The independent Spec reviewer identified three initial P2 defects and one adjacent rejection-path P2, all confirmed through coordinator-owned reproductions:

1. A focused Search result leaked Delete to the editor, opening a deletion review for the existing map selection. The global shortcut owner now ignores Search, with a public regression. No deletion mutation/confirmation semantics changed.
2. Reopening and dismissing Search during deferred presentation let an obsolete reveal regain ownership. Search open/close now advances the existing context generation, while the command's own publication suppresses its accepted close. The real composed regression verifies stale rejection with no frame/focus.
3. Same-cluster activation left Add armed because only the map mode changed. The complete accepted reveal invokes composition-owned synchronous creation/route cleanup. Real command and browser cases verify Select and no accidental placement; a refused guard retains the armed Add state.
4. Initial cleanup placement could end Add before renderer readiness/framing rejected the operation. The cleanup now runs only after a successful frame and final ownership check, immediately before map focus and the successful verdict with no subsequent await. The new real-command case reproduces the old loss and verifies preservation for both unavailable readiness and failed framing. No controller rollback protocol or weakened rejection contract was introduced.

The reviewer also inspected Escape from a result while Add is armed: the existing modal exclusion prevents that shortcut from reaching Add cancellation, so no additional defect or workaround was introduced. Final Spec closure at **31c01b4d** verified all four corrections and their regressions, with **zero remaining blocking findings** and no scope creep; object search remains deferred to tickets 02/03. The intermediate correction commit is `5d9a1d4595480bce81af72ce2bbab72e5f7ceac7`; its ongoing build was stopped before completion for the rejection-path correction, so it is not recorded as a successful corrected-candidate build.

## Integrated suite and presentation correction

The reviewed source candidate `31c01b4d` passed the final production build in 4m15s (`test-results/search01-final-build.log`), plus lint and typecheck. The complete Playwright invocation ran all 457 tests with two workers, unchanged default test deadlines and no skips: **448 passed, 9 failed**, in 29.6 minutes. Report: `test-results/search01-integrated-final/report.json`. All 17 focused pure/command cases and all 8 public Search cases passed within that run.

The exact nine failed scenarios were selected from that report and rerun with the repository's usual single worker, unchanged source/assertions/deadlines: **8 passed, 1 failed** (`test-results/search01-isolated-rerun/report.json`). The remaining failure was reproducible pointer obstruction in the short-landscape panel smoke journey: the open map-navigation popover covered Inspect at 844x390. The other eight failures were not reproduced in that single-worker run; no code or test relaxation was introduced for them.

The UI developer applied a CSS-only correction to the zoom navigation surface for widths of at least 761px and heights up to 600px. Heading, slider and range note sit beside the four pan controls in a horizontal row. Normal portrait/desktop composition remains outside that rule. The existing panel regression then passed unchanged (18.4s), and an initial visual probe passed header separation, viewport containment and Inspect-center hit testing (12.0s). A stronger comparison of compact and regular rendered button bounds caught an unintended reduction from 40px to 32px; the final correction restores the original 2.5rem tracks. State and keyboard behavior are unchanged.

The affected panel, Search and maintained UI-smoke run at one worker passed 17 of 18 scenarios (`test-results/search01-final-ui-regression/report.json`), including all five panel and all eight Search scenarios. Its single failure occurred during public workspace creation, before the zoom interaction: the map retained the default name instead of the fixture's supplied name. That exact scenario passed unchanged on an isolated rerun, together with desktop/portrait variants and the existing popover-keyboard-ownership journey (4 passed, `test-results/search01-final-presentation-rerun/report.json`). No test deadline, assertion or source behavior was relaxed for that transient failure.

Following repository guidance for presentation-only changes, unchanged script/type/bundling evidence from `31c01b4d` is retained; final lint and bounded review cover the CSS delta. No second complete-suite run is required solely for that stylesheet correction. Final 40px hit-target probe, affected-check and review closure results will be recorded before ticket completion.

## Review plan

Freeze and commit the integrated candidate, then run independent Standards and Spec reviews against the pinned baseline through the requested code-review skill. Resolve confirmed findings with the owning developer and obtain reviewer closure. Run the full integrated suite once for the delivery, with targeted reruns after corrections where justified. Close ticket 01 only after its criteria and available verification are resolved; unblock ticket 02 without claiming or implementing it.
