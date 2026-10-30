# Tickets 11 and 13: first pruning pass and evidence ownership

## Status and baseline

Tickets 11 and 13 are complete and closed on 2026-11-04 after focused verification and independent Standards, Spec and complementary sensitive reviews with zero remaining findings. Final reviewed tree: `ac146749224d31579a8f1b274a8279ff55f6a265`; reviewers approved the subsequent metadata-only lifecycle closure. The coordinator commits this delivery on the current branch. Cumulative full-suite qualification belongs to ticket 15.

Origin was fetched on 2026-11-04. Starting HEAD is `a5af535ae52fc808fef5d3e85611cdb1a0b6e3b3`; `origin/main` and local `main` are `47c0418a835da285e9edb88e8f8dffc19c3a2bba`. The intentional base is the delivered quality branch, containing main plus ten commits, rather than main alone. The unrelated untracked `.codex/environments/` data is preserved.

Baseline native discovery completed before source edits: **583 cases in 94 files — 267 pure, 315 browser and one development-storage**, with zero duplicate selections or discovery errors. Report: `test-results/tickets-11-13-control/discovery-baseline.json`; command: `node node_modules/@playwright/test/cli.js test --list --reporter=json --output=test-results/tickets-11-13-control/discovery-baseline-output`, with local all-suite selection and Preview/base/auth inputs removed. Historical ticket 09 qualification is retained separately and will not be overwritten or represented as verification of this candidate.

## Ownership and verification plan

- Ticket 11 owns application test pruning, the permanent-behavior/temporary-aesthetics policy, the appended coverage dispositions and affected application helper contracts. Shared helper interfaces require coordinator agreement before editing.
- Ticket 13 starts with read-only architecture inspection, then a separate implementation specialist owns demonstrated runner/artifact gaps and their focused tests. Existing privacy/sanitation behavior is preserved; consequential boundary changes require complementary review.
- The coordinator owns shared ticket/result records, Git, runtime resources and checks. Ticket 13 supplies documentation changes for integration after ticket 11 releases the shared guide. All source writers freeze before browser verification.

Use unique owned artifact directories and focused checks for these slices. New verification-tooling behavior receives a red/green control through the existing public boundary. Reserve cumulative full-suite qualification for ticket 15, as expressly specified in these tickets; valid unchanged historical evidence may be reused with its limits stated.

## Implementation and evidence

### Ticket 11 handoff

The first pass removes two complete browser cases: C113, exact Back-button placement across three viewports, and C276, the exhaustive palette/map glyph comparison with 15 public Add/place cycles. Real Back navigation remains in the canonical navigation case; all 15 subtype creation/edit/save/reload obligations remain in the three object-family journeys. Search model mapping and representative native mark rendering remain covered. The retired obligations are aesthetic and require no replacement.

Eight retained cases drop incidental equal/full footer widths, alignment, Dock rectangle equality, popover framework states, glyph/CSS presentation checks, arbitrary Search dimensions and numeric deep-Hierarchy indentation/name-width thresholds. Native action fit/hit/activation, keyboard and touch access, focus, accessible hierarchy context, painted Search resources, reachability and framed map bounds remain. Destructive styling remains an explicitly justified existing UI contract. No shared fixture/helper contract changed. README and AGENTS already reach the same testing guide, whose permanent-behavior/temporary-aesthetics policy is now explicit.

This removes two workspace preparations and 15 aesthetic comparison placements, with no downloads or exports removed. The pass alone predicts 581 cases (267 pure, 313 browser, one storage); final integrated discovery must also account for ticket 13's necessary tooling coverage. No matched execution-cost gain is claimed.

### Ticket 13 diagnosis and first red/green slice

Read-only architecture tracing confirmed that installed Playwright clears its native output before global setup. The shared default `test-results` and HTML root, forwarded local `--output`/alternate-config arguments, and inherited reporter destinations can bypass intended ownership. Existing native empty-selection rejection and artifact sanitation are retained; no maintained shared trace analyzer was found that needs another implementation.

The first public-session regression failed before correction: caller-owned `--output` was accepted by `session.start` instead of rejected (one failed case, 35 ms). After the minimum launcher correction it passed (77 ms; 4.025 s native runner duration), with zero retries/skips/global errors. Evidence in `test-results/tickets-11-13-control/output-override-red.json` / `.log` and `output-override-green.json` / `.log`; the initial failure trace is retained. Subsequent implementation and final outcomes are recorded below.

### Initial candidate review and native counter-controls

Global lint and typecheck passed on the first candidate. Focused tooling/Search-model execution passed 58/59 in 15.296 s. Its one failure required distinct JSON basenames despite correctly distinct directories and absolute files. The assertion now checks the common `results.json` basename and `join(DIR, NAME) === FILE`; its affected rerun passed in 388 ms (4.3 s runner). These initial artifacts are `focused-tooling-1` and `local-composition-correction` in the control directory. They do not qualify the subsequent corrective implementation.

