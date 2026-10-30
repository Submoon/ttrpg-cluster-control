# Editor UI changes and review

Read this for editor UI changes and their review. The accepted product scope lives in the effort specification; this reference explains boundaries and judgement calls that are easy to miss across components.

## Navigation

| Concern | Start here |
| --- | --- |
| Map title, context label and map commands | `components/WorkspaceMapChrome.vue`, `components/WorkspaceHistoryControls.vue` |
| Application header and workspace search | `components/WorkspaceHeader.vue` (`UDashboardNavbar`), `components/WorkspaceSearch.vue` (`UCommandPalette`); map commands use `UDashboardToolbar` |
| Nested object and Orbit navigation | `components/MapHierarchy.vue` (`UTree`); expansion consults the hierarchy, selection invokes guarded editor commands |
| Guarded commands and session ownership | `components/BaselinePage.vue`, `composables/useEditorWorkflows.ts`, `composables/editor-workflows/` |
| Active versus inspected system and event forwarding | `components/MapInspector.vue`, `components/inspector/JumpRouteInspector.vue`, `components/inspector/ChartDetailsPanel.vue` |
| Object and Orbit consultation/editing | `components/inspector/MapObjectInspector.vue`, `components/inspector/OrbitInspector.vue` |
| Panel sizing, focus and compact recovery | `components/MapEditorLayout.vue`, `components/WorkspaceResizablePanel.vue`, `assets/css/map-workspace.css` |
| Field-definition screens and actions | `components/FieldDefinitionsDialog.vue`, `components/field-definitions/FieldDefinitionEditor.vue` |

Paths above are relative to the repository root. An inspected cluster system can differ from the active system: pass its explicit ID to the existing guarded command. A new UI entry should reuse that command rather than recreate mutation, draft or confirmation logic.

## Design judgement

- Prefer Nuxt UI components and their supported props/slots. Keep custom composition where persistent editor state, map gestures or panel layout require it; explain a new exception when it affects the design.
- Compare related surfaces when changing an interaction. Objects, Orbits, routes, systems and Fields should make the same action recognisable, while creation and consequence reviews retain their distinct purpose.
- Consultation exposes its editing entry; an editing session exposes its own completion actions. Hiding a surface preserves its parent-owned draft. Check the transition between states, not just a screenshot of one state.
- Treat fixed headers, ordinary actions and recovery as parts of the same available space. On compact screens they must leave scrollable content and usable actions; recovery is not a decorative overlay.
- Review focus return, scroll position and pending work across hide/reopen, viewport changes and nested dialogs. Viewport emulation does not certify a physical keyboard or screen reader.

## Placement changes

Define the visible result before changing placement: identify the relevant edges, gap, labels and zoom state. State which neighboring elements stay fixed, whether confirming the current point preserves geometry, and which saved-map compatibility cases apply. Resolve a conflict with those invariants before expanding the change.

Inspect a detail screenshot of the first working slice at a readable zoom before broad verification or declaring visual acceptance. Include the source, target and nearby labels; also inspect compact or minimum-zoom states when affected. Measure the visible gap or hit area through the rendered SVG transform. Keep screenshots in test artifacts or the PR so reviewers can assess the same result.

## Verification

Use `npm run test:ui` for the maintained smoke selection; narrow further with Playwright's existing CLI when appropriate. It checks action states, destructive styling, footer geometry and hit targets, with screenshot attachments in the report. Mechanical assertions belong in tests rather than a growing prose checklist. A pass supplements review of the requested composition and adjacent affected states.

Reuse `tests/helpers.ts` and real public UI flows. `createSingleSystemWorkspace` establishes a one-system precondition; importing a map appends an independent copy and does not establish that precondition. Keep upload, import confirmation and fixture setup explicit.
