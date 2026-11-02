# Verification guidance

Use the scripts in [`package.json`](../../package.json) as the command reference and Playwright as the maintained test runner. Select checks by changed behavior:

| Change | Completion evidence |
| --- | --- |
| Documentation or instructions | Valid links, existing navigation targets and configuration parsing where relevant. |
| Presentation only | Affected desktop/compact states and useful UI checks on development; a production build is not required solely for styling. |
| Behavior | Lint, typecheck and affected scenarios, including relevant failure paths. |
| Dependencies, integration, SSR or bundling | Lint, typecheck, production build and one complete suite on the integrated candidate. CI may supply these results. |

Test behavior at the narrowest useful seam. Pure geometry, placement, and validation functions are good candidates for focused deterministic tests. Store and controller tests should exercise their real actions and observable state transitions, including guards, cancellation, or stale-context handling when relevant. Public browser journeys should continue to cover user-visible preservation and recovery behavior. A Pinia test that uses `@pinia/testing` must account for its default action stubbing; a test that only sees an action stubbed is not evidence that the workflow ran. Pinia's [testing guide](https://pinia.vuejs.org/cookbook/testing.html) documents that behavior. A new store alone does not require a second runner.

During development, use the owned local launcher below for focused browser/layout checks. Keep one concise check record with the candidate revision, command/scope, result and report location. Parallel writers may edit disjoint files, while browser verification uses a frozen runtime input set: shared CSS/HMR can affect another component's journey. Schedule Nuxt preparation, typecheck and build while browser journeys are idle. A run interrupted by source changes needs a fresh verification run; it is not product-failure evidence.

For a multi-ticket feature, run focused checks for each slice and the relevant completed predecessors, then qualify the cumulative feature candidate with the full suite. A consequential shared change can require earlier broad validation. Use exact-candidate CI evidence when available instead of duplicating the full suite locally. After correcting a failure, rerun the affected checks locally and broaden only when the correction adds risk; CI remains conservative for runtime, test and configuration changes. Reuse successful evidence for unchanged source and relevant runtime conditions, and distinguish a fixed initial failure from a clean first run.

Report only evidence actually collected. Browser viewport emulation can verify responsive layout and browser interactions, but it does not certify physical keyboard behavior, operating-system keyboards, screen-reader output, or device-specific input. Record those boundaries when they matter to the change. Follow [the UI guide](ui.md) for editor-specific states and review considerations.

## Map-input and placement regressions

Use `workspaceMapContextType` in [the shared UI helpers](../../tests/helpers.ts) to locate the current map type. For Orbit creation and Inspector integration, [the main-integration scenarios](../../tests/workspace-history-main-integration.spec.ts) create data through the real Add controller and retain an explicit property-order regression; reuse that path rather than copying its output record shape.

Reuse [the shared test helpers](../../tests/helpers.ts) for SVG/screen conversion and native mouse gestures. Derive expected geometry from the pre-gesture transform and the delivered input, with an explicit CSS-pixel accuracy check. Keep domain expectations such as radius ratios, attachment and occupant angles in the scenario. Native event observers belong to the helper that installs them, including cleanup when the gesture fails; D3 release observation must run at window capture before D3 consumes the event.

When changing placement or numerical admission, select the relevant existing regressions for [untouched-route independence and previews](../../tests/cluster-map-geometry.spec.ts), [saved-map restoration and identical-point saving](../../tests/unresolved-exit-layout.spec.ts), and [the public move/confirm/export journey](../../tests/workspace-unresolved-exit-placement.spec.ts). Use these invariants when assessing a fallback or a changed support boundary.

## Playwright suites

For repeated local browser checks, use `npm run test:local -- tests/workspace-history-buttons.spec.ts --project=browser --grep "Back stays to the left"`. The launcher owns one loopback server on port 3100 (`LOCAL_TEST_PORT` overrides it), refuses an occupied port, and keeps it alive between interactive runs: press Enter to repeat the selection or `q` to stop. Noninteractive execution runs once and cleans up. Each run receives separate artifacts and a JSON report; the launcher prints its server-log path.

