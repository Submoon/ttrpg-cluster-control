---
title: "Global search with branch-aware map framing"
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

## Problem Statement

Wardens can browse the Jump Cluster and the active star system, but cannot find a named entity across their entire local workspace without manually changing maps and inspecting the hierarchy. Repeated names, repeated Location keys across systems and imported copies make a text match insufficient to identify an intended destination. Finding an entity must also make it visible without losing unfinished editing work or concealing the result behind mobile panels.

## Solution

Provide a visible, accessible search entry for the current workspace. Search the Jump Cluster name, every star system name, every catalogue object's name and its Location key, including systems whose maps are not open. Match literal text without case or accent sensitivity, ranking exact matches before prefixes and other substrings. Preserve distinct entity identities and give homonyms enough context to be selected deliberately.

Explicitly activating a result performs one guarded editor operation. A cluster result opens and fits the Jump Cluster map; a system result selects and frames its node on that map; an object result opens its containing system and selects the object. Object framing includes all recursively hosted Orbits and their occupants, while excluding parent and sibling branches. Prioritize seeing the complete selected branch over keeping every small label readable.

After success, show the map, close search and focus the map. Keep the query for reopening during the same editor session. Retain useful desktop panels, hide the compact fullscreen panel and leave Inspect available without automatically opening it. Searching and browsing results remain consultation: existing Apply/Discard/Stay guards govern any transition away from a modified draft.

## User Stories

### Scope and matching

1. As a Warden, I want to open search from either map context, so that I do not have to return to a particular screen before looking for something.
2. As a Warden, I want search to cover the entire current workspace, so that objects in unopened systems are discoverable.
3. As a Warden, I want to find the Jump Cluster by its name, so that I can return to its overview directly.
4. As a Warden, I want to find any star system by name, so that I can locate its position within the cluster.
5. As a Warden, I want to find every catalogue object's name, so that the search covers all existing object families and subtypes.
6. As a Warden, I want to search a Location key as well as a name, so that a keyed description can lead me to its map object.
7. As a Warden, I want matching to ignore case and accents, so that ordinary typing differences do not hide a result.
8. As a Warden, I want surrounding query whitespace ignored and punctuation treated literally, so that copied names and keys behave predictably.
9. As a Warden, I want exact matches before prefixes and other substrings, so that the most direct textual match is easy to reach.
10. As a Warden, I want one result for an entity whose name and key both match, so that matching multiple fields does not create duplicate rows.
11. As a Warden, I want empty input to invite typing and an unmatched query to report no matches, so that neither state looks like a broken search.
12. As a Warden, I want all matching entities to remain reachable, so that an arbitrary result limit cannot silently hide my destination.
13. As a Warden, I want search to use current applied data, even while saving is pending, so that it agrees with the editor's current workspace.
14. As a Warden, I want unapplied drafts and placement previews excluded from search, so that unfinished proposals are not presented as committed map destinations.
15. As a Warden, I want results to reflect renaming, importing, deletion and Undo/Redo, so that the search does not keep stale entities or labels.

### Identity and disambiguation

16. As a Warden, I want results to show entity type and system context, so that similarly named systems and objects are distinguishable.
17. As a Warden, I want object results to include their Location key, so that I can compare them with my keyed notes.
18. As a Warden, I want matching entities with identical names or case-equivalent keys to remain separate, so that text normalization never merges their identities.
19. As a Warden, I want otherwise identical result labels to have an additional occurrence number, so that repeated imported systems and their objects remain individually selectable.
20. As a Warden, I want result disambiguation to leave stored names and keys intact, so that search does not change my campaign data.

### Activation and navigation

