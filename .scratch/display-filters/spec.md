---
title: Display filters for the Warden and player consultation
status: closed
triage_labels:
  - enhancement
  - ready-for-agent
---

# Display filters for the Warden and player consultation

## Source issue

[Display filters and label management](https://github.com/Submoon/ttrpg-cluster-control/issues/8) was refreshed on 2026-11-09. It is open, carries `enhancement` and `priority:P1`, and has no comments. Its acceptance criteria cover an accessible filter panel, visibility controls, criteria that combine with AND, and filter state saved with the workspace. Its examples include the Jump Cluster, star systems, object types, status and custom labels. The [closed Wayfinder map](map.md) records the agreed local interpretation and extensions.

| Source request | Agreed local scope |
| --- | --- |
| Filter panel and active-filter feedback | Accessible controls on star-system maps and an active-criterion count. |
| Toggle visibility across map scales | Strongly dim objects outside the criteria on star-system maps. Their marks and interactions remain available. Jump Cluster navigation retains its current scope. |
| Status and custom labels | Filter the configured Player publication and existing Field values. A Field can represent campaign state or a custom classification. |
| Combine filters with AND | Combine active facets and Field conditions with AND. Use OR for included alternatives within a facet or single-select condition. |
| Save filters with the workspace | Keep active criteria in memory for the current session. This is an explicit departure from the source acceptance criterion. |
| Local extensions | Add criteria to Warden Search, including search with blank text, and add filters to the standalone player reader and Warden preview. |

The source acceptance review must account for the local choices on session lifetime, dimming, map scope and Field-based classifications before the GitHub issue can be reported complete.

## Problem Statement

Wardens working on crowded star-system maps need to pick out objects by type, publication or campaign information while preserving orbital context and access to the objects that fade into the background. They also need to find matching objects across the workspace when they know a Field value or type but lack a name or Location key. On compact screens, controls must leave a reliable way back to the map and explain why the whole scene appears dim.

Players need the same ability to focus on relevant locations within a published system. Their available choices and results must be explainable from the document they received, including Unknown presences and partially published Fields. Each player's consultation and the Warden's preview need their own view settings.

## Solution

Give the Warden a **Filters** panel beside Search on star-system maps. One active set spans all systems in the current editor session. Objects that match remain at normal opacity. Other objects and their selection treatment dim strongly, while their positions, Orbit rings, Hierarchy entries and interactions remain available. The panel applies valid edits immediately, reports active criteria and offers individual removal and **Clear all**.

Add a separate set of criteria to Warden Search. Text alone follows the current global search contract. Criteria alone find objects across all systems, and using both returns the intersection. Activating an object result still frames its complete hosted branch. If the map filters dim the target, a temporary locator makes it easy to find until the first deliberate map interaction.

Offer object filtering in the shared player consultation view. The player controls the reader and the Warden controls the preview. Each view derives its options from the current published document, including published object types, a generic **Type not revealed** option when applicable and published Field assignments. Player Search retains its existing public text results. Its activation reveals the target at the current destination zoom. Fit and image exports cover the complete map for their audience.

## User Stories

### Warden criteria and controls

1. As a Warden, I want a Filters button beside Search on the star-system map, so that I can find it alongside the other map commands.
2. As a Warden using a compact screen, I want a scrollable panel with a visible close command, so that I can edit criteria and return to the map.
3. As a keyboard user, I want to open, operate and dismiss Filters and recover focus, so that I can use the map without a pointer.
4. As a Warden, I want the button to count active criteria, so that I can tell when the current view is filtered while the panel is closed.
5. As a Warden, I want one choice per catalogue subtype and per user-named Other subtype, so that I can distinguish a Planet from a Moon or a custom Relay.
6. As a Warden, I want to include several types or publication modes in the same facet, so that I can consult alternatives together.
7. As a Warden, I want to filter by an object's configured Player publication, so that I can find objects with the setting I intend to review even when a parent system limits effective disclosure.
8. As a Warden, I want native and custom Fields available when I add a criterion, so that I can filter on campaign state and classifications I already record.
9. As a Warden, I want text, numeric, boolean and choice conditions suited to each Field, so that I can express criteria such as a keyword in a text Field, a Danger interval or an exploration state.
10. As a Warden, I want a **No value** condition that covers missing or inapplicable Fields, so that I can find objects without a usable assignment.
11. As a Warden, I want Type, Player publication and Field conditions to combine, so that I can find only Revealed or Known type planets and moons with Danger at least 3.
12. As a Warden, I want valid edits to take effect immediately and an incomplete replacement to leave the previous condition active, so that the map remains useful while I enter a value.
13. As a Warden, I want to remove a single condition or clear the whole set from the panel, so that I can broaden the current view quickly.
14. As a Warden, I want types grouped by catalogue family, so that I can find related types while scanning the filter panel.

### Warden map, lifetime and Search

15. As a Warden, I want dimmed objects and their Orbit rings to remain visible, so that I can follow the physical layout of the system.
16. As a Warden, I want dimmed objects to retain selection, Inspect, Move and placement behavior, so that I can deliberately interact with a faded location.
17. As a Warden, I want the full Hierarchy to indicate which objects are dimmed, so that I can reach them by keyboard or touch and inspect their details.
18. As a Warden, I want Fit to include all objects and Orbit rings, so that I can recover the complete system view even when every object is dimmed.
19. As a Warden, I want SVG and PNG images to show the complete map at normal opacity, so that I can export a readable map while using filters on screen.
20. As a Warden, I want the same criteria after visiting another star system or returning from the Jump Cluster map, so that I can review several systems consistently.
21. As a Warden, I want a fresh session or recovered workspace to start without filters, so that I can see the whole map at normal opacity when I reopen it.
22. As a Warden, I want Undo and Redo to affect map edits and keep my valid view settings, so that changing my focus leaves the map's edit history usable.
23. As a Warden, I want obsolete Field references or choices removed with feedback, so that the remaining active criteria continue to express valid conditions.
24. As a Warden, I want a map-copy import to retain the destination's active view settings, so that I can inspect the imported objects with my current criteria.
25. As a Warden, I want Search to keep its own criteria, so that I can find planets while my map emphasizes stars.
26. As a Warden, I want text-only Search to find the same cluster, system and object results at the same ranks, so that existing lookups still work with map filters active.
27. As a Warden, I want Search to accept criteria with blank text, so that I can find all matching objects across systems when I know no names or Location keys.
28. As a Warden, I want text and Search criteria to narrow results together, so that I can distinguish an object named Relais from a planet matching Relais.
29. As a Warden, I want to clear text and criteria independently and see guidance when both are empty, so that I can switch between search modes without rebuilding the other input.
30. As a Warden, I want to reopen Search with my text and criteria during the session, so that I can visit several results in sequence.
31. As a Warden, I want activating a result to honor draft guards and frame its complete hosted branch, so that I can see the relationship context without losing unfinished work.
32. As a Warden, I want a locator when Search lands on a dimmed target, so that I can spot it after the map settles without changing my filters.

### Player reader and preview

33. As a player, I want to choose my own filters in the reader, so that I can focus on the objects relevant to my current consultation.
34. As a Warden, I want the same public filter controls in preview, so that I can try the player experience independently of the reader and my editor view.
35. As a player, I want filters to follow me between systems in the current document, so that I can compare systems consistently.
36. As a player, I want a fresh or reopened consultation to start without filters, so that a new document opens in its complete public view.
37. As a player, I want to filter by types the document discloses, including a generic **Type not revealed** choice, so that I can find both classified objects and Unknown presences.
38. As a player, I want Field criteria based on the values published in the document, so that I can narrow the map using information available to me in Inspect.
39. As a player, I want one condition for public Fields that share the same name and kind, so that I can find an object when any of its published values matches that condition.
40. As a player, I want the choices and counts to describe only published data, so that every result reflects information I can actually consult.
41. As a player, I want dimmed objects and their published Orbit relationships to remain visible and selectable, so that I can follow placement context and inspect a dimmed object.
42. As a player, I want Search to keep finding dimmed objects and reveal a selected result at the current destination zoom, so that I can locate it without changing my view settings.
43. As a player on a compact screen, I want the locator to appear once the map is visible, so that I can find a dimmed result after closing Inspect.
44. As a player, I want Fit and exported images to cover the entire published map, so that I can recover or share the complete system view.

## Implementation Decisions

### Matching contract

- Represent an active filter set as included Type values, included publication modes where available, and at most one active condition per Field. Empty facets contribute no restriction. Evaluate alternatives within each facet with OR and evaluate the active facets and Field conditions with AND. Unrestricted sets leave every applicable map object at normal opacity.
- Preserve the existing family and subtype identity, including case-sensitive stored Other subtypes. A native Planet and an Other subtype displayed as Planet are distinct options. Use the configured object publication mode for the Warden, including Hidden, Unknown presence, Known type and Revealed. Effective disclosure follows the existing publication policy.
- Reuse the existing Field definitions, applicability and assignments. A Field's displayed name may change while its stable identity continues to identify the same Warden criterion. Keep criteria meaningful across systems even when the active system has no objects of a selected type or Field value.

| Field kind | Value conditions |
| --- | --- |
| Text | Contains, equals and does not contain. Comparisons ignore case and accents. |
| Number | `=`, `≠`, `<`, `≤`, `>` and `≥`, plus between with both endpoints included. |
| Boolean | Is Yes or is No. |
| Single-select | Is any one of the selected configured choices. An object stores one choice for that Field. |

- Every Warden Field offers **No value**, which matches a missing assignment or an inapplicable Field even when a former assignment remains stored. Empty and whitespace-only stored text count as missing. Zero and false count as assigned values. All value comparisons, including inequalities and text exclusions, require an applicable Field with an assigned value.
- Evaluate matching separately from rendering and navigation. Use one deterministic evaluation contract where the Warden map and Search share criteria. Public consultation supplies its own published inputs and Field identity rules at the existing publication boundary.

### Warden map presentation and session state

- Put **Filters** beside Search in the upper star-system toolbar. Open an anchored panel on desktop and a scrollable compact panel with a visible close action. Follow existing keyboard and touch focus ownership. Explicit close or Escape returns focus to the opener when available.
- Count one active criterion each for Type and Player publication when selected, plus one per active Field. Selecting Planet and Moon and adding `Danger ≥ 3` shows **Filters (2)**. Communicate the count through the accessible button name. Show the active set in the panel, including criteria with zero matches in the current system.
- Apply valid adds and edits immediately, while an incomplete replacement keeps the previous valid condition active. Group Type options by catalogue family. Uncheck Type and Publication selections directly. Offer Field removal per condition and immediate **Clear all** in the panel. The criteria scroll between the header and reset action. A populated system with zero matches shows every object dimmed. A genuinely empty system retains its ordinary empty-map state.
- Keep all catalogue objects rendered. Apply strong dimming to the mark and its selection treatment when outside the active criteria. All Orbit rings retain normal opacity. Preserve the full Hierarchy and mark dimmed entries accessibly in both themes. Keep Inspect, pointer, keyboard and touch selection, Move, Add, hit testing, occupied-space checks and placement eligibility under the existing interaction rules. Fit includes all objects and Orbits.
- Use the editor session's transient state for map filters. Share one set across star systems, including round trips through the Jump Cluster. Start with an empty set on fresh editor entry, reload, workspace replacement or recovery. Keep valid criteria when an ordinary workspace update or copy import changes the current workspace data without replacing its identity. Browser storage, recovery snapshots, map JSON and history continue to carry map data under their existing contracts.
- Filter changes and reset create zero history entries. Undo and Redo keep current criteria that remain valid for the resulting map. Revalidate active criteria after Field definition and choice changes, including history traversal. Remove invalid references and report the removal. Retain valid choices and unrelated criteria. Remove an **Is** condition that loses its final choice. A valid condition with zero object matches remains active.
- Warden SVG and PNG export the complete committed system geometry at normal opacity while the editor retains its on-screen filters. Normalize filter dimming at the existing export boundary so rendered-view styling cannot carry into the downloaded scene. The Jump Cluster map keeps its existing scope and commands.

### Warden Search and reveal

| Text | Search criteria | Result scope and order |
| --- | --- | --- |
| Present | Empty | Existing cluster and system name matches and object name or Location key matches, in their current text ranking. |
| Empty or blank | Active | Matching catalogue objects across all systems. Order by system name and then object name, keeping each system together and resolving duplicate names deterministically. |
| Present | Active | Catalogue objects matching both text and criteria, in their current text ranking among those matches. |
| Empty or blank | Empty | Empty result list with guidance to enter text or add a criterion. |

- Give Search its own transient Type, Player publication and Field criteria. Map dimming leaves text matches, ranking and row presentation intact. Preserve existing result identity and disambiguation. Clearing one input retains the other. Announce a match count or appropriate no-match state for active searches. Text and criteria survive closing, reopening and activating results within the same editor session and reset with that session or workspace replacement.
- Reuse guarded navigation and existing Apply, Discard and Stay behavior. On accepted object activation, frame the target with its recursively hosted Orbits and occupants, including dimmed descendants. Use measurable object bounds and retain the existing exclusions for parent and sibling branches. Keep the existing settle-and-focus behavior after compact Search or keyboard dismissal.
- After successful framing, show a separate locator on a dimmed target only. Determine dimming from the map criteria at the accepted destination. The locator leaves object and selection opacity intact. Clear it on the first deliberate map interaction or when it loses the destination, selection or dimmed target. Focus transfer during activation preserves the locator. A repeat activation can produce a new locator. A rejected, stale or superseded activation produces zero new locators.

### Player consultation boundary and navigation

- Own filters in each instance of the shared public document view. The reader and preview each start unfiltered and keep their own choices during navigation within that document. Reload, preview reopening and replacement of the document start fresh consultations. Published JSON and links open a fresh view. Keep filtering within the published star-system maps.
- Derive all type options, Field criteria, matches and active counts from the allowlisted public document. Group known types by their published family. Known type and Revealed objects expose published family and subtype. Offer **Type not revealed** when the document has Unknown presences, including neutral public Orbit-host placeholders. Use the public marker category for that match.
- Group Field assignments by published name and kind. One matching published assignment satisfies a condition when an object has several values in that group. Distinguish same-named groups of different kinds. Use the value operators for published kinds and the observed public assignments as the choice inventory. A value condition requires a matching public value. Omit **No value** from public criteria. Use OR for alternatives and AND across the active Type and Field conditions.
- The player projection, codec and renderer contract remain based on publication. The public filter feature consumes the existing document shapes. Keep private classification, unpublished Field options and applicability, source definition identities, Warden selection and filter state outside the public input. Reuse published host and occupant relationships, including neutral placeholders, as already supplied by the public document.
- Apply dimming to published nonmatches and their selection treatment. Keep published objects and Orbit rings available to pointer, touch and keyboard selection. Orbit rings retain their normal opacity. Keep the full public Hierarchy, its accessible dimming indicator, and the existing public details in Inspect.
- Preserve public text Search membership and ranking under map filters. Object activation uses the existing Inspect path and pans to reveal the target anchor at the destination's current zoom. Fit continues to use the full public scene. After a successful Search reveal, mark a dimmed target with a locator. On compact screens wait for the map to become visible. Clear the locator on the first deliberate map interaction. Fence deferred reveal and locators by the existing document, destination and selection ownership.
- Reader and preview SVG and PNG export the complete active published map with normal opacity. Use the existing public scene exporter. The document and shared link carry the publication projection with their existing allowlist and lifecycle.

## Testing Decisions

Use the [repository verification guidance](../../docs/agents/testing.md) and the highest existing behavioral boundary that observes each outcome without duplicating deterministic combinations in browser journeys. The proposed seams are pure matching and search functions, existing editor and public-view workflow boundaries, and real browser actions for layout, focus, rendering and downloads.

| Boundary | Acceptance scenarios and evidence |
| --- | --- |
| Matching and search models | Exercise a representative Type and publication OR set combined with numeric and choice Field conditions. Cover exact native/Other type identity, case and accent handling for text, inclusive numeric bounds, negative comparisons with missing assignments, `0` and `false`, and out-of-scope Fields with former values. Check the four Search input states, text ranking, deterministic filter-only order and stable identity for repeated names and Location keys. |
| Existing Warden workflow and editor state | Exercise independent map and Search criteria, retaining them on system changes and resetting on fresh session or recovery. Check Undo and Redo with a valid active criterion, choice removal with feedback and preservation of unrelated criteria. Use the guarded Search command to verify Stay, failed validation, repeated activation and a superseded request. Assert selection, camera and locator outcomes without pinning private state shape. |
| Published document and public-view boundaries | Use a Known type object, an Unknown public host and a Revealed object with both public and masked source assignments. Verify public options and counts from the document alone, **Type not revealed**, same-name and same-kind Field matching, kind disambiguation and exclusion of private values. Verify independent consultation settings and cancellation of a deferred reveal when the document or selection changes. |
| Warden browser workflow | Use a real Filters panel to apply, edit and clear criteria. Observe the count, dimming, unchanged Orbit and object interaction, complete Hierarchy and zero-match recovery. Reuse a distinct compact Search journey to verify focus return and a dimmed result located after framing. Keep deterministic criterion permutations at the model boundary. |
| Shared player browser workflow and artifacts | Use the existing player-view fixtures to apply public filters, navigate to a dimmed result, recover Fit and verify preview and reader isolation. Cover compact reveal after Inspect closes at the real browser boundary where needed. Capture representative SVG and PNG artifacts for each audience. Check the Warden export against the complete editor map. Inspect public SVG and the decoded published artifact for complete permitted content and absence of private sentinels. Use focused visual review for dimming, visible focus and ring contrast in both themes. |

Reuse the existing [Warden search model coverage](../../tests/workspace-search-model.spec.ts), [guarded Search command coverage](../../tests/workspace-search-command.spec.ts), [global Search browser journey](../../tests/workspace-global-search.spec.ts), [Hierarchy navigation coverage](../../tests/workspace-hierarchy-tree.spec.ts), [workspace recovery coverage](../../tests/workspace-recovery.spec.ts) and [history coordinator coverage](../../tests/workspace-history-coordinator.spec.ts) as precedents. Player precedents include [public content projection](../../tests/player-content-projection.spec.ts), [public search](../../tests/player-search-model.spec.ts), [player reader](../../tests/player-reader.spec.ts), [player Fit geometry](../../tests/player-map-fit.spec.ts), [Warden image exports](../../tests/workspace-image-exports.spec.ts) and [player image geometry](../../tests/player-image-geometry.spec.ts).

Use isolated fixtures and existing public controls. Check outcomes such as accessible focus, measured map containment, usable hit targets and actual downloaded content. Keep browser additions within the repository budget and extend a maintained journey where it already owns the behavior. Use the supported qualification workflow for the eventual runtime change.

## Out of Scope

- Direct filtering of Jump Cluster system and route marks, and a separate filter facet for Orbit rings.
- A dedicated tag model or campaign-status field. Existing Fields cover campaign state and custom classifications.
- Durable filter settings, saved presets, and transporting consultation filters with a map or player document.
- Publication-policy changes, additional disclosure metadata and access-control changes.
- A text-versus-criteria union in Warden Search, criteria-based player Search and filtered image export actions.

## Implementation tickets

The maintainer approved these seven slices and their direct dependencies on 2026-11-06. They follow the existing decision tickets in the local numbering. The source issue was refreshed at publication and retains the scope differences recorded above.

| Ticket | Blocked by |
| --- | --- |
| [Filter Warden system maps by type](tickets/13-warden-type-filters.md) | None |
| [Filter Warden maps by publication and Field values](tickets/14-warden-publication-and-field-filters.md) | [Filter Warden system maps by type](tickets/13-warden-type-filters.md) |
| [Locate dimmed Warden Search results](tickets/15-warden-search-dimmed-locator.md) | [Filter Warden system maps by type](tickets/13-warden-type-filters.md) |
| [Search Warden maps by text and criteria](tickets/16-warden-search-text-and-criteria.md) | [Filter Warden maps by publication and Field values](tickets/14-warden-publication-and-field-filters.md) |
| [Filter player maps by published type](tickets/17-player-published-type-filters.md) | None |
| [Filter player maps by published Field values](tickets/18-player-published-field-filters.md) | [Filter Warden maps by publication and Field values](tickets/14-warden-publication-and-field-filters.md), [Filter player maps by published type](tickets/17-player-published-type-filters.md) |
| [Locate dimmed results in player consultation](tickets/19-player-search-dimmed-locator.md) | [Filter player maps by published type](tickets/17-player-published-type-filters.md) |

The initial frontier contains Warden type filters and player published-type filters. Player Field filters depend on the Warden Field slice for reusable typed comparisons. Each Search locator depends on the corresponding map dimming slice. The Warden criteria-search slice uses the existing Search activation contract and can proceed independently of the locator.

## Further Notes

- **Baseline.** After `git fetch origin` on 2026-11-06, local `main` and `origin/main` were both `7e4f6049dae7ab23b952316ab238410c2a714f0f`. This specification was drafted and checked in the isolated worktree at `19e4532ca2de3c0906214faa64ab62a6874269b0`. The two intervening commits only adjust player Orbit ring contrast. The implementation baseline should be checked again at intake.
- **Architecture references.** Use the [domain context](../../CONTEXT.md), [editor architecture](../../docs/architecture/editor.md), [UI guidance](../../docs/agents/ui.md), [player publication ADR](../../docs/adr/0002-player-publication-boundary.md) and [existing Search specification](../global-search/spec.md). The [Wayfinder map](map.md) links the original decisions.
- **Handoff.** Refresh the source issue and baseline before implementation. Use the project development workflow and the approved dependency order above.
- **Type-filter implementation baseline.** Work on the two initial slices started on 2026-11-09 from `7e4f6049dae7ab23b952316ab238410c2a714f0f`, equal to local `main` and the freshly fetched `origin/main`. The source issue was refreshed at intake.
- **Publication, Field and Search locator baseline.** This batch uses `f66a18fbd02e8fb45e31bb626580526a4b7a053a` on `codex/display-type-filters`. It includes both prerequisite type-filter slices and is one commit ahead of the fetched `origin/main` at `7e4f6049dae7ab23b952316ab238410c2a714f0f`. The source issue was refreshed at intake.
- **Search and public Field implementation baseline.** This batch uses `23e20c162a07bfb06d6b9cdd69bc26f983a88ab4` on `codex/display-type-filters`. It includes both prerequisite batches and is two commits ahead of the fetched `origin/main` at `7e4f6049dae7ab23b952316ab238410c2a714f0f`. The source issue was refreshed at intake.
- **Filter panel follow-up.** The layout and performance corrections start from `60c91422739fff7d49d5867e044b21fa1ec03120`. The integration base is `origin/main` at `a3d9f54878e6a103945bf0ab37db6bb7c6cc9229`, which includes multiple selection. The merged map preserves dimming and group selection on the same objects.

## Resolution

All seven local implementation tickets are complete. The final two slices add independent criteria to Warden Search and published Field filters to player consultation. The GitHub source remains open and still lists saved filter settings among its acceptance criteria. The local specification uses session-only settings as agreed.

The final runtime candidate `4f76698f` passed TypeScript, lint, the production build, 332 pure tests and the development storage test. The complete browser run passed 89 of 99 scenarios on its first run. The remaining ten passed sequentially against the same build, using the repository timeouts.
