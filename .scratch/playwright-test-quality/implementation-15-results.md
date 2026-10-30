# Ticket 15 final Playwright qualification

## Scope and method

On 2026-11-05 the coordinator fetched origin and confirmed local `main` and `origin/main` at `47c0418a835da285e9edb88e8f8dffc19c3a2bba`. The intentional starting revision was `5dfc19e64ff5fea701c53314c54fffa20c17ca3c` on the quality branch, twelve commits ahead and zero behind. [The 12/14 delivery](implementation-12-14-results.md) established the 542-case baseline and the protected local launcher.

A fresh read-only sub-agent used `gpt-6-astra` at `high` reasoning. It reviewed the integrated suite, earlier removals and retained owners, then proposed nine groups of concrete cuts. Separate implementation owners applied accepted application and verification edits. The coordinator owned the shared guidance, Git and runtime. The [intermediate importance ledger](coverage-inventory.md#ticket-15-intermediate-importance-review) records the initial family-level reasons and exceptions. The user then requested at most 100 browser-backed cases and allowed a larger unit suite. Astra reopened retention from that budget.

The user supplied a per-change browser budget. The contributor guide starts with existing coverage, reserves one representative happy path for a new important browser contract when appropriate, and allows up to two distinct important failure or edge cases. The numerical budget is local policy. Its quality criteria follow observable behavior, isolated contexts, user-facing locators and retrying assertions. [Repository guidance](../../docs/agents/testing.md#browser-coverage-for-a-feature-or-fix) · [Playwright best practices](https://playwright.dev/docs/best-practices) · [Playwright isolation](https://playwright.dev/docs/browser-contexts).

## Retained critical assertions

Astra rechecked the actual held Navigate press, mode change and release with a fresh-click positive control. The legacy Object and Orbit drags establish Move independently before each action. Recovery uses distinct current and backup sentinels. The history publication observer asserts captured state outside the best-effort callback. Pan-right compares the immediate camera with the expected 80-pixel change, and repeat-click creation asserts positions from the delivered points. These retained oracles and their existing sensitivity evidence carry forward. The pass made no new product behavior changes or generalized rule for test syntax.

The browser history test still crosses the default limit with user input, checks the notification and list scrolling, and confirms history resets on reload. The cheaper coordinator test still checks which edges a configured history limit evicts. Public creation, save and restore, actual imports and exports, and one real IndexedDB transaction failure remain covered. Both painted Preview smoke journeys and first-failure diagnostic ownership remain part of qualification.

## Intermediate discovery and removed work

| Project | Before | After | Removed |
| --- | ---: | ---: | ---: |
| Browser | 272 | 214 | 58 |
| Pure | 269 | 232 | 37 |
| Development storage | 1 | 1 | 0 |
| Total | 542 | 447 | 95 |

The files decreased from 93 to 89. No case was added. `test-results/ticket-15-control/discovery-1793875804103.json` and its `-delta.json` companion record exact titles, files and project assignments on the intermediate source. The comparison caught an accidental visit-reset retirement and an incorrect Orbit case swap. Both important owners were restored before qualification. The retained held-system-pan scenario still exercises actual suppression and activation after release. Removing its unreachable cluster branch resolved the initial type error. The scoped lint and typecheck passed, following the earlier full lint pass.

The removed browser cases eliminate 58 independent scenario setups. Worker-shared snapshots remain amortized across retained cases. The retired ellipse interchange, unopened Search branch, and repeated route Retry cases alone remove ten export retrievals. The ellipse tour also removes two JSON uploads. In ticket 09's historical compiled run, 56 matching retired cases accounted for 412.8 seconds of reported case duration, including 48.1 seconds for the ellipse tour. Those past case durations describe where the work was concentrated. The full candidate timing is recorded separately.

## Browser cap revision

The intermediate development partition passed 233 cases and released port 3100. The intermediate production build also completed. The user set the 100-case browser cap before Chromium qualification began, so the coordinator held the browser run and reopened the selection. The final candidate receives a fresh build because tests are within the Tailwind source scope and their removal can affect the compiled output. The intermediate reports remain evidence of their own source.

Astra selected 97 ordinary browser cases and the existing development-storage case, leaving 98 browser-backed cases and retaining all 232 pure cases. The applied allowlist receipt `test-results/ticket-15-control/browser-plan-1793876763089.json` identifies each of the 117 additional browser retirements and the five further removed files. The [browser cap ledger](coverage-inventory.md#ticket-15-browser-cap) records the final representative owners. Both image format variants and both Preview smoke cases remain. The narrower Search selection keeps actual compact overflow, End reachability, touch selection, focus and draft survival in the existing Location-key case. Astra found no need for a replacement browser scenario or an extra oracle transfer.

Final discovery selects **330 cases across 84 files**, down from 542 across 93 at the start of ticket 15. Browser decreases from 272 to 97, pure from 269 to 232, and development-storage stays at one. This removes **175 ordinary browser scenarios and 37 pure cases** with zero additions. `test-results/ticket-15-control/discovery-1793879504787-delta.json` contains the exact case ledger and final source SHA-256 `f7bee22a3e82cb74344be7f982b2740cf231305f0f74800359b24052ab456ea0`. The exact-set check confirms the allowlist, all intermediate pure/storage cases, two Preview smoke cases and four UI smoke cases after the focused correction.

Astra compared 235 surviving callbacks in changed files against the starting revision before execution. The only body difference at that point was removal of an unreachable 390px diagnostic screenshot branch from the retained 844×390 footer smoke. The cap cleanup initially left one necessary Orbit Inspector helper import missing. It was restored before the successful typecheck. Full lint passed before that import restoration, and scoped lint passed for both subsequent edits.

The 175 browser retirements remove at least one independent setup each. Shared worker preparation can still serve retained cases. In the historical 315-case compiled run, 171 matching retirements from this ticket accounted for 1,328.9 seconds of reported case duration. This is a cost observation from that earlier run. The final native qualification below measures the actual reduced selection.

## Native qualification

All runs used Node 24.18.1, Playwright 1.64.0, one worker and zero retries. The browser-backed cases used Chromium 156.0.8078.4. The production build and local Nitro server used the `node-server` preset. Each owned server started fresh. The compiled runs opened a functional readiness probe before starting Playwright.

| Run | Outcome | Measured duration | Evidence under `test-results/ticket-15-control/` |
| --- | --- | ---: | --- |
| Owned local launcher, pure and development-storage | 233 passed, including the real IndexedDB failure case | 51.124 s reported | `checks-1793877838945-proof.json` |
| Production build via `nuxt build` | Exit 0 | 5 min 32 s including proof and cleanup | `build-1793877973707-proof.json` |
| Compiled Chromium project | 96 passed, 1 failed | 16 min 33 s reported | `compiled-browser-1793878321924-proof.json` and `-results.json` |
| Focused compiled Chromium, Orbit adjustment spec | 1 passed | 16.742 s reported | `compiled-browser-1793879466571-proof.json` and `-results.json` |

The first compiled run failed while checking that Undo was still disabled during a second Ctrl-wheel cycle. The trace shows the full 10° rotation and an enabled Undo labelled for rotation. Its two available Undo actions are consistent with Add Orbit and a single completed rotation. Astra identified focus loss from the previously clicked Undo button as a plausible early completion boundary. The run did not establish the exact trigger. The retained first native wheel cycle already checks the full rotation, unchanged zoom, pending-state blocking and restoration with one Undo. The native held-key path still checks one-step Undo and Redo. Pure controller tests cover the 300 ms quiet period and focus interruption separately. The coordinator removed the second modifier-order variant and reran only that spec.

The build and the first two test partitions used source SHA-256 `814eb5cbd6f46e85858463e002e933bb2432edda54879d65c809053dd42446b6`. The post-run edit changed only `tests/workspace-orbit-adjustment-gestures.spec.ts`. Reconstructing the prior source digest with the original test confirmed every other verification input matched. Tailwind's installed scanner found three removed identifiers and zero added candidates. The project's design system emits no CSS for any of those identifiers. The focused run reused compiled output SHA-256 `45f2e952927d12092776b0c69705f70ee60f6ecbb06d4062d164d80eb6352330`. The build equivalence proof is `orbit-gesture-build-equivalence.json`.

`qualification-reconciliation.json` matches every final project, file and title to one successful result across the unchanged checks, the first Chromium pass and the focused correction. The 330 selected cases include the first failure followed by the targeted success, with zero skipped cases, automatic retries, duplicates or global errors. The first failure report and trace are preserved. Owned ports 3100 and 3101 were released.

Ticket 09's 315-case compiled run reported 46 min 04 s under the same Node, Playwright and Chromium versions with one worker and zero retries. Ticket 15's 97-case run reported 16 min 33 s, followed by the 17-second focused run. This compares the observed selection durations at different revisions. Production build and server warmup are separate costs. The smoke scenarios ran locally on the compiled application. Remote Preview authentication and additional browser engines were outside this qualification.

## Independent closure

Astra High approved closure after reviewing the final wheel edit, the exact allowlist and the reconciled native results. The final suite keeps representative public workflows and native risks. Dedicated theme persistence, alternate viewport and modifier-order variants, and secondary feedback checks were deliberately retired. Fixture, runner, CI and contributor entry points continue to use the same contracts. [Final coverage ledger](coverage-inventory.md#ticket-15-browser-cap) · [Maintained test guide](../../docs/agents/testing.md).

## Rebase onto Player publication

On 2026-11-06, the cumulative Playwright change from `1fc8df90` was replayed onto `origin/main` at `f1922823`, after Player publication merged. The rebase preserves main's v4 source format, Player controls and native gesture guards. It carries the previously verified Warden scenarios forward with the current labels and fixture shape.

The 67 browser scenarios in the incoming Player and Warden publication families were consolidated into two. The Warden scenario exercises guarded publication, applied public text, Preview and the downloaded JSON while a fresh draft remains private. The Player scenario owns fragment and file admission, replacement ordering, native navigation, compact inspection and PNG download. Lower-level tests own schema, migrations, projection, stale commands and format bounds. Seven redundant pure registrations were removed or combined. Dedicated screenshot, viewport and disclosure matrices, native delayed-PNG variants and reader reload/tab permutations were retired.

Discovery selects 99 Chromium scenarios, one IndexedDB case and 317 pure checks. The original 97 Chromium titles remain, and the new gesture assertions are folded into existing cases. [Player publication boundary](../../docs/adr/0002-player-publication-boundary.md).

Local lint, typecheck and Markdown links passed. The complete pure project passed all 317 cases. The focused Chromium and IndexedDB selection passed all ten cases with one worker and zero retries. It included both new journeys, the rebased touch and right-drag guards, chart-save and history-capacity checks, and the actual IndexedDB transaction failure. The initial pure run exposed stale v1 fixtures and two preflight tests that bypassed the controlled Vue environment. The final run used the v4 fixture shape and existing mounted harness. The Windows sandbox also denied the symbolic-link fixture on the first run. That check passed in the authorized local run.
