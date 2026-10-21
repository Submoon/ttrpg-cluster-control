---
title: "Revamp the interface: responsive map editing with preserved local work"
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

## Problem Statement

The Warden needs to navigate, build and maintain Jump Clusters and star systems on desktop and phone without fighting overlapping controls, ambiguous gestures or forms that consume the usable screen. The current saved-workspace editor supports substantial mapping, field management, interchange and recovery workflows; a visual redesign that loses any of them would fail the request. The interface also needs coherent light/dark presentation, readable states and exports, and trustworthy distinctions between a draft, an applied edit and data saved on this device.

The accepted disposable B prototype establishes the presentation direction. It does not implement the complete saved-workspace product. Its missing controls, simulated persistence, historical theme/icon failures and reported phone reachability defects inform integration requirements, rather than accepted feature cuts. The human subsequently limits supported Android mobile use to **Chrome**; Android/Firefox observations remain historical usability evidence, not a Firefox acceptance obligation or proof of Chrome behavior.

## Solution

Refactor the real local-workspace editor around the accepted B/Dock direction, using Nuxt UI components to the greatest practical extent. Keep separate Jump Cluster and star system maps, explicit context/Back, safe Navigate, deliberate Select and Move, persistent same-type Add, an anchored creation chooser and optional nested Hierarchy. Give the unobstructed map priority while navigation and placement are active. On compact screens, Inspect and Hierarchy each occupy the available fullscreen surface, exclusively, and hide the dock and zoom controls until closed.

Provide readable, resumable editing: visible Inspector sections, full-width long text, persistent bottom ordinary actions and feedback, and Fields list → consultation detail → explicit Edit. Preserve every baseline command, validation rule, data format and local recovery path. Share one light/dark preference and palette across shell, maps and portal content, with clean full-scene SVG/PNG and an independent Light for printing option.

This is the complete product specification for the UI refactor, rather than a specification for the prototype renderer. The behavior below is normative unless explicitly described as historical evidence, an unverified gate or a proposed test strategy.

## Source issue

[Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3), refreshed read-only by the coordinator on **2026-10-16**: open, `enhancement`, `priority:P1`, no comments, requirements unchanged.

The source requires a researched, considered modern design; responsive UI; touch-usable UI and map on mobile; most of the screen devoted to the map, especially on mobile; and preservation of existing functionality. It requires an explicit light/dark control with local preference surviving reload, a coherent UI/map palette covering panels, dialogs, grid, objects, routes, Orbits, labels and interaction states, readable hover/focus/selection/error states beyond color, reuse of CSS variables, and legible SVG/PNG. Theme changes must retain drafts, selection and placements. Tools, compact icons, Nuxt UI, shell reorganization, initial OS preference, multiple design studies and printing are resolved through the local decisions below.

Human-confirmed scope is **UI redesign, with related issues coordinated separately**. GitHub remains authoritative for the incoming request and its completion; this local specification and its linked decisions govern the effort. Writing this document neither changes GitHub nor closes issue 3. Local publication overrides the to-spec skill's generic remote-publication instruction.

## User Stories

### Workspace, navigation and composition

1. As a Warden, I want to create a local workspace with a Jump Cluster and its first star system, so that I can begin mapping without an account or remote workspace.
2. As a returning Warden, I want explicit loading, successful resumption and actionable load/recovery errors, so that I know whether my local map is safe to edit.
3. As a Warden, I want the existing product identity and local-data boundary retained, so that the redesign does not unexpectedly open a different archive or change interchange compatibility.
4. As a Warden, I want separate Jump Cluster and star system maps with their names visible, so that I always know the scope of my work.
5. As a Warden using Navigate, I want a deliberate short click/tap or keyboard activation on a system to open its map directly, so that exploration stays quick.
6. As a Warden, I want explicit touch- and keyboard-accessible Back to Jump Cluster, so that returning never depends on hover, a context menu or browser history.
7. As a Warden revisiting a map, I want its own temporary pan/zoom and last still-valid selection restored, so that moving between maps retains my place.
8. As a Warden opening a map for the first time, I want a useful fitted view, so that I can find its contents immediately.
9. As a Warden, I want stale selections and remembered IDs cleared after deletion, so that the interface never resumes a deleted target.
10. As a Warden, I want a readable bottom Dock distinguishing Navigate, Select, Move and creation from panel/file commands, so that I can predict what the next map interaction will do.
11. As a Warden, I want optional Hierarchy reflecting hosted and nested Orbits, so that I can locate and target crowded or obscured entities without directly hitting their marks.
12. As a desktop Warden, I want Inspect and optional Hierarchy overlaid on the full map board, so that editing a draft does not replace the map with a narrow column or disable unrelated navigation.
13. As a phone Warden, I want fullscreen Inspect or Hierarchy with only one visible at a time and dock/zoom hidden, so that the selected task has usable space.
14. As a Warden changing screen size, I want panel exclusivity and retained session work across reflow, so that rotation or resizing does not lose an edit or reveal conflicting surfaces.
15. As a Warden, I want Map files beside the panel commands and reachable above desktop Inspect, so that import/export does not require hiding my work first.
16. As a Warden, I want compact context, Add feedback and Fields headers, so that short landscape screens retain useful map/form space.
17. As a Warden, I want Fit, targeting and recovery controls to work against the map area actually available around overlays, so that a full-size SVG does not conceal an unusable map.

### Tools, placement and gestures

