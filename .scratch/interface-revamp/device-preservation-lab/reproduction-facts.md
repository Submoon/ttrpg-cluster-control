# B device-preservation lab: executed facts

This is an incremental lab capture of accepted B, not a ticket closure or physical-device validation. It uses only the disposable normalized lab build and fresh Playwright contexts. No product source, Git history, the live prototype worktree, port 3113, or real user storage was changed.

## Build and environment

- Baseline: `629d2a98715c3a16b954e0f77c639b1f0c31212c`; accepted B: `7ea41e0a9b0e585e23812eb9165e95420d72dc89`.
- Served build: `.scratch/interface-revamp/measurement-lab/source-b` production output, with the disclosed three Orbit-order normalizations only. The original B output remains in `source-b-original-output`.
- Fixture: `measurement-lab/fixture.json`, 3 systems, 4 routes, 13 objects, 6 Orbits.
- Owned endpoint: `http://127.0.0.1:3125/?variant=B`, PID recorded in `server.pid` (`22988`); `server.log` reported `Listening on http://127.0.0.1:3125`. After capture, PID 22988 was absent and no listener remained on port 3125; no other process was stopped. Port 3113 was left untouched.
- Runtime: Chrome `154.0.8037.98`, Playwright `1.64.0`, Node `v24.18.1`, Windows 11 x64. Browser contexts were newly created with no `storageState`, `deviceScaleFactor: 1`, reduced motion, and downloads enabled. Emulated mobile cases used Playwright `isMobile`/`hasTouch`; no physical phone or tablet was used.
- The contexts reported no IndexedDB databases and only the `nuxt-color-mode` local-storage key. The prototype itself states that it is memory-only and bypasses IndexedDB. `workspaceAvailable` was false and workspace hashes were null; live workspace preservation could not be hash-verified.

## Reproduction commands

Server ran from the normalized `source-b` directory as the Nitro production entry point with `PORT`/`NITRO_PORT=3125`, `HOST`/`NITRO_HOST=127.0.0.1`; stdout/stderr were redirected to this folder's `server.log` and `server-error.log`.

From the repository root, the executed harness commands were:

```powershell
$env:RUN_PHASE='initial'; node '.scratch/interface-revamp/device-preservation-lab/run-preservation.mjs'
$env:RUN_PHASE='exports'; node '.scratch/interface-revamp/device-preservation-lab/run-preservation.mjs'
```

The local server/browser operations required an escalated command because the default sandbox denied local-network navigation. The measurement script is `run-preservation.mjs`. Full raw records, point samples, action traces, and screenshot paths are in `artifacts/preservation-initial.json` (1,657,508 bytes), `artifacts/preservation-runs.json`, and the latest `artifacts/preservation-incremental.json`.

## Executed interaction results

- Desktop 1440×900 starts with Inspect open and Hierarchy closed. Opening Hierarchy leaves Inspect open; closing it preserves the current selection. Desktop has independent side panels in this sample.
- Fresh 390×844 starts with both panels closed. The actual map detail tab opens Inspect; entering `same-target draft persists`, hiding Inspect, and reopening it retained that draft. Opening Hierarchy closed Inspect. Selecting the already-selected route through a visible Hierarchy row closed Hierarchy, reopened Inspect, and retained the draft.
- Selecting a different route opened the visible unsaved-draft guard with Apply, Discard, and Stay. Stay dismissed the guard and retained the current route; reopening Inspect showed the draft unchanged. Discard and continue selected `Jump-6` and discarded the previous Gannet draft. Apply and continue applied the dirty path's in-memory save simulation and navigated to the clicked route, `The Gannet Passage`; the prototype exposed no workspace data/hash, so persistence of that route rename was not independently verified.
- The actual Vela Hierarchy exposed `Select PL-1, Aster`; selecting it opened Inspect. Applying an empty name kept selection `Aster`, kept the actual SVG object-label list unchanged, retained the blank field, and showed `Object name is required.` Both hashes were null, so the workspace-hash comparison is recorded as unavailable.
- At 390×844 the Aster inspector had scrollHeight 1042/clientHeight 844. A wheel attempt did not advance its internal scroll; the harness then set the panel's `scrollTop` to verify the reachable footer (`scrollTop=126`, scrollHeight 970/clientHeight 844). The Apply button center was hit by that button after scroll. Applying `Aster scroll and footer check` changed the rendered SVG object label; Hierarchy then exposed `Select PL-1, Aster scroll and footer check`, and reopening that row retained the applied in-memory name.
- At 844×390 Inspect is full viewport and has scrollHeight 597/clientHeight 390. The toolbar covers the Apply and Discard centers: `elementFromPoint` hit `.b-tool-rail`, not either button. At 390×844 the corresponding button centers were in the viewport and hit the buttons.
- No invalid apply or guard action produced an uncaught page or console error in the completed initial run. Earlier harness-only failures are preserved separately: the first locator assumed a closed desktop Inspector; a later version toggled Hierarchy closed twice before route selection. Those were corrected locator/sequence errors, not missing product controls. `b-mobile-draft-guards-failure.png` is from that earlier harness attempt and is not a product-failure screenshot.

