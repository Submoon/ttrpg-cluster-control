---
title: Move selected objects as one undoable action
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02 — Move selected objects as one undoable action

## What to build

Let the Warden translate a selection on the star-system map in one gesture. Preview the movement and its effects on Orbit placement, apply the accepted move on release, and restore the previous arrangement with one Undo.

## Blocked by

- [Build a shared multi-object selection](01-build-shared-multiple-selection.md). The Move command and gesture consume the selection shared by the map and Hierarchy.

## Specification and baseline

[Multiple object selection and collective movement](../spec.md) · [Multiple selection and groups (#6)](https://github.com/Submoon/ttrpg-cluster-control/issues/6)

Parent stories 10, 13, and 17–31.

Worktree and specification baseline **19e4532ca2de3c0906214faa64ab62a6874269b0**. On 2026-11-06, the ticketing comparison used origin/main **7e4f6049dae7ab23b952316ab238410c2a714f0f**. The two-commit difference changes only Orbit contrast in the player view. This ticketing pass uses the existing isolated worktree base. The approved Warden editor scope is applicable at both revisions. Refresh the base before implementation.

## Acceptance criteria

- [ ] Switching from Select to Move keeps the selection. With multiple objects selected, the Select-mode map context menu on a selected object offers **Move selection**, which invokes the guarded Move command and leaves the selection ready to drag. Player visibility remains available for the clicked object in the same menu.
- [ ] In Move, dragging any selected object previews the same map-space translation for the whole selection from the gesture's captured applied geometry. Dragging an object outside the selection clears the multiple selection and follows the ordinary single-object drag path.
- [ ] A moving object carries its hosted Orbits and their occupants, including nested branches and unselected descendants. A selected descendant that already follows its ancestry receives the translation once. This also applies when a moving object leaves its own Orbit.
- [ ] When an Orbit center follows the translation, its occupants follow at their effective angles. For a selected object on an Orbit whose center stays fixed, keep the object on that Orbit if the exact translated point is representable there within numerical tolerance. Otherwise apply free placement at the exact translated point. A different Orbit intersecting the gesture or its destination does not create an attachment. An unoccupied Orbit center is fixed for this object gesture.
- [ ] Changes in occupancy or angle preserve the effective angles of unaffected occupants, including those whose angles previously came from sibling order.
- [ ] The preview identifies each pending departure from an Orbit. It changes no committed geometry or saved data before release. A canceled gesture clears the preview and its later release cannot apply it. A gesture with no effective change creates no history action.
- [ ] Validate the complete proposal, captured workspace revision, active system, and applicable draft guards before application. A conflict or stale context rejects the whole proposal, clears the preview, and leaves committed geometry and history intact. Show useful feedback when a draft blocks the gesture.
- [ ] A valid release applies all changes in one validated workspace mutation and one history action. Undo and Redo restore positions and Orbit relationships together. Save through the existing ordered workspace writer, and verify that the applied arrangement survives reopening.
- [ ] A successful move retains the selection for a second move. The selection can still be cleared through its normal controls.

## Verification

Extend the public selection journey to invoke **Move selection**, preview and apply a mixed free-and-orbital move, and verify a single Undo restores the previous geometry and attachments. Use the existing placement boundary for exact targets on and off a rotated ellipse, an unoccupied center, carried descendants, and unaffected implicit sibling angles. Use the existing guard and mutation boundary for rejected, canceled, stale, and applied proposals and their history effects. Follow the parent specification's browser budget and use an independent geometry oracle for rendered positions.

## Delivery boundary

The completed ticket enables an editor trial with two consecutive moves and then another attempt after clearing the selection or revisiting the system. The trial informs a later decision on durable group membership and locking.
