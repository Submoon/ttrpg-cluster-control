---
title: Define active-filter feedback and recovery in the editor
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define active-filter feedback and recovery in the editor

## Question

What must a Warden see and be able to do when filters are active, including when every object is dimmed, an active type is absent from the current system or a search result receives temporary emphasis? Decide what the indicator represents, which controls reset individual facets or the whole view, and how the controls are reached and dismissed by touch and keyboard in the compact and desktop editor. Establish how to distinguish dimmed objects and their Hierarchy entries in both themes.

The source issue requires an accessible control surface and active-filter feedback. Use the [editor UI guide](../../../docs/agents/ui.md) to judge panel space, focus return and preservation of ongoing work. Types and active feedback are the proposed first increment.

## Current behavior

- The [shared upper toolbar](../../../components/WorkspaceMapChrome.vue#L83) groups Search and map panel commands across layouts. The [bottom Dock](../../../components/WorkspaceDock.vue#L2) groups tools and Add. [Map Files](../../../components/MapFilesPopover.vue#L2) is an anchored panel precedent.
- The [compact panel layout](../../../components/MapEditorLayout.vue#L147) manages focus ownership, blocks background controls while the panel is modal and restores an available opener. [Search](../../../components/WorkspaceSearch.vue#L36) has an accessible result count and empty state. [Hierarchy](../../../components/MapHierarchy.vue#L127) counts all records independently of map presentation.

## Blocked by

- [Define how Warden filter criteria combine](06-combination-rules.md)
- [Resolve Warden search activation under filters](07-warden-search-reveal.md)

## Resolution

Confirmed on 2026-11-06.

The [current specification](../spec.md#warden-map-presentation-and-session-state) supersedes the original zero-match message and reset controls below after review of the filter panel.

- A **Filters** button sits next to Search in the upper star-system map toolbar. On desktop it opens an anchored panel. In compact layouts it opens a scrollable panel with a visible close command. Support keyboard and touch, use the layout's focus ownership conventions, and return focus to the opener on explicit close or Escape when it remains available.
- The button shows the active criterion count. Type contributes one when it has selections, Player publication contributes one when it has selections, and each active Field contributes one. For example, Planet and Moon plus `Danger ≥ 3` produce **Filters (2)**. The accessible button name communicates the count.
- The panel lists the active criteria and lets the Warden add, edit and remove them. Valid changes apply immediately. During an incomplete edit, the previous valid condition remains active until the replacement is valid or the Warden removes it. Closing and reopening shows the active criteria. A selected type remains visible and editable in the panel when the current system has zero objects of that type.
- Each criterion can be removed independently. **Clear all** is inside the panel and clears the active set immediately without a confirmation step. Clearing the set restores the normal opacity of all map objects.
- When filters are active and a populated system has no matches, show **No objects match** near the map commands with access to Filters, and in the panel. A genuinely empty system retains its empty-map message. During a Search locator, the badge still counts active criteria and the status follows their matches.
- Dimmed objects remain visible on the map in both themes. Hierarchy identifies dimmed entries with accessible text or an accessible marker that remains distinguishable without color alone. Keep the complete Hierarchy and access to Inspect.