## Geometry method and results

SVG CSS rectangles below are the full map viewport rectangles; they are not the unobscured interaction area. For unobscured estimates, the harness sampled `document.elementFromPoint` at 96 cell centers on a 12×8 grid over the viewport-clipped SVG rectangle. Estimated pixels are rectangle area multiplied by the hit fraction; this coarse sample is approximate and excludes neither visually obscured non-SVG controls nor physical input effects.

| Viewport and state | SVG rectangle | Map-hit sample | Inspector-hit sample | Approx. unobscured map area |
| --- | ---: | ---: | ---: | ---: |
| 1440×900, Inspect open, Hierarchy closed | 1440×900 | 60/96 (62.5%) | 18/96 | 810,000 px |
| 1440×900, both panels open | 1440×900 | 39/96 (40.6%) | 18/96 | 526,500 px |
| 390×844, map mode | 390×844 | 84/96 (87.5%) | 0/96 | 288,015 px |
| 390×844, Inspect open | 390×844 | 0/96 | 96/96 | 0 px |
| 390×844, Hierarchy open | 390×844 | 12/96 (12.5%) | 0/96 | 41,145 px |
| 844×390, map mode | 844×390 | 47/96 (49.0%) | 1/96 | 161,151 px |
| 844×390, Inspect open | 844×390 | 0/96 | 72/96 | 0 px |

The other 844×390 grid points hit page/rail/overlay elements. On the portrait map-mode screenshot, the rightmost Details rail control extends past the viewport; the other sampled rail controls had in-viewport centers. Exact rectangles, hit paths, and all grid points are in the raw JSON.

## Exports attempted with dirty drafts

The export run set a dirty Jump Route draft and an Aster draft, then used the real export controls. Successful downloads and previews:

- `artifacts/cluster-dark-dirty-draft.svg` — 26,917 bytes, SHA-256 `718295a401f510c5faf402fdefe24a3462f12d735f25deec8d95e3126b76c14c`; preview `artifacts/cluster-dark-svg-export-preview.png`.
- `artifacts/cluster-dark-dirty-draft.png` — 116,582 bytes, 2016×1216, SHA-256 `458bc15458448ed9de44adff4cbb687f9a7bc55852d7f2a4563c442629f155b1`; preview `artifacts/cluster-dark-png-export-preview.png`.
- `artifacts/system-dark-dirty-draft.svg` — 35,579 bytes, SHA-256 `af41e1add28874f8f214c50b2e1d13b299d49e5bec49fb90800f786f348c223f`; preview `artifacts/system-dark-svg-export-preview.png`.

The System dark PNG action was attempted through the same visible Export map image rail control, but Playwright observed no `download` event within 30 seconds. It is recorded as `systemFailure` in `preservation-runs.json`; no browser page/console errors were recorded. Therefore there are three successful downloads, not four, and no System PNG artifact. No retry, workaround, or app change was made.

The actual cluster SVG and PNG previews show the cluster map on a print-light background and do not show the dirty marker. SVG text scans did not find the draft marker; the PNG binary substring check is not a semantic content test, so the preview is the visual evidence. For all successful exports, selection, transform, active theme, and inspector draft were unchanged across the download; map SVG labels were unchanged. Workspace hash comparison was unavailable (`null`), not a verified unchanged workspace.

The system SVG parsed, but its exported viewBox was `-24 -134 642564 125203`. Rasterizing that downloaded file produced only a wide cream band on gray, with no visible map title or objects. In the exported SVG, the title is `Vela Reach` with fill `rgb(232, 237, 228)` over the print-light background `rgb(251, 248, 239)`; the measured solid-color contrast ratio is `1.11945`. Selected classes remain in the export and edit handles are absent. This observation is limited to the saved dark-theme System SVG; no light-theme export was downloaded. Cluster active-dark and active-light live-with-draft screenshots exist; the System active-light screenshot was not reached because the System PNG download timed out before the theme loop completed.

## Input and device boundaries

These are source facts, not physical-input observations. `ClusterMap.vue:314–327` and `components/maps/system-map-renderer.ts:854–865` filter D3 zoom events and recognize a touch pinch when the event has more than one touch. No explicit `touchcancel` handler was found in those two renderer files. Playwright touch emulation does not establish pinch, cancellation, single-pointer, or phone behavior. `PrototypeWorkbench.vue:957–963` handles left/right arrow keys for variant cycling and does not handle Escape in that handler; route marks have Enter/Space selection handling in `ClusterMap.vue:218–223`. No physical keyboard, assistive technology, or screen-reader outcome was tested.

