---
title: 18. Prototyping field-definition management
label: wayfinder:prototype
type: prototype
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 18. Prototyping field-definition management

## Question

How should a Warden manage native and reusable custom field definitions without crowding the map editor? The user suggested opening a separate page for definition management.

## Prototype

Prototype a focused field-management view reachable from the map editor. Compare a dedicated page with a focused panel or dialog, and demonstrate listing, adding, editing, and removing field definitions and their options.

The development-only prototype source is retained in [`field-definition-prototype.vue`](../field-definition-prototype.vue) for reference. Its `/prototype/field-definitions` route was retired when the Quick Dialog was implemented in ticket 19. The prototype used sample data that reset on reload.

**Preferred direction: C — Quick dialog (user preference).** Keep field management close to the map while separating reusable-definition edits from object-value editing. Preserve the existing-value preview and explicit confirmation for changes that could affect saved values.

## Acceptance criteria

- The prototype makes definition management distinct from editing an individual object's field values.
- It demonstrates the current native and custom field types, including their allowed values or options.
- It shows how changes and removal affect existing object values without implying silent data loss.
- The recommended interaction is documented with a clear path back to the map editor.

## Blocked by

- None.

## Resolution

The user selected solution C, the Quick Dialog, because it keeps reusable field-definition management close to the map while separating it from object-value editing. The selected design retains previews of affected existing values and explicit confirmation for changes that could alter them. Product implementation is tracked in [19. Implementing field-definition management with a Quick Dialog](19-field-definition-management.md).

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [09. Adding native and reusable custom fields](09-object-fields.md)
