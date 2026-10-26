# Verification guidance

Use the scripts in [`package.json`](../../package.json) as the command reference and Playwright as the maintained test runner. Select checks by changed behavior:

| Change | Completion evidence |
| --- | --- |
| Documentation or instructions | Valid links, existing navigation targets and configuration parsing where relevant. |
| Presentation only | Affected desktop/compact states and useful UI checks on development; a production build is not required solely for styling. |
| Behavior | Lint, typecheck and affected scenarios, including relevant failure paths. |
| Dependencies, integration, SSR or bundling | Lint, typecheck, production build and one complete suite on the integrated candidate. CI may supply these results. |

Test behavior at the narrowest useful seam. Pure geometry, placement, and validation functions are good candidates for focused deterministic tests. Store and controller tests should exercise their real actions and observable state transitions, including guards, cancellation, or stale-context handling when relevant. Public browser journeys should continue to cover user-visible preservation and recovery behavior. A Pinia test that uses `@pinia/testing` must account for its default action stubbing; a test that only sees an action stubbed is not evidence that the workflow ran. Pinia's [testing guide](https://pinia.vuejs.org/cookbook/testing.html) documents that behavior. A new store alone does not require a second runner.

During development, run focused checks for the changed behavior and use the development server for local layout checks. For one integrated delivery, run the full suite once. After correcting a failure, rerun the affected checks and broaden validation only when the correction adds risk. Reuse successful evidence for unchanged code on the same candidate, and distinguish a fixed initial failure from a clean first run.

Report only evidence actually collected. Browser viewport emulation can verify responsive layout and browser interactions, but it does not certify physical keyboard behavior, operating-system keyboards, screen-reader output, or device-specific input. Record those boundaries when they matter to the change. Follow [the UI guide](ui.md) for editor-specific states and review considerations.