18. As a Warden, I want Navigate to pan even when a drag begins over an entity, so that exploring cannot accidentally change geometry.
19. As a Warden, I want persistent Select to request Inspect on short entity activation while dragging still pans, so that choosing data editing is distinct from moving it.
20. As a Warden using Select, I want a system to expose its data rather than enter its map, so that inspection has consistent intent.
21. As a Warden, I want persistent Move to select and manipulate existing objects, systems and Orbits explicitly, so that direct geometry changes are deliberate.
22. As a Warden, I want numeric geometry editing in Inspect available while Select is active, so that Move is a gesture choice rather than permission to edit geometry.
23. As a Warden, I want opening/hiding Inspect or Hierarchy to preserve the active map mode, so that panel visibility does not silently change intent.
24. As a Warden, I want Add choices appropriate to the current map in a chooser anchored to its actual trigger, so that creation remains predictable across screen sizes.
25. As a Warden, I want persistent Add to retain the chosen type after success, so that I can place multiple items without repeatedly opening the catalogue.
26. As a Warden adding a system, I want to remain in the Jump Cluster with Add System active, so that repeated cluster construction does not force navigation.
27. As a Warden placing an entity, I want creation to leave Inspect on demand and preserve any existing draft, so that placement does not unexpectedly open or retarget an editor.
28. As a Warden, I want the active Add type, next target or route stage, and Quit Add visible, so that the next action is clear without generic pan-only guidance.
29. As a phone Warden, I want Add status to reuse the context banner while retaining current context and Back, so that creation does not add another permanent obstruction.
30. As a Warden, I want dismissing the chooser to retain Add, type and progress, so that browsing or closing choices does not cancel creation.
31. As a Warden, I want chooser dismissal consumed before map actions, so that Escape or an outside click cannot also quit Add or place an entity.
32. As a Warden, I want Quit Add or Escape on the map to abandon unfinished creation and return to Navigate, so that canceling leaves completed entities and Inspector drafts intact.
33. As a Warden, I want the full existing catalogue, including all 15 subtypes and an Other object's custom type text, so that compact icons do not reduce what I can map.
34. As a Warden, I want to place a catalogue object in empty space or at the chosen position on an Orbit, so that touch creation uses my intended destination rather than a fixed default angle.
35. As a Warden, I want Add Orbit to target an object host or an unoccupied center in empty space, so that both existing Orbit structures remain available.
36. As a Warden, I want indicated targets and explicit choice between overlapping valid candidates, so that crowded maps cannot silently select the wrong destination.
37. As a Warden, I want invalid targets explained with no mutation and the tool still active, so that I can correct placement without restarting.
38. As a Warden moving an attached object into empty space, I want to detach it at the dropped position, so that ordinary drag and drop can move it freely without an additional form or confirmation.
39. As a Warden, I want a drop onto a valid Orbit to attach or transfer the object at the indicated position, with precise Orbit/free-placement controls available as an alternative, so that both direct and numeric editing remain practical.
40. As a Warden, I want hosted/nested Orbits and dependents to follow their hosts during previews and after commit, so that the visible preview matches the validated result.
41. As a Warden, I want selected-Orbit controls for independent axes, rotation and unoccupied-center movement, plus ring-based uniform resizing, so that elliptical geometry remains fully editable.
42. As a Warden, I want explicit Detach before moving a hosted Orbit center independently and indicated valid hosts when attaching an unoccupied center, so that host relationships remain coherent.
43. As a Warden, I want the existing host-minimum adjustment for each radius and its independent notice retained, so that attachment cannot silently produce invalid geometry or hide a correction.
44. As a Warden, I want two-contact pan/zoom in every mode, including over entities, so that I can navigate without leaving my task.
45. As a desktop Warden, I want right-button hold/drag to pan in every mode, so that view movement does not edit, create, inspect or enter a system.
46. As a Warden, I want navigation takeover to cancel a live edit preview and suppress its later release/click, so that a canceled gesture cannot publish after panning.
47. As a Warden constructing a Jump Route, I want a chosen origin retained during view pan/zoom while no partial route is committed, so that I can find the destination safely.
48. As a Warden, I want a completed route to start a fresh route with no reused endpoints, so that repeated Add cannot accidentally connect stale targets.
49. As a Warden, I want normal valid release to commit once and interruption, tool changes or cancellation to drop only unfinished actions, so that canceled previews never enter saved data.
50. As a Warden, I want long-press inspection in Navigate/Move to cancel the pending gesture and suppress follow-up activation, so that the inspection alternative cannot also move or open its target.
51. As a Warden, I want keyboard and single-pointer alternatives to every placement/manipulation result, so that no operation requires drag, pinch, hover, right-click or a modifier.
52. As a Warden moving an existing entity, I want source/destination placement with an indicated preview and Confirm/Cancel, coordinates/Orbit position and named geometry controls, so that precision is possible without gestures. Creation uses the single-action Add contract below.
53. As a Warden, I want zoom in/out, Fit, view movement, wheel zoom and the existing 25–1600% range, so that navigation remains available through touch, pointer and keyboard.
54. As a Warden, I want accepted context changes to reset to Navigate while refused changes retain the current tool and view, so that navigation and draft guards agree.

### Complete data editing and Fields

55. As a Warden, I want Inspector sections visible in one responsive form with full-width Name/Description and multiline custom text, so that essential content is readable without hunting through tabs or collapsed sections.
56. As a Warden, I want top Hide and persistent bottom Apply/Discard changes with reachable validation/save feedback, so that long forms and reduced-height screens retain their ordinary actions.
57. As a Warden, I want field-level errors and feedback that leads to the affected control, so that invalid Apply preserves my work and tells me how to repair it.
58. As a Warden, I want Delete separated at the end of the form with consequence review, so that destructive work is distinct from ordinary application.
59. As a Warden, I want readable established catalogue/domain labels in Inspector, Hierarchy, controls and accessible map names, so that internal identifiers do not become product terminology.
60. As a Warden editing an object, I want its existing Name, unique system Location key, Description, Other type text, placement, coordinates where applicable and optional physical Station association for a Jump Point, so that the redesign preserves full object editing.
61. As a Warden, I want native Atmosphere and Port class values and applicable typed custom values retained, so that reusable data remains editable without losing hidden assignments.
62. As a Warden, I want built-in Description distinct from a custom field named Session note, so that similar-looking text does not overwrite a different field identity.
63. As a Warden editing an Orbit, I want horizontal/vertical radii, unoccupied Center X/Y, ordering, rotation and Detach retained, so that no prototype omission limits the product.
64. As a Warden editing a Jump Route, I want From Jump Point, known/unresolved destination, To Jump Point or external label, and positive integer Jump level retained, so that route data remains fully editable.
65. As a Warden, I want standard Jump levels 1–9 and higher positive custom levels, logical endpoints and optional physical Stations kept distinct, so that the redesign preserves domain meaning.
66. As a Warden, I want chart names and existing summaries editable/readable in their applicable context, so that the interface retains baseline chart details without inventing descriptions for clusters or systems.
67. As a phone Warden opening Fields, I want the definitions list followed by a full-area consultation detail and explicit Edit, so that the list is not stacked above a cramped editor.
68. As a desktop Warden, I want Fields list/detail in two columns inside a correctly centered bounded dialog, so that the catalogue and selected definition remain easy to compare.
69. As a Warden, I want Fields and Manage to reopen the same session screen, selection and draft, so that either entry resumes work without inventing a field-specific target.
70. As a Warden, I want Back to definitions to restore list position, row highlight and focus while preserving the detail draft, so that returning to the same field resumes it.
71. As a Warden, I want Close to hide Fields and restore focus to the actual opener, so that closing presentation preserves work and underlying map context.
72. As a Warden consulting a definition, I want its type, choices, applicability and assignments visible before Edit, so that consultation is meaningful.
73. As a Warden, I want one reachable guarded New custom field entry per screen leading to a dedicated form, so that creation is discoverable without duplicate commands or implicit draft loss.
74. As a Warden creating a custom field, I want supported text, number, boolean and single-select types with choices, so that the existing reusable definitions remain complete.
75. As a Warden, I want successful creation to open the new read-only detail and explicit Cancel to return to the list without creation, so that application and abandonment are unambiguous.
76. As a Warden, I want hiding Fields to retain its creation draft, so that presentation Close is not confused with Cancel.
77. As a Warden changing a definition or starting New with modified work, I want Apply/Discard/Stay, so that moving within Fields cannot silently lose a draft.
78. As a Warden, I want custom applicability to all objects or selected catalogue categories/subtypes to preserve stored values, so that hiding an ineligible value does not delete it.
79. As a Warden changing options/type or deleting a custom definition, I want explicit review of affected assignments and confirmation, so that destructive changes are informed.
80. As a Warden after confirmed deletion of the selected custom definition, I want the list and focus on a valid nearby row or sensible list control, so that a deleted ID or unrelated Atmosphere selection is not retained.
81. As an Android Chrome Warden, I want compact Fields title/Back/Close, Bottom commands, internally scrollable content and reachable reviews/errors with the keyboard open, so that short landscape and real phone editing are usable.

### Drafts, saving, destructive work and interchange

