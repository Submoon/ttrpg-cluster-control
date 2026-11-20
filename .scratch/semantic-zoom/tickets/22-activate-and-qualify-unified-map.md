---
title: "Activate the unified map in all three product views"
status: blocked
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 22 — Activate the unified map in all three product views

## What to build

Make the continuous map the default behavior in the Warden editor, player preview and standalone reader. Verify the complete product across editing, storage, publishing and exports before finishing the change.

## Blocked by

- [Place the anchor of an imported standalone system](18-place-imported-standalone-system.md)
- [Export all three player map image scopes](20-export-player-map-images.md)
- [Measure and improve semantic zoom performance](21-qualify-semantic-zoom-performance.md)

## Specification and baseline

[Unified map with stable semantic zoom](../spec.md) · [Source issue](https://github.com/Submoon/ttrpg-cluster-control/issues/4)

User stories covered: 1–58 integrated.

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch. Implement against the application baseline after refreshing it.

The refreshed [implementation baseline](../spec.md#source-issue) includes the grouped Map Files menu and the Warden selection halo. Preserve those product behaviors when removing the split-map entry points.

[Continuous Warden routes](15-render-and-inspect-warden-routes.md) provide the existing explicit placement workflow for unresolved destinations. Preserve direct Move dragging on the unresolved marker at activation, including rollback when pinch takes over. Reuse the existing placement command and keep the maintained browser drag journey.

## Acceptance criteria

- [x] The normal product entry points use one continuous D3 canvas per view. Disconnected-map navigation and temporary entry points are retired once their behavior has migrated. No Warden draft or data access leaks into the reader or public image pipeline.
- [x] Verify representative overview-to-detail, keyboard and touch input, multi-system edit followed by undo/redo, saved workspace reopen, reviewed standalone import, legacy backup restore, old player file and link admission, and the three PNG/SVG scopes.
- [x] Confirm valid retained layouts and route attachments persist, same-system legacy routes are cleaned silently, and migration is scoped to legacy data. Current invalid edits and output still respect normal validation and disclosure.
- [ ] Complete the repository's required qualification against the integrated revision. Bind performance evidence to the activated runtime and repeat affected measurements if activation or final fixes change interaction performance.

## Activation evidence

The production runtime at `042667d55af0cd22626d3273e8d30a66045ee436` activates the Warden editor, player preview and standalone reader. The full linked Chrome sweep and focused reruns together passed all 104 browser scenarios across the integrated revisions, reusing successful coverage for unchanged behavior. The final touched paths passed native Warden creation and focus, guarded deletion, compact touch takeover, minimum-width Hierarchy, and Search preview smoke. All 647 isolated tests passed across the suite and the focused rerun of the Windows junction case. Recovery from an IndexedDB write failure passed on the real Nuxt development server. Generated Vue types, lint, the production build, and Markdown links passed.

The browser sweep identified three product fixes. Starting a Jump Route while inspecting a saved object exposes the admitted route form. The Orbit Add status presents radius corrections and successful placement. The Add Orbit map surface avoids native text dragging while preserving pointer focus and keyboard access.

Activation remains blocked on the [device performance acceptance](21-qualify-semantic-zoom-performance.md). The deployed Preview and local automated evidence use the same runtime. The integration tip can also include test and tracker updates.
