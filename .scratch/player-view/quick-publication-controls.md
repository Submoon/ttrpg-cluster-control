---
title: Quick configured publication controls
status: closed
parent: spec.md
---

# Quick configured publication controls

The user approved direct four-icon Inspector controls, a shared right-click menu on Select-mode map targets and Hierarchy rows, and persistent visibility indicators on the GM map and Hierarchy. Future multiple selection needs a target-set seam; no new selection tool or batch behavior is requested now.

## Baseline and ownership

Feature branch `codex/player-view-ticket-01`, PR [#39](https://github.com/Submoon/ttrpg-cluster-control/pull/39). Implementation begins after readability commit `8432317f`; refreshed origin/main is `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, with no missing main commits. This intentionally continues the existing player-view feature branch. Preserve unrelated `.codex/environments/`.

Sensitive route: architecture precedes two disjoint implementation owners, then independent standards/behavior and persistence/domain reviews. Coordinator alone owns Git, runtime/browser operations and integration. Freeze all source and tests before browser verification.

Owner 1 owns guarded publication requests, shared icon/status registry and types, menu lifecycle/presentation, Inspector controls, Hierarchy, command context and page wiring. Owner 2 owns canvas input arbitration, cluster/system renderer decorations and private image-export cleanup. Shared interfaces are agreed in the architecture handoff before either writer begins.

## Behavior and invariants

- Use Hidden/eye-off, Unknown presence/circle-help, Known type/shapes and Revealed/eye consistently. Controls expose labels, tooltips, committed pressed states and normal keyboard/touch access.
- Badges indicate configured visibility. A separate lock explains non-Hidden objects whose system is not Revealed. Hidden required hosts retain their Hidden badge even if projection automatically includes an Unknown presence.
- Only Revealed systems open in the player view. Publishing an object never changes its parent or ancestors. Existing snapshots stay immutable.
- Direct commands target explicit system/object identifiers, including an inspected cluster system different from the active system. Resolve drafts through existing Apply/Discard/Stay and continuous-adjustment preflight. Revalidate request/workspace/context/target after async decisions and capacity confirmation.
- Compute publication-only updates from latest committed data. Use the existing mutation/history/durability coordinator once, no alternate writer. Unchanged settings create no history or write. One accepted change supports Undo/Redo and reload.
- Opening/dismissing a menu never changes selection, navigation, geometry or data. Stationary Select-mode right-click on supported marks opens it; right-drag retains panning. Unsupported targets and other modes preserve existing behavior. Hierarchy supports keyboard context activation and touch-accessible actions.
- Menu ownership closes on supersession, target/context removal, gestures and disposal, with safe focus return. An old lease cannot close a newer menu.
- Place map badges outside measured feature groups, following live marker positions. Decorative SVG cannot intercept input or affect camera/geometry. Remove badges and administrative descriptions from GM image clones. No new metadata enters public documents, reader or player images.

## Verification

Focused workflow tests cover explicit targets, draft outcomes, stale requests, no-op/history and parent preservation. Public browser checks cover four Inspector actions, map/Hierarchy menus, independent target selection, committed indicators, parent lock, keyboard/compact behavior and right-drag arbitration. Reuse maintained deep Hierarchy and GM/public export checks. Inspect first desktop/compact captures before broader qualification. Run affected lint/types and meaningful pure regressions while browsers are idle; record exact evidence and independent review closure here.

### Qualification and corrections

Full-source types and affected source/test lint pass. The focused command/preflight run passed nine of ten cases; the final assertion incorrectly expected an implicit Orbit default to exist in stored geometry after Undo. Exact original-workspace restoration replaces that assumption, and its affected replay passes. These checks cover explicit inspected targets, chart drafts, capacity cancellation/staleness, no-op Redo retention and composed continuous-adjustment ordering. Evidence: `quick-publication-pure.log`, `quick-publication-preflight-replay.log`.

The first six browser cases passed direct system/object controls, compact touch sizes and real object Stay/Discard/Apply with reload equality. They exposed two concrete UI defects: the Nuxt menu content wrapper dropped the supplied aria-label, and the four-button row overflowed the 220px Inspector. The menu now obtains its name through the primitive trigger relationship; the row wraps its label above the unchanged 36px controls. Root inspected desktop, compact, minimum-width and full four-option menu captures.

The next integrated run passed seven of nine cases, including menus/checked state, Hierarchy keyboard/touch and Escape focus, minimum width, real drafts/reload, right-drag arbitration and both GM image exports with feature-derived bounds. Changed-mode keyboard focus still requires a captured-target fallback after D3 replaces the original mark. The movement test lacked its download-capture setup; that fixture omission is corrected without changing assertions. Evidence: `quick-publication-browser-integrated.log`, owned `local-test-2026-11-04T14-51-34-203Z-24992`.

Sensitive command/history/disclosure review has no remaining confirmed findings. Standard review confirmed the narrow-panel correction; final runtime closure remains pending focus/movement replays and adjacent regressions. The user clarified that [player/Warden interface consistency](tickets/08-player-map-interface-consistency.md) is local ticket 08 in this same effort, required before PR #39 may merge. It follows qualification of these quick controls on the same branch.

### Final qualification

The clean integrated matrix passed 21 of 22 cases in 2.9 minutes (`quick-publication-final-browser-stable.log`, owned `local-test-2026-11-04T15-37-48-922Z-57108`). The remaining maintained deep-Hierarchy case first identified the visibility button sharing the expansion-control class, then measured the narrower name column. The action now has its own semantic class, actions stack in one 32px column, and row padding returns four pixels to the name budget. The original 80px minimum, all overflow/indentation assertions, full metadata and compact touch/keyboard navigation remain unchanged. The affected deep case and both menu variants passed **3/3** in 46.2 seconds (`quick-publication-hierarchy-budget-qualified.log`, owned `local-test-2026-11-04T15-54-43-947Z-20116`). Root inspected the resulting minimum-width capture.

The full pure suite passed **326/326**, with full-source types and lint passing. A final affected Hierarchy lint qualifies the presentation-only correction. One preceding final-matrix startup was invalidated before assertions by an unidentified filesystem event; it is not counted as a product failure or successful test run. No deadline, retry policy or existing assertion was weakened.

Focus diagnostics established that Reka emits close autofocus from its Popper wrapper rather than the inner menu. Both nodes now retain the captured view; request generation, workspace/context, target, current focus owner and modal gates are rechecked before resolving a surviving map marker. The compact gate permits return inside its originating Hierarchy. Desktop and compact Hierarchy focus plus changed-mode map focus passed with diagnostics and again in the clean matrix. All temporary diagnostic instrumentation is removed.

## Resolution

Inspector controls, map/Hierarchy context menus, configured-mode indicators, parent restriction help, normal saving/history and image-export isolation are implemented. Standard and complementary Sensitive reviews closed with zero outstanding findings. This closure covers the quick-control slice only. Local ticket 08 remains required in this same PR before merge; no source issue is closed and no merge is performed.