82. As a Warden, I want object, Orbit, route, chart-name and field-definition/creation drafts retained across hide/reopen, theme changes and responsive remounts, so that presentation never owns the lifetime of my work.
83. As a Warden with a hidden draft, I want a visible draft indicator and reopening path, so that unfinished work remains discoverable.
84. As a Warden changing selection, context or incompatible editor, I want Apply/Discard/Stay for modified drafts and no unnecessary prompt for clean edits, so that transitions are safe and efficient.
85. As a Warden, I want Stay or invalid Apply to retain target, content, feedback, context, view and tool, so that a refused transition leaves me where I was working.
86. As a Warden, I want a draft to exclude commands that affect its entity or actual dependencies before a competing editable preview appears, so that independent operations remain possible without conflicting overwrites.
87. As a Warden, I want Apply to validate against the latest committed workspace and publish valid memory before durable saving, so that a storage failure is not confused with an invalid edit.
88. As a Warden, I want successful Apply to end that editing session and permit its requested transition even if saving later fails, so that Retry cannot replay the edit or create duplicates.
89. As a Warden, I want Saving, Saved on this device and Not saved distinguished from draft/tool feedback, so that I know which applied data is durable.
90. As a Warden after a write failure, I want my valid applied map retained with a persistent error, Retry and Export current JSON, so that I can recover without rollback or losing work.
91. As a Warden, I want latest-snapshot ordered saving and retry, so that an older completion cannot falsely report newer changes saved.
92. As a Warden, I want Cancel/Discard/Escape to affect only the designated unapplied work, so that it never undoes a committed creation or clears an unrelated save error.
93. As a Warden, I want departure warnings where supported for modified drafts or applied-but-not-durable data, so that the session-only recovery boundary is clear.
94. As a Warden, I want to inspect import/deletion/field-change consequences before resolving an incompatible draft, so that read-only preparation does not force work loss.
95. As a Warden, I want consequences recomputed and reviewed again if applying a draft or another change alters a prepared plan, so that confirmation authorizes the actual latest destructive footprint.
96. As a Warden, I want confirmed cascades to remove dependent references and stale selection/target/draft identities, so that subsequent creation follows the existing valid creation contract without reviving deleted UI state.
97. As a Warden, I want validated JSON import preview with collisions/possible matches and explicit confirmation of an independent ID-remapped copy, so that existing work is retained and no silent merge occurs.
98. As a Warden, I want both complete-cluster and standalone-system JSON export/import with existing layout, references, native/custom fields and supported older schema shapes within the current marker/version boundary, so that the redesign preserves interchange without adding previous-marker fallback.
99. As a Warden, I want current JSON export to include applied data despite a failed local save and exclude drafts/previews/view state, so that recovery exports describe the actual applied map.
100. As a Warden, I want invalid import, canceled review and download errors to preserve workspace and drafts, so that investigating or exporting cannot corrupt my work.
101. As a Warden with an invalid local snapshot, I want Retry and Restore last valid backup with clear missing/damaged-backup feedback, so that recovery never exposes an editable partial workspace.
102. As a Warden, I want backup restoration published only after durable replacement succeeds, so that recovery retains its established stronger guarantee.

### Themes, accessibility, exports and integration

103. As a Warden, I want initial light/dark presentation from the OS until I make an explicit choice, so that the interface respects my environment immediately.
104. As a Warden, I want an accessible explicit theme control whose choice persists in this browser/device across sessions and workspaces, so that later OS changes do not override it.
105. As a Warden, I want shell, both maps, native controls and teleported menus/dialogs to use the same palette, so that light mode has no isolated dark surfaces or unreadable portal content.
106. As a Warden, I want changing theme to preserve data, placements, selection, tool, view, drafts and save/error state without a workspace mutation, so that appearance never changes my map.
107. As a Warden, I want useful text at least 4.5:1 and meaningful controls/graphics/state cues at least 3:1 against their actual backgrounds, so that both themes and exports remain readable.
108. As a Warden, I want active mode, selection, keyboard focus, unknown routes and errors conveyed beyond hue, so that color alone is never required to understand state.
109. As a Warden, I want named controls, readable touch/focus help, visible unobscured focus and correct modal focus entry/return, so that compact icons and overlays remain usable through keyboard and assistive technology.
110. As a Warden, I want existing Enter/Space activation, focused geometry adjustments, protected Delete in inputs/dialogs and reduced-motion behavior retained, so that the refactor preserves established accessible operation.
111. As a Warden, I want used icons, including dynamically chosen glyphs, available locally without external Internet, so that cold control rendering does not depend on Iconify or another external service.
112. As a Warden, I want SVG and PNG to export the full applied map independently of my viewport with a readable applied system-title band, so that off-screen content and long titles are not cropped.
113. As a Warden, I want active-light/active-dark export plus Light for printing without changing the live theme, so that the same map is legible on screen or paper.
114. As a Warden, I want exports free of selection/focus/hover, handles, drafts and gesture/candidate previews, including their effect on bounds, so that output contains map information rather than editor transients.
115. As a Warden, I want SVG independently readable without application CSS and PNG rendered from the same scene, so that both formats retain consistent content, geometry, palette and bounds.
116. As a Warden, I want export success/failure to preserve live editing state and distinguish export errors from saving errors, so that exporting neither applies/discards work nor falsely confirms local durability.
117. As a Warden, I want the decorative footer removed while useful draft/save/error feedback remains continuously accessible, so that map space improves without sacrificing trust.
118. As a Warden, I want a preview link labeled as a fresh preview rather than sharing my unsaved workspace, so that the interface does not imply remote data sharing it does not provide.
119. As a Warden, I want a responsive hydrated shell, working local resources and measured integrated startup/interaction/map behavior on representative devices, so that component reuse does not conceal integration regressions.
120. As a Warden, I want automated mobile portrait/landscape/touch journeys supplemented by targeted Android Chrome keyboard/physical-gesture checks, so that coverage reflects both simulated mobile behavior and the supported device environment.

## Implementation Decisions

### 1. Refactor the saved-workspace product, preserving application boundaries

Nuxt UI is the default for suitable buttons, form controls, navigation, menus, popovers, dialogs, tooltips, panel composition and feedback. Evaluate configuration, slots and application adapters before equivalent bespoke UI. Reassess the prototype's custom Dock, hierarchy/catalogue rows and editor envelopes: none is grandfathered as an exception. Document each smallest necessary exception with the unmet requirement, why adaptation is insufficient or less suitable, compatible library controls retained and validation evidence. This is a reviewable implementation rationale, not a new per-component human approval process.

The accepted B/Dock artifact is the reference for composition and information hierarchy. Nuxt UI may change control appearance, typography, spacing and component details; pixel-identical reproduction is not required. Those adaptations do not authorize moving the Dock to the top, replacing map overlays with permanent columns, or restoring a dense legacy summary header. A technical contract cannot silently supersede the accepted composition. See the [presentation acceptance reset](research/interface-fidelity-reset-2026-10-16.md).

Application-owned responsibilities remain D3/SVG maps and geometry, domain commands and authoritative validation, draft/selection/navigation/tool state, persistence and interchange. A library form validator presents feedback; it does not replace domain validation or publish/save data itself. Preserve the SSR shell with client-mounted maps; do not make the whole page client-only to integrate the library. Coordinate provider, CSS and Tailwind registration without duplicate integration. Disposable comparison routes, fixtures and variants are not the production architecture and must not be promoted into the saved-workspace product.

### 2. Preserve domain, data and baseline workflows

Use the existing domain vocabulary and validation unchanged. No schema or domain-term change is required. Preserve stable identities, unique Location keys within a system, logical Jump Points distinct from optional physical Stations, positive integer Jump levels, nested hosted/unoccupied Orbits, per-host ordering, valid placement/attachment and geometry. Keep automatic host-minimum corrections and their separate notices. Objects and Orbits retain their existing coordinate/geometry rules; do not clamp expanding system scenes back to their initial bounds or reinterpret normalized positions as physical distances.

Retain the product database `ttrpg-cluster-control`, interchange marker `ttrpg-cluster-control-map`, matching drag MIME identities wherever drag support is retained, unchanged JSON schema version and decoder compatibility, and the established new-empty-database/no-migration/no-previous-marker-fallback boundary. Preserve the merged snapshot-recovery and Orbit host corrections. No backend/account, old-database migration or newly durable map/tool/selection/draft UI state is introduced. The explicit theme preference in decision 13 is the required durable UI preference.

