# Verification guidance

Use the scripts in [`package.json`](../../package.json) as the command reference and Playwright as the maintained test runner. Select checks by changed behavior:

| Change | Completion evidence |
| --- | --- |
| Documentation or instructions | Valid links, existing navigation targets and configuration parsing where relevant. |
| Presentation only | Affected desktop/compact states and useful UI checks on development; a production build is not required solely for styling. |
| Behavior | Lint, typecheck and affected scenarios, including relevant failure paths. |
| Dependencies, integration, SSR or bundling | Lint, typecheck, production build and one complete suite on the integrated candidate. CI may supply these results. |

Test behavior at the narrowest useful seam. Pure geometry, placement, and validation functions are good candidates for focused deterministic tests. Store and controller tests should exercise their real actions and observable state transitions, including guards, cancellation, or stale-context handling when relevant. Public browser journeys should continue to cover user-visible preservation and recovery behavior. A Pinia test that uses `@pinia/testing` must account for its default action stubbing; a test that only sees an action stubbed is not evidence that the workflow ran. Pinia's [testing guide](https://pinia.vuejs.org/cookbook/testing.html) documents that behavior. A new store alone does not require a second runner.

During development, run focused checks for the changed behavior and use the development server for local layout checks. Keep one concise check record with the candidate revision, command/scope, result and report location. Freeze the source for integrated checks, and schedule Nuxt preparation, typecheck and build while browser journeys are idle: generated files and HMR can invalidate a running browser journey.

For one integrated delivery, run the full suite once. After correcting a failure, rerun the affected checks and broaden validation only when the correction adds risk. Reuse successful evidence for unchanged source and relevant runtime conditions, and distinguish a fixed initial failure from a clean first run.

Report only evidence actually collected. Browser viewport emulation can verify responsive layout and browser interactions, but it does not certify physical keyboard behavior, operating-system keyboards, screen-reader output, or device-specific input. Record those boundaries when they matter to the change. Follow [the UI guide](ui.md) for editor-specific states and review considerations.

## Map-input and placement regressions

Reuse [the shared test helpers](../../tests/helpers.ts) for SVG/screen conversion and native mouse gestures. Derive expected geometry from the pre-gesture transform and the delivered input, with an explicit CSS-pixel accuracy check. Keep domain expectations such as radius ratios, attachment and occupant angles in the scenario. Native event observers belong to the helper that installs them, including cleanup when the gesture fails; D3 release observation must run at window capture before D3 consumes the event.

When changing placement or numerical admission, select the relevant existing regressions for [untouched-route independence and previews](../../tests/cluster-map-geometry.spec.ts), [saved-map restoration and identical-point saving](../../tests/unresolved-exit-layout.spec.ts), and [the public move/confirm/export journey](../../tests/workspace-unresolved-exit-placement.spec.ts). Use these invariants when assessing a fallback or a changed support boundary.

## Playwright suites

`npm test` runs the complete local suite by default. `PLAYWRIGHT_SUITE=checks` selects pure checks and the single local IndexedDB regression tagged `@development-storage`; `PLAYWRIGHT_SUITE=browser` selects public browser journeys; `PLAYWRIGHT_SUITE=all` selects all three projects. Tests tagged `@pure` run without a browser context, local server, or preview authentication. Keep local IndexedDB behavior in the `development-storage` project with the `@development-storage` tag.

The browser project uses the local development server unless `PLAYWRIGHT_PRODUCTION_URL` points to a validated immutable Vercel Preview. A browser-only run against that URL does not start the local server. The URL must use the repository's protected `ttrpg-cluster-control-<deployment>-submoon.vercel.app` hostname; branch aliases and arbitrary hosts are rejected by the shared preview URL validator. `PLAYWRIGHT_BASE_URL` remains available for an explicitly supplied base URL and suppresses the local server.

Protected Preview authentication is limited to the `browser` project when `PLAYWRIGHT_PRODUCTION_URL` is configured. Supply `VERCEL_AUTOMATION_BYPASS_SECRET` only to that Preview browser job. The runner exchanges it for a host-scoped cookie without following redirects, keeps the cookie in memory, and applies it to that preview's browser context. Local and `checks` runs do not require the secret or create the authentication request context.

## CI and shared preparation

CI runs lint, typecheck, a production build, pure tests and the local storage regression in `checks`. For same-repository pull requests, it resolves a successful Vercel deployment for the exact PR head SHA while checks run. Two browser shards then test that immutable preview, each with one worker and no retries. Fork pull requests, main pushes and manual runs use local development servers for both shards. The final `quality (1.64.0)` gate requires all applicable jobs to succeed. Each job uploads its own report.

Configure Vercel's Protection Bypass for Automation and store its value as the GitHub Actions repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Keep preview protection enabled. Missing credentials, a missing exact-commit deployment or failed authentication fail the run; they do not select a different deployment or skip browser coverage.

The three baseline campaign route scenarios use `campaignTest` with `campaignPreparation: 'prepared-snapshot'`. The worker imports the campaign through the public UI once and waits for persistence, then keeps an IndexedDB storage snapshot in memory. Each scenario receives a cloned snapshot in a fresh context and restores its own map view. Dedicated import/creation journeys and scenarios modifying the fixture keep explicit public-UI preparation. Do not share live pages, contexts or mutable workspace state between tests.
