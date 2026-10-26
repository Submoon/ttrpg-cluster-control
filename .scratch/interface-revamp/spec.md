---
title: "Revamp the interface: responsive map editing with preserved local work"
status: open
triage_labels:
  - enhancement
  - ready-for-agent
---

## Problem Statement

Redesign the real local-workspace editor so Wardens can navigate and edit Jump Clusters and star systems on desktop and phone without overlapping controls, ambiguous gestures or lost work. Preserve baseline mapping, field, interchange and recovery capabilities while making light/dark presentation, accessibility and image export coherent.

## Solution

The product opens at `/` and edits the browser's persisted workspace. Use the accepted B/Dock direction and Nuxt UI by default, while keeping maps, domain validation, persistence and export in their application-owned boundaries. Prototype routes, fixtures and simulated storage are historical evidence, not product acceptance.

## Source issue

The source request is [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3). Human-confirmed scope is a UI redesign, with related requests coordinated separately. GitHub remains authoritative for the request; this specification defines the local product contract and does not close the issue.

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
10. As a Warden, I want Select as the default and leftmost bottom Dock mode, followed by Navigate and Move, with creation and panel/file commands distinguished, so that ordinary object inspection is immediately available.
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
32. As a Warden, I want Quit Add or Escape on the map to abandon unfinished creation and return to Select, so that canceling leaves completed entities and Inspector drafts intact.
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
54. As a Warden, I want accepted context changes to reset to Select while refused changes retain the current tool and view, so that navigation and draft guards agree.

### Complete data editing and Fields

55. As a Warden, I want Inspector sections visible in one responsive form with full-width Name/Description and multiline custom text, so that essential content is readable without hunting through tabs or collapsed sections.
56. As a Warden, I want a top close control that hides the panel without discarding work, and a persistent bottom Edit action during consultation replaced by Apply/Discard during editing, with reachable validation/save feedback, so that long forms and reduced-height screens retain the actions relevant to their current state.
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

1. **Product and library boundary.** Refactor the persisted editor at `/`; do not promote the disposable prototype. Use Nuxt UI wherever it fits. D3/SVG maps, domain commands, validation, workspace state, persistence and interchange remain application-owned.
2. **Baseline parity.** Preserve existing domain meaning, commands, validation, formats, recovery and map operations. No new schema, remote workspace or product capability is implied.
3. **Navigation.** Keep Cluster and system maps separate, show context and explicit Back, and remember each view's temporary pan/zoom and valid selection. Fit first visits and clear deleted selections; this memory is not exported or saved.
4. **Map intent.** Select is the default and leftmost mode, followed by Navigate and Move; Add remains distinct. Navigate pans the view and opens systems; Select opens data editing; Move manipulates entity geometry. Accepted context changes reset to Select only after draft guards pass; leaving Add through Quit Add or Escape returns to Select without discarding editor drafts.
5. **Creation and targeting.** Add remains active for repeated same-type creation, does not force Inspect or system entry, and starts completed routes fresh. Indicate targets; require explicit choice for ambiguity and reject invalid targets without mutation.
6. **Gestures and alternatives.** Panning/zooming never edits data. View takeover cancels and suppresses only the in-progress gesture; earlier commits, drafts and route progress survive. Provide keyboard and single-pointer alternatives for every operation.
7. **Available space.** Desktop panels may coexist with and not disable map navigation. On compact screens Inspect and Hierarchy are fullscreen and exclusive. Fit, targeting, actions and feedback must use the unobstructed area and remain reachable.
8. **Inspector parity.** Keep complete existing object, Orbit, route, chart and custom-field editing. Show responsive sections, readable domain labels and full-width long text. Consultation exposes Edit in the bottom action area; editing replaces it with Apply/Discard, with Apply disabled until modified and Discard available for clean sessions. Creation and impact reviews retain their dedicated actions. Keep deletion separate; place the existing neutral Detach action beside Delete without changing its guards or mutation semantics.
9. **Fields.** Mobile Fields uses list → read-only detail → explicit Edit; desktop uses list/detail columns. Preserve session drafts, focus and position through Back/Close. Guard New and destructive definition changes; review impacts and retain assigned values where applicable.
10. **Draft ownership.** Drafts are session-only and survive hide, reflow and theme changes. Exclude only commands affecting a draft's entity/dependencies. Apply / Discard / Stay guards protect modified work; unrelated commands remain possible.
11. **Apply and saving.** Validate against latest committed data, publish valid memory, end the form, then save durably. Distinguish draft, saving, saved and not-saved. Retry writes latest memory without replay; keep JSON export and last-valid-backup recovery available after failure.
12. **Destructive work and interchange.** Review and confirm consequences before deletion or field-definition changes. Imports validate and preserve current work, creating independent copies where specified; keep routes, physical stations and logical endpoints distinct.
13. **Theme and resources.** Use one coherent palette across shell, maps and portals; start from OS preference and persist an explicit local choice. Required icons work offline. Theme switching changes no data, draft, selection, view or save state.
14. **Accessibility.** Preserve keyboard and touch operation, visible and unobscured focus, readable names, and state cues beyond color. Acceptance targets are at least 4.5:1 for useful text and 3:1 for meaningful controls/map graphics.
15. **Image export.** SVG and PNG contain the full applied scene in the active palette or export-only Light for printing. Exclude transient selection, handles, previews and unapplied drafts. SVG is standalone; export cannot mutate live state.
16. **Evidence.** Validate user-visible behavior and actual files/reload/recovery in the integrated product. Treat each delivery result as scoped; ticket 29 and its dossier own whole-product acceptance. Emulation does not prove physical-device behavior.

## Testing Decisions

- Exercise the real application at `/` through the existing Playwright runner: visible outcomes, hit-tested interactions, downloaded files, reload and recovery. Keep pure codec/domain/storage invariants inside the existing runner; add no debug API or separate harness.
- Cover B1–B10: complete/resumed workflows; intent and creation lifetime; takeover/cancellation; presentation-independent drafts; guard/dependency authority; Fields/destructive review; apply/save failure/latest retry; load/backup recovery; theme/resources/responsive accessibility; complete exports.
- Automate meaningful desktop and mobile-emulated portrait, landscape and reduced-height flows. Target supported physical Android Chrome checks to OS keyboard, safe areas and physical gestures; emulation alone does not establish them. Android Firefox is not an acceptance target.
- Compare integrated development and compiled production behavior as needed. Record source/fixture, browser/device and missing evidence; no numeric performance budget or physical-device pass is inferred. Typecheck/build do not prove behavioral acceptance.

## Out of Scope

Unified-map/semantic-zoom work; undo/redo, multi-selection, Orbit locking and other separately requested features; new schema, remote storage, persistent drafts or player secrecy filters; promoting prototype code/fixtures; and closing related GitHub requests. Required preservation, accessibility, recovery and export behaviors in this contract remain in scope even when related work has a separate owner.

## Further Notes

The historical planning snapshot was `52b3e7aa2946824826ec41071b0d530cc88f38ed`, intentionally based on feature branch `codex/interface-revamp` against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. This records planning provenance; it is not the cleanup or current product-validation baseline. Human approval on 2026-10-16 selected automated mobile coverage and later limited Android support to Chrome. No numeric performance budget or physical-device pass is claimed.