All baseline outcomes remain available: workspace creation/loading/recovery; chart names and summaries; systems and Jump Routes; all 15 catalogue subtypes; native/custom values and definitions; hierarchy and complete inspectors; nested/elliptical Orbits, order, attachment/detachment, axes/rotation/angles/center; movement/pan/zoom; reviewed deletion; validated copy import; cluster/system JSON; full-map SVG/PNG; and existing keyboard paths. Relocation may change visual position, not outcome, validation, cancellation or accessibility. Native HTML drag is no longer required to create by touch; supported drag behavior must obey the accepted tool/target/validation contract.

### 3. Navigation and panel composition

Keep distinct cluster/system contexts. Show current names and explicit Back. Each view keeps temporary viewport and last valid selection; first visit fits. Accepted effective context changes restore that state and reset Navigate. Refused/invalid guarded transitions retain original context, viewport, selection, tool and draft. View memory is session UI state outside workspace JSON; reload persistence is not required.

Keep the selected Dock, separate Hierarchy/Inspect commands beside Map files, one zoom set and an anchored creation chooser. Hierarchy is optional and genuinely nested; it is separate from the catalogue. Desktop may show both panels and retains independent map navigation. Compact Inspect and Hierarchy are fullscreen/exclusive through every opening path and reflow, with dock/zoom hidden. Hiding preserves session ownership and provides a reopening path. Opening either panel closes the chooser without resetting mode/type/progress. A refused panel transition leaves the original presentation intact.

The map fills one board. Desktop Hierarchy and Inspect occupy optional left/right overlays above that board; opening them does not turn the board into a three-column page. Hierarchy starts hidden. The mode/creation Dock sits at the bottom, with the single zoom set at bottom-right, clear of safe areas and visible panels. The application header stays compact: identity/current context and essential global controls. Back and adjacent Hierarchy/Inspect/Map files commands belong in compact map chrome; counts and secondary chart summaries belong in consultation surfaces. Keep recovery feedback accessible without recreating a decorative footer or an oversized permanent header.

Use suitable Nuxt UI panel/sidebar and sizing primitives before custom equivalents. Support useful desktop panel widths and library-supported resizing with an accessible adjustment alternative, while keeping editor subtrees and drafts alive. Session-only panel sizing must not write workspace data. Do not claim resizing, right-edge direction or keyboard adjustment is supplied merely because a component is named DashboardPanel: verify the actual configured behavior. A documented minimal adapter may preserve the required overlay, lifetime and focus behavior; a blanket non-resizable fixed-column substitute does not meet this composition.

Compose menus above panels as required for ordinary hit-tested input and keyboard focus; Map files must remain usable while desktop Inspect is open. Conflicts/confirmations remain above their invoking surface with correct focus containment/return. Avoid duplicate or simultaneously actionable obsolete layers. A preview link opens a fresh preview and must not imply sharing an in-memory workspace.

### 4. Deterministic map intents

| Intent | Short activation | Drag/navigation | Lifetime |
| --- | --- | --- | --- |
| Navigate | Open a system map directly without forcing Inspect; retain existing selection behavior for other entities. | Pan over background or entities; never edit geometry. | Initial default and accepted context-change destination. |
| Select | Select/request Inspect through the draft guard; a system exposes data. | Pan over background or entities; no Inspect on drag release. | Persistent until an explicit mode/context change. |
| Move | Select existing target without system entry. | Explicit object/system movement and Orbit manipulation; background pan retained. | Persistent until an explicit mode/context change. |
| Add | Target creation with priority over normal selection/activation. | Navigation alternatives remain view-only; existing entities are not moved. | Persistent with the same chosen type after success. |

Panel expansion, mode, selection, creation progress, live gesture previews, drafts and applied data remain distinct. The Add chooser button displays the selected creation type while Add is active, with a compact visible label and the full accessible text. Inspect numeric geometry remains editable in Select. Successful Add neither opens Inspect nor enters a newly created system; an existing draft is neither discarded nor silently retargeted. Every completed route starts fresh endpoint state. Invalid/ambiguous targeting retains Add and publishes nothing until validation/explicit choice permits it.

The later tools decision is authoritative: persistent same-type Add supersedes the earlier one-shot Add clauses. Mode changes cancel unfinished map actions but retain valid selection, viewport and editor drafts. Explicit Navigate/Select/Move activation exits Add even when that underlying mode is already selected; it retains committed entities and activates the requested mode. Quit Add/Escape on the map returns Navigate and abandons the entire unfinished route/creation, while committed entities remain.

### 5. Creation targeting, manipulation and alternative commands

The anchored chooser uses its real trigger, collision-aware placement and available-space constraints, preserving focus and palette through portals. Dismissing it retains intent/progress. Its Escape/outside dismissal consumes that interaction before a map quit/placement; dialogs have priority. No single key/click may dismiss a higher layer and mutate the map below.

Show active type and next target/stage with explicit Quit. On compact screens, reuse the context-banner area, preserving current context and Back and restoring ordinary summary on Add exit. This coordinator-selected compaction is required and remains unimplemented in the accepted prototype.

Place free objects at the chosen valid scene point and attached objects at the indicated position on the actual transformed/rotated/nested Orbit. Do not substitute a fixed angle or arbitrary default for the pointer target. Add Orbit targets a valid object host or an unoccupied center. Indicate candidates without hover; explicit candidate choice precedes ambiguous commit. Invalid targets explain why and retain the tool without mutation.

**Human-approved ticket23 follow-up, 2026-10-20:** a completed click/tap on a unique valid system-creation target adds immediately and retains the chosen Add type. If targets overlap, activating a named candidate performs the validated addition without another confirmation. Numeric Placement exposes one Add action validating the current inputs; Preview then Confirm is not a required creation sequence. Native valid drops remain immediate. Existing draft-conflict, interruption, latest-memory, single-publication and save-recovery guarantees remain mandatory. This supersedes the initial universal creation-confirmation implementation; explicit Confirm/Cancel for moving existing entities and destructive/import reviews is unchanged.

**Human amendment, 2026-10-21:** in Move, dropping an object in clear space with no Orbit target places it freely at the raw drop position, including when it began attached. Dropping onto one eligible Orbit attaches or transfers it at the indicated position. Multiple eligible targets require a named choice; an invalid-only target refuses without mutation rather than becoming a free drop. A normal unique-target or free drop commits directly on release. Precise coordinate/Orbit-position controls with Preview/Confirm/Cancel remain an alternative, not a prerequisite for dragging. This replaces the earlier retained-attachment empty-drop decision. Hosted-Orbit centers still require explicit Detach; an unoccupied center may attach to an announced valid host. Preserve dependent previews, former occupants' effective positions, cancellation, cycle/host/geometry checks and unchanged interchange formats. Provide named target-aware controls for independent axes, uniform ring resize, rotation and unoccupied-center movement, plus numeric/dedicated controls, focused adjustments and hierarchy target selection. No result depends exclusively on drag, hover, multi-touch, right-click or modifiers.

### 6. Gesture precedence and cancellation

Two-contact pan/zoom and right-button hold/drag pan work over entities/handles in every mode without mutation, placement, inspection or context entry. Takeover cancels the live geometric preview before navigation and suppresses subsequent release/click publication from it. Preserve mode/type and a chosen route origin/stage: route progress is distinct from the transient gesture preview. No partial route is published by panning.

Valid normal release commits once through domain validation. Escape, Return to Navigate, gesture interruption and cancellation drop only unfinished work. Pinch retains the mode; cancellation is not undo. Long-press Inspect in Navigate/Move cancels the pending gesture first and suppresses the follow-up click; no new Add long-press binding is inferred. Wheel zoom remains; any optional rotation accelerator respects the explicit-edit boundary and has an alternative. Preserve stationary right-click's native behavior outside a recognized pan and suppress the browser context menu caused by a recognized pan; no application context-menu feature is introduced. Release/cancel behavior must be deterministic in supported browsers rather than assumed from renderer defaults.