21. As a Warden, I want typing, hovering and moving through results to leave my map unchanged, so that I can inspect choices before navigating.
22. As a Warden, I want activating a cluster result to open and fit the cluster map, so that I can see its complete overview.
23. As a Warden, I want activating a system result to select its node on the cluster map, so that I can see where it is without entering its local map.
24. As a Warden, I want activating an object result to open its containing system and select that exact object, so that a result from another map reaches the right destination.
25. As a Warden, I want search activation to work independently of the current map tool, so that finding a target cannot accidentally place or move something.
26. As a Warden, I want every activation, including the current result again, to perform its framing, so that I can recover the target after manually moving the camera.
27. As a Warden, I want a removed target or an obsolete pending request rejected, so that delayed navigation cannot take me to the wrong map or selection.
28. As a Warden, I want ordinary map visits to retain their existing camera and selection behavior, so that search does not replace familiar Back and revisit navigation.

### Branch framing and presentation

29. As a Warden, I want an object result framed together with its hosted Orbits, occupants and recursively nested branches, so that I see the complete structure associated with the target.
30. As a Warden, I want the selected object's parent Orbit, siblings and unrelated links excluded from that branch, so that a local result does not become a fit of the whole system.
31. As a Warden, I want a system result framed as its visible cluster node, so that the camera agrees with the chosen cluster destination.
32. As a Warden, I want framing to account for visible marks, Orbit rings and labels, so that fitting an anchor alone cannot leave important content outside the view.
33. As a Warden, I want the entire branch contained with a margin even when it is large, so that I can understand its extent before manually zooming into smaller labels.
34. As a Warden, I want an isolated target shown at a useful scale with surrounding context, so that a tiny symbol does not fill the viewport at maximum zoom.
35. As a Warden, I want framing to use the map area actually available around panels and controls, so that the target is not hidden behind interface chrome.
36. As a Warden, I want search framing to occur after the destination map has mounted and restored its visit, so that remembered camera feedback cannot overwrite the result.
37. As a desktop Warden, I want existing panels retained when the result remains visible, so that search does not unnecessarily dismantle my working layout.
38. As a mobile Warden, I want the fullscreen panel hidden after activation, so that I can see the framed map instead of immediately covering it with Inspect.
39. As a Warden, I want Inspect to remain available without opening automatically, so that I choose when to consult or edit the result's details.

### Drafts, keyboard and session lifetime

40. As a Warden, I want opening, browsing and closing search to preserve drafts, so that merely looking for a destination cannot discard work.
41. As a Warden leaving a modified draft, I want the existing Apply/Discard/Stay choices, so that search follows the editor's established transition rules.
42. As a Warden choosing Stay or encountering invalid Apply, I want the starting map, selection and camera retained with the query available, so that a refused transition does not partly navigate.
43. As a Warden selecting the target of an existing editing session, I want that session preserved, so that reselecting the same entity does not recreate or discard its draft.
44. As a Warden, I want successful activation to close search and focus the map, so that I can immediately continue exploring the revealed result.
45. As a Warden, I want search to retain its query across hide/reopen and responsive reflow during the editor session, so that repeated consultation does not require retyping.
46. As a Warden, I want that query reset when the workspace identity changes or the editor exits, so that a new editing context does not inherit unrelated search state.
47. As a keyboard user, I want visible access without a mandatory shortcut, keyboard result traversal and explicit Enter activation, so that the complete search flow is usable without a pointer.
48. As a keyboard user, I want Escape to close search and return focus to its opener, so that dismissal does not also cancel an editor tool or draft or pan the map.
49. As a user typing with composition input, I want composition keystrokes to remain owned by the input, so that accepting text does not accidentally activate a result.
50. As a mobile Warden, I want to type with the software keyboard, scroll results, tap a result and see its framed map, so that the full flow works on a phone.
51. As a Warden, I want drafts and the session query preserved across resizing or rotation, so that responsive presentation does not change the meaning or ownership of my work.
52. As a Warden, I want search consultation and framing to create no data edit or Undo/Redo action, so that navigation cannot pollute the editing history.

## Implementation Decisions

### Search data and identity

