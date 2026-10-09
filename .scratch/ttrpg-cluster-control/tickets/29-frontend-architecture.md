---
title: 29. Reviewing and modularizing the frontend architecture
label: wayfinder:implement
type: implement
status: closed
assignee: Copilot
parent: "[TTRPG Cluster Control - V1 Specification](../map.md)"
---

# 29. Reviewing and modularizing the frontend architecture

## What to build

As a maintainer, I can navigate the application UI and browser tests by cohesive responsibility, rather than having unrelated features concentrated in a few large files.

## Required sequence

1. Before changing code, review the frontend architecture with GPT-6.1 Sol at XHigh reasoning. Trace the Nuxt page, Vue components, domain and utility modules, styles, and Playwright tests; identify cohesive boundaries, dependencies, migration order, and regression risks. Record a concise review and refactoring plan in this ticket.
2. Implement the approved refactor with GPT-6 Luna at Max reasoning, following the review.

## Acceptance criteria

- The main page and map components delegate cohesive UI responsibilities to focused Vue components and modules; the refactor avoids both giant catch-all files and trivial one-purpose wrappers.
- The Playwright coverage is split into focused spec files by behavior or user workflow, while `npm test` continues to run the complete suite.
- Existing map behavior, accessibility, persistence, import/export, and responsive layouts remain unchanged.
- Shared test helpers are extracted only where multiple specs need them; no dependency is added solely for the refactor.
- Typecheck, the complete test suite, and production build pass after the refactor.
- The ticket resolution records the resulting file/component and test boundaries, plus any material trade-offs.

## First-pass architecture review and approved plan

- `pages/index.vue` combines workspace coordination with field-definition, object/Orbit, file, palette, hierarchy, inspector, and responsive-panel UI. Extract cohesive UI with its local interaction state rather than adding pass-through wrappers.
- `SystemMap.vue` combines D3 rendering and gestures with pure orbital geometry; `ClusterMap.vue` is comparatively cohesive. Keep the framework-independent domain operations and the single `useLocalWorkspace` persistence owner intact.
- The 35 Playwright cases cover several workflows in one file. `npm test` uses Playwright's default discovery under `tests`, so focused spec files need no configuration change.

Proposed refactor:

1. Extract `ObjectPalette.vue`, `MapHierarchy.vue`, `MapInspector.vue`, `FieldDefinitionsDialog.vue`, and the shared responsive `MapEditorLayout.vue`. Keep workspace selection, cross-view coordination, and persistence in the page; extracted modules own their UI state and emit typed actions.
2. Extract pure orbital geometry into `utils/system-map-geometry.ts`; keep SVG ownership, D3 rendering, accessible controls, gestures, and export in `SystemMap.vue`.
3. Keep `ClusterMap.vue`, `domain/workspace.ts`, and existing persistence/export utilities intact unless implementation reveals a real shared responsibility; add no dependencies.
4. Split existing Playwright coverage into `workspace-ui`, `system-map`, `system-orbits`, `cluster-map`, `object-fields`, and `workspace-data` specs. Preserve existing scenarios and assertions; extract only helpers used by multiple specs.
5. Move styles with extracted UI while preserving responsive transitions and styles for D3-created SVG elements.

## First-pass outcome

- Final code review found and fixed a stale-edit prompt after deleting a field definition; a browser assertion now verifies the dialog selects the Atmosphere editor after deletion.

- `pages/index.vue` remains the single `useLocalWorkspace()` persistence owner and coordinates selection, cross-view actions, deletion confirmation, and unsaved-edit protection. `ObjectPalette.vue`, `MapHierarchy.vue`, `MapInspector.vue`, and `FieldDefinitionsDialog.vue` now own their cohesive UI state and typed actions; `MapEditorLayout.vue` provides the shared responsive panels.
- `utils/system-map-geometry.ts` contains pure orbital geometry. `SystemMap.vue` retains D3/SVG DOM ownership, accessible controls, gestures, zoom/fit, export, and its public props/events/handle contract. `ClusterMap.vue`, the domain, and persistence/export utilities were left intact.
- The existing 35 Playwright cases are grouped into `workspace-ui`, `system-map`, `system-orbits`, `cluster-map`, `object-fields`, and `workspace-data`; shared browser helpers are in `tests/helpers.ts`. Styles moved with their UI modules while D3-created SVG styles remain global.
- Validation passed: `npm run typecheck`, `npm test` (35 passed), `npm run build`, and `git diff --check`.
- Trade-off: the shared editor layout stays mounted when switching map modes, so panel-collapse state is shared between the two views.

## Second-pass architecture review and implementation plan

