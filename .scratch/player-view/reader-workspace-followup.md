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