- Search one current local workspace, which contains one Jump Cluster. Include the cluster name, all system names and all catalogue-object names and Location keys. Do not add another workspace collection or search recovery snapshots.
- Read the latest applied workspace, independently of whether its durable-save acknowledgement has arrived. Unapplied editing sessions and temporary geometry proposals are excluded. Refresh derived results after applied changes, imports and history traversal; a persisted duplicate index is unnecessary.
- Normalize surrounding query whitespace, case and accents for literal text matching only. Classify each entity by its strongest matching eligible field: exact, then prefix, then substring. Use a deterministic tie-break for unchanged data. Typo correction and fuzzy scoring are excluded.
- Preserve stable entity identity separately from display text and normalization. A result carries sufficient workspace, cluster, system and entity identity for its destination. Never deduplicate distinct entities by a name, normalized key or breadcrumb.
- Display type and containing context, including an object's Location key. If those values still collide, add a deterministic occurrence number in results only. Do not rename data, expose internal IDs merely to resolve a collision, or promise that a display occurrence number is durable identity.
- Empty input invites typing without enumerating every entity; an unmatched query has explicit feedback. All matches must be reachable through accessible scrolling or another suitable list strategy. A rendering optimization must not silently discard later results.

### One complete guarded reveal operation

- Use the editor command boundary as the single principal integration seam for activation. Provide a focused result-reveal operation rather than requiring the search component to coordinate several selection and navigation calls.
- The operation owns draft resolution, captured context, destination validation, accepted selection/map updates and a truthful accepted or rejected outcome. Keep the specialized editing sessions and their existing Apply/Discard/Stay sequencing; do not relocate drafts into search UI state.
- Revalidate ownership and target existence after asynchronous guards and before any deferred map reveal or focus change. A stale request, deleted target, disposed editor or newer context must not receive a late camera/selection update. Repeated activation must not queue obsolete reveals.
- Destination semantics are explicit: cluster -> cluster view and full-map fit; system -> cluster view with that node selected; object -> owning system view with that exact object selected. Selecting a cluster node does not implicitly replace the editor's separately remembered active system.
- Search activation is navigation, regardless of the current tool. Reuse existing guarded transition and tool/gesture ownership, including continuous adjustments and placement previews. Do not publish a placement or geometry edit through a result click. Accepted context transitions retain established tool-reset behavior; rejected ones retain the starting context.
- Stay or invalid Apply must not partly change the destination map, selection or camera. Preserve the query and existing editing feedback; Stay returns usable focus to search after its guard closes. Reselecting the current editing target preserves that session.
- An explicitly accepted Apply remains an ordinary editor mutation, with memory publication and durable saving acknowledged separately. If the subsequent reveal becomes stale, do not invent a rollback of that legitimate edit or replay it. Search itself adds no workspace mutation or history entry.

### Framing, panels and camera lifetime

- Define the object branch by domain relationships: the object, each Orbit hosted by it, those Orbits' occupants, and recursively hosted branches. Exclude its parent Orbit, sibling objects, unrelated Jump Routes and optional physical Station associations. The branch definition does not follow arbitrary reference links.
- A system result frames only its card/node and label on the cluster map because its internal objects are not drawn there. A cluster result fits the complete cluster map through the existing overview behavior.
- Compute branch bounds from visible object marks, Location keys, names and Orbit rings, not only anchors or glyphs. Exclude invisible hit areas and editing handles. Rendering groups are not a substitute for domain descendant traversal.
- Center the complete selected branch with a margin inside genuinely usable map space. Full containment takes priority over small-label readability for large branches. If the current system zoom floor prevents containment, accommodate the required valid lower scale and coordinate it with controls and remembered viewport restoration instead of silently clipping the branch.
- Avoid excessive enlargement of an isolated small target: retain useful context rather than automatically using maximum zoom. Concrete margins, an isolated-target zoom cap and exact UI spacing remain reversible design choices, to be assessed through rendered evidence.
- Run the target reveal after the destination is mounted, ordinary remembered-camera restoration is complete and the post-search panel layout is ready. Recheck operation ownership after waits. Successful search framing intentionally overrides the remembered destination view for that activation; later ordinary visits retain existing visit semantics.
- Close search after successful activation, focus the map and do not automatically open Inspect. Retain desktop panels when the available map area can show the result. Hide the compact fullscreen panel so the map is visible, preserving any retained controller-owned work. Inspect remains reachable afterward.
- Camera framing must account for visible controls and overlays and remain correct as the software keyboard and compact layout settle. Existing minimal history reveal preserves zoom and is not an unchanged replacement for this branch-aware fit.