## Relevant screenshots

All screenshot paths are enumerated in the raw JSON. Useful captures include:

- `artifacts/b-desktop-1440x900-initial.png`, `artifacts/b-desktop-hierarchy-exclusive.png`
- `artifacts/b-mobile-same-target-draft-reopened.png`, `artifacts/b-mobile-dirty-navigation-guard.png`, `artifacts/b-mobile-stay-keeps-hierarchy-and-selection.png`, `artifacts/b-mobile-discard-result.png`, `artifacts/b-mobile-apply-result.png`
- `artifacts/b-reflow-390x844-inspector-open.png`, `artifacts/b-reflow-844x390-inspector-open.png`, `artifacts/b-mobile-844x390-inspect-open.png`, `artifacts/b-mobile-844x390-map-visible.png`
- `artifacts/b-mobile-invalid-apply-preserves-object.png`, `artifacts/b-mobile-aster-inspector-scrolled-to-actions.png`, `artifacts/b-mobile-aster-after-scroll-footer-apply.png`, `artifacts/b-mobile-aster-reopened-after-apply.png`
- `artifacts/b-cluster-active-dark-with-draft.png`, `artifacts/b-cluster-active-light-with-draft.png`, `artifacts/b-system-active-dark-with-draft.png`
- The three `*-export-preview.png` files listed above.

This capture remains separate from any future PR preview build or human phone trial. Ticket 10 remains open pending the human/device pass.

## 2026-10-15 corrective local production build and focused checks

The corrective source was the shared, uncommitted phone-feedback patch on `codex/interface-revamp` at `99fe1a5709839d12d95fb3aacf1d73117015aa01`. The six changed app source files were overlaid into the ignored `.scratch/interface-revamp/preview-build` runtime, which has the project's production dependencies. After the mobile toast selector was corrected to match its sibling DOM placement, `npm run build` completed successfully in 5m52s (including Nitro) and the post-build `npm run typecheck` exited 0. The served artifact was this isolated local build, not the deployed PR preview.

Run the focused final geometry check from the isolated runtime with:

```powershell
node .\qa-corrective-geometry.mjs
```

It opened fresh headless Chrome contexts with Playwright mobile/touch emulation at 390×844 and 844×390. All eight visible rail buttons, including Inspect, and all three zoom buttons were within the viewport and passed center-point `elementFromPoint` hit tests. Navigation/Move changed the system node's accessible action between Open and Select and back; Navigation opened the system map without Inspector; Back was within the viewport and hit-testable. The “Inspector draft discarded” toast did not intersect any zoom button, and zoom centers remained hit-testable. Both pages had zero errors. The test injects no hooks and alters no app state beyond ordinary UI interactions. Its exact measurements and screenshots are in `artifacts/corrective-2026-10-15/`; script copy: `qa-corrective-geometry.mjs`.

Earlier on the same interaction source, the focused gesture checks passed using Playwright mouse input and CDP-dispatched touch events. The two-contact path showed an object preview, rollback on second contact, map-view transform change during pinch, continued view pan while one finger remained, no change in the object's applied SVG transform through the canceled sequence, and a subsequent fresh one-finger edit. This is renderer-attribute evidence only: no QA-only commit counter or full serialized-model comparison was used, so it does not prove complete model equality or the absence of every domain-side effect. Touch input was synthetic and does not establish behavior on a physical phone. `qa-b-mobile.mjs`, `diagnose-touch-after-pinch.mjs`, and the successful earlier run summary `artifacts/corrective-2026-10-15/gestures-run-summary.json` preserve that bounded check. No physical-device, OS/browser, keyboard, or real safe-area conclusion is claimed.

## 2026-10-15 Orbit seed fixture correction

Astra reproduced a Fit failure on published commit `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`: the free Orbit centers for Vela Reach (`orbit-vela-three`, authored scene point `{ x: 772, y: 300 }`) and Kestrel Deep (`orbit-kestrel-two`, authored scene point `{ x: 210, y: 395 }`) were stored as if they were normalized points. The system-map geometry resolves stored Orbit centers as normalized map points, so those scene-unit values expanded the rendered bounds and pushed Fit to an unusable translation.

The fixture now calls `toNormalizedMapPoint()` for each authored scene point while `seedWorkspace()` constructs these two sample Orbits. This deliberately corrects those fixture values at construction time; it does not add runtime normalization, alter domain rules, or migrate existing data. Local `npm run typecheck` passed after overlaying the updated `PrototypeWorkbench.vue` into the isolated dependency runtime. No local production build or Fit browser run was done for this correction. The screenshots and measurements from `4d90` remain historical evidence for that reviewed build; Astra is to validate Vela and Kestrel Fit on the newly published source.
