---
title: Multiple object selection and collective movement
status: open
scope_status: approved
testing_seams_status: approved
testing_seams_approved_on: 2026-11-06
triage_labels:
  - enhancement
  - ready-for-agent
---

# Multiple object selection and collective movement

## Problem Statement

A Warden rearranging a star system must currently move its objects individually. Moving several objects by the same amount takes repeated gestures and makes it easy to lose their spacing. The Warden also needs to assemble a selection from the map and Hierarchy together, see which objects are included, and keep using the existing visibility action while that selection is active.

## Solution

Introduce a temporary selection shared by the star-system map and Hierarchy. The Warden can toggle objects with Shift+click, replace the selection with a rectangle on the map, and enter Move from the Dock or the selection's context menu. Dragging a selected object previews a common translation. Releasing applies the complete movement as one undoable action, including any object that moves from its current Orbit to free placement. The selection remains available for another move.

## Source issue

[Multiple selection and groups (#6)](https://github.com/Submoon/ttrpg-cluster-control/issues/6) was fetched through GitHub CLI on 2026-11-06. It was open, labeled enhancement and priority:P1, with no comments. The source asks for Shift+click and rectangle selection, selection highlighting, context actions for moving and managing groups, relative-position locks, and documentation of the mobile interaction.

This specification covers the first delivery of #6. The accepted local scope adds Hierarchy selection, object-specific Player visibility during multi-selection, and explicit collective placement rules for objects on Orbits. The source criteria for locking, unlocking, ungrouping, and moving a locked group are deferred until the Warden has tried this delivery.

## Repository baseline

Fetched origin on 2026-11-06. The isolated worktree HEAD, local main, and origin/main all resolved to **19e4532ca2de3c0906214faa64ab62a6874269b0**.

## User Stories

### Build and inspect a selection

1. As a Warden, I want Shift+click on a map object in Select to add or remove it, so that I can build an exact selection incrementally.
2. As a Warden, I want Shift+click on a Hierarchy object row to add or remove it, so that I can select overlapping or distant objects by name.
3. As a Warden, I want the map and Hierarchy to share one selection, so that I can add objects from either surface and move them together.
4. As a Warden, I want each selected object and its visible Hierarchy row to be highlighted, so that I can tell which objects the next move will affect.
5. As a Warden, I want to include objects placed on Orbits, so that I can select a mixed set of free and orbital objects.
6. As a Warden, I want to drag a rectangle from empty map space in Select, so that I can replace the current selection with objects from one area.
7. As a Warden, I want the rectangle to select by each object's placement point at the current pan and zoom, so that icon and label sizes do not affect membership.
8. As a Warden, I want Inspect to show the number of selected objects when several are selected, so that I can confirm the selection from the open panel.
9. As a Warden, I want a plain click on a map object or its Hierarchy row to select and inspect that object, so that I can return to its individual details.
10. As a Warden, I want to keep the selection when switching from Select to Move, so that I can separate choosing objects from moving them.
11. As a Warden, I want to clear the selection with a click on empty map space in Select or with Escape outside a gesture, so that I can start fresh.
12. As a Warden, I want the multiple selection to clear when I leave the current system map, so that returning to a system starts without an earlier set of move targets.

### Use the context menu

13. As a Warden, I want **Move selection** in the map context menu on a selected object when several are selected, so that I can switch directly to Move with the selection ready to drag.
14. As a Warden, I want **Player visibility** on a right-clicked object in Select, whether it is selected or outside the selection, so that I can still manage what players see.
15. As a Warden, I want the visibility action to affect only the clicked object and retain the selection, so that I can adjust disclosure and then move the same objects.
16. As a Warden, I want right-drag panning on the map, so that I can reposition the view while working with a selection.

### Move the selection

17. As a Warden, I want dragging any selected object in Move to preview the same map translation for the whole selection, so that I can place the arrangement with its spacing intact.
18. As a Warden, I want dragging an object outside the selection in Move to clear the multiple selection and move that object alone, so that the old selection does not follow an unrelated drag.
19. As a Warden, I want an Orbit and its occupants to follow their moving host, so that moving an object carries the branch it hosts.
20. As a Warden, I want a selected descendant to travel only once with its moving ancestry, so that selecting an object and an ancestor together preserves their relative positions.
21. As a Warden, I want to move an object along its fixed Orbit by dropping it within the usual hit tolerance, so that I can preserve the attachment while moving the selection.
22. As a Warden, I want an object whose translated point lies off its fixed Orbit to take a free placement when it has no eligible destination Orbit, so that the selection retains its spacing.
23. As a Warden, I want an independently moving member dropped on a fixed Orbit to attach there, even when I grab another member of the selection, so that I can place objects on Orbits while moving them together.
24. As a Warden, I want the preview to identify pending Orbit departures and attachments, so that I can see the consequences before releasing the drag.
25. As a Warden, I want a moving planet's hosted Orbits and their occupants to follow it even if the planet leaves its own Orbit, so that the planetary branch stays together.
26. As a Warden, I want other occupants of a fixed Orbit to retain their effective positions when one occupant leaves or changes angle, so that nearby objects do not shift because of the collective move.
27. As a Warden, I want a draft conflict to block the whole move with useful feedback, so that a rejected drag leaves no partial placement to repair.
28. As a Warden, I want the preview to stay temporary until release and to disappear when a gesture is canceled, so that I can inspect a proposed position without committing it.
29. As a Warden, I want release to apply the accepted translation and placement changes together, so that one Undo restores both positions and Orbit relationships.
30. As a Warden, I want committed changes to save through the ordinary workspace workflow, so that the new arrangement is available when I reopen the workspace.
31. As a Warden, I want the selection to stay active after a successful move, so that I can adjust the same arrangement again.

### Prepare the mobile follow-up

32. As a Warden using a touch screen, I want the planned selection interaction documented, so that I know how the later toolbar command will let me toggle objects and then move them together.
33. As a Warden using a keyboard, I want the later toolbar command described as keyboard-operable, so that I can see how to compose a selection without a pointer modifier.

## Implementation Decisions

### Selection and gestures

- Scope multiple selection to catalogue objects on the active star-system map. Share transient object IDs between the map, Hierarchy, Inspector, and editor commands through the editor's UI-state boundary. Keep selection membership out of saved workspace data, exports, and history.
- Use the existing guarded selection and navigation paths when changing what Inspect owns. For multiple objects, the open panel shows a count. For a single object, it uses the existing object Inspector. Apply the existing draft-resolution rules to transitions that change the Inspector target.
- In Select, a primary-button drag starting on empty map space shows a rectangle and replaces the selection on completion. Use the resolved map anchor of each object and the current map transform for inclusion. Distinguish a background click from a rectangle gesture. Right-click opens the context menu, while right-drag pans.
- Preserve the current selection across Select to Move and after an accepted collective move. Clear it on an empty-map click in Select, Escape outside an owned gesture when the map interaction can handle the key, or leaving the active system map. Remove object references that cease to be valid. Existing controls and active gestures retain their key ownership.
- Route **Move selection** through the guarded Move mode command. Offer it from the map context menu on a selected object when multiple objects are selected. Use the clicked object ID for **Player visibility**, preserve selection membership, and reuse its existing draft, history, and save behavior.
- Begin a collective drag only when the grabbed object belongs to a multiple selection. A drag that begins outside it clears the multiple selection and uses the ordinary single-object drag path. An ordinary click continues to use the single-object selection path.

### Collective placement

- Capture the selected objects, applied positions, workspace revision, and system context at gesture start. Compute the proposed translation from the map-space gesture delta. Preview from the captured positions rather than accumulating intermediate pointer deltas.
- Resolve the existing object and Orbit relationships in dependency order. A hosted Orbit follows its host, including when that host itself follows another Orbit or takes a new free placement. Its occupants follow the resulting center. Count inherited movement once even if both an ancestor and a descendant are selected.
- When an object's current Orbit center moves by the same translation, carry the occupant at its effective angle. For a fixed center, keep the current attachment when the translated point is representable on the ellipse within numerical tolerance. An Orbit with an unoccupied center is fixed in this object-only gesture.
- Use the ordinary object drag hit tolerance for independently moving selected members, including their current fixed Orbit. Give the grabbed Orbit occupant's eligible hit first choice. Otherwise use the closest eligible hit across the selection, with ties resolved in system order. The winning hit supplies one snap offset for the whole selection. Other members may attach where that same translation reaches an eligible Orbit. Orbits carried by the group cannot become new destinations. Objects without a resulting Orbit use their translated point as a free placement.
- Preserve the effective angles of occupants whose placement is unaffected when another occupant leaves or changes position, including occupants whose angles were previously derived from sibling order. This applies to branches at any supported depth.
- Show the proposed geometry and mark each pending Orbit departure or attachment during the gesture. Keep the preview transient and cancel it through the map's gesture ownership path. A gesture with no effective change produces no history action.

### Apply, history, and saving

- Check the complete proposed movement for placement validity, draft conflicts, and stale context before applying it. If any affected change is blocked, clear the preview, report the blocker, and leave the committed geometry and history as they were before the gesture.
- Submit the accepted move on release as one validated proposal through the existing workspace mutation and history coordinator. Apply the entire move in one memory publication and save it through the existing ordered writer. Undo and Redo operate on the same history action and restore the relevant placements and Orbit relationships together.
- Document the proposed later toolbar interaction for toggling membership by tap or keyboard activation, then switching to Move. The current delivery includes the documentation.

## Testing Decisions

- Use a representative Playwright journey through the public Warden editor for the interactions that depend on real rendering and event routing. Compose a mixed selection across the map and Hierarchy, exercise rectangle selection at a non-default transform, inspect the count, use the right-click actions, and perform a collective move. Check the preview and resulting rendered positions or exported placements. One Undo restores the geometry and relationships. Reuse the maintained workspace fixture, map-drag helpers, and public history actions. [Player visibility journeys](../../tests/workspace-player-content.spec.ts) · [Editor history journeys](../../tests/workspace-history-main-integration.spec.ts)
- Cover deterministic geometry at the existing placement boundary. Use a rotated ellipse, targets on and off the current Orbit, an unoccupied center, nested hosted Orbits, selected and unselected descendants, and unaffected siblings with implicit angles. Assert the common map delta and the resulting placements and angles. Reuse the existing placement and Orbit geometry coverage patterns. [Placement contracts](../../tests/workspace-placement-contracts.spec.ts)
- Check draft conflict, cancellation, a stale proposal, and the single history action at the existing controller and mutation boundary where practical. Assert the published workspace and history outcome. Reuse the object placement guard, preflight, and workspace history patterns for these deterministic cases. [Object placement guards](../../tests/workspace-object-placement-guards.spec.ts) · [Apply preflight](../../tests/workspace-editor-apply-preflight.spec.ts)
- Verify new user-visible outcomes through the normal editor entry points. Follow the repository's focused browser budget and use an independent geometry oracle for rendered positions. Document any remaining device or input coverage limits in implementation verification.

## Out of Scope

- Durable group membership and the commands for locking, unlocking, and dissolving groups.
- The later touch and keyboard selection toolbar control.
- Multi-selection of Orbit entities, systems, or routes, and bulk changes to object metadata or publication.
- Any broader change to the single-object placement, attachment, or Orbit editing workflows.

## Further Notes

After the first delivery is available in the editor, try two consecutive moves with one selection. Then clear the selection or revisit the system and try to move the same arrangement again. Use that experience to decide whether recurring moves justify durable membership and locked relative positions. Review the deferred source criteria before considering the GitHub issue complete.
