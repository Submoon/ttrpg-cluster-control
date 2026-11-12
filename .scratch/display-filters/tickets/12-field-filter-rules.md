---
title: Define matching for Field filters
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define matching for Field filters

## Question

Which operators should the Warden be able to use with the native and custom Fields already offered by the editor? Fields are available by default. Decide what matching means for text, number, boolean and single-select values, including whether the Warden can filter for an unset value.

Use a Field limited to Stations to distinguish a Station with no assigned value from a Planet to which the Field does not apply. Use a numeric comparison such as Danger at least 3 and a single-select choice such as Campaign state equals Abandoned to test the criteria. Define the expected match for each case before combining it with other facets.

## Current behavior

- Native Atmosphere applies to planets and moons, and Port class applies to Installations. Custom Fields have [separate applicability and assignment](../../../domain/workspace-fields.ts#L157). A change of scope can leave a value stored for an object to which the Field currently does not apply.
- [Inspector parsing](../../../composables/editor-workflows/entity-draft-validation.ts#L16) treats zero and false as values and removes cleared text. The [stored value validator](../../../domain/workspace-validation.ts#L72) also accepts text strings that contain only whitespace or are empty, which can occur in restored or imported data. Controlled choices keep their configured values.

## Blocked by

None.

## Resolution

Confirmed on 2026-11-06.

| Field kind | Value operators |
| --- | --- |
| Text | Contains, equals, does not contain. Matching is case- and accent-insensitive. |
| Number | `=`, `≠`, `<`, `≤`, `>`, `≥`, and between with both endpoints included. |
| Boolean | Is Yes or is No. |
| Single-select, including native controlled choices | Is the selected configured choice. |

Every Field also offers one **No value** criterion. It matches an applicable Field with no assigned value and an inapplicable Field, even if a former assignment remains stored. Treat empty and whitespace-only stored text as missing for filtering. Zero and false are assigned values.

All value operators require an applicable Field with an assigned value, including numeric inequality and text exclusion. For example, a Station with no Danger value and a Planet outside that Field's scope both match **No value**. A Station with Danger `0` can match `Danger < 3`. A text Field with no value has its own **No value** match, while `does not contain wreck` applies to assigned text. The existing choice `Abandoned` matches `Campaign state is Abandoned`.
