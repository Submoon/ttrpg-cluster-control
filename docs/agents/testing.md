# Verification and test guidance

Use this reference when choosing a test boundary, adding or changing Playwright coverage, or reviewing test changes. `package.json`, `playwright.config.ts`, and the CI workflow remain authoritative for commands and runner behavior; this page explains the repository's testing choices and how to review them.

## Choose the test boundary

Test a behavior at the narrowest existing boundary that can reproduce its failure mode. Keep an integration test when the composition or browser behavior is itself the risk.

| Boundary | Put these obligations here | Keep the subject real |
| --- | --- | --- |
| Domain functions | Validation, geometry, placement rules, import/export transformations, identity relationships, and deterministic permutations. | Supply explicit inputs and assert exact results. |
| Controllers and stores | Draft guards, cancellation, stale-context handling, mutation verdicts, history, save ordering, and deferred durability. | Call the real actions with controlled dependencies. Mount an owner when the behavior depends on mount/unmount lifecycle. |
| Browser and browser storage | Pointer, touch and keyboard gestures; focus ownership; responsive rendering and hit testing; downloads; IndexedDB integration; and representative end-to-end create, save, import, reload, and recovery paths. | Use public actions for the workflow under test and isolate each test's browser state. |

Do not duplicate a deterministic matrix in full browser journeys when domain or controller tests can own it. Retain the browser check that proves the UI is wired to that behavior. If two boundaries assert related outcomes, name the distinct failure each one would catch.

Start a browser coverage review by selecting the smallest set of journeys that exercises the important browser and application boundaries. Keep another journey only when it demonstrates a different failure that matters to a user. When several data values, viewports, or modes exercise the same branch, use a representative case. Keep a separate variant when its interaction, responsive layout, or state transition changes the failure it can expose.

### Browser coverage for a feature or fix

Start with existing coverage. A change can need zero new browser cases when the relevant journey already asserts its outcome or a domain or controller test can catch the regression. For an important new browser behavior, add one representative happy path when appropriate and at most two failure or edge cases that protect distinct important outcomes. Apply the same budget to bug fixes and assert the exact action and outcome that regressed.

Keep individual controls and intermediate steps within the relevant journey. Cover business rules, validation combinations and state or data permutations at the domain or controller boundary. Expand input, state, role or browser matrices only when explicitly requested. Before adding a scenario, identify the regression it would catch beyond existing coverage and why real browser execution is necessary. Reuse a suitable owner when the assertion belongs to its existing behavior.

