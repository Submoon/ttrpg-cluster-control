---
title: Move selected objects as one undoable action
status: closed
closed_on: 2026-11-09
assignee: /root
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

Implementation started on 2026-11-09 from **02c616b5e623f224b39a2399cbe574540c763367**. This work builds on the required selection delivery from ticket 01, one commit ahead of the fetched origin/main **7e4f6049dae7ab23b952316ab238410c2a714f0f**.

## Acceptance criteria

- [x] Switching from Select to Move keeps the selection. With multiple objects selected, the Select-mode map context menu on a selected object offers **Move selection**, which invokes the guarded Move command and leaves the selection ready to drag. Player visibility remains available for the clicked object in the same menu.
- [x] In Move, dragging any selected object previews the same map-space translation for the whole selection from the gesture's captured applied geometry. Dragging an object outside the selection clears the multiple selection and follows the ordinary single-object drag path.
- [x] A moving object carries its hosted Orbits and their occupants, including nested branches and unselected descendants. A selected descendant that already follows its ancestry receives the translation once. This also applies when a moving object leaves its own Orbit.
- [x] When an Orbit center follows the translation, its occupants follow at their effective angles. Independently moving selected objects can snap to eligible stationary Orbits at the destination, including their current Orbit. The grabbed Orbit occupant's hit takes priority, with the nearest eligible group hit as fallback. One snap offset applies to the whole selection. Members without a resulting Orbit take free placements at their translated points. An unoccupied Orbit center is fixed for this object gesture.
- [x] Changes in occupancy or angle preserve the effective angles of unaffected occupants, including those whose angles previously came from sibling order.
- [x] The preview identifies pending Orbit departures and attachments. It changes no committed geometry or saved data before release. A canceled gesture clears the preview and its later release cannot apply it. A gesture with no effective change creates no history action.
- [x] Validate the complete proposal, captured workspace revision, active system, and applicable draft guards before application. A conflict or stale context rejects the whole proposal, clears the preview, and leaves committed geometry and history intact. Show useful feedback when a draft blocks the gesture.
- [x] A valid release applies all changes in one validated workspace mutation and one history action. Undo and Redo restore positions and Orbit relationships together. Save through the existing ordered workspace writer, and verify that the applied arrangement survives reopening.
- [x] A successful move retains the selection for a second move. The selection can still be cleared through its normal controls.

## Verification

Extend the public selection journey to invoke **Move selection**, preview and apply a mixed free-and-orbital move, and verify a single Undo restores the previous geometry and attachments. Use the existing placement boundary for exact targets on and off a rotated ellipse, an unoccupied center, carried descendants, and unaffected implicit sibling angles. Use the existing guard and mutation boundary for rejected, canceled, stale, and applied proposals and their history effects. Follow the parent specification's browser budget and use an independent geometry oracle for rendered positions.

## Delivery boundary

The completed ticket enables an editor trial with two consecutive moves and then another attempt after clearing the selection or revisiting the system. The trial informs a later decision on durable group membership and locking.

## Resolution

The Warden can enter Move from the Dock or the selected object's map context menu. One gesture translates the selected objects and their hosted branches, previews departures from fixed Orbits, and applies one undoable workspace mutation on release. Guard failures are visible on the map. Escape cancels an owned drag or clears an idle Move selection.

The compiled editor journey passed with preview, late-release cancellation, one-step Undo and Redo, and a matching export after reopening. The Chrome suite passed 98 of 99 cases on its complete run. The timed-out unoccupied Orbit center case passed on the same build in isolation. The pure suite passed 326 of 327 cases on its complete run, and the time-sensitive launcher case passed in isolation. The IndexedDB case passed using the owned local launcher. Lint, TypeScript, and the production build passed. Standards, Spec, and domain and persistence reviews closed without blockers. Visual inspection at 133% confirmed the departure marker and Player visibility badge were distinct.

The editor trial prompted a follow-up for Orbit attachment on drop. The closest eligible hit now supplies the translation for all selected objects and carried branches. The preview marks arrivals and departures. At an intersection, an occupant keeps its current Orbit when the final point is also on that Orbit. The editor journey now drags Iria while the ungrabbed Vesper Departure attaches to the fixed Orbit, then checks Undo, Redo, and the saved result after reopening.
