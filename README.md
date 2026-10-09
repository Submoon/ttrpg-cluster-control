# TTRPG Cluster Control

**Can be used with Mothership**

A local-first campaign cartography app for Wardens to plan and maintain schematic, not-to-scale maps of Jump Clusters and star systems.

## Build a campaign map

Start with a local Jump Cluster and its first star system. Add more systems from the Cluster map as campaign knowledge grows, then connect their Jump Points with routes.

- **Jump Clusters and routes:** Connect logical Jump Points with Jump Routes using positive integer Jump levels (standard levels are 1–9; higher positive levels are supported). A route can lead to another known Jump Point or a named unresolved exit beyond the known Cluster. A Jump Point may optionally reference a separate physical Station object; the route itself remains a logical connection.
- **Star-system maps:** Choose from catalogue objects including stars, planets, moons, asteroids, belts, Stations, Bases, Colonies, vessels, derelicts, Jump Points, anomalies, nebulae, hazards, and named “Other” objects. Place them at schematic coordinates or in an Orbit.
- **Elliptical Orbits:** Create nested Orbits hosted by map objects or centered on an unoccupied point. Resize either axis, rotate an Orbit, move an unoccupied center, and detach a hosted Orbit while keeping its child placements.
- **Editing workflow:** The Cluster and system views pair the map with a hierarchy and inspectors. Add catalogue objects by clicking or keyboard activation, or drag them onto the chart or an Orbit; the drag preview shows the matching catalogue mark beside the pointer to keep the drop target clear. Deletion previews affected entities and asks for confirmation.
- **Reusable fields:** Edit native options and define typed custom fields (`text`, `number`, `boolean`, and `single-select`) that apply to all catalogue objects or selected categories and subtypes. A value remains on its object when the field is hidden from that object.
- **Map files:** Export a whole Jump Cluster or a standalone star system as versioned JSON. Cluster exports include systems and routes; system exports contain local system data and applicable layout, not Cluster routes. Export the full rendered map as SVG or PNG.

## Local storage and backups

The current workspace is automatically saved in IndexedDB for this browser profile and site origin. Only committed edits persist; unsaved inspector drafts and temporary pan/zoom do not. Storage is local, not cloud-synced, and clearing browser or site data can erase it. Export the Jump Cluster as JSON for backup or transfer. After creating a workspace, validated JSON imports append an independent copy rather than overwrite it. PNG and SVG are map images, not data backups. Load and save errors appear in the app; a failed load can be retried.

## Technology

The app uses Nuxt 4, Vue 3, and TypeScript with server-side rendering enabled. The workspace is hydrated in the browser after mount; D3/SVG map views are rendered inside Vue's `<ClientOnly>` boundary. Tailwind CSS 4 is integrated through the Vite plugin. SVG exports copy the rendered scene and its styles; PNG exports rasterize that SVG through Canvas.

## Setup and development

Recommended: Node.js 24 LTS (`24.15.0` or newer within 24.x), and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Nuxt.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with Nuxt DevTools enabled. |
| `npm run typecheck` | Run Nuxt and TypeScript type checking. |
| `npx playwright install chromium` | Install the Chromium browser required by the browser tests (once per environment). |
| `npm test` | Run the Playwright browser suite; Playwright starts the app at `http://127.0.0.1:3100`. |
| `npm run build` | Build the production app. |
| `npm run preview` | Preview the production build locally; run `npm run build` first. |

Nuxt DevTools is disabled for production builds.

## Project map

| Path | Responsibility |
| --- | --- |
| `pages/index.vue` | Editor composition and cross-view coordination; the only owner of `useLocalWorkspace()`. |
| `composables/useLocalWorkspace.ts` | Nuxt workspace state, browser hydration, serialized commits, and save status. |
| `composables/useEditorWorkflows.ts`, `composables/editor-workflows/` | Compose editor state with focused cluster, map, and field-definition workflows. |
| `composables/useWorkspaceFiles.ts` | JSON and image downloads, import preview, and confirmation. |
| `utils/workspace-storage.ts` | IndexedDB read/write boundary. |
| `domain/workspace.ts`, `domain/workspace-*.ts` | Stable domain facade over focused model, validation, fields, cluster, system objects, Orbits, deletion, schema, codec, and JSON-import modules. |
| `components/` | Focused header, welcome, palette, hierarchy, inspector, field-definition, map-layout, and map-view UI. `components/inspector/` and `components/field-definitions/` hold focused subviews; `components/maps/system-map-renderer.ts` owns the D3/SVG system-map renderer. `MapEditorLayout.vue` stays mounted between map modes, so panel-collapse state is shared. |
| `utils/` | Map geometry, zoom, catalogue marks, and SVG/PNG image export. |
| `assets/css/main.css`, `assets/css/map-workspace.css` | Global and workspace styles, including unscoped styles for D3-created SVG elements. |
| `tests/` | Six focused Playwright specs and shared browser helpers. |
| `CONTEXT.md` | Domain terms and relationships. |

## License

This repository's code and documentation are licensed under the [MIT License](LICENSE). Third-party dependencies remain subject to their respective licenses.

Mothership® is a trademark of Tuesday Knight Games. This project is an unofficial fan-made tool and is not affiliated with or endorsed by Tuesday Knight Games.