### 7. Actual usable space and responsive actions

Evaluate the drawable area remaining after visible chrome, overlays, safe areas and keyboard, not merely the SVG rectangle. Fit and map navigation must provide a visible/reachable route to representative targets; opening/hiding panels, zoom/Fit and explicit controls must remain usable at short heights. Representative system entry, placement and recovery journeys cannot require force clicks through chrome or off-viewport controls. Mathematical scene visibility behind overlays is insufficient. The existing zoom range and full-scene expansion remain.

Reduce nonessential compact header explanation before crowding identity, Back/Close, active-tool progress, ordinary actions and meaningful feedback. For Fields retain a compact title/Back/Close header; relocate or reduce secondary explanation. Retain persistent Bottom commands for Fields and Inspector with internally scrollable remaining content. On supported **Android Chrome**, actions and feedback must remain reachable with the virtual keyboard open and closed in portrait/landscape without abandoning input or closing the keyboard as a prerequisite. Preserve draft and focus throughout. Reduced desktop viewports help investigate but do not establish that OS-keyboard requirement. The prior Android/Firefox report identifies usability risks to address; it does not prove Chrome passes or fails. There is no agreed universal pixel/percentage budget; measure actual available regions and validate these externally visible journeys.

### 8. Full Inspector parity and vocabulary

Use one form with visible entity-appropriate sections, one phone column, full-width names/descriptions/multiline text and optional desktop pairs for short controls. No tabs/default-collapsed sections replace the accepted visible sections. Top Hide preserves the draft. Bottom Apply/Discard changes, compact save state and error access stay available while the body scrolls. Associate field errors with controls and provide a feedback path to the affected input. Delete stays in a separate final section with exact consequence review.

Preserve object Type label for Other, Location key, Name, Description, system/Orbit Placement, conditional Schematic X/Y, optional physical Station association for a Jump Point, applicable native/custom values and multiline custom text. Preserve Orbit radii, unoccupied Center X/Y, order, rotation, Detach and deletion; route endpoint and known/unresolved destination editing and jump level; chart names and existing summaries. Unsupported prototype Orbit/chart controls are implementation gaps, not successful edits. Apply must actually mutate the intended supported data or refuse explicitly; no success feedback for ignored values.

Use Description only for the built-in object description; retain each custom definition's actual name, including Session note, with native/custom distinction. Clusters/systems retain names only; unsupported prototype notes do not add description properties. Use established readable labels consistently in hierarchy, catalogue, map accessible names and operation labels; preserve an Other object's custom subtype text. Do not rename stored identifiers or introduce vocabulary/schema changes.

### 9. Fields session and impact flow

Fields/Manage share session-only screen/selection/draft state. First opening presents the list. Compact flow is list → read-only detail → explicit Edit, each using the available dialog area; desktop retains two columns in a centered bounded dialog. Detail includes saved type, choices, applicability and assignments. Reopening resumes the last valid screen, including creation. Manage does not manufacture a field target.

Back restores list scroll, highlight and focus, retaining the detail's draft for same-target resume. Close hides and returns focus to its actual opener, preserving underlying map/editor state. Modified target/New transitions use Apply/Discard/Stay; clean transitions do not prompt. One reachable guarded creation entry per screen opens a dedicated detail-area form. Successful application opens the new read-only detail. Explicit creation Cancel returns to list without creation; presentation Hide retains it.

Retain native options, all custom types/choices/applicability, assignments and the difference between reusable definitions and per-object values. Applicability defaults to all objects or specified existing catalogue categories/subtypes; changing visibility retains stored values. Type/option changes and custom deletion retain explicit affected-value review. After confirmed selected-definition deletion return to the list with valid nearby focus, or list heading/New if no suitable row; clear deleted IDs and do not default silently to Atmosphere. Resolving an object-draft conflict must renew review when effects change. Invalid Apply/review Cancel preserves work and context.

### 10. Parent-owned drafts and targeted exclusion

Own draft identity/content/validation and transition state above presentation component lifetime. The policy applies to object, Orbit, Jump Route, chart-name and field-definition drafts, including creation. Hide/reopen, theme changes and responsive remounts retain ownership, content, target and feedback; show a hidden-draft indicator/reopening path. Drafts are session-only; there is no requirement to durably store them or shelve unrelated selected-entity drafts.

An active draft exclusively owns its entity and actual dependencies: host, placement, endpoints, affected definitions and destructive footprint as applicable. Reject conflicting canvas/other commands with an explanation and Apply/Cancel access before showing a misleading editable preview. Do not lock unrelated entities or synchronize/overwrite draft fields silently. Independent pan/zoom and genuinely independent commands remain usable, including while the draft is hidden.

Before leaving modified work for a different selection/context/incompatible editor, offer Apply/Discard/Stay. Apply validates a detached candidate against latest committed data, publishes valid memory, ends the designated session and continues the requested transition. Discard drops only the designated unapplied work. Stay/invalid Apply retains draft, target, feedback, view, context and tool. Unchanged sessions can leave without a prompt. Library dismissal never silently applies/discards work.

### 11. Application, autosave and recovery are different boundaries

Valid form Apply, valid gesture release or destination Confirm publishes validated memory before autosave. Validation refusal publishes nothing. Once applied, the change survives Cancel, Escape, panel dismissal and persistence failure; no undo is introduced. A successfully applied form ends independently of durable-save acknowledgement.

Keep one ordered automatic persistence boundary for the latest snapshot. Saving / Saved on this device / Not saved remain distinct from draft/mode state; only the latest durable snapshot may claim Saved. Preserve valid memory on write failure with persistent readable error, Retry and Export current JSON. Retry saves the latest snapshot without replaying creation/commands or reopening the applied draft. Later applied changes use the same ordering boundary. An old completion cannot mark newer data saved, and export success cannot clear a storage failure by implication.

Current JSON export includes latest applied memory, including pending/failed saves, and excludes drafts, gesture previews and temporary view/selection/tool state. Explain excluded draft work as needed; export does not resolve it implicitly. Distinguish download/export errors from validation and local-save errors, retaining all work. Where browser capabilities permit, warn on voluntary departure/reload for modified drafts or applied data not durable. Actual session loss can lose those; do not promise durable draft recovery.

Preserve validated hydration, explicit load error/Retry, last-valid backup and missing/invalid-backup feedback. Never expose partial invalid data as an editable workspace. Backup restore retains durable-before-publication replacement semantics, distinct from ordinary memory-first editing. Preserve both current/backup records when restoration or saving fails according to the existing storage contract.

### 12. Accurate destructive operations and interchange

Import, deletion and destructive Fields preparation are read-only and preserve drafts. Confirmation resolves incompatible ownership, recalculates consequences against the latest workspace and requires renewed review if dependencies/affected entities changed. Apply only an accurate reviewed validated plan. Cancellation or preparation/validation failure before in-memory application publishes nothing. A durable-save failure after valid memory publication preserves the applied result and follows decision 11, including persistent error, Retry and applied-current-JSON recovery; backup restoration remains the explicit durable-before-publication exception. Do not accept an old preview as authorization for a different footprint. After committed deletion clear stale selection/view-memory/draft/pending IDs and retain unrelated entities. Subsequent creation follows existing valid identity/default/explicit-placement contracts without reusing stale deleted UI state; this does not implement or close the separate defaults-generator issue.

JSON import stays validated preview → explicit confirmation → independent ID-remapped copy; retain collision/possible-match information, reference remapping, applicability reconciliation and existing data. It is not a merge or replacement feature. Preserve standalone-system versus whole-cluster scope and decoding of supported older schema shapes within the current marker/version boundary, without adding previous-marker fallback. JSON exports retain durable geometry/references and omit transient UI state. Image export follows the separate clean-scene contract below.

