# Playwright follow-up for tickets 12 and 14

The work started on 2026-11-05 at `7f5ed98575e4158b965284f0375a627f2947adc7` on `codex/playwright-test-quality`. The fetched `origin/main` and local `main` both pointed to `47c0418a835da285e9edb88e8f8dffc19c3a2bba`. The quality branch deliberately includes the 11 delivered commits ahead of main. The starting discovery has 586 cases across 94 files, with 272 pure, 313 browser and one development-storage case. [The previous delivery](implementation-11-13-results.md) records this discovery and the inherited evidence-ownership contract.

[Ticket 12](tickets/12-minimize-behavior-journeys-and-permutations.md) revisits retained application coverage with a fresh pruning owner and targeted read-only audits. [Ticket 14](tickets/14-shorten-feedback-with-idle-requalification.md) uses a separate architect and implementation owner for the local launcher lifetime. The coordinator integrates changes, owns native execution and updates the shared guidance. [Ticket 15](tickets/15-astra-high-final-pruning-and-oracle-review.md) owns the final Astra High pass and cumulative qualification.

## Pass 2 application coverage

The scoped Playwright browser discovery selected 272 cases across 59 files, down from 313. The 46 retired title entries include five retained journeys with new titles. The net reduction is 41 browser cases, or 13.1%. No new browser scenario was added. The [case ledger](coverage-inventory.md#browser-case-ledger) names retained owners and the precise permutations retired. The raw browser discovery and title delta are `test-results/tickets-12-14-control/pass2-browser-list-1793871242616.json` and `pass2-browser-delta.json` in that directory.

The catalogue matrix uses three representative subtypes in one fresh workspace. This removes two public setups, twelve repeated subtype placements and four JSON retrievals. The image export matrix removes four prepared-context scenarios and eight image retrievals. The versioned-download tour removes two more JSON retrievals. Worker-shared snapshot preparation remains amortized across retained cases, so fewer prepared-context scenarios do not imply the same reduction in public imports. The historical deletion and download case timings establish priority for review. No matched full-suite runtime comparison was performed for the cuts.

The initial focused application pure run passed all 70 selected cases with one worker, zero retries and no skips. Its report is `test-results/tickets-12-14-control/pass2-pure-1793870782867.json`. The initial scoped lint exposed 16 unused imports, and independent review caught a shared keyboard dispatch helper removed with a test. Both were corrected. Review preserved the actual visible history truncation notice, populated short-landscape Search fit and reachable last result, and native no-match status inside existing cases. The reviewer confirmed that the retained browser Search case detects stale armed Cluster Add after successful selection.

The 15 focused Chromium scenarios passed on the first run with one worker, zero retries, zero skips and no scenario deadlines. The coordinator ran them in an isolated copy of the baseline plus the final application test edits, so ticket 14 could continue correcting its launcher without touching the running source. Matching application/test SHA-256 fingerprints were `81447fa96445e74b87270640030f44e56429f58b86e51ad85caa9bdcb390cef2`. The copied source, including the predecessor launcher, stayed at `efe814fe6bf081668058bd883f30ca060c2ff881e689908645e4a038922f12d8` through shutdown. The run reused installed dependencies, created fresh generated caches and used functional browser preflight. Playwright reported 241.0 seconds and the complete launcher took 465.2 seconds, including development-server preparation and shutdown. These are isolated run observations. The artifact gate identified the run's report and port 3100 was released. See `test-results/tickets-12-14-control/pass2-native-1793872258152-proof.json` for selection, phases and report path.

## Integrated discovery and verification

| Project | Before | After | Change |
| --- | ---: | ---: | --- |
| Pure | 272 | 269 | Remove 14 application cases and add 11 launcher guard cases. |
| Browser | 313 | 272 | Remove 41 journeys or variants. |
| Development storage | 1 | 1 | Keep the real IndexedDB failure case. |
| Total | 586 | 542 | 44 fewer cases across 93 files, down from 94. |

Final discovery and the exact title ledger are `test-results/tickets-12-14-control/discovery-1793873123014.json` and `discovery-1793873123014-delta.json` in the same directory. The integrated verification source SHA-256 is `f3208c309809c7cbb50eff2dd06b4d3618c26e88d8dc3927e836918d0f85214c`. Source discovery, both native probes and their restored end states agree on that fingerprint.

Full lint, scoped lint after the last navigation correction, Nuxt typecheck and Markdown links passed. Typecheck initially caught duplicate option keys and unreachable branches after narrowing catalogue and map mode variants. The final log is `test-results/tickets-12-14-control/typecheck-1214-final.log`. Those two browser type corrections preserve the values and actions exercised in the isolated run. The navigation correction did not change launcher or runner files covered by the 54-case focused run. That run covered all 42 launcher cases and the 12 direct-predecessor output and sanitation cases. It passed without retries, skips or deadlines. Its proof is `test-results/tickets-12-14-control/pure-1793872981075-proof.json`.

## Safe idle requalification

An explicit Enter opens a new verification epoch after the prior child and cleanup finish. The session keeps its owned server and a continuous compatibility monitor. The monitor detects changes from the start of preparation, before the new strict monitor and readiness probe are attached. It keeps incompatible config and structural changes sticky across epochs. Preparation has a common deadline. Active source and HMR invalidation remains sticky even when an edit is restored or the child exits zero. Earlier result files and invalidation records remain owned by their original runs. An unsuccessful stop or failed readiness cleanup prevents another epoch in that session.

The controlled launcher cases exercised unchanged repetition, real idle and transient configuration edits, edits before the new monitor attaches and during hydration, stale callbacks, deadlines, overlapping requests, server exit during output preparation, cancellation and late cleanup, and invalidation evidence at child completion. Early reports preserve the initial cancellation timeout, startup budget assertion, cleanup and idle-notification failures. Review found and closed the preparation watch gap, pending readiness ownership, symlink fallback, stale-server admission, final invalidation record, and cleanup failure before abort. A completed compatible write whose filesystem notification is still queued at Enter can conservatively reject preparation. Wait for inputs to settle and enter again. A terminal shutdown can wait for an outstanding filesystem operation after the owned server and Playwright processes are stopped. A pending cleanup cannot qualify a new run.

### Matched native observations

The coordinator ran the same selected scenario before editing, after explicit Enter on the same server, and on a separate newly started server against the identical edited source. The data trial changed the initial system-name default in `useChartNamesSession.ts` and selected public create/resume. The UI trial changed the welcome introduction copy in `WorkspaceWelcome.vue` and selected short-landscape launch/recovery focus. A separate fresh browser context observed the new value before Enter and after the fresh control. All six scenario executions passed on their first attempt. The probes used Windows, Node 24.18.1, Playwright 1.64.0, Chromium 156.0.8078.4, one worker, traces enabled and fresh browser contexts. Installed dependencies and generated caches were retained. The live server naturally retains its process-local caches. These are warm functional comparisons with browser preflight. The strict first-cold protocol remains separate.

| Phase in seconds | Data idle | Data fresh | UI idle | UI fresh |
| --- | ---: | ---: | ---: | ---: |
| Qualification to child spawn | 5.953 | 59.407 | 8.575 | 51.705 |
| Runner start and fixture setup from trace | 3.216 | 3.058 | 3.358 | 2.982 |
| Scenario body between hooks | 8.180 | 8.066 | 7.244 | 7.175 |
| After hooks | 1.761 | 1.025 | 1.191 | 0.965 |
| Native child wall time, including reporters and cleanup | 18.692 | 13.636 | 13.609 | 13.203 |
| Launcher cleanup after child close | 0.612 | 1.139 | 0.703 | 0.722 |
| Total from Enter or fresh session start to result | **25.257** | **74.182** | **22.887** | **65.630** |
| Session shutdown and owned-server stop | 0.975 | 0.701 | 0.988 | 0.977 |

The trace rows are parts of child wall time. The separate edited-page observation took 10.125 and 9.644 seconds on the live server before Enter, and 3.834 and 4.701 seconds after the respective fresh results. These observation costs are outside the measured trigger-to-result time. The data pair used Nuxt PIDs 40080 and 21512. The UI pair used 31444 and 39884. Each reused run kept its first PID and wrote a distinct run root. The harness checked prior report, trace and diagnostic marker bytes, confirmed port release after all four sessions, and restored both temporary edits byte for byte. The raw proofs are `test-results/tickets-12-14-control/data-1793873209520-proof.json` and `ui-1793873440773-proof.json` in that directory. The measured advantage applies to these two one-case comparisons.

## Handoff

Independent application and launcher reviewers closed their blocking findings. The shared guide now gives representative focused commands and explains the explicit Enter, compatible edit and first-attempt evidence rules. The case ledger records intentionally retired variant coverage and the real owners for meaningful behavior. Ticket 15 starts from this integrated candidate and owns one cumulative full qualification after the Astra High value and oracle review.
