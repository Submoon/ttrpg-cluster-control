---
title: Full-page player reader presentation
status: in-progress
parent: spec.md
---

# Full-page player reader

On 2026-11-04 the user requested a player interface close to the Warden map workspace: a viewport-filling map, navigation and read-only consultation. The reported screenshot shows the centered standalone reader and an oversized Known type system marker.

## Baseline

Branch `codex/player-view-ticket-01`, PR [#39](https://github.com/Submoon/ttrpg-cluster-control/pull/39), starting HEAD `fee195f6d10d6972728a5cf69f665f073da3ab0a`. Refreshed origin/main remains `47c0418a835da285e9edb88e8f8dffc19c3a2bba`, 20 ahead and zero behind. The separate main checkout is already current. The unrelated untracked `.codex/environments/` remains untouched.

## Agreed presentation boundary

The architect confirmed that `MapEditorLayout`, `WorkspaceResizablePanel` and the header presentation can be reused without mounting GM hydration, commands or persistence. The player workspace consumes only the validated public document. GM-specific Hierarchy, Inspector, search and viewport owners are not reused. Embedded Warden preview remains an embedded consultation.

The direct player route currently misses styles loaded only by `BaselinePage`; load the shared presentation stylesheet globally without loading the editor itself. Keep the current palette and local typography. Replace the centered, height-limited loaded view with a full workspace; retain file admission, safe errors, clean JSON fallback, hash replacement, cancellation and per-tab isolation.

Fit only the live camera to public bounds and measured viewport size, with a maximum fit magnification of one CSS pixel per world unit. Keep exported SVG/PNG geometry unchanged. Verify usable desktop/compact panels, focus, pan/zoom, sparse-marker scale and long public text.

## System opening clarification

The approved rule remains that only a Revealed system includes an internal public map and can open; a Known type child alone does not open its parent. The user has been asked through the integrated mechanism whether to keep this rule with clearer guidance or also allow anonymous Known type systems to open. No disclosure rule changes before that answer. UI work proceeds independently.

## Verification

The maintained desktop regression reproduced the reported width restriction before implementation: at a 1440px viewport the public system map is 1280px wide, failing the required minimum of 1424px. Evidence: `test-results/player-workspace-layout-red-frozen.log`, owned `local-test-2026-11-04T11-10-56-493Z-13904/playwright-run-1`. The preceding launcher was invalidated by an unidentified filesystem event before assertions; it is not counted as the RED.

Implementation, affected reader/link/preview/editor checks, types/lint, production direct-entry evidence and independent review remain pending. Coordinator owns Git, runtime/browser operations and integration; source and test specialists have disjoint ownership.

### Implementation and focused correction record

Local candidate `7c50f673` adds the public workspace presentation, shared header/layout and global presentation stylesheet, DTO-only panels and live fit sizing. `eeff2d14` retains clean-link/file-mode ownership, adapts maintained public-panel journeys and fixes camera-control placement. No source schema, projection, transport format, GM writer or history behavior changed.

Full Nuxt types and full lint passed. The first preparation exposed a duplicate auto-imported type name; the composable's redundant type re-export was removed and regeneration no longer reports it. Full-source incremental types and affected lint passed after correction. Four pure fit/image-bound assertions passed in a frozen owned run (`player-workspace-fit-frozen.log`). An earlier four-assertion pure run was invalidated by concurrent source editing and is not counted as successful qualification.

The expanded browser fixture initially used invalid public object IDs, then an incorrect automatic banner-role assumption for the nested shared header. Those are test setup/locator failures, not application failures; the maintained width RED above remains the original feature reproduction. Fixtures now use admitted `object-N` IDs, generic Known type labels and the actual shared header.

Early captures and native geometry then confirmed the review finding: an in-flow camera-control row pushed SVG bottoms to 915px at a 900px desktop viewport and 665px at a 650px compact viewport. Controls overlapped the floating toolbar. Workspace-only absolute SVG placement and bounded bottom-center controls fix those layout mechanisms while preserving embedded preview DOM and camera ownership. The architect verified the remaining centered space between bounded desktop panels accommodates the controls.

The outer workspace frame is eight pixels per side. Geometry checks now compare the SVG to the real board width and require it to remain below the header and inside the viewport, rather than incorrectly excluding the component border with a guessed width margin. The redundant one-pixel cluster-renderer border is removed only in workspace mode, so its SVG fills the complete board. Captures/measurements: `player-workspace-layout-geometry.log`, `player-workspace-layout-green.log`, `player-workspace-layout-board.log` and their separate owned reports.

The latest two-case run passed frame sizing, theme changes and public inspection before encountering test-harness mismatches: native pointer cancellation suppresses compatibility mouse events, and an inert toolbar is correctly excluded from role queries while a compact dialog is open. The shared native mouse-input helper now supports explicitly observing pointer events while keeping the default mouse observation for existing callers. Compact assertions use the active dialog's controls and retain return-focus assertions. No forced click, increased timeout, retry or relaxed private-data assertion was introduced. These latest changes still need replay.

Independent review found no GM hydration/persistence dependency or disclosure-gate change. Source layout and clean-link findings were addressed. Its remaining pre-hydration test mismatch is corrected by checking the visible file action's readiness while retaining the hidden input's disabled/enabled and real-loading assertions. Final review closure and production build remain pending.