### 13. One active theme and locally available resources

Before an explicit choice derive light/dark from the OS, including OS changes; afterward retain the saved explicit choice despite OS changes. Persist preference in this browser/device across reloads, browser sessions and workspaces, separately from workspace data/import/export. Provide named keyboard/touch access and current state.

Reuse/extend common CSS variables for shell, native/library controls, portal/teleported menus/dialogs/tooltips, both maps, labels, halos, grid/guides, routes, Orbits, selection/focus, validation and draft/save/error states. Replace literal dark-only surfaces; verify initial SSR/hydrated display and palette coordination. Theme switches are presentation-only: retain data/placements/context/tool/valid selection/per-view viewport/draft/feedback/save state and cause no workspace save. If a genuine interruption occurs, cancel only the gesture preview under the normal contract. No elaborate theme engine is introduced.

Package every used icon, including dynamic selected/check/chevron names, locally. Validate a fresh browser and server with external Internet denied while the local app remains reachable; inspect actual glyphs and server egress. A local HTTP success or warm cache is insufficient. Preserve local resource behavior without adding PWA/offline-without-server scope.

### 14. Readability and accessible interaction

Require **at least 4.5:1 for all useful text**, including large useful text, maps, tooltips, status and export titles, and **at least 3:1 for meaningful icons, control boundaries/state cues and map graphics needed to understand/use the scene** against actual adjacent/composited backgrounds. Do not round a failing result upward. Distinguish decorative grid lines from meaningful alignment/interaction guides. Exact palette values may be chosen during implementation within these constraints.

Convey mode, selection, focus, unknown routes and errors through text/marks/shapes/line patterns or other non-hue cues with programmatic names/states where relevant. Focus and selection remain distinguishable together. Focus remains visible and not entirely hidden by app-created overlays; controls/targets are reachable with keyboard and a single pointer. Compact icon meanings are accessible to touch/focus rather than hover alone. Preserve Enter/Space activation, applicable focused arrow adjustments, keyboard Delete protection in inputs/dialogs, and reduced-motion behavior. Do not introduce the separate later tool-shortcut feature.

Remove the decorative footer, relocating useful status to compact continuously accessible feedback with draft/reopening, saving state, persistent error/Retry/current-JSON export. Neither decorative microcopy nor toasts may obscure required controls or be the only access to persistent failure. Coordinate the dedicated accessibility issue's audit/report without treating its separate scope as permission to miss these thresholds.

### 15. Clean complete-scene image export

Both SVG and PNG default to the active palette and offer Light for printing for that export only. Resolve the palette on an export scene without changing live theme/preference. Export latest validated applied memory even if saving is pending/failed, independent of viewport. Include full scene bounds and the current applied system name in a readable non-overlapping title band with bounds sufficient for it; retain the baseline difference between system-title and cluster exports.

Exclude temporary selection/focus/hover, handles, unapplied draft content and gesture/candidate previews, including their influence on bounds. Preserve meaningful objects/labels/Orbit paths/Jump Routes/unresolved-route cues. SVG is standalone without app CSS; PNG rasterizes the same content/arrangement/palette/title/bounds. Export cannot mutate live scene/selection/view/tool/gesture/draft/theme/save state, apply/discard work or imply local-save success. Distinct actionable export errors retain editing state. This remains Warden-facing output with no new player/secrecy filtering.

### 16. Acceptance evidence and performance

Validate the integrated saved-workspace editor with real commands/storage and complete controls, rather than only the disposable sample. Use representative baseline/dense data, long text/catalogues, both maps, desktop/portrait/landscape/short height and keyboard-reduced space. Automate mobile-emulated touch journeys as part of the primary suite. Record source/runtime identity, versions, fixtures, method, outcomes and limits. Supported Android Chrome OS-keyboard and physical-gesture acceptance supplements that automation. Android Firefox is outside the supported mobile target by the human's explicit 2026-10-16 instruction; desktop support retains the baseline scope.

Measure integrated production initial/deferred JavaScript, CSS/resources, startup/mount, overlays and map pan/zoom with equivalent representative scenarios against the preserved baseline where comparison is valid. Remove disposable A/C/comparison scaffolding from that assessment. Historical additional 628,307 received JS/CSS bytes are a full-prototype difference, not isolated Nuxt UI cost or a final budget. No numeric final performance budget has been human-agreed; report actual comparable results and remaining limitations without inventing one or treating missing timings as zero. A reproducible material usability regression must be investigated rather than hidden by successful bundling.

## Testing Decisions

Presentation acceptance is separate from behavioral test success. For each changed UI surface, compare the integrated application with the accepted B/Dock reference at comparable viewport, theme and panel/tool state; disclose fixture differences. Record screenshots and inspect the actual relative placement of Dock, map, overlays, header and feedback on desktop, portrait and short landscape. Verify ordinary hit testing, focus and overlay-aware Fit as well. Judge composition and usability, allowing Nuxt UI's visual details; do not require pixel equality. A passing scripted matrix or source review cannot waive a visible structural mismatch. Tickets 18–21 require reassessment following the human's rejection of the implemented composition; previous technical results remain scoped evidence, not current product acceptance.

**Confirmed by the human on 2026-10-16:** “Oui — Automatiser le mobile et cibler le contrôle sur téléphone.” The human then explicitly narrows Android support to Chrome. Use automated desktop and mobile-emulated portrait/landscape/touch journeys, with targeted supported Android Chrome device checks for OS-keyboard and physical-gesture gaps. The specification is `open` and `enhancement` / `ready-for-agent`: specified and planned, with implementation and device acceptance still outstanding.

The primary seam is the **real application through existing Playwright tests**: user-visible UI/map outcomes, actual JSON/SVG/PNG downloads, durable reload and recovery. Prefer role/name-based actions and ordinary hit-tested pointer/keyboard input. Assert external behavior, validated exported content, retained data and understandable feedback; avoid component internals, CSS class names, copied reducer assertions or incidental DOM structure. Use geometric/hit-test inspection only where the externally visible requirement is reachability or available space, and inspect captures alongside it. Screenshot geometry alone does not prove successful interaction.

A small existing lower-level seam remains appropriate for pure domain/codec/storage invariants that the browser cannot economically observe completely: decoding of supported older schema shapes within the current marker/version boundary without previous-marker fallback, reference/geometry validity and atomic current/backup snapshot outcomes under failures. Keep these inside the existing Playwright runner; there is no separate unit/component harness. Do not introduce a debug API or new test-only command interface. Existing `npm test` runs Playwright, including current pure-function and real-browser storage-adapter cases; typecheck and build validate integration but do not establish behavioral acceptance. No product test, typecheck or build is executed or claimed passed by this specification-writing step.

Prior art is the existing navigation/arrangement/route suite, nested-object/native/custom-field and destructive-field tests, Orbit drag/detach/host-minimum/round-trip cases, full-bounds image export cases, cluster/system JSON and independent-copy import journeys, and current/backup recovery failure tests. Keep their feature outcomes; update presentation-specific locators/assertions where the accepted design intentionally changes the shell. The accepted prototype suites supply useful scenario ideas, not product acceptance or an obligation to preserve their harnesses. The [test-seam investigation](research/spec-test-seams-2026-10-16.md) records detailed prior art and the **B1–B10** scenario families: complete/resumed workflow; intents/creation lifetime; takeover/cancellation; presentation-independent drafts; guard/dependency authority; Fields/destructive reviews; Apply/save failure/latest Retry; load/backup recovery; theme/resources/responsive accessibility; and complete export. Map implementation tickets to the applicable families plus preserved capability regressions rather than prescribe one giant journey or a fixed case count.

