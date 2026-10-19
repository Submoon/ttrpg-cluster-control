# Preservation preflight and historical failures

Static preparation only against coordinator-confirmed baseline `e8bb78c014909f9046eb43c405cfbd7a72b43e3f`; no application/test edits or runtime reproduction. Line numbers below describe the read source and may change under assigned implementation.

## Historical outcomes stay separate

| Evidence | Recorded result and current classification |
| --- | --- |
| Ticket 18 resumed `qa/full-suite.json` and final summary | 93 discovered; 0 passed / 1 failed / 92 unrun. Post-reload cluster node transform expectation at `tests/cluster-map.spec.ts:78` could not find `Open Vesper system map`; error context showed Vesper system map. Unclassified cause. |
| Ticket 19 resumed `qa/full-suite.json` and final summary | Same counts and absent restored cluster node symptom; actual expected transform was `translate(254.5177960205078 229.81890563964842)`. Recurrence does not establish a baseline/product cause. |
| Ticket 20 resumed `qa/full-suite-attempt.json` | Exactly one command exited 1; sandbox TEMP stdout/JSON disappeared. Counts and whether any test began are unknown. No attribution to the preceding cluster symptom is valid. |
| Historical ticket 21 `production-qa/full-suite-attempt-1-interrupted.json` | 93 discovered; 0 passed / 3 failed / 90 not completed, interrupted. Failures: mode-sensitive locator resolution in dragBy; retained wrong mode before opening New System 2; detached Installations palette category in unresolved-exit journey. These are old attempt classifications, not current candidate outcomes. |
| Historical Orbit uniform resize | Criterion 10 and reset explicitly retain this unresolved journey. Current `cluster-map.spec.ts:101` asserts both axes grow uniformly with orbital angle stable; `system-orbits.spec.ts:101` independently asserts both axes grow and attached planet moves. No fresh reproduction or passing current evidence yet. |

`helpers.ts:244` currently returns from `returnToClusterMap` after immediate `Back.count()` / fallback `isVisible()` checks, without waiting for product readiness or asserting cluster arrival. After `page.reload`, a hydration gap can yield neither control, silently leave the system map and produce the historical symptom. This is a source-supported **hypothesis**, not a proven root cause. A faithful test-owner repair should wait for the real workspace/context, then activate the public Back control if in a system, or positively verify an existing cluster map; retain the durable transform/reload assertion.

The end-of-run ledger `research/implementation-18-21-2026-10-16.md:371` is the stronger boundary after those initial classified timeouts: its Add chooser visibility/trigger cause was corrected and one focused route-follow case passed, but **the original Orbit-radius-growth assertion and unresolved-exit journey still failed**, with no decisive hit-target proof or useful final timeout call log. Do not turn the initial detached-category diagnosis into a claim that the final unresolved-exit failure is explained. Both current outcomes require actual execution.

The historical unresolved-exit timeout occurred while a category button detached, not while asserting the external route. Preserve known level 3→12 edits, logical point rename, unknown level 15 label, durable reload and physical Jump Station association. Wait for actual chooser/category lifecycle and deliberate mode/context through public controls; do not remove the route journey or force-click a detached control.

## Concrete old-journey diagnostics for the assigned test owner

For uniform resize, record the intended Orbit ID, initial `rx/ry`, current Move state, actual SVG CTM, chosen start/end client coordinates and `elementsFromPoint` at the start. The current helper uses angle 0.5, which avoids the horizontal/vertical axis handles; retain that deliberate ring interaction unless evidence shows occlusion. Explicitly Fit or hide a panel through public UI if the ring point is covered by a newly floating surface, then capture a fresh CTM before drag. Ordinary pointer movement must change both axes uniformly and preserve attached-object angle (`cluster-map`); the independent `system-orbits` case must still grow both axes and move its attached planet. If the ordinary pointer reaches the right ring, Move is active and no radius grows, that is current product evidence for the geometry owner; do not compensate with a numeric setter or keyboard action in the drag assertion. Keyboard alternatives remain separately required.

For unresolved exit, expose Hierarchy explicitly, use the real context Back and retain the pre-existing Add-system auto-entry setup correction. At each catalogue action observe Add trigger `aria-expanded=true` and stable visible palette/category after any prior exit; matching the visible closing portal is insufficient. Keep categories scope-specific, wait for completion after Add, and choose Navigate deliberately before a system short activation if the route setup retains another mode. Collect timeout call log, visible map title/mode, trigger state, active modal/popover and screenshot. Preserve all route/reference/reload assertions; a single final 30-second timeout without operation identity remains unclassified.

## Protected pre-existing hunk adoption recommendation

Read the coordinator's exact `preexisting-before/original-working-tree.patch` and all five captured originals. **Recommend adopting every existing hunk, preserving its intent**, with further B-owned public setup/locator adaptations reviewed against the new composition. No hunk reduces assertions or changes application data behavior. This is a read-only recommendation; coordinator/test owner performs any adoption.

