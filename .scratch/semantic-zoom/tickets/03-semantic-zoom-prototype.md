---
title: Prototype stable geometry and semantic detail
status: closed
label: wayfinder:prototype
type: prototype
mode: HITL
parent: ../map.md
assignee: Codex
---

# Prototype stable geometry and semantic detail

## Question

Does a stable shared layout let the user move naturally between the Cluster, systems and nested orbital groups, and which detail/targeting rules make that interaction readable?

Build a cheap runnable prototype using the spatial and ownership decisions. Compare plausible reveal thresholds and transitions while preserving the selected geometry. Evaluate projected screen size as a candidate trigger. Record the human verdict on what should appear, remain selectable and receive input at each scale.

## Scenarios

- Zoom between two nearby systems with different densities, overlapping envelopes and several visible groups.
- Approach a planet with nested Orbits, a Moon and a Station.
- Inspect sibling Orbits with the same host and an Orbit with several occupants or an unoccupied center.
- Repeatedly cross a reveal threshold while retaining a useful camera anchor.
- Use wheel zoom, touch pinch and basic selection or placement across systems.
- Move a system by its name or anchor and scale it through selection handles and the Inspector around its fixed anchor.
- Show a minimum frame for an empty system and an envelope containing the anchor when all content is displaced to one side.
- Create objects through definite placement targets, a unique system envelope, overlapping envelopes and a point outside all envelopes. Show how the owning system is inferred or chosen.
- Move an object across a neighboring system's envelope with its existing owner, then use Change system to preview an explicit transfer of a complete hosted branch.
- Transfer a branch to a free position and to a destination Orbit across systems with different scales. Show the destination scale and editable proposals for conflicting location keys.
- Transfer a Jump Point or a referenced Station, retaining Jump Routes and presenting any Station links to remove when the transfer is accepted.

Use the [agreed representative scenes, devices and measurement targets](08-representative-scenes-and-budgets.md#resolution). Include the existing five-link orbital branch within the chosen scene totals. Surface camera, detail and target state so the transitions can be understood. Report observed performance with its device and scene context. This prototype informs the later command and publication decisions.

## Outcome

Follow the prototype skill for a runnable artifact, a retained branch and an asset pointer. Resolve this ticket through user feedback with a recorded verdict and remaining limitations. The earlier conversation illustration supplied exploratory examples and no validated interaction contract.

## Artifact under evaluation

The initial implementation is captured in `bbe8bd0f7e170e3436fcfb4c0c344043a6496d5d` on `codex/prototype-semantic-zoom`, based on `9ab9cd782abde0968348fcb283079fa9941111a5`. The overview-label refinement deliberately continues from `7c8b2924` on the same branch. The development-only entry is `/?prototype=semantic-zoom&variant=system`, launched with `npm run prototype:semantic-zoom` on port 3034. It uses in-memory fixtures and does not mount the saved-workspace editor.

The comparison concerns information hierarchy, with one stable world-space geometry and camera:

- `system` reveals a system's interior as a group once its envelope is large enough on screen.
- `orbit` reveals orbital groups independently according to their projected size, retaining their ancestors.
- `focus` adds context retained around the current selection to the orbital policy.

Switching policy must preserve the camera, selection and in-memory edits. The prototype exposes relevant state and measured interaction timings. It uses Warden interaction scenarios to decide the navigation contract; player disclosure and production renderer integration remain in their dependent tickets.

## Resolution

The user selected System Envelope and requested much larger system names above the map geometry at distant zoom. The envelope switches between an overview and the system's internal detail according to its projected size. Stable map geometry remains the basis for both states. The exact thresholds and label styling are prototype values. Detailed editing and targeting contracts belong to the dependent editing ticket.

The overview uses bold screen-sized names. Nearby names are spaced vertically where room permits, with thin leaders connecting displaced names to their envelopes. The overview names support selection and system movement. The annotation layer also preserves readable names when an envelope reveals its interior at a distant camera scale.

The prototype retains the original individual scaling experiment. The later [shared spatial layout decision](01-shared-spatial-layout.md#resolution) specifies one common scale for the product.

The guide on the prototype branch provides the walkthrough. The [evaluation record](../prototype-evaluation.md) records tested interactions, local timing samples and remaining limits. The initial local zoom samples fell below the agreed 60 fps target. Physical smartphone measurements are still pending.

## Blocked by

- [Place star systems on a stable shared canvas](01-shared-spatial-layout.md)
- [Define ownership and placement across system boundaries](02-system-ownership-and-placement.md)
- [Choose representative scenes and interaction budgets](08-representative-scenes-and-budgets.md)
