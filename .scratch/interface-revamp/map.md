---
title: "Revamp the interface: make the map central on desktop and mobile"
label: wayfinder:map
status: open
---

## Destination

An analysis, decisions, and a UI redesign specification ready to prepare implementation: a map-first, responsive, touch-friendly interface, light/dark themes, and preservation of all existing functionality. Related issues are coordinated separately; this effort establishes their coherence without implementing them.

## Source issue

[Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3), refreshed read-only on 2026-10-15 before closing the mobile Fields decision, open, `enhancement`, `priority:P1`, no comments; requirements unchanged. Requirements: research a considered modern design, responsiveness, a touch-usable map that is prominent on mobile, and preservation of functionality; an explicit, remembered light/dark control, coherent UI/map palettes, readable states, and legible SVG/PNG exports. A tool-based approach, compact icons, and Nuxt UI are to be evaluated. Resolved choices follow the indexed contracts; the Nuxt UI prototype direction is conditional, with final adoption awaiting actual evidence and a later human decision.

## Notes

- Human-confirmed scope: “UI redesign, with related issues coordinated separately.”
- Analysis: `gpt-6.1-sol`, effort `high`. Later implementation: subagents `gpt-6-luna`, effort `xhigh`.
- Resumption baseline, 2026-10-15: fresh origin fetch confirms the intentionally different planning/preview branch `codex/interface-revamp` at `19755c750560723429555a9a92c55a554dbd6360`, matching its remote branch, 8 ahead / 0 behind `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. Unrelated `.codex/` and server logs are preserved. Earlier baseline statements describe their dated captures.
- Baseline and risks: [Provisional analysis of the interface revamp and its dependencies](analysis.md), a static audit with a preservation matrix and source-code references.
- Local planning only. No product changes, GitHub writes, or implementation tickets in this planning effort.
- Inspected baseline: local `main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`, confirmed again by the root's fresh fetch on 2026-10-14 with `HEAD == origin/main`, zero commits ahead/behind; the earlier divergence is no longer current. Existing local AGENTS/planning changes and unrelated files are preserved. Product identity, storage/interchange compatibility, and merged Orbit host-minimum and snapshot-recovery corrections remain part of the baseline to preserve.
- Read `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`, `CONTEXT.md`, and the V1 effort `.scratch/ttrpg-cluster-control/`.
- Skills: `wayfinder` for the effort, `grilling` and `domain-modeling` for human decisions, `prototype` for visual/interaction direction, and `research` for external facts.
- HITL choices are resolved only with the user. Only documented resolutions go in the index; scope is recorded in Destination/Notes.
- Completed analysis, 2026-10-15: the human confirmed the complete mobile Fields flow; its closed decision is indexed below. Fresh fetch before closure confirms branch `codex/interface-revamp` at `d756cf8b3e44a6015e304a44c7db62884ea5d662`, matching its remote, 0 main-only / 12 branch-only versus `origin/main` at `629d2a98715c3a16b954e0f77c639b1f0c31212c`; source issue unchanged and open. [Validate the mobile Fields flow in the B prototype](tickets/16-prototype-mobile-fields-flow.md) is prepared, open and unclaimed; no code work starts from this closure. The human's [Dock phone follow-up](research/dock-feedback-2026-10-15.md#human-phone-follow-up) retains context-banner reuse for mobile Add status as a separate future refinement. [The controls presentation](tickets/12-decide-controls-presentation.md) remains in progress and [focused tools validation](tickets/15-prototype-resolved-tools-contract.md) retains its dependency. Agent tests use local `npm run dev`; Vercel supplies the human's phone preview.

- Current prototype, 2026-10-15: [Validate the mobile Fields flow in the B prototype](tickets/16-prototype-mobile-fields-flow.md) is claimed as `codex-prototype-mobile-fields`. The human explicitly requests the runnable Fields iteration. [The prototype report](research/fields-prototype-2026-10-15.md) records the refreshed `c9ba3f3f` baseline, SOL architecture/reviews, Luna XHIGH implementation and local development evidence as it becomes available. Keep B/Dock and the confirmed Fields flow; compare only command placement within Fields. The saved-workspace editor, Inspector-form decision and Add-banner refinement remain separate.

## Decisions so far

- [Set the revamp's navigation boundary against future semantic zoom](tickets/01-map-navigation-boundary.md): retain separate maps, open systems directly outside a drag, show context and explicit return, and restore each view's temporary zoom/pan and valid selection; unified-map implementation remains separate.
- [Evaluate Nuxt UI for the revamp without destabilizing map rendering](tickets/02-nuxt-ui-fit.md): documentary Nuxt 4/Tailwind 4 compatibility and integration trade-offs established; application behavior, weight, and performance remain unmeasured by this research.
- [Decide touch, mouse, and keyboard map gestures and controls](tickets/03-touch-keyboard-interactions.md): original safe-navigation/editing, targeting, attachment, cancellation and accessible-alternative guarantees; Add lifetime and the mode set are amended by the later tools decision below.
- [Define revamp guarantees for drafts, selection, and saving](tickets/05-editor-state-and-preservation.md): targeted draft exclusion, resumable session drafts, guarded transitions, application distinct from durable saving, visible retry/export after save failure, and non-destructive operation previews.
- [Define the light/dark, accessibility, and export palette contract](tickets/06-themes-accessibility-export.md): OS default then durable local choice, common token palettes without state loss, clean full-scene SVG/PNG with independent light-print option, measurable contrast/focus targets, and useful status relocated from the decorative footer.
- [Decide Nuxt UI adoption and scope](tickets/07-nuxt-ui-adoption.md): broad prototype use, application-owned maps/state/data boundaries, adaptation-first targeted exceptions, and final adoption conditional on representative evidence and human confirmation.
- [Choose a map-first UI direction through desktop and mobile prototypes](tickets/04-map-first-ui-direction.md): human accepts B with the main tool rail, optional nested hierarchy and icon catalogue; mobile Inspect is full-height and exclusive with Hierarchy, the pictured utility toolbar and LIVE MAP badge are removed, and missing library-adoption evidence remains downstream.
- [Measure Nuxt UI integration, offline resources, and comparative performance](tickets/09-measure-nuxt-ui-integration.md): production desktop costs and targeted SSR/theme/portal/offline behavior are measured; cold control icons and theme coordination fail, mobile/gesture comparisons remain partial, and device/preservation evidence plus human library adoption remain downstream.
- [Finalize the tools contract after the Astra interface review](tickets/11-finalize-tools-contract.md): contextual Navigate, Select-to-Inspect, persistent Move and same-type Add without automatic Inspect/context entry; right-drag view pan and two-contact navigation preserve a chosen route origin, while explicit Add exit returns to Navigate.
- [Decide the mobile Fields list-to-editor flow](tickets/13-decide-mobile-fields-flow.md): mobile list → consultation detail → Edit, shared Fields/Manage session resumption, preserved drafts/list position, creation to new detail and deletion to the list; desktop keeps two columns and reachable commands/reviews remain mandatory.

## Not yet specified

- Remaining detailed dialogs beyond the confirmed Fields flow and separately ticketed tools presentation/inspector-form decisions, within accepted B and its full-height mobile Inspect amendment. Exact Fields action placement is now an explicit prototype question, not unspecified fog.
- Exact palette values and status placement beyond pending-placement guidance, plus usability measures within the resolved theme, contrast, focus and state-preservation contracts.
- Specification assembly, criteria for the map area that is actually available, representative data volumes, and coordination conditions with separate fixes, once prototype feedback is known.

## Out of scope

- Product implementation, implementation-ticket breakdown, and GitHub closure during this effort.
- Implementing features from related issues: unified map, undo/redo, multi-selection/groups, search/filters, player export, annotations, and campaign modules. Their requirements inform the coherence of the revamp and have separate efforts.
- [Add keyboard shortcuts for map tools and show them in the toolbox](https://github.com/Submoon/ttrpg-cluster-control/issues/29) is a human-requested later follow-up, explicitly outside this effort. The native GitHub dependency is **blocked by Revamp the interface**; current Fields work retains existing keyboard/focus behavior without implementing these new tool shortcuts.
- Changing the glossary without a human resolution of a term or relationship.
