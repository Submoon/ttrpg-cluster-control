# Dock feedback reproduction and acceptance

This artifact records the real-UI reproduction and the final local acceptance run for the Dock creation flow. The prototype source was based on `origin/codex/interface-revamp` at `f886b8a9781d02eab651e52d5a1e4e4c0d9f6b88`; the separately fetched `origin/main` baseline was `629d2a98715c3a16b954e0f77c639b1f0c31212c`.

## Baseline failure

The original red run used a fresh Playwright Chrome context at 1440 × 900 and ordinary mouse clicks on two separated, hit-tested points on `orbit-vela-three`, after Fit and two Zoom in actions. It created both objects at `{x: 879.79, y: 350.54}`. The requested target points were `{x: 707.70, y: 169.63}` and `{x: 769.70, y: 436.32}`; the placement errors were 249.69 and 139.56 SVG scene units. The baseline assertions failed with no page errors.

The Add trigger was also detached from its catalogue: the trigger began near `(847.7, 835.0)`, while the catalogue began near `(16, 156.8)`, with a 438 px vertical gap and no horizontal overlap. The canvas emitted an Orbit ID without the click angle, and the workbench placed every new Orbit object at the fixed angle `Math.PI / 5`.

The untouched red evidence is `before/qa-before.json`, `before/dock-feedback-before-1440x900.png`, and `before/dock-picker-before-1440x900.png`.

## Earlier production acceptance (pre-layering)

The acceptance harness is `../../qa-dock-feedback.mjs`. It uses fresh browser contexts and visible UI input to check the Dock default, Add action selection, trigger/Escape/outside dismissal, persistent Add type, picker anchorage, the map command row, mobile Add status bounds and hit targets, and object placement on both the rotated free-center Orbit and a hosted Orbit. It also opens the Groups URL reference once at desktop size. The Groups capture verifies that the URL reference still selects that layout; it does not claim Groups mobile HUD coverage.

The earlier production run is in `after/final/qa-report.json`, with per-viewport JSON and screenshots alongside it. Chrome 155.0.8059.41 reported no page errors. At each tested viewport—1440 × 900, 390 × 844, and 844 × 390—the Dock loaded by default, the chooser remained anchored to its Add trigger, Add status and Quit/Change controls stayed visible and hit-testable, Hierarchy/Inspect/Map files shared the map HUD row, and two successive placements landed at distinct requested Orbit positions. Across the free-center and hosted Orbit checks, the largest measured scene-space placement error was 1.443 units against the 1.5-unit acceptance bound. Same-type Add remained armed after placement.

This run remains evidence for placement geometry and the interactions listed above. A later visual review found that the picker content could sit under the HUD and a stale Add-cancellation toast in landscape, so its screenshots do not verify final picker layering. The reviewed layer and toast corrections are covered by the separate final development run below.

The compact runs enable Playwright `isMobile` and `hasTouch`; the chooser outside-dismissal gesture uses Playwright touchscreen taps and verifies that the first tap closes only the chooser without adding an object, while preserving Add and its selected type. Subsequent placement clicks use the mouse API. This is viewport and input emulation, not physical-device testing.

The landscape chooser can cover some points on the Orbit. The harness therefore picks an Orbit point only after the chooser opens and rechecks `elementFromPoint` against the live overlay. A read-only event trace confirmed the touch sequence on a live, unobscured point: touch pointerdown closed the chooser, pointerup/touchend/click followed, and the map object count did not change. The earlier landscape failure used a point selected before the chooser opened; it was a stale-coordinate test error, not an application failure.

The earlier command-row bounds were measured with Add active. At 390 × 844, the Add status occupied `(7.2, 192.0)–(365.2, 330.3)`; both controls were inside the viewport and hit-testable, and all three HUD buttons were visible and hit-testable around y=146–180. At 844 × 390, the status occupied `(16.0, 172.8)–(700.0, 244.4)`; its controls were hit-testable, and all three HUD buttons remained hit-testable around y=126–164. The 1440 × 900 Add status and both actions also remained inside the viewport and hit-testable.