| File / original hunk | Evidence and recommendation |
| --- | --- |
| `cluster-map.spec.ts` moved-system locator + post-reload Navigate | Move truthfully changes Open to Select. Keep transformed-node assertion against the correct Select name and restore Navigate before Open after reload. Fix positive context readiness separately; the hunk alone does not prove the old cluster-return issue resolved. |
| `cluster-map.spec.ts` Add-system setup in both route cases | Current legacy command enters New System 2. Keep the visible new-system-map wait rather than issuing a second cluster Open. Persistent Add/no-entry is ticket 23, so do not retrofit that future behavior here. |
| `cluster-map.spec.ts` route-follow moved-source locator | Keep pre-mode source bounding box and post-mode Select locator while asserting both system transform and route line change during the real drag. |
| `helpers.ts` dragBy source resolution before Move | Keep capture before the mode-sensitive accessible name changes. Recompute/verify ordinary exposed hit target as needed for overlays, without undoing the name fix. |
| `helpers.ts` catalogue trigger expanded + palette visible | Keep trigger-state ownership; closing portal visibility is not open state. Add bounded public lifecycle readiness only if current evidence needs it, not arbitrary sleeps or forced clicks. |
| `object-fields.spec.ts` Add-system setup | Keep the new-system visibility assertion before testing reusable custom values in the independently created system. |
| `workspace-data.spec.ts` four Add-system setups | Keep real auto-entry setup in applicability import, dependent deletion, versioned JSON and complete campaign journeys. Preserve all subsequent data/reference/import assertions. |
| `workspace-ui.spec.ts` Add-system setup + return to cluster | Keep new-system visibility and explicit Back before opening Vesper; this verifies current context behavior. Replace only obsolete summary/column presentation checks elsewhere under the corrected contract. |

All five current hashes match the captured originals at the end of initial QA preparation. The coordinator's later split assigns **A all existing tests/helpers**, after component handoff, and **B the new composition test plus application/layout scope**. QA owns no canonical test edits. Preserve original snapshots/patch as provenance even when an adopted file's new hash necessarily changes.

## Required faithful test adaptation

| Current test seam | Required outcome to retain and legitimate adaptation |
| --- | --- |
| `helpers.ts:226–240`; `cluster-map.spec.ts:35/129` and related callers | `workspaceNavigation` currently owns output/+/-/Fit. Separate bottom-right zoom requires a new semantic zoom locator and migrated view-control callers; the mode helper remains Dock-specific. Preserve one control set, 25–1600%, wheel/Fit/pan and keyboard behavior. Do not enlarge the Dock locator to hide duplicated controls. |
| Hidden-default Hierarchy; direct `System hierarchy`, `Star systems`, `Jump Routes` callers | Explicitly reveal through named Hierarchy control before hierarchy interaction, including after context/import/reload and compact exclusive reflow. Context changes may close panels; re-evaluate real state. No global helper should permanently force Hierarchy open and erase the map-first assertion. |
| `workspace-ui.spec.ts:30` | It asserts initial both-open and three ordered non-overlapping columns. Replace those superseded geometry assertions with initial Hierarchy-hidden, independently opened overlays, stable full map-board bounds and real panel overlap/hit testing. Retain compact fullscreen/exclusive/focus and desktop coexistence. |
| `workspace-ui.spec.ts:226` | It asserts all summaries/counts inside Header. Preserve readable current names and dynamic counts in approved map chrome/consultation surfaces, no accidental duplicate SVG captions, and updated count after Add star. Explicitly test compact header density; do not delete information assertions. |
| `cluster-map.spec.ts` first journey | Preserve cluster/system arrangement, zoom range, wheel/Fit/pan, actual durable reload, uniform Orbit resize/angle, keyboard radius and system/object restore. Explicit opener/mode/zoom adapters only. |
| `cluster-map.spec.ts` route journeys | Preserve route endpoint attachment while system moves, known/unresolved routes and positive custom levels, rename propagation, reload and physical Station link distinct from logical point. |
| `object-fields.spec.ts` | Preserve nested map editing, Chart details keyboard access, native/custom typed values/applicability, centered Fields dialog and destructive reviews. Add explicit panel setup where needed. |
| `workspace-data.spec.ts` | Preserve dependent deletion reviews, reference cleanup, current marker/version, cluster/system JSON/layout/native/custom data, invalid/canceled/independent-copy import and complete campaign workflow. Adapt moved summary consultations; do not flatten to signature-only downloads. |
| `system-orbits.spec.ts`, `system-map.spec.ts` | Preserve uniform/elliptical/nested geometry, ring/keyboard controls, detach/host-minimum/free center, previews and full export/import results. Overlay-aware safe hit points may replace old now-occluded coordinates, with actual gesture and same result assertions. |
| `workspace-navigation`, `workspace-panels`, map gesture/touch suites | Preserve intent/camera/deletion/guard/long-press/takeover cases; update split toolbar and hidden-panel setup, add resize/session-only behavior and controlled first Fit. |
| Chart drafts/feedback/recovery/theme/launch files | Preserve prior scoped data/session/recovery/atomicity/theme outcomes. Do not regress ticket 20's recovery Popover or overwrite hidden drafts when rearranging retained panels. |

Potential occlusion is now an actual requirement boundary: a pan helper's old bottom-left SVG coordinate may fall under an overlay; an Orbit resize point may lie below Dock/feedback. Choose an exposed real pointer path after explicit Fit or panel hide, disclose why, and keep geometry/data assertions. A forced click, hidden DOM invocation or lower threshold would not verify usability.

Canonical test/source changes belong to the separately assigned test/implementation owner. QA reports exact setup defects and product defects separately, with original screenshots/errors retained and corrections limited to the adjudicated cause. No reduction in tested preserved capability is authorized by this preflight.
