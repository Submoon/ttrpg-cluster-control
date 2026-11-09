---
title: Define custom labels and their lifecycle
status: closed
label: wayfinder:grilling
type: grilling
parent: ../map.md
assignee: Codex
---

# Define custom labels and their lifecycle

## Question

What does a custom label represent, and what can the Warden create, assign, rename and remove? Compare a reusable tag with a choice in an existing custom Field, a displayed name and a user-named Other type. Settle label identity and scope, multiple assignments, and what happens to assignments and active criteria when a label is renamed or removed. Use one label assigned to objects in two systems to test the lifecycle.

## Current behavior

- [Catalogue objects](../../../domain/workspace-model.ts#L87) have a name, type, location key and optional Field values. A custom single-select Field assigns one choice per object and Field.
- [Field definitions](../../../domain/workspace-fields.ts#L79) use workspace-wide identity and case-insensitive name uniqueness. [Renaming a Field](../../../domain/workspace-fields.ts#L214) preserves its identity and existing assignments. [Deleting a definition](../../../components/FieldDefinitionsDialog.vue#L159) previews the affected assignments and asks for confirmation.
- [Object Field edits](../../../components/inspector/MapObjectInspector.vue#L218) use the Inspector's Apply and Discard flow.

## Blocked by

None.

## Resolution

Confirmed on 2026-11-06. The Warden's existing Fields and their values cover the source issue's request for custom-label filtering. For example, the Warden can define a single-select Exploration state Field with an option such as To explore, assign it to relevant objects and filter on that value. Field creation, assignment, rename and removal follow their existing workflows.

A separate system of reusable, stackable tags and its lifecycle are outside this effort. The [Field operator decision](12-field-filter-rules.md) defines how the existing values match.
