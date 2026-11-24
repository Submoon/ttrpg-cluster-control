---
title: "Activate the unified map in all three product views"
status: closed
assignee: Codex
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

Planning baseline: `dc5edb282087458c1bc6dd26287c96a974662c3b` (`main` and `origin/main` after fetch on 2026-11-16). The local planning checkout retains the prototype branch.

Implementation comparison: `6f2ce0690c344cbb6052a785cba672481d47032`; the refreshed `origin/main` baseline was `48873799dac97b84856db676176b5c6b869b5620`. The activated runtime was measured at `f4e1cff97cae2ec92b76812bef4c5899dd9199ff`; integrated candidate `627cc06852b1db0d1bea5cf081dca7122708523e` contains the type-only selector correction.

The refreshed [implementation baseline](../spec.md#source-issue) included the grouped Map Files menu and the Warden selection halo; the activated implementation retains both.

The [continuous Warden route workflow](15-render-and-inspect-warden-routes.md) retains explicit placement for unresolved destinations, direct Move dragging on the unresolved marker, and rollback when pinch takes over. The maintained browser drag journey covers the same command.

## Acceptance criteria

- [x] The normal product entry points use one continuous D3 canvas per view. Disconnected-map navigation and temporary entry points are retired once their behavior has migrated. No Warden draft or data access leaks into the reader or public image pipeline.
- [x] Verify representative overview-to-detail, keyboard and touch input, multi-system edit followed by undo/redo, saved workspace reopen, reviewed standalone import, legacy backup restore, old player file and link admission, and the three PNG/SVG scopes.
- [x] Confirm valid retained layouts and route attachments persist, same-system legacy routes are cleaned silently, and migration is scoped to legacy data. Current invalid edits and output still respect normal validation and disclosure.
- [x] Complete the repository's required qualification against the integrated revision. Bind performance evidence to the activated runtime and repeat affected measurements if activation or final fixes change interaction performance.

## Historical activation evidence

The production runtime at `042667d55af0cd22626d3273e8d30a66045ee436` activates the Warden editor, player preview and standalone reader. The full linked Chrome sweep and focused reruns together passed all 104 browser scenarios across the integrated revisions, reusing successful coverage for unchanged behavior. The final touched paths passed native Warden creation and focus, guarded deletion, compact touch takeover, minimum-width Hierarchy, and Search preview smoke. All 647 isolated tests passed across the suite and the focused rerun of the Windows junction case. Recovery from an IndexedDB write failure passed on the real Nuxt development server. Generated Vue types, lint, the production build, and Markdown links passed.

The browser sweep identified three product fixes. Starting a Jump Route while inspecting a saved object exposes the admitted route form. The Orbit Add status presents radius corrections and successful placement. The Add Orbit map surface avoids native text dragging while preserving pointer focus and keyboard access.

This staged activation evidence predates ticket 21’s accepted web-only performance closeout. See [ticket 21](21-qualify-semantic-zoom-performance.md) for its measured desktop results and physical-device waiver.

## Resolution

The continuous map is active in the Warden editor, Player Preview, and Player Reader. [Performance qualification](21-qualify-semantic-zoom-performance.md) records the agreed web scope, measured desktop exceptions, and physical-device waiver. The SVG selector annotation at `627cc068` preserves the JavaScript and template measured at `f4e1cff9`.

The [integrated CI workflow](https://github.com/Submoon/ttrpg-cluster-control/actions/runs/45418361662) on `627cc06852b1db0d1bea5cf081dca7122708523e` passed lint, typecheck, build, 707 checks, the Preview smoke check, and all 20 browser journeys across two shards on the exact Vercel Preview.
