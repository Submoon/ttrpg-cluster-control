# Ticket 18 implementation evidence

## Source and scope

Implementation began from `3c660a6a2df6c37f392c998c36d72cec1ddbf938` on 2026-10-16. The retained-baseline capture ran against that source before routing changed. The implementation changes the product entry, tightens the bounded Playwright development-server startup allowance, and adds browser-level launch/recovery coverage. `BaselinePage` remains the only owner of `useLocalWorkspace`; no storage, codec, schema, or recovery-composable code changed.

## Retained baseline and red/green result

Before editing the route, a fresh isolated headless Chromium context used `/?variant=baseline` at 1440×900. It created **Kestrel Reach / Vesper**, observed `Saved on this device`, reloaded, and opened the saved Jump Cluster map. The run record is [retained-baseline.json](artifacts/retained-baseline.json), with [welcome](artifacts/baseline-welcome-1440x900.png), [created workspace](artifacts/baseline-created-1440x900.png), and [reloaded map](artifacts/baseline-reloaded-1440x900.png) captures.

The new literal-root test first failed on the disposable prototype: `getByRole('heading', {name: 'Give the unknown a name.'})` was absent at `/`. After the route change and a bounded wait for IndexedDB hydration, the test passed creation, durable save, reload, and map reopening. The original baseline alias and explicit A/B/C prototype variants remain available; absent and unrecognized variants now open the persisted workspace.

## Recovery coverage

The focused Playwright run passed **8/8** tests across `workspace-launch.spec.ts` and `workspace-recovery.spec.ts` in 44.4 seconds with one worker against the warm Nuxt development server on `127.0.0.1:3100`. It includes the existing invalid-current, backup, atomic-save, import-validation, and successful-restore regressions, plus:

- a transient IndexedDB open failure that keeps the editor unavailable, then succeeds through **Try again** and creates a saved workspace;
- an aborted UI-driven backup replacement that holds terminal event delivery at the browser storage boundary, observes the loading state with no map or editor, then verifies the damaged current record and valid backup are unchanged before a successful restore and reload.

The failed-restore test uses a scoped test-context IndexedDB prototype override. It adds no application API and restores the methods during cleanup.

## Compiled-QA accessibility correction

Compiled QA against candidate `591745b8` found low-contrast boundaries on the two welcome inputs (1.917:1) and recovery buttons (2.977:1 and 2.988:1), plus a clipped focus outline at 844×390. The captured recovery action ended at `bottom=390.016` with a 2px outline and 3px offset, clipping about 5px of its focus indicator.

The focused Playwright regression uses a real created workspace and valid backup, damages the current record, reloads into recovery, follows the QA focus path, and asserts the complete outline remains inside the viewport. It failed against the old compiled candidate `591745b8` before the source correction.

The bounded correction is local to `WorkspaceWelcome.vue`: welcome inputs and recovery buttons use `--text-quiet` for their control borders, all three launch actions share a 0.75rem scroll margin, and the recovery panel uses 1rem block padding at viewport heights up to 450px. The retained native workspace-creation form remains the validated launch UI. This adds no new control primitive, global palette rule, application hook, or theme engine; broader Nuxt UI surface work remains with later tickets.

## Creation-action focus follow-up

A stricter full-outline check on compiled candidate `5018fe9a` passed the strengthened control borders and recovery focus, then found the creation submit action clipped at 844×390: its bottom was 389.609px with a 5px focus-ring extent and the page at `scrollY=18`. An isolated browser exploration showed that adding a 0.75rem scroll margin to the creation button moved the page to `scrollY=30`, leaving the button bottom at 377.609px and its full outline within the viewport at 382.609px. This required no coordinate tweak or additional spacing compaction.

