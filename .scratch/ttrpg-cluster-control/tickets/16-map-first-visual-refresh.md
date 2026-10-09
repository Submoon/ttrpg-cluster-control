---
title: 16. Making the workspace darker and more map-first
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 16. Making the workspace darker and more map-first

## What to build

As a Warden, I can work in a space-inspired interface where the map is the main surface, so that the campaign chart feels immersive and has room to grow.

## Acceptance criteria

- The page chrome uses a dark, near-black space-inspired palette while retaining readable text, clear focus indicators, and visible selected, disabled, and error states.
- The active map fills the available editor viewport; Jump Cluster and active-system names and object counts appear in the shared application header, outside the SVG.
- Both map views support zoom from 25% to 1600% with unbounded panning.
- The hierarchy and inspector are collapsible floating panels with directional controls; opening and closing them is animated, and on narrow screens opening one panel closes the other.
- The system object palette and Add Orbit action float above the map canvas below the shared header summary. Compact category buttons show one object group at a time, scrolling horizontally when needed to keep actions visible on short and narrow screens without covering the summary or map navigation. Object marks use the same type glyphs as the palette.
- The Cluster map control has an opaque background; export controls stay compact, within the viewport, and do not shift when object-placement state changes.
- Pressing Delete removes the selected object, Orbit, or Jump Route while preserving deletion confirmation; focused text and form controls remain safe to edit.
- The layout remains usable at narrow viewport widths without horizontal overflow or inaccessible map controls.
- Map labels, symbols, and exported maps remain legible against their backgrounds.

## Blocked by

- None.

## Resolution

The map editors zoom from 25% to 1600% with unbounded panning, and the SVG fills the available canvas. Both side panels animate open and closed. Jump Cluster and active-system names and counts appear in the shared application header, outside the SVG; the former floating summary cards are removed. The compact object palette remains over the map below the header, with horizontally scrollable category buttons that reveal one object group at a time. Add Orbit remains with the object actions, and the palette background lets map interactions pass through. Header summaries, zoom controls, and panel toggles stay clear of the palette, and export actions remain in a separate compact bar. Map objects use the same glyphs as the palette, and the Cluster map button has an opaque background. Delete removes the selected object, Orbit, or Jump Route through the confirmation flow, while keyboard input remains safe in editable fields.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
- [10. Navigating and arranging both map views](10-map-navigation.md)
- [11. Safely deleting dependent map entities](11-safe-dependent-deletion.md)
