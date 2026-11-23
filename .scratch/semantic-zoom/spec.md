---
title: Unified map with stable semantic zoom
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

# Unified map with stable semantic zoom

## Problem Statement

Wardens currently move between a Jump Cluster overview and separate star system maps. They lose the surrounding layout when inspecting an orbital branch and must enter another system before editing its contents. Players also move between separate maps. Both audiences need to move from a readable overview to local detail without losing their place, while the Warden must retain control over object ownership, unsaved edits, and what players can see.

## Solution

Give the Warden editor, player preview, and player reader one continuous D3 canvas per view. Zoom changes the camera and the detail shown for each system. Systems, objects, and Orbits keep their schematic positions during navigation. The Warden can edit visible targets wherever they are on the map. Players explore the geometry in their published document. Existing editable maps and player shares open on the unified map, and images can cover the whole Cluster, one system, or the current viewport.

## Source issue

[Unified map with semantic zoom](https://github.com/Submoon/ttrpg-cluster-control/issues/4) is open and had no comments when refreshed on 2026-11-16. It calls for one continuous D3 canvas, automatic detail changes at zoom thresholds, usable performance, and mobile touch zoom. The confirmed scope includes the Warden editor, player preview, and player reader. This specification consolidates the [Wayfinder decisions](map.md).

The application baseline after fetching was `dc5edb282087458c1bc6dd26287c96a974662c3b` on both local `main` and `origin/main`. The planning checkout intentionally uses the prototype branch at `28217cb8e3292910070617e79389fd167ded2367` plus local decision records. Use the application baseline for the existing product contracts and the prototype branch for interaction evidence.

During implementation on 2026-11-16, both `main` and `origin/main` advanced to `88d84f1749c7615b6dc5179f2bd4f24040d79f6a`. Tickets 09 and 10 were first verified against the original application baseline. The integration branch merged the updated main at `45c78ffb89bd6fab5b2973f84ec962ac45cb797c`; the updated application and dependency lock apply to subsequent integrated verification.

On 2026-11-17, the Preview preparation fetch advanced `origin/main` to `686ea383378184778711af552db589f6cfa14037`. Local `main` was fast-forwarded to match. The integration branch incorporated that application baseline at `6dbf693c6aa5f255f14c91a2a1ef91e9c2944892`, retaining marker colors, Warden draft presentation, and Dropbox backup and restore for the final qualification. Earlier isolated ticket checks used the integrated `88d84f17` baseline.

On 2026-11-18, local `main` was fast-forwarded to `0774efc2f80490aa9889d73c61660792115ca033`. Integration commit `96b1e9fb69b4c15e370dd04cb373e6a7811e9996` incorporates the shared cloud backup restore UI and updated Preview verification.

A second fetch on 2026-11-18 advanced local `main` and `origin/main` to `48873799dac97b84856db676176b5c6b869b5620`, including the application logo and favicon. The activation runs through `06f6b1d64bbbc5c1ea95b7fe93fddbb1571edc5c` intentionally retained the earlier baseline for exact verification. Integration `cb76f4ecc9bfcd930df8e108b4c467981f742bc6` incorporates the refreshed baseline for subsequent qualification.

The 2026-11-20 feedback correction resumes the prototype at `65ef166dba60468353162570066f8450406fdb15` on `codex/semantic-zoom-sharpness`. After fetching, `main` and `origin/main` remain at `48873799dac97b84856db676176b5c6b869b5620`; the feature base contains that revision. The supplied Firefox desktop GIF shows transient raster blur on object labels and dashed Orbits during wheel zoom, followed by sharp settled rendering. Software Firefox captures do not reproduce that transient blur. The correction must paint ordinary system details directly in viewport coordinates and retain object/Orbit interaction geometry. In Move, all available system-frame corners must remain visible and operable regardless of selection; existing placement and modal guards still apply.

The next feedback pass starts from `99e9271f23b2596ef5277fa70aac55a774691e44`, the fetched prototype branch head, which already contains the unchanged `origin/main` baseline above.

The selected-system export and Delete shortcut feedback starts from prototype revision `5824c383fe1c023166aaef9b9be78703d97acde5`. After fetching, `main` and `origin/main` still point to `48873799dac97b84856db676176b5c6b869b5620`, which the prototype already contains.

The small-map wheel response follow-up starts from prototype revision `680aa2426602b5f41e09debb44ab836926d1c9ab`. A fresh fetch confirmed the same `origin/main` baseline.

The Firefox follow-up starts from prototype revision `e9fa0da6cbf8f145388c48069175199c902f509a` with the same fetched `origin/main` baseline. Reproduce the report using the supplied two-system workspace in a local browser session.

The maximum-zoom follow-up starts from prototype revision `58431aeb7ab34ccfbb514542165b84fd7ec669b5` with the same fetched `origin/main` baseline. The supplied workspace reproduces the Firefox stalls when the camera starts at 1600% with four large, partially visible Orbits.

## User Stories

### Explore and arrange the map

1. As a Warden, I want to zoom from the Jump Cluster into a star system and its orbital branches, so that I can keep neighboring systems in view.
2. As a player, I want the same continuous navigation in the preview and reader, so that I can relate published local details to the wider Cluster.
3. As a viewer, I want distant system names to stay readable above map geometry, so that I can orient myself before zooming in.
4. As a viewer, I want nearby systems to reveal their interiors independently at a readable size, so that I can explore several systems in one view.
5. As a viewer, I want zoom to preserve the positions and proportions of systems, objects, and Orbits, so that detail appears where I expect it.
6. As a Warden, I want to drag a system by its name or anchor, so that I can reposition its entire layout in one action.
7. As a Warden, I want systems with multiple stars, off-center stars, or no objects to have their own anchors, so that system placement is independent of its contents.
8. As a Warden, I want each envelope to follow its contents, including distant objects, so that I can see the extent of each system.
9. As a Warden, I want system envelopes to stop at neighboring frames, so that I can distinguish adjacent systems while keeping their anchors and contents in place.
10. As a Warden, I want pan and zoom available while selecting, moving, or adding, so that navigation does not require switching tools.
11. As a desktop Warden, I want right-drag to pan and left-drag from the background in Select to draw a selection rectangle, so that I can navigate and select using distinct gestures.
12. As a phone user, I want background drag and pinch to navigate, so that I can explore the map without a mouse.

### Inspect and edit across systems

13. As a Warden, I want selecting a system name to open Inspect at the current camera position, so that I decide when to change the view.
14. As a viewer, I want Fit to frame the applicable whole Cluster and Center to frame my selection, so that I can return to overview or recover a target.
15. As a Warden, I want Search to reveal its result and ordinary Hierarchy selection to leave the camera in place, so that I can choose between locating and inspecting.
16. As a Warden, I want a target covered by another mark to remain accessible through Hierarchy and Search where supported, so that overlap does not prevent editing.
17. As a Warden, I want a direct click or drag to use the frontmost eligible mark, so that the result matches the map I can see.
18. As a Warden, I want my selection and draft to survive when zoom hides the selected entity, so that I can review the wider map while editing.
19. As a keyboard user, I want focus to move to a visible system name or the canvas when the focused mark disappears, so that I can continue using the map.
20. As a Warden, I want Apply, Discard, or Stay when an action would leave a modified Inspector draft, so that I decide how to handle unfinished work.
21. As a Warden, I want to move an independent object in another system while keeping my current draft open, so that I can adjust the map without changing what I inspect.
22. As a Warden, I want to add an object directly to a definite object or Orbit target or a unique system envelope, so that I can work without activating a system first.
23. As a Warden, I want an owner choice when I add on a shared edge or outside every frame without a definite target, so that the new object belongs to the intended system.
24. As a Warden, I want a drop inside another system's frame to initiate a transfer to that system, so that I can move an object directly between systems.
25. As a Warden, I want a system transfer to carry the object's hosted orbital branch and preview its placement, so that I can move a planet with its moons and stations together.
26. As a Warden, I want to preview a transferred root in free space or on an Orbit in the destination system, so that I can choose its new placement.
27. As a Warden, I want editable suggestions for conflicting Location keys and a review of affected links, so that I can resolve the consequences before applying a transfer.
28. As a Warden, I want to select and move objects from different systems as a group, so that I can adjust their layout together.
29. As a Warden, I want only the object I grab to snap the group to an eligible Orbit, so that I can control what drives the shared movement.
30. As a Warden, I want the group preview to report attachments, detachments, and selected members hidden by zoom, so that I know everything that will move.
31. As a phone Warden, I want to add or remove each group member by long-pressing it, so that I can build a selection without modifier keys.
32. As a phone Warden, I want a second contact during an uncommitted move to start pinch and cancel the move, so that a change of gesture cannot place anything accidentally.
33. As a Warden, I want Undo and Redo to restore an entire group move or other accepted layout edit and reveal the affected entity, so that I can recover my work with minimal camera movement.

### Work with Jump Routes

34. As a Warden, I want to create a route between distinct systems and optionally attach each end to a Jump Point, so that I can chart routes before placing the local points.
35. As a Warden, I want to change a route's origin or destination system directly, so that I can revise a connection and then choose a local Jump Point if needed.
36. As a Warden, I want a transferred or deleted Jump Point to leave affected systems connected, so that editing the local departure or arrival does not remove the route.
37. As a Warden, I want each route end to join the anchor or its Jump Point according to that system's detail, so that the drawing reflects what I can see at each end.
38. As a Warden, I want unresolved destinations to retain their position and distinct marker, so that they remain recognizable at every detail level.
39. As a viewer, I want separate paths for routes that share endpoints and labels showing their jump levels when space allows, so that I can identify and select the intended route.
40. As a viewer, I want to select the visible part of a route and explicitly center its whole path, so that a route remains usable when it crosses the viewport edge.

### Consult and share published maps

41. As a Warden, I want the preview to use the same published geometry and interactions as the reader, so that I can check what a player will see.
42. As a Warden, I want public envelopes and camera framing based only on published geometry, so that private objects cannot be inferred from the size of a system or the behavior of its camera.
43. As a player, I want generic markers for systems with limited disclosure and a named minimum frame for a Revealed system without published contents, so that each system's permitted information is readable.
44. As a player, I want to see the permitted orbital context at its published coordinates, so that retained Orbits and their hosts make the map understandable.
45. As a player, I want to inspect public system markers and shared routes without forcing a camera move, so that consultation does not interrupt navigation.
46. As a Warden, I want a shared route to attach only to an independently Revealed Jump Point in a detailed player system, so that sharing the route cannot reveal a private point or Station.
47. As a player, I want a permitted anonymous destination to stay labeled Unknown destination, so that I can read the route according to what has been published.
48. As a player opening another document, I want selection and pending reveals reset, so that the new document does not inherit a target from the previous one.

### Restore, import, export, and verify

49. As a returning Warden, I want older maps to preserve system positions, local layouts, and valid route attachments, so that the unified map retains my work.
50. As a returning Warden, I want legacy routes that link a system to itself removed automatically, so that reopening a map leaves meaningful system connections.
51. As a Warden, I want a full backup to restore the complete editable Cluster and an independent system import to preview its new anchor, so that restoration and adding a copy stay distinct.
52. As a player, I want old files and links to open on the unified map from their published data, so that I can consult an existing share.
53. As a player, I want old same-system loops cleaned from the loaded share, so that legacy links follow the same route rule.
54. As a viewer, I want a whole-Cluster PNG or SVG overview, so that I can share the full network independently of the current camera.
55. As a viewer, I want a PNG or SVG of a chosen system with dashed outgoing route segments, so that I can share its full detail and show where routes continue.
56. As a viewer, I want a PNG or SVG of the current map framing, detail, and filters, so that I can share the view I composed.
57. As a Warden, I want saved layout edits to round-trip through the workspace and backup, so that reopening preserves my arrangement.
58. As a desktop or phone user, I want responsive zoom, pan, and selection in the agreed representative scenes, so that the continuous map remains usable in a dense Cluster.

## Implementation Decisions

### Geometry, reveal, and ownership boundaries

- A mounted surface has one D3 camera for its Cluster scene. A common uniform drawing scale converts each complete resolved local scene into Cluster coordinates. Translate the same fixed local origin to each independent system anchor, then apply the camera to that Cluster geometry. Apply the same conversion to coordinates, dimensions, and Orbit geometry. Resolve legacy normalized data using the existing projections before this conversion, with no clipping to the old viewport. The prototype's fixed local origin is a useful starting point for that convention.
- Derive content bounds from the anchor and complete in-scope object and Orbit geometry. Derive the displayed and empty-space placement frame separately. Cap facing edges at neighboring frames so their interiors never overlap. Edge contact is allowed. Keep anchors, objects, and Orbits in place, including contents outside the resulting frame. Moving an anchor translates its contents and their route attachments consistently. All systems use the same layout scale.
- **System Envelope** is the reveal policy. Projected size determines when each system switches between overview and interior. Present prominent names in screen space over distant systems and move each name toward its frame's upper left near detail. Fade in and out the interior marks at separated thresholds. Update hit targets and focus with the logical detail state. Preserve system anchors and object, Orbit, and system identities during presentation changes.
- Separate scene geometry and audience projection from mounted rendering and gestures. The Warden scene receives committed editable layout and explicitly owned previews. The player scene derives entirely from the detached player document. The renderer owns camera, geometry presentation and gesture lifecycle, while guarded editor commands own draft decisions and mutations. Reuse the current workspace writer, history and recovery flows. Settle or cancel stale work when its owner or target changes.

### Camera, selection, and gestures

- The unified Warden map uses Select, Move and Add. Pan and zoom are shared capabilities. Wheel and pinch work across tools. Right-button drag pans while a right click retains its context-menu behavior. In Select, a primary drag from empty canvas draws the object selection rectangle without a modifier. Retain the existing modified-click selection path for desktop. A finger drag on empty background pans. In Move, dragging an editable mark manipulates its target. A second contact takes over for pinch and rolls back the uncommitted move.
- Coarse wheel input eases toward the accumulated, pointer-anchored camera target over 160 ms from the latest impulse. If the browser misses a frame, the next frame uses actual elapsed time. Fine wheel input and reduced-motion preferences use immediate camera updates.
- Reuse the root SVG screen transform within a wheel burst while recomputing the anchor from each event's coordinates. Invalidate the transform when the viewport moves or resizes. Use opaque theme surfaces for the Warden controls and side panels over the live SVG to avoid recomputing backdrop blur on camera frames.
- In Select, a tap is ordinary selection. A long press on each object toggles its membership in the group. Motion beyond the gesture threshold or a second contact cancels a pending press. An activated long press consumes its release so it cannot also act as a tap. Switching to Move preserves the group.
- Direct input uses the frontmost eligible visible target. System names and anchors are direct targets for their supported actions. Provide ongoing access to covered entities through Hierarchy and Search where supported. Selecting a system name inspects it without entry into a separate map. Ordinary selection, including Hierarchy selection, leaves the camera in place.
- Fit frames the Cluster on the applicable surface. Center and Search use the unobstructed map area and keep the current zoom where it suffices, adjusting it to reveal detail or frame the target when needed. Fit, pan, zoom and Center preserve the current selection and draft. Keep a collapsed selection in Inspect and its owning system identifiable. If the focused mark disappears, focus the owning system's visible name or the canvas if that name is outside the usable area. On successful Undo or Redo, reveal the affected entity or its surviving parent, panning only as needed and adjusting zoom when semantic detail would hide it.
- Any change of Inspector target that would leave a modified draft uses Apply, Discard and Stay, through the same guard for map, Hierarchy, Search or editing gestures. Stay or a failed Apply keeps the source target and draft. An independent direct move can commit while the Inspector and draft stay on another entity, subject to the existing mutation and dependency checks.
- Delete opens the existing consequence review for a selected object, Orbit, or route on the continuous map, including in Move mode. An object must be the only member of the current selection. Active map gestures retain ownership of keyboard input.
- An Orbit ring has a screen-space pointer target extending beyond its dashed stroke. The target follows the same ellipse in Select and Move, with one keyboard focus stop per Orbit and existing edit handles and object targets taking precedence. In live viewport paint, compensate the root SVG scale to keep the stroke, dash spacing, and hit width constant in screen pixels.
- At high zoom, bound large Orbit strokes and their pointer corridors to the live viewport with overscan. Preserve the ellipse geometry, dash phase, and keyboard target when the curve is represented by visible arcs. Image exports continue to use the full applied geometry in their own crop.

### Placement and transfer

The Warden's Halo Orbital frame and its resize and placement gestures were validated in the prototype.

- Every catalogue object and Orbit has one owning system. For Add, use the definite target's owner or the unique frame at the placement point. Ask the Warden to choose the owner when the point is ambiguous or outside every frame. An existing object dropped in empty space retains its owner and its new coordinates. A drop in another system's frame initiates a transfer of the hosted branch. Only an eligible Orbit in the destination system can receive that transferred branch. Host and occupant relationships remain within one system and acyclic.
- Draw the Warden's Halo Orbital frame with a rounded dotted contour and a subtle halo. Put resize handles on its four rounded corners. Dragging a corner resizes the adjoining sides while keeping the regular contour and the opposite corner in place.
- While an object is being placed just outside its own frame, preview a limited elastic deformation of the actual contour near the object. Measure the stretch budget from the frame at the start of the gesture and stop the contour at neighboring frames. End the deformation when placement finishes or is canceled. A valid drop in the stretched area keeps only the increase in frame size needed to enclose the object in a regular rounded frame. Animate that accepted enlargement after release, with an immediate result when reduced motion is enabled. Save the preferred frame size relative to the anchor and derive the constrained frame for display. Frames must leave other systems' interiors clear, and objects can be positioned on either side of a frame boundary.
- A group can include objects from multiple systems. Use one Cluster-space displacement for the complete selection and its hosted branches. The grabbed object alone may snap the translation to an eligible Orbit in its own system. Apply the translation once to each moved entity, including when both a host and a descendant are explicitly selected. Keep hidden selected members and show how many will follow. Preview Orbit attachments and detachments, then validate and commit the complete move as one undoable operation.
- **Change system** transfers the object's complete hosted branch, preserving identities and internal relationships. After choosing the destination, preview the root at a free position or on an eligible destination Orbit. The root leaves its source parent Orbit. The branch keeps its scale, local dimensions and proportions. A direct drop in another system commits in one action when no Location key, Jump Route attachment, or Station link requires a decision. Otherwise open the transfer review with the destination and position already chosen. Keep available Location keys and offer editable available replacements for conflicts. Show all affected route attachments and all Station links that the transfer would separate across systems. Apply placement, ownership, keys, and consequence fixes together. Preserve Station links whose ends remain together, including incoming links to a transferred Station.

### Jump Routes

- A route specifies an origin system, and either a different destination system or an unresolved exit. Each known system end may reference one Jump Point in that system. A Jump Point can reference a same-system Station. The Station relationship is separate from the route attachment. Warden route editing addresses the systems directly. Changing a system clears that end's former Jump Point in the draft and allows another eligible point or the anchor. The other end keeps its attachment.
- Choose each displayed end independently. An end without an eligible local Jump Point uses the facing edge of the displayed frame. An attached end uses the system anchor in overview and the Jump Point's projected position in detail. Ends without a displayed frame use their authorized anchor or unresolved exit position. Preserve the distinct unresolved marker and the existing origin-relative default for an unplaced exit. Briefly transition the displayed path when an attachment changes with zoom, preserving route identity, selection, and its Inspector session.
- Draw distinct selectable paths for multiple routes, including shared anchor or exact endpoint pairs. In distant views show compact jump-level labels when they fit, with priority for the selected route. Keep full names in the Warden Inspector. The visible part of a clipped route remains selectable. Center on a route frames its full path and may zoom out to include both ends.
- Transferring or deleting an attached Jump Point preserves the route and the system connection. The consequence review lists the affected routes. Acceptance clears the applicable attachment and returns that end to the frame edge or authorized anchor. A move within the same system preserves the attachment. The route's schematic display does not define a transit placement contract for future ships.

### Player publication

- The preview and reader share read-only rules and use the same allowlisted document boundary. Resolve committed effective geometry before filtering. Keep only published objects and the required Orbit and host chains, with otherwise Hidden necessary hosts represented as Unknown presences. Public relationships use snapshot-local identities. Preserve the existing limits on content and Station associations.
- Hidden systems have no system marker. Unknown presence and Known type systems have their permitted generic markers at the public anchor at every detail level. Revealed systems use their public name and derive their bounds, constrained frame and reveal threshold from the public anchor and retained interior geometry. An empty published interior starts from a named minimum frame. Initial framing, Fit, Center, thresholds, labels, counts and public image bounds derive from permitted data. Identical published geometry yields identical framing regardless of private source extents.
- Publish only explicitly shared routes with at least one published system. If one end is a Hidden system, represent it as a generic Unknown destination at that system's authorized exact anchor and present the published system as the visible origin. A shared unresolved exit from a published system uses its authorized exact exit coordinate and the same generic label. Sharing a route leaves system and object disclosure permissions intact. An endpoint may follow a Jump Point in detail only if the route carries an eligible association to that independently Revealed point in the correct system of the same public document. In overview this association uses its system's public anchor. An end without such an association uses its public frame edge when available, or its authorized anchor. Share only public endpoint identities and permitted geometry.
- Players can select public markers, objects, Orbits and shared routes for inspection. Route inspection shows jump level and published endpoints, including the generic label for an anonymous end. Center frames the corresponding public marker, envelope, entity or whole route. Fit uses the full public extent. Keep a selection through semantic collapse in the same document. On document replacement reset selection and pending actions even if public IDs repeat.

### Compatibility, history, and exports

- Restore legacy editable data with its existing Cluster positions as anchors and preserve its resolved local geometry and authored unresolved exits, including nearby systems and distant content. Resolve any overlapping frames at display time while retaining the saved layout. For legacy routes derive endpoint systems from the original Jump Points and retain those references as optional attachments. Preserve surviving route identities and unresolved exit data. Silently remove resolved same-system routes and their route-only metadata during legacy restoration or import, retaining all related Jump Points and Stations. Validating new routes and endpoint edits requires distinct systems.
- Load older player files and links on the unified map from their existing public data. Use the public frame edge or authorized anchor when the document lacks an explicit association. Silently drop resolved same-system loops from the loaded legacy public document before presentation or image export. The file or link is an immutable snapshot. Keep unresolved and anonymous destinations.
- Persist applied anchors, preferred frame dimensions, placements, Orbit geometry and authored unresolved exits in the workspace and complete backups. Older backups without preferred dimensions start with content-derived frames. Use the existing restore semantics and fresh history baseline for a complete Cluster restore. An imported standalone system remains a reviewed copy. The Warden previews its envelope and chooses the new anchor. The copy preserves its internal geometry. The camera and current selection are view state, and the complete data backup is independent of the current image scope.
- Render PNG and SVG from the same scope rules on the Warden and applicable player views. Use applied map data and the corresponding disclosure boundary. For **Entire Cluster**, automatically frame the overview, system names, overview routes, and authorized unresolved or anonymous destinations. For **Selected system**, always frame the system name and complete permitted interior, including content outside its frame, independently of the live camera and saved frame dimensions. Omit the frame and overview marker. Include bounded dashed incident route segments without framing remote destinations. On the player view, offer this scope only for Revealed systems. For **Current viewport**, preserve the camera framing, zoom, detail and filters of that view. Omit menus, panels and unapplied movement or placement previews from images. Preserve bounded PNG rasterization and complete in-scope SVG geometry.

## Testing Decisions

Prefer the highest existing seam that observes the contract directly and reliably. Exercise coordinated user outcomes through the real public workflows. Use the established pure, controller, and browser seams for their distinct failure modes. Assert visible results, durable outcomes and admitted data. Avoid locking in D3 internals, exact look-and-feel constants, or incidental SVG structure. Extend existing journeys where they already cover a workflow. Follow the [repository verification guidance](../../docs/agents/testing.md) when selecting the smallest useful browser suite.

| Existing seam | Required observable coverage | Prior art |
| --- | --- | --- |
| Geometry, domain mutations, codecs and projection | Round-trip common transforms and legacy geometry, including rotated or distant Orbits. Verify envelope bounds, authority for ownership and transfer, one common group displacement, two distinct route systems, and detachment of local Jump Point references without removing a route. Test both types of legacy loop cleanup, valid route retention, and public envelopes, route attachments and image bounds against paired inputs differing only in private extents. | Existing system and Cluster geometry, selected-object placement, workspace validation, player projection, public codec, and image geometry coverage. |
| Editor command and workspace integration | Verify selection and draft ownership across systems, cancellation and stale requests, all-or-nothing group and transfer changes, history reveal, restore admission, and the saved layout or unchanged data an operation leaves behind. Test preflight and cancellation before image capture. | Existing editor transition, Search reveal, history traversal, storage/recovery, and file-operation coverage. |
| Browser journeys on the real editor and player view | Verify overview-to-detail on a single camera, name targeting, frontmost versus alternate access, desktop rectangle/right-drag, long press and pinch takeover, selection and keyboard focus across collapse, and framing of a clipped route. Verify one representative save and reopen flow, shared consultation in preview and reader, and downloads for all three image scopes without private or preview data. | Existing touch takeover, Hierarchy, search and navigation, portable player share, and image export journeys. |

### Performance acceptance

| Scene | Systems | Total catalogue objects |
| --- | ---: | ---: |
| Reference | 5 | 50 |
| Demanding | 10 | 200 |

Count stars among the objects. Include dense and sparse neighbors, overlapping envelopes, multiple detailed systems, distant geometry, routes, and a five-link Orbit branch. Record Orbit, route and object distribution. Use the Warden, preview, and reader with their applicable versions of both scenes.

- Aim for **60 frames per second** during sustained pan and zoom on a typical laptop and a mid-range smartphone in both scenes. Movement remains regular, with **no visible freeze longer than 100 ms** during a gesture. Visible click or tap selection feedback arrives in **under 100 ms**, and semantic detail settles in **under 200 ms** after zoom input ends. The camera responds during the gesture.
- Use mouse/wheel and trackpad on the laptop, and one-finger pan and two-finger pinch on a physical phone. Record device, browser version, viewport, refresh rate, and the visible object, Orbit and label counts for each tested camera segment. Measure after scene admission and initial render. Cover first reveal, repeated threshold crossings, neighboring systems, and sustained movement. Record frame intervals, observed pacing, longest pauses, selection latency and settling time. Record initial load separately if measured.
- The [prototype evidence](prototype-evaluation.md) supports the interaction choice. The measured demanding zoom samples were below the target and compact emulation was run on the laptop. Final renderer measurements and physical smartphone results remain pending.

## Out of Scope

- Inter-system objects and ships in transit, tracked in [Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60).
- Planet surface maps, station interiors, political overlays, and individual system scaling.
- Production implementation and the implementation ticket breakdown during this specification step.

## Further Notes

- The exact common drawing scale, envelope margin, minimum footprint, reveal thresholds, label placement and transition duration are tunable implementation parameters. Select them against the confirmed semantics and performance checks. Prototype values and its old individual-scaling experiment are evaluation evidence.
- Choose the necessary format versions and migration adapters during implementation planning. Keep editable and published formats separate, and use the existing restore, history and disclosure boundaries. Preserve supported legacy data subject to the confirmed same-system route cleanup.
- The next planning step is to slice this specification into implementation tickets with dependency ordering and acceptance scenarios. The [Wayfinder map](map.md) retains the source of each decision.
