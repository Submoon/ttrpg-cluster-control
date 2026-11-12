---
title: Define how Warden filter criteria combine
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define how Warden filter criteria combine

## Question

What is the result of selecting multiple values within each facet and combining facets with the AND behavior required by the source issue? Specify which criteria mark objects as matching or dimmed, how an empty facet behaves, and how Field matches combine with type and Player publication. Use a table of expected matches for stars and planets with different publication modes and Field values. Include an active user-named type that occurs in another star system but is absent from the current one.

## Current behavior

- An [object's type](../../../domain/workspace-model.ts#L87) has a family and subtype. A user-named Other subtype can have the same displayed name as a native type. Existing [Field applicability](../../../domain/workspace-fields.ts#L157) distinguishes family and subtype and applies the same identities across systems.
- [Field matching](12-field-filter-rules.md) defines the result of each value test, including the shared **No value** condition for missing or inapplicable values. [Player publication](02-status-meaning.md) matches the mode configured on the object.

## Blocked by

- [Choose Warden filter targets and surfaces](01-warden-filter-scope.md)
- [Define the meaning of a status filter](02-status-meaning.md)
- [Define matching for Field filters](12-field-filter-rules.md)

## Resolution

Confirmed on 2026-11-06.

- The Type and Player publication facets each accept multiple included values. Any selected value satisfies its facet. An empty selection leaves that facet unrestricted. Type matches use the existing family and subtype identity across systems, so an Other subtype named Planet and the native Planet type remain distinct.
- Each Field can contribute one active condition. An **Is** condition for a single-select Field can include several allowed choices, and any one of those choices satisfies the condition. Each object still stores a single choice for the Field. The [Field operator decision](12-field-filter-rules.md) governs missing and inapplicable values. A Field without an active condition is unrestricted.
- The active Type facet, the active Player publication facet, and every active Field condition combine with AND. An object that satisfies all of them stays at normal opacity. The rest are dimmed.
- The same criteria stay active across star systems. If Relay is the only included type and the current system contains no Relay, all of its objects are dimmed. An absent option in the current system has the same matching rule as any other selected option.

For example, the Warden selects Planet or Moon, Revealed or Known type, `Danger ≥ 3`, and Campaign state **Is** Abandoned or Damaged.

| Type | Configured publication | Danger | Campaign state | Result |
| --- | --- | ---: | --- | --- |
| Planet | Revealed | 3 | Abandoned | Normal opacity |
| Moon | Known type | 4 | Damaged | Normal opacity |
| Star | Revealed | 3 | Abandoned | Dimmed |
| Planet | Hidden | 3 | Abandoned | Dimmed |
| Planet | Revealed | 2 | Abandoned | Dimmed |
| Planet | Revealed | 4 | Operational | Dimmed |
| Planet | Revealed | Unset | Damaged | Dimmed |
