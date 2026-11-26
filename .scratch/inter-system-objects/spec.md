---
title: Zones and catalogue objects on routes
status: open
framing_status: approved
specification_status: ready
verification_plan_status: approved
triage_labels:
  - enhancement
  - ready-for-agent
---

# Zones and catalogue objects on routes

## Source issue

[Place and manage inter-system objects, including ships on Jump Routes](https://github.com/Submoon/ttrpg-cluster-control/issues/60) was refreshed on 2026-11-26. It remains open with the enhancement label and no comments. It requests objects outside arbitrary star-system ownership, ships along Jump Routes, semantic-zoom integration, and durable placement and relationships. The semantic-zoom prerequisite was completed on 2026-11-24.

The user approved the revised framing on 2026-11-25: generic Zones and route transit replace unrestricted free inter-system placement. That approved direction governs this specification. The GitHub body has not been rewritten; the local specification is the authoritative implementation plan.

## Baseline

The specification uses fetched origin/main at c649b576f1636c8ffec57da6b6112b6316bee882, verified on 2026-11-26. Local main and codex/issue-60-framing were fast-forwarded to that revision, preserving uncommitted planning documents and existing local environment files. There is no intentionally different implementation base.

The earlier framing used aab5a0c386c3d47959019d90867dc60a303982da. The intervening range was inspected: it changes interface copy, map badges and hit areas, and selection-ring behavior; it does not introduce route-owned catalogue objects. Existing test and editor boundaries were checked against the newer baseline.

## Problem Statement

Wardens prepare places that are not necessarily stellar systems, yet every local map is presented as a star system and starts with a seeded star. Catalogue objects must currently belong to one such container. A ship cannot be represented as the same authored object travelling along a Jump Route without assigning it an artificial local owner.

Placement also permits accepted coordinates beyond an authored local frame. A Warden needs to see where an object and its orbital branch will actually land, transfer it to another valid place, and avoid creating new objects stranded between places. New Location keys must identify objects across the whole Cluster while existing campaigns retain their data.

## Solution

Use one generic local-map container called a Zone, created empty. A Zone may represent a stellar system, an isolated installation or another named region. A catalogue object is either in a Zone, directly or through an Orbit, or on a route on a Jump Route with its hosted branch.

Creation and relocation use the same target model: drop onto a Zone or route. An existing object keeps its identity and authored content. Route progression is manual and editable precisely. Reaching an endpoint does not detach it automatically.

During a drag, show the object under the pointer and a translucent ghost of the entire branch at the position that will be applied. The pointer may cross empty space; the accepted landing remains on a valid support. Within a Zone, bound the manipulated root by its permitted elastic reach and enlarge the frame for descendants when feasible. Neighboring Zones remain fixed and non-overlapping. Numeric edits reject impossible positions.

Integrate this model with the existing guarded editor, hierarchy, object Search and filters, semantic zoom, history, complete backups, scoped image exports, and allowlisted player documents. Preserve older duplicate keys and out-of-frame placements without silently repairing them.

## User Stories

1. As a Warden, I want to create a Zone for a place without stars, so that I can map an isolated installation or region without inventing a stellar system.
2. As a Warden, I want to start every new Zone, including the first one, empty, so that I choose its contents.
3. As a Warden, I want to add stars through the ordinary catalogue, so that a stellar system is one use of a Zone.
4. As a Warden, I want to retain existing local names and contents under the Zone terminology, so that updating the application preserves my campaign.
5. As a Warden, I want to see Zone used consistently for generic local maps, so that commands and inspection describe the same concept.
6. As a Warden, I want to create any catalogue type directly in a Zone, so that placement is independent of an obligatory star.
7. As a Warden, I want to create any catalogue type directly on a route, including a stationary obstacle, so that the route records hazards and other locations as well as moving ships.
8. As a Warden, I want to use the same placement targets for new and existing objects, so that creation and relocation follow the same model.
9. As a Warden, I want to place an existing object onto a chosen route or Zone, so that I can advance or correct the campaign without an artificial origin restriction.
10. As a Warden, I want to preserve identity, names, notes, Fields, publication and marker settings during relocation, so that a route object remains the same object.
11. As a Warden, I want to move a root with its hosted Orbits and recursive occupants, so that a planet, its moons and their installations travel together.
12. As a Warden, I want to remove a transferred occupant from its former parent Orbit, so that its old placement does not remain as a broken relationship.
13. As a Warden, I want to preserve branch dimensions, orientations and internal relationships, so that changing context does not distort the map.
14. As a Warden, I want to review incompatible relationship changes before acceptance, so that a transfer has understandable consequences.
15. As a Warden, I want to detach a departing Jump Point from its local route attachment while preserving the Zone connection, so that transit does not redefine route endpoints.
16. As a Warden, I want to assign new Location keys uniquely throughout the Cluster, so that a key does not ambiguously identify a new object.
17. As a Warden, I want to include objects in Zones and on routes when allocating keys, so that transit does not create a second key namespace.
18. As a Warden, I want to reject duplicate new key edits before application, so that changing a key cannot introduce an invalid assignment.
19. As a Warden, I want to retain existing duplicate keys on opening and unrelated edits, so that older campaign references are not rewritten.
20. As a Warden, I want to retain existing out-of-frame positions on opening, so that the application does not rearrange an older map.
21. As a Warden, I want to bound new or changed local placements by permitted Zone expansion, so that new objects do not become stranded outside their place.
22. As a Warden, I want to refuse impossible numeric coordinates with useful feedback, so that the Inspector cannot bypass map placement rules.
23. As a Warden, I want to follow the pointer with the dragged object during preview, so that I can aim across empty space at another Zone or route.
24. As a Warden, I want to see a translucent ghost at the actual landing position, so that I can predict the accepted result.
25. As a Warden, I want to include every hosted Orbit and occupant in the ghost, so that I can assess the whole branch.
26. As a Warden, I want to enlarge the destination Zone frame for descendants when possible, so that the branch fits without independent child clamping.
27. As a Warden, I want to keep neighboring Zones fixed and non-overlapping, so that moving one object does not rearrange other places.
28. As a Warden, I want to limit the ghost to the last feasible position when frame growth is obstructed, so that an impossible placement is apparent before release.
29. As a Warden, I want to apply the bounded ghost when releasing an existing Zone object over empty space, so that the object remains in its current Zone.
30. As a Warden, I want to apply the projected route ghost when releasing a route object away from other targets, so that the object remains on its current route.
31. As a Warden, I want to reject a new-object drop without a valid Zone or route, so that creation cannot produce free Cluster objects.
32. As a Warden, I want to replace the fallback landing when aiming at a valid Zone or route, so that the same gesture can complete a deliberate transfer.
33. As a Warden, I want to preserve geometry when confirming an unchanged valid position, so that a no-op does not create an artificial movement.
34. As a Warden, I want to drag a route object along a route manually, so that position follows the campaign rather than an automatic clock.
35. As a Warden, I want to enter a precise route percentage, so that I can place a route object at a known relative stage.
36. As a Warden, I want to refuse invalid route percentages, so that progress remains finite and within departure and arrival.
37. As a Warden, I want to retain progression when a route is reshaped or retargeted, so that the route object follows the route at the same relative stage.
38. As a Warden, I want to complement progression on a simple departure/arrival reversal, so that the stage along the same trip is preserved.
39. As a Warden, I want to keep a route object attached at either endpoint, including an unresolved exit, so that arrival does not trigger an implicit context change.
40. As a Warden, I want to detach into a valid chosen Zone through an explicit action, so that leaving transit never produces an object in empty Cluster space.
41. As a Warden, I want to pan and zoom without changing saved placement or progression, so that consultation is not an edit.
42. As a Warden, I want to cancel a gesture, review or draft transition without changing the campaign, so that previews are safe to explore.
43. As a Warden, I want to reject stale transfers after their context changes, so that an old confirmation cannot affect a newer map.
44. As a Warden, I want to undo a transfer, frame growth and accepted relationship changes in one action, so that I can reverse the operation coherently.
45. As a Warden, I want to redo the complete operation with useful selection context, so that history remains understandable across Zone and route placement.
46. As a Warden, I want to list route objects and their branches in route-deletion review, so that the resulting cascade is explicit.
47. As a Warden, I want to remove route objects and hosted branches with a confirmed route deletion, so that no detached objects remain without a valid place.
48. As a Warden, I want to include incident routes and their route objects in Zone-deletion review, so that indirect destruction is visible.
49. As a Warden, I want to cancel deletion without changing data or history, so that reviewing consequences does not itself edit the campaign.
50. As a Warden, I want to nest local objects under their Zone and route objects under their route in Hierarchy, so that I can find an object's current place.
51. As a Warden, I want to search object names and keys in both contexts, so that transit does not hide an object from navigation.
52. As a Warden, I want to apply Type, Field and publication criteria to route objects, so that filtering remains consistent across the map and Search.
53. As a Warden, I want to inspect and edit the same catalogue information on a route, so that a route object does not lose its capabilities.
54. As a Warden, I want to retain root markers in distant views and reveal branches closer up, so that the continuous map remains readable.
55. As a Warden, I want to retain selection when branch detail collapses, so that zooming does not lose the object I am working with.
56. As a Warden, I want to keep keyboard, touch and compact editing usable, so that the feature fits existing interaction paths.
57. As a Warden, I want to use the existing four publication levels on route objects, so that disclosure remains an authored choice.
58. As a Warden, I want to publish a route object without publishing its private route, so that its permitted position can be shared independently.
59. As a player, I want to have private route paths, names, progression, destinations and source identities withheld, so that seeing an object does not expose its private association.
60. As a player, I want to inspect permitted association and progression on a shared route, so that I can understand a published route object's place along it.
61. As a Warden, I want to leave object disclosure unchanged when sharing a route, so that Hidden route objects are not revealed automatically.
62. As a player, I want to retain only required Orbit and host chains with minimum disclosure, so that visible descendants do not reveal unrelated preparation.
63. As a player, I want to derive public framing, counts and image bounds from permitted content, so that private branches do not affect consultation.
64. As a Warden, I want to use the same publication rules in preview, reader, files and immutable links, so that exported consultation matches my preview.
65. As a Warden, I want to round-trip all Zones, route objects, branches, policies and geometry in complete local/cloud backups, so that restoration is faithful.
66. As a Warden, I want to retain an applied transfer after save and reload with existing save-error feedback, so that transit uses the same durability contract as other edits.
67. As a Warden, I want to export only a Zone's own content and internal relationships in a standalone file, so that a local-map copy does not pull in unrelated route objects.
68. As a Warden, I want to review newly introduced key conflicts when copying a Zone, so that an independent copy respects Cluster-wide assignments.
69. As a Warden, I want to include route object roots in Cluster images and current detail in viewport images, so that routes and their objects are represented together.
70. As a Warden, I want to retain local scope and bounded route stubs in selected-Zone images, so that remote route objects do not enlarge a Zone export.
71. As a Warden, I want to exclude unapplied pointer and ghost previews from every export, so that artifacts describe the accepted campaign.
72. As a Warden or player, I want to read older supported files and clearly reject malformed new files, so that compatibility does not silently erase transit or accept corrupt data.

## Implementation Decisions

### Domain, terminology and placement contracts

- Generalize the existing local-map container to Zone throughout generic product language, creation, inspection, Search context, history descriptions and sharing. A stellar system is possible Zone content. Keep authored names and contents unchanged.
- Create initial and subsequent Zones empty. Retain the existing requirement for at least one source Zone; introduce neither a zero-Zone source workspace nor a second container type.
- Keep stable catalogue identity and authored values separate from location. A root has exactly one Zone or route context. Orbit occupants inherit the context of their hosted branch. No free Cluster-position placement is valid for a new object.
- Extend placement and context-aware lookup/selection interfaces to support route roots with a route reference and normalized progression. Keep hosted Orbits, recursive occupants and effective geometry with the same branch. Unoccupied-center Orbits remain local to a Zone; independent route-owned Orbit centers are outside this effort.
- Reuse the common schematic scale and existing effective Orbit calculations. Changing context preserves a branch's size, proportions, internal angles and orientation.
- Route object includes stationary obstacles, anomalies, derelicts and every other catalogue type, as well as moving ships. Route position is a manually chosen relative position, not evidence of automatic travel; no vessel-only rendering, Search or filter restriction is permitted.

### Landing proposals and gesture ownership

- One framework-independent landing calculation supplies the candidate context, root position, complete branch geometry, required frame change, relationship consequences and rejection reason. Preview and accepted mutation consume that proposal contract instead of implementing separate placement policies.
- Preserve existing limited root elasticity and fixed neighboring-frame constraints. Browser adapters supply scene transforms and input context; pure calculations do not access Vue, the DOM, Pinia or storage.
- The directly manipulated object determines the requested landing. Fit descendants by frame growth while retaining their geometry. If a neighboring Zone prevents that growth, resolve the last feasible complete landing or reject the change. Do not overlap or move neighboring frames, compress the branch, or automatically move the camera.
- Show the pointer-following object and a distinct translucent landing ghost. The ghost includes the root, every hosted Orbit and recursive occupant at their actual candidate positions. It is an unapplied preview.
- A valid Zone or route target enables a deliberate transfer. With no new target, project an existing object onto its current support: a Zone's allowed elastic region or its existing route. Release applies the visible ghost proposal after final context validation. Without an initial support or valid target, new creation is rejected.
- Retain existing target-candidate arbitration where marks compete. Make the chosen context and final geometry apparent before acceptance; release cannot silently choose a different context.
- Numeric local-coordinate edits reject impossible proposals and do not infer another owner from a typed position. A deliberate context-changing action moves to another Zone or route. Route edits expose finite progression from 0% through 100%.
- Reuse native gesture ownership, pointer-release cancellation, touch/pinch arbitration and existing keyboard placement paths. A cancelled, superseded or disposed gesture cannot later publish its proposal.

### Context transitions, routes and deletion

- A transferred root leaves its former parent Orbit; its hosted branch travels with it. Preserve compatible internal relationships. Present incompatible links in the existing consequence review and apply accepted fixes with the transfer.
- Routes continue to connect two different Zones, optionally through local Jump Points, or a Zone and an unresolved exit. A Jump Point leaving its endpoint Zone clears that local attachment after review; the route retains its Zone connection. There are no free inter-Zone Jump Point endpoints.
- Route progression is manual and logical, independent of camera state. A route object follows its route when the displayed path changes while keeping progression. Retargeting the same route keeps progression; a simple reversal complements it.
- Reaching 0% or 100% does not detach the object. Explicit relocation or Detach requires a valid Zone and landing proposal. There is no free-space fallback or automatic travel simulation.
- Confirmed route deletion cascades to all its route objects and hosted branches. Zone deletion includes the same cascade for incident routes. The review enumerates indirect effects; cancellation preserves source data and the history position.
- Preserve existing acyclic Orbit and relationship invariants. Reject invalid or circular dependency proposals before application rather than silently dropping extra links.

### Keys and compatibility exceptions

- Allocate and validate newly assigned Location keys against all objects in the Cluster, including route contexts. Moving the same entity retains its existing key; a new key assignment must be globally available.
- Retain existing duplicate assignments and out-of-frame placements from supported older maps. Opening, saving, unrelated edits, complete restore and history traversal must not silently rename or reposition them.
- Compatibility is specific to the retained assignment or placement. It is not permission to introduce a new duplicate or new invalid geometry. Editing the relevant key or placement invokes current rules.
- Persist the information needed to distinguish retained exceptions from malformed current data across save, history and complete backup round trips. Do not weaken the current schema globally or rely on a one-time in-memory hydration flag.
- Full backup restoration retains replacement semantics and saved entity identities. A standalone Zone import remains an independent reviewed copy. Its newly assigned identities and keys must be valid in the destination; propose necessary key replacements before acceptance rather than changing destination objects or silently rewriting notes.
- Version affected complete-source and public-document formats explicitly when their shapes change. Admit supported older forms through explicit compatibility paths; reject missing or malformed required current-version fields. Keep source and public version lifetimes independent, preserving the standalone Zone format's separate scope.

### Editor, hierarchy and query integration

- Reuse focused object, Orbit, route and chart sessions and guarded commands. Context-aware commands identify a Zone or route directly; components do not assemble multi-step mutations or invent a synthetic Zone for a route object.
- Keep the workspace writer, mutation coordinator, revision checks, durable acknowledgements and history timeline as the sole publication/persistence path. One accepted operation includes location, frame growth and relationship changes. Failed durability retains existing applied-memory and retry behavior.
- Pinia continues to own transient shared interface state. Mounted maps own browser gestures and rendering resources. Pointer previews, ghosts, cameras and unresolved confirmations do not become committed workspace data.
- Nest route-associated branches under their route and local branches under their Zone. Preserve selection and guarded inspection through context changes. Extend object Search, result context and criteria inventories to route objects; preserve independent Search and map criteria lifetimes.
- Keep root markers available in distant views, reveal hosted detail progressively and retain selection through semantic collapse. Apply generic Zone language while preserving the current concise interface copy, visibility badges and usable hit areas.
- Reuse desktop, compact, keyboard and touch interaction patterns, including focus return and accessible consequence review.

### Publication and presentation boundaries

- Use the existing Hidden, Unknown presence, Known type and Revealed policies, private GM notes, separate player text, Field permissions/masks and required-host minimum disclosure.
- A route object can be published independently of its route and endpoint Zones. When its route is private or omitted, emit only authorized detached object/branch geometry and content. Withhold the private route association, percentage, path, source route name, destinations and source identifiers.
- A shared route retains the existing requirement for at least one published endpoint Zone. Hidden endpoints use the existing anonymous authorized destination geometry. Route sharing does not promote route objects or Jump Points.
- When the association is permitted, represent it only through public identities and authorized progression. Public rendering and bounds use the public graph; private route inventory, source ordering and hidden branches must not affect public route layout.
- Resolve effective committed branch geometry before filtering; do not recompute default Orbit placements from reduced sibling lists. Player presentation receives detached allowlisted records, never the complete Warden workspace.
- A permitted route object remains consultable even when no Zone marker or route is published. Public-document eligibility must recognize retained public objects rather than requiring a Zone marker in every document; a wholly empty public document remains undistributable.
- Preview, reader, JSON, immutable links, SVG and PNG use the same allowed model and scope. Public hierarchy cannot disclose a private route through a parent row, label, count or empty placeholder.

### Persistence and export scope

- Complete local/cloud backups retain all accepted Zone, route, route object and branch data, geometry and policies. Save/reload and recovery use the existing single storage owner.
- A standalone Zone file contains that Zone's own objects, Orbits, applicable shared settings and internal references. It excludes route-owned route objects and retains reviewed copy-import behavior.
- Entire-Cluster images use overview detail including route object roots. Current-viewport images preserve that view's framing, applicable detail and filters. Selected-Zone images retain local detail and bounded incident-route stubs without pulling remote route objects into their extent.
- Source and public exports exclude unapplied gestures, ghosts and placement drafts. Export preflight and asynchronous context checks remain operation-owned; stale preparation cannot download a newer or unrelated map.
- Undo/Redo restores the whole accepted action, including geometry, context, frame and link changes. Keep existing save-state gates, capacity handling, history reveal and baseline resets for complete restore.

## Testing Decisions

### Proposed boundaries and good tests

The primary integration seam is the existing real guarded editor operation from proposal and draft resolution through mutation verdict, history and writer. Extend that seam for Zone/route context rather than add a test-only application facade.

Use focused pure tests where failure is deterministic, and a small number of browser journeys where native input, rendering, downloads or IndexedDB are the risk. Follow the repository's existing boundary policy and avoid repeating a validation matrix in a browser.

The user approved this plan on 2026-11-26 with an explicit condition: keep browser journeys limited, as required by the project rules. Build most coverage with domain and controller tests. Extend the existing owning journey with the smallest useful assertion; do not create one browser journey per story, catalogue type, input mode or validation branch. The matrix below allocates obligations to boundaries, not new test cases. A new browser scenario needs a named important failure that existing journeys and deterministic/controller tests cannot observe. Use temporary visual inspection for incidental styling rather than grow the permanent suite.

A useful test asserts an observable contract: accepted context and data, an unchanged campaign after rejection, exact branch preservation, complete history results, a durable round trip or permitted public output. Its oracle must be independent of the production calculation under test. Do not assert incidental component structure, internal D3 selections, an exact chosen opacity or arbitrary layout constants.

### Verification matrix

| Boundary | Modules exercised | Required evidence | Existing prior art |
| --- | --- | --- | --- |
| Pure domain and geometry | Context-aware placement, effective branch geometry, frame limits, route progression, relationship/deletion planning and key assignment | Ghost proposal/accepted geometry agreement; root elasticity and descendant growth; blocked neighbors; progression endpoints/reversal; valid target transfer; one-context/acyclic identity invariants; reviewed cascade; current versus retained legacy assignments/positions | Hosted-branch transfer, elastic placement, continuous route geometry, occupied Orbit geometry and workspace validation coverage |
| Pure codecs and publication | Source restore/export/copy import, public projection/admission, public and source image scene preparation | Full round trips; preserved legacy duplicates/outliers; strict malformed-current rejection; global new-key conflicts; object-only public documents; private route association omitted; hidden branches absent from framing and metadata; correct image/local-file scope | Workspace codec and JSON import, public object/route projection and codec, shared-geometry privacy and image-scene coverage |
| Real editor commands and controllers | Object/Orbit sessions, transfer/consequence operation, mutation coordinator, history and ordered writer | Capture and recheck identity/revision; cancellation and stale-context rejection; no partial publication; one history action; complete Undo/Redo; separate memory verdict and durable acknowledgement; export-preparation ownership | Transfer workflow/draft checks, main history integration, mutation verdict, save-order and Search reveal coverage |
| Focused browser and storage journeys | Mounted continuous editor, Inspector/Hierarchy/Search, native gestures, IndexedDB, file downloads and independent player reader | Pointer preview and full-branch ghost at readable zoom; release matches the ghost; Zone/route transfer; invalid numeric input; compact/touch cancellation; representative save/reload, cascade Undo and public file/link/image consultation | Existing object branch-transfer, continuous routes, editor launch/reopen, native gesture arbitration, private files and player-publication journeys |

### Required representative cases

- Exercise a root with two levels of hosted Orbits and occupants using an independent pre-action geometry oracle. Verify the accepted branch and ghost agree after pan/zoom and cross-context transfer.
- Distinguish empty-space release of an existing Zone object, empty-space release of a route object and creation without valid support. Only accepted landing geometry is committed.
- Check neighbor-limited growth and impossible typed coordinates in pure/controller coverage; keep the browser assertion proving real controls and input are wired to that policy.
- Retain separate legacy fixtures for duplicate keys and out-of-frame coordinates. Unrelated edits and complete round trips preserve them; relevant new assignments/placements obey current rules.
- Verify direct creation and relocation for every catalogue family at the deterministic seam; use a representative route object and hosted branch in the browser.
- Test route reshape, retarget, simple reversal, 0%/100%, explicit departure from transit, unresolved exit and cascade deletion. Inspect observable data and history rather than callback counts alone.
- Compare paired inputs with identical permitted published geometry/content and different private inventory. Public documents, hierarchy, image bounds and serialization remain identical where allowed output is unchanged.
- Include a published route object with an unpublished route and Hidden endpoint Zones. The detached reader works without a synthetic Zone or private route placeholder.
- Extend maintained create/reopen, hosted-transfer and publication journeys where possible. Add a browser scenario only for a distinct native-input, data-loss or disclosure failure that those journeys cannot observe.
- Keep cascade Undo in the maintained deletion/history journey, save/reload in the maintained workspace journey, and public consultation/download assertions in the maintained publication/reader journeys. Do not add parallel end-to-end versions of the same deterministic contract.
- Preserve first-failure traces and screenshots and describe viewport emulation accurately. Review a readable detail capture of the pointer/ghost branch and relevant compact states before broad visual acceptance.

Run focused deterministic and controller checks during slices, then freeze the integrated candidate for relevant browser journeys and cumulative qualification. Follow existing no-retry, artifact-ownership and source-freeze rules. This specification describes required evidence; runtime tests have not been executed as part of drafting it.

### Boundary confirmation

The product framing was approved on 2026-11-25. On 2026-11-26, the user confirmed the proposed verification boundaries while explicitly requiring limited browser journeys in accordance with repository guidance. That condition is incorporated above. The specification is ready for dependency-aware ticket breakdown without further product triage.

## Out of Scope

- Free catalogue objects or unoccupied-center Orbits between Zones.
- Free Jump Point endpoints, routes following a Jump Point outside its endpoint Zone, same-Zone route loops or zero-Zone source workspaces.
- A second local-container type or mandatory Zone subtype classification.
- Automatic travel, elapsed-time simulation, speeds, schedules or automatic endpoint detachment.
- Automatic Zone capture/release when moving or resizing frames, automatic relocation of neighboring Zones, frame overlap or forced movement of legacy outliers.
- Automatic renaming of existing duplicate keys, rewriting references embedded in prose, or replacing stable entity identity with Location keys.
- Expanding Search to new entity kinds such as routes or Orbits; this change covers catalogue objects in their two contexts.
- New storage, history or publication owners, a player synchronization service, mutable player links or Warden source records in public renderers.
- Redesigning unrelated editor chrome, political overlays, planetary surfaces, station interiors or individual Zone scaling.
- Implementation tickets, runtime implementation, source-issue closure, merge or release.

## Further Notes

The [approved framing](framing.md) is the retained decision record for this specification. The [earlier free-space discussion](earlier-framing.md) is superseded history and must not override it. The [domain glossary](../../CONTEXT.md) and [Zone/transit decision](../../docs/adr/0004-zones-and-route-transit.md) record the accepted language and scope.

This is a multi-session feature touching domain ownership, geometry, persistence, public disclosure and destructive consequences. Split work into dependency-aware vertical slices from this specification, keeping existing acceptance evidence for unchanged areas. Each slice must preserve coherent current/legacy admission and the single mutation/persistence path.

Publishing this specification means updating the local planning artifact under this repository's tracker policy. The enhancement and ready-for-agent roles are recorded on this local plan. The GitHub source remains the intake request; this drafting task does not update its body, labels or completion state.
