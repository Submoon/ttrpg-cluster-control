---
title: Build a shared multi-object selection
status: closed
closed_on: 2026-11-06
assignee: /root/selection_dev
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 01 — Build a shared multi-object selection

## What to build

Let the Warden compose one temporary selection from the star-system map and Hierarchy in Select. Show membership on both surfaces and the count in the open Inspector. Let the Warden use Player visibility for an individual object while the selection is active.

## Blocked by

None. This ticket can start immediately.

## Specification and baseline

[Multiple object selection and collective movement](../spec.md) · [Multiple selection and groups (#6)](https://github.com/Submoon/ttrpg-cluster-control/issues/6)

Parent stories 1–9, 11–12, 14–16, and 32–33.

Worktree and specification baseline **19e4532ca2de3c0906214faa64ab62a6874269b0**. On 2026-11-06, the ticketing comparison used origin/main **7e4f6049dae7ab23b952316ab238410c2a714f0f**. The two-commit difference changes only Orbit contrast in the player view. This ticketing pass uses the existing isolated worktree base. The approved Warden editor scope is applicable at both revisions. Refresh the base before implementation.

Implementation baseline **7e4f6049dae7ab23b952316ab238410c2a714f0f**, fetched from origin/main on 2026-11-06.

## Acceptance criteria

- [x] In Select, Shift+click toggles an object from the map or a Hierarchy object row. Free and orbital objects can both belong to the selection. Selecting from either surface updates the same selection and highlights the selected map marks and visible Hierarchy rows.
- [x] A primary-button rectangle started on empty map space in Select replaces the previous selection. Include each object whose resolved placement point is inside the rectangle at the current pan and zoom, independently of its icon and label size.
- [x] With multiple objects selected, the open Inspect panel shows their count. A plain click on a map object or Hierarchy row selects that object and opens its ordinary details. Changes of Inspector target use the existing draft-resolution path.
- [x] An empty-map click in Select, Escape outside an owned gesture where the map can handle the key, or leaving the active system map clears the selection. Stale object references are dropped when an object ceases to be valid. The selection belongs to the active editor session and creates no history entry or saved membership.
- [x] In Select, the map context menu offers Player visibility for either a selected object or one outside the selection. Applying a visibility choice affects the clicked object alone and keeps the current selection. The command uses the usual draft, history, and save flow. Right-drag pans the map.
- [x] Document the proposed later toolbar command for toggling objects by tap or keyboard activation and then switching to Move.

## Verification

Use the public Warden editor to demonstrate Shift+click in both views, rectangle selection under a non-default pan or zoom, the Inspect count, returning to a single object's details, and a Player visibility change while a multiple selection is active. Reuse the maintained workspace fixture and the approved browser coverage from the parent specification. Extend this selection journey in the dependent movement ticket.

## Delivery boundary

This ticket is demonstrable in Select. The transfer of the selection to Move, the Move selection context action, and the collective gesture are delivered together by the dependent ticket.

## Resolution

The system map and Hierarchy now share transient selection through guarded editor commands. The rectangle participates in the editor's gesture ownership. The Inspector count and targeted Player visibility are available while a multiple selection is active. System SVG exports omit the selection metadata. The README documents the later tap and keyboard flow.

The new browser assertions were consolidated into the existing Hierarchy journey. The focused journey and SVG/PNG export checks passed. The complete compiled Chrome run passed 96 of 99 cases. The three timed-out cases all passed in a focused one-worker rerun against the same build. All 317 pure cases and the IndexedDB development case passed. Lint, type checking, and the production build passed. Independent Standards and Spec reviews closed with no blocking findings.

The next delivery is [Move selected objects as one undoable action](02-move-selected-objects.md).