**Current route and baseline limitations:** the current default `/` mounts a memory-only prototype; only `?variant=baseline` reaches the retained saved-workspace editor. Existing suites navigate `/` expecting historical product forms, so they are preservation prior art rather than an automatically passing current product gate. Implementation must restore the real integrated persisted editor as the production experience and deliberately target it in tests. Any interim retained-baseline check must name its explicit route and shared feature-branch changes. Do not mechanically point all tests at the disposable sample.

The retained baseline's draft acknowledgement waits for durable completion, its transition guard does not yet offer the accepted full Apply/Discard/Stay behavior, and its load Retry is not a save-latest-memory Retry. The existing IndexedDB transaction-abort test establishes storage atomicity rather than form-ending/Not saved/latest Retry/write-order behavior; those require integrated UI checks. The current exporter clones displayed SVG and initially reads bounds before handle removal; valid SVG/PNG signatures do not establish applied-only content, transient-free bounds or export-only palette. Assert those intended external results explicitly.

**Automated mobile is part of the main suite.** Parameterize meaningful journeys with Playwright mobile/touch emulation in portrait, landscape and reduced-height layouts, including tap, supported synthetic multi-contact input, panel/Fields navigation, complete form journeys, guards, themes, downloads and reload/recovery. Existing 390×844, 844×390 and 390×500 scenarios are useful starting viewports. Cover relevant capabilities, then select focused/pairwise theme/size variants without repeating every mutation at every size. Emulation tests responsive/input behavior; it does not reproduce an OS virtual keyboard merely by shrinking a viewport.