Independent reviews of tree `189f52c4d889b4f3dbd7888e0e03fde7fe978542` found blocking worker-lifecycle, argument-parsing and last-run-file ownership defects, plus an exact tooltip locator missing the second sentence of production wording. These findings prompted an architectural correction and native counter-controls rather than acceptance of the initial candidate.

Real native negative controls reproduced all four tooling mechanisms in disposable fixtures: `test-results/tickets-11-13-control/regressions-red-1793804286022/proof.json`. An argv separator caused validation of a different directory from the one actually cleared; an environment-supplied output failed when the first worker reloaded configuration; the last-run override overwrote a disposable retained file; and a native failure trace landed outside the coordinator's declared output. That first trace arose from the sandbox's missing browser executable, not the intended assertion. It still establishes the output mismatch; subsequent controls use serverless attachments and an explicit assertion fault to avoid that environmental dependency. Actual earlier retained reports and user metadata were not used as destructive fixtures.

Earlier positive concurrency/HTML/empty-selection controls passed (`native-ownership-1793803981899-proof.json`) and retained the recorded evidence bytes, but did not exercise failure attachments or environment-bound worker imports. They were insufficient to close those blockers; the later controls below exercise the corrected contracts.

## Corrected ownership and sanitation

The configuration now validates output freshness once and issues one scoped invocation manifest. Its coordinator and immediate connected IPC children share the same validated paths; workers neither generate another root nor reject their own already-created artifacts. Stale or mismatched invocation state cannot authorize reuse. The manifest stays outside native/HTML cleanup roots.

Direct output/last-run options require an initial option prefix; reserved tokens later in argv are rejected even after `--`. This deliberately rejects ambiguous literal/filter forms rather than trying to duplicate Commander's parser. Local execution owns its destinations, rejects output/config/last-run overrides including packed config flags, and clears inherited destination/invocation state. Native, JSON, HTML and last-run destinations have explicit ownership; existing protected reporter restrictions and the latest-run sanitation marker remain in force. The [shared guide](../../docs/agents/testing.md) documents the actual command contract and current idle-edit limitation.

A second separator-value counterexample was found during review: Commander can consume `--` as an option value and continue parsing later flags. The disposable sentinel was lost before correction (`regressions-separator-value-red-1793806305403/proof.json`) and preserved with rejection afterward (`regressions-separator-value-green-1793806588642/proof.json`). Both are under the control directory. No actual retained user evidence was a destructive target.

A real protected native probe also exposed a pre-existing encoded-body gap: raw report/ZIP scans looked clean, but decoding JSON attachment bodies recovered the fake credential (`protected-inline-check.json`). The first advanced probe's raw-only privacy check was insufficient. Recognized inline attachment records are now suppressed in protected JSON and HTML: empty body, `text/plain`, and an idempotent redaction suffix on the sanitized name. Existing file attachments retain their handling; no-auth bytes remain unchanged. This extends the existing sanitizer rather than adding a new one.

## Final discovery, source identity and focused verification

Delivery discovery is **586 cases / 94 files: 272 pure, 313 browser, one development-storage**, with zero duplicate selections or discovery errors. Report: `test-results/tickets-11-13-control/discovery-delivery.json`. Relative to the 583-case starting point, ticket 11 removes two browser cases and ticket 13 adds five necessary pure verification guards; protected fixture extensions add no cases. This is discovery, not a claim that all 586 ran in this batch.

The final runtime/test source digest is `149c5b7ac2719d7559850111df6741625161204874b7bd8ff08bf45cf14c6077`. The qualified browser-rerun digest was `1d113173aac1e12465b2c0fb0aac846e1eb131a833521db13b98c83cc5756735`; the only later source difference removes a trailing blank line at EOF from the retired-glyph case file, with no behavioral change. The reviewed core tree is `c4c5515c9093a6dd12fd99eaf9c3f4d45bb16159`; its only subsequent source correction disambiguates two tooltip text locators using the public `aria-hidden` attribute. Documentation amendments do not affect the runtime digest.

All short artifact names below are in `test-results/tickets-11-13-control/` unless a full path is given. These ignored local artifacts require separate retention for use outside this checkout.

