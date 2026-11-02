# TTRPG Cluster Control

**Can be used with Mothership**

A local-first campaign cartography app for Wardens to plan schematic, not-to-scale Jump Cluster and star-system maps.

[Open the app on Vercel](https://ttrpg-cluster-control.vercel.app/)

The editor supports desktop and mobile layouts, light/dark themes, catalogue objects and Orbits, logical Jump Routes, and reusable custom fields.

## Using the editor

- Use the bottom dock: **Select** (default) to inspect, **Navigate** to pan or enter systems, **Move** to reposition map elements, and **Add** for repeated placement.
- Open **Hierarchy** to browse the map and **Inspect** for details. Panels fill the screen on mobile; closing a panel preserves its draft.
- Use **Search** from either map context to find the current Jump Cluster or any star system by name, or an object in any system by name or Location key. Choosing an object frames its hosted Orbit branch. Existing draft guards still apply.
- Choose **Edit** to make changes, then **Apply** or **Discard**. From a system's cluster inspector, **Open system** enters its map without changing tools. Deletions show their consequences before confirmation; the last system cannot be deleted.
- Open **Fields** to manage reusable definitions. Use **Map files** for JSON import/export and clean SVG/PNG images, with an optional light print palette.
- In chart details, choose **Edit chart details** to set the independent **Player-facing title** and how players see the selected system: Hidden, Unknown presence, Known type, or Revealed. New systems start as Known type; systems from older maps start Hidden.
- Object editing offers the same four publication modes. New objects start as Known type; legacy objects start Hidden. Publication changes preserve their source content and geometry.
- Object editing separates **Player text** from private **GM notes**. In **Fields**, choose **Share with players** for native or custom definitions; an object can additionally hide an individual value. Only Revealed objects publish their player text and permitted, applicable Field values. Other selection options remain private.
- Jump Route editing offers **Share with players** independently of its Jump Points. A shared route needs at least one visible system; a Hidden endpoint appears as an unknown destination at its exact map position. Pan, zoom and Fit in the player preview keep distant destinations inspectable. Source route resolution remains unchanged. A physical Station association appears only when both objects are Revealed.
- **Preview player view** shows committed player-visible content in a Warden-side dialog. Only Revealed systems open their internal player map. Required secret Orbit hosts appear anonymously, while unrelated hidden objects stay absent. The preview includes only permitted text, values, routes and associations. GM notes, Location keys, private definitions/options and private counts stay excluded.
- In **Map files**, **Generate player link** creates an immutable snapshot of the whole published cluster. Copy the retained link or select it for manual copying. Anyone with the link can read and copy that snapshot; later edits require generating a new link. Each player tab is independent, and reloading a link restores its snapshot. Ordinary base-site tabs still reopen the saved Warden workspace.
- Player links contain compressed public data in the URL fragment, without a map service, database or account. The hosted application is still required. The complete URL is limited to 8,192 UTF-8 bytes; this application limit does not guarantee acceptance by every messenger. If the snapshot is too large or native compression is unavailable, use **Export player JSON**. **Open player JSON** opens the standalone reader in another tab; recipients can also visit `/player` and choose the file. A file stays in that tab's memory and must be reopened after reload. Invalid links show an error and offer the JSON reader.
- **Export player SVG** and **Export player PNG** download the current public map with the active or light print palette. Internal system images require a Revealed system with visible objects. Empty shares and images without public features are refused. Complete Warden backup and image actions remain available separately.

## Local data

Applied changes are saved automatically in IndexedDB, separately for each browser profile and site origin. A last-valid snapshot supports recovery when the current workspace cannot load; failed saves offer retry and JSON recovery actions. Unapplied drafts and temporary pan/zoom are session state. Storage is local, not cloud-synced; clearing browser/site data can erase it. Export Jump Cluster JSON for backup or transfer. Validated imports append an independent copy rather than overwrite existing work. SVG/PNG files are images, not data backups.

New complete JSON backups use source format version 4 and retain publication settings, player text, GM notes, Field masks and all preparation data. Version 1 imports remain supported with Hidden system/object publication. Version 2 imports preserve their system settings and initialize their legacy objects Hidden. Version 3 imports preserve system/object visibility. Earlier formats initialize player text empty and Fields/routes private. Appending an imported cluster preserves compatible incoming publication settings and the destination cluster's player-facing title; it does not replace the destination chart metadata. Conflicting native or same-name custom Field publication policies must be aligned before importing again; they never silently broaden sharing. New backups are not guaranteed to open in older application versions.

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

GitHub Actions runs lint, type checking, a production build and the full Playwright suite on pull requests and pushes to `main`. Playwright reports and attachments are available as workflow artifacts. For local changes, see [verification guidance](docs/agents/testing.md).

Technical references: [editor architecture](docs/architecture/editor.md), [source conventions](docs/agents/conventions.md), and [UI guidance](docs/agents/ui.md). Agent coordination follows [the development workflow](.agents/skills/project-development/SKILL.md).

## License

This repository's code and documentation are licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses.

Mothership® is a trademark of Tuesday Knight Games. This unofficial fan-made tool is not affiliated with or endorsed by Tuesday Knight Games.
