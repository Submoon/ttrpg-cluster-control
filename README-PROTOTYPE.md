# TTRPG Cluster Control UI prototype

This disposable prototype compares three layouts over the same seeded Jump Cluster and star-system maps. It lives at `/` only when the URL has `?variant=A`, `?variant=B`, or `?variant=C`; opening `/` without a supported variant mounts the existing baseline page. The development-only switcher changes the query string, and its Share button copies the current variant URL.

## Run

From the repository root, run:

```sh
npm run prototype
```

The Nuxt development server listens on `http://127.0.0.1:3113`. This command does not build or publish the product.

## What is connected

The prototype renders the existing D3/SVG cluster and system maps in a client-only canvas. Map pan/zoom, system opening, explicit return to the cluster, and map selection use those renderers. The three shells use the same in-memory workspace, selection, active tool, inspector draft, and theme; each shell owns its own map viewport instance. Navigation is the initial tool; add tools are explicit and return to Navigation after placement, while Move / Modify remains active. The inspector can be hidden and reopened without dropping edits, and context changes offer Stay, Apply, and Discard.

Nuxt UI provides the shared buttons, fields, selects, badges, menus, and dialogs. The map canvas remains a targeted custom surface because the existing SVG map interactions and a non-modal inspector need to stay visible together. Prototype maps mount inside `ClientOnly` and `KeepAlive`; the baseline page remains a separate component and is not mounted when a prototype variant is selected.

## Prototype-only behavior

There is no IndexedDB write, backend, account, sync, or durable workspace state in these variants. The seed, edits, route and field changes, import candidate, and confirmed deletions are held in memory and reset on reload. Apply updates the sample; its simulated save deliberately fails once and then succeeds when Retry is pressed. Import uses the existing JSON preparation helper for a preview, but does not replace a saved workspace. The delete dialog applies the domain deletion plan to the sample only.

SVG and PNG exports are real downloads from the currently applied in-memory map. They use a print-light palette; unapplied inspector edits and an in-progress map gesture are excluded. Applied sample edits remain exportable even when the simulated save indicator is in its error state. Theme and map view state are session-local. No browser storage is used for the prototype preference.

This prototype is for choosing an interaction and layout direction. It does not establish product guarantees for offline behavior, persistence, mobile touch gestures, accessibility conformance, performance, or server rendering. It has not been measured against production workload or device coverage.

## Validation

`npm run typecheck` and `npm run build` passed. On the Windows sandbox, the first build attempt could not resolve a dependency real path; rerunning the same build with the authorized filesystem access completed successfully. A manual Chrome walkthrough covered cluster/system navigation, route-draft context guarding, hide/reopen, theme and variant switching, apply and simulated retry, SVG/PNG export, and the phone/short-landscape inspector controls. Nine viewport renders had no captured JavaScript errors, hydration warnings, or horizontal overflow. This smoke check is limited to the prototype paths exercised.
