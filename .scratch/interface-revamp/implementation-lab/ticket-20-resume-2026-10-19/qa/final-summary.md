# Ticket 20 resumed QA outcome

Final CSS candidate: `65f6cc2cd910e4e05644dbc1e304ae2055f78106`. Intentional baseline: `92c4bd85a2891bb1144c01e19d2b6088a93d5a7b`. Actual persisted product `/`, installed headless Chrome 155.0.8059.80, isolated browser contexts, scale 1. QA changed no application or canonical test file and performed no Git mutation. The coordinator owns acceptance and lifecycle.

## Passing final evidence

- Corrected application candidate `dc7861d736a12f545f6c2c16ddd4b53bcccc7b89`: the complete focused suite passed **28/28 in 57.8s**: 19 chart sessions/guards/order/recovery, three feedback cases including the causal Fit regression, four theme cases and two launch cases. This is one clean scoped run, not a repository-wide preservation result.
- Final candidate changes only two CSS gap values, giving the four feedback rows/action groups 8px gaps. Its justified fresh build passed in **1m02s**. Only affected feedback tests were repeated: **3/3 in 7.7s**. The preceding 28/28 remains attributed to the corrected application candidate; it is not relabelled as a final-CSS 28-case run.
- Final 390×500 dark touch case passed **27/27 observations**. A planet created and positioned at (0.9, 0.9) through public UI remains ordinarily selectable after a real IndexedDB write abort, a hidden chart draft and explicit Fit. Its bounds are x233.31–260.59/y372.44–396.68; compact feedback begins at y410.03. Ordinary touch reaches the chart guard. Applied recovery JSON excludes the hidden draft; Retry and durable reload retain applied names without replay.
- Final dark-desktop/light-portrait recovery-details supplement passed **37/37 observations**. Full error details, actual JSON download, portal Retry, compact-panel focus and Escape return work. Holding a real write's completion notification retains the previous failure through Retry; this is explicitly an acknowledgement hold, not an uncommitted transaction. Releasing it produces Saved, removes the error-only trigger and focuses Saved status. Feedback/popovers do not auto-Fit the camera.
- The final two scripts contain **17 contrast samples**. Useful text minimum is **6.782:1**; meaningful native boundary minimum **5.849:1**; meaningful recovery glyph minimum **13.499:1**; semantic button focus minimum **6.042:1**. Saved fallback uses the observed Chrome `auto 1px` outline, with full visible extent and contrast **14.975:1 dark / 19.028:1 light**. Thresholds remain 4.5:1 for text and 3:1 for controls/focus. Recorded application console warnings/errors and page errors are zero.

The three final PNGs were visually inspected: the fitted compact planet is above feedback; the light compact portal displays the full failure and unobscured focused action; the desktop recovery strip is subordinate to the map and clear of Inspector actions. No full matrix was repeated after the bounded fixes.

## Preserved attempts and corrections

Initial application `ffa1025026b2c751fa854e77d3edf20de853e13a` built successfully in 1m41s. Its portable attempt recorded 10 passed/1 failed/16 unrun; a remaining-only continuation recorded 13 passed/3 failed. Coordinator-approved test corrections restored public cluster navigation, waited for a closing Add popover and used the correct Selected versus Active summary name. All assertions remained. The corrected 28/28 supplies current proof for those journeys.

The initial six-case presentation run recorded **111/112**. It exposed a genuine new overlay obstruction: feedback x8–382/y348.83–492 covered the fitted lower-right planet x276.97–333.18/y430.56–481.65. The developer's single new regression also failed at that actual hit assertion. The correction made feedback concise, exposed full details through Nuxt UI and measured the feedback band for explicit Fit.

The corrected compact run recorded **26/27** and its first details supplement **24/30**. Five supplement failures were real adjacent focus-contrast failures; one was a QA-only expectation that error details remain after successful Saved. Before/after pixels proved the 2px outline plus 2px offset touched a neighboring border across a 4px gap. This was fixed with 8px spacing, without lowering thresholds. The helper expectation was corrected to verify trigger removal and Saved fallback focus. Original JSON, causal PNG and focus pixel evidence remain intact; attempts are not combined into a fictitious aggregate pass.

## Full-suite limitation

Exactly one repository-suite command was invoked and exited 1. Its redirected stdout/JSON used ephemeral sandbox TEMP, which disappeared before recovery. Counts, cause and whether any test began are unavailable. The coordinator explicitly prohibited a repeat; none occurred. `full-suite-attempt.json` records the exact lost path. No prior cluster-map cause or repository-wide preservation pass is inferred. Subsequent runtime commands used elevated host execution with persistent evidence.

## Fidelity, preservation and cleanup

The actual B/Dock desktop-light reference and initial product capture use comparable viewport, palette, cluster scope and panel state, with different fixtures/selection explicitly disclosed. Chart/modal/feedback actions remain reachable. The compact bottom feedback removes the former reserved footer row; the historical pre-footer capture has different source/fixture/Files provenance. The inherited top Dock, framed columns and dense header remain ticket 21 work. This report makes no whole-interface fidelity claim.

Initial freeze verified all six preserved modified test/helper files. The coordinator later adopted the chart test's pre-existing navigation hunk and five specifically approved corrections into `dc7861d7`; the original snapshot remains. The other five files remain byte-identical and uncommitted. Final verification confirms all ten frozen source hashes and those five protected hashes match. Runs used this shared working tree with preserved local work; no clean-checkout full-suite pass is claimed.

All identified QA dev/compiled trees were stopped. Final process 22836 is stopped, and ports **3100/3180 are free**, recorded in `final-cleanup-and-hash-verification.json`. Physical Android Chrome, real OS keyboard, safe areas and physical gestures remain unavailable; viewport/touch emulation is not physical proof. The curated manifest excludes generated artifact trees and does not authorize staging unrelated work.
