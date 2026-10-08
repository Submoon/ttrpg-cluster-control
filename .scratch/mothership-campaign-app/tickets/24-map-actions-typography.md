---
title: 24. Improving text readability in Add Object and Map Files
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 24. Improving text readability in Add Object and Map Files

## What to build

As a Warden, I can comfortably read the Add Object and Map Files sections, so their map-editing and file actions are easy to use.

## Acceptance criteria

- Increase the small headings, action labels, and supporting text in the Add Object and Map Files sections to a comfortably readable size.
- Preserve the visual hierarchy between section headings, categories, and actions without changing unrelated global typography.
- Keep all labels and controls visible and usable at narrow and short viewport sizes, without clipping, overflow, or overlap with map controls.
- Maintain readable contrast and visible keyboard-focus states.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [16. Making the workspace darker and more map-first](16-map-first-visual-refresh.md)
- [17. Moving map import and export actions into the header](17-header-import-export.md)

## Resolution

Raised Add Object and Map Files typography without changing global styles, and kept their controls readable and unclipped in compact layouts. The Map Files actions scroll within a bounded panel, and short-height Add Object layouts keep the palette clear of map navigation.

Validation: `npm run typecheck`; `npm test` (28 passed).
