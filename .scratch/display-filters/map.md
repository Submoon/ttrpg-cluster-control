---
title: Display filters and label management
label: wayfinder:map
status: closed
---

# Display filters and label management

## Destination

Reach a specification-ready contract for session-only Warden display filters by type, Player publication and Field value, including the use of filter criteria in Warden Search. Define how the player reader and Warden's player preview let people filter information already present in a published player document.

## Source issue

[Display filters and label management](https://github.com/Submoon/ttrpg-cluster-control/issues/8), fetched on 2026-11-06. The issue is open. Its criteria are an accessible filter panel, controls that toggle visibility, filters that combine with AND logic, and filter state saved with the workspace. It also asks for active-filter feedback, per-type controls and filtering by custom labels, and mentions status as a filter dimension. It is linked to the completed [interface revamp](https://github.com/Submoon/ttrpg-cluster-control/issues/3).

The intake discussion proposed starting with object types and an active-filter indicator. On 2026-11-06 the maintainer extended this local effort to player consultation and Warden Search with filter criteria, including search with no text query when a criterion is active. The GitHub issue describes the original Warden request. Record any implications for its acceptance separately when writing the specification.

The local decision on [filter lifetime](tickets/08-workspace-persistence.md#resolution) differs from the source criterion that saves filter state with the workspace. Record this difference in the specification and when reviewing source issue acceptance.

## Notes

- At the first baseline check after `git fetch origin` on 2026-11-06, the isolated worktree `HEAD`, local `main` and `origin/main` all resolved to `19e4532ca2de3c0906214faa64ab62a6874269b0`.
- A later check on 2026-11-06 fast-forwarded local `main` to `origin/main` at `7e4f6049dae7ab23b952316ab238410c2a714f0f`. This decision work continues in the isolated worktree at `19e4532ca2de3c0906214faa64ab62a6874269b0`. The intervening diff only adjusts the contrast of player Orbit rings.
- [Global search with auto-fit](https://github.com/Submoon/ttrpg-cluster-control/issues/7) is complete. The [search contract](../global-search/spec.md) and [editor architecture](../../docs/architecture/editor.md) establish guarded navigation and complete hosted-branch framing. The current [framing implementation](../../components/SystemMap.vue#L565) needs a measurable visible mark for every object in that branch.
- [The player reader and preview share a document view](../../components/PlayerDocumentView.vue). Their [search](../../utils/player-search.ts) works on the published document. Use the [publication boundary](../../docs/adr/0002-player-publication-boundary.md) when considering controls, option lists, counts, results and exports. Warden display settings and publication decisions have separate lifetimes.
- Use the [domain context](../../CONTEXT.md) for existing terms and the [editor UI guide](../../docs/agents/ui.md) for desktop and compact workflows. Work through the decision tickets with `grilling` and `domain-modeling`. Use `to-spec` and `to-tickets` locally when the decisions support implementation.

## Decisions so far

<!-- Add one linked summary for each closed decision ticket. -->

- [Choose Warden filter targets and surfaces](tickets/01-warden-filter-scope.md) — Shared filters strongly dim nonmatching catalogue objects on star-system maps while keeping the full Hierarchy and access to Inspect.
- [Define the meaning of a status filter](tickets/02-status-meaning.md) — Fields are available for filtering by default, including campaign state recorded in a Field. A separate facet matches the object's configured Player publication.
- [Choose player filter capabilities and ownership](tickets/04-player-filter-contract.md) — Reader and preview each own their session filters for public types and Field values on published system maps.
- [Decide how Warden filters affect dependent geometry](tickets/05-warden-dependent-geometry.md) — Orbit rings keep normal opacity, dimmed objects keep their interactions and selection dimming, and Fit and Warden exports cover the whole system.
- [Define how Warden filter criteria combine](tickets/06-combination-rules.md) — Included alternatives within a facet use OR. Active facets and Field conditions use AND and remain active across systems.
- [Resolve Warden search activation under filters](tickets/07-warden-search-reveal.md) — Text search retains dimmed results and full-branch framing. A locator marks a dimmed target until the first map interaction.
- [Define what filter settings travel with a workspace](tickets/08-workspace-persistence.md) — Warden map criteria live in memory for the current session and reset on recovery or reload. Valid criteria survive map undo and redo.
- [Define active-filter feedback and recovery in the editor](tickets/09-warden-filter-controls.md) — The upper map toolbar shows the active criterion count. A responsive panel applies valid edits immediately and offers individual removal and Clear all.
- [Resolve filtered navigation and framing in player consultation](tickets/10-player-filtered-navigation.md) — Dimmed public objects stay navigable. Search reveals a target at the current zoom, and Fit and images cover the complete published map.
- [Define how Warden Search combines text and filters](tickets/11-filtered-workspace-search.md) — Search uses its own criteria, intersects them with text when present and supports filter-only results ordered by system and object name.
- [Define matching for Field filters](tickets/12-field-filter-rules.md) — Field types have their own value operators and share one criterion for missing or inapplicable values.

## Specification handoff

The decision map closed on 2026-11-06. The [display filters specification](spec.md) consolidates the decisions and defines acceptance scenarios for both audiences. Its [approved implementation tickets](spec.md#implementation-tickets) record the slices and their dependencies.

## Out of scope

- Application implementation during Wayfinding.
- [Define custom labels and their lifecycle](tickets/03-label-lifecycle.md) — A dedicated tag model and lifecycle are outside this effort. Filterable Fields cover the source issue's custom-label request.
- A new player access-control or live synchronization system, and changes to the confidentiality guarantees of the publication boundary.
