# TTRPG Cluster Control

**Can be used with Mothership**

A local-first campaign cartography app for Wardens to plan schematic, not-to-scale Jump Cluster and star-system maps.

[Open the app on Vercel](https://ttrpg-cluster-control.vercel.app/)

The Warden editor, its player preview, and the standalone player reader use continuous maps. Players see only the content included in a published player document.

## Using the Warden editor

- Use the map tools **Select**, **Move**, and **Add**. Use the mouse wheel or pinch to zoom between the Jump Cluster overview and system detail; drag empty map space with one finger or right-drag with a mouse to pan. **Fit map** shows the whole Cluster; **Center selection** frames an inspected system, object, Orbit, or Jump Route. Select a system or map item to inspect it on the same canvas.
- In **Select**, click or tap an item to inspect it. On touch, long-press an object to toggle it in or out of the group selection. On desktop, Shift-, Ctrl-, or Cmd-click toggles an object; drag from empty map space to select objects in a rectangle. In **Select** or **Move**, drag an already selected object to move the whole selection. A group can span systems. Right-click a map or Hierarchy item, or focus it and press Shift+F10 or the Context Menu key, to open its context menu; use **Change Visibility** or **Delete** there, choose **Move selection** to move a group, and use **Edit** in Inspect for details.
- Select a system by its name, then drag the name to move the system. In **Select**, the selected system or Orbit shows its editing handles. To add a system, choose open map space outside the existing system frames and names.
- Use **Hierarchy** to browse systems and objects, **Inspect** for the current selection, and **Search** to find the Jump Cluster, a system, or an object in the current workspace. Search matches object names and Location keys. Choose a result to reveal it on the continuous map. Press Ctrl+K or Cmd+K to open Search.
- In Inspect, choose **Apply changes** or **Discard** to complete an edit. Deletions show their consequences before confirmation. Use **Undo** and **Redo** for applied changes.
- Open **Fields** to manage reusable field definitions. The map filters and Search filters can narrow objects by type, publication, and field values.

### Map files

**Map files** groups file and image actions into **Download or back up**, **Import or restore**, **Export an image**, and **Share with players**.

- Download or back up the private Jump Cluster or selected Star System as JSON, or use a configured cloud backup provider. Import a Star System as a reviewed copy, or restore a complete Jump Cluster backup after review.
- Warden images can export as PNG or SVG with the active palette or a light print palette. Choose **Entire Cluster**, **Selected system**, or **Current viewport** for the image area. Use **Export a system…** to filter by name and choose a Star System for Warden image export. Warden images include private map content.
- Player images export only published content. In the player preview and standalone reader, **Map files** offers the same image areas when available for the current public document. A selected-system image is available only for a Revealed system.
- **Share with players** opens the player preview, exports player JSON, opens the standalone reader, or generates a player link. A player link is an immutable snapshot of the published Jump Cluster; generate a new link to share later edits.

### Publishing

Set each system and object to **Hidden**, **Unknown presence**, **Known type**, or **Revealed**. Object publication is independent of system visibility. Edit **Player text** separately from private **GM notes**; choose which fields and individual values players can see. Share Jump Routes independently from the systems they connect. The preview and reader contain only published text, values, and relationships; private notes, Location keys, and Warden-only data stay out of player files and images.

A player link contains compressed public data in its URL fragment and does not require an account or map service. The hosted application is still required. The complete URL is limited to 8,192 UTF-8 bytes, which may exceed some messengers' limits. If a link is too large or compression is unavailable, export **player JSON** instead. Open a file in the standalone reader, or visit `/player` and choose the file. A file stays in that tab's memory and must be reopened after reload; reloading a generated link restores its snapshot.

## Local data

Applied changes save automatically in IndexedDB, separately for each browser profile and site origin. The app keeps a last-valid snapshot for recovery if the current workspace cannot load. Unapplied drafts and map view state are temporary. Clearing browser site data can erase the local workspace.

Complete Jump Cluster backups contain editable Warden data. Current complete Cluster exports use format version 6. Standalone Star System exports use version 5. Complete backups keep legacy Location key assignments, and standalone imports review any key replacements before creating an independent copy. Supported earlier backup versions remain importable. Player JSON uses a separate public document format, and player links contain a snapshot of that public document.

See [Google Drive setup](docs/google-drive-backups.md) and [Dropbox setup](docs/dropbox-setup.md) for provider configuration and backup behavior.

## Development

Use Node.js 24.x (`24.15.0` or newer) and npm.

```sh
npm ci
npm run dev
```

Run `npm run lint` and `npm run typecheck` for source checks. Install Chromium with `npx playwright install chromium` before running browser tests. See [verification guidance](docs/agents/testing.md) for focused commands, runner variables, and CI artifacts.

Technical references: [editor architecture](docs/architecture/editor.md), [source conventions](docs/agents/conventions.md), and [UI guidance](docs/agents/ui.md).

## License

This repository's code and documentation are licensed under the [MIT License](LICENSE). Third-party dependencies retain their own licenses.

Mothership® is a trademark of Tuesday Knight Games. This unofficial fan-made tool is not affiliated with or endorsed by Tuesday Knight Games.
