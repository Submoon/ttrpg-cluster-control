---
title: 20. Clarifying the Chart Details action
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
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

- [Mothership Campaign App - V1 Specification](../map.md)
- [03. Prototyping the Jump Cluster and system-map editor](03-map-editor-prototype.md)
