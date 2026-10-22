# TTRPG Cluster Control

**Can be used with Mothership**

A local-first campaign cartography app for Wardens to plan schematic, not-to-scale Jump Cluster and star-system maps.

The saved-workspace editor opens at `/` and reads/writes the current workspace in this browser profile and site origin. It supports map navigation, catalogue objects and Orbits, logical Jump Routes, reusable Fields, JSON interchange, recovery, and SVG/PNG map images. Historical prototype experiments are retired from the product workflow.

## Local data

Committed workspace data is saved automatically in IndexedDB. A last-valid snapshot supports recovery when the current workspace cannot load. Unsaved inspector drafts and temporary pan/zoom are session state. Storage is local, not cloud-synced; clearing browser/site data can erase it. Export Cluster JSON for backup or transfer. Validated imports append an independent copy rather than overwrite existing work. SVG/PNG files are images, not data backups.

## Development

Use Node.js 24.x (`24.15.0` or newer) and npm.

```sh
npm ci
npm run dev
```

| Command or variable | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. Nuxt DevTools is disabled. |
| `npm test` | Run Playwright against the development app; it starts the app when no external base URL is set. |
| `PLAYWRIGHT_BASE_URL` | Optional URL of an already-running development app; disables Playwright's automatic web server. |
| `PLAYWRIGHT_PRODUCTION_URL` | Optional compiled-app URL; enables split execution, with the Vite-only IndexedDB preservation case kept on development. |
| `PLAYWRIGHT_CHANNEL` | Optional browser channel, such as Chrome. |
| `PLAYWRIGHT_OUTPUT_DIR` | Optional Playwright artifact output directory. |
| `PLAYWRIGHT_JSON_OUTPUT_NAME` | Optional JSON reporter output filename. |
| `npm run typecheck` | Run Nuxt and TypeScript type checking. |
| `npm run build` | Build the production app. |
| `npm run preview` | Serve the production build locally; build first. |
| `npx playwright install chromium` | Install the Chromium browser needed by browser tests. |

For split execution, start both the Vite development app and compiled app, then set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_PRODUCTION_URL`. The default test run uses development only. Nuxt DevTools is disabled in development and production builds.

## License

This repository's code and documentation are licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses.

Mothership® is a trademark of Tuesday Knight Games. This unofficial fan-made tool is not affiliated with or endorsed by Tuesday Knight Games.