| Check | Outcome and evidence |
| --- | --- |
| Global static checks | `npm run lint` passed (`lint-3.log`). `npm run typecheck` passed after the final locator correction (`typecheck-delivery.log`). Scoped tooltip ESLint also passed (`tooltip-lint.log`). |
| Focused pure/tooling coverage | Five-file selection: `node scripts/playwright-pure.mjs tests/local-test-launcher.spec.ts tests/playwright-runner.spec.ts tests/playwright-artifacts.spec.ts tests/ci-verification.spec.ts tests/workspace-search-model.spec.ts --reporter=list,json`, with a fresh explicit JSON file. Its 61-case run passed 60/61 in 14.895 s; the sole failure checked incidental error wording despite correct rejection. The affected parser case then passed (`parser-correction.json`). This is composite affected-rerun evidence, not a clean first-attempt run. |
| Real worker regression | The maintained serverless native integration case passed in 6.723 s under the default 30-second budget. It proves default and environment-bound failure/replacement attachments use coordinator-owned outputs. The earlier unsupported timeout detail was removed. |
| Sanitation correction | All six existing artifact cases passed in 3.7 s after fixture extensions (`artifacts-inline-correction.json`). The actual protected native control (`advanced-1793807719404/proof.json`) produced the intended assertion failure and a passing replacement, completed sanitation, covered attachment paths and **one decoded inline body with zero leaked bodies**. Only fake credentials were used; this is not live Preview authentication evidence. |
| Native ownership controls | `regressions-green-1793806030704/proof.json` establishes worker startup, owned failure traces and preserved separator/last-run sentinels. `advanced-1793806939829/proof.json` establishes accepted fresh pair/equals destinations, a fresh last-run file, rejected restored stale manifest and rejected local packed/separator overrides. Its earlier raw-only privacy conclusion is superseded by the decoded correction above. |
| Concurrent and empty selections | `native-ownership-1793807863694-proof.json`: two concurrent matching controls passed once each with different default outputs and a sibling HTML report. Native unmatched selection returned nonzero. Recorded earlier reports, initial-failure attachments and user metadata remained byte-identical. |
| Clean production build | `node test-results/tickets-11-13-control/build.mjs` ran `node node_modules/nuxt/bin/nuxt.mjs build` with production/node-server settings, exit 0 in 282.848 s. Proof: `build-1793808269756-proof.json`; source digest `198c8384749e763a18c5d6e0a0e2cbf4ec80ea71ae8e319c7efaaa0dfa90276d` was unchanged. The later two-locator test correction changes no production/runner/sanitizer behavior, so this build evidence is retained. |
| Affected browser cases | The eight changed retained cases plus canonical Back-navigation owner were selected: three footer viewports, shortcut help, Search marks, two compact Search journeys, deep Hierarchy and navigation. First run: **8/9**, 78.590 s native duration, 49.413 s server-to-readiness; source preserved and port released (`focused-browser-1793808602430-proof.json`). Its only failure was duplicate tooltip text, with a painted span and an `aria-hidden` mirror. The locator now excludes the hidden mirror without slots, generated IDs or indexing. Its affected rerun passed in 8.6 s body / 15.066 s native duration, 35.793 s readiness, with source digest preserved and port released (`focused-browser-1793809087561-proof.json`). All nine selected obligations are therefore covered by the original eight passes plus this corrected pass. |

Browser evidence uses local Chromium `156.0.8078.4`, Node `v24.18.1`, Playwright `1.64.0`, one worker, zero retries, fresh scenario contexts and a hydrated-browser functional preflight. Dependency/generated caches were retained. The proof files contain exact argument arrays, report paths and runtime conditions; the maintained launcher command remains `npm run test:local -- <test files> --project=browser --grep <selected titles>`. Native durations exclude server readiness; no cold-start or statistical flake-rate claim is made.

The coordinator mistakenly started an earlier functional session while a build still ran. That functional process tree was stopped before any target result, the port was released, and the overlapped build was discarded as qualification despite exit 0. Both logs are retained in `aborted-overlap.json`; only the subsequent separate clean build and browser epochs above qualify the result. No source correction or passing claim derives from the aborted attempts.

The final delivery summary verifies discovery, source identity and unchanged hashes of retained ticket-09 reports and the user-owned environment file (`delivery-summary.json`). Full-suite qualification remains ticket 15; no live Preview, other browser engine or fresh-install qualification was performed. There is no matched before/after whole-suite timing or claimed global speedup. Ticket 12 receives the stable first-pass inventory and ticket 14 the settled output/cleanup contract.

## Standards

Standards review is closed with zero findings on tree `ac146749224d31579a8f1b274a8279ff55f6a265`. The reviewer inspected the two-locator correction, documentation and final evidence and approved the bounded lifecycle closure.

## Spec

Spec review is closed with zero findings on the same final reviewed tree; the reviewer confirmed tickets 11/13 acceptance criteria and approved the bounded lifecycle closure. Complementary sensitive review is also closed with zero material blockers, including native proof of zero decoded-body leaks and the documented qualification limits. No full-suite or live Preview approval is inferred.