The numerical budget is a repository policy. The published guidance favors observable user behavior, isolated browser contexts, resilient locators and assertions that wait for the outcome. [Playwright best practices](https://playwright.dev/docs/best-practices) and [Playwright browser isolation](https://playwright.dev/docs/browser-contexts).

Keep the suite at 100 browser-backed cases or fewer, including the development-storage case. Review the existing owners when adding coverage near the limit. The browser budget leaves domain and controller coverage free to reflect the important deterministic rules.

## Permanent behavior and temporary visual checks

Keep a permanent test when it can catch a specific important user or verification failure that existing coverage would miss. Apply that question to whole journeys as well as individual assertions. A previous failure or the existence of a test prompts a review of the risk it still protects.

Use screenshots, manual review or disposable scripts in owned artifacts as temporary aids while a visual change is being built; record the useful result and remove temporary scripts before delivery. Once the change is accepted, remove assertions for incidental spacing, equal sizing, exact alignment, framework markup or a preferred CSS treatment unless a lasting product or accessibility requirement names the outcome. A lasting visual requirement needs a focused test and a short explanation of how violating it would affect users. Keep behavioral rendering checks for readable names, visible focus, usable hit targets, unclipped content, map geometry and other errors that obstruct an action or change its meaning.

Delete duplicate or unnecessary scenarios without adding a replacement. Move deterministic rules to an existing domain or controller test only when the browser test adds no distinct interaction risk, and retain one browser check for real UI wiring. Do not delete useful behavior merely because its journey is slow; first separate setup from the behavior or identify a cheaper boundary that still catches the same failure.

## Locator and accessibility contracts

Playwright recommends user-facing locators and resilient tests. Prefer scoped `getByRole` with an accessible name for controls, and `getByLabel` for form fields. Use text locators when visible wording is the behavior being asserted. Scope repeated controls to a dialog, panel, map, or other meaningful owner so the locator expresses which control the user can reach.

Choose an observation that remains available after the action. When a toolbar action can dismiss a popover, read the resulting map state from the persistent toolbar. The popover still owns the interactions performed inside it.

Use native HTML semantics when they fit. Add an accessible name, role, or ARIA state when it gives users a meaningful contract. Tests may verify that contract with role/name, focus, keyboard operation, or visible text. An ARIA value describes user meaning; it is not a substitute for a technical identity.

Use a stable `data-testid` when copy, wrapper structure, or visual presentation is incidental to the test's purpose and no durable domain identity is available. Give the identifier a semantic purpose, keep it stable across desktop and compact layouts, and scope it when both representations can exist. For map entities, use their existing entity identity where identity matters. Continue asserting accessible names and other user-facing behavior even when a test id is used to find the element.

CSS and structural locators are appropriate when DOM structure, SVG geometry, or hit testing is the contract under test. Positional selection is appropriate when the collection order is itself established and meaningful. Explain exceptions that would otherwise look incidental, such as why an actionability bypass, fixed delay, structural locator, or rendering tolerance is required. Do not replace all roles and labels with test ids or ban all CSS and positional locators.

The locator reference distinguishes role, label, text, test-id, and CSS/XPath locators. [Playwright locators](https://playwright.dev/docs/locators).

## Fixtures, state, and ownership

Playwright gives each browser test its own context and page. Keep test data, cookies, local storage, and IndexedDB isolated. Make preconditions explicit so a test does not depend on order or a prior run.

Exercise creation, import, hydration, and recovery through the public UI when that path is the behavior being protected. For other scenarios, reusable preparation may import a known campaign once and supply each test a cloned IndexedDB snapshot in a fresh context. Keep the snapshot immutable, tied to the correct origin, and free of shared pages or live contexts. Use the existing campaign fixture contract rather than adding another setup path.

Use `preparedCampaignTest` for scenarios that only need the imported campaign as a precondition. It completes the public import in worker setup before the scenario budget starts, then supplies each test a cloned snapshot. Ordinary `campaignTest` keeps public-import preparation lazy. Neither fixture shares a live page or context between tests.

A fixture or helper owns what it creates: listeners, browser probes, failpoints, and temporary state must be restored on both success and failure. Use a real controller or writer when asserting ordering, acknowledgement, mutation, or durability. If using `@pinia/testing`, account for its default action stubbing; observing a stub is not evidence that the workflow ran. See Pinia's [testing guide](https://pinia.vuejs.org/cookbook/testing.html).

Official guidance: [Playwright fixtures](https://playwright.dev/docs/test-fixtures) describes isolated fixtures, setup/teardown ownership, and fixture timeouts.

## Assertions, timing, and geometry

Use awaited Playwright assertions for eventual DOM state. They retry until the condition is met or the assertion timeout expires. Prefer a controlled promise, event, or observable state transition to sleeping for a guessed duration. A timed wait is suitable when elapsed time is itself the contract, and the tested threshold and expected observation are explicit. Keep ordinary actions subject to Playwright's actionability checks; justify `force` or another bypass by the specific interaction the test models.

Test-scoped fixture setup and `beforeEach` share the test budget by default. A fixture configured with its own timeout uses a separate clock. Measure preparation before selecting that bound, keep navigation and readiness within the fixture's lifetime, and preserve the scenario's action budgets. A cold-start protocol keeps its first navigation in the scenario's fresh context and records any application preflight and its warming effect.

Record preparation, body, cleanup and total runner costs when collecting timing evidence. The reported test duration can exclude separately budgeted fixture work. The installed package version and runner budgets are recorded with the baseline inventory; read the lockfile and configuration for current values.

For map gestures, calculate expected placement or camera movement from the pre-action transform and the input actually delivered. Keep persisted/domain equality exact; apply a stated CSS-pixel tolerance only to browser-rendered geometry. Capture the baseline immediately before the interaction being asserted so an earlier action cannot satisfy the expectation.

Official guidance: [auto-retrying assertions](https://playwright.dev/docs/test-assertions), [actionability checks](https://playwright.dev/docs/actionability), and [timeouts](https://playwright.dev/docs/test-timeouts).

## Current runner and commands

`playwright.config.ts` defines `pure`, `development-storage`, and `browser` projects. The package lock and CI workflow pin and check the runner version. Read those files before relying on a command's server or project behavior.

| Selection | Current behavior |
| --- | --- |
| `npm test` | Selects all three projects. The configured Nuxt development server starts locally unless `PLAYWRIGHT_BASE_URL`, a selected browser-only Preview, or an explicit pure-only CLI project selection suppresses it. |
| `npm run test:pure` | Runs only the `pure` project. It starts no Nuxt server, does not launch the browser project, and does not require an external base URL or Preview authentication. Pass focused Playwright arguments after `--`, for example `npm run test:pure -- --grep "route placement"`. |
| `npm test -- tests/workspace-codec.spec.ts --project=pure` | With the default `all` suite, selects the file in the pure project and starts no Nuxt server. Put positional test paths before `--project`; the CLI filter does not remove inherited environment values. |
| `PLAYWRIGHT_SUITE=checks npm test` | Selects `pure` and the one `development-storage` case. The global web server still starts because the storage project uses the local app. This is not a no-server pure-only command. |
| `PLAYWRIGHT_SUITE=browser npm test` | Selects the browser project. It uses the local development app by default. A validated `PLAYWRIGHT_PRODUCTION_URL` selects that URL for the browser project and suppresses the local server when this is the selected suite. |
| `npm run test:ui` | Selects the cases tagged `@ui-smoke`; this remains a Playwright selection, not a separate test implementation. |
| `npm run test:local -- tests/workspace-ui-smoke.spec.ts --project=browser` | Uses the local launcher for a focused browser run. It starts and owns a local server on `127.0.0.1:3100` (`LOCAL_TEST_PORT` overrides it), checks HTTP and hydrated-browser readiness, monitors verification inputs, writes a server log and run artifacts, and supports Enter-to-rerun in an interactive terminal. It refuses an occupied port. |

Pass Playwright file, project, or grep arguments after `npm test --`. For example, `npm test -- tests/workspace-recovery.spec.ts --project=pure development-storage` is mixed and keeps the local server because its storage case uses the app. Every explicitly selected project must be `pure` to suppress the server. `PLAYWRIGHT_BASE_URL` supplies an already-running app and disables the configured web server. `PLAYWRIGHT_PRODUCTION_URL` is for the validated Preview host used by the browser project; it does not make the `checks` project pure-only. For a combined `all` selection, the local server is still required by the non-browser projects.

The pure launcher removes inherited base URL, Preview URL, and Vercel bypass-secret variables before it starts Playwright. A direct CLI project filter changes server selection but leaves the environment intact; use `npm run test:pure` when those inputs must also be removed.

Choose the file and case that own the changed behavior before starting a local server. For a codec change, run `npm run test:pure -- tests/workspace-codec.spec.ts`. For a launch default or initial save change, exercise the public form and reload with `npm run test:local -- tests/workspace-launch.spec.ts --project=browser --grep "the product root creates and resumes"`. For a launch layout or focus change, select `keyboard focus remains visible on launch and recovery actions` in the same file. For editor footer reachability, use `npm run test:local -- tests/workspace-ui-smoke.spec.ts --project=browser --grep "footer actions fit and receive pointer hits"`. Shared runtime, fixture, or configuration changes can require broader qualification.

Browser tests use zero retries, retain a trace for each failed attempt, and capture a failure screenshot when the test has a live page. A trace is kept from the first failure, so a successful rerun is not needed to produce diagnostic evidence.

The local launcher opens a separate browser context and confirms the hydrated welcome form before the selected test starts. This warms the app and module caches, so do not treat its target test as first-cold evidence. HTTP readiness alone does not establish client readiness. The source monitor invalidates the run after an application input changes or HMR update, including a test process that exits successfully at the same time. It excludes only the root-relative `.codex/environments/` metadata subtree from input snapshots and watcher events; other `.codex` files, prefix-lookalike paths and unidentified events remain subject to the normal fail-closed checks. Tailwind source detection excludes that same metadata subtree.

For a multi-ticket feature, run focused checks for each slice and the relevant completed predecessors, then qualify the cumulative feature candidate with the full suite. A consequential shared change can require earlier broad validation. Use exact-candidate CI evidence when available instead of duplicating the full suite locally. After correcting a failure, rerun the affected checks locally and broaden only when the correction adds risk; CI remains conservative for runtime, test and configuration changes. Reuse successful evidence for unchanged source and relevant runtime conditions, and distinguish a fixed initial failure from a clean first run.

When a Preview URL or a nonempty bypass secret is configured, the runner scrubs Preview bypass headers and host-scoped Preview cookies from traces and retained artifacts before reports are published. It sanitizes the HTML report's embedded archive and copied attachments after reporters finish. Protected Preview runs support the `list`, `github`, and `html` reporters, plus JSON when its output file can be resolved. Unsupported reporters, JSON output to stdout, and report paths outside the repository are rejected before tests start. CI uploads a Playwright report only after the diagnostic gate has written a fresh completion marker; an incomplete required sanitation pass blocks the upload. Local and checks runs without either authentication input retain native artifact bytes; their marker records that Preview sanitation was not required.

The artifact protection covers files produced by those supported reporters. Keep Playwright debug logging disabled for protected Preview runs, and do not add a custom reporter that writes diagnostics without extending the sanitizer.

Protected JSON/HTML reports suppress inline attachment bodies, mark their names with `[inline body redacted]` and use `text/plain`. This avoids exposing payloads hidden by the reporters' different encodings. File-based attachment paths, traces and screenshots retain their existing sanitation behavior. Runs without Preview authentication inputs preserve native report and attachment bytes.

CI runs lint, typecheck, build and the `checks` selection, then runs the `browser` project in two one-worker shards with retries disabled. Same-repository pull requests use the Preview for the exact head revision; other CI runs use a local development server. Preview authentication is scoped to the browser project. Keep bypass credentials out of local and `checks` runs; a missing Preview or failed authentication must fail the applicable job without substituting another deployment or skipping browser coverage. CI keeps report artifacts separate by job and shard and uploads them only after the sanitation gate passes. See [`tests/fixtures.ts`](../../tests/fixtures.ts), [`tests/vercel-preview-auth.ts`](../../tests/vercel-preview-auth.ts), and [the CI workflow](../../.github/workflows/ci.yml) for the current implementation.

Official guidance for diagnostic modes is in the [trace option reference](https://playwright.dev/docs/api/class-testoptions#test-options-trace) and [Trace Viewer](https://playwright.dev/docs/trace-viewer). Inspect retained `trace.zip` files locally with `npm exec playwright show-trace path/to/trace.zip`. Keep the first failed run's trace and screenshot when recording a correction; do not use a successful rerun alone as evidence that a failure is fixed.

Nuxt typechecking excludes generated `test-results` and `playwright-report` output, matching the existing lint exclusions. Test source files under `tests` remain typechecked; keep reports separate from those sources.

## Map and editor regressions

Use `workspaceMapContextType` from [the shared helpers](../../tests/helpers.ts) to scope a locator to the active map. For Orbit creation and Inspector integration, exercise the real Add-controller path and its draft ownership through [main integration coverage](../../tests/workspace-history-main-integration.spec.ts).

Use the shared helpers for screen/SVG conversion and native mouse gestures. Derive expected map geometry from the pre-gesture transform and delivered input. Gesture observers belong to the helper that installs them and must be cleaned up if the gesture fails; a D3 release observer must listen at window capture before D3 consumes the event.

For cancellation during a held contact, assert both the cancelled state before release and the outcome of the eventual release. When suppression has a deadline, hold beyond that deadline so an expired guard cannot hide an activation, then verify that a fresh contact still works. Establish the requested mode independently before each action that can reset it.

When changing map placement or numerical admission, preserve the relevant regressions for [untouched-route independence and previews](../../tests/cluster-map-geometry.spec.ts), [saved-map restoration and identical-point saving](../../tests/unresolved-exit-layout.spec.ts), and [the public unresolved-exit move/confirm/export journey](../../tests/workspace-unresolved-exit-placement.spec.ts). Use [UI guidance](ui.md) when assessing editor-specific states.

## Verification workflow

Run focused checks for changed behavior during development. Keep one concise record with the candidate revision, command and scope, result, and report/artifact location. For layout work, use the development app and the affected desktop and compact states.

CI classifies the complete change before selecting checks. The documentation allowlist is defined in [verification inputs](../../scripts/verification-inputs.mjs); unknown paths and runtime, test, script or configuration changes require full qualification. Documentation checks validate local references across the maintained corpus, including references to deleted targets. Documentation paths are explicitly excluded from Tailwind source detection so their utility-class examples do not alter application CSS.

Full qualification runs lint, typecheck, a production build, pure tests and the local storage regression. A short browser smoke then exercises the maintained painted Search icon and deep Hierarchy journeys through `npm run test:preview-smoke`, before both full browser shards. These cases also remain in the full suite. Same-repository pull requests use a successful immutable Vercel Preview for the exact head SHA; forks, main pushes and manual runs use local development servers. One worker and zero retries remain the browser policy.

A documentation-only closure commit on a code-changing PR can reuse a full qualification only on same-repository synchronization, with an unchanged base, a documentation-only difference from the exact previous head, and a matching successful full-run artifact. Missing, expired, incomplete or mismatched evidence selects full qualification. Reused runs do not issue another full-run artifact, so a second consecutive documentation push may need a full run. Manual dispatch forces full qualification. The unchanged required `quality (1.64.0)` gate validates the explicit documentation, full or verified-reuse result matrix; unexpected skips and failed checks cannot produce success.

Playwright clears its native output before global setup, so the repository configuration validates destinations once before that cleanup and shares the validated invocation with its workers. Ordinary runs reserve a unique `test-results/playwright-<timestamp>-<pid>-<random>/` root with sibling `artifacts/`, `html/` and `results.json` locations. The default reporter remains `list`; JSON is opt-in through its destination settings or a JSON reporter selection. Native/HTML directories containing retained data, existing report files, symbolic-link components, filesystem/workspace roots or ancestors, and overlapping artifact/report destinations are rejected. An invocation receipt outside the cleared directories keeps coordinator and worker paths consistent; it is not reusable by a later independent command. Use new destinations for each execution and keep retained evidence, logs and control scripts outside the directories that execution owns.

For direct commands, put `--output` and `--last-failed-file`, when needed, in an initial option prefix before test filters and other flags; pair and `=value` forms are supported. Reserved ownership options elsewhere are rejected, including apparent filter values or tokens after `--`, rather than guessing how Playwright will parse them. CLI `--output` takes precedence over `PLAYWRIGHT_OUTPUT_DIR`; explicit destinations are exclusively owned by that invocation, so concurrent callers must choose different paths. JSON precedence is `PLAYWRIGHT_JSON_OUTPUT_FILE`, then `PLAYWRIGHT_JSON_OUTPUT_DIR` plus `PLAYWRIGHT_JSON_OUTPUT_NAME`; NAME alone is relative to the working directory. HTML uses `PLAYWRIGHT_HTML_OUTPUT_DIR` before `PLAYWRIGHT_HTML_REPORT`, otherwise the unique default above. Protected Preview runs retain their additional repository-owned-path and supported-reporter restrictions.

Native last-run metadata defaults to `artifacts/.last-run.json` within the owned output. Explicit `--last-failed-file` or `PLAYWRIGHT_LAST_RUN_OUTPUT_FILE` targets also require fresh, non-colliding paths. Reading a retained last-run file and rewriting it in place is incompatible with evidence preservation; use focused file/grep selection unless a separate read-old/write-new workflow is implemented.

Set `PLAYWRIGHT_JSON_OUTPUT_FILE` explicitly when automation needs a predictable report path. JSON reporter selection, including `--list --reporter=json`, writes a file rather than relying on stdout.

The local launcher owns `local-test-<timestamp>-<pid>-<random>/playwright-run-N/` roots with the same sibling layout. It rejects caller output, last-run or alternate-config overrides (`--output`, `--last-failed-file`, `--config`/`-c`), including packed short config forms, before startup. It replaces inherited output/reporter destinations, last-run and invocation state with that run's ownership. Its invalidation record is outside `artifacts/`. Server logs remain at session level.

In an interactive session, wait for the prompt before editing. Enter explicitly repeats the same selection on the owned server after checking current source and confirming HTTP and hydrated-browser readiness in a fresh context. Compatible idle edits include ordinary application source, CSS and test sources under the launcher's allowlist. Configuration, environment files, package metadata, scripts, unrecognized inputs and structural directory changes require a fresh session. Stop the session before installing dependencies or running generation, typecheck or build.

An edit or HMR update during preparation or an active run invalidates that verification attempt. This includes a restored edit and a Playwright child that exits successfully. If an invalidation record exists, the report alongside it is evidence for diagnosis. A later successful Enter creates fresh evidence and leaves the earlier result as recorded. If preparation rejects a compatible change, wait for inputs to settle before pressing Enter again. Start an independent server and browser context for strict cold-start evidence.

The existing sanitation marker describes the latest completed run's output paths. Bind a retained marker to the corresponding run/report when recording evidence; it is not a concurrent multi-run upload authorization. CI jobs/shards use separate workspaces and their existing `test-results/` upload includes the nested reports. Per-run output ownership does not relax sanitation or first-attempt diagnostic requirements.

Freeze source before integrated checks. Keep Nuxt generation, typecheck, and build idle while browser journeys run; generated files and HMR can invalidate an active browser run. Run the full suite once on the integrated candidate. After a correction, rerun affected checks and broaden only when the correction adds risk. Reuse successful evidence for unchanged source and report first-run failures separately from clean first runs.

Viewport emulation checks responsive layout and browser interactions; it does not certify physical keyboard behavior, operating-system keyboards, screen-reader output, or device-specific input. Record that boundary when it matters to the change.

## Review and mechanical enforcement

For each changed test, a reviewer should be able to identify its behavioral obligation, why its boundary is needed, the state it owns, and the assertion that would fail on regression. Check that setup establishes the mode, selection, pending gesture, current-versus-backup distinction, or redo branch named by the case. Check observers outside best-effort production callbacks and compare results with the immediate pre-action state.

The existing ESLint configuration checks JavaScript, TypeScript, and Vue correctness but does not define a test-quality rule set. No new blanket rule is appropriate here: bans on timers, CSS, positional locators, or actionability options cannot distinguish a fragile shortcut from a deliberate time/geometry/native-input contract. Deduplication, the need for a browser boundary, and whether an assertion proves the named behavior require review of behavior and preconditions. Add a narrow automated rule only when it can reject a demonstrated invalid pattern and allow a justified positive example; the inventory and review criteria remain the enforcement for those judgments.
