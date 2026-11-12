---
title: Choose player filter capabilities and ownership
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Choose player filter capabilities and ownership

## Question

What may a reader filter in the standalone player view and in the Warden's player preview? Decide who controls the choices and defaults, which already published attributes can drive options, and what survives navigation, reload or replacement of the published document. If a candidate attribute would need new disclosure, identify the separate publication decision it requires.

Use two cases to test the boundary. A Known type marker has a published classification, while an Unknown presence may have a private type in the Warden workspace. Also consider a published object whose assigned Field value was omitted by publication. Define safe behavior for options, counts, empty states and filter combinations using only the public document. The [publication ADR](../../../docs/adr/0002-player-publication-boundary.md) defines the input boundary for both views.

## Current behavior

- The [public object model](../../../domain/player-projection.ts#L41) gives Known type and Revealed objects a public family and subtype. Unknown presences, including public placeholders for required Orbit hosts, use a generic label and geometry. Only Revealed objects can carry [published Field assignments](../../../domain/player-projection.ts#L338).
- A public Field assignment has a name, a kind and a value. The [public codec](../../../domain/player-codec.ts#L659) carries those properties. An absent value can come from several private states. Two Field definitions can also produce the same public name and kind, because the document omits source definition identity.
- [The shared player document view](../../../components/PlayerDocumentView.vue#L352) owns local consultation state in both reader and preview. It [resets](../../../components/PlayerDocumentView.vue#L433) on deactivation or replacement of the document. The [publication ADR](../../../docs/adr/0002-player-publication-boundary.md#standalone-documents-and-reader-lifetime) describes standalone file and link reload and the independent public export formats.

## Blocked by

None.

## Resolution

Confirmed on 2026-11-06.

- The player controls filters in the standalone reader. The Warden controls a separate set in the player preview. Each consultation starts unfiltered and retains its own settings while navigating within the same document. Reloading, reopening the preview or replacing the document starts a fresh consultation. Shared JSON and links open as fresh consultations.
- The filters apply to objects in published star-system maps. The choices are available in both the reader and preview. Jump Cluster navigation retains its existing scope.
- Build type choices from public family and subtype. Offer **Type not revealed** when the document contains Unknown presences. It matches their public marker category, including placeholders for required Orbit hosts. Other type choices match the published type of a Known type or Revealed object.
- Build Field criteria from assignments present in the current player document. Use the [Field value operators](12-field-filter-rules.md) for those public kinds and build choice lists from observed public assignments. Every Field condition requires a published value that satisfies it. Keep absence as one outcome and omit the **No value** operator from player filters.
- A public Field criterion groups assignments with the same public name and kind. When an object has several such assignments, any one published value that satisfies the condition is enough. Use the public kind to distinguish same-named criteria with different kinds.
- Apply the [Warden combination rule](06-combination-rules.md) to public Type and Field criteria. Alternatives within a choice use OR, and active conditions combine with AND. Derive options, matches, counts and empty states entirely from the published document. The existing publication policy governs which information reaches it.
