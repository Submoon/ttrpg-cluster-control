# Ticket 21 bounded QA evidence

Baseline: `e8bb78c014909f9046eb43c405cfbd7a72b43e3f`. Final sources are freeze 10; the application is equivalent to compiled freeze 8, and the six geometry comparison families remain from freeze 7. **All 25 original failures have actual passing affected-run evidence**, linked by title in the resolution ledger. This is a collection of scoped runs, not a 99/99 complete-suite result. No lifecycle or Git operation was performed by QA.

The five pre-existing modified test/helper files (`cluster-map`, `helpers`, `object-fields`, `workspace-data`, `workspace-ui`) were explicitly adopted and preserved; QA did not revert or edit them. Final ownership supersedes the early preflight note: A handled existing-test public setup adaptations, B handled the new composition test/application layout, and QA only the gate/evidence. The readonly installed resizing hook exception is accepted; this gate assesses actual session width, accessibility, pointer/keyboard behavior and cleanup rather than requiring that hook.

## Execution record

- The sole complete capability-suite invocation used freeze 2: **74 passed, 25 failed, zero skipped/flaky/unrun**, 99 cases. Its original outcome remains unchanged.
- The affected compiled subset on freeze 5 used exactly 30 cases: **19 passed, 11 failed**. This was not another complete-suite invocation.
- The final affected compiled subset on freeze 7 used the eleven remaining failures plus three composition cases: **8 passed, 6 failed, zero skipped/flaky/unrun**, 14 cases, 172.102 seconds. Workers 1, retries 0, maxFailures 0; no timeout increase or assertion removal. Failure screenshots and traces remain in the literal host output directory recorded in the manifest.
- The initial freeze-6 typecheck found the independently identified test-only TS2367 (`Animation.playState === 'pending'`). Its evidence is preserved. The approved correction uses `Animation.pending`; freeze 7 typecheck passed.
- One final production build passed. Freeze 6 → 7 changed only that test line; the application build is equivalent. Build logs remain separate from the test logs.
- Post-capture identity: **97/97 unchanged**, including all 90 frozen application/test inputs, QA scripts, fixture and compiled entry metadata. Compiled server PID 23312 was retained on port 3180 for coordinator inspection.
- Freeze 8 typecheck and its single production build passed. Its exact ten-case subset (six remaining failures, cluster preservation ×3, composition resize ×1) completed **7 passed / 3 failed / zero skipped/flaky/unrun**, 120.231 seconds. Cluster preservation, resize, exported angle and campaign deletion checks passed. The remaining first failures were a background-wheel helper searching for a descendant SVG when its locator is already the SVG; a collapsed Hierarchy before the dependent-system delete action; and a recovery assertion using an obsolete system-navigation button name. Post-run identity remained **90/90 unchanged**. These are raw failures until their corrected affected tests pass.
- Freeze 9 reused the unchanged compiled application and ran only those three remaining titles: **2 passed / 1 failed**, 57.044 seconds. Elliptical Orbit round-trip and recovery passed. Dependent deletion progressed to a later map click intercepted by the open Hierarchy; its raw trace remains preserved.
- Freeze 10 changed only that test's public UI precondition and reused the same compiled application. The single dependent-deletion case **passed**, 18.654 seconds. Final typecheck passed, including the SVG helper changes made after freeze 8. Final identity remained **90/90 unchanged**. No additional build or broader suite followed these test-only changes.
- The ledger also cites two actual passing titles from the coordinator-qualified freeze-3 focused seven-case report (**2 passed / 5 failed**) and the ring pass from its focused five-case report. Those reports' failures are preserved, not replaced with a blanket pass. The earlier orbit-route diagnostic is not used to attribute unrelated system-map/hosted-drag titles.
- Only verified compiled server PID **25840** was stopped after the final gate. Host listener checks confirm ports **3100 and 3180 are free**. The runtime cleanup identity/result is curated.

The freeze-7 first failures were Orbit horizontal radius expected 320/actual 319; Orbit round-trip Hierarchy precondition after reload; dependent-deletion Hierarchy rows after reload; missing/nonfinite exported planet angle; imported system deletion leaving its mark; and imported undersized-Orbit recovery Hierarchy precondition. Later affected passes resolve those cases without altering their raw historical outcomes. Chart details, palette preview, and all three composition cases also passed their relevant subsets.

## Bounded UI gate

