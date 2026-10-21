# Ticket24 Add and route targeting follow-up — 2026-10-21

## Baseline and scope

Fresh `origin/codex/interface-revamp` equals HEAD `b4258cf73865015c886f60b2ba077aafe9522267`; `origin/main` remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only/48 feature-only). Preserve the feature baseline and historical untracked artifacts. Issue3 is refreshed: open, no comments, enhancement/priority:P1. No successor, source-issue closure or merge.

The human reports that Add leaves an ordinary mode highlighted, and map route targeting offers a separate system picker beside global From/To lists instead of a natural two-system flow. Ticket24 is reopened for these bounded UX/state corrections. Its earlier135/135 pass remains true for its earlier tests and source; it did not cover these new symptoms.

Use project-development's Complex route for the cross-component UI/session contract, without changing domain validators, persistence, schema or publication. SOL6.1 High provides the scoped architecture and independent review; Luna XHIGH owns implementation. The coordinator owns runtime, documentation and Git. No parallel writers or broad test/review expansion.

## Contract

- Active Add is exclusive in the Dock's visual and accessible pressed states. Keep its remembered ordinary mode internally for exit; opening the chooser alone does not arm Add.
- Keep exactly one From and one To USelect. After a map hit, scope the corresponding selector to logical Jump Points in the hit system(s). No third picker. Before map scoping, global form choices preserve the keyboard-only path.
- Retain existing origin/destination stage. Zero eligible points refuse without changing draft/stage/scope. One eligible point chooses immediately; multiple points wait for an explicit named choice in the corresponding field. Only a valid origin advances to destination.
- Retain independent transient endpoint system-ID scopes, including overlapping hits, through other edits/hide/reflow. Source/destination reset choices clear only their own value/scope and target that endpoint for the next map click. A source change preserves destination unless identical to the chosen source. Explicit reset affordances are a routine implementation assumption, not a new domain decision.
- Accepted destination-system targeting selects a known destination; an invalid hit preserves an external-exit draft. Map targeting never applies a route. Existing reset/quit/guard/session-generation/save behavior remains authoritative.

## Feedback loop and ownership

Luna first owns only `tests/workspace-add-route-targeting.spec.ts`. On the unchanged compiled baseline, the first test reproduces Move remaining `aria-pressed=true` during Add. Initial route setup incorrectly uses pre-import IDs; independent imports remap them. Correct only setup to visible exact system labels and live exported endpoint identities. The corrected route-only RED reproduces the duplicate picker (expected0, received1) after a real map click.

The exact symptom is deterministic at the public product seam, so speculative instrumentation/bisection and ranked alternative theories are unnecessary here: the inspected Dock binding and duplicate form control directly explain the two RED results. Original test deadlines, ordinary hit testing and zero retries remain unchanged.

Implementation ownership is `WorkspaceDock.vue`, `JumpRouteInspector.vue`, `useRouteInspectorSession.ts`, the new spec and only necessary existing route-staging expectations. Keep publication/validators/shared helpers unchanged. Coordinator executes typecheck/build, the new regressions and relevant existing route/mode preservation cases. Independent review examines only this delta. No fresh complete-suite success will be inferred from focused passes.

Raw evidence is local host TEMP `C:/Users/fbal-fontaine/AppData/Local/Temp/ticket23-ticket24-targeting-20261021`. Baseline compiled entry hash is `2441DA8E168741B5BF16B27CE66E7056D6499DB6CA6A69C2FF150106D377DCA1`, served by owned PID19056 on3180. Implementation and final verification are pending.

## Verification and resolution

The first independent review catches scopes being cleared after named/unique selections. Luna retains them until explicit reset/valid retarget and extends the existing regression to inspect both dropdowns after selection and a Jump level edit. Typecheck passes and the first production build passes. The first focused invocation gives12 passed/2 failed: an absent-status negative assertion is a test preparation issue; Escape on a USelect is a genuine popup-priority defect. Its global handler also quits Add, so the following system click incorrectly navigates away. Specification section4 requires higher-layer dismissal not to mutate the map below.

The correction is one guard in `BaselinePage.handleAddEscape`: yield to an open Nuxt UI/Reka listbox, leaving normal map Escape and modal handling unchanged. Installed Reka2.10.5 source confirms the queried role/state. The test retains Escape and now explicitly checks Add and its origin survive; it does not evade the defect. A missing test-local locator is caught by independent review/typecheck before building, then declared in its own case. Final bounded review has no remaining blocker. Existing route/publication/validation behavior is unchanged.

Final candidate `ticket24-add-targeting-ready-20261021` passes typecheck and the production build (1m45s), then **14/14** focused public tests in91.748 seconds: three new regressions, four existing route cases and seven existing system-creation cases. Zero failures/skips/flaky cases/retries, one worker, original30-second deadlines. The same14-case invocation is replayed after the actual correction; passing outcomes are not aggregated from different candidates. No complete-suite rerun is performed for this bounded follow-up; the earlier135/135 remains attributed only to baseline `b4258cf7`.

Two final compiled views are exercised and inspected:1440×900/light desktop and390×844/dark portrait with Chromium touch emulation. Both use actual map selection of Vesper Prime then Harrow and retain the expected logical From/To endpoints. Ordinary modes are unpressed while Add is pressed, no third picker exists, footer actions pass ordinary hit testing, and no page errors occur. The mobile journey hides the Inspector, performs two real emulated taps for unique endpoints, then reopens the same route draft. The desktop view retains the bottom Dock/full map/overlay composition; the compact Inspector remains fullscreen. Physical Android, OS keyboard and safe-area behavior are not certified by these checks.

All114 source/test/config hashes and the compiled entry/four CSS hashes remain unchanged after tests/captures. Owned compiled PID28956 is stopped and3180 verified free before documentation edits. Raw candidate identities, both failed-attempt logs, type/build logs, Playwright traces and the two selected PNGs remain in the host-TEMP directory above; no disposable artifact tree is committed.

Ticket24 returns to closed/unassigned. Tickets25,26,28 remain open/unclaimed,27 remains blocked by26 and29 remains last with the final whole-interface Astra review, including Tools coherence. No successor, source-issue closure, merge or PR-ready transition is performed. Historical untracked work is preserved.
