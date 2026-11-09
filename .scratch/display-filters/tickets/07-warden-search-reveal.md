---
title: Resolve Warden search activation under filters
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Resolve Warden search activation under filters

## Question

What should happen when Warden Search finds an object in another system and a filter dims either that object or part of its hosted branch? Decide which results remain discoverable, what is signaled before activation, and which objects are framed and emphasized. Compare retaining the dimming, temporarily restoring normal opacity and offering an explicit filter change. If a temporary emphasis applies, define when it ends. Test the proposed contract against repeat activation, filter changes, a rejected or stale transition and compact-screen focus.

The [global-search contract](../../global-search/spec.md) uses Apply/Discard/Stay guards and frames the chosen object with its recursively hosted Orbits and occupants. The [current renderer](../../../components/SystemMap.vue#L565) requires measurable glyph bounds for each object in the branch. Include a case where the target matches the filters and only a descendant is dimmed. Check that dimmed marks still supply the bounds required for complete-branch framing.

Ordinary selection leaves the target and its selection treatment dimmed. Decide whether search activation uses that same presentation or needs a temporary exception to make the framed result easy to locate.

## Current behavior

- [Search matches names and location keys across the workspace](../../../utils/workspace-search.ts#L108). An activation [resolves draft guards](../../../composables/editor-workflows/useEditorNavigation.ts#L529) and waits for [the destination layout to settle](../../../components/BaselinePage.vue#L740), including compact Search and keyboard dismissal, before it frames and focuses the map. Repeat activation reframes. Rejected and stale requests preserve the guarded navigation contract.
- [Glyph measurement](../../../components/SystemMap.vue#L523) reads SVG bounding boxes and stroke widths. Dimming that changes only opacity leaves those inputs available. Removing glyphs can leave the branch without the bounds it needs.

## Blocked by

- [Decide how Warden filters affect dependent geometry](05-warden-dependent-geometry.md)

## Resolution

Confirmed on 2026-11-06.

- Warden text search continues to find matching objects across systems regardless of map dimming. Both dimmed and undimmed results use the ordinary ranking and result-row presentation.
- Activating a result frames the entire hosted branch, including dimmed descendants and Orbit rings. A dimmed descendant still contributes its glyph bounds when the target itself matches the filters.
- After successful framing, a dimmed target receives a brief separate locator. Object opacity, selection dimming and active map filters retain their normal behavior throughout. The locator applies to the target only and clears on the first deliberate map interaction, such as a click, tap, pan, zoom or map keyboard command. The activation's own focus transfer leaves the locator visible.
- A repeated successful activation can show a new locator after reframing. The locator belongs to the accepted destination and current dimmed target. Changing the destination or selection, removing the target, or restoring its normal opacity clears that ownership. A rejected, stale or superseded activation produces no new locator. In compact layouts, show it after the destination settles and framing succeeds.
- Searching with filter criteria, including with an empty text query, is a separate decision in [Define how Warden Search combines text and filters](11-filtered-workspace-search.md).