`WorkspaceWelcome.vue` now applies the same semantic `.launch-action` scroll-margin class to Create, Try again, and Restore. The focused Playwright test checks the full outline and center hit target on Create before submit, then on Restore after the real damaged-current/valid-backup recovery setup. The test uses the same focus→Tab→Shift+Tab path as compiled QA. Refreshed `npm run typecheck` passes. Fresh compiled verification of this shared class and expanded test is pending.

## Validation and runtime limits

`npm run typecheck` passes. `npm test -- --list` passes and discovers 44 tests in 8 files.

The first standard focused test command did not reach Playwright because the configured `webServer.timeout` was 120 seconds. Two manual Nuxt starts reported ready after 4m08s and 3m49s; their Nuxt bundle phases were 3m54s and 3m28s, respectively. `playwright.config.ts` now permits up to 300 seconds for server startup; assertion timeouts remain unchanged. The 8-test behavioral batch used a temporary no-webServer config with the already-running server to avoid another cold start; that temporary config was removed after the run. A full standard `npm test` rerun after the timeout adjustment was not performed here.

The initial compiled QA run found the accessibility defects described above. The next compiled candidate `5018fe9a` passed the corrected contrast and recovery-focus checks but exposed the creation-action focus edge described above. Final compiled SSR/hydration and short-viewport focus evidence after the shared-action correction remain pending. This report does not claim those final gates, the light-theme work owned by ticket 19, or a physical Android Chrome check.

## Initial frozen source snapshot before compiled-QA correction

SHA-256 at handoff:

| File | SHA-256 |
| --- | --- |
| `pages/index.vue` | `f918e80a5fd3e3c79eca7c6f5319461bd006a2361a12444518f9c9399bf9de5c` |
| `playwright.config.ts` | `892f7a764e29df098fcf271d3ab3dcf5ec5109db2e4558e8f4943cc4c4576cab` |
| `tests/workspace-launch.spec.ts` | `f3318697f8e2af3700f3497d037c021d330724cc04490105bb785f9615011e17` |
| `tests/workspace-recovery.spec.ts` | `c154727296222dd8f6fbd9072c7a430c5a4563d0ead1f845805aac3f6619f9ee` |

## Source hashes after initial accessibility correction, before creation-focus follow-up

SHA-256 after the scoped accessibility correction and focused test addition:

| File | SHA-256 |
| --- | --- |
| `components/WorkspaceWelcome.vue` | `17622d9f1106e96e3f49ac396d9151b44d8a55d75f4e9d34995367d7be383378` |
| `pages/index.vue` | `f918e80a5fd3e3c79eca7c6f5319461bd006a2361a12444518f9c9399bf9de5c` |
| `playwright.config.ts` | `892f7a764e29df098fcf271d3ab3dcf5ec5109db2e4558e8f4943cc4c4576cab` |
| `tests/workspace-launch.spec.ts` | `3b63d81db36ac745941d9e500027751096c053955c729294009c78fab719a806` |
| `tests/workspace-recovery.spec.ts` | `c154727296222dd8f6fbd9072c7a430c5a4563d0ead1f845805aac3f6619f9ee` |

## Current source hashes after creation-focus follow-up

SHA-256 after sharing the launch-action scroll margin and extending the focus regression:

| File | SHA-256 |
| --- | --- |
| `components/WorkspaceWelcome.vue` | `c6bb0ca07460fa3bb57a3fe8feb8d2422bea8af5c781d0cc777f7a246eacd21e` |
| `pages/index.vue` | `f918e80a5fd3e3c79eca7c6f5319461bd006a2361a12444518f9c9399bf9de5c` |
| `playwright.config.ts` | `892f7a764e29df098fcf271d3ab3dcf5ec5109db2e4558e8f4943cc4c4576cab` |
| `tests/workspace-launch.spec.ts` | `46583520032ce0c649af868179cffa0f7244c0828cbb9e5fac6fc2cdcddc51c6` |
| `tests/workspace-recovery.spec.ts` | `c154727296222dd8f6fbd9072c7a430c5a4563d0ead1f845805aac3f6619f9ee` |
