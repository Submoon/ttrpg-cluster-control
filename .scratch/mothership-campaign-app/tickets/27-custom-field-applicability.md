---
title: 27. Scoping custom fields to objects and categories
label: wayfinder:implement
type: implement
status: open
parent: "[Mothership Campaign App - V1 Specification](../map.md)"
---

# 27. Scoping custom fields to objects and categories

## What to build

As a Warden, I can choose which map objects can use each custom field, so details are relevant to the objects or object categories I select.

## Acceptance criteria

- A custom-field definition can apply to all map objects, one or more specific objects, or one or more existing catalogue categories/subtypes.
- Existing definitions without an applicability scope retain the current all-objects behavior; newly created definitions default to all objects.
- The field-definition UI can inspect and change applicability, and an object's inspector shows only fields applicable to that object.
- Changing applicability never silently deletes values from objects that become ineligible; values remain intact and can be edited again if the field is made applicable later.
- Applicability settings persist through workspace save/restore and versioned JSON export/import. Object-specific targets use stable IDs and are correctly remapped when importing an independent copy.
- Deleting an object targeted by a field does not leave a broken reference or clear unrelated field values.
- Verification covers object-specific and category applicability, non-applicable fields being hidden, value preservation after scope changes, legacy definitions, persistence, and JSON import/export.

## Blocked by

- None.

## Source specs

- [Mothership Campaign App - V1 Specification](../map.md)
- [01. Defining the V1 map data model and object catalogue](01-map-data-model.md)
- [09. Adding native and reusable custom fields](09-object-fields.md)
- [12. Exporting clusters and systems as versioned JSON](12-json-export.md)
- [13. Importing JSON as a safe independent copy](13-json-import.md)
- [19. Implementing field-definition management with a Quick Dialog](19-field-definition-management.md)