The chooser's catalogue body uses scrolling when needed. At the tested 844 × 390 landscape size, the active Moon family measured 231 px content and client heights under a 273 px maximum; the last type remained visible and hit-testable. At 390 × 844, the family measured 309/309 px and its last type was visible and hit-testable. No scrolling was needed for these tested families.

## Final picker layering verification

The final focused run is in `after/final-dev/qa-report.json`, with one run report and screenshot per viewport. It uses the local Nuxt development server on owned port 3139 after the reviewed UPopover content-layer and Add-feedback-toast corrections. This is development-runtime evidence; the dev-only prototype switcher is visible, so these captures do not claim production chrome geometry or physical-device behavior.

At 1440 × 900, 390 × 844, and 844 × 390, the Add action chooser and catalogue content reported z-index 15. The run created a real cancellation toast, confirmed it was visible before opening Add, and confirmed it was hidden while the chooser was open. In all three viewports it verified the two Add actions, catalogue header and close button, all seven family buttons, and every type button in every family using DOM bounds and `elementFromPoint` hit testing. Closing the catalogue preserved armed Add, and no browser page errors occurred. Checkout and isolated runtime hashes match for all seven captured application sources. The landscape capture shows the chooser above the overlapping HUD with no stale toast:

- `after/final-dev/dock-chooser-844x390.png`
- `after/final-dev/dock-chooser-390x844.png`
- `after/final-dev/dock-chooser-1440x900.png`

The harness is `../../qa-popover-stacking.mjs`. The final source set passed `npm run typecheck` in the isolated runtime. No production build was repeated for this layering-only correction; the earlier local production build and placement run are recorded separately above, and production packaging for the final layer code is left to CI/preview.

## Build and source provenance

The initial combined typecheck and production-build attempt passed typecheck, then failed during Nitro packaging with `EPERM` resolving `preview-build/node_modules/vue/index.mjs` under the restricted sandbox. The authorized elevated retry completed successfully. After browser QA proved the mobile Add status was off-screen in portrait and overlapped the HUD row, the reviewed CSS correction was typechecked and the production build was run again with elevation; that build succeeded. The later picker-layering correction was checked with `npm run typecheck` and the focused dev run above; it was not included in that production build. No dependency or build configuration changed.

The earlier production acceptance report records seven app source hashes, and each checkout hash equals its preview runtime copy hash. That production server served the approved runtime build from the ignored `preview-build` directory on owned localhost port 3137. The preview runtime's main build artifact was `node .output/server/index.mjs`; this QA did not use Vercel. The final focused development report independently records matching hashes for the reviewed final source files and its runtime copy.

## Reproduction

For quick HMR iterations, start `npm run dev` in the isolated runtime copy on an owned port:

```powershell
Push-Location .scratch/interface-revamp/preview-build
npm run dev -- --host 127.0.0.1 --port 3139
```

The final focused picker-layering run used that local development runtime on port 3139. From a separate terminal at the repository root:

```powershell
$env:PREVIEW_ROOT_URL = 'http://127.0.0.1:3139/?variant=B'
node .scratch/interface-revamp/device-preservation-lab/qa-popover-stacking.mjs
```

The earlier production placement run used the approved local production runtime on port 3137. The recorded command was:

```powershell
$env:PREVIEW_ROOT_URL = 'http://127.0.0.1:3137/'
$env:PREVIEW_BUILD_ROOT = '.scratch/interface-revamp/preview-build'
$env:PREVIEW_BUILD_LABEL = 'Approved local production build after reviewed mobile status CSS correction'
$env:QA_OUTPUT_DIR = '.scratch/interface-revamp/device-preservation-lab/artifacts/dock-feedback-2026-10-15/after/final'
node .scratch/interface-revamp/device-preservation-lab/qa-dock-feedback.mjs
```

The reports and screenshots are written to the respective evidence directories described above. The preserved baseline remains separate under `before/`. Intermediate diagnostics remain machine-local and are not the final acceptance record.
