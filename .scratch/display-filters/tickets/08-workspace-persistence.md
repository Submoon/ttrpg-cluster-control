---
title: Define what filter settings travel with a workspace
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define what filter settings travel with a workspace

## Question

What is the durable contract for the Warden's shared filter settings? The source issue requires filters saved with the workspace. Decide what the workspace-wide settings do across reload, recovery, complete backup, copy import and export, and which changes participate in undo/redo. Use a legacy workspace, an incoming copy with same-named Fields, and a saved filter that references a removed Field or choice as acceptance scenarios.

The [editor architecture](../../../docs/architecture/editor.md) separates temporary Pinia state from the validated workspace writer, history and ordered IndexedDB saves. The [publication ADR](../../../docs/adr/0002-player-publication-boundary.md) distinguishes the private workspace format and player documents.

## Current behavior

- [Browser saves](../../../utils/workspace-storage.ts#L107) write the workspace and retain the previous valid snapshot. [Recovery](../../../utils/workspace-storage.ts#L143) validates the backup and replaces the browser's current workspace with it.
- [Warden JSON](../../../domain/workspace-codec.ts#L11) exports a portable cluster or star-system map, with shared Field definitions and relevant layout. [Import](../../../domain/workspace-json-import.ts#L522) appends an independent copy to the current workspace. Compatible same-named custom Fields can reuse a destination definition, and imported assignments follow the resulting ID mapping.
- [Undo and Redo](../../../composables/editor-workflows/workspace-mutations.ts#L830) currently restore encoded workspace snapshots. The filter decision needs to say whether the settings follow that history or survive map undo and redo.

## Blocked by

- [Define how Warden filter criteria combine](06-combination-rules.md)

## Resolution

Confirmed on 2026-11-06.

- Warden map filters are session-only view settings. The active Type, Player publication and Field criteria remain available while navigating the same workspace. Opening a fresh editor session, reloading the page, replacing the workspace or restoring a recovery snapshot starts with an empty filter set.
- Filter state lives in memory. Browser saves, recovery snapshots, and cluster and system JSON files contain map data. A successful copy import into the open workspace keeps its active filters and applies them to the resulting map. The import continues to resolve Field references using the destination workspace's definitions.
- Undo and Redo act on map changes. They preserve the current filters whose criteria remain valid in the resulting workspace. Changing or resetting filters creates no history entry.
- Revalidate active criteria when a Field definition or controlled choice changes, including during history traversal. Remove an invalid Field condition or invalid selected choices and inform the Warden. Preserve valid choices and unrelated criteria. If an **Is** condition loses its last choice, remove that condition. A valid criterion can stay active when it matches zero objects.

This session-only behavior differs from the [source issue's workspace-persistence criterion](https://github.com/Submoon/ttrpg-cluster-control/issues/8). Carry the difference into the specification and source issue acceptance review.
