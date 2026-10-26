# TTRPG Cluster Control

**Can be used with Mothership**

A local-first campaign cartography app for Wardens to plan schematic, not-to-scale Jump Cluster and star-system maps.

[Open the app on Vercel](https://ttrpg-cluster-control.vercel.app/)

The editor supports desktop and mobile layouts, light/dark themes, catalogue objects and Orbits, logical Jump Routes, and reusable custom fields.

## Using the editor

- Use the bottom dock: **Select** (default) to inspect, **Navigate** to pan or enter systems, **Move** to reposition map elements, and **Add** for repeated placement.
- Open **Hierarchy** to browse the map and **Inspect** for details. Panels fill the screen on mobile; closing a panel preserves its draft.
- Choose **Edit** to make changes, then **Apply** or **Discard**. From a system's cluster inspector, **Open system** enters its map without changing tools. Deletions show their consequences before confirmation; the last system cannot be deleted.
- Open **Fields** to manage reusable definitions. Use **Map files** for JSON import/export and clean SVG/PNG images, with an optional light print palette.

## Local data

Applied changes are saved automatically in IndexedDB, separately for each browser profile and site origin. A last-valid snapshot supports recovery when the current workspace cannot load; failed saves offer retry and JSON recovery actions. Unapplied drafts and temporary pan/zoom are session state. Storage is local, not cloud-synced; clearing browser/site data can erase it. Export Jump Cluster JSON for backup or transfer. Validated imports append an independent copy rather than overwrite existing work. SVG/PNG files are images, not data backups.

## Development

Use Node.js 24.x (`24.15.0` or newer) and npm.

```sh
npm ci
npm run dev
```

| Command or variable | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. Nuxt DevTools is disabled. |
| `npm run lint` | Check Vue/TypeScript correctness with ESLint; warnings fail the check. |
| `npm run test:ui` | Run the focused UI smoke selection, including desktop and compact layouts. |
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

For split execution, start both the Vite development app and compiled app, then set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_PRODUCTION_URL`. The default test run uses development only.

GitHub Actions runs lint, type checking, a production build and the full Playwright suite on pull requests and pushes to `main`. Playwright reports and attachments are available as workflow artifacts. For local changes, start with the checks relevant to the affected behavior; see [the development workflow](.agents/skills/project-development/SKILL.md) and [UI guidance](docs/agents/ui.md).

## License

This repository's code and documentation are licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses.

Mothership® is a trademark of Tuesday Knight Games. This unofficial fan-made tool is not affiliated with or endorsed by Tuesday Knight Games.