### UI and state ownership

- Keep the search entry visible and named in both map contexts. The exact header, panel, popover or dialog composition is not prescribed. Use the established component conventions and choose a surface that satisfies the behavior and focus contract.
- Opening, typing, hovering and keyboard result traversal remain consultation; none changes the map, tool, selection or draft. Activation must be deliberate, by supported keyboard or pointer/touch action.
- Retain query state for the editor identity/session across closing, reopening and responsive reflow; reset it on workspace/cluster identity change or editor exit. Do not persist search history or add a map-navigation stack.
- Support keyboard access, result traversal, Enter activation, touch activation, native input editing and composition. Scope search-owned keys to search; preserve native editing shortcuts and the editor's other shortcut owners.
- Escape closes search first and, for simple dismissal, returns focus to its opener without also canceling another tool/draft or panning the map. Existing guard dialogs own focus while open. Successful reveal focuses the map; refused navigation must leave usable search or validation focus as appropriate.
- Keep committed data and ordered persistence with the existing sole writer, shared transient editor state within its existing lifetime, and mounted geometry/focus/browser effects with their lifecycle owners. Search calculations accept data and return results; they do not depend on persistence or browser APIs.
- Preserve application/request isolation and hydration safety. No schema, import/export format or domain-terminology change is required by this feature.

## Testing Decisions

### Confirmed test seams

The user explicitly approved these seams on 2026-10-29 during specification preparation:

1. **Primary integration seam: editor result-activation command.** Exercise real composed draft guards, destination resolution and selection through the focused operation. Assert accepted/rejected observable outcomes, not private method calls or component wiring. Prefer existing editor workflow composition to introducing several new test-only entry points.
2. **Public browser journeys.** Verify the rendered result, actual framing, focus, overlays, query lifetime and desktop/compact behavior through visible controls. A command-level selection assertion alone cannot establish that the Warden can see the result.
3. **Targeted pure calculation tests.** Cover matching/ranking/identity handling and descendant/framing calculations where deterministic inputs give precise expectations. These support the principal operation rather than replace its integration coverage.

Good tests describe user-visible behavior and ownership guarantees. Avoid tests that merely reproduce implementation loops, inspect private state unnecessarily or mock away the guards being verified. Keep the existing maintained test runner and public setup helpers; no additional runner is required.

### Required coverage

