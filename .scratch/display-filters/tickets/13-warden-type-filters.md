---
title: Filter Warden system maps by type
status: closed
assignee: coordinator
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 13 — Filter Warden system maps by type

## Parent

[Display filters for the Warden and player consultation](../spec.md)

## What to build

A Warden can focus a crowded star-system map on selected object types from the upper map toolbar. The map dims nonmatches while preserving the relationships and interactions needed to use the whole system.

## Blocked by

None.

## Acceptance criteria

- [x] A keyboard- and touch-accessible **Filters** button next to Search opens an anchored desktop panel or a scrollable compact panel with a visible close action. Explicit close or Escape returns focus to the available opener.
- [x] Offer each catalogue subtype and each user-named Other subtype as a separate option grouped by family. Keep native and custom types with the same displayed name distinct. Any selected Type value matches. An empty selection leaves Type unrestricted.
- [x] Apply valid edits immediately. Show one active criterion for the Type facet regardless of the number of selected types. Include the count in the accessible control name. Removing Type or using **Clear all** in the panel restores normal opacity immediately.
- [x] Dim the object and its selection treatment when it falls outside the criteria. Preserve all Orbit rings at normal opacity, the complete Hierarchy with accessible dimming cues, and the existing Inspect, pointer, touch, keyboard, Move, Add, hit testing and placement behavior.
- [x] Keep the active Type criterion across star systems and round trips through the Jump Cluster. When a populated system has zero matches, dim every object and keep the active selection editable in Filters. Use the ordinary empty-map state for an empty system.
- [x] Treat the criterion as session view state. Fresh editor entry, reload, workspace replacement and recovery begin unfiltered. Copy import and Undo or Redo within the same workspace retain the active Type criterion. Filter edits leave the map's edit history, saved data and JSON format under their existing contracts.
- [x] **Fit** includes all objects and Orbits. The Warden's SVG and PNG exports include the complete committed system at normal opacity while the live editor retains its filter.

## Verification

Use deterministic cases for type identity and empty or nonmatching selections. Use a representative browser path for the panel, accessible count, dimming, retained interaction and reset. Extend existing focused coverage for session lifetime and full-opacity exports.

## Resolution

The Warden can select catalogue types and named Other types from the system map toolbar. Filters stay active across systems for the current editor session. Dimming preserves the complete Hierarchy, Orbit rings, selection and map interaction. SVG and PNG export the complete system at normal opacity.

The system export journey checks live dimming and both image outputs. A separate Chromium run verified keyboard focus return, feedback when no objects match, retention across systems, copy import and Undo or Redo, and reset after reload and backup restoration.
