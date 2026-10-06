---
title: 19. Implementing field-definition management with a Quick Dialog
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 19. Implementing field-definition management with a Quick Dialog

## What to build

As a Warden, I can manage native and reusable custom field definitions from the active map in a Quick Dialog, so that definition changes stay close to campaign editing without mixing with per-object value editing.

## Acceptance criteria

- The map editor opens the selected Quick Dialog (solution C) without navigating away from the active map; closing it returns to the same map and selection.
- The dialog lists native and reusable custom field definitions and supports adding, editing, and removing definitions and their allowed values or options.
- Editing a definition or option previews affected existing object values when applicable and requires explicit confirmation before applying changes that may alter saved values. Canceling leaves definitions and values unchanged; confirmed changes do not cause silent data loss.
- Field-definition and object-value changes persist through workspace save/restore and versioned JSON import/export.
- The dialog is keyboard accessible, including a clear close action and sensible focus handling.
- After the real implementation is integrated and validated, the development prototype is no longer reachable through the dedicated `/prototype/field-definitions` route. If its source is retained for reference, move it outside Nuxt's auto-routed `pages/` tree and update its link in ticket 18.
- Verification covers add/edit/remove flows, affected-value preview and confirmation, persistence and JSON round-trips, keyboard interaction, and direct access to the retired prototype route.

## Blocked by

- [18. Prototyping field-definition management](18-field-definition-management.md)

## Resolution

- Added a map-bound Quick Dialog for native and reusable custom field definitions, with custom-field creation, renaming, removal, and editable single-select options.
- Changes that clear assigned values show affected objects and require explicit confirmation; canceling preserves saved data.
- Workspace restore and versioned JSON preserve definitions and values. The prototype source is outside Nuxt's routed `pages/` tree, and its former route returns 404.
- Validation passed: `npm run typecheck` and `npm test` (24 Playwright tests).

## Source specs

- [Mothership Campaign App - V1 Specification](../spec.md)
- [18. Prototyping field-definition management](18-field-definition-management.md)
- [Quick Dialog prototype source](../field-definition-prototype.vue)
- [09. Adding native and reusable custom fields](09-object-fields.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