| Area | Observable evidence |
| --- | --- |
| Matching | Names and keys across inactive systems; case/accent normalization; surrounding whitespace; literal punctuation; exact/prefix/substring order; empty/no-match states; one entity matching two fields yields one result. |
| Identity | Same names within/across systems; same key across systems; case-distinct valid keys; duplicated imported systems/objects; deterministic contextual labels and occurrence numbers; activation reaches the intended ID. |
| Applied data | Results update after rename/import/delete/Undo/Redo; pending durable saves do not hide applied values; unapplied drafts/previews do not become searchable; deleted stale rows cannot navigate. |
| Guarded activation | Current-system and cross-system objects, system node, cluster overview, same-target draft reuse, Apply/Discard/Stay, invalid Apply, hidden object/Orbit/route/chart sessions and context changes during a pending confirmation. Assert no partial navigation or stale deferred camera update. |
| Geometry | Leaf and recursive branches, multiple hosted Orbits, rotated ellipses, descendants on both sides of the target, parent/sibling exclusion, labels, tiny targets, large branches beyond the former zoom floor and expanded coordinates. Assert screen-space containment with useful margins, not only a transform value. |
| Visits and modes | Search reveal follows destination restoration, repeated activation reframes, ordinary Back/revisit restores its own state, tools/continuous adjustments/previews retain established completion or cancellation semantics, and consultation adds no history action. |
| Panels and focus | Desktop with existing overlays; compact width and short landscape height; success shows the map without opening Inspect; retained drafts survive hidden panels/reflow; Stay preserves query and usable focus; nested guard dialogs own focus. |
| Keyboard and touch | Visible non-shortcut access; keyboard traversal/Enter; Escape dismissal and opener return; no map-arrow, tool-cancel or editing-shortcut leakage; composition does not activate; touch scrolling and activation; query reuse and identity reset. |
| Mobile keyboard | Real software-keyboard entry followed by result selection and a visible correctly framed map after layout changes; supplement browser emulation with actual device/input evidence. |
| Scale | A representative larger workspace confirms that all matches remain reachable and input/list behavior is usable. Existing tiny fixtures establish no numerical latency or capacity promise. |

Prior art includes existing editor transition and entity-session checks, public navigation journeys restoring per-map cameras and distinguishing active versus inspected systems, chart-draft preservation scenarios, compact-panel and nested-dialog focus journeys, and pure map-fit and target-reveal geometry cases. Extend those patterns rather than creating a separate editor or bypassing public import/creation setup.

For implementation completion, run lint, type checking and affected behavior checks, including cancellation/failure paths; include maintained UI smoke and readable desktop/compact visual inspection of the selected branch. Follow repository integrated verification for dependency, SSR or bundling changes. Reuse successful evidence for unchanged code and keep the eventual candidate revision and results in one concise check record. Browser viewport emulation does not certify a physical keyboard, operating-system software keyboard or screen reader.

## Out of Scope

- Multiple saved-workspace or multi-cluster libraries, other browser profiles/origins, cloud search and recovery-snapshot search.
- Description/full-text search, custom-field names or values, route names, Orbit results, catalogue browsing and translation-key search.
- Typo correction, fuzzy matching, similarity scoring and an external search service.
- Searching or persisting unapplied draft values and geometry previews.
- Automatically opening a system map for a system-name result, fitting an object's parent/siblings, or following routes/Station references as descendants.
- Automatic data renaming, identity merging, raw-ID disambiguation or durable occurrence numbers.
- Automatic Inspect opening, a prescribed header/sidebar/dialog layout, a mandatory global shortcut, durable query history or a new navigation stack.
- Replacing existing draft controllers, persistence/history ownership, map renderers or the editor architecture.
- Product implementation, implementation-ticket creation, commits, pushes, PRs, GitHub label/comment/state changes or source-issue closure as part of this specification-writing task.

## Further Notes

### Source issue

