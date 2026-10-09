---
title: 27. Scoping custom fields to categories and subtypes
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 27. Scoping custom fields to categories and subtypes

## What to build

As a Warden, I can choose which object categories or subtypes can use each custom field, so details are relevant to the objects I select.

## Acceptance criteria

- A custom-field definition can apply to all map objects or one or more existing catalogue categories/subtypes.
- Existing definitions without an applicability scope retain the current all-objects behavior; newly created definitions default to all objects.
- The field-definition UI can inspect and change applicability, and an object's inspector shows only fields applicable to that object.
- Changing applicability never silently deletes values from objects that become ineligible; values remain intact and can be edited again if the field is made applicable later.
- Applicability settings persist through workspace save/restore and versioned JSON export/import. Compatible definitions with the same name, type, and options are reused and their category/subtype scopes are united on import.
- Deleting a map object does not change category/subtype applicability or clear unrelated field values.
- Verification covers category/subtype applicability, non-applicable fields being hidden, value preservation after scope changes, legacy definitions (including removal of old object targets), persistence, and JSON import/export.

## Blocked by

- None.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [09. Adding native and reusable custom fields](09-object-fields.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
- [19. Implementing field-definition management with a Quick Dialog](19-field-definition-management.md)

## Resolution

- Reusable custom fields target all catalogue objects or selected categories and subtypes; values remain stored when a field is hidden.
- Legacy object targets are removed when restoring saved workspaces or importing JSON while category/subtype scopes and field values are preserved. Compatible definitions reuse the existing field and unite their category/subtype scopes; an unscoped definition remains global.
- Validation passed: `npm run typecheck` and `npm run test` (35 Playwright tests).
