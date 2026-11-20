---
title: Define editing and navigation across visible systems
status: closed
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../map.md
assignee: Codex
---

# Define editing and navigation across visible systems

## Question

How do tools, selection, the Inspector and editing drafts behave when several systems are directly editable on the same canvas?

Define how a target supplies command context, how existing draft resolution is invoked, and what happens when zoom simplifies the representation of the current selection or draft. Cover object and Orbit manipulation, system movement, multi-selection, keyboard focus, touch gestures and overlapping targets.

Decide how Hierarchy, Search, Fit and history reveal choose a useful camera position in the continuous map. Use an unsaved object draft in one system followed by a click, search result or gesture in another as a concrete transition.

## Context

The [source map](../map.md) confirms direct editing across systems. Existing [editor commands and draft ownership](../../../docs/architecture/editor.md) coordinate accepted mutations, navigation guards and asynchronous context checks. The new interaction contract must state the resulting user behavior at each entry point.

On 2026-11-14, the source issue was refreshed. After fetching, local `main` and `origin/main` matched `6613435f4b0fe0ac12528a64d6d2132cd2138e79`. Use that revision for current editor behavior. The local planning files remain on the prototype branch at `28217cb8e3292910070617e79389fd167ded2367`, which preserves the accepted prototype and its decision record.

- Current [navigation commands](../../../composables/editor-workflows/useEditorNavigation.ts) guard a change of Inspector target and preserve a draft when returning to its entity. Camera pan, zoom, and Fit do not replace the Inspector target. A direct move can address a different entity while the existing draft stays attached to its own target. The distinction matters when deciding how a direct gesture interacts with Inspect on the unified map.
- On the current baseline, multiple selection covers objects in one system. Shift-click or a selection rectangle creates a group, and dragging a selected member in Move can translate the group in one history entry. The group Inspector displays a count. This gives the unified map a concrete existing behavior to preserve or extend.
- Existing [Search reveal](https://github.com/Submoon/ttrpg-cluster-control/blob/6613435f4b0fe0ac12528a64d6d2132cd2138e79/composables/editor-workflows/useWardenSearchReveal.ts) resolves drafts before revealing a new target. Object results frame the branch in the usable area around the panels. History reveals a surviving target or parent after traversal, preserving zoom and panning as needed. The unified canvas must account for a target hidden by semantic detail as well as a target outside the viewport.

## Resolution

Confirmed by the user across the discussion rounds ending on 2026-11-14. The source issue was refreshed before closing this decision.

### Selection, drafts, and tools

1. **Zoom and drafts.** Keep the object or Orbit selected in Inspect when semantic zoom hides its mark, with its draft intact. Keep its owning system identifiable in the overview and offer an explicit Center action to reveal the entity again.
2. **Changing target.** Reuse Apply, Discard, and Stay when a change of Inspector target would leave a modified draft. Apply the same rule to map selection, Hierarchy, Search, and an edit gesture that changes the Inspector's target. Stay or a failed Apply cancels the proposed transition and keeps the source draft. Camera movement alone keeps the same target.
3. **Tools.** Remove the dedicated Navigate mode from the unified Warden map. The camera is available while using the remaining tools.

### Camera access and direct manipulation

4. **Camera input.** Wheel zoom and pinch zoom are available in every tool. In Move, dragging an editable mark manipulates its entity.
5. **System names.** In Select, clicking or tapping a system name inspects that system at the current camera position. Center is the explicit request to frame the system and reveal its interior.
6. **Independent manipulation.** Moving a station in system B can commit without changing the Inspector target or resolving a modified draft for a planet in system A. A gesture that needs to change the Inspector target follows Apply, Discard, and Stay before proceeding. Normal validation still governs the mutation and its dependencies.

### Framing and target choice

7. **Fit.** Fit frames the entire Jump Cluster on the shared canvas. Center reveals the selected entity. Both preserve selection and any modified draft.
8. **Overlapping targets.** Direct selection or movement uses the frontmost eligible rendered target. System names and anchors are direct targets for their supported actions. The previously agreed ownership chooser still applies when Add cannot infer an owner from a definite target or a unique envelope.
9. **Multiple selection.** An object selection and its group move may span multiple systems. The previously agreed ownership rules apply to every member.

### Common scale and desktop gestures

10. **Common scale.** All systems use the same scale. This clarification replaces the individual scaling option in the earlier spatial-layout decision. A group move is described in shared map coordinates.
11. **Orbit snap.** An eligible Orbit may snap the entire group during a move, including when the group spans systems. Ownership rules continue to prevent attachment to another system's Orbit.
12. **Desktop pan and rectangle.** Keep the existing right-button drag for camera pan. In Select, a left-button drag starting on empty canvas draws a selection rectangle. Shift is not required for the rectangle. Preserve the distinction between a right-click menu and a right drag.

### Group moves and touch gestures

13. **Group translation.** Dragging a selected object translates the entire group by one shared map displacement. The grabbed object alone may snap the group to an eligible Orbit in its own system. Hosted branches follow their hosts, and the preview identifies Orbit attachments and detachments. Each member retains its system. The group move is validated and committed as one operation and can be undone as one history entry.
14. **Hidden group members.** Semantic zoom retains all explicitly selected members. A move started on a visible member carries the complete group. The preview indicates how many selected members are hidden at the current level of detail and will move with it.
15. **Touch arbitration.** A one-finger drag on the background pans the camera. A pinch zooms the map. In Move, a one-finger drag on an editable target manipulates that target. A second contact cancels the uncommitted move and hands control to pinch zoom.

### Revealing and reaching targets

16. **Explicit framing.** Center and Search use the unobstructed map area and retain the current zoom where it already suffices. Adjust zoom when necessary to reveal the target's detail or frame the system. An ordinary Hierarchy selection changes the inspected target without moving the camera.
17. **Covered targets.** Hierarchy and Search provide access to a covered entity and its Inspector actions. Direct map input continues to target the frontmost eligible mark.

### Touch selection, keyboard focus, and history

18. **Touch group selection.** In Select, long-press each object to add it to the group. Long-press a selected object again to remove it. Members may belong to different systems. A tap remains ordinary selection, and switching to Move keeps the group available for dragging. Movement beyond the gesture threshold or a second contact cancels a pending long press. After activation, its release consumes the corresponding tap so it does not change the selection again.
19. **Keyboard focus.** When semantic zoom hides the currently focused map mark, focus its owning system's visible name. If that name is outside the usable map area, focus the canvas. Keep the underlying selection and its Inspector draft. Apply this fallback only when the disappearing mark had focus.
20. **History reveal.** After a successful Undo or Redo, reveal the affected entity or its surviving parent. Pan only as needed within the unobstructed area and adjust zoom only when semantic detail hides the target. Existing draft guards and history availability still apply.

## Blocked by

- [Define ownership and placement across system boundaries](02-system-ownership-and-placement.md)
- [Prototype stable geometry and semantic detail](03-semantic-zoom-prototype.md)