The source is [Global search with auto-fit, GitHub #7](https://github.com/Submoon/ttrpg-cluster-control/issues/7), fetched with body, comments, labels and state on 2026-10-29 when preparing this specification. It remains OPEN, with `enhancement` and `priority:P1`, and has no comments. The refreshed source is unchanged from framing.

The original request requires accessible visible search across cluster/system/object names, auto-fit/zoom on selection and mobile keyboard operation; fuzzy matching is optional in that source. The user-approved [Global search with auto-fit: behavior framing](framing.md) supplies the explicit Location-key inclusion, exclusion of fuzzy matching, destination semantics, complete-branch framing, disambiguation, draft guarantees and focus/session contract. Its eleven product answers and the separately approved test seams are the authority for this specification; no user answer has been inferred.

The related [Revamp the interface, GitHub #3](https://github.com/Submoon/ttrpg-cluster-control/issues/3) is closed and provides existing responsive/accessibility foundations. This does not mean search is implemented. No dependency on another issue or another chat is established.

The numbered User Stories define the acceptance behavior; Implementation Decisions and Testing Decisions state its constraints and required evidence. GitHub remains authoritative for the incoming request and global completion, while this local specification is authoritative for the agreed effort contract. Repository tracker configuration publishes specifications locally; the `ready-for-agent` label above is local metadata, not a remote issue change.

### Actual baseline

After fetching `origin` on 2026-10-29, this isolated worktree's detached `HEAD`, local `main` and `origin/main` are all **8d4b66504ca6723db5405ed7cb93d0a666264c9a**. Both comparisons with `origin/main` are 0 ahead / 0 behind, matching the framing baseline. No alternative base is intended and no fast-forward is necessary. Pre-existing environment files and the closed framing artifact are preserved.

### Readiness and remaining design work

Product behavior and the proposed test seams are confirmed. The specification is open and `ready-for-agent`, with an approved local ticket set; that state alone is not authorization to start implementation. Separately authorized tickets 01 and 02 have delivered the visible entry, matching/identity contract, guarded reveal and active-system branch framing. Their implementation records capture the chosen layout, 200% isolated-target cap, lower zoom support and verification limits. No prototype or new domain ADR is currently required to settle a product question.

The remaining implementation risk is extending the complete guarded reveal across systems, including inactive maps, while retaining the delivered branch bounds, valid lower zoom and camera/focus ownership after restoration and panel/keyboard changes. Keep these responsibilities connected in ticket 03. Recheck the source issue and baseline before implementation and report divergence rather than overwriting confirmed decisions.

### Approved implementation tickets

On 2026-10-29, the user approved the three vertical slices and the dependency graph below. The [Global search: approved vertical implementation slices](ticket-proposal.md) preserves the reviewed breakdown. Each ticket includes its own acceptance criteria, source/baseline, shared constraints and confirmed test seams.

| Ticket | Predecessor | Increment |
| --- | --- | --- |
| [Find and reveal the cluster and its systems](tickets/01-cluster-system-search.md) | None | Accessible cluster/system search and complete guarded cluster reveal. |
| [Find an object and frame its branch in the active system](tickets/02-active-system-object-branches.md) | [Find and reveal the cluster and its systems](tickets/01-cluster-system-search.md) (closed) | Active-system object names/keys and complete hosted-branch framing. |
| [Find and reveal objects across every system](tickets/03-global-object-reveal.md) | [Find an object and frame its branch in the active system](tickets/02-active-system-object-branches.md) (closed) | All-workspace object discovery and guarded cross-map reveal. |

Tickets 01 and 02 are closed following their separately authorized implementations. On 2026-10-30 the user required **one feature branch**: all predecessor commits were preserved and pushed on **codex/global-search**, and ticket 03 is claimed there. Historical ticket-specific branch names in earlier records are past provenance. See [Cluster and system search: implementation and verification](implementation-01.md), [Active-system object search: implementation and verification](implementation-02.md) and [Global object search: implementation and verification](implementation-03.md) for actual baselines, behavior, checks and limits. Ready-for-agent metadata is distinct from implementation authorization. Full global-object acceptance still requires ticket 03, including its actual software-keyboard evidence.

The source issue and baseline were refreshed before publication as recorded above. Later authorizations covered all three implementation slices, pushing completed ticket 02, and one canonical feature branch. They do not authorize a PR, merge to main or remote issue update. GitHub #7 was re-read unchanged before ticket 03 implementation and remains OPEN.

### Specification verification

The initial specification deliverable was documentation only. Subsequent ticket 01/02 runtime, automated checks, screenshots and limitations are recorded in their linked implementation records. Ticket 02's full suite was 483/487 on its first complete invocation; three failures passed on unchanged targeted reruns and the remaining Orbit timeout also reproduced on the predecessor. No fully green suite or physical software-keyboard/screen-reader certification is claimed. Global cross-system object checks remain future completion requirements; the parent specification stays open.