GPT-6.1 Sol (XHigh) reviewed the remaining large modules after the first pass. At review time, the main candidates were `pages/index.vue` (2,554 lines), `domain/workspace.ts` (2,124), `FieldDefinitionsDialog.vue` (1,216), `SystemMap.vue` (1,152), `MapInspector.vue` (1,143), and `ClusterMap.vue` (562). Under 500 lines is a useful target for most components, not a reason to split cohesive rendering or add pass-through wrappers.

1. Keep `domain/workspace.ts` as the stable import façade and move cohesive implementations behind it: model, validation, fields, cluster, system objects, Orbits, deletion, schema, codec, and JSON import. Use explicit re-exports; internal modules must import each other directly rather than through the façade, avoiding dependency cycles. Add a domain operation such as `replaceWorkspaceSystem` where it removes page-owned domain mutation.
2. Reorganize `pages/index.vue` around editor coordination. Extract cohesive header/file/welcome UI and workflow commands into focused components or composables, but keep exactly one `useLocalWorkspace()` owner and preserve its save queue, revision, and error behavior.
3. Reduce `MapInspector.vue` and `FieldDefinitionsDialog.vue` by moving coherent state-owning views or logic behind smaller interfaces. Preserve drafts, save acknowledgements, destructive-change previews, confirmation behavior, focus, and accessibility.
4. Further modularize the map renderers only at real seams. Keep D3/SVG ownership, accessible controls, gestures, drag MIME and coordinate behavior, responsive layout, and image-export styling intact. Avoid fragmenting a cohesive renderer merely to meet a line count.
5. Run the domain/contracts change first. Once its interface is stable, implement the page/workflow, inspector, field-dialog, and map packets in parallel with exclusive file ownership, then integrate and validate the full suite.

### Pinia decision

Do not add Pinia in this refactor. This is currently a single editor route; workspace load/save state already uses Nuxt's SSR-safe `useState`, IndexedDB remains the persistence layer, and most selection, draft, and panel state is scoped to the page or owning UI module. Component extraction alone does not justify a global store. Keep `pages/index.vue` as the single `useLocalWorkspace()` owner and pass the workspace, commit operation, and needed status to workflow composables rather than invoking that composable again. Its save queue and revision guard are per invocation, so correctness currently relies on that single owner. Reconsider Pinia if multiple routes or autonomous long-lived consumers need to coordinate workspace mutations beyond the editor's lifetime.

## Blocked by

None. Tickets 27 and 28 are closed, so the follow-up refactor can proceed.

## Resolution

- `domain/workspace.ts` remains the stable import façade; its model, validation, fields, cluster, system objects, Orbits, deletion, schema, codec, and JSON import implementations now live in focused domain modules. `replaceWorkspaceSystem(workspace, system)` centralizes whole-system replacement and preserves layout pruning.
- `pages/index.vue` is 326 lines and remains the sole `useLocalWorkspace()` owner. Header, welcome, and file workflows are extracted; `useEditorWorkflows` composes focused state, cluster, map, and field-definition workflows while preserving its page contract. The 966-line page style block now loads unchanged and unscoped from `assets/css/map-workspace.css`.
- The major Vue files are now below 500 lines: `FieldDefinitionsDialog.vue` (495), `MapInspector.vue` (229), `SystemMap.vue` (404), and `ClusterMap.vue` (487). Inspector and field-dialog submodules own cohesive panels and drafts. `components/maps/system-map-renderer.ts` keeps D3/SVG ownership behind a focused interface; its implementation remains larger because rendering and gesture behavior are cohesive.
- The existing 35 Playwright cases remain grouped into six workflow specs, with shared helpers in `tests/helpers.ts`. No dependencies were added.
- Pinia was intentionally not introduced: Nuxt `useState` and scoped refs fit the single editor route, and the one persistence owner preserves save-queue/revision semantics. Reconsider a global store only if multiple routes or autonomous long-lived consumers need coordinated workspace mutations.
- Validation passed: `npm run typecheck`, `npm test` (35 passed), `npm run build`, and `git diff --check`. Playwright logged non-fatal Nuxt/Vite `#app-manifest` diagnostics during the run.
- Trade-off: the shared `MapEditorLayout` stays mounted while switching map modes, so panel-collapse state is shared between the two views.

## Source specs

- [TTRPG Cluster Control - V1 Specification](../map.md)
- [04. Choosing the V1 application and rendering architecture](04-application-architecture.md)
- [06. Building a star-system map with nested Orbits](06-star-system-map.md)
- [16. Making the workspace darker and more map-first](16-map-first-visual-refresh.md)
