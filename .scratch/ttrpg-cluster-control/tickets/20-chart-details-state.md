---
title: 20. Clarifying the Chart Details action
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 20. Clarifying the Chart Details action

## What to build

As a Warden, I can tell whether Chart Details is the active view or an action, so that its purpose is clear and activating it has an understandable result.

## Acceptance criteria

- When an object, Orbit, or route is selected, activating Chart Details visibly returns the inspector to chart-level details.
- When chart-level details are already active, the control clearly communicates that state or is presented as a non-interactive label.
- Chart-level information, when present, is clearly distinguished from the selected object's details.
- The state is keyboard accessible and remains synchronized with the selected map entity.

## Blocked by

- None.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)

## Resolution

Both the system and Jump Route inspectors now expose a keyboard-accessible Chart Details button with `aria-pressed` and visible active styling synchronized to the current selection. Activating it clears any selected object, Orbit, or route and returns the inspector to chart-level details. The cluster control is hidden while a route draft is open so it cannot discard unsaved route input.