All six root arms completed: desktop map-first and both overlays (1440×900 light), portrait map and exclusive panels (390×844 dark), short landscape (844×390 light), and reduced recovery (390×500 dark). All root arms assert the actual fixture route ID and selected SVG class after real keyboard activation and after Navigate/theme/Fit; Inspect captures additionally require `JUMP ROUTE / SELECTED` and `Jump Level 4`. The earlier root captures with an uncontrolled consultation state are diagnostic only and are not used as final paired selection evidence.

The unchanged accepted B/Dock reference arms are retained from the freeze-5 compiled run at `/?variant=B&controls=dock`. Root uses an actual publicly created/imported record validated by the repository domain parser, then its standard IndexedDB representation in isolated contexts. Root and B have different disclosed fixture IDs/names/density: root 3 systems/11 objects/3 Orbits/1 route; B 3/13/6/4. Viewport, palette, mode and panel state are matched. Root's actual record and screenshot geometry preserve its source IDs.

The gate recorded **137 passed / 3 flagged observations**, with no execution failure or page error. Resize exercised pointer growth/shrinkage and both keyboard directions for both panels, actual accessible widths, node identity and invalid draft/error retention across Hide/theme/compact reflow, camera/data preservation, session-width restoration and ordinary handle hits. The planet retains a nonempty draft Name and deliberately duplicates distinct Primary Star location key A, reaching the domain validator. Reduced recovery exercised a real aborted browser-storage write, retained draft/selection state, recovery Popover, focus return, Stay/Retry and reload.

Focus samples use natural Tab order. Desktop Select/Fit/navigation minima were 5.973/6.031/6.031:1; portrait Fit/navigation now pass at 11.405/7.438:1, with complete paint and geometry checks. The 8px group spacing resolves their previous adjacent-border failures.

Three raw measurement flags remain visible:

1. Light inspector resting resize cue: RGB (85,75,64) against actual border (121,110,93), **1.703:1**, below 3:1.
2. Dark inspector resting resize cue: RGB (137,153,153) against border (101,120,122), **1.566:1**, below 3:1. Light Hierarchy cue passes at 5.631:1.
3. Portrait Select nominal-colour paint-match predicate fails although its nominal contrast is 11.405:1. Offline audit of all 48 already captured actual contour/background RGB pairs yields minimum **9.369:1**. The coordinator visually confirmed a complete, clear ring with 8px spacing and adjudicated this as nominal-RGB oracle strictness, **not a contrast defect**. The raw failed predicate, causal PNG and actual-pixel audit remain unchanged; no forced green result replaces them.

Measurement-only foreground or outline-color suppression reveals the actual background, with exact inline styles restored in `finally`. Fidelity and focused PNGs capture unmodified presentation. No acceptance styling, forced focus, threshold relaxation or product modification was used.

Physical Android Chrome, an actual OS keyboard, device safe areas and physical gestures were unavailable. Viewport/touch emulation is not physical-device certification. The six families are a bounded UI gate, not an exhaustive matrix or product-wide accessibility certificate. The coordinator inspected the corrected selection captures and unmodified light/dark cue PNGs; the application-wide completion/lifecycle decision remains with the coordinator.

## Corrected cue supplement — freeze 8

The independent desktop-overlays root arm completed **48/48 observations**, no page errors. Its application/build/QA identity remained **79/79 unchanged**; canonical test files were explicitly excluded because the coordinator authorized simultaneous test-only corrections by B. This does not weaken or replace the separate full 90-file checks around the targeted run.

The approved product correction gives the 2px cue a primary-text foreground and 2px panel halo. The final cue sampler therefore uses an **unmodified screenshot**, reading actual cue pixels against both immediately adjacent pixels at three straight-stroke positions. Hiding the entire handle would also remove its production halo and incorrectly measure the border underneath. The old method/results remain preserved. No threshold was changed; the threshold remains 3:1.

Actual minimum cue contrast is **9.826:1 light inspector**, **13.328:1 dark inspector**, and **9.920:1 light Hierarchy**. The unmodified PNGs and per-pixel RGB records are retained. Normal pointer and keyboard resizing and draft/error/node/camera retention passed again. The coordinator visually confirmed the corrected cues. No additional six-family capture matrix was run.

## Evidence

`evidence-manifest.json` lists only useful new QA scripts, the reproducible fixture, current-run result JSONs and selected PNGs. Raw stdout, stderr and failure traces remain outside the watched repository under literal host TEMP directories. The manifest records their locations and hashes of curated files. The original full-suite failure outcome is preserved separately from targeted corrections; no aggregate claim that all 99 passed is made.