Targeted phone acceptance uses supported Android Chrome for keyboard open/closed, portrait/landscape, safe areas and actual tap/drag/long-press/second-contact takeover where emulation cannot establish the outcome. It complements automation, rather than making all mobile testing manual. Experimental Playwright Android Chrome/WebView automation is an optional available method, not a required new hardware setup, CI dependency or harness. Android Firefox is not a required acceptance target. The coordinator checked the official [emulation documentation](https://playwright.dev/docs/emulation) and [Android support documentation](https://playwright.dev/docs/api/class-android); these capability facts do not claim a device setup exists here.

| Requirement group / stories | Required external acceptance |
| --- | --- |
| Workspace and full parity, 1–17, 33, 55–81 | Create/resume a real local workspace; exercise all catalogue/native/custom fields, chart names, full object/Orbit/route controls and hierarchy. Desktop panels and Map files coexist without occlusion; compact exclusive panels survive every entry/reflow. No unsupported control may appear to save successfully. |
| Tools and targets, 18–54 | Both maps: Navigate/Select pan cannot mutate; short activation differs correctly; repeated same-type Add, no automatic Inspect/system entry; fresh route endpoints; chosen-angle placement on rotated/nested Orbits; valid/ambiguous/invalid candidates; transfer/detach/host minimum; explicit alternatives. Canceled/interrupted/second-contact/right-pan release cannot publish, while route origin and earlier commits survive. |
| Layering and available area, 13–17, 24, 28–32, 56–58, 67–81 | Normal hit tests/focus reach menu/chooser/dialog and main actions with overlapping panels; Escape/outside dismissal affects only its layer. Desktop, portrait, short landscape, dense/long content and safe areas preserve usable map/form regions and a reachable Fit/targeting path. Verify compact Add banner and Fields header on the integrated artifact. |
| Draft ownership, 23, 69–86, 92–96 | Representative object/Orbit/route/chart/field edit and creation drafts retain identity/text/validation through hide/theme/reflow. Hidden ownership rejects actual dependency conflicts before preview but permits unrelated commands. Valid/invalid Apply, Discard, Stay and clean transitions preserve/reset exactly the required context/tool/view. Refreshed destructive reviews cannot commit obsolete effects. |
| Autosave/recovery, 1–3, 87–102 | Validation refusal publishes nothing. Valid application ends its form before a forced durable failure; persistent error/current-JSON recovery retain memory. Latest retry/autosave and out-of-order completion never duplicate operations or claim stale data saved. Reload restores validated durable data; missing/invalid current/backup and failed restore retain exact established atomic outcomes. |
| Interchange, 94–102, 112–116 | Real invalid/canceled/confirmed import journeys preserve existing work and remap independent copies. Decode actual cluster/system downloads with the unchanged codec and inspect expected applied values/references/layout. Test cancelled/changed deletion/field impacts, stale ID cleanup and fresh creation after deletion. |
| Themes/resources, 103–111, 117–119 | First OS light/dark, OS change before/after choice, durable override across reload/session/workspaces/import; shell/maps/portal palette; switching with hidden dirty drafts/selection/view/save failure. Fresh browser and server with external Internet denied render every used glyph with no external dependency. SSR/hydration does not reset work or produce inconsistent controls. |
| Contrast/focus, 107–110 | Measure actual light/dark composited pairs and meaningful graphics/state combinations without rounding failures; preserve distinct selection/focus/non-color cues, readable names/help, modal entry/containment/return, keyboard-only complete flows and single-pointer alternatives. Record limitations; no assumed library accessibility certification. |
| Images, 112–116 | Independently read both maps in active-light, active-dark and print-light, each as SVG and PNG. Check same scene geometry/full bounds/system title, dense/long/off-viewport content, selection+draft+gesture+failed save, transient-free bounds and standalone SVG styles. Assert all live state and theme preference remain unchanged; failed export is separate from failed save. |
| Automated mobile, supported device and performance, 16–17, 44–47, 81, 119–120 | Automate portrait/landscape/touch journeys through the integrated product. Target Android Chrome phone checks to keyboard open/closed, safe areas and physical gestures: ordinary actions, feedback and editable content reachable with draft/focus preserved. Physical second-contact takeover/cancellation needs evidence beyond viewport simulation. Separately record equivalent integrated production cost/startup/overlay/map measurements with source/fixture/device identity and missing/partial arms disclosed. |

Fixtures should cover empty/initial and populated workspaces; dense maps with overlapping candidates; free and nested hosted/unoccupied elliptical Orbits; all catalogue/custom value types; long names/descriptions/definitions/options/assignments; known/unresolved routes and higher jump levels; stale dependencies; dirty hidden drafts; validation refusal; storage/download failures. Reuse valid existing fixtures and builders; invalid fixture data must not masquerade as an application failure. Sample 3-system/13-object/6-Orbit evidence is illustrative, not a prescribed maximum or sufficient performance load by itself.

Use local development for focused UI iteration as directed by the human. Use compiled production for packaging, hydration/modal geometry and meaningful final performance checks; deployment readiness is not behavioral or physical-device proof. Run relevant existing suites, typecheck/build and targeted new behavioral cases appropriate to actual changes. Keep source snapshots separate: do not add historical pass counts into a current-head total or claim a fixed viewport is a physical keyboard/touch pass.

## Out of Scope

- Unified continuous map/semantic zoom and its coordinate/renderer changes; the two existing maps remain.
- Undo/redo, multi-selection/arbitrary groups, Orbit locking, search/filters, annotations/zones, campaign modules, player views/secret-free export and other separately requested features.
- [Tool keyboard shortcuts and toolbox hints](https://github.com/Submoon/ttrpg-cluster-control/issues/29); preserve existing keyboard behavior here, with this later issue dependent on the revamp.
- New domain terms, cluster/system descriptions, new durable workspace schema, persistent drafts, remote accounts/storage/sharing, database migration, a theme engine or a new map renderer.
- Promoting the disposable sample/fixtures/comparison variants into the product, or treating simulated saving as storage integration.
- A new broad visual prototype vote, per-component permission gates, or retroactive physical/accessibility/performance certification from prior evidence.
- Implementing or closing related issue requests solely because this specification mentions their coordination. This includes independent reliability diagnosis and the dedicated accessibility audit/report deliverable; required no-loss behavior and contrast thresholds in this specification still apply.
- Product source implementation, implementation-ticket creation, GitHub writes, merge or issue closure during this specification step. The subsequent to-tickets/implementation workflow is separate.

## Further Notes

### Baseline and readiness

Coordinator-supplied fresh fetch on **2026-10-16** establishes intentionally different planning/preview branch `codex/interface-revamp` at **`52b3e7aa2946824826ec41071b0d530cc88f38ed`**, matching its remote, **0 main-only / 22 feature-only** against **`origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`**. The latter is the saved-workspace product baseline whose capabilities must be preserved. This specification adds planning content on that feature branch; it does not describe the disposable default route as a merged product refactor. Existing unrelated local work remains outside this document's ownership.

All seventeen Wayfinder questions are closed with bounded Resolutions. Their closure settles decisions/investigations; it does not mean the product is implemented or every technical/device gate passed. The current Astra review finds no new essential human design choice before specification. The human confirmed the test strategy on 2026-10-16 and subsequently limited Android mobile support to Chrome, superseding earlier Android/Firefox acceptance-target wording while preserving historical findings. No final numeric performance budget is claimed. Exact palette values, Nuxt UI composition and small justified adaptations are implementation choices governed by the fixed contracts and evidence requirements above.

This synthesis uses the root domain context; no ADR directory was present. It introduces no new term/relationship. Specification prose is English as required by the repository.

### Decision and requirement traceability

| Source | Authority carried into this specification |
| --- | --- |
| [Navigation boundary](tickets/01-map-navigation-boundary.md#resolution) | Separate maps, direct Navigate entry, context/Back, temporary per-view state, guarded transitions; stories 4–9, 54. |
| [Nuxt UI fit research](tickets/02-nuxt-ui-fit.md#resolution) | Documentary compatibility and integration questions, not adoption/performance proof; decisions 1, 13, 16. |
| [Touch/mouse/keyboard contract](tickets/03-touch-keyboard-interactions.md#resolution) | Targeting, attachment, complete alternatives, previews/cancellation and context boundaries; stories 34–54, amended by the later tools decision. |
| [B direction](tickets/04-map-first-ui-direction.md#resolution) | Optional nested hierarchy/icon catalogue, exclusive fullscreen compact panels; remove pictured utility toolbar and LIVE MAP badge; decisions 3, 7. |
| [State preservation](tickets/05-editor-state-and-preservation.md#resolution) | Targeted exclusion, session ownership, Apply/Discard/Stay, application versus durable save, persistent failure/retry/export, renewed impacts/recovery and data identity; stories 82–102. |
| [Themes/accessibility/export](tickets/06-themes-accessibility-export.md#resolution) | OS-first durable choice, shared tokens, status relocation, contrast/focus/non-color requirements and clean full-scene dual-palette output; stories 103–117. |
| [Broad prototype boundary](tickets/07-nuxt-ui-adoption.md#resolution) | Application/library responsibilities, SSR and adaptation-first policy, later strengthened by final adoption; decision 1. |
| [Final Nuxt UI adoption](tickets/08-confirm-nuxt-ui-adoption.md#resolution) | Maximum library reuse, reassess custom prototype surfaces, smallest justified exceptions, retained integration obligations; decisions 1, 13, 16. |
| [Integration evidence](tickets/09-measure-nuxt-ui-integration.md#resolution) | Historical SSR/desktop costs, cold-icon/theme failures and partial arms; test required corrections without inventing library-only cost. |
| [Consolidated device/preservation investigation](tickets/10-validate-b-device-preservation.md#resolution) | Source-specific evidence and historical Android/Firefox keyboard/header findings; device acceptance now targets Android Chrome under the later human instruction, with resource, theme, layering, parity, durability/export/performance obligations retained. |
| [Final tools contract](tickets/11-finalize-tools-contract.md#resolution) | Navigate/Select/Move, persistent same-type Add, no forced Inspect/system entry, right-pan, route-origin retention and takeover suppression; stories 18–54. |
| [Controls presentation](tickets/12-decide-controls-presentation.md#resolution) | Chosen Dock, anchored chooser, panel/file separation, context-banner Add compaction, readable/named controls, native stationary-right-click boundary and remaining composition gates. |
| [Mobile Fields flow](tickets/13-decide-mobile-fields-flow.md#resolution) | List/detail/Edit, shared resumption, Back/Close/focus, guarded New, creation/deletion outcomes and values/impacts; stories 67–81. |
| [Inspector refinements](tickets/14-decide-inspector-form-refinements.md#resolution) | Visible sections, responsive text, bottom actions/status/errors, top Hide, distinct Description/custom names and separated deletion; stories 55–66. |
| [Focused tools evidence](tickets/15-prototype-resolved-tools-contract.md#resolution) | Sufficient design demonstration for specification, with physical/full-product gates explicitly transferred rather than declared passed. |
| [Accepted Fields artifact](tickets/16-prototype-mobile-fields-flow.md#resolution) | Bottom commands, corrected Nuxt UI modal centering and one guarded creation entry, with physical keyboard acceptance still outstanding. |
| [Accepted Inspector artifact](tickets/17-prototype-inspector-form.md#resolution) | Accepted focused rendering at published `be8bef3e`; full parity/durability/device requirements retained. |

### Evidence is not the requirement

The [initial static capability audit](analysis.md), [current map](map.md) and [current Astra review](research/astra-current-interface-review-2026-10-16.md) supply source and scope context. The [consolidated dossier](research/b-consolidated-validation-2026-10-16.md) retains individual source identities instead of a combined pass score. The [Dock correction](research/dock-feedback-2026-10-15.md), [Fields report](research/fields-prototype-2026-10-15.md), [Fields production positioning follow-up](research/fields-modal-position-2026-10-16.md), [Inspector parity audit](research/inspector-form-refinements-2026-10-16.md) and [Inspector execution report](research/inspector-prototype-2026-10-16.md) explain the accepted artifacts and their limits.

Evidence supports chosen design and bounded behavior: source-specific controls checks, Fields/Inspector review and browser cases, and a retained-baseline hit-tested pan/zoom probe. It does not certify full saved-workspace parity, IndexedDB durability, complete export combinations, complete keyboard/screen-reader behavior, contrast, physical multitouch or performance of the final integration. The retained-baseline route shares feature-branch providers/styles/renderers and is not pristine main for comparative performance.

Known integration work remains: desktop Map files occluded by Inspect; oversized compact Fields header; short-screen map targets covered by chrome; cold external icon dependency; historical inconsistent portal/OS/persisted theme; and complete-control/persistence/export gaps. Historical Android/Firefox keyboard-hidden actions motivate the required keyboard-access behavior, now to be validated on supported Android Chrome; no Chrome failure or pass is inferred and no Firefox repair obligation remains. Current Fit samples no longer reproduce total drawing disappearance, while overlay obstruction remains distinct. Context-banner Add reuse is decided but unimplemented. Physical second-contact takeover remains unverified. Human general acceptance of artifacts does not provide unreported device versions, loaded hashes or scenario results.

Related [Orbit-draft overwrite](https://github.com/Submoon/ttrpg-cluster-control/issues/16), [post-deletion defaults](https://github.com/Submoon/ttrpg-cluster-control/issues/15) and [accessibility/footer](https://github.com/Submoon/ttrpg-cluster-control/issues/23) work must coordinate against the accepted contracts without implying their independent request is complete. Existing recovery/host corrections remain preserved. Planning records and historical reports may retain dated pending statements; their final Resolutions and the explicit precedence in this specification govern the current contract.