Browser warmup establishes the hydrated welcome screen and usable cluster-name field in a fresh context before an individual test's deadline begins. HTTP availability alone does not establish client readiness. The launcher retains a browser probe and monitors verification inputs: an edit or HMR update during qualification invalidates the run, including a concurrent zero test exit. Resolve the change and rerun the focused selection. Explicit pure-only project selection avoids the server and browser warmup; keep positional test paths before `--project=pure`.

`npm test` runs the complete local suite by default. `PLAYWRIGHT_SUITE=checks` selects pure checks and the single local IndexedDB regression tagged `@development-storage`; `PLAYWRIGHT_SUITE=browser` selects public browser journeys; `PLAYWRIGHT_SUITE=all` selects all three projects. Tests tagged `@pure` run without a browser context, local server, or preview authentication. Keep local IndexedDB behavior in the `development-storage` project with the `@development-storage` tag.

The browser project uses the local development server unless `PLAYWRIGHT_PRODUCTION_URL` points to a validated immutable Vercel Preview. A browser-only run against that URL does not start the local server. The URL must use the repository's protected `ttrpg-cluster-control-<deployment>-submoon.vercel.app` hostname; branch aliases and arbitrary hosts are rejected by the shared preview URL validator. `PLAYWRIGHT_BASE_URL` remains available for an explicitly supplied base URL and suppresses the local server.

Protected Preview authentication is limited to the `browser` project when `PLAYWRIGHT_PRODUCTION_URL` is configured. Supply `VERCEL_AUTOMATION_BYPASS_SECRET` only to that Preview browser job. The runner exchanges it for a host-scoped cookie without following redirects, keeps the cookie in memory, and applies it to that preview's browser context. Local and `checks` runs do not require the secret or create the authentication request context.

## CI and shared preparation

CI classifies the complete change before selecting checks. The documentation allowlist is defined in [verification inputs](../../scripts/verification-inputs.mjs); unknown paths and runtime, test, script or configuration changes require full qualification. Documentation checks validate local references across the maintained corpus, including references to deleted targets. Documentation paths are explicitly excluded from Tailwind source detection so their utility-class examples do not alter application CSS.

Full qualification runs lint, typecheck, a production build, pure tests and the local storage regression. A short browser smoke then exercises the maintained painted Search icon and deep Hierarchy journeys through `npm run test:preview-smoke`, before both full browser shards. These cases also remain in the full suite. Same-repository pull requests use a successful immutable Vercel Preview for the exact head SHA; forks, main pushes and manual runs use local development servers. One worker and zero retries remain the browser policy.

A documentation-only closure commit on a code-changing PR can reuse a full qualification only on same-repository synchronization, with an unchanged base, a documentation-only difference from the exact previous head, and a matching successful full-run artifact. Missing, expired, incomplete or mismatched evidence selects full qualification. Reused runs do not issue another full-run artifact, so a second consecutive documentation push may need a full run. Manual dispatch forces full qualification. The unchanged required `quality (1.64.0)` gate validates the explicit documentation, full or verified-reuse result matrix; unexpected skips and failed checks cannot produce success.

Configure Vercel's Protection Bypass for Automation and store its value as the GitHub Actions repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Keep preview protection enabled. Missing credentials, a missing exact-commit deployment or failed authentication fail the run; they do not select a different deployment or skip browser coverage.

The three baseline campaign route scenarios use `campaignTest` with `campaignPreparation: 'prepared-snapshot'`. The worker imports the campaign through the public UI once and waits for persistence, then keeps an IndexedDB storage snapshot in memory. Each scenario receives a cloned snapshot in a fresh context and restores its own map view. Dedicated import/creation journeys and scenarios modifying the fixture keep explicit public-UI preparation. Do not share live pages, contexts or mutable workspace state between tests.
